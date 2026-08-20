// [对标战役 0d] 返照/推运族古典口径透传契约。
// 病理:9 组件 genNatalParams/natalParams 手写 4-6 基础键,古典键(界系/三分/宫头5°律/三态阈/
// 空亡/恒星/映点/三开关)全丢——改「星盘设置」后返照·小限·太阳弧·ZR·波斯向运·行星弧·十年运
// 与主盘口径静默分叉(三层断链之前端层;Java 层=PredictiveController 白名单,Python 层=webpredictsrv 临界区)。
// 契约:①helper 默认态空/非默认逐键 ②9 组件源码必 spread 单源(防回退手写)。
import fs from 'fs';
import path from 'path';
import { natalClassicalParams } from '../AstroExtraCommon';

describe('natalClassicalParams(单源 helper)', () => {
	it('默认态(空/默认值参数包)恒返回 {} —— 请求体/缓存键零回归锚', () => {
		expect(natalClassicalParams(undefined)).toEqual({});
		expect(natalClassicalParams({})).toEqual({});
		expect(natalClassicalParams({
			date: '1990-01-01', hsys: 1, zodiacal: 0,
			termsVariant: 0, geminiBoundEmended: 0, westNodeType: 'mean', sectBuffer: 'geo',
			leoBoundFirst: 0, triplicity: 'Dorothean', lotReversal: 1,
			houseCuspAdvance: 5, cazimiOrb: 17 / 60, combustOrb: 8.5, underBeamsOrb: 17,
			vocMode: 'classic', vocIncludeOuter: 0, fixedStarOrb: 1, fixedStarOrbMode: 'school',
			antisciaOrb: 1, viaCombustaVariant: 'standard',
			lotsDocReverse: 0, nodeExaltation: 0,
			// 已删档键(saturnExalt20/polarMcMode):残值喂非默认也须零透传(残键免疫)
			saturnExalt20: 1, polarMcMode: 'aboveHorizon',
		})).toEqual({});
	});

	it('非默认逐键透传:七头键 + 二/四批 + 三开关(与主盘 fieldsToParams 同口径)', () => {
		const out = natalClassicalParams({
			termsVariant: 3, geminiBoundEmended: 1, westNodeType: 'true', sectBuffer: 'ptolemy5',
			leoBoundFirst: 1, triplicity: 'Ptolemaic', lotReversal: 0,
			houseCuspAdvance: 0, cazimiOrb: 1, combustOrb: 8, underBeamsOrb: 15,
			vocMode: 'kenodromia', vocIncludeOuter: 1, fixedStarOrb: 2, fixedStarOrbMode: 'byMagnitude',
			antisciaOrb: 2, viaCombustaVariant: 'narrow',
			lotsDocReverse: 1, nodeExaltation: 1,
		});
		expect(out).toEqual({
			termsVariant: 3, geminiBoundEmended: 1, westNodeType: 'true', sectBuffer: 'ptolemy5',
			leoBoundFirst: 1, triplicity: 'Ptolemaic', lotReversal: 0,
			houseCuspAdvance: 0, cazimiOrb: 1, combustOrb: 8, underBeamsOrb: 15,
			vocMode: 'kenodromia', vocIncludeOuter: 1, starOrb: 2, starOrbMode: 'byMagnitude',
			antisciaOrb: 2, viaCombustaVariant: 'narrow',
			lotsDocReverse: 1, nodeExaltation: 1,
		});
	});

	it('键名映射与主盘一致:fixedStarOrb→starOrb / fixedStarOrbMode→starOrbMode', () => {
		const out = natalClassicalParams({ fixedStarOrb: 3, fixedStarOrbMode: 'byMagnitude' });
		expect(out.starOrb).toBe(3);
		expect(out.starOrbMode).toBe('byMagnitude');
		expect(out.fixedStarOrb).toBeUndefined();
	});

	it('sect/node 判非默认为「≠默认」形——未来档位扩容(如 sect 第三档)自动透传', () => {
		expect(natalClassicalParams({ sectBuffer: 'apparent' }).sectBuffer).toBe('apparent');
		expect(natalClassicalParams({ westNodeType: 'true' }).westNodeType).toBe('true');
	});
});

describe('9 组件源码级契约:genNatalParams/natalParams 必 spread 单源', () => {
	const FILES = [
		'AstroSolarReturn.js', 'AstroLunarReturn.js', 'AstroProfection.js', 'AstroGivenYear.js',
		'AstroDecennials.js', 'AstroSolarArc.js', 'AstroZR.js', 'AstroPersianDirected.js', 'AstroPlanetaryArc.js',
	];
	FILES.forEach((f) => {
		it(`${f} 含 ...natalClassicalParams( spread(防回退手写基础键)`, () => {
			const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
			expect(src).toMatch(/\.\.\.natalClassicalParams\(/);
			// import 形宽匹配:natalClassicalParams 出现在 AstroExtraCommon 的具名 import 花括号内
			// (后续 helper(如 transitOrbDefault)可同行追加,不锁次序)。
			expect(src).toMatch(/import \{[^}]*\bnatalClassicalParams\b[^}]*\} from '\.\/AstroExtraCommon'/);
		});
	});

	it('chartParams(辅盘族入口)也走同一单源(古典段不得手写第二份)', () => {
		const src = fs.readFileSync(path.join(__dirname, '..', 'AstroExtraCommon.js'), 'utf8');
		expect(src).toMatch(/export function chartParams[\s\S]*?\.\.\.natalClassicalParams\(params\),/);
	});
});
