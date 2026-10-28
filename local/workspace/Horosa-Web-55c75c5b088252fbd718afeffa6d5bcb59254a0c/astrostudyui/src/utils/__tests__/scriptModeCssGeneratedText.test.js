// 界面简繁 · 护栏:CSS 伪元素 content: attr(…) 生成的字不经显示层(显示层只转文字节点与几个显示属性)——
// 繁体界面里这些字停在简体(印占校时徽标「罗 / 计」曾如此)。要显示文字的改成真实子元素;只放纯符号的属性登记在下表。
// 另:富文本编辑器(Quill)的占位符同样是 attr(data-placeholder) 生成,调用方别传中文 placeholder(要提示写在编辑器外)。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../..');
// 属性名 → 理由(只许放符号,不许放中文)
const SYMBOL_ONLY_ATTRS = {
	'data-dong': '小成图动爻标记,只放 ○ / ×',
};

function walk(dir, out, re){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		const st = fs.statSync(p);
		if(st.isDirectory()){
			if(f === '__tests__' || f === 'test' || f.startsWith('.umi')){ return; }
			walk(p, out, re);
		}else if(re.test(f)){
			out.push(p);
		}
	});
	return out;
}
const ATTR_RE = /content\s*:\s*[^;{}]*attr\(\s*([\w-]+)\s*\)/g;
const attrsIn = (css)=>{
	const out = [];
	let m;
	const re = new RegExp(ATTR_RE.source, 'g');
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
	while((m = re.exec(clean))){ out.push(m[1]); }
	return out;
};

describe('CSS content: attr() 生成的字(界面简繁)', () => {
	const styles = walk(SRC, [], /\.(less|css)$/);
	const js = walk(SRC, [], /\.(js|jsx)$/).map((f)=>[path.relative(SRC, f).split(path.sep).join('/'), fs.readFileSync(f, 'utf8')]);
	const used = {};
	styles.forEach((f)=>{ attrsIn(fs.readFileSync(f, 'utf8')).forEach((a)=>{ (used[a] = used[a] || []).push(path.relative(SRC, f)); }); });

	it('扫到了样式文件(防扫描静默失效)', () => {
		expect(styles.length).toBeGreaterThan(20);
	});

	it('🔴 生成文字的属性只许是登记过的纯符号属性', () => {
		expect(Object.keys(used).filter((a)=>!SYMBOL_ONLY_ATTRS[a])).toEqual([]);
	});

	it('登记的纯符号属性在代码里赋的都不是中文', () => {
		const bad = [];
		Object.keys(SYMBOL_ONLY_ATTRS).forEach((a)=>{
			const re = new RegExp(`${a}=\\{([^}]*)\\}|${a}="([^"]*)"`, 'g');
			js.forEach(([rel, code])=>{
				let m;
				while((m = re.exec(code))){ if(/[㐀-鿿]/.test(m[1] || m[2] || '')){ bad.push(`${rel}: ${m[0].slice(0, 60)}`); } }
			});
		});
		expect(bad).toEqual([]);
	});

	it('富文本编辑器不传中文占位符(它由 attr(data-placeholder) 生成)', () => {
		const bad = js.filter(([, code])=>/<RichEditor\b[^>]*\bplaceholder=\{?["'`][^"'`]*[㐀-鿿]/.test(code)).map(([rel])=>rel);
		expect(bad).toEqual([]);
	});

	it('形态样例', () => {
		expect(attrsIn('.a::before{ content: attr(data-glyph); }')).toEqual(['data-glyph']);
		expect(attrsIn('.a::after{content:"(" attr(title) ")"}')).toEqual(['title']);
		expect(attrsIn('/* content: attr(x) */ .a{ color: red }')).toEqual([]);
	});
});
