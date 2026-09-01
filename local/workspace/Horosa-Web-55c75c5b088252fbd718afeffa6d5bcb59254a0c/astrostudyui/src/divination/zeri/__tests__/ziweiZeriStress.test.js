// [紫微择日 压测] 全类型全取值×16 参数轴×随机树 fuzz 恒等对拍(zeriStressKit)。
// 行内同盘探针在此技法价值最高:plateKey↔判定面同构病(anchorMD)刚在检查轮实抓过。
import { scanZiwei, computeZiweiScanPan, evaluateZiweiTree, ziweiPlateKeyOf, ziweiKeyMaskOf } from '../ziweiZeriScanEngine';
import { ZIWEI_CONDITION_TYPES, newZiweiLeaf, newZiweiGroup, compileZiweiTree } from '../ziweiZeriConditionTypes';
import { zoneOffsetMinutes } from '../hourlyScanEngine';
import { makeZeriStressKit } from './zeriStressKit';

jest.setTimeout(900000);

const ZONE = '+08:00';
const GEO = { zone: ZONE, lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
const WIN36 = { startDate: '2026-05-14', startTime: '00:00', endDate: '2026-05-15', endTime: '11:59' };
// 23 点段窗:晚子时/换日/plateKey anchorMD 病灶带
const WIN_LATEZI = { startDate: '2026-05-14', startTime: '21:00', endDate: '2026-05-15', endTime: '02:59' };
// 跨立春窗(年干支/四化翻转)
const WIN_LICHUN = { startDate: '2027-02-03', startTime: '12:00', endDate: '2027-02-04', endTime: '23:59' };

const NATAL = { lifeZhi: '午' };

const kit = makeZeriStressKit({
	name: 'ziwei',
	scan: (args)=>scanZiwei({ ...args, options: { ...args.options, _natal: NATAL } }),
	panAt: (geo, options, d, t)=>{
		const pan = computeZiweiScanPan(geo, options, d, t);
		if(pan){ pan._natal = NATAL; }	// 紫微 natal 走 pan._natal(引擎 makeScanCtx 同挂)
		return pan;
	},
	evaluateTree: (compiled, pan)=>evaluateZiweiTree(compiled, pan, null, false),
	compileTree: compileZiweiTree,
	plateKeyOf: ziweiPlateKeyOf,
	keyMaskOf: ziweiKeyMaskOf,
	offsetMin: zoneOffsetMinutes(ZONE),
	geo: GEO,
	baseOptions: {},
	defaultCfg: WIN36,
	stepMs: 3600e3,
});

afterAll(kit.printSummary);

describe('S1 全类型全取值穷举', ()=>{
	const cases = kit.enumerateTypeValueCases(ZIWEI_CONDITION_TYPES, newZiweiLeaf, newZiweiGroup, 4)	// [W 全谱轮] 类数大增后 S1 限前4值(三式先例;全值域由 schemeAudit 恒盖);
	cases.forEach((c)=>{
		it(`S1·${c.id}`, async ()=>{
			await kit.scanAndSweep(`S1·${c.id}`, c.root);
		});
	});
});

describe('S2 参数矩阵(工作台 16 键逐档;lateZi 病灶带用 23 点窗)', ()=>{
	const root = ()=>({ ...newZiweiGroup('all'), children: [newZiweiLeaf('ming_gong_zhi')] });
	const AXES = [
		['ziweiLunarBasis', ['calendar', 'ziwei']],
		['lateZi', ['zi_chu', 'zi_zheng', 'midnight_split']],
		['after23NewDay', [0, 1]],
		['lateZiHourUseNextDay', [0, 1]],
		['yearBoundary', ['lichun', 'lunar_1_1']],
		['leapMonth', ['mid_split', 'next', 'prev']],
		['huoling', ['sanhe', 'nanpai']],
		['kongNaming', ['modern', 'book']],
		['starSet', ['full', 'north18']],
		['shangShi', ['fixed', 'yinyang']],
		['changshengStart', ['shui_tu', 'huo_tu']],
		['changshengDirection', ['yinyang', 'always_forward']],
		['kuiYue', ['jia_wu_geng', 'geng_ma_hu']],
		['kongwangStyle', ['double', 'single']],
		['lifeMasterBy', ['year_branch', 'ming_branch']],
		['gender', [0, 1]],
		['timeAlg', [0, 1]],
		['tianmaBasis', ['month', 'year']],
	];
	AXES.forEach(([key, vals])=>{
		vals.forEach((v)=>{
			it(`S2·${key}=${v}`, async ()=>{
				const cfg = (key === 'lateZi' || key === 'after23NewDay' || key === 'lateZiHourUseNextDay') ? WIN_LATEZI : undefined;
				await kit.scanAndSweep(`S2·${key}=${v}`, root(), { [key]: v }, cfg);
			});
		});
	});
});

describe('S3 随机树 fuzz', ()=>{
	let seed = 20260829;
	const rnd = ()=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
	const types = Object.keys(ZIWEI_CONDITION_TYPES);
	const JOINERS = ['all', 'any', 'xor'];
	const randomLeaf = ()=>{
		const t = types[Math.floor(rnd() * types.length)];
		const leaf = newZiweiLeaf(t);
		// [复审 F11] 叶参数随机化:恒默认参数=跨字段非默认组合零覆盖——随机改一个 select
		// 字段值(multiselect 单值形;validate 撞墙由 compile 预检兜)
		const spec = ZIWEI_CONDITION_TYPES[t];
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
			const group = { ...newZiweiGroup(JOINERS[Math.floor(rnd() * 3)]), children: [randomLeaf(), randomLeaf()], negate: rnd() < 0.3 };
			group.joiner = JOINERS[Math.floor(rnd() * 3)];
			const root = { ...newZiweiGroup('all'), children: [randomLeaf(), group] };
			try{
				compileZiweiTree(root);
			}catch(e){
				return;	// 随机参数撞 validate=非判定面(kit enumerate 同律)
			}
			await kit.scanAndSweep(`S3·fuzz#${i}`, root);
		});
	}
});

describe('S4 边界窗', ()=>{
	it('S4·跨立春·年系条件(四化随年干翻转)', async ()=>{
		const leaf = newZiweiLeaf('sihua_dui_ming');
		await kit.scanAndSweep('S4·lichun·sihua', { ...newZiweiGroup('all'), children: [leaf] }, {}, WIN_LICHUN);
	});
	it('S4·23点段·calendar 基准(anchorMD 同构病灶带,行内同盘探针主战场)', async ()=>{
		const leaf = newZiweiLeaf('ming_gong_zhi');
		await kit.scanAndSweep('S4·latezi·mingong', { ...newZiweiGroup('all'), children: [leaf] }, { ziweiLunarBasis: 'calendar', lateZi: 'zi_chu' }, WIN_LATEZI);
	});
});
