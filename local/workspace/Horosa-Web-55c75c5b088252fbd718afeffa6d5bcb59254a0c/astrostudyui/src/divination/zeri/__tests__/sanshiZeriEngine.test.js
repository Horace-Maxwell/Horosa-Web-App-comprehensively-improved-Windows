// [Z6·三式择日] 引擎+程序化注册表金标。锚=2026-01-01 12:30 +08:00 北京(六壬重审课/
// 太乙阳遁六十七局——与 Z3/Z5 各家金标同锚同真值;三家判定全数继承,此处只测合并层)。
// 程序化文件无「一键一行」可抓——preflight[227] 改由本套件的**合并键集恒等哨兵**接防:
// 键集 ≡ 三源注册表键加前缀映射(任一源加/删类,此处自动跟或红)。
import fs from 'fs';
import path from 'path';
import { SANSHI_CONDITION_TYPES, SANSHI_FAMILIES, makeSanshiZeriEvalCtx, compileSanshiTree, newSanshiLeaf, sanshiLeafSummary } from '../sanshiZeriConditionTypes';
import { computeSanshiScanPan, evaluateSanshiTree, scanSanshi, explainSanshiAt, sanshiKeyMaskOf } from '../sanshiZeriScanEngine';
import { splitSanshiOptions, SANSHI_SPLIT_ALL_KEYS, SANSHI_ZERI_EXTRA_KEYS, SANSHI_SHARED_TIME_KEYS } from '../sanshiOptionSplit';
import { buildQimenScanSeeds } from '../qimenScanEngine';
import { LIURENG_CONDITION_TYPES } from '../liurengZeriConditionTypes';
import { QIMEN_CONDITION_TYPES } from '../qimenConditionTypes';
import { TAIYI_CONDITION_TYPES } from '../taiyiZeriConditionTypes';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../../../utils/techniqueMountSettings';

const GEO = { zone: '+08:00', gpsLon: 116.46, gpsLat: 39.9, lon: '116e28', lat: '39n54' };
const seeds = ()=>buildQimenScanSeeds(2026, 2026, '+08:00');
const anchorPan = (opts)=>computeSanshiScanPan({ seeds: seeds(), natal: (opts || {})._natal || null }, GEO, opts || {}, '2026-01-01', '12:30:00');

describe('[Z6] 🔴 程序化合并层(键集恒等+freeze+分派+失败注记)', ()=>{
	it('🔴 合并键集恒等哨兵:键集 ≡ 三源加前缀(源注册表演进此处自动跟;preflight[227] 依赖本例)', ()=>{
		const expect_keys = [
			...Object.keys(LIURENG_CONDITION_TYPES).map((k)=>`lr_${k}`),
			...Object.keys(QIMEN_CONDITION_TYPES).map((k)=>`qm_${k}`),
			...Object.keys(TAIYI_CONDITION_TYPES).map((k)=>`ty_${k}`),
		].sort();
		expect(Object.keys(SANSHI_CONDITION_TYPES).sort()).toEqual(expect_keys);
		expect(expect_keys.length).toBeGreaterThanOrEqual(50);
	});

	it('🔴 freeze:合并表冻结+合并层不 mutate 三源(spec 引用同一 defaults/fields 对象=零拷贝共享,写保护由源方冻结惯例+此处防合并表被改)', ()=>{
		expect(Object.isFrozen(SANSHI_CONDITION_TYPES)).toBe(true);
		expect(()=>{ SANSHI_CONDITION_TYPES.lr_fake = {}; }).toThrow();
		// label/category 前缀化不污染源
		expect(SANSHI_CONDITION_TYPES.lr_ke_name.label).toBe('六壬·课名(九宗门)');
		expect(LIURENG_CONDITION_TYPES.ke_name.label).toBe('课名(九宗门)');
	});

	it('🔴 三家锚判定分派(与各家金标同锚同真值)+失败家注记', ()=>{
		const pan = anchorPan();
		const ctx = makeSanshiZeriEvalCtx(pan);
		expect(SANSHI_CONDITION_TYPES.lr_ke_name.evaluate(pan, { values: ['重审课'] }, ctx).pass).toBe(true);
		expect(SANSHI_CONDITION_TYPES.ty_ju_num.evaluate(pan, { values: ['67'] }, ctx).pass).toBe(true);
		expect(SANSHI_CONDITION_TYPES.ty_ju_num.evaluate(pan, { values: ['19'] }, ctx).pass).toBe(false);
		expect(pan.qimen && typeof pan.qimen.juText === 'string' && pan.qimen.juText.length > 0).toBe(true);
		// 失败家:注记+判否;三家全败=null
		const broken = { liureng: null, qimen: pan.qimen, taiyi: pan.taiyi, _famFail: { liureng: 'x' } };
		const v = SANSHI_CONDITION_TYPES.lr_ke_name.evaluate(broken, { values: ['重审课'] }, makeSanshiZeriEvalCtx(broken));
		expect(v.pass).toBe(false);
		expect(v.actual).toContain('六壬盘起盘失败');
	});

	it('🔴 splitter 单源:拆分白名单 ⊆ 主页 SANSHI_UNITED_FIELDS ∪ 择日增补键(主页 schema 加键此处强制表态)', ()=>{
		const schema = TECHNIQUE_SETTINGS_SCHEMA.sanshiunited;
		expect(schema && Array.isArray(schema.fields)).toBe(true);
		const unitedNames = new Set(schema.fields.map((f)=>f.name));
		const allowed = new Set([...unitedNames, ...SANSHI_ZERI_EXTRA_KEYS]);
		const orphan = SANSHI_SPLIT_ALL_KEYS.filter((k)=>!allowed.has(k));
		expect(orphan.length ? `拆分键不在主页 schema 也不在增补白名单:${orphan.join('、')}` : 'ok').toBe('ok');
		// 改名规则回拆:taiyiAccum→tn
		const split = splitSanshiOptions({ taiyiAccum: 1, guirengType: 2, school: '飞盘', after23NewDay: 1 });
		expect(split.taiyi.tn).toBe(1);
		expect(split.liureng.guirengType).toBe(2);
		expect(split.qimen.school).toBe('飞盘');
		expect(split.liureng.after23NewDay).toBe(1);
		expect(split.qimen.after23NewDay).toBe(1);
		expect(split.taiyi.after23NewDay).toBe(1);
		expect(split.taiyi.timeAlg).toBe(undefined);
		// 共享键锚与 techniqueMountSettings 同值(字面对拍防漂移)
		expect(SANSHI_SHARED_TIME_KEYS).toEqual(['timeAlg', 'after23NewDay', 'lateZiHourUseNextDay']);
	});

	it('🔴 判别:merged 键经 splitter 透传确变各家盘(ty tn 67/19+lr 贵人流派 巳/丑)', ()=>{
		const a = anchorPan();
		const b = anchorPan({ taiyiAccum: 1 });
		expect(a.taiyi.kook.num).toBe(67);
		expect(b.taiyi.kook.num).toBe(19);
		const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		const gui = (p)=>ZHI[p.liureng.layout.houseTianJiang.indexOf('贵人')];
		expect(gui(a)).toBe('巳');
		expect(gui(anchorPan({ guirengType: 1 }))).toBe('丑');
	});

	it('树工厂/编译:跨家混排一棵树+validate 抓空', ()=>{
		const leaf1 = newSanshiLeaf('lr_zhou_ye');
		const leaf2 = newSanshiLeaf('ty_yinyang_ju');
		expect(sanshiLeafSummary(leaf1)).toContain('六壬·');
		expect(sanshiLeafSummary(leaf2)).toContain('太乙·');
		const tree = compileSanshiTree({ kind: 'group', joiner: 'all', children: [leaf1, { ...leaf2, joiner: 'all' }] });
		expect(tree.type).toBe('all');
		expect(()=>compileSanshiTree({ kind: 'group', joiner: 'all', children: [{ kind: 'leaf', type: 'ty_ju_num', joiner: 'all', params: { values: [] } }] })).toThrow();
	});
});

describe('[Z6] 扫描引擎(外壳第七实例:跨家复合恒等+行内同盘探针)', ()=>{
	jest.setTimeout(180000);
	const OPTS = {};
	// 跨家复合树:太乙阳遁(1月恒真) AND 六壬昼占(昼夜各半)——复合判定有真有假
	const TREE = compileSanshiTree({ kind: 'group', joiner: 'all', children: [newSanshiLeaf('ty_yinyang_ju'), { ...newSanshiLeaf('lr_zhou_ye'), joiner: 'all' }] });

	it('🔴 两日窗:区间覆盖≡独立逐时辰真值(每家同函数复算)+行内同盘探针', async ()=>{
		const res = await scanSanshi({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-02', endTime: '23:59' }, geoParams: GEO, options: OPTS, tree: TREE });
		expect(res.intervals.length).toBeGreaterThan(0);
		const sd = seeds();
		let mismatch = 0;
		let truths = 0;
		for(let ms = Date.UTC(2026, 0, 1) - 8 * 3600e3; ms < Date.UTC(2026, 0, 3) - 8 * 3600e3; ms += 3600e3){
			const d = new Date(ms + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const p = computeSanshiScanPan({ seeds: sd, natal: null }, GEO, OPTS, ds, ts);
			const truth = !!evaluateSanshiTree(TREE, p, null, false).pass;
			if(truth){ truths++; }
			const inRow = res.intervals.some((r)=>ms >= r.startMs && ms < r.endMs);
			if(truth !== inRow){ mismatch++; }
		}
		expect(mismatch).toBe(0);
		expect(truths).toBeGreaterThan(0);
		expect(truths).toBeLessThan(48);
		res.intervals.forEach((r)=>{
			const mid = r.startMs + Math.floor((r.endMs - r.startMs) / 2 / 60000) * 60000;
			const d = new Date(mid + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const p = computeSanshiScanPan({ seeds: sd, natal: null }, GEO, OPTS, ds, ts);
			const lr = p.liureng && p.liureng.sanChuan ? p.liureng.sanChuan.name : '—';
			const ty = p.taiyi && p.taiyi.kook ? p.taiyi.kook.text : '—';
			// [十四轮] 徽章面=树涉及家(TREE=ty+lr 两叶,qm 未涉不上徽章;家级掩码效果活证)
			expect(r.sanshiText).toBe(`${lr}·${ty}`);
		});
	});

	it('natal 经 options._natal 注入六壬家(判别:注入与否结果确不同)', async ()=>{
		const tree = compileSanshiTree({ kind: 'group', joiner: 'all', children: [newSanshiLeaf('lr_bm_in_chuan')] });
		const res = await scanSanshi({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-01', endTime: '23:59' }, geoParams: GEO, options: { _natal: { mingZhi: '午' } }, tree });
		expect(res.intervals.length).toBeGreaterThan(0);
		const resNo = await scanSanshi({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-01', endTime: '23:59' }, geoParams: GEO, options: {}, tree });
		expect(resNo.intervals.length).toBe(0);
	});

	it('explain 单时刻判读同源+extras(三家徽标)', ()=>{
		const ex = explainSanshiAt({ geoParams: GEO, options: OPTS, tree: TREE, t: '2026-01-01 12:30' });
		expect(['group', 'leaf']).toContain(ex.tree.kind);
		expect(ex.sanshiText).toContain('重审课');
		expect(ex.sanshiText).toContain('阳遁六十七局');
		// 奇门家段非失败占位(explain 现建 seeds 链通:makeScanCtx 拿 wAt.y 建当年种子)
		expect(ex.sanshiText.split('·')[1]).not.toBe('—');
	});
});

describe('[十一轮] 三式子掩码:按叶前缀分家取位(lr/qm 各走本家 keyMaskOf 单源)', ()=>{
	it('lr 叶不涉贵人+qm 叶不涉柱面 → 两家掩位全 false;涉则对应位开', ()=>{
		const t1 = compileSanshiTree({ kind: 'group', joiner: 'all', children: [
			{ kind: 'leaf', type: 'lr_ke_name', joiner: 'all', params: { values: ['元首课'] } },
			{ kind: 'leaf', type: 'qm_door', joiner: 'all', params: { values: ['开门'], palaces: [], matchMode: 'any' } },
		] });
		const m1 = sanshiKeyMaskOf(t1);
		expect(m1.lr.diurnal).toBe(false);
		expect(m1.qm.dayGz).toBe(false);
		const t2 = compileSanshiTree({ kind: 'group', joiner: 'all', children: [
			{ kind: 'leaf', type: 'lr_zhou_ye', joiner: 'all', params: { value: 'day' } },
			{ kind: 'leaf', type: 'qm_xun_shou', joiner: 'all', params: { dim: 'xunShou', values: ['甲子'] } },
		] });
		const m2 = sanshiKeyMaskOf(t2);
		expect(m2.lr.diurnal).toBe(true);
		expect(m2.qm.dayGz).toBe(true);
		expect(m2.qm.timeGz).toBe(false);
	});
});

describe('[十四轮] 家级掩码双向判别:树不涉之家不劈行(用户实报 1.8h+15分=太乙钟表换局劈六壬树)', ()=>{
	jest.setTimeout(180000);
	const GEO2 = { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, ad: 1 };
	// 太乙钟表换局界=19:00 整;六壬真太阳酉→戌界≈19:15。窗 17:00-21:00 覆盖两界。
	const cfg = { startDate: '2026-08-31', startTime: '17:00', endDate: '2026-08-31', endTime: '21:00' };
	const OPTS2 = {};
	const at1900 = Date.parse('2026-08-31T19:00:00+08:00');
	it('🔴 lr 恒真树:19:00 太乙界不劈(边界只落六壬面);ty 恒真树:19:00 必劈;并集恒等', async ()=>{
		const lrTree = compileSanshiTree({ kind: 'group', joiner: 'any', children: [
			{ ...newSanshiLeaf('lr_zhou_ye'), joiner: 'any', params: { value: 'day' } },
			{ ...newSanshiLeaf('lr_zhou_ye'), joiner: 'any', params: { value: 'night' } },
		] });
		const resLr = await scanSanshi({ cfg, geoParams: GEO2, options: OPTS2, tree: lrTree });
		const lrEnds = resLr.intervals.map((r)=>r.endMs);
		expect(lrEnds.indexOf(at1900)).toBe(-1);
		resLr.intervals.forEach((r)=>{ expect(r.sanshiText.indexOf('局')).toBe(-1); });	// 徽章仅六壬段
		const tyTree = compileSanshiTree({ kind: 'group', joiner: 'any', children: [
			{ ...newSanshiLeaf('ty_yinyang_ju'), joiner: 'any', params: { value: '阴' } },
			{ ...newSanshiLeaf('ty_yinyang_ju'), joiner: 'any', params: { value: '阳' } },
		] });
		const resTy = await scanSanshi({ cfg, geoParams: GEO2, options: OPTS2, tree: tyTree });
		expect(resTy.intervals.map((r)=>r.endMs).indexOf(at1900)).toBeGreaterThanOrEqual(0);
		const spanOf = (res)=>res.intervals.reduce((a, r)=>a + (r.endMs - r.startMs), 0);
		expect(spanOf(resLr)).toBe(spanOf(resTy));
	});
});
