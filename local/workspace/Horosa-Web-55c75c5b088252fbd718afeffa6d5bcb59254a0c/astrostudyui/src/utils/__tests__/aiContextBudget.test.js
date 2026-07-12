// [挂载预算三修] clipContextLayersDetailed 预算引擎回归：
// oracle = 改前 clipContextLayers 旧贪心算法原样拷贝（legacyClip），
// 未触界 / 恰好等界 / 未开 fairShare 三态输出必须与 oracle 逐字节相等（零回归铁律）；
// fairShare 触界走公平分摊：技法层保底不静默丢 + 段对齐裁剪 + dropped 有账可查。
// mock 头与 aiAnalysisContext.test.js 同套（模块加载所需），fixture 取空即可。

jest.mock('../localcharts', ()=>({
	listLocalCharts: jest.fn(()=>[]),
}));

jest.mock('../localcases', ()=>({
	listLocalCases: jest.fn(()=>[]),
	getCaseTypeLabel: jest.fn((type)=>type),
	getCaseTypeMeta: jest.fn(()=>({ module: 'sanshiunited', value: 'sanshiunited' })),
}));

jest.mock('../astroAiSnapshot', ()=>({
	buildAstroSnapshotContent: jest.fn(()=> 'snapshot'),
	loadAstroAISnapshot: jest.fn(()=>null),
}));

jest.mock('../moduleAiSnapshot', ()=>({
	loadModuleAISnapshot: jest.fn(()=>null),
	saveModuleAISnapshot: jest.fn(),
}));

jest.mock('../../services/astro', ()=>({
	fetchChart: jest.fn(async ()=>({ Result: { chart: { objects: [], stars: [] }, lots: [] } })),
}));

jest.mock('../request', ()=>({
	__esModule: true,
	default: jest.fn(async ()=>({ Result: {} })),
}));

jest.mock('../preciseCalcBridge', ()=>({
	fetchPreciseNongli: jest.fn(async ()=>({})),
}));

jest.mock('../aiAnalysisStore', ()=>({
	AI_ANALYSIS_STORES: {
		contextCache: 'contextCache',
	},
	getStoreRecord: jest.fn(async ()=>null),
	putStoreRecord: jest.fn(async (storeName, record)=>record),
}));

jest.mock('../../components/lrzhan/LiuRengMain', ()=>({
	buildLiuRengSnapshotText: jest.fn(()=> '自动生成的大六壬快照'),
}));

jest.mock('../../components/jinkou/JinKouMain', ()=>({
	buildJinKouSnapshotText: jest.fn(()=> '自动生成的金口诀快照'),
}));

jest.mock('../../components/jinkou/JinKouCalc', ()=>({
	buildJinKouData: jest.fn(()=>({ ready: true, topInfo: { diFen: '子' }, rows: [] })),
}));

jest.mock('../../components/jinkou/JinKouState', ()=>({
	resolveJinKouDiFen: jest.fn(()=> '子'),
}));

jest.mock('../../components/dunjia/DunJiaCalc', ()=>({
	calcDunJia: jest.fn(()=>({ kind: 'qimen-pan' })),
	buildDunJiaSnapshotText: jest.fn(()=> '自动生成的奇门快照'),
}));

jest.mock('../../components/taiyi/TaiYiCalc', ()=>({
	calcTaiyi: jest.fn(()=>({ kind: 'taiyi-pan' })),
	fetchTaiyiPan: jest.fn(async ()=>({ kind: 'taiyi-pan' })),
	buildTaiyiSnapshotText: jest.fn(()=> '自动生成的太乙快照'),
}));

jest.mock('../../components/tongshefa/TongSheFaMain', ()=>({
	buildTongSheFaModel: jest.fn((selection)=>selection),
	buildTongSheFaSnapshot: jest.fn(()=> '自动生成的统摄法快照'),
}));

jest.mock('../../components/guazhan/GuaZhanMain', ()=>({
	buildGuaSnapshotText: jest.fn(()=> '自动生成的六爻快照'),
}));


jest.mock('../../divination/horary/horaryEngine', ()=>({
	runHorary: jest.fn(()=>({ verdict: { leaning: 'even' } })),
	ASPECT_CN: {},
}));
jest.mock('../../divination/horary/horarySnapshot', ()=>({
	buildHorarySnapshot: jest.fn(()=> '自动生成的卜卦盘快照'),
}));
jest.mock('../../divination/election/electionEngine', ()=>({
	runElection: jest.fn(()=>({ overall: { score: 80 } })),
}));
jest.mock('../../divination/election/electionSnapshot', ()=>({
	buildElectionSnapshot: jest.fn(()=> '自动生成的择日盘快照'),
}));

jest.mock('../../components/comp/DateTime', ()=> jest.fn().mockImplementation(()=>({
	ad: 1,
	zone: '+08:00',
	clone(){
		return this;
	},
	startOf(){
		return this;
	},
	format(fmt){
		if(fmt === 'YYYY/MM/DD'){
			return '2026/04/04';
		}
		return '10:00:00';
	},
})));

import fs from 'fs';
import path from 'path';
import {
	AI_CONTEXT_MAX_CHARS,
	buildContextLayers,
	buildPromptContext,
	clipContextLayersDetailed,
} from '../aiAnalysisContext';

// ============ oracle：改前 clipContextLayers 旧算法原样拷贝（一行不改） ============
function legacyClip(layers, options = {}){
	const maxChars = options.maxChars || 18000; // 改前 DEFAULT_CONTEXT_CHAR_LIMIT 字面
	const sorted = (layers || []).slice(0).sort((a, b)=>b.priority - a.priority);
	const kept = [];
	let totalChars = 0;
	sorted.forEach((item)=>{
		const content = `${item.content || ''}`.trim();
		if(!content){
			return;
		}
		const nextChars = totalChars + content.length;
		if(nextChars <= maxChars){
			kept.push({
				...item,
				content,
				clipped: false,
			});
			totalChars = nextChars;
			return;
		}
		if(kept.length === 0 || item.priority >= 90){
			const remain = Math.max(0, maxChars - totalChars);
			if(remain > 120){
				kept.push({
					...item,
					content: `${content.slice(0, remain)}\n...[已裁剪]`,
					clipped: true,
				});
				totalChars = maxChars;
			}
		}
	});
	return kept;
}

// 与 buildPromptContext / buildResolvedPrompt 逐字同式的 join。
const joinPrompt = (kept)=>kept.map((item)=>`${item.title}\n${item.content}`).join('\n\n').trim();

const mkLayer = (key, title, priority, content)=>({ key, title, priority, content });

// 带 [段] 结构的技法快照：每段 = `[名段i]` 头行 + 定长正文行（以 §END 收尾，供段边界断言）。
function makeSectionedContent(name, sectionCount, bodyLen){
	const parts = [];
	for(let i = 1; i <= sectionCount; i++){
		parts.push(`[${name}段${i}]\n${'x'.repeat(bodyLen - 4)}§END`);
	}
	return parts.join('\n');
}

describe('aiContextBudget（挂载预算三修）', ()=>{
	// ① 未触界 + fairShare 开：快路径，与 oracle 逐字节相等。
	test('case1: ≤4 技法未触界，fairShare 输出与旧算法逐字节相等', ()=>{
		const layers = [
			mkLayer('system', '系统提示', 100, 'x'.repeat(400)),
			mkLayer('source', '案例前提：测试', 95, 'y'.repeat(3000)),
			mkLayer('dayBoundaryRule', '排盘规则（日界点·晚子时）', 94, 'z'.repeat(120)),
			mkLayer('technique:bazi', '使用技法：八字', 93, makeSectionedContent('甲', 6, 200)),
			mkLayer('technique:ziwei', '使用技法：紫微', 92, makeSectionedContent('乙', 6, 200)),
			mkLayer('technique:astro', '使用技法：星盘', 91, makeSectionedContent('丙', 6, 200)),
			mkLayer('technique:qimen', '使用技法：奇门', 90, makeSectionedContent('丁', 6, 200)),
		];
		const detail = clipContextLayersDetailed(layers, { maxChars: AI_CONTEXT_MAX_CHARS, fairShare: true });
		const oracle = legacyClip(layers, { maxChars: AI_CONTEXT_MAX_CHARS });
		expect(detail.stats.totalRaw).toBeLessThan(AI_CONTEXT_MAX_CHARS);
		expect(joinPrompt(detail.kept)).toBe(joinPrompt(oracle));
		expect(detail.kept.map((item)=>item.content)).toEqual(oracle.map((item)=>item.content));
		expect(detail.dropped).toEqual([]);
		expect(detail.stats.clippedCount).toBe(0);
	});

	// ② total === maxChars 恰好等界：仍走快路径（含等号语义），逐字节相等。
	test('case2: 总量恰好等于 maxChars 仍全保留，与旧算法逐字节相等', ()=>{
		const layers = [
			mkLayer('system', '系统提示', 100, 'a'.repeat(400)),
			mkLayer('source', '案例前提：测试', 95, 'b'.repeat(3000)),
			mkLayer('technique:bazi', '使用技法：八字', 93, 'c'.repeat(16600)),
		];
		const total = layers.reduce((sum, item)=>sum + item.content.length, 0);
		expect(total).toBe(AI_CONTEXT_MAX_CHARS);
		const detail = clipContextLayersDetailed(layers, { maxChars: AI_CONTEXT_MAX_CHARS, fairShare: true });
		const oracle = legacyClip(layers, { maxChars: AI_CONTEXT_MAX_CHARS });
		expect(joinPrompt(detail.kept)).toBe(joinPrompt(oracle));
		expect(detail.kept.every((item)=>item.clipped === false)).toBe(true);
		expect(detail.stats.totalKept).toBe(AI_CONTEXT_MAX_CHARS);
		expect(detail.dropped).toEqual([]);
	});

	// ③ 触界 + fairShare 未开：legacy 分支输出与 oracle 逐字节相等，且被丢层记进 dropped（不再静默）。
	test('case3: 触界未开 fairShare 走旧贪心逐字节等价，dropped 有账', ()=>{
		const layers = [
			mkLayer('system', '系统提示', 100, 's'.repeat(500)),
			mkLayer('technique:bazi', '使用技法：八字', 93, 't'.repeat(800)),
			mkLayer('template:tpl1', '模版约束：格式', 90, 'u'.repeat(1000)),
			mkLayer('material:m1', '参考资料 1：文档', 70, 'v'.repeat(100)),
			mkLayer('recent-history', '最近对话', 60, 'w'.repeat(50)),
		];
		const detail = clipContextLayersDetailed(layers, { maxChars: 2000 });
		const oracle = legacyClip(layers, { maxChars: 2000 });
		expect(joinPrompt(detail.kept)).toBe(joinPrompt(oracle));
		expect(detail.kept.map((item)=>item.content)).toEqual(oracle.map((item)=>item.content));
		// 旧算法静默丢掉的 material / recent-history 现在必须记账。
		expect(detail.dropped.map((item)=>item.key)).toEqual(['material:m1', 'recent-history']);
		expect(detail.stats.byKey['material:m1'].dropped).toBe(true);
		expect(detail.stats.byKey['recent-history'].dropped).toBe(true);
		expect(detail.stats.byKey['template:tpl1'].clipped).toBe(true);
	});

	// ④ 6 技法触界 + fairShare：全部技法在 kept（无整层静默丢），每层 ≥ min(原长,600)，
	//    Σ ≤ maxChars，被裁层止于段边界且尾带旧裁剪 marker，dropped 为空。
	test('case4: 6 技法触界 fairShare 公平分摊，段对齐裁剪且绝不静默丢层', ()=>{
		const techSpecs = [
			['technique:bazi', '甲', 6, 93],
			['technique:ziwei', '乙', 8, 92],
			['technique:astro', '丙', 15, 91],
			['technique:qimen', '丁', 20, 90],
			['technique:liureng', '戊', 25, 89],
			['technique:taiyi', '己', 30, 88],
		];
		const layers = [
			mkLayer('system', '系统提示', 100, 'p'.repeat(300)),
			mkLayer('source', '案例前提：测试', 95, 'q'.repeat(2000)),
			mkLayer('dayBoundaryRule', '排盘规则（日界点·晚子时）', 94, 'r'.repeat(150)),
			...techSpecs.map(([key, name, cnt, pri])=>mkLayer(key, `使用技法：${name}`, pri, makeSectionedContent(name, cnt, 200))),
			mkLayer('template:tpl1', '模版约束：格式', 90, 'u'.repeat(1000)),
			mkLayer('material:m1', '参考资料 1：文档', 70, 'v'.repeat(2000)),
		];
		const rawByKey = {};
		layers.forEach((item)=>{ rawByKey[item.key] = item.content.length; });
		const totalRaw = layers.reduce((sum, item)=>sum + item.content.length, 0);
		expect(totalRaw).toBeGreaterThan(AI_CONTEXT_MAX_CHARS);

		const detail = clipContextLayersDetailed(layers, { maxChars: AI_CONTEXT_MAX_CHARS, fairShare: true });
		// 绝不静默：6 个技法层全部在 kept，dropped 为空。
		expect(detail.dropped).toEqual([]);
		const keptKeys = detail.kept.map((item)=>item.key);
		techSpecs.forEach(([key])=>{
			expect(keptKeys).toContain(key);
			const entry = detail.kept.find((item)=>item.key === key);
			// 每层保底：≥ min(原长, 600)。
			expect(entry.content.length).toBeGreaterThanOrEqual(Math.min(rawByKey[key], 600));
			if(entry.clipped){
				// 被裁层：尾带旧 marker 前缀，且裁剪点止于段边界（段尾哨兵 §END）。
				const markerIdx = entry.content.indexOf('\n...[已裁剪');
				expect(markerIdx).toBeGreaterThan(0);
				expect(entry.content.slice(0, markerIdx).endsWith('§END')).toBe(true);
				expect(entry.content.length).toBeLessThan(rawByKey[key]);
			}
		});
		// 至少长尾技法真的被裁（不是全体恰好塞得下的空转）。
		expect(detail.kept.filter((item)=>item.clipped && `${item.key}`.indexOf('technique:') === 0).length).toBeGreaterThanOrEqual(3);
		// 总量硬约束。
		const totalKept = detail.kept.reduce((sum, item)=>sum + item.content.length, 0);
		expect(totalKept).toBeLessThanOrEqual(AI_CONTEXT_MAX_CHARS);
		expect(detail.stats.totalKept).toBe(totalKept);
		// mandatory 全额收纳 + rest 尾仓未被技法层吃光。
		expect(detail.kept[0].key).toBe('system');
		expect(detail.kept[1].key).toBe('source');
		expect(detail.kept[2].key).toBe('dayBoundaryRule');
		expect(detail.stats.byKey['template:tpl1'].clipped).toBe(false);
		expect(detail.stats.byKey['material:m1'].kept).toBe(2000);
		// 输出顺序 = priority 降序；同 priority(90) 时技法层保持在模版层前（与旧序一致）。
		expect(keptKeys.indexOf('technique:qimen')).toBeLessThan(keptKeys.indexOf('template:tpl1'));
	});

	// ⑤ 无 [段] 结构的层触界：回退字符 slice + 旧 marker。
	test('case5: 无段结构技法层触界回退字符 slice + 旧 marker', ()=>{
		const layers = [
			mkLayer('system', '系统提示', 100, 's'.repeat(200)),
			mkLayer('technique:bazi', '使用技法：八字', 93, 'x'.repeat(5000)),
		];
		const detail = clipContextLayersDetailed(layers, { maxChars: 3000, fairShare: true });
		expect(detail.dropped).toEqual([]);
		const tech = detail.kept.find((item)=>item.key === 'technique:bazi');
		expect(tech.clipped).toBe(true);
		expect(tech.content.endsWith('\n...[已裁剪]')).toBe(true);
		expect(tech.content.indexOf('略去')).toBe(-1);
		// slice 前缀 = 原文前缀，且该层总长（含 marker）不超过分得的预算（此处 = 3000-200=2800）。
		const body = tech.content.slice(0, tech.content.length - '\n...[已裁剪]'.length);
		expect(body).toBe('x'.repeat(body.length));
		expect(tech.content.length).toBe(2800);
		const totalKept = detail.kept.reduce((sum, item)=>sum + item.content.length, 0);
		expect(totalKept).toBeLessThanOrEqual(3000);
	});

	// ⑥ 消双算等价：同输入下 单次 clipDetailed 的 kept join === buildPromptContext 的产出。
	test('case6: buildResolvedPrompt 单次裁剪与 buildPromptContext 同输入产出逐字节一致', ()=>{
		const input = {
			sourceContext: {
				title: '测试案例',
				content: '案例正文',
			},
			techniqueContexts: [
				{ key: 'liureng', title: '大六壬', content: '大六壬结构化快照' },
				{ key: 'qimen', title: '奇门遁甲', content: '奇门遁甲结构化快照' },
			],
			materials: [
				{ id: 'm1', name: '资料一', extractedText: '资料正文' },
			],
			bundles: [],
			templates: [
				{ id: 'tpl-1', name: '回复模版', format: 'text', content: '请按以下结构输出' },
			],
			retrievedChunks: [],
			conversationMessages: [
				{ role: 'user', content: '帮我分析' },
			],
			systemPrompt: '你是测试系统提示',
		};
		const layers = buildContextLayers(input);
		const detail = clipContextLayersDetailed(layers, { maxChars: AI_CONTEXT_MAX_CHARS, fairShare: true });
		const single = joinPrompt(detail.kept);
		const legacyDouble = buildPromptContext({ ...input, maxChars: AI_CONTEXT_MAX_CHARS });
		expect(single).toBe(legacyDouble);
		expect(single).toContain('案例前提：测试案例');
		expect(single).toContain('使用技法：大六壬');
	});

	// ⑦ 常量哨兵：AI_CONTEXT_MAX_CHARS 单一真值；发送路径不再散落 maxChars: 20000 字面量。
	test('case7: 常量哨兵 20000 单一真值，AIAnalysisMain 无字面 maxChars: 20000', ()=>{
		expect(AI_CONTEXT_MAX_CHARS).toBe(20000);
		const mainPath = path.join(__dirname, '../../components/aianalysis/AIAnalysisMain.js');
		const src = fs.readFileSync(mainPath, 'utf8');
		expect(src.indexOf('maxChars: 20000')).toBe(-1);
		expect(src.indexOf('maxChars:20000')).toBe(-1);
		expect(src.indexOf('AI_CONTEXT_MAX_CHARS')).toBeGreaterThan(-1);
		expect(src.indexOf('clipContextLayersDetailed(layers, { maxChars: AI_CONTEXT_MAX_CHARS, fairShare: true })')).toBeGreaterThan(-1);
	});
});
