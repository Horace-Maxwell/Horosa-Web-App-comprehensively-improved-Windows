// 干支年基准（立春界）与参评大运排法 —— 金标 + 接线锁（2026-07-31 用户实测三案制度化）。
//
// 病灶回顾：术数技法的「第 N 岁流年」以**干支年**为基准，立春前出生者的公历年已跨、干支年未跨；
// 直接拿出生公历年当 base 会让流年整体错一位（河洛 2026-01-31 命例：年柱乙巳，旧算首年给丙午）。
// 同一条旧公式 (y-4)%10 早被 reportTimeAnchor.test.js 钉死过，但河洛/参评两条链没吃到那次修。
import fs from 'fs';
import path from 'path';
import { ganzhiYearBase, ganzhiOfSolarYear } from '../ganzhiYearBase';
import {
	calculate as canpingCalculate,
	liunianSeries as canpingLiunian,
	qiyunFromLunarDate,
	CANPING_DAYUN_RULES,
} from '../canpingLocal';

const SRC = path.resolve(__dirname, '..', '..');
const stripComments = (t) => t.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('干支年基准（立春界）', () => {
	it('立春后出生：干支年 === 出生公历年（零回归）', () => {
		// 1990-02-15 立春(2/4)后 → 年柱庚午 === 1990 干支
		expect(ganzhiOfSolarYear(1990)).toBe('庚午');
		expect(ganzhiYearBase(1990, '庚午')).toBe(1990);
	});

	it('🔴 立春前出生：干支年 = 公历年 - 1（用户实测命例 2026-01-31 → 乙巳/2025）', () => {
		expect(ganzhiOfSolarYear(2026)).toBe('丙午');   // 旧公式给的（错）
		expect(ganzhiOfSolarYear(2025)).toBe('乙巳');   // 年柱真值
		expect(ganzhiYearBase(2026, '乙巳')).toBe(2025);
	});

	it('年柱缺失/异常 → 原样返回（绝不抛、退回旧行为）', () => {
		expect(ganzhiYearBase(2026, '')).toBe(2026);
		expect(ganzhiYearBase(2026, '不存在')).toBe(2026);
		expect(ganzhiYearBase(0, '乙巳')).toBe(0);
	});

	it('接线锁：河洛/参评/AI 挂载三处 birthYear 必须经 ganzhiYearBase（不许再裸用公历年）', () => {
		[
			'components/shusuan/HeLuoMain.js',
			'components/shusuan/CanPingMain.js',
			'utils/aiAnalysisContext.js',
		].forEach((rel) => {
			const t = stripComments(read(rel));
			expect(t.includes('ganzhiYearBase(')).toBe(true);
			// 不许再有「裸 parseYearFromDateStr 直接当 birthYear」的写法
			expect(/birthYear[^\n]*=\s*parseYearFromDateStr\([^)]*\)\s*\|\|\s*0\s*[,;]/.test(t)).toBe(false);
			expect(/birthYear:\s*parseYearFromDateStr\([^)]*\)\s*\|\|\s*0\s*,/.test(t)).toBe(false);
		});
	});
});

describe('参评数：性别接线（死开关锁）', () => {
	it('宿主必须下发 gender，组件必须 props 优先', () => {
		const host = stripComments(read('components/kinastro/KinAstroMain.js'));
		expect((host.match(/<CanPingMain[^>]*gender=\{this\.state\.gender\}/g) || []).length).toBe(2);
		expect((host.match(/<ZhengChuanMain[^>]*gender=\{this\.state\.gender\}/g) || []).length).toBe(2);
		['components/shusuan/CanPingMain.js', 'components/shusuan/ZhengChuanMain.js'].forEach((rel) => {
			expect(stripComments(read(rel)).includes('this.props.gender !== undefined')).toBe(true);
		});
	});

	it('引擎按性别换条文层（男命上层洞门 / 女命中层闺门）', () => {
		const base = { yearGz: '丙申', monthBranch: '申', dayBranch: '午', hourBranch: '午' };
		const male = canpingCalculate({ ...base, gender: '男' });
		const female = canpingCalculate({ ...base, gender: '女' });
		expect(male.kindMain).toBe('male');
		expect(female.kindMain).toBe('female');
		const mv = male.benming.verses;
		const fv = female.benming.verses;
		expect(mv.numShun).toBe(fv.numShun);                 // 数相同
		expect(mv.textShun === fv.textShun && mv.textNi === fv.textNi).toBe(false);   // 条文必不同
	});

	it('快照文本带出性别取层（AI 侧看得出取了哪一层）', () => {
		const { buildSnapshotText } = require('../canpingLocal');
		const r = canpingCalculate({ yearGz: '丙申', monthBranch: '申', dayBranch: '午', hourBranch: '午', gender: '女' });
		expect(buildSnapshotText(r)).toContain('女命（中层闺门）');
	});

	it('快照去重键含 gender 与 opts（改性别/换档必刷新）', () => {
		const t = stripComments(read('components/shusuan/CanPingMain.js'));
		expect(/const key = `[^`]*g:\$\{r\.gender\}[^`]*o:/.test(t)).toBe(true);
	});
});

describe('参评数：大运排法三档', () => {
	it('起运岁按《参评诀》推算——蔡英文例 农历七月廿六 → 1岁8个月、自 2 岁行运', () => {
		const q = qiyunFromLunarDate(7, 26);   // 单月：30 逆数至 26 得 5；5÷3 = 1 余 2
		expect(q.count).toBe(5);
		expect(q.years).toBe(1);
		expect(q.months).toBe(8);
		expect(q.startAge).toBe(2);
	});

	it('双月由初一顺数（口径对偶）+ 农历缺失退回一岁', () => {
		expect(qiyunFromLunarDate(8, 26).count).toBe(26);
		expect(qiyunFromLunarDate(0, 0).usable).toBe(false);
		expect(qiyunFromLunarDate(0, 0).startAge).toBe(1);
	});

	it('🔴 默认档金标：命宫寅、大运 2-11 / 12-21 / 22-31（资料②逐字）', () => {
		// 蔡英文 1956-08-31：丙申年·申月·午日·午时，农历七月廿六
		const r = canpingCalculate({
			yearGz: '丙申', monthBranch: '申', dayBranch: '午', hourBranch: '午',
			gender: '女', method: 'ming', lunarMonth: 7, lunarDay: 26,
		});
		expect(r.dayunRule).toBe('mingGongQiyun');
		expect(r.mingGong).toBe('寅');
		expect(r.qiyunAge).toBe(2);
		expect(r.dayun.slice(0, 3).map((d) => `${d.branch}${d.ageStart}-${d.ageEnd}`))
			.toEqual(['寅2-11', '卯12-21', '辰22-31']);
	});

	it('恒一岁档＝旧行为（可回退，1-10/11-20…）', () => {
		const r = canpingCalculate({
			yearGz: '丙申', monthBranch: '申', dayBranch: '午', hourBranch: '午',
			gender: '女', method: 'ming', lunarMonth: 7, lunarDay: 26, dayunRule: 'mingGongOne',
		});
		expect(r.qiyunAge).toBe(1);
		expect(r.dayun.slice(0, 2).map((d) => `${d.branch}${d.ageStart}-${d.ageEnd}`)).toEqual(['寅1-10', '卯11-20']);
	});

	it('八字大运法：阳男阴女顺／阴男阳女逆，自月建下一位起', () => {
		const common = { yearGz: '丙申', monthBranch: '申', dayBranch: '午', hourBranch: '午', method: 'ming', lunarMonth: 7, lunarDay: 26, dayunRule: 'baziStyle' };
		const male = canpingCalculate({ ...common, gender: '男' });     // 丙=阳年干 + 男 → 顺
		const female = canpingCalculate({ ...common, gender: '女' });   // 丙=阳年干 + 女 → 逆
		expect(male.dayunForward).toBe(true);
		expect(female.dayunForward).toBe(false);
		expect(male.dayun.slice(0, 3).map((d) => d.branch)).toEqual(['酉', '戌', '亥']);   // 申 → 下一位起
		expect(female.dayun.slice(0, 3).map((d) => d.branch)).toEqual(['未', '午', '巳']);
	});

	it('三档两两必不同（防新档形同虚设）', () => {
		const common = { yearGz: '丙申', monthBranch: '申', dayBranch: '午', hourBranch: '午', gender: '女', method: 'ming', lunarMonth: 7, lunarDay: 26 };
		const sigs = CANPING_DAYUN_RULES.map((rule) => JSON.stringify(
			canpingCalculate({ ...common, dayunRule: rule }).dayun.map((d) => `${d.branch}${d.ageStart}`),
		));
		expect(new Set(sigs).size).toBe(CANPING_DAYUN_RULES.length);
	});

	it('流年表的大运列跟随实算起运岁（不再用入参 1 定位）', () => {
		const s = canpingLiunian({
			yearGz: '丙申', monthBranch: '申', dayBranch: '午', hourBranch: '午',
			gender: '女', method: 'ming', lunarMonth: 7, lunarDay: 26, birthYear: 1956, startAge: 1, endAge: 30,
		});
		expect(s.qiyunAge).toBe(2);
		const at12 = s.rows.find((x) => x.age === 12);
		expect(at12.dayunRange).toBe('12-21');   // 起运 2 岁 → 12 岁正是第二运首年
	});
});
