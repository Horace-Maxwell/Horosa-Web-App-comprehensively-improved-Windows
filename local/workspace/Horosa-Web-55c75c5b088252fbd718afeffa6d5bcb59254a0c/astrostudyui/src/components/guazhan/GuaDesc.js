import { Component } from 'react';
import { Typography, Tabs } from 'antd';
import {randomStr, } from '../../utils/helper';
import styles from '../../css/styles.less';

const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;

class GuaDesc extends Component{
	
	constructor(props) {
		super(props);

		this.genGua = this.genGua.bind(this);
	}

	genGua(gua){
		if(gua === undefined || gua === null){
			return null;
		}

		let res = [];
		let title = (
			<Title level={3} key={randomStr(8)}><a href={gua.url} target='_blank'>第{gua.ord}卦，{gua.name}卦，{gua.desc}</a></Title>
		);
		res.push(title);

		let guacititle = (<Title level={4} key={randomStr(8)}>卦辞</Title>);
		let guaci = (<Paragraph key={randomStr(8)}><Text strong type='warning'>{gua['卦辞']}</Text></Paragraph>);
		res.push(guacititle);
		res.push(guaci);

		let yaotitle = (<Title level={4} key={randomStr(8)}>爻辞</Title>);
		let yao = gua['爻辞'].map((item, idx)=>{
			let dom = (
				<li key={randomStr(8)}>
					<Text strong mark>{item}</Text>
					<div>象曰：{gua['爻象'][idx]}</div>
				</li>
			);

			return dom
		});
		let yaoci = (
			<Paragraph key={randomStr(8)}>
				<ul>
					{yao}
				</ul>
			</Paragraph>
		);
		res.push(yaotitle);
		res.push(yaoci)

		let zuantitle = (<Title level={4} key={randomStr(8)}>彖曰</Title>);
		let zuan = (<Paragraph key={randomStr(8)}>{gua['彖']}</Paragraph>);
		res.push(zuantitle);
		res.push(zuan);

		let xiangtitle = (<Title level={4} key={randomStr(8)}>象曰</Title>);
		let xiang = (<Paragraph key={randomStr(8)}>{gua['象']}</Paragraph>);
		res.push(xiangtitle);
		res.push(xiang);


		let dom = (<Typography>{res}</Typography>);
		return dom;
	}


	render(){
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-110) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let tabheight = height;

		let desc = this.props.value ? this.props.value : {};
		let guaOrg = this.genGua(desc.guaOrg);
		let guaMiddle = this.genGua(desc.guaMiddle);
		let guaRes = this.genGua(desc.guaRes);
		if(desc.guaOrg && desc.guaRes && desc.guaOrg.ord === desc.guaRes.ord){
			guaRes = null;
		}

		return (
			<div>
				<Tabs
					defaultActiveKey='org' tabPosition='right'
					style={{ height: tabheight }}				
				>
					<TabPane tab="本" key="org">
						<div className={styles.scrollbar} style={style}>
							{guaOrg}
						</div>
					</TabPane>

					<TabPane tab="互" key="middle">
						<div className={styles.scrollbar} style={style}>
							{guaMiddle}
						</div>
					</TabPane>

					<TabPane tab="之" key="res">
						<div className={styles.scrollbar} style={style}>
							{guaRes}
						</div>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default GuaDesc;
