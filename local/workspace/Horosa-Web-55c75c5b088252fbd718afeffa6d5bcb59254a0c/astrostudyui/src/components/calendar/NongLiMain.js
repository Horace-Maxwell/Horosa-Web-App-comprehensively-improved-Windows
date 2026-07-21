import { Component } from 'react';
import { Row, Col, Divider, } from 'antd';
import { XQButton as Button } from '../xq-ui';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import DateTimeSelector from '../comp/DateTimeSelector';
import { convertLonToStr, convertLatToStr } from '../astro/AstroHelper';
import { dstAwareZoneAt } from '../../utils/timezone';
import { randomStr, } from '../../utils/helper';
import DateTime from '../comp/DateTime';
import NongLi from './NongLi';
import GuaChartDiv from '../gua/GuaChartDiv';
import {Week} from '../../msg/types';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { markInteractionStart, markPanelReady } from '../../utils/perfMark';

// horosa_panel_scu_v1:黄历族四个子页【零消费】共享 fields/chartObj(本页仅在 constructor
// 读一次 fields.gpsLon/gpsLat 作初值,渲染路径完全不碰),但父链每次 dva dispatch 都会把它们
// 重渲一遍。下面的 sCU 只在「自身 state 变了」或「除 fields 外的 props 变了」时放行。
// fields/fieldsAry 被显式排除 —— 理由写死在这里,日后若本页开始在 render 里读 fields,
// 必须把它从排除表拿掉,否则会出现「改了时间但本页不更新」的陈旧。
const SCU_IGNORED_PROPS = { fields: 1, fieldsAry: 1 };

export function calendarPanelShouldUpdate(prevProps, nextProps, prevState, nextState){
	const pk = Object.keys(prevProps);
	const nk = Object.keys(nextProps);
	if(pk.length !== nk.length){ return true; }
	for(let i = 0; i < nk.length; i++){
		const k = nk[i];
		if(SCU_IGNORED_PROPS[k]){ continue; }
		if(prevProps[k] !== nextProps[k]){ return true; }
	}
	// state 逐键引用比较:任何一键引用变了即放行(本族所有 setState 都是「造新对象/新数组」,
	// 无就地变异 —— 见各 handler)。键数不同也放行。
	const ps = Object.keys(prevState || {});
	const ns = Object.keys(nextState || {});
	if(ps.length !== ns.length){ return true; }
	for(let i = 0; i < ns.length; i++){
		const k = ns[i];
		if(!prevState || prevState[k] !== nextState[k]){ return true; }
	}
	return false;
}

// 日干支五行着色（与八字模块同色变量 --horosa-bazi-*）。农历网格 dayExtra 用。
const GAN_WX = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
const ZHI_WX = { 子: 'water', 丑: 'earth', 寅: 'wood', 卯: 'wood', 辰: 'earth', 巳: 'fire', 午: 'fire', 未: 'earth', 申: 'metal', 酉: 'metal', 戌: 'earth', 亥: 'water' };

// AI 导出/挂载快照 builder（纯函数,jest 直测）。四同步:段头须与 aiExport preset('calendar') 逐字一致。
// 月历行只收与 days[0] 同月的项(days 可能带下月补位);字段均后端真值直引,不在前端重算。
export function buildNongliSnapshotText(state){
	const st = state || {};
	const days = Array.isArray(st.days) ? st.days : [];
	const lines = [];
	const monthOf = (d)=>{
		const birth = `${d && d.birth ? d.birth : ''}`;
		return birth.slice(0, 7);
	};
	const dayOf = (d)=>{
		const birth = `${d && d.birth ? d.birth : ''}`;
		return birth.slice(5, 10);
	};

	const queryMonth = st.date && st.date.format ? st.date.format('YYYY-MM') : (days[0] ? monthOf(days[0]) : '');
	lines.push('[起盘信息]');
	if(queryMonth){ lines.push(`查询月份：${queryMonth}`); }
	if(st.date && st.date.zone !== undefined && st.date.zone !== null && `${st.date.zone}` !== ''){
		lines.push(`时区：东${st.date.zone}区`);
	}
	if(st.lon){ lines.push(`历算经度：${st.lon}`); }

	if(days.length){
		const curMonth = monthOf(days[0]);
		const rows = days.filter((d)=>d && monthOf(d) === curMonth);
		if(rows.length){
			lines.push('');
			lines.push('[当月月历]');
			lines.push('| 公历 | 星期 | 农历 | 日干支 | 节气/朔望 |');
			lines.push('| --- | --- | --- | --- | --- |');
			rows.forEach((d)=>{
				let nl = `${d.day || ''}`;
				if(d.dayInt === 1){
					nl = `${d.leap ? '闰' : ''}${d.month || ''}${d.day || ''}`;
				}
				const notes = [];
				if(d.jieqi){ notes.push(`${d.jieqi} ${d.jieqiTime || ''}`.trim()); }
				if(d.moonTime){
					const mt = d.dayInt === 1 ? '朔' : (d.dayInt === 15 ? '望' : '月相');
					notes.push(`${mt} ${d.moonTime}`.trim());
				}
				lines.push(`| ${dayOf(d)} | ${Week[`${d.dayOfWeek}`] || ''} | ${nl} | ${d.dayGanZi || ''} | ${notes.join('；')} |`);
			});
		}
	}

	const sel = st.dateSelected;
	if(sel && sel.birth){
		lines.push('');
		lines.push('[选中日详情]');
		lines.push(`公历：${sel.birth.split(' ')[0]} ${Week[`${sel.dayOfWeek}`] || ''}`);
		let selMonth = `${sel.month || ''}`;
		if(sel.leap){ selMonth = `闰${selMonth}`; }
		lines.push(`农历：${sel.year || ''}年${selMonth}${sel.day || ''}`);
		if(sel.yearNaying){ lines.push(`年纳音：${sel.yearNaying}`); }
		lines.push(`干支：${sel.yearJieqi || ''}年 ${sel.monthGanZi || ''}月 ${sel.dayGanZi || ''}日 ${sel.time || ''}时`);
		if(sel.jiedelta || sel.chef){ lines.push(`节候：${[sel.jiedelta, sel.chef].filter(Boolean).join('，')}`); }
		if(sel.jieqi){ lines.push(`节气：${sel.jieqi} ${sel.jieqiTime || ''}${sel.jieqiJdn ? `（jdn ${sel.jieqiJdn}）` : ''}`); }
		if(sel.moonTime){
			const mt = sel.dayInt === 1 ? '朔月' : (sel.dayInt === 15 ? '望月' : '月相');
			lines.push(`${mt}：${sel.date || ''} ${sel.moonTime}${sel.moonJdn ? `（jdn ${sel.moonJdn}）` : ''}`);
		}
		if(sel.qimengYearGua){
			const gua = st.yearGua;
			lines.push(`奇门年卦：${sel.qimengYearGua}${gua && gua.desc ? `（${gua.desc}）` : ''}`);
		}
	}

	if(lines.length <= 1){
		return '';
	}
	lines.push('');
	lines.push('[方法说明]');
	lines.push('月干支：以当天正午12点是否已跨节气决定归属月。');
	lines.push('年柱口径：干支年以节气（立春）为界；农历年月日以朔望月与置闰为准，两者并列显示。');
	lines.push('节气/朔望时刻为该历算经度下的真时刻；jdn 为对应儒略日数。');
	return lines.join('\n');
}

class NongLiMain extends Component{
	constructor(props) {
		super(props);
		this.state = {
			date: new DateTime(),
			gpsLon: this.props.fields.gpsLon.value,
			gpsLat: this.props.fields.gpsLat.value,
			lon: '120e00',
			lat: '0n00',
			days: [],
			prevDays: [],
			dateSelected: null,
			yearGua: null,
		};

		this.genParams = this.genParams.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.genSelectDateDom = this.genSelectDateDom.bind(this);
		this.dayExtra = this.dayExtra.bind(this);
		this.clickDate = this.clickDate.bind(this);
		this.clickYearGua = this.clickYearGua.bind(this);
		this.requestYearGua = this.requestYearGua.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	// AI 导出实时取数(同太乙机制):导出侧派发 refresh 事件,这里按当前 state 即时构建快照回填,
	// 保证「显示什么就导出什么」,不依赖懒存缓存是否已物化。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'calendar'){
			return;
		}
		const snapshotText = this.saveAISnapshot();
		if(snapshotText && evt && evt.detail && typeof evt.detail === 'object'){
			evt.detail.snapshotText = snapshotText;
		}
	}

	saveAISnapshot(){
		const snapshotText = `${buildNongliSnapshotText(this.state) || ''}`.trim();
		if(snapshotText){
			saveModuleAISnapshot('calendar', snapshotText);
		}
		return snapshotText;
	}

	genParams(){
		const params = {
			date: this.state.date.format('YYYY-MM-DD'),
			ad: this.state.date.ad || 1,
			zone: this.state.date.zone,
			lon: this.state.lon,
		}
		return params;
	}

	async requestNongli(){
		const params = this.genParams();

		const data = await request(`${Constants.ServerRoot}/calendar/month`, {
			body: JSON.stringify(params),
		});
		if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
		const result = data[Constants.ResultKey];

		const st = {
			days: result.days,
			prevDays: result.prevDays,
			dateSelected: null,
		};

		this.setState(st, ()=>{
			this.saveAISnapshot();
			markPanelReady('calendar');   // horosa_panel_ready_v1:月历网格数据落定 = 中栏画完
		});
	}

	async requestYearGua(){
		if(this.state.dateSelected === undefined || this.state.dateSelected === null){
			markPanelReady('calendar');   // horosa_panel_ready_v1:无可查年卦,右栏已是终态
			return null;
		}
		let date = this.state.dateSelected;
		let gua = date.qimengYearGua;
		if(gua === undefined || gua === null){
			markPanelReady('calendar');   // horosa_panel_ready_v1:同上,不留悬空计时
			return;
		}

		let params = {
			name: [gua],
		}
		const data = await request(`${Constants.ServerRoot}/gua/desc`, {
			body: JSON.stringify(params),
		});
		if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
		const result = data[Constants.ResultKey];

		const st = {
			yearGua: result[gua],
		};

		this.setState(st, ()=>{
			this.saveAISnapshot();
			markPanelReady('calendar');   // horosa_panel_ready_v1:年卦是选中日详情的最后一块
		});
	}

	onTimeChanged(dt){
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点(本页时间条不经 pages/index.js)
		this.setState({
			date: dt.value,
		}, ()=>{
			this.requestNongli();
		});
	}

	changeGeo(rec){
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
		// 选新地点时按新坐标自动校正时区(未在 atlas 内手改时区时),genParams 读 this.state.date.zone。
		// setZone 仅改时区标签、保留钟面时刻(见 DateTime.setZone),不移位时间。
		const patch = {
			lat: convertLatToStr(rec.lat),
			lon: convertLonToStr(rec.lng),
			gpsLat: rec.gpsLat,
			gpsLon: rec.gpsLng,
		};
		const cur = this.state.date;
		if(cur && cur.clone){
			const d = cur.clone();
			try{
				if(rec.zone){
					d.setZone(rec.zone);
					patch.date = d;
				}else{
					const ds = d.format ? d.format('YYYY-MM-DD') : null;
					const z = dstAwareZoneAt(rec.gpsLat, rec.gpsLng, ds);
					if(z && z.offset){ d.setZone(z.offset); patch.date = d; }
				}
			}catch(e){ /* 推断失败保留原时区 */ }
		}
		this.setState(patch, ()=>{
			this.requestNongli();
		});
	}

	clickDate(date){
		let lastdt = this.state.dateSelected;
		let lastGua = lastdt ? lastdt.qimengYearGua : null;
		let same = lastGua === date.qimengYearGua;

		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
		this.setState({
			dateSelected: date,
		}, ()=>{
			if(!same){
				this.requestYearGua();
			}
			this.saveAISnapshot();
			if(same){
				// horosa_panel_ready_v1:年卦未变 → 右栏这一帧即终态;年卦要重取时留给
				// requestYearGua 的终点收尾(它每条出口都打点,不会悬空)。
				markPanelReady('calendar');
			}
		});
	}

	clickYearGua(){
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
		this.requestYearGua();
	}

	// 农历网格格内附加：当日干支（五行着色）+ 有节气者附节气精确时刻（时分秒）。
	// 纯用后端 days 已带字段（dayGanZi/jieqi/jieqiTime），零逐格重算 → 不拖慢农历渲染。
	dayExtra(date){
		const gz = `${date.dayGanZi || ''}`;
		const gan = gz[0];
		const zhi = gz[1];
		if(!gz && !(date.jieqi && date.jieqiTime)){ return null; }
		// jieqiTime 后端为完整时刻串（"YYYY-MM-DD HH:mm:ss"）；格内日期已在，仅取时分秒。
		const jqTime = date.jieqiTime ? (`${date.jieqiTime}`.split(' ')[1] || `${date.jieqiTime}`) : '';
		return (
			<span className='horosa-nongli-cellrich'>
				{gz ? (
					<span className='horosa-nl-cell-gz'>
						<span className={`horosa-wx-${GAN_WX[gan] || 'earth'}`}>{gan}</span>
						<span className={`horosa-wx-${ZHI_WX[zhi] || 'earth'}`}>{zhi}</span>
					</span>
				) : null}
				{date.jieqi && jqTime ? (
					<span className='horosa-nl-cell-jieqi'>{jqTime}</span>
				) : null}
			</span>
		);
	}

	genSelectDateDom(){
		if(this.state.dateSelected === undefined || this.state.dateSelected === null){
			return null;
		}
		let date = this.state.dateSelected;
		let parts = date.birth.split(' ');
		let month = date.month + date.day;
		if(date.leap){
			month = '闰'+month;
		}

		let mt = '';
		if(date.dayInt === 1){
			mt = '朔月';
		}else if(date.dayInt === 15){
			mt = '望月';
		}

		let row = (
			<Row key={date.birth}>
				<Col span={24}>
					<span>{parts[0]}</span>&nbsp;
					<span>{Week[date.dayOfWeek+'']}</span>
				</Col>
				<Col span={24}>
					<span>年纳音：{date.yearNaying}</span>
				</Col>
				<Col span={24}>
					<span>{date.year}年{month}</span>
				</Col>
				<Col span={24}>
					<span>{date.yearJieqi}年</span>&nbsp;
					<span>{date.monthGanZi}月</span>&nbsp;
					<span>{date.dayGanZi}日</span>&nbsp;					
					<span>{date.time}时</span>&nbsp;					
				</Col>
				<Col span={24}>
					(此处月干支以当天中午12点计算是否跨节气来决定。)
				</Col>
				<Col span={24}>
					<span>{date.jiedelta}，{date.chef}</span>
				</Col>
				{
					date.jieqi && (
						<Col span={24}>
							<Divider />
							<span>{date.jieqi}</span>&nbsp;
							<span>{date.jieqiTime}</span>&nbsp;
						</Col>	
					)
				}
				{
					date.jieqi && (
						<Col span={24}>
							<span>jdn:{date.jieqiJdn}</span>&nbsp;					
						</Col>	
					)
				}
				{
					date.moonTime && (
						<Col span={24}>
							<Divider />
							<span>{mt}</span>&nbsp;
							<span>{date.date}&nbsp;{date.moonTime}</span>&nbsp;
						</Col>	
					)
				}
				{
					date.moonTime && (
						<Col span={24}>
							<span>jdn：{date.moonJdn}</span>&nbsp;					
						</Col>	
					)
				}
				<Col span={24}><Divider /></Col>
				{
					date.qimengYearGua && (
						<Col span={24}>
							<Button type='link' onClick={this.clickYearGua}>奇门年卦：{date.qimengYearGua}</Button>
						</Col>	
					)
				}
				{
					this.state.yearGua && (
						<Col span={24}>
							<Row>
								<Col span={6}>
									<GuaChartDiv value={this.state.yearGua} height={30} width={40} />
								</Col>
								<Col span={18}>
									<a href={this.state.yearGua.url} target='_blank'>{this.state.yearGua.desc}</a>
								</Col>
							</Row>
						</Col>
					)
				}
			</Row>
		);


		return row;
	}

	componentDidMount(){
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.requestNongli();
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// horosa_panel_scu_v1:见文件头注释。本页渲染只依赖 state + props.height,
	// fields 仅在 constructor 读一次 → 父链 dispatch 不再穿透成整页重渲。
	shouldComponentUpdate(nextProps, nextState){
		return calendarPanelShouldUpdate(this.props, nextProps, this.state, nextState);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = '100%'   // 充满整块board面板(原 calc(100%-30px) 令农历网格矮30px→底部黑条)
		}else{
			height = height - 30;
		}

		let seldatedom = this.genSelectDateDom();

		return (
			<div className='horosa-calendar-workbench'>
				<section className='horosa-calendar-board-panel horosa-nongli-board'>
						<NongLi
							height={height}
							date={this.state.date}
							days={this.state.days}
							prevDays={this.state.prevDays}
							focusDate={this.state.date}
							onDateClick={this.clickDate}
							dayExtra={this.dayExtra}
						/>
				</section>
				<aside className='horosa-calendar-detail-panel'>
					<div className='horosa-calendar-control-strip'>
								<DateTimeSelector 
									value={this.state.date}
									defaultTimeType='M'
									showTime={false}
									showAdjust={true}
									onlyMonthAdjust={true}
									onChange={this.onTimeChanged} 
								/>
					</div>
					<Divider />
					<div className='horosa-calendar-selected'>
						{seldatedom || <div className='horosa-empty-hint'>选择日期查看详细农历、干支与节气信息</div>}
					</div>
				</aside>
			</div>
		);
	}
}

export default NongLiMain;
