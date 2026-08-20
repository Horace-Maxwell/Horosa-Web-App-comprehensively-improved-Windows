// utils/judgeLayerOverrides.js
// 判读引擎「全局层」的唯一组装点：horaryJudgeOpts / runElection 的第 2 层输入。
//
// 判读相关全局键分居两个 store——
//   classicalChartGlobals（排盘级,同时透传后端显示链）:cazimiOrb/combustOrb/underBeamsOrb/
//     vocMode/vocIncludeOuter/fixedStarOrb/fixedStarOrbMode;
//   divinationJudgeGlobals（纯判读级）:combustMitigateSameSign/antiscia。
// 本函数合并双 store 的 overrides（只含用户改过≠默认的键）,键名与 HORARY_PARAM_SPEC 一致,
// 保证 horaryJudgeOpts 四层优先级(内建默认<全局层<流派差异集<页面覆盖)语义零变。
// 类型口径:vocIncludeOuter 在 classical 仓存 0/1 → 判读层收编为 bool。
import { classicalGlobalOverrides } from './classicalChartGlobals';
import { divinationJudgeOverrides } from './divinationJudgeGlobals';

const JUDGE_KEYS_FROM_CLASSICAL = [
	'cazimiOrb', 'combustOrb', 'underBeamsOrb',
	'vocMode', 'vocIncludeOuter', 'fixedStarOrb', 'fixedStarOrbMode',
	'viaCombustaVariant', 'partileDef',
	'antisciaOrb',   // [R5-P1] 两接收端(horarySchools JUDGE_KEYS/electionParams 白名单)早已就位,发送端漏此一行=卜卦映点表/择日映点模块恒 1° 兜底
];

export function judgeLayerOverrides(){
	const c = classicalGlobalOverrides();
	const out = {};
	JUDGE_KEYS_FROM_CLASSICAL.forEach((k) => {
		if(c[k] === undefined){ return; }
		out[k] = (k === 'vocIncludeOuter') ? !!c[k] : c[k];
	});
	return { ...out, ...divinationJudgeOverrides() };
}

export default judgeLayerOverrides;
