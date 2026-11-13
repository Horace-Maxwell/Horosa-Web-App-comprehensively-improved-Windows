// 竖排页签条单一来源:锁住四件事 ——
//   ① 竖排(left / right)的 XQTabs 缺省走自绘页签条 XQTabRailBar(原生纵向滚动;不出「更多」省略号菜单);
//   ② 主导航自有滚动样式,显式 rail={false} 保持原行为;
//   ③ 各页不再各写一份竖排页签条(组件里不自绘、页级样式不再给竖排 nav-wrap 另开 overflow);
//   ④ 样式里有原生滚动 + 三档边缘渐隐 + 右缘末项避让窗口右下角状态灯。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		const p = path.join(dir, d.name);
		if(d.isDirectory()){
			if(d.name === '__tests__' || d.name === 'node_modules' || d.name.startsWith('.umi')){ return; }
			walk(p, out);
		}else{
			out.push(p);
		}
	});
	return out;
}

describe('竖排页签条单一来源', ()=>{
	const xq = read('components/xq-ui/index.js');
	const styles = read('components/xq-ui/styles.less');

	test('竖排 XQTabs 缺省走自绘页签条,且带 xq-tabs-rail 类', ()=>{
		expect(/function XQTabRailBar\(/.test(xq)).toBe(true);
		expect(/rest\.tabPosition === 'right' \|\| rest\.tabPosition === 'left'/.test(xq)).toBe(true);
		expect(/vertical && rail !== false && !rest\.renderTabBar/.test(xq)).toBe(true);
		expect(/className=\{`xq-tabs xq-tabs-rail \$\{className\}`\.trim\(\)\}/.test(xq)).toBe(true);
		// 自绘条沿用 antd 类名(各页样式 / 查询不必改),另加自己的钩子类
		expect(/className="ant-tabs-nav xq-tab-rail"/.test(xq)).toBe(true);
		expect(/className="ant-tabs-nav-wrap xq-tab-rail-wrap"/.test(xq)).toBe(true);
		expect(/role="tablist"/.test(xq)).toBe(true);
	});

	test('主导航保持原页签条', ()=>{
		const page = read('pages/index.js');
		expect(/<XQTabs[^>]*tabPosition='left'[^>]*rail=\{false\}/.test(page)).toBe(true);
	});

	test('各页不再自绘竖排页签条', ()=>{
		const files = walk(path.join(SRC, 'components'), []).filter((f)=>/\.js$/.test(f));
		const offenders = [];
		files.forEach((f)=>{
			const rel = path.relative(SRC, f);
			if(rel === path.join('components', 'xq-ui', 'index.js')){ return; }
			const s = fs.readFileSync(f, 'utf8');
			if(!/tabPosition=\{?['"](right|left)['"]\}?/.test(s)){ return; }
			if(/renderTabBar=/.test(s)){ offenders.push(rel); }
		});
		expect(offenders).toEqual([]);
	});

	test('页级样式不再给竖排页签条另开滚动', ()=>{
		const RAIL_SCOPES = ['horosa-direction-page', 'horosa-relative-tabs', 'xq-tabs-rail', 'ant-tabs-right', 'ant-tabs-left'];
		const RAIL_SCOPE_RE = new RegExp(`(${RAIL_SCOPES.join('|')})`);
		const less = walk(SRC, []).filter((f)=>/\.less$/.test(f));
		const offenders = [];
		less.forEach((f)=>{
			const rel = path.relative(SRC, f);
			if(rel === path.join('components', 'xq-ui', 'styles.less')){ return; }
			// 主导航(rail={false})自有滚动样式,整段在 mainRootTabs 名下,不在此列
			const s = fs.readFileSync(f, 'utf8');
			const re = /([^{}]*\.ant-tabs-nav-wrap[^{}]*)\{([^{}]*)\}/g;
			let m;
			while((m = re.exec(s))){
				const sel = m[1];
				if(/mainRootTabs/.test(sel)){ continue; }
				if(!RAIL_SCOPE_RE.test(sel)){ continue; }
				if(/overflow(-y)?\s*:\s*(auto|scroll)/.test(m[2])){ offenders.push(`${rel}: ${sel.trim().split('\n').pop().trim()}`); }
			}
		});
		expect(offenders).toEqual([]);
	});

	test('样式:原生滚动 + 三档边缘渐隐 + 末项避让状态灯', ()=>{
		const m = /\.xq-tabs-rail\.ant-tabs > \.xq-tab-rail > \.xq-tab-rail-wrap \{([^}]*)\}/.exec(styles);
		expect(m).not.toBeNull();
		expect(/overflow-y:\s*auto;/.test(m[1])).toBe(true);
		expect(/overscroll-behavior:\s*contain;/.test(m[1])).toBe(true);
		['top', 'bottom', 'both'].forEach((k)=>{
			const mm = new RegExp(`\\.xq-tab-rail-wrap\\[data-more='${k}'\\] \\{([^}]*)\\}`).exec(styles);
			expect([k, !!mm && /-webkit-mask-image:/.test(mm[1]) && /\n\s*mask-image:/.test(mm[1])]).toEqual([k, true]);
		});
		expect(/\.xq-tabs-rail\.ant-tabs-right > \.xq-tab-rail > \.xq-tab-rail-wrap > \.ant-tabs-nav-list \{\s*padding-bottom:\s*22px;/.test(styles)).toBe(true);
	});
});
