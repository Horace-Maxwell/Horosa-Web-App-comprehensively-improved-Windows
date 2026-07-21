// 修法5:排盘「裸 fetch」的透明重试薄包装。
//
// 用于各术数引擎(奇门 / 太乙 / 金口诀 / 七政四余 等)直接 `fetch(buildKentangEndpoint(...))`
// 调本地排盘服务的场景。这些请求是「幂等的纯计算」(后端无写库,见 ChartController),可安全重试。
//
// 铁律——成功路径与原生 fetch 逐字节一致:
//   · 返回同一个 Response 对象,不消费 body、不解析、不改任何成功语义;
//   · HTTP 4xx/5xx 会正常 resolve 出 Response(后端可达、只是报错)→ 不重试、原样返回;
//   · 仅在「后端不可达」(连接被拒 / 断网,fetch 抛 TypeError)时做有界退避重试。
//
// 绝不可用于:login/注册/保存/AI predict(计费)/SSE 流/文件上传——那些非幂等,重试会双提交/双计费。

import { markServiceOnline, isBackendUnreachableError } from './serviceStatus';
// horosa_prefetch_runtime_whitelist_v1(PERF-R9 Ship 7):kentang 全族走的是本裸 fetch 路径
// (不经 utils/request),没有这一闸整族就在任何白名单之外。非预取作用域恒放行,零行为变化。
import { guardPrefetchUrl } from './stepPrefetch';

const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = [300, 600];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchChartWithRetry(url, opts, cfg) {
  // horosa_prefetch_runtime_whitelist_v1:预取作用域内的非白名单 URL 直接拒发。
  // 抛错而非返 undefined —— 调用方一律 `resp.ok` 取用,给假 Response 反而更危险;
  // 预取路径的失败本就被调度器静默吞掉,正式请求(非预取作用域)恒放行不受影响。
  if (!guardPrefetchUrl(url)) {
    throw new Error('prefetch.blocked');
  }
  const retries = cfg && cfg.retries != null ? cfg.retries : DEFAULT_RETRIES;
  const backoff = (cfg && cfg.backoff) || DEFAULT_BACKOFF_MS;
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const resp = await fetch(url, opts);
      // 收到任何 HTTP 响应即视为后端在线(清除重连横幅);HTTP 错误码不在此函数判定,交给调用方解析。
      markServiceOnline();
      return resp;
    } catch (err) {
      lastErr = err;
      // 仅对「后端不可达」重试;其它(理论上 fetch 很少抛别的)直接抛出。
      // 不在此 markServiceOffline:裸 fetch 失败后引擎通常还有 request() 兜底,
      // 由 request 路径在最终不可达时统一置离线,避免横幅闪烁。
      if (isBackendUnreachableError(err) && attempt < retries) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(backoff[Math.min(attempt, backoff.length - 1)]);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
