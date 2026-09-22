import React from 'react';
import { XQSelect, XQCheckItem } from '../xq-ui';
import { AstroMsgCN } from '../../constants/AstroText';
import { CONDITION_TYPES, SCAN_BODIES } from '../../divination/zeri/conditionTypes';

const Option = XQSelect.Option;

// 元数据驱动的条件参数表单。整齐网格排版:两列字段对(label 定宽右对齐+控件满格),
// 多选/时间等长控件独占整行——参差 flex-wrap 已废(用户圈报)。
// [奇门择日] 加性 prop `types`:传入其它条件注册表(如 QIMEN_CONDITION_TYPES)即复用本表单;
// 缺省仍走天星 CONDITION_TYPES,既有调用零变化。
export default function ConditionParamsForm({ type, params, onChange, types }){
	const spec = (types || CONDITION_TYPES)[type];
	if(!spec){
		return null;
	}
	// [Q-465/T-427] 形态选择器可声明 resetsByValue:切到新形态时把与它共用同一参数键的字段一并重置成
	// 该形态的合法值(否则「目标=四轴点」下四轴框还留着星名 Venus,发出去整次搜索报 invalid_conditions)。
	const patch = (key, value) => {
		const fld = (spec.fields || []).find((x)=>x && x.key === key && x.resetsByValue);
		const extra = (fld && fld.resetsByValue && fld.resetsByValue[value]) || null;
		onChange({ ...params, [key]: value, ...(extra || {}) });
	};
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
					{/* [Q-474/T-436] 注册表可把「选了也不判别」的档标 disabled:选项仍在(旧方案里的值照常显示),
					    但不能再被选中 —— 比直接删档不破坏既有方案。 */}
					{f.options.map((o) => (<Option key={`${o.value}`} value={o.value} disabled={!!o.disabled} title={o.hint || undefined}>{o.label}</Option>))}
				</XQSelect>
			);
		}else if(f.kind === 'number'){
			// [Q-478/T-440] 清空后别静默:各求值器对 '' 会按 0 / 内置默认取值,用户看着空框、引擎按别的数扫。
			// 红框 + 行内提示,工作台侧同时禁用「加入 / 替换」(emptyNumberFieldError 同一判据)。
			const rawNum = params[f.key];
			const emptyNum = rawNum === '' || rawNum === null || rawNum === undefined || !Number.isFinite(Number(rawNum));
			control = (
				<div style={{ width: '100%' }}>
					<input type="number" min={f.min} max={f.max} step={f.step || 1}
						value={params[f.key]}
						aria-invalid={emptyNum ? 'true' : undefined}
						style={{ width: '100%', boxSizing: 'border-box', borderColor: emptyNum ? '#e5484d' : undefined }}
						onChange={(e) => patch(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
					{emptyNum ? <div style={{ fontSize: 11, color: '#e5484d', marginTop: 2, lineHeight: 1.4 }}>不能留空(留空会按 0 / 内置默认求值)</div> : null}
				</div>
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
