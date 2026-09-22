// [压测二轮·D6] 通知洪泛:一次批量任务能在几秒内推上百条通知 —— 页面侧必须先自己限流(桌面横幅令牌桶 + 同文去重),
// 不能把「壳侧再限流」当唯一防线(壳的限流器管不到 IDB 落库量,也管不到用户看到的 100 个横幅动画)。
import { pushNotice, listNotices, trimNotices, unreadCount, NOTICE_MAX, DESKTOP_NOTIFY_KEY } from '../aiAgent/tasks/noticeStore';
import { safeLocalStorageSet } from '../safeStorage';
import { AI_ANALYSIS_STORES, clearStore } from '../aiAnalysisStore';
import * as desktop from '../aiAnalysisDesktop';

const tick = ()=>new Promise((r)=>setTimeout(r, 0));
async function settle(maxTicks, stop){
	for(let i = 0; i < maxTicks; i++){
		// eslint-disable-next-line no-await-in-loop
		await tick();
		if(typeof stop === 'function' && stop()){ return; }
	}
}

beforeEach(async ()=>{
	window.localStorage.clear();
	jest.restoreAllMocks();
	await clearStore(AI_ANALYSIS_STORES.agentNotices);
});

describe('N1 桌面横幅限流', ()=>{
	it('🔴 N1a 10 秒内 100 条同文通知 → 桌面横幅只弹 1 次(同文去重)', async ()=>{
		// 当前代码为何红:noticeStore.js:46-54 的 pushNotice 对每一条都直接 `desktopShowNotification(...)`,
		// 页面侧零限流零去重(头注把限流全推给壳侧)—— 一个失败重试的目标任务能连弹上百个横幅。
		safeLocalStorageSet(DESKTOP_NOTIFY_KEY, '1');
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		const show = jest.spyOn(desktop, 'desktopShowNotification').mockResolvedValue({ shown: true });
		for(let i = 0; i < 100; i++){
			// eslint-disable-next-line no-await-in-loop
			await pushNotice({ level: 'warn', title: '目标任务出错', body: '连续出错已停止', taskId: 't1' });
		}
		expect(show.mock.calls.length).toBe(1);
		expect((await listNotices()).length).toBe(100);   // 判别力:通知本身照常全部落库(限的是横幅不是记录)
	}, 60000);

	it('🔴 N1b 100 条不同文案 → 每分钟桌面横幅调用 ≤6', async ()=>{
		// 当前代码为何红:同上 —— 页面侧没有令牌桶,100 条不同文案就是 100 次壳命令。
		safeLocalStorageSet(DESKTOP_NOTIFY_KEY, '1');
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		const show = jest.spyOn(desktop, 'desktopShowNotification').mockResolvedValue({ shown: true });
		for(let i = 0; i < 100; i++){
			// eslint-disable-next-line no-await-in-loop
			await pushNotice({ level: 'info', title: `任务 ${i} 完成`, body: `第 ${i} 条`, taskId: `t${i}` });
		}
		expect(show.mock.calls.length).toBeLessThanOrEqual(6);
	}, 60000);

	it('N1c 判别力:桌面通知开关关(缺省)→ 一次壳命令都不发,通知照常落库', async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		const show = jest.spyOn(desktop, 'desktopShowNotification').mockResolvedValue({ shown: true });
		await pushNotice({ level: 'info', title: 'a', body: 'b' });
		await pushNotice({ level: 'info', title: 'c', body: 'd' });
		expect(show).not.toHaveBeenCalled();
		expect((await listNotices()).length).toBe(2);
		expect(await unreadCount()).toBe(2);
	});
});

describe('N2 封顶与裁剪', ()=>{
	it('N2 600 条并发 pushNotice → 表长收敛到 ≤ NOTICE_MAX(裁剪不重入、不把表清空)', async ()=>{
		expect(NOTICE_MAX).toBe(500);
		await Promise.all(Array.from({ length: 600 }, (_, i)=>pushNotice({ level: 'info', title: `批量 ${i}`, body: `第 ${i} 条` }, { desktop: false })));
		await settle(60, async ()=>false);
		await trimNotices();
		const all = await listNotices();
		expect(all.length).toBeLessThanOrEqual(NOTICE_MAX);
		expect(all.length).toBeGreaterThan(NOTICE_MAX / 2);   // 判别力:不是被裁成空表
		// 新在前:留下的是最后写的那批
		expect(all[0].seq).toBeGreaterThan(all[all.length - 1].seq);
	}, 120000);
});
