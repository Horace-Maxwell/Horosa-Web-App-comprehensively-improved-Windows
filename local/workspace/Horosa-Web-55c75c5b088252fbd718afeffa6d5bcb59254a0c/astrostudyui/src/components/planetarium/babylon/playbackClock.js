// 天文馆 · 播放时钟的长帧处理(纯函数,不碰场景)。
// 播放时刻 = 起播时刻 + 速率 ×(现在 − 起播墙钟)。主线程被占住一下(首次打开一个重图层、一份全量数据回包建场景),
// 两帧之间的墙钟间隔就被拉长,加速档下模拟时间照墙钟一次补齐 → 画面顿住之后天球往前一跳。
// 这里把「卡顿造成的长帧」折成一帧名义时长:起播墙钟往后挪掉多出来的那段,模拟时间只走一帧的量,接着匀速播。

// 两帧间隔超过它才算卡顿(60Hz 下连丢 5 帧以上;偶尔丢一两帧不处理,免得把正常抖动也算进去)。
export const PLAYBACK_HITCH_MIN_MS = 100;
// 超过它的不是卡顿,是页面被挂起(切到别的页、窗口隐藏时帧循环整个停摆):沿用墙钟跟随,回来时停在墙钟对应的时刻。
export const PLAYBACK_HITCH_MAX_MS = 3000;
// 折成的一帧名义时长。
export const PLAYBACK_FRAME_NOMINAL_MS = 1000 / 60;

// 返回本帧应当使用的起播墙钟。
// 实时档(±1 倍)不折:它的语义就是跟着墙钟走,卡一下之后补上的那点位移肉眼看不出,折掉反而让天空落后于真实时间。
export function playbackAnchorAfterHitch(anchorMs, lastFrameMs, frameMs, speed){
	const anchor = Number(anchorMs);
	const last = Number(lastFrameMs);
	const now = Number(frameMs);
	if(!Number.isFinite(anchor) || !Number.isFinite(last) || !Number.isFinite(now) || !(last > 0)){ return anchorMs; }
	if(!(Math.abs(Number(speed)) > 1)){ return anchorMs; }
	const gap = now - last;
	if(!(gap > PLAYBACK_HITCH_MIN_MS) || gap > PLAYBACK_HITCH_MAX_MS){ return anchorMs; }
	return anchor + (gap - PLAYBACK_FRAME_NOMINAL_MS);
}
