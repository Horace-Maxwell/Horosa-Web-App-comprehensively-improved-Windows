// [概览浮窗·真组件时代] SSR smoke:概览=中栏真组件本体(2026-08-30 定案)。
// SSR(renderToStaticMarkup)口径:useMemo 同步跑、useEffect 不跑 ——
//   同步卡(八字 PaiBaZi/太乙 TaiyiBoardSvg/三式奇门+太乙段)锚真盘内容;
//   异步卡(紫微 rules/六壬双响应)恒「排盘中…」骨架,真盘内容断言由真机走查覆盖。
// 判别向量(建档时人工注错自证):computePan=null → 三式奇门段「—」;八字 useMemo 抛 → 排盘失败。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ZeriMiniPanPopup from '../../../components/zeri/ZeriMiniPanPopup';
import { computeTaiyiScanPan } from '../taiyiZeriScanEngine';

const GEO = { zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
const ROW = { start: '2026-05-14 08:00', pick: '2026-05-14 08:01', end: '2026-05-14 10:00' };

function mount(tech, computePan, techOptions){
	const html = renderToStaticMarkup(
		<ZeriMiniPanPopup tech={tech} row={ROW} computePan={computePan || null} geo={GEO} onClose={()=>{}} techOptions={techOptions} />
	);
	return html.replace(/<[^>]+>/g, '¦');
}

describe('概览浮窗真组件 SSR smoke', ()=>{
	it('八字:PaiBaZi 真组件全渲染(乾造头+四柱干支+十神藏干层)', ()=>{
		const txt = mount('bazi');
		['乾造', '正财', '比肩'].forEach((k)=>{
			expect(txt.indexOf(k) >= 0 ? 'ok' : `缺${k}`).toBe('ok');
		});
		// 2026-05-14=丙午年癸巳月戊子日(JDN 锚 2026-05-18=壬辰 回退 4 日;全年份域权威化同源);
		// PaiBaZi 天干/地支分行渲染 → 逐字锚(连串「丙午」在 SSR 文本中不相邻)
		['丙', '午', '癸', '巳', '戊', '子'].forEach((z)=>{
			expect(txt.indexOf(z) >= 0 ? 'ok' : `缺${z}`).toBe('ok');
		});
	});
	it('太乙:TaiyiBoardSvg 真组件全渲染(十六宫+三算+局)——概览盘=扫描同一张盘', ()=>{
		const txt = mount('taiyi', null, { tn: 0 });
		['大威', '天道', '大武', '阴德', '太阳', '大神'].forEach((k)=>{
			expect(txt.indexOf(k) >= 0 ? 'ok' : `缺宫神${k}`).toBe('ok');
		});
		['主算', '客算', '定算', '太乙数', '中宫'].forEach((k)=>{
			expect(txt.indexOf(k) >= 0 ? 'ok' : `缺${k}`).toBe('ok');
		});
		expect(/[阴阳]遁[一二三四五六七八九十]+局/.test(txt)).toBe(true);
	});
	it('太乙:引擎盘与卡内盘同源恰等(kook/三算逐值)', ()=>{
		const pan = computeTaiyiScanPan(GEO, { tn: 0 }, '2026-05-14', '08:01:00');
		const txt = mount('taiyi', null, { tn: 0 });
		expect(pan && pan.kook ? 'has' : 'null').toBe('has');
		[pan.kook.text, `主算:${pan.homeCal}`, `客算:${pan.awayCal}`, `定算:${pan.setCal}`].forEach((k)=>{
			expect(txt.indexOf(k) >= 0 ? 'ok' : `缺${k}`).toBe('ok');
		});
	});
	it('三式:一体化盘卡(SanshiUnitedBoard;数据异步 → SSR 恒骨架不崩)', ()=>{
		// 设计定案(2026-08-30):三式概览=中栏「三式合一盘」本体,非三张独立盘。
		// 数据链 fetchChart+fetchQimenPan+六壬三件套全在 useEffect → SSR 只render骨架;
		// 一体化盘内容断言由真机走查覆盖(主页盘/概览盘双截图核对)。
		const txt = mount('sanshi', null);
		expect(txt.indexOf('排盘中') >= 0 ? 'ok' : '三式卡无骨架').toBe('ok');
	});
	it('紫微/六壬:异步卡 SSR 恒骨架(不崩、不空白)', ()=>{
		['ziwei', 'liureng'].forEach((tech)=>{
			const txt = mount(tech);
			expect(txt.indexOf('排盘中') >= 0 ? 'ok' : `${tech} 无骨架`).toBe('ok');
		});
	});
	it('防御:行时刻非法 → 报错文案', ()=>{
		const html = renderToStaticMarkup(
			<ZeriMiniPanPopup tech="taiyi" row={{ start: 'garbage' }} computePan={null} geo={GEO} onClose={()=>{}} />
		);
		expect(html.indexOf('排盘失败') >= 0).toBe(true);
	});
});
