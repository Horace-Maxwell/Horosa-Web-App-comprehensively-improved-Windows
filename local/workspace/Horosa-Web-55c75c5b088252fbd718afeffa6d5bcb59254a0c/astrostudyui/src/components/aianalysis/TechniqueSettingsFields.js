// 每技法「详细设置」字段渲染（无状态、纯 props）。
// 共用件:AI 对话挂载抽屉(AIAnalysisMain) 与其他设置界面共用,
// 保证各处「奇门排盘体例 / 六壬起课法 / …」等设置 UI 完全一致。
// 本组件是 mount-settings 通用渲染,不含任何调用方专用逻辑。
//
// props:
//   schemaKey  — 技法 key(getTechniqueSettingsSchema 取 schema)
//   draft      — 当前 options 草稿对象({字段名: 值})
//   onChange(name, value) — 字段更新回调(由父组件维护 draft)
import { Switch, Select, Input } from 'antd';
import moment from 'moment';
import { XQDatePicker } from '../xq-ui';
import { getTechniqueSettingsSchema } from '../../utils/techniqueMountSettings';
import styles from './TechniqueSettingsFields.less';

function renderField(field, draft, onChange){
	const value = Object.prototype.hasOwnProperty.call(draft || {}, field.name)
		? draft[field.name]
		: field.default;
	if(field.type === 'switch'){
		return (
			<div className={styles.techSettingRow} key={field.name}>
				<span className={styles.techSettingLabel}>{field.label}</span>
				<Switch
					size="small"
					checked={`${value}` === '1' || value === true}
					onChange={(checked)=>onChange(field.name, checked ? 1 : 0)}
				/>
			</div>
		);
	}
	if(field.type === 'select'){
		return (
			<div className={styles.techSettingRow} key={field.name}>
				<span className={styles.techSettingLabel}>{field.label}</span>
				<Select
					size="small"
					value={value}
					style={{ minWidth: 180 }}
					onChange={(val)=>onChange(field.name, val)}
				>
					{(field.options || []).map((opt)=>(
						<Select.Option key={`${opt.value}`} value={opt.value}>{opt.label}</Select.Option>
					))}
				</Select>
			</div>
		);
	}
	if(field.type === 'multiselect'){
		const arrVal = Array.isArray(value) ? value : [];
		let opts = field.options;
		if(!Array.isArray(opts) && field.dynamicOptions){
			opts = typeof field.dynamicOptions === 'function' ? field.dynamicOptions(draft || {}) : field.dynamicOptions;
		}
		return (
			<div className={styles.techSettingRow} key={field.name}>
				<span className={styles.techSettingLabel}>{field.label}</span>
				<Select
					mode="multiple"
					size="small"
					value={arrVal}
					allowClear
					style={{ minWidth: 220, maxWidth: 280 }}
					placeholder={field.placeholder || '不选=不挂'}
					onChange={(val)=>onChange(field.name, Array.isArray(val) ? val : [])}
				>
					{(Array.isArray(opts) ? opts : []).map((opt)=>(
						<Select.Option key={`${opt.value}`} value={opt.value}>{opt.label}</Select.Option>
					))}
				</Select>
			</div>
		);
	}
	if(field.type === 'datetime' || field.type === 'date' || field.type === 'time'){
		const draftStr = value === undefined || value === null ? '' : `${value}`;
		const isDatetime = field.type === 'datetime';
		const isTime = field.type === 'time';
		const fmt = isDatetime ? 'YYYY-MM-DD HH:mm' : (isTime ? 'HH:mm' : 'YYYY-MM-DD');
		const mVal = draftStr ? moment(draftStr, fmt) : null;
		const pickerProps = {
			size: 'small',
			format: fmt,
			// 🔴 未设置必须传 null 显 placeholder:曾恒回退 moment() → 「留空=单点/此刻」
			// 语义的字段(推运目标时刻/扫描区间终点)面板显示今天,用户以为已设,draft 实为空。
			value: mVal && mVal.isValid() ? mVal : null,
			placeholder: field.placeholder || (draftStr ? '' : '此刻'),
			style: { minWidth: 200 },
			allowClear: true,
			onChange: (mObj)=>onChange(field.name, mObj ? mObj.format(fmt) : ''),
		};
		if(isDatetime){
			pickerProps.showTime = { format: 'HH:mm' };
		}else if(isTime){
			pickerProps.picker = 'time';
		}
		return (
			<div className={styles.techSettingRow} key={field.name}>
				<span className={styles.techSettingLabel}>{field.label}</span>
				<XQDatePicker {...pickerProps} />
			</div>
		);
	}
	// 兜底:number / text
	return (
		<div className={styles.techSettingRow} key={field.name}>
			<span className={styles.techSettingLabel}>{field.label}</span>
			<Input
				size="small"
				value={`${value === undefined || value === null ? '' : value}`}
				style={{ maxWidth: 180 }}
				onChange={(e)=>onChange(field.name, field.type === 'number' ? (e.target.value === '' ? field.default : Number(e.target.value)) : e.target.value)}
			/>
		</div>
	);
}

export default function TechniqueSettingsFields({ schemaKey, draft, onChange }){
	const schema = schemaKey ? getTechniqueSettingsSchema(schemaKey) : null;
	if(!schema || !Array.isArray(schema.fields) || !schema.fields.length){
		return null;
	}
	// 按 group 分组(条件揭示 field.showWhen)。
	const groups = [];
	const groupMap = {};
	const draftOrDefault = (name)=>{
		const d = draft || {};
		if(d[name] !== undefined && d[name] !== null && d[name] !== ''){ return d[name]; }
		return (schema.fields.find((f)=>f.name === name) || {}).default;
	};
	schema.fields.forEach((field)=>{
		if(typeof field.showWhen === 'function' && !field.showWhen(draft || {})){ return; }
		// 对象式 when:{key:value} —— 曾无人实现(cetian 六个 kentang 条件项恒显,
		// 书法档下改了也被后端忽略,「点了没反应」)。按草稿值(缺省回退字段默认)比对。
		if(field.when && typeof field.when === 'object'){
			const ok = Object.keys(field.when).every((k)=>`${draftOrDefault(k)}` === `${field.when[k]}`);
			if(!ok){ return; }
		}
		const g = field.group || '设置';
		if(!groupMap[g]){ groupMap[g] = []; groups.push(g); }
		groupMap[g].push(field);
	});
	if(!groups.length){ return null; }
	return (
		<div className={styles.techSettingsFields}>
			{groups.map((g)=>(
				<div className={styles.techSettingGroup} key={g}>
					<div className={styles.techSettingGroupTitle}>{g}</div>
					{groupMap[g].map((field)=>renderField(field, draft, onChange))}
				</div>
			))}
		</div>
	);
}
