// WP-1 宗派深化 + WP-2 月相机制:分支行为单测 + 流派计权。
import { runElection } from '../electionEngine';
import { buildMockResult } from './electionFixture';

function sectionOf(j, key){ return j.sections.find((s) => s.key === key); }
function msgs(sec){ return (sec.findings || []).map((f) => f.message).join('\n'); }
function setObj(r, id, patch){ Object.assign(r.chart.objects.find((o) => o.id === id), patch); return r; }

describe('WP-1 宗派(sect)模块', () => {
	it('昼盘:得派吉星木星/离派凶星火星,火星角宫命中负项', () => {
		const j = runElection(buildMockResult(), 'marriage');
		const s = sectionOf(j, 'sect');
		expect(s).toBeTruthy();
		expect(s.title).toBe('宗派（昼夜派）');
		const m = msgs(s);
		expect(m).toContain('昼盘：得派吉星为木星');
		expect(m).toContain('离派凶星 火星 临角宫');
	});

	it('夜盘翻转:得派吉星金星/离派凶星土星', () => {
		const r = buildMockResult();
		r.chart.isDiurnal = false;
		const j = runElection(r, 'marriage');
		expect(msgs(sectionOf(j, 'sect'))).toContain('夜盘：得派吉星为金星');
	});

	it('hayz 三态与喜乐宫消费后端字段', () => {
		const r = buildMockResult();
		setObj(r, 'Venus', { hayyiz: 'Hayyiz' });
		setObj(r, 'Jupiter', { hayyiz: 'DemiHayyiz', joy: true });
		setObj(r, 'Saturn', { hayyiz: 'InWrongPos' });
		const m = msgs(sectionOf(runElection(r, 'marriage'), 'sect'));
		expect(m).toContain('金星 得时(hayz)');
		expect(m).toContain('木星 半得时(halb)');
		expect(m).toContain('土星 失时');
		expect(m).toContain('木星 入喜乐宫');
	});
});

describe('WP-2 月相机制模块', () => {
	it('fixture 基线:传光(月离火入土·凶)+光线围攻', () => {
		const j = runElection(buildMockResult(), 'marriage');
		const m = msgs(sectionOf(j, 'moon_mechanics'));
		expect(m).toContain('传光：月离 火星');
		expect(m).toContain('入相 土星');
		expect(m).toContain('光线围攻：月亮');
	});

	it('收光:两星同入相更慢的第三星', () => {
		const r = buildMockResult();
		// 金星+月亮 同入相土星(土星速度 0.11 慢于两者)→ 收光
		r.aspects.normalAsp.Venus.Applicative = [{ id: 'Saturn', asp: 120, orb: 2.5 }];
		const m = msgs(sectionOf(runElection(r, 'marriage'), 'moon_mechanics'));
		expect(m).toContain('收光：');
		expect(m).toContain('同入相更慢的 土星');
	});

	it('阻碍:第三星先于月成相截走', () => {
		const r = buildMockResult();
		// 月入相土星 orb 1.5;金星亦入相土星 orb 0.6(更先成相)→ 阻碍
		r.aspects.normalAsp.Venus.Applicative = [{ id: 'Saturn', asp: 60, orb: 0.6 }];
		const m = msgs(sectionOf(runElection(r, 'marriage'), 'moon_mechanics'));
		expect(m).toContain('阻碍：金星 先于月与 土星 成相');
	});

	it('挫败:受相星先赴他约', () => {
		const r = buildMockResult();
		// 月入相土星 orb 1.5;土星自身入相金星 orb 0.4 → 挫败
		r.aspects.normalAsp.Saturn = { Applicative: [{ id: 'Venus', asp: 60, orb: 0.4 }], Separative: [], Exact: [], None: [], Obvious: [] };
		const m = msgs(sectionOf(runElection(r, 'marriage'), 'moon_mechanics'));
		expect(m).toContain('挫败：土星 先赴与 金星 之约');
	});

	it('回避风险:入相目标逆行/守留', () => {
		const r = buildMockResult();
		setObj(r, 'Saturn', { movedir: 'Retrograde', lonspeed: -0.02 });
		const m = msgs(sectionOf(runElection(r, 'marriage'), 'moon_mechanics'));
		expect(m).toContain('回避风险：土星 逆行');
	});

	it('体围攻:黄经两侧 7° 内被火土同夹', () => {
		const r = buildMockResult();
		// 金星移到火土黄经中间:火 100 / 金 103(白羊改巨蟹段) / 土 97
		setObj(r, 'Venus', { lon: 103, sign: 'Cancer', signlon: 13, house: 'House4' });
		setObj(r, 'Saturn', { lon: 97.5, sign: 'Cancer', signlon: 7.5, house: 'House4' });
		const m = msgs(sectionOf(runElection(r, 'marriage'), 'moon_mechanics'));
		expect(m).toContain('体围攻：金星');
	});

	it('野逸:后端 feral 字段直读', () => {
		const r = buildMockResult();
		setObj(r, 'Moon', { feral: true });
		const m = msgs(sectionOf(runElection(r, 'marriage'), 'moon_mechanics'));
		expect(m).toContain('月亮野逸');
	});
});

describe('流派计权(extraWeights)', () => {
	it('🔴 默认档:新模块仅展示、总分构成不变(base=golden 锚值)', () => {
		const j = runElection(buildMockResult(), 'marriage');
		expect(sectionOf(j, 'sect')).toBeTruthy();
		expect(sectionOf(j, 'moon_mechanics')).toBeTruthy();
		expect(j.base).toBe(58); // golden 锚:与 WP-1/2 之前逐字一致
	});

	it('宗派强调档:新模块按 extraWeights 计入总分(动态手算核对)', () => {
		const { WEST_SCHOOLS } = require('../westernSchools');
		const dj = runElection(buildMockResult(), 'marriage');
		const pj = runElection(buildMockResult(), 'marriage', null, null, { westSchool: 'persian' });
		// 动态手算:base_persian = (58×1.03 + Σ score_k·w_k) / (1.03 + Σw_k)
		const ew = WEST_SCHOOLS.persian.extraWeights;
		let extra = 0; let wsum = 0;
		Object.keys(ew).forEach((k) => {
			const sec = pj.sections.find((s) => s.key === k);
			expect(sec).toBeTruthy();
			extra += sec.score * ew[k]; wsum += ew[k];
		});
		const exp = Math.round((58 * 1.03 + extra) / (1.03 + wsum));
		expect(Math.abs(pj.base - exp)).toBeLessThanOrEqual(1); // 58 为默认档四舍五入锚,容 ±1
		expect(dj).toBeTruthy();
		// 计权真实生效(确定性合成盘,不吃 fixture 均值巧合):
		// persian 计 sect(权重>0) → moon100+sect0 均分 <100;默认档不计 → =100。
		const { scoreReport } = require('../scoring');
		const synth = [{ key: 'moon', score: 100 }, { key: 'sect', score: 0 }];
		expect(scoreReport(synth, [], WEST_SCHOOLS.persian).base).toBeLessThan(100);
		expect(scoreReport(synth, [], WEST_SCHOOLS.modern_main).base).toBe(100);
	});
});
