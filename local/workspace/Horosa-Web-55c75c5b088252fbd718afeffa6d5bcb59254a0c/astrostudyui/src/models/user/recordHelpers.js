// 用户模型 · 存取提示与当前档案联动:只在本次运行有效 / 删除没写进的提示、清掉 / 从存储重载当前事盘、摘掉当前命盘
// 从 user.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { RECORD_NOT_PERSISTED_NOTE, recordStorePersisted, RECORD_DELETE_NOT_PERSISTED_NOTE } from '../../utils/recordStoreNotice';
import { message } from 'antd';
import { DAY_BOUNDARY_LOCKS_RELEASED } from '../../utils/dayBoundaryLock';

// 写入后只在本次运行有效(本机存储不可用)→ 提示;已落盘不打扰(这些入口落盘成功时本来就不弹成功提示)
export function warnIfSessionOnly(kind, text, note = RECORD_NOT_PERSISTED_NOTE){
	if(!recordStorePersisted(kind)){
		message.warning(`${text}${note}`);
	}
}

// 删除写不进(配额满,主库原样)→ 报错;只在本次运行有效 → 提示重启后还会在
export function noticeDeleteResult(kind, w){
	if(w && !w.persisted && w.reason === 'quota'){
		message.error(`${kind === 'case' ? '事盘' : '命盘'}删除没能写入：本地存储空间不足，请先导出清理后重试`);
		return;
	}
	warnIfSessionOnly(kind, kind === 'case' ? '事盘已删除' : '命盘已删除', RECORD_DELETE_NOT_PERSISTED_NOTE);
}

// 删掉的记录里有当前事盘 → currentCase 与原样记录同一次清(删除 / 撤销删档的唯一写入口)。
// 删掉的里有「显式载入的那条」→ 载入标记(appliedCaseCid)同一次清:否则从回收站恢复后点「编辑」(不是载入),
// 读档去重键按旧标记认成已载入,新挂载的技法页会按旧代次还原一次
export function* clearCurrentCaseIn(cids, { put, select }){
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
export function* reloadCurrentCaseFromStore(rec, affectsCast, { put, select }){
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
export function* detachCurrentChartIn(cids, { put, select }){
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
