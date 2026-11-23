// 六爻页 · 事盘回灌、断卦设置改值、右栏页签、存案与快照刷新
// 从 GuaZhanMain.js 按职责拆出的 GuaZhanMain 方法:this 仍是 GuaZhanMain 实例,门面里 mixinMethods(GuaZhanMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import * as AstroConst from '../../../constants/AstroConst';
import { Gua64 } from '../../gua/GuaConst';
import { analyzeLiuyao } from '../../gua/liuyaoFacade';
import { normalizeLiuyaoSettings, applyPreset, factoryLiuyaoSettings, setOption, selectionDelta, applySelectionDelta, loadPersistedLiuyaoSettings, persistLiuyaoSettings } from '../../gua/liuyaoSchools';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { getStore } from '../../../utils/storageutil';
import { caseRestoreKey, caseFieldSnapshot, currentCaseFieldsPatch } from '../../../utils/kentangCaseSave';
import { buildGuaSnapshotText } from './snapshot';

export const caseStateMethods = {
	// 生爻配色按访问时读当前调色板(切明暗后新爻即新色);构造期数组会把旧主题的色存死
	get genColor(){
		return [
			AstroConst.AstroColor.Stroke,
			AstroConst.AstroColor.Mars || '#a01306',
			AstroConst.AstroColor.MC || '#948e33',
			AstroConst.AstroColor['Purple Clouds'] || '#7b5cbc',
			AstroConst.AstroColor.Jupiter || '#0b0e66',
		];
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

	restoreFromCurrentCase(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		// 读档去重键走共用件(kentangCaseSave.caseRestoreKey,只认显式载入):同一条记录再载入一次必换键;
		// 编辑 / 存为事盘 / 保存编辑换掉的当前事盘不是载入 → null,不还原。禁另拼一份。
		const caseVersion = caseRestoreKey('guazhan', userState);
		if(!caseVersion){
			return;
		}
		if(!force && this.lastRestoredCaseId === caseVersion){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		if(sourceModule !== 'guazhan' && caseType !== 'liuyao'){
			return;
		}
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload){
			return;
		}
		const rawState = payload.gua && typeof payload.gua === 'object'
			? payload.gua
			: (payload.state && typeof payload.state === 'object' ? payload.state : null);
		if(!rawState){
			return;
		}
		const empty = this.emptyYao();
		const rawYao = rawState.yao instanceof Array ? rawState.yao : [];
		const yao = empty.map((item, idx)=>{
			const one = rawYao[idx] || {};
			const value = one.value === 0 || one.value === 1 ? one.value : item.value;
			return {
				...item,
				value: value,
				change: !!one.change,
				name: one.name !== undefined ? one.name : item.name,
				god: one.god !== undefined ? one.god : item.god,
				color: one.color || item.color,
			};
		});
		const nextState = {
			yao: yao,
			currentGua: rawState.currentGua !== undefined ? rawState.currentGua : null,
			// 旧档(v2 之前)无此键:一律按「一次性成卦」还原,宁可少重算也绝不重摇覆盖存档卦象。
			guaOrigin: rawState.guaOrigin === 'time' ? 'time' : (rawState.guaOrigin || 'restored'),
			nongli: rawState.nongli && typeof rawState.nongli === 'object' ? rawState.nongli : null,
			guaDesc: rawState.guaDesc && typeof rawState.guaDesc === 'object' ? rawState.guaDesc : null,
			custGuaDongYao: rawState.custGuaDongYao !== undefined ? rawState.custGuaDongYao : -1,
			numGuaDongYao: rawState.numGuaDongYao !== undefined ? rawState.numGuaDongYao : -1,
			upGuaIdx: rawState.upGuaIdx !== undefined ? rawState.upGuaIdx : null,
			downGuaIdx: rawState.downGuaIdx !== undefined ? rawState.downGuaIdx : null,
			number: rawState.number !== undefined ? rawState.number : null,
			liuyaoSettings: normalizeLiuyaoSettings(rawState.liuyaoSettings),
		};
		this.lastRestoredCaseId = caseVersion;
		this._liuyaoSettingsFromCase = true;   // 盘面的断卦设置来自事盘:之后亲手改只把改动叠在本机记住的那一套上(见 setLiuyaoSettingsByUser)
		this.stopFlipping();   // 翻动中载入事盘:不停则下一帧把存档卦冲掉
		this.supersedePendingCast({ dropNongli: true });   // 在途的起卦收尾与干支晚到都不盖掉存档卦与存档干支
		this.setState(nextState, ()=>{
			if(!this.state.guaDesc && this.state.currentGua !== null){
				this.requestGuaDesc();
			}
			// 旧档没存干支:按事盘自己的时间地点补取一次(在途的旧请求已作废,不补则日辰月建全空)。
			// 不能用 genFields():载入时左栏要到最后一步才换成事盘时刻,此刻 props.fields / 时间控件还是载入前的
			if(!this.state.nongli){
				const casePatch = currentCaseFieldsPatch({ timeAlg: true });
				this.requestNongli(casePatch ? { ...(this.props.fields || {}), ...casePatch } : this.genFields(), ()=>{}, { refreshOnly: true });
			}
		});
	},

	setRightPanelTab(key){
		this.setState({
			rightPanelTab: key,
		});
	},

	// 断卦分析(单一真值源):currentGua + 动爻 + nongli干支 + 流派设置 → analyzeLiuyao。按 key 记忆,避免每帧重算。
	getLiuyaoAnalysis(){
		const st = this.state;
		const nowGua = st.currentGua !== null && st.currentGua !== undefined && Gua64[st.currentGua] ? Gua64[st.currentGua] : null;
		const yao = st.yao || [];
		const ok = nowGua && yao.length === 6 && yao.every((y)=>y && (y.value === 0 || y.value === 1));
		if(!ok){ return null; }
		const nongli = st.nongli || {};
		const settings = normalizeLiuyaoSettings(st.liuyaoSettings);
		// 定年界线口径:立春换岁(yearJieqi/节气系)/正月初一(yearGZByLunar/农历系);
		// 缺该口径字段时回落另一系(旧数据兼容),再回落 year。
		const yearGz = `${(settings.yearBoundary === 'lunar'
			? (nongli.yearGZByLunar || nongli.yearGanZi || nongli.yearJieqi)
			: (nongli.yearJieqi || nongli.yearGanZi || nongli.yearGZByLunar)) || nongli.year || ''}`.trim();
		const monthGz = `${nongli.monthGanZi || ''}`.trim();
		const dayGz = `${nongli.dayGanZi || ''}`.trim();
		const hourGz = `${nongli.timeGanZi || nongli.hourGanZi || ''}`.trim();
		const jieqiName = `${nongli.jieqi || nongli.jieqiName || ''}`.trim();
		const moving = [];
		yao.forEach((y, i)=>{ if(y.change){ moving.push(i + 1); } });
		const key = [st.currentGua, moving.join('-'), dayGz, monthGz, yearGz, hourGz, jieqiName, JSON.stringify(settings)].join('|');
		// 单槽升 4 槽 LRU:切流派/切卦往返(A→B→A)免重算 analyzeLiuyao
		const hit = this._liuyaoMemo.get(key);
		if(hit !== undefined){ return hit; }
		const ctx = {
			dayGan: dayGz.length >= 2 ? dayGz[0] : null, dayZhi: dayGz.length >= 2 ? dayGz[1] : null,
			monthGan: monthGz.length >= 2 ? monthGz[0] : null, monthZhi: monthGz.length >= 2 ? monthGz[1] : null,
			// 🔴 月建索引(寅=正月=1):月令75神煞 + 月建六神 依此起例。此前缺 monthNum → yueLiuShenAnn 恒 null、月令神煞子集空转(死控)。
			monthNum: (['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'].indexOf(monthGz.length >= 2 ? monthGz[1] : '') + 1) || null,
			yearGan: yearGz.length >= 2 ? yearGz[0] : null, yearZhi: yearGz.length >= 2 ? yearGz[1] : null,
			hourZhi: hourGz.length >= 2 ? hourGz[1] : null,
			jieqiName: jieqiName || null,
		};
		const analysis = analyzeLiuyao(nowGua, moving, ctx, settings);
		this._liuyaoMemo.set(key, analysis);
		return analysis;
	},

	// 断卦设置只在亲手改(切流派 / 改单项 / 恢复默认)时落盘;载入事盘回灌的那一套只用于本次盘面,不写本机记忆
	// (否则载入一条盲派事盘,重开本页就成了盲派;载入没存设置的旧事盘,全部设置连同体验项被清回出厂)。
	// 盘面是载入事盘回灌的那一套时,亲手改的这一下(改一项 / 套流派 / 恢复默认)作用在本机记住的那一套上落盘,
	// 盘面照旧作用在当前那一套上:记住的 = 原先记住的 + 这次改动,载入带来的流派与其余各项不记。没载入过事盘时两者是同一套
	setLiuyaoSettingsByUser(updater){
		this.setState((prev)=>({ liuyaoSettings: updater(prev.liuyaoSettings) }), ()=>{
			if(this.unmounted){ return; }
			persistLiuyaoSettings(this._liuyaoSettingsFromCase
				? updater(loadPersistedLiuyaoSettings() || factoryLiuyaoSettings())
				: this.state.liuyaoSettings);
		});
	},

	changeLiuyaoPreset(presetKey){
		// 切派保留输入键(占测事项/用神/本命)与显示、起卦体验键的当前值。
		this.setLiuyaoSettingsByUser((cur)=>applyPreset(presetKey, cur));
	},

	changeLiuyaoOption(optKey, value){
		this.setLiuyaoSettingsByUser((cur)=>setOption(cur, optKey, value));
	},

	// 多选改一项(神煞勾选):按增量叠加 —— 盘面 = 点击时看到的一组 ± 这一项,本机记忆 = 记住的一组 ± 这一项。
	// 不能把「以盘面为底算好的整组」交进来:盘面那组来自载入的事盘时,会被整组写进本机记忆(流派也随之翻成「自定义」)。
	// shownArr = 点击时盘面那一组;universe = 选项表(定顺序;扩展神煞记忆为 null = 全选时按它展开)。
	changeLiuyaoSelection(optKey, shownArr, nextArr, universe){
		const delta = selectionDelta(shownArr, nextArr);
		this.setLiuyaoSettingsByUser((cur)=>{
			const sub = (cur && cur[optKey]) || {};
			const base = Array.isArray(sub.set) ? sub.set : (Array.isArray(universe) ? universe : []);
			return setOption(cur, optKey, { set: applySelectionDelta(base, delta, universe) });
		});
	},

	// 关联卦显示勾一项:同上按增量(null = 全显示;叠完全选回 null,与默认态同形)。
	changeLiuyaoRelatedCard(cardKey, on){
		const all = ['bian', 'hu', 'fu', 'zong', 'cuo'];
		this.setLiuyaoSettingsByUser((cur)=>{
			const base = Array.isArray(cur && cur.relatedCards) ? cur.relatedCards : all.slice();
			const next = applySelectionDelta(base, on ? { add: [cardKey] } : { remove: [cardKey] }, all);
			return setOption(cur, 'relatedCards', next.length === all.length ? null : next);
		});
	},

	navigateFeature(tabKey, subTab){
		if(this.props.dispatch){
			const payload = {
				currentTab: tabKey,
			};
			if(subTab){
				payload.currentSubTab = subTab;
			}
			this.props.dispatch({
				type: 'astro/save',
				payload,
			});
		}
	},

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的卦即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(reload/rehydrate 未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'guazhan'){
			return;
		}
		if(this.isFlipping()){ return; }   // 翻动中卦未定:不把半途卦交给 AI
		let text = '';
		try{
			text = `${buildGuaSnapshotText(this.props.fields, this.state) || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('guazhan', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	},

	async clickSaveCase(){
		if(this.isFlipping()){
			message.warning('正在随机翻动,请先停止翻动再保存');
			return;
		}
		if(this.state.currentGua === null){
			message.warning('请先完成起卦后再保存');
			return;
		}
		const flds = this.props.fields;
		if(!flds){
			return;
		}
		// [断语确定性] 保存前 await 断语库加载并即时重建快照:mount 预热是 fire-and-forget,
		// 快操作(起卦即存)时同步 getDoctrine() 会取到空缓存 → [占类断语] 掉断语。此处确保就绪后再取。
		try{ const _m = await import('../../gua/data/liuyaoDoctrineCache'); if(_m && _m.loadDoctrine){ await _m.loadDoctrine(); } }catch(_){ /* 断语加载失败不阻断保存 */ }
		if(this.unmounted){ return; }
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		let snapshot;
		try{ snapshot = buildGuaSnapshotText(flds, this.state); saveModuleAISnapshot('guazhan', snapshot); }
		catch(_){ snapshot = loadModuleAISnapshot('guazhan'); }
		const guaState = {
			currentGua: this.state.currentGua,
			yao: this.state.yao,
			nongli: this.state.nongli,
			guaDesc: this.state.guaDesc,
			custGuaDongYao: this.state.custGuaDongYao,
			numGuaDongYao: this.state.numGuaDongYao,
			upGuaIdx: this.state.upGuaIdx,
			downGuaIdx: this.state.downGuaIdx,
			number: this.state.number,
			guaOrigin: this.state.guaOrigin || 'time',
			liuyaoSettings: normalizeLiuyaoSettings(this.state.liuyaoSettings),
		};
		const payload = {
			module: 'guazhan',
			version: 2,
			savedAt: new Date().toISOString(),
			snapshot: snapshot,
			gua: guaState,
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `六爻占断 ${divTime}`,
						caseType: 'liuyao',
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						// 性别影响取用神(占婚男取妻财/女取官鬼),快照头已随之 —— record 不存则载入回落全局值致用神错位。
						gender: flds.gender && (flds.gender.value === 0 || flds.gender.value === 1) ? flds.gender.value : null,
						// 🔴 口径快照必带:载档时 applyCase 从 payload.fieldSnapshot 回灌日界点/晚子时/
						// 卦日界/时间算法;不带则沿用全局当前值 → 载回来的盘可能与存档不同。
						payload: { ...payload, fieldSnapshot: caseFieldSnapshot(flds) },
						sourceModule: 'guazhan',
					},
				},
			});
		}
	},

	getDuanJueCtx(){
		const n = this.state.nongli || {};
		const d = `${n.dayGanZi || ''}`;
		return { dayGan: d[0] || '', dayZhi: d[1] || '' };
	},
};
