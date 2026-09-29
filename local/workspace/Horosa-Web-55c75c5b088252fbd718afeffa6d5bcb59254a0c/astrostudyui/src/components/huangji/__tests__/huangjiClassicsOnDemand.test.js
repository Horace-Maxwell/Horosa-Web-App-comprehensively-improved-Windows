// [#75] 皇极经世典籍正文按需:合并对齐 / 无头快照端到端带正文 / 典籍取数失败回退全文盘 / 页面接线棘轮。
import fs from 'fs';
import path from 'path';

const mockFullClassics = {
	meta: [{ key: 'huangji_jingshi_shu', name: '皇极经世书' }],
	selectedKey: 'huangji_jingshi_shu',
	sections: [
		{ level: 1, title: '观物内篇之一', content: '物之大者莫若天地' },
		{ level: 2, title: '观物内篇之二', content: '天生于动者也' },
	],
};
const mockSlimOf = (c)=> ({ meta: c.meta, selectedKey: c.selectedKey, sections: c.sections.map((x)=> ({ level: x.level, title: x.title })), contentOmitted: true });
const mockPanBase = { source: 'kinwangji', sections: [], history: [], historyYear: 2026 };

const mockCalls = [];
let mockClassicFails = false;
jest.mock('../../../utils/kentangCache', ()=> ({
	cachedKentangFetch: jest.fn(async (url, opts)=>{
		const body = JSON.parse(opts.body || '{}');
		mockCalls.push({ url, body });
		const ok = (result)=> ({ text: async ()=> JSON.stringify({ ResultCode: 0, Result: result }) });
		if(/\/wangji\/classic$/.test(url)){
			if(mockClassicFails){ throw new Error('classic down'); }
			return ok({ ...mockFullClassics, selectedKey: body.classicKey || mockFullClassics.selectedKey });
		}
		if(/\/wangji\/pan$/.test(url)){
			const c = { ...mockFullClassics, selectedKey: body.classicKey || mockFullClassics.selectedKey };
			return ok({ ...mockPanBase, classics: body.slimClassics === 1 ? mockSlimOf(c) : c });
		}
		throw new Error(`unexpected ${url}`);
	}),
}));

// eslint-disable-next-line import/first
import { mergeClassicsFull, buildHuangJiSnapshotForFields } from '../HuangJiMain';
// eslint-disable-next-line import/first
import DateTime from '../../comp/DateTime';

const fields = ()=>{
	const dt = new DateTime();
	return { date: { value: dt }, time: { value: dt }, zone: { value: '+08:00' } };
};

beforeEach(()=>{ mockCalls.length = 0; mockClassicFails = false; localStorage.removeItem('horosa.perf.wangjiClassicsOnDemand'); });

test('合并:逐节对齐才合并,产出与旧盘同形(三键同序);任一不齐返回 null', ()=>{
	const merged = mergeClassicsFull(mockSlimOf(mockFullClassics), mockFullClassics);
	expect(Object.keys(merged)).toEqual(['meta', 'selectedKey', 'sections']);
	expect(JSON.stringify(merged)).toBe(JSON.stringify(mockFullClassics));
	expect(mergeClassicsFull(mockSlimOf(mockFullClassics), { ...mockFullClassics, selectedKey: 'other' })).toBeNull();
	expect(mergeClassicsFull(mockSlimOf(mockFullClassics), { ...mockFullClassics, sections: mockFullClassics.sections.slice(0, 1) })).toBeNull();
	const retitled = { ...mockFullClassics, sections: [{ ...mockFullClassics.sections[0], title: '改' }, mockFullClassics.sections[1]] };
	expect(mergeClassicsFull(mockSlimOf(mockFullClassics), retitled)).toBeNull();
});

test('无头快照:盘请求带精简标记,[经典原文] 仍是全文', async ()=>{
	const text = await buildHuangJiSnapshotForFields(fields(), { classicSectionIndex: 1 });
	expect(text).toContain('天生于动者也');
	const panCalls = mockCalls.filter((c)=> /\/wangji\/pan$/.test(c.url));
	expect(panCalls.length).toBeGreaterThan(0);
	expect(panCalls.every((c)=> c.body.slimClassics === 1)).toBe(true);
});

test('典籍取数失败 → 回退一次不带标记的全文盘,正文不丢', async ()=>{
	mockClassicFails = true;
	const text = await buildHuangJiSnapshotForFields(fields(), { classicSectionIndex: 0, classicKey: 'uncached_classic_key', historyYear: 1999 });
	expect(text).toContain('物之大者莫若天地');
	const panCalls = mockCalls.filter((c)=> /\/wangji\/pan$/.test(c.url));
	expect(panCalls.some((c)=> c.body.slimClassics === 1)).toBe(true);
	expect(panCalls.some((c)=> c.body.slimClassics === undefined)).toBe(true);
});

test('开关关:盘请求不带精简标记(旧口径)', async ()=>{
	localStorage.setItem('horosa.perf.wangjiClassicsOnDemand', '0');
	const text = await buildHuangJiSnapshotForFields(fields(), { classicSectionIndex: 0, historyYear: 1888 });
	expect(text).toContain('物之大者莫若天地');
	const panCalls = mockCalls.filter((c)=> /\/wangji\/pan$/.test(c.url));
	expect(panCalls.length).toBeGreaterThan(0);
	expect(panCalls.every((c)=> c.body.slimClassics === undefined)).toBe(true);
	expect(mockCalls.some((c)=> /\/wangji\/classic$/.test(c.url))).toBe(false);
});

test('页面接线棘轮:起盘 / 无头快照都先补齐正文;载荷单源带标记;存档还原只合并不重新起盘', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', 'HuangJiMain.js'), 'utf8');
	const fetchPan = src.slice(src.indexOf('async fetchPan(fields){'), src.indexOf('async fetchXinyi('));
	expect(fetchPan).toMatch(/ensurePanClassics\(await postWangJi\('pan', payload\), payload\)/);
	expect(src).toMatch(/const pan = await ensurePanClassics\(await postWangJi\('pan', panPayload\), panPayload\);/);
	expect(src).toMatch(/buildPanPayload\(fields\)\{[\s\S]{0,200}return withSlimClassics\(\{/);
	const restore = src.slice(src.indexOf('restoreFromCurrentCase(force){'), src.indexOf('onFieldsChange(field){'));
	expect(restore).toMatch(/loadClassicFull\(pan\.classics\.selectedKey\)/);
	expect(restore).not.toMatch(/ensurePanClassics\(/);
});

test('微年表页:请求带 limit,「仅显示前 300 条」按总数判断', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', '..', 'xuanshi', 'XuanShiMicro.js'), 'utf8');
	expect(src).toMatch(/limit: flagEnabled\('horosa\.perf\.xuanshiMicroLimit'\) \? MICRO_RENDER_LIMIT : undefined/);
	expect(src).toMatch(/\(events\.length > MICRO_RENDER_LIMIT \|\| \(sm\.total \|\| 0\) > MICRO_RENDER_LIMIT\)/);
});
