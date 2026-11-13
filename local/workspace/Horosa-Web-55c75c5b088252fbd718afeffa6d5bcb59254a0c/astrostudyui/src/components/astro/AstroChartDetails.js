// 占星右栏「细节」页签:三十张盘面细节表,选一张看。算法在 /astroextra/chartdetails。
import { Component } from 'react';
import { Spin } from 'antd';
import { XQSelect as Select } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, chartParams, chartRequestKey, SmallTable, cardStyle, parkLoadFailure, clearLoadFailure, loadParked, LOAD_RETRY_PARK_MS } from './AstroExtraCommon';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import {
	CHART_DETAIL_OPTIONS, CHART_DETAIL_SETTINGS, CHART_DETAIL_TABLES, notifyChartDetailSettingsChanged, chartDetailFields, chartDetailRequestFields, detailBeamsName, detailMotionName, detailPairs, detailPointList,
	detailPointName, detailSacredName, detailAspectName, detailStarName, HOUR_ASPECT_NAMES, STAT_GROUPS,
} from '../../utils/chartDetails';

const { Option } = Select;
const MUTED = { color: 'var(--horosa-muted, #999)', fontSize: 12 };
const GOLD = { color: 'var(--horosa-gold, #b8860b)' };
const SEVEN = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const yes = (v)=>(v ? <span style={GOLD}>是</span> : <span style={MUTED}>否</span>);
const signed = (v)=>(Number(v) > 0 ? `+${v}` : `${v}`);
const fixed = (v, d)=>(Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '-');
const dateOnly = (v)=>`${v || '-'}`.trim().split(' ')[0];
const SIGN_CN = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const detailLon = (v)=>{
	const n = Number(v);
	if(!Number.isFinite(n)){ return '-'; }
	const x = ((n % 360) + 360) % 360;
	return `${SIGN_CN[Math.floor(x / 30)]} ${(x % 30).toFixed(2)}°`;
};
const planetColumn = { key: 'planet', title: '星', render: (v)=>detailPointName(v) };
const pointColumn = { key: 'point', title: '点', render: (v)=>detailPointName(v) };
const deg = (v, d = 2)=>(Number.isFinite(Number(v)) ? `${Number(v).toFixed(d)}°` : '-');
const aspectColumn = { key: 'aspect', title: '相位', render: detailAspectName };
const orbColumn = { key: 'orb', title: '容许', align: 'right', render: (v)=>deg(v) };
const applyName = (v)=>(v === null || v === undefined ? '-' : v ? '入' : '离');
const signList = (v)=>(v || []).map((i)=>SIGN_CN[i]).join('、');
const LIGHT_CN = { bright: '亮', dark: '暗', smoky: '烟', void: '空' };
// 选项字段 → 存储键
const FIELD_STATE = { faces: 'detailFaces', variant: 'detailVariant', lunar: 'detailLunar', mundo: 'detailMundo', midpoint: 'detailMidpoint' };
const POINT_COLUMNS = { eminence: true };

class AstroChartDetails extends Component{
	constructor(props){
		super(props);
		const saved = CHART_DETAIL_SETTINGS.load();
		this.state = { ...saved, result: null, resultSig: '', requestKey: '', loading: false, failed: false };
		this.load = this.load.bind(this);
		// 每个选项写死存储键:控件扫描靠字面量找 save 键
		this.savers = {
			faces: (v)=>this.save('detailFaces', v), variant: (v)=>this.save('detailVariant', v), lunar: (v)=>this.save('detailLunar', v),
			mundo: (v)=>this.save('detailMundo', v), midpoint: (v)=>this.save('detailMidpoint', v),
		};
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
	}

	componentDidUpdate(){
		const key = this.reqKey();
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	componentWillUnmount(){
		this._mounted = false;
		clearTimeout(this._retryTimer);
	}

	reqKey(){ return chartRequestKey(this.props.value, JSON.stringify(chartDetailRequestFields(this.state))); }

	save(field, value){
		CHART_DETAIL_SETTINGS.save({ [field]: value });
		notifyChartDetailSettingsChanged({ [field]: value });
		this.setState({ [field]: value });
	}

	async load(){
		this._seq = (this._seq || 0) + 1;
		const seq = this._seq;
		if(!this.props.value){ return; }
		const key = this.reqKey();
		const resultSig = natalSourceKey(this.props.value);
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/chartdetails`, {
				body: JSON.stringify({ ...chartParams(this.props.value), ...chartDetailRequestFields(this.state) }), silent: true, timeoutMs: 30000,
			});
			if(!this._mounted || seq !== this._seq){ return; }
			const result = unwrapResult(data);
			if(!result || result.err){
				this.loadFailed(key);
				return;
			}
			clearLoadFailure(this);
			this.setState({ result, resultSig, requestKey: key, loading: false, failed: false });
		}catch(e){
			if(!this._mounted || seq !== this._seq){ return; }
			this.loadFailed(key);
		}
	}

	// 失败后过了停车窗口自己再试一次
	loadFailed(key){
		parkLoadFailure(this, key);
		this.setState({ loading: false, failed: true });
		clearTimeout(this._retryTimer);
		this._retryTimer = setTimeout(()=>{ if(this._mounted){ this.forceUpdate(); } }, LOAD_RETRY_PARK_MS + 500);
	}

	tableOf(r){
		const table = this.state.detailTable;
		if(table === 'topics'){
			return (
				<SmallTable rows={r.topics} scrollX columns={[
					{ key: 'topic', title: '专题' },
					...SEVEN.map((name)=>({ key: name, title: detailPointName(name), align: 'right', render: (v, row)=>row.scores[name] })),
					{ key: 'winners', title: '主星', render: (v)=><span style={GOLD}>{detailPointList(v)}</span> },
				]} />
			);
		}
		if(table === 'accidental'){
			return (
				<div>
					<SmallTable rows={r.accidental.rows} scrollX columns={[
						planetColumn,
						...[['house', '宫'], ['speed', '速'], ['retro', '行'], ['orient', '东西'], ['sun', '日'], ['besieged', '围'], ['partile', '度'], ['stars', '恒星'], ['moonlight', '月光'], ['essential', '本质']]
							.map(([key, title])=>({ key, title, align: 'right', render: signed })),
						{ key: 'sum', title: '合计', align: 'right', render: (v)=><span style={GOLD}>{signed(v)}</span> },
					]} />
					<div style={{ ...MUTED, marginTop: 6 }}>命主星:{detailPointName(r.accidental.geniture)}</div>
				</div>
			);
		}
		if(table === 'persian'){
			return (
				<SmallTable rows={r.persian} scrollX columns={[
					planetColumn,
					...[['ruler', '守'], ['exalt', '旺'], ['term', '界'], ['triplicity', '三分'], ['face', '面'], ['place', '宫']].map(([key, title])=>({ key, title, align: 'right' })),
					{ key: 'sum', title: '合计', align: 'right', render: (v)=><span style={GOLD}>{v}</span> },
				]} />
			);
		}
		if(table === 'sunPhases'){
			return (
				<SmallTable rows={r.sunPhases} scrollX columns={[
					planetColumn,
					{ key: 'phaseName', title: '相' },
					{ key: 'elongation', title: '距日', align: 'right', render: (v)=>fixed(v, 2) },
					{ key: 'hours', title: '时位差', align: 'right', render: (v)=>fixed(v, 2) },
					{ key: 'motion', title: '运行', render: detailMotionName },
					{ key: 'sacred', title: '神圣', render: detailSacredName },
					{ key: 'beams', title: '七日内', render: detailBeamsName },
					{ key: 'nextStation', title: '下次留', render: dateOnly },
				]} />
			);
		}
		if(table === 'sect'){
			return (
				<SmallTable rows={r.sect} scrollX columns={[
					planetColumn,
					...[['east', '东出'], ['horizon', '地平'], ['sign', '座'], ['quadrant', '象限'], ['hayz', '喜乐'], ['ex', '失位'], ['almugea', '对望'], ['dustoria', '夜守']].map(([key, title])=>({ key, title, render: yes })),
					{ key: 'triplicity', title: '三分主', render: detailPointList },
				]} />
			);
		}
		if(table === 'dispositors'){
			return (
				<div>
					<SmallTable rows={r.dispositors.rows} columns={[
						planetColumn,
						{ key: 'chain', title: '星链', render: (v)=>v.map(detailPointName).join(' → ') },
						{ key: 'end', title: '终止', render: (v)=>(v === 'self' ? '自守' : '回环') },
					]} />
					<div style={{ ...MUTED, marginTop: 6 }}>最终定位星:{r.dispositors.final ? detailPointName(r.dispositors.final) : '无'}</div>
				</div>
			);
		}
		if(table === 'receptions'){
			if(!r.receptions.length){ return <div style={MUTED}>本盘没有互容</div>; }
			return (
				<SmallTable rows={r.receptions} columns={[
					{ key: 'name', title: '类型' },
					{ key: 'a', title: '星', render: detailPointName },
					{ key: 'b', title: '星', render: detailPointName },
				]} />
			);
		}
		if(table === 'relations'){
			return <SmallTable rows={r.relations} columns={[{ key: 'name', title: '关系' }, { key: 'items', title: '星', render: (v)=>detailPairs(v) || '无' }]} />;
		}
		if(table === 'hyleg'){
			return (
				<SmallTable rows={r.hyleg} columns={[
					{ key: 'label', title: '派' },
					{ key: 'hyleg', title: '寿主', render: detailPointName },
					{ key: 'alcocoden', title: '寿主星', render: detailPointName },
				]} />
			);
		}
		if(table === 'temperament'){
			const t = r.temperament;
			const names = ['上升座', '月相', '季节', '上升主', '命主'];
			const rows = t.votes.map((vote, i)=>({ id: names[i], heat: vote[0] > 0 ? '热' : '冷', moist: vote[1] > 0 ? '湿' : '干' }));
			return (
				<div>
					<div style={{ marginBottom: 6 }}><span style={GOLD}>{t.name}</span><span style={MUTED}> · 热冷 {signed(t.warm)} · 湿干 {signed(t.moist)}</span></div>
					<SmallTable rows={rows} columns={[{ key: 'id', title: '票' }, { key: 'heat', title: '热冷' }, { key: 'moist', title: '湿干' }]} />
				</div>
			);
		}
		if(table === 'hellenistic'){
			const h = r.hellenistic;
			const rows = [['主星', detailPointName(h.predominator)], ['三分主', detailPointList(h.triplicity)], ['界主', detailPointName(h.oversight)],
				['宫主', detailPointName(h.domicile)], ['月亮下一座座主', detailPointName(h.nextMoon)], ['本派光体界主', detailPointName(h.sectTerm)]].map(([id, value])=>({ id, value }));
			return <SmallTable rows={rows} columns={[{ key: 'id', title: '项' }, { key: 'value', title: '值' }]} />;
		}
		if(table === 'slavery'){
			return <SmallTable rows={r.slavery} columns={[{ key: 'test', title: '判据' }, { key: 'planets', title: '成立', render: (v)=>detailPointList(Array.from(new Set(v))) || <span style={MUTED}>否</span> }]} />;
		}
		if(table === 'fertility'){
			const fert = r.fertility || { rows: [] };
			return (
				<div>
					<div style={{ ...MUTED, marginBottom: 6 }}>出生时日月角距 {fixed(fert.elongation, 2)}°</div>
					<SmallTable rows={fert.rows} columns={[
						{ key: 'datetime', title: '时刻' },
						{ key: 'moonLon', title: '月亮', render: (v)=>detailLon(v) },
						{ key: 'male', title: '月座阴阳', render: (v)=>(v ? '阳 · 男' : '阴 · 女') },
					]} />
				</div>
			);
		}
		if(table === 'crisis'){
			const crisis = r.crisis || { rows: [] };
			return (
				<div>
					<div style={{ ...MUTED, marginBottom: 6 }}>起病时月亮 {detailLon(crisis.moon)}</div>
					<SmallTable rows={crisis.rows} columns={[
						{ key: 'arc', title: '月亮已走', align: 'right', render: (v)=>`${v}°` },
						{ key: 'datetime', title: '时刻' },
						{ key: 'days', title: '距起病', align: 'right', render: (v)=>`${fixed(v, 2)} 日` },
						{ key: 'critical', title: '性质', render: (v)=>(v ? <span style={GOLD}>危机日</span> : '判断日') },
					]} />
				</div>
			);
		}
		if(table === 'hourAspects'){
			const hours = r.hourAspects || {};
			const hits = (hours.pairs || []).filter((row)=>row.aspect !== null && row.aspect !== undefined);
			return (
				<div>
					<div style={{ ...MUTED, marginBottom: 6 }}>成相 {hits.length} 对</div>
					<SmallTable rows={hits} columns={[
						{ key: 'a', title: '星', render: detailPointName },
						{ key: 'b', title: '星', render: detailPointName },
						{ key: 'aspect', title: '相位', render: (v)=>HOUR_ASPECT_NAMES[v] || v },
						{ key: 'gap', title: '时位差', align: 'right', render: (v)=>fixed(v, 3) },
						{ key: 'orb', title: '容许', align: 'right', render: (v)=>fixed(v, 3) },
					]} />
					<div style={{ ...GOLD, margin: '10px 0 6px' }}>各星时位</div>
					<SmallTable rows={hours.bodies || []} columns={[
						{ key: 'id', title: '星', render: detailPointName },
						{ key: 'hourAngle', title: '时角', align: 'right', render: (v)=>`${fixed(v, 2)}°` },
						{ key: 'dec', title: '赤纬', align: 'right', render: (v)=>`${fixed(v, 2)}°` },
						{ key: 'hour', title: '时位', align: 'right', render: (v)=>fixed(v, 3) },
					]} />
				</div>
			);
		}
		if(table === 'lunarDays'){
			const lunar = r.lunarDays || {};
			if(lunar.note === 'polar'){ return <div style={MUTED}>当地月亮这段时间不升起,传统月亮日不成立,可换其他算法</div>; }
			return (
				<SmallTable rows={lunar.rows || []} scrollX rowStyle={(row)=>(row.current ? GOLD : undefined)} columns={[
					{ key: 'day', title: '日', align: 'right' },
					...(lunar.method === 'centered' ? [{ key: 'phase', title: '相' }] : []),
					{ key: 'start', title: '起' },
					{ key: 'end', title: '止' },
					{ key: 'hours', title: '时长', align: 'right', render: (v)=>`${fixed(v, 2)} 时` },
					{ key: 'current', title: '出生', render: (v)=>(v ? '在此日' : '') },
				]} />
			);
		}
		if(table === 'perfections'){
			if(!(r.perfections || []).length){ return <div style={MUTED}>没有在容许度内的星对</div>; }
			return (
				<SmallTable rows={r.perfections} scrollX columns={[
					{ key: 'a', title: '星', render: detailPointName }, aspectColumn, { key: 'b', title: '星', render: detailPointName },
					{ key: 'gap', title: '盘时离正相位', align: 'right', render: (v)=>deg(v) },
					{ key: 'applying', title: '入离', render: applyName },
					{ key: 'datetime', title: '正相位时刻' },
				]} />
			);
		}
		if(table === 'inMundo'){
			const mundo = r.inMundo || {};
			return (
				<div>
					<SmallTable rows={mundo.aspects || []} scrollX columns={[
						{ key: 'a', title: '点', render: detailPointName }, { key: 'b', title: '点', render: detailPointName }, aspectColumn,
						{ key: 'distance', title: '世俗距离', align: 'right', render: (v)=>deg(v, 3) }, orbColumn,
					]} />
					<div style={{ ...GOLD, margin: '10px 0 6px' }}>各点世俗位置</div>
					<SmallTable rows={mundo.positions || []} scrollX columns={[
						pointColumn, { key: 'position', title: '位置', align: 'right', render: (v)=>deg(v, 3) },
						{ key: 'house', title: '宫', align: 'right' }, { key: 'inHouse', title: '宫内', align: 'right', render: (v)=>deg(v) },
					]} />
					{(mundo.missing || []).length ? (
						<div style={{ ...MUTED, marginTop: 6 }}>{`所选宫制在本纬度对 ${detailPointList(mundo.missing)} 不成立(极区半弧无解或星体不出没),这些点不列、不参与相位。`}</div>
					) : null}
				</div>
			);
		}
		if(table === 'cuspAspects'){
			return (
				<SmallTable rows={r.cuspAspects || []} scrollX columns={[
					planetColumn, { key: 'house', title: '宫头', align: 'right', render: (v)=>`${v} 宫` }, aspectColumn, orbColumn, { key: 'applying', title: '入离', render: applyName },
				]} />
			);
		}
		if(table === 'starAspects'){
			if(!(r.starAspects || []).length){ return <div style={MUTED}>1° 内没有亮星相位</div>; }
			return (
				<SmallTable rows={r.starAspects} scrollX columns={[
					planetColumn, aspectColumn, { key: 'star', title: '恒星', render: detailStarName }, { key: 'starLon', title: '恒星黄经', render: (v)=>detailLon(v) }, orbColumn,
				]} />
			);
		}
		if(table === 'bindhu'){
			return (
				<SmallTable rows={r.bindhu || []} scrollX columns={[
					pointColumn, { key: 'lon', title: '位置', render: (v)=>detailLon(v) }, { key: 'degree', title: '投照度', align: 'right', render: (v)=>`第 ${v} 度` },
					{ key: 'a60', title: '六合', render: signList }, { key: 'a90', title: '刑', render: signList },
					{ key: 'a120', title: '拱', render: signList }, { key: 'a180', title: '冲', render: signList },
				]} />
			);
		}
		if(table === 'astrodynes'){
			const dynes = r.astrodynes || {};
			const total = (dynes.rows || []).reduce((sum, row)=>sum + Number(row.power || 0), 0) || 1;
			const one = (v)=>fixed(v, 2);
			return (
				<div>
					<SmallTable rows={dynes.rows || []} scrollX columns={[
						planetColumn, { key: 'house', title: '宫', align: 'right' },
						{ key: 'aspectPower', title: '相位力', align: 'right', render: one }, { key: 'housePower', title: '宫位力', align: 'right', render: one },
						{ key: 'power', title: '力量', align: 'right', render: (v)=><span style={GOLD}>{one(v)}</span> },
						{ key: 'pct', title: '占比', align: 'right', render: (v, row)=>`${(row.power / total * 100).toFixed(1)}%` },
						{ key: 'dignity', title: '尊贵', align: 'right', render: signed },
						{ key: 'harmony', title: '和谐', align: 'right', render: (v)=><span style={GOLD}>{signed(one(v))}</span> },
					]} />
					<div style={{ ...GOLD, margin: '10px 0 6px' }}>宫</div>
					<SmallTable rows={dynes.houses || []} scrollX columns={[
						{ key: 'house', title: '宫', align: 'right' }, { key: 'power', title: '力量', align: 'right', render: one }, { key: 'harmony', title: '和谐', align: 'right', render: (v)=>signed(one(v)) },
					]} />
					<div style={{ ...GOLD, margin: '10px 0 6px' }}>座</div>
					<SmallTable rows={dynes.signs || []} scrollX columns={[
						{ key: 'sign', title: '座', render: (v)=>SIGN_CN[v] }, { key: 'power', title: '力量', align: 'right', render: one }, { key: 'harmony', title: '和谐', align: 'right', render: (v)=>signed(one(v)) },
					]} />
					<div style={{ ...GOLD, margin: '10px 0 6px' }}>相位明细</div>
					<SmallTable rows={dynes.aspects || []} scrollX columns={[
						{ key: 'a', title: '点', render: detailPointName }, { key: 'b', title: '点', render: detailPointName }, aspectColumn, orbColumn,
						{ key: 'power', title: '力', align: 'right', render: one }, { key: 'harmony', title: '和谐', align: 'right', render: (v)=>signed(one(v)) },
					]} />
				</div>
			);
		}
		if(table === 'planetDetails'){
			return (
				<SmallTable rows={r.planetDetails || []} scrollX columns={[
					planetColumn,
					{ key: 'magnitude', title: '星等', align: 'right', render: (v)=>fixed(v, 2) },
					{ key: 'phase', title: '亮面', align: 'right', render: (v, row)=>(row.planet === 'Sun' ? '—' : `${fixed(v * 100, 1)}%`) },
					{ key: 'elongation', title: '距日', align: 'right', render: (v)=>deg(v) },
					{ key: 'diameter', title: '视径', align: 'right', render: (v)=>`${fixed(v * 3600, 1)}″` },
					{ key: 'azimuth', title: '方位', align: 'right', render: (v)=>deg(v) },
					{ key: 'altitude', title: '高度', align: 'right', render: (v)=>deg(v) },
					{ key: 'apparentAltitude', title: '视高度', align: 'right', render: (v)=>deg(v) },
					{ key: 'ra', title: '赤经', align: 'right', render: (v)=>deg(v) },
					{ key: 'decl', title: '赤纬', align: 'right', render: (v)=>deg(v) },
					{ key: 'speed', title: '日速', align: 'right', render: (v)=>fixed(v, 4) },
					{ key: 'accelerating', title: '增减', render: (v)=>(v ? '加速' : '减速') },
					{ key: 'speedPct', title: '速度比', align: 'right', render: (v)=>`${fixed(v, 1)}%` },
					{ key: 'speedMeanPct', title: '比均速', align: 'right', render: (v)=>`${fixed(v, 1)}%` },
				]} />
			);
		}
		if(table === 'degrees'){
			const dg = r.degrees || {};
			// 改进档是 Lilly 的一张表:明暗只有一派,深陷与井度是同一类(deep or pitted);经典档两派并列
			const lilly = ((dg.points || [])[0] || {}).school === 'lilly';
			const common = lilly ? [
				{ key: 'sex', title: '阴阳', render: (v)=>(v === 'masculine' ? '阳' : '阴') },
				{ key: 'lightA', title: '明暗', render: (v)=>LIGHT_CN[v] },
				{ key: 'deep', title: '深陷(井)', render: (v)=>(v ? '是' : '') }, { key: 'lame', title: '残缺', render: (v)=>(v ? '是' : '') },
				{ key: 'fortune', title: '增运', render: (v)=>(v ? '是' : '') },
			] : [
				{ key: 'sex', title: '阴阳', render: (v)=>(v === 'masculine' ? '阳' : '阴') },
				{ key: 'lightA', title: '明暗甲', render: (v)=>LIGHT_CN[v] }, { key: 'lightB', title: '明暗乙', render: (v)=>LIGHT_CN[v] },
				{ key: 'wells', title: '井度', render: (v)=>(v ? `${v} 派` : '') }, { key: 'fortune', title: '增运', render: (v)=>(v ? `${v} 派` : '') },
				{ key: 'lame', title: '残缺', render: (v)=>(v ? '是' : '') }, { key: 'deep', title: '深陷', render: (v)=>(v ? '是' : '') },
			];
			return (
				<div>
					<SmallTable rows={dg.points || []} scrollX columns={[pointColumn, { key: 'lon', title: '位置', render: (v)=>detailLon(v) }, ...common]} />
					<div style={{ ...GOLD, margin: '10px 0 6px' }}>宫头</div>
					<SmallTable rows={dg.cusps || []} scrollX columns={[
						{ key: 'house', title: '宫', align: 'right' }, { key: 'lon', title: '宫头', render: (v)=>detailLon(v) },
						{ key: 'term', title: '界', render: detailPointName }, { key: 'face', title: '面', render: detailPointName },
						{ key: 'duodecimal', title: '十二分', render: (v)=>SIGN_CN[v] }, { key: 'novenaria', title: '九分', render: (v)=>SIGN_CN[v] },
						{ key: 'mansion', title: '宿', align: 'right' }, ...common,
					]} />
				</div>
			);
		}
		if(table === 'midpoints'){
			const mp = r.midpoints || {};
			const ecl = mp.coord === 'ecliptic';
			return (
				<SmallTable rows={mp.rows || []} scrollX columns={[
					{ key: 'a', title: '点', render: detailPointName }, { key: 'b', title: '点', render: detailPointName },
					{ key: 'midpoint', title: '中点', render: (v)=>(ecl ? detailLon(v) : deg(v, 3)) },
					...(mp.coord === 'mundane' ? [{ key: 'house', title: '宫', align: 'right' }] : []),
					{ key: 'sum', title: '和', render: (v)=>(ecl ? detailLon(v) : deg(v, 3)) },
				]} />
			);
		}
		if(table === 'anatomy'){
			const an = r.anatomy || {};
			return (
				<div>
					<SmallTable rows={an.rows || []} scrollX columns={[
						pointColumn, { key: 'sign', title: '座', render: (v)=>SIGN_CN[v] }, { key: 'region', title: '星座所管' },
						{ key: 'organs', title: '本星所管', render: (v)=>v || <span style={MUTED}>—</span> }, { key: 'house', title: '宫', align: 'right' },
					]} />
					{an.sixthCusp ? <div style={{ ...MUTED, margin: '8px 0' }}>第六宫头在{SIGN_CN[an.sixthCusp.sign]},对应{an.sixthCusp.region}</div> : null}
					<div style={{ ...GOLD, margin: '10px 0 6px' }}>十二星座所管部位</div>
					<SmallTable rows={an.signs || []} columns={[{ key: 'sign', title: '座', render: (v)=>SIGN_CN[v] }, { key: 'region', title: '部位' }]} />
				</div>
			);
		}
		if(table === 'stats'){
			const st = r.stats || {};
			const rows = [];
			STAT_GROUPS.forEach(([group, label, names])=>{
				Object.keys(names).forEach((key)=>{
					const pts = (st[group] || {})[key] || [];
					rows.push({ id: `${group}-${key}`, group: label, item: names[key], count: pts.length, points: pts });
				});
			});
			return (
				<SmallTable rows={rows} columns={[
					{ key: 'group', title: '类' }, { key: 'item', title: '项' }, { key: 'count', title: '数', align: 'right' },
					{ key: 'points', title: '点', render: (v)=>detailPointList(v) || <span style={MUTED}>无</span> },
				]} />
			);
		}
		if(table === 'patterns'){
			if(!r.patterns.length){ return <div style={MUTED}>本盘没有成形的格局</div>; }
			return (
				<SmallTable rows={r.patterns} columns={[
					{ key: 'name', title: '格局' },
					{ key: 'corners', title: '角', render: (v)=>v.map((corner)=>corner.map(detailPointName).join('+')).join(' / ') },
				]} />
			);
		}
		return (
			<SmallTable rows={r[table]} columns={[
				{ key: 'test', title: '判据' },
				...(POINT_COLUMNS[table] ? [{ key: 'lord', title: '主星', render: detailPointName }] : []),
				{ key: 'hit', title: '成立', render: yes },
			]} />
		);
	}

	statusNote(r){
		if(!this.props.value){ return '起盘后显示细节表'; }
		if(r && this.state.failed){ return '这一次没取到新结果,下面还是上一次的表,稍后自动重试'; }
		return this.state.failed ? '细节表暂时取不到,稍后自动重试' : '';
	}

	render(){
		const r = pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
		const def = CHART_DETAIL_TABLES.find((item)=>item.value === this.state.detailTable) || CHART_DETAIL_TABLES[0];
		const fields = chartDetailFields(def.value);
		const zodiacal = this.props.value && this.props.value.params ? Number(this.props.value.params.zodiacal) : 0;
		const note = this.statusNote(r);
		return (
			<div style={{ height: this.props.height, overflowY: 'auto', overflowX: 'hidden', padding: '0 2px' }}>
				<div style={{ display: 'grid', gridTemplateColumns: `minmax(0, 2fr)${' minmax(0, 1fr)'.repeat(fields.length)}`, gap: 6, marginBottom: 6 }}>
					<Select style={{ width: '100%' }} value={this.state.detailTable} onChange={(v)=>this.save('detailTable', v)}>
						{CHART_DETAIL_TABLES.map((item)=>(<Option key={item.value} value={item.value}>{item.label}</Option>))}
					</Select>
					{fields.map((field)=>(
						<Select key={field} style={{ width: '100%' }} value={this.state[FIELD_STATE[field]]} onChange={this.savers[field]}>
							{CHART_DETAIL_OPTIONS[field].map((item)=>(<Option key={item.value} value={item.value}>{item.label}</Option>))}
						</Select>
					))}
				</div>
				<Spin spinning={this.state.loading && !r}>
					<div style={{ ...cardStyle, overflowX: 'auto' }}>
						<div className="horosa-info-card-title">{def.label}</div>
						<div style={{ ...MUTED, marginBottom: 6 }}>{def.note}</div>
						{zodiacal ? <div style={{ ...MUTED, marginBottom: 6 }}>本页按回归黄道计算</div> : null}
						{note ? <div style={{ ...MUTED, marginBottom: 6 }}>{note}</div> : null}
						{r ? this.tableOf(r) : null}
					</div>
				</Spin>
			</div>
		);
	}
}

export default AstroChartDetails;
