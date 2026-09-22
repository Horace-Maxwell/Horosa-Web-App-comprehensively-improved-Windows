// [批五] 界面操作轨迹(内存环,不进账本、零 localStorage):push/list/按 turnId 筛/撤销一次/环上限/订阅广播。
import { pushUiTrail, listUiTrail, undoUiTrail, subscribeUiTrail, UI_TRAIL_MAX, __resetUiTrailForTests } from '../aiAgent/uiTrail';

beforeEach(()=>{ window.localStorage.clear(); __resetUiTrailForTests(); });

it('push → list 带 canUndo;undo 走回调、只许一次;无回调条目 canUndo=false;回调回 ok:false 时不标 undone', ()=>{
	let back = 0;
	const id = pushUiTrail({ kind: 'route', turnId: 't1', label: '已切到八字', before: { tab: 'aianalysis' }, after: { tab: 'bazi' }, undo: ()=>{ back += 1; return { ok: true }; } });
	const id2 = pushUiTrail({ kind: 'route', turnId: 't2', label: '无回调' });
	const id3 = pushUiTrail({ kind: 'pair', turnId: 't1', label: '拒绝回退', undo: ()=>({ ok: false, message: 'nope' }) });
	expect(listUiTrail().map((x)=>x.canUndo)).toEqual([true, false, true]);
	expect(listUiTrail({ turnId: 't1' }).length).toBe(2);
	expect(undoUiTrail(id).ok).toBe(true); expect(back).toBe(1);
	expect(undoUiTrail(id).code).toBe('E_ACTION_NOT_FOUND');
	expect(undoUiTrail(id2).code).toBe('E_UNDO_NOT_APPLICABLE');
	expect(undoUiTrail(id3).ok).toBe(false); expect(listUiTrail().find((x)=>x.id === id3).undone).toBe(false);
	expect(listUiTrail().some((x)=>'_undo' in x)).toBe(false);
	expect(window.localStorage.length).toBe(0);
});
it('环上限与订阅广播', ()=>{
	const seen = [];
	const off = subscribeUiTrail((list)=>seen.push(list.length));
	for(let i = 0; i < UI_TRAIL_MAX + 5; i++){ pushUiTrail({ kind: 'route', label: `x${i}` }); }
	expect(listUiTrail().length).toBe(UI_TRAIL_MAX);
	expect(listUiTrail()[0].label).toBe('x5');
	expect(seen.length).toBe(UI_TRAIL_MAX + 5);
	off();
	pushUiTrail({ kind: 'route', label: 'after-off' });
	expect(seen.length).toBe(UI_TRAIL_MAX + 5);
});
