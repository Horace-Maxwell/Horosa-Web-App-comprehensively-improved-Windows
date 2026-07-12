import { Component } from 'react';
import { Row, Col, Divider, } from 'antd';
import { randomStr } from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import { buildMeaningTipByCategory, } from './AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from './AstroMeaningPopover';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
// [YB] 三段补厚共享 helper(起盘信息/当前时点/方法说明)。namespace import + typeof 守卫:
// 测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),缺函数时回 [] 保底。
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';

const birthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const currentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const methodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);
import styles from '../../css/styles.less';
import { XQTable as Table } from '../xq-ui';

// 129 年系统 AI 快照（同步，读 chartObj.predictives.yearsystem129）。无数据返回 ''。
export function buildYearSystem129SnapshotText(chartObj){
	const obj = chartObj || {};
	const predictives = obj.predictives || {};
	const data = Array.isArray(predictives.yearsystem129) ? predictives.yearsystem129 : [];
	if(data.length === 0){ return ''; }
	const cn = (id) => (AstroText.AstroTxtMsg[id] || `${id}`);
	const lines = [];
	// [YB] 头部盘主生辰([起盘信息];无数据 helper 自返 [],不产空段头)。
	lines.push(...birthHeaderLines(chartObj));
	lines.push('[129年系统表格]');
	lines.push('七政各管其小年（土30木12火15日19金8水20月25 = 129 年一轮），按 sect 起始、含子限。（succession 序实验性，待校准）');
	lines.push('');
	lines.push('| 主限 | 子限 | 日期 |');
	lines.push('| --- | --- | --- |');
	data.forEach((main) => {
		const subs = Array.isArray(main.subDirect) ? main.subDirect : [];
		if(subs.length === 0){
			lines.push(`| ${cn(main.mainDirect)} | - | - |`);
			return;
		}
		subs.forEach((sub) => {
			lines.push(`| ${cn(main.mainDirect)} | ${cn(sub.subDirect)} | ${sub.date || '-'} |`);
		});
	});
	// [YB] 尾部 [当前时点]+[方法说明](表内日期即应期窗口,按导出时刻自查,不另加定位行)。
	const tail = [...currentMomentLines(chartObj), ...methodNoteLines('yearsystem129')];
	if(tail.length){
		lines.push('');
		lines.push(...tail);
	}
	return lines.join('\n');
}

class AstroYearSystem129 extends Component{
	constructor(props){
		super(props);
		const columns = [{
			title: '主限', dataIndex: 'mainDirect', key: 'mainDirect', width: '20%',
			render: (text) => this.planetText(text),
		}, {
			title: '子限', dataIndex: 'subDirect', key: 'subDirect', width: '20%',
			render: (text) => this.planetText(text),
		}, {
			title: '日期', dataIndex: 'date', key: 'date', width: '60%',
			render: (text) => text,
		}];
		this.state = { columns };
		this.convertToDataSource = this.convertToDataSource.bind(this);
		this.genDom = this.genDom.bind(this);
		this.planetText = this.planetText.bind(this);
		this.showMeaning = this.showMeaning.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this.saveAISnapshot();
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentDidUpdate(prevProps){
		if(prevProps.value !== this.props.value){
			this.saveAISnapshot();
		}
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	saveAISnapshot(){
		const txt = buildYearSystem129SnapshotText(this.props.value);
		saveModuleAISnapshot('yearsystem129', txt, { tab: 'yearsystem129' });
		return txt;
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'yearsystem129'){
			return;
		}
		const txt = this.saveAISnapshot();
		if(txt){
			evt.detail.snapshotText = txt;
		}
	}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	planetText(id){
		const base = AstroText.AstroMsg[id] ? AstroText.AstroMsg[id] : `${id || ''}`;
		const text = appendPlanetHouseInfoById(base, this.props.value, id, this.props.showPlanetHouseInfo);
		const one = splitPlanetHouseInfoText(text);
		const labelNode = (
			<span>
				<span style={{ fontFamily: AstroConst.AstroFont }}>{one.label}</span>
				{one.info ? <span style={{ fontFamily: AstroConst.NormalFont }}>{`(${one.info})`}</span> : null}
			</span>
		);
		return wrapWithMeaning(labelNode, this.showMeaning(), buildMeaningTipByCategory('planet', id));
	}

	convertToDataSource(item){
		if(item === undefined || item === null){ return null; }
		const ds = [];
		const subs = Array.isArray(item.subDirect) ? item.subDirect : [];
		for(let i = 0; i < subs.length; i++){
			ds.push({ mainDirect: item.mainDirect, subDirect: subs[i].subDirect, date: subs[i].date });
		}
		return ds;
	}

	genDom(ds){
		return (
			<Table key={randomStr(8)} dataSource={ds} columns={this.state.columns} rowKey='date' pagination={false} bordered size='small' />
		);
	}

	render(){
		const chart = this.props.value ? this.props.value : {};
		const predictives = chart.predictives ? chart.predictives : {};
		const data = predictives.yearsystem129 ? predictives.yearsystem129 : [];
		const height = this.props.height ? this.props.height : '100%';
		const style = { height: (height - 70) + 'px', overflowY: 'auto', overflowX: 'hidden' };

		const doms = [];
		const rows = [];
		let rowobj = null;
		for(let i = 0; i < data.length; i++){
			if(i % 3 === 0){ rowobj = []; rows.push(rowobj); }
			rowobj.push(this.genDom(this.convertToDataSource(data[i])));
		}
		for(let i = 0; i < rows.length; i++){
			const cols = rows[i].map((d) => <Col key={randomStr(8)} span={8}>{d}</Col>);
			doms.push(<Row key={randomStr(8)} gutter={12}>{cols}</Row>);
			if(i < rows.length - 1){ doms.push(<Divider key={randomStr(8)} dashed={true} />); }
		}

		return (
			<div className={styles.scrollbar} style={style}>
				<Divider orientation="left">129 年系统（七政小年序列）</Divider>
				{doms}
			</div>
		);
	}
}

export default AstroYearSystem129;
