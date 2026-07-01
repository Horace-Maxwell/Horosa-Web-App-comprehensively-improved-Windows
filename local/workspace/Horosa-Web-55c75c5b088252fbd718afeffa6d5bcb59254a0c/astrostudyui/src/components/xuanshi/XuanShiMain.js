import React from 'react';
import { Spin, Empty } from 'antd';
import {
	XUANSHI_SUBPAGES,
	loadXuanShiState,
	saveXuanShiState,
} from '../../utils/xuanshiState';
import { fetchSummary, fetchEvents, fetchDaily, fetchFigures } from '../../services/xuanshi';
import { firstLoadParallelEnabled } from '../../utils/perfFlags';
import XuanShiEvents from './XuanShiEvents';
import XuanShiCelestial from './XuanShiCelestial';
import XuanShiMicro from './XuanShiMicro';
import XuanShiStories from './XuanShiStories';
import { resolveChartDate } from './xuanshiDate';
import XuanShiFigures from './XuanShiFigures';
import XuanShiMap from './XuanShiMap';
import XuanShiPersons from './XuanShiPersons';
import XuanShiTimeline from './XuanShiTimeline';
import XuanShiEncyclopedia from './XuanShiEncyclopedia';
import XuanShiSearch from './XuanShiSearch';
import XuanShiFacetSearch from './XuanShiFacetSearch';
import XuanShiDesk, { pushSearchHistory } from './XuanShiDesk';
import DateTime from '../comp/DateTime';

// 玄学史(中国玄学史)主页 —— 忠实移植源 app 的「宣纸×墨×朱砂」古籍美学。
// 设计系统类在 xuanshiTheme.less(经 app.less @import 全局加载);三栏:左 子页导航 / 中 主区。
// 子页内容按阶段填充;本版:总览(/summary 真数据,hero + 统计 + 入口卡)+ 10 子页路由占位。

// 朝代 → 都城 [lng, lat, 名](联动排盘用;无朝代则按年代推断)
const CAPITALS = {
	'西周': [108.9, 34.27, '镐京'], '春秋': [112.45, 34.62, '洛邑'], '战国': [112.45, 34.62, '洛邑'], '秦': [108.9, 34.27, '咸阳'],
	'西汉': [108.9, 34.27, '长安'], '新莽': [108.9, 34.27, '长安'], '东汉': [112.45, 34.62, '洛阳'], '三国': [112.45, 34.62, '洛阳'],
	'西晋': [112.45, 34.62, '洛阳'], '东晋': [118.8, 32.06, '建康'], '十六国': [112.45, 34.62, '中原'], '南朝': [118.8, 32.06, '建康'],
	'北朝': [112.45, 34.62, '洛阳'], '隋': [108.9, 34.27, '大兴'], '唐': [108.9, 34.27, '长安'], '五代': [114.3, 34.8, '开封'],
	'北宋': [114.3, 34.8, '开封'], '南宋': [120.15, 30.27, '临安'], '辽': [116.4, 39.9, '燕京'], '金': [116.4, 39.9, '中都'],
	'元': [116.4, 39.9, '大都'], '明': [116.4, 39.9, '北京'], '清': [116.4, 39.9, '北京'],
};
function capitalForYear(y) {
	if (y < -256) { return [112.45, 34.62, '洛邑']; }   // 先秦 → 洛邑
	if (y < 25) { return [108.9, 34.27, '长安']; }        // 秦西汉 → 长安
	if (y < 589) { return [112.45, 34.62, '洛阳']; }      // 东汉魏晋南北朝 → 洛阳
	if (y < 907) { return [108.9, 34.27, '长安']; }       // 隋唐 → 长安
	if (y < 1127) { return [114.3, 34.8, '开封']; }       // 五代北宋 → 开封
	if (y < 1279) { return [120.15, 30.27, '临安']; }     // 南宋 → 临安
	return [116.4, 39.9, '北京'];                          // 元明清 → 北京
}

// 十进制度 → app 经纬字符串("DDDeMM"/"DDnMM");后端 convertLonStrToDegree 按此格式 split,传数字会 IndexOutOfBounds
function degToDM(d, posSym, negSym) {
	let a = Math.abs(d), deg = Math.floor(a), mn = Math.round((a - deg) * 60);
	if (mn >= 60) { deg += 1; mn -= 60; }
	return `${deg}${d >= 0 ? posSym : negSym}${mn < 10 ? '0' + mn : mn}`;
}

export default class XuanShiMain extends React.Component {
	constructor(props) {
		super(props);
		const persisted = loadXuanShiState();
		this.state = {
			subpage: persisted.subpage || 'overview',
			ui: persisted,
			summary: null,
			summaryLoading: false,
			summaryErr: '',
			daily: null,
			featured: null,
			figuresTop: null,
			openEventId: null,
			openFigureSlug: null,
			openStorySlug: null,
			openEncEntry: null,
			openCelestialEvent: null,
		};
	}

	componentDidMount() { this.loadSummary(); }

	persist(patch) {
		const ui = { ...this.state.ui, ...patch };
		this.setState({ ui });
		saveXuanShiState(ui);
	}

	setSubpage = (key) => {
		this.setState({ subpage: key, openEventId: null, openFigureSlug: null, openStorySlug: null, openEncEntry: null, openCelestialEvent: null });
		this.persist({ subpage: key });
	};

	// 首页「检索」faceted 面板 → 去检索:存选择到 ui.search,切到统一搜索子页(读 ui.search 出结果)
	goFacetSearch = (sel) => {
		const ui = { ...this.state.ui, search: { ...sel }, subpage: 'search' };
		this.setState({ ui, subpage: 'search', openEventId: null });
		saveXuanShiState(ui);
		if (sel && sel.q) { pushSearchHistory(sel.q); } // 近探(案头)历史
	};

	// 检索结果点某事件 → 切到玄学万象子页并自动打开该事件详情
	goEvent = (id) => {
		this.setState({ openEventId: id, subpage: 'events', openFigureSlug: null });
		this.persist({ subpage: 'events' });
	};

	// 案头·私藏点开 → 按 kind 路由到对应子页 **并自动打开该条详情**(非仅跳列表页)
	goBookmark = (kind, ref) => {
		const RESET = { openEventId: null, openFigureSlug: null, openStorySlug: null, openEncEntry: null, openCelestialEvent: null };
		if (kind === 'event') { this.goEvent(ref); return; }
		if (kind === 'figure') { this.setState({ ...RESET, openFigureSlug: ref, subpage: 'figures' }); this.persist({ subpage: 'figures' }); return; }
		if (kind === 'story') { this.setState({ ...RESET, openStorySlug: ref, subpage: 'stories' }); this.persist({ subpage: 'stories' }); return; }
		if (kind === 'celestial') { this.setState({ ...RESET, openCelestialEvent: ref, subpage: 'celestial' }); this.persist({ subpage: 'celestial' }); return; }
		if (kind === 'technique' || kind === 'dynasty' || kind === 'celestial_term') {
			const cat = { technique: 'techniques', dynasty: 'dynasties', celestial_term: 'terms' }[kind];
			this.setState({ ...RESET, openEncEntry: { cat, slug: ref }, subpage: 'encyclopedia' });
			this.persist({ subpage: 'encyclopedia' });
			return;
		}
		this.setSubpage('overview');
	};

	// 联动:用某历史天象的公历日 + 朝代都城经纬,切到占星/七政并排该日之盘
	chartLink = (ev, tab) => {
		const { fields, dispatch, predictHook } = this.props;
		if (!fields || !dispatch || !ev) { return; }
		// 统一解析可起盘日期:精确 modern_date → year → 文本帝王纪年(襄公十四年)→ period 朝代段最早;无则不跳(不用 dynasty 兜底)
		const rd = resolveChartDate(ev);
		if (!rd) { return; }
		const md = rd.md, mdDisp = rd.disp;
		const m = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})/.exec(md);
		if (!m) { return; }
		const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), da = parseInt(m[3], 10);
		if (!y || !mo || !da) { return; }
		const cap = CAPITALS[ev.dynasty] || capitalForYear(y);
		const baseZone = (fields.date && fields.date.value && fields.date.value.zone) || (fields.zone && fields.zone.value) || '+08:00';
		// 自定义 DateTime 构造历史日:ad=±1 支持公元前全范围;缺具体时刻默认中午 12 点
		const tm = new DateTime({ ad: y < 0 ? -1 : 1, year: Math.abs(y), month: mo, date: da, hour: 12, minute: 0, second: 0, zone: baseZone });
		if (typeof tm.calcJdn === 'function') { tm.calcJdn(); } // 算 jdn(构造器未算;部分下游依赖)
		// 地点名并入 name(避免改 pos 类型破坏 fieldsToParams);经纬走 lat/lon
		const nameStr = `玄学史·${ev.omen || ev.title || '事件'}·${cap[2] || ''}·${mdDisp || md}`;
		const newFields = {
			...fields,
			date: { ...fields.date, value: tm },
			time: { ...fields.time, value: tm },
			lon: { ...fields.lon, value: degToDM(cap[0], 'e', 'w') },  // 字符串格式,勿传数字
			lat: { ...fields.lat, value: degToDM(cap[1], 'n', 's') },
			gpsLon: fields.gpsLon ? { ...fields.gpsLon, value: cap[0] } : fields.gpsLon,
			gpsLat: fields.gpsLat ? { ...fields.gpsLat, value: cap[1] } : fields.gpsLat,
			pos: fields.pos ? { ...fields.pos, value: cap[2] || nameStr } : fields.pos,
			name: fields.name ? { ...fields.name, value: nameStr } : fields.name,
		};
		const t = tab || 'astrochart';
		if (t === 'planetarium') {
			// 天文馆:设 fields(日期/经纬)+切 tab + 触发其重算(纯天文,不走排盘)
			dispatch({ type: 'astro/save', payload: { currentTab: t, fields: newFields } });
			if (predictHook && predictHook.planetarium && predictHook.planetarium.fun) { predictHook.planetarium.fun(newFields); }
		} else {
			// 同步设 fields(名称/地点/日期立即反映,不用手动按确定)+切 tab;再算盘
			dispatch({ type: 'astro/save', payload: { currentTab: t, fields: newFields } });
			dispatch({ type: 'astro/nowChart', payload: { fields: newFields } });
		}
	};

	async loadSummary() {
		if (this.state.summary || this.state.summaryLoading) { return; }
		this.setState({ summaryLoading: true, summaryErr: '' });
		// v3.0.1 perf R3(玄学史首屏):总览与「玄典甄选/玄学名家/事件」4 个请求互不依赖。原来是
		// 「await 总览 → 再发其余 3 个」的串行瀑布;现改为**同时发起**(纯发起时机,内容/结果不变),
		// 总览仍门控主体渲染、其余 3 个到达即填充。关开关(horosa.perf.firstLoadParallel=0)回到原串行。
		const parallel = firstLoadParallelEnabled();
		const fireTasters = () => {
			// 失败静默,不挡总览主体
			fetchDaily().then((d) => { if (d && !d.err && (d.title || d.blurb)) { this.setState({ daily: d }); } }).catch(() => {});
			fetchEvents({ page: 1, page_size: 6 }).then((r) => { this.setState({ featured: (r && r.items) || [] }); }).catch(() => {});
			fetchFigures({ status: 'all', limit: 6 }).then((r) => { this.setState({ figuresTop: (r && (r.items || r.figures)) || [] }); }).catch(() => {});
		};
		if (parallel) { fireTasters(); }
		try {
			const summary = await fetchSummary();
			this.setState({ summary, summaryLoading: false });
		} catch (e) {
			this.setState({ summaryLoading: false, summaryErr: `${e && e.message ? e.message : e}` });
		}
		if (!parallel) { fireTasters(); }
	}

	renderOverview() {
		const { summary, summaryLoading, summaryErr, featured } = this.state;
		if (summaryLoading) { return <div className="xuanshi-center"><Spin tip="载入玄学史…" /></div>; }
		if (summaryErr) {
			return (
				<div className="xuanshi-center">
					<Empty description={`总览载入失败:${summaryErr}`} />
					<span className="xuanshi-link" onClick={() => this.loadSummary()}>重试</span>
				</div>
			);
		}
		if (!summary) { return <div className="xuanshi-center"><Empty description="暂无数据" /></div>; }
		const c = summary.counts || {};
		const trad = summary.events_by_tradition || {};
		const ed = summary.editorial || {};
		const histCount = ((summary.event_facets || {}).histories || []).length; // 索引古籍 = 正史+野载 全部典籍
		const figs = this.state.figuresTop || [];
		const toolCards = [
			{ key: 'celestial', name: '星象大典', sub: '27K 天象事件', accent: 'var(--vermilion)' },
			{ key: 'timeline', name: '朝代时间轴', sub: '三千年事件分布', accent: 'var(--gold)' },
			{ key: 'micro', name: '天象微年表', sub: '逐年逐旬观象', accent: 'var(--gold)' },
			{ key: 'map', name: '地理地图', sub: '分野与地脉', accent: 'var(--jade)' },
			{ key: 'persons', name: '人物关系图', sub: '师承共现网络', accent: 'var(--jade)' },
		];
		const collection = [
			{ num: trad['正史'] || 0, label: '正史玄学', accent: 'var(--vermilion)' },
			{ num: trad['野载'] || 0, label: '野载玄学', accent: 'var(--vermilion)' },
			{ num: histCount, label: '索引古籍' },
			{ num: ed.figures_total || 0, label: '名家列传' },
			{ num: c.celestial_events || 0, label: '天象记录' },
		];
		return (
			<div>
				{/* Hero(对齐标准版首页)*/}
				<h1 className="xuanshi-display is-hero" style={{ fontSize: 'clamp(34px,5vw,52px)', fontWeight: 300 }}>中国玄学史</h1>
				<div className="xuanshi-hero-rule" />
				<div className="xuanshi-display" style={{ fontSize: 17, color: 'var(--ink)', marginTop: 14, letterSpacing: '.04em' }}>卜筮 · 占梦 · 相术 · 道术 · 风水 · 天象</div>
				<div className="xuanshi-stat-sub" style={{ fontSize: 13, marginTop: 6 }}>三千载玄虚之学 · 正史野载兼收</div>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26 }}>
					<span className="xuanshi-btn is-primary" onClick={() => this.setSubpage('events')}>玄学万象 →</span>
					<span className="xuanshi-btn" onClick={() => this.setSubpage('celestial')}>星象大典</span>
					<span className="xuanshi-btn" onClick={() => this.setSubpage('figures')}>名家列传</span>
				</div>

				{/* 检索 */}
				<div className="xuanshi-deco-line" style={{ margin: '34px 0 22px' }} />
				<XuanShiFacetSearch onSearch={this.goFacetSearch} tradition={(this.state.ui.search && this.state.ui.search.tradition) || '正史'} />

				{/* 玄典甄选 + 玄学名家 */}
				<div className="xuanshi-home-taster">
					<div>
						<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
							<h2 className="xuanshi-display is-h2" style={{ margin: 0 }}>玄典甄选</h2>
							<span className="xuanshi-link" onClick={() => this.setSubpage('events')}>看更多 →</span>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
							{(featured || []).map((e) => (
								<div className="xuanshi-card is-link" key={e.event_id} onClick={() => this.goEvent(e.event_id)}>
									<div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
										{e.dynasty ? <span className="xuanshi-chip is-ink">{e.dynasty}</span> : null}
										{e.techniques ? <span className="xuanshi-chip is-jade">{`${e.techniques}`.split(/[;,、，]/)[0]}</span> : null}
										{e.history ? <span className="xuanshi-stat-sub" style={{ marginLeft: 'auto', fontSize: 10 }}>《{e.history}》{e.volume_no ? `卷${e.volume_no}` : ''}</span> : null}
									</div>
									<div className="xuanshi-display is-h2" style={{ fontSize: 15, lineHeight: 1.4 }}>{e.title}</div>
									<div className="xuanshi-stat-sub" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
										{e.outcome || e.procedure || e.trigger || ''}
									</div>
								</div>
							))}
						</div>
					</div>
					<aside>
						<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
							<h2 className="xuanshi-display is-h2" style={{ margin: 0 }}>玄学名家</h2>
							<span className="xuanshi-link" onClick={() => this.setSubpage('figures')}>全部 →</span>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
							{figs.slice(0, 6).map((f) => (
								<div className="xuanshi-card is-link" key={f.slug} style={{ padding: 14 }} onClick={() => this.setSubpage('figures')}>
									<div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
										<span className="xuanshi-fig-seal" style={{ width: 40, height: 40, flex: '0 0 40px', fontSize: (f.name || '').length >= 3 ? 12 : 15 }}>{f.name}</span>
										<div style={{ minWidth: 0 }}>
											<div className="xuanshi-display" style={{ fontSize: 14, color: 'var(--ink)' }}>{f.name}</div>
											{f.dynasty ? <div className="xuanshi-stat-sub" style={{ fontSize: 10, marginTop: 1 }}>{f.dynasty}</div> : null}
										</div>
									</div>
									{f.one_liner ? <div className="xuanshi-stat-sub" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f.one_liner}</div> : null}
								</div>
							))}
						</div>
					</aside>
				</div>

				{/* 图谱工具 */}
				<h2 className="xuanshi-display is-h2" style={{ marginTop: 36 }}>图谱工具</h2>
				<div className="xuanshi-tool-grid">
					{toolCards.map((t) => (
						<div className="xuanshi-tool-card" key={t.key} style={{ '--accent': t.accent }} onClick={() => this.setSubpage(t.key)}>
							<div className="xuanshi-tool-name">{t.name}</div>
							<div className="xuanshi-tool-sub">{t.sub}</div>
						</div>
					))}
				</div>

				{/* 馆藏 */}
				<h2 className="xuanshi-display is-h2" style={{ marginTop: 36 }}>馆藏</h2>
				<div className="xuanshi-collection">
					{collection.map((s) => (
						<div className="xuanshi-coll-cell" key={s.label}>
							<div className="xuanshi-coll-num" style={s.accent ? { color: s.accent } : undefined}>{(s.num || 0).toLocaleString()}</div>
							<div className="xuanshi-coll-label">{s.label}</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	renderSubpage() {
		const { subpage } = this.state;
		if (subpage === 'overview') { return this.renderOverview(); }
		if (subpage === 'events') {
			return <XuanShiEvents ui={this.state.ui} openEventId={this.state.openEventId} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} onChartLink={this.chartLink} onHome={() => this.setSubpage('overview')} />;
		}
		if (subpage === 'celestial') {
			return <XuanShiCelestial ui={this.state.ui} openCelestialEvent={this.state.openCelestialEvent} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} onChartLink={this.chartLink} onHome={() => this.setSubpage('overview')} />;
		}
		if (subpage === 'figures') {
			return <XuanShiFigures ui={this.state.ui} openFigureSlug={this.state.openFigureSlug} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} onHome={() => this.setSubpage('overview')} onNav={(k) => this.setSubpage(k)} />;
		}
		if (subpage === 'map') {
			return <XuanShiMap ui={this.state.ui} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} onHome={() => this.setSubpage('overview')} />;
		}
		if (subpage === 'persons') {
			return <XuanShiPersons ui={this.state.ui} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} onHome={() => this.setSubpage('overview')} onOpenPerson={(name) => { const ui = { ...this.state.ui, figures: { ...(this.state.ui.figures || {}), q: name, dynasty: '', page: 1 }, subpage: 'figures' }; this.setState({ ui, subpage: 'figures', openEventId: null }); saveXuanShiState(ui); }} />;
		}
		if (subpage === 'stories') {
			return <XuanShiStories ui={this.state.ui} openStorySlug={this.state.openStorySlug} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} />;
		}
		if (subpage === 'timeline') {
			return <XuanShiTimeline ui={this.state.ui} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} onHome={() => this.setSubpage('overview')} onOpenEvent={this.goEvent} />;
		}
		if (subpage === 'encyclopedia') {
			return <XuanShiEncyclopedia ui={this.state.ui} openEncEntry={this.state.openEncEntry} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} />;
		}
		if (subpage === 'search') {
			return <XuanShiSearch ui={this.state.ui} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} onHome={() => this.setSubpage('overview')} onOpenEvent={this.goEvent} />;
		}
		if (subpage === 'desk') {
			return <XuanShiDesk onHome={() => this.setSubpage('overview')} onNav={(k) => this.setSubpage(k)} onOpen={this.goBookmark} onSearchHistory={(q) => this.goFacetSearch({ tradition: '正史', q, dynasty: [], technique: [], history: [], evidence: '' })} />;
		}
		if (subpage === 'micro') {
			return <XuanShiMicro ui={this.state.ui} onPersist={(k, p) => this.persist({ [k]: { ...(this.state.ui[k] || {}), ...p } })} onHome={() => this.setSubpage('overview')} />;
		}
		const label = (XUANSHI_SUBPAGES.find((s) => s.key === subpage) || {}).label || subpage;
		return <div className="xuanshi-center"><Empty description={`「${label}」建设中`} /></div>;
	}

	render() {
		const height = this.props.height || 800;
		const { subpage } = this.state;
		return (
			<div className="xuanshi-app" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
				<div className="xuanshi-side">
					<div className="xuanshi-brand">
						<span className="xuanshi-seal">玄</span>
						<span className="xuanshi-brand-name">玄学史</span>
					</div>
					{XUANSHI_SUBPAGES.map((s) => (
						<div
							key={s.key}
							className={`xuanshi-nav-item${subpage === s.key ? ' is-active' : ''}`}
							onClick={() => this.setSubpage(s.key)}
						>{s.label}</div>
					))}
				</div>
				<div className="xuanshi-stage"><div className="xuanshi-stage-inner">{this.renderSubpage()}</div></div>
			</div>
		);
	}
}
