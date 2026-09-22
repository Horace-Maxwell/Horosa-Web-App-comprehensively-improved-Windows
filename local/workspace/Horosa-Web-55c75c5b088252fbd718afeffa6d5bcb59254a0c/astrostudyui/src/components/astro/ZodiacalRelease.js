import { Component } from 'react';
import { Tree, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { randomStr, } from '../../utils/helper';
import styles from '../../css/styles.less';

const { TreeNode } = Tree;

class ZodiacalRelease extends Component{
	constructor(props) {
		super(props);
		this.colors = [
			'var(--horosa-direction-level-1, #275fc7)',
			'var(--horosa-direction-level-2, #c72d22)',
			'var(--horosa-direction-level-3, #237a45)',
			'var(--horosa-direction-level-4, #805526)',
		];
		this.bgColors = [
			'var(--horosa-direction-node-highlight, rgba(184, 137, 63, 0.14))',
			'var(--horosa-direction-node-highlight, rgba(184, 137, 63, 0.14))',
			'var(--horosa-direction-node-highlight, rgba(184, 137, 63, 0.14))',
		];

		this.genZRSubLevelDom = this.genZRSubLevelDom.bind(this);
		this.handleSelect = this.handleSelect.bind(this);
	}

	genZRSubLevelDom(list, parentSignIdx, pathKey){
		let cnt = 0;
		let spans = list.map((item, idx)=>{
			let subdom = null;
			let sigIdx = AstroConst.LIST_SIGNS.indexOf(item.sign);
			const nodeKey = `${pathKey || 'zr'}-${idx}`;
			if(this._keySign){ this._keySign[nodeKey] = item.sign; }
			if(item.sublevel && item.sublevel.length){
				subdom = this.genZRSubLevelDom(item.sublevel, sigIdx, nodeKey);
			}

			let divstyle = {};
			if(item.level === 1){
				divstyle = {
					color: this.colors[item.level - 1],
				};
			}else if(((sigIdx + 6) % 12) === parentSignIdx){
				cnt = cnt + 1;
				divstyle = {
					color: this.colors[item.level - 1],
				};
				if(cnt === 2){
					divstyle = {
						color: this.colors[item.level - 1],
						background: this.bgColors[item.level - 2],
					};	
				}
			}

			// 点运高亮只在星盘呈现(本座+4/7/10);树里只保留 antd 单块选中(被点那一个),
			// 不按同座给散落多节点上色——否则点一个运,树里所有同座的运四处一起变色,反而干扰阅读。
			let titledom = (
				<div style={{ ...divstyle, cursor: 'pointer', borderRadius: 4, padding: '0 4px' }}
					title="点击高亮该运星座(本座 + 第4/7/10座)">
					<span style={{fontFamily: AstroConst.NormalFont}}>{'L' + item.level}&nbsp;</span>
					<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item.sign]}&nbsp;</span>
					<span style={{fontFamily: AstroConst.NormalFont}}>{item.date}&nbsp;</span>
					{/* [Q-362/T-343] 末段子期按父期截断(后端 truncated 标):明示该期未走完整长 */}
					{item.truncated ? <span style={{ fontFamily: AstroConst.NormalFont, opacity: 0.7 }} title="该子期超出所属上级期,已按上级期讫日截断">（截）</span> : null}
				</div>
			);

			return (
				<TreeNode key={nodeKey} title={titledom}>
					{subdom}
				</TreeNode>
			);
		});

		return spans;
	}

	handleSelect(keys){
		const sign = (this._keySign && keys && keys.length) ? this._keySign[keys[0]] : null;
		if(!this.props.onSignClick || !sign){ return; }
		this.props.onSignClick(sign);
	}


	render(){
		let height = this.props.height ? this.props.height : '100%';
		let mainCont = document.getElementById('mainContent');
		if(mainCont){
			height = mainCont.clientHeight;
		}
		if(height === '100%'){
			height = 'calc(100% - 70px)'
		}else{
			height = height - 100
		}
		let style = {
			height: height,
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let dom = null;
		if(this.props.value){
			this._keySign = {};
			dom = this.genZRSubLevelDom(this.props.value, -1, 'zr');
		}
		return (
			<div className={`${styles.scrollbar} horosa-direction-tree-scroll horosa-zodiacal-release-tree-scroll`} style={style}>
				<Tree className="horosa-direction-tree horosa-zodiacal-release-tree" onSelect={this.handleSelect}>
					{dom}
				</Tree>
			</div>
		);
	}
}

export default ZodiacalRelease
