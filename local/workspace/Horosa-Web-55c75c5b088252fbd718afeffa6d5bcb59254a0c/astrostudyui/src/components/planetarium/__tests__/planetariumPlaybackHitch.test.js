// 天文馆播放:卡顿造成的长帧不让模拟时间照墙钟一次补齐(天球往前一跳)。
import path from 'path';
import {
	playbackAnchorAfterHitch, PLAYBACK_HITCH_MIN_MS, PLAYBACK_HITCH_MAX_MS, PLAYBACK_FRAME_NOMINAL_MS,
} from '../babylon/playbackClock';

const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');

describe('天文馆播放长帧', ()=>{
	test('正常帧距不动起播墙钟', ()=>{
		expect(playbackAnchorAfterHitch(1000, 5000, 5016.7, 360)).toBe(1000);
		expect(playbackAnchorAfterHitch(1000, 5000, 5000 + PLAYBACK_HITCH_MIN_MS, 360)).toBe(1000);
	});

	test('加速档遇到卡顿:模拟时间只走一帧的量', ()=>{
		const anchor = 1000;
		const last = 5000;
		const now = 6432;   // 卡了 1432ms
		const next = playbackAnchorAfterHitch(anchor, last, now, 86400);
		// 卡顿前后「已播放墙钟」只多出一帧名义时长
		expect((now - next) - (last - anchor)).toBeCloseTo(PLAYBACK_FRAME_NOMINAL_MS, 9);
		// 倒放同样
		const back = playbackAnchorAfterHitch(anchor, last, now, -86400);
		expect(back).toBeCloseTo(next, 9);
	});

	test('实时档(±1 倍)保持跟着墙钟走', ()=>{
		expect(playbackAnchorAfterHitch(1000, 5000, 6432, 1)).toBe(1000);
		expect(playbackAnchorAfterHitch(1000, 5000, 6432, -1)).toBe(1000);
	});

	test('超过挂起阈值的间隔不算卡顿(页面切走 / 窗口隐藏),沿用墙钟跟随', ()=>{
		expect(playbackAnchorAfterHitch(1000, 5000, 5000 + PLAYBACK_HITCH_MAX_MS + 1, 360)).toBe(1000);
		expect(playbackAnchorAfterHitch(1000, 5000, 5000 + 60000, 360)).toBe(1000);
	});

	test('还没有上一帧(刚起播 / 已暂停清零)不处理', ()=>{
		expect(playbackAnchorAfterHitch(1000, 0, 6432, 360)).toBe(1000);
		expect(playbackAnchorAfterHitch(1000, NaN, 6432, 360)).toBe(1000);
	});

	test('帧循环在算本帧时刻之前先折长帧', ()=>{
		const src = readSource(path.resolve(__dirname, '..', 'PlanetariumBabylon.js'));   // 门面 + 子模块全集
		const fold = src.indexOf('this.playbackAnchorMs = playbackAnchorAfterHitch(this.playbackAnchorMs, this.playbackLastFrameMs, frameMs, speed);');
		const elapsed = src.indexOf('const elapsedSeconds = Math.max(0, (frameMs - this.playbackAnchorMs) / 1000);');
		const mark = src.indexOf('this.playbackLastFrameMs = frameMs;');
		expect(fold).toBeGreaterThan(0);
		expect(elapsed).toBeGreaterThan(fold);
		expect(mark).toBeGreaterThan(elapsed);
	});
});
