// [Tahoe 浮层根治] 静态复发哨兵:任何**新写**的 fixed 浮层若把 rect 域坐标直接写进
// style.left/top 而不经 zoomDomain 换算,本套件判红。
//
// 为什么需要静态哨兵:行为测试只能覆盖已知的那 8 个写回点;真正的复发形态是"半年后有人
// 加了第 9 个 d3 tooltip",而那个点没有任何测试会经过。静态扫描是唯一能拦住它的闸。
//
// 判红后的两条正路(任选其一,都要留下判定依据):
//   ① 该处确属 rect→CSS 跨域 ⇒ 用 clientToFixed() 包住写回值;
//   ② 该处两端同域(如 canvas 内部坐标 + absolute 挂同容器)⇒ 加进下方 EXEMPT 并写明理由。
// 严禁只为"让测试变绿"而加豁免——理由必须能自证同域。
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC = path.resolve(__dirname, '..', '..');

// 豁免清单:每条都必须有可自证的同域理由。
const EXEMPT = [
	{
		file: 'components/astro3d/Astro3D.js',
		reason: 'xy = transPosition() 是 THREE 投影出的 canvas 内部像素(布局域);'
			+ 'planetHintDiv = .astro3dtap{position:absolute} 挂同一 canvas 容器 ⇒ 两端同域,加换算反而错位。',
	},
	{
		file: 'utils/zoomDomain.js',
		reason: '换算层自身:内部探针元素写 style.left 用于实测映射,不能自我换算(会循环)。',
	},
];

// horosa_win_shell_free_scan_v1(Windows 侧移植适配;建议上游化 Mac)
//
// 原实现 `execSync("grep -rnaE --include='*.js' " + JSON.stringify(pattern) + " …")` 在 Windows 必失效:
// Node 的 execSync 在 Windows 走 **cmd.exe**,而 `JSON.stringify` 产出的是**双引号**串 ——
// cmd 不按 POSIX 规则处理双引号内的反斜杠,于是 `\\.` 被吃掉,正则到达 grep 时成了
// `style.(left|top|right|bottom)[[:space:]]*=|.style('(left|top)'`,括号不配对 ⇒
// grep 报 "Unmatched ( or \(" 非零退出 ⇒ 走进 catch 拿到空 stdout ⇒ **扫描结果恒为空集**。
// 空集会让「已收口写回点逐一在位」判红、也会让新增违规**永远查不出来**(假绿方向更危险)。
// 实测复现:同一命令在本仓直接跑即报 Unmatched,hits=0。
//
// 修法:换成**纯 Node 等价扫描**(fs 递归 + 同义正则),语义逐条对齐、判据零放宽:
//   · `-r` 递归 components/utils/pages  · `--include='*.js'` 只看 .js
//   · POSIX `[[:space:]]` ≡ JS `\s`     · `-a` 二进制当文本:Node 按 utf8 读天然如此
//   · 输出仍是 {file, line, text},且 **file 用 POSIX 分隔符**(下方 EXEMPT/期望表都是正斜杠写法,
//     这一步不做归一就会重蹈 pathsep 覆辙 —— 仓内同类先例见 horosa_win_pathsep_posix_v1)。
// 顺带更稳:不再依赖机器上是否装了 grep、PATH 里是哪一个 grep。
const SCAN_DIRS = ['components', 'utils', 'pages'];
const SCAN_RE = /style\.(left|top|right|bottom)\s*=|\.style\('(left|top)'/;

function walkJs(dir, acc){
	let ents = [];
	try{ ents = fs.readdirSync(dir, { withFileTypes: true }); }catch(e){ return acc; }
	ents.forEach((ent) => {
		const full = path.join(dir, ent.name);
		if(ent.isDirectory()){ walkJs(full, acc); }
		else if(ent.name.endsWith('.js')){ acc.push(full); }
	});
	return acc;
}

function scan(){
	const hits = [];
	SCAN_DIRS.forEach((d) => {
		walkJs(path.join(SRC, d), []).forEach((full) => {
			let src = '';
			try{ src = fs.readFileSync(full, 'utf8'); }catch(e){ return; }
			const rel = path.relative(SRC, full).split(path.sep).join('/');
			src.split('\n').forEach((text, i) => {
				if(SCAN_RE.test(text)){ hits.push({ file: rel, line: i + 1, text }); }
			});
		});
	});
	return hits;
}

// 🔴 判定必须按**写回点**粒度,不能按行。
// 自证经过:首版按整行判 `text.includes('clientToFixed')`,结果把已收口的 left 改回原样后
// 哨兵仍绿——因为同一行的 top 还带着 clientToFixed,子串穿透掩盖了违规。改成:每个写回点
// 的"值窗口"截止到下一个写回点(或行尾),各自独立判定。两个判别向量现均判红。
const WRITE_RE = /style\.(?:left|top|right|bottom)\s*=|\.style\(['"](?:left|top)['"]\s*,/g;

function writePoints(text){
	const idx = [];
	WRITE_RE.lastIndex = 0;
	let m = WRITE_RE.exec(text);
	while(m !== null){
		idx.push({ at: m.index, tag: m[0] });
		m = WRITE_RE.exec(text);
	}
	return idx.map((p, i) => ({
		tag: p.tag,
		win: text.slice(p.at, i + 1 < idx.length ? idx[i + 1].at : text.length),
	}));
}

function isCompensated(win){
	return win.indexOf('clientToFixed') >= 0 || win.indexOf('clientToLayout') >= 0;
}

function isBenign(win){
	// 复位/清除类写回,不携带坐标。
	return /=\s*''/.test(win) || /'auto'/.test(win) || /=\s*'0'/.test(win);
}

describe('T5 手写浮层缩放域静态哨兵', () => {
	const hits = scan();

	it('扫描确实命中了写回点(哨兵本身没瞎——防 grep 失效导致空集假绿)', () => {
		expect(hits.length).toBeGreaterThan(8);
		// 已知的真实收口点必须在命中集里,否则说明 pattern 漂了
		expect(hits.some((h) => h.file === 'utils/helper.js' && isCompensated(h.text))).toBe(true);
	});

	it('🔴 每个坐标写回点要么已换算,要么在带理由的豁免清单里', () => {
		const bad = [];
		hits.forEach((h) => {
			if(EXEMPT.some((e) => e.file === h.file)){ return; }
			writePoints(h.text).forEach((wp) => {
				if(isCompensated(wp.win) || isBenign(wp.win)){ return; }
				bad.push(`  ${h.file}:${h.line}  ${wp.tag}  →  ${wp.win.trim().slice(0, 60)}`);
			});
		});
		expect(bad.join('\n')).toBe('');
	});

	// 🔴 发行形态自适应:精简发行版不含本表若干模块,对应文件天然不存在。
	// 缺席=跳过而非判红;但**存在的那些必须仍真有写回点**(否则豁免已过期该删),
	// 且整表不得全部失效(全失效=表已腐烂到没有任何看守意义)。
	it('豁免清单不腐烂:在场的豁免文件仍真有写回点,且整表未全失效', () => {
		let live = 0;
		EXEMPT.forEach((e) => {
			expect(e.reason.length).toBeGreaterThan(20);       // 必须写理由,不许空豁免
			if(!fs.existsSync(path.join(SRC, e.file))){ return; }   // 本仓无此文件(精简版)
			live += 1;
			expect(`${e.file} 有写回点=${hits.some((h) => h.file === e.file)}`)
				.toBe(`${e.file} 有写回点=true`);              // 无写回点=豁免已过期,应删
		});
		expect(live).toBeGreaterThan(0);
	});

	it('已收口的写回点逐一在位(防"改回去"回归;数按写回点不按行)', () => {
		const EXPECT = [
			['utils/helper.js', 2],                                     // left + top
			['pages/index.js', 2],                                       // top + right(left='auto' 属 benign)
		];
		// 形态自适应:缺席文件跳过(精简版不含该模块),在场的必须逐一对数。
		const seen = [];
		EXPECT.forEach(([file, n]) => {
			if(!fs.existsSync(path.join(SRC, file))){ return; }
			seen.push(file);
			let got = 0;
			hits.filter((h) => h.file === file).forEach((h) => {
				writePoints(h.text).forEach((wp) => { if(isCompensated(wp.win)){ got += 1; } });
			});
			expect(`${file}=${got}`).toBe(`${file}=${n}`);
		});
		// 这两处是任何发行形态都必然包含的核心面,缺席即代表修复没铺到位,不能算作"精简"。
		['utils/helper.js', 'pages/index.js'].forEach((f) => {
			expect(`${f} 已覆盖=${seen.indexOf(f) >= 0}`).toBe(`${f} 已覆盖=true`);
		});
	});
});
