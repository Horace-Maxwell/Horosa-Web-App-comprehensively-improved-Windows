// 风水 · 理气工作区「新派注册表」。
//
// 背景：LiqiWorkspace 原有十四派走 legacy switch（compute/renderParams/renderChart/renderPanel/buildSnapshot 五处分支族）。
// 派数继续增长会把单文件顶爆，故**新派一律走本注册表**；旧十四派保持原样不迁移（迁移＝零收益高风险）。
//
// 契约（每派一模块，导出下列成员）：
//   defaults           左栏参数初值对象（宿主以 { ...defaults, ...regStates[school] } 取值）
//   compute(p, env)    纯函数，返回 { available, ... }；不得触任何 React。
//                      env（可选）＝宿主运行期物事，目前只有 { geo }（画布户型图几何输入）。
//                      🔴 env 不入存档、不进 defaults —— 它含函数与实时坐标，只能现取现用；
//                      故凡用 env 者，缺 env 时必须退化成「未判」而非「判为无」。
//   Params({p,patch,ui})  左栏；ui = { sel, segField, numField }（宿主控件工厂，闭包透传）
//   Chart({result,p,patch,chartBox})  中栏
//   Panel({result,ui,p,patch})  右栏；ui = { card, row }；p/patch 供右栏回写左栏勾选（可不用）
//   snapshotLines(result) -> string[]  AI 快照**正文行**
//
// 🔴 三条铁律
//   1. snapshotLines 绝不自带段头【风水·派名】—— 段头由 LiqiWorkspace.buildSnapshot 单点统一冠。
//   2. 新派 key 必须同步进 FengShuiMain 的 LIQI_SCHOOLS 白名单与 SCHOOL_GROUPS，否则画布引擎的 vm
//      会在本派激活时覆盖 fengshui 模块快照（onVm 守卫按白名单放行）。哨兵测试已机器强制。
//   3. 新派同 commit 五处齐动：SCHOOL_CN / LIQI_SCHOOLS / SCHOOL_GROUPS / aiExport 段与 union / 四本账测试。
import daxuankongSchool from './daxuankongSchool';
import shuilongSchool from './shuilongSchool';
import huashaSchool from './huashaSchool';
import zhaiduanSchool from './zhaiduanSchool';

export const LIQI_SCHOOL_IMPL = {
	daxuankong: daxuankongSchool,
	shuilong: shuilongSchool,
	huasha: huashaSchool,
	zhaiduan: zhaiduanSchool,
};

export const REGISTRY_KEYS = Object.keys(LIQI_SCHOOL_IMPL);

export function implOf(school) {
	return Object.prototype.hasOwnProperty.call(LIQI_SCHOOL_IMPL, school) ? LIQI_SCHOOL_IMPL[school] : null;
}

export default LIQI_SCHOOL_IMPL;
