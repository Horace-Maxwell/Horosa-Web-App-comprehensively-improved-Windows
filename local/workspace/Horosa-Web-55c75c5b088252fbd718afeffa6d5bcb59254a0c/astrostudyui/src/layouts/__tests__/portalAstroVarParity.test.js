// portal 层 --horosa-astro-* 变量与作用域内定义的**逐条等价锁**。
//
// 背景:盘面那套 --horosa-astro-* 只定义在 `.horosa-workspace-shell .horosa-astro-redesign`
// 作用域内,而 antd 的 Drawer / Modal / Popover / Tooltip / Dropdown 都 portal 到 body,
// 不在该祖先之下 → 变量解析不到 → 组件只吃行内兜底色(塔罗单卡详情抽屉「亮色主题白底白字」即此)。
// 修法是在 portal 根上补一份同名定义。
//
// 🔴 本文件锁的是「补的那份必须与作用域内**逐条相同**」:
//    首版把它们映到了语义相近的根 token(--horosa-cyan / --horosa-text-soft …),
//    结果 11 个里 7 个不等价 —— 最狠的是 astro-cyan,暗色由青 #79c9be 变金 #d8ad63,
//    直接换了色相;label 由暖 #d6c7b0 变冷 #b9c7c9。对**挂在作用域内**的 portal
//    (用 getPopupContainer 的那些)这是实打实的观感回归,且肉眼极易漏过。
//    以后任一侧改了值而另一侧没跟,这里立刻红。
import fs from 'fs';
import path from 'path';

const LESS = fs.readFileSync(path.join(__dirname, '../app.less'), 'utf8');

/** 取某个选择器块内的全部 --horosa-astro-* 声明(按出现序) */
function astroVarsIn(selectorAnchor){
	const i = LESS.indexOf(selectorAnchor);
	expect([selectorAnchor, i >= 0]).toEqual([selectorAnchor, true]);
	// 块尾:该锚点之后第一个「四空格缩进的右花括号」
	const j = LESS.indexOf('\n    }', i);
	expect(j).toBeGreaterThan(i);
	const body = LESS.slice(i, j);
	const out = {};
	const re = /(--horosa-astro-[\w-]+)\s*:\s*([^;]+);/g;
	let m = re.exec(body);
	while(m){ out[m[1]] = m[2].trim(); m = re.exec(body); }
	return out;
}

const SCOPED_DARK = '.horosa-workspace-shell .horosa-astro-redesign {';
const SCOPED_LIGHT = ":root[data-horosa-appearance='light'] .horosa-workspace-shell .horosa-astro-redesign {";
const PORTAL_DARK = '.ant-dropdown {';
const PORTAL_LIGHT = ":root[data-horosa-appearance='light'] .ant-dropdown {";

describe('portal 层 astro 变量与作用域内定义等价', ()=>{
	it('暗色基线:两处变量集合与取值逐条相同', ()=>{
		const scoped = astroVarsIn(SCOPED_DARK);
		const portal = astroVarsIn(PORTAL_DARK);
		expect(Object.keys(portal).sort()).toEqual(Object.keys(scoped).sort());
		const diff = Object.keys(scoped).filter((k)=>portal[k] !== scoped[k])
			.map((k)=>`${k}: 作用域=${scoped[k]} portal=${portal[k]}`);
		expect(diff).toEqual([]);
	});

	it('亮色覆盖:两处变量集合与取值逐条相同', ()=>{
		const scoped = astroVarsIn(SCOPED_LIGHT);
		const portal = astroVarsIn(PORTAL_LIGHT);
		expect(Object.keys(portal).sort()).toEqual(Object.keys(scoped).sort());
		const diff = Object.keys(scoped).filter((k)=>portal[k] !== scoped[k])
			.map((k)=>`${k}: 作用域=${scoped[k]} portal=${portal[k]}`);
		expect(diff).toEqual([]);
	});

	it('两个主题的变量集合本身一致(亮色不许漏覆盖某一项)', ()=>{
		expect(Object.keys(astroVarsIn(SCOPED_LIGHT)).sort())
			.toEqual(Object.keys(astroVarsIn(SCOPED_DARK)).sort());
	});

	it('五类 antd portal 根全部登记(少一类=该类弹层里变量仍解析不到)', ()=>{
		['.ant-drawer', '.ant-modal-root', '.ant-popover', '.ant-tooltip', '.ant-dropdown'].forEach((sel)=>{
			// 暗色基线块与亮色覆盖块都必须包含该选择器
			const darkIdx = LESS.indexOf(PORTAL_DARK);
			const darkHead = LESS.slice(Math.max(0, darkIdx - 400), darkIdx);
			expect([sel, darkHead.includes(`${sel},`) || sel === '.ant-dropdown']).toEqual([sel, true]);
			const lightIdx = LESS.indexOf(PORTAL_LIGHT);
			const lightHead = LESS.slice(Math.max(0, lightIdx - 500), lightIdx);
			expect([sel, lightHead.includes(`'light'] ${sel},`) || sel === '.ant-dropdown']).toEqual([sel, true]);
		});
	});

	it('🔴 塔罗单卡详情抽屉的正文色确实走这套变量(回归原案)', ()=>{
		const drawer = fs.readFileSync(path.join(__dirname, '../../components/tarot/CardDetailDrawer.js'), 'utf8');
		expect(drawer).toContain('var(--horosa-astro-text');
	});
});
