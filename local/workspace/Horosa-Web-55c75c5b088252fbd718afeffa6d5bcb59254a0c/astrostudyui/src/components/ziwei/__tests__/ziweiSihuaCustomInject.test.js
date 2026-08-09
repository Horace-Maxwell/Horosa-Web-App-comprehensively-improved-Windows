// [A4] 随盘自定义四化表注入链金标:
//   ① normalizeSihuaCustomTable 三态(合法/坏值/部分合法补全)
//   ② ZWSihuaCustom.override 优先级(custom 档:注入表 > localStorage > beipai 兜底)
//   ③ builder set/finally 源码守卫(注入必配对清理;绝不写 localStorage)
import * as ZWConst from '../../../constants/ZWConst';

const LEGAL = {
	甲: ['廉贞', '破军', '武曲', '太阳'], 乙: ['天机', '天梁', '紫微', '太阴'],
	丙: ['天同', '天机', '文昌', '廉贞'], 丁: ['太阴', '天同', '天机', '巨门'],
	戊: ['贪狼', '太阴', '右弼', '天机'], 己: ['武曲', '贪狼', '天梁', '文曲'],
	庚: ['太阳', '武曲', '太阴', '天相'], 辛: ['巨门', '太阳', '文曲', '文昌'],
	壬: ['天梁', '紫微', '左辅', '武曲'], 癸: ['破军', '巨门', '太阴', '贪狼'],
};

describe('[A4] normalizeSihuaCustomTable', ()=>{
	test('合法 JSON 字符串/对象均归一;十干齐全逐干相等', ()=>{
		const a = ZWConst.normalizeSihuaCustomTable(JSON.stringify(LEGAL));
		const b = ZWConst.normalizeSihuaCustomTable(LEGAL);
		expect(a).toEqual(LEGAL);
		expect(b).toEqual(LEGAL);
	});
	test('坏值全谱返 null:空串/坏 JSON/数组/行长≠4/星名空串', ()=>{
		expect(ZWConst.normalizeSihuaCustomTable('')).toBe(null);
		expect(ZWConst.normalizeSihuaCustomTable('  ')).toBe(null);
		expect(ZWConst.normalizeSihuaCustomTable('{bad json')).toBe(null);
		expect(ZWConst.normalizeSihuaCustomTable('[1,2]')).toBe(null);
		expect(ZWConst.normalizeSihuaCustomTable({ 甲: ['廉贞', '破军', '武曲'] })).toBe(null);
		expect(ZWConst.normalizeSihuaCustomTable({ 甲: ['廉贞', '破军', '武曲', ''] })).toBe(null);
	});
	test('部分合法=缺干回落通用表(beipai)补全', ()=>{
		const t = ZWConst.normalizeSihuaCustomTable({ 庚: ['太阳', '武曲', '天同', '天相'] });
		expect(t['庚']).toEqual(['太阳', '武曲', '天同', '天相']);
		expect(t['甲']).toEqual(ZWConst.SiHuaTables.beipai['甲']);
		expect(Object.keys(t).length).toBe(10);
	});
});

describe('[A4] ZWSihuaCustom.override 优先级(custom 档)', ()=>{
	const prevSchool = ZWConst.ZWSchool.school;
	afterEach(()=>{
		ZWConst.ZWSihuaCustom.override = null;
		ZWConst.ZWSchool.school = prevSchool;
		try{ localStorage.removeItem('ziweiSihuaCustom'); }catch(e){ /* noop */ }
	});
	test('🔴 注入表 > localStorage > beipai 兜底;清 override 即回落', ()=>{
		ZWConst.ZWSchool.school = 'custom';
		// 层3:无注入无 LS → beipai
		expect(ZWConst.getActiveSiHuaGan()).toBe(ZWConst.SiHuaTables.beipai);
		// 层2:LS
		const lsTable = { ...LEGAL, 甲: ['破军', '廉贞', '武曲', '太阳'] };
		localStorage.setItem('ziweiSihuaCustom', JSON.stringify(lsTable));
		expect(ZWConst.getActiveSiHuaGan()['甲']).toEqual(['破军', '廉贞', '武曲', '太阳']);
		// 层1:注入单例压过 LS
		ZWConst.ZWSihuaCustom.override = LEGAL;
		expect(ZWConst.getActiveSiHuaGan()['甲']).toEqual(['廉贞', '破军', '武曲', '太阳']);
		expect(ZWConst.getActiveSiHuaGan()['庚']).toEqual(['太阳', '武曲', '太阴', '天相']);
		// 清 override → 回落 LS
		ZWConst.ZWSihuaCustom.override = null;
		expect(ZWConst.getActiveSiHuaGan()['甲']).toEqual(['破军', '廉贞', '武曲', '太阳']);
	});
	test('非 custom 档不受注入影响(单例只在 custom 分支消费)', ()=>{
		ZWConst.ZWSchool.school = 'beipai';
		ZWConst.ZWSihuaCustom.override = LEGAL;
		expect(ZWConst.getActiveSiHuaGan()).toBe(ZWConst.SiHuaTables.beipai);
	});
});

describe('[A4] builder set/finally 源码守卫', ()=>{
	test('🔴 ZiWeiMain 注入必配对 finally 清 null;归一经 normalizeSihuaCustomTable;绝不写 localStorage', ()=>{
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
		expect(src.includes('normalizeSihuaCustomTable(params.sihuaCustomTable)')).toBe(true);
		expect(src.includes('ZWConst.ZWSihuaCustom.override = customSihua')).toBe(true);
		expect(src.includes('ZWConst.ZWSihuaCustom.override = null')).toBe(true);
		// finally 块内清理(set 与清都伴随 resetHuaMap 失效缓存)
		const fin = src.slice(src.indexOf('ZWConst.ZWSihuaCustom.override = null'));
		expect(fin.slice(0, 400).includes('resetHuaMap')).toBe(true);
		// 随盘表绝不落本机 LS(ziweiSihuaCustom 键只允许出现在读取注释,写入仅 ZiWeiInput 编辑器)
		expect(src.includes("safeLocalStorageSet('ziweiSihuaCustom'")).toBe(false);
		// 透传键在发后端前删除
		expect(src.includes('delete p.sihuaCustomTable')).toBe(true);
	});
	test('aiAnalysisContext 透传守卫:record.sihuaCustomTable 非空才挂', ()=>{
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'utils', 'aiAnalysisContext.js'), 'utf8');
		expect(src.includes('params.sihuaCustomTable = record.sihuaCustomTable')).toBe(true);
	});
});
