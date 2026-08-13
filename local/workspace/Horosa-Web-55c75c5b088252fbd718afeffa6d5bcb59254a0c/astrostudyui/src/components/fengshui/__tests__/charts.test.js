// 风水 SVG 盘面组件 冒烟（确认 import/transpile + 渲染不抛 + 返回 svg，喂真实模块输出）。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LuoshuGrid from '../charts/LuoshuGrid';
import TwentyFourShanRing from '../charts/TwentyFourShanRing';
import EightPalaceDisk from '../charts/EightPalaceDisk';
import { xuankong } from '../xuankong';
import { zibai } from '../zibai';
import { sanhe } from '../sanhe';
import { jinsuo } from '../jinsuo';
import { qiankun } from '../qiankun';
import { bazhai } from '../bazhai';
import LuopanDial from '../charts/LuopanDial';
import XianfaRing from '../charts/XianfaRing';
import SixtyFourGuaCircle from '../charts/SixtyFourGuaCircle';
import XingshiFormGallery from '../charts/XingshiFormGallery';
import { LUOPAN_LAYERS, LUOPAN_DEFAULT_LAYERS, XINGSHI_9STAR, XUE_4TYPE, SHUICHENG_5, DAOZHANG_12 } from '../fengshuiData';

describe('风水 SVG 盘面 冒烟', ()=>{
	it('LuoshuGrid 渲染 玄空/紫白/八宅 三态', ()=>{
		expect(typeof LuoshuGrid).toBe('function');
		expect(LuoshuGrid({ palaces: xuankong(9, '午').palaces, mode: 'xuankong', highlightYun: 9 }).type).toBe('svg');
		expect(LuoshuGrid({ palaces: zibai({ year: 2026 }).yearPalaces, mode: 'zibai' }).type).toBe('svg');
		expect(LuoshuGrid({ palaces: bazhai({ zuoGua: '坎' }).palaces, mode: 'bazhai' }).type).toBe('svg');
	});
	it('TwentyFourShanRing 渲染 三合长生环 + 坐向', ()=>{
		const sh = sanhe({ shuiKou: '戌', waterFlow: 'leftToRight' });
		expect(TwentyFourShanRing({ ring: sh.ring, zuoShan: '子', xiangShan: '午' }).type).toBe('svg');
	});
});

// 第二批四图表（含 hooks，须走 SSR 渲染，不能当纯函数直调）。
const R = (el)=>renderToStaticMarkup(el);
const visible = (html)=>html.replace(/<[^>]*>/g, '\u0001');

describe('风水 SVG 盘面 冒烟 · 第二批', ()=>{
	// EightPalaceDisk 自 2026-08-12 起带 hooks(自量可用宽 → 盘铺满中栏),故由第一批移来此处走
	// SSR 渲染 —— 纯函数直调必 "Invalid hook call"。
	it('EightPalaceDisk 渲染 金锁 + 乾坤国宝', ()=>{
		const js = jinsuo({ sectors: { 坎: 'sand', 乾: 'water' } });
		const jsP = js.palaces.map((p)=>({ gong: p.gong, gua: p.gua, dir: p.dir, primary: p.actual === 'sand' ? '砂' : (p.actual === 'water' ? '水' : '平'), secondary: p.deWei ? '得位' : '失位', jx: p.deWei ? 'good' : 'bad' }));
		const jsHtml = R(<EightPalaceDisk palaces={jsP} centerLabel="金锁" />);
		expect(jsHtml).toContain('<svg');
		expect(jsHtml).toContain('金锁');
		const qk = qiankun({ zuoGua: '坎' });
		const qkP = qk.positions.map((p)=>({ gong: p.pos, dir: p.posName, primary: p.name.slice(0, 2), jx: p.jx }));
		const qkHtml = R(<EightPalaceDisk palaces={qkP} centerLabel="乾坤国宝" />);
		expect(qkHtml).toContain('<svg');
		expect(qkHtml).toContain('乾坤国宝');
	});

	// 🔴 格内文本收敛(用户实报改造化煞页「文字超出框架」):SVG <text> 既不换行也不截断,
	// 一长就画出格子压到隔壁宫。两条金标:①超长单串必被截断加省略号;②并列多项传数组时
	// 各占一行、逐行完整不截(挤成一行会丢尾字,实测「理·先后天火煞」丢过「火煞」)。
	it('EightPalaceDisk 格内长文本:单串截断 / 数组分行不丢字', ()=>{
		const long = '理·阴神满地／理·先后天火煞／理·斗牛煞／理·黄入贪狼';
		const one = R(<EightPalaceDisk palaces={[{ gong: 1, gua: '坎', primary: '3', secondary: long }]} centerLabel="化煞" size={324} />);
		expect(one).toContain('…');
		expect(one).not.toContain(long);
		const two = R(<EightPalaceDisk palaces={[{ gong: 1, gua: '坎', primary: '2', secondary: ['理·阴神满地', '理·先后天火煞'] }]} centerLabel="化煞" size={324} />);
		expect(two).toContain('理·阴神满地');
		expect(two).toContain('理·先后天火煞');
		expect(two).not.toContain('…');
	});

	// 量不到容器(SSR/jsdom 无布局)时必须回落传入的 size —— 绝不因量不到画成 0。
	it('EightPalaceDisk 无布局环境回落 size,不塌成 0', ()=>{
		const html = R(<EightPalaceDisk palaces={[{ gong: 1, primary: '1' }]} centerLabel="x" size={480} />);
		expect(html).toContain('width="480"');
		expect(html).toContain('height="480"');
	});

	it('LuopanDial 全层/默认层/单层/无参 均出 svg 且无 NaN', ()=>{
		const all = R(<LuopanDial deg={176.4} zuoShan="子" xiangShan="午" layers={LUOPAN_LAYERS.map((l)=>l.key)} />);
		expect(all.startsWith('<svg')).toBe(true);
		expect(all).toContain('horosa-fs-luopan');
		expect(all).toContain('176.4°');
		expect(all).not.toMatch(/NaN/);
		const cells = LUOPAN_LAYERS.reduce((a, l)=>a + (l.cells || []).length, 0);
		expect((all.match(/<path/g) || []).length).toBeGreaterThanOrEqual(cells);
		const def = R(<LuopanDial deg={0} layers={LUOPAN_DEFAULT_LAYERS} />);
		expect((def.match(/<path/g) || []).length).toBeLessThan((all.match(/<path/g) || []).length);
		expect(R(<LuopanDial layers={['dipan']} />).startsWith('<svg')).toBe(true);
		expect(R(<LuopanDial />).startsWith('<svg')).toBe(true);
	});
	it('XianfaRing 有度/无度', ()=>{
		expect(R(<XianfaRing deg={345.5} />)).toContain('345.5°');
		expect(R(<XianfaRing />)).toContain('填坐山度数以定格');
		expect(R(<XianfaRing deg={345.5} />)).not.toMatch(/NaN/);
	});
	it('SixtyFourGuaCircle 落卦/空态/合十弦/全周扫描', ()=>{
		expect(R(<SixtyFourGuaCircle deg={199.7} />)).toContain('乾为天');
		expect(R(<SixtyFourGuaCircle />)).toContain('六十四卦圆图');
		expect(R(<SixtyFourGuaCircle deg={199.7} heShiOf="坤为地" />)).toContain('stroke-dasharray');
		for (let d = 0; d < 360; d += 11.3) { expect(R(<SixtyFourGuaCircle deg={d} />).startsWith('<svg')).toBe(true); }
	});
	it('XingshiFormGallery 四组图卡齐全 + 选中态', ()=>{
		const n = XINGSHI_9STAR.length + XUE_4TYPE.length + SHUICHENG_5.length + DAOZHANG_12.length;
		const a = R(<XingshiFormGallery sel={{}} />);
		expect((a.match(/horosa-fs-form-card/g) || []).length).toBe(n);
		expect(a).toContain('寻龙九星形体');
		expect(a).toContain('倒杖十二法');
		const b = R(<XingshiFormGallery sel={{ longStar: '贪狼', xueType: '窝穴', shuiCheng: '金城', daoZhang: '顺杖' }} />);
		expect((b.match(/is-active/g) || []).length).toBe(4);
	});
	it('🔴 显示层零来源泄漏：四图表输出无 § / 书名 / 「手册」字样', ()=>{
		[R(<LuopanDial deg={90} layers={LUOPAN_LAYERS.map((l)=>l.key)} />), R(<XianfaRing deg={90} />),
			R(<SixtyFourGuaCircle deg={90} />), R(<XingshiFormGallery sel={{}} />)].forEach((h)=>{
			expect(visible(h)).not.toMatch(/§|手册/);
		});
	});
});
