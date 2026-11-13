// 辅盘实验页(变换盘 / 黄道制)右栏表格的单元格:行星字形按本色、黄经写成「星座符号 + 度分」。
// 调色板只在渲染时读(函数里现取 AstroColor,不缓存),切明暗跟着重画。
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';

const norm = (x)=>(((x % 360) + 360) % 360);
const ink = (id)=>{
	const c = AstroConst.AstroColor || {};
	return c[id] || c.Stroke || 'var(--horosa-text)';
};

export const AUX_TABLE_CLASS = 'horosa-aux-table';

// 占星字体的字面比标称字号小一圈,按 18px 取才和 12.5px 正文等高
const GLYPH = { fontFamily: AstroConst.AstroFont, fontSize: 18, lineHeight: 1, display: 'inline-block', width: 20, textAlign: 'center', verticalAlign: '-3px' };

export function planetName(id){
	return (AstroText.AstroMsgCN && AstroText.AstroMsgCN[id]) || id;
}

// 点:本色字形 + 中文名
export function pointCell(id){
	const glyph = (AstroText.AstroMsg && AstroText.AstroMsg[id]) || '';
	return (
		<span className="horosa-aux-point" style={{ whiteSpace: 'nowrap' }}>
			<span style={{ ...GLYPH, color: ink(id) }}>{glyph}</span>
			<span style={{ marginLeft: 6 }}>{planetName(id)}</span>
		</span>
	);
}

// 度分:16.715 → 16°43′(分四舍五入,进位到 60 时进一度)
export function degMin(value){
	const v = Number(value);
	if(!Number.isFinite(v)){ return '—'; }
	let d = Math.floor(v);
	let m = Math.round((v - d) * 60);
	if(m === 60){ d += 1; m = 0; }
	return `${d}°${String(m).padStart(2, '0')}′`;
}

// 黄经:回归十二座符号(本色)+ 座内度分;strong 时数字加粗(变换后那一列)
export function lonCell(lon, strong){
	const v = Number(lon);
	if(!Number.isFinite(v)){ return '—'; }
	const n = norm(v);
	const sign = AstroConst.LIST_SIGNS[Math.floor(n / 30) % 12];
	const glyph = (AstroText.AstroMsg && AstroText.AstroMsg[sign]) || '';
	const title = `${(AstroText.AstroTxtMsg && AstroText.AstroTxtMsg[sign]) || sign} · 黄经 ${n.toFixed(2)}°`;
	return (
		<span title={title} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
			<span style={{ ...GLYPH, fontSize: 17, color: ink(sign) }}>{glyph}</span>
			<span style={{ marginLeft: 4, fontWeight: strong ? 600 : 400 }}>{degMin(n % 30)}</span>
		</span>
	);
}

// 星座名 + 度分(不等分黄道 / 银河黄道这类没有符号的分段)
export function segCell(name, deg){
	if(!name){ return '—'; }
	return <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{name}<span style={{ marginLeft: 6, opacity: 0.85 }}>{degMin(deg)}</span></span>;
}

// 位移:变换后 − 本命,取 −180..180 的最短弧,带正负号
export function shiftCell(from, to){
	const a = Number(from);
	const b = Number(to);
	if(!Number.isFinite(a) || !Number.isFinite(b)){ return '—'; }
	const d = ((b - a + 540) % 360) - 180;
	if(Math.abs(d) < 0.005){ return <span className="horosa-aux-muted">不动</span>; }
	if(180 - Math.abs(d) < 0.005){ return <span className="horosa-aux-muted">对冲 180°</span>; }
	return <span className="horosa-aux-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{`${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}°`}</span>;
}

// 分组:七政与三王星 / 小行星与虚点 / 四轴。每组第一行上沿加一道分隔线
// (合并边框里行框要比格框宽才压得过,所以是 2px;tr 上的 box-shadow 在合并边框表里不画)
const ANGLES = ['Asc', 'Desc', 'MC', 'IC'];
const MAJOR = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
export function pointGroup(id){
	if(ANGLES.indexOf(id) >= 0){ return 'angles'; }
	return MAJOR.indexOf(id) >= 0 ? 'major' : 'minor';
}
export function groupRowStyle(rows){
	return (row, idx)=>(idx > 0 && pointGroup(rows[idx - 1].id) !== pointGroup(row.id) ? { borderTop: '2px solid rgba(214, 167, 85, 0.32)' } : undefined);
}
