// 择日工作台必须暴露的引擎参数(合同):三式择日扫描消费、而宿主不从内嵌三式页播种的键,工作台参数区都必须能设
// —— 否则用户在三式页改过它(置闰天数 / 月家起局 / 移星),择日扫描按引擎缺省扫,与页面不同口径。
// 奇门家的这几项与奇门择日工作台同一份描述(qimenWorkbenchFields);点结果行回写三式页的键集就是这张表(不另抄)。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
const fs = require('fs');
const path = require('path');
const { sanshiWorkbenchParamFields } = require('../SanshiZeriWorkbench');
const { QIMEN_WORKBENCH_PARAM_FIELDS } = require('../QimenZeriWorkbench');
const { QIMEN_ZHIRUN_LEAP_FIELD, QIMEN_YUEJIA_QIJU_FIELD, QIMEN_SHIFT_PALACE_FIELD } = require('../qimenWorkbenchFields');
const { SANSHI_SPLIT_ALL_KEYS, QM_SEED_KEYS, splitSanshiOptions } = require('../../../divination/zeri/sanshiOptionSplit');
const { SANSHI_LR_PAGE_SCAN_KEYS, SANSHI_TY_PAGE_SCAN_KEYS } = require('../../../divination/zeri/zeriPageCalibre');

// 「技法 ↔ 择日」登记表的这一列:工作台 → 必须暴露的引擎参数(机械求出:扫描消费键 − 宿主从内嵌页播种的键)
const WORKBENCH_ENGINE_PARAMS = {
	// 宿主从内嵌页取的页面键(奇门播种 / 六壬分昼夜涉害 / 太乙流派表,zeriPageCalibre 登记)不必在工作台出现
	三式择日: { fields: ()=>sanshiWorkbenchParamFields(), mustExpose: SANSHI_SPLIT_ALL_KEYS.filter((k)=>QM_SEED_KEYS.indexOf(k) < 0 && SANSHI_LR_PAGE_SCAN_KEYS.indexOf(k) < 0 && SANSHI_TY_PAGE_SCAN_KEYS.indexOf(k) < 0) },
};

describe.each(Object.keys(WORKBENCH_ENGINE_PARAMS))('%s', (name)=>{
	const reg = WORKBENCH_ENGINE_PARAMS[name];
	test('扫描消费、宿主又不播种的引擎参数,工作台都能设', ()=>{
		const keys = reg.fields().map((f)=>f.key);
		expect(reg.mustExpose.length).toBeGreaterThanOrEqual(15);
		expect(reg.mustExpose.filter((k)=>keys.indexOf(k) < 0)).toEqual([]);
	});
});

describe('奇门家定局子参数 / 移星:两个工作台同一份描述', ()=>{
	test.each([QIMEN_ZHIRUN_LEAP_FIELD, QIMEN_YUEJIA_QIJU_FIELD, QIMEN_SHIFT_PALACE_FIELD])('$key', (F)=>{
		expect(QIMEN_WORKBENCH_PARAM_FIELDS).toContain(F);
		const s = sanshiWorkbenchParamFields().find((f)=>f.key === F.key);
		expect(s).toBeTruthy();
		expect(s.options).toBe(F.options);
		expect(s.label).toBe(`奇门·${F.label}`);
	});
	test('显隐 / 置灰与奇门页同一条件(缺省 = 时家 · 置闰)', ()=>{
		const when = QIMEN_ZHIRUN_LEAP_FIELD.when;
		expect(when({})).toBe(true);                                         // 时家 · 置闰(缺省)
		expect(when({ qijuMethod: 'chaibu' })).toBe(false);
		expect(when({ paiPanType: 1 })).toBe(false);                         // 月家没有置闰
		expect(QIMEN_YUEJIA_QIJU_FIELD.disabled({})).toBe(true);
		expect(QIMEN_YUEJIA_QIJU_FIELD.disabled({ paiPanType: 1 })).toBe(false);
	});
	test('工作台设的值进扫描(拆分器)', ()=>{
		const q = splitSanshiOptions({ zhirunLeapDays: 10, yueJiaQiJuType: 2, shiftPalace: 3 }).qimen;
		expect(q).toEqual(expect.objectContaining({ zhirunLeapDays: 10, yueJiaQiJuType: 2, shiftPalace: 3 }));
	});
});

describe('点结果行:工作台口径回写三式页的键集 = 工作台参数区那张表', ()=>{
	test('置闰天数 / 月家起局 / 移星一并回写', async ()=>{
		const SanshiZeriMain = require('../SanshiZeriMain').default;
		const h = Object.create(SanshiZeriMain.prototype);
		h.state = { options: { zhirunLeapDays: 8, yueJiaQiJuType: 1, shiftPalace: 2, guirengType: 0, yueMode: 'jieqi', paiPanType: 3 } };
		let got = null;
		h.sanshiHook = { applyOptions: (p)=>{ got = p; return Promise.resolve(); } };
		await h.applyWorkbenchCalibre();
		expect(got).toEqual(expect.objectContaining({ zhirunLeapDays: 8, yueJiaQiJuType: 1, shiftPalace: 2, guireng: 0, yueJiangMethod: 'jieqi', paiPanType: 3 }));
		expect(got).not.toHaveProperty('guirengType');
		const src = fs.readFileSync(path.join(__dirname, '../SanshiZeriMain.js'), 'utf8');
		expect(src).toContain('sanshiWorkbenchParamFields().map((f)=>f.key)');
	});
});
