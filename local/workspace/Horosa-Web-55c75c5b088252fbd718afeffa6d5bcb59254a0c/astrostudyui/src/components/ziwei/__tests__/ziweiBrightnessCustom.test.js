// [B14] 自定义亮度表金标:
//   ① normalize 三态 ② starLightOf custom 档层级(注入>LS>基表;缺格回落) ③ 编辑器快照/重置纯函数
//   ④ builder set/finally 源码守卫 ⑤ 默认档零渗漏(custom 不进 needsLocalEngine)
import {
	STAR_LIGHT, starLightOf, BRIGHTNESS_GRADES,
	normalizeBrightnessCustomTable, ZWBrightnessCustom, resetBrightnessCustomCache,
} from '../data/ziweiTables';
import { snapshotFromSource, STAR_GROUPS } from '../ZWBrightnessCustomModal';

afterEach(()=>{
	ZWBrightnessCustom.override = null;
	try{ localStorage.removeItem('ziweiBrightnessCustom'); }catch(e){ /* noop */ }
	resetBrightnessCustomCache();
});

describe('[B14] normalizeBrightnessCustomTable', ()=>{
	test('合法对象/JSON 归一;非法支/非法档逐格丢弃;空表返 null', ()=>{
		const t = normalizeBrightnessCustomTable({ 紫微: { 子: '庙', 丑: '坏档', 猫: '旺' }, 天机: 'not-obj' });
		expect(t).toEqual({ 紫微: { 子: '庙' } });
		expect(normalizeBrightnessCustomTable(JSON.stringify({ 火星: { 亥: '陷' } }))).toEqual({ 火星: { 亥: '陷' } });
		expect(normalizeBrightnessCustomTable('')).toBe(null);
		expect(normalizeBrightnessCustomTable('{bad')).toBe(null);
		expect(normalizeBrightnessCustomTable({ 紫微: { 子: '错' } })).toBe(null);
	});
	test('档值域恰 9 值', ()=>{
		expect(BRIGHTNESS_GRADES).toEqual(['庙', '旺', '得', '地', '利', '平', '闲', '不', '陷']);
	});
});

describe('[B14] starLightOf custom 档', ()=>{
	test('🔴 层级:注入单例 > LS > 基表;命中格用其值,缺格回落基表', ()=>{
		// 无表:custom 档 === 基表(全格)
		expect(starLightOf('紫微', '子', 'custom')).toBe(STAR_LIGHT['紫微']['子']);
		// LS 层
		localStorage.setItem('ziweiBrightnessCustom', JSON.stringify({ 紫微: { 子: '陷' } }));
		resetBrightnessCustomCache();
		expect(starLightOf('紫微', '子', 'custom')).toBe('陷');
		expect(starLightOf('紫微', '丑', 'custom')).toBe(STAR_LIGHT['紫微']['丑']);   // 缺格回落
		// 注入层压过 LS
		ZWBrightnessCustom.override = { 紫微: { 子: '庙' } };
		expect(starLightOf('紫微', '子', 'custom')).toBe('庙');
		// 清注入回落 LS
		ZWBrightnessCustom.override = null;
		expect(starLightOf('紫微', '子', 'custom')).toBe('陷');
	});
	test('非 custom 源不受注入/LS 影响(既有档零回归)', ()=>{
		ZWBrightnessCustom.override = { 紫微: { 子: '陷' } };
		localStorage.setItem('ziweiBrightnessCustom', JSON.stringify({ 紫微: { 子: '陷' } }));
		resetBrightnessCustomCache();
		expect(starLightOf('紫微', '子', 'zi_jian')).toBe(STAR_LIGHT['紫微']['子']);
		expect(starLightOf('擎羊', '子', 'quanshu')).toBe('旺');
	});
	test('LS 缓存:写后未 reset 仍读旧值,reset 后生效(编辑器保存必配 reset 的行为依据)', ()=>{
		expect(starLightOf('天机', '子', 'custom')).toBe(STAR_LIGHT['天机']['子']);   // 建立缓存(null)
		localStorage.setItem('ziweiBrightnessCustom', JSON.stringify({ 天机: { 子: '陷' } }));
		expect(starLightOf('天机', '子', 'custom')).toBe(STAR_LIGHT['天机']['子']);   // 缓存未失效
		resetBrightnessCustomCache();
		expect(starLightOf('天机', '子', 'custom')).toBe('陷');
	});
});

describe('[B14] 编辑器纯函数', ()=>{
	test('星组 32 星四组无重无漏(与亮度表全集一致)', ()=>{
		const all = STAR_GROUPS.flatMap((g)=>g.stars);
		expect(all.length).toBe(32);
		expect(new Set(all).size).toBe(32);
		const tableStars = Object.keys(STAR_LIGHT);
		all.forEach((s)=>expect(`${s}:${tableStars.includes(s)}`).toBe(`${s}:true`));
	});
	test('snapshotFromSource:逐格=starLightOf(该源);custom 源快照落 zi_jian(避免自引用)', ()=>{
		const snap = snapshotFromSource('quanshu');
		expect(snap['擎羊']['子']).toBe('旺');
		expect(snap['紫微']['子']).toBe(starLightOf('紫微', '子', 'quanshu'));
		const snapC = snapshotFromSource('custom');
		expect(snapC['紫微']['子']).toBe(starLightOf('紫微', '子', 'zi_jian'));
	});
});

describe('[B14] builder/needsLocalEngine 守卫', ()=>{
	const fs = require('fs'); const path = require('path');
	test('🔴 ZiWeiMain 注入必配对 finally 清 null;透传键发后端前删除;绝不写 LS', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
		expect(src.includes('normalizeBrightnessCustomTable(params.brightnessCustomTable)')).toBe(true);
		expect(src.includes('ZWBrightnessCustom.override = customBrightness')).toBe(true);
		expect(src.includes('ZWBrightnessCustom.override = null')).toBe(true);
		expect(src.includes('delete p.brightnessCustomTable')).toBe(true);
		expect(src.includes("safeLocalStorageSet('ziweiBrightnessCustom'")).toBe(false);
	});
	test('🔴 custom 亮度绝不进 needsLocalEngine(纯显示层;开着不该逼本地引擎重排)', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'ziweiOptions.js'), 'utf8');
		const fn = src.slice(src.indexOf('export function ziweiNeedsLocalEngine'));
		// 只查 return 判断链(首个分号前);其后的「为何不进」注释合法提及键名,不算命中。
		const body = fn.slice(0, fn.indexOf(';'));
		expect(body.includes('brightnessSource')).toBe(false);
		expect(body.includes('brightnessCustom')).toBe(false);
	});
});
