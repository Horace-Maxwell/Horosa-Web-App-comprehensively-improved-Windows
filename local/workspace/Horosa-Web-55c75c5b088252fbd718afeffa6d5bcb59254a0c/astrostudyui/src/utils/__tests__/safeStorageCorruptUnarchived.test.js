// 用户数据 JSON 坏了、本机存储又满了(留档写不进):原串是唯一副本,不能删、也不能被之后的写盖掉。
// 此前 safeJsonParseFromStorage 不看留档成没成,照样删原串 —— 人生事件 / 择日方案 / 书签这类键的唯一一份就此没了。
// 现在:留档没成 → 原串原样留在原键、本次读当空;之后两条写入通道(同步 safeLocalStorageSet / 延迟落盘)先再试一次留档,
// 留不成就拒写;腾出空间后留档成功就照常写;存储健康页列出这些键、可导出原内容。
import {
	safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageSet, listCorruptArchives,
	listCorruptUnarchivedKeys, __resetCorruptUnarchivedForTests, CORRUPT_UNARCHIVED_EVENT,
} from '../safeStorage';
import { scheduleStorageWrite, flushStorageWrites } from '../deferredStorage';

const KEY = 'horosa.lc.lifeEvents.v1';          // 用户数据键
const FILL = 'horosa.localCharts.v1';           // 填满剩余空间用(记录库键,不在清理面里)

function corruptRaw(){
	const body = JSON.stringify({ sig: Array.from({ length: 20000 }, (_, i)=>({ id: `e${i}`, date: '2020-01-01', title: '事件'.repeat(30) })) });
	return body.slice(0, body.length - 3);
}
function fillStorage(){
	const filler = 'x'.repeat(10000);
	try{ for(;;){ localStorage.setItem(FILL, (localStorage.getItem(FILL) || '') + filler); } }catch(e){ /* 满了 */ }
}

beforeEach(()=>{ localStorage.clear(); __resetCorruptUnarchivedForTests(); });

describe('🔴 坏 JSON + 存储满:原串不删、之后的写不盖', ()=>{
	test('读:回 null,原串仍在,没有留档;记进「没能留档」清单并广播', ()=>{
		const raw = corruptRaw();
		localStorage.setItem(KEY, raw);
		fillStorage();
		const got = [];
		const h = (e)=>got.push(e.detail);
		window.addEventListener(CORRUPT_UNARCHIVED_EVENT, h);
		expect(safeJsonParseFromStorage(KEY)).toBe(null);
		window.removeEventListener(CORRUPT_UNARCHIVED_EVENT, h);
		expect(localStorage.getItem(KEY)).toBe(raw);
		expect(listCorruptArchives()).toEqual([]);
		expect(listCorruptUnarchivedKeys()).toEqual([{ key: KEY, size: raw.length }]);
		expect(got).toEqual([{ key: KEY }]);
	});
	test('写:同步写与延迟落盘都拒写(原串不变),同步写回 false', ()=>{
		const raw = corruptRaw();
		localStorage.setItem(KEY, raw);
		fillStorage();
		safeJsonParseFromStorage(KEY);
		expect(safeJsonStringifyToStorage(KEY, { sig: [] })).toBe(false);
		expect(safeLocalStorageSet(KEY, '{}')).toBe(false);
		scheduleStorageWrite(KEY, ()=>'{"sig":[]}');
		flushStorageWrites();
		expect(localStorage.getItem(KEY)).toBe(raw);
	});
	test('腾出空间后:下一次写先把原串留档、再照常写;清单自动解除', ()=>{
		const raw = corruptRaw();
		localStorage.setItem(KEY, raw);
		fillStorage();
		safeJsonParseFromStorage(KEY);
		localStorage.removeItem(FILL);   // 用户清理了一些数据
		expect(safeJsonStringifyToStorage(KEY, { sig: [] })).toBe(true);
		expect(localStorage.getItem(KEY)).toBe('{"sig":[]}');
		const arch = listCorruptArchives();
		expect(arch.length).toBe(1);
		expect(localStorage.getItem(arch[0].key)).toBe(raw);
		expect(listCorruptUnarchivedKeys()).toEqual([]);
	});
	test('原串已不在(用户在别处清掉)→ 不再拦', ()=>{
		localStorage.setItem(KEY, corruptRaw());
		fillStorage();
		safeJsonParseFromStorage(KEY);
		localStorage.removeItem(KEY);
		localStorage.removeItem(FILL);
		expect(safeLocalStorageSet(KEY, '{}')).toBe(true);
		expect(listCorruptUnarchivedKeys()).toEqual([]);
	});
	test('空间够时照旧:先留档、再清坏串(现状不变)', ()=>{
		localStorage.setItem(KEY, '{"sig":[');
		expect(safeJsonParseFromStorage(KEY)).toBe(null);
		expect(localStorage.getItem(KEY)).toBe(null);
		expect(listCorruptArchives().length).toBe(1);
		expect(listCorruptUnarchivedKeys()).toEqual([]);
		expect(safeLocalStorageSet(KEY, '{}')).toBe(true);
	});
	test('不是用户数据的键(可再生缓存)坏了照旧直接清', ()=>{
		const { classifyStorageKey } = require('../storageKeyRegistry');
		const k = 'horosa.ai.snapshot.v1.astrochart';
		const e = classifyStorageKey(k);
		expect(e && e.kind).not.toBe('user-data');
		localStorage.setItem(k, '{bad');
		expect(safeJsonParseFromStorage(k)).toBe(null);
		expect(localStorage.getItem(k)).toBe(null);
	});
});

// 留档函数的回值是「原串有没有另存成功」:丢掉它就会在没留住的情况下照样删 / 盖原串。全仓调用点的回值必须被用上
describe('源码合同:archiveCorruptStorageValue 的回值一律被使用', ()=>{
	const fs = require('fs');
	const path = require('path');
	const { parseModule } = require('./helpers/importSpecs');
	const traverse = require('@babel/traverse').default;
	const SRC = path.resolve(__dirname, '../..');
	function walk(dir, acc){
		fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
			const p = path.join(dir, e.name);
			if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== '.umi' && e.name !== '.umi-production'){ walk(p, acc); } }
			else if(/\.js$/.test(e.name)){ acc.push(p); }
		});
		return acc;
	}
	function discarded(src){
		const out = [];
		let ast = null;
		try{ ast = parseModule(src); }catch(e){ return out; }
		traverse(ast, {
			CallExpression(p){
				const c = p.node.callee;
				const name = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && c.property && c.property.name);
				if(name !== 'archiveCorruptStorageValue'){ return; }
				if(p.parentPath.isExpressionStatement() || (p.parentPath.isUnaryExpression({ operator: 'void' }))){ out.push(p.node.loc.start.line); }
			},
		});
		return out;
	}
	test('全 src 没有一处把回值丢掉', ()=>{
		const bad = [];
		let calls = 0;
		walk(SRC, []).forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			if(src.indexOf('archiveCorruptStorageValue(') < 0){ return; }
			calls += (src.match(/archiveCorruptStorageValue\(/g) || []).length;
			discarded(src).forEach((l)=>bad.push(`${path.relative(SRC, f)}:${l}`));
		});
		expect(calls).toBeGreaterThanOrEqual(5);
		expect(bad).toEqual([]);
	});
	test('判别力:表达式语句丢回值即红;赋值 / 条件里用上不红', ()=>{
		expect(discarded("if(x){ archiveCorruptStorageValue(k, raw); }\nremove(k);")).toEqual([1]);
		expect(discarded("const a = archiveCorruptStorageValue(k, raw);\nif(!archiveCorruptStorageValue(k, raw)){ return; }")).toEqual([]);
	});
});
