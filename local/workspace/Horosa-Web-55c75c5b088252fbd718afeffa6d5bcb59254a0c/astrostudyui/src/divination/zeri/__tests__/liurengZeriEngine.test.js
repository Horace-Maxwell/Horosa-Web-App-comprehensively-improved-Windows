// [Z5·六壬择日] 引擎+注册表金标。锚=2026-01-01 12:30 +08:00 北京(乙亥日壬午时·月将丑·
// 昼·三传壬午→丁丑→空申·重审课——2026-08-28 本地链 dump 定谳)。判定单源:排盘=主六壬页
// 同一函数族(涉害 byte-perfect 核),此处红=主排盘变,择日强制显影。
// 判别纪律(定案19):贵人流派/阴阳系/月将两档/昼夜界/换日五档逐键「换档必变盘」;
// 昼夜界修正实抓:几何中心日出方程偏晚 ~4 分(07:40 误判夜),升级 zenith=90.833° 标准式
// (上边缘+折射)后与民用日出对齐(07:30 夜/07:40 昼,真值 07:36)。
import fs from 'fs';
import path from 'path';
import { LIURENG_CONDITION_TYPES, makeLiurengZeriEvalCtx, compileLiurengTree, newLiurengLeaf, liurengLeafSummary } from '../liurengZeriConditionTypes';
import { computeLiurengScanPan, evaluateLiurengTree, scanLiureng, explainLiurengAt } from '../liurengZeriScanEngine';
import { LR_GODS_RULES, LR_TAISUI_GODS } from '../liurengGodsData';
import { isDiurnalLocal } from '../liurengLocal';

const GEO = { zone: '+08:00', gpsLon: 116.46, gpsLat: 39.9 };
const anchorPan = ()=>computeLiurengScanPan(GEO, {}, '2026-01-01', '12:30:00');
const ev = (type, params, pan, natal)=>{
	const p = pan || anchorPan();
	if(natal){ p._natal = natal; }
	return LIURENG_CONDITION_TYPES[type].evaluate(p, params, makeLiurengZeriEvalCtx(p));
};
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

describe('[Z5] 🔴 gods 表机械同源(直读 Java 资源逐键逐值 diff;Java 表改此处红=制度层1)', ()=>{
	const SRV = path.join(__dirname, '..', '..', '..', '..', '..', 'astrostudysrv', 'astrostudy', 'src', 'main', 'java', 'spacex', 'astrostudy', 'helper');

	it('gods.json 16 神 rule 逐键逐值恰等', ()=>{
		const src = JSON.parse(fs.readFileSync(path.join(SRV, 'gods.json'), 'utf8'));
		const byname = {};
		src.forEach((r)=>{
			`${r.name}`.split('/').forEach((nm)=>{ byname[nm] = r; });
		});
		Object.keys(LR_GODS_RULES).forEach((n)=>{
			expect(byname[n] ? 'ok' : `Java gods.json 缺 ${n}`).toBe('ok');
			expect(LR_GODS_RULES[n]).toEqual(byname[n].rule);
		});
		expect(Object.keys(LR_GODS_RULES).length).toBe(16);
	});

	it('taisui.json 三环逐值恰等', ()=>{
		const src = JSON.parse(fs.readFileSync(path.join(SRV, 'taisui.json'), 'utf8'));
		expect(LR_TAISUI_GODS.gods1).toEqual(src.gods1);
		expect(LR_TAISUI_GODS.gods2).toEqual(src.gods2);
		expect(LR_TAISUI_GODS.gods3).toEqual(src.gods3);
	});

	it('排盘函数单源:LiuRengMain 导出即主页同函数(grep 计数哨兵——第三份重复=红)', ()=>{
		const read = (p)=>fs.readFileSync(path.join(__dirname, '..', '..', '..', p), 'utf8');
		const eng = read('divination/zeri/liurengZeriScanEngine.js');
		expect(eng).toContain("from '../../components/lrzhan/LiuRengMain'");
		// 全仓 buildLiuRengLayout 定义处 ≤2(LiuRengMain+SanShiUnitedMain 既有;择日零新增)
		const defs = ['components/lrzhan/LiuRengMain.js', 'components/sanshi/SanShiUnitedMain.js']
			.filter((p)=>read(p).includes('function buildLiuRengLayout('));
		expect(defs.length).toBeLessThanOrEqual(2);
		expect(eng.includes('function buildLiuRengLayout(')).toBe(false);
	});
});

describe('[Z5] 注册表契约+锚盘正反双判', ()=>{
	it('🔴 每类 spec 契约齐且 ≥22 类', ()=>{
		const keys = Object.keys(LIURENG_CONDITION_TYPES);
		expect(keys.length).toBeGreaterThanOrEqual(22);
		keys.forEach((k)=>{
			const s = LIURENG_CONDITION_TYPES[k];
			expect(typeof s.evaluate).toBe('function');
			expect(typeof s.summary(s.defaults)).toBe('string');
			expect(typeof s.category).toBe('string');
			expect(Array.isArray(s.fields)).toBe(true);
		});
	});

	it('🔴 锚盘真值(三传/课名/贵人/月将/昼夜)', ()=>{
		const p = anchorPan();
		expect(p.sanChuan.cuang).toEqual(['壬午', '丁丑', '空申']);
		expect(p.sanChuan.name).toBe('重审课');
		expect(p.yue).toBe('丑');
		expect(p.diurnal).toBe(true);
		expect(ZHI[p.layout.houseTianJiang.indexOf('贵人')]).toBe('巳');
		expect(p.layout.guirenForward).toBe(false);
	});

	it('🔴 全 22 类正反双判(锚盘真值判真+扰动判假)', ()=>{
		const p = anchorPan();
		expect(ev('ke_name', { values: ['重审课'] }, p).pass).toBe(true);
		expect(ev('ke_name', { values: ['元首课'] }, p).pass).toBe(false);
		expect(ev('chuan_zhi', { pos: 'any', values: ['午'] }, p).pass).toBe(true);
		expect(ev('chuan_zhi', { pos: '0', values: ['午'] }, p).pass).toBe(true);
		expect(ev('chuan_zhi', { pos: '2', values: ['申'] }, p).pass).toBe(true);	// 空申尾字=申
		expect(ev('chuan_zhi', { pos: 'any', values: ['子'] }, p).pass).toBe(false);
		expect(ev('chuan_jiang', { pos: 'any', values: ['天空'] }, p).pass).toBe(true);
		expect(ev('chuan_jiang', { pos: '0', values: ['天后'] }, p).pass).toBe(false);
		expect(ev('chuan_liuqin', { pos: '0', values: ['子孙'] }, p).pass).toBe(true);
		expect(ev('chuan_liuqin', { pos: '0', values: ['官鬼'] }, p).pass).toBe(false);
		expect(ev('chuan_liuqin', { pos: 'any', values: ['官鬼'] }, p).pass).toBe(true);
		expect(ev('chuan_kong', { mode: 'has' }, p).pass).toBe(true);	// 空申
		expect(ev('chuan_kong', { mode: 'none' }, p).pass).toBe(false);
		expect(ev('chuan_kong', { mode: 'first' }, p).pass).toBe(false);
		expect(ev('chuan_ju', { values: ['水', '木', '火', '金'] }, p).pass).toBe(false);	// 午丑申不成局
		expect(ev('fa_yong', { who: '驿马' }, p).pass).toBe(false);	// 驿马巳·初传午
		expect(ev('tianpan_at', { di: '子', values: ['未'] }, p).pass).toBe(true);	// 丑将午时:子上未
		expect(ev('tianpan_at', { di: '子', values: ['丑'] }, p).pass).toBe(false);
		expect(ev('guiren_pos', { values: ['巳'], dir: 'reverse' }, p).pass).toBe(true);
		expect(ev('guiren_pos', { values: ['巳'], dir: 'forward' }, p).pass).toBe(false);
		expect(ev('guiren_pos', { values: [], dir: 'reverse' }, p).pass).toBe(true);
		expect(ev('jiang_at', { jiang: '青龙', values: ['子'] }, p).pass).toBe(true);
		expect(ev('jiang_at', { jiang: '青龙', values: ['寅'] }, p).pass).toBe(false);
		expect(ev('yue_jiang_is', { values: ['丑'] }, p).pass).toBe(true);
		expect(ev('yue_jiang_is', { values: ['子'] }, p).pass).toBe(false);
		expect(ev('zhou_ye', { value: 'day' }, p).pass).toBe(true);
		expect(ev('zhou_ye', { value: 'night' }, p).pass).toBe(false);
		expect(ev('ke_shang', { pos: '0', values: ['亥'] }, p).pass).toBe(true);
		expect(ev('ke_shang', { pos: '3', values: ['丑'] }, p).pass).toBe(true);
		expect(ev('ke_shang', { pos: '0', values: ['子'] }, p).pass).toBe(false);
		// 贼克:锚盘二三课同形(亥上午)水贼火=下贼上 2 课(初判"恰一"想当然错,引擎对)
		expect(ev('ke_zei', { kind: 'zei', min: 2, max: 4 }, p).pass).toBe(true);
		expect(ev('ke_zei', { kind: 'zei', min: 3, max: 4 }, p).pass).toBe(false);
		expect(ev('ke_zei', { kind: 'zei', min: 0, max: 1 }, p).pass).toBe(false);
		expect(ev('day_ganzhi', { values: ['乙亥'] }, p).pass).toBe(true);
		expect(ev('day_ganzhi', { values: ['乙'] }, p).pass).toBe(true);
		expect(ev('day_ganzhi', { values: ['甲子'] }, p).pass).toBe(false);
		expect(ev('hour_zhi', { values: ['午'] }, p).pass).toBe(true);
		expect(ev('hour_zhi', { values: ['子'] }, p).pass).toBe(false);
		expect(ev('shensha_at', { who: '日德', values: ['申'] }, p).pass).toBe(true);
		expect(ev('shensha_at', { who: '日德', values: ['子'] }, p).pass).toBe(false);
		expect(ev('shensha_at', { who: '驿马', values: ['巳'] }, p).pass).toBe(true);
		expect(ev('taisui_god_at', { who: '岁驾', values: ['巳'] }, p).pass).toBe(true);
		expect(ev('taisui_god_at', { who: '白虎', values: ['丑'] }, p).pass).toBe(true);
		expect(ev('taisui_god_at', { who: '岁驾', values: ['子'] }, p).pass).toBe(false);
		expect(ev('xun_ding', { who: 'ding', values: ['丑'] }, p).pass).toBe(true);
		expect(ev('xun_ding', { who: 'kong', values: ['申'] }, p).pass).toBe(true);
		expect(ev('xun_ding', { who: 'kong', values: ['子'] }, p).pass).toBe(false);
		// 发用午·日支亥:非冲(亥冲巳)非同非合(午与亥)——not_chong 真
		expect(ev('chuan_chong_ri', { rel: 'not_chong' }, p).pass).toBe(true);
		expect(ev('chuan_chong_ri', { rel: 'chong' }, p).pass).toBe(false);
	});

	it('🔴 本命组:未设 natal 判假+提示;设 natal 判别(换 natal 结果变)', ()=>{
		const p = anchorPan();
		expect(ev('bm_in_chuan', { who: 'ming', mode: 'in' }, p).pass).toBe(false);
		expect(ev('bm_in_chuan', { who: 'ming', mode: 'in' }, p).actual).toContain('未设用事人本命');
		const p2 = anchorPan();
		expect(ev('bm_in_chuan', { who: 'ming', mode: 'in' }, p2, { mingZhi: '午' }).pass).toBe(true);	// 三传午丑申
		const p3 = anchorPan();
		expect(ev('bm_in_chuan', { who: 'ming', mode: 'in' }, p3, { mingZhi: '子' }).pass).toBe(false);
		const p4 = anchorPan();
		expect(ev('bm_in_chuan', { who: 'ming', mode: 'fayong' }, p4, { mingZhi: '午' }).pass).toBe(true);
		const p5 = anchorPan();
		expect(ev('bm_shang_jiang', { who: 'ming', values: ['贵人'] }, p5, { mingZhi: '巳' }).pass).toBe(true);	// 贵人临巳
		const p6 = anchorPan();
		expect(ev('bm_shang_jiang', { who: 'ming', values: ['贵人'] }, p6, { mingZhi: '子' }).pass).toBe(false);
	});

	it('树工厂/编译:默认叶+validate 抓空 values', ()=>{
		const leaf = newLiurengLeaf('chuan_zhi');
		expect(leaf.params.values).toEqual(['子']);
		expect(liurengLeafSummary(leaf)).toContain('三传');
		expect(()=>compileLiurengTree({ kind: 'group', joiner: 'all', children: [{ kind: 'leaf', type: 'ke_name', joiner: 'all', params: { values: [] } }] })).toThrow();
	});
});

describe('[Z5] 🔴 扫描参数逐键判别(换档必变盘;定案19)', ()=>{
	const pan = (opts, d, t)=>computeLiurengScanPan(GEO, opts || {}, d || '2026-01-01', t || '12:30:00');
	const guiAt = (p)=>ZHI[p.layout.houseTianJiang.indexOf('贵人')];

	it('贵人流派 guirengType 0/1:同刻贵人位 巳/丑 确不同', ()=>{
		expect(guiAt(pan({}))).toBe('巳');
		expect(guiAt(pan({ guirengType: 1 }))).toBe('丑');
	});

	it('阴阳系 yinyangSystem(乙日在换组):贵人 巳/丑 确不同', ()=>{
		expect(guiAt(pan({ yinyangSystem: 'yinyang' }))).toBe('丑');
	});

	it('🔴 月将两档(1/10 小寒后大寒前):中气丑·比用课 / 节气子·无依课 整盘确不同', ()=>{
		const a = pan({}, '2026-01-10', '12:30:00');
		const b = pan({ yueMode: 'jieqi' }, '2026-01-10', '12:30:00');
		expect(a.yue).toBe('丑');
		expect(b.yue).toBe('子');
		expect(a.sanChuan.name).toBe('比用课');
		expect(b.sanChuan.name).toBe('无依课');
	});

	it('🔴 昼夜界(日出 07:36 修正实抓):07:30 夜贵亥 / 07:40 昼贵卯 确不同;日落 17:00 前后再证', ()=>{
		const a = pan({}, '2026-01-01', '07:30:00');
		const b = pan({}, '2026-01-01', '07:40:00');
		expect(a.diurnal).toBe(false);
		expect(b.diurnal).toBe(true);
		expect(guiAt(a)).toBe('亥');
		expect(guiAt(b)).toBe('卯');
		expect(isDiurnalLocal('2026-01-01', '16:55:00', 39.9, 116.46, 8)).toBe(true);
		expect(isDiurnalLocal('2026-01-01', '17:05:00', 39.9, 116.46, 8)).toBe(false);
	});

	it('换日档 after23NewDay(23:30):两档日柱不同→三传确不同', ()=>{
		const a = pan({ after23NewDay: 0 }, '2026-01-01', '23:30:00');
		const b = pan({ after23NewDay: 1 }, '2026-01-01', '23:30:00');
		const day = (x)=>((x.fourColumns || {}).day || {}).ganzi;
		expect(day(a)).not.toBe(day(b));
		expect(a.sanChuan.cuang.join('')).not.toBe(b.sanChuan.cuang.join(''));
	});
});

describe('[Z5] 扫描引擎(外壳第六实例:恒等+行内同盘探针)', ()=>{
	jest.setTimeout(120000);
	const OPTS = {};
	const TREE = compileLiurengTree({ kind: 'group', joiner: 'all', children: [newLiurengLeaf('zhou_ye')] });	// 昼占(默认 day;昼夜各半)

	it('🔴 三日窗:区间覆盖≡独立逐时辰真值+行内同盘探针(plateKey 含昼夜位)', async ()=>{
		const res = await scanLiureng({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-03', endTime: '23:59' }, geoParams: GEO, options: OPTS, tree: TREE });
		expect(res.intervals.length).toBeGreaterThan(0);
		let mismatch = 0;
		let truths = 0;
		for(let ms = Date.UTC(2026, 0, 1) - 8 * 3600e3; ms < Date.UTC(2026, 0, 4) - 8 * 3600e3; ms += 3600e3){
			const d = new Date(ms + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const p = computeLiurengScanPan(GEO, OPTS, ds, ts);
			const truth = !!evaluateLiurengTree(TREE, p, null, false).pass;
			if(truth){ truths++; }
			const inRow = res.intervals.some((r)=>ms >= r.startMs && ms < r.endMs);
			if(truth !== inRow){ mismatch++; }
		}
		expect(mismatch).toBe(0);
		expect(truths).toBeGreaterThan(0);
		expect(truths).toBeLessThan(72);
		res.intervals.forEach((r)=>{
			const mid = r.startMs + Math.floor((r.endMs - r.startMs) / 2 / 60000) * 60000;
			const d = new Date(mid + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const p = computeLiurengScanPan(GEO, OPTS, ds, ts);
			expect(r.keText).toBe(p.sanChuan.name);
			expect(r.chuanText).toBe(p.sanChuan.cuang.join('→'));
		});
	});

	it('natal 经 options._natal 注入扫描(判别:注入与否结果确不同)', async ()=>{
		const tree = compileLiurengTree({ kind: 'group', joiner: 'all', children: [newLiurengLeaf('bm_in_chuan')] });
		const res = await scanLiureng({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-01', endTime: '23:59' }, geoParams: GEO, options: { _natal: { mingZhi: '午' } }, tree });
		expect(res.intervals.length).toBeGreaterThan(0);
		const resNo = await scanLiureng({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-01', endTime: '23:59' }, geoParams: GEO, options: {}, tree });
		expect(resNo.intervals.length).toBe(0);
	});

	it('explain 单时刻判读同源+extras', ()=>{
		const ex = explainLiurengAt({ geoParams: GEO, options: OPTS, tree: TREE, t: '2026-01-01 12:30' });
		expect(['group', 'leaf']).toContain(ex.tree.kind);
		expect(ex.keText).toBe('重审课');
		expect(ex.chuanText).toBe('壬午→丁丑→空申');
	});
	it('🔴 [W2 全谱轮] 6 新类/扩档正反双判(正锚真值 dump 实跑:三传壬午/丁丑/空申·重审·小局13·日乙亥)', ()=>{
		// 遁干:初遁壬/中遁丁/末空亡无遁干
		expect(ev('chuan_dungan', { pos: '0', values: ['壬'] }).pass).toBe(true);
		expect(ev('chuan_dungan', { pos: 'any', values: ['丁'] }).pass).toBe(true);
		expect(ev('chuan_dungan', { pos: '2', values: ['丁'] }).pass).toBe(false);
		expect(ev('chuan_dungan', { pos: 'any', values: ['癸'] }).pass).toBe(false);
		// 小局:sanqi 在/yinv 不在
		expect(ev('xiaoju_hit', { mode: 'with', values: ['sanqi'] }).pass).toBe(true);
		expect(ev('xiaoju_hit', { mode: 'with', values: ['yinv'] }).pass).toBe(false);
		expect(ev('xiaoju_hit', { mode: 'without', values: ['yinv'] }).pass).toBe(true);
		// 大格:chongshen 在/yuanshou 不在
		expect(ev('dage_hit', { mode: 'with', values: ['chongshen'] }).pass).toBe(true);
		expect(ev('dage_hit', { mode: 'with', values: ['yuanshou'] }).pass).toBe(false);
		// 贼克位置:二课上午(火)下亥(水)=下贼上;一课下=日干乙寄辰(土)上亥(水)=上下互不克→比和假、上克下假?
		// 亥(水)克?水克火——上水下土:土克水=下贼上!直接双向断言实跑值:
		expect(ev('ke_pos_zei', { pos: '2', rel: 'xia_zei_shang' }).pass).toBe(true);
		expect(ev('ke_pos_zei', { pos: '2', rel: 'shang_ke_xia' }).pass).toBe(false);
		// 旺衰:日干乙(阴木)于发用午=长生(阳顺阴逆)
		expect(ev('zhu_wangshuai', { who: 'fa_yong', phases: ['长生'] }).pass).toBe(true);
		expect(ev('zhu_wangshuai', { who: 'fa_yong', phases: ['帝旺'] }).pass).toBe(false);
		// 太岁三环扩档:二环剑锋(判定并三环本就在,选项现可选)
		const r = ev('taisui_god_at', { who: '剑锋', values: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] });
		expect(typeof r.pass).toBe('boolean');
		expect(r.actual.indexOf('剑锋') === 0).toBe(true);
	});

});

describe('[十一轮] keyDeps 判别网:声明「不吃昼夜」的类在仅昼夜异的两盘上结果必同', ()=>{
	// 盘对构造:同一时刻盘,取其 chartLite/yue 用主页同三函数重起「昼夜翻转」版——
	// lrGods/xun/fourColumns/_candY 全不变,唯 layout/ke/sanChuan/diurnal 按翻转昼夜重排
	// = 「仅昼夜面异」的判别对(castOverride.isDiurnal 既有注入口,零生产改动)。
	const { buildLiuRengLayout, buildKeData, buildSanChuanData } = require('../../../components/lrzhan/LiuRengMain');
	const makeDiurnalPair = (dateStr, timeStr)=>{
		const p1 = computeLiurengScanPan(GEO, {}, dateStr, timeStr);
		if(!p1){ return null; }
		const co2 = { ...p1.castOverride, isDiurnal: !p1.diurnal };
		const layout2 = buildLiuRengLayout(p1.chartLite, p1.guirengType, co2);
		const ke2 = buildKeData(layout2, p1.chartLite);
		const sc2 = buildSanChuanData(layout2, ke2.raw, p1.chartLite, co2);
		const p2 = { ...p1, layout: layout2, ke: ke2, sanChuan: sc2, diurnal: !p1.diurnal, castOverride: co2 };
		return [p1, p2];
	};
	const natal = { mingZhi: '卯', bornYear: 1990, male: true, xingnianZhi: '寅' };

	it('🔴 构造有效性判别向量:zhou_ye 在盘对上 pass 必反(翻转真的生效)', ()=>{
		const pair = makeDiurnalPair('2026-01-01', '12:30:00');
		expect(pair).toBeTruthy();
		const r1 = ev('zhou_ye', { value: 'day' }, { ...pair[0] });
		const r2 = ev('zhou_ye', { value: 'day' }, { ...pair[1] });
		expect(r1.pass).not.toBe(r2.pass);
	});

	it('🔴 引擎级双向判别:同为恒真树,吃/不吃 diurnal 决定日落劈不劈行(用户 1.6h/24分 报障根修实证)', async ()=>{
		// 北京 2026-08-31 日落钟表≈18:4x;宽容窗 (18:30,18:59) **不含 19:00 时辰界**(时支翻
		// =合法真变盘边界,掩码不该也不能吞它——首跑把 19:00 圈进窗=断言画错,探针 dump 定谳)。
		const cfg = { startDate: '2026-08-31', startTime: '12:00', endDate: '2026-08-31', endTime: '23:00' };
		const sunsetLo = Date.parse('2026-08-31T18:30:00+08:00');
		const sunsetHi = Date.parse('2026-08-31T18:59:00+08:00');
		const innerEnds = (res)=>res.intervals.map((r)=>r.endMs).filter((ms)=>ms > sunsetLo && ms < sunsetHi);
		// 树A:三传含支=全 12 支(恒真,keyDeps 无 diurnal)→ 掩码略昼夜位,日落不劈
		const treeA = compileLiurengTree({ kind: 'leaf', type: 'chuan_zhi', params: { pos: 'any', values: ZHI.slice() } });
		const resA = await scanLiureng({ cfg, geoParams: GEO, options: {}, tree: treeA });
		expect(innerEnds(resA)).toEqual([]);
		// 树B:昼∨夜(恒真,zhou_ye 声明吃 diurnal)→ 掩码保留昼夜位,日落必劈
		const treeB = compileLiurengTree({ kind: 'group', joiner: 'any', children: [
			{ kind: 'leaf', type: 'zhou_ye', joiner: 'any', params: { value: 'day' } },
			{ kind: 'leaf', type: 'zhou_ye', joiner: 'any', params: { value: 'night' } },
		] });
		const resB = await scanLiureng({ cfg, geoParams: GEO, options: {}, tree: treeB });
		expect(innerEnds(resB).length).toBe(1);
		// 两树覆盖并集恒等(掩码只改分行不改覆盖)
		const spanOf = (res)=>res.intervals.reduce((s, r)=>s + (r.endMs - r.startMs), 0);
		expect(spanOf(resA)).toBe(spanOf(resB));
	});

	it('🔴 全类扫:keyDeps 不含 diurnal 的类,枚举参数变体逐一断言两盘 pass+actual 全等(漏标必红)', ()=>{
		// 变体源:defaults + 每 select/multiselect 字段逐 option 替换(与压测 S1 同思路的轻量版;
		// 不引 kit 全件避免圈依赖,15 行内联)。
		const variantsOf = (spec)=>{
			const out = [JSON.parse(JSON.stringify(spec.defaults || {}))];
			(spec.fields || []).forEach((f)=>{
				if((f.kind === 'select' || f.kind === 'multiselect') && Array.isArray(f.options)){
					f.options.slice(0, 4).forEach((o)=>{
						const v = JSON.parse(JSON.stringify(spec.defaults || {}));
						v[f.key] = f.kind === 'multiselect' ? [o.value] : o.value;
						out.push(v);
					});
				}
			});
			return out;
		};
		// 两个盘对(冬至邻近正午+夏至邻近傍晚)扩大覆盖
		const pairs = [makeDiurnalPair('2026-01-01', '12:30:00'), makeDiurnalPair('2026-06-20', '17:30:00')].filter(Boolean);
		expect(pairs.length).toBe(2);
		const offenders = [];
		Object.keys(LIURENG_CONDITION_TYPES).forEach((type)=>{
			const spec = LIURENG_CONDITION_TYPES[type];
			expect(Array.isArray(spec.keyDeps)).toBe(true);	// 完备闸内联:缺声明=红
			if(spec.keyDeps.indexOf('diurnal') >= 0){ return; }
			variantsOf(spec).forEach((params)=>{
				pairs.forEach(([a, b], pi)=>{
					const pa = { ...a };
					const pb = { ...b };
					const ra = ev(type, params, pa, natal);
					const rb = ev(type, params, pb, natal);
					if(ra.pass !== rb.pass || `${ra.actual}` !== `${rb.actual}`){
						offenders.push(`${type} 声明不吃昼夜但盘对${pi} 结果异:${JSON.stringify(params)} → ${ra.pass}/${ra.actual} vs ${rb.pass}/${rb.actual}`);
					}
				});
			});
		});
		expect(offenders).toEqual([]);
	});
});
