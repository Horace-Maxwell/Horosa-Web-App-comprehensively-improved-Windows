// 择日工作台参数表:下拉显示的必须是「当前取值」那一档的名字,不是字段名。
// 病根(曾真机可见):字段描述对象拿 valueOf 当「显示值换算」的键 —— 每个对象都带原型上的 valueOf,
// `f.valueOf ? f.valueOf(opts) : opts[f.key]` 恒走前支,没自定义换算的字段返回的是字段对象自己,
// 下拉组件拿对象的 label 去显示 → 十几个下拉全显示成了字段名(只有自带换算的「起局」显示对)。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
const fs = require('fs');
const path = require('path');
const { sanshiWorkbenchParamFields, sanshiParamValue, sanshiParamLabel } = require('../SanshiZeriWorkbench');
const { QIMEN_WORKBENCH_PARAM_FIELDS } = require('../QimenZeriWorkbench');

const PROTO_KEYS = Object.getOwnPropertyNames(Object.prototype);
const ZERI_DIR = path.join(__dirname, '..');

describe('参数表字段描述不拿原型上已有的名字当键', ()=>{
	test.each([
		['三式择日', ()=>sanshiWorkbenchParamFields()],
		['奇门择日', ()=>QIMEN_WORKBENCH_PARAM_FIELDS],
	])('%s', (_name, fields)=>{
		const hits = [];
		fields().forEach((f)=>{
			Object.keys(f).forEach((k)=>{
				if(PROTO_KEYS.indexOf(k) >= 0){ hits.push(`${f.key}.${k}`); }
			});
		});
		expect(hits).toEqual([]);
	});

	test('择日目录下没有「拿原型方法当判据」的写法', ()=>{
		const hits = [];
		fs.readdirSync(ZERI_DIR).filter((n)=>/\.js$/.test(n)).forEach((n)=>{
			const lines = fs.readFileSync(path.join(ZERI_DIR, n), 'utf8').split('\n');
			lines.forEach((line, i)=>{
				const code = line.replace(/\/\/.*$/, '');
				if(/\b[A-Za-z_$][\w$]*\.(valueOf|toString|toLocaleString|hasOwnProperty|constructor)\s*\?(?!\.)/.test(code)){
					hits.push(`${n}:${i + 1}`);
				}
			});
		});
		expect(hits).toEqual([]);
	});
});

describe('三式择日:每个下拉的值都是原始值,且落在自己的选项里', ()=>{
	const CASES = [
		['缺省', {}],
		['月家 · 茅山', { paiPanType: 1, qijuMethod: 'maoshan' }],
		['阴盘', { paiPanType: 4, shuziReportNumber: '168' }],
		['显式取值', { yueMode: 1, guirengType: 2, school: 'feipan', timeAlg: 1, after23NewDay: 1, taiyiAccum: 1 }],
	];
	test.each(CASES)('%s', (_name, opts)=>{
		const fields = sanshiWorkbenchParamFields().filter((f)=>(!f.when || f.when(opts)) && f.kind !== 'input');
		expect(fields.length).toBeGreaterThanOrEqual(12);
		fields.forEach((f)=>{
			const value = sanshiParamValue(f, opts);
			expect(['string', 'number', 'boolean']).toContain(typeof value);
			const label = sanshiParamLabel(f, opts);
			expect(typeof label).toBe('string');
			expect(label).not.toBe(f.label);   // 显示的不是字段名
		});
	});

	test('缺省取值 = 参数表 dv 那一档(下拉显示得出档名)', ()=>{
		sanshiWorkbenchParamFields().filter((f)=>f.kind !== 'input' && (!f.when || f.when({}))).forEach((f)=>{
			const list = f.optionsFor ? f.optionsFor({}) : f.options;
			const value = sanshiParamValue(f, {});
			expect(list.some((o)=>`${o.value}` === `${value}`)).toBe(true);
			expect(sanshiParamLabel(f, {})).toBe(list.find((o)=>`${o.value}` === `${value}`).label);
		});
	});

	test('改了哪个键,那个键的档名跟着变', ()=>{
		sanshiWorkbenchParamFields().filter((f)=>f.kind !== 'input' && !f.optionsFor && (!f.when || f.when({})) && f.options.length > 1).forEach((f)=>{
			const other = f.options.find((o)=>`${o.value}` !== `${sanshiParamValue(f, {})}`);
			expect(sanshiParamLabel(f, { [f.key]: other.value })).toBe(other.label);
		});
	});
});

describe('奇门择日:下拉取值走 selectValue,不碰原型', ()=>{
	test('源码里参数下拉的 value 用 selectValue 分支', ()=>{
		const src = fs.readFileSync(path.join(ZERI_DIR, 'QimenZeriWorkbench.js'), 'utf8');
		expect(src).toContain('value={f.selectValue ? f.selectValue(opts) : opts[f.key]}');
	});
	test('只有带换算的字段才有 selectValue,且换算结果是原始值', ()=>{
		const withSel = QIMEN_WORKBENCH_PARAM_FIELDS.filter((f)=>typeof f.selectValue === 'function');
		expect(withSel.map((f)=>f.key)).toEqual(['qijuMethod']);
		expect(['string', 'number']).toContain(typeof withSel[0].selectValue({ paiPanType: 3, qijuMethod: 'zhirun' }));
	});
});
