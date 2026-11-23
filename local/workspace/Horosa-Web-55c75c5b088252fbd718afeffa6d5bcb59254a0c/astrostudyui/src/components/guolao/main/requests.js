// 七政四余页 · 取盘:命盘 / 规则 / 流时盘 / 七政盘请求与整组取数、AI 快照保存与刷新
// 从 GuoLaoChartMain.js 按职责拆出的 GuoLaoChartMain 方法:this 仍是 GuoLaoChartMain 实例,门面里 mixinMethods(GuoLaoChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { claimTrigger, settleTrigger, identityOf } from '../../../utils/singleTrigger';
import * as Constants from '../../../utils/constants';
import { GUOLAO_CHART_STYLE_QIZHENG } from '../GuoLaoChartStyle';
import { fetchKinastroQizheng, fetchMoiraQizhengRules } from '../../../services/qizheng';
import { saveModuleAISnapshot, saveModuleAISnapshotLazy } from '../../../utils/moduleAiSnapshot';
import { isIncompleteMoiraRules } from './format';
import { clonePlain, applyGuolaoNodeMode, hasGuolaoRiseSetFields } from './aspectsNodeMode';
import { GUOLAO_SU28_CACHE_REV, guolaoMem, pushCache, buildGuolaoKey, isChartObjMatchParams, isChartObjSameNatal, fetchGuolaoChartCached, GUOLAO_COMPOSITE_EMPTY } from './chartCache';
import { computeGuolaoSeedPatch, fieldsToParams, paramsWithMoiraTransit } from './params';
import { buildLocalMoiraRules, buildGuolaoSnapshotTextV2, guolaoSnapshotMeta } from './snapshot';
import { natalSourceKey, pickKeyedDerived } from '../../../utils/derivedChartSource';
import { guolaoMergedPaintEnabled } from '../../../utils/perfFlags';
import { markPanelReady } from '../../../utils/perfMark';
import { peekCachedPost } from '../../../services/_requestCache';
import { stableMoiraKey } from '../../../services/qizheng';

export const requestMethods = {
	async requestKinastroQizheng(){
		if(!this.props.fields || this.unmounted){
			return null;
		}
		const params = this.genParams();
		if(!params){
			return null;
		}
		const plotFields = this.props.fields;   // genParams 读的这一份
		const options = this.state.kinastroOptions || {};
		const seq = ++this.qizhengKinReqSeq;
		this.setState({
			qizhengKinLoading: true,
			qizhengKinError: '',
		});
		try{
		const pan = await fetchKinastroQizheng({
				...params,
				// fieldsToParams 不含 gender,后端 data.get("gender") 缺省男 → 女命大运与断语恒按男排;此处补透传(1/0 → 后端 gender_cn)。
				gender: (this.props.fields && this.props.fields.gender && this.props.fields.gender.value !== undefined && this.props.fields.gender.value !== null) ? this.props.fields.gender.value : undefined,
				qizhengKinCurrentYear: options.currentYear,
				qizhengKinTransitMode: options.transitMode || 'none',
				qizhengKinTransitDate: options.transitDate || '',
				qizhengKinTransitTime: options.transitTime || '',
				qizhengKinElectionalStartDate: options.electionalStartDate || '',
				qizhengKinElectionalCriteria: options.electionalCriteria || 'general',
				qizhengKinElectionalDays: options.electionalDays || 30,
			});
			if(this.unmounted || seq !== this.qizhengKinReqSeq){
				return pan;
			}
			this._plottedFields = plotFields;
			this.setState({
				qizhengKinPan: pan,
				qizhengKinPanSig: natalSourceKey(params),
				qizhengKinLoading: false,
				qizhengKinError: '',
			}, ()=>{
				// horosa_panel_ready_v1:坚七政(kinastro 引擎)分支的唯一落定点 —— 中栏七政轮
				// 与右栏信息 Tabs 同吃 qizhengKinPan,这一次 setState 之后两栏全部画完。
				markPanelReady('guolao');
			});
			// 🔴 全站共用槽只归主页实例写(择日内嵌实例写它=候选时刻内容污染主页槽,审查实抓)
			if(pan && pan.snapshot && (this.props.techniqueScope || 'guolao') === 'guolao'){
				saveModuleAISnapshot('guolao-qizhengkin', pan.snapshot, {
					date: params.date,
					time: params.time,
					zone: params.zone,
					lon: params.lon,
					lat: params.lat,
				});
			}
			return pan;
		}catch(e){
			if(!this.unmounted && seq === this.qizhengKinReqSeq){
				this.setState({
					qizhengKinLoading: false,
					qizhengKinError: e && e.message ? e.message : '七政四余服务暂不可用',
				}, ()=>{
					// horosa_panel_ready_v1:坚七政失败终态(错误卡上屏即本次交互结束)。
					markPanelReady('guolao');
				});
			}
			return null;
		}
	},

	// 每张新开 / 未存的盘都按本机仓补空(与「新盘种子」同义):不再只在本实例首开时补一次 —— 页面常驻,
	// 本次运行里后来新开的命盘若不补,就按出厂值起盘,要重开软件才跟本机仓。补空本身幂等(只补仍是 schema 初值、
	// 且与本机仓不同的键;左栏改值时同时写本机仓),载入了记录(cid)、择日内嵌一律不补,见 computeGuolaoSeedPatch。
	ensureGuolaoDefaults(){
		if(!this.props.fields || !this.props.dispatch){
			return false;
		}
		const patch = computeGuolaoSeedPatch(this.props.fields, { embedded: (this.props.techniqueScope || 'guolao') !== 'guolao' });
		if(!Object.keys(patch).length){
			return false;
		}
		this.onFieldsChange(patch);
		return true;
	},

	applyChartObj(params, chartObj){
		if(!params || !chartObj || this.unmounted){
			return;
		}
		const key = buildGuolaoKey(params);
		if(key){
			pushCache(guolaoMem, key, clonePlain(chartObj));
		}
		const displayChartObj = applyGuolaoNodeMode(chartObj, this.props.fields);
		// 合批渲染(用户钦定「算好一起出」):主盘暂存,与流年盘+rules 在 commitMoiraPanel 一次放行,
		// 消除 框→主盘→神煞 三段跳。rules 链任何失败路径都有 local-fallback 兜底 commit,不会卡 loading。
		this._pendingMoiraChartObj = displayChartObj;
		this.setState({
			moiraLoading: true,
		});
		this.saveGuolaoAISnapshot(params, displayChartObj);
		this.requestMoiraTransitChart(params, displayChartObj);
	},

	commitMoiraPanel(rules, params, chartObj, transitParams, transitChartObj){
		const nextTransitParams = transitParams || paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const pendingChartObj = this._pendingMoiraChartObj;
		this._pendingMoiraChartObj = null;
		this.setState({
			...(pendingChartObj ? { chartObj: pendingChartObj } : {}),
			// 流年盘与主盘/rules 同批放行(彻底合批:盘面一次成型,不显示半成品)。
			...(transitChartObj ? { moiraTransitChartObj: transitChartObj, moiraTransitChartObjSig: natalSourceKey(params) } : {}),
			moiraRules: rules,
			moiraPanelChartObj: clonePlain(chartObj),
			moiraPanelTransitChartObj: clonePlain(transitChartObj || this.shownMoiraTransitChartObj()),
			moiraPanelTransitParams: clonePlain(nextTransitParams),
			moiraLoading: false,
		}, ()=>{
			// horosa_panel_ready_v1:旧多段路径的**唯一**终点(applyChartObj→requestMoiraTransitChart
			// →requestMoiraRules 全部汇入此处),中栏盘面 + 右栏 rules 在这一次 setState 里一起落定。
			markPanelReady('guolao');
			// 规则落地即补拍快照:阶段一在 moiraRules 未归时已产首版(lazy 200-800ms
			// 即物化冻结,导出直吃缓存),不补拍则 AI 侧恒丢 [虚实]/[本命化曜]/[流年流曜] 三段、
			// [神煞] 降级历法源——页面/refresh/无头三路都等规则,唯存盘路裸拍(不同构)。
			this.saveGuolaoAISnapshot(params, pendingChartObj || chartObj || this.state.chartObj);
		});
	},

	async requestMoiraRules(params, chartObj, transitParams, transitChartObj){
		if(!params || !chartObj || this.unmounted){
			return;
		}
		const seq = ++this.moiraReqSeq;
		this.setState({
			moiraLoading: true,
		});
		let rsp = null;
		let fallbackReason = 'empty-response';
		try{
			rsp = await fetchMoiraQizhengRules({
				params: params,
				chartObj: chartObj,
				transitParams: transitParams || paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime),
				transitChartObj: transitChartObj || this.shownMoiraTransitChartObj() || null,
			}, {
				silent: true,
				timeoutMs: 12000,
			});
		}catch(e){
			fallbackReason = e && e.message ? e.message : 'request-error';
		}
		if(this.unmounted || seq !== this.moiraReqSeq){
			return;
		}
		const remoteRules = rsp && rsp[Constants.ResultKey] ? rsp[Constants.ResultKey] : null;
		const rules = isIncompleteMoiraRules(remoteRules)
			? buildLocalMoiraRules(params, chartObj, this.props.fields, fallbackReason)
			: remoteRules;
		this.commitMoiraPanel(rules, params, chartObj, transitParams, transitChartObj);
	},

	async prefetchChart(params){
		if(!params){
			return null;
		}
		return fetchGuolaoChartCached(params, {
			silent: true,
		});
	},

	async requestMoiraTransitChart(baseParams, baseChartObj){
		if(!this.props.fields || this.unmounted){
			return null;
		}
		const params = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		if(baseParams){
			params.lon = baseParams.lon;
			params.lat = baseParams.lat;
			params.gpsLon = baseParams.gpsLon;
			params.gpsLat = baseParams.gpsLat;
			params.doubingSu28 = baseParams.doubingSu28;
			params.guolaoZhengSidereal = baseParams.guolaoZhengSidereal;
			params.zodiacal = baseParams.zodiacal;
			params.guolaoLifeMode = baseParams.guolaoLifeMode;
			params.tradition = baseParams.tradition;
			params.strongRecption = baseParams.strongRecption;
			params.simpleAsp = baseParams.simpleAsp;
			params.virtualPointReceiveAsp = baseParams.virtualPointReceiveAsp;
			params._su28Rev = baseParams._su28Rev || GUOLAO_SU28_CACHE_REV;
		}
		const seq = ++this.moiraTransitReqSeq;
		this.setState({
			moiraTransitLoading: true,
			moiraLoading: true,
		});
		try{
			const result = await fetchGuolaoChartCached(params, {
				silent: true,
			});
			if(this.unmounted || seq !== this.moiraTransitReqSeq){
				return result;
			}
			const displayResult = applyGuolaoNodeMode(result, this.props.fields);
			const rootParams = baseParams || this.genParams();
			const rootChartObj = baseChartObj || this.state.chartObj || applyGuolaoNodeMode(this.props.value, this.props.fields);
			if(!rootParams || !rootChartObj){
				this.setState({
					...(this._pendingMoiraChartObj ? { chartObj: this._pendingMoiraChartObj } : {}),
					moiraTransitChartObj: displayResult,
					moiraTransitChartObjSig: natalSourceKey(rootParams || this.genParams()),
					moiraTransitLoading: false,
					moiraLoading: false,
				}, ()=>{
					// horosa_panel_ready_v1:无根盘/根参数的降级终点(不再走 commitMoiraPanel)。
					markPanelReady('guolao');
				});
				this._pendingMoiraChartObj = null;
				return result;
			}
			// 彻底合批(用户钦定「不显示半成品」):流年盘结果不在此放行,与主盘/rules 一并
			// 在 commitMoiraPanel 单次 setState(消除「主盘→流年环→神煞」三段跳的第二跳)。
			this.setState({
				moiraTransitLoading: false,
			});
			this.requestMoiraRules(rootParams, rootChartObj, params, displayResult);
			return result;
		}catch(e){
			if(!this.unmounted && seq === this.moiraTransitReqSeq){
				const rootParams = baseParams || this.genParams();
				const rootChartObj = baseChartObj || this.state.chartObj || applyGuolaoNodeMode(this.props.value, this.props.fields);
				this.setState({
					moiraTransitLoading: false,
				});
				if(rootParams && rootChartObj){
					this.requestMoiraRules(rootParams, rootChartObj, params, null);
				}else {
					this.setState({
						...(this._pendingMoiraChartObj ? { chartObj: this._pendingMoiraChartObj } : {}),
						moiraLoading: false,
					}, ()=>{
						// horosa_panel_ready_v1:流年盘失败且无根盘的终点。
						markPanelReady('guolao');
					});
					this._pendingMoiraChartObj = null;
				}
			}
			return null;
		}
	},

	async requestChart(params, options){
		if(!params){
			return null;
		}
		const opt = options || {};
		const applyResult = opt.applyResult !== false;
		if(!applyResult){
			return this.prefetchChart(params);
		}
		const seq = ++this.chartReqSeq;
		const result = await fetchGuolaoChartCached(params, {
			silent: opt.silent !== false,
		});
		if(!result || this.unmounted || seq !== this.chartReqSeq){
			return result;
		}
		this.applyChartObj(params, result);
		return result;
	},

	saveGuolaoAISnapshot(params, result){
		const p = params || this.genParams();
		const r = result || this.state.chartObj;
		if(!p || !r){
			return;
		}
		const planetDisplay = this.props.planetDisplay;
		const fields = this.props.fields;
		// 命主取法 / 行运法 / 童限 / 年界按本页显示偏好写(与右栏、大限环同源)
		const displayPrefs = this.state ? this.state.guolaoDisplay : null;
		saveModuleAISnapshotLazy(this.props.techniqueScope || 'guolao', ()=>{
			const base = buildGuolaoSnapshotTextV2(p, r, planetDisplay, fields, this.state ? this.state.moiraRules : null, displayPrefs) || '';
			// 择日宿主经 composeAiSnapshot 拼接择时三段(scope 化,主七政页零影响)
			if(typeof this.props.composeAiSnapshot === 'function'){
				try{ return `${this.props.composeAiSnapshot(base) || base}`; }catch(e){ return base; }
			}
			return base;
		}, guolaoSnapshotMeta(p));
	},

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」,Win 用户实测)。
	// 本组件含两个 key:guolao(果老星宗,实时构建)与 guolao-qizhengkin(七政果老,取后端预置快照)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		let text = '';
		let meta;
		try{
			if(moduleName === (this.props.techniqueScope || 'guolao')){
				const p = this.genParams();
				const r = this.state ? this.state.chartObj : null;
				// 带本盘出生签名写槽(与 saveGuolaoAISnapshot 同一份 meta):不带则刷新一次后槽失去签名,对话挂载认不出是这位命主
				meta = guolaoSnapshotMeta(p);
				if(p && r){
					text = `${buildGuolaoSnapshotTextV2(p, r, this.props.planetDisplay, this.props.fields, this.state ? this.state.moiraRules : null, this.state ? this.state.guolaoDisplay : null) || ''}`.trim();
				}
			}else if(moduleName === 'guolao-qizhengkin' && (this.props.techniqueScope || 'guolao') === 'guolao'){
				// 🔴 全站共用槽只归主页实例应答:择日内嵌实例(techniqueScope='qizhengzeri')在
				// kinastro 档下也持 qizhengKinPan,双实例都答=后注册者用**择日候选时刻**内容
				// 覆写 detail.snapshotText,主页「七政(七政)」导出被污染(审查实抓)。
				const pan = this.shownQizhengKinPan();
				text = `${(pan && pan.snapshot) || ''}`.trim();
			}else{
				return;
			}
		}catch(e){
			text = '';
		}
		if(text && moduleName === (this.props.techniqueScope || 'guolao') && typeof this.props.composeAiSnapshot === 'function'){
			try{ text = `${this.props.composeAiSnapshot(text) || text}`; }catch(e){ /* 拼接失败用基底 */ }
		}
		if(text){
			saveModuleAISnapshot(moduleName, text, meta);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	},

	requestChartObj(fields, chartObj){
		// v-guolao-moira: 收口到单闸门，禁止分步 setState（见 requestGuolaoBundle）。
		this.requestGuolaoBundle(chartObj || this.props.value);
	},

	// 一次性渲染闸门：本命盘 + 流年盘并行取齐 + Moira 规则一次性提交，期间只显示骨架/遮罩，
	// 绝不画半成品。取代旧的 requestChartObj→applyChartObj→requestMoiraTransitChart→requestMoiraRules→commitMoiraPanel 多段提交。
	async requestGuolaoBundle(srcChart){
		if(this.unmounted || this.state.engineMode === 'kinastro'){
			return;
		}
		const params = this.genParams();
		if(!params){
			return;
		}
		const plotFields = this.props.fields;   // genParams 读的这一份
		const style = this.state.chartStyle;
		// 流年盘:Moira/天星择日 在转盘上画;Horosa原盘 不画转盘但右栏「流年星曜/流年七政动态/流年落入」仍需流年盘数据,
		// 故所有样式都取流年盘(否则 classic 下右栏流年段空白显示「无数据」)。坚七政自有流年路径,不在此分支。
		const needTransit = (style !== GUOLAO_CHART_STYLE_QIZHENG);
		// 双触发收敛:同一次取盘,componentDidUpdate(props.value 换新)与 doHook 挂钩(requestChartObj)各进一次;
		// 输入(本命参数 / 流年时刻 / 盘式 / 引擎 / 源盘 / fields 身份)全同 → 第二路跳过,免整套三段重来(见 utils/singleTrigger)。
		const bundleTrig = claimTrigger(this, 'guolaoBundle', JSON.stringify([
			params, this.state.moiraTransitTime ? identityOf(this.state.moiraTransitTime) : 'now', style, this.state.engineMode,
			srcChart ? (srcChart.chartId || identityOf(srcChart)) : null, identityOf(this.props.fields),
		]));
		if(!bundleTrig){
			return;
		}
		const seq = ++this.bundleSeq;
		// 换了命主:本命 / 流年 / 规则整组复位成首次加载(骨架),在途期间不再拿上一位命主的整组盘顶着画;
		// 同一位命主只改设置 → 旧盘留存 + 遮罩「更新中」(isChartObjSameNatal)。
		if(this.state.chartObj && !isChartObjSameNatal(this.state.chartObj, params)){
			this.setState({ ...GUOLAO_COMPOSITE_EMPTY, bundleLoading: true });
		}else{
			this.setState({ bundleLoading: true });
		}
		const transitParams = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const reuse = srcChart && isChartObjMatchParams(srcChart, params) && hasGuolaoRiseSetFields(srcChart);
		// 阶段一(冷加载性能):只取本命盘并立即上屏——命盘轮完整、绝不画半成品。
		// 此前 Promise.all([本命,流年]) 把两冷盘塞同一阻塞段(后端冷算串行≈2×单盘=撞 <1s 红线);拆两段后首屏只等本命盘。
		// 流年环/流曜/格局走既有 transitLoading/moiraLoading 过渡态稍后毫秒级补入,默认显示口径不变,缓存键(byte-perfect)不动。
		let natalRaw = null;
		let natalFailed = false;   // 本命盘未取到(抛错或空回)→ 画的是回落旧盘,须报失败让同参可重试
		// 回落旧盘只许是同一位命主的(只改了设置);换了人 → 不画(不能拿上一位命主的盘顶着)
		const fallbackChart = ()=>(isChartObjSameNatal(this.state.chartObj, params) ? this.state.chartObj : null);
		try{
			natalRaw = reuse ? srcChart : await fetchGuolaoChartCached(params, {silent: true});
			if(!reuse && !natalRaw){ natalFailed = true; }
		}catch(e){
			natalFailed = !reuse;
			natalRaw = reuse ? srcChart : null;
		}
		if(seq !== this.bundleSeq || this.unmounted){
			return;
		}
		if(natalRaw && !natalFailed){ this._plottedFields = plotFields; }   // 取不到本命盘时画的是回落旧盘,不算按这份起的
		const chartObj = natalRaw ? applyGuolaoNodeMode(natalRaw, this.props.fields) : fallbackChart();
		this.setState({
			chartObj,
			moiraPanelChartObj: chartObj,
			bundleLoading: false,
			// 流年/规则后台计算中:流曜区/右栏显示过渡态,不画半成品。
			moiraLoading: !!chartObj,
			moiraTransitLoading: needTransit,
		});
		if(chartObj){
			this.saveGuolaoAISnapshot(params, chartObj);
		}
		if(!chartObj){
			settleTrigger(this, 'guolaoBundle', bundleTrig, false);   // 无盘可画 = 失败,同参允许立即重试
			// horosa_panel_ready_v1:取盘失败的终态也要收口,否则本次交互的计时会悬着、
			// 被下一次交互错配(观测口径要求每次交互恰好一条 panel-ready)。
			this.setState({ moiraLoading: false, moiraTransitLoading: false }, ()=>{
				markPanelReady('guolao');
			});
			return;
		}
		if(natalFailed){ settleTrigger(this, 'guolaoBundle', bundleTrig, false); }   // 画的是回落旧盘 → 同参允许重试

		// 阶段二(后台非阻塞):流年盘(needTransit 时)+ Moira 规则,取齐后合并。
		let transitRaw = null;
		if(needTransit){
			try{
				transitRaw = await fetchGuolaoChartCached(transitParams, {silent: true});
			}catch(e){
				transitRaw = null;
			}
			if(seq !== this.bundleSeq || this.unmounted){
				return;
			}
		}
		if(needTransit && !transitRaw){ settleTrigger(this, 'guolaoBundle', bundleTrig, false); }   // 流年盘未取到 → 同参允许重试
		const transitObj = transitRaw ? applyGuolaoNodeMode(transitRaw, this.props.fields) : null;
		// [horosa_guolao_render_slice_v1 G5] 全命中路径中间帧合并:Moira 规则已在缓存(同步窥探)
		// ⇒ 下面的规则取回是 Promise.resolve 级,跳过「先画流年环」的中间 setState,终态一次落齐
		// (终态字节一致,少一整轮重渲)。窥探为假(冷/在途)⇒ 保留中间帧 = 流年环照旧先行上屏,
		// 绝不让流年环等规则往返。窥探真而取时被 LRU 逐出的极角:流年环与规则同帧上屏,终态不变。
		// 流年盘与其来源键 moiraTransitChartObjSig 必须同帧写(shownMoiraTransitChartObj 按键比对;
		// 只写盘不写键 = 合并路径下流年环整个不显示),中间帧与终态帧都带。
		const rulesPeekHit = guolaoMergedPaintEnabled()
			&& peekCachedPost('qizheng/moira', stableMoiraKey({ params, transitParams }));
		if(!rulesPeekHit){
			this.setState({
				moiraTransitChartObj: transitObj,
				moiraTransitChartObjSig: natalSourceKey(params),
				moiraTransitLoading: false,
			});
		}
		let rsp = null;
		let fallbackReason = 'empty-response';
		try{
			rsp = await fetchMoiraQizhengRules({
				params,
				chartObj,
				transitParams,
				transitChartObj: transitObj,
			}, {
				silent: true,
				timeoutMs: 12000,
			});
		}catch(e){
			fallbackReason = e && e.message ? e.message : 'request-error';
		}
		if(seq !== this.bundleSeq || this.unmounted){
			return;
		}
		if(!rsp){ settleTrigger(this, 'guolaoBundle', bundleTrig, false); }   // 规则未取到(走了本地回落)→ 同参允许重试
		const remoteRules = rsp && rsp[Constants.ResultKey] ? rsp[Constants.ResultKey] : null;
		const rules = isIncompleteMoiraRules(remoteRules)
			? buildLocalMoiraRules(params, chartObj, this.props.fields, fallbackReason)
			: remoteRules;
		this.setState({
			moiraRules: rules,
			// G5:流年盘字段并入终态帧(慢路径下与中间帧同引用 = 幂等无额外工作;
			// 合并路径下这里是它唯一的落点)。来源键同帧写(见上 G5 注)。
			moiraTransitChartObj: transitObj,
			moiraTransitChartObjSig: natalSourceKey(params),
			moiraPanelChartObj: chartObj,
			moiraPanelTransitChartObj: transitObj,
			moiraPanelTransitParams: transitParams,
			moiraLoading: false,
			moiraTransitLoading: false,
		}, ()=>{
			// horosa_panel_ready_v1:主路径(单闸门 requestGuolaoBundle)终点 —— 中栏命盘轮 + 流年环
			// + 右栏 Moira 面板(rules/流曜/格局)全部落定的那一次 setState。
			markPanelReady('guolao');
			// 同 commitMoiraPanel:阶段二规则取齐即补拍,快照终版带全 Moira 段。
			this.saveGuolaoAISnapshot(params, chartObj);
		});
	},

	// 当前命主来源键(按 fields 身份记一次)
	curNatalSig(){
		if(this._natalSigFields !== this.props.fields){
			this._natalSigFields = this.props.fields;
			let p = null;
			try{ p = this.genParams(); }catch(e){ p = null; }
			this._natalSig = natalSourceKey(p);
		}
		return this._natalSig;
	},

	// 流年盘 / 七政四余盘只用出自当前命主的那份:换命主后新盘在途 / 取失败时不拿上一位命主的
	shownMoiraTransitChartObj(){
		return pickKeyedDerived(this.state.moiraTransitChartObj, this.state.moiraTransitChartObjSig, this.curNatalSig());
	},

	shownQizhengKinPan(){
		return pickKeyedDerived(this.state.qizhengKinPan, this.state.qizhengKinPanSig, this.curNatalSig());
	},

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields);
		return params;
	},
};
