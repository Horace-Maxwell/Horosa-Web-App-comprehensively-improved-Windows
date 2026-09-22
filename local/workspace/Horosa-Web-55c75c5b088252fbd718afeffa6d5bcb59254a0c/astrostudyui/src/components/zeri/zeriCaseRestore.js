// [Q-270/T-264] 择日宿主「载入存案 → 还原工作台态」共享件。
// 此前只有奇门择日宿主自还原 payload.zeri;八字/紫微/黄历/印度/七政五宿主存了 payload.zeri 却全仓零读取
// (载入存案不还原工作台与点选时刻)。本件照 QimenZeriMain.restoreWorkbenchFromCase 同律:
//   store.user.currentCase 命中本宿主 scope → 版本守卫(cid|updateTime|载入代次) → payload.zeri → setState 补丁。
import { getStore } from '../../utils/storageutil';
import { caseApplySeqSuffix } from '../../utils/kentangCaseSave';

// 从 payload.zeri 拼 state 补丁(纯函数,单测锚)。
export function zeriPayloadToStatePatch(zeri, state){
	if(!zeri || typeof zeri !== 'object'){ return null; }
	const st = state || {};
	const next = {};
	if(zeri.cfg && typeof zeri.cfg === 'object' && zeri.cfg.startDate){ next.cfg = { ...(st.cfg || {}), ...zeri.cfg }; }
	if(zeri.geo && typeof zeri.geo === 'object'){ next.geo = { ...(st.geo || {}), ...zeri.geo }; }
	if(zeri.options && typeof zeri.options === 'object'){ next.options = { ...(st.options || {}), ...zeri.options }; }
	if(zeri.natal !== undefined && zeri.natal !== null && typeof zeri.natal === 'object'){ next.natal = zeri.natal; }
	if(typeof zeri.pickText === 'string' && zeri.pickText){ next.pickText = zeri.pickText; }
	if(zeri.tree && typeof zeri.tree === 'object' && Array.isArray(zeri.tree.children)){ next.tree = zeri.tree; }
	if(Array.isArray(zeri.results)){
		next.results = zeri.results;
		next.truncated = !!zeri.truncated;
	}
	return Object.keys(next).length ? next : null;
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
	const cid = `${currentCase.cid.value}`;
	const updateTime = currentCase.updateTime && currentCase.updateTime.value ? `${currentCase.updateTime.value}` : '';
	// 载入代次后缀(kentangCaseSave.caseApplySeqSuffix):同一条记录第二次载入不被去重守卫拦掉。
	const caseVersion = `${cid}|${updateTime}${caseApplySeqSuffix(userState)}`;
	if(host._lastRestoredZeriCase === caseVersion){ return false; }
	host._lastRestoredZeriCase = caseVersion;
	let payload = currentCase.payload ? currentCase.payload.value : null;
	if(typeof payload === 'string'){
		try{ payload = JSON.parse(payload); }catch(e){ payload = null; }
	}
	const zeri = payload && payload.zeri && typeof payload.zeri === 'object' ? payload.zeri : null;
	const next = zeriPayloadToStatePatch(zeri, host.state);
	if(!next){ return false; }
	host.setState(next);
	return true;
}

// 存档负载(与还原同形):cfg/tree/results/truncated 之外补 geo/options/natal/pickText(缺者不写键)。
export function buildZeriCasePayload(host){
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
	if(st.natal && typeof st.natal === 'object'){ out.natal = st.natal; }
	if(typeof st.pickText === 'string' && st.pickText){ out.pickText = st.pickText; }
	return out;
}
