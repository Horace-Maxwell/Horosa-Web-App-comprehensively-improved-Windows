// 接线锁 —— 两把，都是审计时踩出来的真坑补的。
//
// 锁① 九纲档字段 lockstep：
//   `fengshuiSelFromAnchors.test.js` 的 18 字段 lockstep 只覆盖**五诀档**（图判工作台喂的那一档），
//   九纲档是后加的 opt-in 档，落在那把锁的扫描范围之外。若无本锁，九纲新增字段时
//   不会有任何测试提醒左栏漏喂——引擎读了、UI 不给，就是静默死档。
//
// 锁② 新派 Chart 的 CSS 类必须真有定义：
//   🔴 真踩过：化煞/宅断两派最初自拼 div + 自造类名（horosa-fengshui-eight-grid / hf-dir / hf-sha …），
//      样式表里根本没有这些类，中栏退化成无样式裸文本堆。而真机验证若只读 innerText，
//      文字全在、看着「正常」，这坑就漏过去了。故必须机器扫。
import fs from 'fs';
import path from 'path';

const FS_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(__dirname, '../../..');
const read = (p)=>fs.readFileSync(p, 'utf8');

describe('锁① 九纲档：引擎读取的字段全部有左栏控件', ()=>{
	it('nineGang 读的 s.* 全集 ⊆ LiqiWorkspace 里 setXs 写入且 xs 读取的键集', ()=>{
		const eng = read(path.join(FS_DIR, 'xingshi.js'));
		const ui = read(path.join(FS_DIR, 'LiqiWorkspace.js'));
		const nine = eng.slice(eng.indexOf('function nineGang'));
		// 排除数组/对象方法名等误匹配（s.push 之类不是字段）。
		const NOT_FIELD = new Set(['push', 'length', 'filter', 'map', 'find', 'indexOf', 'forEach', 'slice']);
		const fields = [...new Set([...nine.matchAll(/\bs\.([A-Za-z0-9]+)\b/g)].map((m)=>m[1]))]
			.filter((f)=>!NOT_FIELD.has(f)).sort();
		expect(fields.length).toBeGreaterThanOrEqual(20);   // 九纲字段规模守底

		const written = new Set([...ui.matchAll(/setXs\(\{ \.\.\.xs, ([A-Za-z0-9]+):/g)].map((m)=>m[1]));
		const readKeys = new Set([...ui.matchAll(/\bxs\.([A-Za-z0-9]+)\b/g)].map((m)=>m[1]));
		const missing = fields.filter((f)=>!(written.has(f) && readKeys.has(f)));
		expect(missing).toEqual([]);
	});
	it('九纲档确有切档控件（scoreMode 可被写入），否则整档进不去', ()=>{
		const ui = read(path.join(FS_DIR, 'LiqiWorkspace.js'));
		expect(ui).toMatch(/setXs\(\{ \.\.\.xs, scoreMode: v \}\)/);
		expect(ui).toMatch(/label: '九纲全参'/);
	});
});

describe('锁② registry 各派 Chart 用到的 CSS 类必须在样式表里有定义', ()=>{
	// 收集全部 .less 里定义过的类名（含 :global 与嵌套写法）。
	const lessDefined = (()=>{
		const set = new Set();
		const walk = (dir)=>{
			fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
				const fp = path.join(dir, e.name);
				if (e.isDirectory()) { if (e.name !== 'node_modules') { walk(fp); } return; }
				if (!e.name.endsWith('.less')) { return; }
				[...read(fp).matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)].forEach((m)=>set.add(m[1]));
			});
		};
		walk(SRC_DIR);
		return set;
	})();

	const SCHOOL_FILES = fs.readdirSync(path.join(FS_DIR, 'liqi'))
		.filter((f)=>f.endsWith('School.js'));

	it('registry 派文件已被发现（否则本锁形同虚设）', ()=>{
		expect(SCHOOL_FILES.length).toBeGreaterThanOrEqual(4);
	});

	SCHOOL_FILES.forEach((f)=>{
		it(`${f} 的 className 全部有 CSS 定义`, ()=>{
			const src = read(path.join(FS_DIR, 'liqi', f));
			const classes = new Set();
			// 静态 className="a b" 与模板串 className={`a ${x}`} 里的字面量部分都要收。
			[...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].forEach((m)=>{
				// 🔴 模板串必须先把 ${...} 整段剔掉再切分：表达式里的空格会把
				//    `? : === 'good'` 之类切成假类名（本锁首跑即被自己坑了一次）。
				const raw = (m[1] || m[2] || '').replace(/\$\{[^}]*\}/g, ' ');
				raw.split(/\s+/).forEach((c)=>{
					const t = c.trim();
					if (t && /^[A-Za-z][A-Za-z0-9_-]*$/.test(t)) { classes.add(t); }
				});
			});
			const missing = [...classes].filter((c)=>!lessDefined.has(c)).sort();
			expect(missing).toEqual([]);
		});
	});
});
