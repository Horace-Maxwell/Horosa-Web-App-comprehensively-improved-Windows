// 三式合一「八宫逐宫」段:页面快照与无头 / 挂载重算共用 buildSanshiPalaceSections(单源),外圈两项进挂载齿轮。
import fs from 'fs';
import path from 'path';
import { buildSanshiPalaceSections } from '../SanShiUnitedMain';
import { getTechniqueSettingsSchema } from '../../../utils/techniqueMountSettings';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的门面按「子模块 + 门面」全集读(scripts/source-sets.json)

const read = (rel)=>readSource(path.join(__dirname, '..', '..', '..', rel));

const DUNJIA = {
	ganzhi: { year: '丙午', month: '己亥', day: '甲子', time: '庚午' },
	cells: [{ palaceNum: 8, tianGan: '己', god: '阴', tianXing: '辅', diGan: '壬' }],
};
const LR = { downZi: ['子', '丑'], upZi: ['酉', '戌'], houseTianJiang: ['太阴', '玄武'] };

test('八宫逐段:遁甲 / 六壬 / 外圈逐支合成;赤道分宫时第 1 宫那一支写上升取法', ()=>{
	const outer = { housesByBranch: { 子: ['1'] }, starsByBranchFull: { 子: ['月亮 9°11'] }, ascRaLine: '上升取法：经典' };
	const secs = buildSanshiPalaceSections({ dunjia: DUNJIA, lrLayout: LR, outerData: outer });
	expect(secs.map((s)=>s.title)).toEqual(['正北坎宫', '东北艮宫', '正东震宫', '东南巽宫', '正南离宫', '西南坤宫', '正西兑宫', '西北乾宫']);
	const kan = secs[0].body;
	expect(kan[0]).toBe('遁甲：天盘干：己；八神：阴；九星：辅；地盘干：壬');
	expect(kan).toEqual(expect.arrayContaining(['人事宫位：第 1 宫', '上升取法：经典', '六壬：天盘：酉；神将：太阴', '星盘：月亮 9°11']));
	// 黄道分宫(无 ascRaLine)不出取法行;没有外圈数据也照出遁甲 / 六壬
	const plain = buildSanshiPalaceSections({ dunjia: DUNJIA, lrLayout: LR, outerData: null })[0].body;
	expect(plain.some((l)=>/上升取法/.test(l))).toBe(false);
	expect(plain).toEqual(expect.arrayContaining(['六壬：天盘：酉；神将：太阴', '星盘：无']));
	expect(buildSanshiPalaceSections({ dunjia: null })).toEqual([]);
});

test('页面快照与无头重算走同一个合成函数(不各写一份)', ()=>{
	const page = read('components/sanshi/SanShiUnitedMain.js');
	expect(page).toMatch(/buildSanshiPalaceSections\(\{ dunjia, lrLayout, outerData \}\)\.forEach\(\(sec\)=>appendSection\(lines, sec\.title, sec\.body\)\)/);
	const headless = read('utils/aiAnalysisContext/regenDivination.js');
	expect(headless).toMatch(/S\.buildSanshiPalaceSections\(\{ dunjia, lrLayout, outerData \}\)/);
	expect(headless).toMatch(/S\.buildOuterData\(astroChart, outerCoord, ascRaMode\)/);
});

test('挂载齿轮:外圈分宫缺省黄道、跟页面保存值;上升取法只在赤道时显示', ()=>{
	const f = (getTechniqueSettingsSchema('sanshiunited') || {}).fields || [];
	const oc = f.find((x)=>x.name === 'outerCoord');
	const ar = f.find((x)=>x.name === 'ascRaMode');
	expect(oc && oc.default).toBe('ecliptic');
	expect(typeof oc.globalCurrent).toBe('function');
	expect(ar.showWhen({ outerCoord: 'ecliptic' })).toBe(false);
	expect(ar.showWhen({ outerCoord: 'equatorial' })).toBe(true);
});
