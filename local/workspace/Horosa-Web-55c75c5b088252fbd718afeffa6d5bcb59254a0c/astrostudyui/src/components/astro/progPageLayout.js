// 星运带盘子页共用版式件(推运 / 赤纬推运 / 恒星推运 / 演进推运 / 推运图 / 周日小限 / 双黄道;主限法盘等老页的右栏也用 SideColumn):
//   左边整列是盘:正方形,边长 = min(页高, 页宽 × 17⁄24),与主限法盘同比例;页高限住盘时多出来的宽度全给右栏(不留空白)。
//   右栏顶部留安全距离,分两段:
//     · 固定头(不随滚动):标题行(技法名 · 关键数值 · 口径说明悬浮)→「时间选择」(CompactTimeField:单击编辑器、双击键入、
//       编辑器里按住拖动调单位、下面一行步进)→「设置」;
//     · 表格区:只在表格内部滚动(表头吸顶),不再有外层滚动;各表卡高度按「公平分配」(allocateCardHeights):
//       放得下的表给足(绝不出现差几像素的滚动条),放不下的平分剩余,全放得下时多出的给主表(grow)。
// 尺寸只量容器(ResizeObserver),不读视口、不除缩放值(缩放域铁律:直接量容器对任何引擎都成立)。
import React, { Component } from 'react';
import { Row, Col, Divider, Tooltip } from 'antd';
import UpdatingBadge from '../common/UpdatingBadge';
import CompactTimeField, { dateTimeOf } from '../comp/CompactTimeField';
import DateTime from '../comp/DateTime';
import { cardStyle, SmallTable, symbolWithMeaning } from './AstroExtraCommon';
import { ZODIAC_ASPECT_LABELS, pointName } from '../../utils/directedFigures';
import styles from '../../css/styles.less';
import { createDeferredResizeObserver } from '../../utils/deferredResizeObserver';

export const PAGE_GAP = 10;
export const SIDE_TOP_PAD = 12;   // 右栏顶部安全距离
export const MUTED = { color: 'var(--horosa-text-soft)' };
const WHEEL_SHARE = 17 / 24;   // 与主限法盘 Col 17 / 7 同比例
const SIDE_MIN = 360;

// 整页壳:定高;updating = 有旧结果时后台重取中
export function ProgPageShell({ height, updating, children }){
	return (
		<div style={{ position: 'relative', height, display: 'flex', minHeight: 0 }}>
			{updating ? <UpdatingBadge /> : null}
			{children}
		</div>
	);
}

// 表格区高度分配(公平分配,像素):每张表卡上报「完整内容高」(表全部行都摆开时卡的高),右栏按表格区实测高分:
//   ① 全放得下 → 每张按内容高,多出来的给 grow 主表(卡底与盘底齐平,不留外部空白);
//   ② 放不下 → 从内容最矮的卡起,放得下的就给足(小表绝不出现「差几像素」的滚动条),剩下的高度在放不下的卡之间平分;
//      平分后只差一点(≤ 60px)就放得下的表,再从最大那张匀给它补足(那张保底 200px)。
// 百分比最小高在多层 flex 里不一定生效,所以全部按实测像素算。
const SideAlloc = React.createContext(null);
let fillCardSeq = 0;

const NEAR_FIT_PX = 60;
const DENSE_MAX_PX = 96;
const DONOR_MIN_PX = 200;
export function allocateCardHeights(cards, avail){
	// cards: [{ id, natural, grow }](按出现顺序);返回 { id: height }
	const out = {};
	if(!cards.length || !(avail > 0)){ return out; }
	const sorted = cards.slice().sort((a, b)=>a.natural - b.natural);
	let rem = avail;
	let left = sorted.length;
	sorted.forEach((c)=>{
		const share = rem / left;
		const h = Math.max(Math.min(c.natural, share), 0);
		out[c.id] = Math.ceil(h);
		rem -= out[c.id];
		left -= 1;
	});
	if(rem > 0){
		const g = cards.find((c)=>c.grow) || cards[cards.length - 1];
		out[g.id] += Math.floor(rem);
	}
	// 差一点点就放得下的表(缺口 ≤ NEAR_FIT_PX):从分得最多、仍要滚动的那张匀给它补足(那张保底 DONOR_MIN_PX),
	// 免得出现「只能滚十几像素」的滚动条
	cards.forEach((c)=>{
		const gap = c.natural - out[c.id];
		if(gap <= 0 || gap > NEAR_FIT_PX){ return; }
		const donor = cards.filter((d)=>d.id !== c.id && d.natural > out[d.id]).sort((a, b)=>out[b.id] - out[a.id])[0];
		if(donor && out[donor.id] - gap >= DONOR_MIN_PX){
			out[donor.id] -= gap;
			out[c.id] += gap;
		}
	});
	return out;
}

// 右栏:固定头 + 表格区。head 不随滚动;children 是表格卡(FillCard,各自卡内滚动)。
// scrollBody = 表格区整体滚动(老页右栏下半是一串长内容、不是 FillCard 时用)。
export class SideColumn extends Component{
	constructor(props){
		super(props);
		this.bodyRef = React.createRef();
		this.state = { bodyH: 0, naturals: {}, dense: false, denseNormalSum: 0 };
		this.order = [];
		this.measure = this.measure.bind(this);
		this.alloc = {
			report: (id, natural, grow)=>{
				if(this.order.indexOf(id) < 0){ this.order.push(id); }
				const cur = this.state.naturals[id];
				if(!cur || Math.abs(cur.natural - natural) > 1 || cur.grow !== grow){
					this.setState((st)=>({ naturals: { ...st.naturals, [id]: { natural, grow } } }));
				}
			},
			drop: (id)=>{
				this.order = this.order.filter((x)=>x !== id);
				this.setState((st)=>{ const n = { ...st.naturals }; delete n[id]; return { naturals: n }; });
			},
			heights: {},
		};
	}

	componentDidMount(){
		this.measure();
		// 统一入口:回调延到下一帧(setState 改卡高,同步跑会构成 RO 回环)
		this._ro = this.bodyRef.current ? createDeferredResizeObserver(this.measure) : null;
		if(this._ro){ this._ro.observe(this.bodyRef.current); }
	}

	componentWillUnmount(){
		this._unmounted = true;
		if(this._ro){ this._ro.disconnect(); this._ro = null; }
	}

	measure(){
		if(this._unmounted){ return; }
		const el = this.bodyRef.current;
		const h = el ? el.clientHeight : 0;
		// 表格区高变了(窗口 / 头部变高)就退出紧凑档,按正常行距重新量、重新判
		if(Math.abs(h - this.state.bodyH) > 1){ this.setState({ bodyH: h, dense: false, denseNormalSum: 0 }); }
	}

	// 紧凑档:各表合计只超出一点(≤ DENSE_MAX_PX)时收紧行距与卡内距,让它们放下,而不是让某张表只能滚几十像素;
	// 回差:进入时记下正常行距下的合计,只有可用高放得下那个合计时才退出(否则紧凑 ↔ 正常来回跳)
	componentDidUpdate(){
		if(this.props.scrollBody){ return; }
		const cards = this.order.filter((id)=>this.state.naturals[id]).map((id)=>this.state.naturals[id]);
		if(!cards.length || !this.state.bodyH){ return; }
		const avail = this.state.bodyH - Math.max(cards.length - 1, 0) * PAGE_GAP - 2;
		const sum = cards.reduce((a, c)=>a + c.natural, 0);
		if(!this.state.dense){
			const deficit = sum - avail;
			if(deficit > 0 && deficit <= DENSE_MAX_PX){ this.setState({ dense: true, denseNormalSum: sum }); }
		}else if(this.state.denseNormalSum && this.state.denseNormalSum <= avail){
			this.setState({ dense: false, denseNormalSum: 0 });
		}
	}

	render(){
		const { head, children, scrollBody, style, className } = this.props;
		const cards = this.order.filter((id)=>this.state.naturals[id]).map((id)=>({ id, ...this.state.naturals[id] }));
		const avail = this.state.bodyH - Math.max(cards.length - 1, 0) * PAGE_GAP - 2;
		this.alloc.heights = scrollBody ? {} : allocateCardHeights(cards, avail);
		// 新对象让 context 消费方随分配结果重渲染
		const ctx = { report: this.alloc.report, drop: this.alloc.drop, heights: this.alloc.heights };
		return (
			<div className={`horosa-prog-side${className ? ` ${className}` : ''}${this.state.dense && !scrollBody ? ' horosa-prog-dense' : ''}`} style={{ height: '100%', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', paddingTop: SIDE_TOP_PAD, ...style }}>
				<div className="horosa-prog-side-head" style={{ flex: '0 0 auto' }}>{head}</div>
				<div ref={this.bodyRef} className={scrollBody ? styles.scrollbar : undefined}
					style={{ flex: '1 1 0', minHeight: 160, marginTop: PAGE_GAP, display: 'flex', flexDirection: 'column', gap: PAGE_GAP, overflowY: scrollBody ? 'auto' : 'hidden', overflowX: 'hidden', paddingRight: scrollBody ? 6 : 0, paddingBottom: 2 }}>
					<SideAlloc.Provider value={scrollBody ? null : ctx}>{children}</SideAlloc.Provider>
				</div>
			</div>
		);
	}
}

// 左盘右栏。renderWheel(size, h):size = 盘宽(正方形边长),h = 盘列高。head / children 交给 SideColumn;
// 老页传 side(自带的 SideColumn)时只用本件算宽度 —— 星运 15 个带盘页盘大小与右栏宽度同一套算法,切页签盘不忽大忽小。
export class WheelSplit extends Component{
	constructor(props){
		super(props);
		this.ref = React.createRef();
		this.state = { w: 0, h: 0 };
		this.measure = this.measure.bind(this);
	}

	componentDidMount(){
		this.measure();
		// 统一入口:回调延到下一帧(本组件 setState 改盘尺寸,同步跑会构成 RO 回环);换档帧由登记表同步重量
		this._ro = this.ref.current ? createDeferredResizeObserver(this.measure) : null;
		if(this._ro){ this._ro.observe(this.ref.current); }
	}

	componentWillUnmount(){
		if(this._ro){ this._ro.disconnect(); this._ro = null; }
	}

	measure(){
		const el = this.ref.current;
		if(!el){ return; }
		const w = el.clientWidth;
		const h = el.clientHeight;
		if(Math.abs(w - this.state.w) > 1 || Math.abs(h - this.state.h) > 1){ this.setState({ w, h }); }
	}

	wheelSize(){
		const { w, h } = this.state;
		if(!w || !h){ return 0; }
		const size = Math.min(h, w * WHEEL_SHARE, w - SIDE_MIN - PAGE_GAP);
		return Math.max(Math.floor(size), 0);
	}

	render(){
		const size = this.wheelSize();
		const h = this.state.h;
		return (
			<div ref={this.ref} style={{ flex: '1 1 auto', minWidth: 0, height: '100%', display: 'flex', gap: PAGE_GAP, ...this.props.style }}>
				<div style={{ flex: `0 0 ${size}px`, minWidth: 0, height: '100%' }}>
					{size > 0 && h > 0 ? this.props.renderWheel(size, h) : null}
				</div>
				{this.props.side ? (
					// 老页自带右栏(已是 SideColumn):只换外框,宽度与新页同一套算法
					<div style={{ flex: '1 1 0', minWidth: 0, height: '100%', paddingRight: 8 }}>{this.props.side}</div>
				) : (
					<SideColumn head={this.props.head} style={{ flex: '1 1 0', paddingRight: 8 }}>
						{this.props.children}
					</SideColumn>
				)}
			</div>
		);
	}
}

// 右栏标题行:技法名 · 关键数值(小字,可换行)· 口径说明(悬浮)
export function SidePanelHead({ title, sub, desc, children }){
	return (
		<div>
			<div className="horosa-prog-side-title">
				<span className="horosa-prog-side-name">{title}</span>
				{sub ? <span className="horosa-prog-side-sub">{sub}</span> : null}
				{desc ? (
					<Tooltip title={desc} placement="bottomRight" overlayStyle={{ maxWidth: 440 }}>
						<span className="horosa-prog-side-note">口径说明</span>
					</Tooltip>
				) : null}
			</div>
			{children}
		</div>
	);
}

export function SideSection({ title, extra, children }){
	return (
		<React.Fragment>
			<Divider orientation="left" className="horosa-prog-side-divider">{title}{extra ? <span className="horosa-prog-side-divider-extra">{extra}</span> : null}</Divider>
			{children}
		</React.Fragment>
	);
}

// 设置栅格里的一格(两格一行,标签在上);栅格里只有一格时改成「标签 + 控件」同一行占满宽(不留半行空白)
export function ControlCol({ label, span, inline, children }){
	if(inline){
		return (
			<Col span={24} className="horosa-prog-control-inline">
				<div className="horosa-balbillus-label">{label}</div>
				<div className="horosa-prog-control-body">{children}</div>
			</Col>
		);
	}
	return (
		<Col span={span || 12} style={{ marginBottom: 8 }}>
			<div className="horosa-balbillus-label" style={{ whiteSpace: 'nowrap' }}>{label}</div>
			{children}
		</Col>
	);
}

export function ControlGrid({ children }){
	const items = React.Children.toArray(children).filter(Boolean);
	if(items.length === 1 && React.isValidElement(items[0])){
		return <Row gutter={12}>{React.cloneElement(items[0], { inline: true })}</Row>;
	}
	return <Row gutter={12}>{items}</Row>;
}

// 目标时刻(本盘时区钟面):页面状态存 YYYY-MM-DD / HH:mm:ss 两个字符串(后端字段与快照都按它),控件是左栏同一个紧凑时间块
export function TargetTimeControl({ date, time, zone, onChange }){
	const dt = DateTime.nowForChart(zone);
	dt.parse(`${date || ''} ${time || '12:00:00'}`.trim(), 'YYYY-MM-DD HH:mm:ss');
	return (
		<CompactTimeField
			inline
			label={null}
			hint={null}
			value={dt}
			timeText={`${date || ''} ${time || ''}`.trim()}
			needZone={false}
			onChange={(res)=>{
				const next = dateTimeOf(res);
				if(next && typeof next.format === 'function'){ onChange(next.format('YYYY-MM-DD'), next.format('HH:mm:ss')); }
			}}
		/>
	);
}

// 表格卡片:高度由右栏按「公平分配」给(见 allocateCardHeights);卡内的表配 SmallTable fill(盒子吃满卡、表头吸顶、卡内滚动)。
// 卡把自己的「完整内容高」= 卡当前高 − 表盒可视高 + 表盒内容高 报给右栏;表行变了 / 卡宽变了(换行)都会重报。
// grow = 主表:全放得下时多出来的高度给它。不在 SideColumn 里(老页的 scrollBody)时按内容自然排。
// 卡的「完整内容高」:内距 + 边框 + 各子块高;表盒按里面整张表的高算(不按表盒当前被分到的高,否则主表分到多余高度后会虚涨)
function cardNaturalHeight(el){
	if(typeof getComputedStyle !== 'function'){ return el.scrollHeight; }
	const px = (v)=>parseFloat(v) || 0;
	const cs = getComputedStyle(el);
	let h = px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
	Array.prototype.forEach.call(el.children, (ch)=>{
		const ccs = getComputedStyle(ch);
		const m = px(ccs.marginTop) + px(ccs.marginBottom);
		if(ch.classList && ch.classList.contains('horosa-small-table-scroll')){
			const t = ch.firstElementChild;
			// 表盒自身的内距 / 边框(表盒带底部内距,漏算它 = 每张「刚好放下」的表多出一条只能滚十几像素的假滚动条)
			// + 横向滚动条占的高(表宽于卡时)
			const box = px(ccs.paddingTop) + px(ccs.paddingBottom) + px(ccs.borderTopWidth) + px(ccs.borderBottomWidth);
			const hScrollbar = Math.max(ch.offsetHeight - ch.clientHeight - px(ccs.borderTopWidth) - px(ccs.borderBottomWidth), 0);
			h += (t ? t.offsetHeight : 0) + m + box + hScrollbar;
		}else{
			h += ch.offsetHeight + m;
		}
	});
	return h;
}

export function FillCard({ title, extra, note, grow, style, children }){
	const alloc = React.useContext(SideAlloc);
	const ref = React.useRef(null);
	const idRef = React.useRef(0);
	if(!idRef.current){ fillCardSeq += 1; idRef.current = fillCardSeq; }
	const id = idRef.current;
	React.useLayoutEffect(()=>{
		if(!alloc || !ref.current){ return undefined; }
		const el = ref.current;
		const report = ()=>{
			const natural = cardNaturalHeight(el);
			// 表格实测高常带小数(350.4px):向上取整再 +1,否则容器取整后亚像素溢出,刚好放下也画出滚动条
			if(natural > 0){ alloc.report(id, Math.ceil(natural) + 1, !!grow); }
		};
		report();
		const ro = createDeferredResizeObserver(report);
		if(ro){
			ro.observe(el);
			const table = el.querySelector('.horosa-small-table-scroll > table');
			if(table){ ro.observe(table); }
		}
		return ()=>{ if(ro){ ro.disconnect(); } };
	});
	React.useEffect(()=>(alloc ? ()=>alloc.drop(id) : undefined), [alloc ? 1 : 0]);   // 卸载时退出分配
	const h = alloc && alloc.heights ? alloc.heights[id] : undefined;
	const size = h ? { flex: '0 0 auto', height: h } : (alloc ? { flex: grow ? '1 1 0' : '0 1 auto', minHeight: 0 } : { flex: '0 0 auto' });
	return (
		<div ref={ref} className="horosa-prog-card" style={{ ...cardStyle, marginBottom: 0, display: 'flex', flexDirection: 'column', minWidth: 0, boxSizing: 'border-box', ...size, ...style }}>
			{title ? (
				<div className="horosa-info-card-title" style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, rowGap: 2, flex: '0 0 auto' }}>
					<span style={{ whiteSpace: 'nowrap' }}>{title}</span>{extra ? <span style={{ ...MUTED, fontSize: 11, fontWeight: 400 }}>{extra}</span> : null}
				</div>
			) : null}
			{children}
			{note ? <div style={{ ...MUTED, fontSize: 11, marginTop: 6, flex: '0 0 auto' }}>{note}</div> : null}
		</div>
	);
}

// 取不到结果(接口报错 / 本机服务没有这个接口 / 断网)时的说明;有旧结果时不显示(旧结果原样留着)
export function LoadFailNote(){
	return (
		<div style={{ ...cardStyle, marginBottom: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center' }}>
			<div style={{ color: 'var(--horosa-text)', fontWeight: 600 }}>没有取到计算结果</div>
			<div style={{ ...MUTED, fontSize: 12, maxWidth: 420, lineHeight: 1.7 }}>
				本机计算服务没有返回这个技法的结果。刚更新过程序时多半是计算服务还是旧版本,重启本机服务即可;本页每隔十几秒会自动重试。
			</div>
		</div>
	);
}

export function EmptyWheel({ text }){
	return (
		<div style={{ ...cardStyle, marginBottom: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...MUTED }}>{text}</div>
	);
}

// 推运盘对本命的相位表(太阳弧 / 返照 / 流年 / 小限 / 行星弧共用;与推运图族各页同一写法):
//   chart = 推运盘回包(读 chart.chart.aspects:[{ directId, objects: [{ natalId, aspect, delta }] }]);
//   renderPoint(id, side) 可选,side = 'dir' | 'natal'(宿主用它带出「宫位信息」显示项);缺省 = 字形盒 + 中文名。
export function aspectRowsOf(chart, limit = 160){
	const rows = [];
	((chart && chart.chart && chart.chart.aspects) || []).forEach((row)=>{
		(row.objects || []).forEach((o)=>{ if(rows.length < limit){ rows.push({ directId: row.directId, natalId: o.natalId, aspect: o.aspect, delta: o.delta }); } });
	});
	return rows;
}

export function pointGlyphName(id, showAstroMeaning){
	return (
		<span style={{ whiteSpace: 'nowrap' }}>
			<span style={{ display: 'inline-block', width: 16, textAlign: 'center', whiteSpace: 'nowrap' }}>{symbolWithMeaning(id, showAstroMeaning)}</span> {pointName(id)}
		</span>
	);
}

export function AspectTable({ chart, moverTitle, renderPoint, showAstroMeaning, emptyText }){
	const rows = aspectRowsOf(chart);
	if(!rows.length){
		return <div style={{ ...MUTED, fontSize: 12, padding: '4px 2px' }}>{chart ? (emptyText || '容许度内无相位。') : '取盘后显示相位。'}</div>;
	}
	const pt = (id, side)=>(renderPoint ? renderPoint(id, side) : pointGlyphName(id, showAstroMeaning));
	// 直接是 SmallTable fill:放进 FillCard 里参与右栏高度分配(卡内滚动、表头吸顶)
	return (
		<SmallTable rows={rows} fill scrollClassName={styles.scrollbar} columns={[
			{ key: 'directId', title: moverTitle || '推运星', width: '32%', render: (v)=>pt(v, 'dir') },
			{ key: 'aspect', title: '相位', width: '15%', render: (v)=>ZODIAC_ASPECT_LABELS[Math.round(Number(v))] || `${v}°` },
			{ key: 'natalId', title: '本命星', width: '32%', render: (v)=>pt(v, 'natal') },
			{ key: 'delta', title: '误差', align: 'right', render: (v)=>(Number.isFinite(Number(v)) ? Number(v).toFixed(3) : '-') },
		]} />
	);
}
