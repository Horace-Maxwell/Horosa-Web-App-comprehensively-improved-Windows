// [六壬择日 压测] 全类型全取值×参数矩阵×随机树 fuzz 恒等对拍(zeriStressKit)。
// plateKey 刚补年支/月支(跨节折叠病)——跨立春窗+行内同盘探针是本技法主战场;
// 行年按候选年现算(ctx.xingnian)由跨年窗行覆盖。
import { scanLiureng, computeLiurengScanPan, evaluateLiurengTree, liurengPlateKeyOf, liurengKeyMaskOf } from '../liurengZeriScanEngine';
import { LIURENG_CONDITION_TYPES, newLiurengLeaf, newLiurengGroup, compileLiurengTree } from '../liurengZeriConditionTypes';
import { zoneOffsetMinutes } from '../hourlyScanEngine';
import { makeZeriStressKit } from './zeriStressKit';

jest.setTimeout(900000);

const ZONE = '+08:00';
const GEO = { zone: ZONE, lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
const WIN36 = { startDate: '2026-05-14', startTime: '00:00', endDate: '2026-05-15', endTime: '11:59' };
const WIN_LICHUN = { startDate: '2027-02-03', startTime: '12:00', endDate: '2027-02-04', endTime: '23:59' };
// 跨公历年窗(行年翻支面)
const WIN_NEWYEAR = { startDate: '2026-12-31', startTime: '12:00', endDate: '2027-01-01', endTime: '23:59' };

const NATAL = { mingZhi: '子', bornYear: 1996, male: true };

const kit = makeZeriStressKit({
	name: 'liureng',
	scan: (args)=>scanLiureng({ ...args, options: { ...args.options, _natal: NATAL } }),
	panAt: (geo, options, d, t)=>{
		const pan = computeLiurengScanPan(geo, options, d, t);
		if(pan){
			pan._natal = NATAL;
			pan._candY = Number(`${d}`.slice(0, 4));	// 引擎 computePanAt 同挂(行年候选年现算输入)
		}
		return pan;
	},
	evaluateTree: (compiled, pan)=>evaluateLiurengTree(compiled, pan, null, false),
	compileTree: compileLiurengTree,
	plateKeyOf: liurengPlateKeyOf,
	keyMaskOf: liurengKeyMaskOf,
	offsetMin: zoneOffsetMinutes(ZONE),
	geo: GEO,
	baseOptions: { guirengType: 0, yueMode: 'zhongqi', after23NewDay: 1, lateZiHourUseNextDay: 1 },
	defaultCfg: WIN36,
	stepMs: 3600e3,
});

afterAll(kit.printSummary);

describe('S1 全类型全取值穷举', ()=>{
	const cases = kit.enumerateTypeValueCases(LIURENG_CONDITION_TYPES, newLiurengLeaf, newLiurengGroup, 4)	// [W 全谱轮] 类数大增后 S1 限前4值(三式先例;全值域由 schemeAudit 恒盖);
	cases.forEach((c)=>{
		it(`S1·${c.id}`, async ()=>{
			await kit.scanAndSweep(`S1·${c.id}`, c.root);
		});
	});
});

describe('S2 参数矩阵', ()=>{
	const root = ()=>({ ...newLiurengGroup('all'), children: [newLiurengLeaf('ke_name')] });
	const AXES = [
		['guirengType', [0, 1, 2]],
		['yueMode', ['zhongqi', 'jieqi']],
		['after23NewDay', [0, 1]],
		['lateZiHourUseNextDay', [0, 1]],
	];
	AXES.forEach(([key, vals])=>{
		vals.forEach((v)=>{
			it(`S2·${key}=${v}`, async ()=>{
				await kit.scanAndSweep(`S2·${key}=${v}`, root(), { [key]: v });
			});
		});
	});
});

describe('S3 随机树 fuzz', ()=>{
	let seed = 20260829;
	const rnd = ()=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
	const types = Object.keys(LIURENG_CONDITION_TYPES);
	const JOINERS = ['all', 'any', 'xor'];
	const randomLeaf = ()=>{
		const t = types[Math.floor(rnd() * types.length)];
		const leaf = newLiurengLeaf(t);
		// [复审 F11] 叶参数随机化:恒默认参数=跨字段非默认组合零覆盖——随机改一个 select
		// 字段值(multiselect 单值形;validate 撞墙由 compile 预检兜)
		const spec = LIURENG_CONDITION_TYPES[t];
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
			const group = { ...newLiurengGroup(JOINERS[Math.floor(rnd() * 3)]), children: [randomLeaf(), randomLeaf()], negate: rnd() < 0.3 };
			group.joiner = JOINERS[Math.floor(rnd() * 3)];
			const root = { ...newLiurengGroup('all'), children: [randomLeaf(), group] };
			try{
				compileLiurengTree(root);
			}catch(e){
				return;	// 随机参数撞 validate=非判定面(kit enumerate 同律)
			}
			await kit.scanAndSweep(`S3·fuzz#${i}`, root);
		});
	}
});

describe('S4 边界窗', ()=>{
	it('S4·跨立春·太岁十二神(年支入 plateKey 修复面:节界必分行)', async ()=>{
		const leaf = newLiurengLeaf('taisui_god_at');
		await kit.scanAndSweep('S4·lichun·taisui', { ...newLiurengGroup('all'), children: [leaf] }, {}, WIN_LICHUN);
	});
	it('S4·跨立春·月德(月支入 plateKey 修复面)', async ()=>{
		const leaf = newLiurengLeaf('shensha_at');
		await kit.scanAndSweep('S4·lichun·shensha', { ...newLiurengGroup('all'), children: [leaf] }, {}, WIN_LICHUN);
	});
	it('S4·跨公历年·行年入传(候选年现算修复面:两年段行年支确不同)', async ()=>{
		const mk = ()=>{
			const leaf = newLiurengLeaf('bm_in_chuan');
			leaf.params = { ...leaf.params, who: 'xingnian', mode: 'in' };
			return { ...newLiurengGroup('all'), children: [leaf] };
		};
		await kit.scanAndSweep('S4·newyear·xingnian', mk(), {}, WIN_NEWYEAR);
		// 判别自证:2026 vs 2027 行年支必不同(虚岁+1 → 支进一位)
		const p26 = computeLiurengScanPan(GEO, {}, '2026-12-31', '13:00:00');
		const p27 = computeLiurengScanPan(GEO, {}, '2027-01-01', '13:00:00');
		p26._natal = NATAL; p26._candY = 2026;
		p27._natal = NATAL; p27._candY = 2027;
		const { makeLiurengZeriEvalCtx } = require('../liurengZeriConditionTypes');
		const x26 = makeLiurengZeriEvalCtx(p26).xingnian();
		const x27 = makeLiurengZeriEvalCtx(p27).xingnian();
		expect(x26).not.toBe(x27);
	});
});
