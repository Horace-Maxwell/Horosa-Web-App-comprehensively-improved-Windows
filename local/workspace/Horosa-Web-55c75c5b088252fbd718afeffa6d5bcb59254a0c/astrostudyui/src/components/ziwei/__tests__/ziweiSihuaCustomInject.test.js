// 随盘自定义四化表注入链金标:
//   ① normalizeSihuaCustomTable 三态(合法/坏值/部分合法补全)
//   ② ZWSihuaCustom.override 优先级(custom 档:注入表 > localStorage > beipai 兜底)
//   ③ builder set/finally 源码守卫(注入必配对清理;绝不写 localStorage)
import * as ZWConst from '../../../constants/ZWConst';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const LEGAL = {
	甲: ['廉贞', '破军', '武曲', '太阳'], 乙: ['天机', '天梁', '紫微', '太阴'],
	丙: ['天同', '天机', '文昌', '廉贞'], 丁: ['太阴', '天同', '天机', '巨门'],
	戊: ['贪狼', '太阴', '右弼', '天机'], 己: ['武曲', '贪狼', '天梁', '文曲'],
	庚: ['太阳', '武曲', '太阴', '天相'], 辛: ['巨门', '太阳', '文曲', '文昌'],
	壬: ['天梁', '紫微', '左辅', '武曲'], 癸: ['破军', '巨门', '太阴', '贪狼'],
};

describe('normalizeSihuaCustomTable', ()=>{
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

describe('ZWSihuaCustom.override 优先级(custom 档)', ()=>{
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

describe('按盘临时覆盖(挂载快照 / 盘面截图共用 applyZiweiRecordOverride)', ()=>{
	test('🔴 随盘自定义四化表:归一后注入、还原清掉、四化缓存随之失效;全程不写本机偏好', ()=>{
		const { applyZiweiRecordOverride } = require('../ZiWeiMain');
		const ZiWeiHelper = require('../ZiWeiHelper');
		const prevSchool = ZWConst.ZWSchool.school;
		const writes = jest.spyOn(Storage.prototype, 'setItem');
		const resets = jest.spyOn(ZiWeiHelper, 'resetHuaMap');
		try{
			ZWConst.ZWSihuaCustom.override = null;
			const restore = applyZiweiRecordOverride({ sihuaSchool: 'custom', sihuaCustomTable: JSON.stringify(LEGAL) });
			expect(ZWConst.ZWSihuaCustom.override).toEqual(ZWConst.normalizeSihuaCustomTable(JSON.stringify(LEGAL)));
			const nReset = resets.mock.calls.length;
			restore();
			expect(ZWConst.ZWSihuaCustom.override).toBe(null);
			expect(resets.mock.calls.length).toBeGreaterThan(nReset);
			expect(writes.mock.calls.filter((c)=>/ziwei/i.test(`${c[0]}`))).toEqual([]);
		}finally{
			writes.mockRestore(); resets.mockRestore();
			ZWConst.ZWSchool.school = prevSchool; ZWConst.ZWSihuaCustom.override = null; ZWConst.refreshActiveSiHua();
		}
	});
	test('透传键在发后端前删除(请求体不带随盘表)', ()=>{
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
		expect(src.includes('delete p.sihuaCustomTable')).toBe(true);
	});
	test('aiAnalysisContext 透传守卫:record.sihuaCustomTable 非空才挂', ()=>{
		const fs = require('fs'); const path = require('path');
		const src = readSource(path.resolve(__dirname, '..', '..', '..', 'utils', 'aiAnalysisContext.js'));
		expect(src.includes('params.sihuaCustomTable = record.sihuaCustomTable')).toBe(true);
	});
});
