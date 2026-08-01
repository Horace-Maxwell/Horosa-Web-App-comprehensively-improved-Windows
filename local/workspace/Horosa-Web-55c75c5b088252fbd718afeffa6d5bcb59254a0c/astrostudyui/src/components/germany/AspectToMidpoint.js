import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { buildMeaningTipByCategory, buildAspectMeaningTip, } from '../astro/AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from '../astro/AstroMeaningPopover';
import { composeShort } from '../../data/uranianMeanings';
import { tnpGlyph } from './UranianGlyphs';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

// 中点相位(「行星中点」Tab 右栏「相位」页):按目标因子分组的卡片行——
//   组头 = 因子字形 + 中文名 + 命中数徽章;行 = 相位符号(合金/刑冲红) + (A/B 中点对) ↔ 误差(等宽数字,右对齐)。
// 误差色阶:≤0.1° 极紧加重(最有力接触);>0.5° 转灰弱化。数据/筛选(planetDisplay)口径零变,纯渲染美化。
const LIST_POINTS = [
    AstroConst.ASC, AstroConst.MC, AstroConst.DESC, AstroConst.IC,
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS,
	AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN,
	AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO,
	AstroConst.CHIRON, AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE,
	AstroConst.DARKMOON, AstroConst.PURPLE_CLOUDS, AstroConst.SYZYGY, AstroConst.PARS_FORTUNA
]

const SOFT = { color: 'var(--horosa-text-soft, rgba(120,120,120,0.85))' };
// 相位符号着色随全站口径:合=强调金(最强接触),刑/冲=凶红(硬张力)。
const ASPECT_TONE = {
	0: 'var(--horosa-accent, #b8860b)',
	90: 'var(--horosa-jx-xiong, #c0392b)',
	180: 'var(--horosa-jx-xiong, #c0392b)',
};

let planets = new Set()

class AspectToMidpoint extends Component{

	constructor(props) {
		super(props);
		this.state = {};
		this.glyph = this.glyph.bind(this);
		this.aspRow = this.aspRow.bind(this);
		this.showMeaning = this.showMeaning.bind(this);
	}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	glyph(id){
		// 与 Midpoint.js 同修:虚星在字体无字符致空白 → SVG 字形优先 → 字体 → 缩写兜底。
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

	aspRow(targetId, asp, key, alt){
		const delta = Math.round(asp.delta * 1000) / 1000;
		const tight = asp.delta <= 0.1;
		const weak = asp.delta > 0.5;
		return (
			<div key={key} title={composeShort(asp.idA, asp.idB)}
				style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
					padding: '2px 10px', borderRadius: 6, lineHeight: 1.8,
					background: alt ? 'var(--horosa-row-alt, rgba(120,120,120,0.06))' : 'transparent' }}>
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
					{wrapWithMeaning(
						<span style={{ fontFamily: AstroConst.AstroFont, fontWeight: 600, color: ASPECT_TONE[asp.aspect] || 'inherit' }}>{AstroText.AstroMsg['Asp' + asp.aspect]}</span>,
						this.showMeaning(),
						buildAspectMeaningTip(asp.aspect, { id: targetId }, { id: asp.idA })
					)}
					<span style={{ ...SOFT, fontSize: 12 }}>（</span>
					{this.glyph(asp.idA)}
					<span style={{ ...SOFT, fontSize: 12 }}>/</span>
					{this.glyph(asp.idB)}
					<span style={{ ...SOFT, fontSize: 12 }}>）</span>
				</span>
				<span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 12,
					fontWeight: tight ? 600 : 400,
					color: weak ? 'var(--horosa-text-soft, rgba(120,120,120,0.85))' : 'inherit' }}>
					{delta}°
				</span>
			</div>
		);
	}

	genAspDom(aspects){
		if(aspects === undefined || aspects === null){
			return null;
		}
		const divs = [];
		for(let i = 0; i < LIST_POINTS.length; i++){
			const key = LIST_POINTS[i];
			const obj = aspects[key];
			if(obj === undefined || obj === null || !planets.has(key)){
				continue;
			}
			divs.push(
				<div key={`h-${key}`} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 4px', paddingBottom: 3,
					borderBottom: '1px solid var(--horosa-border-soft, rgba(120,120,120,0.22))' }}>
					{wrapWithMeaning(
						<span style={{ fontFamily: AstroConst.AstroFont }}>{AstroText.AstroMsg[key]}</span>,
						this.showMeaning(),
						buildMeaningTipByCategory('planet', key)
					)}
					<span style={{ fontSize: 12, fontWeight: 600 }}>{AstroText.AstroMsgCN[key] || key}</span>
					<span className="horosa-panel-count">{obj.length}</span>
				</div>
			);
			for(let idx = 0; idx < obj.length; idx++){
				divs.push(this.aspRow(key, obj[idx], `a-${key}-${idx}`, idx % 2 === 1));
			}
		}
		return divs;
	}

	render(){
		if(this.props.planetDisplay){
			planets = new Set();
			for(let i=0; i<this.props.planetDisplay.length; i++){
				planets.add(this.props.planetDisplay[i]);
			}
		}

		const height = this.props.height ? this.props.height : '100%';
		const style = {
			height: (height - 180) + 'px',
			overflowY: 'auto',
			overflowX: 'hidden',
			// 安全边距:分组头/行底色条/顶部列注与容器边缘留距,不贴 Tab 卡边框。
			padding: '6px 14px 12px 12px',
		};

		const dom = this.genAspDom(this.props.value);

		return (
			<div className={styles.scrollbar} style={style}>
				<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, ...SOFT, padding: '0 10px 2px' }}>
					<span>相位 ·（中点对）</span>
					<span>误差°</span>
				</div>
				{dom}
			</div>
		);
	}

}

export default AspectToMidpoint;
