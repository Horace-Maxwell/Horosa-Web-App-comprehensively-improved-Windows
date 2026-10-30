import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { isMeaningEnabled, } from '../astro/AstroMeaningPopover';
import { composeShort } from '../../data/uranianMeanings';
import { midpointGlyph } from './midpointGlyph';
import styles from '../../css/styles.less';

// 「中点坐标」选赤经 / 赤纬时的右栏两表(后端 coordMidpoints):版式与黄经两表(Midpoint / AspectToMidpoint)同一套——
//   中点:按 30° 赤经段(赤纬按北 / 南)分组的卡片行,行 = A/B 字形对 ↔ 坐标值(等宽数字);
//   相位:按目标因子分组,行 = 接触符号 + (A/B 中点对) ↔ 误差。赤经接触用合 / 刑 / 冲字形,赤纬用 ∥ 平行 / ⥮ 反平行(同 90°盘赤纬接触)。
// 只是渲染,数值全取后端,不另算。
const SOFT = { color: 'var(--horosa-text-soft, rgba(120,120,120,0.85))' };
const ASPECT_TONE = {
	0: 'var(--horosa-accent, #b8860b)',
	90: 'var(--horosa-jx-xiong, #c0392b)',
	180: 'var(--horosa-jx-xiong, #c0392b)',
	parallel: 'var(--horosa-accent, #b8860b)',
	contraParallel: 'var(--horosa-jx-xiong, #c0392b)',
};
const ASPECT_TITLE = { 0: '合', 90: '刑', 180: '冲', parallel: '平行(同号)', contraParallel: '反平行(异号)' };
// 目标因子排序:与黄经相位表同序在前,其余(虚星等)按出现序随后
const TARGET_ORDER = [
	AstroConst.ASC, AstroConst.MC, AstroConst.DESC, AstroConst.IC,
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS,
	AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN,
	AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO,
	AstroConst.CHIRON, AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE,
	AstroConst.DARKMOON, AstroConst.PURPLE_CLOUDS, AstroConst.SYZYGY, AstroConst.PARS_FORTUNA,
];

const dms = (v)=>{
	const a = Math.abs(v);
	let d = Math.floor(a);
	let m = Math.round((a - d) * 60);
	if(m === 60){ d += 1; m = 0; }
	return `${d}°${m < 10 ? '0' : ''}${m}′`;
};
/** 坐标值文案:赤经 0–360° 度分;赤纬 北 / 南 + 度分。 */
export function coordValueText(coord, v){
	if(coord === 'decl'){ return `${v < 0 ? '南' : '北'} ${dms(v)}`; }
	return dms(((v % 360) + 360) % 360);
}

/** 中点分组:赤经按 30° 段(0°–30° …),赤纬按北 / 南(各自按绝对值由小到大)。 */
export function coordMidpointGroups(coord, midpoints){
	const list = Array.isArray(midpoints) ? midpoints : [];
	if(coord === 'decl'){
		const north = list.filter((m)=>m.value >= 0).sort((a, b)=>a.value - b.value);
		const south = list.filter((m)=>m.value < 0).sort((a, b)=>b.value - a.value);
		return [{ key: 'N', label: '北赤纬', rows: north }, { key: 'S', label: '南赤纬', rows: south }].filter((g)=>g.rows.length);
	}
	const gs = [];
	list.slice().sort((a, b)=>a.value - b.value).forEach((m)=>{
		const band = Math.min(11, Math.floor((((m.value % 360) + 360) % 360) / 30));
		let g = gs.length ? gs[gs.length - 1] : null;
		if(!g || g.band !== band){ g = { key: `b${band}`, band, label: `${band * 30}°–${band * 30 + 30}°`, rows: [] }; gs.push(g); }
		g.rows.push(m);
	});
	return gs;
}

/** 接触按目标因子分组(先 TARGET_ORDER,其余按出现序);planetDisplay 只筛 TARGET_ORDER 里的常规点(同黄经相位表)。 */
export function coordContactGroups(contacts, planetDisplay){
	const shown = Array.isArray(planetDisplay) ? new Set(planetDisplay) : null;
	const by = new Map();
	(Array.isArray(contacts) ? contacts : []).forEach((c)=>{
		if(shown && TARGET_ORDER.indexOf(c.id) >= 0 && !shown.has(c.id)){ return; }
		if(!by.has(c.id)){ by.set(c.id, []); }
		by.get(c.id).push(c);
	});
	const ids = TARGET_ORDER.filter((id)=>by.has(id)).concat([...by.keys()].filter((id)=>TARGET_ORDER.indexOf(id) < 0));
	return ids.map((id)=>({ id, rows: by.get(id).slice().sort((a, b)=>a.delta - b.delta) }));
}

class CoordMidpoint extends Component{

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	header(key, glyphNode, label, count){
		return (
			<div key={`h-${key}`} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 4px', paddingBottom: 3,
				borderBottom: '1px solid var(--horosa-border-soft, rgba(120,120,120,0.22))' }}>
				{glyphNode}
				<span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
				<span className="horosa-panel-count">{count}</span>
			</div>
		);
	}

	rowStyle(alt){
		return { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
			padding: '3px 10px', borderRadius: 6, lineHeight: 1.8,
			background: alt ? 'var(--horosa-table-row-alt, rgba(120,120,120,0.06))' : 'transparent' };
	}

	pair(idA, idB){
		const sm = this.showMeaning();
		return (
			<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
				{midpointGlyph(idA, sm)}
				<span style={{ ...SOFT, fontSize: 12 }}>/</span>
				{midpointGlyph(idB, sm)}
			</span>
		);
	}

	aspectMark(aspect){
		const tone = ASPECT_TONE[aspect] || 'inherit';
		const title = ASPECT_TITLE[aspect];
		if(aspect === 'parallel' || aspect === 'contraParallel'){
			return <span title={title} style={{ fontWeight: 600, color: tone, minWidth: '1.1em', textAlign: 'center' }}>{aspect === 'parallel' ? '∥' : '⥮'}</span>;
		}
		return <span title={title} style={{ fontFamily: AstroConst.AstroFont, fontWeight: 600, color: tone }}>{AstroText.AstroMsg['Asp' + aspect]}</span>;
	}

	renderMidpoints(coord, midpoints){
		const gs = coordMidpointGroups(coord, midpoints);
		if(!gs.length){ return <div style={{ ...SOFT, fontSize: 12, padding: '6px 10px' }}>没有可列的中点</div>; }
		return gs.map((g)=>(
			<div key={g.key} style={{ marginBottom: 10 }}>
				{this.header(g.key, null, g.label, g.rows.length)}
				{g.rows.map((m, i)=>(
					<div key={`${g.key}-${i}`} title={composeShort(m.idA, m.idB)} style={this.rowStyle(i % 2 === 1)}>
						{this.pair(m.idA, m.idB)}
						<span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{coordValueText(coord, m.value)}</span>
					</div>
				))}
			</div>
		));
	}

	renderContacts(coord, contacts){
		const gs = coordContactGroups(contacts, this.props.planetDisplay);
		if(!gs.length){
			return <div style={{ ...SOFT, fontSize: 12, padding: '6px 10px' }}>容许度内没有星体落在{coord === 'ra' ? '赤经' : '赤纬'}中点上</div>;
		}
		const sm = this.showMeaning();
		const out = [];
		gs.forEach((g)=>{
			out.push(this.header(g.id, midpointGlyph(g.id, sm), AstroText.AstroMsgCN[g.id] || (AstroText.AstroTxtMsg && AstroText.AstroTxtMsg[g.id]) || g.id, g.rows.length));
			g.rows.forEach((c, i)=>{
				const tight = c.delta <= 0.1;
				const weak = c.delta > 0.5;
				out.push(
					<div key={`${g.id}-${i}`} title={composeShort(c.idA, c.idB)} style={{ ...this.rowStyle(i % 2 === 1), padding: '2px 10px' }}>
						<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
							{this.aspectMark(c.aspect)}
							<span style={{ ...SOFT, fontSize: 12 }}>（</span>
							{this.pair(c.idA, c.idB)}
							<span style={{ ...SOFT, fontSize: 12 }}>）</span>
						</span>
						<span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 12,
							fontWeight: tight ? 600 : 400, color: weak ? SOFT.color : 'inherit' }}>
							{Math.round(c.delta * 1000) / 1000}°
						</span>
					</div>
				);
			});
		});
		return out;
	}

	render(){
		const cm = this.props.value || {};
		const coord = cm.coord === 'decl' ? 'decl' : 'ra';
		const contactsView = this.props.view === 'contacts';
		const unit = coord === 'ra' ? '赤经' : '赤纬';
		return (
			<div className={styles.scrollbar} style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '6px 14px 12px 12px' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, ...SOFT, padding: '0 10px 2px' }}>
					<span>{contactsView ? `${unit}接触 ·（中点对）` : `中点对（${unit}）`}</span>
					<span>{contactsView ? '误差°' : unit}</span>
				</div>
				{contactsView ? this.renderContacts(coord, cm.contacts) : this.renderMidpoints(coord, cm.midpoints)}
			</div>
		);
	}

}

export default CoordMidpoint;
