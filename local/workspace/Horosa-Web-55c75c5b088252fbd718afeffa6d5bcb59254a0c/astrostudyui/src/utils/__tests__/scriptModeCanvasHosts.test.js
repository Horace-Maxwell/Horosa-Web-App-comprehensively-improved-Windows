// 界面简繁 · 护栏:canvas 上画的字在切换后要重画。
// SVG / DOM 里的字由显示层自动转换;canvas / WebGL 纹理上的字是绘制那一刻定下的,切换后不重画就停在旧写法。
// 凡在 canvas 上画字的文件(fillText / strokeText / echarts.init):自己经 watchChartScript(utils/chartDrawGuard.js)
// 订阅重画,或在下表登记「谁是它的宿主、宿主用哪个入口重画」—— 宿主文件必须订阅并调用那个入口。
import { makeTextSprite, repaintTextSprites } from '../../components/astro3d/labelSprite';
import { watchChartScript } from '../chartDrawGuard';
import { applyScriptMode, SCRIPT_HANT, __resetScriptModeForTest, __setConverterForTest } from '../scriptMode';

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../..');
const CANVAS_TEXT_RE = /\.(fillText|strokeText)\s*\(|echarts\.init\s*\(/;
const SUBSCRIBE_RE = /\bwatchChartScript\s*\(/;

// 画字的库文件 → [宿主文件, 宿主里必须调用的重画入口] 列表
const LIBS = {
	'components/fengshui/fengshuiEngine.js': [['components/fengshui/FengShuiMain.js', /engine\.drawAll\(\)/]],
	'components/astro3d/labelSprite.js': [
		['components/astro3d/AstroChart3D.js', /repaintTextSprites\(\)/],
		['components/astro3d/AstroPDSphere.js', /repaintTextSprites\(\)/],
	],
	'components/planetarium/babylon/PlanetariumRenderer.js': [['components/planetarium/PlanetariumBabylon.js', /repaintTextLabels\(\)/]],
};
// 只在导出时临时画、画完即丢的(不在屏幕上停留),不必订阅
const EXEMPT = {
	'utils/scriptMode.js': '单源件本身',
};

function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){
			if(f === '__tests__' || f === 'test' || f === '.umi' || f === '.umi-production' || f === '.umi-test'){ return; }
			walk(p, out);
		}else if(/\.(js|jsx)$/.test(f)){
			out.push(p);
		}
	});
	return out;
}
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('canvas 上画字的地方切换后都会重画(界面简繁)', () => {
	const drawers = [];
	walk(SRC, []).forEach((file)=>{
		const rel = path.relative(SRC, file).split(path.sep).join('/');
		const code = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((ln)=>ln.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
		if(CANVAS_TEXT_RE.test(code)){ drawers.push(rel); }
	});

	it('扫到了已知的画字文件(防正则静默失效)', () => {
		expect(drawers).toEqual(expect.arrayContaining(Object.keys(LIBS)));
	});

	it('每个画字文件:自己订阅,或登记了宿主且宿主订阅并调重画入口', () => {
		const bad = [];
		drawers.forEach((rel)=>{
			if(EXEMPT[rel]){ return; }
			if(SUBSCRIBE_RE.test(read(rel))){ return; }
			const hosts = LIBS[rel];
			if(!hosts){ bad.push(`${rel}:没订阅也没登记宿主`); return; }
			hosts.forEach(([host, entry])=>{
				const code = read(host);
				if(!SUBSCRIBE_RE.test(code)){ bad.push(`${host}:没经 watchChartScript 订阅`); }
				if(!entry.test(code)){ bad.push(`${host}:订阅里没调 ${entry}`); }
			});
		});
		expect(bad).toEqual([]);
	});
});

describe('3D 文字 sprite:切换后重画成繁体', () => {
	function FakeCtx(){ this.drawn = []; }
	FakeCtx.prototype.fillText = function(t){ this.drawn.push(t); };
	FakeCtx.prototype.strokeText = function(t){ this.drawn.push(t); };
	FakeCtx.prototype.measureText = function(t){ return { width: `${t}`.length * 10 }; };
	FakeCtx.prototype.clearRect = function(){ this.drawn = []; };
	let origGetContext;
	beforeAll(() => {
		window.CanvasRenderingContext2D = FakeCtx;
		origGetContext = HTMLCanvasElement.prototype.getContext;
		const ctxs = new WeakMap();
		HTMLCanvasElement.prototype.getContext = function(){ if(!ctxs.has(this)){ ctxs.set(this, new FakeCtx()); } return ctxs.get(this); };
		__resetScriptModeForTest();
		__setConverterForTest((s)=>`${s}`.replace(/后/g, '後'));
	});
	afterAll(() => {
		HTMLCanvasElement.prototype.getContext = origGetContext;
		delete window.CanvasRenderingContext2D;
		__resetScriptModeForTest();
	});

	it('繁体切换后 repaintTextSprites 用转换后的字重画同一张画布', async () => {
		const made = [];
		const origCreate = document.createElement.bind(document);
		const spy = jest.spyOn(document, 'createElement').mockImplementation((tag, ...rest)=>{ const el = origCreate(tag, ...rest); if(`${tag}`.toLowerCase() === 'canvas'){ made.push(el); } return el; });
		try{ makeTextSprite('先后'); }finally{ spy.mockRestore(); }
		const ctx = made[0].getContext('2d');
		expect(ctx.drawn).toEqual(['先后']);
		await applyScriptMode(SCRIPT_HANT);
		expect(repaintTextSprites()).toBeGreaterThan(0);
		expect(ctx.drawn).toEqual(['先後']);
	});

	it('watchChartScript:切换后回调一次', async () => {
		__resetScriptModeForTest();
		__setConverterForTest((s)=>s);
		let n = 0;
		const off = watchChartScript(()=>{ n += 1; });
		await applyScriptMode(SCRIPT_HANT);
		await new Promise((r)=>setTimeout(r, 40));
		off();
		expect(n).toBe(1);
	});
});
