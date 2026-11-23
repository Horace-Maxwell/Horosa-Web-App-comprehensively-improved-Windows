// 六壬页 · AI 快照保存与刷新、事盘回灌、存案
// 从 LiuRengMain.js 按职责拆出的 LiuRengMain 方法:this 仍是 LiuRengMain 实例,门面里 mixinMethods(LiuRengMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import DateTime from '../../comp/DateTime';
import { saveModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { loadFreshModuleAISnapshot } from '../../../utils/moduleSnapshotRefresh';
import { getKentangSavedCasePayload, getKentangSavedCaseFieldsPatch, caseFieldSnapshot } from '../../../utils/kentangCaseSave';
import { sendScopedFields } from '../../../utils/scopedFieldsSink';
import { buildBirthFields, getSolarYearFromField, resolveDisplayRunYear } from './birthRunYear';
import { LIURENG_PAGE_SETTINGS } from './castLayout';
import { serializeBirthDraft, deserializeBirthDraft, getAppliedBirth, liurengCaseGender, liurengBenmingXingnian } from './panData';
import { buildLiuRengSnapshotText } from './snapshot';
import { zeriRestoredLockMarks } from '../../../divination/zeri/zeriPageCalibre';

export const caseStateMethods = {
	saveLiuRengAISnapshot(params, liureng, runyear, wuxing, guirengType){
		if(!liureng){
			return '';
		}
		const flds = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const baseParams = params ? params : (flds ? this.genGodsParams(flds) : null);
		if(!baseParams){
			return '';
		}
		const chartObj = this.lrChartFor(this.lessonChartFor(flds));
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
		// 行年单点收口:七个调用点传入的 runyear 全是 this.state.runyear 裸拍——起课回调
		// 紧跟 requestRunYear(异步)即产快照,改出生档后后端行年未归/静默失败时恒旧;而 render 侧
		// (格局参考)一直过 resolveDisplayRunYear 本地校正 → 页面对、AI 挂载错,两路径不同构。
		// 此处与 render 同构收口:值对=幂等原样过,旧拍/缺失=本地年差法立即兜底,快照第一版即正确。
		const appliedRunYear = resolveDisplayRunYear(runyear, appliedBirth, flds);
		// 此前为 const,下方择日宿主 composeAiSnapshot 重赋值在运行时抛只读错并被 try 吞掉 → 择日三段从未进快照/存档/导出。
		let snapshotText = buildLiuRengSnapshotText(
			saveParams,
			liureng,
			appliedRunYear,
			chartObj,
			guirengType,
			wuxing,
			appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : 1,
			{
				castMethod: this.state.castMethod,
				xuanShiZhi: this.state.xuanShiZhi,
				yanShuNum: this.state.yanShuNum,
				yueJiangMethod: this.state.yueJiangMethod,
				fenZhouYe: this.state.fenZhouYe,
				zhanCategory: this.state.zhanCategory,
				seHaiMethod: this.state.seHaiMethod,
				seHaiBoundary: this.state.seHaiBoundary,
				shiRuKe: this.state.shiRuKe,
				yearShenShaSort: this.state.yearShenShaSort,
				yinyangSystem: this.state.yinyangSystem,
				tuWangShuai: this.state.tuWangShuai,
				solarYear: getSolarYearFromField(flds && flds.date ? flds.date : null),
				...liurengBenmingXingnian(appliedBirth, appliedRunYear),
			}
		);
		// 🔴 全局兜底变量只归主页实例写(extractLiuRengContent 第三优先级消费它;择日内嵌
		// 实例每次起课覆写=主六壬导出降级链吃到择日候选时刻内容,审查实抓)
		if(typeof window !== 'undefined' && (this.props.techniqueScope || 'liureng') === 'liureng'){
			window.__horosa_liureng_snapshot_text = snapshotText;
		}
		// 择日宿主 scope 化:独立快照槽+composeAiSnapshot 拼接择时三段(主页零影响)
		if(typeof this.props.composeAiSnapshot === 'function'){
			try{ snapshotText = `${this.props.composeAiSnapshot(snapshotText) || snapshotText}`; }catch(e){ /* 拼接失败用基底 */ }
		}
		saveModuleAISnapshot(this.props.techniqueScope || 'liureng', snapshotText, {
			date: saveParams.date,
			time: saveParams.time,
			zone: saveParams.zone,
			lon: saveParams.lon,
			lat: saveParams.lat,
			castMethod: this.state.castMethod,
			xuanShiZhi: this.state.xuanShiZhi || '',
			yanShuNum: `${this.state.yanShuNum || ''}`,
			yueJiangMethod: this.state.yueJiangMethod,
			fenZhouYe: this.state.fenZhouYe,
		});
		return snapshotText;
	},

	// 事盘回放(2026-07-05 储存审计补):此前六壬事盘存了全部 13 项设置却打不回页面——
	// 打开已存事盘时把课盘数据+每技法设置整体回放(与 太乙/奇门/卦占 同范式);
	// cid|updateTime 去重防重复回放;快照原样回写(保存时刻的真值,零重算漂移)。
	restoreFromCurrentCase(force){
		// 🔴 按本实例 scope 取事盘(曾硬编码 'liureng':择日宿主实例也吃主六壬事盘——初始盘
		// 被劫持+事盘快照原样冲进 'liurengzeri' 槽,审查实抓;DunJiaMain scope 判同律)
		const saved = getKentangSavedCasePayload(this.props.techniqueScope || 'liureng');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			return false;
		}
		const p = saved.payload;
		this.lastRestoredCaseId = saved.caseVersion;
		// zhanCategory(占测事项)必须与存档侧成对 —— 缺它则载回后占断退回「通用」,与存档内的快照打架。
		const optionKeys = ['guireng', 'wuxing', 'timeAlg', 'castMethod', 'xuanShiZhi', 'yanShuNum', 'yueJiangMethod', 'fenZhouYe', 'seHaiMethod', 'seHaiBoundary', 'shiRuKe', 'yearShenShaSort', 'yinyangSystem', 'tuWangShuai', 'zhanCategory'];
		const next = {};
		optionKeys.forEach((key)=>{
			if(p[key] !== undefined && p[key] !== null){
				next[key] = p[key];
			}
		});
		// 事盘里没有的口径键回出厂值,不沿用本机保存的偏好(见 pageSettingsStore.fillMissing 注)
		Object.assign(next, LIURENG_PAGE_SETTINGS.fillMissing(next));
		// 存档带 wuxing → 视同用户已选,载回后不被下一次起课按日干冲掉。
		if(next.wuxing !== undefined){ next.wuxingUserSet = true; }
		if(p.liureng){
			next.liureng = p.liureng;
			this._godsReqSeq = (this._godsReqSeq || 0) + 1;   // 在途的起课作废:课由存档复原
		}
		if(p.runyear !== undefined && p.runyear !== null){
			next.runyear = p.runyear;
			this._runYearReqSeq = (this._runYearReqSeq || 0) + 1;   // 在途的行年作废:行年由存档复原
		}
		// 出生档回灌(birth=草稿、calcBirth=已应用),行年/本命按存档出生档校正,不再被当前档覆盖。
		const restoredBirth = deserializeBirthDraft(p.birthDraft);
		if(restoredBirth){
			next.birth = restoredBirth;
			next.calcBirth = buildBirthFields(restoredBirth, new DateTime());
		}
		if(!Object.keys(next).length){
			return false;
		}
		// 择日内嵌:记下哪些锁定项是由存案复原成非扫描口径的(显式标记;控件据此解锁并写明,别的入口改掉锁定项不算)
		if(this.props.zeriLocked){ this._zeriRestoredLocks = zeriRestoredLockMarks(this.props.zeriLocked, next); }
		if(this.props.techniqueScope){
			// 择日内嵌:时间算法不出控件、扫描恒按真太阳时。旧事盘带来的直接时间先照存档显示(盘面 / 快照是按它起的),
			// 下一次起课按真太阳时(genGodsParams 内嵌恒 0,并把本页时间算法改回)
			// 载入存案 = 按存案看盘:宿主覆盖层换成存案那一刻的时间地点(此前亲手改的作废),左栏与下一次起课都回到存案;
			// 盘面由存档复原,宿主因此重渲染带来的日界变化不触发重起
			// 存案取不出时间地点(补丁为空)时宿主 fields 可能不变,不置跳过标记 —— 否则标记留到下一次真实变化,把那次重起吞掉
			const casePatch = getKentangSavedCaseFieldsPatch(this.props.techniqueScope) || {};
			if(sendScopedFields(this.props, casePatch, { replace: true, recompute: false }) && Object.keys(casePatch).length){
				this._skipNextAfter23Recompute = true;
			}
		}
		this.setState(next, ()=>{
			if(p.snapshot){
				saveModuleAISnapshot(this.props.techniqueScope || 'liureng', p.snapshot);
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
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		// 择日宿主内按宿主键(liurengzeri)存档:module/caseType/sourceModule 同宿主键,快照取宿主槽(含择时段)。
		const lrScope = this.props.techniqueScope || 'liureng';
		// 先请本页按此刻所见重存再读(择日宿主刚出的择时结果经 composeAiSnapshot 并入;直读槽 = 扫描前的旧文)
		const snapshot = loadFreshModuleAISnapshot(lrScope);
		const payload = {
			module: lrScope,
			snapshot: snapshot,
			liureng: this.state.liureng,
			runyear: displayRunYear,
			wuxing: this.state.wuxing,
			timeAlg: this.state.timeAlg,
			guireng: this.state.guireng,
			castMethod: this.state.castMethod,
			xuanShiZhi: this.state.xuanShiZhi,
			yanShuNum: this.state.yanShuNum,
			yueJiangMethod: this.state.yueJiangMethod,
			fenZhouYe: this.state.fenZhouYe,
			seHaiMethod: this.state.seHaiMethod,
			seHaiBoundary: this.state.seHaiBoundary,
			shiRuKe: this.state.shiRuKe,
			yearShenShaSort: this.state.yearShenShaSort,
			yinyangSystem: this.state.yinyangSystem,
			tuWangShuai: this.state.tuWangShuai,
			zhanCategory: this.state.zhanCategory,
			// 起课法「九-十二客/行年加时/本命加时」在无头重算时需要本命支/行年支/公历年——
			// 页面起课经 liurengBenmingXingnian(本命档, 行年) 得到,存档此前不带 → AI 挂载重算静默退正时正将而标注仍打所选法。
			solarYear: getSolarYearFromField(flds && flds.date ? flds.date : null),
			...liurengBenmingXingnian(getAppliedBirth(this.state), displayRunYear),
			// 卜卦人出生档随存(此前不存不载 → 载回后行年/本命按当前出生档(缺省=占时)重算覆盖存档)。
			birthDraft: serializeBirthDraft(getAppliedBirth(this.state)),
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `${lrScope === 'liurengzeri' ? '六壬择日' : '六壬占断'} ${divTime}`,
						caseType: lrScope,
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						// 事盘 gender 曾取「时间与地点」区写的全局 fields.gender,而本页盘面/行年/实时快照
						//   的性别全取「卜卦人出生时间」区 → 无头重算(regenerateLiurengSnapshot 第 7 参=record.gender)的
						//   「问测人性别」可与同快照内行年顺逆矛盾。改取卜卦人性别(0/1),未填时才回落全局值。
						gender: liurengCaseGender(getAppliedBirth(this.state), flds),
						// 🔴 口径快照必带:载档时 applyCase 从 payload.fieldSnapshot 回灌日界点/晚子时/
						// 卦日界/时间算法;不带则沿用全局当前值 → 载回来的盘可能与存档不同。
						payload: { ...payload, fieldSnapshot: caseFieldSnapshot(flds) },
						sourceModule: lrScope,
					},
				},
			});
		}
	},

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== (this.props.techniqueScope || 'liureng')){
			return;
		}
		const snapshotText = this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng);
		if(snapshotText && evt && evt.detail && typeof evt.detail === 'object'){
			evt.detail.snapshotText = snapshotText;
		}
	},
};
