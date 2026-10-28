// 择日宿主「载入存案 → 还原工作台态」共享件。
// 此前只有奇门择日宿主自还原 payload.zeri;八字/紫微/黄历/印度/七政五宿主存了 payload.zeri 却全仓零读取
// (载入存案不还原工作台与点选时刻)。本件照 QimenZeriMain.restoreWorkbenchFromCase 同律:
//   store.user.currentCase 命中本宿主 scope → 版本守卫(caseRestoreKey:只认显式载入) → payload.zeri → setState 补丁。
import { getStore } from '../../utils/storageutil';
import { caseRestoreKey } from '../../utils/kentangCaseSave';
import { serializeEmbedPatch, deserializeEmbedPatch } from '../../utils/scopedFieldsSink';
import DateTime from '../comp/DateTime';
import { normalizeSavedNatal, restoredNatalInput } from './zeriNatal';
import { withFullDefaults } from './zeriOptionDefaults';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { loadFreshModuleAISnapshot, requestModuleSnapshotRefreshSync } from '../../utils/moduleSnapshotRefresh';

function mkSavedDateTime(text, zone){
	const dt = new DateTime();
	if(zone !== undefined && zone !== null && typeof dt.setZone === 'function'){ dt.setZone(zone); }
	return dt.parse ? dt.parse(text, 'YYYY-MM-DD HH:mm:ss') : null;
}

// 从 payload.zeri 拼 state 补丁(纯函数,单测锚)。
// opts.fullDefaultOptions:宿主出厂完整缺省(函数或对象;zeriOptionDefaults)—— 工作台参数以它打底,存案没写的键回出厂值。
// 绝不以本会话 state.options 打底:会话里改过、存案没写的键会混进冻结口径(点选 / 详情 / 快照判读与存案的结果列表不是同一口径)。
export function zeriPayloadToStatePatch(zeri, state, opts){
	if(!zeri || typeof zeri !== 'object'){ return null; }
	const st = state || {};
	const next = {};
	if(zeri.cfg && typeof zeri.cfg === 'object' && zeri.cfg.startDate){ next.cfg = { ...(st.cfg || {}), ...zeri.cfg }; }
	if(zeri.geo && typeof zeri.geo === 'object'){ next.geo = { ...(st.geo || {}), ...zeri.geo }; }
	const fullDefaults = opts && opts.fullDefaultOptions;
	if(zeri.options && typeof zeri.options === 'object'){ next.options = withFullDefaults(fullDefaults, zeri.options); }
	// 本命:有本命这一项的宿主才收(没有本命的宿主从外来存案吃进 natal,再存一次就原样带出去)。
	// 存案里没有可用本命(显式 null / 数组 / 字符串 / 数字 / {} / 旧版存案根本没记)→ 清空:会话里上一位的本命不冒充存案口径
	if(Object.prototype.hasOwnProperty.call(st, 'natal')){ next.natal = normalizeSavedNatal(zeri.natal); }
	// 本命输入框随存案(扫描时那一份),叠在构造缺省上;存案没记 → 构造缺省(宿主自存的空存案就是这个模板)——
	// 否则标签是存案的本命、输入框还是本会话上一位的出生信息,再存一次就挂到这条下面
	if(Object.prototype.hasOwnProperty.call(st, 'natalInput')){ next.natalInput = restoredNatalInput(zeri.natalInput); }
	// 存案整段没记工作台参数(旧版 / 手建):有工作台参数的宿主回出厂完整缺省(印度的本命月宿 / 月座也在其中)
	if(!next.options && fullDefaults && Object.prototype.hasOwnProperty.call(st, 'options')){ next.options = withFullDefaults(fullDefaults, null); }
	if(typeof zeri.pickText === 'string' && zeri.pickText){ next.pickText = zeri.pickText; }
	if(zeri.tree && typeof zeri.tree === 'object' && Array.isArray(zeri.tree.children)){ next.tree = zeri.tree; }
	if(Array.isArray(zeri.results)){
		next.results = zeri.results;
		next.truncated = !!zeri.truncated;
	}
	return Object.keys(next).length ? next : null;
}

// 存案的快照正文 = 页面此刻所见:先请内嵌页按当前盘 + 宿主当前择时结果重存(它经 composeAiSnapshot 并入择时三段),再读槽。
// 此前直读槽 —— 槽只在内嵌页起盘时存过一次,「扫完不点选就存」存进去的是扫描前的旧文(命中时段缺或是上一轮的),
// 而同时存下的 payload.zeri.results 是新的,AI 读事盘两边对不上(奇门择日已先这样修,其余宿主同此)。
// 内嵌页不在场 / 产不出正文 → 槽里已有的;槽也空 → 宿主自己的择时三段。
export function zeriCaseSnapshotText(host, scope){
	let text = '';
	try{
		const m = loadFreshModuleAISnapshot(scope);
		text = m && m.content ? `${m.content}` : '';
	}catch(e){ text = ''; }
	if(!text && host && typeof host.composeAiSnapshot === 'function'){
		try{ text = host.composeAiSnapshot('') || ''; }catch(e){ text = ''; }
	}
	return text;
}

// 宿主侧择时结果变了(扫描完成 / 判读预取到齐)→ 重存本槽:先请内嵌页按「母技法全文 + 择时三段」重存;
// 内嵌页不应答(印度内嵌页本就不应答择日槽、七政降级档产不出基底)才写宿主自己的三段兜底。
// 此前一律直写三段版,把内嵌页存好的母技法全文顶掉。
export function refreshZeriSlot(host, scope){
	let fresh = '';
	try{ fresh = requestModuleSnapshotRefreshSync(scope); }catch(e){ fresh = ''; }
	if(fresh){ return fresh; }
	let text = '';
	try{ text = (host && typeof host.composeAiSnapshot === 'function' ? host.composeAiSnapshot('') : '') || ''; }catch(e){ text = ''; }
	saveModuleAISnapshot(scope, text);
	return text;
}

// 扫描运行代次:宿主 runSearch 开扫时取号,进度 / 结果 / 收尾回调写之前判是否仍是当前这一次;载入存案时推进代次 = 作废在途扫描
export function beginScanRun(host){
	host._scanRun = (host._scanRun || 0) + 1;
	return host._scanRun;
}
export function scanRunIsCurrent(host, run){
	return !!host && host._scanRun === run;
}

// 内嵌页实际起盘所用的 fields(hook.getPlottedFields;所见那张盘的时间地点)。取不到 = null,宿主回落自己的重建
export function plottedFieldsOf(hook){
	try{
		const f = hook && typeof hook.getPlottedFields === 'function' ? hook.getPlottedFields() : null;
		return f && typeof f === 'object' && f.date && f.date.value ? f : null;
	}catch(e){ return null; }
}

// 条件树编译不出来(存案里的条件类型改名 / 下线、校验变严)时的过期指纹:永不等于当前工作台,于是「结果已过期」提示照出、提醒重扫
export const SCAN_UNCOMPILED_SENTINEL = '\u0000uncompiled';

// 「结果已过期」指纹的规范化序列化:对象键按字典序(逐层;数组保序;值为 undefined / 函数的键与 JSON.stringify 同律略去)。
// 两边是同一份口径、只是键的先后不同(载入后的工作台参数由「出厂完整缺省 + 存下的」拼出,扫描时是另一种拼法)时指纹相同,不误报过期
export function canonicalJson(value){
	const norm = (v)=>{
		if(Array.isArray(v)){ return v.map((x)=>(x === undefined || typeof x === 'function' ? null : norm(x))); }
		if(v && typeof v === 'object'){
			if(typeof v.toJSON === 'function'){ return norm(v.toJSON()); }
			const out = {};
			Object.keys(v).sort().forEach((k)=>{
				const x = v[k];
				if(x !== undefined && typeof x !== 'function'){ out[k] = norm(x); }
			});
			return out;
		}
		return v;
	};
	return JSON.stringify(norm(value));
}

// 载入存案时的过期指纹 = 按冻结口径(此刻还原进工作台的存案值:cfg / geo / options / natal / tree)经宿主的纯函数 uiJsonOf 算。
// 绝不调 currentUiJson():它按内嵌页 / 设置单例「此刻」的口径算(页面口径键以页面为准),指纹于是等于现在、不等于存案 ——
// 设置变过也不亮过期(点开的盘按现在的设置、判读按存案),冻结值回写内嵌页之后反而亮。宿主没有 uiJsonOf → 永不相等(照亮过期,不误判为新)
export function frozenUiJsonOf(host, parts){
	if(!host || typeof host.uiJsonOf !== 'function'){ return SCAN_UNCOMPILED_SENTINEL; }
	try{ return host.uiJsonOf(parts || {}); }catch(e){ return SCAN_UNCOMPILED_SENTINEL; }
}

// 扫描冻结口径(_scan*:点选起盘、判读详情、快照前 N 行、「结果已过期」都读它)换成这条存案的:存档里的
// cfg / tree / geo / options / natal 就是当初那次扫描的冻结值(buildZeriCasePayload 存的是 _scan* 优先)。
// 此前载入只改状态:点选按本会话上一次扫描的地点口径起盘、判读用上一次的条件树、本会话没扫过时判读全是「未知条件类型」。
// 存案没带结果 → 清空冻结(与结果列表一起清)。条件树由宿主编译(compileScanTree,各技法各自的编译器)。
function restoreScanFreeze(host, hasResults){
	const st = host.state || {};
	const copy = (v)=>(v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : null);
	const has = (k)=>Object.prototype.hasOwnProperty.call(host, k);
	if(!hasResults){
		host._scanCfg = null;
		host._scanTree = null;
		host._scanUiTree = null;
		host._scanUiJson = '';
		['_scanGeo', '_scanOptions', '_scanNatal', '_scanNatalInput'].forEach((k)=>{ if(has(k)){ host[k] = null; } });
		return;
	}
	host._scanCfg = st.cfg ? { ...st.cfg } : null;
	if(has('_scanGeo')){ host._scanGeo = st.geo ? { ...st.geo } : null; }
	if(has('_scanOptions')){ host._scanOptions = st.options ? { ...st.options } : null; }
	if(has('_scanNatal')){ host._scanNatal = st.natal ? { ...st.natal } : null; }
	if(has('_scanNatalInput')){ host._scanNatalInput = st.natalInput ? { ...st.natalInput } : null; }
	host._scanUiTree = copy(st.tree);
	let compiled = null;
	if(typeof host.compileScanTree === 'function' && st.tree){
		try{ compiled = host.compileScanTree(st.tree); }catch(e){ compiled = null; }
	}
	host._scanTree = compiled;
	host._scanUiJson = (st.tree && !compiled) ? SCAN_UNCOMPILED_SENTINEL
		: frozenUiJsonOf(host, { cfg: st.cfg, geo: st.geo, options: st.options, natal: st.natal, natalInput: st.natalInput, tree: st.tree });
}

// 宿主在 componentDidMount / componentDidUpdate 调用;命中并还原返回 true。
export function restoreZeriWorkbenchFromCase(host, scope){
	if(!host || !scope){ return false; }
	let store = null;
	try{ store = getStore(); }catch(e){ store = null; }
	const userState = store && store.user ? store.user : null;
	const currentCase = userState && userState.currentCase ? userState.currentCase : null;
	if(!currentCase || !currentCase.cid || !currentCase.cid.value){ return false; }
	const caseType = currentCase.caseType ? currentCase.caseType.value : null;
	const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
	if(caseType !== scope && sourceModule !== scope){ return false; }
	// 读档去重键(kentangCaseSave.caseRestoreKey,只认显式载入):同一条记录再载入一次必换键;本宿主刚「存为事盘」/ 编辑换掉的
	// 当前事盘不是载入 → null,不还原(否则工作台没重扫的改动被换回存档值、在途扫描被取消)
	const caseVersion = caseRestoreKey(scope, userState);
	if(!caseVersion){ return false; }
	if(host._lastRestoredZeriCase === caseVersion){ return false; }
	host._lastRestoredZeriCase = caseVersion;
	let payload = currentCase.payload ? currentCase.payload.value : null;
	if(typeof payload === 'string'){
		try{ payload = JSON.parse(payload); }catch(e){ payload = null; }
	}
	// 本宿主的事盘却整段没有 zeri(手建 / 改类型 / AI 建档),或 zeri 里一个认得的键都没有(数组 / 只有版本号):按宿主自己存下的
	// 空存案处理(结果清成没扫过、冻结清空、扫描代次换代、覆盖层清空、没有本命)—— 此前直接返回 / 只清结果,工作台留着本会话
	// 上一次的结果、口径与用事人本命,再存一次就写进这条
	const rawZeri = payload && payload.zeri;
	const zeriObj = rawZeri && typeof rawZeri === 'object' && !Array.isArray(rawZeri) ? rawZeri : null;
	// 认得的键:按空状态拼出的补丁非空(本命 / 输入框不论有没有都会写,单独认)
	const recognized = !!zeriObj && (!!zeriPayloadToStatePatch(zeriObj, {}) || !!normalizeSavedNatal(zeriObj.natal)
		|| !!(zeriObj.natalInput && typeof zeriObj.natalInput === 'object' && !Array.isArray(zeriObj.natalInput)));
	const zeri = recognized ? zeriObj : { ...(zeriObj || {}), natal: null };
	const fullDefaultOptions = typeof host.zeriFullDefaultOptions === 'function' ? ()=>host.zeriFullDefaultOptions() : null;
	const next = zeriPayloadToStatePatch(zeri, host.state, { fullDefaultOptions }) || {};
	// 存案没带扫描结果:结果列表跟着清空(否则留着本会话上一次扫描的结果,判读却按存案口径)。清成「没扫过」(null),
	// 不是「扫过、0 命中」([]):工作台据此显示「尚未择时」,再存一次也不会固化成扫过
	if(!Array.isArray(zeri.results)){ next.results = null; next.truncated = false; }
	// 正在扫描时载入存案:作废这一次(取消 + 推进运行代次),扫描态收起 —— 否则扫完把本次的结果写回来,配着存案的冻结口径
	if(host.state && host.state.scanning){
		if(typeof host.cancelScan === 'function'){ try{ host.cancelScan(); }catch(e){ /* 取消失败:代次照样作废 */ } }
		host._scanRun = (host._scanRun || 0) + 1;
		next.scanning = false;
		if(Object.prototype.hasOwnProperty.call(host.state, 'progress')){ next.progress = null; }
		if(Object.prototype.hasOwnProperty.call(host.state, 'scanProgress')){ next.scanProgress = null; }
	}
	// 载入存案 = 按存案的工作台、点选时刻与存档时内嵌页左栏的改动看盘:覆盖层换成存案里记的那份(没记 = 清空;见 utils/scopedFieldsSink)。
	// 底板用还原后的工作台活值(本会话上一次扫描的冻结口径不是这条存案的);还原后由宿主重排(replotAfterRestore),
	// 此前只改状态不重画 —— 左栏已是存档时刻,盘还是旧的
	host._plotFrozen = false;
	host._plotBaseKey = null;
	// 按行号缓存的判读(工作台「详情」按 扫描代次:行号 取)换代:否则上一轮扫描那一行的判读套到存案的同一行上
	if(host.state && Object.prototype.hasOwnProperty.call(host.state, 'scanEpoch')){ next.scanEpoch = (host.state.scanEpoch || 0) + 1; }
	host.setState(host.state && host.state.embedPatch !== undefined
		? { ...next, embedPatch: deserializeEmbedPatch(zeri && zeri.embedPatch, mkSavedDateTime), embedRev: (host.state.embedRev || 0) + 1 } : next, ()=>{
		restoreScanFreeze(host, Array.isArray(zeri.results));
		// 宿主的载入后钩子(可选):如按还原后的覆盖层记下「由存案复原」的锁定项(显式标记,见 zeriPageCalibre.zeriLockProps)
		if(typeof host.onZeriCaseRestored === 'function'){
			try{ host.onZeriCaseRestored(); }catch(e){ /* 标记失败:锁定项照常锁定 */ }
		}
		// 快照前 N 行判读(七政 / 印度预取的)也换成存案这一次的:作废旧批、按存案结果重新预取(取齐后重存本槽快照);
		// 没结果时清掉,并让宿主重存一次本槽快照(印度槽此前载入后没人重写,再存一次会把上一轮的三段存进去)
		host._snapshotExplains = null;
		host._explainEpoch = (host._explainEpoch || 0) + 1;
		// 先无条件重存一次本槽快照(扫过 0 命中 / 判读行数设为 0 时预取直接返回、不重存,槽里还是上一轮扫描的三段):
		// 凡能合成择时三段的宿主一律同一调用(先请内嵌页按当前盘 + 存案的三段重存,答不了才写宿主三段)——
		// 此前只在宿主自己实现了可选的重存方法时才做,只有印度实现了,七政 / 八字 / 紫微 / 黄历载入后槽里留着上一轮的三段
		if(typeof host.composeAiSnapshot === 'function'){
			try{ refreshZeriSlot(host, scope); }catch(e){ /* 静默 */ }
		}
		if(Array.isArray(zeri.results) && typeof host.prefetchSnapshotExplains === 'function'){
			try{ host.prefetchSnapshotExplains(host.state.results); }catch(e){ /* 预取失败:快照只列清单 */ }
		}
		const replot = ()=>{
			if(!host.unmounted && typeof host.replotAfterRestore === 'function'){
				try{ host.replotAfterRestore(); }catch(e){ /* 重排失败:盘面停在上一张,左栏已是存档 */ }
			}
		};
		// 存案记下了所见那张盘(zeri.plotted):按还原后的工作台重建的底板与它逐键比,不同的并进覆盖层再重排 ——
		// 存案的承诺是「载回所见」(工作台改了没重排就存,底板与所见那张盘不同)。旧存案没有 plotted → 照旧按工作台 + 覆盖层
		const diff = plottedOverlayDiff(host, zeri.plotted);
		if(diff && host.state && host.state.embedPatch !== undefined){
			host.setState((s)=>({ embedPatch: { ...(s.embedPatch || {}), ...diff }, embedRev: (s.embedRev || 0) + 1 }), replot);
		}else{
			replot();
		}
	});
	return true;
}

// 所见那张盘里要随存案记下的键:宿主底板(buildFields)里有的那些(时间 / 地点 / 性别 / 口径);宿主没有底板函数 → 所见那张盘的全部键
function plottedKeysOf(host, plotted){
	let base = null;
	try{ base = host && typeof host.buildFields === 'function' ? host.buildFields(false) : null; }catch(e){ base = null; }
	return Object.keys(base && typeof base === 'object' ? base : plotted).filter((k)=>Object.prototype.hasOwnProperty.call(plotted, k));
}

// 载回:还原后的工作台重建的底板(含存案里的覆盖层)与存案记下的所见那张盘逐键比 → 不同的那些(覆盖层补丁形状);没有 / 全同 → null
export function plottedOverlayDiff(host, savedPlotted){
	if(!savedPlotted || typeof savedPlotted !== 'object' || !host || typeof host.buildFields !== 'function'){ return null; }
	let base = null;
	try{ base = host.buildFields(false); }catch(e){ base = null; }
	if(!base || typeof base !== 'object'){ return null; }
	const seen = deserializeEmbedPatch(savedPlotted, mkSavedDateTime);
	const diff = {};
	Object.keys(seen).forEach((k)=>{
		if(!Object.prototype.hasOwnProperty.call(base, k)){ return; }
		const b = base[k] && typeof base[k] === 'object' && 'value' in base[k] ? base[k].value : base[k];
		if(!sameFieldValue(b, seen[k].value)){ diff[k] = { value: seen[k].value }; }
	});
	return Object.keys(diff).length ? diff : null;
}

// 两个字段值是否同一个(时刻按格式化串比;其余按字面)
function sameFieldValue(a, b){
	const fa = a && typeof a.format === 'function' ? a.format('YYYY-MM-DD HH:mm:ss') : a;
	const fb = b && typeof b.format === 'function' ? b.format('YYYY-MM-DD HH:mm:ss') : b;
	return `${fa === undefined || fa === null ? '' : fa}` === `${fb === undefined || fb === null ? '' : fb}`;
}

// 存档负载(与还原同形):cfg/tree/results/truncated 之外补 geo/options/natal/pickText(缺者不写键)。
// plotted(可选):内嵌页实际起盘所用的 fields(所见那张盘)—— 覆盖层里与它不同的键是没确定、没上盘的草稿,不随存案
export function buildZeriCasePayload(host, plotted){
	const st = (host && host.state) || {};
	const out = {
		cfg: (host && host._scanCfg) || st.cfg,
		tree: (host && host._scanUiTree) || st.tree,
		results: st.results,
		truncated: !!st.truncated,
	};
	const geo = (host && host._scanGeo) || st.geo;
	const options = (host && host._scanOptions) || st.options;
	if(geo && typeof geo === 'object'){ out.geo = { ...geo }; }
	if(options && typeof options === 'object'){ out.options = { ...options }; }
	// 本命与 cfg / tree 同律取扫描冻结值(结果是按它扫的);有本命这一项的宿主显式写(没有 = null),载回时据此清空会话里的本命
	if(Object.prototype.hasOwnProperty.call(st, 'natal')){
		const frozenNatal = host && host._scanUiJson && Object.prototype.hasOwnProperty.call(host, '_scanNatal');
		const natal = frozenNatal ? host._scanNatal : st.natal;
		out.natal = natal && typeof natal === 'object' ? natal : null;
	}
	if(Object.prototype.hasOwnProperty.call(st, 'natalInput')){
		const frozenIn = host && host._scanUiJson && Object.prototype.hasOwnProperty.call(host, '_scanNatalInput') && host._scanNatalInput;
		const ni = frozenIn || st.natalInput;
		if(ni && typeof ni === 'object'){ out.natalInput = { ...ni }; }
	}
	if(typeof st.pickText === 'string' && st.pickText){ out.pickText = st.pickText; }
	// 内嵌页左栏在点选之后又亲手改过的字段(覆盖层):随存案记下,载回时还原 —— 存案的快照是叠过覆盖层的那张盘
	let patch = st.embedPatch;
	if(patch && typeof patch === 'object' && plotted && typeof plotted === 'object'){
		patch = {};
		Object.keys(st.embedPatch).forEach((k)=>{
			const pv = st.embedPatch[k];
			const v = pv && typeof pv === 'object' && 'value' in pv ? pv.value : pv;
			if(!Object.prototype.hasOwnProperty.call(plotted, k) || sameFieldValue(plotted[k] && plotted[k].value, v)){ patch[k] = pv; }
		});
	}
	const embed = serializeEmbedPatch(patch);
	if(embed){ out.embedPatch = embed; }
	// 所见那张盘(时间 / 地点 / 性别 / 口径):载回时与按工作台重建的底板比,不同的并进覆盖层(见 plottedOverlayDiff)
	if(plotted && typeof plotted === 'object'){
		const keep = {};
		plottedKeysOf(host, plotted).forEach((k)=>{ keep[k] = plotted[k]; });
		const seen = serializeEmbedPatch(keep);
		if(seen){ out.plotted = seen; }
	}
	return out;
}
