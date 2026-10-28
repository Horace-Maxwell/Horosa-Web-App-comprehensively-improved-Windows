import { Modal, message } from 'antd';
import * as service from '../services/user';
import DateTime from '../components/comp/DateTime';
import { DefLat, DefLon, DefGpsLat, DefGpsLon, } from '../utils/constants';
import { getPagedLocalCharts, upsertLocalChart, removeLocalChart, listLocalCharts, getLocalChart } from '../utils/localcharts';
import { recordChangeAffectsCast } from '../utils/localRecordStore';
import { DAY_BOUNDARY_LOCKS_RELEASED } from '../utils/dayBoundaryLock';
import { recordStorePersisted, RECORD_NOT_PERSISTED_NOTE, RECORD_DELETE_NOT_PERSISTED_NOTE } from '../utils/recordStoreNotice';

// 写入后只在本次运行有效(本机存储不可用)→ 提示;已落盘不打扰(这些入口落盘成功时本来就不弹成功提示)
function warnIfSessionOnly(kind, text, note = RECORD_NOT_PERSISTED_NOTE){
	if(!recordStorePersisted(kind)){
		message.warning(`${text}${note}`);
	}
}

// 删除写不进(配额满,主库原样)→ 报错;只在本次运行有效 → 提示重启后还会在
function noticeDeleteResult(kind, w){
	if(w && !w.persisted && w.reason === 'quota'){
		message.error(`${kind === 'case' ? '事盘' : '命盘'}删除没能写入：本地存储空间不足，请先导出清理后重试`);
		return;
	}
	warnIfSessionOnly(kind, kind === 'case' ? '事盘已删除' : '命盘已删除', RECORD_DELETE_NOT_PERSISTED_NOTE);
}
import { captureNonDefaultTechniqueFields, markFieldsCaptured } from '../utils/recordFieldsRestore';
import { captureZiweiRecordSettings } from '../utils/ziweiRecordSettings';
import { withNewChartDefaults, captureNewChartDefaults } from '../utils/newChartCapture';
import { getPagedLocalCases, upsertLocalCase, removeLocalCase, getCaseTypeMeta, getLocalCase } from '../utils/localcases';
import { caseRecordFieldsPatch, parseCaseRecordDivTime, parseCaseDivTimeInto, caseLoadNotices, casePlaceGroup } from '../utils/kentangCaseSave';


// 删掉的记录里有当前事盘 → currentCase 与原样记录同一次清(删除 / 撤销删档的唯一写入口)。
// 删掉的里有「显式载入的那条」→ 载入标记(appliedCaseCid)同一次清:否则从回收站恢复后点「编辑」(不是载入),
// 读档去重键按旧标记认成已载入,新挂载的技法页会按旧代次还原一次
function* clearCurrentCaseIn(cids, { put, select }){
	const set = new Set((Array.isArray(cids) ? cids : []).filter((c)=>c !== undefined && c !== null).map((c)=>`${c}`));
	if(!set.size){ return; }
	const us = (yield select((s)=>s.user)) || {};
	const cur = us.currentCase;
	const curCid = cur && cur.cid && cur.cid.value !== undefined && cur.cid.value !== null ? `${cur.cid.value}` : null;
	const applied = us.appliedCaseCid !== undefined && us.appliedCaseCid !== null ? `${us.appliedCaseCid}` : null;
	const patch = {};
	if(curCid !== null && set.has(curCid)){ patch.currentCase = null; patch.currentCaseRecord = null; }
	if(applied !== null && set.has(applied)){ patch.appliedCaseCid = null; }
	if(Object.keys(patch).length){
		yield put({ type: 'save', payload: patch });
	}
	// 载入的那条没了 = 换了一课:左栏亲手改日界的模型层锁随之复位(与实例锁同一归属,dayBoundaryLock)
	if(patch.appliedCaseCid === null){
		yield put({ type: 'astro/save', payload: { ...DAY_BOUNDARY_LOCKS_RELEASED } });
	}
}

// 界面之外改档时「改了不必重排 / 不必推进载入代次」的键:单一出处在 localRecordStore(RECORD_NON_CAST_FIELDS =
// 展示 + 管理 + 记账 + 关联字段),命盘与事盘、单条与批量分支同一判据 recordChangeAffectsCast。
// 只改这些 → 命盘不重排、事盘不推进载入代次(技法页不按存案整页重还原,页上未存的改动与在途择日扫描都留着);
// 其余任何字段(时间 / 时区 / 经纬 / 性别 / 卦盘内容 / 不认识的新字段)一律当作影响起盘。

// 界面之外换了库里的当前事盘(采纳 / 撤销采纳 AI 提案、单库导入整条替换、影子并回)→ 按库里的新版重设当前事盘。
// 当前事盘正是显式载入的那条、且改动影响起课(affectsCast)→ 同一处先推进载入代次:读档去重键(kentangCaseSave.caseRestoreKey)只认「载入的 cid + 载入代次」、
// 不含更新时间,不推进则各技法页与盘壳照旧显示旧版,而 AI 挂载 / 编辑表单已是新版(所见 ≠ 所挂)。
// 只改了标题 / 备注 / 归档这类展示字段 → 只重设、不推进(否则技法页整页重还原,冲掉页上未存的改动、取消在途择日扫描)。
// 当前事盘只是被编辑 / 刚存的那条(不是载入)→ 只重设、不推进(各页本就不据它还原)。
// 「库里新版 → 当前事盘」一律走这里,不许在调用方各写一份(登记表见 caseRestoreExplicitLoadOnly.test.js)
function* reloadCurrentCaseFromStore(rec, affectsCast, { put, select }){
	if(!rec || rec.cid === undefined || rec.cid === null){ return; }
	const us = (yield select((s)=>s.user)) || {};
	if(affectsCast && us.appliedCaseCid !== undefined && us.appliedCaseCid !== null && `${us.appliedCaseCid}` === `${rec.cid}`){
		yield put({ type: 'save', payload: { caseApplySeq: (us.caseApplySeq || 0) + 1 } });
		// 推进载入代次 = 各页按新版重还原 = 换了一课:模型层两把日界锁同一次复位(与实例锁同一归属)
		yield put({ type: 'astro/save', payload: { ...DAY_BOUNDARY_LOCKS_RELEASED } });
	}
	yield put({ type: 'setCurrentCase', payload: rec });
}

// 删掉 / 合并进回收站的记录里有当前命盘 → 盘照旧留在屏幕上,但脱离记录(cid 清空,其余字段不动):
// 命盘的「当前」就是屏幕上的盘,不能像事盘那样整个清掉;保留 cid 则之后「保存 / 更新」写回回收站里那条(或另起一条同 cid 的)。
// 单条删 / 批量删 / 合并重复 / 账本撤销建档四处同调
function* detachCurrentChartIn(cids, { put, select }){
	const set = new Set((Array.isArray(cids) ? cids : []).filter((c)=>c !== undefined && c !== null && `${c}` !== '').map((c)=>`${c}`));
	if(!set.size){ return; }
	const cur = yield select((s)=>s.user && s.user.currentChart);
	const curCid = cur && cur.cid && cur.cid.value !== undefined && cur.cid.value !== null ? `${cur.cid.value}` : null;
	if(curCid !== null && set.has(curCid)){
		const next = { ...cur, cid: { ...cur.cid, value: null } };
		yield put({ type: 'save', payload: { currentChart: next } });
		yield put({ type: 'astro/save', payload: { currentChart: next } });
	}
	const astro = yield select((s)=>s.astro);
	const fields = astro && astro.fields;
	const fCid = fields && fields.cid && fields.cid.value !== undefined && fields.cid.value !== null ? `${fields.cid.value}` : null;
	if(fCid !== null && set.has(fCid)){
		yield put({ type: 'astro/save', payload: { fields: { ...fields, cid: { ...fields.cid, value: null } } } });
	}
}

function newEmptyChartFields(){
	let now = new DateTime();
	const fields = {
		birth: {
			value: now,
			name: ['birth'],
		},
		zone: {
			value: now.zone,
			name: ['zone'],
		},
		lat: {
			value: DefLat,
			name: ['lat'],
		},
		lon: {
			value: DefLon,
			name: ['lon'],
		},
		gpsLat: {
			value: DefGpsLat,
			name: ['gpsLat'],
		},
		gpsLon: {
			value: DefGpsLon,
			name: ['gpsLon'],
		},
		pos: {
			value: null,
			name: ['pos'],
		},
		name: {
			value: null,
			name: ['name'],
		},
		isPub: {
			value: 0,
			name: ['isPub'],
		},
		gender: {
			value: -1,
			name: ['gender'],
		},
		group: {
			value: null,
			name: ['group'],
		},
		doubingSu28: {
			value: 0,
			name: ['doubingSu28'],
		},
		creator: {
			value: null,
			name: ['creator'],
		},
		updateTime: {
			value: null,
			name: ['updateTime'],
		},
		cid: {
			value: null,
			name: ['cid'],
		},
		// 日界点 + 晚子时·时柱起干 + 时间算法 必须随命盘存档(不存则下次打开按全局默认,日柱/时柱可能算错)。
		orbs:{
			value: undefined,
			name: ['orbs'],
		},
		orbScale:{
			value: undefined,
			name: ['orbScale'],
		},
		after23NewDay:{
			value: undefined,
			name: ['after23NewDay'],
		},
		lateZiHourUseNextDay:{
			value: undefined,
			name: ['lateZiHourUseNextDay'],
		},
		timeAlg:{
			value: undefined,
			name: ['timeAlg'],
		},
		memoAstro:{
			value: null,
			name: ['memoAstro'],
		},
		memoBaZi:{
			value: null,
			name: ['memoBaZi'],
		},
		memoZiWei:{
			value: null,
			name: ['memoZiWei'],
		},
		memo74:{
			value: null,
			name: ['memo74'],
		},
		memoGua:{
			value: null,
			name: ['memoGua'],
		},
		memoLiuReng:{
			value: null,
			name: ['memoLiuReng'],
		},
		memoQiMeng:{
			value: null,
			name: ['memoQiMeng'],
		},
		memoSuZhan:{
			value: null,
			name: ['memoSuZhan'],
		},
		// [V] 通用备注(命盘表单直填;技法批注 memo* 八槽照旧走右栏「命盘批注」抽屉)。
		memo: {
			value: null,
			name: ['memo'],
		},
		rodden: {
			value: null,
			name: ['rodden'],
		},
		relation: {
			value: null,
			name: ['relation'],
		},
		sourceNote: {
			value: null,
			name: ['sourceNote'],
		},
		payload: {
			value: null,
			name: ['payload'],
		},
		sourceModule: {
			value: null,
			name: ['sourceModule'],
		},
		chartType: {
			value: null,
			name: ['chartType'],
		},

	};

	return fields;
}

function newEmptyCaseFields(){
	let now = new DateTime();
	const fields = {
		divTime: {
			value: now,
			name: ['divTime'],
		},
		zone: {
			value: now.zone,
			name: ['zone'],
		},
		lat: {
			value: DefLat,
			name: ['lat'],
		},
		lon: {
			value: DefLon,
			name: ['lon'],
		},
		gpsLat: {
			value: DefGpsLat,
			name: ['gpsLat'],
		},
		gpsLon: {
			value: DefGpsLon,
			name: ['gpsLon'],
		},
		pos: {
			value: null,
			name: ['pos'],
		},
		event: {
			value: null,
			name: ['event'],
		},
		caseType: {
			value: 'liuyao',
			name: ['caseType'],
		},
		// 性别随档(占类影响取用神:六爻占婚男取妻财/女取官鬼)。null=未指定,不落库。
		// 🔴 曾三段断链:存案入口一直送 caseGenderValue(fields),但此模板无槽 → 表单管道整段丢,
		// applyCase 的 gender 还原读取永远落空、AI 挂载恒退默认男。
		gender: {
			value: null,
			name: ['gender'],
		},
		// 事盘备注(断后复盘/应期回填;present 才落库)。
		memo: {
			value: null,
			name: ['memo'],
		},
		rodden: {
			value: null,
			name: ['rodden'],
		},
		relation: {
			value: null,
			name: ['relation'],
		},
		sourceNote: {
			value: null,
			name: ['sourceNote'],
		},
		isPub: {
			value: 0,
			name: ['isPub'],
		},
		group: {
			value: null,
			name: ['group'],
		},
		creator: {
			value: null,
			name: ['creator'],
		},
		updateTime: {
			value: null,
			name: ['updateTime'],
		},
		cid: {
			value: null,
			name: ['cid'],
		},
		payload: {
			value: null,
			name: ['payload'],
		},
		sourceModule: {
			value: null,
			name: ['sourceModule'],
		},
	};
	return fields;
}

let now = new DateTime();

export default { 
	namespace: 'user',
	state:{
		token: null,
		charts: [],
		userInfo: null,
		admin: false,
		pageSize: 30,
		pageIndex: 1,
		total: 0,
		cases: [],
		casePageSize: 30,
		casePageIndex: 1,
		caseTotal: 0,

		// 🔴 事盘「显式载入」代次:每执行一次 applyCase(用户在列表里点一条记录)即 +1。
		// 各技法读档函数都有一道去重守卫 `!force && lastRestoredCaseId === saved.caseVersion`,
		// 而 lastRestoredCaseId 只在构造函数里初始化、任何地方都不会重置 —— 于是同一条记录
		// 第二次载入必被守卫拦掉,屏幕上仍是用户后来新起的卦(用户实报:灵棋经存了再读卦不一样)。
		// 把本代次拼进 caseVersion 后:用户每点一次记录代次就变、必定重新还原;
		// 而 fields 因无关原因变化时代次不变、守卫照旧拦住(守卫原意「别反复覆盖用户现场」得以保留)。
		caseApplySeq: 0,
		// 显式载入的那条事盘的 cid(与 caseApplySeq 同一次写,只由 applyCase 写)。读档去重键只认它(kentangCaseSave.caseRestoreKey):
		// 编辑 / 存为事盘 / 保存编辑也会换掉 currentCase,但那不是载入,各技法页不据此还原
		appliedCaseCid: null,
		// 当前事盘的原样记录(setCurrentCase 派发进来的那条):表单字段形态的 currentCase 不带记录顶层的口径键(时间算法等),
		// 补取 / 宿主覆盖层按它与载入事盘走同一份映射(kentangCaseSave.caseRecordFieldsPatch)
		currentCaseRecord: null,

		pwdFields:{
            oldPwd: {
				value: null,
				name: ['oldPwd'],
            },
            newPwd: {
				value: null,
				name: ['newPwd'],
            },
            newPwdAgain: {
				value: null,
				name: ['newPwdAgain'],
            },
		},

		currentChart: {
			birth: {
				value: now,
				name: ['birth'],
			},
			zone: {
				value: now.zone,
				name: ['zone'],
			},
			lat: {
				value: DefLat,
				name: ['lat'],
			},
			lon: {
				value: DefLon,
				name: ['lon'],
			},
			gpsLat: {
				value: DefGpsLat,
				name: ['gpsLat'],
			},
			gpsLon: {
				value: DefGpsLon,
				name: ['gpsLon'],
			},
			name: {
				value: null,
				name: ['name'],
			},
			pos: {
				value: null,
				name: ['pos'],
			},
			gender: {
				value: -1,
				name: ['gender'],
			},
			isPub: {
				value: 0,
				name: ['isPub'],
			},
			cid: {
				value: null,
				name: ['cid'],
			},
			doubingSu28: {
				value: 0,
				name: ['doubingSu28'],
			},
			creator: {
				value: null,
				name: ['creator'],
			},
			group: {
				value: null,
				name: ['group'],
			},
			updateTime: {
				value: null,
				name: ['updateTime'],
			},
			// 日界点 + 晚子时·时柱起干 + 时间算法 随命盘持久化(用户拍板,见 dayBoundary.js)。
			orbs:{
				value: undefined,
				name: ['orbs'],
			},
			orbScale:{
				value: undefined,
				name: ['orbScale'],
			},
			after23NewDay:{
				value: undefined,
				name: ['after23NewDay'],
			},
			lateZiHourUseNextDay:{
				value: undefined,
				name: ['lateZiHourUseNextDay'],
			},
			timeAlg:{
				value: undefined,
				name: ['timeAlg'],
			},

			memoZiWei:{
				value: null,
				name: ['memoZiWei'],
			},
			memoBaZi:{
				value: null,
				name: ['memoBaZi'],
			},
			memoAstro:{
				value: null,
				name: ['memoAstro'],
			},
			memo74:{
				value: null,
				name: ['memo74'],
			},
			memoGua:{
				value: null,
				name: ['memoGua'],
			},
			memoLiuReng:{
				value: null,
				name: ['memoLiuReng'],
			},
			memoQiMeng:{
				value: null,
				name: ['memoQiMeng'],
			},
			memoSuZhan:{
				value: null,
				name: ['memoSuZhan'],
			},
			payload: {
				value: null,
				name: ['payload'],
			},
			sourceModule: {
				value: null,
				name: ['sourceModule'],
			},
			chartType: {
				value: null,
				name: ['chartType'],
			},
			// [V] 通用备注(与 newEmptyChartFields 同步;此内联初值是第三份模板,缺槽=首挂表单无此栏)
			memo: {
				value: null,
				name: ['memo'],
			},
			rodden: {
				value: null,
				name: ['rodden'],
			},
			relation: {
				value: null,
				name: ['relation'],
			},
			sourceNote: {
				value: null,
				name: ['sourceNote'],
			},

		},
		currentCase: {
			divTime: {
				value: now,
				name: ['divTime'],
			},
			zone: {
				value: now.zone,
				name: ['zone'],
			},
			lat: {
				value: DefLat,
				name: ['lat'],
			},
			lon: {
				value: DefLon,
				name: ['lon'],
			},
			gpsLat: {
				value: DefGpsLat,
				name: ['gpsLat'],
			},
			gpsLon: {
				value: DefGpsLon,
				name: ['gpsLon'],
			},
			event: {
				value: null,
				name: ['event'],
			},
			pos: {
				value: null,
				name: ['pos'],
			},
			caseType: {
				value: 'liuyao',
				name: ['caseType'],
			},
			isPub: {
				value: 0,
				name: ['isPub'],
			},
			cid: {
				value: null,
				name: ['cid'],
			},
			creator: {
				value: null,
				name: ['creator'],
			},
			group: {
				value: null,
				name: ['group'],
			},
			updateTime: {
				value: null,
				name: ['updateTime'],
			},
			payload: {
				value: null,
				name: ['payload'],
			},
			sourceModule: {
				value: null,
				name: ['sourceModule'],
			},
		},

	},
	

	reducers: {
		save(state, {payload: values}){
			let st = { ...state, ...values, };
			return st;
		},
	},

	effects: {
		*newCurrentChart({ payload: values }, { call, put, select }){
			const astrostate = yield select((s)=>s.astro);
			const fld = astrostate.fields;
			let date = fld.date.value.format('YYYY-MM-DD');
			let time = fld.date.value.format('HH:mm:ss');
			// 调用方可注入完整出生时间(如奇门「保存为命盘」用起局时间作生时)；占星新增命盘不传 → 沿用全局 fields,行为不变。
			let birth = (values && values.birth) ? `${values.birth}` : (date + ' ' + time);
			let chart = newEmptyChartFields();
			let tm = new DateTime();
			tm.setZone((values && values.zone) ? values.zone : fld.zone.value);
			chart.birth.value = tm.parse(birth, 'YYYY-MM-DD HH:mm:ss');
			chart.zone.value = tm.zone;
			chart.lat.value = fld.lat.value;
			chart.lon.value = fld.lon.value;
			chart.doubingSu28.value = fld.doubingSu28 ? fld.doubingSu28.value : 0;
			chart.group.value = fld.group.value;
			if(fld.group && !(fld.group.value instanceof Array)){
				try{
					chart.group.value = JSON.parse(fld.group.value);
					if(chart.group.value){
						if(chart.group.value.length === undefined || chart.group.value.length === null){
							chart.group.value = null;
						}
					}
				}catch(e){
					chart.group.value = null;
				}
			}
			// 八个技法批注槽表单里看不见:只有「存为命盘」(把当前这张另存)才带上;「新增命盘」/ 列表「添加星盘」/
			// 其它技法「保存为命盘」录的是另一个人或另一件事,此前也把刚载入那张盘的批注悄悄抄进新记录。
			if(values && values.fromCurrent){
				chart.memo74.value = fld.memo74.value;
				chart.memoBaZi.value = fld.memoBaZi.value;
				chart.memoZiWei.value = fld.memoZiWei.value;
				chart.memoAstro.value = fld.memoAstro.value;
				chart.memoGua.value = fld.memoGua.value;
				chart.memoLiuReng.value = fld.memoLiuReng.value;
				chart.memoQiMeng.value = fld.memoQiMeng.value;
				chart.memoSuZhan.value = fld.memoSuZhan.value;
			}
			if(fld.memo && fld.memo.value !== undefined && chart.memo){
				chart.memo.value = fld.memo.value;
			}
			// 研究三字段随表单流入(memo 同款)。
			if(fld.rodden && fld.rodden.value !== undefined && chart.rodden){
				chart.rodden.value = fld.rodden.value;
			}
			if(fld.relation && fld.relation.value !== undefined && chart.relation){
				chart.relation.value = fld.relation.value;
			}
			if(fld.sourceNote && fld.sourceNote.value !== undefined && chart.sourceNote){
				chart.sourceNote.value = fld.sourceNote.value;
			}
			// 日界点 + 晚子时·时柱起干 + 时间算法 + 容许度 + 七政宿度制随命盘存档(用户拍板,见 dayBoundary.js)。
			// 「存为命盘」(fromCurrent)记当前所见;其余新增 = 录另一个人,表单信封填新命盘缺省(与 AI 建档 / 名人库加入同一取值,
			// withNewChartDefaults 的那份)—— 否则信封里抄来的上一张盘的值会挡住新盘缺省
			chart.fromCurrent = { value: !!(values && values.fromCurrent), name: ['fromCurrent'] };
			if(values && values.fromCurrent){
				if(fld.after23NewDay && fld.after23NewDay.value !== undefined){
					chart.after23NewDay.value = fld.after23NewDay.value;
				}
				if(fld.orbs && fld.orbs.value){ chart.orbs.value = fld.orbs.value; }
				if(fld.orbScale && fld.orbScale.value){ chart.orbScale.value = fld.orbScale.value; }
				if(fld.lateZiHourUseNextDay && fld.lateZiHourUseNextDay.value !== undefined){
					chart.lateZiHourUseNextDay.value = fld.lateZiHourUseNextDay.value;
				}
				if(fld.timeAlg && fld.timeAlg.value !== undefined){
					chart.timeAlg.value = fld.timeAlg.value;
				}
			}else{
				let cap = {};
				try{ cap = captureNewChartDefaults() || {}; }catch(e){ cap = {}; }
				['after23NewDay', 'lateZiHourUseNextDay', 'timeAlg', 'orbs', 'orbScale'].forEach((k)=>{
					if(cap[k] !== undefined && chart[k]){ chart[k].value = cap[k]; }
				});
				chart.doubingSu28.value = cap.doubingSu28 !== undefined ? cap.doubingSu28 : 0;
			}
			if(values){
				if(values.payload !== undefined){
					chart.payload.value = values.payload;
				}
				if(values.sourceModule !== undefined){
					chart.sourceModule.value = values.sourceModule;
				}
				if(values.chartType !== undefined){
					chart.chartType.value = values.chartType;
				}
				// 调用方可注入完整人盘信息(奇门「保存为命盘」补性别/经纬度/地名,使命盘管理里信息完整)；占星新增不传 → 不变。
				if(values.gender !== undefined && values.gender !== null && chart.gender){ chart.gender.value = values.gender; }
				if(values.pos !== undefined && values.pos !== null && chart.pos){ chart.pos.value = values.pos; }
				if(values.lat !== undefined && values.lat !== null){ chart.lat.value = values.lat; }
				if(values.lon !== undefined && values.lon !== null){ chart.lon.value = values.lon; }
				if(values.gpsLat !== undefined && values.gpsLat !== null && chart.gpsLat){ chart.gpsLat.value = values.gpsLat; }
				if(values.gpsLon !== undefined && values.gpsLon !== null && chart.gpsLon){ chart.gpsLon.value = values.gpsLon; }
				if(values.name !== undefined && values.name !== null && chart.name){ chart.name.value = values.name; }
			}

			yield put({
                type: 'save',
                payload: {  
					currentChart: chart,
                },
			});
			
			yield put({
                type: 'astro/save',
                payload: {  
					currentChart: chart,
                },
            });

		},

		*setCurrentChart({ payload: values }, { call, put }){
			let tm = new DateTime();
			tm.setZone(values.zone);
			let chart = newEmptyChartFields();
			if(values.birth instanceof DateTime){
				chart.birth.value = values.birth;
			}else{
				chart.birth.value = tm.parse(values.birth, 'YYYY-MM-DD HH:mm:ss');
			}
			chart.zone.value = tm.zone;
			chart.lat.value = values.lat;
			chart.lon.value = values.lon;
			chart.gpsLat.value = values.gpsLat;
			chart.gpsLon.value = values.gpsLon;
			chart.name.value = values.name;
			chart.pos.value = values.pos;
			chart.gender.value = parseInt(values.gender +'');
			chart.isPub.value = parseInt(values.isPub + '');
			chart.cid.value = values.cid;
			chart.creator.value = values.creator;
			chart.updateTime.value = values.updateTime;
			chart.doubingSu28.value = values.doubingSu28 ? values.doubingSu28 : 0;
			// 随盘的日界 / 晚子时 / 时间算法 / 容许度也读进表单(此前没读 → 编辑保存时以空值提交,把记录里的值抹掉)
			['after23NewDay', 'lateZiHourUseNextDay', 'timeAlg', 'orbs', 'orbScale'].forEach((k)=>{
				if(values[k] !== undefined && values[k] !== null && chart[k]){ chart[k].value = values[k]; }
			});
			chart.group.value = values.group;
			if(values.group && !(values.group instanceof Array)){
				try{
					chart.group.value = JSON.parse(values.group);
					if(chart.group.value){
						if(chart.group.value.length === undefined || chart.group.value.length === null){
							chart.group.value = null;
						}
					}
				}catch(e){
					chart.group.value = null;
				}
			}

			chart.memo74.value = values.memo74;
			chart.memoBaZi.value = values.memoBaZi;
			chart.memoZiWei.value = values.memoZiWei;
			chart.memoAstro.value = values.memoAstro;
			chart.memoGua.value = values.memoGua;
			chart.memoLiuReng.value = values.memoLiuReng;
			chart.memoQiMeng.value = values.memoQiMeng;
			chart.memoSuZhan.value = values.memoSuZhan;
			if(values.memo !== undefined && values.memo !== null && chart.memo){
				chart.memo.value = `${values.memo}`;
			}
			// 研究三字段镜像(memo 同款:present 才写,旧档无槽防御)。
			if(values.rodden !== undefined && values.rodden !== null && chart.rodden){
				chart.rodden.value = `${values.rodden}`;
			}
			if(values.relation !== undefined && values.relation !== null && chart.relation){
				chart.relation.value = `${values.relation}`;
			}
			if(values.sourceNote !== undefined && values.sourceNote !== null && chart.sourceNote){
				chart.sourceNote.value = `${values.sourceNote}`;
			}
			chart.payload.value = values.payload;
			chart.sourceModule.value = values.sourceModule;
			chart.chartType.value = values.chartType;

			// 要排盘的载入:当前命盘与左栏字段在排盘成功后同一次提交(fetchByChartData 的成功分支);排盘失败两边都不变。
			// 此前先换 currentChart 再排盘:失败时「当前命盘」已是新的、左栏还是旧盘 —— 一保存就把旧盘字段写进新记录;
			// 宿主页 componentDidUpdate 也看得到「新 currentChart + 旧 fields」的中间态。不排盘的(编辑表单 / 只改名)照旧立刻落
			if(!values || values.skipFetchByChartData !== true){
				yield put({
	                type: 'astro/fetchByChartData',
	                payload: { ...values, __pendingCurrentChart: chart },
	            });
				return;
			}

			yield put({
                type: 'save',
                payload: {  
					currentChart: chart,
                },
            });

			let val = {
				currentChart: chart,
			};
			if(values.drawerVisible){
				val.drawerVisible = values.drawerVisible;
			}

			yield put({
                type: 'astro/save',
                payload: val,
            });

		},

		*newCurrentCase({ payload: values }, { call, put, select }){
			const astrostate = yield select((s)=>s.astro);
			const fld = astrostate.fields;
			const caze = newEmptyCaseFields();
			let tm = new DateTime();
			if(fld && fld.date && fld.time){
				const dtstr = `${fld.date.value.format('YYYY-MM-DD')} ${fld.time.value.format('HH:mm:ss')}`;
				tm = tm.parse(dtstr, 'YYYY-MM-DD HH:mm:ss');
				tm.setZone(fld.zone.value);
			}
			caze.divTime.value = tm;
			caze.zone.value = fld && fld.zone ? fld.zone.value : tm.zone;
			caze.lat.value = fld && fld.lat ? fld.lat.value : DefLat;
			caze.lon.value = fld && fld.lon ? fld.lon.value : DefLon;
			caze.gpsLat.value = fld && fld.gpsLat ? fld.gpsLat.value : DefGpsLat;
			caze.gpsLon.value = fld && fld.gpsLon ? fld.gpsLon.value : DefGpsLon;
			caze.pos.value = fld && fld.pos ? fld.pos.value : null;
			if(values){
				if(values.caseType !== undefined && values.caseType !== null){
					caze.caseType.value = values.caseType;
				}
				// 性别透传(0=女 合法值,判 undefined/null/空串而非真值)——缺这段则存案入口送来的
				// caseGenderValue 在此丢失,表单与落库全链拿不到。
				if(values.gender !== undefined && values.gender !== null && values.gender !== '' && caze.gender){
					caze.gender.value = parseInt(values.gender + '', 10);
				}
				if(values.memo !== undefined && values.memo !== null && caze.memo){
					caze.memo.value = `${values.memo}`;
				}
				if(values.event !== undefined && values.event !== null){
					caze.event.value = values.event;
				}
				if(values.payload !== undefined){
					caze.payload.value = values.payload;
				}
				if(values.sourceModule !== undefined){
					caze.sourceModule.value = values.sourceModule;
				}
				if(values.zone){
					caze.zone.value = values.zone;
				}
				// 存案入口带来的地点当一组(kentangCaseSave.casePlaceGroup,与载入同一判据):完整才整组写;缺 / 半组(如只有经度)
				// 就留表单缺省的左栏地点 —— 此前逐键盖,半组把表单拼成「入口的经度 + 空纬度」存下,载入主盘清空左栏纬度
				const place = casePlaceGroup(values);
				if(place){ Object.keys(place).forEach((k)=>{ caze[k].value = place[k]; }); }
				if(values.divTime){
					let tcase = new DateTime();
					tcase.setZone(caze.zone.value || tm.zone);
					if(values.divTime instanceof DateTime){
						caze.divTime.value = values.divTime;
					}else{
						// 与载入事盘同一种解析(kentangCaseSave.parseCaseDivTimeInto);认不出的照旧交给 DateTime
						caze.divTime.value = parseCaseDivTimeInto(tcase, values.divTime) || tcase.parse(values.divTime, 'YYYY-MM-DD HH:mm:ss');
					}
				}
			}

			yield put({
				type: 'save',
				payload: {
					currentCase: caze,
					currentCaseRecord: null,   // 新建事盘:没有原样记录(与 currentCase 同一次写)
				},
			});
		},

		*setCurrentCase({ payload: values }, { call, put }){
			const caze = newEmptyCaseFields();
			const zone = values.zone !== undefined && values.zone !== null ? values.zone : '+08:00';
			let tm = new DateTime();
			tm.setZone(zone);
			if(values.divTime instanceof DateTime){
				caze.divTime.value = values.divTime;
			}else{
				// 与补取比对时刻同一种解析(kentangCaseSave.parseCaseRecordDivTime);没有起课时间(空 / 认不出)= 此刻,与载入事盘同口径
				caze.divTime.value = parseCaseRecordDivTime(values) || tm;
			}
			caze.zone.value = zone;
			caze.lat.value = values.lat;
			caze.lon.value = values.lon;
			caze.gpsLat.value = values.gpsLat;
			caze.gpsLon.value = values.gpsLon;
			caze.event.value = values.event;
			caze.pos.value = values.pos;
			caze.caseType.value = values.caseType;
			// 性别回填(编辑表单显示既存值;旧档无此键 → 保持模板 null=未指定)
			if(values.gender !== undefined && values.gender !== null && values.gender !== '' && caze.gender){
				caze.gender.value = parseInt(values.gender + '', 10);
			}
			if(values.memo !== undefined && values.memo !== null && caze.memo){
				caze.memo.value = `${values.memo}`;
			}
			caze.isPub.value = parseInt((values.isPub !== undefined && values.isPub !== null ? values.isPub : 0) + '', 10);
			caze.cid.value = values.cid;
			caze.creator.value = values.creator;
			caze.updateTime.value = values.updateTime;
			caze.group.value = values.group;
			if(values.group && !(values.group instanceof Array)){
				try{
					caze.group.value = JSON.parse(values.group);
					if(caze.group.value){
						if(caze.group.value.length === undefined || caze.group.value.length === null){
							caze.group.value = null;
						}
					}
				}catch(e){
					caze.group.value = null;
				}
			}
			// 研究三字段(与命盘同口径:present 才写)—— 此前没读进表单,事盘编辑保存把已有值写成空
			['rodden', 'relation', 'sourceNote'].forEach((k)=>{
				if(values[k] !== undefined && values[k] !== null && caze[k]){ caze[k].value = `${values[k]}`; }
			});
			caze.payload.value = values.payload;
			caze.sourceModule.value = values.sourceModule;

			yield put({
				type: 'save',
				payload: {
					currentCase: caze,
					currentCaseRecord: values && typeof values === 'object' ? values : null,
				},
			});

			if(values.drawerVisible){
				yield put({
					type: 'astro/save',
					payload: {
						drawerVisible: values.drawerVisible,
					},
				});
			}
		},

		*fetchCases({ payload: values }, { call, put, select }){
			const param = {
				...values,
			};
			const state = yield select((s)=>s.user);
			if(param.PageIndex === undefined || param.PageIndex === null){
				param.PageIndex = state.casePageIndex;
				param.PageSize = state.casePageSize;
			}
			const result = getPagedLocalCases(param);
			yield put({
				type: 'save',
				payload: {
					cases: result.List,
					caseTotal: result.Total,
					casePageIndex: result.PageIndex,
					casePageSize: result.PageSize,
				},
			});
		},

		*searchCases({ payload: values }, { call, put, select }){
			const param = {
				...values,
			};
			const state = yield select((s)=>s.user);
			if(param.PageIndex === undefined || param.PageIndex === null){
				param.PageIndex = state.casePageIndex;
				param.PageSize = state.casePageSize;
			}
			const result = getPagedLocalCases(param);
			yield put({
				type: 'save',
				payload: {
					cases: result.List,
					caseTotal: result.Total,
					casePageIndex: result.PageIndex,
					casePageSize: result.PageSize,
				},
			});
		},

		*addCase({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			try{
				if(values.divTime){
					param.divTime = values.divTime.format('YYYY-MM-DD HH:mm:ss');
					param.zone = values.divTime.zone;
				}
				const saved = upsertLocalCase(param);
				warnIfSessionOnly('case', '事盘已保存');
				// 与命盘同口径:当前事盘取库里的完整记录(upsert 的回值只带表单里有的键,记录顶层的日界 / 时间算法等口径键会缺席)
				const rec = (saved && saved.cid ? getLocalCase(saved.cid) : null) || saved;
				yield put({
					type: 'setCurrentCase',
					payload: rec,
				});
				yield put({
					type: 'astro/openDrawer',
					payload: {
						key: 'caselist',
					},
				});
			}catch(e){
				Modal.error({
					title: '事盘保存失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
			}
		},

		*updateCase({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			try{
				if(values.divTime){
					param.divTime = values.divTime.format('YYYY-MM-DD HH:mm:ss');
					param.zone = values.divTime.zone;
				}
				const saved = upsertLocalCase(param);
				warnIfSessionOnly('case', '事盘已更新');
				// 与命盘同口径:当前事盘取库里的完整记录(upsert 的回值只带表单里有的键,记录顶层的日界 / 时间算法等口径键会缺席)
				const rec = (saved && saved.cid ? getLocalCase(saved.cid) : null) || saved;
				yield put({
					type: 'setCurrentCase',
					payload: rec,
				});
				yield put({
					type: 'astro/openDrawer',
					payload: {
						key: 'caselist',
					},
				});
			}catch(e){
				Modal.error({
					title: '事盘更新失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
			}
		},

		// 这些 cid 里有当前事盘 → 清 currentCase 与原样记录(批量删除 / 账本撤销删档派发;单条删除直接调同一函数)
		*clearCurrentCaseIfRemoved({ payload }, { put, select }){
			yield* clearCurrentCaseIn(payload && payload.cids, { put, select });
		},
		// 这些 cid 里有当前命盘 → 脱离记录(批量删除 / 合并重复 / 账本撤销建档派发;单条删除直接调同一函数)
		*detachCurrentChartIfRemoved({ payload }, { put, select }){
			yield* detachCurrentChartIn(payload && payload.cids, { put, select });
		},

		*deleteCase({ payload: values }, { call, put, select }){
			try{
				const w = removeLocalCase(values.cid);
				noticeDeleteResult('case', w);
				// 删除没写进(配额满):记录还在,当前事盘也留着
				const removed = !(w && w.persisted === false && w.reason === 'quota');
				// 删的是当前已应用事盘 → 清 currentCase;否则技法页 restoreFromCurrentCase
				// 与 AI 挂载 getKentangSavedCasePayload 继续命中已删档(幽灵还原)。单条 / 批量删除 / 账本撤销同一入口
				if(removed){ yield* clearCurrentCaseIn([values.cid], { put, select }); }
				yield put({
					type: 'astro/openDrawer',
					payload: {
						key: 'caselist',
					},
				});
			}catch(e){
				Modal.error({
					title: '事盘删除失败',
					content: '本地存储不可用，请稍后重试。',
				});
			}
		},

		*applyCase({ payload: values }, { call, put, select }){
			// 🔴 先自增「显式载入代次」再设 currentCase:代次进 caseVersion(kentangCaseSave.js),
			// 各技法的读档去重守卫据此认出「这是用户又点了一次记录」,从而必定重新还原 ——
			// 同一条记录连点两次也必两次还原(此前第二次永远被守卫拦掉,是存档失真的直接根因)。
			// 载入的 cid 与代次同一次写(读档去重键 caseRestoreKey 只认这两项)
			const prevSeq = yield select((s)=>(s.user && s.user.caseApplySeq) || 0);
			const appliedCid = values && values.cid !== undefined && values.cid !== null && values.cid !== '' ? `${values.cid}` : null;
			yield put({
				type: 'save',
				payload: { caseApplySeq: prevSeq + 1, appliedCaseCid: appliedCid },
			});
			yield put({
				type: 'setCurrentCase',
				payload: values,
			});
			// Close management drawers immediately so case selection always exits back to the target technique view.
			yield put({
				type: 'astro/closeDrawer',
				payload: {},
			});
			const astrostate = yield select((s)=>s.astro);
			// 记录 → 左栏字段:与六爻补取 / 择日宿主覆盖层同一份映射(kentangCaseSave.caseRecordFieldsPatch)。
			// 与 astro/fetchByChartData 同款不可变写：命中键写「新 entry」，绝不就地改共享 entry
			// （否则组件层 prevProps 与 props 同对象、值比对失明；失败路径也会脏写 state）。
			// 储存全字段保真:事盘还原也补回性别 + 影响盘的设置(日界点/晚子时/时间算法/容许度),否则沿用当前全局值致还原盘错位;
			// 事盘经 openKentangCaseDrawer 存的这些口径在 payload.fieldSnapshot(嵌套),顶层优先兼容旧档、回落快照;存档无该字段则跳过、不改现状。
			const casePatch = caseRecordFieldsPatch(values, astrostate.fields);
			// 坏档(没有可用地点 → 地点整组沿用左栏;没有起课时间 → 按此刻):如实说一声,不弹窗
			caseLoadNotices(values).forEach((t)=>{ try{ message.info(t); }catch(e){ /* 无界面环境 */ } });
			const flds = {
				...astrostate.fields,
				...casePatch,
			};
			const typeMeta = getCaseTypeMeta(values.caseType || values.sourceModule);
			const nextTab = typeMeta.tab ? typeMeta.tab : (typeMeta.module === 'sanshiunited' ? 'sanshiunited' : 'cnyibu');
			const nextSubTab = typeMeta.subTab || null;
			yield put({
				type: 'astro/save',
				payload: {
					currentTab: nextTab,
					currentSubTab: nextSubTab,
					// 载入事盘:八字本页覆盖层复位;事盘自带口径(任一键)→ 钉住共享层不被全局事件覆盖
					baziCalibreOverride: {},
					_dayBoundaryRecordPinned: ['after23NewDay', 'lateZiHourUseNextDay', 'timeAlg'].some((k)=>!!casePatch[k]),
					// 换了一课:上一课左栏亲手改的日界 / 晚子时锁不带过来(与实例锁同一归属;此前只在换命盘 / 此刻时复位,
					// 载入另一条不带日界口径的事盘后,「设置 → 日界」改全局,共享 fields 仍不跟)
					...DAY_BOUNDARY_LOCKS_RELEASED,
				},
			});
			yield put({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		},

		*searchCharts({ payload: values }, { call, put, select }){
			const param = {
				...values,
			};
			const state = yield select((s)=>s.user);
			if(param.PageIndex === undefined || param.PageIndex === null){
				param.PageIndex = state.pageIndex;
				param.PageSize = state.pageSize;
			}
			if(param.name === undefined || param.name === null || param.name === ''){
				yield put({
					type: 'fetchCharts',
					payload: param,
				});
				return;
			}
			const result = getPagedLocalCharts(param);
	            yield put({
	                type: 'save',
	                payload: {  
						charts: result.List,
						total: result.Total,
						pageIndex: result.PageIndex,
						pageSize: result.PageSize,
	                },
	            });
			return;

		},

		*fetchCharts({ payload: values }, { call, put, select }){
			const param = {
				...values,
			};
			const state = yield select((s)=>s.user);
			if(param.PageIndex === undefined || param.PageIndex === null){
				param.PageIndex = state.pageIndex;
				param.PageSize = state.pageSize;
			}
			const result = getPagedLocalCharts(param);
			yield put({
                type: 'save',
                payload: {  
					charts: result.List,
					total: result.Total,
					pageIndex: result.PageIndex,
					pageSize: result.PageSize,
                },
            });
			return;

		},

		*addChart({ payload: values }, { call, put, select }){
			const param = {
				...values,
			};
			try{
				if(values.birth){
					param.birth = values.birth.format('YYYY-MM-DD HH:mm:ss');
					param.zone = values.birth.zone;
				}
				// 保存命盘时捕获「当前技法排盘设置 ≠ schema 默认」的键随盘落库
				// (埃及历「非默认才落键」范式推广,用户拍板)。捕获面=还原清单键集(对称闭合);
				// 表单信封已有的键不覆写;全默认零落键 → 旧行为/旧记录体积语义零变。
				// 仅新建捕获 —— updateChart 不捕获:编辑元数据不应把当前全局设置盖到旧记录上。
				// 「存为命盘」(fromCurrent)记当前所见;其余页面新增 = 录另一个人 → 按「新命盘」缺省记随盘设置
				// (与 AI 建档 / 名人库加入 / 外部导入同一 withNewChartDefaults;上一张别人的盘的宫制 / 四化不串进来)
				const fromCurrent = !!param.fromCurrent;
				delete param.fromCurrent;
				let toStore = param;
				if(fromCurrent){
					const astrostate = yield select((s)=>s.astro);
					const captured = captureNonDefaultTechniqueFields(astrostate ? astrostate.fields : null);
					Object.keys(captured).forEach((k)=>{
						if(param[k] === undefined){
							param[k] = captured[k];
						}
					});
					// 紫微排盘设置随盘:紫微左栏的设置住在本机偏好 / 引擎单例,不在 astro.fields,上面那步捕不到;
					// 单独捕获非默认键 + 紫微代次标记(载入时缺键 = 保存时为默认)。表单信封已有的键同样不覆写。
					const zwCaptured = captureZiweiRecordSettings();
					Object.keys(zwCaptured).forEach((k)=>{
						if(param[k] === undefined){
							param[k] = zwCaptured[k];
						}
					});
					markFieldsCaptured(param);   // 新记录打代次标记:载入时缺清单键 = 默认(不再沿用上一张盘)
					param.captureCurrentGlobals = true;   // 按当前设置新建:全局流派类设置(埃及历等)随盘记下
				}else{
					toStore = withNewChartDefaults(param, { forStore: true });
				}
				const rec = upsertLocalChart(toStore);
				warnIfSessionOnly('chart', '命盘已保存');
				// 同名同生辰提示(不拦截保存 —— 双胞胎/重录皆合法,只提醒区分)。
				try{
					if(rec && rec.name){
						const same = listLocalCharts({ name: rec.name }).filter((r)=> r.name === rec.name && r.birth === rec.birth);
						if(same.length > 1){
							message.warning(`已存在 ${same.length} 条同名同生辰命盘，请注意区分（可编辑改名或加标签）`);
						}
					}
				}catch(e){
					// 提示尽力而为,绝不阻断保存
				}
				yield put({
		                type: 'setCurrentChart',
		                payload: rec,
		            });

	            yield put({
	                type: 'astro/openDrawer',
	                payload: {
						key: 'chartlist'
					},
	            });
			}catch(e){
				Modal.error({
					title: '命盘保存失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
			}
			return;
			
		},

		// 界面之外改了档案(任务中心采纳 / 撤销 AI 提案、别的窗口、单库导入、影子并回、恢复):刷新列表;当前的正是这条 → 按库里的完整记录重设
		// (只改了展示 / 管理 / 记账 / 关联字段时:命盘不重排、事盘不推进载入代次;事盘一律经 reloadCurrentCaseFromStore)。
		// 判据一律 recordChangeAffectsCast(改了哪些键):单条来源带 fields,批量来源按条带 fieldsByCid;没带 = 整条替换 = 影响。
		*syncRecordFromStore({ payload }, { put, select }){
			const { store, cid, fields, cids, fieldsByCid } = payload || {};
			if(!cid){
				// 一批记录被换过(别的窗口 / 单库导入整条替换 / 影子并回 / 恢复):cids 给了就按名单,没给就按「库里那条的更新时间与当前载入的不同」判。
				// 当前载入的正是被换的那条 → 按库里的新版重设(否则界面仍是旧版,一保存就把导入 / 并回改回去)
				const list = Array.isArray(cids) ? cids.map((c)=>`${c}`) : null;
				const hit = (curCid, curTime, rec)=>(list ? list.indexOf(`${curCid}`) >= 0 : `${(rec && rec.updateTime) || ''}` !== `${curTime || ''}`);
				const fieldsOf = (c)=>(fieldsByCid && typeof fieldsByCid === 'object' && Object.prototype.hasOwnProperty.call(fieldsByCid, `${c}`) ? fieldsByCid[`${c}`] : undefined);
				if(store !== 'case'){
					yield put({ type: 'fetchCharts', payload: {} });
					const cur = yield select((s)=>s.user && s.user.currentChart);
					const curCid = cur && cur.cid ? cur.cid.value : null;
					if(curCid){
						const rec = getLocalChart(curCid);
						if(rec && hit(curCid, cur.updateTime ? cur.updateTime.value : '', rec)){
							const skip = !recordChangeAffectsCast(fieldsOf(curCid));
							yield put({ type: 'setCurrentChart', payload: { ...rec, skipFetchByChartData: skip } });
							// 不重排的分支:左栏与盘面上的展示字段(名字 / 地名)照样跟上库里那版(此前一直显示旧名)
							if(skip){ yield put({ type: 'astro/patchRecordDisplayFields', payload: rec }); }
						}
					}
				}
				if(store !== 'chart'){
					yield put({ type: 'fetchCases', payload: {} });
					const curCase = yield select((s)=>s.user && s.user.currentCase);
					const caseRec = yield select((s)=>s.user && s.user.currentCaseRecord);
					const curCid = curCase && curCase.cid ? curCase.cid.value : null;
					if(curCid){
						const rec = getLocalCase(curCid);
						if(rec && hit(curCid, caseRec ? caseRec.updateTime : '', rec)){ yield* reloadCurrentCaseFromStore(rec, recordChangeAffectsCast(fieldsOf(curCid)), { put, select }); }
					}
				}
				return;
			}
			// 命盘重排 / 事盘推进载入代次共用一个判据(只改展示字段 → 都不动)
			const affectsChart = recordChangeAffectsCast(fields);
			if(store === 'case'){
				yield put({ type: 'fetchCases', payload: {} });
				const cur = yield select((s)=>s.user && s.user.currentCase);
				if(cur && cur.cid && `${cur.cid.value}` === `${cid}`){
					const rec = getLocalCase(cid);
					// 改的正是显式载入的那条且影响起课 → 推进载入代次重显(与批量分支同一个生成器)
					if(rec){ yield* reloadCurrentCaseFromStore(rec, affectsChart, { put, select }); }
				}
				return;
			}
			yield put({ type: 'fetchCharts', payload: {} });
			const cur = yield select((s)=>s.user && s.user.currentChart);
			if(cur && cur.cid && `${cur.cid.value}` === `${cid}`){
				const rec = getLocalChart(cid);
				if(rec){
					yield put({ type: 'setCurrentChart', payload: { ...rec, skipFetchByChartData: !affectsChart } });
					if(!affectsChart){ yield put({ type: 'astro/patchRecordDisplayFields', payload: rec }); }
				}
			}
		},

		*addLocalChartQuiet({ payload: values }, { put }){
			// 静默入库(名人库「加入命盘」等场景):不弹「星盘列表」抽屉、不导航,仅落库 + 刷新列表 state。
			// addChart 面向保存表单(打开列表抽屉且birth 为 DateTime(带符号年,BC/五位年安全));此处 payload.birth 多为字符串
			// ("YYYY-MM-DD HH:mm:ss"),upsertLocalChart/buildLocalChartRecord 本就容忍字符串,直接落库。
			// 回值:'persisted' 已落盘 / 'session' 只在本次运行有效 / false 没写进(配额满)。
			try{
				const v = { ...(values || {}) };
				// 新建才打代次标记;同 cid 的现档(旧档)不补标记 —— 补了 = 载入时缺键从「保持当前值」翻成「取出厂默认」
				upsertLocalChart(v.cid && getLocalChart(v.cid) ? v : markFieldsCaptured(v));
				yield put({ type: 'fetchCharts', payload: {} });
			}catch(e){
				return false;
			}
			return recordStorePersisted('chart') ? 'persisted' : 'session';
		},
		// 静默刷新已有记录的部分键(名人库同编号重复导入只刷新出生数据):与现档合并,不打代次标记
		// (旧档缺标记 = 「缺键不动当前值」的载入语义,刷新不该把它翻成「缺键取出厂默认」)。
		*refreshLocalChartQuiet({ payload: patch }, { put }){
			if(!patch || !patch.cid || !getLocalChart(patch.cid)){ return false; }
			try{
				upsertLocalChart({ ...patch });
				yield put({ type: 'fetchCharts', payload: {} });
			}catch(e){
				return false;
			}
			return recordStorePersisted('chart') ? 'persisted' : 'session';
		},

		*updateChart({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			try{
				if(values.birth){
					param.birth = values.birth.format('YYYY-MM-DD HH:mm:ss');
					param.zone = values.birth.zone;
				}
				const saved = upsertLocalChart(param);
				warnIfSessionOnly('chart', '命盘已更新');
				// 重新载入用库里的完整记录:upsert 的回值只带表单里有的键,记录原有的随盘设置(紫微代次标记与其余紫微键等)
				// 会缺席 → 载入按「旧盘只还原自带项」处理,得到一半记录值、一半页面值的混合状态。
				const rec = (saved && saved.cid ? getLocalChart(saved.cid) : null) || saved;
				// 当前命盘立刻换成库里刚存的这一版(同一条、已落盘);排盘只由下面这一次 fetchByChartData 做 ——
				// 不带 skip 会在 setCurrentChart 里另起一次排盘,两次换主盘按「最后发起的才落库」只留后一次,
				// 前一次带着的「当前命盘」就跟着作废
				yield put({
		                type: 'setCurrentChart',
		                payload: { ...(rec || {}), skipFetchByChartData: true },
		            });
				yield put({
		                type: 'astro/openDrawer',
		                payload: {
							key: 'chartlist'
						},
					});

	            yield put({
	                type: 'astro/fetchByChartData',
	                payload: {
						...(rec || {}),
						...values,
						birth: param.birth,
						zone: param.zone,
					},
				});
			}catch(e){
				Modal.error({
					title: '命盘更新失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
			}
			return;

		},

		*saveMemo({ payload: values }, { call, put, select }){
            const currentChart = yield select((s)=>s.user.currentChart);
			let type = values.type;
			if(type === 0){
				currentChart.memoAstro.value = values.orgMemo;
			}else if(type === 1){
				currentChart.memoBaZi.value = values.orgMemo;
			}else if(type === 2){
				currentChart.memoZiWei.value = values.orgMemo;
			}else if(type === 3){
				currentChart.memo74.value = values.orgMemo;
			}else if(type === 4){
				currentChart.memoGua.value = values.orgMemo;
			}else if(type === 5){
				currentChart.memoLiuReng.value = values.orgMemo;
			}else if(type === 6){
				currentChart.memoQiMeng.value = values.orgMemo;
			}else if(type === 7){
				currentChart.memoSuZhan.value = values.orgMemo;
			}
			// 只写批注八槽 = 局部写入:库里已没有这张盘(在命盘列表删掉了)时不能写 —— 内核会把它当新建,
			// 落下一条没名字、生辰是此刻的残缺记录并占住原 cid(之后回收站只能按副本恢复)
			if(!values.cid || !getLocalChart(values.cid)){
				Modal.warning({
					title: '批注没有保存',
					content: '这张命盘已从命盘列表删除。可到回收站恢复后再存批注。',
				});
				return;
			}
			try{
				// 只写批注八槽:其余字段由内核与库里现档合并保留(此前用内存里旧的 currentChart 整组回写名字 / 生辰 /
				// 分组等 17 项 → AI 改过名、加过标签之后再存批注,改动被回滚)
				upsertLocalChart({
					cid: values.cid,
					memoAstro: currentChart.memoAstro.value,
					memoBaZi: currentChart.memoBaZi.value,
					memoZiWei: currentChart.memoZiWei.value,
					memo74: currentChart.memo74.value,
					memoGua: currentChart.memoGua.value,
					memoLiuReng: currentChart.memoLiuReng.value,
					memoQiMeng: currentChart.memoQiMeng.value,
					memoSuZhan: currentChart.memoSuZhan.value,
				});
			}catch(e){
				Modal.error({
					title: '批注保存失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
				return;
			}
			if(recordStorePersisted('chart')){
				Modal.info({
					title: '批注已保存到本地。'
				});
			}else{
				Modal.warning({
					title: '批注已保存，但只在本次运行有效',
					content: '本机存储不可用，重启前请先在命盘列表导出一份备份。',
				});
			}
			yield put({
	                type: 'save',
	                payload: {
					currentChart: currentChart,
				},
	            });
			yield put({
	                type: 'astro/save',
	                payload: {  
					currentChart: currentChart,
	                },
	            });
			return;
		},

		*deleteChart({ payload: values }, { call, put, select }){
			const w = removeLocalChart(values.cid);
			noticeDeleteResult('chart', w);
			// 删的是当前命盘 → 脱离记录(删除没写进 = 记录还在,不动)
			if(!(w && w.persisted === false && w.reason === 'quota')){ yield* detachCurrentChartIn([values.cid], { put, select }); }
	            yield put({
	                type: 'astro/openDrawer',
	                payload: {
					key: 'chartlist'
				},
	            });
			return;

		},

		*changePwd({ payload: values }, { call, put }){
            let params = {
                OldPwd: values.oldPwd,
                NewPwd: values.newPwd,
			};
			
			const { Result } = yield call(service.changepwd, params);

            yield put({
                type: 'astro/closeDrawer',
                payload: {},
            });

		},

		*changeParams({ payload: values }, { call, put }){
			const param = {
				...values,
			};

			const { Result } = yield call(service.changeparams, param);

			yield put({
                type: 'astro/closeDrawer',
                payload: {},
            });

		},

	}

}
