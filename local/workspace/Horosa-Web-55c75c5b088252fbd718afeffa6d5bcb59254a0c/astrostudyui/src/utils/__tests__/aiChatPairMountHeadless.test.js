// 双盘挂载 · 无头拼装(多技法编排子任务 / 目标任务共用 buildHeadlessSystemPrompt):给了合盘对方就同页面一样挂两人的盘,
// 不给 / 对方就是本人 / 不是命盘 → 与单盘逐字节相同。
jest.mock('../aiAnalysisContext', ()=>{
	const actual = jest.requireActual('../aiAnalysisContext');
	return {
		...actual,
		getAnalysisSourceContext: jest.fn(async (source)=>({ title: source.title, content: `[起盘信息]\n${source.title}的出生资料`, meta: {} })),
		getAnalysisTechniqueContexts: jest.fn(async (source, keys)=>keys.map((k)=>({ key: k, title: k === 'ziwei' ? '紫微斗数' : k, content: `[宫位总览]\n${source.title}的${k}盘面` }))),
		getPairSynastryText: jest.fn(async (a, b)=>`[比较盘]\n${a.name}×${b.name} 合盘相位`),
		getPairChineseTexts: jest.fn((a, b, keys)=>({ bazi: keys.indexOf('bazi') >= 0 ? `[年命]\n${a.name}×${b.name} 八字合婚` : '', ziwei: '' })),
	};
});
import { buildHeadlessSystemPrompt } from '../aiAgent/goalRunner';

const self = { id: 'local-a', sourceType: 'chart', title: '张三', record: { name: '张三' } };
const other = { id: 'local-b', sourceType: 'chart', title: '李四', record: { name: '李四' } };
const kase = { id: 'local-c', sourceType: 'case', title: '搬家事盘', record: {} };

describe('buildHeadlessSystemPrompt 双盘', ()=>{
	test('给合盘对方 → 两人的技法层都在且注明归属;不给 / 本人 / 事盘 → 单盘逐字节相同', async ()=>{
		const args = { source: self, techniqueKeys: ['ziwei'], systemPrompt: '系统', profile: null, model: 'm' };
		const one = await buildHeadlessSystemPrompt(args);
		expect(one.systemPrompt).not.toContain('李四');
		const two = await buildHeadlessSystemPrompt({ ...args, partnerSource: other });
		expect(two.systemPrompt).toContain('使用技法：紫微斗数（本人·张三）');
		expect(two.systemPrompt).toContain('使用技法：紫微斗数（对方·李四）');
		expect(two.systemPrompt).toContain('李四的ziwei盘面');
		expect(two.meta.layerKeys).toEqual(expect.arrayContaining(['pair-rule', 'partner-source', 'technique:ziwei@partner']));
		expect((await buildHeadlessSystemPrompt({ ...args, partnerSource: self })).systemPrompt).toBe(one.systemPrompt);
		expect((await buildHeadlessSystemPrompt({ ...args, partnerSource: kase })).systemPrompt).toBe(one.systemPrompt);
		// 只看紫微:不附西洋合盘数据
		expect(two.meta.layerKeys).not.toContain('pair:synastry');
	});
	test('子任务是西洋本命盘 → 附两人之间的西洋合盘数据(与对话页同一取数)', async ()=>{
		const r = await buildHeadlessSystemPrompt({ source: self, techniqueKeys: ['astrochart'], systemPrompt: '系统', profile: null, model: 'm', partnerSource: other });
		expect(r.meta.layerKeys).toContain('pair:synastry');
		expect(r.systemPrompt).toContain('张三×李四 合盘相位');
	});
	test('子任务是八字 → 附八字合婚对照(与对话页同一取数)', async ()=>{
		const r = await buildHeadlessSystemPrompt({ source: self, techniqueKeys: ['bazi'], systemPrompt: '系统', profile: null, model: 'm', partnerSource: other });
		expect(r.meta.layerKeys).toContain('pair:bazi-hehun');
		expect(r.systemPrompt).toContain('张三×李四 八字合婚');
	});
});
