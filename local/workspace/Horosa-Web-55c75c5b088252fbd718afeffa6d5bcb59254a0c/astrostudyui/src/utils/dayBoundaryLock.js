// 「左栏亲手改过日界 / 晚子时」的锁只属于改的那张盘 / 那一课(单一出处)。
// 锁的作用:亲手改过之后,「设置 → 日界 / 晚子时」的全局改动不再冲掉这一键(左栏最高权限)。
// 此前锁只在本会话「不复位」,与盘无关:换了一张盘(载入命盘 / 新命盘 / 此刻 / 载入另一条事盘)照样锁着,那张盘也不再跟随全局;
// 温启快照还把它带过重启。现在锁记下置位那一刻的盘身份(命盘换代次 astro.chartEpoch + 显式载入的事盘 appliedCaseCid / caseApplySeq),
// 身份变了锁就不算数。技法页组件实例上的锁一律经这里置位 / 判读(源码合同 dayBoundaryLockOwnership.test.js)。
import { getStore } from './storageutil';

const FLAG = { after23: '_after23BoundaryUserOverrode', lateZi: '_lateZiHourUserOverrode' };

// astro 模型层的同名两把锁(金口诀 / 六壬 / 卦占左栏改日界时置位,锁住共享 fields 不跟全局)与实例锁同一归属:
// 盘身份一变就复位。换命盘(astro fetchByChartData 非温启 / nowChart,同一次推进 chartEpoch)与换事盘
// (user 模型里写 appliedCaseCid / caseApplySeq 的每一处:applyCase / 界面外改档推进载入代次 / 删掉载入的那条)
// 都随同一次提交带上这一份(源码合同 bootDayBoundaryOverride.test.js)。
export const DAY_BOUNDARY_LOCKS_RELEASED = Object.freeze({ _after23BoundaryUserOverrode: false, _lateZiHourUserOverrode: false });

export function currentDayBoundaryLockOwner(){
	let st = null;
	try{ st = getStore(); }catch(e){ st = null; }
	const a = (st && st.astro) || {};
	const u = (st && st.user) || {};
	const cid = u.appliedCaseCid === undefined || u.appliedCaseCid === null ? '' : `${u.appliedCaseCid}`;
	return `${a.chartEpoch || 0}|${cid}|${u.caseApplySeq || 0}`;
}

// 左栏亲手改了这一键:置锁并记下当前盘身份。key = 'after23' | 'lateZi'
export function lockDayBoundary(inst, key){
	if(!inst || !FLAG[key]){ return; }
	inst[FLAG[key]] = true;
	inst._dayBoundaryLockOwner = { ...(inst._dayBoundaryLockOwner || {}), [key]: currentDayBoundaryLockOwner() };
}

// 锁还在、且属于当前这张盘 / 这一课
export function dayBoundaryLockHeld(inst, key){
	if(!inst || !FLAG[key] || !inst[FLAG[key]]){ return false; }
	const owner = inst._dayBoundaryLockOwner && inst._dayBoundaryLockOwner[key];
	return owner !== undefined && owner === currentDayBoundaryLockOwner();
}
