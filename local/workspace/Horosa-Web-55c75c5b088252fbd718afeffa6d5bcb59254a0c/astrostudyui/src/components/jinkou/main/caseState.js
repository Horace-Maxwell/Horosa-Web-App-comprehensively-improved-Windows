// 金口诀页 · AI 快照保存与刷新、事盘回灌、存案
// 从 JinKouMain.js 按职责拆出的 JinKouMain 方法:this 仍是 JinKouMain 实例,门面里 mixinMethods(JinKouMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import DateTime from '../../comp/DateTime';
import { saveModuleAISnapshot, saveModuleAISnapshotLazy } from '../../../utils/moduleAiSnapshot';
import { loadFreshModuleAISnapshot } from '../../../utils/moduleSnapshotRefresh';
import { getKentangSavedCasePayload, openKentangCaseDrawer } from '../../../utils/kentangCaseSave';
import { buildBirthFields, resolveDisplayRunYear, getAppliedBirth } from './runYear';
import { buildJinKouSnapshotText, jinkouSnapshotMeta } from './snapshot';
import { JINKOU_PAGE_SETTINGS } from './pageState';

export const caseStateMethods = {
	saveJinKouSnapshot(params, liureng, runyear, wuxing, guirengType, diFen, jinkouPan){
		if(!liureng){
			return;
		}
		const flds = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const baseParams = params ? params : (flds ? this.genGodsParams(flds) : null);
		if(!baseParams){
			return;
		}
		const finalZone = baseParams.zone !== undefined ? baseParams.zone : (flds && flds.zone ? flds.zone.value : '');
		const finalLon = baseParams.lon !== undefined ? baseParams.lon : (flds && flds.lon ? flds.lon.value : '');
		const finalLat = baseParams.lat !== undefined ? baseParams.lat : (flds && flds.lat ? flds.lat.value : '');
		const saveParams = {
			...baseParams,
			zone: finalZone,
			lon: finalLon,
			lat: finalLat,
		};
		const appliedBirth = getAppliedBirth(this.state);
		// 行年单点收口(与六壬 saveLiuRengAISnapshot 同律):四个调用点全传
		// this.state.runyear 裸拍,起课回调在 requestRunYear(异步)归来前即产快照 → 挂载行年
		// 恒旧一拍;而 refresh-event 路径(handleSnapshotRefreshRequest)一直过 resolveDisplayRunYear
		// → 两路径不同构。此处与其同构收口,懒存物化的快照第一版即正确。
		// 收口值同时喂 assembleJinKouData(旬法/本命/虚岁三键的第二消费路径,只堵文本参会绕道)。
		const appliedRunYear = resolveDisplayRunYear(runyear, appliedBirth, flds);
		const jinkouData = this.assembleJinKouData(liureng, jinkouPan === undefined ? this.state.jinkouPan : jinkouPan, appliedRunYear);   // 不传 = 屏上那一份;传了(哪怕取失败的 null)就用它,不拿屏上的顶
		saveModuleAISnapshotLazy('jinkou', ()=>buildJinKouSnapshotText(
			saveParams,
			liureng,
			appliedRunYear,
			jinkouData,
			wuxing,
			guirengType,
			appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : 1
		), jinkouSnapshotMeta(saveParams, flds, jinkouData));
	},

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。数据源与 render() 完全一致(均取 this.state)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'jinkou'){
			return;
		}
		const liureng = this.state ? this.state.liureng : null;
		if(!liureng){
			return;
		}
		let snapshotText = '';
		let refreshMeta = {};
		try{
			const flds = this.state.calcFields ? this.state.calcFields : this.props.fields;
			const params = flds ? this.genGodsParams(flds) : null;
			const appliedBirth = getAppliedBirth(this.state);
			const displayRunYear = resolveDisplayRunYear(this.state.runyear, appliedBirth, flds);
			const jinkouData = this.assembleJinKouData(liureng, this.state.jinkouPan, displayRunYear);
			refreshMeta = jinkouSnapshotMeta(params, flds, jinkouData);
			snapshotText = `${buildJinKouSnapshotText(
				params,
				liureng,
				displayRunYear,
				jinkouData,
				this.state.wuxing,
				this.state.guireng,
				appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : 1
			) || ''}`.trim();
		}catch(e){
			snapshotText = '';
		}
		if(snapshotText){
			saveModuleAISnapshot('jinkou', snapshotText, refreshMeta);   // 刷新应答与平时写槽同一份起课时地 meta(含地分)
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = snapshotText;
			}
		}
	},

	// 事盘回放(2026-07-05 储存审计补):打开已存金口诀事盘时把课盘数据+全部流派/盘式/
	// 地分/月将占时设置整体回放(与 太乙/奇门/卦占 同范式);cid|updateTime 去重;快照原样回写。
	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('jinkou');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			return false;
		}
		const p = saved.payload;
		this.lastRestoredCaseId = saved.caseVersion;
		const optionKeys = ['wuxing', 'wuxingAuto', 'guireng', 'diFen', 'diFenAuto', 'yueJiang', 'zhanShi', 'schoolYueJiang', 'schoolGuiTable', 'schoolGuiPan', 'panShi', 'soilChangSheng', 'timeBasis',
			// 专题起式一组:与流派同档回放,否则存了专题课再开右栏「专题」页整页空
			'topicKey', 'shiJianKind', 'askKey', 'timeScope', 'diFenSource', 'diFenSourceInput'];
		const next = {};
		optionKeys.forEach((key)=>{
			if(p[key] !== undefined && p[key] !== null){
				next[key] = p[key];
			}
		});
		// 事盘里没有的口径键回出厂值,不沿用本机保存的偏好(见 pageSettingsStore.fillMissing 注)
		Object.assign(next, JINKOU_PAGE_SETTINGS.fillMissing(next));
		if(p.liureng){
			next.liureng = p.liureng;
			this._godsReqSeq = (this._godsReqSeq || 0) + 1;   // 在途的起课作废:课由存档复原
		}
		if(p.jinkouPan){
			next.jinkouPan = p.jinkouPan;
		}
		if(p.runyear !== undefined && p.runyear !== null){
			next.runyear = p.runyear;
			this._runYearReqSeq = (this._runYearReqSeq || 0) + 1;   // 在途的行年作废:行年由存档复原
		}
		// 回放问测人出生(行年真源),免还原后一经重算行年被缺省 birth 打回默认。
		if(p.birthSaved && p.birthSaved.date){
			try{
				const bt = new DateTime();
				if(p.birthSaved.zone){ bt.setZone(p.birthSaved.zone); }
				const parsed = bt.parse(`${p.birthSaved.date} ${p.birthSaved.time || '00:00:00'}`, 'YYYY-MM-DD HH:mm:ss');
				const bf = buildBirthFields({
					date: { value: parsed }, time: { value: parsed },
					zone: { value: p.birthSaved.zone }, gender: { value: p.birthSaved.gender },
				}, parsed);
				next.birth = bf;
				next.calcBirth = bf;
			}catch(e){ /* 坏档忽略,保现状 */ }
		}
		if(!Object.keys(next).length){
			return false;
		}
		this.setState(next, ()=>{
			if(p.snapshot){
				saveModuleAISnapshot('jinkou', p.snapshot);
			}
		});
		return true;
	},

	clickSaveCase(){
		if(!this.state.liureng){
			message.warning('请先完成起课后再保存');
			return;
		}
		const flds = this.state.calcFields ? this.state.calcFields : this.props.fields;
		if(!flds){
			return;
		}
		const displayRunYear = resolveDisplayRunYear(this.state.runyear, getAppliedBirth(this.state), flds);
		const snapshot = loadFreshModuleAISnapshot('jinkou');   // 存案 = 页面此刻所见(先请本页按当前盘重存再读槽,与挂载 / 导出同源)
		const payload = {
			module: 'jinkou',
			snapshot: snapshot,
			liureng: this.state.liureng,
			runyear: displayRunYear,
			wuxing: this.state.wuxing,
			// 「是否手选」也随档：否则回放一张手选五行/钉死地分的档，下次重排即被自动档打回
			wuxingAuto: this.state.wuxingAuto,
			guireng: this.state.guireng,
			diFen: this.state.diFen,
			diFenAuto: this.state.diFenAuto,
			// 月将/占时覆盖(2026-07-05 储存审计补:此前漏存,回放后变默认)
			yueJiang: this.state.yueJiang,
			zhanShi: this.state.zhanShi,
			jinkouPan: this.state.jinkouPan,
			// 流派/盘式(命盘事盘储存:还原时连同流派一并恢复,避免存了课再开变回默认派)
			schoolYueJiang: this.state.schoolYueJiang,
			schoolGuiTable: this.state.schoolGuiTable,
			schoolGuiPan: this.state.schoolGuiPan,
			panShi: this.state.panShi,
			soilChangSheng: this.state.soilChangSheng,
			timeBasis: this.state.timeBasis,
			// 专题起式/定地分取法/行年虚岁(命盘事盘储存:专题课与断诀是右栏一整页,不随档则回放后整页空)
			topicKey: this.state.topicKey,
			shiJianKind: this.state.shiJianKind,
			askKey: this.state.askKey,
			timeScope: this.state.timeScope,
			diFenSource: this.state.diFenSource,
			diFenSourceInput: this.state.diFenSourceInput,
			// 问测人出生(行年真源)随档:此前只存 displayRunYear 值,还原后一经重算
			// (换字段/改流派触发)行年即被缺省 birth 打回默认。DateTime 不可直接 JSON,降维成串。
			birthSaved: this.state.birth && this.state.birth.date && this.state.birth.date.value && this.state.birth.date.value.format ? {
				date: this.state.birth.date.value.format('YYYY-MM-DD'),
				time: this.state.birth.time && this.state.birth.time.value && this.state.birth.time.value.format ? this.state.birth.time.value.format('HH:mm:ss') : '00:00:00',
				zone: this.state.birth.zone ? this.state.birth.zone.value : undefined,
				gender: this.state.birth.gender ? this.state.birth.gender.value : 1,
			} : null,
		};
		// 🔴 改走共用件 openKentangCaseDrawer:此前这里手写 record,漏了两样东西 ——
		//   ① payload.fieldSnapshot(日界点 after23NewDay / 晚子时 lateZiHourUseNextDay /
		//      卦日界 guaAfter23NewDay / 时间算法 timeAlg);② 顶层 gender。
		// applyCase 载档时正是从这两处回灌口径(user.js pickCaseField),取不到就跳过、
		// 沿用全局当前值 —— 于是存档时若把日界点设成非默认,再载回来日柱/时柱直接算错。
		// 共用件产出的 record 与原手写完全等价(event/caseType/divTime/zone/lat/lon/gps/pos 逐项同),
		// 只是额外补齐上面两样,故此处零行为变更、纯补账。
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: flds,
			module: 'jinkou',
			label: '金口诀',
			payload,
		});
	},
};
