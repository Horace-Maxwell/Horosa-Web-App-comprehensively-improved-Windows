// [Z1·黄历择日] 引擎+注册表金标。冻结基线锚=2026-01-01(乙亥/建除闭/朱雀黑道/井宿吉/大安/
// 渐盈凸/九星三/冲蛇/农历十三/周四/山头火/吉时7)与 2026-02-04(立春 04:02:08/己酉/危)——
// 真值经 buildHuangliDay 实跑采集后钉死(判定单源=老黄历卡同函数,主算法改此处红=制度层2)。
// 判别纪律(用户定案19):锚日刻意选「各条件类在此判真/判假可区分」的日子,正反双锚。
import { HUANGLI_CONDITION_TYPES, makeHuangliZeriEvalCtx, GROUP_TYPES } from '../huangliZeriConditionTypes';
import { scanHuangli, explainHuangliAt, evaluateHuangliTree } from '../huangliZeriScanEngine';
import { buildHuangliDay } from '../../../components/calendar/huangliDay';

const D1 = ()=>buildHuangliDay(2026, 1, 1);
const leaf = (type, params)=>({ type, params });
const ev = (type, params, day)=>HUANGLI_CONDITION_TYPES[type].evaluate(day || D1(), params, makeHuangliZeriEvalCtx(day || D1()));

describe('[Z1] 注册表契约', ()=>{
	it('🔴 每类 spec 五件齐(category/label/defaults/fields/evaluate)且 summary/validate 可调', ()=>{
		const keys = Object.keys(HUANGLI_CONDITION_TYPES);
		expect(keys.length).toBeGreaterThanOrEqual(17);
		keys.forEach((k)=>{
			const s = HUANGLI_CONDITION_TYPES[k];
			expect(typeof s.category).toBe('string');
			expect(typeof s.label).toBe('string');
			expect(s.defaults && typeof s.defaults).toBe('object');
			expect(Array.isArray(s.fields)).toBe(true);
			expect(typeof s.evaluate).toBe('function');
			expect(typeof s.summary(s.defaults)).toBe('string');
			if(s.validate){ expect(typeof s.validate(s.defaults)).toBe('string'); }
		});
	});

	it('值域同源非空(建除12/黄黑道值神12/宿28/六曜6/生肖12/用事词表>50)', ()=>{
		const { JIANCHU_NAMES, TIANSHEN_NAMES, XIU_NAMES, LIUYAO_NAMES, SHENGXIAO_NAMES, HUANGLI_TERM_OPTIONS } = require('../huangliZeriConditionTypes');
		expect(JIANCHU_NAMES.length).toBe(12);
		expect(TIANSHEN_NAMES.length).toBe(12);
		expect(XIU_NAMES.length).toBe(28);
		expect(LIUYAO_NAMES.length).toBe(6);
		expect(SHENGXIAO_NAMES.length).toBe(12);
		expect(HUANGLI_TERM_OPTIONS.length).toBeGreaterThan(50);
	});

	it('GROUP_TYPES 复用天星单源(树语义同构)', ()=>{
		expect(GROUP_TYPES.length).toBeGreaterThanOrEqual(3);
	});
});

describe('[Z1] 冻结基线锚 2026-01-01(正反双判,判别纪律)', ()=>{
	it('🔴 17 类逐一:真值判真+扰动值判假(零判别力假绿防御)', ()=>{
		// 用事
		expect(ev('yi_has', { values: ['入宅'], matchMode: 'any' }).pass).toBe(true);
		expect(ev('yi_has', { values: ['安葬'], matchMode: 'any' }).pass).toBe(false);
		expect(ev('ji_not', { values: ['嫁娶'], mode: 'without' }).pass).toBe(false);	// 当日忌嫁娶→净日判假
		expect(ev('ji_not', { values: ['祭祀'], mode: 'without' }).pass).toBe(true);
		// 神煞
		expect(ev('jianchu', { values: ['闭'] }).pass).toBe(true);
		expect(ev('jianchu', { values: ['成'] }).pass).toBe(false);
		expect(ev('tianshen_dao', { dao: '黑道', values: [] }).pass).toBe(true);
		expect(ev('tianshen_dao', { dao: '黄道', values: [] }).pass).toBe(false);
		expect(ev('tianshen_dao', { dao: '', values: ['朱雀'] }).pass).toBe(true);
		expect(ev('zhixiu', { values: ['井'], luck: '' }).pass).toBe(true);
		expect(ev('zhixiu', { values: [], luck: '吉' }).pass).toBe(true);
		expect(ev('zhixiu', { values: ['角'], luck: '' }).pass).toBe(false);
		expect(ev('jishen_has', { values: ['四相'], matchMode: 'any' }).pass).toBe(true);
		expect(ev('jishen_has', { values: ['天德'], matchMode: 'any' }).pass).toBe(false);
		expect(ev('xiongsha_not', { values: ['血支'], mode: 'with' }).pass).toBe(true);
		expect(ev('xiongsha_not', { values: ['血支'], mode: 'without' }).pass).toBe(false);
		expect(ev('xiongsha_not', { values: ['月破'], mode: 'without' }).pass).toBe(true);
		expect(ev('nine_star', { values: ['三'] }).pass).toBe(true);
		expect(ev('nine_star', { values: ['九'] }).pass).toBe(false);
		expect(ev('chong_shengxiao', { values: ['蛇'], mode: 'without' }).pass).toBe(false);	// 当日冲蛇
		expect(ev('chong_shengxiao', { values: ['马'], mode: 'without' }).pass).toBe(true);
		expect(ev('chong_shengxiao', { values: ['蛇'], mode: 'with' }).pass).toBe(true);
		// 历法
		expect(ev('day_ganzhi', { values: ['乙亥'] }).pass).toBe(true);
		expect(ev('day_ganzhi', { values: ['乙'] }).pass).toBe(true);	// 单字=判干
		expect(ev('day_ganzhi', { values: ['亥'] }).pass).toBe(true);	// 单字=判支
		expect(ev('day_ganzhi', { values: ['甲子'] }).pass).toBe(false);
		expect(ev('nayin_wuxing', { values: ['火'] }).pass).toBe(true);	// 山头火
		expect(ev('nayin_wuxing', { values: ['金'] }).pass).toBe(false);
		expect(ev('liuyao', { values: ['大安'] }).pass).toBe(true);
		expect(ev('liuyao', { values: ['赤口'] }).pass).toBe(false);
		expect(ev('yuexiang', { values: ['渐盈凸'] }).pass).toBe(true);
		expect(ev('yuexiang', { values: ['望'] }).pass).toBe(false);
		expect(ev('lunar_day', { values: ['十三'] }).pass).toBe(true);
		expect(ev('lunar_day', { values: ['初一'] }).pass).toBe(false);
		expect(ev('week_day', { values: ['四'] }).pass).toBe(true);
		expect(ev('week_day', { values: ['六', '日'] }).pass).toBe(false);
		// 节气(2026-01-01 非交节;2026-02-04 立春)
		expect(ev('jieqi_day', { mode: 'not', values: [] }).pass).toBe(true);
		const d204 = buildHuangliDay(2026, 2, 4);
		expect(ev('jieqi_day', { mode: 'is', values: ['立春'] }, d204).pass).toBe(true);
		expect(ev('jieqi_day', { mode: 'is', values: ['冬至'] }, d204).pass).toBe(false);
		// 时辰
		expect(ev('good_hour', { zhis: [], minCount: 7 }).pass).toBe(true);
		expect(ev('good_hour', { zhis: [], minCount: 8 }).pass).toBe(false);
	});
});

describe('[Z1] 扫描引擎(区间覆盖≡逐日真值恒等,Stress 范式)', ()=>{
	const TREE = { type: 'all', conditions: [leaf('tianshen_dao', { dao: '黄道', values: [] })] };

	it('🔴 一月窗:扫描区间覆盖 ≡ 独立逐日真值(绕开合并/边界代码路径)', async ()=>{
		const res = await scanHuangli({ cfg: { startDate: '2026-01-01', endDate: '2026-01-31' }, tree: TREE });
		const inRow = (ord)=>res.intervals.some((r)=>ord >= r.startOrd && ord <= r.endOrd);
		let mismatch = 0;
		for(let d = 1; d <= 31; d++){
			const day = buildHuangliDay(2026, 1, d);
			const truth = !!evaluateHuangliTree(TREE, day, null, false).pass;
			const base = Date.UTC(2026, 0, d) / 86400e3;
			if(truth !== inRow(base)){ mismatch++; }
		}
		expect(mismatch).toBe(0);
		expect(res.stats.samples).toBe(31);
		// 黄道/黑道约各半,一月窗两态必然都出现(区间数>0 且未全月一行)
		expect(res.intervals.length).toBeGreaterThan(0);
		expect(res.intervals.length).toBeLessThan(31);
	});

	it('行良构:排序不重叠/天数自洽/pick=起日正午;连续命中日并行', async ()=>{
		const res = await scanHuangli({ cfg: { startDate: '2026-01-01', endDate: '2026-03-31' }, tree: TREE });
		let prevEnd = -Infinity;
		res.intervals.forEach((r)=>{
			expect(r.startOrd).toBeGreaterThan(prevEnd);
			prevEnd = r.endOrd;
			expect(r.days).toBe(r.endOrd - r.startOrd + 1);
			expect(r.pick).toBe(`${r.start} 12:00:00`);
			expect(r.badge.length).toBeGreaterThan(0);
		});
	});

	it('上限/终止/取消:maxHits 截断+truncated;AbortSignal 抛 AbortError;非法范围报错', async ()=>{
		const res = await scanHuangli({ cfg: { startDate: '2026-01-01', endDate: '2026-12-31' }, tree: TREE, limits: { maxHits: 3 } });
		expect(res.intervals.length).toBeLessThanOrEqual(3);
		expect(res.truncated).toBe(true);
		const ctl = { aborted: true };
		await expect(scanHuangli({ cfg: { startDate: '2026-01-01', endDate: '2026-01-02' }, tree: TREE, signal: ctl })).rejects.toThrow('aborted');
		await expect(scanHuangli({ cfg: { startDate: '2026-02-01', endDate: '2026-01-01' }, tree: TREE })).rejects.toThrow('时间范围无效');
	});

	it('explain:叶序 DFS 先序+actual 实测文本;组合树 any/not 语义', async ()=>{
		const tree = { type: 'any', conditions: [leaf('jianchu', { values: ['成'] }), leaf('liuyao', { values: ['大安'] })] };
		const ex = explainHuangliAt({ tree, t: '2026-01-01' });
		expect(ex.tree.kind).toBe('group');
		expect(ex.tree.op).toBe('any');
		expect(ex.tree.pass).toBe(true);	// 大安命中
		expect(ex.tree.children[0].pass).toBe(false);	// 建除闭≠成
		expect(ex.tree.children[1].actual).toContain('大安');
		expect(ex.badge).toContain('闭日');
		const notTree = { type: 'not', conditions: [leaf('jianchu', { values: ['闭'] })] };
		expect(evaluateHuangliTree(notTree, D1(), null, false).pass).toBe(false);
	});

	it('注错自证:锚值改错必红(基线锚判别力)', ()=>{
		expect(ev('day_ganzhi', { values: ['乙亥'] }).pass).not.toBe(false);
		expect(D1().lunar.dayGZ).toBe('乙亥');
		expect(buildHuangliDay(2026, 2, 4).lunar.jieqiTime).toBe('2026-02-04 04:02:08');
	});
	it('🔴 [W6 全谱轮] 9 新类正反双判(锚日 2026-01-01 dump 实跑:子时白虎宜祭祀·董公煞贡吉·乌兔金星吉·嫁娶=忌·月柱戊子·井宿南朱雀木值犴·煞西)', ()=>{
		const day = D1();
		const ev = (type, params)=>HUANGLI_CONDITION_TYPES[type].evaluate(day, params, makeHuangliZeriEvalCtx(day));
		// 时辰宜忌:子时宜祭祀;限定丑时则须实跑(不锚)——用子时正反
		expect(ev('hour_yiji', { mode: 'yi', terms: ['祭祀'], hours: ['子'] }).pass).toBe(true);
		expect(ev('hour_yiji', { mode: 'yi', terms: ['上梁'], hours: ['子'] }).pass).toBe(false);
		expect(ev('hour_yiji', { mode: 'ji', terms: ['上梁'], hours: ['子'] }).pass).toBe(true);
		// 时辰值神/冲/煞:子时白虎·冲午·煞南
		expect(ev('hour_shen', { dim: 'tianshen', values: ['白虎'], hours: ['子'] }).pass).toBe(true);
		expect(ev('hour_shen', { dim: 'tianshen', values: ['青龙'], hours: ['子'] }).pass).toBe(false);
		expect(ev('hour_shen', { dim: 'chong', values: ['午'], hours: ['子'] }).pass).toBe(true);
		expect(ev('hour_shen', { dim: 'sha', values: ['煞南'], hours: ['子'] }).pass).toBe(true);
		// 通书:董公 good(煞贡)/乌兔 good(金星)/三垣空/叠数玄空有吉时
		expect(ev('tongshu_verdict', { school: 'donggong', want: ['good'] }).pass).toBe(true);
		expect(ev('tongshu_verdict', { school: 'donggong', want: ['bad'] }).pass).toBe(false);
		expect(ev('tongshu_verdict', { school: 'wutu', want: ['good'] }).pass).toBe(true);
		expect(ev('tongshu_star', { school: 'donggong', names: ['煞贡'] }).pass).toBe(true);
		expect(ev('tongshu_star', { school: 'donggong', names: ['直星'] }).pass).toBe(false);
		expect(ev('tongshu_star', { school: 'sanyuan', names: ['任意'] }).pass).toBe(false);
		expect(ev('tongshu_hours', { school: 'dieshu' }).pass).toBe(true);
		expect(ev('tongshu_hours', { school: 'xuankong' }).pass).toBe(true);
		// 用事裁决:嫁娶=忌
		expect(ev('yongshi_verdict', { event: '嫁娶', want: ['ji'] }).pass).toBe(true);
		expect(ev('yongshi_verdict', { event: '嫁娶', want: ['yi'] }).pass).toBe(false);
		// 月/年干支·生肖:月戊子(单字戊/子都中)·年乙巳·蛇
		expect(ev('month_year_info', { dim: 'monthgz', values: ['戊子'] }).pass).toBe(true);
		expect(ev('month_year_info', { dim: 'monthgz', values: ['子'] }).pass).toBe(true);
		expect(ev('month_year_info', { dim: 'monthgz', values: ['甲午'] }).pass).toBe(false);
		expect(ev('month_year_info', { dim: 'shengxiao', values: ['蛇'] }).pass).toBe(true);
		// 宿细面:井宿南朱雀·木值·禽犴
		expect(ev('xiu_detail', { dim: 'xiang', values: ['南朱雀'] }).pass).toBe(true);
		expect(ev('xiu_detail', { dim: 'xiang', values: ['东青龙'] }).pass).toBe(false);
		expect(ev('xiu_detail', { dim: 'zheng', values: ['木'] }).pass).toBe(true);
		expect(ev('xiu_detail', { dim: 'animal', values: ['犴'] }).pass).toBe(true);
		// 煞方/彭祖:日煞西;彭祖亥不嫁娶(支忌含「亥」)
		expect(ev('sha_fang_pengzu', { dim: 'sha', values: ['煞西'] }).pass).toBe(true);
		expect(ev('sha_fang_pengzu', { dim: 'sha', values: ['煞东'] }).pass).toBe(false);
		expect(ev('sha_fang_pengzu', { dim: 'pengzu_zhi', values: ['亥'] }).pass).toBe(true);
	});

});
