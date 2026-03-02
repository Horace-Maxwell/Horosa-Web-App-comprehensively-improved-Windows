import { Component } from 'react';
import { Row, Col, Table, Divider, } from 'antd';
import {randomStr} from '../../utils/helper';
import AstroObjectLabel from './AstroObjectLabel';
import {TableOddRowBgColor} from '../../utils/constants'
import styles from '../../css/styles.less';

class AstroFirdaria extends Component{

	constructor(props) {
		super(props);
		this.renderPlanetLabel = this.renderPlanetLabel.bind(this);

		let columns = [{
			title: '主限',
			dataIndex: 'mainDirect',
			key: 'mainDirect',
			width: '20%',
			render: (text, record)=>{
				return this.renderPlanetLabel(text);
			},
		},{
			title: '子限',
			dataIndex: 'subDirect',
			key: 'subDirect',
			width: '20%',
			render: (text, record)=>{
				return this.renderPlanetLabel(text);
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
	}

	renderPlanetLabel(id){
		return (
			<AstroObjectLabel
				id={id}
				chartSources={this.props.value}
			/>
		);
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
			<Table key={randomStr(8)}
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
			rowobj.push(tbldom);
		}

		for(let i=0; i<rows.length; i++){
			let rowobj = rows[i];
			let cols = [];
			for(let j=0; j<rowobj.length; j++){
				let dom = (
					<Col key={randomStr(8)} span={8}>{rowobj[j]}</Col>
				);
				cols.push(dom);
			}
			let dom = (
				<Row key={randomStr(8)} gutter={12}>
					{cols}
				</Row>
			);
			doms.push(dom);
			if(i < rows.length - 1){
				let divider = <Divider key={randomStr(8)} dashed={true} />
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
