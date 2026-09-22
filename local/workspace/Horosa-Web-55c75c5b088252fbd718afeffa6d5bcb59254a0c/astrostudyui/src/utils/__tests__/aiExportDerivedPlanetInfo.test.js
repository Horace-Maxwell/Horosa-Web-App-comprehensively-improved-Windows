// [Q-307/T-303] 衍生盘六个独立导出键(hellenastro/dwadasamsa/harmonic/draconic/relocation/locastro)进「星曜后天信息」集合:
// 自身设置生效;无自身设置时回落聚合键 astrochart_like(挂载侧仍按聚合键读)→ 同一张衍生盘导出与挂载吃同一开关。
import { loadAIExportSettings, applyPlanetInfoFilterByContext } from '../aiExport';

const SETTINGS_KEY = 'horosa.ai.export.settings.v1';
const SAMPLE = '太阳 白羊 5° （后天：1th；主七宫）';

describe('AI导出 · 衍生盘星曜后天信息设置', () => {
	beforeEach(() => { window.localStorage.clear(); });
	it('六衍生键写入 planetInfo 后归一保留(此前被 isPlanetInfoTechnique 过滤掉)', () => {
		window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 60, planetInfo: { hellenastro: { showHouse: 0, showRuler: 1 }, draconic: { showHouse: 1, showRuler: 0 } } }));
		const s = loadAIExportSettings();
		expect(s.planetInfo.hellenastro).toEqual({ showHouse: 0, showRuler: 1 });
		expect(s.planetInfo.draconic).toEqual({ showHouse: 1, showRuler: 0 });
	});
	it('自身设置生效:hellenastro 关宫位 → 导出剥掉 1st;缺省(全开)原样', () => {
		window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 60, planetInfo: { hellenastro: { showHouse: 0, showRuler: 1 } } }));
		const out = applyPlanetInfoFilterByContext(SAMPLE, 'hellenastro');
		expect(out).not.toMatch(/1th/);
		expect(out).toMatch(/主七宫/);
		window.localStorage.clear();
		expect(applyPlanetInfoFilterByContext(SAMPLE, 'hellenastro')).toBe(SAMPLE);
	});
	it('无自身设置时回落聚合键 astrochart_like 的设置(与挂载同开关)', () => {
		window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 60, planetInfo: { astrochart_like: { showHouse: 1, showRuler: 0 } } }));
		['dwadasamsa', 'harmonic', 'relocation', 'locastro'].forEach((k) => {
			const out = applyPlanetInfoFilterByContext(SAMPLE, k);
			expect(out).toMatch(/1th/);
			expect(out).not.toMatch(/主七宫/);
		});
		// 自身设置优先于聚合键
		window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 60, planetInfo: { astrochart_like: { showHouse: 1, showRuler: 0 }, harmonic: { showHouse: 1, showRuler: 1 } } }));
		expect(applyPlanetInfoFilterByContext(SAMPLE, 'harmonic')).toBe(SAMPLE);
	});
});
