// 紫微:走不到的 try / 零消费导出 / 死文件 已收掉,行为逐字不变。
// 行为断言钉「输出照旧」(含经 ZWEngineOptions 单例翻档);源码断言钉「不再长回来」。
import fs from 'fs';
import path from 'path';
import * as ZiWeiHelper from '../ZiWeiHelper';
import * as ziweiSchools from '../ziweiSchools';
import { ZWEngineOptions } from '../ziweiOptions';
import { notifyZiweiTempOverrideRestored, ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT } from '../ziweiTempOverrideScope';

const DIR = path.resolve(__dirname, '..');
const raw = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
// 取某函数体(花括号配对)
function fnBody(src, name){
	const i = src.indexOf(`function ${name}(`);
	if(i < 0){ return null; }
	let depth = 0;
	let j = src.indexOf('{', i);
	for(; j < src.length; j++){
		if(src[j] === '{'){ depth++; }
		else if(src[j] === '}'){ depth--; if(depth === 0){ break; } }
	}
	return src.slice(i, j + 1);
}

const SAVED = { ...ZWEngineOptions };
afterEach(() => { Object.assign(ZWEngineOptions, SAVED); });

describe('Helper 取数 / 开关读取:行为照旧', () => {
	test('dayGanOf 三形状 + 全缺', () => {
		expect(ZiWeiHelper.dayGanOf({ fourColumns: { day: { ganZhi: '丁卯' } } })).toBe('丁');
		expect(ZiWeiHelper.dayGanOf({ fourColumns: { day: {} }, bazi: { dayGanZi: '乙丑' } })).toBe('乙');
		expect(ZiWeiHelper.dayGanOf({ bazi: { bazi: { day: { ganzi: '丙寅' } } } })).toBe('丙');
		expect(ZiWeiHelper.dayGanOf({ fourColumns: 'x', bazi: 5 })).toBe(null);
		expect(ZiWeiHelper.dayGanOf(undefined)).toBe(null);
	});
	test('effLayerSihuaGan:两档 + 宫干缺失回落流年干', () => {
		const houses = Array.from({ length: 12 }, () => ({ ganzi: '甲子' }));
		houses[3] = { ganzi: '癸亥' };
		const layer = { key: 'liunian', gan: '丙', mingIndex: 3 };
		expect(ZiWeiHelper.effLayerSihuaGan({ houses }, layer)).toBe('丙');
		ZWEngineOptions.liunianSihuaGan = 'ming_gong_gan';
		expect(ZiWeiHelper.effLayerSihuaGan({ houses }, layer)).toBe('癸');
		expect(ZiWeiHelper.effLayerSihuaGan(null, layer)).toBe('丙');
		expect(ZiWeiHelper.effLayerSihuaGan({ houses }, { key: 'liunian', gan: '丙', mingIndex: 99 })).toBe('丙');
		expect(ZiWeiHelper.effLayerSihuaGan({ houses }, { key: 'daxian', gan: '戊', sihuaGan: '己' })).toBe('己');
		expect(ZiWeiHelper.effLayerSihuaGan({ houses }, null)).toBe(null);
	});
	test('流年神煞上盘:关 → 原引用;开 → 替换将前 / 岁前', () => {
		const smalls = [{ name: '博士' }, { name: '将星' }, { name: '岁建' }];
		expect(ZiWeiHelper.resolveSmallStarsForDisplay(smalls, '子', '子')).toBe(smalls);
		ZWEngineOptions.flowShenshaOnChart = true;
		const out = ZiWeiHelper.resolveSmallStarsForDisplay(smalls, '子', '子');
		expect(out).not.toBe(smalls);
		expect(out[0]).toBe(smalls[0]);
		expect(out[1]).toMatchObject({ flow: true, natal: '将星' });
		expect(out[2]).toMatchObject({ flow: true, natal: '岁建' });
	});
	test('流鸾流喜 / 流年火铃:跟随单例开关', () => {
		const names = (arr) => arr.map((x) => x.name);
		const base = names(ZiWeiHelper.getFlowStars('甲', '子', '午'));
		expect(base).not.toContain('流鸾');
		expect(base).not.toContain('流火');
		ZWEngineOptions.flowLuanXi = true;
		ZWEngineOptions.flowHuoLing = true;
		const on = names(ZiWeiHelper.getFlowStars('甲', '子', '午'));
		expect(on).toEqual(expect.arrayContaining(['流鸾', '流喜', '流火', '流铃']));
	});
	test('小限顺逆:跟随单例 xiaoxianMode', () => {
		const yinMale = { gender: 'Male', yearGan: '乙' };
		expect(ZiWeiHelper.xiaoxianClockwise(yinMale)).toBe(true);    // '0' 男顺女逆
		ZWEngineOptions.xiaoxianMode = '1';
		expect(ZiWeiHelper.xiaoxianClockwise(yinMale)).toBe(false);   // '1' 阳男阴女顺 → 阴男逆
	});
	test('源码:这几处不再包 try(惰性 require 已加载模块不会抛;&& 链取数不会抛)', () => {
		const src = strip(raw('ZiWeiHelper.js'));
		['dayGanOf', 'xiaoxianModeNow', 'zwFlowLuanXiEnabled', 'zwFlowHuoLingEnabled', 'resolveSmallStarsForDisplay', 'effLayerSihuaGan', 'bumpZwDisplayRev'].forEach((fn) => {
			const body = fnBody(src, fn);
			expect(`${fn}:${!!body}`).toBe(`${fn}:true`);
			expect(`${fn}:${/\btry\s*\{/.test(body)}`).toBe(`${fn}:false`);
		});
	});
});

describe('显示层广播:不再包 try(运行环境都有 CustomEvent;无 window 由 typeof 守卫先挡)', () => {
	test('bumpZwDisplayRev 派发带 detail 的事件', () => {
		const got = [];
		const h = (e) => got.push(e.detail);
		window.addEventListener(ZiWeiHelper.ZIWEI_DISPLAY_EVENT, h);
		ZiWeiHelper.bumpZwDisplayRev('showOthers', 1);
		window.removeEventListener(ZiWeiHelper.ZIWEI_DISPLAY_EVENT, h);
		expect(got).toEqual([{ key: 'showOthers', value: 1 }]);
	});
	test('notifyZiweiTempOverrideRestored 派发事件;函数体无 try', () => {
		let n = 0;
		const h = () => { n++; };
		window.addEventListener(ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT, h);
		notifyZiweiTempOverrideRestored();
		window.removeEventListener(ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT, h);
		expect(n).toBe(1);
		const body = fnBody(strip(raw('ziweiTempOverrideScope.js')), 'notifyZiweiTempOverrideRestored');
		expect(body).not.toMatch(/\btry\s*\{/);
	});
});

describe('ZiWeiMain:记忆键 / 卸载', () => {
	test('记忆键直接取四化表;卸载直接反注册步进预取器', () => {
		const src = strip(raw('ZiWeiMain.js'));
		expect(fnBody(src, 'localEngineMemoKey')).toContain('const table = ZWConst.getActiveSiHuaGan();');
		expect(fnBody(src, 'localEngineMemoKey')).not.toMatch(/\btry\s*\{/);
		expect(src).toContain("unregisterStepPrefetcher('ziwei', this._ziweiStepPrefetcher);");
		expect(src).not.toMatch(/try\s*\{\s*unregisterStepPrefetcher\(/);
	});
});

describe('零消费导出 / 死文件 已删', () => {
	test('Helper 不再导出 ziToHouseIndex / collectFourPalaceStars / getTripleIndices(在用的是 collectSanhePalaces / getSanheIndices)', () => {
		expect(ZiWeiHelper.ziToHouseIndex).toBeUndefined();
		expect(ZiWeiHelper.collectFourPalaceStars).toBeUndefined();
		expect(ZiWeiHelper.getTripleIndices).toBeUndefined();
		expect(typeof ZiWeiHelper.collectSanhePalaces).toBe('function');
		expect(typeof ZiWeiHelper.getSanheIndices).toBe('function');
	});
	test('ziweiSchools 不再有 flySihua;ZiweiCalc 不再有未用的 MAIN14', () => {
		expect(ziweiSchools.flySihua).toBeUndefined();
		expect(typeof ziweiSchools.sihuaOf).toBe('function');
		expect(strip(raw('ZiweiCalc.js'))).not.toMatch(/\bMAIN14\b/);
	});
	test('ZiWeiHouse.js / ZiWeiJiangStar.js 已删(全仓零 import)', () => {
		expect(fs.existsSync(path.join(DIR, 'ZiWeiHouse.js'))).toBe(false);
		expect(fs.existsSync(path.join(DIR, 'ZiWeiJiangStar.js'))).toBe(false);
	});
	test('注释与代码一致:运限文本块写的是 collectSanhePalaces;ziweiOptions 依赖说明如实', () => {
		const main = raw('ZiWeiMain.js');
		expect(main).not.toContain('collectFourPalaceStars');
		expect(main).toContain('getLayerSihua/getFlowStars/collectSanhePalaces');
		expect(raw('ZiWeiHelper.js')).not.toContain('ziweiOptions 零依赖纯常量');
	});
});
