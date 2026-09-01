// [Z3·太乙择日] 引擎+注册表金标。锚1=2026-01-01 12:30 +08:00 tn=0(阳遁六十七局,后端
// parity 同锚);判别纪律(定案19):tn 0/1 两档同刻局数 67≠19=判别时刻三层断言。
// 🔴 换日/晚子时/tenching 三参数对太乙判定面零效果(积数按绝对时辰序列,与日归属无关;
// 2026-08-28 dump 实证 23:30 两档同盘、00:30 与前夜 23:30 同盘)——工作台不设此三档,
// 若未来引擎改为消费日干支,此文件「绝对时辰不变量」用例会红,届时再议参数区。
import { TAIYI_CONDITION_TYPES, makeTaiyiZeriEvalCtx, compileTaiyiTree, newTaiyiLeaf, taiyiLeafSummary } from '../taiyiZeriConditionTypes';
import { computeTaiyiScanPan, evaluateTaiyiTree, scanTaiyi, explainTaiyiAt } from '../taiyiZeriScanEngine';

const GEO = { zone: '+08:00', ad: 1 };
const anchorPan = ()=>computeTaiyiScanPan(GEO, { tn: 0 }, '2026-01-01', '12:30:00');
const ev = (type, params, pan)=>{
	const p = pan || anchorPan();
	return TAIYI_CONDITION_TYPES[type].evaluate(p, params, makeTaiyiZeriEvalCtx(p));
};

describe('[Z3] 注册表契约+锚盘正反双判', ()=>{
	it('🔴 每类 spec 契约齐且 ≥16 类(jiyuan_is 已删:style=3 恒空串死开关)', ()=>{
		const keys = Object.keys(TAIYI_CONDITION_TYPES);
		expect(keys.length).toBeGreaterThanOrEqual(16);
		expect(keys).not.toContain('jiyuan_is');
		keys.forEach((k)=>{
			const s = TAIYI_CONDITION_TYPES[k];
			expect(typeof s.evaluate).toBe('function');
			expect(typeof s.summary(s.defaults)).toBe('string');
			expect(typeof s.category).toBe('string');
			expect(Array.isArray(s.fields)).toBe(true);
		});
	});

	it('🔴 锚1 判定面=后端 parity 同真值(此处红=本地引擎口径变,择日强制显影)', ()=>{
		const p = anchorPan();
		expect(p.kook.num).toBe(67);
		expect(p.taiyiPalace).toBe('子');
		expect(p.homeCal).toBe(25);
	});

	it('🔴 全 16 类正反双判(锚盘真值判真+扰动判假)', ()=>{
		expect(ev('yinyang_ju', { value: '阳' }).pass).toBe(true);
		expect(ev('yinyang_ju', { value: '阴' }).pass).toBe(false);
		expect(ev('ju_num', { values: ['67'] }).pass).toBe(true);
		expect(ev('ju_num', { values: ['19'] }).pass).toBe(false);
		expect(ev('taiyi_gong', { values: ['子'] }).pass).toBe(true);
		expect(ev('taiyi_gong', { values: ['午'] }).pass).toBe(false);
		expect(ev('wenchang_gong', { values: ['巽'] }).pass).toBe(true);
		expect(ev('wenchang_gong', { values: ['子'] }).pass).toBe(false);
		expect(ev('shiji_gong', { values: ['戌'] }).pass).toBe(true);
		expect(ev('shiji_gong', { values: ['子'] }).pass).toBe(false);
		expect(ev('jishen_gong', { who: 'jigod', values: ['申'] }).pass).toBe(true);
		expect(ev('jishen_gong', { who: 'hegod', values: ['未'] }).pass).toBe(true);
		expect(ev('jishen_gong', { who: 'jigod', values: ['子'] }).pass).toBe(false);
		expect(ev('youshen_gong', { who: 'wufuNum', values: ['1'] }).pass).toBe(true);
		expect(ev('youshen_gong', { who: 'wufuNum', values: ['9'] }).pass).toBe(false);
		expect(ev('youshen_gong', { who: 'bigyoNum', values: ['4'] }).pass).toBe(true);
		expect(ev('youshen_gong', { who: 'smyoNum', values: ['3'] }).pass).toBe(true);
		// 格局:锚1 净局(computeGeju=[]);without 全集=真、with 全集=假
		const ALLK = ['yan', 'po', 'guan', 'qiu', 'ge', 'dui', 'ti', 'xie', 'ji'];
		expect(ev('geju_kind', { values: ALLK, mode: 'with' }).pass).toBe(false);
		expect(ev('geju_kind', { values: ALLK, mode: 'without' }).pass).toBe(true);
		// 胜负:锚1 主算25>客算2=主胜(computeVictory 同函数)
		expect(ev('victory_side', { value: 'home' }).pass).toBe(true);
	});

	it('🔴 [W1 全谱轮] 8 新类+3 扩档正反双判(锚盘真值 dump 实跑取得,非手推)', ()=>{
		// 数理:主算25=无门·主大灾+长数;定算26=重阴数…;前缀匹配不误中子类
		expect(ev('shuli_kind', { suan: 'home', kinds: ['无门'] }).pass).toBe(true);
		expect(ev('shuli_kind', { suan: 'home', kinds: ['重阳数'] }).pass).toBe(false);
		expect(ev('shuli_kind', { suan: 'set', kinds: ['重阴数'] }).pass).toBe(true);
		// 五福算1 含「阴中重阳」——选「重阳数」必须不误中(前缀锚判别向量)
		expect(ev('shensuan_kind', { who: '五福算', kinds: ['阴中重阳'] }).pass).toBe(true);
		expect(ev('shensuan_kind', { who: '五福算', kinds: ['重阳数'] }).pass).toBe(false);
		expect(ev('shensuan_kind', { who: '君基算', kinds: ['下和数'] }).pass).toBe(true);
		// 厄会:主算无门厄+定算重阴厄
		expect(ev('ehui_has', { suan: 'any', kinds: ['无门厄'] }).pass).toBe(true);
		expect(ev('ehui_has', { suan: '主算', kinds: ['无门厄'] }).pass).toBe(true);
		expect(ev('ehui_has', { suan: '客算', kinds: ['无门厄'] }).pass).toBe(false);
		expect(ev('ehui_has', { suan: 'any', kinds: ['重阳厄'] }).pass).toBe(false);
		// 十精:客参将酉/主大将中
		expect(ev('shijing_gong', { who: '客参将', values: ['酉'] }).pass).toBe(true);
		expect(ev('shijing_gong', { who: '主大将', values: ['中'] }).pass).toBe(true);
		expect(ev('shijing_gong', { who: '客参将', values: ['子'] }).pass).toBe(false);
		// 分野:太乙8宫=坎/水门/兖州/易气;始击非正宫=无分野判否
		expect(ev('fenye_info', { who: 'taiyi', dim: 'gua', values: ['坎'] }).pass).toBe(true);
		expect(ev('fenye_info', { who: 'taiyi', dim: 'zhou', values: ['兖州'] }).pass).toBe(true);
		expect(ev('fenye_info', { who: 'taiyi', dim: 'qi', values: ['绝阳'] }).pass).toBe(false);
		expect(ev('fenye_info', { who: 'shiji', dim: 'gua', values: ['坎'] }).pass).toBe(false);
		// 三元/五子元:锚盘 sanyuan 空(style=3 无纪元)判否;五子元=丙子元
		expect(ev('sanyuan_wuziyuan', { dim: 'wuziyuan', wz: ['丙子元'] }).pass).toBe(true);
		expect(ev('sanyuan_wuziyuan', { dim: 'wuziyuan', wz: ['甲子元'] }).pass).toBe(false);
		expect(ev('sanyuan_wuziyuan', { dim: 'sanyuan', sy: ['上元', '中元', '下元'] }).pass).toBe(false);
		// 纳音:时柱壬午杨柳木
		expect(ev('nayin_taiyi', { values: ['木'] }).pass).toBe(true);
		expect(ev('nayin_taiyi', { values: ['金'] }).pass).toBe(false);
		// 诸神落位:定目辰/太岁午/帝符亥/飞鸟艮
		expect(ev('god_gong', { who: 'se', values: ['辰'] }).pass).toBe(true);
		expect(ev('god_gong', { who: 'kingfu', values: ['亥'] }).pass).toBe(true);
		expect(ev('god_gong', { who: 'flybird', values: ['艮'] }).pass).toBe(true);
		expect(ev('god_gong', { who: 'se', values: ['子'] }).pass).toBe(false);
		// 扩档:参将(主参=5宫)/风三游/branch12 盘面(丑支有直符,十六宫盘丑无)
		expect(ev('dajiang_gong', { who: 'homeVGen', values: ['5'] }).pass).toBe(true);
		expect(ev('dajiang_gong', { who: 'awayVGen', values: ['6'] }).pass).toBe(true);
		const p = anchorPan();
		expect(ev('youshen_gong', { who: 'threewindNum', values: [`${p.threewindNum}`] }).pass).toBe(true);
		expect(ev('youshen_gong', { who: 'threewindNum', values: [`${(Number(p.threewindNum) % 9) + 1}`] }).pass).toBe(false);
		expect(ev('gong16_has', { board: 'branch12', gong: '丑', names: ['直符'] }).pass).toBe(true);
		expect(ev('gong16_has', { board: 'branch12', gong: '子', names: ['直符'] }).pass).toBe(false);
		expect(ev('victory_side', { value: 'away' }).pass).toBe(false);
		expect(ev('victory_side', { value: 'home' }).actual).toContain('主');
		// 算数:主25客2定26
		expect(ev('suan_range', { who: 'homeCal', min: 25, max: 25 }).pass).toBe(true);
		expect(ev('suan_range', { who: 'homeCal', min: 1, max: 24 }).pass).toBe(false);
		expect(ev('suan_range', { who: 'awayCal', min: 2, max: 2 }).pass).toBe(true);
		expect(ev('suan_range', { who: 'setCal', min: 26, max: 26 }).pass).toBe(true);
		expect(ev('suan_parity', { who: 'homeCal', value: 'odd' }).pass).toBe(true);
		expect(ev('suan_parity', { who: 'homeCal', value: 'even' }).pass).toBe(false);
		expect(ev('suan_parity', { who: 'awayCal', value: 'even' }).pass).toBe(true);
		// 大将:主5客2定6
		expect(ev('dajiang_gong', { who: 'homeGeneral', values: ['5'] }).pass).toBe(true);
		expect(ev('dajiang_gong', { who: 'homeGeneral', values: ['9'] }).pass).toBe(false);
		expect(ev('dajiang_gong', { who: 'awayGeneral', values: ['2'] }).pass).toBe(true);
		expect(ev('dajiang_gong', { who: 'setGeneral', values: ['6'] }).pass).toBe(true);
		expect(ev('dajiang_same', { rel: 'zhu_ke_same' }).pass).toBe(false);	// 5≠2
		expect(ev('dajiang_same', { rel: 'zhu_taiyi_same' }).pass).toBe(false);	// 5≠太乙数8
		// 十六宫布神:太乙落子
		expect(ev('gong16_has', { gong: '子', names: ['太乙'] }).pass).toBe(true);
		expect(ev('gong16_has', { gong: '子', names: ['文昌'] }).pass).toBe(false);
		expect(ev('gong16_has', { gong: '子', names: [] }).pass).toBe(true);
		// 门户:太乙临子=正宫
		expect(ev('sanji_men', { mode: 'zheng', values: [] }).pass).toBe(true);
		expect(ev('sanji_men', { mode: 'men', values: [] }).pass).toBe(false);
		expect(ev('sanji_men', { mode: 'zheng', values: ['子'] }).pass).toBe(true);
		expect(ev('sanji_men', { mode: 'zheng', values: ['午'] }).pass).toBe(false);
		// 位置关系:锚1 文昌巽(6)·太乙子(0)差6=三关系全假
		expect(ev('wenchang_taiyi_rel', { who: 'skyeyes', rel: 'same' }).pass).toBe(false);
		expect(ev('wenchang_taiyi_rel', { who: 'skyeyes', rel: 'opposite' }).pass).toBe(false);
		expect(ev('wenchang_taiyi_rel', { who: 'skyeyes', rel: 'adjacent' }).pass).toBe(false);
	});

	it('🔴 锚2/锚4 格局与关系类真判(po 格·主将同太乙·文昌邻太乙)', ()=>{
		const p2 = computeTaiyiScanPan(GEO, { tn: 0 }, '2026-07-01', '09:30:00');	// 文昌巳邻太乙午
		expect(ev('geju_kind', { values: ['po'], mode: 'with' }, p2).pass).toBe(true);
		expect(ev('geju_kind', { values: ['po'], mode: 'without' }, p2).pass).toBe(false);
		expect(ev('wenchang_taiyi_rel', { who: 'skyeyes', rel: 'adjacent' }, p2).pass).toBe(true);
		const p4 = computeTaiyiScanPan(GEO, { tn: 1 }, '2026-01-01', '12:30:00');	// 主将8=太乙数8
		expect(ev('dajiang_same', { rel: 'zhu_taiyi_same' }, p4).pass).toBe(true);
	});

	it('🔴 判别时刻三层断言:tn 0/1 同刻局数 67/19 各对且确不同(定案19)', ()=>{
		const p0 = computeTaiyiScanPan(GEO, { tn: 0 }, '2026-01-01', '12:30:00');
		const p1 = computeTaiyiScanPan(GEO, { tn: 1 }, '2026-01-01', '12:30:00');
		expect(p0.kook.num).toBe(67);	// ①默认档值对
		expect(p1.kook.num).toBe(19);	// ②非默认档值对
		expect(p0.kook.num).not.toBe(p1.kook.num);	// ③确不同
	});

	it('🔴 绝对时辰不变量:换日参数两档同盘+跨日同子时同盘(三死档不入参数区的证据锚)', ()=>{
		const vec = (x)=>[x.kook.text, x.taiyiPalace, x.homeCal, x.awayCal, x.setCal].join('|');
		const a = computeTaiyiScanPan(GEO, { tn: 0, after23NewDay: 0, lateZiHourUseNextDay: 0 }, '2026-01-01', '23:30:00');
		const b = computeTaiyiScanPan(GEO, { tn: 0, after23NewDay: 1, lateZiHourUseNextDay: 1 }, '2026-01-01', '23:30:00');
		const c = computeTaiyiScanPan(GEO, { tn: 0 }, '2026-01-02', '00:30:00');
		expect(vec(a)).toBe(vec(b));
		expect(vec(a)).toBe(vec(c));
	});

	it('树工厂/编译:默认叶+validate 抓空 values+摘要非空', ()=>{
		const leaf = newTaiyiLeaf('taiyi_gong');
		expect(leaf.params.values).toEqual(['子']);
		expect(taiyiLeafSummary(leaf)).toContain('太乙');
		expect(()=>compileTaiyiTree({ kind: 'group', joiner: 'all', children: [{ kind: 'leaf', type: 'ju_num', joiner: 'all', params: { values: [] } }] })).toThrow();
	});
});

describe('[Z3] 扫描引擎(外壳第三实例:恒等+行内同盘探针)', ()=>{
	jest.setTimeout(120000);
	const OPTS = { tn: 0 };
	const TREE = compileTaiyiTree({ kind: 'group', joiner: 'all', children: [newTaiyiLeaf('suan_parity')] });	// 主算奇(逐时辰变,有真有假)

	it('🔴 三日窗:区间覆盖≡独立逐时辰真值+行内同盘探针(plateKey 完备性)', async ()=>{
		const res = await scanTaiyi({ cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-03', endTime: '23:59' }, geoParams: GEO, options: OPTS, tree: TREE });
		expect(res.intervals.length).toBeGreaterThan(0);
		let mismatch = 0;
		let truths = 0;
		for(let ms = Date.UTC(2026, 0, 1) - 8 * 3600e3; ms < Date.UTC(2026, 0, 4) - 8 * 3600e3; ms += 7200e3){
			const d = new Date(ms + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const p = computeTaiyiScanPan(GEO, OPTS, ds, ts);
			const truth = !!evaluateTaiyiTree(TREE, p, null, false).pass;
			if(truth){ truths++; }
			const inRow = res.intervals.some((r)=>ms >= r.startMs && ms < r.endMs);
			if(truth !== inRow){ mismatch++; }
		}
		expect(mismatch).toBe(0);
		expect(truths).toBeGreaterThan(0);	// 树有判别力(非恒假)
		expect(truths).toBeLessThan(36);	// 亦非恒真
		// 行内同盘探针:每行中点重排盘,plateKey 派生列与行一致
		res.intervals.forEach((r)=>{
			const mid = r.startMs + Math.floor((r.endMs - r.startMs) / 2 / 60000) * 60000;
			const d = new Date(mid + 8 * 3600e3);
			const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
			const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
			const p = computeTaiyiScanPan(GEO, OPTS, ds, ts);
			expect(r.juText).toBe(p.kook.text);
			expect(r.taiyiText).toBe(`太乙${p.taiyiPalace}宫`);
		});
		let prevEnd = -Infinity;
		res.intervals.forEach((r)=>{
			expect(r.startMs).toBeGreaterThanOrEqual(prevEnd);
			prevEnd = r.endMs;
		});
	});

	it('explain 单时刻判读同源+extras', ()=>{
		const ex = explainTaiyiAt({ geoParams: GEO, options: OPTS, tree: TREE, t: '2026-01-01 12:30' });
		expect(['group', 'leaf']).toContain(ex.tree.kind);
		expect(ex.juText).toBe('阳遁六十七局');
		expect(ex.taiyiText).toBe('太乙子宫');
	});
});
