import React from 'react';
import { ServerRoot } from '../../utils/constants';
import { markServiceOnline } from '../../utils/serviceStatus';
import { renegotiateLocalServerRoot } from '../../utils/backendIdentity';

// 2026-07-04 事故复盘:探测地址必须每次从活绑定 ServerRoot 现算——旧版 useMemo 把 URL 冻结,
// 服务地址自愈换根后本组件仍对旧(毒)端口无限轮询。
function currentProbeUrl() {
  return ServerRoot ? `${String(ServerRoot).replace(/\/$/, '')}/heartbeat` : '';
}

// P0 启动稳健化:本地后端就绪前的全屏「正在连接本地服务」覆盖层,取代「白屏 / 进不去主界面」。
//
// 纯增量、安全回退(铁律⑦):
//  · 后端正常时——首次探测即通过 → 立刻 return null、零 DOM、对正常启动零观感影响;
//  · 后端未就绪时——显示覆盖层并**持续自动退避重试**,任意 HTTP 响应(含 4xx/超时=后端在世)都立即放行,
//    仅「网络层不可达(TypeError/连接被拒)」才继续等;**永不永久 hang**——一直重试 + 提供「重试」按钮与重启提示;
//  · 不依赖、不改动既有 request.js / chartFetch / 离线横幅逻辑;无有效后端地址(纯网页托管)时不拦截。
//
// Mac issue #12 增强:
//  · 分阶段文案(10s / 30s / 60s 不同提示信息);
//  · Tauri 环境下加「打开诊断中心」「重启后端」操作按钮;
//  · 长时间未就绪时显示后端地址,便于用户检查。
export default function StartupGate() {
  const [ready, setReady] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0); // 秒
  const startRef = React.useRef(Date.now());

  React.useEffect(() => {
    if (!currentProbeUrl() || typeof fetch !== 'function') { setReady(true); return undefined; }
    let cancelled = false;
    let timer = null;
    const ticker = setInterval(() => {
      if (!cancelled) setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);

    const pass = () => { if (cancelled) return; markServiceOnline(); setReady(true); };

    const probe = (attempt) => {
      if (cancelled) return;
      let abortTimer = null;
      try {
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        if (ctrl) abortTimer = setTimeout(() => { try { ctrl.abort(); } catch (e) { /* noop */ } }, 2500);
        // 每次现算探测地址(活绑定):自愈换根后下一次探测自动落在新根。
        fetch(currentProbeUrl(), { method: 'GET', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
          .then(() => { if (abortTimer) clearTimeout(abortTimer); pass(); })
          .catch((err) => {
            if (abortTimer) clearTimeout(abortTimer);
            if (cancelled) return;
            // 超时/中断 = 后端在世只是慢 → 放行,避免卡在慢启动。
            if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) { pass(); return; }
            // 连败若干次 → 触发一次服务地址再协商(单飞+节流,便宜):
            // 地址可疑(端口被占/存储陈旧)时,换到已验证的根后本环自动跟上。
            if (attempt > 0 && attempt % 4 === 0) {
              try {
                const p = renegotiateLocalServerRoot('startup-gate');
                if (p && p.catch) { p.catch(() => {}); }
              } catch (e) { /* 自愈失败不影响重试环 */ }
            }
            // 网络层不可达:退避重试(上限 2.5s),永不放弃。
            timer = setTimeout(() => probe(attempt + 1), Math.min(2500, 300 + attempt * 300));
          });
      } catch (e) {
        timer = setTimeout(() => probe(attempt + 1), 800);
      }
    };
    probe(0);
    return () => { cancelled = true; if (timer) clearTimeout(timer); clearInterval(ticker); };
  }, []);

  const manualRetry = () => {
    if (!currentProbeUrl()) { setReady(true); return; }
    // 手动重试先自愈再探测(等价 ChartServiceErrorModal 的「立即重试」语义)。
    Promise.resolve()
      .then(() => renegotiateLocalServerRoot('startup-gate-manual'))
      .catch(() => null)
      .then(() => fetch(currentProbeUrl(), { method: 'GET', cache: 'no-store' }))
      .then(() => { markServiceOnline(); setReady(true); })
      .catch(() => { /* 仍不可达,继续显示 */ });
  };

  const hasTauri = typeof window !== 'undefined' && !!window.__TAURI__;
  const restartBackend = () => {
    if (!hasTauri) return;
    try {
      const api = window.__TAURI__.core || window.__TAURI__;
      if (api && api.invoke) api.invoke('trigger_runtime_repair_command');
    } catch (_) { /* swallow */ }
  };
  const openDiagnostics = () => {
    if (!hasTauri) return;
    try {
      const api = window.__TAURI__.core || window.__TAURI__;
      if (api && api.invoke) api.invoke('open_diagnostics_window_command');
    } catch (_) { /* swallow */ }
  };

  if (ready) return null;

  // 分阶段文案：6s 内首次启动正常等；6-15s 提示在解压；15-30s 提示首启较慢；30s+ 提示可能需手动重启
  let mainMsg = '首次启动需准备本地排盘引擎,通常约 10 秒,请稍候。';
  let extraMsg = null;
  if (elapsed >= 30) {
    mainMsg = '本地服务长时间未就绪 (已等待 ' + elapsed + 's)。';
    extraMsg = '建议:点「重启后端」让 app 重新启动本地服务；若仍无效请打开诊断中心查看日志或重启 星阙 整体。';
  } else if (elapsed >= 15) {
    mainMsg = '首次启动较慢 (已等待 ' + elapsed + 's)。';
    extraMsg = '正在解压运行时 (~2GB),首次安装/升级后耗时 20-60 秒属正常。如长时间无响应可点「重启后端」。';
  } else if (elapsed >= 6) {
    mainMsg = '正在准备本地服务 (' + elapsed + 's)…';
    extraMsg = '若超过 30 秒仍未就绪,可点「重试」或下方「重启后端」。';
  }

  const overlay = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 4000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--horosa-bg, #0b0d10)', color: 'var(--horosa-text, inherit)',
  };
  const card = {
    textAlign: 'center', padding: '28px 36px', borderRadius: 14, maxWidth: 460,
    background: 'var(--horosa-surface, rgba(255,255,255,0.94))',
    border: '1px solid var(--horosa-border, rgba(0,0,0,0.1))',
    boxShadow: 'var(--horosa-small-shadow, 0 8px 24px rgba(0,0,0,0.12))',
  };
  const spinner = {
    margin: '0 auto 14px', width: 30, height: 30, borderRadius: '50%',
    border: '3px solid var(--horosa-border, rgba(0,0,0,0.15))',
    borderTopColor: 'var(--horosa-accent, #9a6a25)', animation: 'horosaStartupSpin 0.8s linear infinite',
  };
  const btnPrimary = {
    fontSize: 13, padding: '5px 18px', borderRadius: 8, cursor: 'pointer',
    border: '1px solid var(--horosa-accent, #9a6a25)',
    background: 'var(--horosa-accent-soft, rgba(154,106,37,0.12))',
    color: 'var(--horosa-accent-strong, #7a541c)',
  };
  const btnSecondary = {
    fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid var(--horosa-border, rgba(0,0,0,0.15))',
    background: 'transparent',
    color: 'var(--horosa-text-soft, #666)',
    marginLeft: 8,
  };

  return (
    <div style={overlay} aria-live="polite" role="status">
      <div style={card}>
        <div style={spinner} />
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>正在连接本地服务…</div>
        <div style={{ fontSize: 12.5, color: 'var(--horosa-text-soft, #888)', lineHeight: 1.6 }}>
          {mainMsg}
        </div>
        {extraMsg ? (
          <div style={{ fontSize: 12, color: 'var(--horosa-text-soft, #888)', lineHeight: 1.55, marginTop: 8, padding: '6px 10px', background: 'var(--horosa-bg-soft, #f6f6f9)', borderRadius: 6 }}>
            {extraMsg}
          </div>
        ) : null}
        {elapsed >= 6 ? (
          <div style={{ marginTop: 14 }}>
            <button type="button" onClick={manualRetry} style={btnPrimary}>重试</button>
            {hasTauri && elapsed >= 15 ? (
              <button type="button" onClick={restartBackend} style={btnSecondary}>🔧 重启后端</button>
            ) : null}
            {hasTauri && elapsed >= 30 ? (
              <button type="button" onClick={openDiagnostics} style={btnSecondary}>🔍 诊断</button>
            ) : null}
          </div>
        ) : null}
        {elapsed >= 30 && currentProbeUrl() ? (
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--horosa-text-soft, #999)', wordBreak: 'break-all' }}>
            后端地址: {currentProbeUrl()}
          </div>
        ) : null}
        <style>{'@keyframes horosaStartupSpin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  );
}
