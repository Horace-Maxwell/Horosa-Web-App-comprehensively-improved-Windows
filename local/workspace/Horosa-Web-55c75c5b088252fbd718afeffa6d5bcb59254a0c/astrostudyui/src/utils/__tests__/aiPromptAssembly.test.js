// 系统提示词拼装单源合同:对话页与无头回合合并前各自的写法(照抄为参照实现)在各种组合下与 assembleSystemPrompt 逐字节相同;
// 页面与无头两处都只经 assembleSystemPrompt 拼装(源码锁),无头不再自带一张挥发层表。
import fs from 'fs';
import path from 'path';
import { assembleSystemPrompt, droppedLayersNote, PROMPT_CACHE_BREAKPOINT } from '../aiPromptAssembly';
import { clipContextLayersDetailed, VOLATILE_LAYER_KEYS, hashPromptText } from '../aiAnalysisContext';
import { getProviderProtocolFamily } from '../aiAnalysisProviders';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const BP = '[[__CACHE_BP__]]';
const join = (arr)=>arr.map((item)=>`${item.title}\n${item.content}`).join('\n\n').trim();

// —— 参照:对话页合并前(AIAnalysisMain.buildResolvedPromptImpl 那一段) ——
function oldPage({ layers, maxChars, providerType, historyMode, json }){
	const clipDetail = clipContextLayersDetailed(layers, { maxChars, fairShare: true });
	const fam = getProviderProtocolFamily(providerType);
	let sys;
	const stableL = clipDetail.kept.filter((item)=>!VOLATILE_LAYER_KEYS[item.key]);
	const volatileL = clipDetail.kept.filter((item)=>VOLATILE_LAYER_KEYS[item.key]);
	const cacheFam = fam === 'anthropic' || fam === 'openai-compatible';
	if(cacheFam && stableL.length && volatileL.length){ sys = [join(stableL), join(volatileL)].filter(Boolean).join(`\n\n${BP}\n\n`); }
	else if(cacheFam && stableL.length && historyMode === 'window'){ sys = `${join(stableL)}\n\n${BP}`; }
	else{ sys = join(stableL.concat(volatileL)); }
	if(clipDetail.dropped && clipDetail.dropped.length){
		const names = clipDetail.dropped.map((item)=>`${(item && (item.title || item.key)) || ''}`.replace(/^使用技法：/, '')).filter(Boolean);
		if(names.length){ sys = `${sys}\n\n[挂载预算不足：以下 ${names.length} 层整层未纳入 —— ${names.join('、')}。未列出的内容不代表不存在，请勿臆补；如需完整资料，请提示用户在「进阶 → 对话上下文策略 → 挂载字数预算」里调大，或减少挂载技法。]`; }
	}
	if(json){ sys = `${sys}\n\nJSON-ONLY`; }
	return { sys, stableHash: hashPromptText(join(stableL)), stableChars: join(stableL).length, volatileChars: join(volatileL).length, layerKeys: clipDetail.kept.map((i)=>i.key) };
}
// —— 参照:无头合并前(goalRunner.buildHeadlessSystemPrompt 那一段;自带挥发层表,少 turn-extra) ——
function oldHeadless({ layers, maxChars, providerType }){
	const clip = clipContextLayersDetailed(layers, { maxChars, fairShare: true });
	const volatileKeys = { 'retrieved-context': 1, 'recent-history': 1 };
	const stable = clip.kept.filter((item)=>!volatileKeys[item.key]);
	const volatile = clip.kept.filter((item)=>volatileKeys[item.key]);
	const fam = getProviderProtocolFamily(providerType);
	const cacheFam = fam === 'anthropic' || fam === 'openai-compatible';
	let joined;
	if(cacheFam && stable.length && volatile.length){ joined = [join(stable), join(volatile)].filter(Boolean).join(`\n\n${BP}\n\n`); }
	else if(cacheFam && stable.length){ joined = `${join(stable)}\n\n${BP}`; }
	else{ joined = join(clip.kept); }
	const note = droppedLayersNote(clip.dropped);
	if(note){ joined = `${joined}\n\n${note}`; }
	return { sys: joined, meta: { stableHash: hashPromptText(join(stable)), stableChars: join(stable).length, volatileChars: join(volatile).length, layerKeys: clip.kept.map((i)=>i.key), droppedKeys: (clip.dropped || []).map((i)=>i.key) } };
}

const big = (tag, n)=>Array.from({ length: n }).map((_, i)=>`[段${i}]\n${tag}${'甲'.repeat(200)}`).join('\n');
const L = {
	system: { key: 'system', title: '系统提示', priority: 100, content: '你是星阙的 AI 分析助手。' },
	source: { key: 'source', title: '案例前提：张三', priority: 95, content: '[起盘信息]\n张三' },
	rule: { key: 'dayBoundaryRule', title: '排盘规则', priority: 94, content: '日界子正' },
	ziwei: { key: 'technique:ziwei', title: '使用技法：紫微斗数', priority: 93, content: big('紫微', 12) },
	bazi: { key: 'technique:bazi', title: '使用技法：八字', priority: 92, content: big('八字', 12) },
	material: { key: 'material:m1', title: '资料：古籍', priority: 70, content: big('资料', 6) },
	retrieved: { key: 'retrieved-context', title: '检索命中', priority: 80, content: '片段一' },
	history: { key: 'recent-history', title: '最近对话', priority: 60, content: '[user] 你好' },
	turnExtra: { key: 'turn-extra', title: '本轮附加上下文', priority: 85, content: '【输出格式】要点式' },
};
const SETS = {
	stableOnly: [L.system, L.source, L.rule, L.ziwei],
	withVolatile: [L.system, L.source, L.rule, L.ziwei, L.retrieved, L.history],
	withTurnExtra: [L.system, L.source, L.rule, L.ziwei, L.turnExtra],
	everything: [L.system, L.source, L.rule, L.ziwei, L.bazi, L.material, L.retrieved, L.history, L.turnExtra],
	empty: [],
};
const PROVIDERS = ['anthropic', 'openai', 'deepseek', 'gemini', 'ollama'];
const BUDGETS = [1000000, 3000, 600];

describe('拼装单源与合并前两处写法逐字节相同', ()=>{
	test('对话页:家族 × 历史模式 × 层组合 × 预算(含丢层)× JSON 尾句', ()=>{
		let n = 0;
		PROVIDERS.forEach((pt)=>['system', 'window'].forEach((hm)=>Object.keys(SETS).forEach((k)=>BUDGETS.forEach((budget)=>[false, true].forEach((json)=>{
			const old = oldPage({ layers: SETS[k], maxChars: budget, providerType: pt, historyMode: hm, json });
			const now = assembleSystemPrompt({ layers: SETS[k], maxChars: budget, providerType: pt, breakpointWhenNoVolatile: hm === 'window', tailInstruction: json ? 'JSON-ONLY' : '' });
			expect(now.systemPrompt).toBe(old.sys);
			expect(now.meta.stableHash).toBe(old.stableHash);
			expect(now.meta.stableChars).toBe(old.stableChars);
			expect(now.meta.volatileChars).toBe(old.volatileChars);
			expect(now.meta.layerKeys).toEqual(old.layerKeys);
			n += 1;
		})))));
		expect(n).toBe(PROVIDERS.length * 2 * Object.keys(SETS).length * BUDGETS.length * 2);
	});
	test('无头:家族 × 层组合(无头从不带 turn-extra)× 预算;meta 同形', ()=>{
		PROVIDERS.forEach((pt)=>Object.keys(SETS).filter((k)=>k !== 'withTurnExtra' && k !== 'everything').forEach((k)=>BUDGETS.forEach((budget)=>{
			const old = oldHeadless({ layers: SETS[k], maxChars: budget, providerType: pt });
			const now = assembleSystemPrompt({ layers: SETS[k], maxChars: budget, providerType: pt, breakpointWhenNoVolatile: true });
			expect(now.systemPrompt).toBe(old.sys);
			expect(now.meta).toEqual(old.meta);
		})));
	});
	test('断点常量与后端 AI 代理同一字面;丢层留痕只在有丢层时出现', ()=>{
		expect(PROMPT_CACHE_BREAKPOINT).toBe(BP);
		expect(droppedLayersNote([])).toBe('');
		expect(droppedLayersNote([{ title: '使用技法：八字' }])).toContain('以下 1 层整层未纳入 —— 八字');
	});
	test('源码锁:页面与无头两处都只经 assembleSystemPrompt 拼装,无头不再自带挥发层表', ()=>{
		const main = readSource(path.join(__dirname, '../../components/aianalysis/AIAnalysisMain.js'));
		const goal = fs.readFileSync(path.join(__dirname, '../aiAgent/goalRunner.js'), 'utf8');
		expect(main.indexOf('const assembled = assembleSystemPrompt({')).toBeGreaterThan(-1);
		expect(goal.indexOf('const assembled = assembleSystemPrompt({')).toBeGreaterThan(-1);
		expect(goal.indexOf("const volatileKeys = { 'retrieved-context': 1, 'recent-history': 1 };")).toBe(-1);
		expect(main.indexOf('_stableL.concat(_volatileL)')).toBe(-1);
	});
});
