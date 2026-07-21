import { Component } from 'react';
import { Row, Col, Popover, Divider } from 'antd';
import { BaZiMsg } from '../../msg/bazimsg';
import { birthMonthDayFromBazi, resolveStarCharger } from './starChargerLazy';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

function safeArray(value){
	return Array.isArray(value) ? value : [];
}

const ELEMENT_TOKEN = { wood: 'wood', fire: 'fire', earth: 'earth', metal: 'metal', water: 'water', 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };

function colorOf(cell){
	const el = cell && cell.element ? ELEMENT_TOKEN[cell.element] : '';
	return el ? `var(--horosa-bazi-${el})` : 'var(--horosa-text)';
}

function describeStemBranch(item){
	if(!item){
		return '';
	}
	return `${BaZiMsg[item.polar] || ''}${item.cell || ''}${BaZiMsg[item.element] || ''}•${BaZiMsg[item.relative] || item.relative || ''}`;
}

class SmallDirection extends Component{
	constructor(props) {
		super(props);
		this.state = {};
		this.genGods = this.genGods.bind(this);
		this.genGodsDom = this.genGodsDom.bind(this);
	}

	genGodsDom(rec){
		if(rec === undefined || rec === null){
			return null;
		}
		let cols = this.genGods(rec, '柱');
		let ganCols = this.genGods(rec.stem, '干');
		let ziCols = this.genGods(rec.branch, '支');
		let doms = [];
		[cols, ganCols, ziCols].forEach((c, ci)=>{ if(c){ doms.push(<Row key={`gods-${ci}`}>{c}</Row>); } });
		const taisuiGods = safeArray(rec.branch && rec.branch.taisuiGods);
		if(taisuiGods.length > 0){
			doms.push(<Row key="taisui"><Col span={24}><div>岁：&emsp;{taisuiGods.join('，')}</div></Col></Row>);
		}
		return doms.length > 0 ? doms : null;
	}

	genGods(rec, titleStr){
		if(rec === undefined || rec === null){
			return null;
		}
		let spans = [];
		safeArray(rec.goodGods).length && spans.push(safeArray(rec.goodGods).join('，'));
		safeArray(rec.neutralGods).length && spans.push(safeArray(rec.neutralGods).join('，'));
		safeArray(rec.badGods).length && spans.push(safeArray(rec.badGods).join('，'));
		if(spans.length > 0){
			return [<Col key={`gods-col-${titleStr}`} span={24}><div>{titleStr}：&emsp;{spans.join('，')}</div></Col>];
		}
		return null;
	}

	renderPillarChip(label, pillar, popTitle, popContent){
		const gz = (pillar && pillar.ganzi) || '';
		const stem = pillar && pillar.stem ? pillar.stem : null;
		const branch = pillar && pillar.branch ? pillar.branch : null;
		const naying = (pillar && pillar.naying) || '';
		return (
			<Popover content={popContent} title={popTitle}>
				<div className="horosa-bazi-xy-chip">
					<span className="horosa-bazi-xy-chip-label">{label}</span>
					<span className="horosa-bazi-xy-chip-gz">
						<b style={{ color: colorOf(stem) }}>{gz.charAt(0)}</b>
						<b style={{ color: colorOf(branch) }}>{gz.charAt(1)}</b>
					</span>
					{naying ? <em className="horosa-bazi-xy-chip-naying">{naying}</em> : null}
				</div>
			</Popover>
		);
	}

	render(){
		const rec = this.props.value ? this.props.value : {};
		const height = this.props.height ? this.props.height : '100%';
		const style = {
			height: typeof height === 'number' ? `${height - 130}px` : height,
			overflowY: 'auto',
			overflowX: 'hidden',
		};
		const dirs = safeArray(rec.smallDirection);
		// starCharger 惰性补算所需出生月/日（从 nongli.birth 解析）。
		const bmd = birthMonthDayFromBazi(rec);

		return (
			<div className={`${styles.scrollbar} horosa-bazi-xy-list`} style={style}>
				{dirs.map((dir, di)=>{
					const d = dir || {};
					const subdir = d.direct || {};
					const yeardir = d.yearGanzi || {};
					// 惰性 null 时按公历年补算（与 eager 逐字等价）。
					const starCharger = resolveStarCharger(yeardir.starCharger, yeardir.year != null ? yeardir.year : d.year, bmd.month, bmd.day);
					const popSub = (
						<div style={{ width: 320 }}>
							<div>{describeStemBranch(subdir.stem)}</div>
							<div>{describeStemBranch(subdir.branch)}</div>
							<Divider style={{ margin: '8px 0' }} />
							{this.genGodsDom(subdir)}
						</div>
					);
					const popYear = (
						<div style={{ width: 320 }}>
							<div>{describeStemBranch(yeardir.stem)}</div>
							<div>{describeStemBranch(yeardir.branch)}</div>
							<Divider style={{ margin: '8px 0' }} />
							{this.genGodsDom(yeardir)}
							<h4 style={{ marginTop: 6 }}>值年星宿：{starCharger.name || '暂无'}</h4>
							<div>{starCharger.event || ''}</div>
						</div>
					);
					return (
						<div className="horosa-bazi-xy-item" key={di}>
							{this.renderPillarChip('小运', subdir, `小运：${subdir.ganzi || ''}`, popSub)}
							{this.renderPillarChip('流年', yeardir, `流年：${yeardir.ganzi || ''} ${d.year || ''} ${d.age || ''}岁`, popYear)}
							<div className="horosa-bazi-xy-meta">
								<span className="horosa-bazi-xy-year">{d.year || ''}</span>
								<b className="horosa-bazi-xy-age">{d.age !== undefined ? `${d.age}周岁` : ''}</b>
							</div>
						</div>
					);
				})}
			</div>
		);
	}
}

export default SmallDirection;
