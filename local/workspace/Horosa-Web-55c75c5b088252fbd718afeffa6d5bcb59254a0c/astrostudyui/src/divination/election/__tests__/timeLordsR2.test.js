// R2 时主扩展金标:JDN/分数年龄/月限日限/法达子期与夜序两制/ZR L2·解结·峰期·摩羯27/回归常数/合参段接线。
import {
	gregorianJdn, jdnOfYmd, fractionalAge, profectionMD,
	FIRDARIA_DAY, FIRDARIA_NIGHT, FIRDARIA_NIGHT_NODES_END, firdariaSubAt,
	ZR_YEARS, zrL2At, SOLAR_RETURN_DAYS, LUNAR_RETURN_DAYS,
} from '../../engine/timeLords';
import { runElection } from '../electionEngine';
import { buildFacts } from '../../engine/chartFacts';
import { buildMockResult } from './electionFixture';

describe('历日与年龄', () => {
	it('JDN 锚:2000-01-01=2451545;跨年差正确', () => {
		expect(gregorianJdn(2000, 1, 1)).toBe(2451545);
		expect(jdnOfYmd('2025-03-15') - jdnOfYmd('2024-03-15')).toBe(365);
		expect(fractionalAge('2000-01-01', '2000-01-01')).toBe(0);
		expect(Math.abs(fractionalAge('2000-01-01', '2010-01-01') - 10)).toBeLessThan(0.01);
		expect(fractionalAge('2010-01-01', '2000-01-01')).toBeNull();
	});
});

describe('月限/日限', () => {
	it('生日当天:年=月=日限同宫;+61 天月限进 2 宫;+5 天日限进 2 宫', () => {
		const d0 = profectionMD('2000-03-15', '2024-03-15');   // 24 岁 → 年限 1 宫
		expect(d0.annual).toBe(1);
		expect(d0.monthly).toBe(1);
		expect(d0.daily).toBe(1);
		const d61 = profectionMD('2000-03-15', '2024-05-15');   // 61 天 → 2 个月 → 月限 3 宫
		expect(d61.monthsSinceBirthday).toBe(2);
		expect(d61.monthly).toBe(3);
		const d5 = profectionMD('2000-03-15', '2024-03-20');    // 5 天 → 月限 1 宫内第 3 个 2.5 日 → 日限 3 宫
		expect(d5.monthly).toBe(1);
		expect(d5.daily).toBe(3);
	});
});

describe('法达子期与夜序两制', () => {
	it('昼盘 5 岁:日大运(10y)第 4 子运=月亮(子长 10/7);序循迦勒底环', () => {
		const r = firdariaSubAt(5, true);
		expect(r.major.lord).toBe('sun');
		expect(r.sub.idx).toBe(4);          // 5 / (10/7) = 3.5 → 第 4 段
		expect(r.sub.lord).toBe('moon');    // 日→金→水→月
		expect(Math.abs(r.sub.years - 10 / 7)).toBeLessThan(1e-9);
	});
	it('夜序两制在 39 岁后分道:现行制(交点承火星后)39 岁=北交期;缀末制=太阳期', () => {
		const a = firdariaSubAt(39.5, false, 'nodes_after_mars');
		const b = firdariaSubAt(39.5, false, 'nodes_end');
		expect(a.major.lord).toBe('north_node');
		expect(a.sub).toBeNull();           // 交点期不分子期
		expect(b.major.lord).toBe('sun');
		expect(b.sub).toBeTruthy();
		// 两制总长皆 75
		const sum = (seq) => seq.reduce((s, x) => s + x[1], 0);
		expect(sum(FIRDARIA_DAY)).toBe(75);
		expect(sum(FIRDARIA_NIGHT)).toBe(75);
		expect(sum(FIRDARIA_NIGHT_NODES_END)).toBe(75);
	});
});

describe('ZR L2/解结/峰期(摩羯27·水瓶30)', () => {
	it('小年表:摩羯 27 为全表唯一削减;水瓶 30', () => {
		expect(ZR_YEARS.capricorn).toBe(27);
		expect(ZR_YEARS.aquarius).toBe(30);
	});
	it('自白羊 L1(15y):首 L2=白羊 15 月;L1 内 L2 依次推进;峰期=距释放点 0/4/7/10 位', () => {
		const z0 = zrL2At('aries', 0.5);   // 6 个月 → L2 仍白羊(0–15月)
		expect(z0.l1.sign).toBe('aries');
		expect(z0.l2.sign).toBe('aries');
		expect(z0.l2Peak).toBe(true);      // 本座=角
		const z2 = zrL2At('aries', 1.5);   // 18 月 → 白羊15月后入金牛(15–23月)
		expect(z2.l2.sign).toBe('taurus');
		expect(z2.l2Peak).toBe(false);
		expect(z2.loosedBond).toBe(false);
	});
	it('解结:巨蟹 L1 长 25 年=300 月 > 全轮 211 月 → 跑满一周跳对座摩羯', () => {
		// 全轮月数 = Σ ZR_YEARS = 211;巨蟹起,acc 到 211 月时将回巨蟹 → 跳摩羯
		const z = zrL2At('cancer', (211 + 1) / 12);   // 第 212 个月
		expect(z.l1.sign).toBe('cancer');
		expect(z.loosedBond).toBe(true);
		expect(z.l2.sign).toBe('capricorn');
	});
	it('回归常数:日返 365.25/月返 27.32(恒星月,非 29.5)', () => {
		expect(SOLAR_RETURN_DAYS).toBe(365.25);
		expect(Math.abs(LUNAR_RETURN_DAYS - 27.3217)).toBeLessThan(0.001);
	});
});

describe('合参段接线', () => {
	it('本命合参含月限/法达子运/ZR L2 新行且全部落 timelord 组;过运行不落', () => {
		const natal = buildMockResult();
		natal.params = { ...natal.params, date: '2000-03-15' };   // 25 岁本命
		const j = runElection(buildMockResult(), 'marriage', buildFacts(natal));
		const texts = j.natal.notes.map((n) => n.text).join('|');
		expect(texts).toContain('月限');
		expect(texts).toContain('法达子运');
		expect(texts).toContain('ZR 自幸运点 L2');
		const tl = j.natal.notes.filter((n) => n.kind === 'timelord');
		expect(tl.length).toBeGreaterThanOrEqual(6);
		expect(j.natal.notes.some((n) => n.kind === 'transit')).toBe(true);
	});
	it('ZR 释放点口径切精神点:文案随切;夜序制经 electionParams 透传', () => {
		const natal = buildMockResult();
		natal.params = { ...natal.params, date: '2000-03-15' };
		const j = runElection(buildMockResult(), 'marriage', buildFacts(natal), null, { electionParams: { zrLot: 'spirit' } });
		expect(j.natal.notes.map((n) => n.text).join('|')).toContain('ZR 自精神点 L2');
	});
});
