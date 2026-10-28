// 每技法「详细设置」字段渲染（无状态、纯 props）。
// 共用件:AI 对话挂载抽屉(AIAnalysisMain) 与其他设置界面共用,
// 保证各处「奇门排盘体例 / 六壬起课法 / …」等设置 UI 完全一致。
// 本组件是 mount-settings 通用渲染,不含任何调用方专用逻辑。
//
// props:
//   schemaKey  — 技法 key(getTechniqueSettingsSchema 取 schema)
//   draft      — 当前 options 草稿对象({字段名: 值})
//   record     — (可选)挂载的这张盘(字段 disabledFor 据此判「对这张盘不生效」置灰)
//   baseline   — (可选)该盘现状;留空 = 随存档的父档取空时,子项按存档里父档的实值判显隐(isMountFieldVisible 同参)
//   onChange(name, value) — 字段更新回调(由父组件维护 draft)
import { Switch, Select, Input, InputNumber } from 'antd';
import moment from 'moment';
import { XQDatePicker } from '../xq-ui';
import { getTechniqueSettingsSchema, isMountFieldVisible, mountFieldOptions, fieldCurrentDefault } from '../../utils/techniqueMountSettings';
import styles from './TechniqueSettingsFields.less';
import { scriptFilterBy } from '../../utils/scriptMode';

// 字段可声明 disabledFor({ draft, record, baseline }):对这张盘不生效时置灰(如南半球读法遇北纬出生),标签与 disabledHint 照样显示
function fieldDisabled(field, draft, ctx){
	if(typeof field.disabledFor !== 'function'){ return false; }
	try{ return !!field.disabledFor({ draft: draft || {}, record: ctx && ctx.record, baseline: ctx && ctx.baseline }); }catch(_e){ return false; }
}

function renderField(field, draft, onChange, ctx){
	const value = Object.prototype.hasOwnProperty.call(draft || {}, field.name)
		? draft[field.name]
		: fieldCurrentDefault(field);   // 草稿缺键 = 当前实际生效的缺省(全局现值优先),不是 schema 出厂值
	const disabled = fieldDisabled(field, draft, ctx);
	if(field.type === 'switch'){
		return (
			<div className={styles.techSettingRow} key={field.name} title={disabled && field.disabledHint ? field.disabledHint : undefined} data-mount-field-disabled={disabled ? '1' : undefined}>
				<span className={styles.techSettingLabel} title={field.title || undefined}>{field.label}</span>
				<Switch
					size="small"
					disabled={disabled}
					checked={`${value}` === '1' || value === true}
					onChange={(checked)=>onChange(field.name, checked ? 1 : 0)}
				/>
			</div>
		);
	}
	if(field.type === 'select'){
		// 显示值经 schema normalize(存档布尔 false/true → 0/1 下拉才有匹配档);无 normalize 原样
		let shown = value;
		if(typeof field.normalize === 'function' && value !== undefined && value !== null){
			try{ shown = field.normalize(value); }catch(_e){ shown = value; }
		}
		// 回显值随另一项(如奇门起局法:非时家把节气四法显示为「本家默认」,与页面同)
		if(typeof field.displayValue === 'function'){
			try{ shown = field.displayValue(shown, draft || {}); }catch(_e){ /* 按原值 */ }
		}
		return (
			<div className={styles.techSettingRow} key={field.name}>
				<span className={styles.techSettingLabel} title={field.title || undefined}>{field.label}</span>
				<Select
					size="small"
					value={shown}
					style={{ minWidth: 180 }}
					onChange={(val)=>onChange(field.name, val)}
				>
					{mountFieldOptions(field, draft || {}, value).map((opt)=>(
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
				<span className={styles.techSettingLabel} title={field.title || undefined}>{field.label}</span>
				<Select filterOption={scriptFilterBy()}
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
				<span className={styles.techSettingLabel} title={field.title || undefined}>{field.label}</span>
				<XQDatePicker {...pickerProps} />
			</div>
		);
	}
	// number:受控 Input + Number(text) 会吃掉小数点中间态(1.5→15、0.9856→9856)且 min/max/step 不守;
	// 改 InputNumber(字符串中间态由控件自持),按 schema min/max/step 夹取;清空=回 schema 默认。
	if(field.type === 'number'){
		const num = (value === undefined || value === null || value === '') ? null : Number(value);
		return (
			<div className={styles.techSettingRow} key={field.name}>
				<span className={styles.techSettingLabel} title={field.title || undefined}>{field.label}</span>
				<InputNumber
					size="small"
					value={Number.isFinite(num) ? num : null}
					min={Number.isFinite(Number(field.min)) ? Number(field.min) : undefined}
					max={Number.isFinite(Number(field.max)) ? Number(field.max) : undefined}
					step={Number.isFinite(Number(field.step)) ? Number(field.step) : undefined}
					style={{ maxWidth: 180, width: '100%' }}
					onChange={(v)=>onChange(field.name, (v === null || v === undefined || v === '') ? field.default : v)}
				/>
			</div>
		);
	}
	// 兜底:text
	return (
		<div className={styles.techSettingRow} key={field.name}>
			<span className={styles.techSettingLabel} title={field.title || undefined}>{field.label}</span>
			<Input
				size="small"
				value={textFieldDisplayValue(value)}
				style={{ maxWidth: 180 }}
				onChange={(e)=>onChange(field.name, e.target.value)}
			/>
		</div>
	);
}

// text 字段的值可能是 normalize 产出的对象数组(紫微 taiSuiRelatives:[{branch,role,sex}],会话覆盖/同类默认都存归一后的值):
// 此前 `${value}` 渲染成 [object Object],再编辑就把「[object」「Object]」当成支切碎原关系人 → 按 branch:role:sex 反序列化显示。
export function textFieldDisplayValue(value){
	if(value === undefined || value === null){ return ''; }
	if(Array.isArray(value)){
		return value.map((r)=>(r && typeof r === 'object' ? [r.branch, r.role, r.sex].filter(Boolean).join(':') : `${r}`)).filter(Boolean).join(' ');
	}
	if(typeof value === 'object'){
		return [value.branch, value.role, value.sex].filter(Boolean).join(':');
	}
	return `${value}`;
}

export default function TechniqueSettingsFields({ schemaKey, draft, baseline, record, onChange }){
	const schema = schemaKey ? getTechniqueSettingsSchema(schemaKey) : null;
	if(!schema || !Array.isArray(schema.fields) || !schema.fields.length){
		return null;
	}
	// 按 group 分组(条件揭示 field.showWhen)。
	const groups = [];
	const groupMap = {};
	schema.fields.forEach((field)=>{
		// showWhen(函数)/对象式 when 单源 isMountFieldVisible(与 pruneOptionsToNonDefault 同判:隐藏字段不计数不下发)。
		if(!isMountFieldVisible(field, draft || {}, schema, baseline)){ return; }
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
					{groupMap[g].map((field)=>renderField(field, draft, onChange, { record, baseline }))}
				</div>
			))}
		</div>
	);
}
