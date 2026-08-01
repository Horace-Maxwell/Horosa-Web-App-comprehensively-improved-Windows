import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from '../astro/AstroHelper';
import { buildMeaningTipByCategory, } from '../astro/AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from '../astro/AstroMeaningPopover';
import { composeShort } from '../../data/uranianMeanings';
import { tnpGlyph } from './UranianGlyphs';
import styles from '../../css/styles.less';

// 中点列表(「行星中点」Tab 右栏):按星座分组的卡片行——
//   组头 = 星座字形(星座色) + 中文名 + 数量徽章;行 = A/B 字形对(左) ↔ 位置(度·星座字形·分,等宽数字) + 界主徽章(右)。
// 数据与口径零变(仍按后端 midpoints 原序渲染,组=连续同星座段),纯渲染美化;
// 悬浮=中点对造句义(既有 composeShort),因子/星座 meaning tip 全保留。
const SOFT = { color: 'var(--horosa-text-soft, rgba(120,120,120,0.85))' };
const PILL = {
	fontSize: 11, lineHeight: '16px', padding: '0 6px', borderRadius: 8, whiteSpace: 'nowrap',
	border: '1px solid var(--horosa-border-soft, rgba(120,120,120,0.28))',
	color: 'var(--horosa-text-soft, rgba(120,120,120,0.85))',
};

class Midpoint extends Component{

	constructor(props) {
		super(props);
		this.state = {};
		this.glyph = this.glyph.bind(this);
		this.rowDom = this.rowDom.bind(this);
		this.showMeaning = this.showMeaning.bind(this);
	}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	glyph(id){
		// 虚星(TNP)在 ywastro 字体无字符 → AstroMsg[id] 为 undefined 渲染成空白;
		// 与 90°盘 glyphOf 同链:SVG 字形优先 → 字体字形 → 缩写兜底,任何 id 不再留白。
		const svg = tnpGlyph(id, 14);
		const node = svg
			? <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: '-0.15em' }}>{svg}</span>
			: (AstroText.AstroMsg[id]
				? <span style={{ fontFamily: AstroConst.AstroFont }}>{AstroText.AstroMsg[id]}</span>
				: <span style={{ fontWeight: 600, letterSpacing: '0.3px', fontSize: 12 }}>{AstroText.isUranian(id) ? AstroText.uranianGlyph(id) : (AstroText.AstroMsgCN[id] || id)}</span>);
		return wrapWithMeaning(
			node,
			this.showMeaning(),
			buildMeaningTipByCategory('planet', id)
		);
	}

	rowDom(obj, key, alt){
		const degs = AstroHelper.splitDegree(obj.signlon);
		const term = AstroHelper.whichTerm(obj.sign, obj.signlon);
		const sigColor = (AstroConst.AstroColor && AstroConst.AstroColor[obj.sign]) || 'inherit';
		return (
			<div key={key} title={composeShort(obj.idA, obj.idB)}
				style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
					padding: '3px 10px', borderRadius: 6, lineHeight: 1.8,
					background: alt ? 'var(--horosa-row-alt, rgba(120,120,120,0.06))' : 'transparent' }}>
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
					{this.glyph(obj.idA)}
					<span style={{ ...SOFT, fontSize: 12 }}>/</span>
					{this.glyph(obj.idB)}
				</span>
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
					<span style={{ fontVariantNumeric: 'tabular-nums' }}>
						{degs[0]}°
						{wrapWithMeaning(
							// 星座字形固定等宽槽:窄字形(狮子)不再与数字粘连,宽窄字形占位一致→整列对齐。
							<span style={{ fontFamily: AstroConst.AstroFont, color: sigColor, display: 'inline-block', minWidth: '1.35em', textAlign: 'center', margin: '0 1px' }}>{AstroText.AstroMsg[obj.sign]}</span>,
							this.showMeaning(),
							buildMeaningTipByCategory('sign', obj.sign)
						)}
						{degs[1]}′
					</span>
					<span style={PILL}><span style={{ fontFamily: AstroConst.AstroFont }}>{term}</span> 界</span>
				</span>
			</div>
		);
	}

	// 连续同星座段成组(midpoints 已按黄经排序,同星座必连续——与旧分段逻辑同构)。
	groups(midpoints){
		if(midpoints === undefined || midpoints === null || midpoints.length === 0){
			return [];
		}
		const gs = [];
		let cur = null;
		midpoints.forEach((m) => {
			if(!cur || cur.sign !== m.sign){ cur = { sign: m.sign, rows: [] }; gs.push(cur); }
			cur.rows.push(m);
		});
		return gs;
	}

	render(){
		const height = this.props.height ? this.props.height : '100%';
		const style = {
			height: (height - 180) + 'px',
			overflowY: 'auto',
			overflowX: 'hidden',
			// 安全边距:分组头/行底色条与容器边缘留距,不贴 Tab 卡边框。
			padding: '6px 14px 12px 12px',
		};
		const gs = this.groups(this.props.value);

		return (
			<div className={styles.scrollbar} style={style}>
				{gs.map((g, gi) => (
					<div key={`g-${g.sign}-${gi}`} style={{ marginBottom: 10 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0 4px', paddingBottom: 3,
							borderBottom: '1px solid var(--horosa-border-soft, rgba(120,120,120,0.22))' }}>
							<span style={{ fontFamily: AstroConst.AstroFont, color: (AstroConst.AstroColor && AstroConst.AstroColor[g.sign]) || 'inherit' }}>{AstroText.AstroMsg[g.sign]}</span>
							<span style={{ fontSize: 12, fontWeight: 600 }}>{AstroText.AstroMsgCN[g.sign] || g.sign}</span>
							<span className="horosa-panel-count">{g.rows.length}</span>
						</div>
						{g.rows.map((m, i) => this.rowDom(m, `m-${gi}-${i}`, i % 2 === 1))}
					</div>
				))}
			</div>
		);
	}

}

export default Midpoint;
