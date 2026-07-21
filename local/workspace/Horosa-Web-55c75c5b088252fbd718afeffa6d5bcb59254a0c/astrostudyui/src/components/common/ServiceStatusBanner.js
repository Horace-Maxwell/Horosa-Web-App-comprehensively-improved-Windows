import React from 'react';
import { subscribeServiceStatus, markServiceOnline, markServiceOffline } from '../../utils/serviceStatus';
import { verifyBackendIdentity, renegotiateLocalServerRoot } from '../../utils/backendIdentity';
import { startRecoveryPolling, buildDefaultRecoveryProbe, invokeLightServiceRestart } from '../../utils/serviceRecovery';
import { ServerRoot } from '../../utils/constants';

// 修法6（升级版,Mac issue #12 增强）:非阻塞「本地服务连接中断」重连横幅。
//
// 在线时渲染 null(零 DOM、对正常路径零影响);
// 离线时显示在顶部居中的横幅,带可操作按钮:「立即重试」「重启服务」「打开诊断」(Tauri 环境)。
// 按钮区域 pointerEvents:auto;横幅其余部分 pointerEvents:none,不拦截背景点击。
//
// 离线 / 在线状态由 utils/serviceStatus 驱动:request.js / chartFetch.js 在确认后端不可达时置离线、
// 在收到任何后端响应时置在线。
// [自愈增强] ①横幅显示期间每 10s 自动做身份探测(verify→不过则地址再协商→再 verify),
//   后端自愈/换根成功即自动消横幅——不再要求用户手点或等下一次业务请求撞见;
// ②监听壳侧服务监督事件(supervisor_gave_up):自动修复超限暂停时,横幅文案升级并
//   保证可见(即便还没有业务请求失败);③「重启服务」走轻量 restart_local_services_command
//   (只重启后端进程;老壳无此命令时回退全量修复命令,代数差安全)。
//
// 配色取中性告警色(琥珀),非术数语义色,明暗主题下均可读。
export default function ServiceStatusBanner() {
  const [online, setOnline] = React.useState(true);
  const [retrying, setRetrying] = React.useState(false);
  const [gaveUpMsg, setGaveUpMsg] = React.useState('');
  // [V-2/V11] 信息级提示(非故障):如「本机组件已被另一会话更新,重启后生效」。
  // 与离线横幅独立:在线也显示,可手动关闭,不置离线。
  const [infoMsg, setInfoMsg] = React.useState('');

  React.useEffect(() => {
    const unsub = subscribeServiceStatus((v) => setOnline(v));
    return unsub;
  }, []);

  // 壳侧服务监督事件(__horosaServiceEvent;老壳不发=本钩子静默)。挂载时补读 pending。
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handle = (payload) => {
      if (!payload || !payload.kind) return;
      if (payload.kind === 'runtime_updated_elsewhere') {
        setInfoMsg(payload.message || '本机组件已在另一会话中更新，重启星阙后生效。');
        return;
      }
      // [V-7] 磁盘水位告知(壳侧闩住只发一次;清理回升后再次跌破会再提醒)
      if (payload.kind === 'disk_low') {
        setInfoMsg(payload.message || '磁盘可用空间不足，可能影响排盘与自动更新，请清理磁盘。');
        return;
      }
      if (payload.kind !== 'supervisor_gave_up') return;
      setGaveUpMsg(payload.message || '本地服务多次自动重启未果，已暂停自动修复。');
      // gave_up 时服务必然不可达:主动置离线,保证横幅立即可见(不等业务请求撞见)
      markServiceOffline();
    };
    window.__horosaServiceEvent = handle;
    if (window.__horosaPendingServiceEvent) {
      try { handle(window.__horosaPendingServiceEvent); } catch (_) {}
    }
    return () => {
      if (window.__horosaServiceEvent === handle) {
        window.__horosaServiceEvent = null;
      }
    };
  }, []);

  // 离线期自动恢复轮询:自愈成功即自动消横幅(在线时零定时器)。
  React.useEffect(() => {
    if (online) return undefined;
    const stop = startRecoveryPolling({
      intervalMs: 10000,
      probe: buildDefaultRecoveryProbe({
        verifyBackendIdentity,
        renegotiateLocalServerRoot,
        getServerRoot: () => ServerRoot,
      }),
      onOnline: () => {
        setGaveUpMsg('');
        markServiceOnline();
      },
    });
    return stop;
  }, [online]);

  const hasTauri = typeof window !== 'undefined' && !!window.__TAURI__;

  const handleRetry = React.useCallback(async () => {
    if (!ServerRoot || retrying) return;
    setRetrying(true);
    try {
      // 与自动轮询同源:身份探测(而非裸 /heartbeat——任何 HTTP 响应都 200 的陌生进程会骗过它)
      const outcome = await verifyBackendIdentity(ServerRoot);
      if (outcome && outcome.ok) {
        setGaveUpMsg('');
        markServiceOnline();
      } else {
        await renegotiateLocalServerRoot('banner-retry');
        const second = await verifyBackendIdentity(ServerRoot);
        if (second && second.ok) {
          setGaveUpMsg('');
          markServiceOnline();
        }
      }
    } catch (_) {
      // 仍不可达;横幅继续显示(自动轮询也在跑)
    } finally {
      setRetrying(false);
    }
  }, [retrying]);

  // 「重启服务」:轻量命令只重启后端进程(此前错线到 trigger_runtime_repair_command
  // =全量修复流,会走资产复核/可能重装 runtime,对「服务死了」场景过重)。
  // 老壳(runtime-only 更新不换壳)无新命令 → invoke 抛错 → 回退旧全量修复命令。
  const handleRestart = React.useCallback(async () => {
    if (!hasTauri) return;
    try {
      const api = window.__TAURI__.core || window.__TAURI__;
      const mode = await invokeLightServiceRestart(api);
      if (mode === 'light') setGaveUpMsg('');
    } catch (e) {
      try { console.warn('[ServiceStatusBanner] restart failed', e); } catch (_) {}
    }
  }, [hasTauri]);

  const handleDiag = React.useCallback(async () => {
    if (!hasTauri) return;
    try {
      const api = window.__TAURI__.core || window.__TAURI__;
      if (api && api.invoke) {
        await api.invoke('open_diagnostics_window_command');
      }
    } catch (e) {
      try { console.warn('[ServiceStatusBanner] open diag failed', e); } catch (_) {}
    }
  }, [hasTauri]);

  if (online && !infoMsg) return null;

  // audit 修:pointerEvents 父 none 会吞掉子元素事件 → 改为父 auto + 用 transparent 占位让背景能透过点击。
  // 关键:把横幅本身放进一个 fit-content 的内联块,周围空白用 pointer-events:none 包裹。
  const wrapStyle = {
    position: 'fixed', top: 0, left: 0, right: 0,
    zIndex: 2000,
    display: 'flex', justifyContent: 'center',
    pointerEvents: 'none', // 整个 wrap 让点击穿透
  };

  // [V-2/V11] 在线 + 仅信息提示:渲染中性信息横幅(蓝灰),可关闭,不带故障操作钮。
  if (online && infoMsg) {
    const infoBar = {
      marginTop: 8,
      maxWidth: '96%',
      padding: '8px 14px',
      borderRadius: 8,
      fontSize: 13,
      lineHeight: 1.4,
      color: '#1d4e78',
      background: 'rgba(230, 242, 252, 0.97)',
      border: '1px solid rgba(84, 141, 191, 0.55)',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
      pointerEvents: 'auto',
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      flexWrap: 'wrap',
      cursor: 'default',
    };
    const infoBtn = {
      padding: '3px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
      border: '1px solid rgba(84, 141, 191, 0.7)',
      background: 'rgba(255, 255, 255, 0.7)',
      color: '#1d4e78',
    };
    return (
      <div style={wrapStyle} aria-live="polite">
        <div style={infoBar}>
          <span>ℹ️ {infoMsg}</span>
          <button type="button" onClick={() => setInfoMsg('')} style={infoBtn}>知道了</button>
        </div>
      </div>
    );
  }
  const barStyle = {
    marginTop: 8,
    maxWidth: '96%',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.4,
    color: '#7a4f01',
    background: 'rgba(255, 244, 222, 0.97)',
    border: '1px solid rgba(214, 158, 46, 0.55)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
    pointerEvents: 'auto', // 但 bar 本身收事件 - 子元素自动继承
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
    cursor: 'default',
  };
  const btnStyle = {
    padding: '3px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
    border: '1px solid rgba(214, 158, 46, 0.7)',
    background: 'rgba(255, 255, 255, 0.7)',
    color: '#7a4f01',
  };

  return (
    <div style={wrapStyle} aria-live="polite">
      <div style={barStyle}>
        <span>
          {gaveUpMsg
            ? `⚠️ ${gaveUpMsg}`
            : '⚠️ 本地服务暂时不可达，正在自动探测恢复，操作会自动重试。'}
        </span>
        <button type="button" disabled={retrying} onClick={handleRetry} style={btnStyle}>
          {retrying ? '正在重试…' : '立即重试'}
        </button>
        {hasTauri ? (
          <button type="button" onClick={handleRestart} style={btnStyle}>🔧 重启服务</button>
        ) : null}
        {hasTauri ? (
          <button type="button" onClick={handleDiag} style={btnStyle}>🔍 打开诊断</button>
        ) : null}
      </div>
    </div>
  );
}
