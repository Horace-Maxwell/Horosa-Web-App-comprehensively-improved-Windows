// 印占页 · 时间 / 地点 / 流派 / 宫制 / 岁差 / 分盘与显示口径等选项改值、持久化与回灌、卜卦参数、页签切换
// 从 IndiaChartMain.js 按职责拆出的 IndiaChartMain 方法:this 仍是 IndiaChartMain 实例,门面里 mixinMethods(IndiaChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { recordNewChartSeeds } from '../../../utils/newChartSeeds';
import moment from 'moment';
import { INDIA_TABLE_SETTINGS } from '../../../utils/indiaExtraTables';
import { convertLatToStr, convertLonToStr } from '../AstroHelper';
import { resolveGeoZone } from '../../../utils/timezone';
import { geoNameRawPatch } from '../../../utils/geoName';
import * as AstroConst from '../../../constants/AstroConst';
import { sendScopedFields } from '../../../utils/scopedFieldsSink';
import { DASHA_SEED_DEFAULT, INDIA_OPTION_FIELD_STATE_MAP, seedIndiaOptionState, VARGA_GRID_MAX, VARGA_GRID_DEFAULT } from './optionState';
import { INDIA_DEGREE_DISPLAY_DEGREE, INDIA_DEGREE_DISPLAY_FULL } from './dasha';
import { hasYogaPayload, buildJyotishParamsKey, buildDashaFieldsKey, indiaValuesToFieldPatch } from './jyotishData';
import DateTime from '../../comp/DateTime';

export const optionChangeMethods = {
	changeTab(key){		
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
			currentFractal: hook[key].fractal
		}, ()=>{
			if(this.state.hook[key] && this.state.hook[key].fun){
				this.state.hook[key].fun();
			}
			// 择日内嵌实例切本页子页签不动主页的子页签记忆
			if(this.props.dispatch && (this.props.techniqueScope || 'india') === 'india'){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: key,
					}
				});
			}	
		});
	},

	onFieldsChange(values){
		// 择日宿主内嵌:改动交给宿主的覆盖层(宿主用新 fields 调 hook 重排),不写主盘;此前宿主没传 onChange,这里改了也不生效
		if(sendScopedFields(this.props, indiaValuesToFieldPatch(values), { recompute: !(values && values.confirmed === false) })){
			return;
		}
		let flds = this.withIndiaOptionFields(this.props.fields);
		if(this.props.onChange){
			try{
				const changedFields = this.props.onChange(values);
				if(changedFields){
					flds = this.withIndiaOptionFields(changedFields);
				}
			}catch(e){
				if(typeof window !== 'undefined' && window.console){
					window.console.error(e);
				}
			}
		}
		if(!flds){
			return;
		}
		// 🔴 时间分 6 字段(年/月/日/时/分/秒)输入:弹层编辑中(confirmed===false:逐字段改/未点确定)
		// 只更新输入显示(props.onChange 已做)、不重算 → 免一次输入连算 6 次;点「确定」(confirmed:true)
		// 或非时间变更(confirmed===undefined,如选地点/流派/选项/步进器调整)才重算一次。
		if(values && values.confirmed === false){
			return;
		}
		// 🔴 复核修:withIndiaOptionFields 现在**会缓存并复用**返回对象(horosa_india_fields_memo_v1),
		// 原地 `flds.chartnum = {}` 等于往那个被 render/子组件共享的缓存对象里塞键(改前每次都是新对象,
		// 就地写无害)。改成不可变复制:内容逐字等价,且缓存对象保持只读、不被污染。
		flds = {
			...flds,
			chartnum: { value: this.state.currentFractal },
		};
		let hook = this.state.hook[this.state.currentTab];
		if(hook.fun){
			hook.fun(flds);
		}
		this.requestDashaChart(flds);
	},

	changeTime(value){
		let dt = value.time;
		this.onFieldsChange({
			tm: dt.clone(),
			confirmed: !!value.confirmed,
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
	},

	changeGeo(rec){
		let dt = this.tmHook.getValue ? this.tmHook.getValue().value : null;
		const patch = {
			lon: convertLonToStr(rec.lng),
			lat: convertLatToStr(rec.lat),
			gpsLon: rec.gpsLng,
			gpsLat: rec.gpsLat,
		};
		if(dt){
			// 选地点 → 时区自动校正(只改时区标签、保留输入的钟面时刻;手动改过时区则沿用 rec.zone)
			const ds = dt.format ? dt.format('YYYY-MM-DD') : null;
			const z = resolveGeoZone(rec, ds);
			const nd = dt.clone();
			if(z && nd.setZone){ nd.setZone(z); }
			patch.tm = nd;
			patch.ad = nd.ad;
			patch.zone = nd.zone;
		}
		Object.assign(patch, geoNameRawPatch(rec));
		this.onFieldsChange(patch);
	},

	changeIndiaDashaVariant(key, value){
		// 23 流派开关单键变更(与 INDIA_DASHA_VARIANT_SPECS 同数):合并进 map(选回默认=删键)→ 写穿 dva → 重取(键含 dashaVariants)。
		const spec = AstroConst.INDIA_DASHA_VARIANT_SPECS.find((it)=>it.key === key);
		if(!spec){ return; }
		const cur = AstroConst.normalizeIndiaDashaVariants(this.state.indiaDashaVariants);
		const next = { ...cur };
		if(value === spec.default){ delete next[key]; }
		else { next[key] = value; }
		const stateVal = Object.keys(next).length ? next : null;
		this.setState({ indiaDashaVariants: stateVal }, ()=>{
			this.persistIndiaOption({ indiaDashaVariants: stateVal });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { dashaVariants: stateVal }));
		});
	},

	changeIndiaSchool(value){
		// 流派预设包·软联动:切派写默认岁差/宫制/相位范式 + 可见 tab 子集,触发后端按新岁差/宫制重算;
		// 用户随后仍可单独改岁差/宫制(软联动)。默认 parashari = 零行为差异。
		const school = AstroConst.normalizeIndiaSchool(value);
		const def = AstroConst.getIndiaSchoolDefaults(school);
		// 择日内嵌:分宫制锁定(扫描按整宫数宫)—— 切派不带走宫制,保持锁定值;否则宫制变成该派的,控件随之当成「由存案复原」解锁
		const lockedHsys = this.props.zeriLocked && this.props.zeriLocked.indiaHsys;
		const hsys = lockedHsys ? AstroConst.normalizeIndiaHouseSystem(lockedHsys.value) : def.hsys;
		const tabs = def.tabs;
		// 切派落地主场 tab(primaryTab 优先;无则保留当前/首个)
		const nextTab = (def.primaryTab && tabs.indexOf(def.primaryTab) >= 0)
			? def.primaryTab
			: (tabs.indexOf(`${this.state.jyotishTab || '1'}`) >= 0 ? `${this.state.jyotishTab || '1'}` : tabs[0]);
		// dashaFocus ∈ 大运体系值集 → 切主 dasha 树(dashaSystem 为既有参数,非新增);否则仅供摘要/面板定位。
		const dashaFocusSystem = def.dashaFocus && AstroConst.INDIA_DASHA_SYSTEM_OPTIONS
			.some((o)=>o.value === def.dashaFocus) ? def.dashaFocus : null;
		// stale-while-revalidate:不清盘(requestDashaChart 设 dashaUpdating + lastChartObj 回退),换派算好平滑换新。
		this.setState({
			indiaSchool: school,
			indiaAspectParadigm: def.aspectParadigm,
			visibleTabKeys: tabs,
			jyotishTab: nextTab,
			indiaAyanamsaValue: def.ayanamsa,
			indiaHsysValue: hsys,
			...(dashaFocusSystem ? { dashaSystem: dashaFocusSystem, dashaExpandedKey: null, dashaExpandedAntarKey: null, dashaDrillPath: [] } : {}),
		}, ()=>{
			this.persistIndiaOption({ indiaHsys: hsys, indiaAyanamsa: def.ayanamsa, indiaSchool: school,
				...(dashaFocusSystem ? { indiaDashaSystem: dashaFocusSystem } : {}) });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaHsys: hsys,
				indiaAyanamsa: def.ayanamsa,
			}));
		});
	},

	changeHsys(value){
		const indiaHsys = AstroConst.normalizeIndiaHouseSystem(value);
		const indiaAyanamsa = this.state.indiaAyanamsaValue !== null && this.state.indiaAyanamsaValue !== undefined
			? this.state.indiaAyanamsaValue
			: (this.props.fields && this.props.fields.indiaAyanamsa ? AstroConst.normalizeIndiaAyanamsa(this.props.fields.indiaAyanamsa.value) : AstroConst.INDIA_AYANAMSA_DEFAULT);
		this.setState({
			indiaHsysValue: indiaHsys,
		}, ()=>{
			this.persistIndiaOption({ indiaHsys });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaHsys,
				indiaAyanamsa,
			}));
		});
	},

	changeIndiaAyanamsa(value){
		const indiaAyanamsa = AstroConst.normalizeIndiaAyanamsa(value);
		const indiaHsys = this.state.indiaHsysValue !== null && this.state.indiaHsysValue !== undefined
			? this.state.indiaHsysValue
			: (this.props.fields && this.props.fields.indiaHsys ? AstroConst.normalizeIndiaHouseSystem(this.props.fields.indiaHsys.value) : AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT);
		this.setState({
			indiaAyanamsaValue: indiaAyanamsa,
		}, ()=>{
			this.persistIndiaOption({ indiaAyanamsa });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaHsys,
				indiaAyanamsa,
			}));
		});
	},

	changeIndiaNodeType(value){
		const indiaNodeType = AstroConst.normalizeIndiaNodeType(value && value.target ? value.target.value : value);
		this.setState({
			indiaNodeTypeValue: indiaNodeType,
		}, ()=>{
			this.persistIndiaOption({ indiaNodeType });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaNodeType,
			}));
		});
	},

	changeIndiaTajakaYear(value){
		const raw = value && value.target ? value.target.value : value;
		const yr = parseInt(raw, 10);
		const indiaTajakaYear = Number.isNaN(yr) ? null : yr;
		this.setState({
			indiaTajakaYearValue: indiaTajakaYear,
		}, ()=>{
			this.persistIndiaOption({ indiaTajakaYear });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaTajakaYear,
			}));
		});
	},

	applyTajakaYear(){
		// 直接读输入框 DOM 当前值，避免受控 state 异步未刷新(快速输入+点击)读到旧值 → 算错年。
		const el = this._tajakaYearInputEl;
		const raw = (el && el.value !== undefined && el.value !== '') ? el.value : this.state.tajakaYearInput;
		const yr = parseInt(raw, 10);
		if(!Number.isNaN(yr) && yr > 0 && yr < 5000){
			this.changeIndiaTajakaYear(yr);
		}
	},

	// 右边栏技法用的「当前显示盘」分盘号:分盘集开启时取第一个选定分盘,否则取当前分盘(当前tab)。
	// 用户铁令:左边选了分盘集 → 右边栏只算第一个;否则随「当前分盘」走,不再恒 D1。
	effectiveFractal(){
		if(this.state.vargaSetOpen && Array.isArray(this.state.vargaSetFractals) && this.state.vargaSetFractals.length){
			return this.state.vargaSetFractals[0];
		}
		const f = parseInt(this.state.currentFractal, 10);
		return (!Number.isNaN(f) && f > 0) ? f : 1;
	},

	toggleIndiaAspect(planetId){
		// WP-A 相映:点同星取消、点他星切换、空=清。
		this.setState((s)=>({ indiaAspectSource: s.indiaAspectSource === planetId ? null : (planetId || null) }));
	},

	toggleVargaSet(){
		this.setState((s)=>({ vargaSetOpen: !s.vargaSetOpen }), ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	},

	changeVargaSetFractals(values){
		// antd 多选返回数组;裁剪到最多 4 个,保留先选先得顺序;空选回退默认。
		let arr = Array.isArray(values) ? values.map((v)=>parseInt(v, 10)).filter((v)=>!Number.isNaN(v)) : [];
		if(arr.length > VARGA_GRID_MAX){
			arr = arr.slice(0, VARGA_GRID_MAX);
		}
		if(!arr.length){
			arr = VARGA_GRID_DEFAULT.slice();
		}
		this.setState({ vargaSetFractals: arr }, ()=>{
			this.persistIndiaOption({ indiaVargaSet: arr.join(',') });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	},

	changeDegreeDisplayMode(value){
		const degreeDisplayMode = value === INDIA_DEGREE_DISPLAY_FULL
			? INDIA_DEGREE_DISPLAY_FULL
			: INDIA_DEGREE_DISPLAY_DEGREE;
		this.setState({
			degreeDisplayMode,
		});
	},

	// WP-C 星体显示文字/符号切换:纯显示,零请求(只重渲染三盘的星体标签)。
	// XQSegmented=Radio.Group,onChange 传事件 → 取 e.target.value(与 changeIndiaChartStyle 一致)。
	changeIndiaPlanetDisplayMode(value){
		const next = value && value.target ? value.target.value : value;
		this.setState({ indiaPlanetDisplayMode: AstroConst.normalizeIndiaPlanetDisplay(next) });
	},

	// WP-N 纯视觉开关:逆时针(宫格排列方向)。不进数学。(锁定水瓶为南印固有语义,死开关已移除)
	changeIndiaCounterClockwise(checked){
		this.setState({ indiaCounterClockwise: !!checked });
	},

	// horosa_india_settings_memo_v1:datetm 原来每帧 new 一个 DateTime,拿它当 prop 的
	// SpaceTimePanel 于是每帧必重渲。按「日期|时刻|时区」三元组做实例级 memo:三者任一变即重建,
	// 全同则复用同一实例(该实例只作为受控显示值下传,不由本组件写)。
	resolveDateTime(fields){
		const key = (fields && fields.date && fields.time)
			? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}|${fields.zone ? fields.zone.value : ''}`
			: '';
		if(this._datetmMemo && this._datetmMemoKey === key){
			return this._datetmMemo;
		}
		let datetm = new DateTime();
		if(key){
			datetm = datetm.parse(`${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		this._datetmMemoKey = key;
		this._datetmMemo = datetm;
		return datetm;
	},

	// horosa_india_settings_memo_v1:分盘清单只由 state.hook 的 key/fractal/txt 派生,
	// 而 hook 的这三项在构造后恒定(只有 fun 会被子盘实例回填,不进本清单)→ 算一次即可。
	// 原来每帧重建两个数组,顺带让「当前分盘」Select 的 options 每帧换引用。
	resolveSplitItems(){
		if(!this._splitItemsMemo){
			const splitItems = [];
			for(let key in this.state.hook){
				const hook = this.state.hook[key];
				if(hook.fractal === 1){
					continue;
				}
				splitItems.push({ key, ...hook });
			}
			this._splitItemsMemo = splitItems;
			this._splitOptionsMemo = [
				{ value: 'Natal', label: '命盘 D1' },
				...splitItems.map((item)=>({
					value: item.key,
					label: `${item.fractal}分盘${item.txt ? ` · ${item.txt}` : ''}`,
				})),
			];
		}
		return this._splitItemsMemo;
	},

	// WP-B 换第1宫参照:纯显示重数房号(三盘 + 星曜面板宫位),零请求、零后端、不动黄经。
	changeIndiaLagnaRef(value){
		const next = value && value.target ? value.target.value : value;
		this.setState({ indiaLagnaRef: AstroConst.normalizeIndiaLagnaRef(next) });
	},

	changeSthiraStart(v){
		if((this.state.indiaSthiraStart || 'lagna') === v){ return; }
		this.setState({ indiaSthiraStart: v });
		this.persistIndiaOption({ indiaSthiraStart: v });
		this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { indiaSthiraStart: v }));
	},

	renderSthiraStartToggle(d){
		const cur = this.state.indiaSthiraStart || 'lagna';
		const PN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土', 'North Node': '罗', 'South Node': '计', Rahu: '罗', Ketu: '计' };
		const SCN = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		return (
			<span className="horosa-india-sthira-start" style={{ marginLeft: 8, fontSize: '0.78em', fontWeight: 400 }}>
				起座：
				{[['lagna', '命宫'], ['brahma', 'Brahma']].map(([v, lbl])=>(
					<a key={v} onClick={()=>this.changeSthiraStart(v)} style={{ marginLeft: 5, cursor: 'pointer', color: cur === v ? 'var(--horosa-accent-strong)' : 'var(--horosa-text-secondary, #8a8a8a)', fontWeight: cur === v ? 600 : 400 }}>{lbl}</a>
				))}
				{d && d.startMode === 'brahma' && d.brahma ? <em style={{ marginLeft: 6, opacity: 0.75 }}>（Brahma {PN[d.brahma.planet] || d.brahma.planet}·{SCN[d.brahma.sign] || d.brahma.sign}）</em> : null}
			</span>
		);
	},

	// horosa_india_fields_memo_v1(PERF-R9 Ship 6):无 override 的调用(render 每帧一次 +
	// 每次 componentDidUpdate 一次)此前**恒新建**一个 fields 对象 → 任何下游 memo/sCU 拿它做
	// 引用比都必然失配,等于白比。这里对「无 override」路径做实例级 memo:
	//   缓存键 = 源 fields 引用 + 本方法读取的全部 state 值(逐项列全 —— 漏一项就会返回陈旧对象,
	//   那是「该更新时不更新」的正确性事故,比慢严重得多;新增读取的 state 必须同步加进 KEY)。
	// 带 override 的调用(切流派/宫制/岁差/交点/年份/起座/过运日 的即时重取)一律绕过缓存:既不读也不写,
	// 语义与改前逐字一致。
	withIndiaOptionFields(fields, optionOverrides = {}){
		if(!fields){
			return fields;
		}
		// 🔴 复核修:memo 只有**一个**槽位,而 buildIndiaPrefetchParams(步进预取/预热)会拿
		// steppedFields(另一个对象)来调本方法 —— 那会把 render 路径的槽位挤掉,下一帧 render 必然
		// 未命中 → 重新造对象 → 下游拿 fields 做引用比的 memo / sCU 每帧失配,白包。
		// 故槽位只服务「当前 props.fields」这条渲染主路径;预取/其它源一律绕过(返回新对象,内容不变)。
		const memoable = fields === this.props.fields
			&& (!optionOverrides || Object.keys(optionOverrides).length === 0);
		let memoKey = null;
		if(memoable){
			// 依赖表 = 下方实际读取的全部 state(逐项按引用比:对象值 indiaVargaVariantMap / indiaDashaVariants /
			// prashnaCast 经 setState 换新对象即失效;旧版拼字符串对对象只得 '[object Object]',故改逐项 ===)。
			// 后 9 项(年长/流派/分盘变体/大运变体/Karaka/Yuddha/年盘口径/三旗/问事)此前漏列 —— 它们的处理函数
			// 走「setState → withIndiaOptionFields(this.props.fields) 无 override」路径,漏列即取回陈旧对象(起卦/清卦
			// 无 dispatch 往返,结果整个不生效)。
			memoKey = [
				this.state.indiaHsysValue,
				this.state.indiaAyanamsaValue,
				this.state.indiaNodeTypeValue,
				this.state.indiaTajakaYearValue,
				this.state.dashaSeed,
				this.state.dashaSystem,
				this.state.indiaSthiraStart,
				this.state.indiaTransitDateValue,
				this.effectiveFractal(),
				this.state.indiaDashaYearLength,
				this.state.indiaSchool,
				this.state.indiaVargaVariantMap,
				this.state.indiaDashaVariants,
				this.state.indiaKarakaScheme,
				this.state.indiaYuddhaCriterion,
				this.state.indiaAnnualChartType,
				this.state.indiaTripatakiOn,
				this.state.prashnaCast,
			];
			const prevKey = this._optionFieldsMemoKey;
			if(this._optionFieldsMemo && this._optionFieldsMemoSrc === fields
				&& Array.isArray(prevKey) && prevKey.length === memoKey.length
				&& prevKey.every((v, i)=> v === memoKey[i])){
				return this._optionFieldsMemo;
			}
		}
		const indiaHsys = optionOverrides.indiaHsys !== undefined && optionOverrides.indiaHsys !== null
			? AstroConst.normalizeIndiaHouseSystem(optionOverrides.indiaHsys)
			: (this.state.indiaHsysValue !== null && this.state.indiaHsysValue !== undefined
			? this.state.indiaHsysValue
			: (fields.indiaHsys ? AstroConst.normalizeIndiaHouseSystem(fields.indiaHsys.value) : AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT));
		const indiaAyanamsa = optionOverrides.indiaAyanamsa !== undefined && optionOverrides.indiaAyanamsa !== null
			? AstroConst.normalizeIndiaAyanamsa(optionOverrides.indiaAyanamsa)
			: (this.state.indiaAyanamsaValue !== null && this.state.indiaAyanamsaValue !== undefined
			? this.state.indiaAyanamsaValue
			: (fields.indiaAyanamsa ? AstroConst.normalizeIndiaAyanamsa(fields.indiaAyanamsa.value) : AstroConst.INDIA_AYANAMSA_DEFAULT));
		const indiaNodeType = optionOverrides.indiaNodeType !== undefined && optionOverrides.indiaNodeType !== null
			? AstroConst.normalizeIndiaNodeType(optionOverrides.indiaNodeType)
			: (this.state.indiaNodeTypeValue !== null && this.state.indiaNodeTypeValue !== undefined
			? this.state.indiaNodeTypeValue
			: (fields.indiaNodeType ? AstroConst.normalizeIndiaNodeType(fields.indiaNodeType.value) : AstroConst.INDIA_NODE_TYPE_DEFAULT));
		const indiaTajakaYear = optionOverrides.indiaTajakaYear !== undefined
			? optionOverrides.indiaTajakaYear
			: (this.state.indiaTajakaYearValue !== null && this.state.indiaTajakaYearValue !== undefined
			? this.state.indiaTajakaYearValue
			: (fields.indiaTajakaYear ? fields.indiaTajakaYear.value : null));
		const indiaDashaSeed = optionOverrides.indiaDashaSeed !== undefined && optionOverrides.indiaDashaSeed !== null
			? optionOverrides.indiaDashaSeed
			: (this.state.dashaSeed || DASHA_SEED_DEFAULT);
		// perf：大运体系随每次 fetch 携带(同 seed 口径)→ 后端只算选中体系全三级、其余 maha-only，
		// 响应 dasha 895KB→~150KB。永远带当前 state.dashaSystem，故改时间/换选项都不会把选中体系塌成 maha-only。
		const indiaDashaSystem = optionOverrides.indiaDashaSystem !== undefined && optionOverrides.indiaDashaSystem !== null
			? optionOverrides.indiaDashaSystem
			: (this.state.dashaSystem || 'vimshottari');
		const indiaSthiraStart = optionOverrides.indiaSthiraStart !== undefined && optionOverrides.indiaSthiraStart !== null
			? optionOverrides.indiaSthiraStart
			: (this.state.indiaSthiraStart || 'lagna');
		const indiaTransitDate = optionOverrides.indiaTransitDate !== undefined
			? optionOverrides.indiaTransitDate
			: (this.state.indiaTransitDateValue !== null && this.state.indiaTransitDateValue !== undefined
			? this.state.indiaTransitDateValue
			: (fields.indiaTransitDate ? fields.indiaTransitDate.value : null));
		const optionFields = {
			...fields,
			indiaHsys: {
				...(fields.indiaHsys || { name: ['indiaHsys'] }),
				value: indiaHsys,
			},
			indiaAyanamsa: {
				...(fields.indiaAyanamsa || { name: ['indiaAyanamsa'] }),
				value: indiaAyanamsa,
			},
			indiaNodeType: {
				...(fields.indiaNodeType || { name: ['indiaNodeType'] }),
				value: indiaNodeType,
			},
			indiaTajakaYear: {
				...(fields.indiaTajakaYear || { name: ['indiaTajakaYear'] }),
				value: indiaTajakaYear,
			},
			indiaDashaSeed: {
				...(fields.indiaDashaSeed || { name: ['indiaDashaSeed'] }),
				value: indiaDashaSeed,
			},
			indiaDashaSystem: {
				...(fields.indiaDashaSystem || { name: ['indiaDashaSystem'] }),
				value: indiaDashaSystem,
			},
			indiaSthiraStart: {
				...(fields.indiaSthiraStart || { name: ['indiaSthiraStart'] }),
				value: indiaSthiraStart,
			},
			indiaTransitDate: {
				...(fields.indiaTransitDate || { name: ['indiaTransitDate'] }),
				value: indiaTransitDate,
			},
			indiaActiveFractal: {
				...(fields.indiaActiveFractal || { name: ['indiaActiveFractal'] }),
				value: this.effectiveFractal(),
			},
			// G5 年长(仅非默认下发)/ G13 年盘口径(仅 tithi 下发)/ G8 三旗 opt-in /
			// G1 问事族(prashnaCast 冻结后才有值)。缺省 undefined → 零 churn 契约。
			indiaDashaYearLength: {
				...(fields.indiaDashaYearLength || { name: ['indiaDashaYearLength'] }),
				value: this.state.indiaDashaYearLength,
			},
			indiaSchool: {
				...(fields.indiaSchool || { name: ['indiaSchool'] }),
				value: this.state.indiaSchool,
			},
			indiaVargaVariant: {
				...(fields.indiaVargaVariant || { name: ['indiaVargaVariant'] }),
				value: Object.keys(this.state.indiaVargaVariantMap || {}).length
					? JSON.stringify(this.state.indiaVargaVariantMap) : undefined,
			},
			// 流派 23 开关:此前不注入且不读 overrides → 处理函数里那次请求键不变早退,只能靠 dispatch 往返生效;
			// 无 dispatch 宿主(印度择日)22 项全死。与其它键同形注入(overrides > state > fields)。
			indiaDashaVariants: {
				...(fields.indiaDashaVariants || { name: ['indiaDashaVariants'] }),
				value: (optionOverrides.dashaVariants !== undefined && optionOverrides.dashaVariants !== null)
					? optionOverrides.dashaVariants
					: ((this.state.indiaDashaVariants !== null && this.state.indiaDashaVariants !== undefined)
						? this.state.indiaDashaVariants
						: (fields.indiaDashaVariants ? fields.indiaDashaVariants.value : undefined)),
			},
			indiaKarakaScheme: {
				...(fields.indiaKarakaScheme || { name: ['indiaKarakaScheme'] }),
				value: this.state.indiaKarakaScheme,
			},
			indiaYuddhaCriterion: {
				...(fields.indiaYuddhaCriterion || { name: ['indiaYuddhaCriterion'] }),
				value: this.state.indiaYuddhaCriterion,
			},
			indiaAnnualChartType: {
				...(fields.indiaAnnualChartType || { name: ['indiaAnnualChartType'] }),
				value: this.state.indiaAnnualChartType,
			},
			indiaTripataki: {
				...(fields.indiaTripataki || { name: ['indiaTripataki'] }),
				value: this.state.indiaTripatakiOn ? 1 : undefined,
			},
			indiaPrashnaTime: {
				...(fields.indiaPrashnaTime || { name: ['indiaPrashnaTime'] }),
				value: this.state.prashnaCast ? this.state.prashnaCast.time : undefined,
			},
			indiaPrashnaNumber: {
				...(fields.indiaPrashnaNumber || { name: ['indiaPrashnaNumber'] }),
				value: this.state.prashnaCast ? this.state.prashnaCast.number : undefined,
			},
			indiaPrashnaMatter: {
				...(fields.indiaPrashnaMatter || { name: ['indiaPrashnaMatter'] }),
				value: this.state.prashnaCast ? this.state.prashnaCast.matter : undefined,
			},
			indiaPrashnaSchools: {
				...(fields.indiaPrashnaSchools || { name: ['indiaPrashnaSchools'] }),
				value: this.state.prashnaCast ? this.state.prashnaCast.schools : undefined,
			},
			indiaPrashnaCuspMode: {
				...(fields.indiaPrashnaCuspMode || { name: ['indiaPrashnaCuspMode'] }),
				value: this.state.prashnaCast ? this.state.prashnaCast.cuspMode : undefined,
			},
			indiaPrashnaPrimaryHouse: {
				...(fields.indiaPrashnaPrimaryHouse || { name: ['indiaPrashnaPrimaryHouse'] }),
				value: this.state.prashnaCast ? this.state.prashnaCast.primaryHouse : undefined,
			},
		};
		if(memoable){
			this._optionFieldsMemoSrc = fields;
			this._optionFieldsMemoKey = memoKey;
			this._optionFieldsMemo = optionFields;
		}
		return optionFields;
	},

	// ── G5/G13/G8/G1 设置变更 → 重取(与 changeDashaSystem 同范式) ──
	changeDashaYearLength(value){
		const v = AstroConst.normalizeIndiaDashaYear(value);
		this.setState({ indiaDashaYearLength: v }, ()=>{
			this.persistIndiaOption({ indiaDashaYearLength: v });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	},

	changeVargaVariant(chartnum, value){
		// W1-A:单分盘换法 → 合成映射(standard 即删键)→ 写穿持久化 + 重取全栏。
		const v = value && value.target ? value.target.value : value;
		this.setState((prev)=>{
			const next = { ...(prev.indiaVargaVariantMap || {}) };
			if(!v || v === 'standard'){ delete next[String(chartnum)]; }
			else{ next[String(chartnum)] = v; }
			return { indiaVargaVariantMap: AstroConst.normalizeIndiaVargaVariantMap(next) };
		}, ()=>{
			const map = this.state.indiaVargaVariantMap;
			this.persistIndiaOption({ indiaVargaVariant: Object.keys(map).length ? JSON.stringify(map) : null });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	},

	changeKarakaScheme(value){
		const v = AstroConst.normalizeIndiaKarakaScheme(value && value.target ? value.target.value : value);
		this.setState({ indiaKarakaScheme: v }, ()=>{
			this.persistIndiaOption({ indiaKarakaScheme: v });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	},

	changeYuddhaCriterion(value){
		const v = AstroConst.normalizeIndiaYuddhaCriterion(value && value.target ? value.target.value : value);
		this.setState({ indiaYuddhaCriterion: v }, ()=>{
			this.persistIndiaOption({ indiaYuddhaCriterion: v });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	},

	changeNakshatraCount(value){
		// 🔴 纯显示口径:不发请求、不进缓存键(28 宿编号 number28 引擎恒出,前端只切显示);亲手改 = 跨会话保留
		const count = AstroConst.normalizeIndiaNakshatraCount(value && value.target ? value.target.value : value);
		INDIA_TABLE_SETTINGS.save({ indiaNakshatraCount: count });
		this.setState({ indiaNakshatraCount: count });
	},

	changeAnnualChartType(value){
		const v = AstroConst.normalizeIndiaAnnualChartType(value && value.target ? value.target.value : value);
		this.setState({ indiaAnnualChartType: v }, ()=>{
			this.persistIndiaOption({ indiaAnnualChartType: v });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	},

	changeStageMode(value){
		const mode = AstroConst.normalizeIndiaStageMode(value);
		INDIA_TABLE_SETTINGS.save({ indiaStageMode: mode });   // 亲手改 = 跨会话保留
		// 左栏为三旗盘唯一入口:选中即 opt-in 计算(12 次逐月过运)并重取,免去右栏二次开启。
		if(mode === 'tripataki' && !this.state.indiaTripatakiOn){
			this.setState({ indiaStageMode: mode, indiaTripatakiOn: true }, ()=>{
				this.persistIndiaOption({ indiaTripataki: true });
				this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { tripataki: true }));
			});
			return;
		}
		this.setState({ indiaStageMode: mode });
	},

	castPrashna(){
		// 🔴「起卦」唯一入口:此刻一次性冻结为字符串(绝不 render 取 now → 缓存键秒变)
		const cast = {
			time: moment().format('YYYY/MM/DD HH:mm:ss'),
			number: Math.min(249, Math.max(1, Number(this.state.prashnaNumberInput) || 1)),
			matter: this.state.prashnaMatterInput,
			schools: (this.state.prashnaSchoolsInput || ['kp']).join(','),
			cuspMode: this.state.prashnaCuspModeInput,
			primaryHouse: this.state.prashnaPrimaryHouseInput || undefined,
		};
		this.setState({ prashnaCast: cast }, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	},

	clearPrashna(){
		this.setState({ prashnaCast: null }, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	},

	persistIndiaOption(patch){
		// 选项写穿 dva fields(存盘四本账第一公里)。patch={fieldKey: rawValue};
		// 新建 fields 对象与新 entry(勿就地改共享 entry —— astro 模型 :1144 老坑)。
		if(!this.props.dispatch || !patch){ return; }
		// 择日里内嵌的这份(techniqueScope ≠ india):选项只改本盘(本组件 state 已经换了、请求也按它发),
		// 不记新盘缺省、也不写主盘字段 —— 此前用 astro/save 把择日自造的整包字段写进了主盘(名字变「印度择日」、cid 丢失)
		if((this.props.techniqueScope || 'india') !== 'india'){
			// 选项交给宿主覆盖层(宿主重渲染时 fields 带上你的选择;此前只留在本组件 state,宿主一重渲染就按工作台值冲回)
			const fieldPatch = {};
			Object.keys(patch).forEach((k)=>{ fieldPatch[k] = { value: patch[k] }; });
			sendScopedFields(this.props, fieldPatch, { recompute: false });
			return;
		}
		// 「新盘种子」:本入口只由用户 handler 调(载盘回种走 adoptIndiaOptionFields → setState),故凡经此写的选项 = 亲手改;
		// 大运流月 / 年盘年份 / 三旗 / 问事这类逐盘输入不在种子表,recordNewChartSeeds 自动忽略
		recordNewChartSeeds(patch);
		const cur = this.props.fields || {};
		const fields = { ...cur };
		let touched = false;
		Object.keys(patch).forEach((k)=>{
			const v = patch[k];
			const prev = cur[k] ? cur[k].value : undefined;
			if(prev === v){ return; }
			fields[k] = { ...(cur[k] || { name: [k] }), value: v };
			touched = true;
		});
		if(!touched){ return; }
		this.props.dispatch({ type: 'astro/saveUserFields', payload: { fields } });
	},

	adoptIndiaOptionFields(prevProps){
		// 载盘(fields 引用换新且带 india 设置)→ 以 fields 为真相回种 state。
		// 收敛性:handler → setState+persist → fields 与 state 等值 → 本函数 no-op;
		// 只有外部载入(记录还原)才产生差值 → 采纳一次即稳定。
		if(!prevProps || this.props.fields === prevProps.fields){ return false; }
		const patch = seedIndiaOptionState(this.props.fields);
		// 记录身份变了(载入命盘 / 事盘,或「新命盘」):fields 里**缺席**的映射键也要采纳 —— 缺席 = 记录里没有 = 存档时为默认
		// (schema 本没有的印占键在载入记录时会被撤掉);此前缺席一律不动 state,组件就留着上一张盘 / 新盘种子的值,
		// 页面所见 ≠ 存档 / AI 无头复算(行为普查实抓:载入记录后「流派与算法」各项仍读出种子值)。
		// 只按 cid 变化触发:同一记录内的时间 / 地点改动、择日宿主重建 fields(无 cid)都不重置在页内改过的选项。
		const cidOf = (f)=>(f && f.cid && f.cid.value !== undefined && f.cid.value !== null ? `${f.cid.value}` : '');
		if(cidOf(this.props.fields) !== cidOf(prevProps.fields) && this._indiaOptionStateDefaults){
			INDIA_OPTION_FIELD_STATE_MAP.forEach(({ field, state })=>{
				if(Object.prototype.hasOwnProperty.call(patch, state)){ return; }
				const entry = this.props.fields ? this.props.fields[field] : undefined;
				if(entry && entry.value !== undefined && entry.value !== null && entry.value !== ''){ return; }
				const d = this._indiaOptionStateDefaults[state];
				patch[state] = Array.isArray(d) ? d.slice() : (d && typeof d === 'object' ? { ...d } : d);
			});
		}
		const diff = {};
		Object.keys(patch).forEach((k)=>{
			const cur = this.state[k];
			const nxt = patch[k];
			const same = Array.isArray(nxt)
				? (Array.isArray(cur) && cur.join(',') === nxt.join(','))
				: (nxt && typeof nxt === 'object')
					? JSON.stringify(cur || {}) === JSON.stringify(nxt)
					: String(cur) === String(nxt);
			if(!same){ diff[k] = nxt; }
		});
		if(!Object.keys(diff).length){ return false; }
		if(diff.indiaSchool){
			// 载盘换派 → 应用该派派生(可见 tab 集/相位范式/主场 tab);
			// 岁差/宫制等用户覆盖值由各自字段另行采纳(fields 为真相),互不冲突。
			const def = AstroConst.getIndiaSchoolDefaults(diff.indiaSchool) || {};
			if(Array.isArray(def.tabs) && def.tabs.length){
				diff.visibleTabKeys = def.tabs;
				diff.jyotishTab = (def.primaryTab && def.tabs.indexOf(def.primaryTab) >= 0) ? def.primaryTab : def.tabs[0];
			}
			if(def.aspectParadigm){ diff.indiaAspectParadigm = def.aspectParadigm; }
		}
		this.setState(diff);
		return true;
	},

	updatePrashnaParam(inputPatch, castPatch){
		// 问时(time)与问数(number)是问事行为本身、冻结不可改;事项/宫始定法/主判宫/流派
		// 是占者的事后归类 → 已起卦时原地更新 cast(保 time+number)并重取,不必重冻时刻。
		this.setState((prev)=>({
			...inputPatch,
			prashnaCast: prev.prashnaCast ? { ...prev.prashnaCast, ...castPatch } : prev.prashnaCast,
		}), ()=>{
			if(this.state.prashnaCast){
				this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
			}
		});
	},

	changeIndiaChartStyle(value){
		const indiaChartStyle = AstroConst.normalizeIndiaChartStyle(value && value.target ? value.target.value : value);
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload: {
					indiaChartStyle,
				},
			});
		}
	},

	changeJyotishTab(key){
		this.setState({
			jyotishTab: key,
		});
	},

	handleMainChartLoad(chartObj, params){
		const mainChartKey = buildJyotishParamsKey(params);
		const activeKey = this.state.activeJyotishKey || buildDashaFieldsKey(this.withIndiaOptionFields(this.props.fields));
		if(activeKey && mainChartKey && mainChartKey !== activeKey){
			return;
		}
		this.setState({
			mainChartObj: chartObj || null,
			mainChartKey,
			dashaLoading: mainChartKey && mainChartKey === activeKey && hasYogaPayload(chartObj) ? false : this.state.dashaLoading,
		});
	},
};
