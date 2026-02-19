import { Component } from 'react';
import { Row, Col, Card, Tabs, Divider, Popover} from 'antd';
import { randomStr } from '../../utils/helper';
import { BaZiMsg } from '../../msg/bazimsg';


class MDSDirect extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.background = '#fefeef';

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
		let age = dir.age;

		let gzStyle={
			textAlign: 'center',
			fontWeight: 'bold',
			fontSize: 16,
			margin: 2,
			width: '100%',
		};
		let yearStyle={
			textAlign: 'center',
			fontSize: 12,
			margin: 2,
			width: '100%',
		};
		let ageStyle={
			textAlign: 'center',
			fontSize: 10,
			margin: 2,
			width: '100%',
		};

		let condom = null;
		if(dir.gong12GodDirect){
			let dirgongdom = this.genGong12GodDom(dir.gong12GodDirect);
			condom = (
				<div style={{width: 200,}}>
					{dirgongdom}
				</div>
			)	
		}

		return (
			<div style={{background: this.background}}>
				<Row>
					<Col span={24} style={ageStyle}>
						<span>{age}周岁</span>
					</Col>
					<Col span={24} style={yearStyle}>
						<span>{dir.startYear}</span>
					</Col>
				</Row>
				<Popover content={condom}>
				<Row>
					<Col span={24} style={gzStyle}>
						<span>
							{dir.mainDirect.ganzi}
						</span>
					</Col>
				</Row>
				</Popover>
			</div>
		);
	}
}

export default MDSDirect;


