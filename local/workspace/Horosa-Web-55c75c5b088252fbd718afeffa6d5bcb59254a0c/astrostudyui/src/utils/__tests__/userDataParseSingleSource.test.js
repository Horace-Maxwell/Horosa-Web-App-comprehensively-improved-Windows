// 用户数据键「读 → 改 → 整份写回」:读端一律经单源(safeStorage.readUserDataJson / safeJsonParseFromStorage /
// 记录库内核),不许自己 JSON.parse + catch → 空。自己解析的,坏了当空、下一次写入就把唯一的原串整份盖掉,
// 有空间也一份留档都不留,存储健康页也看不到。
// 合同按存储键登记表驱动:登记为 user-data 的键(含前缀族),某个文件里既自己 JSON.parse 它、又写它 → 红。
// 行为例:坏串 / 形状不对 + 写一次 ⇒ 留档 1 份(或原串仍在)。
import fs from 'fs';
import path from 'path';
import { classifyStorageKey } from '../storageKeyRegistry';
import { readUserDataJson, listCorruptArchives, listCorruptUnarchivedKeys, safeLocalStorageSet, __resetCorruptUnarchivedForTests } from '../safeStorage';

const { parseModule } = require('./helpers/importSpecs');
const traverse = require('@babel/traverse').default;
const SRC = path.resolve(__dirname, '../..');
// 自带留档 / 只读不写的单源文件
const SINGLE_SOURCE_FILES = new Set([
	'utils/safeStorage.js',          // 单源本身
	'utils/localRecordStore.js',     // 记录库内核:坏内容先留档,留不成不盖(recordStoreSafety)
]);

function walk(dir, acc){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== '.umi' && e.name !== '.umi-production'){ walk(p, acc); } }
		else if(/\.js$/.test(e.name)){ acc.push(p); }
	});
	return acc;
}
const calleeName = (c)=>(c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && c.property ? c.property.name : ''));
const WRITE_CALLS = ['safeLocalStorageSet', 'safeJsonStringifyToStorage', 'setItem', 'scheduleStorageWrite', 'safeStorageSetOn'];
const isUserData = (k)=>{ const e = typeof k === 'string' && k ? classifyStorageKey(k) : null; return !!(e && e.kind === 'user-data'); };

// 一个表达式对应的存储键字面值(字面量 / 本文件常量 / 模板串里的固定前缀不算)
function keyOf(p, node, depth = 0){
	if(!node || depth > 4){ return null; }
	if(node.type === 'StringLiteral'){ return node.value; }
	if(node.type === 'Identifier'){
		const b = p.scope.getBinding(node.name);
		if(b && b.path && b.path.isVariableDeclarator()){ return keyOf(b.path, b.path.node.init, depth + 1); }
	}
	return null;
}
// JSON.parse 的实参追到 getItem(键):直接、`getItem(K) || '[]'`、或经局部变量
function parsedKeyOf(p, node, depth = 0){
	if(!node || depth > 4){ return null; }
	if(node.type === 'CallExpression' && calleeName(node.callee) === 'getItem'){ return keyOf(p, node.arguments[0]); }
	if(node.type === 'LogicalExpression'){ return parsedKeyOf(p, node.left, depth + 1); }
	if(node.type === 'Identifier'){
		const b = p.scope.getBinding(node.name);
		if(b && b.path && b.path.isVariableDeclarator()){ return parsedKeyOf(b.path, b.path.node.init, depth + 1); }
	}
	return null;
}
function selfParsedAndWritten(src){
	let ast = null;
	try{ ast = parseModule(src); }catch(e){ return []; }
	const parsed = new Map();   // key -> line
	const written = new Set();
	traverse(ast, {
		CallExpression(p){
			const c = p.node.callee;
			if(c.type === 'MemberExpression' && c.object && c.object.name === 'JSON' && c.property && c.property.name === 'parse'){
				const k = parsedKeyOf(p, p.node.arguments[0]);
				if(isUserData(k) && !parsed.has(k)){ parsed.set(k, p.node.loc.start.line); }
				return;
			}
			const n = calleeName(c);
			if(WRITE_CALLS.indexOf(n) >= 0){
				const kArg = n === 'safeStorageSetOn' ? p.node.arguments[1] : p.node.arguments[0];
				const k = keyOf(p, kArg);
				if(k){ written.add(k); }
			}
		},
	});
	return Array.from(parsed.entries()).filter(([k])=>written.has(k)).map(([k, line])=>({ key: k, line }));
}

describe('源码合同(登记表驱动):用户数据键读端走单源', ()=>{
	test('全 src 零命中', ()=>{
		const bad = [];
		walk(SRC, []).forEach((f)=>{
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			if(SINGLE_SOURCE_FILES.has(rel)){ return; }
			const src = fs.readFileSync(f, 'utf8');
			if(src.indexOf('JSON.parse(') < 0){ return; }
			selfParsedAndWritten(src).forEach((h)=>bad.push(`${rel}:${h.line} ${h.key}`));
		});
		expect(bad).toEqual([]);
	});
	test('判别力:改前的几种写法必红;经单源读的不红', ()=>{
		const K = 'horosa.mundane.region.user.v1';   // 登记为 user-data
		expect(isUserData(K)).toBe(true);
		// ① 两步读
		expect(selfParsedAndWritten(`const USER_KEY='${K}'; function load(){ try{ const raw = localStorage.getItem(USER_KEY); return JSON.parse(raw); }catch(e){ return {}; } } function save(m){ safeLocalStorageSet(USER_KEY, JSON.stringify(m)); }`).length).toBe(1);
		// ② 读带缺省串
		expect(selfParsedAndWritten(`const K='${K}'; function r(){ try{ return JSON.parse(window.localStorage.getItem(K) || '[]'); }catch(_){ return []; } } function w(l){ safeLocalStorageSet(K, JSON.stringify(l)); }`).length).toBe(1);
		// ③ 字面量键
		expect(selfParsedAndWritten(`function r(){ return JSON.parse(localStorage.getItem('${K}')); } function w(v){ localStorage.setItem('${K}', v); }`).length).toBe(1);
		// 经单源读
		expect(selfParsedAndWritten(`const K='${K}'; function r(){ return readUserDataJson(K, {}); } function w(m){ safeLocalStorageSet(K, JSON.stringify(m)); }`).length).toBe(0);
		// 只读不写(不会盖掉原串)不算
		expect(selfParsedAndWritten(`const K='${K}'; function r(){ try{ return JSON.parse(localStorage.getItem(K)); }catch(e){ return {}; } }`).length).toBe(0);
	});
});

describe('🔴 行为:坏串 / 形状不对 + 写一次 ⇒ 原串留了档(或仍在原键)', ()=>{
	beforeEach(()=>{ localStorage.clear(); __resetCorruptUnarchivedForTests(); });
	const archivedRaw = ()=>listCorruptArchives().map((a)=>localStorage.getItem(a.key));
	test('世俗自建地区:截断的 JSON → 留档 1 份,新存的一条照常写进', ()=>{
		const R = require('../../divination/data/regionCharts');
		const bad = '{"k1":{"cn":"甲"';
		localStorage.setItem('horosa.mundane.region.user.v1', bad);
		const out = R.saveUserRegion('k2', { cn: '乙' });
		expect(Object.keys(out)).toEqual(['k2']);
		expect(archivedRaw()).toEqual([bad]);
	});
	test('命主实况问卷:形状不对(数组)→ 同样先留档再当空', ()=>{
		const D = require('../localdeeplearn');
		const bad = '[1,2,3]';
		localStorage.setItem('HorosaLocalDeepLearn', bad);
		expect(D.saveLocalFateEvents({ Cid: 'c1', Val10000: { a: 1 } })).toBe(true);
		expect(archivedRaw()).toEqual([bad]);
		expect(JSON.parse(localStorage.getItem('HorosaLocalDeepLearn')).c1).toBeTruthy();
	});
	test('readUserDataJson:形状按登记表(array / map)判;正常值原样返回', ()=>{
		localStorage.setItem('horosaGeomancyHistory', '[{"ts":1}]');
		expect(readUserDataJson('horosaGeomancyHistory', [])).toEqual([{ ts: 1 }]);
		localStorage.setItem('horosaGeomancyHistory', '{"ts":1}');
		expect(readUserDataJson('horosaGeomancyHistory', [])).toEqual([]);
		expect(archivedRaw()).toEqual(['{"ts":1}']);
		expect(localStorage.getItem('horosaGeomancyHistory')).toBe(null);
	});
	test('形状不对又留不成档:原串不删、之后的写拒绝(与坏 JSON 同口径)', ()=>{
		const KEY = 'horosa.mundane.region.user.v1';
		const bad = JSON.stringify(Array.from({ length: 20000 }, (_, i)=>({ i, t: '地区'.repeat(20) })));
		localStorage.setItem(KEY, bad);
		const filler = 'x'.repeat(10000);
		try{ for(;;){ localStorage.setItem('horosa.localCharts.v1', (localStorage.getItem('horosa.localCharts.v1') || '') + filler); } }catch(e){ /* 满了 */ }
		expect(readUserDataJson(KEY, {})).toEqual({});
		expect(listCorruptUnarchivedKeys().map((x)=>x.key)).toEqual([KEY]);
		expect(safeLocalStorageSet(KEY, '{}')).toBe(false);
		expect(localStorage.getItem(KEY)).toBe(bad);
	});
});
