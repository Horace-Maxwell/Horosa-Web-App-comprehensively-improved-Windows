// 技法 ↔ 择日对应登记表(合同):择日十宿主(天星 / 奇门 / 八字 / 太乙 / 紫微 / 六壬 / 三式 / 七政 / 印度 / 黄历)
// 的内嵌盘、扫描引擎、概览浮窗、AI 快照,凡与技法页同一口径的地方,择日侧必须引用技法侧的同一实现。
// 技法页修了一处口径,择日侧只要还引用同一单源就自动跟上;一旦择日侧另抄一份(或换成自己的旧副本),本测试判红。
//
// 改任何技法口径(起盘参数 / 快照构造 / 缩写表 / 语义色 / 时间算法 · 换日 · 晚子时)时:
//   ① 改在单源上(下表「单源」列),择日侧经引用自动生效;
//   ② 新增的口径函数若择日侧也要用,登记进下表;
//   ③ 择日侧确需不同口径的,写在本文件 EXEMPT 里并写明理由。
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

jest.mock('../../../utils/kentangCaseSave', ()=>({
	...jest.requireActual('../../../utils/kentangCaseSave'),
	openKentangCaseDrawer: jest.fn(),
}));
const qimenPanCalls = [];
jest.mock('../qimenScanEngine', ()=>{
	const actual = jest.requireActual('../qimenScanEngine');
	return { ...actual, computeQimenScanPan: (geo, opts, seeds)=>{ qimenPanCalls.push({ geo, seeds }); return null; } };
});

// eslint-disable-next-line import/first
import { readSource, fnBody } from '../../../utils/__tests__/helpers/sourceSet';
// eslint-disable-next-line import/first
import { saveModuleAISnapshot, loadModuleAISnapshot, clearModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
// eslint-disable-next-line import/first
import { MODULE_SNAPSHOT_REFRESH_EVENT } from '../../../utils/moduleSnapshotRefresh';
// eslint-disable-next-line import/first
import { zeriCaseSnapshotText, refreshZeriSlot } from '../../../components/zeri/zeriCaseRestore';
// eslint-disable-next-line import/first
import BaziZeriMain, { baziZeriDefaultOptions } from '../../../components/zeri/BaziZeriMain';
// eslint-disable-next-line import/first
import ZiweiZeriMain from '../../../components/zeri/ZiweiZeriMain';
// eslint-disable-next-line import/first
import HuangliZeriMain from '../../../components/zeri/HuangliZeriMain';
// eslint-disable-next-line import/first
import QizhengZeriMain from '../../../components/zeri/QizhengZeriMain';
// eslint-disable-next-line import/first
import IndiaZeriMain from '../../../components/zeri/IndiaZeriMain';
// eslint-disable-next-line import/first
import { liurengZeriDefaultOptions } from '../../../components/zeri/LiurengZeriMain';
// eslint-disable-next-line import/first
import QimenMiniBoardPopup from '../../../components/zeri/QimenMiniBoardPopup';
// eslint-disable-next-line import/first
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
// eslint-disable-next-line import/first
import { formatWallDate, wallTextToMs, msToWallText, wallDateStr, msToWall, wallToMs } from '../hourlyScanEngine';
// eslint-disable-next-line import/first
import { classifyStorageKey } from '../../../utils/storageKeyRegistry';
// eslint-disable-next-line import/first
import { CASE_TYPE_OPTIONS } from '../../../utils/localcases';

const { openKentangCaseDrawer } = require('../../../utils/kentangCaseSave');
const parser = require('@babel/parser');

const SRC = path.join(__dirname, '..', '..', '..');
const rel = (p)=>path.join(SRC, p);
const read = (p)=>readSource(rel(p));
const ZERI_DIRS = ['components/zeri', 'divination/zeri'];

function zeriFiles(){
	const out = [];
	ZERI_DIRS.forEach((d)=>{
		fs.readdirSync(rel(d)).filter((f)=>/\.js$/.test(f)).forEach((f)=>out.push(`${d}/${f}`));
	});
	return out;
}
function astOf(text){
	return parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport'], errorRecovery: true });
}
// 文件的静态导入:{ 源: Set(导入名,default = 'default') }
function importsOf(p){
	const map = {};
	astOf(fs.readFileSync(rel(p), 'utf8')).program.body.forEach((n)=>{
		if(n.type !== 'ImportDeclaration'){ return; }
		const set = map[n.source.value] || (map[n.source.value] = new Set());
		n.specifiers.forEach((s)=>{
			set.add(s.type === 'ImportDefaultSpecifier' ? 'default' : (s.type === 'ImportNamespaceSpecifier' ? '*' : s.imported.name));
		});
	});
	return map;
}
// 文件里自己声明(顶层 / 类方法以外的函数与常量)的名字
function declaredNames(p){
	const names = new Set();
	const visit = (node)=>{
		if(!node || typeof node.type !== 'string'){ return; }
		if(node.type === 'FunctionDeclaration' && node.id){ names.add(node.id.name); }
		if(node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier'){ names.add(node.id.name); }
		Object.keys(node).forEach((k)=>{
			if(k === 'loc' || k === 'start' || k === 'end'){ return; }
			const v = node[k];
			if(Array.isArray(v)){ v.forEach(visit); } else if(v && typeof v === 'object' && typeof v.type === 'string'){ visit(v); }
		});
	};
	visit(astOf(fs.readFileSync(rel(p), 'utf8')).program);
	return names;
}
const stripComments = (t)=>`${t}`.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

// ── 登记表:择日侧位置 → 必须引用的技法侧单源 ──
// file:择日侧文件;from:导入源(与该文件里的写法逐字相同);names:必须导入的名字
const PARITY = [
	// 八字:内嵌整页(快照随选项重存 / 运限 / 起运整数档 / 紧凑面板网格都随 BaZi 本体);节气按纬度调整的发送值单源
	{ tech: '八字', file: 'components/zeri/BaziZeriMain.js', from: '../cntradition/BaZi', names: ['default'] },
	{ tech: '八字', file: 'components/zeri/BaziZeriMain.js', from: '../../utils/baziLunarLocal', names: ['BAZI_ADJUST_JIEQI_SENT', 'buildLocalBaziResult'] },
	{ tech: '八字', file: 'components/zeri/BaziZeriMain.js', from: '../../utils/dayBoundary', names: ['defaultAfter23NewDay', 'defaultLateZiHourUseNextDay'] },
	{ tech: '八字', file: 'divination/zeri/baziZeriScanEngine.js', from: '../../utils/baziLunarLocal', names: ['buildLocalNongliLite'] },
	{ tech: '八字', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../cntradition/PaiBaZi', names: ['default'] },
	{ tech: '八字', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../../utils/baziLunarLocal', names: ['buildLocalBaziResult'] },
	// 紫微:内嵌整页(快照随显示口径 / 运限重存、运限芯片条样式随 ZiWeiMain);扫描与浮窗走同一排盘引擎
	{ tech: '紫微', file: 'components/zeri/ZiweiZeriMain.js', from: '../ziwei/ZiWeiMain', names: ['default'] },
	{ tech: '紫微', file: 'divination/zeri/ziweiZeriScanEngine.js', from: '../../components/ziwei/ZiweiCalc', names: ['calcZiweiFromLite'] },
	{ tech: '紫微', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../ziwei/ZiweiCalc', names: ['calcZiwei'] },
	{ tech: '紫微', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../ziwei/ZiWeiChart', names: ['default'] },
	// 浮窗起盘参数与扫描同一构参函数(行为合同见 zeriPopupEqualsScan.test.js)
	{ tech: '紫微', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../../divination/zeri/ziweiZeriScanEngine', names: ['ziweiScanCalcArgs'] },
	{ tech: '八字', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../../divination/zeri/baziZeriScanEngine', names: ['baziScanParams'] },
	// 六壬:内嵌整页;扫描用六壬页的课体构造;浮窗用六壬页的盘组件(天将逐字画字整词定字 / 缩写单源随之)与月将换法
	{ tech: '六壬', file: 'components/zeri/LiurengZeriMain.js', from: '../lrzhan/LiuRengMain', names: ['default'] },
	{ tech: '六壬', file: 'divination/zeri/liurengZeriScanEngine.js', from: '../../components/lrzhan/LiuRengMain', names: ['buildLiuRengLayout', 'buildKeData', 'buildSanChuanData'] },
	{ tech: '六壬', file: 'divination/zeri/liurengZeriConditionTypes.js', from: '../../components/liureng/LRConst', names: ['TianJiang'] },
	{ tech: '六壬', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../lrzhan/LiuRengChart', names: ['default'] },
	{ tech: '六壬', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../lrzhan/LiuRengMain', names: ['buildLiuRengCastOverride'] },
	// 扫描起课的分昼夜 / 涉害口径与六壬页同一实现;内嵌页口径 × 扫描的单一登记处 zeriPageCalibre
	{ tech: '六壬', file: 'divination/zeri/liurengZeriScanEngine.js', from: '../../components/lrzhan/LiuRengMain', names: ['liurengSeHaiOptsOf', 'liurengFenZhouYeDiurnal'] },
	{ tech: '六壬', file: 'components/zeri/LiurengZeriMain.js', from: '../../divination/zeri/zeriPageCalibre', names: ['LIURENG_PAGE_SCAN_KEYS', 'LIURENG_ZERI_LOCKED', 'liurengWorkbenchToPage'] },
	{ tech: '六壬', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../../divination/zeri/zeriPageCalibre', names: ['LIURENG_PAGE_SCAN_KEYS', 'LIURENG_ZERI_LOCKED', 'liurengWorkbenchToPage'] },
	{ tech: '三式', file: 'components/zeri/SanshiZeriMain.js', from: '../../divination/zeri/zeriPageCalibre', names: ['SANSHI_LR_PAGE_SCAN_KEYS', 'SANSHI_TY_PAGE_SCAN_KEYS', 'SANSHI_ZERI_LOCKED', 'liurengWorkbenchToPage'] },
	{ tech: '太乙', file: 'components/zeri/TaiyiZeriMain.js', from: '../../divination/zeri/zeriPageCalibre', names: ['TAIYI_PAGE_SCAN_KEYS', 'TAIYI_ZERI_LOCKED'] },
	{ tech: '太乙', file: 'divination/zeri/taiyiZeriScanEngine.js', from: './zeriPageCalibre', names: ['TAIYI_ZERI_LOCKED'] },
	// 三式合一:内嵌整页;浮窗用三式合一盘本体(缩写节点的整词属性随之)与三式页的装配函数
	{ tech: '三式', file: 'components/zeri/SanshiZeriMain.js', from: '../sanshi/SanShiUnitedMain', names: ['default'] },
	{ tech: '三式', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../sanshi/SanshiUnitedBoard', names: ['default'] },
	{ tech: '三式', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../sanshi/SanShiUnitedMain', names: ['buildLiuRengLayout', 'buildKeData', 'buildSanChuan', 'buildSanshiLiuRengCastOverride', 'buildLrNongli'] },
	// 奇门:内嵌整页;扫描用奇门排局引擎;两个浮窗的奇门盘都是 DunJiaBoard(门名 / 六害语义色随它)
	{ tech: '奇门', file: 'components/zeri/QimenZeriMain.js', from: '../dunjia/DunJiaMain', names: ['default'] },
	{ tech: '奇门', file: 'divination/zeri/qimenScanEngine.js', from: '../../components/dunjia/DunJiaCalc', names: ['calcDunJia'] },
	{ tech: '奇门', file: 'components/zeri/QimenMiniBoardPopup.js', from: '../dunjia/DunJiaBoard', names: ['default'] },
	{ tech: '奇门', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../dunjia/DunJiaCalc', names: ['calcDunJia', 'fetchQimenPan', 'normalizeKinqimenData', 'isQimenLocalRoute'] },
	// 太乙:内嵌整页;扫描用太乙页的起局与流派;浮窗用太乙盘组件
	{ tech: '太乙', file: 'components/zeri/TaiyiZeriMain.js', from: '../taiyi/TaiYiMain', names: ['default'] },
	{ tech: '太乙', file: 'divination/zeri/taiyiZeriScanEngine.js', from: '../../components/taiyi/TaiYiCalc', names: ['calcTaiyi'] },
	{ tech: '太乙', file: 'divination/zeri/taiyiZeriScanEngine.js', from: '../../components/taiyi/core/taiyiSchool', names: ['applyTaiyiSchool'] },
	{ tech: '太乙', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../taiyi/TaiyiBoardSvg', names: ['default'] },
	// 七政 / 印度:内嵌整页;浮窗用技法页的盘组件
	{ tech: '七政', file: 'components/zeri/QizhengZeriMain.js', from: '../guolao/GuoLaoChartMain', names: ['default'] },
	{ tech: '七政', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../guolao/GuoLaoMoiraWheel', names: ['default'] },
	{ tech: '印度', file: 'components/zeri/IndiaZeriMain.js', from: '../astro/IndiaChartMain', names: ['default'] },
	{ tech: '印度', file: 'components/zeri/ZeriMiniPanPopup.js', from: '../astro/IndiaSouthChart', names: ['default'] },
	// 黄历:内嵌整页;扫描与日卡浮窗都用黄历页的同一日课构造与日卡组件(黄黑道 / 宜忌头的字色随它的样式)
	{ tech: '黄历', file: 'components/zeri/HuangliZeriMain.js', from: '../calendar/HuangLiMain', names: ['default'] },
	{ tech: '黄历', file: 'divination/zeri/huangliZeriScanEngine.js', from: '../../components/calendar/huangliDay', names: ['buildHuangliDay'] },
	{ tech: '黄历', file: 'components/zeri/HuangliDayPopup.js', from: '../calendar/HuangLiDayCard', names: ['default'] },
];

// 择日侧不许自己再声明的技法单源名(声明了 = 另立副本,技法侧的修复到不了这里)
const TECH_SINGLE_SOURCE_NAMES = [
	'buildLocalBaziResult', 'buildLocalNongliLite', 'formatStartLuck', 'BAZI_ADJUST_JIEQI_SENT',
	'calcZiwei', 'calcZiweiFromLite', 'buildZiWeiSnapshotText', 'periodFromLuckSel',
	'buildLiuRengLayout', 'buildKeData', 'buildSanChuan', 'buildSanChuanData', 'buildLiuRengCastOverride', 'buildSanshiLiuRengCastOverride',
	'liurengSeHaiOptsOf', 'liurengFenZhouYeDiurnal', 'appendPerCharText', 'perCharScriptWord', 'qimenGlyphScriptAttrs',
	'shortTianJiang', 'getShortJiang', 'tianJiangShortAttrs', 'TIANJIANG_SHORT', 'TIANJIANG_SHORT_MAP',
	'calcDunJia', 'QIMEN_HARM_COLORS', 'qimenHarmColor', 'calcTaiyi', 'buildHuangliDay',
	'parseDateTimeText', 'formatSignedDate', 'selectionDelta', 'applySelectionDelta',
	'withOriginalScript', 'matchesUserQuery', 'scriptFilterBy', 'scriptMatchKey',
	'requestModuleSnapshotRefreshSync', 'dispatchModuleSnapshotRefresh', 'loadFreshModuleAISnapshot',
];
// 择日内部的单源:只许在登记的那一个文件里声明
const ZERI_INTERNAL_SINGLE_SOURCE = {
	geoDepKey: 'components/zeri/zeriHostUtils.js',
	formatWallDate: 'divination/zeri/hourlyScanEngine.js',
	wallTextToMs: 'divination/zeri/hourlyScanEngine.js',
	msToWallText: 'divination/zeri/hourlyScanEngine.js',
	wallYmdToMs: 'divination/zeri/hourlyScanEngine.js',
	zeriCaseSnapshotText: 'components/zeri/zeriCaseRestore.js',
	refreshZeriSlot: 'components/zeri/zeriCaseRestore.js',
	ziweiScanCalcArgs: 'divination/zeri/ziweiZeriScanEngine.js',
	baziScanParams: 'divination/zeri/baziZeriScanEngine.js',
	liurengWorkbenchToPage: 'divination/zeri/zeriPageCalibre.js',
	lockedValuesOf: 'divination/zeri/zeriPageCalibre.js',
	zeriLockProps: 'divination/zeri/zeriPageCalibre.js',
};

describe('登记表:择日侧引用技法侧的同一实现', ()=>{
	test.each(PARITY.map((r)=>[`${r.tech} · ${r.file} ← ${r.from}`, r]))('%s', (_label, r)=>{
		const imp = importsOf(r.file);
		expect(Object.keys(imp)).toContain(r.from);
		r.names.forEach((n)=>{ expect([...imp[r.from]]).toContain(n); });
	});

	test('择日侧不另立技法单源的副本(同名声明即红)', ()=>{
		const hits = [];
		zeriFiles().forEach((p)=>{
			const names = declaredNames(p);
			TECH_SINGLE_SOURCE_NAMES.forEach((n)=>{ if(names.has(n)){ hits.push(`${p}:${n}`); } });
			Object.keys(ZERI_INTERNAL_SINGLE_SOURCE).forEach((n)=>{
				if(names.has(n) && ZERI_INTERNAL_SINGLE_SOURCE[n] !== p){ hits.push(`${p}:${n}(单源在 ${ZERI_INTERNAL_SINGLE_SOURCE[n]})`); }
			});
		});
		expect(hits).toEqual([]);
		// 择日内部单源确实在登记的文件里(防改名后本条失明)
		Object.keys(ZERI_INTERNAL_SINGLE_SOURCE).forEach((n)=>{ expect(declaredNames(ZERI_INTERNAL_SINGLE_SOURCE[n]).has(n)).toBe(true); });
		expect(zeriFiles().length).toBeGreaterThan(50);   // 扫描面塌缩守卫
	});

	test('择日侧没有自己的天将缩写表(缩写只认六壬页那一张)', ()=>{
		const hits = zeriFiles().filter((p)=>/['"]?朱雀['"]?\s*:\s*['"][一-龥]['"]/.test(stripComments(fs.readFileSync(rel(p), 'utf8'))));
		expect(hits).toEqual([]);
	});

	test('择日侧不自己画盘上的字(逐字画字的整词定字只在技法盘组件里)', ()=>{
		const hits = zeriFiles().filter((p)=>/\bdrawText[HV]\s*\(|\.fillText\s*\(|\.strokeText\s*\(/.test(stripComments(fs.readFileSync(rel(p), 'utf8'))));
		expect(hits).toEqual([]);
	});

	test('择日侧不为技法盘另立样式副本(紫微运限芯片条 / 八字面板 / 黄历日卡的样式只在技法那一处)', ()=>{
		const dir = rel('layouts/app');
		const css = fs.readdirSync(dir).filter((f)=>/\.less$/.test(f)).map((f)=>fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
		const bad = css.split(/[{}]/).filter((sel)=>/horosa-zeri/.test(sel) && /horosa-(ziwei-luck|bazi-|huangli-)/.test(sel));
		expect(bad).toEqual([]);
	});
});

describe('起盘口径:择日与技法页同一来源', ()=>{
	test('八字择日只发「节气按纬度调整」的单源值', ()=>{
		zeriFiles().forEach((p)=>{
			const t = stripComments(fs.readFileSync(rel(p), 'utf8'));
			const uses = t.match(/adjustJieqi\s*:[^,\n}]*/g) || [];
			uses.forEach((u)=>{ expect(u).toMatch(/BAZI_ADJUST_JIEQI_SENT/); });
		});
	});

	test('换日 / 晚子时缺省 = 全局日界现值(与技法页同一来源)', ()=>{
		expect(baziZeriDefaultOptions().after23NewDay).toBe(defaultAfter23NewDay());
		expect(baziZeriDefaultOptions().lateZiHourUseNextDay).toBe(defaultLateZiHourUseNextDay());
		expect(liurengZeriDefaultOptions().after23NewDay).toBe(defaultAfter23NewDay());
		expect(liurengZeriDefaultOptions().lateZiHourUseNextDay).toBe(defaultLateZiHourUseNextDay());
	});
});

describe('存案快照 = 页面此刻所见(与对话挂载 / 导出同源)', ()=>{
	const HOSTS = [
		['bazizeri', BaziZeriMain], ['ziweizeri', ZiweiZeriMain], ['huanglizeri', HuangliZeriMain],
		['qizhengzeri', QizhengZeriMain], ['indiazeri', IndiaZeriMain],
	];
	const listeners = [];
	function pageAnswers(scope, text){
		const fn = (evt)=>{
			if(evt.detail && evt.detail.module === scope){
				saveModuleAISnapshot(scope, text);
				evt.detail.snapshotText = text;
			}
		};
		window.addEventListener(MODULE_SNAPSHOT_REFRESH_EVENT, fn);
		listeners.push(fn);
	}
	function mkHost(Host, composed){
		const h = Object.create(Host.prototype);
		h.props = { dispatch: jest.fn() };
		h.state = {};
		h.baziHook = {};
		h.ziweiHook = {};
		h.buildFields = ()=>({});
		h.composeAiSnapshot = jest.fn(()=>composed);
		return h;
	}
	beforeEach(()=>{ jest.clearAllMocks(); });
	afterEach(()=>{
		listeners.splice(0).forEach((fn)=>window.removeEventListener(MODULE_SNAPSHOT_REFRESH_EVENT, fn));
		HOSTS.forEach(([s])=>clearModuleAISnapshot(s));
	});

	test.each(HOSTS)('%s:扫描后没点选就存 → 存进去的是页面此刻的正文(含新结果),不是槽里的旧文', (scope, Host)=>{
		saveModuleAISnapshot(scope, '扫描前的旧文');
		pageAnswers(scope, '页面此刻:母技法全文 + 新的命中时段');
		mkHost(Host, '宿主三段').saveCase();
		expect(openKentangCaseDrawer).toHaveBeenCalledTimes(1);
		expect(openKentangCaseDrawer.mock.calls[0][0].payload.snapshot).toBe('页面此刻:母技法全文 + 新的命中时段');
	});

	test.each(HOSTS)('%s:内嵌页不在场 → 槽里已有的;槽也空 → 宿主三段', (scope, Host)=>{
		saveModuleAISnapshot(scope, '槽里的');
		mkHost(Host, '宿主三段').saveCase();
		expect(openKentangCaseDrawer.mock.calls[0][0].payload.snapshot).toBe('槽里的');
		clearModuleAISnapshot(scope);
		mkHost(Host, '宿主三段').saveCase();
		expect(openKentangCaseDrawer.mock.calls[1][0].payload.snapshot).toBe('宿主三段');
	});

	test('辅助件:zeriCaseSnapshotText / refreshZeriSlot', ()=>{
		const host = { composeAiSnapshot: ()=>'三段' };
		expect(zeriCaseSnapshotText(host, 'qizhengzeri')).toBe('三段');
		// 扫描完成重存:内嵌页应答 → 槽 = 页面全文(不被三段顶掉)
		pageAnswers('qizhengzeri', '七政全文 + 三段');
		expect(refreshZeriSlot(host, 'qizhengzeri')).toBe('七政全文 + 三段');
		expect(loadModuleAISnapshot('qizhengzeri').content).toBe('七政全文 + 三段');
		// 内嵌页不应答 → 写宿主三段兜底
		expect(refreshZeriSlot(host, 'indiazeri')).toBe('三段');
		expect(loadModuleAISnapshot('indiazeri').content).toBe('三段');
	});

	test('七政 / 印度:扫描完成与判读预取到齐都经 refreshZeriSlot 重存(不直写三段版)', ()=>{
		['components/zeri/QizhengZeriMain.js', 'components/zeri/IndiaZeriMain.js'].forEach((p)=>{
			const t = stripComments(fs.readFileSync(rel(p), 'utf8'));
			expect(t).not.toMatch(/saveModuleAISnapshot\(/);
			expect((t.match(/refreshZeriSlot\(this,/g) || []).length).toBeGreaterThanOrEqual(2);
		});
	});

	test('六壬 / 太乙 / 三式内嵌页按择日宿主键存案时,先请页面重存再读槽;奇门页先刷槽再读', ()=>{
		const bodyOf = (file, sig)=>{
			const b = fnBody(read(file), sig);
			expect(b).toBeTruthy();
			return stripComments(b);
		};
		[['components/lrzhan/LiuRengMain.js', 'clickSaveCase('], ['components/taiyi/TaiYiMain.js', 'clickSaveCase('], ['components/sanshi/SanShiUnitedMain.js', 'clickSave(']].forEach(([f, sig])=>{
			const b = bodyOf(f, sig);
			expect(b).toMatch(/loadFreshModuleAISnapshot\(/);
			expect(b).not.toMatch(/\bloadModuleAISnapshot\(/);
		});
		const dj = bodyOf('components/dunjia/DunJiaMain.js', 'clickSaveCase(');
		expect(dj.indexOf('saveLiveSnapshot(')).toBeGreaterThanOrEqual(0);
		expect(dj.indexOf('saveLiveSnapshot(')).toBeLessThan(dj.indexOf('loadModuleAISnapshot(this.scope)'));
	});
});

describe('概览浮窗:地点变了按新地点重排(奇门浮窗与其余各卡同口径)', ()=>{
	let host;
	beforeEach(()=>{ global.React = React; qimenPanCalls.length = 0; host = document.createElement('div'); document.body.appendChild(host); });   // 该组件靠构建期自动注入 React
	afterEach(()=>{ ReactDOM.unmountComponentAtNode(host); host.remove(); });
	const ROW = { start: '2026-05-01 10:00', pick: '2026-05-01 10:00' };
	const OPTS = {};
	const SEEDS = {};
	const G1 = { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, ad: 1, gender: 1 };
	const G2 = { zone: '+08:00', lon: '121e28', lat: '31n14', gpsLon: 121.47, gpsLat: 31.23, ad: 1, gender: 1 };
	const mount = (geo, seeds = SEEDS)=>act(async ()=>{
		ReactDOM.render(<QimenMiniBoardPopup row={ROW} geoParams={geo} options={OPTS} seeds={seeds} onClose={()=>{}} />, host);
		await new Promise((r)=>setTimeout(r, 0));
	});
	test('换地点 → 用新地点重排;同值新对象不重排;找局种子变了也重排', async ()=>{
		await mount(G1);
		const n1 = qimenPanCalls.length;
		expect(n1).toBeGreaterThanOrEqual(1);
		await mount({ ...G1 });
		expect(qimenPanCalls.length).toBe(n1);
		await mount(G2);
		expect(qimenPanCalls.length).toBeGreaterThan(n1);
		expect(qimenPanCalls[qimenPanCalls.length - 1].geo.lon).toBe(G2.lon);
		const n2 = qimenPanCalls.length;
		await mount(G2, { jieqiYear: 2026 });
		expect(qimenPanCalls.length).toBeGreaterThan(n2);
	});
});

describe('墙钟时间串:年补足 4 位、0-99 年不走 Date.UTC(与技法侧日期串同口径)', ()=>{
	test('格式化补足 4 位', ()=>{
		expect(formatWallDate(500, 7, 19)).toBe('0500-07-19');
		expect(formatWallDate(50, 1, 2)).toBe('0050-01-02');
		expect(formatWallDate(2026, 10, 23)).toBe('2026-10-23');
		expect(wallDateStr({ y: 999, mo: 12, dd: 31 })).toBe('0999-12-31');
	});
	test('解析不把 0-99 年映射到 20 世纪,往返恒等', ()=>{
		const t = wallTextToMs('0050-03-01 12:30');
		expect(new Date(t).getUTCFullYear()).toBe(50);
		['0050-03-01 12:30', '0500-07-19 00:00', '2026-10-23 23:59'].forEach((s)=>{ expect(msToWallText(wallTextToMs(s))).toBe(s); });
		expect(wallTextToMs('50-03-01 12:30')).toBe(t);   // 不足 4 位的旧串照认
		const w = msToWall(wallToMs('0050-03-01', '12:30', 480), 480);
		expect([w.y, w.mo, w.dd, w.hh, w.mm]).toEqual([50, 3, 1, 12, 30]);
	});
	test('择日侧不再直接用 Date.UTC 换算墙钟(只经单一来源)', ()=>{
		const hits = zeriFiles().filter((p)=>/Date\.UTC\s*\(/.test(stripComments(fs.readFileSync(rel(p), 'utf8'))));
		expect(hits).toEqual([]);
	});
});

describe('字色:择日侧只用主题语义色(明 / 暗各自达标,与全站对比度修复同一套变量)', ()=>{
	const isThemed = (v)=>/^(var\(--horosa-[a-z0-9-]+(,[^)]*)?\)|inherit|currentColor|transparent)$/.test(`${v}`.trim());
	test('color 属性的字面值都是主题变量', ()=>{
		const bad = [];
		zeriFiles().filter((p)=>p.startsWith('components/')).forEach((p)=>{
			const visit = (node)=>{
				if(!node || typeof node.type !== 'string'){ return; }
				if(node.type === 'ObjectProperty' && ((node.key.type === 'Identifier' && node.key.name === 'color') || (node.key.type === 'StringLiteral' && node.key.value === 'color'))){
					const lits = [];
					const collect = (v)=>{
						if(!v){ return; }
						if(v.type === 'StringLiteral'){ lits.push(v.value); }
						if(v.type === 'ConditionalExpression'){ collect(v.consequent); collect(v.alternate); }
						if(v.type === 'LogicalExpression'){ collect(v.left); collect(v.right); }
					};
					collect(node.value);
					lits.filter((s)=>!isThemed(s)).forEach((s)=>bad.push(`${p}:${node.loc.start.line} ${s}`));
				}
				Object.keys(node).forEach((k)=>{
					if(k === 'loc'){ return; }
					const v = node[k];
					if(Array.isArray(v)){ v.forEach(visit); } else if(v && typeof v === 'object' && typeof v.type === 'string'){ visit(v); }
				});
			};
			visit(astOf(fs.readFileSync(rel(p), 'utf8')).program);
		});
		expect(bad).toEqual([]);
	});
	test('用到的语义色在明暗两套里都有定义', ()=>{
		const base = fs.readFileSync(rel('layouts/app/01-base.less'), 'utf8');
		const used = new Set();
		zeriFiles().filter((p)=>p.startsWith('components/')).forEach((p)=>{
			(fs.readFileSync(rel(p), 'utf8').match(/color: (?:[^,}\n]*\? )?'var\(--horosa-[a-z0-9-]+/g) || []).forEach((m)=>{
				(m.match(/--horosa-[a-z0-9-]+/g) || []).forEach((v)=>used.add(v));
			});
		});
		expect(used.size).toBeGreaterThanOrEqual(3);
		used.forEach((v)=>{ expect((base.match(new RegExp(`${v}\\s*:`, 'g')) || []).length).toBeGreaterThanOrEqual(2); });
	});
});

describe('数据:择日方案库与 AI 快照槽的存储口径', ()=>{
	test('每个方案库键都登记为随备份的用户数据,且按 JSON 校验形状(半坏包不写进本机)', ()=>{
		const t = fs.readFileSync(rel('divination/zeri/schemeStore.js'), 'utf8');
		const keys = (t.match(/storageKey:\s*'([^']+)'/g) || []).map((m)=>m.replace(/storageKey:\s*'|'/g, ''));
		expect(keys.length).toBeGreaterThanOrEqual(10);
		keys.forEach((k)=>{
			const e = classifyStorageKey(k);
			expect(e && e.kind).toBe('user-data');
			expect(e.backup).toBe(true);
			expect(e.format).toBe('json');
		});
	});
	test('AI 快照族上限覆盖择日各宿主的快照槽', ()=>{
		const zeriScopes = CASE_TYPE_OPTIONS.filter((o)=>o.tab === 'zeri').map((o)=>o.module || o.value);
		expect(zeriScopes.length).toBeGreaterThanOrEqual(9);
		const names = new Set(zeriScopes);
		const walk = (dir)=>fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
			const f = path.join(dir, e.name);
			if(e.isDirectory()){ if(['__tests__', 'node_modules', 'test'].indexOf(e.name) < 0){ walk(f); } return; }
			if(!/\.js$/.test(e.name)){ return; }
			const re = /saveModuleAISnapshot(?:Lazy)?\(\s*['"]([A-Za-z0-9_]+)['"]/g;
			const t = fs.readFileSync(f, 'utf8');
			let m = null;
			while((m = re.exec(t)) !== null){ names.add(m[1]); }
		});
		walk(SRC);
		expect(names.size + 1).toBeLessThanOrEqual(classifyStorageKey('horosa.ai.snapshot.module.v1.x').maxEntries);
	});
});

describe('择日 · 日界 / 晚子时缺省取全局单源', ()=>{
	// 选项里缺这两键时一律回落全局现值(defaultAfter23NewDay / defaultLateZiHourUseNextDay),与各技法主页同口径;
	// 此前择日宿主、扫描引擎、概览浮窗各自写死 1(太乙写死 0),全局改了日界择日不跟
	it('择日两目录里没有写死 0 / 1 的回落', ()=>{
		const bad = [];
		zeriFiles().forEach((f)=>{
			const code = stripComments(read(f));
			const re = /\b(after23NewDay|lateZiHourUseNextDay) !== undefined \? [\w.]+\.\1 : [01]\b/g;
			let m;
			while((m = re.exec(code))){ bad.push(`${f}: ${m[0]}`); }
		});
		expect(bad).toEqual([]);
	});
	it('判据自证:写死的回落能被认出', ()=>{
		const re = /\b(after23NewDay|lateZiHourUseNextDay) !== undefined \? [\w.]+\.\1 : [01]\b/;
		expect(re.test('after23NewDay: o.after23NewDay !== undefined ? o.after23NewDay : 1,')).toBe(true);
		expect(re.test('after23NewDay: o.after23NewDay !== undefined ? o.after23NewDay : defaultAfter23NewDay(),')).toBe(false);
	});
});

// ── 内嵌页口径 × 扫描口径 登记表 ──
// 择日宿主内嵌完整技法页,左栏照样能改。页面上每个用户可改的键(pageSettingsRegistry 里该页的 fields ∪ exempt)必须表态:
//   workbench —— 工作台上调,扫描照用,点结果行时按页面键名回写;
//   page      —— 开始择时那一刻从内嵌页取当前值冻结进扫描口径,点结果行时按冻结值回写;
//   locked    —— 扫描只支持一种口径,择日内嵌页里该控件置灰,点结果行时回写锁定值;
//   mirror    —— (奇门择日)工作台参数整份镜像自内嵌奇门页左栏;
//   [exempt, 理由] —— 不改变判定(显示 / 每一课的输入 / 随命主…),写明理由。
// 未登记的键 = 红(页面加了新口径却没表态它在择日里怎么办 = 所见 ≠ 所判 的老路)。
const {
	LIURENG_PAGE_SCAN_KEYS, LIURENG_ZERI_LOCKED, TAIYI_PAGE_SCAN_KEYS, TAIYI_ZERI_LOCKED,
	SANSHI_LR_PAGE_SCAN_KEYS, SANSHI_TY_PAGE_SCAN_KEYS, SANSHI_ZERI_LOCKED,
} = require('../zeriPageCalibre');
const { PAGE_SETTINGS_REGISTRY } = require('../../../utils/pageSettingsRegistry');
const { QM_SEED_KEYS } = require('../sanshiOptionSplit');
const ex = (why)=>['exempt', why];
const SAME_CAST = '每一课的输入(不是口径)';
const EMBED_CALIBRE = {
	liureng: {
		guireng: 'workbench', yueJiangMethod: 'workbench', yinyangSystem: 'workbench',
		fenZhouYe: 'page', seHaiMethod: 'page', seHaiBoundary: 'page', shiRuKe: 'page',
		castMethod: 'locked',
		timeAlg: ex('择日内嵌页不出该控件,起课恒按真太阳时(genGodsParams 内嵌恒 0,与扫描同)'),
		yearShenShaSort: ex('只改右栏年神参考表与快照的年神段;择日条件的太岁神取神煞表,与该排序无关'),
		tuWangShuai: ex('只改右栏旺衰 / 空亡判读与快照;择日条件不判旺衰'),
		wuxing: ex('十二长生五行只改右栏长生表;择日条件不判长生'),
		xuanShiZhi: ex(`选时时辰是${SAME_CAST};起课法在择日里锁定正时正将,该控件不出`),
		yanShuNum: ex(`演数 / 报数数字是${SAME_CAST};起课法在择日里锁定正时正将,该控件不出`),
		zhanCategory: ex('占事类型只改右栏占断分类'),
		xiangOn: ex('取象开关是显示'),
		chartType: ex('盘式(方 / 圆)是显示'),
		bifaQuery: ex('毕法检索词是输入'),
	},
	taiyi: {
		tn: 'workbench',
		school: 'page',
		style: 'locked', timeBasis: 'locked', gameTheory: 'locked',
		showBoardMark: ex('盘面标注是显示'),
		sex: ex('命法性别只在命法盘式用;盘式在择日里锁定时计'),
		after23NewDay: ex('太乙判定面按绝对时辰序列积数,换日不改局(taiyiZeriDefaultOptions 注)'),
		lateZiHourUseNextDay: ex('同上:晚子时不改局'),
	},
	sanshiunited: {
		guireng: 'workbench', yueJiangMethod: 'workbench', yinyangSystem: 'workbench', paiPanType: 'workbench', qijuMethod: 'workbench',
		school: 'workbench', zhiShiType: 'workbench', kongMode: 'workbench', yimaMode: 'workbench', taiyiAccum: 'workbench', timeAlg: 'workbench',
		shuziReportNumber: 'workbench', after23NewDay: 'workbench', lateZiHourUseNextDay: 'workbench',
		zhirunLeapDays: 'workbench', yueJiaQiJuType: 'workbench', shiftPalace: 'workbench',
		...QM_SEED_KEYS.reduce((acc, k)=>{ acc[k] = 'page'; return acc; }, {}),
		...SANSHI_LR_PAGE_SCAN_KEYS.reduce((acc, k)=>{ acc[k] = 'page'; return acc; }, {}),
		...SANSHI_TY_PAGE_SCAN_KEYS.reduce((acc, k)=>{ acc[k] = 'page'; return acc; }, {}),
		taiyiStyle: 'locked', taiyiTimeBasis: 'locked', gameTheory: 'locked',
		yearShenShaSort: ex('只改六壬家右栏年神参考表与快照;择日条件的太岁神取神煞表'),
		tuWangShuai: ex('只改六壬家旺衰 / 空亡判读;择日条件不判旺衰'),
		outerCoord: ex('外圈坐标是显示'),
		showWeakSolid: ex('虚实标记是显示'),
		mode: ex('命局 / 事局只管这一盘存去哪,不改盘'),
		faRelatedPeople: ex(`法奇门相关人是${SAME_CAST}`),
		sex: ex('性别随命主'),
	},
	dunjia: {
		shuziInput: ex(`报数输入框的内容是${SAME_CAST}`),
		chartCategory: ex('盘类(事盘 / 命盘)是这一张盘的属性,择日条件不判'),
		faRelatedPeople: ex(`法奇门相关人是${SAME_CAST}`),
	},
};
const pageKeysOf = (page)=>{
	const e = PAGE_SETTINGS_REGISTRY.find((r)=>r.page === page);
	expect(e).toBeTruthy();
	return Array.from(new Set([...e.fields, ...Object.keys(e.exempt || {})]));
};
const catOf = (v)=>(Array.isArray(v) ? v[0] : v);

describe('内嵌页口径 × 扫描口径:四个内嵌页的每个可改键都表了态', ()=>{
	test.each(['liureng', 'taiyi', 'sanshiunited', 'dunjia'])('%s:未登记即红、登记表不过期、豁免必写理由', (page)=>{
		const keys = pageKeysOf(page);
		const table = EMBED_CALIBRE[page];
		const { dunjiaZeriOptions } = require('../../../components/dunjia/DunJiaMain');
		const mirrored = page === 'dunjia' ? dunjiaZeriOptions() : null;
		const unregistered = keys.filter((k)=>!(k in table) && !(mirrored && k in mirrored));
		expect(unregistered).toEqual([]);
		expect(Object.keys(table).filter((k)=>keys.indexOf(k) < 0)).toEqual([]);
		Object.keys(table).forEach((k)=>{
			const v = table[k];
			expect(['workbench', 'page', 'locked', 'exempt']).toContain(catOf(v));
			if(catOf(v) === 'exempt'){ expect(`${v[1] || ''}`.length).toBeGreaterThan(4); }
		});
	});

	test('奇门择日:工作台参数整份镜像自内嵌奇门页(镜像源 = 页面 options 全量)', ()=>{
		const t = stripComments(read('components/zeri/QimenZeriMain.js'));
		expect(t).toMatch(/out\.draftOptions = \{ \.\.\.ctx\.options \};/);
	});

	test('登记表与代码里的单源表一致(page / locked 两类)', ()=>{
		const pick = (page, cat)=>Object.keys(EMBED_CALIBRE[page]).filter((k)=>catOf(EMBED_CALIBRE[page][k]) === cat).sort();
		expect(pick('liureng', 'page')).toEqual([...LIURENG_PAGE_SCAN_KEYS].sort());
		expect(pick('liureng', 'locked')).toEqual(Object.keys(LIURENG_ZERI_LOCKED).sort());
		// 页面口径键全数登记(表里的键另核必须是该页真实的设置键:多登记一个死键 = 红)
		expect(pick('taiyi', 'page')).toEqual([...TAIYI_PAGE_SCAN_KEYS].sort());
		expect(pick('sanshiunited', 'page')).toEqual([...new Set([...QM_SEED_KEYS, ...SANSHI_LR_PAGE_SCAN_KEYS, ...SANSHI_TY_PAGE_SCAN_KEYS])].sort());
		expect(pick('taiyi', 'locked')).toEqual(Object.keys(TAIYI_ZERI_LOCKED).sort());
		expect(pick('sanshiunited', 'locked')).toEqual(Object.keys(SANSHI_ZERI_LOCKED).sort());
	});

	// 点结果行的回写:workbench / page / locked 每一个键都写回内嵌页
	const HOSTS = {
		liureng: { file: '../../../components/zeri/LiurengZeriMain', hook: 'liurengHook', apply: 'applyCastFields', getter: 'getCastOptions' },
		taiyi: { file: '../../../components/zeri/TaiyiZeriMain', hook: 'taiyiHook', apply: 'applyOptions', getter: 'getOptions' },
		sanshiunited: { file: '../../../components/zeri/SanshiZeriMain', hook: 'sanshiHook', apply: 'applyOptions', getter: 'getOptions' },
	};
	// 页面键名 → 工作台键名(只有这几个改了名)
	const WB_NAME = { guireng: 'guirengType', yueJiangMethod: 'yueMode' };
	const SAMPLE = { guireng: 1, yueJiangMethod: 'jieqi', yinyangSystem: 'yinyang', paiPanType: 1, qijuMethod: 'chaibu', school: '飞盘', zhiShiType: 1, kongMode: 'hour', yimaMode: 'hour', taiyiAccum: 2, timeAlg: 1, shuziReportNumber: '7', after23NewDay: 0, lateZiHourUseNextDay: 0, tn: 1, zhirunLeapDays: 10, yueJiaQiJuType: 1, shiftPalace: 2 };
	const pageSample = (k)=>{
		if(k === 'school' || k === 'taiyiSchool'){ return { zhuSuan: 'x' }; }
		if(typeof SAMPLE[k] !== 'undefined'){ return SAMPLE[k]; }
		return `v_${k}`;
	};
	test.each(Object.keys(HOSTS))('%s:开始择时取页面键、点结果行回写全部 workbench / page / locked 键', async (page)=>{
		const spec = HOSTS[page];
		const Host = require(spec.file).default;
		const table = EMBED_CALIBRE[page];
		const keys = Object.keys(table);
		const pageKeys = keys.filter((k)=>catOf(table[k]) === 'page');
		const pageVals = {};
		pageKeys.forEach((k)=>{ pageVals[k] = pageSample(k); });
		// 页面取值:sanshi 奇门家经 getQimenOptions,六壬 / 太乙家经 getOptions
		const hook = { [spec.getter]: ()=>({ ...pageVals }) };
		if(page === 'sanshiunited'){ hook.getQimenOptions = ()=>({ ...pageVals }); }
		const wbOptions = {};
		keys.filter((k)=>catOf(table[k]) === 'workbench').forEach((k)=>{ wbOptions[WB_NAME[k] || k] = SAMPLE[k]; });
		const fake = { state: { options: wbOptions }, [spec.hook]: hook };
		Object.getOwnPropertyNames(Host.prototype).forEach((n)=>{ if(n !== 'constructor' && typeof Host.prototype[n] === 'function'){ fake[n] = Host.prototype[n].bind(fake); } });
		const eff = fake.effectiveScanOptions();
		pageKeys.forEach((k)=>{ expect([k, eff[k]]).toEqual([k, pageVals[k]]); });
		let got = null;
		hook[spec.apply] = async (p)=>{ got = p; };
		fake._scanOptions = eff;
		await fake.applyWorkbenchCalibre();
		const missing = keys.filter((k)=>['workbench', 'page', 'locked'].indexOf(catOf(table[k])) >= 0 && !(k in got));
		expect(missing).toEqual([]);
		pageKeys.forEach((k)=>{ expect(got[k]).toEqual(pageVals[k]); });
	});

	test('锁定的控件在内嵌页里置灰,宿主把锁定表交给内嵌页;锁定判据带控件当前值(与控件 value 同一表达式)', ()=>{
		// horosa_win_slice_form_v1(Windows 侧移植适配):六壬 / 三式合一的左栏在我方渲染切片里是子组件,切片内 this 不是宿主,
		// 存案标记经 props 进入。两种切片形与上游原形三形皆认:
		//   上游原形   zeriLockProps(this.props.zeriLocked, 'k', V, this._zeriRestoredLocks)(TaiYiMain 等未切片宿主)
		//   类切片形   zeriLockProps(this.props.zeriLocked, 'k', V, this.props.zeriRestoredLocks)(三式合一 horosa_sanshi_render_slice_v1)
		//   函数局部形 const L = zeriLockProps(p.zeriLocked, 'k', p.X, p.zeriRestoredLocks); … title={L.title} … value={p.X} … disabled={!!L.disabled}
		//              (六壬 horosa_liureng_render_slice_v1 的 LiuRengInputPanel)
		// 判据零放宽:第三参仍须与同一行 Select 的 value 逐字相同、第四参仍须是存案标记、title 与 disabled 同一判据;两种切片形另钉
		// 宿主把原值交给切片(zeriLocked={this.props.zeriLocked} / zeriRestoredLocks={this._zeriRestoredLocks};局部形再钉 X={this.state.k})。
		const hostWired = (t)=>t.indexOf('zeriLocked={this.props.zeriLocked}') >= 0 && t.indexOf('zeriRestoredLocks={this._zeriRestoredLocks}') >= 0;
		const sliceLockedForm = (t, k)=>{
			const d = t.match(new RegExp(`const (\\w+) = zeriLockProps\\(p\\.zeriLocked, '${k}', p\\.(\\w+), p\\.zeriRestoredLocks\\);`));
			if(!d){ return false; }   // 认不出局部形 → 照走上游原判据(原样红)
			const lock = d[1];
			const prop = d[2];
			expect([k, new RegExp(`value=\\{p\\.${prop}\\}[^\\n]*?disabled=\\{!!${lock}\\.disabled\\}`).test(t)]).toEqual([k, true]);
			expect([k, t.indexOf(`title={${lock}.title}`) >= 0]).toEqual([k, true]);
			expect([k, t.indexOf(`${prop}={this.state.${k}}`) >= 0, hostWired(t)]).toEqual([k, true, true]);
			return true;
		};
		const lockedIn = (file, keys)=>{
			const t = read(file);
			keys.forEach((k)=>{
				// 同一行 <Select … value={V} … disabled={!!zeriLockProps(this.props.zeriLocked, 'k', V, 标记).disabled}>:V 两处逐字相同;
				// 第四参 = 本页载入存案时记下的显式存案标记(不再按「值不等」推定来自存案)
				const re = new RegExp(`value=\\{([^{}]*)\\}[^\\n]*?disabled=\\{!!zeriLockProps\\(this\\.props\\.zeriLocked, '${k}', ([^,{}]*), (this\\._zeriRestoredLocks|this\\.props\\.zeriRestoredLocks)\\)\\.disabled\\}`);
				const m = t.match(re);
				if(!m && sliceLockedForm(t, k)){ return; }
				expect([k, !!m]).toEqual([k, true]);
				expect([k, m[2].trim()]).toEqual([k, m[1].trim()]);
				// 悬停说明同一判据(载入存案时的提示)
				expect([k, t.indexOf(`title={zeriLockProps(this.props.zeriLocked, '${k}', ${m[2].trim()}, ${m[3]}).title}`) >= 0]).toEqual([k, true]);
				if(m[3] !== 'this._zeriRestoredLocks'){ expect([k, hostWired(t)]).toEqual([k, true]); }
			});
			// 全文件不许有不带当前值 / 不带存案标记的锁定判据
			expect(t.match(/zeriLockProps\(this\.props\.zeriLocked, '\w+'\)/g)).toBe(null);
			// 存案标记只在载入存案时置(zeriRestoredLockMarks),回写锁定值时清(clearZeriLockMarks)
			expect(t).toMatch(/this\._zeriRestoredLocks = zeriRestoredLockMarks\(this\.props\.zeriLocked, /);
			expect(t).toMatch(/this\._zeriRestoredLocks = clearZeriLockMarks\(this\._zeriRestoredLocks, /);
		};
		lockedIn('components/lrzhan/LiuRengMain.js', Object.keys(LIURENG_ZERI_LOCKED));
		lockedIn('components/taiyi/TaiYiMain.js', Object.keys(TAIYI_ZERI_LOCKED));
		lockedIn('components/sanshi/SanShiUnitedMain.js', Object.keys(SANSHI_ZERI_LOCKED));
		expect(read('components/zeri/LiurengZeriMain.js')).toContain('zeriLocked={LIURENG_ZERI_LOCKED}');
		expect(read('components/zeri/TaiyiZeriMain.js')).toContain('zeriLocked={TAIYI_ZERI_LOCKED}');
		expect(read('components/zeri/SanshiZeriMain.js')).toContain('zeriLocked={SANSHI_ZERI_LOCKED}');
	});
});

describe('锁定控件 × 锁定之前存的存案', ()=>{
	const { zeriLockProps, zeriRestoredLockMarks, clearZeriLockMarks, LIURENG_ZERI_LOCKED, TAIYI_ZERI_LOCKED, SANSHI_ZERI_LOCKED } = require('../zeriPageCalibre');
	test.each([['六壬', LIURENG_ZERI_LOCKED, 'castMethod', 'yanshu'], ['太乙', TAIYI_ZERI_LOCKED, 'style', 1], ['太乙', TAIYI_ZERI_LOCKED, 'timeBasis', 'trueSolar'], ['太乙', TAIYI_ZERI_LOCKED, 'gameTheory', 1],
		['三式', SANSHI_ZERI_LOCKED, 'taiyiStyle', 1], ['三式', SANSHI_ZERI_LOCKED, 'taiyiTimeBasis', 'trueSolar'], ['三式', SANSHI_ZERI_LOCKED, 'gameTheory', 1]])('%s %s:当前值 = 锁定值置灰;载入存案复原来的别的值(有存案标记)→ 解锁并悬停说明;没有标记的别的值 → 照样锁定', (_n, table, key, other)=>{
		const on = zeriLockProps(table, key, table[key].value, null);
		expect(on.disabled).toBe(true);
		expect(on.title).toBe(table[key].hint);
		const marks = zeriRestoredLockMarks(table, { [key]: other });
		expect(marks).toEqual({ [key]: true });
		const off = zeriLockProps(table, key, other, marks);
		expect(off.disabled).toBe(false);
		expect(off.title).toContain('存案');
		expect(off.title).toContain(table[key].label);
		// 没有存案标记:别的入口把值改掉 ≠ 存案复原 —— 锁定、不挂「由存案复原」
		const stray = zeriLockProps(table, key, other, null);
		expect(stray.disabled).toBe(true);
		expect(stray.title).toBe(table[key].hint);
		expect(stray.restoredMismatch).toBeUndefined();
		// 有标记但值已回到锁定值 → 锁定;回写过该键 → 标记清掉
		expect(zeriLockProps(table, key, table[key].value, marks).disabled).toBe(true);
		expect(clearZeriLockMarks(marks, { [key]: table[key].value })).toBeNull();
		expect(zeriRestoredLockMarks(table, { [key]: table[key].value })).toBeNull();
		// 没锁的页面(独立技法页)/ 没登记的键:一律不锁
		expect(zeriLockProps(null, key, other)).toEqual({});
		expect(zeriLockProps(table, 'notLocked', other)).toEqual({});
	});
	test('每个锁定项都写了扫描口径名(悬停提示要用)', ()=>{
		[LIURENG_ZERI_LOCKED, TAIYI_ZERI_LOCKED, SANSHI_ZERI_LOCKED].forEach((t)=>Object.keys(t).forEach((k)=>{ expect([k, `${t[k].label || ''}`.length > 0]).toEqual([k, true]); }));
	});
});

describe('page 键的扫描结果 = 按页面起课链算出的那一课(非缺省值逐个核)', ()=>{
	const { computeLiurengScanPan } = require('../liurengZeriScanEngine');
	const { buildLrChartLite } = require('../liurengLocal');
	const { buildLiuRengLayout, buildKeData, buildSanChuanData, buildLiuRengCastOverride } = require('../../../components/lrzhan/LiuRengMain');
	const AstroConst = require('../../../constants/AstroConst');
	const LRConst = require('../../../components/liureng/LRConst');
	const GEO = { zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9, ad: 1, gender: 1 };
	const WB = { guirengType: 0, yueMode: 'zhongqi', after23NewDay: 1, lateZiHourUseNextDay: 1 };
	// 页面起课链:同一时刻的底盘(太阳宫位按月将反推)+ 六壬页 buildLiuRengCastOverride(页面口径)+ 同一组排盘函数
	function pageChain(opts, ds, ts){
		const base = buildLrChartLite(GEO, opts, ds, ts);
		const sign = AstroConst.LIST_SIGNS[LRConst.SignZiList.indexOf(base.yue)];
		const chart = { ...base.chartLite, objects: [{ id: AstroConst.SUN, sign }] };
		const co = buildLiuRengCastOverride(chart, { yueJiangMethod: 'zhongqi', yinyangSystem: 'danmu', castMethod: 'zheng', ...opts });
		const layout = buildLiuRengLayout(chart, Number(opts.guirengType || 0), co);
		const ke = buildKeData(layout, chart);
		const sc = buildSanChuanData(layout, ke.raw, chart, co);
		return JSON.stringify([sc.name, sc.cuang, layout.guizi]);
	}
	const scanOf = (opts, ds, ts)=>{ const p = computeLiurengScanPan(GEO, opts, ds, ts); return JSON.stringify([p.sanChuan.name, p.sanChuan.cuang, p.layout.guizi]); };
	// 第三列 = 该键起作用的前提(涉害起讫只在标准深浅两向下计数),判别力按「前提 vs 前提 + 该值」比
	const CASES = [['fenZhouYe', 'maoyou', {}, []], ['fenZhouYe', 'yinshen', {}, []], ['seHaiMethod', 'standard', {}, []], ['seHaiMethod', 'mengzhongji', {}, []],
		// 两端皆计改课的时刻稀(约两月一次),补进已知会变的时刻
		['seHaiBoundary', 'both', { seHaiMethod: 'standard' }, ['2026-02-22 21:10', '2026-04-23 17:10', '2026-06-22 13:10']],
		['seHaiBoundary', 'neither', { seHaiMethod: 'standard' }, []], ['shiRuKe', true, {}, []]];
	test('登记的 page 键都在本表里核过', ()=>{
		expect(Array.from(new Set(CASES.map((c)=>c[0]))).sort()).toEqual([...LIURENG_PAGE_SCAN_KEYS].sort());
	});
	test.each(CASES)('%s = %s:扫描与页面起课逐时刻同一课,且该值确实改变了部分时刻的课(有判别力)', (k, v, pre, extra)=>{
		let diffFromDefault = 0;
		const samples = [];
		for(let d = 1; d <= 40; d += 1){
			const day = d <= 28 ? `2026-01-${String(d).padStart(2, '0')}` : `2026-02-${String(d - 28).padStart(2, '0')}`;
			for(let h = 1; h < 24; h += 4){ samples.push([day, `${String(h).padStart(2, '0')}:10`]); }
		}
		extra.forEach((t)=>samples.push(t.split(' ')));
		samples.forEach(([day, ts])=>{
			const opts = { ...WB, ...pre, [k]: v };
			expect([day, ts, scanOf(opts, day, ts)]).toEqual([day, ts, pageChain(opts, day, ts)]);
			if(scanOf(opts, day, ts) !== scanOf({ ...WB, ...pre }, day, ts)){ diffFromDefault += 1; }
		});
		expect(diffFromDefault).toBeGreaterThan(0);
	});
});

// ── 日界 / 晚子时缺键回落:AST 判据(上面那条正则只认一种写法)──
// 认这些写法:属性取值是字面量 / 条件式的回落支是字面量 / `||` `??` 右侧字面量 / 两支都是字面量的归一(=== 1 ? 1 : 0)/
// 工作台显示缺省 dv 字面量 / 带后置展开的缺省对象里的字面量(`{ lateZi: 'zi_chu', ...opts }`)。
// 扫描面 = 择日两目录 + 择日引用到的技法引擎文件(由上面 PARITY 表的 from 列自动导出)。
// 紫微晚子时方案的定义表(方案名 → 两键)不是回落,按函数名豁免;lateZi 的显式方案选择(不带展开)不算回落。
const DB_KEYS = new Set(['after23NewDay', 'lateZiHourUseNextDay', 'lateZi']);
const DB_VAR_RE = /^(after23NewDay|lateZiHourUseNextDay|lateZi|lateZiUseNextDay)$/;
const DB_FN_RE = /after23|latezi/i;
// 方案 / 全局设置的定义处(档名 → 0 / 1 的映射本身,不是回落):ZiweiCalc 晚子时三方案;dayBoundary 全局日界单源
const DB_ALLOWED_FUNCS = new Set(['lateZiParams', 'dayBoundaryToAfter23NewDay', 'lateZiHourModeToBit']);
// 已知未修的回落(缺键时回 0 / 1,而不是全局现值)登记处:现为空。
// 新出现的写死回落不许往这里加,改成取全局单源(defaultAfter23NewDay / defaultLateZiHourUseNextDay)。
const DB_PENDING = [];	// 全部已改走 dayBoundaryResolve 单源(清零;新出现的写死回落直接红)
function dbIsLit(n){ return !!n && (n.type === 'NumericLiteral' || n.type === 'BooleanLiteral' || (n.type === 'StringLiteral' && n.value !== 'global')); }
function dbFallbackLit(v){
	if(!v){ return false; }
	if(dbIsLit(v)){ return true; }
	if(v.type === 'ConditionalExpression'){ return dbIsLit(v.alternate) || (dbIsLit(v.consequent) && dbFallbackLit(v.alternate)); }
	if(v.type === 'LogicalExpression' && (v.operator === '||' || v.operator === '??')){ return dbIsLit(v.right); }
	return false;
}
function dayBoundaryLiteralSites(rel, sourceText){
	const text = sourceText !== undefined ? sourceText : fs.readFileSync(path.join(SRC, rel), 'utf8');
	const ast = astOf(text);
	const out = [];
	const snip = (n)=>text.slice(n.start, n.end).replace(/\s+/g, ' ').trim();
	const visit = (n, fnName)=>{
		if(!n || typeof n.type !== 'string'){ return; }
		let fn = fnName;
		if(n.type === 'FunctionDeclaration' && n.id){ fn = n.id.name; }
		if((n.type === 'ClassMethod' || n.type === 'ObjectMethod') && n.key){ fn = n.key.name; }
		if(n.type === 'VariableDeclarator' && n.id && n.id.type === 'Identifier' && n.init && /Function/.test(n.init.type)){ fn = n.id.name; }
		if(!DB_ALLOWED_FUNCS.has(fn)){
			if(n.type === 'ObjectExpression'){
				const hasSpreadAfter = (i)=>n.properties.slice(i + 1).some((p)=>p.type === 'SpreadElement');
				n.properties.forEach((p, i)=>{
					if(p.type !== 'ObjectProperty' || !p.key){ return; }
					const k = p.key.name || p.key.value;
					if(!DB_KEYS.has(k)){ return; }
					const v = p.value;
					const fallbackish = v.type === 'ConditionalExpression' || v.type === 'LogicalExpression';
					if((fallbackish && dbFallbackLit(v)) || (dbIsLit(v) && (k !== 'lateZi' || hasSpreadAfter(i)))){ out.push(snip(p)); }
				});
				const kp = n.properties.find((p)=>p.type === 'ObjectProperty' && p.key && p.key.name === 'key' && p.value && p.value.type === 'StringLiteral' && DB_KEYS.has(p.value.value));
				const dv = n.properties.find((p)=>p.type === 'ObjectProperty' && p.key && p.key.name === 'dv');
				if(kp && dv && dbIsLit(dv.value)){ out.push(`dv ${kp.value.value}=${snip(dv.value)}`); }
			}
			if(n.type === 'VariableDeclarator' && n.id && n.id.type === 'Identifier' && DB_VAR_RE.test(n.id.name) && n.init && (n.init.type === 'ConditionalExpression' || n.init.type === 'LogicalExpression') && dbFallbackLit(n.init)){ out.push(snip(n)); }
			if(n.type === 'ReturnStatement' && fn && DB_FN_RE.test(fn) && n.argument && n.argument.type === 'ConditionalExpression' && dbFallbackLit(n.argument)){ out.push(snip(n).replace(/;$/, '')); }
		}
		Object.keys(n).forEach((k)=>{
			if(k === 'loc'){ return; }
			const c = n[k];
			if(Array.isArray(c)){ c.forEach((x)=>visit(x, fn)); } else if(c && typeof c === 'object' && typeof c.type === 'string'){ visit(c, fn); }
		});
	};
	visit(ast.program, '');
	return out.map((s)=>`${rel}::${s}`);
}
function dayBoundaryScanFiles(){
	const set = new Set(zeriFiles());
	PARITY.forEach((r)=>{
		if(!/^\.\.?\//.test(r.from)){ return; }
		const base = path.join(path.dirname(rel(r.file)), r.from);
		const f = fs.existsSync(`${base}.js`) ? `${base}.js` : (fs.existsSync(path.join(base, 'index.js')) ? path.join(base, 'index.js') : null);
		// horosa_win_pathsep_posix_v1(Windows 侧移植适配;建议上游化):`path.relative` 在 Windows 返回反斜杠分隔
		// (`components\dunjia\DunJiaCalc.js`),而 zeriFiles() 与下方期望表 / DB_PENDING 都是 POSIX 写法 ⇒ 技法引擎
		// 「不在扫描面」、同一文件以两种写法各进 Set 一次(macOS 恒绿)。归一到 POSIX 再入集合;扫描面零变化。
		if(f){ set.add(path.relative(SRC, f).split(path.sep).join('/')); }
	});
	return Array.from(set);
}

describe('择日 · 日界 / 晚子时缺键回落(AST 判据,含择日引用的技法引擎)', ()=>{
	const files = dayBoundaryScanFiles();
	const hits = files.reduce((acc, f)=>acc.concat(dayBoundaryLiteralSites(f)), []);
	test('扫描面含择日引用到的技法引擎(PARITY from 列导出)', ()=>{
		['components/dunjia/DunJiaCalc.js', 'components/taiyi/TaiYiCalc.js', 'components/ziwei/ZiweiCalc.js', 'utils/baziLunarLocal.js', 'components/sanshi/SanShiUnitedMain.js'].forEach((f)=>{ expect(files).toContain(f); });
	});
	test('没有写死的回落(已知未修的在 DB_PENDING 里逐条登记)', ()=>{
		expect(Array.from(new Set(hits)).filter((h)=>DB_PENDING.indexOf(h) < 0)).toEqual([]);
	});
	test('DB_PENDING 不过期:修好的那条必须从登记里删掉', ()=>{
		expect(DB_PENDING.filter((p)=>hits.indexOf(p) < 0)).toEqual([]);
	});
	test('判据自证:各种写死的回落都认得出,方案定义表与取全局不误报', ()=>{
		const probe = (code)=>dayBoundaryLiteralSites('probe.js', code).map((s)=>s.split('::')[1]);
		expect(probe("const a = calc(b, { timeAlg: 1, lateZi: 'zi_chu', ...o });")).toEqual(["lateZi: 'zi_chu'"]);
		expect(probe('const a = { after23NewDay: 1 };')).toEqual(['after23NewDay: 1']);
		expect(probe("const f = [{ key: 'lateZiHourUseNextDay', dv: 1 }];")).toEqual(['dv lateZiHourUseNextDay=1']);
		expect(probe('const a = { after23NewDay: o.after23NewDay === 1 ? 1 : 0, lateZiHourUseNextDay: o.lateZiHourUseNextDay || 0, x: 1 };')).toEqual(['after23NewDay: o.after23NewDay === 1 ? 1 : 0', 'lateZiHourUseNextDay: o.lateZiHourUseNextDay || 0']);
		expect(probe('const a = { after23NewDay: o.after23NewDay ?? 1 };')).toEqual(['after23NewDay: o.after23NewDay ?? 1']);
		expect(probe("const a = { after23NewDay: o.after23NewDay !== undefined ? o.after23NewDay : defaultAfter23NewDay(), lateZi: o.lateZi !== undefined ? o.lateZi : 'global' };")).toEqual([]);
		expect(probe('function lateZiParams(z){ return { after23NewDay: 1, lateZiHourUseNextDay: 1 }; }')).toEqual([]);
		expect(probe("const c = calcZiwei(b, { ...o, lateZi: 'zi_zheng' });")).toEqual([]);
	});
});
