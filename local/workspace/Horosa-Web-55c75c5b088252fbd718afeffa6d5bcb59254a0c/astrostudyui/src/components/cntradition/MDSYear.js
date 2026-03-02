import { Component } from 'react';
import { Row, Col, Card, Tabs, Divider, Popover} from 'antd';
import { randomStr } from '../../utils/helper';
import { BaZiMsg } from '../../msg/bazimsg';
import DateTime from '../comp/DateTime';

class MDSYear extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.background = '#66FFFF';

		this.genGong12GodDom = this.genGong12GodDom.bind(this);

	}

	genGong12GodDom(gong12){
		let dom = null;
		if(gong12 === null || gong12 === undefined){
			return dom;
		}

		dom = (
			<div>
			<ul>
				<li>大运：{gong12['运']['干'].name}，{gong12['运']['支'].name}</li>
				<li>年柱：{gong12['年']['干'].name}，{gong12['月']['支'].name}</li>
				<li>月柱：{gong12['月']['干'].name}，{gong12['月']['支'].name}</li>
				<li>日柱：{gong12['日']['干'].name}，{gong12['日']['支'].name}</li>
				<li>时柱：{gong12['时']['干'].name}，{gong12['时']['支'].name}</li>
				<li>胎元：{gong12['胎']['干'].name}，{gong12['胎']['支'].name}</li>
				<li>命宫：{gong12['命']['干'].name}，{gong12['命']['支'].name}</li>
				<li>身宫：{gong12['身']['干'].name}，{gong12['身']['支'].name}</li>
			</ul>
			</div>
		);

		return dom;
	}


	render(){
		let dir = this.props.value ? this.props.value : {};
		let mainDirect = dir.mainDirect ? dir.mainDirect : {};
		let subs = dir.subDirect ? dir.subDirect : [];
		let startYear = dir.startYear;
		let age = dir.age;

		let gong12god = dir.gong12God;
		
		let now = new DateTime();

		let yearStyle={
			textAlign: 'center',
			fontSize: 12,
			padding: 5,
			margin: 2,
			width: '100%',
		};
		let futureStyle={
			textAlign: 'center',
			fontSize: 12,
			padding: 5,
			margin: 2,
			width: '100%',
			background: this.background,
		};

		let subdoms = subs.map((sub, idx)=>{
			let y = startYear + idx;
			let yStyle = y >= now.year ? futureStyle : yearStyle;
			let nowage = age + idx;
			let gong12dom = null;
			if(gong12god){
				gong12dom = this.genGong12GodDom(gong12god[idx]);
			}
			let condom = (
				<div style={{width: 200,}}>
					<h4>值年星宿：{sub.starCharger.name}</h4>
					<div>{sub.starCharger.event}</div>
					<hr />
					{gong12dom}
				</div>
			)
			return (
				<Popover title={sub.ganzi + '，公元' + y + '年，' + nowage + '周岁'} key={randomStr(8)}
					content={condom}
				>
					<Row key={randomStr(8)} style={{width: '100%'}}>
						<Col span={24} style={yStyle}>
							<span>{sub.ganzi}</span>
						</Col>
					</Row>
				</Popover>
			)
		});


		return (
			<div>
				{subdoms}
			</div>
		);
	}
}

export default MDSYear;


