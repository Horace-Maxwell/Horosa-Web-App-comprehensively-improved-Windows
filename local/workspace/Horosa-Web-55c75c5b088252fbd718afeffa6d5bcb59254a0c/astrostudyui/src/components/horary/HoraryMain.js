import React, { Component } from 'react';   // 显式引 React:模块级 JSX 常量在 jest classic runtime 下必需
import { markPanelReady } from '../../utils/perfMark';
import { Input, Checkbox, Popover } from 'antd';   // Input 仅供 TextArea(所问之事)解构
import PlusMinusTime from '../astro/PlusMinusTime';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { shortOptionLabel } from '../../utils/shortOptionLabel';
import { XQSelect, XQSideSection, XQSegmented, XQButton } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import DivinationChartShell from '../divination/DivinationChartShell';
import GeoCoordModal from '../amap/GeoCoordModal';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { resolveGeoZone } from '../../utils/timezone';
import { judgeLayerOverrides } from '../../utils/judgeLayerOverrides';
import { geoNameRawPatch } from '../../utils/geoName';
import DateTime from '../comp/DateTime';
import HoraryJudgment from './HoraryJudgment';
import { buildHoraryOverlay } from './horaryOverlayData';
import {
	HORARY_SCHOOLS, HORARY_SCHOOL_ORDER, HORARY_PARAM_SPEC, HORARY_PARAM_BY_KEY,
	horaryBackendFields, presetOf, schoolOf, overrideCount, horaryJudgeOpts,
} from '../../divination/horary/horarySchools';

const Option = XQSelect.Option;
const { TextArea } = Input;

// 卜卦问题类别（按宫位/转宫归类）。
export const HORARY_CATEGORIES = [
	{ value: 'general', label: '综合 · 能否成事' },
	{ value: 'wealth', label: '财物 · 借贷（二宫）' },
	{ value: 'lost', label: '失物寻回（二宫动产）' },
	{ value: 'family', label: '兄弟 · 亲属（三宫）' },
	{ value: 'message', label: '消息真假 · 书信（三宫）' },
	{ value: 'property', label: '房产 · 田宅（四宫）' },
	{ value: 'father', label: '父亲 · 尊长（父母宫参数定 4/10）' },
	{ value: 'mother', label: '母亲（父母宫参数定 10/4）' },
	{ value: 'pregnancy', label: '子嗣 · 怀孕（五宫）' },
	{ value: 'health', label: '疾病 · 健康（六宫）' },
	{ value: 'lost_animal', label: '走失活物（六宫/大畜十二宫）' },
	{ value: 'marriage', label: '婚姻 · 感情（七宫）' },
	{ value: 'trade', label: '买卖 · 交易（七宫四角）' },
	{ value: 'lawsuit', label: '诉讼 · 合伙 · 战争（七宫）' },
	{ value: 'theft', label: '盗窃 · 走失（七宫/转宫）' },
	{ value: 'death', label: '死生 · 遗产（八宫）' },
	{ value: 'travel', label: '旅行 · 远行 · 学问（九宫）' },
	{ value: 'career', label: '职位 · 事业（十宫）' },
	{ value: 'hope', label: '愿望 · 朋友（十一宫）' },
	{ value: 'enemy', label: '私敌 · 囚禁（十二宫）' },
];

// 起盘阵营（05 两大阵营 + 中点关系盘）：时刻与地点必须成对绑定。
// 标签去「中心」二字防 segmented 换行（语义不变;详见帮助·卜卦盘）。
const CAMP_OPTIONS = [
	{ value: 'astrologer', label: '占星师' },
	{ value: 'querent', label: '问卜者' },
	{ value: 'midpoint', label: '时空中点' },
];

// 芯片列宽分档(用户定版:放得下不截断才一行两个,否则独占整行):
// 实测窄窗左栏 ~260px,两列半宽仅稳容 ≤6 个汉字 → ≥7 字加 .horosa-chip-full 整行。
function chipCls(label){
	return (label && String(label).length >= 7) ? 'horosa-chip-full' : '';
}

// 高级面板（判读参数·卜卦专属）四组重排：spec.scope==='horary' 才渲染
// （global 键在「设置→星盘设置」统一改,school 键随流派绑定——左栏零双入口）。
const PANEL_GROUP_ORDER = ['尊贵计分', '完成与破坏', '考量', '应期与指派'];
const PANEL_GROUP_OF = {
	accidentalMode: '尊贵计分', lotsSet: '尊贵计分',
	orbMode: '完成与破坏', interferenceTiming: '完成与破坏', detectAbscission: '完成与破坏',
	refranationAsDestruction: '完成与破坏', refranationIncludeSignChange: '完成与破坏',
	collectionRequireReception: '完成与破坏', oppositionVerdict: '完成与破坏',
	perfectionStrict: '完成与破坏', combustExemptConjAnswer: '完成与破坏',
	considerationsMode: '考量', ascEarlyDeg: '考量', ascLateDeg: '考量',
	hourAgreementVariant: '考量', vocMitigateSigns: '考量',   // [H8] 僵尸清理:partileDef/viaCombustaVariant 是 global 键,面板只渲染 horary 域——死映射已删
	timingVariant: '应期与指派', timingModifiers: '应期与指派', timingSecondLaw: '应期与指派',
	onePlanetBoth: '应期与指派', parentHousesVariant: '应期与指派', includeOuter: '应期与指派',
	// [H2] 完成法五键
	perfectionCandidates: '完成与破坏', receptionForHardAspects: '完成与破坏',
	receptionPerfection: '完成与破坏', rescueAfterDestruction: '完成与破坏',
	timingStationAware: '应期与指派',
	// [H4b][H5] 实测证词+徵象星语义
	backendConditionNotes: '考量',
	personScope: '应期与指派', querentGender: '应期与指派',
	moonPromotion: '应期与指派', naturalSignifEnhanced: '应期与指派',
	// [H7] 裁决双轨
	verdictProfile: '考量',
};
const FIVE_MOMENTS_HELP = (
	<div style={{ maxWidth: 300, fontSize: 12, lineHeight: 1.7 }}>
		<b>五种候选起盘时刻（任选其一填入时间栏）</b>
		<div>① 占星师<b>领会</b>问题之时（主流）</div>
		<div>② 问卜者<b>提出</b>问题之时</div>
		<div>③ 信息<b>抵达</b>能回答者之时（信件/留言）</div>
		<div>④ 问题在问卜者<b>心中成形</b>之时</div>
		<div>⑤ 由<b>事件自身</b>的确定时刻（事件盘）</div>
		<div style={{ opacity: 0.75, marginTop: 4 }}>阵营Ⅰ＝①③＋占星师所在地；阵营Ⅱ＝②④＋问卜者所在地；时刻与地点须成对，勿混用。</div>
	</div>
);

// 当前生效流派：优先用户显式所选(extra.horarySchool)；否则据当前宫制反推(老盘 hsys:0 → 希腊化，不误标)。
function activeSchoolId(extra, fields){
	if(extra && extra.horarySchool && HORARY_SCHOOLS[extra.horarySchool]){ return extra.horarySchool; }
	return presetOf(fields);
}

// [批5] 盘面聚焦键星（象征星高亮叠层,复用 AstroChart keyPlanets 宫位聚光机制）：
// 命主(1宫主) + 事项宫主 + 月亮;extra.chartFocus===false 时关闭(默认开)。
// 轻量直读 chart.houses 的 ruler(后端 chartId 形),不跑判读引擎。
function horaryKeyPlanets(chartObj, extra){
	if(!chartObj || !chartObj.chart || (extra && extra.chartFocus === false)){ return undefined; }
	const houses = chartObj.chart.houses || [];
	const byId = {};
	houses.forEach((h) => { if(h && h.id){ byId[h.id] = h; } });
	// [H6] 补 father/mother(4/10 随父母宫两派参数)与两新类;此前父母类聚焦恒不亮。
	const def = { general: null, wealth: 2, lost: 2, family: 3, message: 3, property: 4, pregnancy: 5, health: 6, marriage: 7, lawsuit: 7, theft: 7, death: 8, travel: 9, career: 10, hope: 11, enemy: 12, lost_animal: 6, trade: 7, father: 4, mother: 10 };
	const cat = (extra && extra.questionCategory) || 'general';
	let qh = def[cat];
	if((cat === 'father' || cat === 'mother') && extra && extra.horaryOverrides && extra.horaryOverrides.parentHousesVariant === 'modern'){
		qh = cat === 'father' ? 10 : 4;
	}
	const keys = [];
	const l1 = byId.House1 && byId.House1.ruler;
	if(l1){ keys.push(l1); }
	const lq = qh && byId['House' + qh] && byId['House' + qh].ruler;
	if(lq && keys.indexOf(lq) < 0){ keys.push(lq); }
	if(keys.indexOf('Moon') < 0){ keys.push('Moon'); }
	return keys;
}

// 球面中点（时空中点阵营用）：两 GPS 点的大圆中点。
function sphericalMidpoint(lat1, lng1, lat2, lng2){
	const r = Math.PI / 180;
	const p1 = lat1 * r; const p2 = lat2 * r; const dl = (lng2 - lng1) * r;
	const bx = Math.cos(p2) * Math.cos(dl);
	const by = Math.cos(p2) * Math.sin(dl);
	const pm = Math.atan2(Math.sin(p1) + Math.sin(p2), Math.sqrt((Math.cos(p1) + bx) * (Math.cos(p1) + bx) + by * by));
	const lm = lng1 * r + Math.atan2(by, Math.cos(p1) + bx);
	return { lat: pm / r, lng: ((lm / r + 540) % 360) - 180 };
}

class HoraryMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	// ── 阵营应用：按所选阵营把「起盘时刻+地点」写入主字段（时地成对绑定）。──
	applyCamp({ extra, fields, patchFields }){
		const camp = extra.castingCamp || 'astrologer';
		if(camp === 'astrologer'){ return; }
		const patch = {};
		const qs = extra.querent || {};
		const curDt = fields.date && fields.date.value;
		const parseTo = (text, zone) => {
			if(!text){ return null; }
			const dt = new DateTime();
			if(zone){ dt.setZone(zone); }
			return dt.parse ? dt.parse(String(text).trim(), 'YYYY-MM-DD HH:mm:ss') : null;
		};
		if(camp === 'querent'){
			const zone = qs.zone || (curDt && curDt.zone);
			const dt = parseTo(qs.timeText, zone);
			if(dt){ patch.date = dt; patch.time = dt.clone ? dt.clone() : dt; patch.ad = dt.ad; if(zone){ patch.zone = zone; } }
			if(qs.gpsLat !== undefined && qs.gpsLng !== undefined && qs.gpsLat !== null){
				patch.lon = convertLonToStr(qs.gpsLng); patch.lat = convertLatToStr(qs.gpsLat);
				patch.gpsLon = qs.gpsLng; patch.gpsLat = qs.gpsLat;
				if(qs.pos){ patch.pos = qs.pos; }
			}
		}else if(camp === 'midpoint'){
			// 时间中点：两时刻在当前时区口径下取算术中点（跨时区两地建议各自先化到同一时区再填）。
			const dtQ = parseTo(qs.timeText, curDt && curDt.zone);
			if(dtQ && curDt && curDt.format && dtQ.format){
				const toMs = (d) => new Date(String(d.format('YYYY-MM-DD HH:mm:ss')).replace(/-/g, '/')).getTime();
				const mid = new Date((toMs(curDt) + toMs(dtQ)) / 2);
				const pad = (n) => (n < 10 ? '0' + n : '' + n);
				const midText = `${mid.getFullYear()}-${pad(mid.getMonth() + 1)}-${pad(mid.getDate())} ${pad(mid.getHours())}:${pad(mid.getMinutes())}:${pad(mid.getSeconds())}`;
				const dtM = parseTo(midText, curDt.zone);
				if(dtM){ patch.date = dtM; patch.time = dtM.clone ? dtM.clone() : dtM; patch.ad = dtM.ad; }
			}
			const cLat = fields.gpsLat && fields.gpsLat.value; const cLng = fields.gpsLon && fields.gpsLon.value;
			if(qs.gpsLat !== undefined && qs.gpsLat !== null && cLat !== undefined && cLat !== null){
				const m = sphericalMidpoint(Number(cLat), Number(cLng), Number(qs.gpsLat), Number(qs.gpsLng));
				patch.lon = convertLonToStr(m.lng); patch.lat = convertLatToStr(m.lat);
				patch.gpsLon = m.lng; patch.gpsLat = m.lat;
				patch.pos = '时空中点';
			}
		}
		if(Object.keys(patch).length){ patchFields(patch); }
	}

	// 问卜者时刻的 DateTime 视图:timeText 有值则解析,否则给当前时区此刻(仅作调时器初值,不落存储)。
	campQuerentDt(args){
		const { extra, fields } = args;
		const qs = (extra && extra.querent) || {};
		const curDt = fields && fields.date && fields.date.value;
		const zone = qs.zone || (curDt && curDt.zone);
		const dt = new DateTime();
		if(zone){ dt.setZone(zone); }
		if(qs.timeText && dt.parse){
			const parsed = dt.parse(String(qs.timeText).trim(), 'YYYY-MM-DD HH:mm:ss');
			if(parsed){ return parsed; }
		}
		return dt;
	}

	renderCampBlock(args){
		const { extra, setExtra, fields } = args;
		const camp = extra.castingCamp || 'astrologer';
		const qs = extra.querent || {};
		const setQuerent = (p) => setExtra({ querent: { ...qs, ...p } });
		return (
			<div className="horosa-field-block">
				<div className="horosa-field-label">
					起盘阵营
					<Popover content={FIVE_MOMENTS_HELP} trigger="hover" placement="right">
						<span style={{ marginLeft: 6, opacity: 0.6, cursor: 'help', fontSize: 12 }}>ⓘ 五候选时刻</span>
					</Popover>
				</div>
				<XQSegmented size="small" value={camp}
					onChange={(e)=>setExtra({ castingCamp: e && e.target ? e.target.value : e })}
					options={CAMP_OPTIONS} />
				{camp !== 'astrologer' ? (
					<div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(148,163,184,.08)', border: '1px dashed rgba(148,163,184,.25)' }}>
						<div className="horosa-field-grid">
							<div className="horosa-field-block" style={{ marginBottom: 0 }}>
								<div className="horosa-field-label" style={{ fontSize: 12 }}>问卜者时刻</div>
								{/* 与主时间同款点选调时器(用户定版:不逼手动敲数字)。存储仍是 timeText
								    字符串(事件盘 extra 兼容零变),仅输入方式换 Popover+PlusMinusTime。 */}
								<Popover trigger="click" placement="rightTop" overlayClassName="horosa-time-adjust-popover"
									content={(
										<div className="horosa-time-popover">
											<PlusMinusTime
												value={this.campQuerentDt(args)}
												onChange={(res)=>{
													const dt = res && res.time;
													if(dt && dt.format){ setQuerent({ timeText: dt.format('YYYY-MM-DD HH:mm:ss') }); }
												}} />
										</div>
									)}>
									<button type="button" className="horosa-unified-field" style={{ width: '100%' }}>
										<span>{qs.timeText || '点选时刻'}</span>
									</button>
								</Popover>
							</div>
							<div className="horosa-field-block" style={{ marginBottom: 0 }}>
								<div className="horosa-field-label" style={{ fontSize: 12 }}>问卜者地点</div>
								<GeoCoordModal
									onOk={(rec)=>{
										const zone = resolveGeoZone(rec, null);
										setQuerent({ gpsLat: rec.lat, gpsLng: rec.lng, pos: (geoNameRawPatch(rec) || {}).pos || rec.pos || '', zone: zone || qs.zone });
									}}
									lat={qs.gpsLat !== undefined ? qs.gpsLat : null}
									lng={qs.gpsLng !== undefined ? qs.gpsLng : null}
								>
									<button type="button" className="horosa-unified-field" style={{ width: '100%' }}>
										<span>{qs.pos || (qs.gpsLat !== undefined && qs.gpsLat !== null ? `${convertLonToStr(qs.gpsLng)} · ${convertLatToStr(qs.gpsLat)}` : '选择地点')}</span>
									</button>
								</GeoCoordModal>
							</div>
						</div>
						<XQButton size="small" iconName="refresh" style={{ marginTop: 8 }}
							onClick={()=>this.applyCamp(args)}>
							按阵营写入起盘时地
						</XQButton>
					</div>
				) : null}
			</div>
		);
	}

	// ── 判读参数（卜卦专属）面板：只渲染 scope==='horary' 的键（global 键去「设置→星盘设置」改,
	// school 键随流派绑定——零双入口）;一行两项省空间;改任一项即时生效。──
	renderAdvanced({ extra, setExtra, fields, patchFields }){
		const schoolId = activeSchoolId(extra, fields);
		const sc = schoolOf(schoolId);
		const overrides = extra.horaryOverrides || {};
		const n = overrideCount(overrides);
		// 🔴 回显必须与判读引擎同口径:含全局层(星盘设置改过的键),否则面板显示值
		// 与实际生效值分叉(判读走 horaryJudgeOpts 四层,全局层在流派差异之前)。
		const effective = { ...sc.backend, ...sc.judge, ...judgeLayerOverrides(), ...overrides };
		// tradition 七档为 1(古典星集)时后端不产三王星——includeOuter 勾了也是空转,禁用+注明。
		const outerAvailable = Number(effective.tradition) === 0;
		// 扁平两桶（用户定版:去组标题只留字段标签一层）:选择项按组序排入两列网格,布尔项一行一个芯片。
		const selects = []; const bools = [];
		PANEL_GROUP_ORDER.forEach((name) => {
			HORARY_PARAM_SPEC.forEach((p) => {
				if(p.scope !== 'horary' || (PANEL_GROUP_OF[p.key] || PANEL_GROUP_ORDER[0]) !== name){ return; }
				if(p.type === 'switch'){ bools.push(p); } else { selects.push(p); }
			});
		});
		const setParam = (p, val) => {
			const next = { ...overrides, [p.key]: val };
			// 与预设值相同 → 视为撤销该覆盖（保持「已自定义 N 项」诚实）。
			const presetVal = sc.backend[p.key] !== undefined ? sc.backend[p.key] : sc.judge[p.key];
			if(presetVal === val){ delete next[p.key]; }
			setExtra({ horaryOverrides: next });
			if(p.sendToBackend){
				const cur = fields && fields[p.key] && fields[p.key].value !== undefined ? fields[p.key].value : undefined;
				if(cur !== val){ patchFields({ [p.key]: val }); }
			}
		};
		const changedMark = (p) => (overrides[p.key] !== undefined ? <span style={{ color: 'var(--horosa-accent, #b8860b)' }}> ·改</span> : null);
		return (
			<XQSideSection iconName={sideSectionIcon('school')} title="判读参数（卜卦专属）" storageKey="horary.advanced" className="horosa-side-input-section" collapsible defaultCollapsed>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
					<div style={{ fontSize: 12, opacity: 0.8 }}>当前：<b>{sc.cn}</b>{n > 0 ? ` ·（已自定义 ${n} 项）` : ''}</div>
					{n > 0 ? (
						<XQButton size="small" onClick={()=>{
							setExtra({ horaryOverrides: {} });
							const bf = horaryBackendFields(schoolId);
							const patch = {};
							Object.keys(bf).forEach((k) => {
								const cur = fields && fields[k] && fields[k].value !== undefined ? fields[k].value : undefined;
								if(cur !== bf[k]){ patch[k] = bf[k]; }
							});
							if(Object.keys(patch).length){ patchFields(patch); }
						}}>恢复本档默认</XQButton>
					) : null}
				</div>
				<div className="horosa-field-grid horosa-horary-param-grid">
					{selects.map((p) => (
						<div key={p.key} className="horosa-field-block" style={{ marginBottom: 0 }}>
							<div className="horosa-field-label" style={{ fontSize: 12 }}>{p.label}{changedMark(p)}</div>
							{/* 半宽下拉:收起态显示剥括号短名(否则「启发式（现…」看不出选了什么),
							    展开面板仍是完整 label——面板按内容宽,不受选框宽度约束。 */}
							<XQSelect size="small" style={{ width: '100%' }} value={effective[p.key]}
								dropdownMatchSelectWidth={false} optionLabelProp="label"
								onChange={(val)=>setParam(p, val)}>
								{(p.options || []).map((o)=>(<Option key={String(o.value)} value={o.value} label={shortOptionLabel(o.label)}>{o.label}</Option>))}
							</XQSelect>
						</div>
					))}
				</div>
				<div className="horosa-horary-option-card">
					{/* 整行(长标签)项在前、半宽项归底配对(用户定版:半宽项不落单空在上面;稳定排序保同档原序) */}
					{[...bools].sort((a, b) => (chipCls(b.label) ? 1 : 0) - (chipCls(a.label) ? 1 : 0)).map((p) => {
						// 依赖关系可视化:换座变体是「撤回作独立破坏」的子开关;三王星依赖现代星集。
						const isSignChangeChild = p.key === 'refranationIncludeSignChange';
						const parentOff = isSignChangeChild && !effective.refranationAsDestruction;
						const outerDead = p.key === 'includeOuter' && !outerAvailable;
						const disabled = parentOff || outerDead;
						// 停用原因走 title(hover)而非行内文本:窄栏下这串补充必被 ellipsis 截掉,
						// 且「左栏不放大段解释」是定则——置灰本身已表达不可用,原因 hover 可得。
						const hint = parentOff ? '须先开「撤回作独立破坏」' : (outerDead ? '需三王星入盘:流派预设切「现代心理」' : '');
						return (
							<Checkbox key={p.key} className={chipCls(p.label)} disabled={disabled} title={hint || undefined} checked={!!effective[p.key]} onChange={(e)=>setParam(p, !!(e && e.target && e.target.checked))}>
								{p.label}{changedMark(p)}
							</Checkbox>
						);
					})}
				</div>
			</XQSideSection>
		);
	}

	renderLeftExtra(args){
		const { extra, setExtra, fields, patchFields } = args;
		const schoolId = activeSchoolId(extra, fields);
		return (
			<>
			<XQSideSection iconName={sideSectionIcon('target')} title="卜卦设置" storageKey="horary.opts" className="horosa-side-input-section">
				<div className="horosa-field-block">
					<div className="horosa-field-label">所问之事（自由问句）</div>
					<TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={200}
						placeholder="用一句话写下所问之事"
						value={extra.questionText || ''}
						onChange={(e)=>setExtra({ questionText: e.target.value })} />
				</div>
				<div className="horosa-field-grid">
					<div className="horosa-field-block">
						<div className="horosa-field-label">流派</div>
						<XQSelect style={{ width: '100%' }} size="small"
							value={schoolId}
							dropdownMatchSelectWidth={false}
							onChange={(val)=>{
								setExtra({ horarySchool: val, horaryOverrides: {} });
								// 后端字段联动:换宫制/界/星群/双子界序/福点反转 → patchFields 自动重排盘;
								// 仅当与当前值不同才 patch(避免无谓重取)。tripSystem 前端判读消费,不下发。
								const bf = horaryBackendFields(val);
								const patch = {};
								Object.keys(bf).forEach((k) => {
									const cur = fields && fields[k] && fields[k].value !== undefined ? fields[k].value : undefined;
									if(cur !== bf[k]){ patch[k] = bf[k]; }
								});
								if(Object.keys(patch).length){ patchFields(patch); }
							}}>
							{HORARY_SCHOOL_ORDER.map((id)=>(<Option key={id} value={id}>{HORARY_SCHOOLS[id].cn}</Option>))}
						</XQSelect>
					</div>
					<div className="horosa-field-block">
						<div className="horosa-field-label">问题类别</div>
						<XQSelect style={{ width: '100%' }} size="small"
							value={extra.questionCategory || 'general'}
							dropdownMatchSelectWidth={false}
							onChange={(val)=>setExtra({ questionCategory: val })}>
							{HORARY_CATEGORIES.map((c)=>(<Option key={c.value} value={c.value}>{c.label}</Option>))}
						</XQSelect>
					</div>
				</div>
				{/* [H5b] 人称档/性别档快捷位:与「判读参数」面板同写 horaryOverrides(单一真值源,
				    面板自动回显「·改」);选项列表取 spec(零第二份枚举)。 */}
				<div className="horosa-field-grid">
					{['personScope', 'querentGender'].map((k) => {
						const sp = HORARY_PARAM_BY_KEY[k];
						const ov = extra.horaryOverrides || {};
						const cur = ov[k] !== undefined ? ov[k] : sp.default;
						return (
							<div key={k} className="horosa-field-block">
								<div className="horosa-field-label">{sp.label}</div>
								<XQSelect style={{ width: '100%' }} size="small" value={cur}
									dropdownMatchSelectWidth={false}
									onChange={(val)=>{
										const next = { ...ov };
										if(val === sp.default){ delete next[k]; } else { next[k] = val; }
										setExtra({ horaryOverrides: next });
									}}>
									{(sp.options || []).map((o)=>(<Option key={String(o.value)} value={o.value}>{o.label}</Option>))}
								</XQSelect>
							</div>
						);
					})}
				</div>
				{this.renderCampBlock(args)}
				<div className="horosa-horary-option-card">
					<Checkbox className="horosa-chip-full" checked={extra.chartFocus !== false}
						onChange={(e)=>setExtra({ chartFocus: !!(e && e.target && e.target.checked) })}>
						盘面聚焦征象宫
					</Checkbox>
					<Checkbox checked={extra.sincerityConfirmed !== false}
						onChange={(e)=>setExtra({ sincerityConfirmed: (e && e.target && e.target.checked) ? true : false })}>
						问题真诚自评
					</Checkbox>
					<Checkbox className="horosa-chip-full" checked={!!extra.confirmYouthMatch}
						onChange={(e)=>setExtra({ confirmYouthMatch: !!(e && e.target && e.target.checked) })}>
						年轻体貌合上升
					</Checkbox>
					{/* [H8] 事件盘=有确定客观时刻(⑤类起盘):命度过晚(asc_late)考量的正当救济入口 */}
					<Checkbox className="horosa-chip-full" checked={!!extra.isEventChart}
						onChange={(e)=>setExtra({ isEventChart: !!(e && e.target && e.target.checked) })}>
						事件盘（客观时刻）
					</Checkbox>
					{/* [二期] 判读叠层四子层(默认开;说明详帮助·卜卦盘) */}
					<Checkbox className="horosa-chip-full" checked={extra.overlayPerfection !== false}
						onChange={(e)=>setExtra({ overlayPerfection: !!(e && e.target && e.target.checked) })}>
						盘面完成法连线
					</Checkbox>
					<Checkbox checked={extra.overlayAntiscia !== false}
						onChange={(e)=>setExtra({ overlayAntiscia: !!(e && e.target && e.target.checked) })}>
						盘面映点标记
					</Checkbox>
					<Checkbox className="horosa-chip-full" checked={extra.overlayTerms !== false}
						onChange={(e)=>setExtra({ overlayTerms: !!(e && e.target && e.target.checked) })}>
						界限环按界主着色
					</Checkbox>
					<Checkbox className="horosa-chip-full" checked={extra.overlayStars !== false}
						onChange={(e)=>setExtra({ overlayStars: !!(e && e.target && e.target.checked) })}>
						恒星命中轮缘标注
					</Checkbox>
				</div>
			</XQSideSection>
			{this.renderAdvanced(args)}
			</>
		);
	}

	renderRight({ chart, extra, fields }){
		// horosa_panel_ready_v1:卜卦盘的中栏(DivinationChartShell 画的盘)与右栏(判读)同源于 chart。
		// 本组件自身不发请求(壳负责),故「面板数据落定」= 拿到新 chart 的这一轮渲染;
		// markPanelReady 内部双 rAF 后才记账,量到的是本帧已绘。只在 chart 真换了时打一次。
		if(chart && chart !== this._readyChart){
			this._readyChart = chart;
			markPanelReady('auxchart');
		}
		return <HoraryJudgment chart={chart} category={extra.questionCategory || 'general'}
			schoolId={activeSchoolId(extra, fields)}
			overrides={extra.horaryOverrides || null}
			questionText={extra.questionText || ''}
			castingCamp={extra.castingCamp || 'astrologer'}
			assessments={{
				sincerityConfirmed: extra.sincerityConfirmed !== false,
				confirmYouthMatch: !!extra.confirmYouthMatch,
				isEventChart: !!extra.isEventChart,
			}} />;
	}

	render(){
		return (
			<DivinationChartShell
				title="卜卦盘"
				kicker="起卦设置"
				pageClass="horosa-horary-page"
				// 默认档(经典主流)后端字段全量播种:首帧排盘即带 termsVariant:2/lotReversal:0 等,
				// 使盘面(后端界主/尊贵/福点)与判读(前端 school 口径)从第一发请求起就一致
				// (此前只播 hsys → 默认档盘面按埃及界/福点夜反转、判读按经典传本/不反转,潜在错位)。
				defaults={{ zodiacal: 0, ...horaryBackendFields('classical') }}
				// 全局古典参数热同步白名单:流派学理绑定键(界系/双子界序/福点反转/宫制/星群)
				// 恒以流派为准,只放行未被流派区分的四键随「设置→星盘设置」全局变更。
				globalSyncKeys={['westNodeType', 'sectBuffer', 'leoBoundFirst', 'triplicity',
					'houseCuspAdvance', 'cazimiOrb', 'combustOrb', 'underBeamsOrb', 'antisciaOrb', 'fixedStarOrb', 'fixedStarOrbMode', 'vocMode', 'vocIncludeOuter',
					'stationMarking']}
				initialExtra={{ questionCategory: 'general' }}
				fields={this.props.fields}
				height={this.props.height}
				chartDisplay={this.props.chartDisplay}
				planetDisplay={this.props.planetDisplay}
				lotsDisplay={this.props.lotsDisplay}
				showAstroMeaning={this.props.showAstroMeaning}
				dispatch={this.props.dispatch}
				saveModule="horary"
				// [H9] 存案带格式化 AI 快照(对齐择日/世俗):挂载读 payload.aiSnapshot 免重算路径。
				// 判读 opts 与页面 HoraryJudgment 四层同构;runHorary 有 H3 memo,页面已算过=零成本。
				buildAiSnapshot={(chart, fields, extra) => {
					try{
						const ex = extra || {};
						const { runHorary } = require('../../divination/horary/horaryEngine');
						const { buildHorarySnapshot } = require('../../divination/horary/horarySnapshot');
						const opts = {
							...horaryJudgeOpts(activeSchoolId(ex, fields), ex.horaryOverrides || null, judgeLayerOverrides()),
							sincerityConfirmed: ex.sincerityConfirmed !== false,
							confirmYouthMatch: !!ex.confirmYouthMatch,
							isEventChart: !!ex.isEventChart,
						};
						const j = runHorary(chart, ex.questionCategory || 'general', opts);
						// [复审C1] 第二参=全 Result(receptions/mutuals 在顶层,页面 saveSnap 同款)——曾传 chart.chart 致存案路径 [古典接纳] 段恒缺。
						return j ? buildHorarySnapshot(j, chart, { questionText: ex.questionText, castingCamp: ex.castingCamp }) : undefined;
					}catch(e){ return undefined; }
				}}
				keyPlanets={horaryKeyPlanets}
				// [二期] 判读叠层:函数型 prop,shell 按 (chartObj, extra) 求值;
				// buildHoraryOverlay 单槽 memo 保证同盘同设置=同引用(AstroChart 签名短路)。
				horaryOverlay={buildHoraryOverlay}
				renderLeftExtra={(args)=>this.renderLeftExtra(args)}
				renderRight={(args)=>this.renderRight(args)}
			/>
		);
	}
}

export default HoraryMain;
