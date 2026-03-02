import { Component } from 'react';
import { Row, Col, Divider, Button, Select,} from 'antd';
import { ZhangSheng, SuiTuTong, ZSList, Gan, Zi, ZSColor } from '../../msg/bazimsg';
import { randomStr, printArea,} from '../../utils/helper';
import styles from '../../css/styles.less';

const { Option, } = Select;

class BaZiZhangSheng extends Component{
	constructor(props) {
		super(props);
		let type = this.props.type ? this.props.type : 0;
		let gan = this.props.gan ? this.props.gan : '甲';
		this.state = {
			id: 'div' + randomStr(8),
			type: type,
			gan: gan,
		};

		this.changeType = this.changeType.bind(this);
		this.changeGan = this.changeGan.bind(this);

		this.genGanDom = this.genGanDom.bind(this);
		this.genDom = this.genDom.bind(this);
	}

	changeType(val){
		this.setState({
			type: val,
		}, ()=>{
			this.genDom();
		});
	}

	changeGan(val){
		this.setState({
			gan: val,
		}, ()=>{
			this.genDom();
		});
	}

	genGanDom(){
		let dom = Gan.map((item, idx)=>{
			return (<Option value={item} key={item}>{item}</Option>)
		});
		return dom;
	}

	genDom(){
		let map = ZhangSheng.ganziInverse;
		if(this.state.type === 1){
			map = ZhangSheng.ganzi;
		}else if(this.state.type === 2){
			map = SuiTuTong.ganzi;
		}

		let gan = this.state.gan;

		if(gan.length > 1){
			map = ZhangSheng.nayinwxzhi;
		}

		let cols = Zi.map((item, idx)=>{
			let key = `${gan}_${item}`;
			let zs = map[key];
			let color = ZSColor[zs];
			return (
				<Col key={item} span={6}>
					<Row gutter={16}>
						<Col span={24}><h3 style={{color: color}}>{item}：{zs}</h3></Col>
					</Row>
				</Col>
			);
		});

		let dom = (
			<Row gutter={16}>
				{cols}
			</Row>
		)

		return dom;
	}

	render(){
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-100) + 'px',
			width: '100%',
			overflowY:'auto', 
			overflowX:'hidden',
			marginTop: 20,
		};

		let ganopts = this.genGanDom();
		let dom = this.genDom();

		return (
			<div className={styles.scrollbar} style={style} id={this.state.id}>
				<Row style={{marginBottom: 10}} gutter={16}>
					<Col span={12}>
						<Select value={this.state.type} onChange={this.changeType} style={{width:'100%'}}>
							<Option value={0}>阳顺阴逆火土同</Option>
							<Option value={1}>阴阳同序火土同</Option>
							<Option value={2}>阴阳同序水土同</Option>
						</Select>
					</Col>
					<Col span={8}>
						<Select value={this.state.gan} onChange={this.changeGan} style={{width:'100%'}}>
							{ganopts}
						</Select>
					</Col>
				</Row>
				<Divider />
				{dom}
			</div>
		);
	}
}

export default BaZiZhangSheng;
