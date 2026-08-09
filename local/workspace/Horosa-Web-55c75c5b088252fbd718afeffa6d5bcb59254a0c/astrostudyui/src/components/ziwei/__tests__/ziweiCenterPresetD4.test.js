// [D4] 中宫内容/对宫线/太极角标/显示预设金标:
//   ① zwCenterContent 三档+坏值兜 clean ② 分派器结构(clean 零绘制;full 链式四方法;初一年柱 best-effort)
//   ③ 对宫线(开关+flyHouse 双守卫;点宫后才有=静态盘零变化) ④ 太极角标 slot2
//   ⑤ 显示预设:表结构/displayPresetOf 三态/apply 写入集合相等+恰一次 bump
import fs from 'fs';
import path from 'path';
import * as ZiWeiHelper from '../ZiWeiHelper';
import { ZW_DISPLAY_PRESETS, ZW_DISPLAY_PRESET_KEYS, displayPresetOf } from '../ziweiPresets';

afterEach(()=>{
	try{ localStorage.removeItem('ziweiCenterContent'); }catch(e){ /* noop */ }
});

describe('[D4] zwCenterContent', ()=>{
	test('默认 clean;bazi/full 生效;坏值兜 clean', ()=>{
		expect(ZiWeiHelper.zwCenterContent()).toBe('clean');
		localStorage.setItem('ziweiCenterContent', 'bazi');
		expect(ZiWeiHelper.zwCenterContent()).toBe('bazi');
		localStorage.setItem('ziweiCenterContent', 'full');
		expect(ZiWeiHelper.zwCenterContent()).toBe('full');
		localStorage.setItem('ziweiCenterContent', 'junk');
		expect(ZiWeiHelper.zwCenterContent()).toBe('clean');
	});
});

describe('[D4] 中宫分派器/对宫线/太极角标(源码守卫)', ()=>{
	const center = fs.readFileSync(path.join(__dirname, '..', 'ZWCenterHouse.js'), 'utf8');
	test('🔴 分派器:clean 早退(零绘制=现状);自适应面板承接(字号随宽推导/四柱四列均分/大限十列/初一年柱 best-effort);旧四方法零回潮', ()=>{
		const fn = center.slice(center.indexOf('\tdrawCenterContent(){'));
		const body = fn.slice(0, fn.indexOf('\n\t}\n'));
		expect(body.includes("mode === 'clean'")).toBe(true);
		expect(body.includes('drawCenterInfoPanel(mode)')).toBe(true);
		const panel = center.slice(center.indexOf('\tdrawCenterInfoPanel(mode){'));
		const pbody = panel.slice(0, panel.indexOf('\n\t}\n'));
		expect(pbody.includes('bw / 24')).toBe(true);              // 字号随中宫宽
		expect(pbody.includes('bw / 4')).toBe(true);               // 四柱四列均分撑满
		expect(pbody.includes('bw / direct.length')).toBe(true);   // 大限列均分撑满
		expect(pbody.includes('yearGZByLunar')).toBe(true);
		expect(pbody.includes("mode === 'full'")).toBe(true);
		// 旧固定字号四方法已删,防「写好零调用」回潮
		['\tdrawName(){', '\tdrawDate(x, y){', '\tdrawBaZi(x, y){', '\tdrawDouJun(x, y){'].forEach((sig)=>{
			expect(`${sig}:${center.includes(sig)}`).toBe(`${sig}:false`);
		});
		// draw 主链:内容先画(底层),四化飞线后叠
		expect(/drawCenterContent\(\);[\s\S]{0,220}drawShiTongZiHua\(\)/.test(center)).toBe(true);
	});
	test('🔴 对宫线:三合盘守卫(.chart 修正)+开关+flyHouse 空=零绘制;中心点法+对宫 (idx+6)%12', ()=>{
		const fn = center.slice(center.indexOf('\tdrawSanFanSiZeng(){'));
		const body = fn.slice(0, fn.indexOf('\n\t}\n'));
		expect(body.includes('ZWCont.ZWChart.chart !== ZWCont.ZWChart_SangHe')).toBe(true);
		expect(body.includes('zwShowSfszLine()')).toBe(true);
		expect(body.includes('this.zwchart.flyHouse')).toBe(true);
		expect(body.includes('(idx + 6) % 12')).toBe(true);
		expect(body.includes('drawDashLine')).toBe(true);
	});
	test('太极角标:huoPan+taijiIdx===本宫 → slot 2(与气数0/太岁1错列)', ()=>{
		const comm = fs.readFileSync(path.join(__dirname, '..', 'ZWCommHouse.js'), 'utf8');
		expect(/taijiIdx === this\.houseIndex[\s\S]{0,160}drawCornerTag\(\['太', '极'\][\s\S]{0,80}, 2\)/.test(comm)).toBe(true);
	});
	test('信息按钮:clean 居中/有内容让位底部', ()=>{
		expect(/zwCenterContent\(\) === 'clean'[\s\S]{0,120}this\.height - bh - 10/.test(center)).toBe(true);
	});
});

describe('[D4] 显示预设', ()=>{
	test('🔴 三档表:键集全等于 PRESET_KEYS(漏键=预设拨不全当场红);标准档=默认态', ()=>{
		Object.keys(ZW_DISPLAY_PRESETS).forEach((n)=>{
			expect(`${n}:${Object.keys(ZW_DISPLAY_PRESETS[n].flags).sort().join(',')}`)
				.toBe(`${n}:${[...ZW_DISPLAY_PRESET_KEYS].sort().join(',')}`);
		});
		// 标准档逐键=各开关无 LS 时的默认值(zwShow* 函数族)
		const dfltMap = {
			ziweiShowOthers: true, ziweiShowSmall: false, ziweiShowStarLight: true,
			ziweiShowLaiyin: true, ziweiShowBodyPalace: true,
			ziweiShowShaHuagai: true, ziweiShowShaSande: true, ziweiShowShaTaizuo: true,
			ziweiShowYearAges: false, ziweiShowXiaoxianAges: false, ziweiShowXiaoxianLayer: false,
			ziweiZihuaAlways: false, ziweiShowSfszLine: true,
		};
		ZW_DISPLAY_PRESET_KEYS.forEach((k)=>{
			expect(`${k}:${!!ZW_DISPLAY_PRESETS.standard.flags[k]}`).toBe(`${k}:${dfltMap[k]}`);
		});
	});
	test('displayPresetOf:命中三档/混合态=null', ()=>{
		const mk = (flags)=>(k)=>!!flags[k];
		expect(displayPresetOf(mk(ZW_DISPLAY_PRESETS.full.flags))).toBe('full');
		expect(displayPresetOf(mk(ZW_DISPLAY_PRESETS.standard.flags))).toBe('standard');
		expect(displayPresetOf(mk(ZW_DISPLAY_PRESETS.minimal.flags))).toBe('minimal');
		const mixed = { ...ZW_DISPLAY_PRESETS.minimal.flags, ziweiShowOthers: 1 };
		expect(displayPresetOf(mk(mixed))).toBe(null);
	});
	test('🔴 apply:全键写入 LS 相等+恰一次 bump(源码断言:循环写+末尾单 bump;JSX 挂三按钮)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'ZiWeiInput.js'), 'utf8');
		const fn = src.slice(src.indexOf('applyDisplayPreset(name)'));
		const body = fn.slice(0, fn.indexOf('\n\t}\n'));
		expect(body.includes('ZW_DISPLAY_PRESET_KEYS.forEach((k)=>{ safeLocalStorageSet(k')).toBe(true);
		const bumps = (body.match(/bumpZwDisplayRev\(/g) || []).length;
		expect(bumps).toBe(1);
		expect(src.includes('onDisplayPresetChange(v)')).toBe(true);   // 下拉单选形态(用户定版)
		expect(/onDisplayPresetChange\(val\)\{[\s\S]{0,120}val === 'custom'[\s\S]{0,60}applyDisplayPreset\(val\)/.test(src)).toBe(true);
	});
	test('有意不入预设的键登记在案(六煞黑字/双徽/范式B)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'ziweiPresets.js'), 'utf8');
		expect(src.includes('ziweiSixEvilBlack')).toBe(true);
		expect(src.includes('ziweiShowMingSihua/ziweiShowDaySihua')).toBe(true);
		expect(src.includes('flowShenshaOnChart')).toBe(true);
		expect(ZW_DISPLAY_PRESET_KEYS.includes('ziweiSixEvilBlack')).toBe(false);
		expect(ZW_DISPLAY_PRESET_KEYS.includes('ziweiShowMingSihua')).toBe(false);
	});
});
