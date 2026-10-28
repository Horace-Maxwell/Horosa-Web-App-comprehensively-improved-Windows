// 文字色静态检查(全 src 的 .less 与 .js 行内样式):两类「只为一种主题挑的字色」不许再写进源码。
//
// ① antd 缺省墨色当字色:rgba(0,0,0,.85 / .65 / .45 / .25)、#000000d9 一族、占位符灰 #bfbfbf。
//    它们是 antd 亮色主题的编译期常量,暗底上隐身、宣纸底上占位符只有 1.6–1.8:1。
//    要这个观感就用主题变量(--horosa-text / -text-soft / -muted / -placeholder,亮暗各有取值);
//    写在 var(--x, rgba(0,0,0,.85)) 的兜底位置里不算(变量解析得到时用不上它)。
// ② 语义实底上写死白字:background 是 accent / gold / jx-* / danger / 五行 / 评级色 / 四化 / 链接 / 提示色这类**随主题换值**的实底,
//    字却固定 #fff —— 暗色下这些实底都是浅亮色,白字 1.6–2.9:1。字一律用 --horosa-on-accent / --horosa-on-solid。
// 只查 color(字色);svg / canvas 的 fill / stroke 是盘面绘制,另有盘面主题审计。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../..');

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){
			if(e.name === '__tests__' || e.name === 'node_modules' || e.name.startsWith('.umi')){ return; }
			walk(p, out);
		}else if(/\.(less|js)$/.test(e.name)){
			out.push(p);
		}
	});
	return out;
}
const FILES = walk(SRC, []);

// 注释抹成空白(保留换行,行号不漂)
function stripComments(s, isJs){
	let t = s.replace(/\/\*[\s\S]*?\*\//g, (m)=>m.replace(/[^\n]/g, ' '));
	t = t.replace(isJs ? /(^|[^:'"`\\])\/\/[^\n]*/g : /(^|[^:])\/\/[^\n]*/g, (m, p1)=>p1 + ' '.repeat(m.length - p1.length));
	return t;
}

const ANTD_INK = String.raw`(?:rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.(?:85|65|45|25)\s*\)|#000000(?:d9|a6|73|40)\b|#bfbfbf\b)`;
// 字色声明的值(到 ; / , / } / 换行为止),值里出现 antd 缺省墨色且不在 var( 的兜底位里
const LESS_COLOR_DECL = /(?:^|[\s;{])color\s*:\s*([^;}\n]+)/g;
const JS_COLOR_PROP = /(?:^|[\s,{(])color\s*:\s*(['"`])([^'"`]*)\1/g;
const inkOutsideFallback = (value)=>{
	const re = new RegExp(ANTD_INK, 'i');
	if(!re.test(value)){ return false; }
	// 去掉所有 var(--x, …) 整体之后若仍含 → 是直写;否则只在兜底位
	let v = value; let prev;
	do{ prev = v; v = v.replace(/var\(\s*--[\w-]+\s*,[^()]*(?:\([^()]*\)[^()]*)*\)/g, ''); }while(v !== prev);
	return re.test(v);
};

const SOLID = String.raw`var\(\s*--horosa-(?:accent|gold|jx-[a-z]+|danger|cinnabar|jade|grade-[a-z]+|sev-[a-z]+|bazi-(?:wood|fire|earth|metal|water)|qimen-[a-z]+|sihua-[a-z]+|link|info|warn)(?![\w-])`;
const WHITE = String.raw`(?:#fff(?:fff)?\b|white\b)`;

function findAntdInk(file, text){
	const isJs = file.endsWith('.js');
	const s = stripComments(text, isJs);
	const hits = [];
	const lineOf = (i)=>s.slice(0, i).split('\n').length;
	if(isJs){
		let m = JS_COLOR_PROP.exec(s);
		while(m){ if(inkOutsideFallback(m[2])){ hits.push(`${file}:${lineOf(m.index)} color: ${m[2]}`); } m = JS_COLOR_PROP.exec(s); }
		JS_COLOR_PROP.lastIndex = 0;
	}else{
		let m = LESS_COLOR_DECL.exec(s);
		while(m){ if(inkOutsideFallback(m[1])){ hits.push(`${file}:${lineOf(m.index)} color: ${m[1].trim()}`); } m = LESS_COLOR_DECL.exec(s); }
		LESS_COLOR_DECL.lastIndex = 0;
	}
	return hits;
}

function findWhiteOnSolid(file, text){
	const isJs = file.endsWith('.js');
	const s = stripComments(text, isJs);
	const hits = [];
	const lineOf = (i)=>s.slice(0, i).split('\n').length;
	if(isJs){
		// 行内 style 对象(同一行内的 {{ … }} / { … })
		const re = /\{([^{}\n]*)\}/g;
		let m = re.exec(s);
		while(m){
			const b = m[1];
			if(new RegExp(String.raw`background(?:Color)?\s*:\s*['"\`]` + SOLID).test(b)
				&& new RegExp(String.raw`(?:^|[\s,])color\s*:\s*['"]` + WHITE, 'i').test(b)){
				hits.push(`${file}:${lineOf(m.index)} ${b.trim().slice(0, 120)}`);
			}
			m = re.exec(s);
		}
	}else{
		const re = /\{([^{}]*)\}/g;
		let m = re.exec(s);
		while(m){
			const b = m[1];
			if(new RegExp(String.raw`background(?:-color)?\s*:\s*` + SOLID).test(b)
				&& new RegExp(String.raw`(?:^|[\s;])color\s*:\s*` + WHITE, 'i').test(b)){
				hits.push(`${file}:${lineOf(m.index)} ${b.replace(/\s+/g, ' ').trim().slice(0, 120)}`);
			}
			m = re.exec(s);
		}
	}
	return hits;
}

describe('文字色静态检查', ()=>{
	it('判据自证:构造的坏样本必须被抓到、好样本放过', ()=>{
		expect(findAntdInk('a.less', '.x { color: rgba(0, 0, 0, 0.85); }')).toHaveLength(1);
		expect(findAntdInk('a.less', '.x { color: rgba(0,0,0,.25) !important; }')).toHaveLength(1);
		expect(findAntdInk('a.less', '.x { color: #bfbfbf; }')).toHaveLength(1);
		expect(findAntdInk('a.less', '.x { color: var(--horosa-text, rgba(0, 0, 0, 0.85)); }')).toHaveLength(0);
		expect(findAntdInk('a.less', '.x { background-color: rgba(0,0,0,.25); border-color: rgba(0,0,0,.45); }')).toHaveLength(0);
		expect(findAntdInk('a.less', '/* color: rgba(0,0,0,.85) */ .x { color: var(--horosa-muted); }')).toHaveLength(0);
		expect(findAntdInk('a.js', "<span style={{ color: 'rgba(0, 0, 0, 0.45)' }} />")).toHaveLength(1);
		expect(findAntdInk('a.js', "<span style={{ color: 'var(--horosa-muted, rgba(0,0,0,.45))' }} />")).toHaveLength(0);
		expect(findWhiteOnSolid('a.less', '.x { background: var(--horosa-accent); color: #fff; }')).toHaveLength(1);
		expect(findWhiteOnSolid('a.less', '.x { background: var(--horosa-bazi-fire); color: #ffffff; }')).toHaveLength(1);
		expect(findWhiteOnSolid('a.less', '.x { background: var(--horosa-accent-soft); color: #fff; }')).toHaveLength(0);
		expect(findWhiteOnSolid('a.less', '.x { background: var(--horosa-accent); color: var(--horosa-on-accent, #fff); }')).toHaveLength(0);
		expect(findWhiteOnSolid('a.js', "<b style={{ background: 'var(--horosa-gold)', color: '#fff' }} />")).toHaveLength(1);
		expect(findWhiteOnSolid('a.js', "<b style={{ background: 'var(--horosa-gold)', color: 'var(--horosa-on-accent)' }} />")).toHaveLength(0);
		expect(findWhiteOnSolid('a.js', "<b style={{ background: 'var(--horosa-sihua-lu)', color: '#fff' }} />")).toHaveLength(1);
	});

	it('判据没失明:扫到的文件数像样(全 src 的 less + js)', ()=>{
		expect(FILES.filter((f)=>f.endsWith('.less')).length).toBeGreaterThan(30);
		expect(FILES.filter((f)=>f.endsWith('.js')).length).toBeGreaterThan(500);
	});

	it('① 源码里没有直写 antd 缺省墨色当字色(要用主题变量)', ()=>{
		const hits = [];
		FILES.forEach((f)=>{ hits.push(...findAntdInk(path.relative(SRC, f), fs.readFileSync(f, 'utf8'))); });
		expect(hits).toEqual([]);
	});

	it('② 随主题换值的语义实底上没有写死白字(要用 --horosa-on-accent / --horosa-on-solid)', ()=>{
		const hits = [];
		FILES.forEach((f)=>{ hits.push(...findWhiteOnSolid(path.relative(SRC, f), fs.readFileSync(f, 'utf8'))); });
		expect(hits).toEqual([]);
	});
});
