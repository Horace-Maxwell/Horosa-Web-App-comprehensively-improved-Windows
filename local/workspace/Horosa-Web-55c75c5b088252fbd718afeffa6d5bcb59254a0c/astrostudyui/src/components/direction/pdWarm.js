// [Windows-ahead] 主限法请求的数据层预热 / 步进预取(horosa_pd_warm_module_v1)。
// 原与星运页同文件;上游 v3.15.0 起页面文件设了行数上限(超过 1500 行不许再长),这两件与渲染无关的
// 数据层函数迁到本文件。页面类经 registerPdPageClass 在其模块求值末尾登记进来 —— 本文件不 import 页面
// (否则与页面互为 import,多出一个导入环)。
import request from '../../utils/request';
import * as Constants from '../../utils/constants';

let pdPageClass = null;

// 星运页类登记(AstroDirectMain.js 类定义之后调用一次)。
export function registerPdPageClass(cls){
	pdPageClass = cls || null;
}

// PERF-R8 P2:数据层预热 / 步进预取与真实首点必须同一构造(url + body 逐字节一致才命中 requestDedupe)。
// horosa_pd_request_facade_v1(v3.13.0):不再保留「纯函数复制体 + 类方法委托」—— 直接借类方法本体
// (getDesiredPdConfig / buildPrimaryDirectionRequest 只读 this.props.chartObj / this.props.fields,
// 后者另调 this.getDesiredPdConfig),上游每次扩维度都自动随行。复制体两度静默劣化:v3.6.0 丢 6 个字段
// (issue #59,界面选了发不出去)、v3.13.0 把 Field Plane 方向类型压成 0 并整组丢掉 pdExtra 新设置(gotcha #83④ / #114)。
// 外观对象只给这两样;上游若让这两个方法读别的 this 成员,预热会在 warm 的 try/catch 里静默落空
// (首点回到冷即付),绝不影响页面本身 —— 页面走的始终是类方法原样。
// 页面类尚未登记(页面模块还没求值)时返回 null = 不预热,同样只是回到冷即付。
export function buildPrimaryDirectionRequestPure(chartObj, fields, override = {}){
	if(!pdPageClass){
		return null;
	}
	const facade = {
		props: { chartObj, fields },
		getDesiredPdConfig: pdPageClass.prototype.getDesiredPdConfig,
	};
	return pdPageClass.prototype.buildPrimaryDirectionRequest.call(facade, chartObj, override);
}

// PERF-R8 P2(数据层空闲预热):按当前盘+默认主限配置预热 /predict/pd —— 与星运首点
// (默认子页 primarydirect)同一构造、同一 url+body → requestDedupe L1/L2 命中(10min 内
// 首点 ≈0ms;超窗回落后端 paramhash 盘 ~百毫秒)。silent 且丢弃结果:绝不 dispatch、
// 绝不触碰全局 state(组件路径的 savePrimaryDirectionRows 副作用与预热无关)。失败静默。
export async function warmPrimaryDirection(chartObj, fields){
	try{
		const req = buildPrimaryDirectionRequestPure(chartObj, fields, {});
		if(!req){ return null; }
		return await request(`${Constants.ServerRoot}/predict/pd`, {
			body: JSON.stringify(req),
			silent: true,
			// PERF-R9 Ship 7:预热/预取一律零重试(显式声明,不吃任何调用链上的重试默认值)——
			// 后端重启窗口里 N 个深度预取绝不能变成 N×10 次退避重试风暴。
			retry: { retries: 0 },
		});
	}catch(e){
		return null; // 预热失败静默:首点回到冷即付的现状
	}
}
