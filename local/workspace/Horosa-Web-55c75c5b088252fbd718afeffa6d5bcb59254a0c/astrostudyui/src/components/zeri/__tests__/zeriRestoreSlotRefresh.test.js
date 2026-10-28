// 择日宿主载入存案后,本 scope 的快照槽一律按存案那一次重存(内嵌页不应答时写宿主的择时三段)。
// 此前只在宿主自己实现了可选的重存方法时才重存 —— 全仓只有印度实现了,七政 / 八字 / 紫微 / 黄历载入
// 0 命中 / 断链 / 没结果的存案后,槽里还是上一轮扫描的三段,AI 读到的与工作台对不上。
jest.mock('../../../utils/moduleAiSnapshot', ()=>({
	...jest.requireActual('../../../utils/moduleAiSnapshot'),
	saveModuleAISnapshot: jest.fn(),
}));
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));

const fs = require('fs');
const path = require('path');
const { setGlobalStore } = require('../../../utils/storageutil');
const snap = require('../../../utils/moduleAiSnapshot');
const { restoreZeriWorkbenchFromCase } = require('../zeriCaseRestore');

const DIR = path.join(__dirname, '..');
const HOST_FILES = fs.readdirSync(DIR).filter((f)=>/ZeriMain\.js$/.test(f) && f !== 'ZeriMain.js');
const usesSharedRestore = (f)=>fs.readFileSync(path.join(DIR, f), 'utf8').includes('restoreZeriWorkbenchFromCase(this');
const scopeOf = (f)=>{
	const src = fs.readFileSync(path.join(DIR, f), 'utf8');
	const m = src.match(/restoreZeriWorkbenchFromCase\(this,\s*([A-Z_]+|'[a-z]+')\)/);
	if(!m){ return null; }
	if(m[1].startsWith("'")){ return m[1].slice(1, -1); }
	const c = src.match(new RegExp(`const ${m[1]}\\s*=\\s*'([a-z]+)'`));
	return c ? c[1] : null;
};
// 不走共享还原件的宿主:还原由内嵌页自己做(内嵌页还原后按当前盘 + 宿主三段重存本槽),理由逐个写明
const OWN_RESTORE = {
	'QimenZeriMain.js': '奇门择日与主盘共用 fields,工作台还原在宿主 restoreWorkbenchFromCase,内嵌奇门页还原并重存',
	'LiurengZeriMain.js': '六壬择日没有工作台存案态,内嵌六壬页按事盘还原并重存',
	'SanshiZeriMain.js': '三式择日没有工作台存案态,内嵌三式页按事盘还原并重存',
	'TaiyiZeriMain.js': '太乙择日没有工作台存案态,宿主请内嵌太乙页 restoreCase,还原后重存',
};

afterEach(()=>{ setGlobalStore({}); jest.clearAllMocks(); });

test('清单自检:每个择日宿主要么走共享还原件,要么在豁免表里写明理由', ()=>{
	expect(HOST_FILES.length).toBeGreaterThanOrEqual(9);
	const bad = HOST_FILES.filter((f)=>!usesSharedRestore(f) && !OWN_RESTORE[f]);
	expect(bad).toEqual([]);
	Object.keys(OWN_RESTORE).forEach((f)=>{ expect([f, usesSharedRestore(f)]).toEqual([f, false]); });
});

describe.each(HOST_FILES.filter(usesSharedRestore).map((f)=>[f, scopeOf(f)]))('%s', (file, scope)=>{
	test('载入 0 命中的存案:本槽重存成存案那一次的择时三段', ()=>{
		expect(scope).toBeTruthy();
		const Host = require(`../${file}`).default;
		const h = new Host({ dispatch: jest.fn() });
		h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
		h.replotAfterRestore = ()=>{};
		expect(typeof h.composeAiSnapshot).toBe('function');
		const zeri = { cfg: { startDate: '2026-03-01', endDate: '2026-03-02' }, tree: { kind: 'group', joiner: 'all', negate: false, children: [] }, results: [], truncated: false };
		setGlobalStore({ user: { caseApplySeq: 1, appliedCaseCid: 'slot-1', currentCase: {
			cid: { value: 'slot-1' }, updateTime: { value: 't' }, caseType: { value: scope }, sourceModule: { value: scope },
			payload: { value: JSON.stringify({ module: scope, zeri }) } } } });
		expect(restoreZeriWorkbenchFromCase(h, scope)).toBe(true);
		const calls = snap.saveModuleAISnapshot.mock.calls.filter((c)=>c[0] === scope);
		expect(calls.length).toBeGreaterThanOrEqual(1);
		expect(calls[0][1]).toBe(h.composeAiSnapshot('') || '');
	});
});
