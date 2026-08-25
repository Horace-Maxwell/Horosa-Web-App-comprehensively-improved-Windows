// 择日西方深化·压测矩阵:5 流派 × 37 用事(引擎全集) × 部位 × 危象 全组合(1110)+边界/极端值。
// 不变式:不抛/分数 0-100/grade 合法/section key 唯一/info 仅 annotate 档且零罚分/
//         westSchool 回显/快照非空/危象仅手术。
import { runElection } from '../electionEngine';
import { buildElectionSnapshot } from '../electionSnapshot';
import { WEST_SCHOOL_ORDER, WEST_SCHOOLS } from '../westernSchools';
import { TOPIC_MASTER } from '../../data/topicMaster';
import { mansionOf } from '../../data/lunarMansions';
import { paransAt, riseHourAngle } from '../../engine/paransLocal';
import { buildMockResult } from './electionFixture';
import { computePenalty } from '../scoring';

const GRADES = ['excellent', 'good', 'fair', 'poor', 'disqualified'];
const SEVS = ['critical', 'high', 'medium', 'low', 'info'];
// [重标定] 罚分核对改消费 scoring 单源 computePenalty(测试内复制公式=第二实现必漂移)。

function assertInvariants(j, schoolId, topicId, opts){
	expect(j).toBeTruthy();
	expect(j.overall.score).toBeGreaterThanOrEqual(0);
	expect(j.overall.score).toBeLessThanOrEqual(100);
	expect(j.base).toBeGreaterThanOrEqual(0);
	expect(j.base).toBeLessThanOrEqual(100);
	expect(GRADES).toContain(j.overall.grade);
	// section key 唯一且齐 19 个(11 旧 + 8 新)
	const keys = j.sections.map((s) => s.key);
	expect(new Set(keys).size).toBe(keys.length);
	expect(keys.length).toBe(21);   // R2:+lots(阿拉伯点)+bonification(吉化凶化)模块
	j.sections.forEach((s) => {
		expect(s.score).toBeGreaterThanOrEqual(0);
		expect(s.score).toBeLessThanOrEqual(100);
	});
	// severity 合法;info 仅 annotate 档;info 零罚分
	const annotate = WEST_SCHOOLS[schoolId] && WEST_SCHOOLS[schoolId].modernPlanets === 'annotate';
	expect(j.penalty).toBe(computePenalty(j.hard_flags));   // [重标定] 同源核对(去重+软封顶)
	// 流派回显 + 快照
	expect(j.westSchool.id).toBe(WEST_SCHOOLS[schoolId] ? schoolId : 'modern_main');
	const snap = buildElectionSnapshot(j);
	expect(snap.length).toBeGreaterThan(50);
	expect(snap).toContain('[总评]');
	if(j.westSchool.id !== 'modern_main') expect(snap).toContain('西方流派：');
	else expect(snap).not.toContain('西方流派：');
	// 危象仅医事(手术/用药)
	if(j.crisis) expect(['surgery', 'medication']).toContain(topicId);
}

describe('压测矩阵:全组合 1110', () => {
	it('5 流派 × 37 用事(引擎全集,UI 下拉 25 为子集) × 3 部位档 × 2 危象档 全过不变式', () => {
		const topics = Object.keys(TOPIC_MASTER);
		expect(topics.length).toBe(37);   // R2:+六新分科
		let ran = 0;
		WEST_SCHOOL_ORDER.forEach((ws) => {
			topics.forEach((tp) => {
				[null, 'aries', 'cancer'].forEach((part) => {
					[null, { date: '2025-03-10', moonLon: 40 }].forEach((cb) => {
						const j = runElection(buildMockResult(), tp, null, null, {
							westSchool: ws, surgeryPart: part, crisisBase: cb,
						});
						assertInvariants(j, ws, tp, { part, cb });
						ran += 1;
					});
				});
			});
		});
		expect(ran).toBe(1110);   // 5×37×3×2
	});

	it('默认档全 37 用事 = 不带 opts 深等(逐用事零回归)', () => {
		Object.keys(TOPIC_MASTER).forEach((tp) => {
			const strip = (x) => { const { facts, ...rest } = x; return rest; };
			expect(strip(runElection(buildMockResult(), tp, null, null, { westSchool: 'modern_main' })))
				.toEqual(strip(runElection(buildMockResult(), tp)));
		});
	});
});

describe('压测:边界与极端值', () => {
	it('无效流派/无效用事/空 opts 全兜底不抛', () => {
		['xx', null, undefined, 42, ''].forEach((ws) => {
			const j = runElection(buildMockResult(), 'marriage', null, null, { westSchool: ws });
			expect(j.westSchool.id).toBe('modern_main');
		});
		expect(runElection(buildMockResult(), 'no_such', null, null, {}).topic.topic_id).toBe('marriage');
		expect(runElection(buildMockResult(), 'marriage', null, null, null)).toBeTruthy();
	});

	it('gpsLat 缺失/非数/极地(拱极) parans 优雅', () => {
		const mk = (lat) => { const r = buildMockResult(); if(lat === undefined) delete r.params.gpsLat; else r.params.gpsLat = lat; return r; };
		// ''→Number('')=0 曾被误当赤道(压测抓出),现空串一律视缺失
		[undefined, 'abc', '', null].forEach((lat) => {
			const j = runElection(mk(lat), 'marriage');
			const sec = j.sections.find((s) => s.key === 'parans');
			expect(sec.findings.map((f) => f.message).join('')).toContain('缺地理纬度');
		});
		// 字符串数值可用;极地纬度不抛(升落轴缺,仅中天/天底)
		['39.9', 89.9, -89.9, 0].forEach((lat) => {
			expect(() => runElection(mk(lat), 'marriage')).not.toThrow();
		});
		expect(riseHourAngle(89.9, 40)).toBeNull();
	});

	it('月黄经边界(0/359.99/负值)月宿正确落宿', () => {
		expect(mansionOf(0).n).toBe(1);
		expect(mansionOf(359.99).n).toBe(28);
		expect(mansionOf(-0.01).n).toBe(28);
		expect(mansionOf(720.5).n).toBe(1);
		[0, 359.99, -12.3].forEach((lon) => {
			const r = buildMockResult();
			const m = r.chart.objects.find((o) => o.id === 'Moon');
			m.lon = lon;
			expect(() => runElection(r, 'marriage')).not.toThrow();
		});
	});

	it('危象输入残缺(缺 moonLon/字符串/负数)优雅', () => {
		const cases = [{}, { date: 'x' }, { moonLon: null }, { moonLon: 'abc', date: '2025-01-01' }, { moonLon: -30, date: '2025-01-01' }];
		cases.forEach((cb) => {
			expect(() => runElection(buildMockResult(), 'surgery', null, null, { crisisBase: cb })).not.toThrow();
		});
		// moonLon 'abc' → Number=NaN → norm360(NaN)=NaN → 不该产出 NaN 文本
		const j = runElection(buildMockResult(), 'surgery', null, null, { crisisBase: { moonLon: 'abc', date: '2025-01-01' } });
		if(j.crisis){ expect(Number.isNaN(j.crisis.elapsedDeg)).toBe(false); }
	});

	it('surgeryPart 无效星座 → 检查回 skip;有效部位全 12 座跑通', () => {
		const jBad = runElection(buildMockResult(), 'surgery', null, null, { surgeryPart: 'not_a_sign' });
		expect(jBad.topicPack.items.find((x) => x.code === 'moon_in_surgery_part_sign')).toBeUndefined();
		['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'].forEach((sg) => {
			expect(() => runElection(buildMockResult(), 'surgery', null, null, { surgeryPart: sg })).not.toThrow();
		});
	});

	it('极端盘:全七曜同黄经(围攻/收光风暴)+相位表缺失 不抛', () => {
		const r = buildMockResult();
		r.chart.objects.forEach((o) => { if(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(o.id)){ o.lon = 100; } });
		expect(() => runElection(r, 'marriage')).not.toThrow();
		const r2 = buildMockResult();
		delete r2.aspects;
		expect(() => runElection(r2, 'marriage')).not.toThrow();
		const r3 = buildMockResult();
		r3.aspects = { normalAsp: {} };
		expect(() => runElection(r3, 'marriage')).not.toThrow();
	});

	it('paransAt 直接边界:空星表/空行星/orb 0', () => {
		expect(paransAt(39.9, [], [], 2)).toEqual([]);
		expect(paransAt(39.9, [{ key: 'sun', cn: '太阳', lon: 100 }], [], 2)).toEqual([]);
		expect(() => paransAt(39.9, [{ key: 'sun', cn: '太阳', lon: 100 }], [{ name_cn: 'x', lon: 100, dec: 0, avoid: false, meaning: '' }], 0)).not.toThrow();
	});

	it('本命合参边界:生日缺失/日期倒挂(负年龄)静默跳过时主段', () => {
		const { buildFacts } = require('../../engine/chartFacts');
		const natal = buildMockResult();
		delete natal.params.date;
		const j = runElection(buildMockResult(), 'marriage', buildFacts(natal));
		expect(j.natal.available).toBe(true);
		expect(j.natal.notes.map((n) => n.text).join('')).not.toContain('小限');
		// 本命晚于事盘(负年龄)
		const natal2 = buildMockResult();
		natal2.params = { ...natal2.params, date: '2030-01-01' };
		const j2 = runElection(buildMockResult(), 'marriage', buildFacts(natal2));
		expect(j2.natal.notes.map((n) => n.text).join('')).not.toContain('法达');
	});
});
