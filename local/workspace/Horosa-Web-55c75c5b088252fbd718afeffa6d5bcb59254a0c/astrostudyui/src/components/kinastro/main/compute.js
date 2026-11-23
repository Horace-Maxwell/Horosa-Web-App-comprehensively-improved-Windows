// 策天页 · 时间 / 地点改值、步进预取、起盘载荷与取盘、AI 快照刷新、页签切换
// 从 KinAstroMain.js 按职责拆出的 KinAstroMain 方法:this 仍是 KinAstroMain 实例,门面里 mixinMethods(KinAstroMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { claimTrigger, settleTrigger } from '../../../utils/singleTrigger';
import DateTime from '../../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../../astro/AstroHelper';
import { resolveGeoZone } from '../../../utils/timezone';
import { geoNameFieldPatch } from '../../../utils/geoName';
import { buildYanqinYanfaSnapshot } from '../../yanqin/yanqinSnapshot';
import { saveModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { normBinaryGender, parseFieldsDateTime } from '../../../utils/kinAstroFieldsSync';
import { stepPrefetchEnabled, kentangCacheEnabled, stepSelectPrefetchEnabled } from '../../../utils/perfFlags';
import { notePendingTime, pendingTimePatch } from '../../../utils/pendingTimeDraft';
import { chartDayBoundary } from '../../../utils/dayBoundaryResolve';
import { postKinAstro, buildSnapshotText, kinAstroSnapshotMeta, saveKinAstroAISnapshots } from './snapshot';
import { normalizeGanzhiInput } from './ziweiChart';
import React from 'react';
import { armStepPrefetch } from '../../../utils/stepPrefetchArm';
import { chartSCUEnabled } from '../../../utils/perfFlags';
import { markPanelReady } from '../../../utils/perfMark';
import { readKinCenterContent } from './ziweiChart';

// horosa_kinastro_center_memo_v1(PERF-R9 Ship 6)—— 中栏盘面 memo 槽。
//
// 病灶:本类被数算九家 + 演禽 + 策天 + 一掌经共壳复用,左栏塞了上百个受控控件
// (铁板六项、南极十余项、蠢子十项、神数正传十八项…)。任一控件 onChange → setState →
// 恒真 sCU → **整棵树重渲**:中栏盘面(策天/演禽还要重跑 buildKinAstroZiWeiChart +
// buildZiWeiRulesForChart 造整张紫微盘)、右栏全部子页签、底部快捷栏,一并白跑一遍。
// 而这些控件里有大半(zhengchuan* / yizhangjing* / heluo* / canpingMethod 等 native 子技法项)
// 压根不进 buildPayload,盘面【逐字节不变】。
// ⚠️ 反例订正:cetian* 诸项(cetianMethod/LunarMode/StarOrder/show*)**是**进 buildPayload 的
//    (见 buildPayload 内 serviceKey==='cetian' 分支),且其 onChange 带 clickPlot 回调 → 重排 →
//    新 pan(引用必变)→ 本 memo 照常失效重渲。列它当「不进 payload」的例子是错的,已删。
//
// 修法:把中栏包进本 memo 槽,比较函数只在「盘 + fields 引用 + 影响盘面的选项签名」三者
// 全同时跳过。三项任一不同 → 返 false 照常重渲(拿的是父组件本轮最新的 render 闭包,
// 零陈旧)。sig 由 kinSig() 单点给出,漏一项就等于「改了不刷新」——故那里只许多写不许少写。
// kill-switch:与全站重组件 sCU 同闸(horosa.perf.chartSCU 置 '0' → 比较函数恒返 false =
// 逐字回到「中栏每次都重渲」的旧行为)。全站每一处渲染守卫都必须可一键回退,本处不例外。
const MemoSlot = React.memo(function KinAstroMemoSlot(props){
	return props.render();
}, function kinAstroSlotEqual(prev, next){
	if(!chartSCUEnabled()){
		return false;
	}
	return prev.pan === next.pan && prev.fields === next.fields && prev.sig === next.sig;
});

export const computeMethods = {
	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	// 本组件渲染整个铁板神数家族,每实例按 this.config 对应一个技法;
	// 导出侧对 kinastro 走 kinastro-{serviceKey},故 kinKey 与 moduleKey 两个键都响应。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		const cfg = this.config || {};
		const kinKey = `kinastro-${cfg.serviceKey || 'unknown'}`;
		if(moduleName !== kinKey && moduleName !== cfg.moduleKey){
			return;
		}
		const pan = this.state ? this.state.pan : null;
		if(!pan){
			return;
		}
		let text = '';
		try{
			const suffix = this.tiebanFrameworkSuffix(pan);
			text = `${buildSnapshotText(pan) || ''}${suffix ? `\n\n${suffix}` : ''}`.trim();
			// refresh 路径同构补演法段(与 saveKinAstroAISnapshots/无头同律):
			// 实时导出走此处,不补则「当前页导出」也缺 [演法]。同步 lunar-js 域内即全对。
			if(cfg.serviceKey === 'xianqin' && text && this.props.fields){
				try{
					const yf = buildYanqinYanfaSnapshot(parseFieldsDateTime(this.props.fields));
					if(yf){ text = `${text}\n\n${yf}`; }
				}catch(e2){ /* 演法失败不拖主快照 */ }
			}
		}catch(e){
			text = '';
		}
		if(text && text !== '暂无 kinastro 数据'){
			// 与平时写槽同一份 meta(此前只传两个参数:刷新一次槽的 meta 就变成 {},读盘方丢了服务键 / 段目录)
			saveModuleAISnapshot(moduleName, text, kinAstroSnapshotMeta(cfg, pan, this.props.hostModuleKey || cfg.moduleKey));
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	},

	onFieldsChange(field){
		if(this.props.dispatch){
			const flds = { ...(this.props.fields || {}), ...field };
			this.props.dispatch({ type: 'astro/fetchByFields', payload: flds });
		}
	},

	changeGeo(rec){
		// 策天飞星(cetian)选地点 → 坐标 + 时区自动校正 → onFieldsChange → fetchByFields 实时重排
		const f = this.props.fields || {};
		const dDt = f.date && f.date.value;
		const tDt = f.time && f.time.value;
		const ds = (dDt && dDt.format) ? dDt.format('YYYY-MM-DD') : null;
		const z = resolveGeoZone(rec, ds);
		const payload = {
			lon: { value: convertLonToStr(rec.lng) },
			lat: { value: convertLatToStr(rec.lat) },
			gpsLon: { value: rec.gpsLng },
			gpsLat: { value: rec.gpsLat },
		};
		if(z){
			payload.zone = { value: z };
			// 重锚 date/time 到新时区(保留钟面时刻、瞬时随之偏移),否则排盘仍用旧时区算瞬时
			if(dDt && dDt.clone){ const nd = dDt.clone(); nd.setZone(z); payload.date = { value: nd }; payload.ad = { value: nd.ad }; }
			if(tDt && tDt.clone){ const nt = tDt.clone(); nt.setZone(z); payload.time = { value: nt }; }
		}
		Object.assign(payload, geoNameFieldPatch(rec));
		this.onFieldsChange(payload);
	},

	onTimeChanged(value){
		notePendingTime(this, value && (value.time || value.value));
		const dt = value.time;
		this.onFieldsChange({
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
			// 步进方向提示:驱动 astro model settle 后 /chart ±步预取(消费后即剥离)
			...(value.step ? { __stepHint: value.step } : {}),
		});
		this.prefetchNextStepPan(dt, value.step);
	},

	// 顺向 +1 步 pan 预取:当前步 T 由正式请求(hook 联动)落 kentangCache,此处
	// 静默备下 T+1 —— 连点下一下即命中。payload 走 buildPayload 单源 → 键逐字节等。
	// native 子技法(本地引擎)零网络,直接跳过;失败静默;开关关=零行为。
	prefetchNextStepPan(dt, stepHint){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled()){ return; }
			if(this.config.native){ return; }
			if(!stepHint || !stepHint.dir || !dt || typeof dt.clone !== 'function'){ return; }
			if(this.prefetchStepTimer){ clearTimeout(this.prefetchStepTimer); }
			this.prefetchStepTimer = setTimeout(()=>{
				this.prefetchStepTimer = null;
				if(this.unmounted){ return; }
				this._prefetchPanAtStep(dt, stepHint.unit || 'm', stepHint.dir);
			}, 150);
		}catch(e){ /* 预取失败无害 */ }
	},

	// 取数内核:以 dt 为基按 unit 走 1 步×dir,buildPayload 单源构包预取该时刻 pan。
	// settle 链(+1 同向)与选步长(±1 双向)共用,防两处步进加法漂移。
	_prefetchPanAtStep(dt, unit, dir){
		try{
			const dt2 = dt.clone();
			if(unit === 'y'){ dt2.addYear(dir); }
			else if(unit === 'M'){ dt2.addMonth(dir); }
			else if(unit === 'd'){ dt2.addDate(dir); }
			else if(unit === 'h'){ dt2.addHour(dir); }
			else { dt2.addMinute(4 * dir); }
			const flds2 = {
				...(this.props.fields || {}),
				date: { value: dt2.clone() },
				time: { value: dt2.clone() },
				ad: { value: dt2.ad },
				zone: { value: dt2.zone },
			};
			const payload = this.buildPayload(flds2);
			if(!payload){ return; }
			postKinAstro(this.config.serviceKey, payload).catch(()=>null);
		}catch(e){ /* 预取失败无害 */ }
	},

	// 选步长即预取:/chart 面由全局 handler 罩(时间走 store),pan 面(本页主耗时)
	// 此处以当前时间 ±1 双向预热 —— 选完步长第一下步进 pan 即命中。同 unit 5s 去重。
	prefetchStepSelect(unit){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled() || !stepSelectPrefetchEnabled() || !unit){ return; }
			if(this.config && this.config.native){ return; }
			const now = Date.now();
			if(this._lastStepSel && this._lastStepSel.unit === unit && (now - this._lastStepSel.at) < 5000){ return; }
			this._lastStepSel = { unit, at: now };
			const flds = this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields || {};
			const dt = flds.date && flds.date.value;
			if(!dt || typeof dt.clone !== 'function'){ return; }
			this._prefetchPanAtStep(dt, unit, 1);
			this._prefetchPanAtStep(dt, unit, -1);
		}catch(e){ /* 预取失败无害 */ }
	},

	getTimeFieldsFromSelector(baseFields){
		const _pend = pendingTimePatch(this);   // 改了时间还没等到全局盘回来:以最新改动为准(见 utils/pendingTimeDraft)
		if(_pend){ return { ...(baseFields || {}), ..._pend }; }
		if(!this.timeHook || !this.timeHook.getValue){
			return null;
		}
		const raw = this.timeHook.getValue();
		const dt = raw && raw.value && raw.value instanceof DateTime
			? raw.value
			: (raw && raw.time && raw.time instanceof DateTime ? raw.time : null);
		if(!dt){
			return null;
		}
		const patch = {
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
		return { ...(baseFields || {}), ...patch };
	},

	clickPlot(){
		const nextFields = this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
		if(nextFields && nextFields.date && nextFields.time && nextFields.zone){
			// 单路触发:派发 fields → astro/fetchByFields → save(props 变→didUpdate)+doHook(hook 回调)
			// 经 fetchPan 重排;此处不再显式 fetchPan(否则同一起盘打 2~3 次后端,fetchPan 去重虽能收敛,
			// 但从源头单路更干净)。若可派发(date/time/zone 齐),交由 dispatch 驱动。
			this.onFieldsChange({
				date: nextFields.date,
				time: nextFields.time,
				ad: nextFields.ad,
				zone: nextFields.zone,
			});
			return;
		}
		// 兜底:fields 不全(无法走 dispatch 重锚)时,仍直接起盘,避免按钮无反应。
		this.fetchPan(nextFields);
	},

	buildPayload(fields){
		const dt = parseFieldsDateTime(fields);
		if(!dt){
			return null;
		}
		const payload = {
			...dt,
			// 日界 / 晚子时:本盘有值用本盘,没有才用全局(与八字 / 七政 / 正传页面、AI 无头同一函数)
			...chartDayBoundary(fields),
			gender: normBinaryGender(this.state.gender),
			ke: this.state.ke,
			useKey: this.state.useKey === '1',
			method: this.state.tiebanMethod,
			startAge: this.state.tiebanStartAge,
			dayunSteps: this.state.tiebanDayunSteps,
			fatherBirthYear: this.state.fatherBirthYear,
			fatherDeathYear: this.state.fatherDeathYear,
			motherBirthYear: this.state.motherBirthYear,
			motherDeathYear: this.state.motherDeathYear,
			siblingsInfo: this.state.siblingsInfo,
			maritalStatus: this.state.maritalStatus,
			childrenInfo: this.state.childrenInfo,
			calendarMode: this.state.calendarMode,
			lunarYear: this.state.lunarYear,
			lunarMonth: this.state.lunarMonth,
			lunarDay: this.state.lunarDay,
				stemOverride: this.state.fendjingStemOverride === '1',
				yearStem: this.state.fendjingYearStem,
				hourStem: this.state.fendjingHourStem,
				keMode: this.state.beijiKeMode,
				beijiKeMode: this.state.beijiKeMode,
				beijiKe: this.state.beijiKe,
				beijiLookupCode: this.state.beijiLookupCode,
				beijiKeyword: this.state.beijiKeyword,
				useKe: this.state.beijiKeMode === 'manual',
				nanjiMode: this.state.nanjiMode,
				nanjiAfterLichun: this.state.nanjiAfterLichun,
				nanjiLunarYear: this.state.nanjiLunarYear,
				nanjiSolarMonth: this.state.nanjiSolarMonth,
				nanjiDay: this.state.nanjiDay,
				nanjiHourZhi: this.state.nanjiHourZhi,
				nanjiDayGan: this.state.nanjiDayGan,
				nanjiDayZhi: this.state.nanjiDayZhi,
				nanjiSection: this.state.nanjiSection,
				nanjiJianchu: this.state.nanjiJianchu,
				nanjiXiu: this.state.nanjiXiu,
				nanjiPasswordCode: this.state.nanjiPasswordCode,
				nanjiChart: this.state.nanjiChart,
				nanjiPalace: this.state.nanjiPalace,
				nanjiDegree: this.state.nanjiDegree,
				chunziKeMode: this.state.chunziKeMode,
				chunziKe: this.state.chunziKe,
				chunziLunarMode: this.state.chunziLunarMode,
				chunziLunarMonth: this.state.chunziLunarMonth,
				chunziLunarDay: this.state.chunziLunarDay,
				chunziLookupCode: this.state.chunziLookupCode,
				chunziKeyword: this.state.chunziKeyword,
				chunziTags: this.state.chunziTags,
				chunziMansion: this.state.chunziMansion,
				chunziHourBranch: this.state.chunziHourBranch,
				chunziResultLimit: this.state.chunziResultLimit,
			};
		if(this.config.serviceKey === 'cetian'){
			// 策天双法:覆盖 method(避免与铁板 tiebanMethod 混用)+ 原法子选项
			payload.method = this.state.cetianMethod || 'book';
			payload.lunarMode = this.state.cetianLunarMode || 'sxtwl';
			payload.starOrder = this.state.cetianStarOrder || 'reverse';
			// 5 显示开关随盘请求下发(后端按 show_* 过滤输出段/行;默认 1=现状)
			payload.showWuXingJu = this.state.cetianShowWuXingJu;
			payload.showSihua = this.state.cetianShowSihua;
			payload.showFlying = this.state.cetianShowFlying;
			payload.showBrightness = this.state.cetianShowBrightness;
			payload.showSolarTerm = this.state.cetianShowSolarTerm;
			// 书法(移语本)口径/流年/显示开关(原法后端自动忽略,统一透传保持键集单源)
			payload.brightnessSchool = this.state.cetianBrightnessSchool || 'yiyu';
			payload.shenGongMode = this.state.cetianShenGongMode || 'yizheng';
			payload.daxianMode = this.state.cetianDaxianMode || 'yiyu';
			payload.tianluoMode = this.state.cetianTianluoMode || 'benshu';
			payload.palaceNameMode = this.state.cetianPalaceNameMode || 'common';
			payload.liunianYear = this.state.cetianLiunianYear || new Date().getFullYear();
			payload.liunianQishaMode = this.state.cetianLiunianQishaMode || 'shengshi';
			payload.showLiunian = this.state.cetianShowLiunian;
			payload.showShensha = this.state.cetianShowShensha;
			payload.showZaYao = this.state.cetianShowZaYao;
			payload.showDuanjue = this.state.cetianShowDuanjue;
			payload.showXiu = this.state.cetianShowXiu;
			payload.showBianyao = this.state.cetianShowBianyao;
		}
		if(this.state.pillarOverride === '1'){
			const yearGz = normalizeGanzhiInput(this.state.yearGz);
			const monthGz = normalizeGanzhiInput(this.state.monthGz);
			const dayGz = normalizeGanzhiInput(this.state.dayGz);
			const hourGz = normalizeGanzhiInput(this.state.hourGz);
			if(yearGz){
				payload.yearGz = yearGz;
			}
			if(monthGz){
				payload.monthGz = monthGz;
			}
			if(dayGz){
				payload.dayGz = dayGz;
			}
			if(hourGz){
				payload.hourGz = hourGz;
			}
		}
		return payload;
	},

	async fetchPan(fields){
		if(this.config.native){
			this.requestSeq += 1;
			// horosa_panel_ready_v1:原生技法(参评/河洛/正传/一掌经)不打后端,中右栏由子组件
			// 就着 props.fields 同步自算 —— 本次 setState 提交时子组件已随新 fields 渲完,
			// 故就在它的回调里盖章(markPanelReady 内部再双 rAF 逼近「本帧已绘」)。
			// horosa_panel_ready_attribution_key_v1:参数必须是页签归属键(moduleKey ==
			// currentTab:shusuan/mingother/yanqin),不是 serviceKey('shaozi' 等)——
			// perfMark 的归属校验按 currentTab 配对,键不一致时样本被静默丢弃(验收恒零样本)。
			this.setState({ loading: false, pan: null }, ()=>{
				markPanelReady(this.props.hostModuleKey || this.config.moduleKey);
			});
			return;
		}
		const payload = this.buildPayload(fields);
		if(!payload){
			return;
		}
		// 同输入去重:若一模一样的请求(serviceKey+payload)已在途,跳过(在途那次的结果会落到当前盘)。
		// 起盘一次会经 clickPlot→onFieldsChange→dispatch→save(props 变 didUpdate)+doHook(hook 回调)两路
		// 对同一 payload 重复触发;此处把真正的网络请求收敛为 1 次。输入任何变化 → sig 变 → 照常重排。
		const sig = `${this.config.serviceKey}|${JSON.stringify(payload)}`;
		if(this._inFlightSig === sig){
			return;
		}
		// 双触发收敛:上面只挡「在途」同签名;缓存命中时第一路瞬间落地,挂钩 / 更新钩子的后几路仍会整套重来 →
		// 同签名在同一拍(见 utils/singleTrigger 时间窗)内再次触发也跳过。
		const panTrig = claimTrigger(this, 'fetchPan', sig);
		if(!panTrig){
			return;
		}
		const reqSeq = ++this.requestSeq;
		this._inFlightSig = sig;
		this.setState({ loading: true });
		try{
			const pan = await postKinAstro(this.config.serviceKey, payload);
			if(this._inFlightSig === sig){
				this._inFlightSig = null;
			}
			if(this.unmounted || reqSeq !== this.requestSeq){
				return;
			}
			this.setState({ pan, loading: false }, ()=>{
				// horosa_panel_ready_v1:这一次 setState 才是「盘落定」——中栏盘面与右栏各段
				// 都由 pan 派生,故本回调即「点击 → 中右栏画完」的终点。必须是首行:放在
				// saveKinAstroAISnapshots 之后会把快照序列化的耗时算进交互预算里。
				// 键契约(horosa_panel_ready_attribution_key_v1):页签归属键(hostModuleKey 优先)。
				markPanelReady(this.props.hostModuleKey || this.config.moduleKey);
				saveKinAstroAISnapshots(this.config, pan, this.tiebanFrameworkSuffix(pan), this.props.hostModuleKey, this.props.fields);
				// horosa_step_prefetch_arm_v1(b′):换轨/改选项后的 settle 也按当前技法武装 ±N
				//(fetchByFields settle 只覆盖时间派发路径;/chart 不在本页步进路径上)。
				try{ armStepPrefetch('local-settle', { fieldsOverride: fields, skipChart: true }); }catch(e){ /* 武装失败静默 */ }
			});
		}catch(e){
			if(this._inFlightSig === sig){
				this._inFlightSig = null;
			}
			settleTrigger(this, 'fetchPan', panTrig, false);
			console.warn('kinastro backend failed', this.config.serviceKey, e);
			if(!this.unmounted && reqSeq === this.requestSeq){
				this.setState({ loading: false });
			}
		}
	},

	setRightPanelTab(key){
		this.setState({ rightPanelTab: key });
	},

	// ── horosa_kinastro_render_memo_v1(PERF-R9 Ship 6)──────────────────────────
	// 「影响盘面/快照产出」的选项签名。中栏 memo 槽、快照缓存、可见页签缓存三处共用它。
	// 🔴 只许多写不许少写:少一项 = 那项改了而中栏不刷新(功能降级),多一项只是少省一点。
	//    收录判据 = 被 renderCenter/renderTiebanFramework/tiebanFrameworkOf 读到的 state。
	//    (pan 自身与 props.fields 不进 sig,由 memo 槽按【引用】另行比较。)
	//    另收中宫内容档位:策天/演禽中栏经 buildKinAstroZiWeiChart → readKinCenterContent 读本机存的档位
	//    (不在 state 里;下拉改档只 bump centerContentRev 逼重渲),不进签名则改档后中栏停在旧档。
	kinSig(){
		return [
			this.config.serviceKey,
			this.state.gender,
			this.state.tiebanSchool, this.state.tiebanKeSystem, this.state.tiebanKe,
			this.state.tiebanTwinFen, this.state.tiebanGuofang,
			readKinCenterContent(this.config.serviceKey),
		].join('|');
	},

	// 快照文本:此前 renderRightPanel 与 renderBottomQuickDock 各算一遍(每次重渲两趟
	// buildSnapshotText 全段拼接 + tiebanFrameworkSuffix→buildTiebanFramework 整套框架推演)。
	// 按 (pan 引用, kinSig) 缓存;二者任一变即重算,产出逐字节同前。
	snapshotText(){
		const pan = this.state.pan;
		const sig = this.kinSig();
		if(this._snapCache && this._snapCache.pan === pan && this._snapCache.sig === sig){
			return this._snapCache.text;
		}
		const base = buildSnapshotText(pan);
		const suffix = this.tiebanFrameworkSuffix(pan);
		const text = suffix ? `${base}\n\n${suffix}` : base;
		this._snapCache = { pan, sig, text };
		return text;
	},

	// 可见子页签:同上,原先右栏与底部快捷栏各跑一遍(每个候选页签都要 getTabSections 过滤全段)。
	visibleTabsOf(snapshot){
		const pan = this.state.pan;
		const sig = this.kinSig();
		if(this._tabsCache && this._tabsCache.pan === pan && this._tabsCache.sig === sig
			&& this._tabsCache.snapshot === snapshot){
			return this._tabsCache.tabs;
		}
		const tabs = this.config.tabs.filter((item)=>{
			if(item.key === 'yanfa'){
				return this.config.serviceKey === 'xianqin';
			}
			if(!pan){
				return item.key === 'overview' || item.key === 'snapshot';
			}
			if(item.key === 'snapshot'){
				return !!snapshot;
			}
			if(item.key === 'classics'){
				const classics = pan && pan.classics;
				return !!(classics && classics.sections && classics.sections.length);
			}
			if(item.key === 'settings'){
				return this.config.serviceKey === 'cetian';
			}
			if(item.key === 'framework'){
				return this.config.serviceKey === 'tieban' && !!pan;
			}
			return this.getTabSections(item.key).length > 0;
		});
		this._tabsCache = { pan, sig, snapshot, tabs };
		return tabs;
	},

	// 下传给 native 子技法的 opts:此前每次 render 都新造对象 → 子组件 props 引用必变 →
	// 子组件那边任何 props 浅比 sCU 都恒失效。此处按 JSON 签名固定引用:值不变 = 引用不变。
	// (值一变即换新对象 → 子组件照常重渲;不缓存计算结果,只稳定引用。)
	memoOpts(name, obj){
		const sig = JSON.stringify(obj);
		const store = this._optsMemo || (this._optsMemo = {});
		const cur = store[name];
		if(cur && cur.sig === sig){
			return cur.value;
		}
		store[name] = { sig, value: obj };
		return obj;
	},

	// 中栏槽:后端盘技法走 memo(左栏改与盘无关的选项时不再重造整张盘);
	// native 技法中栏是子组件、由其自身 sCU 把关,此处透传不加层。
	renderCenterSlot(){
		if(this.config.native){
			return this.renderCenter();
		}
		return (
			<MemoSlot
				pan={this.state.pan}
				fields={this.props.fields}
				sig={this.kinSig()}
				render={()=>this.renderCenter()}
			/>
		);
	},

	// 一掌经右栏页签由它自己的组件画;这里记当前页,底部快捷栏才能点得到、亮得对。
	setYizhangjingTab(key){
		this.setState({ yizhangjingTab: key });
	},
};
