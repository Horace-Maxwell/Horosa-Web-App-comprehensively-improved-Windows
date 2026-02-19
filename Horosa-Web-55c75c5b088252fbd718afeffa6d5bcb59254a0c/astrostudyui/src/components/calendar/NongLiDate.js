import { Component } from 'react';
import { Row, Col, Popover, } from 'antd';
import { randomStr } from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import DateTime from '../comp/DateTime';

class NongLiDate extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.gongliColor = '#000';
		this.nongliColor = '#3b3b3b';
		this.otherColor = '#bfbfbf';
		this.weekenColor = '#ff0000';

		this.genGongliDom = this.genGongliDom.bind(this);
		this.genNongliDom = this.genNongliDom.bind(this);
		this.genPopContent = this.genPopContent.bind(this);
		this.genPopTitle = this.genPopTitle.bind(this); 

		this.onClick = this.onClick.bind(this);
	}

	onClick(){
		if(this.props.onClick){
			this.props.onClick(this.props.date);
		}
	}

	genGongliDom(date){
		let birth = date.birth;
		let dt = new DateTime();
		dt = dt.parse(birth, 'yyyy-MM-dd HH:mm:ss');
		let dstr = dt.date + '';
		if(dstr.indexOf('0') === 0){
			dstr = dstr.substr(1, 1);
		}
		let style={
			textAlign: 'center',
			fontWeight: 'bold',
			fontSize: 16,
			color: this.props.date.isOther ? this.otherColor : this.gongliColor,
		};
		if((date.dayOfWeek === 0 || date.dayOfWeek === 6) && !this.props.date.isOther){
			style.color = this.weekenColor;
		}
		let dom = (
			<span style={style}>{dstr}</span>
		);

		return dom

	}

	genNongliDom(date){
		let day = date.day;
		if(date.dayInt === 1){
			day = date.month;
		}
		if(date.jieqi){
			day = date.jieqi;
		}
		let style={
			textAlign: 'center',
			fontSize: 12,
			color: this.props.date.isOther ? this.otherColor : this.nongliColor,
			width: '100%',
		};
		if((date.dayOfWeek === 0 || date.dayOfWeek === 6) && !this.props.date.isOther){
			style.color = this.weekenColor;
		}
		let dom = (
			<span style={style}>{day}</span>
		);

		return dom
	}

	genPopContent(date){
		let month = date.month;
		if(date.leap){
			month = '闰' + month;
		}

		let mt = '';
		if(date.dayInt === 1){
			mt = '朔月';
		}else if(date.dayInt === 15){
			mt = '望月';
		}


		let dom = (
			<div style={{width: 200}}>
				<Row>
					<Col span={24}>年纳音：{date.yearNaying}</Col>
					<Col span={24}>{date.year + '年' + month + date.day}</Col>
					<Col span={24}>{date.yearJieqi}年&nbsp;{date.monthGanZi + '月'}&nbsp;{date.dayGanZi + '日'}&nbsp;{date.time}时</Col>
					<Col span={24}>{date.jiedelta + '，' + date.chef}</Col>
				</Row>
				{
					date.jieqi && (
						<Row>
							<Col span={24}>{date.jieqi}&nbsp;{date.jieqiTime}</Col>
						</Row>
					)
				}
				{
					date.moonTime && (
						<Row>
							<Col span={24}>{mt}:&nbsp;{date.date}&nbsp;{date.moonTime}</Col>
						</Row>
					)
				}

			</div>
		);

		return dom;
	}

	genPopTitle(date){
		let parts = date.birth.split(' ');
		return date.birth;
	}

	render(){
		let date = this.props.date;
		let gongli = null;
		let nongli = null;
		let poptitle = null;
		let popcontent = null;
		if(date){
			gongli = this.genGongliDom(date);
			nongli = this.genNongliDom(date);
			poptitle = this.genPopTitle(date);
			popcontent = this.genPopContent(date);
		}

		let style = {
			textAlign: 'center',
		};
		if(this.props.hightLight){
			style.backgroundColor = '#33CCFF';
		}

		return (
			<Popover trigger='hover' title={poptitle} content={popcontent}>
				<div style={style} onClick={this.onClick}>
					<Row style={{textAlign: 'center'}}>
						<Col span={24}>{gongli}</Col>
					</Row>
					<Row style={{textAlign: 'center'}}>
						<Col span={24}>{nongli}</Col>
					</Row>
				</div>
			</Popover>
		);
	}

}

export default NongLiDate;
