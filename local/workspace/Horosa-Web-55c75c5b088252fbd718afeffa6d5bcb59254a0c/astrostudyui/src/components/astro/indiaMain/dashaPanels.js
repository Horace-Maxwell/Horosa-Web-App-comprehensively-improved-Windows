// 印占页 · 大运:取盘、体系 / 起运 / 流时改值、逐层下钻与面包屑、星座大运卡、风险因素、大运面板与浮层
// 从 IndiaChartMain.js 按职责拆出的 IndiaChartMain 方法:this 仍是 IndiaChartMain 实例,门面里 mixinMethods(IndiaChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { trimDecimals } from '../../../utils/displayPrecision';
import { fixedPopupFrame } from '../../../utils/zoomDomain';
import { createPortal } from 'react-dom';
import moment from 'moment';
import { fieldsToParams, requestIndiaChartData } from '../IndiaChart';
import * as AstroConst from '../../../constants/AstroConst';
import { XQSelect as Select, XQCheckbox } from '../../xq-ui';
import { XQCurrentMark } from '../../xq-icons';
import { natalSourceKey, pickKeyedDerived } from '../../../utils/derivedChartSource';
import { DASHA_SYSTEM_OPTIONS, DASHA_CONDITIONAL_KEYS, DASHA_JAIMINI_KEYS, DASHA_SYSTEM_LABEL, DASHA_SEED_DEFAULT, DASHA_SEED_OPTIONS, DASHA_SEED_LABEL } from './optionState';
import { DASHA_YEAR_DAYS, currentDashaYearDays, syncDashaYearDays, buildBirthMoment, addDashaYears, formatDuration, formatAge, deriveDashaSequence, buildDashaSubPeriods, normalizeDashaLord, DASHA_LEVEL_LABELS, DASHA_MAX_LEVEL, dashaContainsNow, buildVimshottariDasha, dashaMoment } from './dasha';
import { getJyotish, hasJyotishPayload, formatJyotishDate, formatJyotishDateTime, formatDurationFine, cloneIndiaFieldsForJyotish, resolveJyotishChartObj, hasUsableJyotishChart, buildDashaFieldsKey, canBuildIndiaChartParams, jyotishPartialNotice, isDashaPartialName } from './jyotishData';
import { markPanelReady } from '../../../utils/perfMark';
const {Option, OptGroup} = Select;

export const dashaPanelMethods = {
	async requestDashaChart(fields){
		const sourceFields = fields || this.props.fields;
		if(!canBuildIndiaChartParams(sourceFields)){
			return;
		}
		const jyotishFields = cloneIndiaFieldsForJyotish(sourceFields);
		const dashaFieldsKey = buildDashaFieldsKey(jyotishFields);
		const alreadyHasData = hasUsableJyotishChart(this.state, dashaFieldsKey);
		if(!dashaFieldsKey || (dashaFieldsKey === this.lastDashaRequestKey && (this.state.dashaLoading || alreadyHasData))){
			if(dashaFieldsKey && alreadyHasData){ this._plottedMainFields = sourceFields; }   // 同键早退:所见仍是按这份排的
			if(dashaFieldsKey && dashaFieldsKey !== this.state.activeJyotishKey){
				this.setState({
					activeJyotishFields: jyotishFields,
					activeJyotishKey: dashaFieldsKey,
				}, ()=>{
					// horosa_panel_ready_v1:命中「已有可用盘」的短路分支 —— 本次交互不再发请求,
					// 这一次 setState(切换 activeJyotishFields → 中盘 + 右栏 Jyotish 面板同批重画)
					// 就是面板落定的最后一次。不接在这里,缓存命中的那些交互(切分盘/回切旧参数)
					// 会永远量不到 panel-ready(markPanelReady 自身按 generation 去重,多点接入安全)。
					// 🔴 复核修:本分支还有第二条进入路径 —— 同键请求**在途**(dashaLoading)。那时盘面
					// 还是旧的、新数据没到,标 ready 是伪造的早点(且会吃掉 stepT0,让真正落定的那次
					// 变成 no-op → 系统性低估印占耗时)。故只在「确有可用盘」时才标;在途那次不标,
					// 等 1836 的真落定点标,样本不丢。
					if(alreadyHasData){
						markPanelReady('indiachart');
					}
				});
			}
			return;
		}
		this.lastDashaRequestKey = dashaFieldsKey;
		let params = null;
		try{
			params = fieldsToParams(jyotishFields);
			// 右边栏技法按「当前显示盘」算:分盘集取第一个分盘,否则取当前分盘;不再恒 D1。
			params.chartnum = (jyotishFields.indiaActiveFractal && jyotishFields.indiaActiveFractal.value) || 1;
		}catch(e){
			this.lastDashaRequestKey = '';
			return;
		}
		// stale-while-revalidate:不清旧盘(dashaChartObj/mainChartObj 保留)、不设满屏 dashaLoading——
		// 切换/重取期间面板由 resolveJyotishChartObj 回退到 lastChartObj 显上次成功盘 + 角标「更新中…」。
		// 仅首次加载(无 lastChartObj)才 dashaLoading:true,保留首屏「计算中」提示。
		// 回退盘只许是同一位命主的(只改设置 → 旧盘留存 + 更新中;换了人 → 不拿上一位命主的盘顶着)
		const activeNatalSig = natalSourceKey(params);
		const keepLast = pickKeyedDerived(this.state.lastChartObj, this.state.lastChartObjSig, activeNatalSig);
		this.setState({
			dashaLoading: keepLast ? false : true,
			dashaUpdating: true,
			activeNatalSig,
			dashaFieldsKey,
			mainChartObj: this.state.mainChartKey === dashaFieldsKey ? this.state.mainChartObj : null,
			mainChartKey: this.state.mainChartKey === dashaFieldsKey ? this.state.mainChartKey : '',
			activeJyotishFields: jyotishFields,
			activeJyotishKey: dashaFieldsKey,
		});
		try{
			const dashaChartObj = await requestIndiaChartData(params);
			if(!this._mounted) return;
			if(this.state.dashaFieldsKey === dashaFieldsKey){
				// 默认视图上屏的就是这份主盘:记下实际所用的 fields(择日宿主存案取所见那张盘;分盘组网格打开时取当前分盘格)
				if(dashaChartObj){ this._plottedMainFields = sourceFields; }
				this.setState({
					dashaChartObj,
					dashaChartKey: dashaFieldsKey,
					mainChartObj: dashaChartObj || null,
					mainChartKey: dashaFieldsKey,
					// 成功盘存为 lastChartObj(下次切换的回退源);仅有效盘才更新,空结果不覆盖旧盘。
					...(hasJyotishPayload(dashaChartObj) ? { lastChartObj: dashaChartObj, lastChartObjSig: activeNatalSig } : {}),
					dashaLoading: false,
					dashaUpdating: false,
				}, ()=>{
					// horosa_panel_ready_v1:印占面板落定的**唯一**权威点 —— 中盘(mainChartObj)与
					// 右栏全部 Jyotish 技法(大运/五支/星曜/八分/Yoga…)吃的都是这同一个 dashaChartObj,
					// 一次 setState 同批落地。请求发出(1475 的 dashaUpdating:true)不是落定,失败分支
					// (下面 catch)也不是 —— 那次只收 loading 角标、盘面仍是上一次的旧盘,不代表新数据画完。
					markPanelReady('indiachart');
				});
			}
		}catch(e){
			if(!this._mounted) return;
			if(this.state.dashaFieldsKey === dashaFieldsKey){
				// 失败不清旧盘:保留 lastChartObj 兜底,面板仍显上次成功盘;仅收起 updating/loading。
				this.setState({
					dashaLoading: false,
					dashaUpdating: false,
				});
			}
		}
	},

	showDashaSubPopover(item, e){
		if(typeof window === 'undefined' || !e || !e.currentTarget || !e.currentTarget.getBoundingClientRect){
			return;
		}
		// 浮动子面板是 position:fixed:锚点 rect(视觉域)先换到布局域,再与布局视口 / 面板宽(CSS 尺寸)同域比较;z=1 时逐值不变。
		const frame = fixedPopupFrame();
		const rect = frame.rect(e.currentTarget.getBoundingClientRect());
		const margin = 12;
		const panelWidth = Math.min(380, Math.max(300, frame.viewportWidth - margin * 2));
		let left = rect.left - panelWidth - margin;
		if(left < margin){
			left = rect.right + margin;
		}
		if(left + panelWidth > frame.viewportWidth - margin){
			left = Math.max(margin, frame.viewportWidth - panelWidth - margin);
		}
		const top = Math.max(88, Math.min(frame.viewportHeight - 88, rect.top + rect.height / 2));
		this.setState({
			dashaPopoverItem: item,
			dashaPopoverStyle: {
				left,
				top,
				width: panelWidth,
			},
		});
	},

	hideDashaSubPopover(){
		this.setState({
			dashaPopoverItem: null,
			dashaPopoverStyle: null,
		});
	},

	renderRasiDashaCards(fields){
		// 座位大运(rasi dasha)全家族:时间轴化(自出生累加·今日金色高亮·全段不截断);
		// Narayana + 既有 10 系 + 新增 Chakra/Trikona/Navamsa/Varnada + Paryaya 二轮。
		const SIGN_CN = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		const sc = (s)=>SIGN_CN[s] || s || '—';
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const rd = jyotish ? jyotish.rasiDasha : null;
		const nar = rd && rd.narayana;
		if(!rd && !(nar && nar.mahadashas)){ return null; }
		const birth = buildBirthMoment(fields);
		const yearDays = currentDashaYearDays();
		const nowAge = (birth && birth.diff) ? moment().diff(birth, 'days', true) / yearDays : null;
		const renderRows = (list, keyPrefix, opts = {})=>{
			let cum = opts.startOffsetYears || 0;   // Kalachakra 整轮序列:出生落中段 → 轴自 −已过年起
			return (list || []).map((m, i)=>{
				const years = (typeof m.years === 'number') ? m.years : parseFloat(m.years) || 0;
				const startAge = cum;
				cum += years;
				const active = nowAge !== null && nowAge >= startAge && nowAge < cum;
				const startYear = (birth && birth.clone) ? addDashaYears(birth, startAge) : null;
				const endYear = (birth && birth.clone) ? addDashaYears(birth, cum) : null;
				return (
					<div className={`horosa-india-data-row${active ? ' is-dasha-active' : ''}`} key={`${keyPrefix}_${i}`}>
						<strong>{sc(m.rasi)}{m.cycle === 2 ? <em className="horosa-india-cycle-tag">二轮</em> : null}{m.gatiCN ? <em className="horosa-india-gati-tag">{m.gatiCN}</em> : null}</strong>
						<span>{years % 1 === 0 ? years.toFixed(0) : years.toFixed(1)} 年{startYear && endYear ? ` · ${startYear.format('YYYY')}-${endYear.format('YYYY')}` : ''}</span>
						<em>{active ? '当前' : (m.deity || (opts.showLord ? m.lord : '') || '')}</em>
					</div>
				);
			});
		};
		const DEFS = [
			{ key: 'lagnaKendradi', label: 'Lagna Kendrādi 大运' },
			{ key: 'sudasa', label: 'Sudaśā（Sree Lagna）' },
			{ key: 'drigdasa', label: 'Dṛg 大运' },
			{ key: 'shoola', label: 'Śūla 大运' },
			{ key: 'niryanaShoola', label: 'Niryāṇa Śūla 大运' },
			{ key: 'kalachakra', label: 'Kālachakra 大运' },
			{ key: 'taraLagna', label: 'Tāra Lagna 大运（均匀 9 年/座 · 108）' },
			{ key: 'sthira', label: 'Sthira 固定座运（动7/固8/变9 · 96）' },
			{ key: 'yogardha', label: 'Yogārdha 平均座运（(Sthira+Narayana)/2）' },
			{ key: 'manduka', label: 'Maṇḍūka 蛙跳座运（kendra +3 · 7/8/9 · 96）' },
			{ key: 'chakra', label: 'Chakra 座运（恒 10 年/座 · 顺行 · 120）', showLord: true },
			{ key: 'trikona', label: 'Trikoṇa 三角座运（三联组 · 组内强度序）' },
			{ key: 'navamsaDasha', label: 'Navāṁśa 座运（D-9 上跑 Narayana）' },
			{ key: 'varnada', label: 'Varṇada 座运（VL 起 · 数到座主）' },
		];
		const paryaya = rd && rd.paryaya;
		return (
			<>
				{nar && Array.isArray(nar.mahadashas) && nar.mahadashas.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Narayana 座位大运（种子 {sc(nar.seed)}{nar.deity ? ` · ${nar.deity}` : ''}）</div>
						<div className="horosa-india-data-list horosa-india-rasi-scroll">
							{renderRows(nar.mahadashas, 'nar')}
						</div>
					</div>
				) : null}
				{rd ? DEFS.map((def)=>{
					const d = rd[def.key];
					if(!d || d.available === false || !Array.isArray(d.mahadashas) || !d.mahadashas.length){ return null; }
					return (
						<div className="horosa-info-card" key={def.key}>
							<div className="horosa-info-card-title">{def.label}{d.deha ? `（Deha ${sc(d.deha)} · Jiva ${sc(d.jeeva || d.jiva)}）` : ''}{def.key === 'sthira' ? this.renderSthiraStartToggle(d) : null}</div>
							{def.key === 'kalachakra' && d.applicability ? (
								<div className="horosa-india-card-note">{/* 适用条件显示 */}适用性：{d.applicability.applicable === true ? '主用' : (d.applicability.applicable === false ? '备览(月亮 navamsa 座不强于 rasi 座)' : '判据不足')}</div>
							) : null}
							{def.key === 'kalachakra' && (d.paramayush || d.cycleMethod) ? (
								<div className="horosa-india-card-note">paramāyus {d.paramayush} 年{d.startRasi ? ` · 起 ${sc(d.startRasi)}(余 ${trimDecimals(d.startBalanceYears)} 年)` : ''}{d.nextCycle ? ` · 轮终换接:${d.nextCycle.nakshatra} 第${d.nextCycle.pada}pada` : ''}</div>
							) : null}
							<div className="horosa-india-data-list horosa-india-rasi-scroll">
								{renderRows(d.mahadashas, def.key, { showLord: !!def.showLord,
									startOffsetYears: def.key === 'kalachakra' && typeof d.elapsedYears === 'number' ? -d.elapsedYears : 0 })}
							</div>
						</div>
					);
				}) : null}
				{paryaya && paryaya.charaParyaya && paryaya.charaParyaya.available ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Chara Paryāya 二轮（Sampat · 12−首轮）</div>
						<div className="horosa-india-data-list horosa-india-rasi-scroll">
							{renderRows(paryaya.charaParyaya.mahadashas, 'cpar')}
						</div>
					</div>
				) : (paryaya && paryaya.charaParyaya && paryaya.charaParyaya.reason === 'trikona_unoccupied' ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Chara Paryāya 二轮</div>
						<div className="horosa-india-card-note">自上升三角(1/5/9)无行星 → 本盘 Chara Paryāya 废(注疏规则)</div>
					</div>
				) : null)}
				{paryaya && paryaya.sthiraParyaya && paryaya.sthiraParyaya.available ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Sthira Paryāya 二轮（起 {sc(paryaya.sthiraParyaya.seed)}）</div>
						<div className="horosa-india-data-list horosa-india-rasi-scroll">
							{renderRows(paryaya.sthiraParyaya.mahadashas, 'spar')}
						</div>
					</div>
				) : null}
			</>
		);
	},

	changeDashaSystem(value){
		const v = value && value.target ? value.target.value : value;
		// 换大运体系 = 后端只算选中体系全三级(其余 maha-only)→ requestDashaChart 重取(dashaSystem 进缓存键)。
		// stale-while-revalidate:不清盘/不进满屏 loading(由 requestDashaChart 设 dashaUpdating + lastChartObj 回退);
		// 仅收起展开 + 清钻取路径,免视觉残留/索引错位。算好后平滑换新盘。
		this.setState({
			dashaSystem: v,
			dashaExpandedKey: null,
			dashaExpandedAntarKey: null,
			dashaDrillPath: [],
		}, ()=>{
			this.persistIndiaOption({ indiaDashaSystem: v });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { indiaDashaSystem: v }));
		});
	},

	changeDashaSeed(value){
		// 换起运点 = 后端按该点 D1 黄经重算全体系大运 → requestDashaChart 重取(同 nodeType/ayanamsa 口径)。
		const v = (value && value.target ? value.target.value : value) || DASHA_SEED_DEFAULT;
		// stale-while-revalidate:不清盘/不进满屏 loading(由 requestDashaChart 设 dashaUpdating + lastChartObj 回退);
		// 切换期短暂显上次成功盘 + 「更新中…」角标(用户取舍:宁要旧盘留存不要满屏加载框),算好平滑换新。
		this.setState({
			dashaSeed: v,
			dashaExpandedKey: null,
			dashaExpandedAntarKey: null,
			dashaDrillPath: [],
		}, ()=>{
			this.persistIndiaOption({ indiaDashaSeed: v });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { indiaDashaSeed: v }));
		});
	},

	changeTransitDate(value){
		// 换过运日期 = 后端按该日重算 gochara → requestDashaChart 重取(transitDate 进缓存键)。value=moment|null(null=回今日)。
		// stale-while-revalidate:不清盘/不进满屏 loading(由 requestDashaChart 设 dashaUpdating + lastChartObj 回退),算好平滑换新。
		const v = value && value.format ? value.format('YYYY/MM/DD') : null;
		this.setState({
			indiaTransitDateValue: v,
		}, ()=>{
			this.persistIndiaOption({ indiaTransitDate: v });
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { indiaTransitDate: v }));
		});
	},

	toggleDashaExpanded(key){
		this.setState((s)=>({
			dashaExpandedKey: s.dashaExpandedKey === key ? null : key,
			dashaExpandedAntarKey: null,
		}));
	},

	toggleDashaAntarExpanded(key){
		this.setState((s)=>({ dashaExpandedAntarKey: s.dashaExpandedAntarKey === key ? null : key }));
	},

	// WP-D 钻入下一级(追加该段索引,最深 4 → 第5级息运)。
	drillDasha(idx){
		this.setState((s)=>{
			const path = Array.isArray(s.dashaDrillPath) ? s.dashaDrillPath : [];
			if(path.length >= DASHA_MAX_LEVEL - 1){
				return null;
			}
			return { dashaDrillPath: path.concat([idx]) };
		});
	},

	// WP-D 面包屑回溯到第 level 级(path 截断到该长度)。
	dashaBreadcrumbTo(level){
		this.setState((s)=>{
			const path = Array.isArray(s.dashaDrillPath) ? s.dashaDrillPath : [];
			return { dashaDrillPath: path.slice(0, level) };
		});
	},

	// WP-D 大运 5 级钻取视图:面包屑 + 当前级列表;点段钻入,各级含今日金色高亮 +「当前」徽标。
	renderDashaDrillView(dasha){
		let path = Array.isArray(this.state.dashaDrillPath) ? this.state.dashaDrillPath.slice() : [];
		let list = Array.isArray(dasha.items) ? dasha.items : [];
		const seqCtx = deriveDashaSequence(list);   // 体系自身环(4/5 级深钻用;修「非 Vimshottari 深级失真/缺段」)
		const crumbs = [];
		for(let i = 0; i < path.length; i++){
			const sel = list[path[i]];
			if(!sel){ // 索引对不上当前 dasha(换盘/换体系)→ 截断回退,不崩
				path = path.slice(0, i);
				break;
			}
			crumbs.push(sel);
			list = buildDashaSubPeriods(sel, this.state.dashaSystem || 'vimshottari', seqCtx);
		}
		const level = crumbs.length; // 0=大运 … 4=息运
		const levelInfo = DASHA_LEVEL_LABELS[Math.min(level, DASHA_MAX_LEVEL - 1)];
		const canDrill = level < DASHA_MAX_LEVEL - 1;
		// 微运(level 3)+ 息运(level 4)极短 → 日期精确到时:分 + 细粒度时长(天/时/分),不再多段同日。
		const fineTime = level >= 3;
		return (
			<div className="horosa-india-dasha-drill">
				<div className="horosa-india-dasha-crumbs">
					<button
						type="button"
						className={`horosa-india-dasha-crumb${level === 0 ? ' is-current' : ''}`}
						onClick={()=>this.dashaBreadcrumbTo(0)}
					>{DASHA_LEVEL_LABELS[0].cn}</button>
					{crumbs.map((c, k)=>(
						<span className="horosa-india-dasha-crumb-seg" key={`crumb_${k}`}>
							<span className="horosa-india-dasha-crumb-sep" aria-hidden="true">›</span>
							<button
								type="button"
								className={`horosa-india-dasha-crumb${level === k + 1 ? ' is-current' : ''}`}
								onClick={()=>this.dashaBreadcrumbTo(k + 1)}
							>
								<strong>{c.lord.label}</strong>
								<em>{DASHA_LEVEL_LABELS[k + 1] ? DASHA_LEVEL_LABELS[k + 1].cn : ''}</em>
							</button>
						</span>
					))}
				</div>
				<div className="horosa-india-dasha-drill-head">
					<span>{levelInfo.cn} · {levelInfo.en}</span>
					<em>{list.length} 段{canDrill ? ' · 点击钻入下一级' : ' · 已到最细级'}</em>
				</div>
				<div className="horosa-india-dasha-drill-list">
					{list.map((item, idx)=>{
						const cur = !!(item.active || dashaContainsNow(item));
						const hasAge = typeof item.startAge === 'number' && typeof item.endAge === 'number';
						return (
							<button
								type="button"
								key={`${item.lord.key}_${idx}`}
								className={`horosa-india-dasha-drill-row${cur ? ' is-current' : ''}${canDrill ? ' is-drillable' : ''}`}
								onClick={()=>canDrill && this.drillDasha(idx)}
								disabled={!canDrill}
							>
								<span className="horosa-india-dasha-drill-lord">
									<strong>{item.lord.label}</strong>
									<em>{item.lord.en}</em>
									{cur ? <span className="horosa-india-dasha-cur-badge">当前</span> : null}
								</span>
								<span className="horosa-india-dasha-drill-meta">
									<span>{fineTime ? `${formatJyotishDateTime(item.start)} - ${formatJyotishDateTime(item.end)}` : `${formatJyotishDate(item.start)} - ${formatJyotishDate(item.end)}`}</span>
									<em>{fineTime ? formatDurationFine(item.years) : formatDuration(item.years)}{hasAge ? ` · ${formatAge(item.startAge)}-${formatAge(item.endAge)}` : ''}</em>
								</span>
								{canDrill ? <span className="horosa-india-dasha-drill-chev" aria-hidden="true">▸</span> : null}
							</button>
						);
					})}
				</div>
			</div>
		);
	},

	// 实例级 memoize:buildVimshottariDasha(chara/conditional 走 JS 递归)随每次 render(含 hover/popover/钻取等无关
	// state 变更)重跑。签名 = dashaChartObj 引用 + 体系 + 起点;三者不变即复用上轮结果(钻取/今日高亮在缓存的 dasha
	// 上派生,零回归)。seed 实际经后端换盘 → dashaChartObj 引用已变,这里入键属防御性冗余。
	getMemoizedDasha(dashaChartObj, fields, system, seed){
		const cache = this._dashaMemo;
		if(cache && cache.chartObj === dashaChartObj && cache.system === system && cache.seed === seed && cache.fields === fields){
			return cache.dasha;
		}
		const dasha = buildVimshottariDasha(dashaChartObj, fields, system);
		this._dashaMemo = { chartObj: dashaChartObj, system, seed, fields, dasha };
		return dasha;
	},

	// 后端实际所用年长(G5):从大运块读回,防前后端各持一份导致 5 级钻取客户端自算段错位。
	dashaYearDaysOf(chartObj){
		const d = chartObj && chartObj.jyotish && chartObj.jyotish.dasha;
		const v = d && d.vimshottari && Number(d.vimshottari.yearLengthDays);
		return (Number.isFinite(v) && v > 0) ? v : DASHA_YEAR_DAYS;
	},

	// 死亡指示点风险区(伦理敏感:开关默认关;中性灰不作凶色渲染;绝不出寿数)。
	renderRiskFactorsBlock(chartObj){
		const spx = chartObj && chartObj.jyotish && chartObj.jyotish.sensitivePoints;
		const di = spx && spx.deathIndicators;
		return (
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">风险因子（仅标注 · 不作寿命断言）</div>
				<XQCheckbox className="horosa-india-risk-toggle"
					checked={this.state.indiaShowRiskFactors}
					onChange={(e)=>this.setState({ indiaShowRiskFactors: e.target.checked })}>显示风险因子(默认关闭)</XQCheckbox>
				{this.state.indiaShowRiskFactors && di && di.available ? (
					<div className="horosa-india-risk-body">
						<div className="horosa-india-data-list">
							<div className="horosa-india-data-row">
								<strong>22nd Drekkana(自 Lagna)</strong>
								<span>{di.drekkana22.drekkanaSignLabel} · 主 {di.drekkana22.lordLabel}</span>
								<span className="horosa-india-card-note">落 {di.drekkana22.containingSignLabel}</span>
							</div>
							{di.navamsa64FromMoon ? (
								<div className="horosa-india-data-row">
									<strong>64th Navamsa(自 Moon · Khareśa)</strong>
									<span>{di.navamsa64FromMoon.navamsaSignLabel} · 主 {di.navamsa64FromMoon.lordLabel}</span>
								</div>
							) : null}
							{di.navamsa64FromLagna ? (
								<div className="horosa-india-data-row">
									<strong>64th Navamsa(自 Lagna 口径)</strong>
									<span>{di.navamsa64FromLagna.navamsaSignLabel} · 主 {di.navamsa64FromLagna.lordLabel}</span>
								</div>
							) : null}
						</div>
						<div className="horosa-india-card-note">权威给「自 Moon 或 Lagna」两口径 → 两个并列,不擅自二选一;Maraka 因子见星曜页徽标</div>
						<div className="horosa-india-card-note">{di.disclaimer}</div>
					</div>
				) : null}
			</div>
		);
	},

	renderDashaPanel(fields){
		const system = this.state.dashaSystem || 'vimshottari';
		const dashaChartObj = resolveJyotishChartObj(this.state, fields);
		syncDashaYearDays(dashaChartObj);   // G5:客户端段换算与后端年长对齐(单一真值源)
		const seed = this.state.dashaSeed || DASHA_SEED_DEFAULT;
		const dasha = this.getMemoizedDasha(dashaChartObj, fields, system, seed);
		const naisargika = dashaChartObj && dashaChartObj.jyotish && dashaChartObj.jyotish.dasha
			? dashaChartObj.jyotish.dasha.naisargika : null;   // P1 自然大运(年龄段)
		const ayurdaya = dashaChartObj && dashaChartObj.jyotish && dashaChartObj.jyotish.ayurdaya
			&& dashaChartObj.jyotish.ayurdaya.available ? dashaChartObj.jyotish.ayurdaya : null;   // P2 寿命基础
		const mula = dashaChartObj && dashaChartObj.jyotish && dashaChartObj.jyotish.dasha
			&& dashaChartObj.jyotish.dasha.mula && dashaChartObj.jyotish.dasha.mula.available
			? dashaChartObj.jyotish.dasha.mula : null;   // P1 Mūla graha 大运
		const sudarshana = dashaChartObj && dashaChartObj.jyotish && dashaChartObj.jyotish.dasha
			&& dashaChartObj.jyotish.dasha.sudarshanaChakra && dashaChartObj.jyotish.dasha.sudarshanaChakra.available
			? dashaChartObj.jyotish.dasha.sudarshanaChakra : null;   // P1 Sudarśana Chakra(3 轮)
		const sysTitle = DASHA_SYSTEM_LABEL[system] || 'Vimshottari';
		// 大运 / 条件 / 起点 / 寿命子块未能计算时一行提示(引擎落账 jyotish.partialErrors)
		const partialNote = jyotishPartialNotice(getJyotish(dashaChartObj), isDashaPartialName);
		const partialNoteEl = partialNote ? <div className="horosa-india-card-note horosa-india-partial-note">{partialNote}</div> : null;
		const stdOpts = DASHA_SYSTEM_OPTIONS.filter((o)=>DASHA_CONDITIONAL_KEYS.indexOf(o.value) < 0 && DASHA_JAIMINI_KEYS.indexOf(o.value) < 0);
		const condOpts = DASHA_SYSTEM_OPTIONS.filter((o)=>DASHA_CONDITIONAL_KEYS.indexOf(o.value) >= 0);
		const jaiminiOpts = DASHA_SYSTEM_OPTIONS.filter((o)=>DASHA_JAIMINI_KEYS.indexOf(o.value) >= 0);
		const selector = (
			<div className="horosa-india-dasha-syssel">
				<div className="horosa-india-dasha-syssel-row">
					<label className="horosa-india-dasha-syssel-field">
						<span className="horosa-india-dasha-syssel-label">大运体系</span>
						<Select
							size="small"
							value={system}
							onChange={(v)=>this.changeDashaSystem(v)}
							dropdownMatchSelectWidth={false}
							className="horosa-india-dasha-syssel-select"
						>
							<OptGroup label="标准大运">
								{stdOpts.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</OptGroup>
							<OptGroup label="条件 Nakshatra 大运">
								{condOpts.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</OptGroup>
							<OptGroup label="Jaimini 星座大运">
								{jaiminiOpts.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</OptGroup>
						</Select>
					</label>
					<label className="horosa-india-dasha-syssel-field">
						<span className="horosa-india-dasha-syssel-label">起点</span>
						<Select
							size="small"
							value={seed}
							onChange={(v)=>this.changeDashaSeed(v)}
							dropdownMatchSelectWidth={false}
							className="horosa-india-dasha-syssel-select"
						>
							{DASHA_SEED_OPTIONS.map((grp)=>(
								<OptGroup key={grp.label} label={grp.label}>
									{grp.options.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</OptGroup>
							))}
						</Select>
					</label>
					<label className="horosa-india-dasha-syssel-field">
						<span className="horosa-india-dasha-syssel-label">年长</span>
						<Select
							size="small"
							value={this.state.indiaDashaYearLength}
							onChange={(v)=>this.changeDashaYearLength(v)}
							dropdownMatchSelectWidth={false}
							className="horosa-india-dasha-syssel-select"
						>
							{AstroConst.INDIA_DASHA_YEAR_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
						</Select>
					</label>
				</div>
				<div className="horosa-india-card-note">年长:{this.dashaYearDaysOf(dashaChartObj)} 日/年(全大运族统一取用)</div>
			</div>
		);
		if(this.state.dashaLoading && !dasha){
			return (
				<div className="horosa-india-dasha-panel">
					{selector}
					<div className="horosa-india-dasha-empty">大运计算中...</div>
				</div>
			);
		}
		if(!dasha){
			return (
				<div className="horosa-india-dasha-panel">
					{selector}
					{partialNoteEl}
					<div className="horosa-india-dasha-empty">暂无 {sysTitle} 数据</div>
				</div>
			);
		}
		const activeItem = dasha.items.find((item)=>item.active);
		return (
			<div className="horosa-india-dasha-panel">
				{selector}
				{partialNoteEl}
				<div className="horosa-info-card horosa-india-dasha-overview">
					<div className="horosa-info-card-title">{sysTitle}</div>
					{dasha.chara ? (
						<>
							<div className="horosa-info-row"><span>起始座</span><strong>{dasha.nakshatra.name}</strong></div>
							<div className="horosa-info-row"><span>当前座</span><strong>{activeItem ? `${activeItem.lord.label} · ${activeItem.lord.en}` : '—'}</strong></div>
						</>
					) : (
						<>
							{seed !== 'moon' ? (
								<div className="horosa-info-row"><span>起点</span><strong>{DASHA_SEED_LABEL[seed] || seed}</strong></div>
							) : null}
							<div className="horosa-info-row"><span>{seed === 'moon' ? '月宿' : '起点宿'}</span><strong>{dasha.nakshatra.index}. {dasha.nakshatra.name}</strong></div>
							<div className="horosa-info-row"><span>起运</span><strong>{dasha.nakshatra.lord.label} · {dasha.nakshatra.lord.en}</strong></div>
							<div className="horosa-info-row"><span>出生余额</span><strong>{formatDuration(dasha.firstBalance)}</strong></div>
							<div className="horosa-info-row"><span>当前</span><strong>{activeItem ? `${activeItem.lord.label} · ${activeItem.lord.en}` : '—'}</strong></div>
						</>
					)}
				</div>
				<div className="horosa-india-dasha-list">
					{this.renderDashaDrillView(dasha)}
				</div>
				{naisargika && naisargika.available && Array.isArray(naisargika.periods) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Naisargika 自然大运（7 曜固定 120 年 · Varahamihira 成熟序/年龄段）</div>
						<div className="horosa-india-maitri-wrap">
							<table className="horosa-india-maitri-table horosa-india-shad-table">
								<thead><tr><th>曜</th><th>年</th><th>年龄段</th><th>起→止</th></tr></thead>
								<tbody>
									{naisargika.periods.map((p)=>(
										<tr key={`nais${p.planet}`}>
											<th>{p.planetCN}</th>
											<td>{p.years}</td>
											<td>{p.startAge}–{p.endAge}</td>
											<td>{p.start || '—'} → {p.end || '—'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				) : null}
				{ayurdaya && ayurdaya.pindayu ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Āyurdāya 寿命 · Piṇḍāyu 基础（度式贡献 · 未施 haraṇa 减）</div>
						<div className="horosa-info-row"><span>基础年</span><strong className="horosa-india-emph">{ayurdaya.pindayu.baseYears} 年</strong></div>
						<div className="horosa-india-maitri-wrap">
							<table className="horosa-india-maitri-table horosa-india-shad-table">
								<thead><tr><th>曜</th><th>满寿</th><th>距落陷°</th><th>贡献年</th></tr></thead>
								<tbody>
									{ayurdaya.pindayu.contributions.map((c)=>(
										<tr key={`pind${c.planet}`}>
											<th>{c.planetCN}</th>
											<td>{c.fullYears}</td>
											<td>{Math.round(c.arcFromDebil)}</td>
											<td>{c.years}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{Array.isArray(ayurdaya.nisargayu && ayurdaya.nisargayu.naturalYears) ? (
							<div className="horosa-info-row"><span>Nisargāyu</span><strong>自然寿 {ayurdaya.nisargayu.naturalYears.map((n)=>`${n.planetCN}${n.years}`).join(' ')}（120）</strong></div>
						) : null}
						{ayurdaya.amsayu && Array.isArray(ayurdaya.amsayu.contributions) ? (
							<div className="horosa-info-row"><span>Aṁśāyu</span><strong>{ayurdaya.amsayu.contributions.map((c)=>`${c.planetCN}${c.years}${c.multiplier > 1 ? '×' + c.multiplier : ''}`).join(' ')} = <span className="horosa-india-emph">{ayurdaya.amsayu.baseYears}</span> 年（÷200·Bharaṇa）</strong></div>
						) : null}
						{ayurdaya.amsayu && Array.isArray(ayurdaya.amsayu.bharanaVariants) ? (
							<div className="horosa-info-row"><span>Bharaṇa 组</span><strong>{ayurdaya.amsayu.bharanaVariants.map((v)=>`${v.label.replace(/（.*）/, '')} ${v.baseYears}`).join(' · ')}</strong></div>
						) : null}
						<div className="horosa-india-card-note">{ayurdaya.methodSelection}</div>
						<div className="horosa-india-card-note">{ayurdaya.haranaNote}</div>
					</div>
				) : null}
				{ayurdaya && ayurdaya.harana && ayurdaya.harana.available && Array.isArray(ayurdaya.harana.profiles) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Āyurdāya · haraṇa 减算（流派选项 · Piṇḍāyu 施减）</div>
						<div className="horosa-india-data-list">
							{ayurdaya.harana.profiles.map((p)=>(
								<div className="horosa-india-data-row" key={p.key}>
									<strong>{p.label}</strong>
									<span>{p.savanaYears} Savana</span>
									<em className="horosa-india-emph">{p.solarYears} 太阳年</em>
								</div>
							))}
						</div>
						{ayurdaya.haranaNisarga && Array.isArray(ayurdaya.haranaNisarga.profiles) ? (
							<div className="horosa-india-data-list">
								<div className="horosa-india-data-subhead"><strong>Nisargāyu 自然寿（全期 vs 技术派）</strong></div>
								{/* 「全期不减」与行星位置无关,只作参考;缺省档=同 Piṇḍāyu 施减 */}
								<div className="horosa-india-card-note">「全期」档只按自然寿表原样合计,与行星位置无关,仅作参考;缺省按「同 Piṇḍāyu 施减」。</div>
								{ayurdaya.haranaNisarga.profiles.map((p)=>(
									<div className="horosa-india-data-row" key={`nis${p.key}`}>
										<strong>{p.label}</strong>
										<span>{p.savanaYears} Savana</span>
										<em className="horosa-india-emph">{p.solarYears} 太阳年</em>
									</div>
								))}
							</div>
						) : null}
						<div className="horosa-india-maitri-wrap">
							<table className="horosa-india-maitri-table horosa-india-shad-table">
								<thead><tr><th>曜</th><th>基础</th><th>敌/合</th><th>宫</th><th>Chakra</th><th>减后</th></tr></thead>
								<tbody>
									{ayurdaya.harana.planets.map((r)=>(
										<tr key={`har${r.planet}`}>
											<th>{r.planetCN}</th>
											<td>{r.baseYears}</td>
											<td>{`${r.enemySign ? '敌' : ''}${r.combust ? '合' : ''}` || '—'}</td>
											<td>{r.house}</td>
											<td>{r.chakrapata > 0 ? trimDecimals(r.chakrapata) : '—'}</td>
											<td>{r.reducedYears}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{ayurdaya.harana.krurodaya && ayurdaya.harana.krurodaya.applies ? (
							<div className="horosa-info-row"><span>Krurodaya</span><strong>{ayurdaya.harana.krurodaya.planetCN} 升 Lagna{ayurdaya.harana.krurodaya.mitigated ? '·吉星望减半' : ''} · 式A −{ayurdaya.harana.krurodaya.formulaA} / 式B −{ayurdaya.harana.krurodaya.formulaB}</strong></div>
						) : null}
						<div className="horosa-info-row"><span>Lagna Āyu</span><strong>{ayurdaya.harana.lagnaAyu} 年（座内角分/200）</strong></div>
						<div className="horosa-india-card-note">{ayurdaya.harana.note}</div>
					</div>
				) : null}
				{(()=>{
					// Āyurdāya 判读层(开关化管线):选定方法/总值+档位/三对法/致死因子/投影。
					const af = dashaChartObj && dashaChartObj.jyotish && dashaChartObj.jyotish.ayurdayaFinal;
					if(!af || !af.available){ return null; }
					const SIGN_CN2 = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
					const sc2 = (x)=>SIGN_CN2[x] || x || '—';
					const M_CN = { pindayu: 'Piṇḍāyu', nisargayu: 'Nisargāyu', amsayu: 'Aṁśāyu' };
					const sel = af.methodSelection || {};
					const fin = af.selectedFinal || {};
					const proj = af.projection;
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Āyurdāya 判读（方法选定 · 档位 · 因子清单）</div>
							<div className="horosa-info-row"><span>选定方法</span><strong>{M_CN[sel.selected] || sel.selected}{sel.override === 'auto' ? `（自动:${M_CN[sel.auto] || sel.auto}）` : '（手动指定）'}</strong></div>
							<div className="horosa-info-row"><span>并入减算总值</span><strong className="horosa-india-emph">{fin.solarYears != null ? `${fin.solarYears} 太阳年` : '—'}{fin.savanaYears != null ? `（${fin.savanaYears} Savana）` : ''}</strong></div>
							{af.finals ? (
								<div className="horosa-info-row"><span>三法总值</span><strong>{['pindayu', 'nisargayu', 'amsayu'].filter((k)=>af.finals[k] && af.finals[k].solarYears != null).map((k)=>`${M_CN[k]} ${af.finals[k].solarYears}`).join(' / ') || '—'}（太阳年）</strong></div>
							) : null}
							{af.ayuClass ? <div className="horosa-info-row"><span>寿命档</span><strong>{af.ayuClass.label}</strong></div> : null}
							{af.triPairYears != null ? <div className="horosa-info-row"><span>三对法寿数</span><strong>{af.triPairYears} 年{af.triPairVotes ? `（长${af.triPairVotes.purna || 0}/中${af.triPairVotes.madhya || 0}/短${af.triPairVotes.alpa || 0}）` : ''}</strong></div> : null}
							{af.maraka ? (
								<div className="horosa-info-row"><span>Maraka 因子</span><strong>{(af.maraka.lords || []).join('/') || '—'}{(af.maraka.occupants || []).length ? ` · 落宫 ${(af.maraka.occupants || []).join('/')}` : ''}（2宫 {sc2((af.maraka.sthana || {}).second)} · 7宫 {sc2((af.maraka.sthana || {}).seventh)}）</strong></div>
							) : null}
							{af.trishula ? <div className="horosa-info-row"><span>Trishula 座</span><strong>{(af.trishula.signs || []).map(sc2).join('/')}（Rudra {sc2(af.trishula.rudraSign)}）</strong></div> : null}
							{af.drekkana22 ? <div className="horosa-info-row"><span>22 Drekkāṇa</span><strong>{sc2(af.drekkana22.sign)} · 主 {af.drekkana22.lord || '—'}</strong></div> : null}
							{af.navamsa64 ? <div className="horosa-info-row"><span>64 Navāṁśa</span><strong>{sc2(af.navamsa64.sign)} · 主 {af.navamsa64.lord || '—'}（{af.navamsa64.basis === 'moon' ? '月基' : '命基'}）</strong></div> : null}
							{proj && proj.mahaLord ? (
								<div className="horosa-info-row"><span>寿龄投影</span><strong>{(proj.mahaLord || {}).label || '—'} 大运{proj.mahaIsMaraka ? '（maraka 命中）' : ''}{proj.antarLord ? ` / ${(proj.antarLord || {}).label} 中运${proj.antarIsMaraka ? '（maraka）' : ''}` : ''}（Vimshottari）</strong></div>
							) : null}
							<div className="horosa-india-card-note">{af.disclaimer}</div>
						</div>
					);
				})()}
				{this.renderRiskFactorsBlock(dashaChartObj)}
				{mula && Array.isArray(mula.mahadashas) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Mūla 大运（Lagna Kendrādi Graha · 数到本三角座定年 · 二轮补足 120）</div>
						<div className="horosa-india-maitri-wrap">
							<table className="horosa-india-maitri-table horosa-india-shad-table">
								<thead><tr><th>曜</th><th>宫</th><th>首轮年</th><th>次轮年</th></tr></thead>
								<tbody>
									{mula.mahadashas.filter((m)=>m.round === 1).map((m, i)=>{
										const r2 = mula.mahadashas.filter((x)=>x.round === 2)[i];
										return (
											<tr key={`mula${m.planet}`}>
												<th>{m.planetCN}</th>
												<td>{m.house}</td>
												<td>{m.years}</td>
												<td>{r2 ? r2.years : '—'}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<div className="horosa-india-card-note">{mula.note}</div>
					</div>
				) : null}
				{sudarshana && Array.isArray(sudarshana.rows) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Sudarśana Chakra 大运（每宫 1 太阳年 · 12 年循环 · 三轮并读）</div>
						<div className="horosa-india-maitri-wrap">
							<table className="horosa-india-maitri-table horosa-india-shad-table">
								<thead><tr><th>年</th><th>日轮 SL·灵</th><th>月轮 CL·心</th><th>升轮 JL·身</th></tr></thead>
								<tbody>
									{sudarshana.rows.map((r)=>(
										<tr key={`sud${r.year}`} className={r.current ? 'is-current-year' : ''}>
											<th className={r.current ? 'is-good' : ''}>{r.year}{r.current ? <XQCurrentMark /> : ''}</th>
											<td>{r.slLabel}</td>
											<td>{r.clLabel}</td>
											<td>{r.jlLabel}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="horosa-india-card-note">{sudarshana.note}</div>
					</div>
				) : null}
				{this.renderRasiDashaCards(fields)}
				{this.renderJudgmentNotes('3')}
			</div>
		);
	},

	renderDashaSubPopover(item, extraClassName = '', style = null){
		const subItems = buildDashaSubPeriods(item, this.state.dashaSystem || 'vimshottari');
		return (
			<div className={`horosa-india-dasha-subpanel${extraClassName}`} style={style || undefined}>
				<div className="horosa-india-dasha-subtitle">
					<strong>{item.lord.label}</strong>
					<span>{item.lord.en} Antardasha</span>
				</div>
				<div className="horosa-india-dasha-sublist">
					{subItems.map((subItem, idx)=>(
						<div className="horosa-india-dasha-subitem" key={`${item.lord.key}_${subItem.lord.key}_${idx}`}>
							<div className="horosa-india-dasha-subname">
								<strong>{subItem.lord.label}</strong>
								<span>{subItem.lord.en}</span>
							</div>
							<div className="horosa-india-dasha-submeta">
								<span>{formatJyotishDate(subItem.start)} - {formatJyotishDate(subItem.end)}</span>
								<em>{formatDuration(subItem.years)}</em>
							</div>
							{Array.isArray(subItem.pratyantardashas) && subItem.pratyantardashas.length ? (
								<div className="horosa-india-dasha-pratyantar">
									{subItem.pratyantardashas.map((p, pIdx)=>{
										const pl = normalizeDashaLord(p.lord);
										return (
											<div className="horosa-india-dasha-pratyantar-row" key={`prat_${pIdx}`}>
												<span>{pl.label}</span>
												<em>{formatJyotishDate(dashaMoment(p.startIso, p.start))} - {formatJyotishDate(dashaMoment(p.endIso, p.end))}</em>
											</div>
										);
									})}
								</div>
							) : null}
						</div>
					))}
				</div>
			</div>
		);
	},

	renderDashaFloatingPopover(){
		if(!this.state.dashaPopoverItem || !this.state.dashaPopoverStyle || typeof document === 'undefined' || !document.body){
			return null;
		}
		return createPortal(
			this.renderDashaSubPopover(this.state.dashaPopoverItem, ' is-floating', this.state.dashaPopoverStyle),
			document.body
		);
	},
};
