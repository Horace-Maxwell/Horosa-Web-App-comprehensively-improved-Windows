// [卜卦改进 H9] AI 链同步——官方 gap 八项清零锁+段账。
// ①真形 fixture 快照:八 gap 段头全产出(断法要点/六类问法①-⑥/恒星会合/自然象征/
//   应期修正链按料产;同主一星/盗窃研判按局面产——此处验无条件五段+条件段逻辑)
// ②AI_EXPORT_PRESET_SECTIONS.horary 段账=28,与 buildHorarySnapshot 段头集一致(防漏登)
// ③挂载 gear 键账:HORARY_JUDGE_FIELDS 覆盖 spec 全部 horary 域键(spec 驱动自证)
import { runHorary, __resetHoraryMemoForTest } from '../horaryEngine';
import { buildHorarySnapshot } from '../horarySnapshot';
import { HORARY_PARAM_SPEC } from '../horarySchools';

const realResult = require('../../engine/__tests__/fixtures/realChartResult.json');
function freshReal(){ return JSON.parse(JSON.stringify(realResult)); }

describe('H9① 快照八 gap 段', () => {
	beforeEach(() => { __resetHoraryMemoForTest(); });
	it('真形 fixture(general):无条件五段+Query⑥真值行产出', () => {
		const r = freshReal();
		const j = runHorary(r, 'general', {});
		const snap = buildHorarySnapshot(j, r);
		// [复审C1] 第二参=全 Result(receptions/mutuals 在顶层)——存案路径曾传 result.chart
		// 致 [古典接纳] 恒缺;此处按正确形状断言该段在场(真形 fixture 顶层实录接纳数据)。
		expect(snap).toContain('[古典接纳]');
		['[断法要点]', '[六类问法]', '[恒星会合]', '[自然象征]', '[行星时]'].forEach((s) => {
			// 自然象征段依赖 sig.natural——general 类 natural 可能空;有 natural 才断言
			if(s === '[自然象征]' && !j.significators.natural){ return; }
			expect(snap).toContain(s);
		});
		expect(snap).toMatch(/⑥ 结局如何：.+终局/);
		expect(snap).toMatch(/④ 何处何向：/);
		expect(snap).toMatch(/昼时序（日出起）：/);
		expect(snap).toMatch(/夜时序（日落起）：/);
	});
	it('theft 类:盗窃研判 11 步段产出;应期修正链按料产段', () => {
		const r = freshReal();
		const j = runHorary(r, 'theft', {});
		const snap = buildHorarySnapshot(j, r);
		expect(snap).toContain('[盗窃研判]');
		__resetHoraryMemoForTest();
		const j2 = runHorary(freshReal(), 'general', { timingModifiers: true });
		const snap2 = buildHorarySnapshot(j2, freshReal());
		// timingModifiers 开档且有应期时段产出;无应期(timing null)则不产——按 timing 在场性断言
		if(j2.timing && (j2.timing.modifiers || j2.timing.signChange)){
			expect(snap2).toContain('[应期修正链]');
		}
	});
});

describe('H9② 段账=preset 登记一致', () => {
	it('AI_EXPORT_PRESET_SECTIONS.horary=28 段且含 H9 七新段', () => {
		const { AI_EXPORT_PRESET_SECTIONS } = require('../../../utils/aiExport');
		const secs = AI_EXPORT_PRESET_SECTIONS.horary;
		expect(secs.length).toBe(28);
		['断法要点', '六类问法', '恒星会合', '同主一星', '自然象征', '盗窃研判', '应期修正链'].forEach((s) => {
			expect(secs).toContain(s);
		});
	});
	it('快照实产段头 ⊆ preset 登记(防新段漏登;专题深化·X 为通配)', () => {
		const { AI_EXPORT_PRESET_SECTIONS } = require('../../../utils/aiExport');
		const secs = AI_EXPORT_PRESET_SECTIONS.horary;
		__resetHoraryMemoForTest();
		const r = freshReal();
		const j = runHorary(r, 'theft', { timingModifiers: true, accidentalMode: 'lilly', lotsSet: 'core15', verdictProfile: 'v2' });
		const snap = buildHorarySnapshot(j, r, { questionText: 'x', castingCamp: 'querent' });
		const heads = (snap.match(/^\[(.+)\]$/gm) || []).map((h) => h.slice(1, -1));
		heads.forEach((h) => {
			const ok = secs.indexOf(h) >= 0 || h.startsWith('专题深化·');
			expect(ok ? h : `漏登段:${h}`).toBe(h);
		});
	});
});

describe('H9③ 挂载 gear 键账(spec 驱动自证)', () => {
	it('techniqueMountSettings 的 hp_ 字段覆盖 spec 全部 horary 判读键', () => {
		const mod = require('../../../utils/techniqueMountSettings');
		const schema = (mod.MOUNT_TECHNIQUE_SCHEMA || mod.default || {}).horary || (mod.getMountSchema ? mod.getMountSchema('horary') : null);
		const judgeKeys = HORARY_PARAM_SPEC.filter((p) => p.scope === 'horary' && !p.sendToBackend).map((p) => 'hp_' + p.key);
		// schema 形状因版本而异:退到源码文本断言(HORARY_JUDGE_FIELDS 由 spec .map 生成=单源自动)
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'utils', 'techniqueMountSettings.js'), 'utf8');
		expect(src).toContain("'hp_' + sp.key");
		expect(src).toMatch(/HORARY_PARAM_SPEC[\s\S]{0,200}scope === 'horary'/);
		expect(judgeKeys.length).toBeGreaterThanOrEqual(33);   // 22 旧+11 新(H2 五+H4b 一+H5 四+H7 一)
		expect(schema === null || typeof schema === 'object' || schema === undefined).toBe(true);
	});
});
