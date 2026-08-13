// settings(engine 键) ↔ TarotMain state 键 映射单源。保存(settingsFromState)与载入(statePatchFromSavedSettings)
// 共用同一张表,根治「存而不载」漂移(此前 meaningSystem/reversalMode/suitElementSwap 只存不载,载入后静默回默认)。
// 新增设置键只加一行即双向生效;tarotSettingsRoundtrip.test 锁双向完备。纯数据+纯函数,无 React 依赖。
export const SETTINGS_STATE_MAP = [
	['reversals', 'useReversals'], ['dignities', 'useDignities'], ['variant', 'variant'],
	['showCorrespondences', 'showCorrespondences'], ['sig', 'sig'], ['verdictMode', 'verdictMode'],
	['birth', 'birth'], ['question', 'question'], ['artStyle', 'artStyle'],
	['meaningSystem', 'meaningSystem'], ['reversalMode', 'reversalMode'], ['suitElementSwap', 'suitElementSwap'],
	['dummettOrder', 'dummettOrder'], ['ookTable', 'ookTable'],
	['reversalGen', 'reversalGen'], ['crossingUpright', 'crossingUpright'],
	['quintMode', 'quintMode'], ['showBottomCard', 'showBottomCard'],
	['edVersion', 'edVersion'], ['astroModern', 'astroModern'],
	['timingMethod', 'timingMethod'], ['timingUnit', 'timingUnit'],
	['majorsOverlay', 'majorsOverlay'], ['showCutCard', 'showCutCard'], ['includeBlank', 'includeBlank'],
	['courtElementSystem', 'courtElementSystem'], ['courtZodiacSystem', 'courtZodiacSystem'],
];

// 由 state 组装 settings(传给 engine buildReading / 存档 payload.options.settings)
export function settingsFromState(s){
	const out = {};
	SETTINGS_STATE_MAP.forEach(([sk, stk]) => { out[sk] = s[stk]; });
	return out;
}

// 载入用:由已存 settings 反解 state patch(键集与保存同源;缺省回落 defaults 对应值)。
// question 不在此表回灌(载入以 options.question 为准,沿旧行为);
// null 与 undefined 同回落默认(sig/birth 为对象,下游直取 .mode/.year,null 会炸)。
export function statePatchFromSavedSettings(st, defaults){
	const src = st || {};
	const dft = defaults || {};
	const patch = {};
	SETTINGS_STATE_MAP.forEach(([sk, stk]) => {
		if(sk === 'question'){ return; }
		patch[stk] = (src[sk] === undefined || src[sk] === null) ? dft[stk] : src[sk];
	});
	return patch;
}
