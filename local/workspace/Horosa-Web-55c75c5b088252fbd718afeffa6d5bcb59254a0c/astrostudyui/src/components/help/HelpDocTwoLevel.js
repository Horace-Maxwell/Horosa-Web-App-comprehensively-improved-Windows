// 帮助文档「两层页签」外壳:一级 = 技法大类,二级 = 逐技法(或逐章)。
// 聚合页(卜·其他十五技法、命·其他三技法、辅盘十二技法…)原本把技法挤在一排页签里,
// 或把几种技法合塞进一个页签;改为两层后每个技法各占一页,互不挤压。
//
// 🔴 内容惰性构建:items[].render 是函数而非现成 JSX —— 只对「当前选中的那一项」调用。
//    若直接传 JSX,十五个技法的正文会在每次 render 时全部构建(哪怕只看一个),
//    白白吃掉构建开销;antd Tabs 又默认保留已渲染的面板,故必须在传入前就掐断。
//
// 🔴 二级选中态按组各记一份:切走一级再切回来,回到你上次看的那一小节,
//    而不是被打回该组首项(与全站子页签记忆同一口径)。
//
// 单项组(items 只有一个)不出二级页签条 —— 一个孤零零的子页签只是噪音。
import React, { Component } from 'react';
import { Tabs } from 'antd';
import { MUTED } from './helpDocStyle';

const { TabPane } = Tabs;

const L2_WRAP = {
	marginTop: 2,
	paddingLeft: 10,
	borderLeft: '2px solid var(--horosa-border, rgba(120,120,120,0.22))',
};

const GROUP_HINT = { margin: '2px 0 6px', fontSize: 12, color: MUTED, lineHeight: 1.6 };

class HelpDocTwoLevel extends Component{
	constructor(props){
		super(props);
		const groups = this.usableGroups(props);
		this.state = {
			groupKey: groups.length ? groups[0].key : null,
			itemKeys: {},
		};
	}

	usableGroups(props){
		const src = (props || this.props).groups || [];
		return src.filter((group)=>group && group.key && (group.items || []).length);
	}

	onGroupChange = (groupKey)=>{
		this.setState({ groupKey });
	};

	onItemChange = (groupKey, itemKey)=>{
		this.setState((prev)=>({ itemKeys: { ...prev.itemKeys, [groupKey]: itemKey } }));
	};

	// 该组当前二级项:记过且仍合法就用记忆值,否则回落该组首项。
	activeItemKey(group){
		const items = group.items || [];
		const remembered = this.state.itemKeys[group.key];
		if(remembered && items.some((item)=>item.key === remembered)){ return remembered; }
		return items.length ? items[0].key : null;
	}

	renderItem(item){
		if(!item){ return null; }
		return typeof item.render === 'function' ? item.render() : (item.content || null);
	}

	renderGroupBody(group){
		const items = group.items || [];
		const itemKey = this.activeItemKey(group);
		if(items.length <= 1){
			return (
				<div>
					{group.hint ? <div style={GROUP_HINT}>{group.hint}</div> : null}
					{this.renderItem(items[0])}
				</div>
			);
		}
		return (
			<div>
				{group.hint ? <div style={GROUP_HINT}>{group.hint}</div> : null}
				<div style={L2_WRAP}>
					<Tabs
						activeKey={itemKey}
						onChange={(key)=>this.onItemChange(group.key, key)}
						size="small"
						tabPosition="top"
					>
						{items.map((item)=>(
							<TabPane tab={item.label} key={item.key}>
								{item.key === itemKey ? this.renderItem(item) : null}
							</TabPane>
						))}
					</Tabs>
				</div>
			</div>
		);
	}

	render(){
		const groups = this.usableGroups();
		if(!groups.length){ return null; }
		const groupKey = groups.some((group)=>group.key === this.state.groupKey)
			? this.state.groupKey
			: groups[0].key;
		return (
			<Tabs activeKey={groupKey} onChange={this.onGroupChange} size="small" tabPosition="top">
				{groups.map((group)=>(
					<TabPane tab={group.label} key={group.key}>
						{group.key === groupKey ? this.renderGroupBody(group) : null}
					</TabPane>
				))}
			</Tabs>
		);
	}
}

export default HelpDocTwoLevel;
