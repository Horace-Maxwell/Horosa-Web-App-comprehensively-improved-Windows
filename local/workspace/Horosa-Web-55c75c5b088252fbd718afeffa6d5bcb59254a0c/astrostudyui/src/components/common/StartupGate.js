import React from 'react';
import { isDesktopBridgeAvailable, getDesktopInvokeApi } from '../../utils/aiAnalysisDesktop';
import { ServerRoot } from '../../utils/constants';
import { markServiceOnline } from '../../utils/serviceStatus';
import { renegotiateLocalServerRoot } from '../../utils/backendIdentity';
import { bootContext } from '../../utils/backendBootGate';   // [R5 S8] 壳送来的启动上下文(early / 更新后首启 / 壳启动时刻)

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
  // [R5 S8] 桌面壳提前导航时「已用时」从壳启动时刻起算(URL boot=epoch 毫秒),页面挂载前那段也算进去;
  // 更新后首启(firstLaunch=1)从 t=0 就给出「更新已完成,正在恢复启动」的明确文案,不再等 6 s 阈值。
  const bootCtxRef = React.useRef(bootContext());
  const startRef = React.useRef(bootCtxRef.current.bootStartedAtMs || Date.now());
  const [elapsed, setElapsed] = React.useState(() => Math.max(0, Math.floor((Date.now() - startRef.current) / 1000))); // 秒

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

  const hasTauri = isDesktopBridgeAvailable();   // 打包版无 window.__TAURI__,只探它=按钮永不出现
  const restartBackend = () => {
    if (!hasTauri) return;
    try {
      const api = getDesktopInvokeApi();
      if (api && api.invoke) api.invoke('trigger_runtime_repair_command');
    } catch (_) { /* swallow */ }
  };
  const openDiagnostics = () => {
    if (!hasTauri) return;
    try {
      const api = getDesktopInvokeApi();
      if (api && api.invoke) api.invoke('open_diagnostics_window_command');
    } catch (_) { /* swallow */ }
  };

  if (ready) return null;

  // 分阶段文案：6s 内首次启动正常等；6-15s 提示在解压；15-30s 提示首启较慢；30s+ 提示可能需手动重启
  let mainMsg = '首次启动需准备本地排盘引擎,通常约 10 秒,请稍候。';
  let extraMsg = null;
  if (bootCtxRef.current.firstLaunch && elapsed < 15) {
    // [R5 S8] 更新后首启:壳以前把这句写在启动页上;现在提前进界面,由本层顶着同一句。
    mainMsg = '更新已完成,正在恢复启动,通常约 10 秒,请稍候。';
  }
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

  // 🔴 视觉与壳启动页(Horosa_Desktop_Installer/web)同款:品牌墨绿 + 暗色 hero + 星点。
  // 缘由:壳的 early_nav 在后端就绪【之前】就把 webview 导航到前端(温启提速的关键),
  // 于是那张美观启动页只闪 ~0.5s,余下十秒全由本组件顶着——本组件若长得完全两样,
  // 用户看到的就是「启动画面没了」(真机实告)。此处对齐配色与结构,让跳转前后视觉连续;
  // early_nav 本身不动(关掉会把启动拉回 10 秒)。
  const BRAND = '#0f6e56';
  const overlay = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 4000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(145deg, #0e1414 0%, #101717 100%)',
    color: '#fff',
  };
  const card = {
    position: 'relative', textAlign: 'center', padding: '34px 42px 30px', borderRadius: 18, maxWidth: 460,
    background: 'radial-gradient(circle at 80% 28%, rgba(255,255,255,0.08), transparent 28%), linear-gradient(145deg, #121a19 0%, #0f1615 100%)',
    border: '1px solid rgba(255,255,255,0.09)',
    boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  };
  // 星点层(壳 .brand-card::after 同款)
  const starfield = {
    position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.7,
    background: 'radial-gradient(circle at 20% 24%, rgba(255,255,255,0.62) 0 1px, transparent 1.5px), radial-gradient(circle at 74% 21%, rgba(255,255,255,0.42) 0 1px, transparent 1.5px), radial-gradient(circle at 88% 68%, rgba(255,255,255,0.34) 0 1px, transparent 1.5px)',
  };
  const spinner = {
    margin: '0 auto 16px', width: 34, height: 34, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.14)',
    borderTopColor: BRAND, animation: 'horosaStartupSpin 0.8s linear infinite',
  };
  const btnPrimary = {
    fontSize: 13, padding: '5px 18px', borderRadius: 8, cursor: 'pointer',
    border: `1px solid ${BRAND}`,
    background: 'rgba(15,110,86,0.18)',
    color: '#8fe3c9',
  };
  const btnSecondary = {
    fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.62)',
    marginLeft: 8,
  };

  return (
    <div style={overlay} aria-live="polite" role="status">
      <div style={card}>
        <div style={starfield} />
        <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6, marginBottom: 14, color: '#f3f7f5' }}>星阙</div>
        <div style={spinner} />
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: '#eef4f2' }}>正在连接本地服务…</div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          {mainMsg}
        </div>
        {bootCtxRef.current.early ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            已用时 {elapsed} 秒
          </div>
        ) : null}
        {extraMsg ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)', lineHeight: 1.55, marginTop: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: 6 }}>
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
          <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.45)', wordBreak: 'break-all' }}>
            后端地址: {currentProbeUrl()}
          </div>
        ) : null}
        </div>
        <style>{'@keyframes horosaStartupSpin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  );
}
