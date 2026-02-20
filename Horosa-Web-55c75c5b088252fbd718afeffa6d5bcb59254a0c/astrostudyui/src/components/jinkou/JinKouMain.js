import { Component } from 'react';
import { Row, Col, Button, Divider, Select, Tabs, message, Modal } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import * as LRConst from '../liureng/LRConst';
import { ZSList, ZhangSheng, } from '../liureng/LRZhangSheng';
import LiuRengInput from '../lrzhan/LiuRengInput';
import LiuRengBirthInput from '../lrzhan/LiuRengBirthInput';
import DateTime from '../comp/DateTime';
import JinKouChart from './JinKouChart';
import { buildJinKouData } from './JinKouCalc';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import styles from '../../css/styles.less';

const { Option } = Select;
const TabPane = Tabs.TabPane;

function cloneDateTimeSafe(val, fallback){
	if(val && val instanceof DateTime){
		return val.clone();
	}
	if(fallback && fallback instanceof DateTime){
		return fallback.clone();
	}
	return new DateTime();
}

function buildBirthFields(source, fallbackNow){
	const now = fallbackNow && fallbackNow instanceof DateTime ? fallbackNow : new DateTime();
	const src = source || {};
	const dateVal = src.date && src.date.value ? cloneDateTimeSafe(src.date.value, now.startOf('date')) : now.startOf('date');
	const timeVal = src.time && src.time.value ? cloneDateTimeSafe(src.time.value, now) : now.clone();
	return {
		date: { value: dateVal },
		time: { value: timeVal },
		ad: { value: src.ad && src.ad.value !== undefined ? src.ad.value : now.ad },
		zone: { value: src.zone && src.zone.value ? src.zone.value : now.zone },
		lat: { value: src.lat && src.lat.value ? src.lat.value : Constants.DefLat },
		lon: { value: src.lon && src.lon.value ? src.lon.value : Constants.DefLon },
		gpsLat: { value: src.gpsLat && src.gpsLat.value !== undefined ? src.gpsLat.value : Constants.DefGpsLat },
		gpsLon: { value: src.gpsLon && src.gpsLon.value !== undefined ? src.gpsLon.value : Constants.DefGpsLon },
		gender: { value: src.gender && src.gender.value !== undefined ? src.gender.value : 1 },
		after23NewDay: { value: src.after23NewDay && src.after23NewDay.value !== undefined ? src.after23NewDay.value : 0 },
	};
}

function fmtValue(value){
	if(value === undefined || value === null || value === ''){
		return '无';
	}
	if(value instanceof Array){
		return value.join('、') || '无';
	}
	return `${value}`;
}

function cleanKey(key){
	const txt = `${key || ''}`;
	const idx = txt.indexOf('(');
	if(idx >= 0){
		return txt.substring(0, idx);
	}
	return txt;
}

function appendMapSection(lines, title, obj){
	lines.push(`[${title}]`);
	if(!obj || typeof obj !== 'object'){
		lines.push('无');
		lines.push('');
		return;
	}
	const keys = Object.keys(obj);
	if(keys.length === 0){
		lines.push('无');
		lines.push('');
		return;
	}
	for(let i=0; i<keys.length; i++){
		const key = keys[i];
		lines.push(`${cleanKey(key)}：${fmtValue(obj[key])}`);
	}
	lines.push('');
}

function buildJinKouSnapshotText(params, liureng, runyear, jinkouData, wuxing, guirengType, gender){
	const lines = [];
	const nongli = liureng && liureng.nongli ? liureng.nongli : {};
	const xingbie = `${gender}` === '1' ? '男' : '女';
	const guirenType = guirengType === 0 ? '六壬法贵人' : (guirengType === 1 ? '遁甲法贵人' : '星占法贵人');
	const briefKong = (txt)=>{
		const val = `${txt || ''}`;
		const hasEmpty = val.indexOf('空亡') >= 0;
		const hasSiKong = val.indexOf('四大空亡') >= 0;
		if(hasEmpty && hasSiKong){
			return '空&四空';
		}
		if(hasEmpty){
			return '空';
		}
		if(hasSiKong){
			return '四空';
		}
		return '';
	};
	const findRow = (name)=>{
		if(!jinkouData || !jinkouData.rows){
			return null;
		}
		for(let i=0; i<jinkouData.rows.length; i++){
			const row = jinkouData.rows[i];
			if(row && row.label === name){
				return row;
			}
		}
		return null;
	};
	const appendBriefRow = (name, withShenjiang)=>{
		const row = findRow(name);
		if(!row){
			lines.push(`${name}：无`);
			return;
		}
		const main = fmtValue(row.content);
		const shenjiang = withShenjiang && row.shenjiang && row.shenjiang !== '-' ? `（${row.shenjiang}）` : '';
		const power = row.power && row.power !== '—' ? row.power : '无';
		const kong = briefKong(row.kong);
		let line = `${name}：${main}${shenjiang}；（${power}）`;
		if(kong){
			line = `${line}；${kong}`;
		}
		lines.push(line);
	};

	lines.push('[起盘信息]');
	if(params){
		lines.push(`日期：${params.date} ${params.time}`);
		lines.push(`时区：${params.zone}`);
		lines.push(`经纬度：${params.lon} ${params.lat}`);
	}
	if(nongli && nongli.birth){
		lines.push(`真太阳时：${nongli.birth}`);
	}
	if(liureng && liureng.fourColumns){
		const cols = liureng.fourColumns;
		lines.push(`四柱：${fmtValue(cols.year && cols.year.ganzi)}年 ${fmtValue(cols.month && cols.month.ganzi)}月 ${fmtValue(cols.day && cols.day.ganzi)}日 ${fmtValue(cols.time && cols.time.ganzi)}时`);
	}
	lines.push(`贵人体系：${guirenType}`);
	lines.push(`十二长生五行：${fmtValue(wuxing)}`);
	lines.push(`问测人性别：${xingbie}`);
	lines.push('');

	lines.push('[金口诀速览]');
	if(jinkouData && jinkouData.ready){
		lines.push(`地分：${fmtValue(jinkouData.topInfo.diFen)}`);
		lines.push(`空亡：${fmtValue(jinkouData.topInfo.xunKong)}`);
		lines.push(`四大空亡：${fmtValue(jinkouData.topInfo.siDaKong)}`);
		appendBriefRow('人元', false);
		appendBriefRow('贵神', true);
		appendBriefRow('将神', true);
		appendBriefRow('地分', false);
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[金口诀四位]');
	if(jinkouData && jinkouData.ready){
		lines.push(`地分：${fmtValue(jinkouData.topInfo.diFen)}`);
		lines.push(`空亡：${fmtValue(jinkouData.topInfo.xunKong)}`);
		lines.push(`四大空亡：${fmtValue(jinkouData.topInfo.siDaKong)}`);
		for(let i=0; i<jinkouData.rows.length; i++){
			const row = jinkouData.rows[i];
			lines.push(`${row.label}：天干=${fmtValue(row.gan)}；内容=${fmtValue(row.content)}；神将=${fmtValue(row.shenjiang)}；状态=${fmtValue(row.power)}；空亡=${fmtValue(row.kong)}`);
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[四位神煞]');
	if(jinkouData && jinkouData.shenshaRows && jinkouData.shenshaRows.length){
		for(let i=0; i<jinkouData.shenshaRows.length; i++){
			const row = jinkouData.shenshaRows[i];
			lines.push(`${row.label}：${fmtValue(row.value)}`);
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[行年]');
	if(runyear){
		lines.push(`行年干支：${fmtValue(runyear.year)}`);
		lines.push(`年龄：${fmtValue(runyear.age)}岁`);
		lines.push(`性别：${xingbie}`);
	}else{
		lines.push('无');
	}
	lines.push('');

	appendMapSection(lines, '旬日', liureng ? liureng.xun : null);
	appendMapSection(lines, '旺衰', liureng ? liureng.season : null);
	appendMapSection(lines, '基础神煞', liureng ? liureng.gods : null);
	appendMapSection(lines, '干煞', liureng ? liureng.godsGan : null);
	appendMapSection(lines, '月煞', liureng ? liureng.godsMonth : null);
	appendMapSection(lines, '支煞', liureng ? liureng.godsZi : null);
	appendMapSection(lines, '岁煞', liureng && liureng.godsYear ? liureng.godsYear.taisui1 : null);

	lines.push('[十二长生]');
	if(wuxing){
		for(let i=0; i<ZSList.length; i++){
			const item = ZSList[i];
			const key = `${wuxing}_${item}`;
			lines.push(`${item}：${fmtValue(ZhangSheng.wxphase[key])}`);
		}
	}else{
		lines.push('无');
	}
	return lines.join('\n').trim();
}

function mapObjToRows(obj){
	if(!obj || typeof obj !== 'object'){
		return [];
	}
	const keys = Object.keys(obj);
	const rows = [];
	for(let i=0; i<keys.length; i++){
		const key = keys[i];
		let value = obj[key];
		if(value instanceof Array){
			value = value.join('、');
		}
		rows.push({
			key: cleanKey(key),
			value: value === undefined || value === null || value === '' ? '—' : `${value}`,
		});
	}
	return rows;
}

function normalizeZiFromText(text){
	const txt = `${text || ''}`;
	for(let i=0; i<txt.length; i++){
		const one = txt.substr(i, 1);
		if(LRConst.ZiList.indexOf(one) >= 0){
			return one;
		}
	}
	return '';
}

class JinKouMain extends Component{
	constructor(props) {
		super(props);
		const now = new DateTime();
		const birth = buildBirthFields(this.props.fields, now);

		this.state = {
			birth: birth,
			liureng: null,
			runyear: null,
			wuxing: '土',
			guireng: 0,
			diFen: '子',
			rightTab: 'godsZi',
		};

		this.unmounted = false;

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onBirthChange = this.onBirthChange.bind(this);
		this.onWuXingChange = this.onWuXingChange.bind(this);
		this.onGuiRengChange = this.onGuiRengChange.bind(this);
		this.onDiFenChange = this.onDiFenChange.bind(this);
		this.setRightTab = this.setRightTab.bind(this);
		this.genWuXingDoms = this.genWuXingDoms.bind(this);
		this.genGodsParams = this.genGodsParams.bind(this);
		this.genRunYearParams = this.genRunYearParams.bind(this);
		this.requestGods = this.requestGods.bind(this);
		this.requestRunYear = this.requestRunYear.bind(this);
		this.saveJinKouSnapshot = this.saveJinKouSnapshot.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.renderInfoTable = this.renderInfoTable.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.requestGods(fields);
			};
		}
	}

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			const flds = {
				...this.props.fields,
				...field,
			};
			this.props.dispatch({
				type: 'astro/save',
				payload: {
					fields: flds,
				},
			});
			this.requestGods(flds);
		}
	}

	onBirthChange(field){
		const flds = {
			...this.state.birth,
			...field,
		};
		this.setState({
			birth: flds,
		}, ()=>{
			this.requestRunYear();
		});
	}

	onWuXingChange(val){
		this.setState({
			wuxing: val,
		}, ()=>{
			this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, val, this.state.guireng, this.state.diFen);
		});
	}

	onGuiRengChange(val){
		this.setState({
			guireng: val,
		}, ()=>{
			this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, val, this.state.diFen);
		});
	}

	onDiFenChange(val){
		this.setState({
			diFen: val,
		}, ()=>{
			this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng, val);
		});
	}

	setRightTab(key){
		this.setState({
			rightTab: key,
		});
	}

	genRunYearParams(){
		const flds = this.state.birth;
		return {
			ad: flds.date.value.ad,
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm'),
			zone: flds.date.value.zone,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gender: flds.gender.value,
			after23NewDay: flds.after23NewDay.value,
			guaYearGanZi: this.state.liureng.nongli.year,
		};
	}

	genGodsParams(fields){
		let params = null;
		const flds = fields ? fields : this.props.fields;
		if(flds.params){
			const dtparts = flds.params.birth.split(' ');
			params = {
				...flds.params,
				date: dtparts[0],
				time: dtparts[1],
			};
		}else{
			params = {
				date: flds.date.value.format('YYYY-MM-DD'),
				time: flds.time.value.format('HH:mm'),
				zone: flds.date.value.zone,
				ad: flds.date.value.ad,
				lon: flds.lon.value,
				lat: flds.lat.value,
			};
		}
		return params;
	}

	saveJinKouSnapshot(params, liureng, runyear, wuxing, guirengType, diFen){
		if(!liureng){
			return;
		}
		const flds = this.props.fields;
		const baseParams = params ? params : (flds ? this.genGodsParams(flds) : null);
		if(!baseParams){
			return;
		}
		const finalZone = baseParams.zone !== undefined ? baseParams.zone : (flds && flds.zone ? flds.zone.value : '');
		const finalLon = baseParams.lon !== undefined ? baseParams.lon : (flds && flds.lon ? flds.lon.value : '');
		const finalLat = baseParams.lat !== undefined ? baseParams.lat : (flds && flds.lat ? flds.lat.value : '');
		const saveParams = {
			...baseParams,
			zone: finalZone,
			lon: finalLon,
			lat: finalLat,
		};
		const jinkouData = buildJinKouData(liureng, {
			diFen: diFen,
			guirengType: guirengType,
		});
		saveModuleAISnapshot('jinkou', buildJinKouSnapshotText(
			saveParams,
			liureng,
			runyear,
			jinkouData,
			wuxing,
			guirengType,
			this.state.birth && this.state.birth.gender ? this.state.birth.gender.value : 1
		), {
			date: saveParams.date,
			time: saveParams.time,
			zone: saveParams.zone,
			lon: saveParams.lon,
			lat: saveParams.lat,
			diFen: jinkouData && jinkouData.topInfo ? jinkouData.topInfo.diFen : '',
		});
	}

	async requestGods(fields){
		if(fields === undefined || fields === null){
			return;
		}
		const params = this.genGodsParams(fields);
		const data = await request(`${Constants.ServerRoot}/liureng/gods`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];

		const dayGanZi = result.liureng.nongli.dayGanZi;
		const dayGan = dayGanZi.substr(0, 1);
		const wx = LRConst.GanZiWuXing[dayGan];
		const timeZi = normalizeZiFromText(result.liureng.nongli.time);
		const diFen = timeZi ? timeZi : this.state.diFen;
		const st = {
			liureng: result.liureng,
			wuxing: wx,
			diFen: diFen,
		};

		this.setState(st, ()=>{
			this.requestRunYear();
			this.saveJinKouSnapshot(params, result.liureng, this.state.runyear, wx, this.state.guireng, diFen);
		});
	}

	async requestRunYear(){
		if(this.state.liureng === null){
			return;
		}
		const params = this.genRunYearParams();
		if(this.state.birth.date.value.year > this.props.fields.date.value.year){
			Modal.error({
				title: '出生年份必须小于卜卦年份',
			});
			return;
		}
		const data = await request(`${Constants.ServerRoot}/liureng/runyear`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];

		let age = this.props.fields.date.value.year - this.state.birth.date.value.year;
		age = Math.floor(age / 60) * 60 + result.age;
		result.age = age;
		this.setState({
			runyear: result,
		}, ()=>{
			this.saveJinKouSnapshot(null, this.state.liureng, result, this.state.wuxing, this.state.guireng, this.state.diFen);
		});
	}

	clickSaveCase(){
		if(!this.state.liureng){
			message.warning('请先完成起课后再保存');
			return;
		}
		const flds = this.props.fields;
		if(!flds){
			return;
		}
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		const snapshot = loadModuleAISnapshot('jinkou');
		const payload = {
			module: 'jinkou',
			snapshot: snapshot,
			liureng: this.state.liureng,
			runyear: this.state.runyear,
			wuxing: this.state.wuxing,
			guireng: this.state.guireng,
			diFen: this.state.diFen,
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `金口诀占断 ${divTime}`,
						caseType: 'jinkou',
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						payload: payload,
						sourceModule: 'jinkou',
					},
				},
			});
		}
	}

	genWuXingDoms(){
		return LRConst.WuXing.map((item, idx)=>{
			return (
				<Option key={idx} value={item.elem}>十二长生：{item.elem}--{item.ganzi}</Option>
			);
		});
	}

	componentDidMount(){
		this.unmounted = false;
		if(this.props.fields){
			this.requestGods(this.props.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	renderInfoTable(title, rows){
		if(!rows || rows.length === 0){
			return (
				<div style={{ border: '1px solid #d9d9d9', marginBottom: 8 }}>
					<div style={{ backgroundColor: '#f7f3dc', padding: '2px 8px', fontWeight: 600 }}>{title}</div>
					<div style={{ padding: '6px 8px', color: '#8c8c8c' }}>无</div>
				</div>
			);
		}
		return (
			<div style={{ border: '1px solid #d9d9d9', marginBottom: 8 }}>
				<div style={{ backgroundColor: '#f7f3dc', padding: '2px 8px', fontWeight: 600 }}>{title}</div>
				<div style={{ padding: 0 }}>
					<table style={{ width: '100%', borderCollapse: 'collapse' }}>
						<tbody>
							{
								rows.map((row, idx)=>(
									<tr key={`${title}_${idx}`}>
										<td style={{ width: '42%', borderTop: '1px solid #f0f0f0', padding: '2px 6px', color: '#595959' }}>{row.key}</td>
										<td style={{ borderTop: '1px solid #f0f0f0', padding: '2px 6px', color: row.color ? row.color : '#262626', wordBreak: 'break-all' }}>{row.value}</td>
									</tr>
								))
							}
						</tbody>
					</table>
				</div>
			</div>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 70px)';
		}else{
			height = height - 20;
		}

		let chartHeight = height;
		if(typeof chartHeight !== 'number'){
			chartHeight = 760;
		}

		const chartObj = this.props.value;
		const chart = chartObj ? chartObj.chart : {};
		const jinkouData = buildJinKouData(this.state.liureng, {
			diFen: this.state.diFen,
			guirengType: this.state.guireng,
		});
		const wxdoms = this.genWuXingDoms();

		const godsZiRows = this.state.liureng ? mapObjToRows(this.state.liureng.godsZi) : [];
		const godsYearRows = this.state.liureng && this.state.liureng.godsYear ? mapObjToRows(this.state.liureng.godsYear.taisui1) : [];
		const zsRows = ZSList.map((name)=>{
			const key = `${this.state.wuxing}_${name}`;
			return {
				key: name,
				value: ZhangSheng.wxphase[key] ? ZhangSheng.wxphase[key] : '—',
			};
		});
		const roleRefRows = [{
			key: '四、人元',
			value: '尊、客、天、君、祖、外',
		}, {
			key: '三、贵神',
			value: '上、主、宰相、臣、父、官禄',
		}, {
			key: '二、月将',
			value: '中、己身、妻财、亲戚、内',
		}, {
			key: '一、地分',
			value: '下、田宅、子孙、奴仆、鞍马、六畜',
		}];
		const optionTabHeight = Math.max(170, Math.floor(chartHeight * 0.36));

		return (
			<div>
				<Row gutter={6}>
					<Col span={16}>
						<div style={{
							height: chartHeight,
							overflow: 'auto',
							border: '1px solid #d9d9d9',
							backgroundColor: '#f7f7f7',
						}}>
							<div style={{
								width: '100%',
								height: chartHeight,
							}}>
								<JinKouChart
									value={chart}
									liureng={this.state.liureng}
									runyear={this.state.runyear}
									gender={this.state.birth.gender.value}
									zhangshengElem={this.state.wuxing}
									guireng={this.state.guireng}
									jinkouData={jinkouData}
									height={chartHeight}
									fields={this.props.fields}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
								/>
							</div>
						</div>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>
								<LiuRengInput
									fields={this.props.fields}
									onFieldsChange={this.onFieldsChange}
								/>
							</Col>
						</Row>
						<Row style={{ marginTop: 8 }} gutter={6}>
							<Col span={12}>
								<Button style={{ width: '100%' }} onClick={this.clickSaveCase}>保存</Button>
							</Col>
							<Col span={12}>
								<Select value={this.state.diFen} onChange={this.onDiFenChange} style={{ width: '100%' }}>
									{
										LRConst.ZiList.map((zi)=>(
											<Option key={`difen_${zi}`} value={zi}>地分：{zi}</Option>
										))
									}
								</Select>
							</Col>
						</Row>
						<Divider orientation='left'>卜卦人出生时间</Divider>
						<Row>
							<Col span={24}>
								<LiuRengBirthInput
									fields={this.state.birth}
									onFieldsChange={this.onBirthChange}
								/>
							</Col>
						</Row>
						<Divider />
						<Row gutter={6}>
							<Col span={24}>
								<Select value={this.state.wuxing} onChange={this.onWuXingChange} style={{ width: '100%' }}>
									{wxdoms}
								</Select>
							</Col>
							<Col span={24} style={{ marginTop: 4 }}>
								<Select value={this.state.guireng} onChange={this.onGuiRengChange} style={{ width: '100%' }}>
									<Option value={0}>六壬法贵人</Option>
									<Option value={1}>遁甲法贵人</Option>
									<Option value={2}>星占法贵人</Option>
								</Select>
							</Col>
						</Row>

						<Divider style={{ marginTop: 10, marginBottom: 8 }} />
						<Tabs
							activeKey={this.state.rightTab}
							onChange={this.setRightTab}
							defaultActiveKey='godsZi'
							tabPosition='top'
							size='small'
							style={{ height: optionTabHeight + 44 }}
						>
							<TabPane tab='支煞' key='godsZi'>
								<div className={styles.scrollbar} style={{ height: optionTabHeight, overflow: 'auto' }}>
									{this.renderInfoTable('支煞', godsZiRows)}
								</div>
							</TabPane>
							<TabPane tab='年煞' key='godsYear'>
								<div className={styles.scrollbar} style={{ height: optionTabHeight, overflow: 'auto' }}>
									{this.renderInfoTable('年煞', godsYearRows)}
								</div>
							</TabPane>
							<TabPane tab='十二长生' key='zs'>
								<div className={styles.scrollbar} style={{ height: optionTabHeight, overflow: 'auto' }}>
									{this.renderInfoTable(`${this.state.wuxing}十二长生`, zsRows)}
								</div>
							</TabPane>
							<TabPane tab='四位参考' key='roleRef'>
								<div className={styles.scrollbar} style={{ height: optionTabHeight, overflow: 'auto' }}>
									{this.renderInfoTable('四位参考', roleRefRows)}
								</div>
							</TabPane>
						</Tabs>
					</Col>
				</Row>
			</div>
		);
	}
}

export default JinKouMain;
