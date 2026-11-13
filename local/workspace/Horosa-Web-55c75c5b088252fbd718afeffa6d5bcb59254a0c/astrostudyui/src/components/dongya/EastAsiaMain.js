// 命 · 其他 · 东亚:藏历藏占 / 蒙古 Zurkhai / 算命学 / 九星气学 / 洛书流年 / 易卦星盘。
// 全部在前端按出生资料算(易卦星盘另读本命盘的星位与宫位),与「其他」页其余技法同一版式:
// 左栏时间地点与选项,中栏图,右栏表,最右是技法切换。
import { Component } from 'react';
import { InputNumber } from 'antd';
import SpaceTimePanel, { buildDateTimeFromFields, formatSpaceTime } from '../comp/SpaceTimePanel';
import { XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { SmallTable, cardStyle } from '../astro/AstroExtraCommon';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { normBinaryGender } from '../../utils/kinAstroFieldsSync';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import {
	EAST_ASIA_TABS, EAST_ASIA_PAGE_SETTINGS, buildEastAsiaModel, eastAsiaSnapshotLines, eastAsiaParamsFromFields, geoChangeFieldsPatch,
	tibetanDateText,
} from '../../utils/eastAsiaSnapshot';
import { MEWA_COLOR, hexName, trigramName, rabjungText, ZURKHAI_RELATION, EAST_ASIA_ANIMALS, EAST_ASIA_BRANCHES } from '../../utils/eastAsiaArts';
import EastAsiaBoard from './EastAsiaBoard';
import QuickDockBar from '../common/QuickDockBar';

const { TabPane } = Tabs;
const { Option } = Select;
const FILL = { flex: '1 1 auto', minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 };
const ICHING_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const PLANET_CN = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };

const mewaCell = (v)=>(v ? `${v} ${MEWA_COLOR[v] || ''}` : '—');

export default class EastAsiaMain extends Component{
	constructor(props){
		super(props);
		this.state = { ...EAST_ASIA_PAGE_SETTINGS.load(), flowYear: null };
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.setOpt = this.setOpt.bind(this);
	}

	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){ this.markRuntime(); this.saveSnapshot(); }

	// 「其他」页的 AI 导出按当前激活的子技法取上下文:与 KinAstro 各技法写同一处
	markRuntime(){
		try{
			if(typeof window === 'undefined'){ return; }
			if(!window.__horosaKinAstroCurrent || typeof window.__horosaKinAstroCurrent !== 'object'){ window.__horosaKinAstroCurrent = {}; }
			window.__horosaKinAstroCurrent.mingother = 'dongya';
			window.__horosaKinAstroCurrent.technique = 'dongya';
		}catch(e){ /* 只影响导出上下文 */ }
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.fields !== this.props.fields || prevProps.value !== this.props.value
			|| prevState.fenyeVersion !== this.state.fenyeVersion || prevState.ichingMerge !== this.state.ichingMerge
			|| prevState.flowYear !== this.state.flowYear){
			this.saveSnapshot();
		}
	}

	model(){
		const params = eastAsiaParamsFromFields(this.props.fields);
		if(!params.date){ return null; }
		return buildEastAsiaModel(params, this.props.value, {
			fenyeVersion: this.state.fenyeVersion, ichingMerge: this.state.ichingMerge, flowYear: this.state.flowYear,
		});
	}

	saveSnapshot(){
		try{
			const params = eastAsiaParamsFromFields(this.props.fields);
			const model = this.model();
			const text = eastAsiaSnapshotLines(model).join('\n');
			if(text){
				saveModuleAISnapshot('dongya', text, { date: params.date, time: params.time, zone: params.zone, lon: params.lon, lat: params.lat });
			}
		}catch(e){ /* 快照失败不阻塞页面 */ }
	}

	setOpt(patch){
		const saved = {};
		['tab', 'fenyeVersion', 'ichingMerge'].forEach((k)=>{ if(patch[k] !== undefined){ saved[k] = patch[k]; } });
		if(Object.keys(saved).length){ EAST_ASIA_PAGE_SETTINGS.save(saved); }
		this.setState(patch);
	}

	onFieldsChange(field){
		if(this.props.dispatch){
			this.props.dispatch({ type: 'astro/fetchByFields', payload: { ...(this.props.fields || {}), ...field } });
		}
	}

	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		this.onFieldsChange({ date: { value: dt.clone() }, time: { value: dt.clone() }, ad: { value: dt.ad }, zone: { value: dt.zone } });
	}

	// 选地点 → 坐标 + 时区校正 → fetchByFields 重排(藏历日界、易卦宫卦随地点变)
	changeGeo(rec){
		const patch = geoChangeFieldsPatch(this.props.fields, rec);
		if(patch){ this.onFieldsChange(patch); }
	}

	renderInputPanel(model){
		const fields = this.props.fields || {};
		const gender = normBinaryGender(fields.gender && fields.gender.value);
		return (
			<div className="horosa-huangji-input-stack horosa-kinastro-input-stack">
				<div>
					<div className="horosa-side-panel-title">东亚诸术设置</div>
					<div className="horosa-side-panel-subtitle">藏、蒙、日诸术与易卦星盘</div>
				</div>
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						fields={fields}
						value={buildDateTimeFromFields(fields)}
						timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
						onTimeChange={this.onTimeChanged}
						onGeoChange={this.changeGeo}
					/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title="选项" storageKey="dongya.options" className="horosa-side-input-section">
					<div className="horosa-side-fields-inner">
						<div className="horosa-side-field">
							<div className="horosa-side-field-label">性别</div>
							<Select value={String(gender)} onChange={(value)=>this.onFieldsChange({ gender: { value: Number(value) } })}>
								<Option value="1">男</Option>
								<Option value="0">女</Option>
							</Select>
						</div>
						<div className="horosa-side-field">
							<div className="horosa-side-field-label">流年</div>
							<InputNumber min={1} max={9999} value={this.state.flowYear || (model ? model.flowYear : null)} onChange={(v)=>this.setState({ flowYear: Number(v) || null })} style={{ width: '100%' }} />
						</div>
						<div className="horosa-side-field">
							<div className="horosa-side-field-label">算命学藏干表</div>
							<Select value={this.state.fenyeVersion} onChange={(value)=>this.setOpt({ fenyeVersion: value })}>
								<Option value="common">通行版</Option>
								<Option value="fajue">法诀版</Option>
							</Select>
						</div>
						<div className="horosa-side-field">
							<div className="horosa-side-field-label">易卦星卦合入</div>
							<Select value={this.state.ichingMerge} onChange={(value)=>this.setOpt({ ichingMerge: value })}>
								<Option value="horizon">按地平上下</Option>
								<Option value="upper">恒合上卦</Option>
								<Option value="lower">恒合下卦</Option>
							</Select>
						</div>
					</div>
				</XQSideSection>
			</div>
		);
	}

	// 没有模型时的原因(右栏与中栏同一句)
	emptyReason(){
		const p = eastAsiaParamsFromFields(this.props.fields);
		if(p.date && Number(p.ad) < 0){ return '公元前出生暂不排东亚诸术:干支历只覆盖公元 1 年以后。'; }
		return p.date ? '这份出生资料排不出东亚诸术(日期超出干支历范围)。' : '没有出生资料。';
	}

	renderTables(model){
		if(!model){
			return <div style={cardStyle}>{this.emptyReason()}</div>;
		}
		const t = model.tibetan;
		const d = t.date;
		const kv = (rows, fill)=><SmallTable fill={!!fill} columns={[{ key: 'k', title: '项' }, { key: 'v', title: '值' }]} rows={rows.map(([k, v])=>({ k, v }))} />;
		const panes = {
			tibetan: (
				<div style={FILL}>
					{kv([
						['出生藏历', tibetanDateText(d, true)],
						['年', `${t.year.element}${t.year.male ? '阳' : '阴'}${t.year.animal} · ${rabjungText(t.year)}`],
						['曜日', `${t.weekday}曜`],
						['真太阳', `${d.trueSun.toFixed(2)}°`],
						['今日藏历', tibetanDateText(t.today, false)],
						['流年八卦', model.parkha.year
							? `${model.parkha.year.gua} ${model.parkha.year.tib} · ${model.parkha.year.dir} · ${model.parkha.year.element}(${model.parkha.age} 岁)`
							: `${model.flowYear} 年早于出生(藏历生年 ${d.year} 年),没有流年八卦`],
						['出生日八卦', `${model.parkha.day.gua} ${model.parkha.day.tib} · ${model.parkha.day.dir}`],
						['本命九宫', mewaCell(model.mewa.birth)],
						['当年九宫', mewaCell(model.mewa.year)],
						['生命力 / 个人力', `${mewaCell(model.mewa.vitality)} / ${mewaCell(model.mewa.power)}`],
						['下降九宫', mewaCell(model.mewa.descending)],
						['太阴日 / 历日九宫', `${mewaCell(model.mewa.lunarDay)} / ${mewaCell(model.mewa.calendarDay)}`],
						...model.forces.map((f)=>[f.label, f.value]),
					], true)}
				</div>
			),
			zurkhai: (
				<div style={FILL}>
					{kv([
						['年柱(立春换年)', `${model.zurkhai.yearGz || model.zurkhai.yearZhi} · ${EAST_ASIA_ANIMALS[EAST_ASIA_BRANCHES.indexOf(model.zurkhai.yearZhi)] || ''}`],
						['月柱(交节换月)', `${model.zurkhai.monthGz || model.zurkhai.monthZhi} · ${EAST_ASIA_ANIMALS[EAST_ASIA_BRANCHES.indexOf(model.zurkhai.monthZhi)] || ''}`],
						['相位', `${model.zurkhai.aspect}${model.zurkhai.relation ? `(${model.zurkhai.relation})` : ''}`],
					])}
					<div style={{ ...cardStyle, marginTop: 8 }}>相位 = 年支与月支在十二支环上相距几位再加一;同支记 0,没有 1。</div>
					<SmallTable fill columns={[{ key: 'a', title: '相位', align: 'right' }, { key: 'r', title: '两支关系' }, { key: 'm', title: '本盘' }]}
						rows={Object.keys(ZURKHAI_RELATION).map((k)=>({ a: k, r: ZURKHAI_RELATION[k], m: Number(k) === model.zurkhai.aspect ? '★ 本盘' : '' }))} />
				</div>
			),
			sanmei: model.sanmei ? (
				<div style={FILL}>
					<SmallTable columns={[{ key: 'label', title: '柱' }, { key: 'gz', title: '干支' }, { key: 'ruler', title: '藏干' }, { key: 'pos', title: '元' }, { key: 'segs', title: '分段' }]}
						rows={model.sanmei.pillars.map((p, i)=>{
							const h = model.sanmei.hidden[i];
							return { label: `${p.label}柱`, gz: p.gz, ruler: h.ruler || '—', pos: h.rulerPos || '', segs: h.segments.map((s)=>`${s.gan}${s.days}`).join(' ') };
						})} />
					<div style={{ ...cardStyle, marginTop: 8 }}>
						天中杀 {model.sanmei.tenchusatsu.join('')} · 近年 {model.sanmei.years.map((y)=>`${y.year}${y.zhi}`).join('、') || '—'}
						{model.sanmei.relations.length ? <div style={{ marginTop: 6 }}>{model.sanmei.relations.map((r)=>`${r.a}${r.b}${r.kind}(${r.text})`).join(';')}</div> : null}
					</div>
				</div>
			) : null,
			ninestar: model.ninestar ? kv([
				['本命星', `${model.ninestar.honmeiName}(立春年 ${model.ninestar.year})`],
				['月命星', model.ninestar.getsumeiName],
				['日命星', model.ninestar.nichimeiName ? `${model.ninestar.nichimeiName}${model.ninestar.nichimeiDun ? `(${model.ninestar.nichimeiDun})` : ''}` : '—'],
				['日命星口径', '离冬至最近的甲子起一白阳遁顺行,离夏至最近的甲子起九紫阴遁逆行,逐日连续;遇闰在甲午换遁'],
			]) : null,
			loshu: (
				<SmallTable fill columns={[{ key: 'year', title: '年', align: 'right' }, { key: 'age', title: '岁', align: 'right' }, { key: 'center', title: '中宫', align: 'right' }, { key: 'active', title: '当年数', align: 'right' }, { key: 'cell', title: '所在格' }]}
					rows={model.loshu.map((r)=>(r.beforeBirth
						? { year: r.year, age: '—', center: '—', active: '—', cell: '早于出生' }
						: { year: r.year, age: r.age, center: r.center, active: r.active, cell: (r.cells.find((c)=>c.active) || {}).label || '' }))} />
			),
			iching: model.iching.rows.length ? (
				<div style={FILL}>
					<SmallTable columns={[{ key: 'p', title: '星' }, { key: 'deg', title: '度卦 → 合后' }, { key: 'sign', title: '座卦 → 合后' }, { key: 'house', title: '宫卦 → 合后' }]}
						rows={ICHING_ORDER.map((id)=>model.iching.rows.find((r)=>r.id === id)).filter(Boolean).map((r)=>({
							p: `${PLANET_CN[r.id] || r.id} ${trigramName(r.trigram)}${r.toUpper ? '上' : '下'}${r.house ? ` · ${r.house} 宫` : ''}`,
							deg: `${hexName(r.degree)} → ${hexName(r.degreeMerged)}`,
							sign: `${hexName(r.sign_)} → ${hexName(r.signMerged)}`,
							house: r.house_ ? `${hexName(r.house_)} → ${hexName(r.houseMerged)}` : '—',
						}))} />
					<div style={{ ...cardStyle, marginTop: 8 }}>易卦推运:今日环位 {model.iching.progression.position},{hexName(model.iching.progression.hexagram)}</div>
				</div>
			) : <div style={cardStyle}>先在「占星」页排出本命盘,这里读它的星位与宫位。</div>,
		};
		return (
			<Tabs activeKey={this.state.tab} onChange={(key)=>this.setOpt({ tab: key })} tabPosition="top" className="horosa-huangji-tabs horosa-kinastro-tabs">
				{EAST_ASIA_TABS.map((item)=>(
					<TabPane tab={<span title={item.full || item.label}>{item.label}</span>} key={item.key}>
						<div style={{ ...FILL, height: '100%' }}>{panes[item.key]}</div>
					</TabPane>
				))}
			</Tabs>
		);
	}

	// 流年步进:delta 0 = 回今年(清掉手填的年,跟着今天走)
	shiftFlowYear(delta, model){
		if(!delta){ this.setState({ flowYear: null }); return; }
		const base = Number(this.state.flowYear || (model && model.flowYear)) || new Date().getFullYear();
		this.setState({ flowYear: Math.min(9999, Math.max(1, base + delta)) });
	}

	// 底部快捷栏:与「其他」页其余技法同一位置。本页即改即算、没有起盘键,放流年步进(藏占流年八卦 / 当年九宫 / 洛书流年都跟它走)
	renderBottomQuickDock(model){
		return (
			<QuickDockBar
				page="dongya"
				className="horosa-huangji-quick-dock horosa-kinastro-quick-dock"
				hasResult={!!model}
				extras={[
					{ key: 'prevYear', label: '上一年', icon: 'quickTransit', onClick: ()=>this.shiftFlowYear(-1, model) },
					{ key: 'thisYear', label: '回今年', icon: 'quickComposite', disabled: !model || !this.state.flowYear, onClick: ()=>this.shiftFlowYear(0, model) },
					{ key: 'nextYear', label: '下一年', icon: 'quickTransit', onClick: ()=>this.shiftFlowYear(1, model) },
				]}
				dispatch={this.props.dispatch}
			/>
		);
	}

	renderTechniqueRail(){
		const tabs = Array.isArray(this.props.techniqueTabs) ? this.props.techniqueTabs : [];
		if(tabs.length <= 1){ return null; }
		return (
			<div className="horosa-kinastro-technique-rail">
				{tabs.map((item)=>(
					<button type="button" key={item.key} className={this.props.activeTechnique === item.key ? 'is-active' : ''}
						onClick={()=>this.props.onTechniqueChange && this.props.onTechniqueChange(item.key)}>
						{item.label}
					</button>
				))}
			</div>
		);
	}

	render(){
		const model = this.model();
		const hasRail = Array.isArray(this.props.techniqueTabs) && this.props.techniqueTabs.length > 1;
		return (
			<div className="horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-kinastro-redesign horosa-kinastro-module-mingother horosa-dongya-redesign" style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<div className={`horosa-astro-redesign-grid horosa-huangji-redesign-grid horosa-kinastro-grid${hasRail ? ' has-technique-rail' : ''}`} style={{ position: 'relative' }}>
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
							{this.renderInputPanel(model)}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer" style={{ position: 'relative' }}>
							<div className="horosa-huangji-board-host horosa-kinastro-board-host" style={{ width: '100%', height: '100%' }}>
								<EastAsiaBoard model={model} tab={this.state.tab} emptyReason={model ? '' : this.emptyReason()} />
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
							<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
								<div>
									<div className="horosa-side-panel-title">东亚诸术</div>
									<div className="horosa-side-panel-subtitle">藏历 · 藏占 · 蒙古 · 算命学 · 九星 · 洛书 · 易卦</div>
								</div>
							</div>
							{this.renderTables(model)}
						</div>
						{this.renderTechniqueRail()}
					</div>
					{this.renderBottomQuickDock(model)}
				</div>
			</div>
		);
	}
}
