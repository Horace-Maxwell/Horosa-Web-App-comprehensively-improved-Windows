// 世俗「行星周期」的周期表页签:大中小合、平均大合、千年轮转、世运法达、世俗小限等。算法在 /astroextra/mundanecycles。
import React, { Component } from 'react';
import { Spin } from 'antd';
import { XQSelect as Select, XQInputNumber } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { unwrapResult, chartParams, chartRequestKey, SmallTable, cardStyle, parkLoadFailure, clearLoadFailure, loadParked, LOAD_RETRY_PARK_MS } from '../astro/AstroExtraCommon';
import {
	MUNDANE_CYCLE_OPTIONS, MUNDANE_CYCLE_SETTINGS, MUNDANE_CYCLE_TABLES, RELATION_NAMES, WEATHER_ANGLE_NAMES, WEATHER_CONDITION_NAMES, WEATHER_VARIANT_NOTES, THOUSANDS_COLUMN_NOTES, WORLD_YEAR_COLUMN_NOTES,
	buildMundaneCycleText, weatherStarText, mundaneCycleFieldLabel, mundaneCycleFields, mundaneCycleRequestFields,
	mundaneCycleTable, mundaneLon, mundanePointName, mundaneSignName,
} from '../../utils/mundaneCycles';

const { Option } = Select;
const MUTED = { color: 'var(--horosa-muted, #999)', fontSize: 12 };
const GOLD = { color: 'var(--horosa-gold, #b8860b)' };
const OPTION_ROWS = [['conjKind'], ['meanTable'], ['firdariaLevel'], ['firdariaYears'], ['profRate'], ['profBase'], ['flood'], ['cycleYear'], ['dawrStart'], ['eraKind'], ['ingressPoint'], ['mpdKey'], ['weatherMonths'], ['cycleVariant']];
const dateOnly = (v)=>`${v || '-'}`.trim().split(' ')[0];
const lonColumn = { key: 'lon', title: '位置', render: mundaneLon };
const dateColumn = { key: 'date', title: '日期', render: dateOnly };
const signColumn = { key: 'sign', title: '座', render: mundaneSignName };
const planet = (key, title)=>({ key, title, render: mundanePointName });
const fixed = (key, title, d)=>({ key, title, align: 'right', render: (v)=>Number(v).toFixed(d) });
const DIRECTION_SIDE = { S: ' 左', D: ' 右' };
// 列头悬浮说明:虚下划线提示可悬停
const noted = (title, note)=>(note ? <span title={note} style={{ whiteSpace: 'nowrap', borderBottom: '1px dotted currentColor', cursor: 'help' }}>{title}</span> : title);
const withNotes = (cols, notes)=>cols.map((col)=>({ ...col, title: noted(col.title, notes[col.key]) }));
// 时刻串到分钟(公元前带负号,按正则拆不按位置切);认不出原样
const STAMP_RE = /^\s*(-?\d{1,6}-\d{1,2}-\d{1,2})[ T](\d{1,2}:\d{2})/;
const stampParts = (v)=>{
	const m = STAMP_RE.exec(`${v || ''}`);
	return m ? [m[1], m[2]] : [`${v || '-'}`, ''];
};
const SUB = { fontSize: 11, color: 'var(--horosa-muted, #999)' };
const WRAP = { whiteSpace: 'normal', minWidth: 56 };
// 气象占一行九项塞进右栏会横滚到看不见主星:按「朔望 / 关键度数与主星 / 十六相与条件 / 后随角与亮星」四格叠排,一屏看全
const WEATHER_COLUMNS = [
	{ key: 'date', title: '朔望', render: (v, row)=>(<div style={{ whiteSpace: 'nowrap' }}>{stampParts(v)[0]}<div style={SUB}>{`${stampParts(v)[1]} ${row.kind === 'new' ? '朔' : `望 · 取${mundanePointName(row.luminary)}`}`}</div>
		{row.season ? <div style={{ ...GOLD, fontSize: 11 }}>季节朔望<br />(入{mundaneSignName(Math.round(row.season.point / 30))}前)</div> : null}</div>) },
	{ key: 'lon', title: '关键度数 · 主星', render: (v, row)=>(<div style={WRAP}>{mundaneLon(v)}<div><span style={GOLD}>{row.lord ? mundanePointName(row.lord.planet) : '-'}</span>{row.lord ? ` ${mundaneSignName(row.lord.sign)}` : ''}</div></div>) },
	{ key: 'conds', title: '十六相 · 条件', render: (_v, row)=>(<div style={WRAP}>{row.lord ? row.lord.phaseName : '-'}
		<div style={SUB}>{((row.lord && row.lord.conditions) || []).filter((c)=>c !== 'SIGN').map((c)=>WEATHER_CONDITION_NAMES[c] || c).join('、') || '—'}</div></div>) },
	{ key: 'angle', title: '后随角 · 亮星', render: (v, row)=>(<div style={WRAP}>{`${WEATHER_ANGLE_NAMES[v] || v} · 座主 ${mundanePointName(row.angleRuler)}`}
		<div style={SUB}>{row.stars && row.stars.length ? weatherStarText(row.stars) : '1.6° 内无亮星'}</div></div>) },
];
const COLUMNS = {
	conjunctions: [dateColumn, lonColumn, { key: 'shift', title: '换组', render: (v)=>(v ? <span style={GOLD}>换</span> : '') }, { key: 'repeat', title: '三重', render: (v)=>(v ? '是' : '') }],
	meanConjunctions: [{ key: 'id', title: '序', align: 'right' }, dateColumn, lonColumn],
	turns: [dateColumn, signColumn, planet('lord', '主')],
	firdaria: [dateColumn, { key: 'lord', title: '主', render: (v, row)=>(v ? mundanePointName(v) : mundaneSignName(row.sign)) }, { key: 'years', title: '年', align: 'right' }],
	profections: [dateColumn, signColumn],
	thousands: withNotes([{ key: 'year', title: '年' }, planet('thousandLord', '千年主'), planet('turnLord', '转主'), planet('quarterLord', '季摄'), { key: 'quarterYear', title: '季内年', align: 'right' }, fixed('division', '分度', 1), fixed('turn', '转位', 0)], THOUSANDS_COLUMN_NOTES),
	// 二十列:主星类(世主 / 九主 / 法达三级 / 季摄 / 大年)靠前,一屏先看到;方向与小限的度数列在后
	worldYears: withNotes([{ key: 'year', title: '年' }, { key: 'worldYear', title: '世界年' }, planet('governor', '世主'), planet('governorNine', '九主'),
		planet('firdariaLord', '法达'), planet('firdariaMiddle', '中'), planet('firdariaLesser', '小'), planet('quarterLord', '季摄'), { key: 'greatYear', title: '大年', align: 'right' },
		fixed('dirYear', '年向', 0), fixed('profYear', '年限', 0), fixed('trepidation', '颤动', 2),
		fixed('dirMillennium', '千向', 2), fixed('dirCentury', '百向', 2), fixed('dirDecade', '十向', 2), fixed('profMillennium', '千限', 2), fixed('profCentury', '百限', 2), fixed('profDecade', '十限', 0),
		fixed('firdariaLon', '法达度', 2), fixed('firdariaBig', '大度', 2)], WORLD_YEAR_COLUMN_NOTES),
	dawr: [{ key: 'year', title: '年' }, signColumn, planet('lord', '年主'), planet('quarterLord', '四分主'), lonColumn],
	era: [{ key: 'year', title: '年' }, { key: 'asc', title: '上升', render: mundaneLon }, { key: 'turn', title: '换组', render: mundaneLon }, { key: 'conj', title: '大合', render: mundaneLon }, { key: 'flood', title: '洪水', render: mundaneLon }],
	parts: [{ key: 'formula', title: '式' }, lonColumn],
	weather: WEATHER_COLUMNS,
	lunations: [{ key: 'relative', title: '轮', align: 'right', render: (v)=>(v > 0 ? `+${v}` : `${v}`) }, { key: 'new', title: '朔' }, { key: 'firstQuarter', title: '上弦' }, { key: 'full', title: '望' },
		{ key: 'lastQuarter', title: '下弦' }, { key: 'sunLon', title: '朔时太阳', render: mundaneLon }, { key: 'gap', title: '距上轮', align: 'right', render: (v)=>(v ? `${Number(v).toFixed(2)} 日` : '') }],
	directions: [dateColumn, planet('promissor', '迫星'), { key: 'aspect', title: '相位', align: 'right', render: (v, row)=>`${v}°${DIRECTION_SIDE[row.side] || ''}` }, planet('significator', '应星'),
		fixed('arc', '弧', 2), fixed('days', '日', 1), { key: 'converse', title: '向', render: (v)=>(v ? '逆' : '顺') }],
	revolution: [planet('planet', '星'), lonColumn, { key: 'north', title: '黄纬', render: (v)=>(v ? '北' : '南') }, { key: 'retrograde', title: '逆', render: (v)=>(v ? '是' : '') }, { key: 'relation', title: '对日', render: (v)=>RELATION_NAMES[v] || '' }],
};

class MundaneCycleTables extends Component{
	constructor(props){
		super(props);
		this.state = { ...MUNDANE_CYCLE_SETTINGS.load(), startYear: null, endYear: null, startDraft: null, endDraft: null, result: null, resultSig: '', requestKey: '', loading: false, failed: false, outOfRange: false };
		this.load = this.load.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
	}

	componentDidUpdate(){
		const key = this.reqKey();
		if(key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	componentWillUnmount(){
		this._mounted = false;
		clearTimeout(this._retryTimer);
	}

	body(){
		const fields = mundaneCycleRequestFields(this.state, { startYear: this.state.startYear, endYear: this.state.endYear });
		const base = this.props.value ? chartParams(this.props.value) : { date: new Date().toISOString().slice(0, 10), time: '12:00:00', zone: '+00:00', lat: '0n00', lon: '0e00', hsys: 0 };
		// 起点取盘面日期 + 时刻(只发日期时后端按当天中午算,世运法达等「以盘面时刻为起点」的表会差半天)
		return { ...base, targetDate: base.date, targetTime: base.time || '12:00:00', ...fields };
	}

	reqKey(){ return JSON.stringify(this.body()); }

	// 无盘时周期表照样能算,来源键给个固定值
	sourceKey(){ return natalSourceKey(this.props.value) || 'no-chart'; }

	save(field, value){
		MUNDANE_CYCLE_SETTINGS.save({ [field]: value });
		this.setState({ [field]: value });
	}

	async load(){
		this._seq = (this._seq || 0) + 1;
		const seq = this._seq;
		const body = this.body();
		const key = JSON.stringify(body);
		const resultSig = this.sourceKey();
		if(mundaneCycleTable(this.state.cycleTable).chart && !this.props.value){
			this.setState({ result: null, requestKey: key, loading: false, failed: false, outOfRange: false });
			this.report('');
			return;
		}
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/mundanecycles`, { body: key, silent: true, timeoutMs: 60000 });
			if(!this._mounted || seq !== this._seq){ return; }
			const result = unwrapResult(data);
			if(!result){
				this.loadFailed(key);
				return;
			}
			clearLoadFailure(this);
			if(result.err){      // 接口算不出来(年份超出星历),重试也一样
				this.setState({ result: null, requestKey: key, loading: false, failed: false, outOfRange: true });
				this.report('');
				return;
			}
			this.setState({ result, resultSig, requestKey: key, loading: false, failed: false, outOfRange: false });
			this.report(buildMundaneCycleText(result, body));   // 接口没回带的口径(年长、周期年表起点)按这次请求写进快照
		}catch(e){
			if(!this._mounted || seq !== this._seq){ return; }
			this.loadFailed(key);
		}
	}

	report(text){
		if(this.props.onText){ this.props.onText(text, chartRequestKey(this.props.value)); }
	}

	loadFailed(key){
		parkLoadFailure(this, key);
		this.setState({ loading: false, failed: true });
		this.report('');
		clearTimeout(this._retryTimer);
		this._retryTimer = setTimeout(()=>{ if(this._mounted){ this.forceUpdate(); } }, LOAD_RETRY_PARK_MS + 500);
	}

	// 年份敲完才算数,逐键不发请求
	renderYear(field, draft, placeholder){
		const commit = ()=>{
			const value = this.state[draft];
			this.setState({ [field]: Number.isInteger(value) && value !== 0 ? value : null });
		};
		return (
			<XQInputNumber style={{ width: '100%' }} placeholder={placeholder} value={this.state[draft]} onChange={(v)=>this.setState({ [draft]: v })} onBlur={commit} onPressEnter={commit} />
		);
	}

	renderOption(key){
		return (
			<Select key={key} style={{ width: '100%' }} value={this.state[key]} onChange={(v)=>this.save(key, v)}>
				{MUNDANE_CYCLE_OPTIONS[key].map((item)=>(<Option key={`${item.value}`} value={item.value}>{item.label}</Option>))}
			</Select>
		);
	}

	render(){
		const r = pickKeyedDerived(this.state.result, this.state.resultSig, this.sourceKey());
		const def = mundaneCycleTable(this.state.cycleTable);
		const shown = r && r.table === def.value ? r : null;
		const fields = mundaneCycleFields(this.state);
		// 同一张表改了选项:旧表留在原处直到新结果回来 —— 标明「重算中」并淡化旧表,不让人把旧结果当新结果读
		const stale = !!shown && this.state.loading && this.state.requestKey !== this.reqKey();
		const many = shown && shown.rows.length > 14;
		return (
			<div>
				<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6, marginBottom: 6 }}>
					<Select style={{ width: '100%' }} value={this.state.cycleTable} onChange={(v)=>this.save('cycleTable', v)}>
						{MUNDANE_CYCLE_TABLES.map((item)=>(<Option key={item.value} value={item.value}>{item.label}</Option>))}
					</Select>
					{OPTION_ROWS.filter(([key])=>fields.includes(key)).map(([key])=>this.renderOption(key))}
					{def.range || def.year ? this.renderYear('startYear', 'startDraft', def.range ? '起始年' : '年份') : null}
					{def.range ? this.renderYear('endYear', 'endDraft', '结束年') : null}
				</div>
				<Spin spinning={this.state.loading} tip={stale ? '按新选项重算中' : undefined}>
					<div style={{ ...cardStyle, overflowX: 'auto' }}>
						<div className="horosa-info-card-title">{def.label}</div>
						<div style={{ ...MUTED, marginBottom: 6 }}>{def.note}{def.year || def.chart || def.zone ? '' : '。时间为世界时,以盘面时刻为准'}</div>
						{def.value === 'weather' ? <div style={{ ...MUTED, marginBottom: 6 }}>{WEATHER_VARIANT_NOTES[this.state.cycleVariant === 'classic' ? 'classic' : 'improved']}。时刻按盘面时区</div> : null}
						{def.value === 'thousands' || def.value === 'worldYears' ? <div style={{ ...MUTED, marginBottom: 6 }}>列头带虚线的,鼠标停上去看这一列的意思</div> : null}
						{stale ? <div style={{ ...MUTED, ...GOLD, marginBottom: 6 }}>按新选项重算中,下表还是上一次的结果</div> : null}
						{shown && shown.anchor ? <div style={{ ...MUTED, marginBottom: 6 }}>锚点:{dateOnly(shown.anchor)} {mundaneLon(shown.anchorLon)}</div> : null}
						{shown && shown.date ? <div style={{ ...MUTED, marginBottom: 6 }}>回归时刻(世界时):{shown.date}</div> : null}
						{this.state.failed ? <div style={{ ...MUTED, marginBottom: 6 }}>这张表暂时取不到,稍后自动重试</div> : null}
						{this.state.outOfRange ? <div style={{ ...MUTED, marginBottom: 6 }}>这段年份超出星历范围,换一个年份</div> : null}
						{def.chart && !this.props.value ? <div style={MUTED}>起盘后显示</div> : null}
						{shown && !shown.rows.length ? <div style={MUTED}>这段年份里没有</div> : null}
						{shown && shown.rows.length ? (
							<div style={stale ? { opacity: 0.45 } : undefined}>
								{/* 气象占四格叠排、不横滚;其余宽表横滚,行多时表在卡内滚动、表头吸顶,横向滚动条留在一屏之内 */}
								<SmallTable rows={shown.rows} scrollX={def.value !== 'weather'} maxHeight={many ? 'max(320px, calc(100 * var(--horosa-lvh, 1vh) - 360px))' : undefined} columns={COLUMNS[def.value]} />
							</div>
						) : null}
					</div>
				</Spin>
			</div>
		);
	}
}

export default MundaneCycleTables;
