// labelUploadQueue.js —— 天文馆名牌纹理的「画完隔两帧再上传」队列(不碰 Babylon / DOM)。
// 名牌是画布上画描边字再传成纹理。WebKit 的画布是延迟栅格化的:画的那一刻只记指令(几乎不花时间),
// 真正的栅格化在后台做;画完立刻上传 = 主线程原地等它栅格化完(实测 60 张 256x64 约 50ms),
// 隔两帧再上传时已栅格化好(同样 60 张约 6ms)。于是一次开一层几十个名牌、或整场重建两百多个名牌,
// 主线程不再被栅格化卡住。没上传的纹理处于未就绪状态,名牌晚两帧(约 33ms)露出,字、位置、清晰度不变。
//
// 渲染循环没跑起来之前(含 jest:没有渲染循环)一律当场上传,和原先完全一样。

export const LABEL_UPLOAD_MIN_AGE_FRAMES = 2;   // 画完至少隔几帧再上传
export const LABEL_UPLOAD_SLICE_MS = 4;         // 一帧里上传名牌的时间预算(至少传一张,保证往前走)

function defaultNow(){
	return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

export class LabelUploadQueue {
	constructor(now){
		this.now = typeof now === 'function' ? now : defaultNow;
		this.pending = new Map();   // 纹理 → { upload, frame };Map 按登记先后迭代 = 按画的先后
		this.frame = 0;
	}

	// 渲染循环跑过至少一帧才延后(否则没人来取,名牌永远不出现)
	get live(){
		return this.frame > 0;
	}

	get size(){
		return this.pending.size;
	}

	// 登记一张刚画完的名牌。返回 false = 队列没在转,调用方当场上传。
	// 同一张纹理重画(界面简繁切换)→ 挪到队尾重新计帧,只传最后一次画的内容。
	push(texture, upload){
		if(!texture || typeof upload !== 'function' || !this.live){ return false; }
		this.pending.delete(texture);
		this.pending.set(texture, { upload, frame: this.frame });
		return true;
	}

	// 纹理被释放 / 被换掉:不再上传
	drop(texture){
		this.pending.delete(texture);
	}

	clear(){
		this.pending.clear();
	}

	// 渲染循环每帧调一次(在画这一帧之前)
	tick(){
		this.frame += 1;
		return this.flush(false);
	}

	// force = 不看帧龄、不看预算,全部传完(收尾 / 需要立刻齐全的场合)
	flush(force){
		if(!this.pending.size){ return 0; }
		const started = this.now();
		let done = 0;
		let stop = false;
		this.pending.forEach((item, texture)=>{
			if(stop){ return; }
			if(!force){
				// 按画的先后排,碰到第一张还太新的就可以停了
				if(this.frame - item.frame < LABEL_UPLOAD_MIN_AGE_FRAMES){ stop = true; return; }
				if(done > 0 && this.now() - started >= LABEL_UPLOAD_SLICE_MS){ stop = true; return; }
			}
			this.pending.delete(texture);
			try{ item.upload(); }catch(e){ /* 单张失败不影响其余 */ }
			done += 1;
		});
		return done;
	}
}
