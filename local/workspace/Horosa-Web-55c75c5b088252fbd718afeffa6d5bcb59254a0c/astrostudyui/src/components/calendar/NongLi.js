import { Component } from 'react';
import NongLiDate from './NongLiDate';
import {Week} from '../../msg/types';
import DateTime from '../comp/DateTime';

class NongLi extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};
		this.otherDaysColor = '';
		this.daysColor = 'var(--horosa-text, #3b3b3b)';

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

	// 行循环按固定 42 格索引取数;days/prevDays 短缺时(如 prevDays 未就绪)对应格为
	// undefined,直接进 genDateCol 会在 date.birth 上抛错白屏 → 以空占位格兜底。
	genDateColSafe(resdays, i, focusDate){
		const obj = resdays[i];
		if(obj === undefined || obj === null){
			return (<div key={`nl-empty-${i}`} className="horosa-calendar-cell-wrap" />);
		}
		return this.genDateCol(obj, i % 7, focusDate);
	}

	genDateCol(date, ord, focusDate){
		let hightlight = false;
		let parts = date.birth.split(' ');
		if(focusDate && focusDate === parts[0]){
			hightlight = true;
		}
		let col = (
			// key 用日期本身:randomStr 每次渲染都变,整列子树反复重挂(丢状态+白耗)
			<div key={date.birth} className={`horosa-calendar-cell-wrap ${ord === 0 || ord === 6 ? 'is-weekend' : ''}`}>
				<NongLiDate
					date={date}
					hightLight={hightlight}
					onClick={this.onDateClick}
					extra={this.props.dayExtra ? this.props.dayExtra(date) : null}
				/>
			</div>
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

		let prevdays = this.props.prevDays || [];
		let first = days[0].dayOfWeek;
		let resdays = [];
		for(let i=first-1; i>=0; i--){
			let obj = prevdays[i];
			// prevDays 尚未就绪/长度不足时跳过补位格,别抛错(后一个 days 循环本就有同款守卫)
			if(obj === undefined || obj === null){
				continue;
			}
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
			let col = this.genDateColSafe(resdays, i, focusDate);
			row0cols.push(col);
		}

		let row1cols = [];
		for(let i=7; i<14; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row1cols.push(col);
			
		}

		let row2cols = [];
		for(let i=14; i<21; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row2cols.push(col);
			
		}

		let row3cols = [];
		for(let i=21; i<28; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row3cols.push(col);
			
		}

		let row4cols = [];
		for(let i=28; i<35; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row4cols.push(col);			
		}

		let row5cols = [];
		for(let i=35; i<resdays.length; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row5cols.push(col);			
		}

		let rows = [row0cols, row1cols, row2cols, row3cols, row4cols];
		if(resdays[35] && resdays[35].isOther === false){
			rows.push(row5cols);
		}

		const cells = rows.reduce((acc, item) => acc.concat(item), []);

		return (
			<div className='horosa-calendar-grid'>
				{cells}
			</div>
		);
	}


	render(){
		let height = this.props.height ? this.props.height : '100%';
		let dt = this.props.date.format('YYYY-MM');

		let daysdom = this.genDaysDom();

		return (
			<div className='horosa-lunar-calendar' style={{height: height}}>
				<div className='horosa-calendar-title'>{dt}</div>
				<div className='horosa-calendar-week-row'>
					<div>{Week['0']}</div>
					<div>{Week['1']}</div>
					<div>{Week['2']}</div>
					<div>{Week['3']}</div>
					<div>{Week['4']}</div>
					<div>{Week['5']}</div>
					<div>{Week['6']}</div>
				</div>
				{daysdom}

			</div>
		);
	}
}

export default NongLi;
