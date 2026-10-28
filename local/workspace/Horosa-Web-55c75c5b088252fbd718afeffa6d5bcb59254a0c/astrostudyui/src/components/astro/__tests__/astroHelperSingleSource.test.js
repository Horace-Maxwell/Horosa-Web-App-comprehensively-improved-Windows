// AstroHelper = 字符串 / 坐标小工具的单一来源。
// ① 旧的函数式 d3 画盘管线(signsBand … drawDoubleChart)早已由 AstroChartCircle 类接管、站内零调用,已整体移除;
//    本文件只留在用的工具,导出清单在此锁死(加新工具请同步这里)。
// ② 座内度分 / 星体显示名这几份逐字相同的副本(七政、宿占、量化盘中点、合盘页)收口到这里,各页 import。
import fs from 'fs';
import path from 'path';
import * as AstroHelper from '../AstroHelper';
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => readSource(path.join(SRC, rel));
// 剥注释:注释里出现名字不等于代码用了它
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const EXPECTED_EXPORTS = [
	'whichTerm', 'splitDegree', 'convertLatToStr', 'convertLonToStr', 'formatLonDms', 'formatLatDms',
	'convertLatStrToDegree', 'convertLonStrToDegree', 'getDignityText', 'getObjectsText', 'getStars', 'getObject',
	'signDegMin', 'astroMsgText', 'astroMsgPlainText',
].sort();

describe('AstroHelper 只留在用的工具', () => {
	test('导出清单 = 在用工具(旧画盘管线不在)', () => {
		expect(Object.keys(AstroHelper).sort()).toEqual(EXPECTED_EXPORTS);
	});
	test('不再引 d3 / detectOS(模块加载期不碰 navigator)', () => {
		const src = strip(read('components/astro/AstroHelper.js'));
		expect(src).not.toMatch(/from 'd3'/);
		expect(src).not.toMatch(/detectOS/);
		expect(src).not.toMatch(/termsTableForVariant|distanceInCircleAbs/);
	});
	test('留下的工具行为照旧', () => {
		expect(AstroHelper.splitDegree(12.5)).toEqual([12, 30, 0]);
		expect(AstroHelper.convertLatToStr(-0.12)).toBe('0s07');
		expect(AstroHelper.convertLonStrToDegree('116e24')).toBeCloseTo(116.4, 6);
		expect(AstroHelper.formatLonDms(-122.5)).toBe('122°30′0″W');
		expect(AstroHelper.getDignityText([])).toBe('游走');
		expect(AstroHelper.getObjectsText(null)).toBe(null);
		const chart = { chart: { objects: [{ id: AstroConst.SUN, lon: 10 }], stars: [{ id: AstroConst.SUN, stars: ['x'] }] }, lots: [{ id: 'Pars', lon: 1 }] };
		expect(AstroHelper.getObject(chart, AstroConst.SUN).lon).toBe(10);
		expect(AstroHelper.getObject(chart, 'Pars').lon).toBe(1);
		expect(AstroHelper.getStars(chart, AstroConst.SUN)).toEqual(['x']);
		expect(AstroHelper.getObject(null, AstroConst.SUN)).toBe(null);
	});
});

// 原副本逐字搬来作对照(收口前七政 / 宿占 / 量化盘中点各一份)
function legacySignDegMin(degree){
	let d = Number(degree);
	if(Number.isNaN(d)){
		return [0, 0];
	}
	if(d < 0){
		d += 360;
	}
	const deg = Math.floor(d % 30);
	const min = Math.floor(((d % 30) - deg) * 60);
	return [deg, min];
}
function legacyMsg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		return `${AstroText.AstroMsg[id]}`;
	}
	return `${id}`;
}

describe('座内度分 / 星体显示名 单一来源', () => {
	test('signDegMin 与原副本逐值相同(含负值、越界、非数)', () => {
		[0, 0.5, 29.999, 30, 45.75, 359.99, 360, 725.3, -0.25, -30, -400, '12.5', 'abc', null, undefined, NaN].forEach((v) => {
			expect(AstroHelper.signDegMin(v)).toEqual(legacySignDegMin(v));
		});
	});
	test('astroMsgText 与原副本逐值相同', () => {
		const ids = [...Object.keys(AstroText.AstroTxtMsg), ...Object.keys(AstroText.AstroMsg), 'NoSuchId', '', 0, null, undefined];
		ids.forEach((id) => {
			expect(AstroHelper.astroMsgText(id)).toBe(legacyMsg(id));
		});
	});
	test('astroMsgPlainText:字形码不进纯文本,单字符码出中文名', () => {
		expect(AstroHelper.astroMsgPlainText(null)).toBe('');
		expect(AstroText.AstroTxtMsg[AstroConst.SUN]).toBeTruthy();
		expect(AstroHelper.astroMsgPlainText(AstroConst.SUN)).toBe(AstroText.AstroTxtMsg[AstroConst.SUN]);
		expect(AstroHelper.astroMsgPlainText('A')).toBe('日');
		expect(AstroHelper.astroMsgPlainText('$')).toBe('月亮平均近地点');
		expect(AstroHelper.astroMsgPlainText('NoSuchId')).toBe('NoSuchId');
		// 与 astroMsgText 的差别只在「AstroMsg 给的是单字符字形码」这一支
		Object.keys(AstroText.AstroMsg).forEach((id) => {
			if(AstroText.AstroTxtMsg[id]){ return; }
			const glyph = `${AstroText.AstroMsg[id]}`;
			if(/^[A-Za-z0-9${}]$/.test(glyph.trim())){
				expect(AstroHelper.astroMsgPlainText(id)).not.toBe(glyph);
			}else{
				expect(AstroHelper.astroMsgPlainText(id)).toBe(AstroHelper.astroMsgText(id));
			}
		});
	});
	test('各页不再自带副本,改从 AstroHelper 引', () => {
		const sites = {
			'components/guolao/GuoLaoChartMain.js': "import { signDegMin, astroMsgPlainText as msg } from '../../astro/AstroHelper';",   // 主页助手拆在 main/(全集读),路径多一层
			'components/suzhan/SuZhanMain.js': "import { signDegMin, astroMsgPlainText as msg } from '../astro/AstroHelper';",
			'components/germany/AstroMidpoint.js': "import { signDegMin, astroMsgText as msg } from '../astro/AstroHelper';",
			'components/astro/AstroRelative.js': "import { astroMsgText as msg } from './AstroHelper';",
		};
		Object.entries(sites).forEach(([rel, imp]) => {
			const src = strip(read(rel));
			expect(`${rel}:${src.includes(imp)}`).toBe(`${rel}:true`);
			expect(`${rel}:${/\bfunction (msg|splitDegree|isEncodedToken)\s*\(/.test(src)}`).toBe(`${rel}:false`);
			expect(`${rel}:${/SIMPLE_TOKEN_MAP/.test(src)}`).toBe(`${rel}:false`);
		});
	});
});
