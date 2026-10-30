// 主限法「应星 / 迫星扩展」勾选面板 —— 表格 pane 与 3D 天球 pane 共用。
//
// 为什么抽出来:这两处原本各写一份几乎逐字相同的 JSX(同一份 PD_SIGNIFICATOR_OPTIONS /
// PD_PROMISSOR_TYPE_OPTIONS、同样的全选/清空、同样的两栏 + 分隔竖线)。上一轮修天球弹层
// 可读性时只改了天球那份,立刻就产生了外观分叉(字号 12 vs 11、金线 0.42 vs 0.3、组标题
// 有无类名)——「同一功能两份实现」必然漏改,这就是活样本。
//
// 皮肤分两档,但**只分皮肤,不分尺寸**:
//   variant='dark'  天球用。恒暗底亮字,与它所在的天球工具条/时间轴同域(那片区域永远盖在
//                   暗底星空上,不随 App 亮暗主题变)。皮肤在 app.less 的 .horosa-pdsphere-ext-pop。
//   variant='theme' 表格用。跟随 App 主题(它所在的右栏报表区就是跟随主题的)——
//                   零额外 less:继承通用 popover 的 var(--horosa-text) 本来就是对的。
// 两档的字号 / 间距 / 描边 / 标题层级完全一致,由本文件的常量单点决定。
import { Popover, Checkbox, Button, Select } from 'antd';
import {
	PD_SIGNIFICATOR_OPTIONS,
	PD_PROMISSOR_TYPE_OPTIONS,
	PD_EXTRA_SETTING_SPECS,
	pickPdExtraSettings,
	pdSettingInertReason,
	pdExtensionOptionInertReason,
} from '../../utils/primaryDirectionSync';

// 字号阶梯(全站主限法面板共用):11 仅角标 / 12 正文与组标题 / 13 强调。
// 「全选 | 清空」曾是 11px —— 实测偏小(用户报过「看不清」),统一提到 12。
const FS_HEAD = 12;
const FS_LINK = 12;
const GOLD_UNDERLINE = 'rgba(215, 173, 105, 0.42)';	// 组标题下划线
const GOLD_DIVIDER = 'rgba(215, 173, 105, 0.32)';	// 两组之间的竖线

const headStyle = {
	fontSize: FS_HEAD,
	fontWeight: 600,
	paddingBottom: 5,
	borderBottom: `1px solid ${GOLD_UNDERLINE}`,
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'baseline',
};

// 当前方向 / 弧算法下不起作用的项:置灰 + 悬停说明原因(规则单源 pdSettingInertReason)。
// 只在取值仍是缺省时禁用;已改离缺省的保持可点,方便改回(否则被禁用的旧值永远改不掉)。
const INERT_STYLE = { opacity: 0.5 };

/** 一组勾选(标题 + 全选/清空 + 选项列表)。 */
function Group({ title, options, selected, onChange, minWidth, headClassName, optionInertReason }){
	const sel = Array.isArray(selected) ? selected : [];
	const reasonOf = (value)=>(optionInertReason ? optionInertReason(value) : '');
	const allInert = options.every((o)=>!!reasonOf(o.value));
	const inertReason = allInert ? reasonOf(options[0].value) : '';
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth, ...(inertReason ? INERT_STYLE : null) }} title={inertReason || undefined}>
			<span className={headClassName} style={headStyle}>
				{title}
				<span style={{ fontWeight: 400, fontSize: FS_LINK }}>
					{/* 链接色走项目金色系,不用 antd 默认蓝:实测那个蓝在 theme 档的白底上只有
					    3.24:1(不达 AA 4.5)。horosa-pd-ext-link 取 --horosa-accent-strong
					    (亮色主题 6.75:1,暗主题该 token 自动变亮);dark 档另有更高特异度规则
					    盖成亮金 #d8ab52(暗底 8.85:1),两档同色系不同明度档。 */}
					<a className='horosa-pd-ext-link' onClick={()=>onChange(options.filter((o)=>!reasonOf(o.value) || sel.indexOf(o.value) >= 0).map((o)=>o.value))}>全选</a>
					<span style={{ color: 'var(--horosa-text-secondary)', margin: '0 4px' }}>|</span>
					<a className='horosa-pd-ext-link' onClick={()=>onChange([])}>清空</a>
				</span>
			</span>
			{options.map((o)=>{
				const reason = allInert ? '' : reasonOf(o.value);
				const on = sel.indexOf(o.value) >= 0;
				return (
				<Checkbox
					key={o.value}
					style={{ marginLeft: 0, ...(reason ? INERT_STYLE : null) }}
					disabled={!!(reason || inertReason) && !on}
					checked={on}
					onChange={(e)=>{
						const cur = sel.slice();
						const idx = cur.indexOf(o.value);
						if(e.target.checked && idx < 0){ cur.push(o.value); }
						if(!e.target.checked && idx >= 0){ cur.splice(idx, 1); }
						onChange(cur);
					}}
				><span title={reason ? `当前不起作用:${reason}` : undefined}>{o.label}</span></Checkbox>
				);
			})}
		</div>
	);
}

// 本面板列的设置项:几何口径在「弧算法」下拉里选(inProjection),不在这里重复
const PANEL_SETTING_SPECS = PD_EXTRA_SETTING_SPECS.filter((s)=>!s.inProjection);

/** 「取点与方向」组:控件按 primaryDirectionSync 的设置项登记表生成(开关 = 勾选,相位侧 = 下拉;说明放悬停提示)。 */
function SettingsGroup({ values, onChange, headClassName, dark, inertContext }){
	const v = pickPdExtraSettings(values);
	const reasonOf = (key)=>(inertContext ? pdSettingInertReason(key, { ...inertContext, values: v }) : '');
	const titleOf = (spec, reason)=>(reason ? `当前不起作用:${reason}` + (spec.help ? `\n${spec.help}` : '') : (spec.help || ''));
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 128 }}>
			<span className={headClassName} style={headStyle}>取点与方向</span>
			{PANEL_SETTING_SPECS.map((spec)=>{
				const reason = reasonOf(spec.key);
				const atDefault = v[spec.key] === spec.default;
				return spec.type === 'switch' ? (
				<Checkbox
					key={spec.key}
					data-pd-setting={spec.key}
					style={{ marginLeft: 0, ...(reason ? INERT_STYLE : null) }}
					disabled={!!reason && atDefault}
					checked={v[spec.key] === 1}
					onChange={(e)=>onChange(spec.key, e.target.checked ? 1 : 0)}
				><span title={titleOf(spec, reason)}>{spec.label}</span></Checkbox>
			) : (
				<span key={spec.key} data-pd-setting={spec.key} title={titleOf(spec, reason)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...(reason ? INERT_STYLE : null) }}>
					<span>{spec.label}</span>
					<Select
						size='small'
						style={{ width: spec.selectWidth || 96 }}
						disabled={!!reason && atDefault}
						value={v[spec.key]}
						onChange={(val)=>onChange(spec.key, val)}
						dropdownMatchSelectWidth={false}
						getPopupContainer={(t)=>t.parentNode}
						popupClassName={dark ? 'horosa-pdsphere-ext-pop' : undefined}
						options={spec.options}
					/>
				</span>
			);
			})}
		</div>
	);
}

/**
 * @param variant 'dark'(天球,恒暗底) | 'theme'(表格,跟随主题)
 * @param significators / promissorTypes 已选值数组
 * @param onSignificatorsChange / onPromissorTypesChange 收下一个完整数组
 * @param extraSection 第三组插槽(可选;未传不渲染,天球调用方零改动零回归)——宿主把
 *        「附加促发」等自带 disabled/条件控件的既有 JSX 原样平移进来,逻辑零改。
 * @param extraSectionTitle 插槽组标题(默认「附加促发」);extraCount 插槽勾选数(并入按钮徽标)
 * @param extraSettings / onExtraSettingChange 「取点与方向」组的值与回调(key, value);未传不渲染
 * @param inertContext { pdtype, projection, geometry, timeKey }:传了就按 pdSettingInertReason 把当前不起作用的项置灰并说明原因
 * @param placement Popover 位置;buttonStyle 触发按钮内联样式(两处按钮本就不同,保留各自的)
 */
export default function PdExtensionPanel({
	variant = 'theme',
	significators,
	promissorTypes,
	onSignificatorsChange,
	onPromissorTypesChange,
	extraSection,
	extraSectionTitle = '附加促发',
	extraCount = 0,
	extraSettings,
	onExtraSettingChange,
	inertContext,
	placement = 'bottom',
	buttonStyle,
	buttonSize = 'small',
}){
	const sig = Array.isArray(significators) ? significators : [];
	const prom = Array.isArray(promissorTypes) ? promissorTypes : [];
	const dark = variant === 'dark';
	const settingsOn = !!onExtraSettingChange;
	const settingsChanged = settingsOn
		? (()=>{ const v = pickPdExtraSettings(extraSettings); return PANEL_SETTING_SPECS.filter((s)=>v[s.key] !== s.default).length; })()
		: 0;
	const count = sig.length + prom.length + (Number.isFinite(extraCount) ? extraCount : 0) + settingsChanged;

	const content = (
		<div style={{ display: 'flex', gap: 16 }}>
			<Group
				title='应星扩展'
				options={PD_SIGNIFICATOR_OPTIONS}
				selected={sig}
				onChange={onSignificatorsChange}
				minWidth={168}
				headClassName={dark ? 'horosa-pdsphere-ext-head' : undefined}
				optionInertReason={inertContext ? (value)=>pdExtensionOptionInertReason('pdSignificators', value, inertContext) : null}
			/>
			<div style={{ width: 1, alignSelf: 'stretch', background: GOLD_DIVIDER }} />
			<Group
				title='迫星扩展'
				options={PD_PROMISSOR_TYPE_OPTIONS}
				selected={prom}
				onChange={onPromissorTypesChange}
				minWidth={128}
				headClassName={dark ? 'horosa-pdsphere-ext-head' : undefined}
				optionInertReason={inertContext ? (value)=>pdExtensionOptionInertReason('pdPromissorTypes', value, inertContext) : null}
			/>
			{settingsOn ? (
				<>
					<div style={{ width: 1, alignSelf: 'stretch', background: GOLD_DIVIDER }} />
					<SettingsGroup
						values={extraSettings}
						onChange={onExtraSettingChange}
						headClassName={dark ? 'horosa-pdsphere-ext-head' : undefined}
						dark={dark}
						inertContext={inertContext}
					/>
				</>
			) : null}
			{extraSection ? (
				<>
					<div style={{ width: 1, alignSelf: 'stretch', background: GOLD_DIVIDER }} />
					<div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 108 }}>
						<span className={dark ? 'horosa-pdsphere-ext-head' : undefined} style={headStyle}>
							{extraSectionTitle}
						</span>
						{extraSection}
					</div>
				</>
			) : null}
		</div>
	);

	return (
		<Popover
			trigger='click'
			placement={placement}
			// 🔴 dark 档必须带这个 overlayClassName。病史:本弹层因下面的 getPopupContainer 挂进
			// .horosa-pdsphere-chrome,而 antd Checkbox 的 wrapper 本身是 <label> → 被工具条那条
			// 「label 恒亮字」命中;弹层自身皮肤却走通用 popover(亮色主题下近白底)→ 白底浅字,
			// 实测对比度 1.36:1 几乎不可见。theme 档不挂:它所在的报表区跟随主题,继承即正确。
			overlayClassName={dark ? 'horosa-pdsphere-ext-pop' : undefined}
			getPopupContainer={(t)=>t.parentNode}
			content={content}
		>
			<Button size={buttonSize} style={buttonStyle}>
				扩展{count > 0 ? `·${count}` : ''}
			</Button>
		</Popover>
	);
}
