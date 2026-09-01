// [太乙择日 压测] 全类型全取值×tn 四档×随机树 fuzz 恒等对拍(zeriStressKit)。
import { scanTaiyi, computeTaiyiScanPan, evaluateTaiyiTree, taiyiPlateKeyOf } from '../taiyiZeriScanEngine';
import { TAIYI_CONDITION_TYPES, newTaiyiLeaf, newTaiyiGroup, compileTaiyiTree } from '../taiyiZeriConditionTypes';
import { zoneOffsetMinutes } from '../hourlyScanEngine';
import { makeZeriStressKit } from './zeriStressKit';

jest.setTimeout(600000);

const ZONE = '+08:00';
const GEO = { zone: ZONE, lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
const WIN36 = { startDate: '2026-05-14', startTime: '00:00', endDate: '2026-05-15', endTime: '11:59' };
// 阴遁窗(冬半年):阴遁对齐补丁面(taiyiPalace 翻宫+布神三表重建)必须在阴遁局上跑过恒等
const WIN_YIN = { startDate: '2026-11-20', startTime: '00:00', endDate: '2026-11-21', endTime: '11:59' };

const kit = makeZeriStressKit({
	name: 'taiyi',
	scan: scanTaiyi,
	panAt: (geo, options, d, t)=>computeTaiyiScanPan(geo, options, d, t),
	evaluateTree: (compiled, pan)=>evaluateTaiyiTree(compiled, pan, null, false),
	compileTree: compileTaiyiTree,
	plateKeyOf: taiyiPlateKeyOf,
	offsetMin: zoneOffsetMinutes(ZONE),
	geo: GEO,
	baseOptions: { tn: 0 },
	defaultCfg: WIN36,
	stepMs: 3600e3,
});

afterAll(kit.printSummary);

describe('S1 全类型全取值穷举', ()=>{
	const cases = kit.enumerateTypeValueCases(TAIYI_CONDITION_TYPES, newTaiyiLeaf, newTaiyiGroup, 2)	// [W 全谱轮] 太乙单盘贵(单扫36h≈13s 固有本底)——limit 2(S3 fuzz 全类随机+schemeAudit 值域仍全盖);
	cases.forEach((c)=>{
		it(`S1·${c.id}`, async ()=>{
			await kit.scanAndSweep(`S1·${c.id}`, c.root);
		});
	});
});

describe('S2 tn 四档矩阵(唯一有判别力参数)', ()=>{
	const root = ()=>({ ...newTaiyiGroup('all'), children: [newTaiyiLeaf('geju_kind')] });
	[0, 1, 2, 3].forEach((tn)=>{
		it(`S2·tn=${tn}`, async ()=>{
			await kit.scanAndSweep(`S2·tn=${tn}`, root(), { tn });
		});
	});
});

describe('S3 随机树 fuzz', ()=>{
	let seed = 20260829;
	const rnd = ()=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
	const types = Object.keys(TAIYI_CONDITION_TYPES);
	const JOINERS = ['all', 'any', 'xor'];
	const randomLeaf = ()=>{
		const t = types[Math.floor(rnd() * types.length)];
		const leaf = newTaiyiLeaf(t);
		// [复审 F11] 叶参数随机化:恒默认参数=跨字段非默认组合零覆盖——随机改一个 select
		// 字段值(multiselect 单值形;validate 撞墙由 compile 预检兜)
		const spec = TAIYI_CONDITION_TYPES[t];
		const sf = ((spec && spec.fields) || []).filter((x)=>(x.kind === 'select' || x.kind === 'multiselect') && Array.isArray(x.options) && x.options.length);
		if(sf.length && rnd() < 0.7){
			const fld = sf[Math.floor(rnd() * sf.length)];
			const o = fld.options[Math.floor(rnd() * fld.options.length)];
			const v = o && o.value !== undefined ? o.value : o;
			leaf.params = { ...leaf.params, [fld.key]: fld.kind === 'multiselect' ? [v] : v };
		}
		leaf.negate = rnd() < 0.3;
		leaf.joiner = JOINERS[Math.floor(rnd() * 3)];
		return leaf;
	};
	for(let i = 0; i < 12; i++){
		it(`S3·fuzz#${i}`, async ()=>{
			const group = { ...newTaiyiGroup(JOINERS[Math.floor(rnd() * 3)]), children: [randomLeaf(), randomLeaf()], negate: rnd() < 0.3 };
			group.joiner = JOINERS[Math.floor(rnd() * 3)];
			const root = { ...newTaiyiGroup('all'), children: [randomLeaf(), group] };
			try{
				compileTaiyiTree(root);
			}catch(e){
				return;	// 随机参数撞 validate=非判定面(kit enumerate 同律)
			}
			await kit.scanAndSweep(`S3·fuzz#${i}`, root);
		});
	}
});

describe('S4 阴遁窗(对齐补丁面:taiyi_gong 与 gong16_has 同引擎自洽)', ()=>{
	it('S4·阴遁·taiyi_gong 全宫恒等', async ()=>{
		const leaf = newTaiyiLeaf('taiyi_gong');
		await kit.scanAndSweep('S4·yin·taiyi_gong', { ...newTaiyiGroup('all'), children: [leaf] }, {}, WIN_YIN);
	});
	it('S4·阴遁·gong16_has 太乙(布神表同步面;曾只翻 taiyiPalace 互斥)', async ()=>{
		const leaf = newTaiyiLeaf('gong16_has');
		leaf.params = { ...leaf.params, names: ['太乙'] };
		await kit.scanAndSweep('S4·yin·gong16_has', { ...newTaiyiGroup('all'), children: [leaf] }, {}, WIN_YIN);
	});
	it('S4·阴遁·两条件联判自洽(太乙落 X 宫 ⟺ X 宫布神含太乙,逐宫等价)', async ()=>{
		// 直接逐时辰断言两判定面等价——补丁只翻一处时此处必红(审查实抓病的封棺钉)
		const GONG16 = ['子', '丑', '艮', '寅', '卯', '辰', '巽', '巳', '午', '未', '坤', '申', '酉', '戌', '乾', '亥'];
		const bad = [];
		for(let h = 0; h < 36; h += 2){
			const d = h < 24 ? '2026-11-20' : '2026-11-21';
			const hh = h % 24;
			const pan = computeTaiyiScanPan(GEO, { tn: 0 }, d, `${hh < 10 ? `0${hh}` : hh}:30:00`);
			if(!pan){ continue; }
			const gong = pan.taiyiPalace;
			const cell = (pan.palace16 || []).find((c)=>c && c.palace === gong);
			const items = ((cell && cell.items) || []).map((x)=>`${x.name || x}`);
			if(!items.some((x)=>x.indexOf('太乙') >= 0)){
				bad.push(`${d} ${hh}:30 太乙落${gong}但${gong}宫布神=${items.join('、') || '空'}`);
			}
			GONG16.filter((g)=>g !== gong).forEach((g)=>{
				const c2 = (pan.palace16 || []).find((c)=>c && c.palace === g);
				const it2 = ((c2 && c2.items) || []).map((x)=>`${x.name || x}`);
				if(it2.some((x)=>x === '太乙')){
					bad.push(`${d} ${hh}:30 太乙落${gong}但${g}宫布神也含太乙`);
				}
			});
		}
		expect(bad).toEqual([]);
	});
});
