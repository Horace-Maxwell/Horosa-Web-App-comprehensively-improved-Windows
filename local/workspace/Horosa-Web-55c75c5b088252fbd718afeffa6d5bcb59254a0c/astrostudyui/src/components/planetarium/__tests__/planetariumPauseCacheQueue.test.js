// 天文馆三条状态合同(真机可复现):
// ① 只补轨迹 / 只换星表的快路径,缓存存这次请求的原始回包,不存拼接结果(拼接结果里日月行星已被播放推到别的时刻,observer.jd 却是旧的,
//    切页再回来按 observer.jd 判命中、不再校准 → 天体停在播放时的位置,时钟却是命盘时刻)。
// ② 暂停后把 state.time 对齐到暂停帧即清掉「最后一帧时刻」;单步 / 改时间 / 回到命盘 / 换盘先清它
//    (否则「空格暂停 → 单步 → 空格继续」从旧暂停瞬间开播;播放中点「回到命盘」被暂停分支盖回最后一帧)。
// ③ 在途期间排着的整场重取,不被后来的「只补行星轨迹」顶掉(和「只补星表」同律)。
import path from 'path';

const { readSource, fnBody } = require('../../../utils/__tests__/helpers/sourceSet');
const SRC = readSource(path.resolve(__dirname, '..', 'PlanetariumBabylon.js'));

describe('天文馆:缓存 / 暂停 / 排队', ()=>{
	test('① 快路径缓存原始回包', ()=>{
		const body = fnBody(SRC, 'finishStateData(payload)');
		expect(body).toBeTruthy();
		expect(body).toMatch(/cachePlanetariumState\(trailsOnly \|\| starsOnly \? payload\.data : data\);/);
		expect((body.match(/cachePlanetariumState\(/g) || []).length).toBe(1);
	});

	test('② 暂停分支对齐 state.time 后清掉最后一帧时刻;改时刻的四处先清', ()=>{
		const setup = fnBody(SRC, 'setupPlayback()');
		expect(setup).toBeTruthy();
		const pause = setup.slice(0, setup.indexOf('this.playbackAnchorMs = nowMs();'));
		const align = pause.indexOf('this.setState({ time: pauseTime');
		const clear = pause.indexOf('this.playbackLastFrameTime = null;');
		expect(align).toBeGreaterThan(-1);
		expect(clear).toBeGreaterThan(align);
		['jumpNow()', 'stepTime(amount, unit)', 'changeObserverTime(res)'].forEach((sig)=>{
			const b = fnBody(SRC, sig);
			expect([sig, !!b]).toEqual([sig, true]);
			const c = b.indexOf('this.playbackLastFrameTime = null;');
			const st = b.indexOf('this.setState(');
			expect([sig, c > -1 && c < st]).toEqual([sig, true]);
		});
		const upd = fnBody(SRC, 'componentDidUpdate(prevProps, prevState)') || fnBody(SRC, 'componentDidUpdate(prevProps)');
		expect(upd).toBeTruthy();
		expect(upd).toMatch(/if\(prevProps\.fields !== this\.props\.fields\)\{\s*\n\s*const time = buildObservationTime\(this\.props\.fields\);\s*\n\s*this\.playbackLastFrameTime = null;/);
	});

	test('③ 排着的整场重取不被只补星表 / 只补轨迹顶掉', ()=>{
		const body = fnBody(SRC, 'async requestState(options = {})');
		expect(body).toBeTruthy();
		expect(body).toMatch(/const narrow = \(r\)=>isStarOnlyReason\(r\) \|\| r === 'planet-trails';/);
		expect(body).toMatch(/if\(queued && !narrow\(queued\.reason\) && narrow\(opts\.reason\)\)\{\s*\n\s*return;/);
	});
});
