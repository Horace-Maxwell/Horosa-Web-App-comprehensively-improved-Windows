// [版面域根治] 静态复发哨兵:任何「视口读数 ÷ 缩放值」的写法一律判红。
//
// 为什么必须有静态哨兵:行为测试只能覆盖今天已知的那几处消费点;真正的复发形态是
// 「半年后有人为新页面又写了一遍 innerHeight/zoom」,而那处没有任何测试会经过。
// 2026-08-27 的事故就是这个形状,一次同时坑了主工作区、奇门、三式合一、启动页四处。
//
// 判红后的两条正路(任选其一,都要留下判定依据):
//   ① 需要布局域尺寸 ⇒ 直接量容器(el.clientHeight)或 zoomDomain.measureLayoutViewport();
//   ② 该处确实要物理域数值(如与鼠标 rect 坐标同域比较)⇒ 进 EXEMPT 并写明为何同域。
// 严禁只为「让测试变绿」而加豁免 —— 理由必须能自证。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..');
// 壳内三页(启动/诊断/偏好)。这次事故里它们的密度探测犯了同样的错,却因为不在任何
// 扫描范围内而无人发觉 —— 所以哨兵必须把它们一并纳入。
const SHELL_WEB = path.resolve(SRC, '..', '..', '..', 'Horosa_Desktop_Installer', 'web');

const EXEMPT = [];

// 「视口读数 ÷ 标识符/调用」。除以数字字面量(如 /2 居中)是正常算术,不在此列。
// horosa_win_shell_free_scan_v1(Windows 侧移植适配;popupAlign 两守卫同判例,建议上游化 Mac):
// 原 `execSync("grep -rnaE …")` 在 Windows 走 cmd.exe —— 单引号 include 原样到达 grep(匹配不到
// 任何文件)、grep 本身未必在 cmd 的 PATH 上;T1 自证会红(诚实),但守卫必须双平台真扫描。
// 换纯 Node 等价扫描,语义逐条对齐:-r 递归 ≡ walk;--include ≡ 扩展名滤;POSIX [[:space:]] ≡ \s;
// -a 二进制当文本 ≡ Node utf8 读;输出仍 {file,line,text} 且 file 用 POSIX 分隔符 + './' 前缀
// (与 grep 相对路径输出形一致,T1/T2 的 indexOf 判据零改动)。
const SCAN_RE = /(clientHeight|clientWidth|innerHeight|innerWidth)\s*\/\s*[a-zA-Z_$]/;

function scanDir(dir, includes){
	if(!fs.existsSync(dir)){ return []; }
	const exts = Array.from(includes.matchAll(/\*(\.\w+)/g)).map((m) => m[1]);
	const files = [];
	(function walk(d){
		let ents = [];
		try{ ents = fs.readdirSync(d, { withFileTypes: true }); }catch(e){ return; }
		ents.forEach((ent) => {
			const full = path.join(d, ent.name);
			if(ent.isDirectory()){
				if(ent.name === 'node_modules'){ return; }
				walk(full);
			}else if(exts.some((x) => ent.name.endsWith(x))){
				files.push(full);
			}
		});
	})(dir);
	const hits = [];
	files.forEach((full) => {
		let src = '';
		try{ src = fs.readFileSync(full, 'utf8'); }catch(e){ return; }
		const rel = './' + path.relative(dir, full).split(path.sep).join('/');
		src.split('\n').forEach((text, i) => {
			if(SCAN_RE.test(text)){ hits.push({ file: rel, line: i + 1, text }); }
		});
	});
	return hits;
}

// 注释行不算违规(踩过两次:哨兵是纯文本 grep,不分代码与注释)
function isComment(text){
	return /^\s*(\/\/|\*|\/\*)/.test(text);
}

describe('T1 哨兵判别力自证(绿本身不是证据)', () => {
	it('扫描器在人造违规上必须判红', () => {
		const tmp = path.join(SRC, 'utils', '__tests__', '__probe_layout_domain__.js');
		fs.writeFileSync(tmp, 'const h = window.innerHeight / shellZoom;\nexport default h;\n');
		try{
			const hits = scanDir(SRC, "--include='*.js'").filter((h) => h.file.indexOf('__probe_layout_domain__') >= 0);
			expect(hits.length).toBeGreaterThan(0);
		}finally{
			fs.unlinkSync(tmp);
		}
	});

	it('扫描器确实看得见文件(防 grep 失效导致空集假绿)', () => {
		const any = scanDir(SRC, "--include='*.js'");
		expect(Array.isArray(any)).toBe(true);
		// 至少要能读到源码树本身
		expect(fs.existsSync(path.join(SRC, 'utils', 'zoomDomain.js'))).toBe(true);
	});
});

describe('T2 主应用:零「视口读数 ÷ 缩放」', () => {
	it('🔴 src 全树无此形状(注释除外)', () => {
		const bad = scanDir(SRC, "--include='*.js'")
			.filter((h) => h.file.indexOf('__tests__') < 0)
			.filter((h) => !isComment(h.text))
			.filter((h) => !EXEMPT.some((e) => h.file.indexOf(e) >= 0))
			.map((h) => `  ${h.file}:${h.line}  ${h.text.trim().slice(0, 78)}`);
		expect(bad.join('\n')).toBe('');
	});
});

describe('T3 壳内三页:同一标准', () => {
	// 形态自适应:该目录在精简发行形态下可能不存在,缺席跳过而非判红。
	const present = fs.existsSync(SHELL_WEB);

	it('🔴 启动/诊断/偏好三页无此形状(注释除外)', () => {
		if(!present){ return; }
		const bad = scanDir(SHELL_WEB, "--include='*.js' --include='*.css'")
			.filter((h) => !isComment(h.text))
			.map((h) => `  web/${h.file}:${h.line}  ${h.text.trim().slice(0, 78)}`);
		expect(bad.join('\n')).toBe('');
	});

	it('本仓若含壳内页,密度探测必须是直接量(防改回「÷ 声明缩放」)', () => {
		if(!present){ return; }
		const appJs = path.join(SHELL_WEB, 'app.js');
		if(!fs.existsSync(appJs)){ return; }
		const src = fs.readFileSync(appJs, 'utf8');
		expect(src.indexOf('function layoutSpace') >= 0).toBe(true);
		expect(src.indexOf('position:fixed;left:0;top:0;right:0;bottom:0') >= 0).toBe(true);
	});
});


// ── T4 rect→style 写回族(2026-09-01 Tahoe 轮新增) ─────────────────────────────
// 第三族域混:getBoundingClientRect(rect 域,壳缩放≠1 时已被 zoom 缩放)的读数被写进
// style.width/height(CSS 布局域 px)。z≠1 即写错尺寸——紫微盘面「超宽被两侧遮裁」的
// 元凶(ZiWeiChart.ensureChartSurfaceSize,已改 offsetWidth 直读)。上面的 PATTERN 只抓
// 「读数÷标识符」,抓不到这种跨域直写,故按「文件同时含 gBCR 与 style 尺寸写」粗筛+
// 豁免表精判。豁免必须带一行可自证的判定依据,严禁为绿而豁免。
const RECT_WRITE_EXEMPT = [
	// rect 仅用于鼠标坐标换算(注释自证「getBoundingClientRect 本就是 CSS px」);
	// canvas 尺寸写回值源自 host.clientWidth(布局域)——读写同域。
	'components/fengshui/fengshuiEngine.js',
	// rect 用于克隆节点测自然高(clone 脱离布局流,与写回目标同一元素同域)。
	'components/calendar/NongLi.js',
	// rect 用于阅读器翻页几何(与滚动坐标同域消费),尺寸写回源自 clientWidth。
	'components/reader/BookReader.js',
	// 3D 视图:rect 用于 pointer 拾取(物理域正当消费);画布尺寸走 clientWidth+dpr。
	'components/astro3d/Astro3D.js',
	'components/astro3d/AstroChart3D.js',
	// 方盘边长已改 clientWidth 优先,残余 rect 仅作 0 兜底且经 getEffectiveScale 换域,
	// 以及 rect.top 域内相减后显式 /zScale 换回布局域(见各自 [Tahoe 域混根修] 注释)。
	'components/suzhan/SuZhanChart.js',
	'components/guolao/GuoLaoChart.js',
];

function fileHasRectStyleWrite(fullPath){
	const src = fs.readFileSync(fullPath, 'utf8');
	// 注释里的字样不算(哨兵纯文本陷阱,上面 isComment 同教训)
	const code = src.split('\n').filter((l) => !isComment(l)).join('\n');
	return code.indexOf('getBoundingClientRect') >= 0
		&& /style\.(width|height)\s*=/.test(code);
}

function walkJs(dir, out){
	for(const name of fs.readdirSync(dir)){
		const full = path.join(dir, name);
		const st = fs.statSync(full);
		if(st.isDirectory()){
			if(name === '__tests__' || name === 'node_modules'){ continue; }
			walkJs(full, out);
		}else if(name.endsWith('.js')){
			out.push(full);
		}
	}
	return out;
}

describe('T4 rect→style 写回族(第三族域混)', () => {
	it('扫描器在人造违规上必须判红(判别力自证)', () => {
		const tmp = path.join(SRC, 'utils', '__tests__', '__probe_rect_write__.js');
		fs.writeFileSync(tmp,
			'const r = el.getBoundingClientRect();\nel.style.width = r.width + "px";\n');
		try{
			expect(fileHasRectStyleWrite(tmp)).toBe(true);
		}finally{
			fs.unlinkSync(tmp);
		}
	});

	it('🔴 components 全树:gBCR 与 style 尺寸写共存的文件必须在豁免表内(带依据)', () => {
		const compDir = path.join(SRC, 'components');
		const offenders = walkJs(compDir, [])
			.filter((f) => fileHasRectStyleWrite(f))
			.map((f) => path.relative(SRC, f).split(path.sep).join('/'))
			.filter((rel) => !RECT_WRITE_EXEMPT.includes(rel));
		expect(offenders.join('\n')).toBe('');
	});

	it('豁免清单不腐烂:每个豁免文件必须仍存在且仍双命中(否则摘除豁免)', () => {
		for(const rel of RECT_WRITE_EXEMPT){
			const full = path.join(SRC, rel);
			expect(fs.existsSync(full)).toBe(true);
			expect(fileHasRectStyleWrite(full)).toBe(true);
		}
	});

	it('🔴 紫微主刀点自身:ensureChartSurfaceSize 已是布局域直读(零 gBCR)', () => {
		const src = fs.readFileSync(path.join(SRC, 'components', 'ziwei', 'ZiWeiChart.js'), 'utf8');
		const fnStart = src.indexOf('ensureChartSurfaceSize(');
		expect(fnStart).toBeGreaterThan(0);
		// 剥注释再判(修复注释里点名了旧病 API 名——哨兵纯文本陷阱,只认代码行)
		const fnBody = src.slice(fnStart, src.indexOf('drawChart(', fnStart))
			.split('\n').filter((l) => !isComment(l)).join('\n');
		expect(fnBody.indexOf('getBoundingClientRect')).toBe(-1);
		expect(fnBody.indexOf('offsetWidth')).toBeGreaterThan(0);
		expect(fnBody.indexOf('offsetHeight')).toBeGreaterThan(0);
	});
});
