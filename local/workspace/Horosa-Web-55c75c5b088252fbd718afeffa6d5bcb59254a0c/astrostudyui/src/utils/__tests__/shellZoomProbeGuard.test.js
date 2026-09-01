// [Tahoe 根治锁] 壳缩放探针链结构哨兵 + 同构对偶锁。
//
// 为什么必须有对偶锁:壳(main.rs init script)与 global.js 各持一份探针决策实现,历史上
// audit_app_layout.py 的「逐字对齐」内嵌拷贝已经悄悄漂移成假话(闸门测的不是跑的)。
// 本锁把两份实现的核心函数体做规范化比对——任何一侧单改必红,再没有静默劈叉。
// 形态自适应:壳仓不在(精简发行形态)则跨仓项跳过,本仓项照测(照 layoutDomainStaticGuard T3 先例)。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..');
const GLOBAL_JS = path.join(SRC, 'global.js');
const MAIN_RS = path.resolve(SRC, '..', '..', '..', 'Horosa_Desktop_Installer', 'src-tauri', 'src', 'main.rs');
const MODELS_APP = path.join(SRC, 'models', 'app.js');

const globalSrc = fs.readFileSync(GLOBAL_JS, 'utf8');
const mainRsPresent = fs.existsSync(MAIN_RS);
const mainRsSrc = mainRsPresent ? fs.readFileSync(MAIN_RS, 'utf8') : '';

// 从源文本切出 `var <name> = function ...` 到配对 `};`(括号计数,注释内花括号已先剥)。
function extractFn(src, name){
	const start = src.indexOf('var ' + name + ' = function');
	if(start < 0){ return null; }
	let depth = 0, i = src.indexOf('{', start);
	if(i < 0){ return null; }
	for(; i < src.length; i++){
		if(src[i] === '{'){ depth++; }
		else if(src[i] === '}'){
			depth--;
			if(depth === 0){ return src.slice(start, i + 1); }
		}
	}
	return null;
}

// 规范化:剥行注释/块注释,压缩全部空白,引号归一 —— 只比语义 token 序列。
function normalize(code){
	return code
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/[^\n]*/g, '')
		.replace(/"/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

describe('T1 global.js 探针加固结构锚', ()=>{
	test('🔴 两拍重测/重跑/诊断出口/kill-switch/近 1 容差 全 token 在位', ()=>{
		expect(globalSrc).toContain("__applyBodyComp('first')");
		expect(globalSrc).toContain("__applyBodyComp('raf')");
		expect(globalSrc).toContain("__applyBodyComp('load')");
		expect(globalSrc).toContain("__applyBodyComp('resize')");
		expect(globalSrc).toContain('requestAnimationFrame');
		expect(globalSrc).toContain("{ once: true }");
		expect(globalSrc).toContain('__HOROSA_ZOOM_PROBE_LAST');
		expect(globalSrc).toContain('__HOROSA_ZOOM_REPROBE_ARMED');
		expect(globalSrc).toContain("horosa.compat.zoomReprobe");
		expect(globalSrc).toContain('Math.abs(__hsz - 1) < 0.001');
	});

	test('重跑现场读 z(不吃旧闭包值):决策函数内从 documentElement 取 zoom', ()=>{
		const fn = extractFn(globalSrc, '__applyBodyComp');
		expect(fn).toBeTruthy();
		expect(fn).toContain('document.documentElement.style.zoom');
	});
});

describe('T2 main.rs 壳侧三改结构锚(壳仓缺席则跳过)', ()=>{
	test('🔴 抽取锚/resize 桥/zoom-snap 三标记在位', ()=>{
		if(!mainRsPresent){ return; }
		expect(mainRsSrc).toContain('[zoom-apply-fn:begin]');
		expect(mainRsSrc).toContain('[zoom-apply-fn:end]');
		expect(mainRsSrc).toContain('[tahoe-resize-bridge]');
		expect(mainRsSrc).toContain("dispatchEvent(new Event('resize'))");
		expect(mainRsSrc).toContain('[zoom-snap]');
		expect(mainRsSrc).toContain('(value * 10.0).round() / 10.0');
	});

	test('抽取锚段内含完整 APPLY 函数(audit 运行时抽的就是这段)', ()=>{
		if(!mainRsPresent){ return; }
		const seg = mainRsSrc.split('[zoom-apply-fn:begin]')[1].split('[zoom-apply-fn:end]')[0];
		expect(seg).toContain('__HOROSA_APPLY_SHELL_ZOOM');
		expect(seg).toContain('__applyBodyComp');
		expect(seg).toContain('__armZoomReprobe');
	});
});

describe('T3 同构对偶锁:探针决策核心两处逐 token 相同', ()=>{
	// 判别力自证:规范化函数对真实差异必须敏感(不是把什么都洗成相同)。
	test('规范化对语义差异敏感(判别力自证)', ()=>{
		expect(normalize('var a = function () { x > 2; };'))
			.not.toBe(normalize('var a = function () { x > 3; };'));
		expect(normalize("var a = function () { s = 'b'; }; // c1"))
			.toBe(normalize('var a = function () { s = "b"; }; // c2'));
	});

	test('🔴 __applyBodyComp:global.js 与 main.rs 抽取段规范化后逐字节相同', ()=>{
		if(!mainRsPresent){ return; }
		const a = extractFn(globalSrc, '__applyBodyComp');
		const b = extractFn(mainRsSrc, '__applyBodyComp');
		expect(a).toBeTruthy();
		expect(b).toBeTruthy();
		expect(normalize(a)).toBe(normalize(b));
	});

	test('🔴 __armZoomReprobe:两处规范化后逐字节相同', ()=>{
		if(!mainRsPresent){ return; }
		const a = extractFn(globalSrc, '__armZoomReprobe');
		const b = extractFn(mainRsSrc, '__armZoomReprobe');
		expect(a).toBeTruthy();
		expect(b).toBeTruthy();
		expect(normalize(a)).toBe(normalize(b));
	});
});

describe('T4 models/app.js visualViewport 三保险对称挂/卸', ()=>{
	const modelsSrc = fs.readFileSync(MODELS_APP, 'utf8');

	test('🔴 挂载与卸载对称在位', ()=>{
		expect(modelsSrc).toContain("window.visualViewport.addEventListener('resize', vvHandler)");
		expect(modelsSrc).toContain("window.visualViewport.removeEventListener('resize', vvHandler)");
	});
});
