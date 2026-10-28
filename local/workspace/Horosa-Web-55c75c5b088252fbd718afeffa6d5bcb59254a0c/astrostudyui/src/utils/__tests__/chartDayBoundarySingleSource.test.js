// 命类技法「日界 / 晚子时」取值单源:本盘(fields)有值用本盘,没有才用全局 —— 一律经 dayBoundaryResolve.chartDayBoundary。
//
// 病理:kinastro 系页面(邵子 / 铁板 / 分金 / 北极 / 南极 / 蠢子 / 策天)的请求体只读全局两键,AI 无头按本盘值算;
//       本盘子时四态与全局不同、出生在 23 点档时,同一张盘页面与挂载两套日柱 / 时柱。
// 护栏:
//   ① AST:命类技法目录下,两键的取值不许直接写 default…() / fieldVal(…, default…()) / 手写「有值 ? 值 : 全局」,必须经 chartDayBoundary;
//   ② 行为锁:本盘 0 / 全局 1,kinastro 页面 buildPayload 与无头 kinDayBoundary 下发值相等且都等于本盘值。
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import DateTime from '../../components/comp/DateTime';
import { chartDayBoundary } from '../dayBoundaryResolve';

const SRC = path.join(__dirname, '..', '..');
const KEYS = new Set(['after23NewDay', 'lateZiHourUseNextDay']);
// 起「本命盘」的命类技法(盘面 fields 自带子时四态):目录 / 文件
const MING_SCOPE = ['components/kinastro/', 'components/shusuan/', 'components/guolao/', 'components/cntradition/', 'components/yizhangjing/'];
// 豁免(文件: 片段):不是「从盘面取值」,而是对已拼好的请求参数做缓存键归一
const EXEMPT = new Set([
	'components/guolao/main/chartCache.js: after23NewDay: normalizeNumText(src.after23NewDay, defaultAfter23NewDay())',
	'components/guolao/main/chartCache.js: lateZiHourUseNextDay: normalizeNumText(src.lateZiHourUseNextDay, defaultLateZiHourUseNextDay())',
]);

function listJs(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(['node_modules', '__tests__', '.umi', '.umi-production'].includes(d.name)){ return; }
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ listJs(p, out); return; }
		if(/\.(js|jsx)$/.test(d.name)){ out.push(p); }
	});
	return out;
}

const isDefaultCall = (n)=>n && n.type === 'CallExpression' && n.callee.type === 'Identifier' && /^default(After23NewDay|LateZiHourUseNextDay)$/.test(n.callee.name);
function containsDefaultCall(n){
	let hit = false;
	const visit = (x)=>{
		if(hit || !x || typeof x.type !== 'string'){ return; }
		if(isDefaultCall(x)){ hit = true; return; }
		Object.keys(x).forEach((k)=>{
			if(['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments'].includes(k)){ return; }
			const v = x[k];
			if(Array.isArray(v)){ v.forEach(visit); } else if(v && typeof v === 'object'){ visit(v); }
		});
	};
	visit(n);
	return hit;
}

export function dayBoundaryBypassSites(code){
	const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'], errorRecovery: true });
	const out = [];
	const visit = (n)=>{
		if(!n || typeof n.type !== 'string'){ return; }
		if(n.type === 'ObjectProperty' && !n.computed){
			const k = n.key.type === 'Identifier' ? n.key.name : (n.key.type === 'StringLiteral' ? n.key.value : null);
			if(KEYS.has(k) && containsDefaultCall(n.value)){ out.push(code.slice(n.start, n.end).replace(/\s+/g, ' ').slice(0, 120)); }
		}
		Object.keys(n).forEach((k)=>{
			if(['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments'].includes(k)){ return; }
			const v = n[k];
			if(Array.isArray(v)){ v.forEach(visit); } else if(v && typeof v === 'object'){ visit(v); }
		});
	};
	visit(ast.program);
	return out;
}

describe('命类技法日界 / 晚子时单源 chartDayBoundary', ()=>{
	it('判据自检', ()=>{
		expect(dayBoundaryBypassSites('const p = { after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay() };')).toHaveLength(2);
		expect(dayBoundaryBypassSites("const p = { after23NewDay: fieldVal(f, 'after23NewDay', defaultAfter23NewDay()) };")).toHaveLength(1);
		expect(dayBoundaryBypassSites('const p = { after23NewDay: (f.after23NewDay && f.after23NewDay.value !== undefined) ? f.after23NewDay.value : defaultAfter23NewDay() };')).toHaveLength(1);
		expect(dayBoundaryBypassSites('const p = { ...chartDayBoundary(fields), x: defaultAfter23NewDay() };')).toHaveLength(0);
	});

	it('命类技法目录下零旁路', ()=>{
		const bad = [];
		listJs(SRC, []).forEach((abs)=>{
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			if(!MING_SCOPE.some((p)=>rel.startsWith(p))){ return; }
			dayBoundaryBypassSites(fs.readFileSync(abs, 'utf8')).forEach((s)=>{ const id = `${rel}: ${s}`; if(!EXEMPT.has(id)){ bad.push(id); } });
		});
		expect(bad).toEqual([]);
	});

	describe('行为锁:本盘 0 / 全局 1', ()=>{
		const store = {};
		const ls = { getItem: (k)=>(k in store ? store[k] : null), setItem: (k, v)=>{ store[k] = `${v}`; }, removeItem: (k)=>{ delete store[k]; } };
		let prev;
		beforeAll(()=>{ prev = global.localStorage; Object.defineProperty(global, 'localStorage', { value: ls, configurable: true, writable: true }); });
		afterAll(()=>{ Object.defineProperty(global, 'localStorage', { value: prev, configurable: true, writable: true }); });

		function fieldsOf(a23, late){
			const d = new DateTime({ ad: 1, year: 1990, month: 3, date: 10, hour: 23, minute: 30, second: 0, zone: '+08:00' });
			d.calcJdn();
			return { date: { value: d }, time: { value: d.clone() }, zone: { value: '+08:00' }, lat: { value: '39n54' }, lon: { value: '116e24' },
				gender: { value: 1 }, after23NewDay: { value: a23 }, lateZiHourUseNextDay: { value: late } };
		}

		it('chartDayBoundary:本盘值优先、缺键回全局、值形归一', ()=>{
			expect(chartDayBoundary(fieldsOf(0, 0))).toEqual({ after23NewDay: 0, lateZiHourUseNextDay: 0 });
			expect(chartDayBoundary(fieldsOf('0', '1'))).toEqual({ after23NewDay: 0, lateZiHourUseNextDay: 1 });
			expect(chartDayBoundary({})).toEqual({ after23NewDay: 1, lateZiHourUseNextDay: 1 });
			ls.setItem('globalSetup', JSON.stringify({ dayBoundary: 'after24', lateZiHourMode: 'today' }));
			expect(chartDayBoundary({})).toEqual({ after23NewDay: 0, lateZiHourUseNextDay: 0 });
			expect(chartDayBoundary(fieldsOf(1, 1))).toEqual({ after23NewDay: 1, lateZiHourUseNextDay: 1 });
			ls.removeItem('globalSetup');
		});

		it('kinastro 页面 buildPayload 与无头 kinDayBoundary 同值(= 本盘值)', ()=>{
			const KinAstroMain = require('../../components/kinastro/KinAstroMain').default;
			const { kinDayBoundary } = require('../aiAnalysisContext/recordFields');
			const fake = { state: { gender: '1' }, props: {}, config: { serviceKey: 'shaozi' } };
			const page = KinAstroMain.prototype.buildPayload.call(fake, fieldsOf(0, 0));
			const headless = kinDayBoundary({ birth: '1990-03-10 23:30:00', zone: '+08:00', after23NewDay: 0, lateZiHourUseNextDay: 0 });
			expect({ a: page.after23NewDay, l: page.lateZiHourUseNextDay }).toEqual({ a: 0, l: 0 });
			expect({ a: headless.after23NewDay, l: headless.lateZiHourUseNextDay }).toEqual({ a: 0, l: 0 });
		});
	});
});
