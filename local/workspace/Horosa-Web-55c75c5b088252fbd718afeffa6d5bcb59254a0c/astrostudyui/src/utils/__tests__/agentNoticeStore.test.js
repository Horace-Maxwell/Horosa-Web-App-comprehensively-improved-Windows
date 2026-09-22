// 通知中心(P1)合同:落库归一/未读/已读/封顶清理;桌面横幅门:缺省关 → 壳命令零调用;开且桥在 → 调用;desktop:false 可禁。
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>true),
	desktopShowNotification: jest.fn(async ()=>({ shown: true })),
	invokeDesktopCommand: jest.fn(async ()=>({})),
}));
import { pushNotice, listNotices, unreadCount, markRead, trimNotices, isDesktopNotifyEnabled, DESKTOP_NOTIFY_KEY, NOTICE_MAX } from '../aiAgent/tasks/noticeStore';
import { clearStore, AI_ANALYSIS_STORES } from '../aiAnalysisStore';
import * as desktop from '../aiAnalysisDesktop';

beforeEach(async ()=>{ window.localStorage.clear(); jest.clearAllMocks(); await clearStore(AI_ANALYSIS_STORES.agentNotices); });

describe('noticeStore', ()=>{
	it('pushNotice 归一(level 枚举/截断/read=false);listNotices 新在前;unreadCount;markRead 单条与 all', async ()=>{
		const a = await pushNotice({ level: 'bogus', title: 't'.repeat(200), body: 'b', taskId: 'task-1' });
		expect(a.level).toBe('info');
		expect(a.title.length).toBe(120);
		expect(a.read).toBe(false);
		expect(a.taskId).toBe('task-1');
		await pushNotice({ level: 'error', title: '失败', body: 'x' });
		const list = await listNotices();
		expect(list.map((n)=>n.level)).toEqual(['error', 'info']);
		expect(await unreadCount()).toBe(2);
		expect(await markRead(a.id)).toBe(1);
		expect(await unreadCount()).toBe(1);
		expect((await listNotices({ unreadOnly: true })).length).toBe(1);
		expect(await markRead('all')).toBe(1);
		expect(await unreadCount()).toBe(0);
		expect(await markRead('all')).toBe(0);
	});
	it('封顶:超出 max 的旧记录删除(缺省 500)', async ()=>{
		for(let i = 0; i < 6; i++){
			// eslint-disable-next-line no-await-in-loop
			await pushNotice({ title: `n${i}`, body: '' }, { desktop: false });
		}
		expect(await trimNotices(4)).toBe(2);
		expect((await listNotices()).map((n)=>n.title)).toEqual(['n5', 'n4', 'n3', 'n2']);
		expect(NOTICE_MAX).toBe(500);
	});
	it('🔴 桌面横幅门:缺省(键缺席)零调用;键=1 且桥在 → 调用一次并记 desktopShown;desktop:false 强制不弹;桥不在不弹', async ()=>{
		expect(isDesktopNotifyEnabled()).toBe(false);
		const off = await pushNotice({ title: 'a', body: 'b' });
		expect(desktop.desktopShowNotification).not.toHaveBeenCalled();
		expect(off.desktopShown).toBe(false);
		window.localStorage.setItem(DESKTOP_NOTIFY_KEY, '1');
		expect(isDesktopNotifyEnabled()).toBe(true);
		const on = await pushNotice({ title: '完成', body: '任务完成' });
		expect(desktop.desktopShowNotification).toHaveBeenCalledTimes(1);
		expect(desktop.desktopShowNotification).toHaveBeenCalledWith('完成', '任务完成');
		expect(on.desktopShown).toBe(true);
		await pushNotice({ title: 'silent', body: '' }, { desktop: false });
		expect(desktop.desktopShowNotification).toHaveBeenCalledTimes(1);
		desktop.isDesktopBridgeAvailable.mockReturnValue(false);
		const noBridge = await pushNotice({ title: 'x', body: 'y' });
		expect(desktop.desktopShowNotification).toHaveBeenCalledTimes(1);
		expect(noBridge.desktopShown).toBe(false);
		// 壳命令拒绝(限流/偏好关)→ desktopShown=false 但通知照落库
		desktop.isDesktopBridgeAvailable.mockReturnValue(true);
		desktop.desktopShowNotification.mockResolvedValueOnce({ shown: false, reason: 'rate_limited' });
		const limited = await pushNotice({ title: 'z', body: 'w' });
		expect(limited.desktopShown).toBe(false);
		expect((await listNotices()).length).toBe(5);
	});
});
