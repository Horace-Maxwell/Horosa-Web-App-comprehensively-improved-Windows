// 量化盘各盘面(折叠盘 / 模数盘 / 宇宙图 / 六宫框轮)共用的几何与提示小工具,单一来源。
import * as AstroText from '../../constants/AstroText';
import { factorLabel } from '../../data/uranianMeanings';

export const TAU = Math.PI * 2;
export const norm360 = (x) => ((x % 360) + 360) % 360;
// 逆时针(0°在正上、度数向左增)，与全站星盘一致(AstroChartCircle.signsBand 用负角=逆时针)。
export const polar = (cx, cy, R, deg) => { const a = deg / 360 * TAU; return [cx - R * Math.sin(a), cy - R * Math.cos(a)]; };
// 字形 hover 名(增强):原名 · 因子义(factorLabel 缺则只剩原名)。
export const glyphTip = (id) => { const n = AstroText.AstroMsgCN[id] || id; const lab = factorLabel(id); return lab && lab !== n ? n + ' · ' + lab : n; };
