// WP-7..10:时主推运/医疗接通/埃及凶日/可判性/胜利星。
import { ageAt, profectionHouse, firdariaAt, zrL1At } from '../../engine/timeLords';
import { isEgyptianDay } from '../../data/egyptianDays';
import { runElection } from '../electionEngine';
import { buildElectionSnapshot } from '../electionSnapshot';
import { buildMockResult } from './electionFixture';

function sectionOf(j, key){ return j.sections.find((s) => s.key === key); }
function msgs(sec){ return (sec.findings || []).map((f) => f.message).join('\n'); }

describe('WP-7 时主推运纯函数', () => {
	it('ageAt/profectionHouse:周岁与小限宫', () => {
		expect(ageAt('1990-06-15', '2025-03-15')).toBe(34); // 生日未到
		expect(ageAt('1990-03-15', '2025-03-15')).toBe(35); // 生日当天已满
		expect(profectionHouse(0)).toBe(1);
		expect(profectionHouse(34)).toBe(11); // 34 mod 12 = 10 → 第 11 宫
		expect(profectionHouse(36)).toBe(1);
	});

	it('Firdaria 75 年表:昼盘自日起,夜盘自月起,边界正确', () => {
		expect(firdariaAt(0, true)).toEqual({ lord: 'sun', years: 10, from: 0, to: 10 });
		expect(firdariaAt(9, true).lord).toBe('sun');
		expect(firdariaAt(10, true)).toEqual({ lord: 'venus', years: 8, from: 10, to: 18 });
		expect(firdariaAt(74, true).lord).toBe('south_node');
		expect(firdariaAt(75, true).lord).toBe('sun'); // 循环
		expect(firdariaAt(0, false).lord).toBe('moon');
		expect(firdariaAt(34, false).lord).toBe('mars'); // 夜:月9+土11+木12=32,34−32=2 落火星期(7年)
	});

	it('ZR L1:自幸运点座顺行连续期(摩羯27/水瓶30 表)', () => {
		expect(zrL1At('cancer', 0)).toEqual({ sign: 'cancer', lord: 'moon', from: 0, to: 25 });
		expect(zrL1At('cancer', 25)).toEqual({ sign: 'leo', lord: 'sun', from: 25, to: 44 });
		expect(zrL1At('capricorn', 26).lord).toBe('saturn'); // 摩羯 27 年
		expect(zrL1At('capricorn', 27).sign).toBe('aquarius');
	});

	it('本命合参输出时主推运段(fixture 自身作本命,年龄 0)', () => {
		const j = runElection(buildMockResult(), 'marriage', require('../../engine/chartFacts').buildFacts(buildMockResult()));
		const texts = j.natal.notes.map((n) => n.text).join('\n');
		expect(texts).toContain('小限（Profection）:0 岁行第 1 宫');
		expect(texts).toContain('法达（Firdaria）大运:太阳（0–10 岁');
		expect(texts).toContain('黄道释放（ZR）自幸运点 L1:巨蟹 期（0–25 岁');
	});

	it('🔴 裸 Result(无 houseMap 懒建缓存)自建宫位表:小限年主不落空', () => {
		// houseMap 是盘面组件渲染时懒建的缓存;本命合参/挂载再生拿的是裸 Result。
		const { buildFacts } = require('../../engine/chartFacts');
		const bare = buildMockResult();
		const hm = bare.houseMap;
		delete bare.houseMap;
		bare.chart.houses = Object.keys(hm).map((id) => ({ id, ...hm[id] }));
		const facts = buildFacts(bare);
		expect(facts.houses[1].ruler).toBe('mars');
		expect(facts.houses[4].ruler).toBe('moon');
		const j = runElection(buildMockResult(), 'marriage', facts);
		expect(j.natal.notes.map((n) => n.text).join('\n')).toContain('小限（Profection）:0 岁行第 1 宫,年主星 火星');
	});
});

describe('WP-8 医疗:部位接通+危象日', () => {
	it('surgeryPart 指定后 topicPack 真判月落部位星座', () => {
		// fixture 月在巨蟹;部位选巨蟹(胸/胃)→ fail;选白羊 → pass
		const jHit = runElection(buildMockResult(), 'surgery', null, null, { surgeryPart: 'cancer' });
		const itHit = jHit.topicPack.items.find((x) => x.code === 'moon_in_surgery_part_sign');
		expect(itHit).toBeTruthy();
		expect(itHit.pass).toBe(false);
		const jOk = runElection(buildMockResult(), 'surgery', null, null, { surgeryPart: 'aries' });
		expect(jOk.topicPack.items.find((x) => x.code === 'moon_in_surgery_part_sign').pass).toBe(true);
		// 未指定沿现状 skip(零回归)
		const jDef = runElection(buildMockResult(), 'surgery');
		expect(jDef.topicPack.items.find((x) => x.code === 'moon_in_surgery_part_sign')).toBeUndefined();
	});

	it('危象日:纯陈述已行度数与最近危象点;快照含段', () => {
		// fixture 月 97°;病始月位 40° → 已行 57°,最近 45°(差 12°)
		const j = runElection(buildMockResult(), 'surgery', null, null, { crisisBase: { date: '2025-03-10', moonLon: 40 } });
		expect(j.crisis.elapsedDeg).toBe(57);
		expect(j.crisis.nearestMark).toBe(45);
		expect(j.crisis.distToMark).toBe(12);
		expect(buildElectionSnapshot(j)).toContain('[危象日参照]');
		// 缺省 null(默认输出零变)
		expect(runElection(buildMockResult(), 'surgery').crisis).toBeNull();
		// 危象仅手术用事产出:同 crisisBase 在 marriage 下门控为 null(切走用事不残留)
		const jm = runElection(buildMockResult(), 'marriage', null, null, { crisisBase: { date: '2025-03-10', moonLon: 40 } });
		expect(jm.crisis).toBeNull();
		expect(buildElectionSnapshot(jm)).not.toContain('危象日参照');
	});
});

describe('WP-9 埃及凶日', () => {
	it('24 日表命中/不中', () => {
		expect(isEgyptianDay('2025-01-01')).toBe(true);
		expect(isEgyptianDay('2025-03-15')).toBe(false); // fixture 日期不中(golden 稳定)
		expect(isEgyptianDay('2025-08-30')).toBe(true);
		expect(isEgyptianDay('2025-12-22')).toBe(true);
		expect(isEgyptianDay('')).toBe(false);
	});

	it('命中日给 low 红线;fixture 日期不触(golden 锚不动)', () => {
		const r = buildMockResult();
		r.params.date = '2025-01-25';
		const j = runElection(r, 'marriage');
		const f = j.hard_flags.find((x) => x.id === 'egyptian_day');
		expect(f).toBeTruthy();
		expect(f.severity).toBe('low');
		expect(runElection(buildMockResult(), 'marriage').hard_flags.find((x) => x.id === 'egyptian_day')).toBeUndefined();
	});
});

describe('WP-10 可判性+胜利星', () => {
	it('radicality 模块:fixture 命度 15° 无过早/过晚警告', () => {
		const j = runElection(buildMockResult(), 'marriage');
		const sec = sectionOf(j, 'radicality');
		expect(sec).toBeTruthy();
		const m = msgs(sec);
		expect(m).not.toContain('极早');
		expect(m).not.toContain('极晚');
	});

	it('命度过晚触发可判性警告', () => {
		const r = buildMockResult();
		const asc = r.chart.objects.find((o) => o.id === 'Asc');
		asc.lon = 28.5; asc.signlon = 28.5;
		const m = msgs(sectionOf(runElection(r, 'marriage'), 'radicality'));
		expect(m).toContain('极晚');
	});

	it('Almuten Figuris:fixture 手算锚(月20/金16/木13,五命点权威法·三分按昼夜取主+共主)', () => {
		// R2 口径统一(engine/almuten.almutenFiguris):三分不再昼夜双主齐计,改按盘 sect 取主+Dorothean 共主。
		// 手算(昼盘/埃及界):双鱼24.9→木5金(旺4+昼三分3)月3火(界2面1);巨蟹7→月(庙5共3)木4金(3+2+1);
		// 白羊15→火5日(4+3+1)土3水2;巨蟹27.1→月(5+3+1)木4金3土2 ⇒ 月20/金16/木13/火8/日8/土5/水2。
		const m = msgs(sectionOf(runElection(buildMockResult(), 'marriage'), 'almuten'));
		expect(m).toContain('胜利星（Almuten Figuris）：月亮（20 分');
		expect(m).toContain('次位：金星(16)、木星(13)');
	});
});
