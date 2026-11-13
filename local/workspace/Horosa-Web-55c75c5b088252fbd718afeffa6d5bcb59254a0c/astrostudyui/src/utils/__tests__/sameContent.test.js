// 「内容没变、只是换了个对象」的判定(盘面回访不白白重建)。
import { sameJsonContent, stableStringify, propsOrStateChanged } from '../sameContent';

describe('sameJsonContent', ()=>{
	test('同引用 / 同内容 → 真;内容不同、非对象、循环引用 → 假', ()=>{
		const a = { chart: { houses: [1, 2, 3] }, name: '甲' };
		expect(sameJsonContent(a, a)).toBe(true);
		expect(sameJsonContent(a, JSON.parse(JSON.stringify(a)))).toBe(true);
		expect(sameJsonContent(a, { ...a, name: '乙' })).toBe(false);
		expect(sameJsonContent(null, a)).toBe(false);
		expect(sameJsonContent(1, 1)).toBe(true);
		expect(sameJsonContent('1', 1)).toBe(false);
		const loop = {}; loop.self = loop;
		expect(sameJsonContent(loop, { self: {} })).toBe(false);
	});
	test('对象被就地改写后再比:按改写后的内容判(不记旧文本)', ()=>{
		const a = { n: 1 };
		const b = { n: 1 };
		expect(sameJsonContent(a, b)).toBe(true);
		a.n = 2;
		expect(sameJsonContent(a, b)).toBe(false);
		expect(sameJsonContent(a, { n: 2 })).toBe(true);
	});
});

describe('stableStringify', ()=>{
	test('键序无关;数组序有关;循环引用返回 null', ()=>{
		expect(stableStringify({ age: 0, ageCycle: 0, year: '丙寅' })).toBe(stableStringify({ ageCycle: 0, year: '丙寅', age: 0 }));
		expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
		expect(stableStringify(undefined)).toBe(undefined);
		const loop = {}; loop.self = loop;
		expect(stableStringify(loop)).toBe(null);
	});
});

describe('propsOrStateChanged', ()=>{
	const fn = ()=>{};
	const base = { value: { a: 1 }, onTip: fn, showDignity: true, transitLoading: false };
	test('内容相同的新对象、被忽略的入参变了 → 不重渲', ()=>{
		expect(propsOrStateChanged(base, { ...base, value: { a: 1 } }, { s: 1 }, { s: 1 }, ['transitLoading'])).toBe(false);
		expect(propsOrStateChanged(base, { ...base, transitLoading: true }, null, null, ['transitLoading'])).toBe(false);
	});
	test('内容变了、开关变了、函数换了、状态变了、多了 / 少了入参 → 重渲', ()=>{
		expect(propsOrStateChanged(base, { ...base, value: { a: 2 } }, null, null, [])).toBe(true);
		expect(propsOrStateChanged(base, { ...base, showDignity: false }, null, null, [])).toBe(true);
		expect(propsOrStateChanged(base, { ...base, onTip: ()=>{} }, null, null, [])).toBe(true);
		expect(propsOrStateChanged(base, base, { side: 700 }, { side: 744 }, [])).toBe(true);
		expect(propsOrStateChanged(base, { ...base, extra: 1 }, null, null, [])).toBe(true);
		expect(propsOrStateChanged({ ...base, extra: 1 }, base, null, null, [])).toBe(true);
		expect(propsOrStateChanged(base, { ...base, transitLoading: true }, null, null, [])).toBe(true);
	});
});
