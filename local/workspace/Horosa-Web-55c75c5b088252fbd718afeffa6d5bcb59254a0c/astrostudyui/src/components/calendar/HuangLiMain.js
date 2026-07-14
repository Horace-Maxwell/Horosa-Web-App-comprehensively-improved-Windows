import { Component } from 'react';
import { Divider } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import { XQButton } from '../xq-ui';
import DateTimeSelector from '../comp/DateTimeSelector';
import DateTime from '../comp/DateTime';
import NongLi from './NongLi';
import HuangLiDayCard from './HuangLiDayCard';
import YearAuspiciousPanel from './YearAuspiciousPanel';
import { buildHuangliDay } from './huangliDay';
import { buildHuangliSnapshotText } from './huangliSnapshot';
import { wutuForDate } from './tongshu/wutu';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';

const MODULE = 'calendar-huangli';
// 干支 → 五行（与八字模块同色：--horosa-bazi-wood/fire/earth/metal/water）。
const GAN_WX = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
const ZHI_WX = { 子: 'water', 丑: 'earth', 寅: 'wood', 卯: 'wood', 辰: 'earth', 巳: 'fire', 午: 'fire', 未: 'earth', 申: 'metal', 酉: 'metal', 戌: 'earth', 亥: 'water' };

// 老黄历：中栏复用 NongLi 月历网格（默认不变；本 tab 传 dayExtra 叠加建除色带），
// 右栏为完整今日通书日课卡（buildHuangliDay 纯前端）。日课与经纬无关，网格仅借后端 /calendar/month 排布。
class HuangLiMain extends Component {
	constructor(props) {
		super(props);
		this.state = {
			date: new DateTime(),
			lon: '120e00',
			days: [],
			prevDays: [],
			selectedYmd: null,   // {y,m,d}
			selectedDay: null,   // buildHuangliDay 结果
			focus: null,         // 高亮用 DateTime
			yearPanelOpen: false,
		};
		this.huangliCache = {};

		this.requestMonth = this.requestMonth.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.clickDate = this.clickDate.bind(this);
		this.dayExtra = this.dayExtra.bind(this);
		this.selectByYmd = this.selectByYmd.bind(this);
		this.pickAuspiciousDay = this.pickAuspiciousDay.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	// 逐格日课缓存（避免重渲染重算），键=公历 y-m-d。
	getHuangli(y, m, d) {
		const key = `${y}-${m}-${d}`;
		if (!this.huangliCache[key]) { this.huangliCache[key] = buildHuangliDay(y, m, d); }
		return this.huangliCache[key];
	}

	// 乌兔九星缓存（网格叠加用）。
	getWutu(y, m, d) {
		if (!this.wutuCache) { this.wutuCache = {}; }
		const key = `${y}-${m}-${d}`;
		if (!(key in this.wutuCache)) { try { this.wutuCache[key] = wutuForDate({ y, m, d }); } catch (e) { this.wutuCache[key] = null; } }
		return this.wutuCache[key];
	}

	parseBirth(birth) {
		const ymd = `${birth || ''}`.split(' ')[0];
		const [y, m, d] = ymd.split('-').map((n)=> parseInt(n, 10));
		return { y, m, d, ymd };
	}

	// 日课卡纯前端(lunar)，不等后端：先选中今日，网格数据后到不覆盖已有选择。
	selectTodayIfEmpty() {
		if (this.state.selectedDay) { return; }
		const now = new DateTime();
		this.selectByYmd(this.parseBirth(`${now.format('YYYY-MM-DD')} 12:00:00`));
	}

	async requestMonth() {
		const params = { date: this.state.date.format('YYYY-MM-DD'), zone: this.state.date.zone, lon: this.state.lon };
		const data = await request(`${Constants.ServerRoot}/calendar/month`, { body: JSON.stringify(params) });
		if (!data) { return; }
		const result = data[Constants.ResultKey];
		this.setState({ days: result.days, prevDays: result.prevDays }, ()=>{
			// 切换月份后：若尚无选择或选中日不在本月，则选本月内今天、否则当月首日。
			const days = this.state.days || [];
			const sel = this.state.selectedYmd;
			const inMonth = sel && days.some((x)=> x && `${x.birth}`.split(' ')[0] === `${sel.y}-${String(sel.m).padStart(2, '0')}-${String(sel.d).padStart(2, '0')}`);
			if (inMonth) { return; }
			const today = new DateTime().format('YYYY-MM-DD');
			let pick = days.find((x)=> x && `${x.birth}`.split(' ')[0] === today);
			if (!pick) { pick = days[0]; }
			if (pick) { this.selectByYmd(this.parseBirth(pick.birth)); }
		});
	}

	selectByYmd({ y, m, d, ymd }) {
		const focus = new DateTime().parse(`${ymd} 12:00:00`, 'yyyy-MM-dd HH:mm:ss');
		this.setState({
			selectedYmd: { y, m, d },
			selectedDay: this.getHuangli(y, m, d),
			focus,
		}, this.saveAISnapshot);
	}

	onTimeChanged(dt) {
		this.setState({ date: dt.value }, ()=>{ this.requestMonth(); });
	}

	clickDate(date) {
		this.selectByYmd(this.parseBirth(date.birth));
	}

	// 年度吉日榜回填：跳到该日所在月并选中（网格随之刷新，requestMonth 保留本次选择）。
	pickAuspiciousDay(ymd) {
		const parsed = this.parseBirth(`${ymd} 12:00:00`);
		const dt = new DateTime().parse(`${ymd} 12:00:00`, 'yyyy-MM-dd HH:mm:ss');
		this.setState({ date: dt, yearPanelOpen: false }, ()=>{
			this.selectByYmd(parsed);
			this.requestMonth();
		});
	}

	// 网格每格叠加：日干支(五行色·与八字对齐) + 建除(吉凶色) + 黄/黑道 + 值宿 + 乌兔九星。
	// default-off，农历 tab 不传此 prop（零改动）。
	dayExtra(date) {
		const { y, m, d } = this.parseBirth(date.birth);
		if (!y) { return null; }
		const hd = this.getHuangli(y, m, d);
		const wt = this.getWutu(y, m, d);
		const jc = hd.jianchu;
		const jcCls = jc.jx === 'good' ? 'is-good' : (jc.jx === 'bad' ? 'is-bad' : 'is-neutral');
		const isHuang = hd.tianshen.type === '黄道';
		const gz = hd.lunar.dayGZ || '';
		const gan = gz[0];
		const zhi = gz[1];
		return (
			<span className='horosa-huangli-cellrich'>
				<span className='horosa-hl-cell-gz'>
					<span className={`horosa-wx-${GAN_WX[gan] || 'earth'}`}>{gan}</span>
					<span className={`horosa-wx-${ZHI_WX[zhi] || 'earth'}`}>{zhi}</span>
				</span>
				<span className='horosa-hl-cell-row'>
					<span className={`horosa-hl-cell-jc ${jcCls}`}>{jc.name}</span>
					<span className={`horosa-hl-cell-dao ${isHuang ? 'is-huangdao' : 'is-heidao'}`}>{isHuang ? '黄' : '黑'}</span>
					<span className='horosa-hl-cell-xiu'>{hd.xiu.name}</span>
				</span>
				{wt ? (
					<span className={`horosa-hl-cell-wutu ${wt.jx === 'good' ? 'is-good' : 'is-bad'}`}>
						{wt.star}{wt.isSun ? '☀' : (wt.isMoon ? '☾' : '')}
					</span>
				) : null}
				{(hd.yi && hd.yi.length) ? (
					<span className='horosa-hl-cell-yi'>宜 {hd.yi.slice(0, 2).join('·')}</span>
				) : ((hd.ji && hd.ji.length) ? (
					<span className='horosa-hl-cell-ji'>忌 {hd.ji.slice(0, 2).join('·')}</span>
				) : null)}
			</span>
		);
	}

	saveAISnapshot() {
		const text = `${this.state.selectedDay ? buildHuangliSnapshotText(this.state.selectedDay) : ''}`.trim();
		if (text) { saveModuleAISnapshot(MODULE, text); }
		return text;
	}

	handleSnapshotRefreshRequest(evt) {
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if (moduleName !== MODULE) { return; }
		const text = this.saveAISnapshot();
		if (text && evt && evt.detail && typeof evt.detail === 'object') { evt.detail.snapshotText = text; }
	}

	componentDidMount() {
		if (typeof window !== 'undefined') {
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.selectTodayIfEmpty();   // 先出卡片（纯前端），不等后端网格
		this.requestMonth();
	}

	componentWillUnmount() {
		if (typeof window !== 'undefined') {
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	render() {
		let height = this.props.height ? this.props.height : 760;
		if (height === '100%') { height = '100%'; } else { height = height - 30; }

		return (
			<div className='horosa-calendar-workbench' style={{ height }}>
				<section className='horosa-calendar-board-panel horosa-huangli-board'>
					<NongLi
						height={height}
						date={this.state.date}
						days={this.state.days}
						prevDays={this.state.prevDays}
						focusDate={this.state.focus}
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
						<div className='horosa-huangli-yearbtn'>
							<XQButton variant='primary' onClick={()=> this.setState({ yearPanelOpen: true })}>年度吉日榜</XQButton>
						</div>
					</div>
					<Divider />
					<div className='horosa-calendar-selected'>
						<HuangLiDayCard day={this.state.selectedDay} />
					</div>
				</aside>
				<YearAuspiciousPanel
					year={parseInt(this.state.date.format('YYYY'), 10)}
					visible={this.state.yearPanelOpen}
					onPick={this.pickAuspiciousDay}
					onClose={()=> this.setState({ yearPanelOpen: false })}
				/>
			</div>
		);
	}
}

export default HuangLiMain;
