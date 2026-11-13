// antd 主色族走变量主题、别名到主题金:锁住三件事 ——
//   ① .umirc.js 开了变量主题入口(不开 = antd 把 #1890ff 编译死在一百多条规则里,弹层全蓝);
//   ② 层叠末端那条 :root 把 antd 的主色 / 信息色变量全部别名到 --horosa-* 变量(不写死色值:亮暗两套跟着主题块走);
//   ③ antd 变量主题里声明的主色 / 信息色变量一个不漏(antd 升级新增变量时这里先红)。
const fs = require('fs');
const path = require('path');
const { sourceSetFiles } = require('./helpers/sourceSet');

const UI = path.resolve(__dirname, '../../..');
const read = (rel)=>fs.readFileSync(path.join(UI, rel), 'utf8');

describe('antd 主色族别名到主题金', ()=>{
	const rc = read('.umirc.js');
	const tail = read('src/layouts/app/22-tail-fixes.less');
	const block = (()=>{
		// 取「声明行」那一处(行首缩进后直接是变量名),注释里提到变量名的不算
		const m = /\n\s*--ant-primary-color:\s*var\(/.exec(tail);
		if(!m){ return ''; }
		const start = tail.lastIndexOf(':root {', m.index);
		return tail.slice(start, tail.indexOf('}', m.index));
	})();

	test('.umirc.js 开变量主题入口', ()=>{
		expect(/'root-entry-name'\s*:\s*'variable'/.test(rc)).toBe(true);
	});

	test('别名只引用 --horosa-* 变量,不写死色值', ()=>{
		const decls = block.split('\n').map((l)=>l.trim()).filter((l)=>l.startsWith('--ant'));
		expect(decls.length).toBeGreaterThan(15);
		decls.forEach((d)=>{
			expect([d, /^--ant[d]?-[\w-]+:\s*var\(--horosa-[\w-]+\);$/.test(d)]).toEqual([d, true]);
		});
	});

	test('antd 变量主题声明的主色 / 信息色变量全部被别名', ()=>{
		const p = path.join(UI, 'node_modules/antd/lib/style/themes/variable.less');
		if(!fs.existsSync(p)){ return; }
		const src = fs.readFileSync(p, 'utf8');
		const names = [];
		src.replace(/--@\{ant-prefix\}-((?:primary|info)-[\w-]+):\s*([^;]+);/g, (m, name, val)=>{
			if(val.trim() !== "~''"){ names.push(`--ant-${name}`); }
			return m;
		});
		expect(names.length).toBeGreaterThan(15);
		const missing = names.filter((n)=>!new RegExp(`${n}:\\s*var\\(`).test(block));
		expect(missing).toEqual([]);
	});

	test('全局主按钮前景修正不抬特异度(它只管弹层里的实底金钮;抬了就把页面内主按钮的前景刷成白压在浅底上)', ()=>{
		// 取「color: var(--horosa-on-accent」所在规则的选择器组:每个选择器只许是 .ant-btn-primary 加至多一个伪类
		const idx = tail.indexOf('.ant-btn-primary,\n');
		expect(idx).toBeGreaterThan(-1);
		const head = tail.slice(idx, tail.indexOf('{', idx));
		const sels = head.split(',').map((x)=>x.trim()).filter(Boolean);
		expect(sels.length).toBe(4);
		sels.forEach((sel)=>{
			expect([sel, /^\.ant-btn-primary(:hover|:focus|:active)?$/.test(sel)]).toEqual([sel, true]);
		});
		// 带 :not( 的主按钮选择器只许出现在「页面内主按钮单一皮」那一组(以内容区 id 起头)
		tail.split('\n').filter((l)=>/\.ant-btn-primary:not\(/.test(l)).forEach((l)=>{
			expect([l.trim(), /^#mainContent \.ant-btn\.ant-btn-primary:not\(/.test(l.trim())]).toEqual([l.trim(), true]);
		});
		// 壳内按钮的中性底规则仍在(这条规则存在,上面的不抬特异度才是必要条件)
		const shell = read('src/layouts/app/02-shell.less');
		expect(/\.horosa-workspace-shell \.ant-btn \{[^}]*background:\s*var\(--horosa-panel-soft\)[^}]*color:\s*var\(--horosa-text\)/.test(shell)).toBe(true);
	});

	test('页面内主按钮单一皮:金淡底 + 金边 + 金字,只取主题变量,且压得过各页带 !important 的共用皮', ()=>{
		const m = /#mainContent \.ant-btn\.ant-btn-primary:not\(\[disabled\]\):not\(\.ant-btn-dangerous\) \{([^}]*)\}/.exec(tail);
		expect(m).not.toBeNull();
		const body = m[1];
		expect(/border-color:\s*var\(--horosa-border-strong\) !important;/.test(body)).toBe(true);
		expect(/background:\s*var\(--horosa-accent-soft\) !important;/.test(body)).toBe(true);
		expect(/color:\s*var\(--horosa-accent-strong\) !important;/.test(body)).toBe(true);
		expect(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(body)).toBe(false);
		// 不留任何按类名豁免的口子(起卦钮曾因吸底豁免成实底金,与起课 / 定局 / 起盘长相不一)
		expect(/#mainContent \.ant-btn\.ant-btn-primary[^{]*:not\(\.horosa-/.test(tail)).toBe(false);
	});

	test('开关钮的「开」态同一张皮:压得过各页带 !important 的共用皮(否则开与关只差字重),只取主题变量,禁用态不管', ()=>{
		const m = /#mainContent \.ant-btn\.xq-toggle-active:not\(\[disabled\]\) \{([^}]*)\}/.exec(tail);
		expect(m).not.toBeNull();
		const body = m[1];
		expect(/border-color:\s*var\(--horosa-accent\) !important;/.test(body)).toBe(true);
		expect(/background:\s*var\(--horosa-accent-soft\) !important;/.test(body)).toBe(true);
		expect(/color:\s*var\(--horosa-accent-strong\) !important;/.test(body)).toBe(true);
		expect(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(body)).toBe(false);
	});

	test('别名块在主题块之外(层叠末端),且 app.less 最后才引它', ()=>{
		// 区段次序按登记表读(登记次序 = app.less 的 @import 次序,sourceSetManifest 看守两者一致);门面排在清单最后
		const parts = sourceSetFiles(path.join(UI, 'src/layouts/app.less'));
		expect(path.basename(parts[parts.length - 2])).toBe('22-tail-fixes.less');
		expect(read('src/layouts/app/01-base.less').includes('--ant-primary-color')).toBe(false);
	});
});
