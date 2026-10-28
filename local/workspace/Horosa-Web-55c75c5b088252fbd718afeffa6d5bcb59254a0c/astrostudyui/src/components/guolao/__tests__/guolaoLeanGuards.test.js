// 七政:命度取宫单一来源 / 走不到的 try / 零消费导出 / 逐字相同副本 已收掉,行为逐字不变。
import fs from 'fs';
import path from 'path';
import * as AstroConst from '../../../constants/AstroConst';
import * as guolaoData from '../guolaoData';
import * as GuoLaoChartStyle from '../GuoLaoChartStyle';
import * as guolaoMoiraTables from '../guolaoMoiraTables';
import * as guolaoTransit from '../guolaoTransit';
import * as moiraWheelLayout from '../moiraWheelLayout';
import { moiraFormatGodName, moiraNormDegree, moiraStemBranchForYear } from '../GuoLaoMoiraWheel';
import GLSZSignChart from '../GLSZSignChart';
import GuoLaoNatalChart from '../GuoLaoNatalChart';
const { readSource, sourceSetFiles } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const DIR = path.resolve(__dirname, '..');
const raw = (f) => readSource(path.join(DIR, f));
const { fileImportsName } = require('../../../utils/__tests__/helpers/importSpecs');   // 按 AST 读 import:同一条里多导几个名字 / 换行排版都照认
// 门面按「门面 + 子模块」全集逐个文件问:任一文件从 GuoLaoMoiraWheel 导入了 name(本地名 as)即认
const setImports = (f, name, as) => sourceSetFiles(path.join(DIR, f)).some((file) => fileImportsName(file, { name, as, target: path.join(DIR, 'GuoLaoMoiraWheel') }));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const { lifeMasterSignOf } = guolaoData;

const lifeObj = (lon) => ({ objects: [{ id: AstroConst.SUN, lon: 1 }, { id: AstroConst.LIFEMASTERDEG74, lon }] });
const mode = (v) => ({ guolaoLifeMode: { value: v } });

describe('命度取宫 lifeMasterSignOf(方盘 / 圆盘同源)', () => {
	test('占星上升 / 缺档 → null(调用方回落上升点)', () => {
		expect(lifeMasterSignOf(mode('asc'), lifeObj(45))).toBe(null);
		expect(lifeMasterSignOf({}, lifeObj(45))).toBe(null);
		expect(lifeMasterSignOf(null, lifeObj(45))).toBe(null);
	});
	test('非上升档:命度黄经所在星座(含负值 / 越 360)', () => {
		expect(lifeMasterSignOf(mode('yumao'), lifeObj(45))).toBe(AstroConst.LIST_SIGNS[1]);
		expect(lifeMasterSignOf(mode('gumao'), lifeObj(0))).toBe(AstroConst.LIST_SIGNS[0]);
		expect(lifeMasterSignOf(mode('cotrans'), lifeObj(-10))).toBe(AstroConst.LIST_SIGNS[11]);
		expect(lifeMasterSignOf(mode('yumao'), lifeObj(725))).toBe(AstroConst.LIST_SIGNS[0]);
		expect(lifeMasterSignOf(mode('yumao'), lifeObj('359.9'))).toBe(AstroConst.LIST_SIGNS[11]);
	});
	test('盘上无命度 / 经度非数 / 盘缺 → null', () => {
		expect(lifeMasterSignOf(mode('yumao'), { objects: [{ id: AstroConst.SUN, lon: 1 }] })).toBe(null);
		expect(lifeMasterSignOf(mode('yumao'), lifeObj('abc'))).toBe(null);
		expect(lifeMasterSignOf(mode('yumao'), null)).toBe(null);
		expect(lifeMasterSignOf(mode('yumao'), { objects: null })).toBe(null);
		expect(lifeMasterSignOf(mode('yumao'), { objects: [null, { id: AstroConst.LIFEMASTERDEG74, lon: 95 }] })).toBe(AstroConst.LIST_SIGNS[3]);
	});
	test('方盘 / 圆盘的 getLifeMasterSign 都转给 lifeMasterSignOf,不再各写一份', () => {
		const ctx = { fields: mode('yumao'), chartObj: lifeObj(200) };
		expect(GLSZSignChart.prototype.getLifeMasterSign.call(ctx)).toBe(AstroConst.LIST_SIGNS[6]);
		expect(GuoLaoNatalChart.prototype.getLifeMasterSign.call(ctx)).toBe(AstroConst.LIST_SIGNS[6]);
		['GLSZSignChart.js', 'GuoLaoNatalChart.js'].forEach((f) => {
			const src = strip(raw(f));
			expect(`${f}:${src.includes('return lifeMasterSignOf(this.fields, this.chartObj);')}`).toBe(`${f}:true`);
			expect(`${f}:${src.includes('LIFEMASTERDEG74')}`).toBe(`${f}:false`);
		});
	});
});

describe('GuoLaoChartMain:偏好落盘 / 卸载', () => {
	test('safeLocalStorageSet 与 unregisterStepPrefetcher 不再包 try', () => {
		const src = strip(raw('GuoLaoChartMain.js'));
		expect(src).toContain('safeLocalStorageSet(GUOLAO_ENGINE_STORAGE_KEY, next);');
		expect(src).toContain('safeLocalStorageSet(GUOLAO_KIN_OPTIONS_STORAGE_KEY, JSON.stringify(next));');
		expect(src).not.toMatch(/try\s*\{\s*safeLocalStorageSet\(/);
		expect(src).toContain("unregisterStepPrefetcher('guolao', this._guolaoStepPrefetcher);");
		expect(src).not.toMatch(/try\s*\{\s*unregisterStepPrefetcher\(/);
	});
});

describe('零消费导出已删', () => {
	test.each([
		['GuoLaoChartStyle', GuoLaoChartStyle, ['GUOLAO_LIFE_MODE_CUSTOM', 'hasStoredGuolaoSu28Mode', 'GUOLAO_LIMIT_CHILD_BASES']],
		['guolaoData', guolaoData, ['EQUATORIAL_TOTAL_DEGREE', 'QINTANG_DIR_OPTIONS']],
		['guolaoMoiraTables', guolaoMoiraTables, ['LIFE_HELPER_ALT_LABELS']],
		['guolaoTransit', guolaoTransit, ['TONGXIAN_BASE_DEFAULT']],
		['moiraWheelLayout', moiraWheelLayout, ['MOIRA_HUB_POS_ASPECTS']],
	])('%s', (_name, mod, gone) => {
		gone.forEach((k) => expect(`${k}:${k in mod}`).toBe(`${k}:false`));
	});
	test('相邻在用的仍在(LIFE_HELPER_LABELS / GUOLAO_LIMIT_YEAR_BOUNDARIES / ASPECTS_RING_POS_13)', () => {
		expect(guolaoMoiraTables.LIFE_HELPER_LABELS).toEqual(['难', '仇', '恩', '用']);
		expect(GuoLaoChartStyle.GUOLAO_LIMIT_YEAR_BOUNDARIES).toEqual(['gregorian', 'lichun', 'dongzhi']);
		expect(moiraWheelLayout.ASPECTS_RING_POS_13[0]).toBe(0.38);
	});
	test('MoiraPanel 不再有未调用的 joinYearItems', () => {
		expect(strip(raw('GuoLaoMoiraPanel.js'))).not.toMatch(/\bjoinYearItems\b/);
	});
});

// 收口前的副本逐字搬来作对照
function legacyFormatGodName(name){
	let val = `${name || ''}`.replace(/\s+/g, '');
	if(!val){
		return '';
	}
	val = val.split(/[\/／]/)[0];
	const aliases = { 天乙贵人: '天贵', 玉堂贵人: '玉贵' };
	return aliases[val] || val;
}
function legacyNorm(deg){
	let val = Number(deg);
	if(!Number.isFinite(val)){
		return 0;
	}
	val %= 360;
	if(val < 0){
		val += 360;
	}
	return val;
}
const LEGACY_SB = (() => { const g = '甲乙丙丁戊己庚辛壬癸'; const z = '子丑寅卯辰巳午未申酉戌亥'; return Array.from({ length: 60 }, (_, i) => g[i % 10] + z[i % 12]); })();
function legacyStemBranchForYear(year){
	const idx = ((Number(year) - 1984) % 60 + 60) % 60;
	return LEGACY_SB[idx] || '';
}

describe('Moira 小工具单一来源(GuoLaoMoiraWheel 导出,面板 / 主页引用)', () => {
	test('moiraFormatGodName / moiraNormDegree / moiraStemBranchForYear 与原副本逐值相同', () => {
		['天乙贵人', ' 玉堂 贵人 ', '天德/月德', '驿马／劫煞', '', null, undefined, 0, '文昌'].forEach((v) => {
			expect(moiraFormatGodName(v)).toBe(legacyFormatGodName(v));
		});
		[0, 30.5, 359.99, 360, 725, -1, -721, 'x', null, Infinity].forEach((v) => {
			expect(moiraNormDegree(v)).toBe(legacyNorm(v));
		});
		[1984, 2026, 1900, -1, 0, 3000, '2000', 'abc'].forEach((v) => {
			expect(moiraStemBranchForYear(v)).toBe(legacyStemBranchForYear(v));
		});
	});
	test('面板 / 主页不再各带 formatGodName / norm / stemBranchForYear / 干支表', () => {
		const panel = strip(raw('GuoLaoMoiraPanel.js'));
		[['moiraNormDegree', 'norm'], ['moiraStemBranchForYear', 'stemBranchForYear'], ['moiraFormatGodName', 'formatGodName']].forEach(([name, as]) => {
			expect(`${name}:${setImports('GuoLaoMoiraPanel.js', name, as)}`).toBe(`${name}:true`);
		});
		expect(panel).not.toMatch(/\bfunction (formatGodName|norm|stemBranchForYear)\s*\(/);
		expect(panel).not.toMatch(/\bSTEM_BRANCHES\b/);
		const main = strip(raw('GuoLaoChartMain.js'));
		// 主页的模块级助手已拆进 main/(全集读):引用落在 main/format.js,路径多一层
		expect(setImports('GuoLaoChartMain.js', 'moiraFormatGodName', 'formatGodName')).toBe(true);
		expect(main).not.toMatch(/\bfunction formatGodName\s*\(/);
	});
});
