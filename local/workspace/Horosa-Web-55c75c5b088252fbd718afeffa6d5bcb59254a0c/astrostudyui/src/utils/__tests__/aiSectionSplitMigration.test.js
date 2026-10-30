// 拆段迁移:段自某母段拆出成独立段后,导出设置走 union 窗;数据源级的逐源段白名单(segments)按单源表
// AI_SECTION_SPLITS 一次性补新段(勾了母段就补上;迁过的不再补,不复活用户之后取消的段)。
import * as presets from '../aiExport/presets';

const { AI_SECTION_SPLITS, AI_SECTION_SPLIT_LATEST, migrateSplitSegments } = presets;
// union 窗里「本版才诞生、不是自哪段拆出」的段(新内容,无母段可迁):逐窗写明。新窗不在拆段表、也不在这里 = 红(必须先分类)
const NEWBORN_WINDOWS = {
	45: '补构建器实产段(新内容)', 49: '新段', 50: '新页签对应的新段', 51: '新段', 52: '新段', 53: '新段', 54: '新段', 55: '新段',
	56: '内容完备性审计新生段', 58: '新段', 60: '新段(量化盘中点坐标 / 公式求解)',
};

describe('拆段映射合同', ()=>{
	const windows = Object.keys(presets).map((k)=>/^AI_EXPORT_V(\d+)_SECTION_UNION$/.exec(k)).filter(Boolean).map((m)=>Number(m[1]));
	it('🔴 每个 union 窗都已分类:要么在拆段表(自某段拆出),要么登记为新生段', ()=>{
		expect(windows.length).toBeGreaterThanOrEqual(12);
		const split = new Set(AI_SECTION_SPLITS.map((x)=>x.version));
		const unclassified = windows.filter((v)=>!split.has(v) && !Object.prototype.hasOwnProperty.call(NEWBORN_WINDOWS, `${v}`));
		expect(unclassified).toEqual([]);
	});
	it('🔴 拆段表每行:新段就是该窗登记的段、键集合 = 该窗的键;母段与新段同在各键的预设段里', ()=>{
		AI_SECTION_SPLITS.forEach((sp)=>{
			const win = presets[`AI_EXPORT_V${sp.version}_SECTION_UNION`];
			expect(win).toBeTruthy();
			expect(sp.keys.slice().sort()).toEqual(Object.keys(win).sort());
			sp.keys.forEach((k)=>{
				expect([k, win[k]]).toEqual([k, [sp.child]]);
				const preset = presets.AI_EXPORT_PRESET_SECTIONS[k] || [];
				expect([k, preset.indexOf(sp.parent) >= 0, preset.indexOf(sp.child) >= 0]).toEqual([k, true, true]);
			});
		});
		expect(AI_SECTION_SPLIT_LATEST).toBe(Math.max(...AI_SECTION_SPLITS.map((x)=>x.version)));
	});
});

describe('逐源段白名单迁移', ()=>{
	it('纯函数:勾了母段补新段(紧跟母段);没勾母段不补;已迁过不补;键不在该窗不补', ()=>{
		expect(migrateSplitSegments('germany', ['行星', '汉堡学派要素'], 0)).toEqual(['行星', '汉堡学派要素', '赤纬接触']);
		expect(migrateSplitSegments('germany', ['行星'], 0)).toEqual(['行星']);
		expect(migrateSplitSegments('germany', ['汉堡学派要素'], 59)).toEqual(['汉堡学派要素']);
		expect(migrateSplitSegments('bazi', ['汉堡学派要素'], 0)).toEqual(['汉堡学派要素']);
		expect(migrateSplitSegments('astrochart', ['主宰星链'], 57)).toEqual(['主宰星链']);
		expect(migrateSplitSegments('astrochart', ['主宰星链'], 56)).toEqual(['主宰星链', '分宫制宫神星表']);
		expect(migrateSplitSegments('germany', [], 0)).toEqual([]);   // [] = 显式全清,不动
	});
});

