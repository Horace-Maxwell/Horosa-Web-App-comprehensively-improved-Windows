// 浅色风味(古典宣纸 / 经典白色):写失败如实回报;别的窗口改了 / 清空了存储本窗口跟着换且不回写;
// 页头按钮的下一档按页面上实际生效的那档算(组件 state 可能是旧的)。
import fs from 'fs';
import path from 'path';
import {
	applyLightFlavorToDocument, bindLightFlavorStorageSync, currentLightFlavor, getStoredLightFlavor,
	LIGHT_FLAVOR_APPLIED_EVENT, LIGHT_FLAVOR_CLASSIC, LIGHT_FLAVOR_PAPER,
} from '../appearance';

const KEY = 'horosa.ui.lightFlavor';
const attr = ()=>document.documentElement.getAttribute('data-horosa-light-flavor');
let detach = ()=>{};

beforeEach(()=>{
	window.localStorage.clear();
	document.documentElement.removeAttribute('data-horosa-light-flavor');
});
afterEach(()=>{
	detach();
	detach = ()=>{};
	jest.restoreAllMocks();
});

it('🔴 写不进存储:照常生效,但回报 false(调用方据此提示「重启后会回到原来那档」)', ()=>{
	jest.spyOn(Storage.prototype, 'setItem').mockImplementation(()=>{ throw new Error('SecurityError'); });
	expect(applyLightFlavorToDocument(LIGHT_FLAVOR_CLASSIC)).toBe(false);
	expect(attr()).toBe(LIGHT_FLAVOR_CLASSIC);
	jest.restoreAllMocks();
	expect(applyLightFlavorToDocument(LIGHT_FLAVOR_PAPER)).toBe(true);
	expect(window.localStorage.getItem(KEY)).toBe(LIGHT_FLAVOR_PAPER);
});

it('🔴 别的窗口改了浅色风味:本窗口跟着换,且不回写存储', ()=>{
	detach = bindLightFlavorStorageSync();
	const seen = [];
	const onApplied = (e)=>seen.push(e.detail.flavor);
	window.addEventListener(LIGHT_FLAVOR_APPLIED_EVENT, onApplied);
	window.localStorage.setItem(KEY, LIGHT_FLAVOR_CLASSIC);
	const spy = jest.spyOn(Storage.prototype, 'setItem');
	window.dispatchEvent(new window.StorageEvent('storage', { key: KEY, newValue: LIGHT_FLAVOR_CLASSIC, oldValue: LIGHT_FLAVOR_PAPER, storageArea: window.localStorage }));
	expect(attr()).toBe(LIGHT_FLAVOR_CLASSIC);
	expect(currentLightFlavor()).toBe(LIGHT_FLAVOR_CLASSIC);
	expect(seen).toEqual([LIGHT_FLAVOR_CLASSIC]);   // 页头按钮的提示文字据此跟上
	expect(spy).not.toHaveBeenCalled();
	window.removeEventListener(LIGHT_FLAVOR_APPLIED_EVENT, onApplied);
});

it('🔴 别的窗口清空了存储(key === null):回到缺省那档,不回写', ()=>{
	detach = bindLightFlavorStorageSync();
	applyLightFlavorToDocument(LIGHT_FLAVOR_CLASSIC);
	window.localStorage.clear();
	const spy = jest.spyOn(Storage.prototype, 'setItem');
	window.dispatchEvent(new window.StorageEvent('storage', { key: null, newValue: null, oldValue: null, storageArea: window.localStorage }));
	expect(attr()).toBe(null);
	expect(currentLightFlavor()).toBe(LIGHT_FLAVOR_PAPER);
	expect(getStoredLightFlavor()).toBe(LIGHT_FLAVOR_PAPER);
	expect(spy).not.toHaveBeenCalled();
	expect(window.localStorage.getItem(KEY)).toBe(null);
});

it('别的键变化不理会', ()=>{
	detach = bindLightFlavorStorageSync();
	applyLightFlavorToDocument(LIGHT_FLAVOR_CLASSIC);
	window.localStorage.setItem(KEY, LIGHT_FLAVOR_PAPER);   // 存储被直改,但事件说的是别的键
	window.dispatchEvent(new window.StorageEvent('storage', { key: 'horosa.ui.script', newValue: 'hant', storageArea: window.localStorage }));
	expect(attr()).toBe(LIGHT_FLAVOR_CLASSIC);
});

describe('源码合同', ()=>{
	const SRC = path.join(__dirname, '..', '..');
	const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
	it('页头切换按页面实际那档算下一档,写失败要提示;布局挂上跨窗口同步', ()=>{
		const ph = read('components/homepage/PageHeader.js');
		const fn = ph.slice(ph.indexOf('function cycleLightFlavor(){'), ph.indexOf('function changeDayBoundary('));
		expect(fn).toContain('currentLightFlavor()');
		expect(fn).not.toMatch(/=\s*lightFlavor\s*===/);   // 不拿组件 state 当现值
		expect(fn).toMatch(/if\(!applyLightFlavorToDocument\(next\)\)\{\s*message\.warning\(/);
		expect(ph).toContain('LIGHT_FLAVOR_APPLIED_EVENT');
		expect(read('layouts/app.js')).toContain('bindLightFlavorStorageSync()');
	});

	it('🔴 开机回放只在挂载时一次:随明暗切换重跑的 effect 里不许按存储回放浅色风味(写失败时会把当次生效的档换回旧档)', ()=>{
		const parser = require('@babel/parser');
		const traverse = require('@babel/traverse').default;
		const code = read('layouts/app.js');
		const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport'] });
		const effects = [];
		traverse(ast, {
			CallExpression(p){
				const c = p.node.callee;
				const isEffect = (c.type === 'MemberExpression' && c.property && c.property.name === 'useEffect') || (c.type === 'Identifier' && c.name === 'useEffect');
				if(!isEffect){ return; }
				const [fn, deps] = p.node.arguments;
				effects.push({ body: code.slice(fn.start, fn.end), deps: deps && deps.type === 'ArrayExpression' ? deps.elements.length : null });
			},
		});
		const replays = effects.filter((e)=>/applyLightFlavorToDocument\(\s*getStoredLightFlavor\(\)\s*\)/.test(e.body));
		expect(replays.length).toBe(1);
		expect(replays[0].deps).toBe(0);
		expect(effects.filter((e)=>e.deps !== 0 && /applyLightFlavor/.test(e.body))).toEqual([]);
	});
});
