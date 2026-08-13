/**
 * 五兆四链同源哨兵 —— 挂载 schema / 挂载 builder / 请求体 / 存案 / 导出段表。
 *
 * 病灶原型:挂载设置面能设的档位,builder 却只手抄了一部分键 → 用户设了没反应,
 * 是彻头彻尾的死开关,而既有测试全绿(因为各自单测各自的一半)。
 * 本测试把「能设的键集」与「读得到的键集」摆在一起比,差集非空即失败。
 */
import { WUZHAO_CALC_OPTION_KEYS } from '../WuZhaoMain';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../../../utils/techniqueMountSettings';
import { AI_EXPORT_PRESET_SECTIONS, getOptionsForTechniqueKey } from '../../../utils/aiExport';
import PAN from './fixtures/wuzhaoPan.json';

const SRC_CONTEXT = require('fs').readFileSync(
	require('path').resolve(__dirname, '../../../utils/aiAnalysisContext.js'), 'utf8');

describe('五兆四链同源', () => {
	test('①挂载 schema 的字段 ⊆ 计算类键集（能设的必是算得到的）', () => {
		const schema = TECHNIQUE_SETTINGS_SCHEMA.wuzhao;
		expect(schema).toBeTruthy();
		const schemaKeys = (schema.fields || []).map((f)=>f.name);
		expect(schemaKeys.length).toBeGreaterThan(0);
		const orphan = schemaKeys.filter((k)=>WUZHAO_CALC_OPTION_KEYS.indexOf(k) < 0);
		expect(orphan).toEqual([]);   // schema 里有而排盘不吃的键 = 死开关
	});

	test('②计算类键集里的起兆/断法档位都在挂载 schema 中可设（不藏功能）', () => {
		const schemaKeys = (TECHNIQUE_SETTINGS_SCHEMA.wuzhao.fields || []).map((f)=>f.name);
		const missing = WUZHAO_CALC_OPTION_KEYS.filter((k)=>schemaKeys.indexOf(k) < 0);
		expect(missing).toEqual([]);
	});

	test('③挂载 builder 走键集遍历,绝不手抄白名单', () => {
		const branch = SRC_CONTEXT.split("case 'wuzhao': {")[1].split('\tcase ')[0];
		expect(branch).toBeTruthy();
		// 必须引用共享键集
		expect(branch).toContain('WUZHAO_CALC_OPTION_KEYS');
		// 🔴 不得再出现逐键手抄(mode: wv(p.mode, oo.mode) 之属)
		expect(branch).not.toMatch(/mode:\s*wv\(/);
		expect(branch).not.toMatch(/manualSplits:\s*wv\(/);
		// import 处须取到该键集
		expect(SRC_CONTEXT).toContain('WUZHAO_CALC_OPTION_KEYS');
	});

	test('④导出段表含古法层六段,且与后端段名逐字一致', () => {
		const preset = AI_EXPORT_PRESET_SECTIONS.wuzhao;
		expect(preset).toBeTruthy();
		[
			'起盘', '揲筮', '兆', '木乡', '火乡', '土乡', '金乡', '水乡', '特殊标记',
			'断辞', '君子小人', '纳甲', '神煞', '行神', '类占',
		].forEach((title)=>{ expect(preset).toContain(title); });
		// 既有九段的次第为向后相容契约,不得改序
		expect(preset.slice(0, 9)).toEqual(
			['起盘', '揲筮', '兆', '木乡', '火乡', '土乡', '金乡', '水乡', '特殊标记']);
	});

	test('⑥导出设置面板提供的段 = preset 全集(用户可逐段勾选,零段漏出面板)', () => {
		const options = getOptionsForTechniqueKey('wuzhao');
		AI_EXPORT_PRESET_SECTIONS.wuzhao.forEach((t)=>{ expect(options).toContain(t); });
	});

	test('⑦真实快照的段名全部落在导出设置面板里(产出与可勾选项不脱节)', () => {
		// 快照段头 [X] 逐个必须能在面板里勾到,否则用户永远关不掉/开不出那一段
		const titles = (PAN.zhushu.snapshot.match(/^\[([^\]]+)\]$/gm) || [])
			.map((s)=>s.replace(/^\[|\]$/g, ''));
		expect(titles.length).toBe(15);
		const options = getOptionsForTechniqueKey('wuzhao');
		titles.forEach((t)=>{ expect(options).toContain(t); });
	});

	test('⑧帮助文档五兆章覆盖全部起兆法与右栏页签(加了档位忘写帮助即红)', () => {
		const help = require('fs').readFileSync(
			require('path').resolve(__dirname, '../../help/CnyibuHelpDoc.js'), 'utf8');
		const chapter = help.split('<div style={h}>五兆</div>')[1].split('<div style={h}>太玄</div>')[0];
		expect(chapter).toBeTruthy();
		const main = require('fs').readFileSync(
			require('path').resolve(__dirname, '../WuZhaoMain.js'), 'utf8');
		// 起兆法：取标签的核心词（帮助里「日干 / 时干 / 分干起盘」合并成一条，故按词而非整串）
		const modes = main.split('const MODE_OPTIONS')[1].split('];')[0];
		const labels = [...modes.matchAll(/label: '([^']+)'/g)].map((m)=>m[1]);
		expect(labels.length).toBe(8);
		labels.forEach((label)=>{
			const core = label.replace(/起盘$/, '');
			expect(chapter).toContain(core);
		});
		// 右栏页签名逐个在帮助里
		[...main.matchAll(/<TabPane tab="([^"]+)" key="\w+">/g)].map((m)=>m[1])
			.forEach((tab)=>{ expect(chapter).toContain(tab); });
		// 断法四项
		['六神显示', '行神月制', '年命支', '性别'].forEach((k)=>{ expect(chapter).toContain(k); });
		// 保密：零今人姓名、零私档名、零节号
	});

	test('⑤挂载 schema 的 showWhen 条件键都是真实档位(不指向不存在的字段)', () => {
		const fields = TECHNIQUE_SETTINGS_SCHEMA.wuzhao.fields || [];
		const names = new Set(fields.map((f)=>f.name));
		fields.filter((f)=>typeof f.showWhen === 'function').forEach((f)=>{
			// 用探针对象记录 showWhen 读了哪些键
			const read = [];
			const probe = new Proxy({}, { get(_t, k){ read.push(k); return undefined; } });
			try{ f.showWhen(probe); }catch(e){ /* 读了就够,返回值无关 */ }
			read.filter((k)=>typeof k === 'string').forEach((k)=>{
				expect(names.has(k) || WUZHAO_CALC_OPTION_KEYS.indexOf(k) >= 0).toBe(true);
			});
		});
	});
});
