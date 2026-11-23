import React from 'react';
import { SystemNotice, SystemNoticeButton } from './SystemNotice';
import { isDesktopBridgeAvailable, getDesktopInvokeApi } from '../../utils/aiAnalysisDesktop';
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
// 外观走系统提示条统一件(SystemNotice):主题变量 + 信息 / 警告语气,亮暗都可读。
export default function ServiceStatusBanner() {
  const [online, setOnline] = React.useState(true);
  const [retrying, setRetrying] = React.useState(false);
  const [gaveUpMsg, setGaveUpMsg] = React.useState('');
  // 信息级提示(非故障):如「本机组件已被另一会话更新,重启后生效」。
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
      // 磁盘水位告知(壳侧闩住只发一次;清理回升后再次跌破会再提醒)
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

  const hasTauri = isDesktopBridgeAvailable();   // 打包版无 window.__TAURI__,只探它=按钮永不出现

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
      const api = getDesktopInvokeApi();
      const mode = await invokeLightServiceRestart(api);
      if (mode === 'light') setGaveUpMsg('');
    } catch (e) {
      console.warn('[ServiceStatusBanner] restart failed', e);
    }
  }, [hasTauri]);

  const handleDiag = React.useCallback(async () => {
    if (!hasTauri) return;
    try {
      const api = getDesktopInvokeApi();
      if (api && api.invoke) {
        await api.invoke('open_diagnostics_window_command');
      }
    } catch (e) {
      console.warn('[ServiceStatusBanner] open diag failed', e);
    }
  }, [hasTauri]);

  if (online && !infoMsg) return null;

  // 外层点穿、只有提示条本身收事件(SystemNotice 的样式里做了),不挡页面背后的点击。
  // 在线 + 仅信息提示:信息语气,可关闭,不带故障操作钮。
  if (online && infoMsg) {
    return (
      <SystemNotice tone="info" layer="notice">
        <span>{infoMsg}</span>
        <SystemNoticeButton onClick={() => setInfoMsg('')}>知道了</SystemNoticeButton>
      </SystemNotice>
    );
  }
  return (
    <SystemNotice tone="warn" layer="notice">
      <span>
        {gaveUpMsg
          ? gaveUpMsg
          : '本地服务暂时不可达，正在自动探测恢复，操作会自动重试。'}
      </span>
      <SystemNoticeButton disabled={retrying} onClick={handleRetry}>
        {retrying ? '正在重试…' : '立即重试'}
      </SystemNoticeButton>
      {hasTauri ? (
        <SystemNoticeButton onClick={handleRestart}>重启服务</SystemNoticeButton>
      ) : null}
      {hasTauri ? (
        <SystemNoticeButton onClick={handleDiag}>打开诊断</SystemNoticeButton>
      ) : null}
    </SystemNotice>
  );
}
