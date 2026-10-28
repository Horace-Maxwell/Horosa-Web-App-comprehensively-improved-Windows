// 无人引用的文件 / 导出 / 样式 / 配置 / 依赖已清掉;仍在用的同模块导出照常在。
import fs from 'fs';
import path from 'path';
const { readSource } = require('../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const SRC = path.join(__dirname, '..', '..');
const UI = path.join(SRC, '..');
const read = (rel)=>readSource(path.join(SRC, rel));

describe('无人引用的文件已删除', ()=>{
	test('旧约定文件 / 模板残留 / 零引用组件都不在了', ()=>{
		[
			'dva.js', 'pages/index.less',
			'components/amap/ACG.js', 'components/amap/GeoCoord.js',
			'components/graph/D3DegreeInnerLine.js', 'components/graph/D3DegreeOuterLine.js', 'components/graph/D3BaseCircle.js',
			'components/homepage/PageFooter.js', 'components/homepage/PageFooter.less',
			'components/jieqi/JieQiChart.js', 'components/ruleziwei/ZWIndication.js',
		].forEach((rel)=>{
			expect(`${rel}:${fs.existsSync(path.join(SRC, rel))}`).toBe(`${rel}:false`);
		});
	});
	test('运行时 dva 配置只在 app.js 一处', ()=>{
		expect(read('app.js')).toMatch(/export const dva = \{/);
	});
});

describe('无人消费的导出已删除,同模块仍在用的导出照常在', ()=>{
	const has = (mod, name)=>Object.prototype.hasOwnProperty.call(mod, name);
	test('六壬常量 / 取象', ()=>{
		const LRConst = require('../liureng/LRConst');
		expect(has(LRConst, 'isBrother')).toBe(false);
		expect(has(LRConst, 'getSigColor')).toBe(false);
		['isRestrain', 'isAccrue', 'getHouseColor', 'GanZiBrother', 'ZiHe'].forEach((k)=>expect(has(LRConst, k)).toBe(true));
		const xiang = require('../liureng/LRXiangDoc');
		expect(has(xiang, 'getGanXiangLines')).toBe(false);
		expect(typeof xiang.buildXiangContext).toBe('function');
		expect(read('components/liureng/LRXiangDoc.js')).not.toContain('QimenXiangDoc');
	});
	test('塔罗牌组数据', ()=>{
		const corr = require('../tarot/decks/correspondences');
		expect(has(corr, 'majorElement')).toBe(false);
		expect(typeof corr.SIGN_ELEMENT).toBe('object');
		const manual = require('../tarot/decks/manualMeanings');
		expect(has(manual, 'manualMeaningOf')).toBe(false);
		['MAJOR_MANUAL', 'PIP_MANUAL', 'COURT_MANUAL'].forEach((k)=>expect(typeof manual[k]).toBe('object'));
		const deck = require('../tarot/decks/deckInfo');
		expect(has(deck, 'deckInfo')).toBe(false);
		expect(typeof deck.DECK_INFO).toBe('object');
	});
	test('风水富文本 / 演禽引擎 / 通用组件库', ()=>{
		const rich = require('../fengshui/fengshuiRichText');
		expect(has(rich, 'stripInlineBold')).toBe(false);
		expect(typeof rich.deepInlineBold).toBe('function');
		const yq = require('../yanqin/yanqinEngine');
		['elementOf', 'qinKeJudge', 'huangHeiDaoOfDay', 'jianChuOfDay'].forEach((k)=>expect(`${k}:${has(yq, k)}`).toBe(`${k}:false`));
		['huangHeiDao', 'jianChu', 'qinKeByWuxing', 'ganzhiIdxOfDay', 'yearQin'].forEach((k)=>expect(`${k}:${typeof yq[k]}`).toBe(`${k}:function`));
		const ui = require('../xq-ui');
		expect(has(ui, 'XQNavItem')).toBe(false);
		expect(typeof ui.XQPanelHeader).toBe('function');
	});
	test('玄学史日期:只认 modern_date / year,朝代段与文本纪年推断已删', ()=>{
		const d = require('../xuanshi/xuanshiDate');
		expect(has(d, 'periodToDate')).toBe(false);
		expect(has(d, 'textToYear')).toBe(false);
		expect(d.resolveChartDate({ period: '唐开元', dynasty: '唐', title: '襄公十四年' })).toBeNull();
		expect(d.resolveChartDate({ year: -500 })).toEqual({ md: '-500-01-01', disp: '约 公元前 500', exact: false });
		const src = read('components/xuanshi/xuanshiDate.js');
		['LU_REIGN_START', 'cnNumToInt', 'const TABLE'].forEach((w)=>expect(src).not.toContain(w));
		expect(src).not.toContain('→ 文本帝王纪年 → period 朝代段最早');
	});
});

describe('死样式 / 死配置', ()=>{
	test('外壳样式表不再有 :global 之外、无人用的 rootcontainer / trigger / sider', ()=>{
		const less = read('layouts/app.less');
		['.rootcontainer{', '.trigger {', '.trigger:hover {', '.sider::-webkit-scrollbar'].forEach((sel)=>{
			expect(`${sel}:${less.split('\n').some((l)=>l.startsWith(sel))}`).toBe(`${sel}:false`);
		});
		const used = (read('layouts/app.js').match(/styles\.[a-zA-Z]+/g) || []).sort();
		expect([...new Set(used)]).toEqual(['styles.horosaAppShell', 'styles.workspaceInner', 'styles.workspaceOuter']);
	});
	test('global.css 不再有非法选择器 :global(#root)(整条规则会被浏览器丢弃);#root 高度仍由首段规则给出', ()=>{
		const css = read('global.css');
		expect(css).not.toContain(':global(#root)');
		expect(css).toMatch(/html,\s*body,\s*#root\s*\{[^}]*height:\s*100%/);
	});
	test('.umirc.js 不再写 umi2 遗留开关;global.js 不再有空变量', ()=>{
		const rc = fs.readFileSync(path.join(UI, '.umirc.js'), 'utf8');
		['dll:', 'hardSource:', 'pwa:', 'hd:', 'fastClick:'].forEach((k)=>expect(`${k}${rc.includes(k)}`).toBe(`${k}false`));
		expect(read('global.js')).not.toContain('_globalObj');
	});
	test('package.json:零引用依赖已去掉;umi 布局插件的对等依赖保留', ()=>{
		const pkg = JSON.parse(fs.readFileSync(path.join(UI, 'package.json'), 'utf8'));
		const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
		['fastclick', 'drag-modal', 'mammoth', 'qrcode.react', '@monaco-editor/react'].forEach((dep)=>{
			expect(`${dep}:${Object.prototype.hasOwnProperty.call(all, dep)}`).toBe(`${dep}:false`);
		});
		// antd 本身没有直接声明,靠它把 antd 一族留在生产依赖树里
		expect(Object.prototype.hasOwnProperty.call(all, '@ant-design/pro-layout')).toBe(true);
	});
});
