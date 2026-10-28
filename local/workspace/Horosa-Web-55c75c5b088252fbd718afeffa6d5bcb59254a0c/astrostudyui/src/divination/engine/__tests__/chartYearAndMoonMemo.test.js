// ① 「从盘里取公历年」(恒星岁差修正)单一来源 engine/utils.chartYearFromFacts:卜卦 / 择日 / 偶然尊贵 / 根本性判定四处共用;
//    空值由 && 链挡住,剩下只有 String(JSON 值).match,不抛 —— 不再外包 try。
// ② 月空(1647 法)记忆化表直接用 WeakMap(目标环境恒有)。
import fs from 'fs';
import path from 'path';
import { chartYearFromFacts } from '../utils';
import { classicVocOf } from '../moon';

const DIV = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(DIV, rel), 'utf8');

describe('chartYearFromFacts', ()=>{
	const f = (params)=>({ result: { params } });
	test('读 params.birth,缺则读 date', ()=>{
		expect(chartYearFromFacts(f({ birth: '1990-05-01 10:00:00', date: '2001-01-01' }))).toBe(1990);
		expect(chartYearFromFacts(f({ date: '2026-03-01' }))).toBe(2026);
		expect(chartYearFromFacts(f({ birth: '0800-01-01' }))).toBe(800);
		expect(chartYearFromFacts(f({ birth: '-0500-03-01' }))).toBe(-500);
		expect(chartYearFromFacts(f({ birth: 2010 }))).toBe(2010);
	});
	test('取不到年份一律回中性年 2000', ()=>{
		expect(chartYearFromFacts(null)).toBe(2000);
		expect(chartYearFromFacts({})).toBe(2000);
		expect(chartYearFromFacts({ result: {} })).toBe(2000);
		expect(chartYearFromFacts(f(null))).toBe(2000);
		expect(chartYearFromFacts(f({}))).toBe(2000);
		expect(chartYearFromFacts(f({ birth: '' }))).toBe(2000);
		expect(chartYearFromFacts(f({ birth: { a: 1 } }))).toBe(2000);
		expect(chartYearFromFacts(f({ birth: ['x'] }))).toBe(2000);
		expect(chartYearFromFacts(f({ birth: 'abc' }))).toBe(2000);
	});
	test('源码:四处调用方都 import 单源,不再各自解析', ()=>{
		[
			['election/modules.js', 3],
			['horary/horaryEngine.js', 1],
			['data/accidentalDignity.js', 1],
			['engine/radicality.js', 1],
		].forEach(([rel, n])=>{
			const src = read(rel);
			expect(src).toMatch(/import \{[^}]*\bchartYearFromFacts\b[^}]*\} from '\.\.?\/(engine\/)?utils';/);
			expect(src.split('chartYearFromFacts(facts)').length - 1).toBe(n);
			expect(src).not.toContain('String(ds).match(');
			expect(src).not.toMatch(/function (getChartYear|chartYear|chartYearOf)\(/);
		});
		const u = read('engine/utils.js');
		expect(u).toContain('export function chartYearFromFacts(facts){');
		expect(u.slice(u.indexOf('export function chartYearFromFacts'), u.indexOf('export function chartYearFromFacts') + 300)).not.toContain('try{');
	});
});

describe('月空(1647 法)记忆化', ()=>{
	const mk = (moonAsp)=>({
		planets: { moon: { isVOC: true } },
		result: { aspects: { normalAsp: { Moon: moonAsp } } },
	});
	test('有入相主相位 = 不空;无 = 空;同一相位表条目第二次走缓存(结果不变)', ()=>{
		const live = mk({ Applicative: [{ id: 'Mars', asp: 90, orb: 3 }], Exact: [], Separative: [] });
		expect(classicVocOf(live)).toBe(false);
		live.result.aspects.normalAsp.Moon.Applicative = [];   // 就地改表:同一条目对象 → 仍取缓存
		expect(classicVocOf(live)).toBe(false);
		const voc = mk({ Applicative: [{ id: 'Mars', asp: 45, orb: 1 }], Exact: [], Separative: [{ id: 'Sun', asp: 0 }] });
		expect(classicVocOf(voc)).toBe(true);
	});
	test('相位表缺月亮条目时回落后端旗(不缓存);没有月亮 = 不空', ()=>{
		const f = { planets: { moon: { isVOC: true } }, result: { aspects: { normalAsp: {} } } };
		expect(classicVocOf(f)).toBe(true);
		f.planets.moon.isVOC = false;
		expect(classicVocOf(f)).toBe(false);
		expect(classicVocOf({ planets: {} })).toBe(false);
	});
	test('源码:记忆化表直接 new WeakMap,不再判环境', ()=>{
		const src = read('engine/moon.js');
		expect(src).toContain('const CLASSIC_VOC_MEMO = new WeakMap();');
		expect(src).not.toContain("typeof WeakMap === 'function'");
		expect(src).not.toContain('CLASSIC_VOC_MEMO &&');
	});
});
