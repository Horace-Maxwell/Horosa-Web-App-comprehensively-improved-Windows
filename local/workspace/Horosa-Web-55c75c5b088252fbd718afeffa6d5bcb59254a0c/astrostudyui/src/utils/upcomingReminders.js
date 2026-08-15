// [V5-D15] 生日/整寿提醒(用户明令:设置里可开关;默认关,主动开启才提示)。
// 第一期=阳历生日 ±windowDays 窗口+逢十整寿标注;农历生日/换大限提醒列后续
// (需历法引擎与技法运限逻辑接线)。纯函数可测;启动时布局层 enabled 才跑。
import { safeLocalStorageGet, safeLocalStorageSet } from './safeStorage';

const ENABLED_KEY = 'horosa.reminders.enabled.v1';

export function remindersEnabled(){
	return safeLocalStorageGet(ENABLED_KEY) === '1';
}

export function setRemindersEnabled(on){
	safeLocalStorageSet(ENABLED_KEY, on ? '1' : '0');
}

// 扫记录:未来 windowDays 天内(含今天)过阳历生日的名单。
// 返回 [{name, cid, date:'MM-DD', inDays, turnsAge, decade}] 按 inDays 升序。
export function upcomingBirthdays(records, now, windowDays){
	const win = windowDays || 7;
	const base = now instanceof Date ? now : new Date();
	const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
	const out = [];
	(records || []).forEach((r)=>{
		if(!r || !r.birth || r.archived === true){
			return;
		}
		const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(`${r.birth}`);
		if(!m){
			return;
		}
		const [, by, bm, bd] = m;
		let next = new Date(today.getFullYear(), +bm - 1, +bd);
		if(next < today){
			next = new Date(today.getFullYear() + 1, +bm - 1, +bd);
		}
		const inDays = Math.round((next - today) / (24 * 3600 * 1000));
		if(inDays > win){
			return;
		}
		const turnsAge = next.getFullYear() - (+by);
		if(turnsAge <= 0){
			return;
		}
		out.push({
			name: r.name || '(未命名)',
			cid: r.cid,
			date: `${bm}-${bd}`,
			inDays,
			turnsAge,
			decade: turnsAge % 10 === 0,
		});
	});
	return out.sort((a, b)=>a.inDays - b.inDays);
}
