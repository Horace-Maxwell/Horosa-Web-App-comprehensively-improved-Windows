import React from 'react';
import { isDesktopBridgeAvailable, getDesktopInvokeApi } from '../../utils/aiAnalysisDesktop';
import { Popover, Button, Space, message } from 'antd';
import { subscribeServiceStatus, markServiceOnline, markServiceOffline } from '../../utils/serviceStatus';
import { ServerRoot, ClientVer, getLocalServerRootMode } from '../../utils/constants';
import { snapshot as requestTelemetrySnapshot } from '../../utils/requestTelemetry';
import { collectDesktopBridgeDiag } from '../../utils/desktopBridgeDiag';
import { buildBackendDiagText } from '../../utils/backendDiagText';
import { verifyBackendIdentity, renegotiateLocalServerRoot } from '../../utils/backendIdentity';
import { invokeLightServiceRestart } from '../../utils/serviceRecovery';
import { copyTextSmart } from '../../utils/clipboardText';

// Mac issue #12 增强:常驻「后端健康指示灯」。
//
// 目的:回应用户「不知道在哪查看 Horosa 本地服务的运行状态」——把状态做成永远可见的视觉信号。
// 状态:
//   · 绿色实心圆 = 后端在线 (markServiceOnline 已被调用过)
//   · 黄色实心圆 = 正在检测(尚未收到响应,启动初期)
//   · 红色实心圆 = 后端不可达(markServiceOffline 已被调用)
// 位置:fixed 右下角,可点击展开 Popover 显详情 + 操作。
//
// 自检:首次挂载主动做一次身份握手探测;之后被动跟随 serviceStatus 订阅。
// [V-6] 弃 heartbeat 裸 fetch:主后端无该 HTTP 路由(404 也 markOnline=灯撒谎),
// 且任何陌生进程的 200 都会点绿——改 verifyBackendIdentity(fail-closed,与横幅同源)。
// 仅在 ServerRoot 有效(桌面 app)时挂载;纯网页托管返回 null。

// 构建指纹:前端包版本 + 壳传入的运行时版本(URL rv 参数,浏览器直跑为空)+ 协议版本。
function collectBuildFingerprint() {
  const out = { appVersion: '', runtimeVersion: '', clientVer: ClientVer };
  try { out.appVersion = require('../../../package.json').version || ''; } catch (_) { /* 打包形态不含时留空 */ }
  try { out.runtimeVersion = new URLSearchParams(window.location.search || '').get('rv') || ''; } catch (_) { /* 无窗口留空 */ }
  return out;
}

export default function BackendStatusDot() {
  const [online, setOnline] = React.useState(true);
  const [probed, setProbed] = React.useState(false);
  const [latencyMs, setLatencyMs] = React.useState(null);
  const [retrying, setRetrying] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // 订阅状态
  React.useEffect(() => {
    const unsub = subscribeServiceStatus((v) => setOnline(v));
    return unsub;
  }, []);

  // 首次主动探测
  React.useEffect(() => {
    if (!ServerRoot) { setProbed(true); return undefined; }
    let cancelled = false;
    const probe = async () => {
      try {
        const t0 = Date.now();
        const outcome = await verifyBackendIdentity(ServerRoot);
        if (cancelled) return;
        if (outcome && outcome.ok) {
          setLatencyMs(Date.now() - t0);
          markServiceOnline();
        } else {
          markServiceOffline();
        }
      } catch (_) {
        if (cancelled) return;
        markServiceOffline();
      } finally {
        if (!cancelled) setProbed(true);
      }
    };
    probe();
    // 周期慢探(每 60s)保活信号
    const id = setInterval(probe, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const hasTauri = isDesktopBridgeAvailable();   // [FL-20260902-1] 打包版无 window.__TAURI__,只探它=按钮永不出现

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      // 与横幅同源:身份握手;不过 → 地址再协商(verify-to-switch)后再验一次
      const t0 = Date.now();
      const first = await verifyBackendIdentity(ServerRoot);
      let ok = !!(first && first.ok);
      if (!ok) {
        await renegotiateLocalServerRoot('statusdot-retry');
        const second = await verifyBackendIdentity(ServerRoot);
        ok = !!(second && second.ok);
      }
      if (ok) {
        setLatencyMs(Date.now() - t0);
        markServiceOnline();
        message.success('后端已在线');
      } else {
        markServiceOffline();
        message.warning('仍不可达,请检查后端或代理设置');
      }
    } catch (_) {
      markServiceOffline();
      message.warning('仍不可达,请检查后端或代理设置');
    } finally {
      setRetrying(false);
    }
  };

  // audit 修:tauriInvoke 需 await + 真实成功/失败反馈,不再 fire-and-forget
  // [V-6] 统一走轻量重启(此前错线到全量修复命令,对「服务死了」场景过重且慢)
  const handleRestart = async () => {
    if (!hasTauri) return;
    try {
      const api = getDesktopInvokeApi();
      const mode = await invokeLightServiceRestart(api);
      message.info(mode === 'light' ? '已请求重启后端,约 10 秒内恢复' : '已请求完整修复,请等待 10-60 秒');
    } catch (e) {
      message.error(`重启失败：${(e && e.message) || e}`);
    }
  };

  const handleDiag = async () => {
    if (!hasTauri) return;
    try {
      const api = getDesktopInvokeApi();
      if (api && api.invoke) {
        await api.invoke('open_diagnostics_window_command');
      }
    } catch (e) {
      message.error(`打开诊断中心失败：${(e && e.message) || e}`);
    }
  };

  // 复制信息 = 状态基线 + 请求失败计数(页面内存账)+ 桌面桥诊断字段 + 构建指纹;文本由纯函数拼装。
  const copyDiag = () => {
    let bridge = null;
    try { bridge = collectDesktopBridgeDiag(); } catch (_) { bridge = null; }
    let telemetry = null;
    try { telemetry = requestTelemetrySnapshot(); } catch (_) { telemetry = null; }
    const txt = buildBackendDiagText({
      online,
      latencyMs,
      serverRoot: ServerRoot,
      serverRootMode: getLocalServerRootMode(),
      telemetry,
      bridge,
      build: collectBuildFingerprint(),
    });
    copyTextSmart(txt).then((ok) => {
      if (ok) { message.success('诊断信息已复制'); }
      else { message.error('复制失败，请手动选择文本复制'); }
    });
  };

  if (!ServerRoot) return null;

  let color = '#52c41a';
  let label = '后端在线';
  if (!probed) { color = '#faad14'; label = '正在探测后端…'; }
  else if (!online) { color = '#ff4d4f'; label = '后端不可达'; }

  const dotStyle = {
    width: 12, height: 12, borderRadius: '50%',
    background: color,
    boxShadow: `0 0 4px ${color}`,
    border: '1px solid rgba(0,0,0,0.15)',
    cursor: 'pointer',
  };

  const content = (
    <div style={{ minWidth: 260, fontSize: 12.5, lineHeight: 1.7 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>本地后端</div>
      <div>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />
        {label}{latencyMs != null && online ? ` (${latencyMs}ms)` : ''}
      </div>
      <div style={{ color: 'var(--horosa-muted, #888)', wordBreak: 'break-all', marginTop: 4 }}>地址: {ServerRoot}</div>
      <div style={{ marginTop: 10 }}>
        <Space size={6} wrap>
          <Button size="small" loading={retrying} onClick={handleRetry}>立即重试</Button>
          {hasTauri ? <Button size="small" onClick={handleRestart}>🔧 重启后端</Button> : null}
          {hasTauri ? <Button size="small" onClick={handleDiag}>🔍 诊断中心</Button> : null}
          <Button size="small" onClick={copyDiag}>📋 复制信息</Button>
        </Space>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 1500, pointerEvents: 'auto' }}>
      <Popover content={content} title={null} placement="topRight" trigger="click" open={open} onOpenChange={setOpen}>
        <div title={label} style={dotStyle} />
      </Popover>
    </div>
  );
}
