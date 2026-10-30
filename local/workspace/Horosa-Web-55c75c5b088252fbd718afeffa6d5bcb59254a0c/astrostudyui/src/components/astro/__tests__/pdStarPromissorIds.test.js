/**
 * 恒星作迫星的行编号(后端出表):FS_<星>_0 合 / FS_<星>_180 冲 / FSD_<星>_θ 右相位 / FSS_<星>_θ 左相位。
 * 解析只在 primaryDirectionSync 一处;表格的类型列、相位 glyph、相位 / 方向 / 类型筛选,文本与短名都从它取。
 */
import { parsePdStarPointId, pdStarPointText, pdStarPointShort } from '../../../utils/primaryDirectionSync';
import { directionRowAspectHand, pdPromFilterMatch } from '../AstroPrimaryDirection';
import { glyphSegsOf } from '../../astro3d/pdTimelineMath';

describe('恒星迫星编号', () => {
	it('解析', () => {
		expect(parsePdStarPointId('FS_Sirius_0')).toEqual({ head: 'N', name: 'Sirius', deg: 0 });
		expect(parsePdStarPointId('FS_Sirius_180')).toEqual({ head: 'N', name: 'Sirius', deg: 180 });
		expect(parsePdStarPointId('FSD_Deneb Algedi_60')).toEqual({ head: 'D', name: 'Deneb Algedi', deg: 60 });
		expect(parsePdStarPointId('FSS_Spica_120')).toEqual({ head: 'S', name: 'Spica', deg: 120 });
		expect(parsePdStarPointId('D_Sun_60')).toBe(null);
		expect(parsePdStarPointId('FS')).toBe(null);
		expect(parsePdStarPointId(null)).toBe(null);
	});

	it('文本与短名与行星同一句式', () => {
		expect(pdStarPointText('FS_Sirius_0')).toBe('恒星 Sirius');
		expect(pdStarPointText('FS_Sirius_180')).toBe('恒星 Sirius的180度相位处');
		expect(pdStarPointText('FSD_Sirius_60', () => '天狼')).toBe('恒星 天狼的60度右相位处');
		expect(pdStarPointText('FSS_Sirius_90')).toBe('恒星 Sirius的90度左相位处');
		expect(pdStarPointText('N_Sun_0')).toBe(null);
		expect(pdStarPointShort('FSD_Sirius_60')).toBe('★Sirius右60°');
		expect(pdStarPointShort('FSS_Sirius_60')).toBe('★Sirius左60°');
		expect(pdStarPointShort('FS_Sirius_0')).toBe('★Sirius');
	});

	it('方向与筛选', () => {
		expect(directionRowAspectHand('FSD_Sirius_60')).toBe('dexter');
		expect(directionRowAspectHand('FSS_Sirius_60')).toBe('sinister');
		expect(directionRowAspectHand('FS_Sirius_0')).toBe(null);
		expect(pdPromFilterMatch('TYPE:star', 'FSD_Sirius_60')).toBe(true);
		expect(pdPromFilterMatch('TYPE:star', 'FS_Sirius_0')).toBe(true);
		expect(pdPromFilterMatch('TYPE:star', 'D_Sun_60')).toBe(false);
		expect(pdPromFilterMatch('ASP:60', 'FSS_Sirius_60')).toBe(true);
		expect(pdPromFilterMatch('ASP:180', 'FS_Sirius_180')).toBe(true);
		expect(pdPromFilterMatch('ASP:0', 'FS_Sirius_0')).toBe(true);
		expect(pdPromFilterMatch('ASP:0', 'FS_Sirius_180')).toBe(false);
		expect(pdPromFilterMatch('HAND:dexter', 'FSD_Sirius_60')).toBe(true);
	});

	it('时间轴章:星名 + 相位 glyph', () => {
		const segs = glyphSegsOf('FSD_Sirius_60');
		expect(segs[0]).toEqual({ t: '★Sirius', astro: false });
		expect(segs.length).toBe(2);
		expect(glyphSegsOf('FS_Sirius_0')).toEqual([{ t: '★Sirius', astro: false }]);
	});
});
