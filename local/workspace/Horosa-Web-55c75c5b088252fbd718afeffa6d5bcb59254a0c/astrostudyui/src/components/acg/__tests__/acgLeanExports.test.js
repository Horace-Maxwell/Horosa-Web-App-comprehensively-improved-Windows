// 占星地图:释义表的五个零消费取值包装(planetAngle / lsDirection / paranStage / starMeaning / zoneMeaning)
// 与罗盘里未调用的 textOn 已删;在用的 sensitiveMeaning 与各释义表照旧导出。
import fs from 'fs';
import path from 'path';
import * as Interp from '../interpretations.zh';

describe('占星地图 零消费导出', () => {
	test('五个包装已删,表与 sensitiveMeaning 照旧', () => {
		['planetAngle', 'lsDirection', 'paranStage', 'starMeaning', 'zoneMeaning'].forEach((k) => {
			expect(`${k}:${k in Interp}`).toBe(`${k}:false`);
		});
		['PLANET_ANGLE', 'LS_DIRECTION', 'PARAN_STAGE', 'STAR_MEANING', 'ZONE_MEANING', 'SENSITIVE_MEANING'].forEach((k) => {
			expect(`${k}:${!!Interp[k]}`).toBe(`${k}:true`);
		});
		const key = Object.keys(Interp.SENSITIVE_MEANING)[0];
		expect(Interp.sensitiveMeaning(key)).toBe(Interp.SENSITIVE_MEANING[key]);
		expect(Interp.sensitiveMeaning('NoSuchKey')).toBe('');
	});
	test('AcgCompassDial 不再有未调用的 textOn', () => {
		expect(fs.readFileSync(path.resolve(__dirname, '..', 'AcgCompassDial.js'), 'utf8')).not.toMatch(/\btextOn\b/);
	});
});
