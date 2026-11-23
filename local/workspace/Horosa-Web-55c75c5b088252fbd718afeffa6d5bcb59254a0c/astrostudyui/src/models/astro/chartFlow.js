// 主盘请求流程的小件:是否带主限法、响应校验与报错、抽屉收起、提交代次与在途中止、步进预取任务构造、挂钩分发
// 从 astro.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { ServerRoot } from '../../utils/constants';
import { Modal } from 'antd';
import { showChartServiceError as showChartServiceErrorRich } from '../../components/common/ChartServiceErrorModal';
import { getStepPrefetcher, registerStepSelectHandler, submitStepPrefetch } from '../../utils/stepPrefetch';
import * as service from '../../services/astro';
import { getStore } from '../../utils/storageutil';
import { stepPrefetchArmEnabled, stepPrefetchDepth } from '../../utils/perfFlags';
import { shouldArmForTab, reportStepUnit, registerArmPlanBuilder } from '../../utils/stepPrefetchArm';
import DateTime from '../../components/comp/DateTime';
import { fieldsToParams } from './fields';
// [Windows-ahead] stepStreak:horosa_pump_skew_v1 连击计量读端(见 buildStepPrefetchTasks 偏斜分支)。
import { armStepPrefetch, stepStreak } from '../../utils/stepPrefetchArm';
import { stepPrefetchSkewEnabled } from '../../utils/perfFlags';

export function shouldIncludePrimaryDirection(state){
	// primarydirsphere = WS-3 主限天球(3D):与表格/盘同吃 PD 数据(/chart 携带
	// predictives.primaryDirection),三件套登记之一(另两处:primaryDirectionSync
	// VALID_DIRECTION_SUB_TABS + jest 枚举断言)。
	return !!(
		state
		&& state.currentTab === 'direction'
		&& (state.currentSubTab === 'primarydirect'
			|| state.currentSubTab === 'primarydirchart'
			|| state.currentSubTab === 'primarydirsphere')
	);
}

export function isValidChartResponse(rsp){
	return rsp !== undefined && rsp !== null && rsp.Result !== undefined && rsp.Result !== null;
}

// Mac issue #12 / Win #11 #14: 委托到 components/common/ChartServiceErrorModal 渲染富对话框
// (dva 的 model parser 不支持 JSX,所以 React 端必须放独立组件文件)。
// fallback 用经典 Modal.error 防止任何加载/导入异常导致用户拿不到反馈。
export function showChartServiceError(extraDetail){
	// 先探活再定弹窗:服务在线但本次计算失败(如参数异常/超出星历数据域)≠「服务未就绪」。
	// 误报「未就绪」会把用户引向重启/防火墙排查,掩盖真实原因(全年份域工程实测坑)。
	try {
		fetch(`${ServerRoot}/horosaIdentity`, { method: 'GET' }).then((r) => {
			if(r && r.ok){
				Modal.error({
					title: '排盘失败：该时刻或参数计算失败',
					content: '本地服务在线,但此次排盘未能完成。常见原因:日期超出星历数据域(公元前 12999 ~ 公元 16799)、参数组合异常。请调整时间/参数后重试;若反复失败请反馈该时刻。',
				});
			}else{
				showChartServiceErrorRich(extraDetail);
			}
		}).catch(() => {
			showChartServiceErrorRich(extraDetail);
		});
	} catch(e) {
		Modal.error({ title: '排盘失败：本地排盘服务未就绪。请确认 Horosa 本地服务仍在运行后重试。' });
	}
}

export function closeAllDrawer(msg){
	console.log(msg);
	const drawer = {
		query: false,
		selectplanet: false,
		selectchartdisplay: false,
		selectasp: false,
		selectorb: false,
		register: false,
		login: false,
		resetpwd: false,
		changepwd: false,
		changeparams: false,
		chartlist: false,
		chartedit: false,
		chartadd: false,
		caselist: false,
		caseedit: false,
		caseadd: false,
		chartdeeplearn: false,
		memo: false,
		chartsgps: false,
		commtools: false,
		homepage: false,
	};
	return drawer;
}

// 主盘提交代次(单一出处,模块级):fetch / fetchByChartData / nowChart / fetchByFields 四个换主盘的入口
// 在第一个 yield 之前同步取号(fetchByFields 与主链 AbortController 同一原子段取),/chart 回来后、落库之前
// 不是最新的一次就静默作废(不 save 不弹错)——「最后发起的那次才落库」(latest-wins),跨入口同样成立:
// 连着载入两张命盘、载入在途时步进时间 / 点此刻 / 载入事盘,晚到的旧响应都不再把新盘盖回去。
// 正确性不随性能开关:快车道开关只管 fields 先不先行提交,不管旧响应丢不丢。
let chartCommitGen = 0;
export function takeChartCommitTicket(){
	chartCommitGen += 1;
	return chartCommitGen;
}
export function chartCommitTicketLive(ticket){
	return ticket === chartCommitGen;
}

// —— WP-P1 步进预取:主请求 settle 后,把「下一步」的盘预先算好塞进缓存 ——
// 步长套用与 DateTimeSelector 的 clickPlus/clickMinus 逐字节同法('m'档=±4 分钟);
// 深度 k 的时间必须【克隆后逐次 add*】(月末 clamp 与用户连点出的真序列一致,
// 1月31日+1M+1M=3月28日≠+2M —— 一步到位会臆造出用户永远点不出来的参数,预取即白打)。
function applyPrefetchStep(dt, unit, dir){
	if(unit === 'y'){ dt.addYear(dir); }
	else if(unit === 'M'){ dt.addMonth(dir); }
	else if(unit === 'd'){ dt.addDate(dir); }
	else if(unit === 'h'){ dt.addHour(dir); }
	else { dt.addMinute(4 * dir); }
	return dt;
}

export function buildStepPrefetchTasks(fieldValues, stepHint, astroState){
	const dt0 = fieldValues && fieldValues.date && fieldValues.date.value;
	// 🔴 能力守卫必须查全步进方法,不能只查 clone:预取是优化,任何「不像 DateTime」的
	// 日期态(异常来源/测试替身)都必须让它整体静默让路,而不是把 TypeError 抛进
	// fetchByFields 主流程。
	if(!dt0 || typeof dt0.clone !== 'function'
		|| typeof dt0.addYear !== 'function' || typeof dt0.addMonth !== 'function'
		|| typeof dt0.addDate !== 'function' || typeof dt0.addHour !== 'function'
		|| typeof dt0.addMinute !== 'function'){
		return [];
	}
	// 计划(数组序 == 提交序):
	//   有向(用户已点 ±):[+1, -1, +2..+depth] —— 同向连点压倒性,反向覆盖「拨过头往回」;
	//     depth 缺省 2 时提交序逐字节等于旧 [+1,+2,-1](tech+1,chart+1,tech-1,chart-1,chart+2,tech+2)。
	//   武装(R4-B2,dir=0 且带 depth):[±1, ±2, .. ±depth] 对称交错(+ 先)——
	//     选完步长 +/− 概率对等,±1 即时命中,远窗吃空闲。
	//   旧调用(无 depth、无向):[±1] 各一,行为不变。
	const depth = stepHint && Number.isFinite(stepHint.depth)
		? Math.max(0, Math.min(5, Math.floor(stepHint.depth)))
		: 0;
	let plan;
	if(stepHint && stepHint.dir){
		const d = Math.max(2, depth || 2);
		// horosa_pump_skew_v1(Windows-ahead,PERF-R12 W3a③,对抗校验窄背书形态):同向连击 ≥3
		// 且间隔 <2s 时丢反向换前伸 +(d+1)—— 反向目标(刚渲染那张)本就温在 chartMem/L2,
		// 丢弃零损;任务数不变,白名单/预算结构不动;显式 budget 的 stepSelect 直发路径不经此分支。
		// 判定失败=不偏(fail-open 回对称计划)。kill:horosa.perf.stepPrefetchSkew。
		let skew = false;
		try{
			if(stepPrefetchSkewEnabled()){
				const s = stepStreak(astroState.currentTab);
				skew = s.count >= 3 && s.dir === stepHint.dir
					&& (!stepHint.unit || s.unit === stepHint.unit)
					&& (Date.now() - s.at) < 2000;
			}
		}catch(e){ /* 不偏 */ }
		if(skew){
			plan = [];
			for(let k = 1; k <= Math.min(d + 1, 5); k += 1){
				plan.push({ k, dir: stepHint.dir });
			}
		}else{
			plan = [{ k: 1, dir: stepHint.dir }, { k: 1, dir: -stepHint.dir }];
			for(let k = 2; k <= d; k += 1){
				plan.push({ k, dir: stepHint.dir });
			}
		}
	}else if(depth > 0){
		plan = [];
		for(let k = 1; k <= depth; k += 1){
			plan.push({ k, dir: 1 });
			plan.push({ k, dir: -1 });
		}
	}else{
		plan = [{ k: 1, dir: 1 }, { k: 1, dir: -1 }];
	}
	const unit = (stepHint && stepHint.unit) || 'm';
	// 本地漏斗技法(紫微/遁甲)的武装:/chart 不在其步进路径上,预取它纯属浪费 —— 只做技法端点。
	const skipChart = !!(stepHint && stepHint.skipChart);
	// Phase B:当前技法登记的端点(kentang pan 等)——用技法自己的请求函数,落其自己的缓存。
	// 🔴 传给登记方的必须是【已步进到目标时间的 f2】(旧版传的是基准 fields,构出来的是
	//    「此刻」的参数 —— 与用户下一步要看的盘不是同一张,预取白打;死表期潜伏未爆,R4-B2 修)。
	const extra = getStepPrefetcher(astroState.currentTab);
	const chartTasks = [];
	const techTasks = [];
	for(const pl of plan){
		// 整个单步构造包进 try:clone 出来的对象若丢了步进能力、或构参路径抛任何异常,
		// 都只作废这一个占位 —— 预取构造永不外抛(占位保序,排序阶段按位配对)。
		let f2;
		let label;
		let param;
		try{
			let dt = dt0.clone();
			for(let i = 0; i < pl.k; i += 1){
				dt = applyPrefetchStep(dt, unit, pl.dir);
			}
			f2 = {
				...fieldValues,
				date: { ...fieldValues.date, value: dt },
				time: { ...fieldValues.time, value: dt },
			};
			label = `${pl.dir > 0 ? '+' : '-'}${pl.k}${unit}`;
			param = fieldsToParams(f2);   // 🔴 与正式请求同一构参路径 —— 缓存键逐字节同键是预取生效的唯一前提
		}catch(e){
			chartTasks.push(null);         // 非法日期(如越 startTime)静默跳过(占位保序)
			techTasks.push(null);
			continue;
		}
		param.cid = null;
		param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
		if(skipChart){
			chartTasks.push(null);   // 本地漏斗武装:占位保序,只发技法端点
		}else{
			chartTasks.push({
				name: `chart${label}`,
				path: '/chart',   // R4-B1 运行时白名单契约:无 path 的任务会被 submitStepPrefetch 丢弃
				// silent+零重试:预取失败静默、绝不退避风暴;结果自动进 chartMem+requestDedupe
				run: ()=> service.fetchChart(param, { silent: true, retry: { retries: 0 } }),
			});
		}
		let mine = null;
		if(extra){
			try{
				const more = extra(f2, stepHint);
				if(Array.isArray(more) && more.length){
					mine = more.map((t)=>({ ...t, name: `${(t && t.name) || 'tech'}${label}` }));
				}
			}catch(e){ /* 技法预取器出错不碍主流程 */ }
		}
		techTasks.push(mine);
	}
	// 排序即价值:近窗(k==1)技法端点先于 chart(非占星页 gate 面板的是技法端点,旧序 chart
	// 在前时技法任务恒被预算砍掉);远窗(k>=2)chart 先把共享底盘备好、技法端点跟队。
	// 经典有向 [+1,-1,+2] 在此规则下的输出与旧实现逐字节同序。
	const tasks = [];
	const emit = (arr, idx)=>{
		const v = arr[idx];
		if(!v){ return; }
		if(Array.isArray(v)){ tasks.push(...v); return; }
		tasks.push(v);
	};
	for(let i = 0; i < plan.length; i += 1){
		if(plan[i].k <= 1){
			emit(techTasks, i);
			emit(chartTasks, i);
		}else{
			emit(chartTasks, i);
			emit(techTasks, i);
		}
	}
	return tasks;
}

// 选步长即预取处理器:DateTimeSelector 选定步长档(opt-in 宿主)→ 武装引擎。
// R4-B2(武装引擎接管上游触发线):上游触发面(opt-in 宿主 + 5s 去重)保持原样;
// ±stepPrefetchDepth 全窗(默认 3;技法端点任务随 chart 一起构造,见 builder);
// NO_ARM/early-boot/reportStepUnit(settle 兜底取档靠它)全在 armStepPrefetch 体内。
// [Windows-only] F1 收敛(v3.7.1,gotcha #90):旧形态在此处**内联复刻** armStepPrefetch
// 的全部守卫后直发 submitStepPrefetch —— 语义同路但绕过 arm 台账,__horosaPrefetch.arms
// 在主盘时间条上恒 0(验收探针的「武装线活着」信号盲区,R12-P2 实测 arms=0 即此)。
// 改为委托:同守卫、同构造器(planBuilder=buildStepPrefetchTasks 注入)、同 5s 去重,
// 唯一行为差 = stats.arms/lastReason 正确入账。sameMinute 闸天然豁免(不传 selectorDatetime,
// v3.5.1 裁决:opt-in 宿主已在源头滤掉旁路时间条)。
registerStepSelectHandler((unit)=>{
	armStepPrefetch('unit-select', { unit });
});

// R4-B2:把任务构造器注入武装模块(utils 不反向 import models)。
// 选步长/切页/本地漏斗 settle 的武装全部经由它,与真点步进共用同一 fieldsToParams 路径 ——
// 「预取参数与用户真点逐字节同键」的纪律因此自动继承。
registerArmPlanBuilder((fieldValues, hint, astroState)=>buildStepPrefetchTasks(fieldValues, hint, astroState));

export function hooking(hook, currentTab, fields, chartObj){
	if(currentTab === 'indiachart' || currentTab === 'locastro'
		|| currentTab === 'hellenastro' || currentTab === 'guolao'
		|| currentTab === 'germanytech' || currentTab === 'jieqichart'
		|| currentTab === 'cntradition' || currentTab === 'cnyibu' || currentTab === 'otherbu'
		|| currentTab === 'fengshui' || currentTab === 'sanshiunited' || currentTab === 'aianalysis'
		|| currentTab === 'bazi' || currentTab === 'ziwei' || currentTab === 'guazhan'
		|| currentTab === 'liureng' || currentTab === 'dunjia' || currentTab === 'taiyi'
		|| currentTab === 'shusuan' || currentTab === 'yanqin' || currentTab === 'mingother'
		|| currentTab === 'auxchart' || currentTab === 'planetarium'){
		if(hook[currentTab].fun){
			hook[currentTab].fun(fields, chartObj)
		}
	}else if(currentTab === 'direction'){
		if(hook[currentTab].fun){
			hook[currentTab].fun(chartObj);
		}
	}

}

export let now = new DateTime();
