// 更新可视化 v2:事件 reducer 与格式化器哨兵。
// 兼容矩阵纪律:壳与前端可能不同版(runtime-only 更新不换壳),v2 字段全部 optional——
// 「旧壳零字段」与「新壳全字段」两个极端都必须正确退化/呈现。
jest.mock('../../../utils/aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: ()=>false,
	updateCheckSilent: jest.fn(),
	updateStartBackground: jest.fn(),
	updateInstallAndRestart: jest.fn(),
}));
jest.mock('../UpdateNotifier.less', ()=>({}), { virtual: true });

import { reduceUpdateEvent, fmtMB, fmtSpeed, fmtEta, modeBadgeText } from '../UpdateNotifier';

const BASE = { pct: 0, message: '', mode: '', reusePct: null, latestVersion: '' };

describe('reduceUpdateEvent 兼容矩阵', ()=>{
	test('新壳全字段:available 带模式/预计体积/复用率', ()=>{
		const patch = reduceUpdateEvent(BASE, {
			phase: 'available', latestVersion: '3.3.0', currentVersion: '3.2.1',
			notes: 'n', releaseUrl: 'u', mode: 'incremental', downloadBytes: 66060288, reusePct: 90,
		});
		expect(patch.phase).toBe('available');
		expect(patch.mode).toBe('incremental');
		expect(patch.estimateBytes).toBe(66060288);
		expect(patch.reusePct).toBe(90);
	});

	test('旧壳零字段:available 不炸且 v2 态为空(渲染退回老样式)', ()=>{
		const patch = reduceUpdateEvent(BASE, {
			phase: 'available', latestVersion: '3.3.0', currentVersion: '3.2.1',
		});
		expect(patch.phase).toBe('available');
		expect(patch.mode).toBe('');
		expect(patch.estimateBytes).toBeNull();
		expect(patch.reusePct).toBeNull();
	});

	test('downloading 合并字节账本字段,缺字段不覆盖既有值', ()=>{
		const full = reduceUpdateEvent(BASE, {
			phase: 'downloading', pct: 42, message: 'm',
			mode: 'incremental', totalBytes: 649 * 1048576, downloadedBytes: 214 * 1048576,
			speedBps: 6.4 * 1048576, etaSecs: 70, component: 'web-app', componentIndex: 2, componentTotal: 3,
		});
		expect(full.downloadedBytes).toBe(214 * 1048576);
		expect(full.component).toBe('web-app');
		const sparse = reduceUpdateEvent({ ...BASE, pct: 42 }, { phase: 'downloading' });
		expect(sparse.pct).toBe(42);
		expect(sparse).not.toHaveProperty('downloadedBytes');
	});

	test('planning 锁定模式与总量;downloading 带 mode=full 可覆盖(增量降级全量)', ()=>{
		const plan = reduceUpdateEvent(BASE, { phase: 'planning', pct: 8, mode: 'incremental', totalBytes: 100, reusePct: 88 });
		expect(plan.mode).toBe('incremental');
		expect(plan.totalBytes).toBe(100);
		const degraded = reduceUpdateEvent({ ...BASE, mode: 'incremental' }, { phase: 'downloading', pct: 10, mode: 'full' });
		expect(degraded.mode).toBe('full');
	});

	test('ready 带实际下载量与模式;uptodate 出 toast;error 兜底文案', ()=>{
		const ready = reduceUpdateEvent({ ...BASE, mode: 'incremental' }, { phase: 'ready', version: '3.3.0', downloadedBytes: 123, mode: 'incremental' });
		expect(ready.readyBytes).toBe(123);
		expect(ready.pct).toBe(100);
		expect(reduceUpdateEvent(BASE, { phase: 'uptodate' }).toast).toBe('已是最新版本');
		expect(reduceUpdateEvent(BASE, { phase: 'error' }).message).toBe('更新失败');
		expect(reduceUpdateEvent(BASE, null)).toBeNull();
	});

	test('check-failed/downgrade-blocked 低打扰 toast:不改 phase、不打断下载 UI', ()=>{
		const failed = reduceUpdateEvent(BASE, { phase: 'check-failed', message: '更新检查未完成（网络或更新源暂不可达）' });
		expect(failed.toast).toContain('更新检查未完成');
		expect(failed.phase).toBeUndefined(); // 只出 toast,phase 保持原态
		expect(reduceUpdateEvent(BASE, { phase: 'check-failed' }).toast).toBe('更新检查未完成，稍后会自动重试');
		const blocked = reduceUpdateEvent(BASE, { phase: 'downgrade-blocked', message: '线上运行环境版本低于本机' });
		expect(blocked.toast).toContain('低于本机');
		expect(blocked.phase).toBeUndefined();
		// 下载中收到 check-failed:补丁无 phase 字段 → 下载卡不被打断(组件层 merge 语义)
		const during = reduceUpdateEvent({ ...BASE, phase: 'downloading' }, { phase: 'check-failed' });
		expect(during.phase).toBeUndefined();
	});

	test('applying 安装阶段:带消息/缺消息兜底;未知 phase 返回 null', ()=>{
		const applying = reduceUpdateEvent(BASE, { phase: 'applying', message: '部件 2/7·web-app:解压 43% · 1024 个文件' });
		expect(applying.phase).toBe('applying');
		expect(applying.minimized).toBe(false);
		expect(applying.message).toContain('web-app');
		expect(reduceUpdateEvent(BASE, { phase: 'applying' }).message).toBe('正在安装更新…');
		expect(reduceUpdateEvent(BASE, { phase: 'phase-from-a-newer-shell' })).toBeNull();
	});
});

describe('notify-only(无 sha 不自动安装)', ()=>{
	test('available 带 notifyOnly → 状态置真并带解释文案', ()=>{
		const st = reduceUpdateEvent(BASE, {
			phase: 'available',
			latestVersion: '9.9.9',
			currentVersion: '9.9.8',
			releaseUrl: 'https://x/releases/tag/v9.9.9',
			notifyOnly: true,
			message: '更新清单暂不可获取',
		});
		expect(st.notifyOnly).toBe(true);
		expect(st.message).toBe('更新清单暂不可获取');
		expect(st.releaseUrl).toBe('https://x/releases/tag/v9.9.9');
	});

	test('老壳 available 不带该字段 → notifyOnly 判空退化为 false(照常可下载)', ()=>{
		const st = reduceUpdateEvent(BASE, { phase: 'available', latestVersion: '9.9.9' });
		expect(st.notifyOnly).toBe(false);
	});

	test('notify-only phase(后台下载被短路)→ 回 available 卡并切换形态,不停在假下载中', ()=>{
		const downloading = { ...BASE, phase: 'downloading', latestVersion: '9.9.9', releaseUrl: 'u' };
		const st = reduceUpdateEvent(downloading, {
			phase: 'notify-only',
			message: '已暂停自动下载',
			latestVersion: '9.9.9',
			releaseUrl: 'https://x/rel',
		});
		expect(st.phase).toBe('available');
		expect(st.notifyOnly).toBe(true);
		expect(st.releaseUrl).toBe('https://x/rel');
		expect(st.toast).toBe('已暂停自动下载');
	});

	test('notify-only 缺字段时回退到既有 state(不产生 undefined)', ()=>{
		const prev = { ...BASE, latestVersion: '1.2.3', releaseUrl: 'keep' };
		const st = reduceUpdateEvent(prev, { phase: 'notify-only' });
		expect(st.latestVersion).toBe('1.2.3');
		expect(st.releaseUrl).toBe('keep');
		expect(typeof st.toast).toBe('string');
	});
});

describe('格式化器', ()=>{
	test('fmtMB/fmtSpeed/fmtEta 数值与空值', ()=>{
		expect(fmtMB(649 * 1048576)).toBe('649');
		expect(fmtMB(63.4 * 1048576)).toBe('63.4');
		expect(fmtMB(null)).toBe('');
		expect(fmtSpeed(6.1 * 1048576)).toBe('6.1 MB/s');
		expect(fmtSpeed(0)).toBe('');
		expect(fmtEta(70)).toBe('约剩 1 分 10 秒');
		expect(fmtEta(42)).toBe('约剩 42 秒');
		expect(fmtEta(null)).toBe('');
	});
	test('模式徽标', ()=>{
		expect(modeBadgeText('incremental')).toBe('增量');
		expect(modeBadgeText('full')).toBe('完整');
		expect(modeBadgeText('')).toBe('');
	});
});
