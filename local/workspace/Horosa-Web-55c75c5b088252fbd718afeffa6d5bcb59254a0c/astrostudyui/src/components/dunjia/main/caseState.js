// 奇门页 · 事盘 / 命盘回灌、关联人物、存案与另存命盘、AI 快照刷新
// 从 DunJiaMain.js 按职责拆出的 DunJiaMain 方法:this 仍是 DunJiaMain 实例,门面里 mixinMethods(DunJiaMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { getStore } from '../../../utils/storageutil';
import { caseRestoreKey, caseFieldSnapshot, caseGenderValue } from '../../../utils/kentangCaseSave';
import { listLocalCharts } from '../../../utils/localcharts';
import { birthToYearGan } from '../DunJiaCalc';
import { DEFAULT_OPTIONS, DUNJIA_PAGE_SETTINGS, normalizeKenQimenOptions } from './options';
import { saveQimenLiveSnapshot, getFieldKey, getNongliRequestKey, sameRelatedPeople } from './pageState';

export const caseStateMethods = {
	// 外部性别 → 标签型 sex:函数式 setState,叠在同一次更新里先排下的还原(载入存案 / 命盘)之上。
	// 此前走 onOptionChange 按 this.state.options(还原前的旧值)拼整份 options:性别与当前盘不同的存案一载入,
	// 刚还原的盘面选项被冲回旧值(只有 sex 是新的)。镜像标明是性别同步(宿主只跟这一项)
	syncSexFromFields(sex){
		let changed = false;
		this.setState((s)=>{
			if(!s.options || s.options.sex === sex){ return null; }
			changed = true;
			return { options: normalizeKenQimenOptions({ ...s.options, sex }) };
		}, ()=>{
			if(!changed || this.unmounted){ return; }
			const options = this.state.options;
			if(typeof this.props.onOptionsChange === 'function'){
				this.props.onOptionsChange({ ...options }, { source: 'gender-sync' });
			}
			this.replotAfterOptionChange('sex', options);
		});
	},

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== this.scope){
			return;
		}
		if(this.state.pan){
			this.applyFaRelatedToPan(this.state.pan);
			const snapshotText = this.saveLiveSnapshot(this.state.pan);
			if(snapshotText){
				saveModuleAISnapshot(this.scope, snapshotText);
				if(evt && evt.detail && typeof evt.detail === 'object'){
					evt.detail.snapshotText = snapshotText;
				}
			}
		}
	},

	// scope 感知的 live 快照单入口:类内 5 条产快照链一律走此,禁止直调模块函数(契约测试锁)。
	saveLiveSnapshot(pan){
		return saveQimenLiveSnapshot(pan, this.scope, this.props.composeAiSnapshot);
	},

	parseCasePayload(raw){
		if(!raw){
			return null;
		}
		if(typeof raw === 'string'){
			try{
				return JSON.parse(raw);
			}catch(e){
				return null;
			}
		}
		if(typeof raw === 'object'){
			return raw;
		}
		return null;
	},

	// 载入事盘 / 带奇门设置的命盘时,记录里**没有**的口径键回出厂值,而不是留着本机保存的偏好:本页口径现在跨会话保留,
	// 按出厂口径存下的旧记录不带后来才有的键,不回出厂就会被按你现在的偏好重排(盘变了,与存档里的快照也对不上)。
	// 本函数只回答「回出厂之后,与当前 state 比有没有变」—— 记录里的键随后照旧逐个盖上去。
	persistedKeysChanged(nextOptions){
		const cur = this.state.options || {};
		return DUNJIA_PAGE_SETTINGS.fields.some((k)=>nextOptions[k] !== cur[k]);
	},

	restoreOptionsFromCurrentCase(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		// 读档去重键走共用件(kentangCaseSave.caseRestoreKey,只认显式载入):同一条记录再载入一次必换键;
		// 编辑 / 存为事盘 / 保存编辑换掉的当前事盘不是载入 → null,不还原。禁另拼一份。
		const caseVersion = caseRestoreKey(this.scope, userState);
		if(!caseVersion){
			return;
		}
		if(!force && this.lastRestoredCaseId === caseVersion){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		if(sourceModule !== this.scope && caseType !== this.scope){
			return;
		}
		// 真载入一条本页事盘:取数中排下的外部起盘(择日点结果行)作废 —— 以后发生的载入为准,不让取数落地后补起的旧点选盖掉
		this._queuedExternalPlot = null;
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload){
			return;
		}
		const nextOptions = {
			...this.state.options,
			...DUNJIA_PAGE_SETTINGS.defaults(),   // 事盘里没有的口径键回出厂值(见 persistedKeysChanged 注)
		};
		let changed = this.persistedKeysChanged(nextOptions);
		const savedOptions = payload.options && typeof payload.options === 'object' ? payload.options : null;
		if(savedOptions){
			Object.keys(DEFAULT_OPTIONS).forEach((key)=>{
				if(savedOptions[key] !== undefined){
					nextOptions[key] = savedOptions[key];
					changed = true;
				}
			});
		}
		const pan = payload.pan && typeof payload.pan === 'object' ? payload.pan : null;
		if(pan){
			if(pan.shiftPalace !== undefined){
				nextOptions.shiftPalace = pan.shiftPalace;
				changed = true;
			}
			if(pan.fengJu !== undefined){
				nextOptions.fengJu = !!pan.fengJu;
				changed = true;
			}
		}
		const nextFaRelated = Array.isArray(payload.faRelatedPeople) ? payload.faRelatedPeople : [];
		if(!sameRelatedPeople(nextFaRelated, this.state.faRelatedPeople)){
			changed = true;
		}
		this.lastRestoredCaseId = caseVersion;
		if(!changed){
			return;
		}
		this.setState({
			options: nextOptions,
			faRelatedPeople: nextFaRelated,
			chartCategory: 'shi',
		}, ()=>{
			// 重排按提交后的最终选项(同一批里外部性别同步叠上的 sex 已在里面;没有同批改动时就等于 nextOptions)
			const finalOptions = this.state.options || nextOptions;
			const calcFields = this.state.localFields || this.props.fields;
			const calcFieldKey = getFieldKey(calcFields);
			const nongliKey = getNongliRequestKey(calcFields, finalOptions);
			const canRecalc = this.state.nongli
				&& calcFieldKey
				&& nongliKey
				&& nongliKey === this.lastNongliKey;
			if(this.state.hasPlotted){
				if(canRecalc){
					this.recalc(this.state.localFields || this.props.fields, this.state.nongli, finalOptions, this.state.displaySolarTime);
				}else{
					this.requestNongli(calcFields, true);
				}
			}
			if(typeof this.props.onOptionsChange === 'function'){
				// 第二参标明这是载入存案还原出来的盘面选项(宿主据此判断要不要镜像进自己的工作台,如奇门择日以存案的工作台参数为准)
				this.props.onOptionsChange({ ...nextOptions }, { source: 'case', caseVersion });
			}
		});
	},

	// —— 命盘(localCharts)往返：奇门设置存于 currentChart.payload.qimen，重开时还原；命盘本体是普通人命盘，跨技法自由使用。——
	restoreFromCurrentChart(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentChart = userState && userState.currentChart ? userState.currentChart : null;
		if(!currentChart || !currentChart.cid || !currentChart.cid.value){
			return;
		}
		const cid = `${currentChart.cid.value}`;
		const updateTime = currentChart.updateTime && currentChart.updateTime.value ? `${currentChart.updateTime.value}` : '';
		const chartVersion = `${cid}|${updateTime}`;
		if(!force && this.lastRestoredChartId === chartVersion){
			return;
		}
		const payload = this.parseCasePayload(currentChart.payload ? currentChart.payload.value : null);
		const qimen = payload && payload.qimen && typeof payload.qimen === 'object' ? payload.qimen : null;
		// 标记已处理此命盘版本（无论是否带奇门设置，避免反复触发）。
		this.lastRestoredChartId = chartVersion;
		// 换了一张命盘(主盘时间地点随之改了):取数中排下的外部起盘作废,以后发生的载入为准(与载入事盘同)
		this._queuedExternalPlot = null;
		if(!qimen){
			return;
		}
		const nextOptions = { ...this.state.options, ...DUNJIA_PAGE_SETTINGS.defaults() };   // 命盘里没有的口径键回出厂值(见 persistedKeysChanged 注)
		let changed = this.persistedKeysChanged(nextOptions);
		const savedOptions = qimen.options && typeof qimen.options === 'object' ? qimen.options : null;
		if(savedOptions){
			Object.keys(DEFAULT_OPTIONS).forEach((key)=>{
				if(savedOptions[key] !== undefined){
					nextOptions[key] = savedOptions[key];
					changed = true;
				}
			});
		}
		const nextFaRelated = Array.isArray(qimen.faRelatedPeople) ? qimen.faRelatedPeople : [];
		if(!sameRelatedPeople(nextFaRelated, this.state.faRelatedPeople)){
			changed = true;
		}
		if(!changed){
			return;
		}
		this.setState({
			options: nextOptions,
			faRelatedPeople: nextFaRelated,
			chartCategory: 'ming',
		}, ()=>{
			// 重排按提交后的最终选项(同一批里外部性别同步叠上的 sex 已在里面;没有同批改动时就等于 nextOptions)
			const finalOptions = this.state.options || nextOptions;
			const calcFields = this.state.localFields || this.props.fields;
			const calcFieldKey = getFieldKey(calcFields);
			const nongliKey = getNongliRequestKey(calcFields, finalOptions);
			const canRecalc = this.state.nongli
				&& calcFieldKey
				&& nongliKey
				&& nongliKey === this.lastNongliKey;
			if(this.state.hasPlotted){
				if(canRecalc){
					this.recalc(this.state.localFields || this.props.fields, this.state.nongli, finalOptions, this.state.displaySolarTime);
				}else{
					this.requestNongli(calcFields, true);
				}
			}
			if(typeof this.props.onOptionsChange === 'function'){
				this.props.onOptionsChange({ ...nextOptions });
			}
		});
	},

	// 把当前选中的「相关人员」捕获快照写到 pan 上（单源：快照/导出/挂载/储存全读 pan.faRelatedPeople）。
	applyFaRelatedToPan(pan){
		const arr = Array.isArray(this.state.faRelatedPeople) ? this.state.faRelatedPeople : [];
		if(pan){
			pan.faRelatedPeople = arr;
		}
		// 同步全局当前选择，供 AI 挂载里「重算 pan（未 stamp）」的路径兜底，确保四同步无遗漏。
		// 全局兜底槽只属独立奇门页;择日页实例的 pan 恒已 stamp,不需也不得竞写全局。
		if(typeof window !== 'undefined' && this.scope === 'qimen'){
			window.__horosa_qimen_related_people = arr;
		}
		return pan;
	},

	// 命盘库全部人 → 多选项（label 带生年干）；生年干按 cid+birth 缓存，避免下拉重复计算。并入当前已选(防源命盘被删后标签丢失)。
	getRelatedPeopleOptions(){
		let list = [];
		try{
			list = listLocalCharts() || [];
		}catch(e){
			list = [];
		}
		this._yearGanCache = this._yearGanCache || {};
		const opts = [];
		const seen = {};
		list.forEach((c)=>{
			if(!c || !c.cid){
				return;
			}
			const key = `${c.cid}|${c.birth}`;
			let yg = this._yearGanCache[key];
			if(yg === undefined){
				yg = birthToYearGan(c.birth) || '';
				this._yearGanCache[key] = yg;
			}
			const name = c.name ? `${c.name}` : '未命名';
			opts.push({ value: `${c.cid}`, name, yearGan: yg, label: `${name}·${yg || '?'}年` });
			seen[`${c.cid}`] = true;
		});
		(this.state.faRelatedPeople || []).forEach((p)=>{
			if(p && p.cid && !seen[`${p.cid}`]){
				const name = p.name ? `${p.name}` : '未命名';
				opts.push({ value: `${p.cid}`, name, yearGan: p.yearGan || '', label: `${name}·${p.yearGan || '?'}年` });
				seen[`${p.cid}`] = true;
			}
		});
		return opts;
	},

	onRelatedPeopleChange(cids){
		const opts = this.getRelatedPeopleOptions();
		const byCid = {};
		opts.forEach((o)=>{ byCid[o.value] = o; });
		const people = (cids || []).map((cid)=>{
			const o = byCid[`${cid}`];
			return o ? { cid: o.value, name: o.name, yearGan: o.yearGan } : { cid: `${cid}`, name: '', yearGan: '' };
		});
		this.setState({ faRelatedPeople: people }, ()=>{
			const pan = this.state.pan;
			// 总是同步全局当前选择(即使尚未起盘),供 AI 挂载兜底。
			this.applyFaRelatedToPan(pan);
			if(pan){
				const snapshotText = this.saveLiveSnapshot(pan);
				if(snapshotText){
					saveModuleAISnapshot(this.scope, snapshotText);
				}
				this.forceUpdate();
			}
		});
	},

	onChartCategoryChange(value){
		const cat = value === 'ming' ? 'ming' : 'shi';
		this.setState({ chartCategory: cat }, ()=>{
			// 切换命/事局后重戳 pan 并刷新 AI 快照，使「用神/化解/全局速览」的命事语义与挂载/导出即时同步。
			const pan = this.state.pan;
			if(pan){
				if(pan.options){ pan.options.chartCategory = cat; }
				const snapshotText = this.saveLiveSnapshot(pan);
				if(snapshotText){
					saveModuleAISnapshot(this.scope, snapshotText);
				}
			}
		});
	},

	clickSaveCase(){
		const pan = this.state.pan;
		if(!pan){
			message.warning('请先起盘后再保存');
			return;
		}
		const flds = this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		this.applyFaRelatedToPan(pan);
		const faRelated = Array.isArray(this.state.faRelatedPeople) ? this.state.faRelatedPeople : [];
		const fixedOptions = {
			...this.state.options,
			fengJu: !!this.state.options.fengJu,
		};
		// 命盘：复用命盘库(localCharts)，奇门设置存 payload.qimen；命盘本体跨技法自由使用。
		if(this.state.chartCategory === 'ming'){
			this.saveAsMingChart(flds, fixedOptions, faRelated);
			return;
		}
		// 事盘：案例库(localCases)。payload 增 faRelatedPeople 以便重开还原。
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		// 保存前先按当前盘刷一次槽(composeAiSnapshot 会并入宿主最新找局结果):此前直读槽 →
		// 「找局→不 pick→保存」的 payload.snapshot [命中时辰] 是找局前旧文,而 payload.zeri.results 是新的 → AI 说「尚未找局」。
		if(this.state.pan){ try{ this.saveLiveSnapshot(this.state.pan); }catch(_e){ /* 刷槽失败退回旧槽 */ } }
		const snapshot = loadModuleAISnapshot(this.scope);
		// [奇门择日] 宿主附加负载(如 zeri 工作台态)先铺底,核心键恒后置覆盖,防外部键顶掉本体。
		const extra = typeof this.props.casePayloadExtra === 'function' ? (this.props.casePayloadExtra() || {}) : {};
		const payload = {
			...extra,
			module: this.scope,
			snapshot: snapshot,
			pan: pan,
			// 盘类(命局/事局)不在 state.options 里,单独并入 —— 缺它则挂载重算恒退事局,「盘类：」行与存档打架。
			options: { ...fixedOptions, chartCategory: this.state.chartCategory },
			faRelatedPeople: faRelated,
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `${this.props.caseEventPrefix || '奇门占断'} ${divTime}`,
						caseType: this.scope,
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						gender: caseGenderValue(flds),
						// 🔴 口径快照必带:载档时 applyCase 从 payload.fieldSnapshot 回灌日界点/晚子时/
						// 卦日界/时间算法;不带则沿用全局当前值 → 载回来的盘可能与存档不同。
						payload: { ...payload, fieldSnapshot: caseFieldSnapshot(flds) },
						sourceModule: this.scope,
					},
				},
			});
		}
	},

	// 保存为「命盘」：始终弹出「新增星盘」抽屉(复用命盘管理新增流程)，用户填姓名后入命盘库 localCharts。
	// birth/经纬度/性别已预填完整、奇门设置塞进 payload.qimen；命盘是普通人盘、日后可被占星/八字等任意技法自由使用。
	saveAsMingChart(flds, fixedOptions, faRelated){
		const qimenSettings = {
			options: { ...fixedOptions, chartCategory: 'ming' },   // 盘类随盘记下(载入恒为命局;AI 挂载重算同此)
			faRelatedPeople: faRelated,
			version: 1,
		};
		if(this.props.dispatch){
			const birthStr = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
			// 注入完整人盘信息(起局时间作生时 + 经纬度/地名/性别)，使新建命盘在「命盘管理」里信息完整。
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'chartadd',
					record: {
						birth: birthStr,
						zone: flds.zone ? flds.zone.value : undefined,
						lat: flds.lat ? flds.lat.value : undefined,
						lon: flds.lon ? flds.lon.value : undefined,
						gpsLat: flds.gpsLat ? flds.gpsLat.value : undefined,
						gpsLon: flds.gpsLon ? flds.gpsLon.value : undefined,
						pos: flds.pos ? flds.pos.value : undefined,
						gender: this.state.options ? this.state.options.sex : undefined,
						payload: { qimen: qimenSettings },
					},
				},
			});
		}
	},
};
