// 九张择日条件注册表的树 API(叶 / 组工厂、叶摘要、编译)单一来源 conditionTypes.makeConditionTreeApi;
// 各注册表模块按原名再导出,语义与错误文案不变。
import fs from 'fs';
import path from 'path';
import { makeConditionTreeApi } from '../conditionTypes';
import * as bazi from '../baziZeriConditionTypes';
import * as huangli from '../huangliZeriConditionTypes';
import * as india from '../indiaZeriConditionTypes';
import * as liureng from '../liurengZeriConditionTypes';
import * as qimen from '../qimenConditionTypes';
import * as qizheng from '../qizhengZeriConditionTypes';
import * as sanshi from '../sanshiZeriConditionTypes';
import * as taiyi from '../taiyiZeriConditionTypes';
import * as ziwei from '../ziweiZeriConditionTypes';

const FAMILIES = [
	['Bazi', bazi, 'BAZI_CONDITION_TYPES', 'baziZeriConditionTypes.js'],
	['Huangli', huangli, 'HUANGLI_CONDITION_TYPES', 'huangliZeriConditionTypes.js'],
	['India', india, 'INDIA_CONDITION_TYPES', 'indiaZeriConditionTypes.js'],
	['Liureng', liureng, 'LIURENG_CONDITION_TYPES', 'liurengZeriConditionTypes.js'],
	['Qimen', qimen, 'QIMEN_CONDITION_TYPES', 'qimenConditionTypes.js'],
	['Qizheng', qizheng, 'QIZHENG_CONDITION_TYPES', 'qizhengZeriConditionTypes.js'],
	['Sanshi', sanshi, 'SANSHI_CONDITION_TYPES', 'sanshiZeriConditionTypes.js'],
	['Taiyi', taiyi, 'TAIYI_CONDITION_TYPES', 'taiyiZeriConditionTypes.js'],
	['Ziwei', ziwei, 'ZIWEI_CONDITION_TYPES', 'ziweiZeriConditionTypes.js'],
];
const api = (stem, mod)=>{
	const lc = stem[0].toLowerCase() + stem.slice(1);
	return { newLeaf: mod[`new${stem}Leaf`], newGroup: mod[`new${stem}Group`], summary: mod[`${lc}LeafSummary`], compile: mod[`compile${stem}Tree`] };
};

describe.each(FAMILIES)('%s 条件树 API', (stem, mod, regName)=>{
	const reg = mod[regName];
	const keys = Object.keys(reg);
	const a = api(stem, mod);

	test('四个原名导出都在', ()=>{
		['newLeaf', 'newGroup', 'summary', 'compile'].forEach((k)=>expect(typeof a[k]).toBe('function'));
	});

	test('叶工厂:默认参数深拷贝、连接门缺省 all;未知类型参数为空对象', ()=>{
		const k = keys[0];
		const leaf = a.newLeaf(k, 'any');
		expect(leaf).toMatchObject({ kind: 'leaf', type: k, negate: false, joiner: 'any' });
		expect(leaf.params).toEqual(reg[k].defaults);
		expect(leaf.params).not.toBe(reg[k].defaults);
		expect(a.newLeaf(k, 'bogus').joiner).toBe('all');
		expect(a.newLeaf('__nope__').params).toEqual({});
		expect(a.newGroup('xor')).toEqual({ kind: 'group', negate: false, joiner: 'xor', children: [] });
		expect(a.newGroup().joiner).toBe('all');
	});

	test('叶摘要:未知 → 未知条件;取反加前缀', ()=>{
		expect(a.summary(null)).toBe('未知条件');
		expect(a.summary({ type: '__nope__' })).toBe('未知条件');
		const k = keys[0];
		const leaf = { ...a.newLeaf(k), negate: true };
		const s = a.summary(leaf);
		expect(s.startsWith(`非·${reg[k].label}·`)).toBe(true);
	});

	test('编译:取反包 not、同门扁平、异门左折叠;空链 / 未知类型报原文案', ()=>{
		const k = keys[0];
		const mk = (j, neg)=>({ ...a.newLeaf(k, j), negate: !!neg });
		const root = { kind: 'group', children: [mk('all'), mk('all'), mk('any', true)] };
		let out;
		try{ out = a.compile(root); }catch(e){ out = e; }
		if(out instanceof Error){
			// 缺省参数本身不过校验的叶:错误文案沿用「「标签」条件:…」格式
			expect(out.message).toMatch(new RegExp(`^「${reg[k].label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}」条件:`));
		}else{
			expect(out.type).toBe('any');
			expect(out.conditions[0].type).toBe('all');
			expect(out.conditions[0].conditions.length).toBe(2);
			expect(out.conditions[1]).toEqual({ type: 'not', conditions: [{ type: k, params: reg[k].defaults }] });
		}
		expect(()=>a.compile({ kind: 'group', children: [] })).toThrow('条件列表为空');
		expect(()=>a.compile({ kind: 'leaf', type: '__nope__' })).toThrow('未知条件类型:__nope__');
	});
});

describe('工厂本身', ()=>{
	test('读的是传入注册表的当前内容(后加的类型也认)', ()=>{
		const reg = { x: { label: 'X', defaults: { v: 1 }, summary: (p)=>`v=${p.v}`, validate: (p)=>(p.v > 0 ? '' : '须为正') } };
		const t = makeConditionTreeApi(reg);
		expect(t.compileTree(t.newLeaf('x'))).toEqual({ type: 'x', params: { v: 1 } });
		expect(()=>t.compileTree({ kind: 'leaf', type: 'x', params: { v: 0 } })).toThrow('「X」条件:须为正');
		reg.y = { label: 'Y', defaults: {}, summary: ()=>{ throw new Error('bad'); } };
		expect(t.leafSummary(t.newLeaf('y'))).toBe('Y·');
	});

	test('源码:九个注册表模块不再各自实现编译,统一调工厂', ()=>{
		FAMILIES.forEach(([stem, , regName, file])=>{
			const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
			expect(src).toContain(`const TREE_API = makeConditionTreeApi(${regName});`);
			expect(src).not.toContain('function compileSelf(');
			expect(src).not.toContain('function compileChain(');
			expect(src).not.toContain(`export function new${stem}Leaf(`);
		});
	});
});
