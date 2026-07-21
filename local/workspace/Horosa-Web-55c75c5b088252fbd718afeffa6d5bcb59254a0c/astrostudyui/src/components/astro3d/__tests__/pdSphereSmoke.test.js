// 主限天球 · setData 全链 smoke(WP-4 防回潮根修):
// 现有测试全是纯数学/契约层,不跑渲染建场链 —— R-undefined 型 ReferenceError(jest 71 绿
// 而真机全坏)正是这个盲区。本文件喂真实 pd3d fixture 跑 setData→selectRow→playRow 全链。
//
// ⚠️ THREE 走全仓 jest 万能 stub(test/threeJestStub.js,三层病理定谳勿解除)——场景树
// 计数断言在 stub 下无意义;但 R-undefined 型错误是【纯 JS 作用域错】,与 THREE 无关,
// stub 下照抛并被 setData 分步 try 记账 → onError 非空即红。这正是本 smoke 的核心断言。
// 自证(已人工验证):把 _buildHorizonFrame 首行 `const R = this.radius` 临时删掉 → ① 必红。
import fs from 'fs';
import path from 'path';
import PDSphereEngine from '../PDSphereEngine';

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', 'pd3d.alcabitius.json'), 'utf8'));

beforeAll(()=>{
	// jsdom 无 canvas 2D:labelSprite 要 ctx.font/measureText/fillText —— 打桩最小面
	const stubCtx = {
		font: '', textBaseline: '', fillStyle: '', shadowColor: '', shadowBlur: 0,
		measureText: (t)=>({ width: Math.max(8, `${t}`.length * 10) }),
		fillText: ()=>{}, clearRect: ()=>{}, drawImage: ()=>{},
		fillRect: ()=>{},   // [WP-D] makeStarSprite→getGlowTexture 用(星空氛围层)
		getImageData: ()=>({ data: new Uint8ClampedArray(4) }),
		save: ()=>{}, restore: ()=>{}, scale: ()=>{},
		beginPath: ()=>{}, arc: ()=>{}, fill: ()=>{}, stroke: ()=>{},
		createRadialGradient: ()=>({ addColorStop: ()=>{} }),
	};
	window.HTMLCanvasElement.prototype.getContext = function(){ return stubCtx; };
	// raf 打桩:帧循环不自续(smoke 只断言同步建场/状态,不跑动画帧)
	window.requestAnimationFrame = ()=>0;
	window.cancelAnimationFrame = ()=>{};
});

function mkEngine(){
	const dom = document.createElement('div');
	document.body.appendChild(dom);
	const engine = new PDSphereEngine({
		dom, width: 800, height: 600,
		// 注入 stub renderer/controls(引擎 WP-4 注入点;jsdom 无 WebGL,生产不传=原路径零变)
		createRenderer: ()=>({
			domElement: document.createElement('canvas'),
			setPixelRatio(){}, setSize(){}, setClearColor(){}, render(){}, dispose(){}, forceContextLoss(){},
		}),
		createControls: ()=>({ addEventListener(){}, update(){}, dispose(){} }),
	});
	engine.init();
	return engine;
}

describe('[WP-4] setData 全链 smoke(真 fixture 建场链;THREE=全仓 stub)', ()=>{
	test('①setData 分步建场零失败(R-undefined 型作用域错在此必红)', ()=>{
		const engine = mkEngine();
		const errs = [];
		engine.onError = (m)=>errs.push(m);
		engine.setData(FIXTURE);
		expect(errs).toEqual([]);
		expect(engine.res).toBe(FIXTURE);
		expect(engine._frameBasis).toBeTruthy(); // 地平框架建成(basis 是纯对象,非 THREE)
		engine.dispose();
	});
	test('②selectRow→playRow 全链不抛;选中状态机正确', ()=>{
		const engine = mkEngine();
		engine.setData(FIXTURE);
		const sel = engine.selectRow(0);
		expect(sel && sel.row).toBeTruthy();
		expect(engine._selection && engine._selection.idx).toBe(0);
		engine.playRow(0, '', ()=>{});
		expect(engine._tweenActive).toBe(true);
		engine.dispose();
	});
	test('③连续换行选中+清选:状态机干净', ()=>{
		const engine = mkEngine();
		engine.setData(FIXTURE);
		engine.selectRow(0);
		engine.selectRow(1);
		expect(engine._selection.idx).toBe(1);
		engine.clearSelection();
		expect(engine._selection).toBe(null);
		engine.dispose();
	});
	test('④虚点 toggle/聚焦模式接口不抛且状态生效', ()=>{
		const engine = mkEngine();
		engine.setData(FIXTURE);
		engine.setVirtualToggles({ aspect: false, antiscia: true, term: false });
		expect(engine.virtualToggles).toEqual({ aspect: false, antiscia: true, term: false });
		engine.setFocusMode(false);
		expect(engine.focusMode).toBe(false);
		engine.setFocusMode(true);
		expect(engine.focusMode).toBe(true);
		engine.dispose();
	});
	test('⑥captureFrame 导出帧接口:stub renderer 下守卫返 null 且不抛', ()=>{
		const engine = mkEngine();
		engine.setData(FIXTURE);
		expect(engine.captureFrame()).toBe(null); // stub domElement 无真 WebGL 帧 → 守卫路径
		engine.dispose();
	});
	test('⑤M 类行(cat=M)选中不抛(相位口径分派路径)', ()=>{
		const engine = mkEngine();
		// 就地伪造一行 M 类(fixture 全 Z):复制首行改 cat —— 只测分派路径不抛
		const mRes = { ...FIXTURE, rows: [{ ...FIXTURE.rows[0], cat: 'M' }] };
		engine.setData(mRes);
		const sel = engine.selectRow(0);
		expect(sel && sel.row && sel.row.cat).toBe('M');
		engine.dispose();
	});
	// —— [WP-E] 防回潮三测:T 类分派 / PD_COLOR 语义键契约 / 建场全链 console 干净 ——
	test('⑦T 类行(cat=T,界)选中不抛(几何按行 cat 分派;pdTerms 开启产出的行)', ()=>{
		const engine = mkEngine();
		const tRes = { ...FIXTURE, rows: [{ ...FIXTURE.rows[0], cat: 'T' }] };
		engine.setData(tRes);
		const sel = engine.selectRow(0);
		expect(sel && sel.row && sel.row.cat).toBe('T');
		engine.dispose();
	});
	test('⑧PD_COLOR 语义键契约:引擎消费的键一个不缺(ecliptic 缺失曾致刻度线静默白色+material 警告)', ()=>{
		const { PD_COLOR } = require('../PDSphereEngine');
		// 注错自证:删掉 PD_COLOR.ecliptic → 本断言必红(键级契约,先于渲染层拦缺键)
		['ecliptic', 'direct', 'converse', 'virtualPoint'].forEach((k)=>{
			expect(Object.prototype.hasOwnProperty.call(PD_COLOR, k)).toBe(true);
			expect(Number.isFinite(PD_COLOR[k])).toBe(true);
		});
	});
	test('⑩[G3] 选中态机:显隐策略生效(restore 非空)+ 运动资产不再挂 skyGroup + 实体点 glyph 化字段', ()=>{
		const engine = mkEngine();
		engine.setData(FIXTURE);
		engine.selectRow(0);
		// 显隐/高亮还原钩非空 = 应星高亮+其余隐去策略确实执行(纯 JS 数组,stub 下真实可断言)
		expect(engine._selection.restore.length).toBeGreaterThan(0);
		// [G3] extraSky 兼容字段恒空 —— 选中行运动资产全数改挂 dirGroup(skyGroup 零残留)
		expect(engine._selection.extraSky).toEqual([]);
		// [G1] 实体点 glyph 化:非虚点条目带 isSprite 标记与 selK 基档
		let sawSprite = false;
		engine.pointMeshMap.forEach((entry)=>{
			if(!entry.isVirtual){
				expect(entry.isSprite).toBe(true);
				expect(entry.selK).toBeGreaterThan(0);
				sawSprite = true;
			}
		});
		expect(sawSprite).toBe(true);
		engine.dispose();
	});
	test('⑫[D2] 动方入选中态机:全族恒 prom(应星固定、迫星动)——行星与 MC 行同为 prom', ()=>{
		const engine = mkEngine();
		engine.setData(FIXTURE);
		const iSig = FIXTURE.rows.findIndex((r)=>!/MC|Asc|Vertex|House/i.test(r.sig));
		const iMc = FIXTURE.rows.findIndex((r)=>/N_MC_0/.test(r.sig));
		expect(iSig).toBeGreaterThanOrEqual(0);
		expect(iMc).toBeGreaterThanOrEqual(0);
		engine.selectRow(iSig);
		expect(engine._selection.mover).toBe('prom');   // [D2] 行星族亦迫星动(D1 曾 'sig')
		engine.selectRow(iMc);
		expect(engine._selection.mover).toBe('prom');
		engine.dispose();
	});
	test('⑬[L1] 圈层开关:六圈层组全登记+setFrameLayers 状态生效且持久化(标注总开关含内)', ()=>{
		const engine = mkEngine();
		engine.setData(FIXTURE);
		// 六圈全登记(ecliptic/equator/grid + 地平三圈;labels 是横切开关不占组)
		expect(Object.keys(engine._frameLayerGroups).sort()).toEqual(
			['ecliptic', 'equator', 'grid', 'horizon', 'meridian', 'primeVertical']
		);
		engine.setFrameLayers({ ecliptic: false, labels: false });
		expect(engine.frameLayers.ecliptic).toBe(false);
		expect(engine.frameLayers.labels).toBe(false);
		expect(engine.frameLayers.equator).toBe(true); // 未触碰键不连坐
		// localStorage 持久化 + 新引擎构造器回读(记忆闭环)
		const engine2 = mkEngine();
		expect(engine2.frameLayers.ecliptic).toBe(false);
		expect(engine2.frameLayers.labels).toBe(false);
		try{ localStorage.removeItem('horosa.pdsphere.frameLayers'); }catch(_){ }
		engine2.dispose();
		engine.dispose();
	});
	test('⑨setData→selectRow→playRow 全链 console 零 warn/error(建场链不允许任何静默告警)', ()=>{
		const logs = [];
		const spyW = jest.spyOn(console, 'warn').mockImplementation((...a)=>logs.push('W:' + a.join(' ')));
		const spyE = jest.spyOn(console, 'error').mockImplementation((...a)=>logs.push('E:' + a.join(' ')));
		try{
			const engine = mkEngine();
			engine.setData(FIXTURE);
			engine.selectRow(0);
			engine.playRow(0, '', ()=>{});
			engine.dispose();
		}finally{
			spyW.mockRestore();
			spyE.mockRestore();
		}
		expect(logs).toEqual([]);
	});
});
