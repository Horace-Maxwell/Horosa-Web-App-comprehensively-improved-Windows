import { Component } from 'react';
import { Row, Col, Popover} from 'antd';
import { BaZiMsg } from '../../msg/bazimsg';
import { resolveStarCharger } from './starChargerLazy';
import DateTime from '../comp/DateTime';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

function gongName(gong12, palace, part){
	return gong12 && gong12[palace] && gong12[palace][part] && gong12[palace][part].name
		? gong12[palace][part].name : '';
}

class MDSYear extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.background = 'var(--horosa-bazi-year-bg, #66FFFF)';

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
				<li>大运：{gongName(gong12, '运', '干')}，{gongName(gong12, '运', '支')}</li>
				<li>年柱：{gongName(gong12, '年', '干')}，{gongName(gong12, '年', '支')}</li>
				<li>月柱：{gongName(gong12, '月', '干')}，{gongName(gong12, '月', '支')}</li>
				<li>日柱：{gongName(gong12, '日', '干')}，{gongName(gong12, '日', '支')}</li>
				<li>时柱：{gongName(gong12, '时', '干')}，{gongName(gong12, '时', '支')}</li>
				<li>胎元：{gongName(gong12, '胎', '干')}，{gongName(gong12, '胎', '支')}</li>
				<li>命宫：{gongName(gong12, '命', '干')}，{gongName(gong12, '命', '支')}</li>
				<li>身宫：{gongName(gong12, '身', '干')}，{gongName(gong12, '身', '支')}</li>
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
			color: 'var(--horosa-text)',
		};
		let futureStyle={
			textAlign: 'center',
			fontSize: 12,
			padding: 5,
			margin: 2,
			width: '100%',
			background: this.background,
			color: 'var(--horosa-text)',
		};

		let subdoms = subs.map((sub, idx)=>{
			sub = sub || {};
			let y = startYear + idx;
			let yStyle = y >= now.year ? futureStyle : yearStyle;
			let nowage = age + idx;
			let gong12dom = null;
			if(gong12god){
				gong12dom = this.genGong12GodDom(gong12god[idx]);
			}
			// starCharger 惰性化：null 时按公历年补算（出生月/日由父组件 MainDirectionSimple 传入）。
			const starCharger = resolveStarCharger(sub && sub.starCharger, sub && sub.year != null ? sub.year : y, this.props.birthMonth, this.props.birthDay);
			let condom = (
				<div style={{width: 200,}}>
					<h4>值年星宿：{starCharger.name || '暂无'}</h4>
					<div>{starCharger.event || ''}</div>
					<hr />
					{gong12dom}
				</div>
			)
			return (
				<Popover title={(sub.ganzi || '') + '，公元' + y + '年，' + nowage + '周岁'} key={`year-${idx}`}
					content={condom}
				>
					<Row key={`year-row-${idx}`} style={{width: '100%'}}>
						<Col span={24} className={y >= now.year ? 'horosa-bazi-year-cell horosa-bazi-year-cell-future' : 'horosa-bazi-year-cell'} style={yStyle}>
							<span>{sub.ganzi || ''}</span>
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
