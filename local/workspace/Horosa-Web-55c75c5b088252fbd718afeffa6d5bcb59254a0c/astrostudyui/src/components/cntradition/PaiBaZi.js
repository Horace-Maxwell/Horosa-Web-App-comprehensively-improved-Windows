import { Component } from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { Row, Col, Divider } from 'antd';
import { XQButton as Button } from '../xq-ui';
import BaZiFineChart from './BaZiFineChart';
import BaZiAncientChart from './BaZiAncientChart';
import { BaZiMsg } from '../../msg/bazimsg';
import { randomStr,} from '../../utils/helper';
import styles from '../../css/styles.less';

export const BAZI_CHART_STYLE_KEY = 'baziChartStyle';

class PaiBaZi extends Component{
	constructor(props) {
		super(props);
		const savedStyle = localStorage.getItem(BAZI_CHART_STYLE_KEY);
		this.state = {
			id: 'div' + randomStr(8),
			chartStyle: savedStyle === 'fine' ? 'fine' : 'simple',
		};

		this.genDirDom = this.genDirDom.bind(this);
		this.genSubDirectDom = this.genSubDirectDom.bind(this);
		this.changeChartStyle = this.changeChartStyle.bind(this);
	}

	changeChartStyle(chartStyle){
		if(this.props.onChartStyleChange){
			this.props.onChartStyleChange(chartStyle);
			return;
		}
		this.setState({
			chartStyle,
		}, ()=>{
			safeLocalStorageSet(BAZI_CHART_STYLE_KEY, chartStyle);
		});
	}

	renderStyleButtons(chartStyle){
		const styles3 = [['simple', '简盘'], ['fine', '细盘'], ['ancient', '古法盘']];
		return (
			<div className="horosa-bazi-summary-style-actions" aria-label="盘式">
				{styles3.map(([style, label])=>(
					<button
						key={style}
						type="button"
						className={`horosa-bazi-summary-style-button ${chartStyle === style ? 'is-active' : ''}`}
						onClick={()=>this.changeChartStyle(style)}
					>
						{label}
					</button>
				))}
			</div>
		);
	}

	genDirDom(dirs, directTime){
		let doms = [];
		if(dirs && dirs.length){
			for(let i = 0; i<dirs.length; i++){
				let dir = dirs[i];
				let age = dir.age;
				let startYear = dir.startYear;
				let mainDirect = dir.mainDirect;
				let subdir = this.genSubDirectDom(dir.subDirect, startYear, age, mainDirect, directTime);
				let maindirDom = (
					<div key={randomStr(8)}>
						<Divider orientation='left'>{startYear + ' ' + mainDirect.ganzi + ' ' + mainDirect.naying}</Divider>
						<Row>
							{subdir}
						</Row>
					</div>
				);
				doms.push(maindirDom);
			}	
		}

		return doms;
	}

	genSubDirectDom(dir, startYear, age, mainDirect, directTime){
		let dirdoms0 = [];
		let dirdoms1 = [];
		for(let i=0; i<dir.length; i++){
			let sub = dir[i];
			let y = startYear + i;
			let dirtm = y;
			let gancol = (<Col key={randomStr(8)} span={4}>{sub.ganzi}</Col>);
			let nayingcol = (<Col key={randomStr(8)} span={6}>{sub.naying}</Col>);
			let tmcol = (<Col key={randomStr(8)} span={14}>{dirtm}&emsp;{age + i}周岁</Col>);
			let dom = (
				<Col key={randomStr(8)} span={24}>
					<Row>
						{gancol}
						{nayingcol}
						{tmcol}
					</Row>
				</Col>
			);
			if(i < 5){
				dirdoms0.push(dom);
			}else{
				dirdoms1.push(dom);
			}
		}
		let row0 = (
			<Col key={randomStr(8)} span={12}>
				<Row>{dirdoms0}</Row>
			</Col>
		)
		let row1 = (
			<Col key={randomStr(8)} span={12}>
				<Row>{dirdoms1}</Row>
			</Col>
		)
		let dirdoms = [row0, row1];
		return dirdoms;
	}

	render(){
		let fields = this.props.fields ? this.props.fields : {};
		let name = fields.name ? fields.name.value : null;
		let rec = this.props.value ? this.props.value : {};
		let height = this.props.height ? this.props.height : '100%';
		const chartStyle = this.props.chartStyle ? this.props.chartStyle : this.state.chartStyle;
		const isFine = chartStyle === 'fine';
		const isAncient = chartStyle === 'ancient';
		const showStyleSwitch = this.props.showStyleSwitch !== false;
		const measuredHeight = typeof height === 'number' ? `${height - (showStyleSwitch ? 100 : 8)}px` : height;
		let style = {
			height: measuredHeight,
			overflowY:'auto', 
			overflowX:'hidden',
			marginTop: showStyleSwitch ? 20 : 0,
		};

		let nongli = null;
		let realtm = null;
		let chef = null;
		let jiedelta = null;
		let extraLine = null;
		if(rec.nongli){
			let leap = rec.nongli.leap ? '闰' : '';
			nongli = `${rec.nongli.year}年${leap}${rec.nongli.month}${rec.nongli.day}`;
			const timeAlgVal = fields.timeAlg ? fields.timeAlg.value : 0;
			const timeAlgNames = { 0: '真太阳时', 1: '直接时间', 2: '春分定卯时', 3: '平太阳时' };
			const formClock = (fields.date && fields.time) ? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}` : '';
			const clockTm = rec.nongli.clockTime || formClock || rec.nongli.birth || '';
			const solarTm = rec.nongli.solarTime || rec.nongli.birth || '';
			// 三段各自不可内断:窄容器/极端长年份时在词组边界整段换行,不再把「真太阳时」拦腰割裂
			realtm = [`直接时间:${clockTm}`, `真太阳时:${solarTm}`, `计算基准:${timeAlgNames[timeAlgVal] || '真太阳时'}`];
			chef = rec.nongli.chef || '';
			jiedelta = rec.nongli.jiedelta || '';
		}

		let tiaohou = null;
		if(rec.tiaohou && rec.tiaohou.length){
			tiaohou = '调候：' + rec.tiaohou.join('，');
		}
		const detailParts = [jiedelta, chef].filter(Boolean);
		extraLine = detailParts.length ? detailParts.join('，') : '';
		if(extraLine && chef){
			extraLine += '；';
		}
		extraLine = [extraLine, tiaohou].filter(Boolean).join(' ');

		let dirdoms = this.genDirDom(rec.direction, rec.directTime);
		return (
			<div className={`horosa-bazi-scroll ${styles.scrollbar}`} style={style} id={this.state.id}>
				{showStyleSwitch ? (
					<div className="horosa-bazi-style-switch">
						<Button size="small" type={chartStyle === 'simple' ? 'primary' : 'default'} onClick={()=>this.changeChartStyle('simple')}>简盘</Button>
						<Button size="small" type={isFine ? 'primary' : 'default'} onClick={()=>this.changeChartStyle('fine')}>细盘</Button>
						<Button size="small" type={isAncient ? 'primary' : 'default'} onClick={()=>this.changeChartStyle('ancient')}>古法盘</Button>
					</div>
				) : null}
				<Row className="horosa-bazi-summary" style={{marginBottom: 10}}>
						<Col span={24}>
							<div className="horosa-bazi-summary-inner">
								<div className="horosa-bazi-summary-copy">
							<span style={{fontSize: 16, fontWeight: 'bold'}}>{BaZiMsg[rec.gender]}</span>&nbsp;
							<span>{name}</span>&nbsp;
							<span>农历:</span>
						<span>{nongli}</span>&nbsp;
						{Array.isArray(realtm) ? realtm.map((seg)=>(
							<span key={seg} style={{whiteSpace: 'nowrap', marginRight: 8, display: 'inline-block'}}>{seg}</span>
						)) : <span>{realtm}</span>}<br />
						<span>{extraLine}</span>
								</div>
								{this.renderStyleButtons(chartStyle)}
							</div>
						</Col>
					</Row>
				{isAncient ? (
					<BaZiAncientChart value={rec} fields={fields} />
				) : (
					<BaZiFineChart
						value={rec}
						fields={fields}
						mode={isFine ? 'fine' : 'simple'}
						flowSelection={this.props.flowSelection}
						showRelations={!(this.props.baziOpt && this.props.baziOpt.showRelations === false)}
						cangVersion={(this.props.baziOpt && this.props.baziOpt.cangVersion) || 'common'}
						onlyZiGanShen={!!(this.props.baziOpt && this.props.baziOpt.onlyZiGanShen)}
					/>
				)}
			</div>
		);
	}
}

export default PaiBaZi;
