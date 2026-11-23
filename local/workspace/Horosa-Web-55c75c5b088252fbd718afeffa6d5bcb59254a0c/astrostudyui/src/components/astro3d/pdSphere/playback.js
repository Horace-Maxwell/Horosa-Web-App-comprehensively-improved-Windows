// 主限天球引擎 · 播放:按行播放周日运动、转到某行、截帧、复位、渐隐尾迹、选中脉冲
// 从 PDSphereEngine.js 按职责拆出的 PDSphereEngine 方法:this 仍是 PDSphereEngine 实例,门面里 mixinMethods(PDSphereEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import { easeInOutCubic } from '../morphMath';
import { promRotationRad, playDurationMs } from '../pdSphereMath';
import { PD_COLOR, TWO_PI } from './sceneConst';

export const playbackMethods = {
	// —— 播放:dirGroup.rotation.y 0 → −arc·π/180(easeInOutCubic;converse 负弧自然反向)——
	// 运动组独转:应星/黄道/其余点全部静止,唯迫星组被周日运动引导(directio 正统)。
	// 连播衔接:非本命姿态起播时先 300ms 缓动回 0 再进入正式播放——
	// selectRow 起手会硬置 rotation=0(路径弧/marker 按 rotation=0 烘焙,不可从中途姿态直转),
	// 旧行为=瞬间跳回本命再播(跳变);现=柔和回 0 → _playRowCore。
	playRow(idx, cardText, onDone){
		const curY = this.dirGroup ? this.dirGroup.rotation.y : 0;
		if(Math.abs(curY) > 1e-6){
			this._playToken += 1;
			const token = this._playToken;
			const t0 = performance.now();
			this._tweenActive = true;
			const back = ()=>{
				if(this.disposed){ this._tweenActive = false; return; }
				if(token !== this._playToken){ return; }
				const t = Math.min(1, (performance.now() - t0) / 300);
				this._applyDirRotation(curY * (1 - easeInOutCubic(t)));
				this.wake(1);
				if(t < 1){
					window.requestAnimationFrame(back);
				}else{
					this._tweenActive = false;
					this._playRowCore(idx, cardText, onDone);
				}
			};
			this.wake(2);
			window.requestAnimationFrame(back);
			return;
		}
		this._playRowCore(idx, cardText, onDone);
	},

	_playRowCore(idx, cardText, onDone){
		const sel = this.selectRow(idx);
		if(!sel){
			return;
		}
		const row = sel.row;
		const target = promRotationRad(row);   // 迫星旋转角(族定号序;应星固定)
		const dur = playDurationMs(row.arc);
		this._playToken += 1;
		const token = this._playToken;
		this._showLabelCard(cardText, sel.conv);
		this._trailInit(sel.conv); // 接回渐隐尾迹(死代码复活:头注早已宣称,基建全在,只差三处接线)
		this._setBeaconEmphasis(true); // 播放期周日方向浮标提亮

		const t0 = performance.now();
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;   // 新播放/新数据已接管(不碰 _tweenActive,由接管方主导)
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			const eased = easeInOutCubic(t);
			this._applyDirRotation(target * eased);
			// 走过的路实线渐现(setDrawRange 与转角同步 —— 轨迹随转动陆续出现,不提前铺)
			const selNow = this._selection;
			if(selNow && selNow.progressLine){
				selNow.progressLine.geometry.setDrawRange(0, Math.max(0, Math.floor(eased * selNow.pathSegs) + 1));
			}
			this._trailAppend(); // 迫星活动标残影逐帧记点
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
				this._pulseSelection(token);   // t=1:应星位置圈 emissive 脉冲 2 次
				this._emitTrueMotionInfo();    // 播放落定:历时+诸曜真位漂移报宿主信息行
				this._trailFade(token);        // 尾迹渐隐收场
				this._setBeaconEmphasis(false); // 播完浮标回淡显
				if(onDone){
					onDone();
				}
				// 播放停在命中姿态(默认)——与时间轴拖拽路径行为统一,天球停驻在「事件发生时的天空」。
				// 显式开启「播完自动复位」(设置 checkbox → localStorage horosa.pdsphere.autoResetAfterPlay='1')
				// 才走 900ms 缓动回 0(旧 WP-3 行为);连播不再依赖此块——playRow 起手自带 300ms 回 0 衔接。
				let autoReset = false;
				try{ autoReset = localStorage.getItem('horosa.pdsphere.autoResetAfterPlay') === '1'; }catch(_){ }
				if(autoReset){
					const fromY = this.dirGroup.rotation.y;
					if(Math.abs(fromY) > 1e-6){
						const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 600; // 停留 0.6s 再回
						const backStep = ()=>{
							if(this.disposed || token !== this._playToken){ return; }
							const now2 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
							if(now2 < t1){ window.requestAnimationFrame(backStep); return; }
							const k = Math.min(1, (now2 - t1) / 900);
							this._applyDirRotation(fromY * (1 - easeInOutCubic(k)));
							this.wake(1);
							if(k < 1){ window.requestAnimationFrame(backStep); }
						};
						window.requestAnimationFrame(backStep);
					}
				}
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	},

	/** 时间轴拖拽落点:选行后直接补间到该行弧位(600ms,无尾迹/脉冲 —— 播放专属观感不稀释) */
	rotateToRow(idx){
		const sel = this.selectRow(idx);
		if(!sel){
			return;
		}
		const target = promRotationRad(sel.row);   // 迫星旋转角(族定号序;应星固定)
		this._playToken += 1;
		const token = this._playToken;
		const from = this.dirGroup.rotation.y;
		const t0 = performance.now();
		const dur = 600;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			this._applyDirRotation(from + (target - from) * easeInOutCubic(t));
			const selNow = this._selection;
			if(selNow && selNow.progressLine && Math.abs(target) > 1e-9){
				const frac = Math.max(0, Math.min(1, this.dirGroup.rotation.y / target));
				selNow.progressLine.geometry.setDrawRange(0, Math.floor(frac * selNow.pathSegs) + 1);
			}
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
				this._emitTrueMotionInfo();   // 拖拽落定同报信息行
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	},

	/** 复位:天球转回 0 位(选择保留) */
	// 导出附图用:render 后同步读帧(WebGL preserveDrawingBuffer=false 下唯一可靠路)。
	// stub renderer(jsdom smoke)无真 toDataURL → 守卫返 null,由截图链降级,绝不抛。
	captureFrame(){
		try{
			const el = this.renderer && this.renderer.domElement;
			if(!el || typeof el.toDataURL !== 'function'){
				return null;
			}
			this.renderer.render(this.scene, this.camera);
			const dataUrl = el.toDataURL('image/png');
			if(!dataUrl || dataUrl.length < 2000){
				return null;
			}
			return { dataUrl, width: el.width || 0, height: el.height || 0 };
		}catch(e){
			return null;
		}
	},

	resetRotation(){
		this._playToken += 1;
		const token = this._playToken;
		// 复位=回本命姿态:同时清「走过的路」轨迹线(原漏清——复位后轨迹残留在 0 姿态上错位)。
		const selNow = this._selection;
		if(selNow && selNow.progressLine){
			selNow.progressLine.geometry.setDrawRange(0, 0);
		}
		this._setBeaconEmphasis(false); // 复位浮标回淡显
		// 复位同时回正视角到当前档默认位(带缓动;视角=观感的一部分,复位应一并归位)
		this.applyViewMode(this.viewMode, true);
		const from = this.dirGroup ? this.dirGroup.rotation.y : 0;
		if(!this.dirGroup || Math.abs(from) < 1e-9){
			return;
		}
		const t0 = performance.now();
		const dur = 500;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			this._applyDirRotation(from * (1 - easeInOutCubic(t)));
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	},

	// —— 尾迹:播放中逐帧记录迫星活动标世界位(观测者系),顶点色头亮尾黑=渐隐观感 ——
	_trailInit(conv){
		this._clearTrail();
		this._trail = {
			pts: [],
			color: new THREE.Color(conv ? PD_COLOR.converse : PD_COLOR.direct),
			line: null,
		};
	},

	_trailAppend(){
		if(!this._trail || !this._selection || !this._selection.marker){
			return;
		}
		const v = new THREE.Vector3();
		this._selection.marker.getWorldPosition(v);
		const pts = this._trail.pts;
		pts.push(v);
		if(pts.length > 420){
			pts.shift();
		}
		if(pts.length < 2){
			return;
		}
		// 逐帧重建多段线(≤420 顶点,播放期专属开销;LineBasicMaterial 顶点色:黑底上
		// 头亮尾黑 + additive = 透明度衰减观感,免自定义 shader)
		if(this._trail.line){
			this.selGroup.remove(this._trail.line);
			this._disposeObject(this._trail.line);
		}
		const n = pts.length;
		const positions = new Float32Array(n * 3);
		const colors = new Float32Array(n * 3);
		for(let i = 0; i < n; i += 1){
			positions[i * 3] = pts[i].x;
			positions[i * 3 + 1] = pts[i].y;
			positions[i * 3 + 2] = pts[i].z;
			const k = n > 1 ? (i / (n - 1)) : 1;   // 头(新)=1,尾(旧)→0
			colors[i * 3] = this._trail.color.r * k;
			colors[i * 3 + 1] = this._trail.color.g * k;
			colors[i * 3 + 2] = this._trail.color.b * k;
		}
		const geom = new THREE.BufferGeometry();
		geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			opacity: 0.9,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		}));
		this._trail.line = line;
		this.selGroup.add(line);
	},

	_trailFade(token){
		if(!this._trail || !this._trail.line){
			return;
		}
		const material = this._trail.line.material;
		const t0 = performance.now();
		const dur = 900;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			if(material){
				material.opacity = 0.9 * (1 - t);
			}
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
				this._clearTrail();
				this.wake(1);
			}
		};
		window.requestAnimationFrame(step);
	},

	_clearTrail(){
		if(this._trail && this._trail.line){
			this.selGroup.remove(this._trail.line);
			this._disposeObject(this._trail.line);
		}
		this._trail = null;
	},

	// —— t=1 应星位置圈脉冲:sin²(2πt) 包络恰 2 个峰;Tube 走真 emissiveIntensity,
	//    Line(采样多段线/细弧,LineBasicMaterial 无 emissive 通道)等效走颜色提白 ——
	_pulseSelection(token){
		if(!this._selection || !this._selection.pulseTargets.length){
			return;
		}
		const targets = this._selection.pulseTargets;
		const white = new THREE.Color(0xffffff);
		const t0 = performance.now();
		const dur = 1100;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			const envelope = Math.pow(Math.sin(TWO_PI * t), 2);   // t∈[0,1] 峰在 0.25/0.75 → 2 次脉冲
			targets.forEach((tg)=>{
				if(!tg.material){
					return;
				}
				if(tg.mode === 'emissive'){
					tg.material.emissiveIntensity = 1 + 1.8 * envelope;
				}else if(tg.material.color){
					const base = new THREE.Color(tg.baseColor);
					tg.material.color.copy(base.lerp(white, envelope * 0.85));
				}
			});
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
				targets.forEach((tg)=>{
					if(!tg.material){
						return;
					}
					if(tg.mode === 'emissive'){
						tg.material.emissiveIntensity = 1;
					}else if(tg.material.color && tg.baseColor !== undefined){
						tg.material.color.setHex(tg.baseColor);
					}
				});
				this.wake(1);
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	},
};
