// 非页面新建入口的随盘设置(单源):AI 建档 / 名人库加入 / AI 页草稿存为命盘 / 从其它软件导入 / AI 合成的本命源。
// 一律按「此刻点「新命盘」会用的缺省」记下 —— 技法设置 = 新盘种子 + 古典全局(与「新命盘」同一字段工厂);
// 紫微 = 你自己的设置(不是刚载入那张盘的)。页面上的「存为命盘」不走这里,它记的是当前所见。
// 此前这些入口只打代次标记、不带任何设置 → 载入后全是出厂值,与在页面上新建的同一个人不一样。
// 字段工厂没注册的场合(无头运行、纯工具单测):技法部分按「全局口径」那几类键自己拼一份 —— 古典全局(每键 = 当前全局值)
// + 新盘种子(schema 本有的键 = 当前种子值;schema 没有的只在存过非默认时带上),与「新命盘」字段工厂里这两类键同一取值;
// 其余技法键在工厂里恒等于基准、本来就不落。此前工厂缺席时技法部分为空、只打标记 → 无头里 AI 建的盘 / 临时本命源
// 带标记却缺键,一律按出厂值算,用户设的古典全局与新盘种子全不生效(与桌面同一个人同一次调用结果不同)。
import { captureNonDefaultTechniqueFields, fieldsSchemaBaseline, markFieldsCaptured } from './recordFieldsRestore';
import { captureNewChartZiweiSettings } from './ziweiRecordSettings';
import { CLASSICAL_SPEC_KEYS } from './classicalParamSpec';
import { classicalGlobalValue } from './classicalChartGlobals';
import { NEW_CHART_SEED_KEYS, newChartSeedIsInSchema, newChartSeedValue, newChartSeedExtraEntries } from './newChartSeeds';

// 工厂缺席时的替身:只含古典全局键与新盘种子键(取值口径与工厂相同)
export function globalsOnlyNewChartFields(){
	const fields = {};
	CLASSICAL_SPEC_KEYS.forEach((k)=>{ fields[k] = { value: classicalGlobalValue(k), name: [k] }; });
	NEW_CHART_SEED_KEYS.forEach((k)=>{ if(newChartSeedIsInSchema(k)){ fields[k] = { value: newChartSeedValue(k), name: [k] }; } });
	Object.assign(fields, newChartSeedExtraEntries());
	return fields;
}

export function captureNewChartDefaults(){
	const out = {};
	try{
		const base = fieldsSchemaBaseline();
		const fields = base && typeof base === 'object' && Object.keys(base).length ? base : globalsOnlyNewChartFields();
		Object.assign(out, captureNonDefaultTechniqueFields(fields));
	}catch(e){ /* 取不到:只打标记 */ }
	try{
		Object.assign(out, captureNewChartZiweiSettings());
	}catch(e){ /* 取不到:只打标记 */ }
	return out;
}

// values 里已有的键不覆盖(调用方显式给的口径优先),补上新盘缺省并打代次标记。返回新对象。
// forStore:要写进命盘库的新记录 —— 另带「按当前设置新建」标志,全局流派类设置(埃及历等)随盘记下,与页面新建同。
export function withNewChartDefaults(values, { forStore = false } = {}){
	const v = { ...(values || {}) };
	const cap = captureNewChartDefaults();
	Object.keys(cap).forEach((k)=>{
		if(v[k] === undefined){ v[k] = cap[k]; }
	});
	if(forStore){ v.captureCurrentGlobals = true; }
	return markFieldsCaptured(v);
}
