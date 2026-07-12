import { Component } from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import {convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import { dstAwareZoneAt } from '../../utils/timezone';
import { geoNameFieldPatch } from '../../utils/geoName';
import DateTime from '../comp/DateTime';
import SpaceTimePanel from '../comp/SpaceTimePanel';
import * as SZConst from '../suzhan/SZConst';
import * as AstroConst from '../../constants/AstroConst';
import { Checkbox, InputNumber, Radio } from 'antd';
import { XQSelect as Select, XQToggle, XQModal } from '../xq-ui';
import { MOIRA_PLANET_DEFS, MOIRA_ASPECT_DEFS, MOIRA_BIRTH_GOD_ORDER, MOIRA_TRANSIT_GOD_ORDER } from './GuoLaoMoiraWheel';
import { parseMagneticDms, formatMagneticDms } from './electionGeomag';
import GuoLaoStarSectDoc from './GuoLaoStarSectDoc';
import XQIcon from '../xq-icons';
import { GUOLAO_ALL_ASPECTS, GUOLAO_CHART_STYLE_CLASSIC, GUOLAO_CHART_STYLE_MOIRA, GUOLAO_CHART_STYLE_PICK, GUOLAO_CHART_STYLE_QIZHENG, GUOLAO_LIFE_MODE_ASC, GUOLAO_LIFE_MODE_COTRANS, GUOLAO_LIFE_MODE_YUMAO, GUOLAO_NODE_MODE_NORTH_KETU, GUOLAO_NODE_MODE_NORTH_RAHU, getStoredGuolaoLifeMode, getStoredGuolaoNodeMode, setStoredGuolaoAyanamsa, getStoredGuolaoTrueSolarTime, setStoredGuolaoTrueSolarTime, getStoredGuolaoNodeType, setStoredGuolaoNodeType, getStoredGuolaoLilithType, setStoredGuolaoLilithType, getStoredGuolaoBodyMode, setStoredGuolaoBodyMode, getStoredGuolaoTuibianMethod, setStoredGuolaoTuibianMethod, getStoredGuolaoGufaPrecess, setStoredGuolaoGufaPrecess, getStoredGuolaoEqTropicalAnchor, setStoredGuolaoEqTropicalAnchor, setStoredGuolaoLifeMode, setStoredGuolaoSu28Mode, GUOLAO_SCHOOL_PRESETS, matchSchoolPreset, normalizeGuolaoLifeMode, normalizeGuolaoNodeMode, } from './GuoLaoChartStyle';
import { SU28_MODE_GROUPS, TUIBIAN_METHOD_OPTIONS, GUFA_PRECESS_OPTIONS, EQ_TROPICAL_ANCHOR_OPTIONS, TRUE_SOLAR_TIME_OPTIONS, NODE_TYPE_OPTIONS, LILITH_TYPE_OPTIONS, BODY_MODE_OPTIONS, LIFE_MODE_OPTIONS, LIFE_MASTER_MODE_OPTIONS, MINOR_LIMIT_TYPE_OPTIONS, TONGXIAN_BASE_OPTIONS, SCHOOL_PRESET_OPTIONS, LIFE_CUSTOM_ZHI_OPTIONS, BODY_CUSTOM_ZHI_OPTIONS, HSYS_OPTIONS } from './guolaoData';

const {Option, OptGroup} = Select;

class GuoLaoInput extends Component{
	
	constructor(props) {
		super(props);

		this.state = {
			displayFilterOpen: false,
		};

        this.tmHook = {
            getValue: null,
        }

		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.onDoubingSu28Change = this.onDoubingSu28Change.bind(this);
		this.onChartShapeChange = this.onChartShapeChange.bind(this);
		this.onChartStyleChange = this.onChartStyleChange.bind(this);
		this.onLifeModeChange = this.onLifeModeChange.bind(this);
		this.onNodeModeChange = this.onNodeModeChange.bind(this);
		this.onAyanamsaChange = this.onAyanamsaChange.bind(this);
		this.onTrueSolarTimeChange = this.onTrueSolarTimeChange.bind(this);
		this.onNodeTypeChange = this.onNodeTypeChange.bind(this);
		this.onLilithTypeChange = this.onLilithTypeChange.bind(this);
		this.onBodyModeChange = this.onBodyModeChange.bind(this);
		this.onTuibianMethodChange = this.onTuibianMethodChange.bind(this);
		this.onGufaPrecessChange = this.onGufaPrecessChange.bind(this);
		this.onEqTropicalAnchorChange = this.onEqTropicalAnchorChange.bind(this);
		this.onMoiraTransitTimeChanged = this.onMoiraTransitTimeChanged.bind(this);
		this.onMoiraTransitGodsToggle = this.onMoiraTransitGodsToggle.bind(this);
		this.onEngineModeChange = this.onEngineModeChange.bind(this);
		this.onKinastroOptionChange = this.onKinastroOptionChange.bind(this);
		this.onDisplayToggle = this.onDisplayToggle.bind(this);
		this.toggleAspect = this.toggleAspect.bind(this);
	}

	onGenderChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				gender: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	onDoubingSu28Change(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				doubingSu28: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	onTimeChanged(value){
		if(this.props.onFieldsChange){
			let dt = value.time;

			this.props.onFieldsChange({
				__confirmed: !!value.confirmed,
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				}
			});
		}
	}

	onChartShapeChange(val){
		SZConst.SZChart.shape = val;
		safeLocalStorageSet('suzhanChartShape', val);
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				szshape: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	onChartStyleChange(val){
		if(this.props.onChartStyleChange){
			this.props.onChartStyleChange(val);
		}
	}

	onLifeModeChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				guolaoLifeMode: {
					value: normalizeGuolaoLifeMode(val),
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	onNodeModeChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				guolaoNodeMode: {
					value: normalizeGuolaoNodeMode(val),
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},
			});
		}
	}

	onAyanamsaChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			setStoredGuolaoAyanamsa(val);
			this.props.onFieldsChange({
				guolaoAyanamsa: { value: val || '' },
				date: { value: dt.clone() },
				time: { value: dt.clone() },
				ad: { value: dt.ad },
				zone: { value: dt.zone },
			});
		}
	}

	// G6/G10/G11 起盘类参数:变更须重排盘(带 date/time/ad/zone 触发后端重取,同 onAyanamsaChange)。
	onGuolaoParamChange(fieldKey, val, setter){
		if(this.props.onFieldsChange){
			const dt = this.tmHook.getValue().value;
			if(setter){ setter(val); }
			const patch = { date: { value: dt.clone() }, time: { value: dt.clone() }, ad: { value: dt.ad }, zone: { value: dt.zone } };
			patch[fieldKey] = { value: val };
			this.props.onFieldsChange(patch);
		}
	}

	onTrueSolarTimeChange(val){
		this.onGuolaoParamChange('guolaoTrueSolarTime', val, setStoredGuolaoTrueSolarTime);
	}

	onNodeTypeChange(val){
		this.onGuolaoParamChange('guolaoNodeType', val, setStoredGuolaoNodeType);
	}

	onLilithTypeChange(val){
		this.onGuolaoParamChange('guolaoLilithType', val, setStoredGuolaoLilithType);
	}

	onBodyModeChange(val){
		this.onGuolaoParamChange('guolaoBodyMode', val, setStoredGuolaoBodyMode);
	}

	// WP-D 授时历古法(用制 6)子选项:推变法 + 古宿岁差,变更须重排盘(同 onBodyModeChange 起盘类)。
	onTuibianMethodChange(val){
		this.onGuolaoParamChange('guolaoTuibianMethod', val, setStoredGuolaoTuibianMethod);
	}

	onGufaPrecessChange(val){
		this.onGuolaoParamChange('guolaoGufaPrecess', val, setStoredGuolaoGufaPrecess);
	}

	// 额外档 赤道回归制(用制 7)锚点:牛前冬至/春分壁2.3,变更须重排盘。
	onEqTropicalAnchorChange(val){
		this.onGuolaoParamChange('guolaoEqTropicalAnchor', val, setStoredGuolaoEqTropicalAnchor);
	}

	// 类B 显示偏好的下拉(命主取法/行运法):写 guolaoDisplay,纯前端即时联动,不重取后端。
	onGuolaoDisplaySelect(key, val){
		if(this.props.onGuolaoDisplayChange){
			this.props.onGuolaoDisplayChange({[key]: val});
		}
	}

	// G34 流派预设一键:批量套 类A fields(单帧重排)+ 类B display(即时);选后回 custom 可微调。
	onSchoolPresetChange(preset){
		const p = GUOLAO_SCHOOL_PRESETS[preset];
		if(!p || !this.props.onFieldsChange){ return; }
		const f = p.fields || {};
		const setters = {
			guolaoLifeMode: setStoredGuolaoLifeMode, guolaoBodyMode: setStoredGuolaoBodyMode,
			guolaoTrueSolarTime: setStoredGuolaoTrueSolarTime, guolaoNodeType: setStoredGuolaoNodeType,
			doubingSu28: setStoredGuolaoSu28Mode,
		};
		Object.keys(f).forEach((k)=>{ if(setters[k]){ setters[k](f[k]); } });
		const dt = this.tmHook.getValue().value;
		const patch = { date: { value: dt.clone() }, time: { value: dt.clone() }, ad: { value: dt.ad }, zone: { value: dt.zone } };
		Object.keys(f).forEach((k)=>{ patch[k] = { value: f[k] }; });
		this.props.onFieldsChange(patch);
		if(p.display && this.props.onGuolaoDisplayChange){ this.props.onGuolaoDisplayChange(p.display); }
	}

	// G34 流派预设「当前值」纯派生:解析当前 fields(类A,缺则回退存储默认)+ display(类B),交给纯函数
	// matchSchoolPreset 匹配。选后即显所选流派(命中);任一相关开关被微调 → 不再吻合 → 诚实回落「自定」。
	// 匹配逻辑抽成 GuoLaoChartStyle.matchSchoolPreset(纯函数,单一真值源 + jest 守卫)。
	schoolPresetValue(){
		const fields = this.props.fields || {};
		const fv = (key, fallback)=>{
			const f = fields[key];
			return (f && f.value !== undefined && f.value !== null) ? f.value : fallback;
		};
		return matchSchoolPreset({
			guolaoLifeMode: fv('guolaoLifeMode', getStoredGuolaoLifeMode()),
			guolaoBodyMode: fv('guolaoBodyMode', getStoredGuolaoBodyMode()),
			guolaoTrueSolarTime: fv('guolaoTrueSolarTime', getStoredGuolaoTrueSolarTime()),
			guolaoNodeType: fv('guolaoNodeType', getStoredGuolaoNodeType()),
			doubingSu28: fv('doubingSu28', 2),
		}, this.props.guolaoDisplay || {});
	}

	onMoiraTransitTimeChanged(value){
		if(this.props.onMoiraTransitTimeChange){
			this.props.onMoiraTransitTimeChange(value);
		}
	}

	onMoiraTransitGodsToggle(){
		if(this.props.onMoiraTransitGodsVisibleChange){
			this.props.onMoiraTransitGodsVisibleChange(!this.props.showMoiraTransitGods);
		}
	}

	onEngineModeChange(val){
		if(this.props.onEngineModeChange){
			this.props.onEngineModeChange(val);
		}
	}

	onKinastroOptionChange(key, value){
		if(this.props.onKinastroOptionChange){
			this.props.onKinastroOptionChange(key, value);
		}
	}

	onElectionChange(patch){
		if(this.props.onGuolaoElectionChange){
			this.props.onGuolaoElectionChange(patch);
		}
	}

	onDisplayToggle(key){
		if(this.props.onGuolaoDisplayChange){
			const cur = this.props.guolaoDisplay || {};
			this.props.onGuolaoDisplayChange({[key]: !cur[key]});
		}
	}

	// 星曜可见性(对照 Moira PlanetDialog):pill 亮=显示;存隐藏名单,空=全显(默认零变化)。
	togglePlanetHidden(label){
		if(!this.props.onGuolaoDisplayChange){
			return;
		}
		const cur = (this.props.guolaoDisplay && this.props.guolaoDisplay.hiddenPlanets) || [];
		const next = cur.indexOf(label) >= 0 ? cur.filter((x)=>x !== label) : cur.concat([label]);
		this.props.onGuolaoDisplayChange({ hiddenPlanets: next });
	}

	// 神煞筛选(对照 Moira 神煞开关):Checkbox 勾=显示;落盘存隐藏名单。
	// 本命/流年独立名单(listKey=hiddenGodsBirth|hiddenGodsTransit),互不影响。
	setGodsVisible(listKey, order, visibleList){
		if(!this.props.onGuolaoDisplayChange){
			return;
		}
		const cur = (this.props.guolaoDisplay && this.props.guolaoDisplay[listKey]) || [];
		const others = cur.filter((g)=>order.indexOf(g) < 0);
		const hiddenInOrder = order.filter((g)=>visibleList.indexOf(g) < 0);
		this.props.onGuolaoDisplayChange({ [listKey]: others.concat(hiddenInOrder) });
	}

	// 每相位容许度(对照 Moira AspectDialog):清空回内置默认。
	setAspectOrb(key, val){
		if(!this.props.onGuolaoDisplayChange){
			return;
		}
		const cur = { ...((this.props.guolaoDisplay && this.props.guolaoDisplay.aspectOrbs) || {}) };
		const num = Number(val);
		if(val === null || val === undefined || val === '' || !Number.isFinite(num)){
			delete cur[key];
		}else{
			cur[key] = Math.max(0, Math.min(30, num));
		}
		this.props.onGuolaoDisplayChange({ aspectOrbs: cur });
	}

	toggleAspect(asp){
		if(!this.props.onGuolaoDisplayChange){
			return;
		}
		const cur = (this.props.guolaoDisplay && this.props.guolaoDisplay.aspects) || [];
		const next = cur.indexOf(asp) >= 0 ? cur.filter((a)=>a !== asp) : cur.concat([asp]);
		this.props.onGuolaoDisplayChange({aspects: next});
	}

	// 神煞筛选 + 相位容许度 设置弹层(信息不进快捷栏;此处是设置项,归左栏)。
	renderDisplayFilterModal(display){
		if(!this.state.displayFilterOpen){
			return null;
		}
		const orbs = display.aspectOrbs || {};
		const godSection = (title, order, listKey)=>{
			const hiddenList = display[listKey] || [];
			const visible = order.filter((g)=>hiddenList.indexOf(g) < 0);
			return (
				<div style={{marginBottom: 14}}>
					<div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6}}>
						<strong style={{fontSize: 13}}>{title}</strong>
						<a onClick={()=>this.setGodsVisible(listKey, order, order)} style={{fontSize: 12}}>全选</a>
						<a onClick={()=>this.setGodsVisible(listKey, order, [])} style={{fontSize: 12}}>清空</a>
						<a onClick={()=>this.setGodsVisible(listKey, order, order.filter((g)=>(listKey === 'hiddenGodsBirth' ? MOIRA_BIRTH_GOD_ORDER : MOIRA_TRANSIT_GOD_ORDER).indexOf(g) >= 0))} style={{fontSize: 12}}>恢复默认</a>
						<span style={{fontSize: 12, color: 'var(--horosa-muted, #8c8c8c)'}}>{visible.length}/{order.length}</span>
					</div>
					<Checkbox.Group
						value={visible}
						onChange={(list)=>this.setGodsVisible(listKey, order, list)}
						style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))', gap: '2px 8px'}}
					>
						{order.map((god)=>(<Checkbox key={god} value={god} style={{fontSize: 12, marginLeft: 0}}>{god}</Checkbox>))}
					</Checkbox.Group>
				</div>
			);
		};
		return (
			<XQModal
				visible
				title="盘面显示筛选"
				width={720}
				footer={null}
				onCancel={()=>this.setState({ displayFilterOpen: false })}
			>
				{(()=>{
					// 清单以当前盘实收字集为准(godNamePools,数据驱动);空(盘未返回)才回退固定序表。
					const pools = this.props.godNamePools || {};
					const birthList = pools.birth && pools.birth.length ? pools.birth : MOIRA_BIRTH_GOD_ORDER;
					const transitList = pools.transit && pools.transit.length ? pools.transit : MOIRA_TRANSIT_GOD_ORDER;
					return (
						<>
							{godSection(`本命神煞`, birthList, 'hiddenGodsBirth')}
							{godSection(`流年神煞`, transitList, 'hiddenGodsTransit')}
						</>
					);
				})()}
				<div style={{marginBottom: 14}}>
					<div style={{marginBottom: 6}}><strong style={{fontSize: 13}}>十神选择</strong><span style={{fontSize: 12, color: 'var(--horosa-muted, #8c8c8c)', marginLeft: 8}}>年曜十神的称谓体系（对照 Moira）</span></div>
					<Radio.Group
						value={display.tenGodSeq === 'alt' ? 'alt' : 'org'}
						onChange={(e)=>this.props.onGuolaoDisplayChange && this.props.onGuolaoDisplayChange({ tenGodSeq: e.target.value })}
					>
						<Radio value="org" style={{display: 'block', fontSize: 12, marginBottom: 2}}>天禄, 天暗, 天福, 天耗, 天荫, 天贵, 天嗣, 天刑, 天印, 天囚, 天权</Radio>
						<Radio value="alt" style={{display: 'block', fontSize: 12}}>比肩, 劫财, 食神, 伤官, 偏财, 正财, 七杀, 正官, 偏印, 正印</Radio>
					</Radio.Group>
				</div>
				<div>
					<div style={{marginBottom: 6}}><strong style={{fontSize: 13}}>相位容许度(度)</strong><span style={{fontSize: 12, color: 'var(--horosa-muted, #8c8c8c)', marginLeft: 8}}>清空=用默认</span></div>
					<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8}}>
						{MOIRA_ASPECT_DEFS.map((sp)=>(
							<label key={sp.key} style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 12}}>
								<span style={{minWidth: 30}}>{sp.key}</span>
								<InputNumber
									size="small"
									min={0}
									max={30}
									step={0.5}
									value={orbs[sp.key] !== undefined ? orbs[sp.key] : sp.orb}
									onChange={(val)=>this.setAspectOrb(sp.key, val)}
								/>
							</label>
						))}
					</div>
				</div>
			</XQModal>
		);
	}

	changeGeo(rec){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			// 选新地点时按新坐标自动校正时区(未在 atlas 内手改时区时)。
			// setZone 仅改时区标签、保留出生钟面时刻(见 DateTime.setZone),不移位时间。
			if(dt && dt.setZone){
				try{
					if(rec.zone){
						dt.setZone(rec.zone);
					}else{
						const ds = dt.format ? dt.format('YYYY-MM-DD') : null;
						const z = dstAwareZoneAt(rec.gpsLat, rec.gpsLng, ds);
						if(z && z.offset){ dt.setZone(z.offset); }
					}
				}catch(e){ /* 推断失败保留原时区 */ }
			}
			this.props.onFieldsChange({
				lon: {
					value: convertLonToStr(rec.lng),
				},
				lat: {
					value: convertLatToStr(rec.lat),
				},
				gpsLon: {
					value: rec.gpsLng
				},
				gpsLat: {
					value: rec.gpsLat
				},
				...geoNameFieldPatch(rec),
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	render(){
		let fields = this.props.fields ? this.props.fields : {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			let str = fields.date.value.format('YYYY-MM-DD') + ' ' + 
						fields.time.value.format('HH:mm:ss');
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}

		let szshape = SZConst.SZChart.shape;
		if(fields.szshape !== undefined && fields.szshape !== null &&
			fields.szshape.value !== undefined && fields.szshape.value !== null){
			szshape = fields.szshape.value;
		}
		const engineMode = this.props.engineMode === 'kinastro' ? 'kinastro' : 'horosa';
		const chartStyle = engineMode === 'kinastro'
			? GUOLAO_CHART_STYLE_QIZHENG
			: (this.props.chartStyle === GUOLAO_CHART_STYLE_PICK
				? GUOLAO_CHART_STYLE_PICK
				: (this.props.chartStyle === GUOLAO_CHART_STYLE_MOIRA ? GUOLAO_CHART_STYLE_MOIRA : GUOLAO_CHART_STYLE_CLASSIC));
		const lifeMode = fields.guolaoLifeMode && fields.guolaoLifeMode.value !== undefined && fields.guolaoLifeMode.value !== null
			? normalizeGuolaoLifeMode(fields.guolaoLifeMode.value)
			: getStoredGuolaoLifeMode();
		const nodeMode = fields.guolaoNodeMode && fields.guolaoNodeMode.value !== undefined && fields.guolaoNodeMode.value !== null
			? normalizeGuolaoNodeMode(fields.guolaoNodeMode.value)
			: getStoredGuolaoNodeMode();
		const kinOptions = this.props.kinastroOptions || {};
		const chartDateNative = fields.date && fields.date.value && fields.date.value.format ? fields.date.value.format('YYYY-MM-DD') : '';
		const kinCurrentYear = kinOptions.currentYear || new Date().getFullYear();
		const kinTransitMode = kinOptions.transitMode || 'none';
		const kinTransitDate = kinOptions.transitDate || '';
		const kinTransitTime = kinOptions.transitTime || '';
		const kinElectionalStartDate = kinOptions.electionalStartDate || chartDateNative;
		const kinElectionalCriteria = kinOptions.electionalCriteria || 'general';
		const kinElectionalDays = kinOptions.electionalDays || 30;
		const display = this.props.guolaoDisplay || {};
		const ele = this.props.electionOptions || {};
		const chartStyleField = (
			<label className="horosa-guolao-select-field">
				<span>星盘样式</span>
				<Select value={chartStyle} onChange={this.onChartStyleChange} size='small' dropdownMatchSelectWidth={false}>
					<Option value={GUOLAO_CHART_STYLE_CLASSIC}>Horosa原盘</Option>
					<Option value={GUOLAO_CHART_STYLE_MOIRA}>Moira圆盘</Option>
					<Option value={GUOLAO_CHART_STYLE_PICK}>天星择日</Option>
					<Option value={GUOLAO_CHART_STYLE_QIZHENG}>坚七政</Option>
				</Select>
			</label>
		);
		// 分宫制(西占宫位格/择日西占带共用 election.hsys):Moira圆盘与天星择日两样式可选,
		// 从「天星择日」卡挪入「选项」卡(用户钦定)。
		const hsysField = (chartStyle === GUOLAO_CHART_STYLE_MOIRA || chartStyle === GUOLAO_CHART_STYLE_PICK) ? (
			<label className="horosa-guolao-select-field">
				<span>分宫制</span>
				<Select value={ele.hsys} onChange={(v)=>this.onElectionChange({ hsys: v })} size='small' dropdownMatchSelectWidth={false}>
					{HSYS_OPTIONS.map(([v, l])=>(<Option key={v} value={v}>{l}</Option>))}
				</Select>
			</label>
		) : null;

		return (
			<div className="horosa-guolao-input-stack">
				<div className="horosa-side-panel-heading">
					<div>
						<div className="horosa-side-panel-title">七政设置</div>
						<div className="horosa-side-panel-subtitle">时间、地点与排盘选项</div>
					</div>
				</div>

				<SpaceTimePanel
					fields={fields}
					value={datetm}
					onTimeChange={this.onTimeChanged}
					timeHook={this.tmHook}
					onGeoChange={this.changeGeo}
				/>

				<div className="horosa-guolao-input-section">
					<div className="horosa-guolao-field-title">
						<XQIcon name="sliders" />
						<span>选项</span>
					</div>
					{engineMode === 'kinastro' ? (
					<div className="horosa-guolao-select-grid horosa-guolao-kinastro-options">
						<label className="horosa-guolao-select-field">
							<span>性别</span>
							<Select value={fields.gender.value} onChange={this.onGenderChange} size='small' dropdownMatchSelectWidth={false}>
								<Option value={0}>女</Option>
								<Option value={1}>男</Option>
							</Select>
						</label>
						{chartStyleField}
						<label className="horosa-guolao-select-field">
							<span>流时</span>
							<Select value={kinTransitMode} onChange={(val)=>this.onKinastroOptionChange('transitMode', val)} size='small' dropdownMatchSelectWidth={false}>
								<Option value="none">关闭</Option>
								<Option value="same">同刻</Option>
								<Option value="now">此刻</Option>
								<Option value="custom">自定</Option>
							</Select>
						</label>
						{kinTransitMode === 'custom' ? (
						<>
							<label className="horosa-guolao-select-field">
								<span>流时日期</span>
								<input
									className="horosa-guolao-mini-input"
									type="date"
									value={kinTransitDate}
									onChange={(event)=>this.onKinastroOptionChange('transitDate', event.currentTarget.value)}
									onInput={(event)=>this.onKinastroOptionChange('transitDate', event.currentTarget.value)}
								/>
							</label>
							<label className="horosa-guolao-select-field">
								<span>流时时间</span>
								<input
									className="horosa-guolao-mini-input"
									type="time"
									value={kinTransitTime}
									onChange={(event)=>this.onKinastroOptionChange('transitTime', event.currentTarget.value)}
									onInput={(event)=>this.onKinastroOptionChange('transitTime', event.currentTarget.value)}
								/>
							</label>
						</>
						) : null}
						<label className="horosa-guolao-select-field">
							<span>推运年份</span>
							<input
								className="horosa-guolao-mini-input"
								type="number"
								min="1"
								max="9999"
								value={kinCurrentYear}
								onChange={(event)=>this.onKinastroOptionChange('currentYear', event.currentTarget.value)}
							/>
						</label>
						<label className="horosa-guolao-select-field">
							<span>择日起日</span>
							<input
								className="horosa-guolao-mini-input"
								type="date"
								value={kinElectionalStartDate}
								onChange={(event)=>this.onKinastroOptionChange('electionalStartDate', event.currentTarget.value)}
								onInput={(event)=>this.onKinastroOptionChange('electionalStartDate', event.currentTarget.value)}
							/>
						</label>
						<label className="horosa-guolao-select-field">
							<span>择日用途</span>
							<Select value={kinElectionalCriteria} onChange={(val)=>this.onKinastroOptionChange('electionalCriteria', val)} size='small' dropdownMatchSelectWidth={false}>
								<Option value="general">通用</Option>
								<Option value="marriage">嫁娶</Option>
								<Option value="travel">出行</Option>
								<Option value="business">开市</Option>
								<Option value="moving">搬迁</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>择日天数</span>
							<input
								className="horosa-guolao-mini-input"
								type="number"
								min="1"
								max="60"
								value={kinElectionalDays}
								onChange={(event)=>this.onKinastroOptionChange('electionalDays', event.currentTarget.value)}
							/>
						</label>
						<label className="horosa-guolao-select-field">
							<span>古籍断语</span>
							<Select value={kinOptions.showZhangguo === false ? 'off' : 'on'} onChange={(val)=>this.onKinastroOptionChange('showZhangguo', val === 'on')} size='small' dropdownMatchSelectWidth={false}>
								<Option value="on">显示</Option>
								<Option value="off">隐藏</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>神煞</span>
							<Select value={kinOptions.showShensha === false ? 'off' : 'on'} onChange={(val)=>this.onKinastroOptionChange('showShensha', val === 'on')} size='small' dropdownMatchSelectWidth={false}>
								<Option value="on">显示</Option>
								<Option value="off">隐藏</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>命宫解读</span>
							<Select value={kinOptions.showMingGong === false ? 'off' : 'on'} onChange={(val)=>this.onKinastroOptionChange('showMingGong', val === 'on')} size='small' dropdownMatchSelectWidth={false}>
								<Option value="on">显示</Option>
								<Option value="off">隐藏</Option>
							</Select>
						</label>
					</div>
					) : (
					<div className="horosa-guolao-select-grid">
						<label className="horosa-guolao-select-field">
							<span>性别</span>
							<Select value={fields.gender.value} onChange={this.onGenderChange} size='small' dropdownMatchSelectWidth={false}>
								<Option value={-1}>未知</Option>
								<Option value={0}>女</Option>
								<Option value={1}>男</Option>
							</Select>
						</label>
						{chartStyleField}
						<label className="horosa-guolao-select-field">
							<span>宿度制</span>
							<Select value={fields.doubingSu28.value} onChange={this.onDoubingSu28Change} size='small' dropdownMatchSelectWidth={false}>
								{SU28_MODE_GROUPS.map((g)=>(
									<OptGroup key={g.header} label={g.header}>
										{g.options.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
									</OptGroup>
								))}
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>命度</span>
							<Select value={lifeMode} onChange={this.onLifeModeChange} size='small' dropdownMatchSelectWidth={false}>
								{LIFE_MODE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								{LIFE_CUSTOM_ZHI_OPTIONS.map((o)=>(<Option key={`lc-${o.value}`} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						{chartStyle === GUOLAO_CHART_STYLE_CLASSIC ? (
							<label className="horosa-guolao-select-field">
								<span>盘式</span>
								<Select value={szshape} onChange={this.onChartShapeChange} size='small' dropdownMatchSelectWidth={false}>
									<Option value={SZConst.SZChart_Circle}>圆形盘</Option>
									<Option value={SZConst.SZChart_Square}>方形盘</Option>
								</Select>
							</label>
						) : null}
						<label className="horosa-guolao-select-field">
							<span>罗计</span>
							<Select value={nodeMode} onChange={this.onNodeModeChange} size='small' dropdownMatchSelectWidth={false}>
								<Option value={GUOLAO_NODE_MODE_NORTH_RAHU}>北罗南计</Option>
								<Option value={GUOLAO_NODE_MODE_NORTH_KETU}>北计南罗</Option>
							</Select>
						</label>
						{Number(fields.doubingSu28.value) === 4 ? (
							<label className="horosa-guolao-select-field">
								<span>恒星岁差</span>
								<Select value={(fields.guolaoAyanamsa && fields.guolaoAyanamsa.value) || ''} onChange={this.onAyanamsaChange} size='small' dropdownMatchSelectWidth={false}>
									<Option value="">郑式(默认)</Option>
									{(AstroConst.INDIA_AYANAMSA_OPTIONS || []).map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</Select>
							</label>
						) : null}
						{Number(fields.doubingSu28.value) === 6 ? (
							<label className="horosa-guolao-select-field">
								<span>推变法</span>
								<Select value={(fields.guolaoTuibianMethod && fields.guolaoTuibianMethod.value) || getStoredGuolaoTuibianMethod()} onChange={this.onTuibianMethodChange} size='small' dropdownMatchSelectWidth={false}>
									{TUIBIAN_METHOD_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</Select>
							</label>
						) : null}
						{Number(fields.doubingSu28.value) === 6 ? (
							<label className="horosa-guolao-select-field">
								<span>古宿岁差</span>
								<Select value={Number((fields.guolaoGufaPrecess && fields.guolaoGufaPrecess.value) || getStoredGuolaoGufaPrecess())} onChange={this.onGufaPrecessChange} size='small' dropdownMatchSelectWidth={false}>
									{GUFA_PRECESS_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</Select>
							</label>
						) : null}
						{Number(fields.doubingSu28.value) === 7 || Number(fields.doubingSu28.value) === 8 ? (
							<label className="horosa-guolao-select-field">
								<span>回归锚点</span>
								<Select value={(fields.guolaoEqTropicalAnchor && fields.guolaoEqTropicalAnchor.value) || getStoredGuolaoEqTropicalAnchor()} onChange={this.onEqTropicalAnchorChange} size='small' dropdownMatchSelectWidth={false}>
									{EQ_TROPICAL_ANCHOR_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</Select>
							</label>
						) : null}
						<label className="horosa-guolao-select-field">
							<span>报时星</span>
							<Select value={(fields.guolaoTrueSolarTime && fields.guolaoTrueSolarTime.value) || getStoredGuolaoTrueSolarTime()} onChange={this.onTrueSolarTimeChange} size='small' dropdownMatchSelectWidth={false}>
								{TRUE_SOLAR_TIME_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>罗计取法</span>
							<Select value={(fields.guolaoNodeType && fields.guolaoNodeType.value) || getStoredGuolaoNodeType()} onChange={this.onNodeTypeChange} size='small' dropdownMatchSelectWidth={false}>
								{NODE_TYPE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>月孛取法</span>
							<Select value={(fields.guolaoLilithType && fields.guolaoLilithType.value) || getStoredGuolaoLilithType()} onChange={this.onLilithTypeChange} size='small' dropdownMatchSelectWidth={false}>
								{LILITH_TYPE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>身宫法</span>
							<Select value={(fields.guolaoBodyMode && fields.guolaoBodyMode.value) || getStoredGuolaoBodyMode()} onChange={this.onBodyModeChange} size='small' dropdownMatchSelectWidth={false}>
								{BODY_MODE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								{BODY_CUSTOM_ZHI_OPTIONS.map((o)=>(<Option key={`bc-${o.value}`} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>命主取法</span>
							<Select value={display.lifeMasterMode || 'gong'} onChange={(v)=>this.onGuolaoDisplaySelect('lifeMasterMode', v)} size='small' dropdownMatchSelectWidth={false}>
								{LIFE_MASTER_MODE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>行运法</span>
							<Select value={display.minorLimitType || ''} onChange={(v)=>this.onGuolaoDisplaySelect('minorLimitType', v)} size='small' dropdownMatchSelectWidth={false}>
								<Option value="">古度限度法(默认)</Option>
								{MINOR_LIMIT_TYPE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						{display.minorLimitType === 'tong' ? (
							<label className="horosa-guolao-select-field">
								<span>童限基数</span>
								<Select value={display.tongxianBase || 'tong10'} onChange={(v)=>this.onGuolaoDisplaySelect('tongxianBase', v)} size='small' dropdownMatchSelectWidth={false}>
									{TONGXIAN_BASE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</Select>
							</label>
						) : null}
						<label className="horosa-guolao-select-field">
							<span>定童限</span>
							<Select value={Number(display.limitChildBase) === 10 ? 10 : 9} onChange={(v)=>this.onGuolaoDisplaySelect('limitChildBase', v)} size='small' dropdownMatchSelectWidth={false}>
								<Option value={9}>九年起(默认)</Option>
								<Option value={10}>十年起</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>大限年界</span>
							<Select value={display.limitYearBoundary || 'gregorian'} onChange={(v)=>this.onGuolaoDisplaySelect('limitYearBoundary', v)} size='small' dropdownMatchSelectWidth={false}>
								<Option value="gregorian">公历元旦(Moira默认)</Option>
								<Option value="lichun">立春起</Option>
								<Option value="dongzhi">冬至起</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>流派预设</span>
							<Select value={this.schoolPresetValue()} onChange={(v)=>{ if(v !== 'custom'){ this.onSchoolPresetChange(v); } }} size='small' dropdownMatchSelectWidth={false}>
								{SCHOOL_PRESET_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						{hsysField}
					</div>
					)}
				</div>

				{engineMode !== 'kinastro' && (chartStyle === GUOLAO_CHART_STYLE_MOIRA || chartStyle === GUOLAO_CHART_STYLE_PICK) ? (
					<div className="horosa-guolao-input-section horosa-guolao-moira-transit-section">
						<div className="horosa-guolao-field-title">
							<XQIcon name="clock" />
							<span>{chartStyle === GUOLAO_CHART_STYLE_PICK ? '天星择日动盘' : 'Moira流年'}</span>
						</div>
						<SpaceTimePanel
							className="horosa-guolao-moira-transit-time"
							value={this.props.moiraTransitTime}
							timeText={this.props.moiraTransitTime ? this.props.moiraTransitTime.format('YYYY-MM-DD HH:mm:ss') : ''}
							onTimeChange={this.onMoiraTransitTimeChanged}
							showLocation={false}
							needZone={false}
						/>

					</div>
				) : null}
				{engineMode !== 'kinastro' && chartStyle === GUOLAO_CHART_STYLE_PICK ? (
					<div className="horosa-guolao-input-section">
						<div className="horosa-guolao-field-title">
							<XQIcon name="target" />
							<span>天星择日</span>
						</div>
						<div className="horosa-guolao-election-grid">
						<label className="horosa-guolao-select-field">
							<span>动盘选择</span>
							<Select value={ele.dynMode} onChange={(v)=>this.onElectionChange({ dynMode: v })} size='small' dropdownMatchSelectWidth={false}>
								<Option value="horizon">地平动盘</Option>
								<Option value="quick">黄道动盘</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>度数显示</span>
							<Select value={ele.degreeDisplay} onChange={(v)=>this.onElectionChange({ degreeDisplay: v })} size='small' dropdownMatchSelectWidth={false}>
								<Option value="mountain">二十四山</Option>
								<Option value="zodiac">十二宫</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>子正</span>
							<Select value={ele.ziZheng} onChange={(v)=>this.onElectionChange({ ziZheng: v })} size='small' dropdownMatchSelectWidth={false}>
								<Option value="true">正北</Option>
								<Option value="magnetic">磁北</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>二十四山盘</span>
							<Select value={ele.plate} onChange={(v)=>this.onElectionChange({ plate: v })} size='small' dropdownMatchSelectWidth={false}>
								<Option value="tian">天盘</Option>
								<Option value="di">地盘</Option>
								<Option value="ren">人盘</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>山五行</span>
							<Select value={ele.wuxing} onChange={(v)=>this.onElectionChange({ wuxing: v })} size='small' dropdownMatchSelectWidth={false}>
								<Option value="main">正体五行</Option>
								<Option value="combo">化合五行</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>立命时刻</span>
							<Select value={this.props.eleLifeMode || 'sunrise'} onChange={(v)=>{ if(this.props.onEleLifeModeChange){ this.props.onEleLifeModeChange(v); } }} size='small' dropdownMatchSelectWidth={false}>
								<Option value="sunrise">日出立命</Option>
								<Option value="noon">正午立命</Option>
								<Option value="sunset">日落立命</Option>
							</Select>
						</label>
						<label className="horosa-guolao-select-field">
							<span>座山度数</span>
							<InputNumber size="small" min={0} max={359.99} step={0.5} value={ele.zuoShanDeg} onChange={(v)=>this.onElectionChange({ zuoShanDeg: Number(v) || 0 })} />
						</label>
						</div>
						<div className="horosa-guolao-toggle-grid">
							<XQToggle size="small" iconName="sideSwitch" active={ele.alignNorth !== false} onClick={()=>this.onElectionChange({ alignNorth: !(ele.alignNorth !== false) })}>子正在下</XQToggle>
							<XQToggle size="small" iconName="sideSwitch" active={ele.adjNorth !== false} onClick={()=>this.onElectionChange({ adjNorth: !(ele.adjNorth !== false) })}>自动磁偏</XQToggle>
						</div>
						<label className="horosa-guolao-select-field">
							<span>磁北度数</span>
							{ele.adjNorth !== false ? (
								<span style={{fontSize: 12, color: 'var(--horosa-text-soft, #c8c0b2)'}}>
									{formatMagneticDms(this.props.electionDeclination || 0)}（WMM 自动{this.props.electionDeclOutOfRange ? '·超模型年限' : ''}）
								</span>
							) : (
								<input
									style={{width: 110, fontSize: 12, padding: '2px 6px', background: 'transparent', color: 'inherit', border: '1px solid var(--horosa-border-soft, rgba(231,189,117,0.25))', borderRadius: 4}}
									defaultValue={formatMagneticDms(ele.magShiftManual || 0)}
									placeholder="0E00'00"
									onBlur={(e)=>{ const v = parseMagneticDms(e.target.value); if(v !== null){ this.onElectionChange({ magShiftManual: v }); } }}
								/>
							)}
						</label>
					</div>
				) : null}
				{engineMode !== 'kinastro' && (chartStyle === GUOLAO_CHART_STYLE_MOIRA || chartStyle === GUOLAO_CHART_STYLE_PICK) ? (
					<div className="horosa-guolao-input-section">
						<div className="horosa-guolao-field-title">
							<XQIcon name="sliders" />
							<span>显示</span>
						</div>
						<div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8}}>
							{GUOLAO_ALL_ASPECTS.map((asp)=>{
								const on = (display.aspects || []).indexOf(asp) >= 0;
								return (
									<button
										type="button"
										key={asp}
										onClick={()=>this.toggleAspect(asp)}
										style={{
											padding: '2px 9px',
											borderRadius: 999,
											cursor: 'pointer',
											fontSize: 12,
											lineHeight: '18px',
											border: on ? '1px solid var(--horosa-astro-gold, #e7bd75)' : '1px solid var(--horosa-border-soft, rgba(231,189,117,0.2))',
											background: on ? 'var(--horosa-astro-gold, #e7bd75)' : 'transparent',
											color: on ? '#1a1712' : 'var(--horosa-text-soft, #c8c0b2)',
										}}
									>{asp}</button>
								);
							})}
						</div>
						<div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8}}>
							{MOIRA_PLANET_DEFS.map((def)=>{
								const hidden = ((display.hiddenPlanets || []).indexOf(def.label) >= 0);
								return (
									<button
										type="button"
										key={`pl-${def.label}`}
										onClick={()=>this.togglePlanetHidden(def.label)}
										title={hidden ? `显示${def.label}` : `隐藏${def.label}(连带不参与相位连线)`}
										style={{
											padding: '2px 9px',
											borderRadius: 999,
											cursor: 'pointer',
											fontSize: 12,
											lineHeight: '18px',
											border: !hidden ? '1px solid var(--horosa-astro-gold, #e7bd75)' : '1px solid var(--horosa-border-soft, rgba(231,189,117,0.2))',
											background: !hidden ? 'var(--horosa-astro-gold, #e7bd75)' : 'transparent',
											color: !hidden ? '#1a1712' : 'var(--horosa-text-soft, #c8c0b2)',
										}}
									>{def.label}</button>
								);
							})}
						</div>
						<div className="horosa-guolao-toggle-grid">
							<XQToggle size="small" iconName="sideSwitch" active={display.dignity !== false} onClick={()=>this.onDisplayToggle('dignity')}>庙旺标注</XQToggle>
								<XQToggle size="small" iconName="sideSwitch" active={display.showAspects === true} onClick={()=>this.onDisplayToggle('showAspects')}>显示相位</XQToggle>
							<XQToggle size="small" iconName="sideSwitch" active={false} onClick={()=>this.setState({ displayFilterOpen: true })}>神煞筛选</XQToggle>
							{this.props.onOpenPatternDialog ? (
								<XQToggle size="small" iconName="sideSwitch" active={false} onClick={this.props.onOpenPatternDialog}>格局档位</XQToggle>
							) : null}
						</div>
						{this.renderDisplayFilterModal(display)}
						<GuoLaoStarSectDoc />
					</div>
				) : null}
			</div>
		);
	}

}

export default GuoLaoInput;
