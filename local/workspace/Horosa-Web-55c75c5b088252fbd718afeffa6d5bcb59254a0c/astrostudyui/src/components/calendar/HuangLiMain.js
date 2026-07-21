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
import { techniqueResultCacheEnabled } from '../../utils/perfFlags';
import { markInteractionStart, markPanelReady } from '../../utils/perfMark';
import { calendarPanelShouldUpdate } from './NongLiMain';

const MODULE = 'calendar-huangli';
// 干支 → 五行（与八字模块同色：--horosa-bazi-wood/fire/earth/metal/water）。
const GAN_WX = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
const ZHI_WX = { 子: 'water', 丑: 'earth', 寅: 'wood', 卯: 'wood', 辰: 'earth', 巳: 'fire', 午: 'fire', 未: 'earth', 申: 'metal', 酉: 'metal', 戌: 'earth', 亥: 'water' };

// horosa_kentang_result_cache_v1 —— 逐格日课(buildHuangliDay)/乌兔九星(wutuForDate)缓存**提升到模块级**。
// 原为 per-instance:切走黄历页 → 组件卸载 → 整月 ~42 格日课全丢,切回来逐格重算(纯前端但成本在渲染路径上)。
// 二者都是**纯函数**:入参只有公历 (y,m,d) 整数,无随机、无「现在时刻」依赖、无副作用 → 同键必同值,
// 跨实例复用与重算逐值等价。ns 显式写死在常量名里(不涉后端 URL)。
// 上限 512 条(≈12 个月网格)LRU:原 per-instance 明文无上限,提到模块级后必须有界,否则长期使用无限涨。
// 关 horosa.perf.techniqueResultCache → 回到 per-instance(=今日行为,逐字一致)。
const HUANGLI_DAY_MEM = new Map();
const HUANGLI_WUTU_MEM = new Map();
const HUANGLI_CACHE_MAX = 512;

function huangliMemGet(map, key, build){
	if(map.has(key)){
		return map.get(key);
	}
	const val = build();
	map.set(key, val);
	if(map.size > HUANGLI_CACHE_MAX){
		const first = map.keys().next().value;
		if(first !== undefined){
			map.delete(first);
		}
	}
	return val;
}

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
		// horosa_kentang_result_cache_v1:命中模块级 LRU(切页回来 0 重算);关闸=每实例独立(旧行为)。
		this._shareDayCache = techniqueResultCacheEnabled();

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
		if (this._shareDayCache) { return huangliMemGet(HUANGLI_DAY_MEM, key, ()=> buildHuangliDay(y, m, d)); }
		if (!this.huangliCache[key]) { this.huangliCache[key] = buildHuangliDay(y, m, d); }
		return this.huangliCache[key];
	}

	// 乌兔九星缓存（网格叠加用）。
	getWutu(y, m, d) {
		const key = `${y}-${m}-${d}`;
		if (this._shareDayCache) {
			return huangliMemGet(HUANGLI_WUTU_MEM, key, ()=>{ try { return wutuForDate({ y, m, d }); } catch (e) { return null; } });
		}
		if (!this.wutuCache) { this.wutuCache = {}; }
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
			// horosa_panel_ready_v1:选中日仍在本月 → 右栏日课卡不变,本帧网格画完即终态。
			if (inMonth) { markPanelReady('calendar'); return; }
			const today = new DateTime().format('YYYY-MM-DD');
			let pick = days.find((x)=> x && `${x.birth}`.split(' ')[0] === today);
			if (!pick) { pick = days[0]; }
			// 有 pick 时由 selectByYmd 收尾(它是最后一次 setState);无 pick 则此处即终态。
			if (pick) { this.selectByYmd(this.parseBirth(pick.birth)); }
			else { markPanelReady('calendar'); }   // horosa_panel_ready_v1
		});
	}

	selectByYmd({ y, m, d, ymd }) {
		const focus = new DateTime().parse(`${ymd} 12:00:00`, 'yyyy-MM-dd HH:mm:ss');
		this.setState({
			selectedYmd: { y, m, d },
			selectedDay: this.getHuangli(y, m, d),
			focus,
		}, ()=>{
			this.saveAISnapshot();
			// horosa_panel_ready_v1:日课卡(右栏)落定。
			// 🔴 必须再要求【中栏月历网格已到】才算「画完」:componentDidMount 会先
			// selectTodayIfEmpty() 出纯前端日课卡,而 /calendar/month 还在飞 —— 那一刻中栏是空的。
			// 首次点开「老黄历」子页签的那次计时若在此收尾,量到的是 ~0ms 的假数;
			// 真正的终点在 requestMonth 的回调里(网格落定后它自己打点或转调本函数)。
			if((this.state.days || []).length){
				markPanelReady('calendar');
			}
		});
	}

	onTimeChanged(dt) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
		this.setState({ date: dt.value }, ()=>{ this.requestMonth(); });
	}

	clickDate(date) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
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

	// horosa_panel_scu_v1:本页【零消费】props.fields —— 渲染只看 state + props.height。
	shouldComponentUpdate(nextProps, nextState) {
		return calendarPanelShouldUpdate(this.props, nextProps, this.state, nextState);
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
