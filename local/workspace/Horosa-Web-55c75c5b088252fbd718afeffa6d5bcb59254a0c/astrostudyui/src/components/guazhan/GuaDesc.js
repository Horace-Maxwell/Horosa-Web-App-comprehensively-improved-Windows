import { Component } from 'react';
import { Typography } from 'antd';
import styles from '../../css/styles.less';
import { XQTabs as Tabs } from '../xq-ui';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

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
		// res 为固定次序的九段(标题/卦辞/爻辞/彖/象),每段各出现一次,故字面量键即稳定且互不重复。
		let title = (
			<Title level={3} key="title"><a href={gua.url} target='_blank'>第{gua.ord}卦，{gua.name}卦，{gua.desc}</a></Title>
		);
		res.push(title);

		let guacititle = (<Title level={4} key="guaciTitle">卦辞</Title>);
		let guaci = (<Paragraph key="guaci"><Text strong type='warning'>{gua['卦辞']}</Text></Paragraph>);
		res.push(guacititle);
		res.push(guaci);

		let yaotitle = (<Title level={4} key="yaoTitle">爻辞</Title>);
		let yao = gua['爻辞'].map((item, idx)=>{
			let dom = (
				<li key={idx}>
					<Text strong mark>{item}</Text>
					<div>象曰：{gua['爻象'][idx]}</div>
				</li>
			);

			return dom
		});
		let yaoci = (
			<Paragraph key="yaoci">
				<ul>
					{yao}
				</ul>
			</Paragraph>
		);
		res.push(yaotitle);
		res.push(yaoci)

		let zuantitle = (<Title level={4} key="tuanTitle">彖曰</Title>);
		let zuan = (<Paragraph key="tuan">{gua['彖']}</Paragraph>);
		res.push(zuantitle);
		res.push(zuan);

		let xiangtitle = (<Title level={4} key="xiangTitle">象曰</Title>);
		let xiang = (<Paragraph key="xiang">{gua['象']}</Paragraph>);
		res.push(xiangtitle);
		res.push(xiang);


		let dom = (<Typography>{res}</Typography>);
		return dom;
	}


	render(){
		// 卦辞填满容器:框(嵌套 tabs)随面板高、仅内层块滚动;不再用页高派生的固定像素(会高估→撑出外层双滚动条)
		let style = {
			height: '100%',
			overflowY:'auto',
			overflowX:'hidden',
		};

		let desc = this.props.value ? this.props.value : {};
		let guaOrg = this.genGua(desc.guaOrg);
		let guaMiddle = this.genGua(desc.guaMiddle);
		let guaRes = this.genGua(desc.guaRes);
		if(desc.guaOrg && desc.guaRes && desc.guaOrg.ord === desc.guaRes.ord){
			guaRes = null;
		}

		return (
			<div style={{ height: '100%', minHeight: 0 }}>
				<Tabs
					defaultActiveKey='org' tabPosition='right'
					style={{ height: '100%' }}				
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
