import { Component } from 'react';
import { Slider, Table } from 'antd';
import { XQSelect, XQDatePicker } from '../xq-ui';
import { rectificationHits, SA_RATE } from '../../utils/uranianDial';

// WP-10 校时工具(只读预览):事件日期→周岁→太阳弧→推进 MC/Asc→命中本命因子。
// 仅预览,绝不写回盘(fields.time 不动);「Asc 微调」滑块实时改本命 Asc 看命中数变化,松手即弃。
//   换算文案:1°MC≈4 分(时间);1°弧≈1 年(太阳弧)。

// 事件类型仅作标注(不参与几何);常见人生事件分类,纯文案。
const EVENT_TYPES = [
	{ value: 'marriage', label: '婚姻' },
	{ value: 'children', label: '生育' },
	{ value: 'career', label: '事业' },
	{ value: 'move', label: '迁居' },
	{ value: 'loss', label: '丧亲' },
	{ value: 'accident', label: '意外' },
	{ value: 'other', label: '其他' },
];
const soft = { color: 'var(--horosa-text-soft)' };

// 由出生 moment + 事件 moment 算周岁(弧年);任一缺失→null。
function yearsBetween(birth, when){
	if (!birth || !when || typeof birth.valueOf !== 'function' || typeof when.valueOf !== 'function') return null;
	const ms = when.valueOf() - birth.valueOf();
	if (!Number.isFinite(ms)) return null;
	return ms / (86400000 * 365.2422);
}

export default class UranianRectify extends Component {
	constructor(props){
		super(props);
		this.state = {
			ascNudge: 0, // 本命 Asc 微调(度);仅预览,不写回盘。
		};
		this.addEvent = this.addEvent.bind(this);
	}

	// 事件列表持久化交给父组件(saveDisp);本组件只读 props.events + 回调 props.onChange。
	patchEvents(next){ if (this.props.onChange) this.props.onChange(next); }

	addEvent(){
		const cur = Array.isArray(this.props.events) ? this.props.events : [];
		this.patchEvents(cur.concat([{ label: '', date: null, type: 'other' }]));
	}
	removeEvent(i){
		const cur = (Array.isArray(this.props.events) ? this.props.events : []).slice();
		cur.splice(i, 1);
		this.patchEvents(cur);
	}
	setEvent(i, patch){
		const cur = (Array.isArray(this.props.events) ? this.props.events : []).slice();
		cur[i] = { ...cur[i], ...patch };
		this.patchEvents(cur);
	}

	render(){
		const events = Array.isArray(this.props.events) ? this.props.events : [];
		const birth = this.props.birth; // moment/DateTime(本命出生时刻);缺则无法算年龄
		const glyphOf = this.props.glyphOf || ((id) => <span>{id}</span>);
		const base = this.props.base || 90;
		const orb = this.props.orb || 1;
		const rate = SA_RATE[this.props.saKey] || SA_RATE.naibod;   // [Q-147/T-54] 三档(含 Cardan)同 SA_RATE 单源
		const natalPts = Array.isArray(this.props.natalPts) ? this.props.natalPts : [];
		// 本命 MC/Asc(Asc 叠加微调);缺角则该轴不参与。
		const mc = Number.isFinite(Number(this.props.mc)) ? Number(this.props.mc) : null;
		const ascBase = Number.isFinite(Number(this.props.asc)) ? Number(this.props.asc) : null;
		const asc = ascBase == null ? null : ((ascBase + this.state.ascNudge) % 360 + 360) % 360;

		// 事件→弧年(由出生与事件日期);喂给纯函数 rectificationHits。
		const evInput = events.map((ev, i) => {
			const when = ev.date || null;
			const years = yearsBetween(birth, when);
			const lbl = (ev.label && `${ev.label}`.trim()) ? ev.label : `事件${i + 1}`;
			return { label: lbl, years: years == null ? NaN : years };
		});
		const angles = {};
		if (mc != null) angles.mc = mc;
		if (asc != null) angles.asc = asc;
		const results = rectificationHits(evInput, angles, natalPts, base, orb, rate);
		const totalHits = results.reduce((n, r) => n + (r.hits ? r.hits.length : 0), 0);

		const headStyle = { fontSize: 11, color: 'var(--horosa-text-soft)', marginBottom: 3 };
		const rowSty = { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' };

		// 命中表:每行一个事件,展开命中因子(轴/因子/角距)。
		const cols = [
			{ title: '事件', dataIndex: 'event', key: 'event', width: 70, render: (v) => <span style={{ fontSize: 12 }}>{v}</span> },
			{ title: '弧°', dataIndex: 'arc', key: 'arc', width: 52, render: (v) => <span style={soft}>{Number.isFinite(v) ? v.toFixed(2) : '—'}</span> },
			{
				title: '命中(轴→本命因子)', key: 'hits', render: (_v, r) => (
					(r.hits && r.hits.length)
						? <span>{r.hits.slice(0, 8).map((h, k) => (
							<span key={k} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>
								<span style={soft}>{h.angle} → </span>{glyphOf(h.factor)}<span style={soft}> ·{h.sep.toFixed(2)}°</span>
							</span>
						))}</span>
						: <span style={soft}>无命中</span>
				),
			},
		];

		return (
			<div>
				<div style={{ fontSize: 11, ...soft, marginBottom: 8, lineHeight: 1.7 }}>
					录入已知人生事件 → 推进 MC/Asc 看是否触动本命因子(只预览，不改盘)。
					换算：1°MC≈4 分；1°弧≈1 年（{({ oneDeg: '1°/年', cardan: 'Cardan', naibod: 'Naibod' })[this.props.saKey] || 'Naibod'}）。
				</div>

				{events.length === 0
					? <div style={{ ...soft, fontSize: 12, marginBottom: 8 }}>暂无事件，点下方「+ 事件」添加。</div>
					: events.map((ev, i) => (
						<div key={i} style={{ borderBottom: '1px solid var(--horosa-border-soft, rgba(0,0,0,0.06))', paddingBottom: 6, marginBottom: 6 }}>
							<div style={rowSty}>
								<XQDatePicker size="small" value={ev.date || null} format="YYYY-MM-DD"
									placeholder="事件日期" style={{ width: 140 }}
									onChange={(v) => this.setEvent(i, { date: v })} />
								<XQSelect size="small" value={ev.type || 'other'} style={{ width: 96 }}
									onChange={(v) => this.setEvent(i, { type: v })}
									options={EVENT_TYPES} />
								<input type="text" value={ev.label || ''} placeholder="备注"
									onChange={(e) => this.setEvent(i, { label: e.target.value })}
									style={{ flex: 1, minWidth: 80, fontSize: 12, padding: '2px 6px', borderRadius: 4,
										border: '1px solid var(--horosa-border-soft, rgba(0,0,0,0.12))', background: 'transparent', color: 'inherit' }} />
								<button type="button" onClick={() => this.removeEvent(i)}
									style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer', borderRadius: 4,
										border: '1px solid var(--horosa-border-soft, rgba(0,0,0,0.12))', background: 'transparent', color: 'inherit' }}>删</button>
							</div>
						</div>
					))}

				<button type="button" onClick={this.addEvent}
					style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', borderRadius: 4, marginBottom: 10,
						border: '1px solid var(--horosa-border-soft, rgba(0,0,0,0.12))', background: 'transparent', color: 'inherit' }}>+ 事件</button>

				{ascBase != null ? (
					<div style={{ marginBottom: 10 }}>
						<div style={headStyle}>建议 Asc 微调 <b>{this.state.ascNudge > 0 ? '+' : ''}{this.state.ascNudge.toFixed(2)}°</b>
							<span style={{ marginLeft: 6 }}>（≈ {(this.state.ascNudge * 4).toFixed(1)} 分钟 出生时间）</span></div>
						<Slider min={-3} max={3} step={0.05} value={this.state.ascNudge}
							onChange={(v) => this.setState({ ascNudge: Number(v) })} />
						<div style={{ ...soft, fontSize: 11 }}>命中合计 <b style={{ color: totalHits > 0 ? 'var(--horosa-accent, #c0392b)' : 'inherit' }}>{totalHits}</b> · 只预览，松手不改盘</div>
					</div>
				) : <div style={{ ...soft, fontSize: 11, marginBottom: 8 }}>本命缺 Asc，无法微调（仍可看 MC 推进命中）。</div>}

				{events.length > 0 ? (
					<Table className="horosa-uranian-rectify-table" size="small" rowKey={(r, i) => i}
						columns={cols} dataSource={results} pagination={false} bordered={false} />
				) : null}
			</div>
		);
	}
}
