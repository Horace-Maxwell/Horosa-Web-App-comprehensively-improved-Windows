// perfMark 交互观测契约(PERF-R10 Ship1):
//   ① 归属校验:markPanelReady 的键必须等于起点归属键(currentTab),不等即静默丢弃 ——
//      这正是 shusuan/mingother 曾经「验收恒零样本」的机制(KinAstroMain 打了 serviceKey)。
//   ② horosa_panel_ready_no_gen_void_v1:样本一经消费(t0/tech 定格)就必须落账,
//      双 rAF 窗口内出现新 pointerdown 不得作废 —— 旧守卫让快节奏连点几乎每条样本报废。
//   ③ MAX_SPAN 悬空起点丢弃仍然生效(② 删的是消费后的作废,不是消费前的垃圾闸)。
//   ④ KinAstroMain 键契约静态断言:0 处 serviceKey 打点、≥2 处 moduleKey 打点。
const fs = require('fs');
const path = require('path');

describe('perfMark interaction span contract', () => {
	let rafQueue;
	let perfMark;

	const flushRaf = () => {
		// 双 rAF:逐个执行,回调里可能再排新帧
		let guard = 0;
		while (rafQueue.length && guard < 32) {
			const cb = rafQueue.shift();
			cb();
			guard += 1;
		}
	};

	beforeEach(() => {
		jest.resetModules();
		rafQueue = [];
		global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
		window.requestAnimationFrame = global.requestAnimationFrame;
		// 每个用例拿全新模块实例(内部 stepT0/stepGen/ring 归零)
		perfMark = require('../perfMark');
	});

	function recentSamples(n) {
		return perfMark.perfRecent(n || 50).filter((s) => s.op === 'interaction');
	}

	it('drops panel-ready whose technique mismatches the start attribution (serviceKey bug class)', () => {
		perfMark.setCurrentTechnique('shusuan');
		perfMark.markInteractionStart('shusuan');
		perfMark.markPanelReady('shaozi');   // serviceKey ≠ 页签键 → 必须丢弃且不消费起点
		flushRaf();
		expect(recentSamples().length).toBe(0);
		// 真正归属的 ready 随后到达,仍能配对(起点未被误消费)
		perfMark.markPanelReady('shusuan');
		flushRaf();
		expect(recentSamples().length).toBe(1);
		expect(recentSamples()[0].tech).toBe('shusuan');
	});

	it('keeps a consumed sample even if a new gesture lands inside the double-rAF window', () => {
		perfMark.setCurrentTechnique('ziwei');
		perfMark.markInteractionStart('ziwei');
		perfMark.markPanelReady('ziwei');    // 消费起点,finish 排进 rAF 队列
		// 双 rAF 尚未执行:模拟用户已经点下了下一步(捕获期 pointerdown)
		document.dispatchEvent(new Event('pointerdown'));
		flushRaf();
		const samples = recentSamples();
		expect(samples.length).toBe(1);      // 旧守卫会在这里把样本作废成 0
		expect(samples[0].tech).toBe('ziwei');
	});

	it('still discards dangling starts older than MAX_SPAN', () => {
		const nowSpy = jest.spyOn(performance, 'now');
		nowSpy.mockReturnValue(1000);
		perfMark.setCurrentTechnique('bazi');
		perfMark.markInteractionStart('bazi');
		nowSpy.mockReturnValue(1000 + 15000 + 1);   // 超过 MAX_SPAN_MS=15000
		perfMark.markPanelReady('bazi');
		flushRaf();
		expect(recentSamples().length).toBe(0);
		nowSpy.mockRestore();
	});

	it('KinAstroMain marks panel-ready with moduleKey (tab attribution), never serviceKey', () => {
		const src = fs.readFileSync(
			path.join(__dirname, '..', '..', 'components', 'kinastro', 'KinAstroMain.js'),
			'utf8'
		);
		expect(src.match(/markPanelReady\(this\.config\.serviceKey\)/g)).toBeNull();
		const moduleKeyMarks = src.match(/markPanelReady\(this\.config\.moduleKey\)/g) || [];
		expect(moduleKeyMarks.length).toBeGreaterThanOrEqual(2);
	});
});
