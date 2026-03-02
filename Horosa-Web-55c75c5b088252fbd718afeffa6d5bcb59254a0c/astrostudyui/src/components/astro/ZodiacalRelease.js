import { Component } from 'react';
import { Row, Col, Tree, Card, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { randomStr, } from '../../utils/helper';
import styles from '../../css/styles.less';

const { TreeNode } = Tree;

class ZodiacalRelease extends Component{
	constructor(props) {
		super(props);
		this.colors = ['#0a2e81','#c81808', '#005000', '#948e33'];
		this.bgColors = ['#d3d3d3','#d3d3d3', '#d3d3d3'];

		this.genZRSubLevelDom = this.genZRSubLevelDom.bind(this);
	}

	genZRSubLevelDom(list, parentSignIdx){
		let cnt = 0;
		let spans = list.map((item, idx)=>{
			let subdom = null;
			let sigIdx = AstroConst.LIST_SIGNS.indexOf(item.sign);
			if(item.sublevel && item.sublevel.length){
				subdom = this.genZRSubLevelDom(item.sublevel, sigIdx);
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

			let titledom = (
				<div style={divstyle}>
					<span style={{fontFamily: AstroConst.NormalFont}}>{'L' + item.level}&nbsp;</span>
					<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item.sign]}&nbsp;</span>
					<span style={{fontFamily: AstroConst.NormalFont}}>{item.date}&nbsp;</span>
				</div>
			);

			return (
				<TreeNode key={randomStr(8)} title={titledom}>
					{subdom}
				</TreeNode>
			);
		});

		return spans;
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
			dom = this.genZRSubLevelDom(this.props.value, -1);
		}
		return (
			<div className={styles.scrollbar} style={style}>
				<Tree>
					{dom}
				</Tree>
			</div>
		);
	}
}

export default ZodiacalRelease
