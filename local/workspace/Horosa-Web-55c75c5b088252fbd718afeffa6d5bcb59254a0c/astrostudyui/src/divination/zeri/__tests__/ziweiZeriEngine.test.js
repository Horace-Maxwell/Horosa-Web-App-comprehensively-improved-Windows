// [Z4·紫微择日] 引擎+注册表金标。锚=2026-01-01 12:30 +08:00 男 Java兼容口径(初一年界:
// 年柱乙巳——非立春界丙午,shangShi 判别组因此=阴男;2026-08-28 dump 定谳)。
// 判别纪律(定案19):15 个扫描参数逐键「换档必变盘」三层断言;两个"疑似死开关"复盘:
// timeAlg @12:58 同盘=选点无判别力(北京 116°E<120°E 真太阳时-17.6分,11:05 才跨界),
// shangShi @女同盘=乙阴年女属阳男阴女组不换(判别组=阴年男)——都不是死开关。
// 🔴 组合退化明示:ziweiLunarBasis='calendar'(Java兼容默认)下 lateZi 三档对安星零效果
// (calendar 恒日历日+时支不随日进位),仅 basis='ziwei' 时晚子时档生效——金标钉此语义。
import { ZIWEI_CONDITION_TYPES, makeZiweiZeriEvalCtx, compileZiweiTree, newZiweiLeaf, ziweiLeafSummary, ZHI12 } from '../ziweiZeriConditionTypes';
import { computeZiweiScanPan, evaluateZiweiTree, scanZiwei, explainZiweiAt, ZIWEI_ZERI_DEFAULT_COMPAT } from '../ziweiZeriScanEngine';
import fs from 'fs';
import path from 'path';

const GEO = { zone: '+08:00', gpsLon: 116.46, gpsLat: 39.9 };
const anchorPan = ()=>computeZiweiScanPan(GEO, {}, '2026-01-01', '12:30:00');
const ev = (type, params, pan, natal)=>{
	const p = pan || anchorPan();
	return ZIWEI_CONDITION_TYPES[type].evaluate(p, params, makeZiweiZeriEvalCtx(p, natal || null));
};

describe('[Z4] 注册表契约+锚盘正反双判', ()=>{
	it('🔴 每类 spec 契约齐且 ≥20 类;口径三键与 parity 套件单源相等(防漂移)', ()=>{
		const keys = Object.keys(ZIWEI_CONDITION_TYPES);
		expect(keys.length).toBeGreaterThanOrEqual(20);
		keys.forEach((k)=>{
			const s = ZIWEI_CONDITION_TYPES[k];
			expect(typeof s.evaluate).toBe('function');
			expect(typeof s.summary(s.defaults)).toBe('string');
			expect(typeof s.category).toBe('string');
			expect(Array.isArray(s.fields)).toBe(true);
		});
		// 与 ziweiLocalParity.ZIWEI_JAVA_COMPAT_OPTS 逐键同(不 import 测试文件防套件连带执行;
		// 若 parity 侧口径演进,此处字面量+24 例网格例同步红)
		expect(ZIWEI_ZERI_DEFAULT_COMPAT).toEqual({ yearBoundary: 'lunar_1_1', ziweiLunarBasis: 'calendar', lifeMasterBy: 'year_branch' });
	});

	it('🔴 锚盘真值(命午/木三局/紫微申/乙年四化;此处红=本地引擎口径变,择日强制显影)', ()=>{
		const p = anchorPan();
		expect(ZHI12[p.lifeHouseIndex]).toBe('午');
		expect(p.wuxingJuText).toBe('木三局');
		expect(ZHI12[p.ziweiIndex]).toBe('申');
		expect(p.lifeMaster).toBe('武曲');
		expect(p.bodyMaster).toBe('天机');
		expect(p.doujun).toBe('丑');
		expect(p.birthSihua).toEqual({ 禄: '天机', 权: '天梁', 科: '紫微', 忌: '太阴' });
	});

	it('🔴 全 20 类正反双判(锚盘真值判真+扰动判假)', ()=>{
		const p = anchorPan();
		expect(ev('wuxing_ju', { values: ['3'] }, p).pass).toBe(true);
		expect(ev('wuxing_ju', { values: ['2'] }, p).pass).toBe(false);
		expect(ev('ming_gong_zhi', { values: ['午'] }, p).pass).toBe(true);
		expect(ev('ming_gong_zhi', { values: ['子'] }, p).pass).toBe(false);
		expect(ev('ming_zhu_xing', { mode: 'has', values: ['破军'] }, p).pass).toBe(true);
		expect(ev('ming_zhu_xing', { mode: 'has', values: ['紫微'] }, p).pass).toBe(false);
		expect(ev('ming_zhu_xing', { mode: 'empty', values: [] }, p).pass).toBe(false);
		// 身宫现场化:取身宫实有正曜判真,不在场星判假
		const bodyMains = (p.houses[p.bodyHouseIndex].starsMain || []).map((s)=>s.name);
		if(bodyMains.length){
			expect(ev('shen_zhu_xing', { mode: 'has', values: [bodyMains[0]] }, p).pass).toBe(true);
		}else{
			expect(ev('shen_zhu_xing', { mode: 'empty', values: [] }, p).pass).toBe(true);
		}
		expect(ev('ming_changsheng', { values: ['衰'] }, p).pass).toBe(true);
		expect(ev('ming_changsheng', { values: ['长生'] }, p).pass).toBe(false);
		// 安星:紫微在申
		const zwGong = p.houses[p.ziweiIndex].name;
		expect(ev('star_in_gong', { star: '紫微', gongs: [zwGong] }, p).pass).toBe(true);
		expect(ev('star_in_zhi', { star: '紫微', values: ['申'] }, p).pass).toBe(true);
		expect(ev('star_in_zhi', { star: '紫微', values: ['子'] }, p).pass).toBe(false);
		expect(ev('star_in_zhi', { star: '天马', values: ['寅'] }, p).pass).toBe(true);
		expect(ev('star_in_zhi', { star: '禄存', values: ['卯'] }, p).pass).toBe(true);	// 乙年禄存在卯
		expect(ev('star_in_zhi', { star: '禄存', values: ['子'] }, p).pass).toBe(false);
		// 同宫:禄存卯·天马寅=不同宫(禄马不同乡)
		expect(ev('star_tong_gong', { starA: '禄存', starB: '天马' }, p).pass).toBe(false);
		// 四化
		expect(ev('sihua_star', { hua: '禄', values: ['天机'] }, p).pass).toBe(true);
		expect(ev('sihua_star', { hua: '禄', values: ['武曲'] }, p).pass).toBe(false);
		expect(ev('sihua_star', { hua: '忌', values: ['太阴'] }, p).pass).toBe(true);
		// 忌太阴落宫现场化+sihua_dui_ming 三档恰一真
		const rIn = ev('sihua_dui_ming', { hua: '忌', rel: 'in' }, p).pass;
		const rOpp = ev('sihua_dui_ming', { hua: '忌', rel: 'opposite' }, p).pass;
		const rNot = ev('sihua_dui_ming', { hua: '忌', rel: 'not_in' }, p).pass;
		expect([rIn, rOpp, rNot].filter(Boolean).length >= 1).toBe(true);
		expect(rNot).toBe(!(rIn || rOpp));
		// 亮度:破军庙
		expect(ev('star_brightness', { star: '破军', values: ['庙'] }, p).pass).toBe(true);
		expect(ev('star_brightness', { star: '破军', values: ['陷'] }, p).pass).toBe(false);
		// 主宰
		expect(ev('life_master', { values: ['武曲'] }, p).pass).toBe(true);
		expect(ev('life_master', { values: ['破军'] }, p).pass).toBe(false);
		expect(ev('body_master', { values: ['天机'] }, p).pass).toBe(true);
		expect(ev('doujun_zhi', { values: ['丑'] }, p).pass).toBe(true);
		expect(ev('doujun_zhi', { values: ['寅'] }, p).pass).toBe(false);
		// 会照:命午三方四正={午,戌,寅,子};天马寅在内
		expect(ev('sanfang_has', { gong: '命宫', stars: ['天马'], mode: 'any' }, p).pass).toBe(true);
		expect(ev('sanfang_has', { gong: '命宫', stars: ['天马'], mode: 'none' }, p).pass).toBe(false);
		// 六吉/六煞计数:现场化(与 ctx 直查一致性)
		const ctx = makeZiweiZeriEvalCtx(p);
		const zone = new Set(ctx.sanfang(p.lifeHouseIndex));
		const liuji = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'].filter((st)=>(ctx.stars()[st] || []).some((e)=>zone.has(e.idx)));
		expect(ev('liuji_count', { gong: '命宫', min: liuji.length }, p).pass).toBe(true);
		expect(ev('liuji_count', { gong: '命宫', min: liuji.length + 1 }, p).pass).toBe(false);
		const liusha = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'].filter((st)=>(ctx.stars()[st] || []).some((e)=>zone.has(e.idx)));
		expect(ev('liusha_count', { gong: '命宫', max: liusha.length }, p).pass).toBe(true);
		if(liusha.length > 0){
			expect(ev('liusha_count', { gong: '命宫', max: liusha.length - 1 }, p).pass).toBe(false);
		}
		// 🔴 空劫真身=时系{地空,地劫}(modern 锚盘;年支杂曜「天空」不是空劫——曾两侧同含
		// 天空互证假绿,修实现后此处判别显影,期望对齐真口径并加「天空≠空劫」反锚)
		const kjAt = ['地空', '地劫'].flatMap((st)=>(ctx.stars()[st] || []).map((e)=>e.idx));
		const inZone = kjAt.some((i)=>zone.has(i));
		expect(ev('kong_jie_ming', { rel: 'avoid' }, p).pass).toBe(!inZone);
		expect(ev('kong_jie_ming', { rel: 'hui' }, p).pass).toBe(inZone);
		// 反锚:锚盘年支天空在三方四正而地空地劫全不在 → avoid 仍须真(天空不入判)
		const tkIdx = (ctx.stars()['天空'] || []).map((e)=>e.idx);
		if(tkIdx.some((i)=>zone.has(i)) && !inZone){
			expect(ev('kong_jie_ming', { rel: 'avoid' }, p).pass).toBe(true);
		}
	});

	it('🔴 本命组:未设 natal 判假+提示;设 natal 判别(换 natal 结果变)', ()=>{
		const p = anchorPan();
		expect(ev('bm_ji_bu_chong', {}, p).pass).toBe(false);
		expect(ev('bm_ji_bu_chong', {}, p).actual).toContain('未设用事人本命');
		// 忌=太阴,落宫现场取
		const ctx = makeZiweiZeriEvalCtx(p);
		const jiZhi = ZHI12[(ctx.stars()['太阴'] || [])[0].idx];
		expect(ev('bm_ji_bu_chong', {}, p, { mingZhi: jiZhi }).pass).toBe(false);	// 忌坐本命命宫=犯
		const far = ZHI12[(ZHI12.indexOf(jiZhi) + 3) % 12];
		expect(ev('bm_ji_bu_chong', {}, p, { mingZhi: far }).pass).toBe(true);
		// 候选命宫午:六合未
		expect(ev('bm_ming_he', { rel: 'liuhe' }, p, { mingZhi: '未' }).pass).toBe(true);
		expect(ev('bm_ming_he', { rel: 'liuhe' }, p, { mingZhi: '子' }).pass).toBe(false);
		expect(ev('bm_ming_he', { rel: 'sanhe' }, p, { mingZhi: '寅' }).pass).toBe(true);	// 寅午戌
		expect(ev('bm_ming_he', { rel: 'same' }, p, { mingZhi: '午' }).pass).toBe(true);
	});

	it('树工厂/编译:默认叶+validate 抓空 values', ()=>{
		const leaf = newZiweiLeaf('ming_gong_zhi');
		expect(leaf.params.values).toEqual(['子']);
		expect(ziweiLeafSummary(leaf)).toContain('命宫');
		expect(()=>compileZiweiTree({ kind: 'group', joiner: 'all', children: [{ kind: 'leaf', type: 'wuxing_ju', joiner: 'all', params: { values: [] } }] })).toThrow();
	});
});

describe('[Z4] 🔴 扫描参数逐键判别(换档必变盘;定案19 三层断言)', ()=>{
	const pan = (opts, d, t)=>computeZiweiScanPan(GEO, opts || {}, d || '2026-01-01', t || '12:30:00');

	it('yearBoundary(立春↔初一窗内 2026-02-10):局与四化整套确不同', ()=>{
		const a = pan({}, '2026-02-10', '10:30:00');
		const b = pan({ yearBoundary: 'lichun' }, '2026-02-10', '10:30:00');
		expect(a.wuxingJuText).toBe('水二局');
		expect(b.wuxingJuText).toBe('火六局');
		expect(a.birthSihua['禄']).toBe('天机');
		expect(b.birthSihua['禄']).toBe('天同');
	});

	it('🔴 ziweiLunarBasis×lateZi 组合语义:calendar 下晚子时零效果(明示退化);ziwei 基准下确变盘', ()=>{
		const key = (x)=>[ZHI12[x.lifeHouseIndex], x.wuxingJuText, ZHI12[x.ziweiIndex]].join('|');
		const c1 = pan({ lateZi: 'zi_chu' }, '2026-01-01', '23:30:00');
		const c2 = pan({ lateZi: 'zi_zheng' }, '2026-01-01', '23:30:00');
		expect(key(c1)).toBe(key(c2));	// calendar(默认):安星恒日历日,晚子时不入判定面
		const z1 = pan({ ziweiLunarBasis: 'ziwei', lateZi: 'zi_chu' }, '2026-01-01', '23:30:00');
		const z2 = pan({ ziweiLunarBasis: 'ziwei', lateZi: 'zi_zheng' }, '2026-01-01', '23:30:00');
		expect(ZHI12[z1.ziweiIndex]).toBe('申');	// 进日
		expect(ZHI12[z2.ziweiIndex]).toBe('亥');	// 不进日
		expect(key(z1)).not.toBe(key(z2));
	});

	it('timeAlg(真太阳时 11:05 界时刻):时支巳/午确不同(12:58 同盘=选点无判别力的反面教材)', ()=>{
		const t0 = pan({ timeAlg: 0 }, '2026-01-01', '11:05:00');
		const t1 = pan({ timeAlg: 1 }, '2026-01-01', '11:05:00');
		expect(t0.timeZi).toBe('巳');	// 11:05-17.6分=10:47
		expect(t1.timeZi).toBe('午');
	});

	it('leapMonth(2025 闰六月):mid_split 命卯 / prev 命寅 确不同', ()=>{
		const a = pan({}, '2025-08-10', '10:30:00');
		const b = pan({ leapMonth: 'prev' }, '2025-08-10', '10:30:00');
		expect(ZHI12[a.lifeHouseIndex]).toBe('卯');
		expect(ZHI12[b.lifeHouseIndex]).toBe('寅');
	});

	it('安星八键逐一变盘(tianma/huoling/kuiYue@庚年/kongwang/csStart@土五局/csDir/shangShi@阴男/kongNaming/starSet/lifeMasterBy/gender)', ()=>{
		const at = (p, name)=>{
			const out = [];
			p.houses.forEach((h, i)=>['starsMain', 'starsAssist', 'starsEvil', 'starsOthersGood', 'starsOthersBad', 'starsSmall'].forEach((f)=>(h[f] || []).forEach((s)=>{ if(s.name === name || s.name === `副${name}`){ out.push(`${s.name}${ZHI12[i]}`); } })));
			return out.sort().join('|') || 'NONE';
		};
		const A = anchorPan();
		expect(at(pan({ tianmaBasis: 'year' }), '天马')).toBe('天马亥');
		expect(at(A, '天马')).toBe('天马寅');
		expect(at(pan({ huoling: 'nanpai' }), '火星')).toBe('火星卯');
		expect(at(A, '火星')).toBe('火星酉');
		// 魁钺歌诀:判别年=庚(2020-06-01 庚子);两档确不同
		const kv1 = at(pan({}, '2020-06-01', '10:30:00'), '天钺');
		const kv2 = at(pan({ kuiYue: 'geng_ma_hu' }, '2020-06-01', '10:30:00'), '天钺');
		expect(kv1).not.toBe(kv2);
		// 空亡style:副星消失(数量2→1)
		expect(at(A, '旬空').split('|').length).toBe(2);
		expect(at(pan({ kongwangStyle: 'single' }), '旬空').split('|').length).toBe(1);
		// 长生起法:判别局=土五局(2025-08-10);两档命宫 phase 确不同
		const cs1 = pan({}, '2025-08-10', '10:30:00');
		const cs2 = pan({ changshengStart: 'huo_tu' }, '2025-08-10', '10:30:00');
		expect(cs1.wuxingJuText).toBe('土五局');
		expect(cs1.houses[cs1.lifeHouseIndex].phase).not.toBe(cs2.houses[cs2.lifeHouseIndex].phase);
		// 长生顺逆:锚盘 衰→死
		expect(A.houses[A.lifeHouseIndex].phase).toBe('衰');
		const cd = pan({ changshengDirection: 'always_forward' });
		expect(cd.houses[cd.lifeHouseIndex].phase).toBe('死');
		// 天伤天使:锚=乙年男=阴男→yinyang 档互换(亥↔丑);女(阳男阴女组)不换=判别组反面
		expect(at(A, '天伤')).toBe('天伤亥');
		expect(at(pan({ shangShi: 'yinyang' }), '天伤')).toBe('天伤丑');
		expect(at(pan({ shangShi: 'yinyang', gender: 0 }), '天伤')).toBe('天伤亥');
		// 空劫命名:book→地空改名天空且年支独立天空去除
		expect(at(pan({ kongNaming: 'book' }), '地空')).toBe('NONE');
		expect(at(pan({ kongNaming: 'book' }), '天空')).toBe('天空巳');
		expect(at(A, '天空')).toBe('天空午');
		// 星集:north18 滤掉禄存
		expect(at(pan({ starSet: 'north18' }), '禄存')).toBe('NONE');
		expect(at(A, '禄存')).toBe('禄存卯');
		// 命主取法
		expect(pan({ lifeMasterBy: 'ming_branch' }).lifeMaster).toBe('破军');
		expect(A.lifeMaster).toBe('武曲');
		// 性别(用事人):长生逆行
		expect(pan({ gender: 0 }).houses[A.lifeHouseIndex].phase).toBe('死');
	});
});

describe('[Z4] lite↔Java 24 例网格扩锚+plateKey 不变量+性能哨兵', ()=>{
	jest.setTimeout(120000);

	it('🔴 calcZiweiFromLite 过 Java 24 例网格(核心面 parity;决策10 扫描引擎接入门槛)', ()=>{
		const GRID = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'components', 'ziwei', '__tests__', 'fixtures', 'ziweiJavaGrid.json'), 'utf8'));
		let checked = 0;
		GRID.forEach((entry)=>{
			const q = entry.params;
			const p = computeZiweiScanPan({ zone: q.zone, lon: q.lon, lat: q.lat, gpsLon: q.gpsLon, gpsLat: q.gpsLat }, {
				gender: q.gender, timeAlg: q.timeAlg, after23NewDay: q.after23NewDay, lateZiHourUseNextDay: q.lateZiHourUseNextDay,
			}, q.date, q.time);
			const jc = entry.chart;
			if(!p || !jc || jc.lifeHouseIndex === undefined){ return; }
			expect(`${entry.why}|life:${p.lifeHouseIndex}`).toBe(`${entry.why}|life:${jc.lifeHouseIndex}`);
			if(jc.wuxingJu !== undefined){ expect(p.wuxingJu).toBe(jc.wuxingJu); }
			if(jc.ziweiIndex !== undefined){ expect(p.ziweiIndex).toBe(jc.ziweiIndex); }
			checked++;
		});
		expect(checked).toBeGreaterThanOrEqual(20);
	});

	it('plateKey 不变量:同时辰两分钟点 chart 判定面 deep-equal(同 key⇒同盘)', ()=>{
		[['2026-01-05', '09:05:00', '10:55:00'], ['2026-03-20', '13:10:00', '14:50:00'], ['2026-07-01', '21:01:00', '22:59:00']].forEach(([d, t1, t2])=>{
			const a = computeZiweiScanPan(GEO, {}, d, t1);
			const b = computeZiweiScanPan(GEO, {}, d, t2);
			const strip = (c)=>JSON.stringify({ ...c, nongli: null, fourColumns: null });
			expect(strip(a)).toBe(strip(b));
		});
	});

	it('🔴 性能哨兵:24 样均值 <10ms/盘(A档纯前端预算;lite 实测 0.13ms,10ms=红线)', ()=>{
		computeZiweiScanPan(GEO, {}, '2026-01-01', '00:30:00');	// 预热
		const t0 = Date.now();
		for(let h = 0; h < 24; h++){
			computeZiweiScanPan(GEO, {}, '2026-01-02', `${String(h).padStart(2, '0')}:30:00`);
		}
		const avg = (Date.now() - t0) / 24;
		expect(avg).toBeLessThan(10);
	});
});

describe('[Z4] 扫描引擎(外壳第四实例:恒等+行内同盘探针)', ()=>{
	jest.setTimeout(120000);
	const OPTS = {};
	const TREE = compileZiweiTree({ kind: 'group', joiner: 'all', children: [newZiweiLeaf('ming_gong_zhi')] });	// 命宫子(约1/12 命中)

	it('🔴 三日窗:区间覆盖≡独立逐时辰真值+行内同盘探针', async ()=>{
		const res = await scanZiwei({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-03', endTime: '23:59' }, geoParams: GEO, options: OPTS, tree: TREE });
		let mismatch = 0;
		let truths = 0;
		for(let ms = Date.UTC(2026, 0, 1) - 8 * 3600e3; ms < Date.UTC(2026, 0, 4) - 8 * 3600e3; ms += 7200e3){
			const d = new Date(ms + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const p = computeZiweiScanPan(GEO, OPTS, ds, ts);
			const truth = !!evaluateZiweiTree(TREE, p, null, false).pass;
			if(truth){ truths++; }
			const inRow = res.intervals.some((r)=>ms >= r.startMs && ms < r.endMs);
			if(truth !== inRow){ mismatch++; }
		}
		expect(mismatch).toBe(0);
		expect(truths).toBeGreaterThan(0);
		expect(truths).toBeLessThan(36);
		res.intervals.forEach((r)=>{
			const mid = r.startMs + Math.floor((r.endMs - r.startMs) / 2 / 60000) * 60000;
			const d = new Date(mid + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const p = computeZiweiScanPan(GEO, OPTS, ds, ts);
			const mains = ((p.houses && p.houses[p.lifeHouseIndex]) || {}).starsMain || [];
			expect(r.mingText).toBe(`命宫${ZHI12[p.lifeHouseIndex]}·${mains.length ? mains.map((s)=>s.name).join('') : '空宫'}`);
			expect(r.juText).toBe(p.wuxingJuText);
		});
	});

	it('natal 经 options._natal 注入扫描(本命条件在扫描态生效;判别:注入与否结果确不同)', async ()=>{
		const tree = compileZiweiTree({ kind: 'group', joiner: 'all', children: [newZiweiLeaf('bm_ming_he')] });
		const natal = { mingZhi: '未' };	// any_he:午未六合等——一日窗内必有命午/寅/戌/亥时辰
		const res = await scanZiwei({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-01', endTime: '23:59' }, geoParams: GEO, options: { _natal: natal }, tree });
		expect(res.intervals.length).toBeGreaterThan(0);
		const resNo = await scanZiwei({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-01', endTime: '23:59' }, geoParams: GEO, options: {}, tree });
		expect(resNo.intervals.length).toBe(0);
	});

	it('explain 单时刻判读同源+extras', ()=>{
		const ex = explainZiweiAt({ geoParams: GEO, options: OPTS, tree: TREE, t: '2026-01-01 12:30' });
		expect(['group', 'leaf']).toContain(ex.tree.kind);
		expect(ex.mingText).toBe('命宫午·破军');
		expect(ex.juText).toBe('木三局');
	});
	it('🔴 [W5 全谱轮] 7 新类正反双判(锚盘 dump 实跑:命午破军衰·身同宫·年干乙·杀破狼/英星入庙/文星失位·田宅乙酉)', ()=>{
		// 格局:杀破狼在(不破)/紫府同宫不在;避格档
		expect(ev('geju_hit', { mode: 'with', broken: 'any', values: ['杀破狼'] }).pass).toBe(true);
		expect(ev('geju_hit', { mode: 'with', broken: 'intact', values: ['杀破狼'] }).pass).toBe(true);
		expect(ev('geju_hit', { mode: 'with', broken: 'any', values: ['紫府同宫'] }).pass).toBe(false);
		expect(ev('geju_hit', { mode: 'without', broken: 'any', values: ['紫府同宫'] }).pass).toBe(true);
		// 宫干四化:田宅宫干乙,乙化忌=太阴,太阴恰在田宅(乙酉)→自化忌真
		expect(ev('gong_gan_sihua', { gong: '田宅', hua: '忌', mode: 'self' }).pass).toBe(true);
		expect(ev('gong_gan_sihua', { gong: '田宅', hua: '忌', mode: 'to_ming' }).pass).toBe(false);
		// 身宫:与命同宫(命宫档真;地支午档真;迁移档假)
		expect(ev('shen_gong_pos', { values: ['命宫'] }).pass).toBe(true);
		expect(ev('shen_gong_pos', { values: ['午'] }).pass).toBe(true);
		expect(ev('shen_gong_pos', { values: ['迁移'] }).pass).toBe(false);
		// 任意宫长生态:福德=临官/命宫=衰
		expect(ev('gong_changsheng', { gong: '福德', phases: ['临官'] }).pass).toBe(true);
		expect(ev('gong_changsheng', { gong: '福德', phases: ['帝旺'] }).pass).toBe(false);
		expect(ev('gong_changsheng', { gong: '命宫', phases: ['衰'] }).pass).toBe(true);
		// 来因宫:年干乙×宫干乙=田宅(乙酉)
		expect(ev('laiyin_gong', { values: ['田宅'] }).pass).toBe(true);
		expect(ev('laiyin_gong', { values: ['命宫'] }).pass).toBe(false);
		// 空宫:全盘无空宫(逐宫有主)→命宫 filled 真/empty 假
		expect(ev('gong_empty', { gong: '命宫', want: 'filled' }).pass).toBe(true);
		expect(ev('gong_empty', { gong: '命宫', want: 'empty' }).pass).toBe(false);
		// 宫名×地支:财帛在寅
		expect(ev('gong_zhi_name', { gong: '财帛', values: ['寅'] }).pass).toBe(true);
		expect(ev('gong_zhi_name', { gong: '财帛', values: ['卯'] }).pass).toBe(false);
	});

});
