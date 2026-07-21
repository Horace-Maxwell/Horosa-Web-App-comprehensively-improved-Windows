import { Component } from 'react';
import { Row, Col, Divider, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import { buildMeaningTipByCategory, } from './AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from './AstroMeaningPopover';
import styles from '../../css/styles.less';
import { XQTable as Table } from '../xq-ui';
import { getFirdariaInterp } from '../../utils/firdariaInterp';
import { markPanelReady } from '../../utils/perfMark';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

class AstroFirdaria extends Component{

	constructor(props) {
		super(props);

		let columns = [{
			title: '主限',
			dataIndex: 'mainDirect',
			key: 'mainDirect',
			width: '20%',
			render: (text, record)=>{
				return this.planetText(text);
			},
		},{
			title: '子限',
			dataIndex: 'subDirect',
			key: 'subDirect',
			width: '20%',
			render: (text, record)=>{
				return this.planetText(text);
			},
		},{
			title: '日期',
			dataIndex: 'date',
			key: 'date',
			width: '60%',
			render: (text, record)=>{
				return text;
			},
		}];
		
		this.state = {
			columns: columns,
		}

			this.convertToDataSource = this.convertToDataSource.bind(this);
			this.genFirdariaDom = this.genFirdariaDom.bind(this);
			this.planetText = this.planetText.bind(this);
			this.showMeaning = this.showMeaning.bind(this);
		}

	// horosa_panel_ready_v1:本技法无自有请求 —— 法达运期表整份来自 chartObj.predictives.firdaria,
	// 「数据落定」就是拿到新盘对象后的这一次渲染提交(markPanelReady 内部再等双 rAF 逼近「已绘」)。
	// 故接在 componentDidUpdate 的 value 变更分支上,与带回调的技法同口径。
	componentDidUpdate(prevProps){
		if(prevProps.value !== this.props.value){
			markPanelReady('direction');
		}
	}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	planetText(id){
		const base = AstroText.AstroMsg[id] ? AstroText.AstroMsg[id] : `${id || ''}`;
		const text = appendPlanetHouseInfoById(
			base,
			this.props.value,
			id,
			this.props.showPlanetHouseInfo
		);
		const one = splitPlanetHouseInfoText(text);
		const labelNode = (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
				{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
			</span>
		);
		return wrapWithMeaning(labelNode, this.showMeaning(), buildMeaningTipByCategory('planet', id));
	}

	convertToDataSource(firdaria){
		if(firdaria === undefined || firdaria === null){
			return null;
		}

		let ds = [];
		for(let i=0; i<firdaria.subDirect.length; i++){
			let pd = firdaria.subDirect[i];
			let obj = {
				mainDirect: firdaria.mainDirect,
				subDirect: pd.subDirect,
				date: pd.date,
			}
			ds.push(obj);
		}
		return ds;
	}

	genFirdariaDom(ds){
		let dom = (
			<Table key='firdaria-table'
				dataSource={ds} 
				columns={this.state.columns} 
				rowKey='date'
				pagination={false}
				bordered size='small'
			/>					

		);
		return dom;
	}


	render(){
		let chart = this.props.value ? this.props.value : {};
		let predictives = chart.predictives ? chart.predictives : {};
		let firdaria = predictives.firdaria ? predictives.firdaria : [];

		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-70) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let doms = [];
		let rows = [];
		let rowobj = null;
		for(let i=0; i<firdaria.length; i++){
			if(i % 3 === 0){
				rowobj = [];
				rows.push(rowobj);
			}
			let pd = firdaria[i];
			let ds = this.convertToDataSource(pd);
			let tbldom = this.genFirdariaDom(ds);
			const interp = getFirdariaInterp(pd.mainDirect);
			const cell = (
				<div key={`firdaria-cell-${i}`}>
					{interp ? (
						<div style={{ fontSize: 11, opacity: 0.78, lineHeight: '16px', margin: '0 0 4px', padding: '4px 8px', background: 'var(--horosa-accent-soft, rgba(184,134,11,0.08))', borderRadius: 6 }}>
							<b>{interp.mainShort}主限</b> · {interp.mainTheme}
						</div>
					) : null}
					{tbldom}
				</div>
			);
			rowobj.push(cell);
		}

		for(let i=0; i<rows.length; i++){
			let rowobj = rows[i];
			let cols = [];
			for(let j=0; j<rowobj.length; j++){
				let dom = (
					<Col key={j} span={8}>{rowobj[j]}</Col>
				);
				cols.push(dom);
			}
			let dom = (
				<Row key={`row-${i}`} gutter={12}>
					{cols}
				</Row>
			);
			doms.push(dom);
			if(i < rows.length - 1){
				// Row 与 Divider 推进同一个 doms 数组，故各自带前缀避免同 i 撞键
				let divider = <Divider key={`divider-${i}`} dashed={true} />
				doms.push(divider)	
			}
		}

		return (
			<div className={styles.scrollbar} style={style} >
				{doms}
			</div>
		);
	}

}

export default AstroFirdaria;
