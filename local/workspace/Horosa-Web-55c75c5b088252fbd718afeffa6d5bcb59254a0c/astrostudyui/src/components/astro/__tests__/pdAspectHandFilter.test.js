/**
 * 主限法迫星列「相位方向」筛选金标(用户点单:入口在列头筛选下拉,与相位/类型维并存):
 * ① hand 判定与行文案渲染同前缀源:D_=dexter(行文案「右相位处」)/S_=sinister(「左相位处」);
 *    N_/A_/C_/T_ 及裸名无方向 → null。
 * ② 列筛选维 PD_PROM_FILTER_EXTRA 含 HAND:dexter/HAND:sinister 两项(紧随冲 180° 之后)。
 * ③ pdPromFilterMatch 的 HAND: 分支:命中该方向行;无方向行不命中(antd 多选筛选是 OR 语义,
 *    勾「右相位」+「☌ 合相」时合相行仍由 ASP:0 维命中显示——列内多值并集,与既有维一致)。
 */
import { directionRowAspectHand, pdPromFilterMatch } from '../AstroPrimaryDirection';

describe('pdAspectHandFilter(列筛选版)', () => {
	it('① D_=dexter / S_=sinister,其余无方向', () => {
		expect(directionRowAspectHand('D_Venus_120')).toBe('dexter');
		expect(directionRowAspectHand('S_Venus_120')).toBe('sinister');
		expect(directionRowAspectHand('D_Sun_60')).toBe('dexter');
		expect(directionRowAspectHand('S_Mars_90')).toBe('sinister');
		expect(directionRowAspectHand('N_Sun_0')).toBe(null);
		expect(directionRowAspectHand('A_Moon')).toBe(null);
		expect(directionRowAspectHand('C_Moon')).toBe(null);
		expect(directionRowAspectHand('T_Saturn_150')).toBe(null);
		expect(directionRowAspectHand('')).toBe(null);
		expect(directionRowAspectHand(null)).toBe(null);
		// 前缀须整段匹配起始(D/S 出现在中段不算)
		expect(directionRowAspectHand('N_D_weird')).toBe(null);
	});

	it('② 列筛选维含左右相位两项,紧随冲 180° 之后', () => {
		// eslint-disable-next-line global-require
		const src = require('fs').readFileSync(
			// eslint-disable-next-line global-require
			require('path').join(__dirname, '..', 'AstroPrimaryDirection.js'), 'utf8');
		const i180 = src.indexOf("value: 'ASP:180'");
		const iDex = src.indexOf("value: 'HAND:dexter'");
		const iSin = src.indexOf("value: 'HAND:sinister'");
		expect(i180).toBeGreaterThan(-1);
		expect(iDex).toBeGreaterThan(i180);
		expect(iSin).toBeGreaterThan(iDex);
	});

	it('③ HAND: 分支匹配语义(命中方向行;无方向行不命中;既有维零回归)', () => {
		expect(pdPromFilterMatch('HAND:dexter', 'D_Venus_120')).toBe(true);
		expect(pdPromFilterMatch('HAND:dexter', 'S_Venus_120')).toBe(false);
		expect(pdPromFilterMatch('HAND:sinister', 'S_Mars_90')).toBe(true);
		expect(pdPromFilterMatch('HAND:sinister', 'D_Mars_90')).toBe(false);
		expect(pdPromFilterMatch('HAND:dexter', 'N_Sun_0')).toBe(false);
		expect(pdPromFilterMatch('HAND:sinister', 'A_Moon')).toBe(false);
		// 既有维零回归
		expect(pdPromFilterMatch('ASP:120', 'D_Venus_120')).toBe(true);
		expect(pdPromFilterMatch('ASP:0', 'N_Sun_0')).toBe(true);
		expect(pdPromFilterMatch('TYPE:anti', 'A_Moon')).toBe(true);
		expect(pdPromFilterMatch('Venus', 'D_Venus_120')).toBe(null); // 非扩展值交回星名 indexOf
	});
});
