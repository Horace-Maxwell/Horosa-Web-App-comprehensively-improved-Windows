// [2026-09-11] @ 引用技法池覆盖率棘轮:池(全技法并集)⊇ 命盘类 ∪ 事盘类 全键;标签表里不在池内的键恰等于成文白名单
// (节气盘系/骰子/风水/辅助=源码成文豁免;huangli/tongshu 只在起课时间源可挂;9 个择日子技法是工作台页非可挂单盘)——新增技法漏进 @ 即红。
import { ANALYSIS_TECHNIQUE_LABELS, ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES, listAllAnalysisTechniqueOptions, listAnalysisTechniqueOptions } from '../aiAnalysisContext';
import { buildMentionCandidates } from '../aiChat/mentions';

const WHITELIST = ['jieqi', 'jieqi_meta', 'jieqi_chunfen', 'jieqi_xiazhi', 'jieqi_qiufen', 'jieqi_dongzhi', 'jieqipan', 'otherbu', 'fengshui', 'cntradition', 'huangli', 'tongshu',
	'huanglizeri', 'bazizeri', 'taiyizeri', 'ziweizeri', 'liurengzeri', 'sanshizeri', 'qizhengzeri', 'indiazeri', 'rizi'];

it('🔴 @ 池 ⊇ 命盘类 ∪ 事盘类 全部技法(六爻/六壬/奇门/太乙/卜卦盘/择日盘等事盘技法在命盘源下也能 @ 到,只是灰显)', ()=>{
	const all = listAllAnalysisTechniqueOptions();
	const keys = new Set(all.map((o)=>o.value));
	[...ANALYSIS_CHART_TECHNIQUES, ...ANALYSIS_CASE_TECHNIQUES].forEach((k)=>expect(keys.has(k)).toBe(true));
	['bazi', 'ziwei', 'sixyao', 'liureng', 'qimen', 'taiyi', 'horary', 'election', 'astrochart'].forEach((k)=>expect(keys.has(k)).toBe(true));
	const chartAllowed = new Set(listAnalysisTechniqueOptions({ sourceType: 'chart' }).map((o)=>o.value));
	const pool = buildMentionCandidates({ techniqueOptions: all, techniqueAvailable: (k)=>(chartAllowed.has(k) ? true : '需事盘案例') });
	const techs = pool.filter((x)=>x.kind === 'technique');
	expect(techs.length).toBe(all.length);
	expect(techs.find((x)=>x.key === 'bazi').available).toBe(true);
	expect(techs.find((x)=>x.key === 'sixyao')).toEqual(expect.objectContaining({ available: false, why: '需事盘案例' }));
	expect(techs.every((x)=>`${x.label}`.length > 0 && !/^[a-z_]+$/.test(x.label))).toBe(true);   // 每个技法都有中文标签(不裸露键名)
});

it('🔴 标签表 − 池 恰等于成文白名单(新增技法只登记标签、没进 chart/case 数组 = 漏进 @,判红)', ()=>{
	const keys = new Set(listAllAnalysisTechniqueOptions().map((o)=>o.value));
	const missing = Object.keys(ANALYSIS_TECHNIQUE_LABELS).filter((k)=>!keys.has(k)).sort();
	expect(missing).toEqual(WHITELIST.slice().sort());
});
