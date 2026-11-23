// 地占页 · 起卦历史、事盘回灌、存案与 AI 快照刷新
// 从 GeomancyMain.js 按职责拆出的 GeomancyMain 方法:this 仍是 GeomancyMain 实例,门面里 mixinMethods(GeomancyMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { pushGeomancyHistory } from '../geomancyHistory';
import { safeLocalStorageSet, readUserDataJson } from '../../../utils/safeStorage';
import { message } from 'antd';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../../utils/kentangCaseSave';
import { snapshotMetaFromFields } from '../../../utils/divinationTimeDraft';
import { HISTORY_KEY, HISTORY_MAX, QUESTION_TYPE_HOUSE, restoredGeomancySeedMode, GEOMANCY_PAGE_SETTINGS } from './tables';
import { buildGeomancySnapshotText } from './snapshot';

export const caseStateMethods = {
	// 读端单源 readUserDataJson:坏数据先留档(留不成就不让之后的写盖掉原串),再当空
	loadHistory(){
		this.setState({ history: readUserDataJson(HISTORY_KEY, []).slice(0, HISTORY_MAX) });
	},

	pushHistory(result){
		const reading = (result && result.reading) || {};
		const entry = {
			question: reading.question || '',
			questionType: reading.questionType || 'custom',
			questionTypeZh: reading.questionTypeZh || '',
			quesitedHouse: (reading.settings || {}).quesited_house || reading.primaryHouse || 1,
			judge: (reading.judge || {}).nameZh || (reading.judge || {}).nameEn || '',
			ascendant: (reading.ascendantFigure || {}).nameZh || '',
			seed: reading.seed,
			tradition: this.state.tradition, readingScope: this.state.readingScope, zodiacSystem: this.state.zodiacSystem,
			// 四本账:历史回放须能还原当时的传本改写与转宫,否则回放出的是另一副判读
			granular: { ...(this.state.granular || {}) }, turnTo: this.state.turnTo,
			// 四本账续扩:起卦诸法(报数所报之数)与行星地占盘四键
			castMethod: this.state.seedMode,
			castNumbers: this.parsedCastNumbers(),
			planetaryChart: this.state.planetaryChart,
			planetaryChartZodiac: this.state.planetaryChartZodiac,
			planetaryChartNodes: this.state.planetaryChartNodes,
			planetaryChartExtras: this.state.planetaryChartExtras,
			ts: Date.now(),
		};
		// 🔴 一次起卦只占一条:钉盘重算(改时地/流派/传本/所问宫…)出的还是**同一副卦**,
		//    若照旧追加,拖一下时间选择器就能把三十条上限刷满、把真正起过的卦挤出去(口径单源 geomancyHistory.js)。
		const prev = readUserDataJson(HISTORY_KEY, []);
		const next = pushGeomancyHistory(prev, entry);
		let ok = false;
		try{ ok = safeLocalStorageSet(HISTORY_KEY, JSON.stringify(next)); }catch(e){ ok = false; }
		// 写不进(存储满 / 坏原串封锁):列表按存储里实际的显示,不冒充已记下
		this.setState({ history: ok ? next : readUserDataJson(HISTORY_KEY, []).slice(0, HISTORY_MAX) });
	},

	// 写槽 meta 单一来源:平时写槽与刷新应答共用(刷新一次后槽的 meta 不变)
	snapshotMeta(){
		return snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() });
	},

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'geomancy'){ return; }
		const result = this.state ? this.state.result : null;
		if(!result){ return; }
		let text = '';
		try{ text = `${buildGeomancySnapshotText(result) || ''}`.trim(); }catch(e){ text = ''; }
		if(text){
			saveModuleAISnapshot('geomancy', text, this.snapshotMeta());
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	},

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('geomancy');
		if(!saved || !saved.payload){ return false; }
		if(!force && this.lastRestoredCaseId === saved.caseVersion){ return false; }
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		this.requestSeq += 1;
		this._freshCastSeq = null;   // 在途的新起盘已作废,它挂起的补排一并作废
		this._recastAfterFresh = false;
		// 🔴 载档整个提交周期内一律不许重算。真机 setState 是异步的:此处清掉的本地时地草稿要到
		//    下一拍才生效,而那一拍 restored 已是 false、签名却变了 —— 存档盘就被重算覆盖掉了
		//    (jest 若用同步 setState 模拟,这条永远测不出来)。并作废在途的时地重排。
		this._suppressRecast = true;
		if(this._recastTimer){ clearTimeout(this._recastTimer); this._recastTimer = null; }
		const factory = GEOMANCY_PAGE_SETTINGS.defaults();
		this.setState({
			loading: false,
			result: payload.result || null,
			resultSig: '',	// 存档盘按存档的时刻,不与此刻的起盘参数比:之后起盘取失败时不拿它顶
			question: options.question !== undefined ? options.question : this.state.question,
			questionType: options.questionType || this.state.questionType,
			quesitedHouse: options.quesitedHouse !== undefined && options.quesitedHouse !== null
				? Number(options.quesitedHouse) : this.state.quesitedHouse,
			// 报数盘同理:存档带十六数者起卦法复位为报数;其余按存档里记下的你当时的起卦法(castMethod)——
			// 与灵棋同:盘面直接用存档结果,「再起卦」照你的起卦法起新的;当时确是手动种子才回到手动。
			// 没记 castMethod 的旧档照旧按存档的 seedMode(有盘时存的是 manual + 种子)
			seedMode: (Array.isArray(options.castNumbers) && options.castNumbers.length === 16)
				? 'numbers' : restoredGeomancySeedMode(options, this.state.seedMode),
			manualSeed: options.seed !== undefined ? options.seed : this.state.manualSeed,
			// 🔴 castMethod 此前**存而不载**:保存时 seedMode 被硬写成 'manual'(锁定复现用),
			// 真正用过的起卦法(掷骰/抛硬币/沙痕/掷片/报数)只记在 castMethod 里,而无人读回 →
			// 载档后「这一卦当初是怎么起的」这条信息彻底丢失。此处如实读回;
			// seedMode 按存档所记读回(restoredGeomancySeedMode),种子照旧钉住(载档重算不重掷)。
			castMethod: options.castMethod || this.state.castMethod || null,
			// 载档必清本地时地草稿:否则左栏仍显示用户先前改的草稿时地,与存档所记不符
			// (guice:71 / lingqi / feigong / xiaoliuren / xiaochengtu 皆已如此)。
			localFields: null,
			// 口径键:存档里没有的回**出厂值**(factory),不沿用当前 state —— 这些键现在跨会话保留,state 里是本机保存的偏好;
			// 按出厂口径存下的旧档不带后来才有的键,沿用偏好就等于拿你现在的流派 / 覆盖项去重判这一卦。
			tradition: options.tradition || factory.tradition,
			readingScope: options.readingScope || factory.readingScope,
			zodiacSystem: options.zodiacSystem || factory.zodiacSystem,
			// 四本账:载入/回放时一并还原传本改写与转宫(缺省用 ?? 而非 ||,免把「空对象/0/null」误当未提供)
			granular: options.granular !== undefined && options.granular !== null
				? { ...options.granular } : {},
			turnTo: options.turnTo !== undefined ? options.turnTo : this.state.turnTo,
			// 四本账续扩:起卦诸法与行星地占盘四键(旧存档缺键回出厂值,不写 undefined)
			castNumbersText: Array.isArray(options.castNumbers) && options.castNumbers.length === 16
				? options.castNumbers.join(' ') : this.state.castNumbersText,
			planetaryChart: options.planetaryChart !== undefined
				? !!options.planetaryChart : factory.planetaryChart,
			planetaryChartZodiac: options.planetaryChartZodiac || factory.planetaryChartZodiac,
			planetaryChartNodes: options.planetaryChartNodes !== undefined
				? !!options.planetaryChartNodes : factory.planetaryChartNodes,
			planetaryChartExtras: options.planetaryChartExtras !== undefined
				? !!options.planetaryChartExtras : factory.planetaryChartExtras,
		}, ()=>{
			this._lastCastParamSig = this.castParamSig();
			this._suppressRecast = false;
			const result = this.state.result;
			// 快照带起课时地 meta(事盘路径与报告来源认得出是哪一局);刷新应答写同一份
			if(result){ saveModuleAISnapshotLazy('geomancy', ()=>buildGeomancySnapshotText(result), this.snapshotMeta()); }
		});
		return true;
	},

	clickSaveCase(){
		if(!this.state.result){
			message.info('请先起盘');
			return;
		}
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 存事盘用生效 fields:改过时间地理则存草稿值(divTime/经纬/地名来自草稿,不写主命盘)。
			fields: this.activeFields(),
			module: 'geomancy',
			label: '天文地占',
			payload: {
				options: {
					question: this.state.question,
					questionType: this.state.questionType,
					quesitedHouse: Number(this.state.quesitedHouse) || QUESTION_TYPE_HOUSE[this.state.questionType || 'custom'] || 1,
					seedMode: this.state.result.reading ? 'manual' : this.state.seedMode,
					seed: this.state.result.reading ? this.state.result.reading.seed : this.state.manualSeed,
					tradition: this.state.tradition,
					readingScope: this.state.readingScope,
					zodiacSystem: this.state.zodiacSystem,
					// 🔴 四本账:传本逐项改写与转宫**此前只存在于内存**,存盘不带、载回即丢
					//    —— 而 restoreFromCurrentCase 一直在读这两个键,存写两侧长期不对称,
					//    载回来的是流派默认盘,与用户存盘时所见判读不同。往返用例已锁死。
					granular: { ...(this.state.granular || {}) },
					turnTo: this.state.turnTo,
					// 四本账续扩:起卦诸法(含报数所报之数)与行星地占盘四键,存写两侧须对称
					castMethod: this.state.seedMode,
					castNumbers: this.parsedCastNumbers(),
					planetaryChart: this.state.planetaryChart,
					planetaryChartZodiac: this.state.planetaryChartZodiac,
					planetaryChartNodes: this.state.planetaryChartNodes,
					planetaryChartExtras: this.state.planetaryChartExtras,
				},
				result: this.state.result,
				snapshot: buildGeomancySnapshotText(this.state.result),
			},
		});
	},

	applyHistory(entry){
		if(!entry){ return; }
		const factory = GEOMANCY_PAGE_SETTINGS.defaults();
		this.setState({
			question: entry.question || '',
			questionType: entry.questionType || 'custom',
			quesitedHouse: Number(entry.quesitedHouse) || QUESTION_TYPE_HOUSE[entry.questionType || 'custom'] || 1,
			// 🔴 报数盘之母图全由那十六个数定 —— 回放若一律按手工种子重揲,得出的是另一副母图。
			//    故存有十六数者复位为报数档(clickCast 即带 castNumbers 重出同盘),余者照旧按种子复现。
			seedMode: (Array.isArray(entry.castNumbers) && entry.castNumbers.length === 16) ? 'numbers' : 'manual',
			manualSeed: entry.seed !== undefined ? entry.seed : 0,
			// 口径键:条目里没有的回出厂值,不沿用当前 state(理由同 restoreFromCurrentCase)
			tradition: entry.tradition || factory.tradition,
			readingScope: entry.readingScope || factory.readingScope,
			zodiacSystem: entry.zodiacSystem || factory.zodiacSystem,
			// 🔴 pushHistory 一直在**存** granular/turnTo(注释写着「回放须能还原当时的传本改写与转宫」),
			//    而此处从不**载** —— 存写两侧长期不对称,回放出来的是流派默认盘,不是当时那副判读。
			//    用 !== undefined 判定而非 ||,免把「空对象 / 0 / null」误当未提供。
			granular: entry.granular !== undefined && entry.granular !== null
				? { ...entry.granular } : {},
			turnTo: entry.turnTo !== undefined ? entry.turnTo : this.state.turnTo,
			// 四本账续扩:回放亦须还原起卦诸法与行星地占盘四键(报数条目按 manual 种子回放同盘)
			castNumbersText: Array.isArray(entry.castNumbers) && entry.castNumbers.length === 16
				? entry.castNumbers.join(' ') : this.state.castNumbersText,
			planetaryChart: entry.planetaryChart !== undefined
				? !!entry.planetaryChart : factory.planetaryChart,
			planetaryChartZodiac: entry.planetaryChartZodiac || factory.planetaryChartZodiac,
			planetaryChartNodes: entry.planetaryChartNodes !== undefined
				? !!entry.planetaryChartNodes : factory.planetaryChartNodes,
			planetaryChartExtras: entry.planetaryChartExtras !== undefined
				? !!entry.planetaryChartExtras : factory.planetaryChartExtras,
		}, ()=>{ this.clickCast(); });
	},
};
