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
import moment from 'moment';
import { XQDatePicker, XQInput, XQInputNumber, XQSelect, XQSettingGroup, XQSettingRow, XQSwitch } from '../xq-ui';
import { getTechniqueSettingsSchema, isMountFieldVisible, mountFieldOptions, fieldCurrentDefault } from '../../utils/techniqueMountSettings';
import styles from './TechniqueSettingsFields.less';
import { scriptFilterBy } from '../../utils/scriptMode';

// 字段可声明 disabledFor({ draft, record, baseline }):对这张盘不生效时置灰(如南半球读法遇北纬出生),标签与 disabledHint 照样显示
function fieldDisabled(field, draft, ctx){
	if(typeof field.disabledFor !== 'function'){ return false; }
	try{ return !!field.disabledFor({ draft: draft || {}, record: ctx && ctx.record, baseline: ctx && ctx.baseline }); }catch(_e){ return false; }
}

// ── 标签只在显示层整理(字段声明里的 label 是数据,别处照原文比对,不改) ──────────────
// 半角括号 → 全角,括号前的空格去掉。
export function zhParens(text){
	return `${text == null ? '' : text}`.replace(/\s*\(/g, '（').replace(/\)/g, '）');
}
// 选项文字:括号全角,括注里夹的半角逗号一并改全角(数字列不动)。
function optionText(text){
	return zhParens(text).replace(/\s*,\s*(?!\d)/g, '，');
}

// 说明文字的标点:分号 / 非数字前的逗号改全角,等号两侧留空格(「1996,2000」这类数字列不动)。
// 组名里的并列斜杠两侧留空(「行运/年度」→「行运 / 年度」),与行标签同一写法;组名本身仍是数据键,不改。
function groupTitleText(text){
	return zhParens(text).replace(/\s*\/\s*/g, ' / ');
}

function tidyNote(text){
	return `${text == null ? '' : text}`
		.replace(/\s*[;；]\s*/g, '；')
		.replace(/\s*,\s*(?!\d)/g, '，')
		.replace(/\s*=\s*/g, ' = ')
		.replace(/^(.* = [^/]*)\/([^/]* = .*)$/, '$1 / $2')	// 「甲 = 乙/丙 = 丁」两组对照之间的斜杠留空格
		.trim();
}

// 「空 → 今年」「留空=用本机表」这类占位:统一成「默认：今年」。
function tidyPlaceholder(text){
	const raw = `${text == null ? '' : text}`.trim();
	const hit = /^(?:留空|空)\s*(?:=|→)\s*(.+)$/.exec(raw);
	if(hit){ return `默认：${hit[1].trim()}`; }
	return raw.replace(/\s*=\s*/g, ' = ');
}

const LABEL_INLINE_MAX = 12;	// 标签连括注不超过这个字数才留在一行里;更长的括注挪到下面的说明行
const BLANK_HINT_MAX = 12;	// 「留空时怎样」不超过这个字数才进输入框占位,更长的进说明行

// 「目标日期(空=今日)」→ 标签「目标日期」+ 占位「默认：今日」;
// 「流年(公历年,逗号分隔,如 1996,2000;留空=只看运限概览)」→ 标签「流年」+ 说明 + 占位。
// takesBlank:这个控件有没有「空着」的样子(输入框 / 日期框有,下拉与开关没有)——没有就把「留空…」留在说明里。
export function splitFieldLabel(label, takesBlank){
	const raw = `${label == null ? '' : label}`.trim();
	const hit = /^(.*?)\s*[(（]([^()（）]*)[)）]$/.exec(raw);
	if(!hit || !hit[1]){ return { label: zhParens(raw), note: '', blank: '' }; }
	const name = hit[1].trim();
	let blank = '';
	const kept = [];
	hit[2].split(/[;；]|[,，]\s*(?=留空|空\s*=)/).forEach((part)=>{
		const clause = part.trim();
		if(!clause){ return; }
		const asBlank = takesBlank && !blank ? /^(?:留空|空)\s*=?\s*[则即]?(.+)$/.exec(clause) : null;
		if(asBlank && /^(?:留空|空\s*=)/.test(clause)){
			const text = tidyNote(asBlank[1]);
			if(text.length <= BLANK_HINT_MAX){ blank = text; return; }
		}
		kept.push(tidyNote(clause));
	});
	const note = kept.join('；');
	if(!note){ return { label: name, note: '', blank }; }
	if(name.length + note.length + 2 <= LABEL_INLINE_MAX){ return { label: `${name}（${note}）`, note: '', blank }; }
	return { label: name, note, blank };
}

// 一行 = 标签(+ 说明)在左、控件在右;与全站设置面同一套行语法(XQSettingRow)。
function fieldRow(field, parts, control, extra, disabled){
	const hint = [parts.note, field.title ? zhParens(field.title) : ''].filter(Boolean).join('；');
	return (
		<XQSettingRow
			key={field.name}
			className={styles.techSettingRow}
			label={parts.label}
			hint={hint || undefined}
			control={control}
			disabled={disabled}
			title={disabled && field.disabledHint ? field.disabledHint : undefined}
			data-mount-field-disabled={disabled ? '1' : undefined}
			{...(extra || {})}
		/>
	);
}

// 文本框要不要独占一行:填 JSON / 长串的放不进右侧定宽框。
function textFieldIsWide(field){
	return /JSON/.test(`${field.label || ''}`) || `${field.placeholder || ''}`.length > 24;
}

function renderField(field, draft, onChange, ctx){
	const value = Object.prototype.hasOwnProperty.call(draft || {}, field.name) ? draft[field.name] : fieldCurrentDefault(field);
	const disabled = fieldDisabled(field, draft, ctx);
	const takesBlank = field.type !== 'switch' && field.type !== 'select';
	const parts = splitFieldLabel(field.label, takesBlank);
	const blankHint = parts.blank ? `默认：${parts.blank}` : '';
	if(field.type === 'switch'){
		return fieldRow(field, parts, (
			<XQSwitch
				size="small"
				disabled={disabled}
				checked={`${value}` === '1' || value === true}
				onChange={(checked)=>onChange(field.name, checked ? 1 : 0)}
			/>
		), null, disabled);
	}
	if(field.type === 'select'){
		let shown = value;
		if(typeof field.normalize === 'function' && value !== undefined && value !== null){ try{ shown = field.normalize(value); }catch(_e){ shown = value; } }
		if(typeof field.displayValue === 'function'){ try{ shown = field.displayValue(shown, draft || {}); }catch(_e){ /* 按原值 */ } }
		return fieldRow(field, parts, (
			<XQSelect
				size="small"
				value={shown}
				disabled={disabled}
				className={styles.techSettingControl}
				onChange={(val)=>onChange(field.name, val)}
			>
				{mountFieldOptions(field, draft || {}, value).map((opt)=>(
					<XQSelect.Option key={`${opt.value}`} value={opt.value}>{optionText(opt.label)}</XQSelect.Option>
				))}
			</XQSelect>
		), null, disabled);
	}
	if(field.type === 'multiselect'){
		const arrVal = Array.isArray(value) ? value : [];
		let opts = field.options;
		if(!Array.isArray(opts) && field.dynamicOptions){ opts = typeof field.dynamicOptions === 'function' ? field.dynamicOptions(draft || {}) : field.dynamicOptions; }
		return fieldRow(field, parts, (
			<XQSelect
				filterOption={scriptFilterBy()}
				mode="multiple"
				size="small"
				value={arrVal}
				allowClear
				disabled={disabled}
				className={styles.techSettingMulti}
				placeholder={field.placeholder ? tidyPlaceholder(field.placeholder) : (blankHint || '不选 = 不挂')}
				onChange={(val)=>onChange(field.name, Array.isArray(val) ? val : [])}
			>
				{(Array.isArray(opts) ? opts : []).map((opt)=>(
					<XQSelect.Option key={`${opt.value}`} value={opt.value}>{optionText(opt.label)}</XQSelect.Option>
				))}
			</XQSelect>
		), { stacked: true }, disabled);
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
			// 未设置必须传 null,显 placeholder(传 undefined 会让选择器沿用上一次的值)
			value: mVal && mVal.isValid() ? mVal : null,
			// 占位说的是「空着时按什么算」(取自标签括注);字段声明里的 placeholder 是旧文本框的格式提示,与选择器格式不符,不用
			placeholder: blankHint || (isDatetime ? '选择日期时间' : (isTime ? '选择时间' : '选择日期')),
			disabled,
			className: styles.techSettingControl,
			allowClear: true,
			onChange: (mObj)=>onChange(field.name, mObj ? mObj.format(fmt) : ''),
		};
		if(isDatetime){ pickerProps.showTime = { format: 'HH:mm' }; }
		else if(isTime){ pickerProps.picker = 'time'; }
		return fieldRow(field, parts, <XQDatePicker {...pickerProps} />, null, disabled);
	}
	if(field.type === 'number'){
		const num = (value === undefined || value === null || value === '') ? null : Number(value);
		return fieldRow(field, parts, (
			<XQInputNumber
				size="small"
				value={Number.isFinite(num) ? num : null}
				min={Number.isFinite(Number(field.min)) ? Number(field.min) : undefined}
				max={Number.isFinite(Number(field.max)) ? Number(field.max) : undefined}
				step={Number.isFinite(Number(field.step)) ? Number(field.step) : undefined}
				disabled={disabled}
				placeholder={field.placeholder ? tidyPlaceholder(field.placeholder) : (blankHint || undefined)}
				className={styles.techSettingControl}
				onChange={(v)=>onChange(field.name, (v === null || v === undefined || v === '') ? field.default : v)}
			/>
		), null, disabled);
	}
	const wide = textFieldIsWide(field);
	return fieldRow(field, parts, (
		<XQInput
			size="small"
			value={textFieldDisplayValue(value)}
			disabled={disabled}
			placeholder={field.placeholder ? tidyPlaceholder(field.placeholder) : (blankHint || undefined)}
			className={wide ? styles.techSettingWide : styles.techSettingControl}
			onChange={(e)=>onChange(field.name, e.target.value)}
		/>
	), wide ? { stacked: true } : null, disabled);
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
				<XQSettingGroup className={styles.techSettingGroup} title={groupTitleText(g)} key={g}>
					{groupMap[g].map((field)=>renderField(field, draft, onChange, { record, baseline }))}
				</XQSettingGroup>
			))}
		</div>
	);
}
