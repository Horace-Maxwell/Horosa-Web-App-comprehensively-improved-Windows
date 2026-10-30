import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { buildMeaningTipByCategory, } from '../astro/AstroMeaningData';
import { wrapWithMeaning, } from '../astro/AstroMeaningPopover';
import { tnpGlyph } from './UranianGlyphs';

// 中点表格里的因子字形(行星中点页「中点 / 相位」与「中点坐标」各表共用):
//   虚星(TNP)在 ywastro 字体无字符 → AstroMsg[id] 为 undefined 渲染成空白;
//   与 90°盘 glyphOf 同链:SVG 字形优先 → 字体字形 → 缩写兜底,任何 id 不再留白。
export function midpointGlyph(id, showMeaning){
	const svg = tnpGlyph(id, 14);
	const node = svg
		? <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: '-0.15em' }}>{svg}</span>
		: (AstroText.AstroMsg[id]
			? <span style={{ fontFamily: AstroConst.AstroFont }}>{AstroText.AstroMsg[id]}</span>
			: <span style={{ fontWeight: 600, letterSpacing: '0.3px', fontSize: 12 }}>{AstroText.isUranian(id) ? AstroText.uranianGlyph(id) : (AstroText.AstroMsgCN[id] || id)}</span>);
	return wrapWithMeaning(node, showMeaning, buildMeaningTipByCategory('planet', id));
}
