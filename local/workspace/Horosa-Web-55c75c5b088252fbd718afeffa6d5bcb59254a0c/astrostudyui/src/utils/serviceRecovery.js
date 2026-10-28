// [自愈] 本地服务离线期的自动恢复轮询编排(纯定时器逻辑,fake-timer 可测)。
// 横幅显示期间每 intervalMs 探一次:probe() 解析为 true → onOnline() 单次回调并停;
// false → 继续轮询。返回 stop 句柄(幂等)。probe/onOnline 由调用方注入(组件里组装
// verifyBackendIdentity + renegotiateLocalServerRoot),本模块不 import 网络层。
export function startRecoveryPolling(opts) {
  const options = opts || {};
  const intervalMs = options.intervalMs || 10000;
  const probe = options.probe;
  const onOnline = options.onOnline;
  let stopped = false;
  let timer = null;
  const tick = () => {
    if (stopped) return;
    Promise.resolve()
      .then(() => probe())
      .catch(() => false)
      .then((ok) => {
        if (stopped) return;
        if (ok) {
          try { onOnline(); } catch (_) {}
          return; // 恢复即停(单次回调)
        }
        timer = setTimeout(tick, intervalMs);
      });
  };
  timer = setTimeout(tick, intervalMs);
  return () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

// 默认探测组装:先验当前服务根身份;不过 → 触发地址再协商(verify-to-switch,
// 自带单飞+5s 节流)后再验一次。恒返回布尔,绝不抛。
export function buildDefaultRecoveryProbe(deps) {
  const verifyBackendIdentity = deps.verifyBackendIdentity;
  const renegotiateLocalServerRoot = deps.renegotiateLocalServerRoot;
  const getServerRoot = deps.getServerRoot;
  return async () => {
    try {
      const first = await verifyBackendIdentity(getServerRoot());
      if (first && first.ok) return true;
      await renegotiateLocalServerRoot('banner-recovery');
      const second = await verifyBackendIdentity(getServerRoot());
      return !!(second && second.ok);
    } catch (_) {
      return false;
    }
  };
}

// 「重启服务」统一入口(横幅/状态灯/排盘失败弹窗三处共用,杜绝轻重不一):
// 轻量 restart_local_services_command 只重启后端进程(秒级);老壳(runtime-only 更新
// 不换壳)无此命令 → invoke 抛错 → 回退全量修复命令(代数差安全,但会走资产复核,慢)。
// 返回 'light' | 'full'(调用方据此定文案);两者皆失败才抛。
export async function invokeLightServiceRestart(api) {
  if (!api || !api.invoke) {
    throw new Error('desktop bridge unavailable');
  }
  try {
    await api.invoke('restart_local_services_command');
    return 'light';
  } catch (_) {
    await api.invoke('trigger_runtime_repair_command');
    return 'full';
  }
}
