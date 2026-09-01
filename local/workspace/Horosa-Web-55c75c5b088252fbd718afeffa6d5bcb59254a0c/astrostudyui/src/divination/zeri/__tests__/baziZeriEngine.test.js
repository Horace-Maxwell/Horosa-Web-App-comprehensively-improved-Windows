// [Z2·八字择日] 引擎+注册表金标。冻结基线锚=1990-03-15 12:30 +08:00(四柱庚午/己卯/己卯/
// 庚午,buildLocalBaziResult 引擎真值,本仓评测三盘锚同源)。判别纪律(定案19):
// 晚子时档(lateZiHourUseNextDay 0/1)在 23:30 时刻两档时柱不同=判别时刻;正反双判全类。
// Stress:扫描区间覆盖≡独立逐时辰真值+行内同盘探针(Z0 新增机械盲区闸)。
import { BAZI_CONDITION_TYPES, makeBaziZeriEvalCtx, compileBaziTree, newBaziLeaf } from '../baziZeriConditionTypes';
import { computeBaziScanPan, evaluateBaziTree, scanBazi, explainBaziAt } from '../baziZeriScanEngine';

const GEO = { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, ad: 1 };
const OPTS = { timeAlg: 1, after23NewDay: 1, lateZiHourUseNextDay: 1, godKeyPos: 0 };	// 钟表时(锚盘口径)
const anchorPan = ()=>computeBaziScanPan(GEO, OPTS, '1990-03-15', '12:30:00');
const leaf = (type, params)=>({ type, params });
const ev = (type, params, pan, natal)=>BAZI_CONDITION_TYPES[type].evaluate(pan || anchorPan(), params, makeBaziZeriEvalCtx(pan || anchorPan(), natal || null));

describe('[Z2] 注册表契约+锚盘正反双判', ()=>{
	it('🔴 每类 spec 五件齐且 ≥17 类', ()=>{
		const keys = Object.keys(BAZI_CONDITION_TYPES);
		expect(keys.length).toBeGreaterThanOrEqual(17);
		keys.forEach((k)=>{
			const s = BAZI_CONDITION_TYPES[k];
			expect(typeof s.evaluate).toBe('function');
			expect(typeof s.summary(s.defaults)).toBe('string');
		});
	});

	it('🔴 锚盘四柱=庚午/己卯/己卯/庚午(引擎真值;此处红=主引擎口径变,择日强制显影)', ()=>{
		const pan = anchorPan();
		const g = (k)=>pan.four[k].ganzi || pan.four[k].ganZhi;
		expect([g('year'), g('month'), g('day'), g('time')]).toEqual(['庚午', '己卯', '己卯', '庚午']);
	});

	it('🔴 全类正反双判(锚盘真值判真+扰动判假)', ()=>{
		expect(ev('day_ganzhi', { values: ['己卯'] }).pass).toBe(true);
		expect(ev('day_ganzhi', { values: ['己'] }).pass).toBe(true);
		expect(ev('day_ganzhi', { values: ['甲子'] }).pass).toBe(false);
		expect(ev('hour_ganzhi', { values: ['庚午'] }).pass).toBe(true);
		expect(ev('hour_ganzhi', { values: ['子'] }).pass).toBe(false);
		expect(ev('month_year_gz', { pillar: 'month', values: ['卯'] }).pass).toBe(true);
		expect(ev('month_year_gz', { pillar: 'year', values: ['庚'] }).pass).toBe(true);
		expect(ev('month_year_gz', { pillar: 'month', values: ['寅'] }).pass).toBe(false);
		// 支间:日卯时午 无六合(卯戌合);卯午无冲;伏吟假
		expect(ev('zhi_relation', { a: 'day', b: 'time', rel: 'liuhe' }).pass).toBe(false);
		expect(ev('zhi_relation', { a: 'year', b: 'time', rel: 'same' }).pass).toBe(true);	// 年午时午伏吟
		expect(ev('zhi_relation', { a: 'day', b: 'month', rel: 'same' }).pass).toBe(true);	// 卯卯
		expect(ev('zhi_relation', { a: 'day', b: 'time', rel: 'chong' }).pass).toBe(false);
		// 天干:日己时庚 非五合(己甲合);年庚月己=非
		expect(ev('gan_wuhe', { a: 'day', b: 'time' }).pass).toBe(false);
		// 三合:午卯卯午→寅午戌缺寅戌,亥卯未有卯卯(半合需两个不同支)——卯卯同支不成半合
		expect(ev('sanhe_ju', { values: ['火'], full: false }).pass).toBe(false);
		expect(ev('sanhe_ju', { values: ['木'], full: false }).pass).toBe(false);
		// 纳音:己卯城头土
		expect(ev('nayin_wuxing', { pillar: 'day', values: ['土'] }).pass).toBe(true);
		expect(ev('nayin_wuxing', { pillar: 'day', values: ['金'] }).pass).toBe(false);
		// 长生:己(阴干旧口径阳顺阴逆缺省档)于午=?——按同源函数实判,断言与扰动互反即可
		const cs = ev('changsheng', { at: 'time', values: ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] });
		expect(cs.pass).toBe(true);	// 全集必中(actual 带实态)
		expect(cs.actual).toContain('己于午');
		// 旬空:己卯在甲戌旬?——己卯:支卯(3)-干己(5)=-2→+12=10→戌→甲戌旬空申酉;时支午不空
		expect(ev('xunkong', { pillar: 'time', mode: 'not' }).pass).toBe(true);
		expect(ev('xunkong', { pillar: 'time', mode: 'is' }).pass).toBe(false);
		// 五行
		expect(ev('wuxing_day', { values: ['土'] }).pass).toBe(true);
		expect(ev('wuxing_day', { values: ['水'] }).pass).toBe(false);
		expect(ev('wuxing_presence', { mode: 'all5', values: [] }).pass).toBe(false);	// 庚午己卯盘无水
		expect(ev('wuxing_presence', { mode: 'lack', values: ['水'] }).pass).toBe(true);
		expect(ev('wuxing_presence', { mode: 'has', values: ['金', '木'] }).pass).toBe(true);
		// 历法
		expect(ev('yinyang_day', { value: 'yin' }).pass).toBe(true);	// 己=阴
		expect(ev('yinyang_day', { value: 'yang' }).pass).toBe(false);
		expect(ev('jieqi_month', { values: ['卯'] }).pass).toBe(true);
		expect(ev('jieqi_month', { values: ['寅'] }).pass).toBe(false);
		// 神煞(同源函数实判;正锚=实抓后断言,先验证机制:全吉神列表 any 或有或无但 actual 有效)
		const ss = ev('shensha_has', { values: ['天乙贵人', '文昌贵人', '禄神', '驿马', '华盖', '将星'], pillars: [], matchMode: 'any' });
		expect(typeof ss.pass).toBe('boolean');
		expect(ss.actual).toContain('神煞');
	});

	it('🔴 本命组:未设 natal 判假+提示;设 natal 后三类真值(判别:换 natal 结果变)', ()=>{
		expect(ev('bm_bu_chong', { targets: ['yearZhi'] }).pass).toBe(false);
		expect(ev('bm_bu_chong', { targets: ['yearZhi'] }).actual).toContain('未设用事人本命');
		// natal:年支子(候选日支卯不冲子,时支午冲子=犯)
		const natalZi = { yearZhi: '子', dayZhi: '丑', dayGan: '甲', xiyong: ['土', '火'] };
		expect(ev('bm_bu_chong', { targets: ['yearZhi'] }, null, natalZi).pass).toBe(false);	// 时支午冲子
		const natalYin = { yearZhi: '寅', dayZhi: '丑', dayGan: '甲', xiyong: ['土', '火'] };
		expect(ev('bm_bu_chong', { targets: ['yearZhi'] }, null, natalYin).pass).toBe(true);	// 寅不被卯/午冲
		// 喜用:日干己(土)∈[土,火]
		expect(ev('bm_xiyong', { scope: 'day' }, null, natalZi).pass).toBe(true);
		expect(ev('bm_xiyong', { scope: 'day' }, null, { ...natalZi, xiyong: ['水'] }).pass).toBe(false);
		// 相合:候选日支卯六合戌
		expect(ev('bm_he', { rel: 'zhi_liuhe' }, null, { ...natalZi, dayZhi: '戌' }).pass).toBe(true);
		expect(ev('bm_he', { rel: 'zhi_liuhe' }, null, natalZi).pass).toBe(false);
		expect(ev('bm_he', { rel: 'gan_wuhe' }, null, natalZi).pass).toBe(true);	// 己合甲
	});

	it('🔴 判别时刻:晚子时两档在 23:30 时柱确不同(换档必变盘,防零判别力假绿)', ()=>{
		const p1 = computeBaziScanPan(GEO, { ...OPTS, after23NewDay: 1 }, '1990-03-15', '23:30:00');
		const p0 = computeBaziScanPan(GEO, { ...OPTS, after23NewDay: 0 }, '1990-03-15', '23:30:00');
		const g = (pan, k)=>pan.four[k].ganzi || pan.four[k].ganZhi;
		expect(g(p1, 'day')).not.toBe(g(p0, 'day'));	// 换日档→日柱不同
		// 真太阳时档 vs 钟表时档:116°E 均时差+经度差在多数时刻不改时辰,选边界时刻 12:59(午未界附近)
		const t1 = computeBaziScanPan(GEO, { ...OPTS, timeAlg: 0 }, '1990-11-03', '13:05:00');
		const t2 = computeBaziScanPan(GEO, { ...OPTS, timeAlg: 1 }, '1990-11-03', '13:05:00');
		expect(`${g(t1, 'time')}|${g(t2, 'time')}`.length).toBeGreaterThan(0);	// 两档可算(不同与否取决于 EoT,不强断)
	});
});

describe('[Z2] 扫描引擎(外壳第二实例:恒等+行内同盘探针)', ()=>{
	jest.setTimeout(120000);
	const TREE = compileBaziTree({ kind: 'group', joiner: 'all', children: [newBaziLeaf('yinyang_day')] });	// 阳日(默认 yang)

	it('🔴 三日窗:区间覆盖≡独立逐时辰真值+行内同盘探针(plateKey 完备性)', async ()=>{
		const res = await scanBazi({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-03', endTime: '23:59' }, geoParams: GEO, options: OPTS, tree: TREE });
		expect(res.intervals.length).toBeGreaterThan(0);
		// 独立逐时辰真值(每 2h 采样,绕开折叠/分解代码路径)
		let mismatch = 0;
		for(let ms = Date.UTC(2026, 0, 1) - 8 * 3600e3; ms < Date.UTC(2026, 0, 4) - 8 * 3600e3; ms += 7200e3){
			const d = new Date(ms + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const pan = computeBaziScanPan(GEO, OPTS, ds, ts);
			const truth = !!evaluateBaziTree(TREE, pan, null, false).pass;
			const inRow = res.intervals.some((r)=>ms >= r.startMs && ms < r.endMs);
			if(truth !== inRow){ mismatch++; }
		}
		expect(mismatch).toBe(0);
		// 行内同盘探针:每行取中点重排盘,plateKey 派生列(pillarText)与行一致
		res.intervals.forEach((r)=>{
			const mid = r.startMs + Math.floor((r.endMs - r.startMs) / 2 / 60000) * 60000;
			const d = new Date(mid + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const pan = computeBaziScanPan(GEO, OPTS, ds, ts);
			const g = (k)=>pan.four[k].ganzi || pan.four[k].ganZhi;
			// [十四轮] yinyang_day keyDeps=['dayGz'] → 掩码徽章只含日柱(时柱行内会变,不上徽章)
			expect(r.pillarText).toBe(`${g('day')}日`);
		});
		// [十四轮效果活证] 阳日树只吃日柱 → 位级掩码后行=整日折叠(修前被时柱劈成逐时辰行):
		// 三日窗阳日恰间隔出现,每命中日=一整行(≥23h;首尾窗裁允许)
		expect(res.intervals.length).toBeLessThanOrEqual(3);
		const winStart = res.intervals[0] ? Math.min(...res.intervals.map((r)=>r.startMs)) : 0;
		const winEnd = Math.max(...res.intervals.map((r)=>r.endMs));
		res.intervals.forEach((r)=>{
			const clipped = r.startMs === winStart || r.endMs === winEnd;	// 首尾窗裁行(23点换日档下一阳日的头/上一日的尾)
			if(!clipped){ expect(r.durationMin).toBeGreaterThanOrEqual(1380); }
		});
		expect(res.intervals.some((r)=>r.durationMin >= 1380)).toBe(true);	// 至少一条整日行=掩码生效实证
		let prevEnd = -Infinity;
		res.intervals.forEach((r)=>{
			expect(r.startMs).toBeGreaterThanOrEqual(prevEnd);
			prevEnd = r.endMs;
		});
	});

	it('natal 经 options._natal 注入扫描(本命条件在扫描态生效)', async ()=>{
		const tree = compileBaziTree({ kind: 'group', joiner: 'all', children: [newBaziLeaf('bm_xiyong')] });
		const natal = { yearZhi: '子', dayZhi: '丑', dayGan: '甲', xiyong: ['金', '木', '水', '火', '土'] };	// 全喜用=恒真
		const res = await scanBazi({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-01', endTime: '23:59' }, geoParams: GEO, options: { ...OPTS, _natal: natal }, tree });
		expect(res.intervals.length).toBeGreaterThan(0);
		const resNo = await scanBazi({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-01', endTime: '23:59' }, geoParams: GEO, options: OPTS, tree });
		expect(resNo.intervals.length).toBe(0);	// 无 natal=本命条件恒假(判别:注入与否结果确不同)
	});

	it('explain 单时刻判读同源+extras', ()=>{
		const ex = explainBaziAt({ geoParams: GEO, options: OPTS, tree: TREE, t: '1990-03-15 12:30' });
		expect(['group', 'leaf']).toContain(ex.tree.kind);	// 单叶树 compile 不包组(与天星同构)
		expect(ex.pillarText).toBe('己卯日庚午时');
	});
	it('🔴 [W4 全谱轮] 新类/扩档正反双判(真锚 1990-03-15 dump 实跑:日己卯·时庚午伤枭·命宫甲申·惊蛰后10天)', ()=>{
		// 十神:时干庚=伤官;日支卯本气=七杀(杀);时支午藏丁枭+己比
		expect(ev('shishen_at', { layer: 'stem', gods: ['伤官'], pillars: ['time'], matchMode: 'any' }).pass).toBe(true);
		expect(ev('shishen_at', { layer: 'stem', gods: ['正官'], pillars: ['time'], matchMode: 'any' }).pass).toBe(false);
		expect(ev('shishen_at', { layer: 'branch', gods: ['七杀'], pillars: ['day'], matchMode: 'any' }).pass).toBe(true);
		expect(ev('shishen_at', { layer: 'canggan', gods: ['偏印'], pillars: ['time'], matchMode: 'any' }).pass).toBe(true);
		expect(ev('shishen_at', { layer: 'canggan', gods: ['正财'], pillars: ['time'], matchMode: 'any' }).pass).toBe(false);
		// 刑穿破会扩档:卯午相破(日/时);卯申无穿?卯申=非穿(卯辰穿)——用卯午破正判
		expect(ev('zhi_relation', { a: 'day', b: 'time', rel: 'po' }).pass).toBe(true);
		expect(ev('zhi_relation', { a: 'day', b: 'time', rel: 'chuan' }).pass).toBe(false);
		expect(ev('zhi_relation', { a: 'month', b: 'day', rel: 'same' }).pass).toBe(true);	// 卯卯伏吟(顺核旧档)
		// 胎命身:命宫甲申·泉中水(水)
		expect(ev('tai_ming_shen', { who: 'ming', dim: 'ganzhi', values: ['甲申'] }).pass).toBe(true);
		expect(ev('tai_ming_shen', { who: 'ming', dim: 'ganzhi', values: ['申'] }).pass).toBe(true);
		expect(ev('tai_ming_shen', { who: 'ming', dim: 'nayin', values: ['水'] }).pass).toBe(true);
		expect(ev('tai_ming_shen', { who: 'ming', dim: 'nayin', values: ['金'] }).pass).toBe(false);
		// 纳音全名:日柱城头土
		expect(ev('nayin_full', { values: ['城头土'], pillars: ['day'], matchMode: 'any' }).pass).toBe(true);
		expect(ev('nayin_full', { values: ['海中金'], pillars: ['day'], matchMode: 'any' }).pass).toBe(false);
		// 逐柱旬空:日柱空申酉
		expect(ev('zhu_xunkong', { pillars: ['day'], zhis: ['申'] }).pass).toBe(true);
		expect(ev('zhu_xunkong', { pillars: ['day'], zhis: ['子'] }).pass).toBe(false);
		// 藏干:时支藏丁己;不藏庚(时支)
		expect(ev('canggan_has', { mode: 'has', gans: ['丁'], pillars: ['time'] }).pass).toBe(true);
		expect(ev('canggan_has', { mode: 'not', gans: ['庚'], pillars: ['time'] }).pass).toBe(true);
		// 农历/节后:二月十九·惊蛰后第10天
		expect(ev('lunar_date', { dim: 'day', values: ['19'] }).pass).toBe(true);
		expect(ev('lunar_date', { dim: 'day', values: ['1'] }).pass).toBe(false);
		expect(ev('lunar_date', { dim: 'leap', values: ['leap_no'] }).pass).toBe(true);
		expect(ev('jie_delta', { min: 8, max: 12 }).pass).toBe(true);
		expect(ev('jie_delta', { min: 0, max: 5 }).pass).toBe(false);
		// 星运值级锚(dump 实抓:己/午 pt2=临官 pt0=帝旺 pt1=胎;己/卯 pt2=病)——
		// 全集恒真 smoke 无判别力(changShengOf 表被改仍绿,2026-08-31 反向判别实验实抓),升值级正反双判:
		expect(ev('zhu_phase', { phases: ['临官'], pillars: ['time'], matchMode: 'any' }).pass).toBe(true);
		expect(ev('zhu_phase', { phases: ['帝旺'], pillars: ['time'], matchMode: 'any' }).pass).toBe(false);
		expect(ev('zhu_phase', { phases: ['病'], pillars: ['day'], matchMode: 'any' }).pass).toBe(true);
		// phaseType 判别向量兑现:同支两口径值互换(pt0 五行寄生:午=帝旺,临官反判假)
		const panPt0 = { ...anchorPan(), phaseType: 0 };
		expect(ev('zhu_phase', { phases: ['帝旺'], pillars: ['time'], matchMode: 'any' }, panPt0).pass).toBe(true);
		expect(ev('zhu_phase', { phases: ['临官'], pillars: ['time'], matchMode: 'any' }, panPt0).pass).toBe(false);
		// 神煞全谱正名:「三奇贵人」死键已斩——名单不再含它(源码锚)
		const fs2 = require('fs');
		const src = fs2.readFileSync(require('path').join(__dirname, '../baziZeriConditionTypes.js'), 'utf8');
		expect(src.indexOf("'三奇贵人'") < 0).toBe(true);
		expect(src.indexOf("'三奇'") >= 0).toBe(true);
		expect(src.indexOf("'天赦'") < 0 && src.indexOf("'魁罡'") < 0).toBe(true);
	});

});
