import React from 'react';
import { XQSelect, XQCheckItem } from '../xq-ui';
import { AstroMsgCN } from '../../constants/AstroText';
import { CONDITION_TYPES, SCAN_BODIES } from '../../divination/zeri/conditionTypes';

const Option = XQSelect.Option;

// 元数据驱动的条件参数表单。整齐网格排版:两列字段对(label 定宽右对齐+控件满格),
// 多选/时间等长控件独占整行——参差 flex-wrap 已废(用户圈报)。
export default function ConditionParamsForm({ type, params, onChange }){
	const spec = CONDITION_TYPES[type];
	if(!spec){
		return null;
	}
	const patch = (key, value) => onChange({ ...params, [key]: value });
	const cells = [];
	spec.fields.forEach((f, idx) => {
		if(typeof f.showIf === 'function' && !f.showIf(params)){
			return;
		}
		const key = `${f.key}_${idx}`;
		const wide = f.kind === 'multiselect' || f.kind === 'toggle';
		const label = (
			<span key={`${key}_l`} title={f.hint || undefined}
				style={{ fontSize: 12, opacity: 0.7, textAlign: 'right', whiteSpace: 'nowrap' }}>
				{f.kind === 'toggle' ? '' : f.label}
			</span>
		);
		let control = null;
		if(f.kind === 'body'){
			control = (
				<XQSelect size="small" style={{ width: '100%' }} value={params[f.key]}
					onChange={(v) => patch(f.key, v)} dropdownMatchSelectWidth={false}>
					{SCAN_BODIES.map((b) => (<Option key={b} value={b}>{AstroMsgCN[b] || b}</Option>))}
				</XQSelect>
			);
		}else if(f.kind === 'select'){
			control = (
				<XQSelect size="small" style={{ width: '100%' }} value={params[f.key]}
					onChange={(v) => patch(f.key, v)} dropdownMatchSelectWidth={false}>
					{f.options.map((o) => (<Option key={`${o.value}`} value={o.value}>{o.label}</Option>))}
				</XQSelect>
			);
		}else if(f.kind === 'multiselect'){
			control = (
				<XQSelect size="small" mode="multiple" style={{ width: '100%' }}
					value={params[f.key] || []}
					onChange={(v) => patch(f.key, v)}
					maxTagCount={5}
					dropdownMatchSelectWidth={false}>
					{f.options.map((o) => (<Option key={`${o.value}`} value={o.value}>{o.label}</Option>))}
				</XQSelect>
			);
		}else if(f.kind === 'number'){
			control = (
				<input type="number" min={f.min} max={f.max} step={f.step || 1}
					value={params[f.key]}
					style={{ width: '100%', boxSizing: 'border-box' }}
					onChange={(e) => patch(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
			);
		}else if(f.kind === 'toggle'){
			// 样式化勾选(全站皮肤 XQCheckItem,行内宽度覆盖其清单式 width:100%);
			// 相邻 toggle 由下方聚簇逻辑收进同一行省空间。
			control = (
				<XQCheckItem compact checked={!!params[f.key]} onClick={() => patch(f.key, !params[f.key])}
					style={{ width: 'auto', display: 'inline-grid', minHeight: 26 }}>
					{f.label}
				</XQCheckItem>
			);
		}else if(f.kind === 'time'){
			control = (
				<input type="time" className="horosa-native-date" value={params[f.key]}
					style={{ width: '100%', boxSizing: 'border-box' }}
					onChange={(e) => patch(f.key, e.target.value)} />
			);
		}
		cells.push({ key, label, control, wide, toggle: f.kind === 'toggle', pair: f.pair });
	});
	// 行编排:相邻 toggle 聚簇同一行;同 pair 键的相邻字段锁同一行(星对不许被顺序流拆行);
	// 其余散字段两两配对,跨 wide/toggle/pair 边界补半行。
	const rows = [];
	let toggleRun = [];
	let half = null;
	const flushToggles = () => {
		if(!toggleRun.length){
			return;
		}
		rows.push({ key: `tg_${toggleRun[0].key}`, kind: 'toggles', items: toggleRun });
		toggleRun = [];
	};
	const pushPair = (a, b) => rows.push({ key: `pr_${a.key}`, kind: 'pair', cells: [a, b] });
	const flushHalf = () => {
		if(half){
			pushPair(half, null);
			half = null;
		}
	};
	for(let i = 0; i < cells.length; i++){
		const c = cells[i];
		if(c.toggle){
			flushHalf();
			toggleRun.push(c);
			continue;
		}
		flushToggles();
		if(c.wide){
			flushHalf();
			rows.push({ key: c.key, kind: 'wide', cell: c });
			continue;
		}
		const next = cells[i + 1];
		if(c.pair && next && !next.toggle && !next.wide && next.pair === c.pair){
			flushHalf();
			pushPair(c, next);
			i++;
			continue;
		}
		if(half){
			pushPair(half, c);
			half = null;
		}else{
			half = c;
		}
	}
	flushHalf();
	flushToggles();
	const gridCell = (c, side) => (c ? [
		<div key={`${c.key}_lbl`} style={{ justifySelf: 'end' }}>{c.label}</div>,
		<div key={`${c.key}_ctl`}>{c.control}</div>,
	] : [
		<div key={`${side}_lbl_empty`} />,
		<div key={`${side}_ctl_empty`} />,
	]);
	return (
		<div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 52px minmax(0,1fr)', gap: '10px 8px', alignItems: 'center' }}>
			{rows.map((r) => {
				if(r.kind === 'toggles'){
					return (
						<div key={r.key} style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
							{r.items.map((c) => <React.Fragment key={c.key}>{c.control}</React.Fragment>)}
						</div>
					);
				}
				if(r.kind === 'wide'){
					const c = r.cell;
					return (
						<div key={c.key} style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: '0 8px', alignItems: 'center' }}>
							{c.label}
							<div>{c.control}</div>
						</div>
					);
				}
				return (
					<React.Fragment key={r.key}>
						{gridCell(r.cells[0], `${r.key}_a`)}
						{gridCell(r.cells[1], `${r.key}_b`)}
					</React.Fragment>
				);
			})}
		</div>
	);
}
