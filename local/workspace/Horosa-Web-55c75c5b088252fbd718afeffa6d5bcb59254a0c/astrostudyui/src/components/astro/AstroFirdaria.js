import { Component } from 'react';
import { Row, Col, Divider, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import { buildMeaningTipByCategory, } from './AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from './AstroMeaningPopover';
import styles from '../../css/styles.less';
import { XQTable as Table } from '../xq-ui';
import { getFirdariaInterp } from '../../utils/firdariaInterp';
import { markPanelReady } from '../../utils/perfMark';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

class AstroFirdaria extends Component{

	constructor(props) {
		super(props);

		let columns = [{
			title: '主限',
			dataIndex: 'mainDirect',
			key: 'mainDirect',
			width: '20%',
			render: (text, record)=>{
				return this.planetText(text);
			},
		},{
			title: '子限',
			dataIndex: 'subDirect',
			key: 'subDirect',
			width: '20%',
			render: (text, record)=>{
				return this.planetText(text);
			},
		},{
			title: '日期',
			dataIndex: 'date',
			key: 'date',
			width: '60%',
			render: (text, record)=>{
				return text;
			},
		}];
		
		this.state = {
			columns: columns,
		}

			this.convertToDataSource = this.convertToDataSource.bind(this);
			this.genFirdariaDom = this.genFirdariaDom.bind(this);
			this.planetText = this.planetText.bind(this);
			this.showMeaning = this.showMeaning.bind(this);
		}

	// horosa_panel_ready_v1:本技法无自有请求 —— 法达运期表整份来自 chartObj.predictives.firdaria,
	// 「数据落定」就是拿到新盘对象后的这一次渲染提交(markPanelReady 内部再等双 rAF 逼近「已绘」)。
	// 故接在 componentDidUpdate 的 value 变更分支上,与带回调的技法同口径。
	componentDidUpdate(prevProps){
		if(prevProps.value !== this.props.value){
			markPanelReady('direction');
		}
	}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	planetText(id){
		const base = AstroText.AstroMsg[id] ? AstroText.AstroMsg[id] : `${id || ''}`;
		const text = appendPlanetHouseInfoById(
			base,
			this.props.value,
			id,
			this.props.showPlanetHouseInfo
		);
		const one = splitPlanetHouseInfoText(text);
		const labelNode = (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
				{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
			</span>
		);
		return wrapWithMeaning(labelNode, this.showMeaning(), buildMeaningTipByCategory('planet', id));
	}

	convertToDataSource(firdaria){
		if(firdaria === undefined || firdaria === null){
			return null;
		}

		let ds = [];
		for(let i=0; i<firdaria.subDirect.length; i++){
			let pd = firdaria.subDirect[i];
			let obj = {
				mainDirect: firdaria.mainDirect,
				subDirect: pd.subDirect,
				date: pd.date,
			}
			ds.push(obj);
		}
		return ds;
	}

	genFirdariaDom(ds){
		let dom = (
			<Table key='firdaria-table'
				dataSource={ds} 
				columns={this.state.columns} 
				rowKey='date'
				pagination={false}
				bordered size='small'
			/>					

		);
		return dom;
	}


	render(){
		let chart = this.props.value ? this.props.value : {};
		let predictives = chart.predictives ? chart.predictives : {};
		let firdaria = predictives.firdaria ? predictives.firdaria : [];

		// 零常数:星运页 Tabs 内容链已整条定高(面板 = 子页可用高),列表盒直接铺满面板。此前写 (height−70)px ——
		// 那是「height = 工作区高、要扣页头」时代的遗留;现在 height 传的就是面板真高 ⇒ 底部恒留 70px 死带、内容在盒底被截
		// (放大档下占比翻倍,1.8 档占面板 16%);且 height 为 '100%' 字符串时算出 NaN px。唯一宿主即星运页。
		let style = {
			height: '100%',
			maxHeight: '100%',
			boxSizing: 'border-box',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let doms = [];
		let rows = [];
		let rowobj = null;
		for(let i=0; i<firdaria.length; i++){
			if(i % 3 === 0){
				rowobj = [];
				rows.push(rowobj);
			}
			let pd = firdaria[i];
			let ds = this.convertToDataSource(pd);
			let tbldom = this.genFirdariaDom(ds);
			const interp = getFirdariaInterp(pd.mainDirect);
			const cell = (
				<div key={`s2-${i}`}>
					{interp ? (
						<div style={{ fontSize: 11, opacity: 0.78, lineHeight: '16px', margin: '0 0 4px', padding: '4px 8px', background: 'var(--horosa-accent-soft, rgba(184,134,11,0.08))', borderRadius: 6 }}>
							<b>{interp.mainShort}主限</b> · {interp.mainTheme}
						</div>
					) : null}
					{tbldom}
				</div>
			);
			rowobj.push(cell);
		}

		for(let i=0; i<rows.length; i++){
			let rowobj = rows[i];
			let cols = [];
			for(let j=0; j<rowobj.length; j++){
				let dom = (
					<Col key={`s3-${j}`} span={8}>{rowobj[j]}</Col>
				);
				cols.push(dom);
			}
			let dom = (
				<Row key={`s4-${i}`} gutter={12}>
					{cols}
				</Row>
			);
			doms.push(dom);
			if(i < rows.length - 1){
				let divider = <Divider key={`s5-${i}`} dashed={true} />
				doms.push(divider)	
			}
		}

		// 与界推运等表页同一套头卡(标题 · 副标题 · 说明),顶部留安全距离
		return (
			<div className={`${styles.scrollbar} horosa-balbillus-shell`} style={{ ...style, paddingRight: 8 }} >
				<div className="horosa-balbillus-head">
					<div className="horosa-balbillus-title">
						法达星限<span className="horosa-balbillus-sub">Firdaria · 主限 · 子限{firdaria.length ? ` · 共 ${firdaria.length} 段主限` : ''}</span>
					</div>
					<div className="horosa-balbillus-desc" style={{ marginBottom: 0 }}>
						按昼夜生定起始星:昼生自太阳、夜生自月亮,依迦勒底序轮掌人生各期(另含南北交两段);每段主限再按同序七分为子限;每张表是一段主限。
					</div>
				</div>
				{doms}
			</div>
		);
	}

}

export default AstroFirdaria;
