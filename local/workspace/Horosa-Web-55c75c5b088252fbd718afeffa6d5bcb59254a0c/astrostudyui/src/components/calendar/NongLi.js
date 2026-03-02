import { Component } from 'react';
import { Row, Col, Tabs, } from 'antd';
import { randomStr } from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import NongLiDate from './NongLiDate';
import {Week} from '../../msg/types';
import DateTime from '../comp/DateTime';

class NongLi extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.titleBackground = '#fefeef';
		this.weekBackground = '#fefeef';
		this.otherDaysColor = '';
		this.daysColor = '#3b3b3b';

		this.genDateCol = this.genDateCol.bind(this);
		this.genDaysDom = this.genDaysDom.bind(this);
		this.getMonth = this.getMonth.bind(this);

		this.onDateClick = this.onDateClick.bind(this);
	}

	onDateClick(date){
		if(this.props.onDateClick){
			this.props.onDateClick(date);
		}
	}

	getMonth(date){
		let dt = new DateTime();
		dt = dt.parse(date.birth, 'yyyy-MM-dd HH:mm:ss');
		return dt.month;
	}

	genDateCol(date, ord, focusDate){
		let span = 3;
		if(ord === 0 || ord === 6){
			span = 4;
		}
		let style={
			textAlign: 'center',
			padding: 5,
			margin: 2,
			width: '100%',
		};
		let hightlight = false;
		let parts = date.birth.split(' ');
		if(focusDate && focusDate === parts[0]){
			hightlight = true;
		}
		let col = (
			<Col key={randomStr(8)} span={span} style={style}>
				<NongLiDate 						
					date={date}
					hightLight={hightlight}
					onClick={this.onDateClick}
				/>
			</Col>
		);
		return col;
	}

	genDaysDom(){
		let days = this.props.days;
		if(days.length === 0){
			return null;
		}

		let focusDate = null;
		if(this.props.focusDate){
			focusDate = this.props.focusDate.format('YYYY-MM-DD');
		}

		let prevdays = this.props.prevDays;
		let first = days[0].dayOfWeek;
		let resdays = [];
		for(let i=first-1; i>=0; i--){
			let obj = prevdays[i];
			obj.isOther = true;
			resdays.push(obj);
		}
		let len = 42 - resdays.length;
		let month = this.getMonth(days[0]);
		for(let i=0; i<len; i++){
			let obj = days[i];
			if(obj === undefined || obj === null){
				break;
			}
			let m = this.getMonth(obj);
			if(m === month){
				obj.isOther = false;
			}else{
				obj.isOther = true;
			}
			resdays.push(obj);
		}


		let row0cols = [];
		for(let i=0; i<7; i++){
			let col = this.genDateCol(resdays[i], i%7, focusDate);
			row0cols.push(col);
		}

		let row1cols = [];
		for(let i=7; i<14; i++){
			let col = this.genDateCol(resdays[i], i%7, focusDate);
			row1cols.push(col);
			
		}

		let row2cols = [];
		for(let i=14; i<21; i++){
			let col = this.genDateCol(resdays[i], i%7, focusDate);
			row2cols.push(col);
			
		}

		let row3cols = [];
		for(let i=21; i<28; i++){
			let col = this.genDateCol(resdays[i], i%7, focusDate);
			row3cols.push(col);
			
		}

		let row4cols = [];
		for(let i=28; i<35; i++){
			let col = this.genDateCol(resdays[i], i%7, focusDate);
			row4cols.push(col);			
		}

		let row5cols = [];
		for(let i=35; i<resdays.length; i++){
			let col = this.genDateCol(resdays[i], i%7, focusDate);
			row5cols.push(col);			
		}

		let rows = [row0cols, row1cols, row2cols, row3cols, row4cols];
		if(resdays[35].isOther === false){
			rows.push(row5cols);
		}

		let doms = rows.map((item, idx)=>{
			return (
				<Row gutter={12} key={randomStr(8)} style={{marginTop:3}}>
					{item}
				</Row>
			);
		});

		return doms;
	}


	render(){
		let height = this.props.height ? this.props.height : '100%';
		let titleStyle={
			textAlign: 'center',
			fontWeight: 'bold',
			fontSize: 20,
			backgroundColor: this.titleBackground,
			padding: 5,
			margin: 2,
		};
		let weekStyle={
			textAlign: 'center',
			fontWeight: 'bold',
			fontSize: 16,
			backgroundColor: this.weekBackground,
			padding: 5,
			margin: 2,
			width: '100%',
		};

		let dt = this.props.date.format('YYYY-MM');

		let daysdom = this.genDaysDom();

		return (
			<div style={{height: height}}>
				<Row>
					<Col span={24} style={titleStyle}>{dt}</Col>
				</Row>
				<Row gutter={12}>
					<Col span={4} style={weekStyle}>{Week['0']}</Col>
					<Col span={3} style={weekStyle}>{Week['1']}</Col>
					<Col span={3} style={weekStyle}>{Week['2']}</Col>
					<Col span={3} style={weekStyle}>{Week['3']}</Col>
					<Col span={3} style={weekStyle}>{Week['4']}</Col>
					<Col span={3} style={weekStyle}>{Week['5']}</Col>
					<Col span={4} style={weekStyle}>{Week['6']}</Col>
				</Row>
				<div>
					{daysdom}
				</div>

			</div>
		);
	}
}

export default NongLi;
