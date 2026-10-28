// 择日工作台 / 宿主共用小工具单一来源:zeriTreeOps(条件树路径工具、方案导出存文件、连接门选项、判读树门名、日期串)
// 与 zeriHostUtils(补零 / 今日日期串 / fields 单项 / 建 DateTime)。各工作台与宿主不再各抄一份。
jest.mock('../../../utils/aiAnalysisExport', ()=>({ saveBlobSmart: jest.fn(()=>'saved') }));

import fs from 'fs';
import path from 'path';
import { downloadJson, JOINER_OPTIONS, getAt, mapAt, removeAt, collectUiLeaves, GATE_CN2, dateStrOf, pad2 as treePad2 } from '../zeriTreeOps';
import { pad2, todayStr, mkField, mkDT } from '../zeriHostUtils';
import { ZERI_GATE_CN } from '../../../divination/zeri/zeriExplainText';

const { saveBlobSmart } = require('../../../utils/aiAnalysisExport');
const DIR = path.join(__dirname, '..');
const read = (f)=>fs.readFileSync(path.join(DIR, f), 'utf8');

const WORKBENCHES = ['BaziZeriWorkbench.js', 'HuangliZeriWorkbench.js', 'IndiaZeriWorkbench.js', 'LiurengZeriWorkbench.js', 'QimenZeriWorkbench.js',
	'QizhengZeriWorkbench.js', 'SanshiZeriWorkbench.js', 'TaiyiZeriWorkbench.js', 'ZiweiZeriWorkbench.js'];
const HOSTS = ['BaziZeriMain.js', 'HuangliZeriMain.js', 'IndiaZeriMain.js', 'LiurengZeriMain.js', 'QizhengZeriMain.js', 'SanshiZeriMain.js', 'TaiyiZeriMain.js', 'ZiweiZeriMain.js'];

describe('zeriTreeOps', ()=>{
	const tree = { kind: 'group', children: [
		{ kind: 'leaf', type: 'a' },
		{ kind: 'group', children: [{ kind: 'leaf', type: 'b' }, { kind: 'leaf', type: 'c' }] },
	] };

	test('树路径取 / 改 / 删:不改原树', ()=>{
		expect(getAt(tree, [])).toBe(tree);
		expect(getAt(tree, [1, 0]).type).toBe('b');
		expect(getAt(tree, [0, 0])).toBe(null);
		expect(getAt(tree, [5])).toBe(null);
		const t2 = mapAt(tree, [1, 1], (n)=>({ ...n, type: 'z' }));
		expect(getAt(t2, [1, 1]).type).toBe('z');
		expect(getAt(tree, [1, 1]).type).toBe('c');
		const t3 = removeAt(tree, [1, 0]);
		expect(getAt(t3, [1]).children.map((n)=>n.type)).toEqual(['c']);
		expect(removeAt(tree, [])).toBe(tree);
	});

	test('UI 叶按 DFS 序收集', ()=>{
		expect(collectUiLeaves(tree, []).map((n)=>n.type)).toEqual(['a', 'b', 'c']);
		expect(collectUiLeaves(null, [])).toEqual([]);
	});

	test('连接门选项 / 判读树门名 / 日期串', ()=>{
		expect(JOINER_OPTIONS.map((o)=>o.value)).toEqual(['all', 'any', 'xor']);
		expect(GATE_CN2).toBe(ZERI_GATE_CN);
		expect(GATE_CN2.not).toBe('非(取反)');
		expect(dateStrOf(new Date(2026, 0, 5))).toBe('2026-01-05');
		expect(treePad2).toBe(pad2);
	});

	test('方案导出存文件:走保存桥;抛错静默回 null', ()=>{
		expect(downloadJson('{"a":1}', 'x.json')).toBe('saved');
		expect(saveBlobSmart).toHaveBeenCalledWith('x.json', expect.any(Blob));
		saveBlobSmart.mockImplementationOnce(()=>{ throw new Error('boom'); });
		expect(downloadJson('{}', 'y.json')).toBe(null);
	});
});

describe('zeriHostUtils', ()=>{
	test('补零 / fields 单项 / 建 DateTime', ()=>{
		expect(pad2(3)).toBe('03');
		expect(pad2(12)).toBe('12');
		expect(mkField(5)).toEqual({ value: 5 });
		const dt = mkDT('2026-03-04 05:06:07');
		expect(dt.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-03-04 05:06:07');
	});
	test('今日日期串', ()=>{
		const d = new Date();
		expect(todayStr()).toBe(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
	});
});

describe('源码:工作台 / 宿主改从单一来源取', ()=>{
	test('九个工作台 + 天星条件构建框不再各自定义树工具', ()=>{
		[...WORKBENCHES, 'ConditionBuilderModal.js'].forEach((f)=>{
			const src = read(f);
			expect(src).toMatch(/^import \{ downloadJson, JOINER_OPTIONS, getAt, mapAt, removeAt, collectUiLeaves, GATE_CN2(, dateStrOf)? \} from '\.\/zeriTreeOps';$/m);
			['downloadJson', 'getAt', 'mapAt', 'removeAt', 'collectUiLeaves', 'pad2', 'dateStrOf'].forEach((n)=>{
				expect(src).not.toContain(`function ${n}(`);
			});
			expect(src).not.toMatch(/^const (JOINER_OPTIONS|GATE_CN2) = /m);
		});
	});
	test('八个宿主不再各自定义补零 / 今日 / fields 单项 / 建 DateTime', ()=>{
		HOSTS.forEach((f)=>{
			const src = read(f);
			expect(src).toMatch(/^import \{ [\w, ]+ \} from '\.\/zeriHostUtils';$/m);
			['pad2', 'todayStr', 'mkField', 'mkDT'].forEach((n)=>{
				expect(src).not.toContain(`function ${n}(`);
			});
		});
	});
});
