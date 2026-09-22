// 盘面标注开启后点宫位的信息面板(驻神/正间/门州气/格局/主事)必须能渲染:
// 此前 shenMeaning 未 import,点宫即 ReferenceError 整盘崩(静态扫描网 check_undefined_identifiers 实抓)。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TaiyiBoardSvg from '../TaiyiBoardSvg';
import { computeTaiyiScanPan } from '../../../divination/zeri/taiyiZeriScanEngine';

const GEO = { zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };

describe('太乙盘面标注:点宫位信息面板', () => {
	it('showBoardMark + selectedPalace 渲染不崩,且带「主事:」(shenMeaning 已接线)', () => {
		const pan = computeTaiyiScanPan(GEO, { tn: 0 }, '2026-05-14', '08:01:00');
		expect(pan && pan.kook ? 'has' : 'null').toBe('has');
		let html = '';
		expect(() => { html = renderToStaticMarkup(<TaiyiBoardSvg pan={pan} showBoardMark selectedPalace={0} onSelectPalace={() => {}} />); }).not.toThrow();
		const txt = html.replace(/<[^>]+>/g, '¦');
		expect(txt.indexOf('主事:') >= 0 ? 'ok' : '缺主事').toBe('ok');
		// 判别向量:同一渲染在未接线时抛 ReferenceError(用 shenMeaning 未定义的复制件即红)——此处以「不抛且含主事」为绿证
	});
	it('不开标注 / 未选宫位:面板不渲染,也不崩', () => {
		const pan = computeTaiyiScanPan(GEO, { tn: 0 }, '2026-05-14', '08:01:00');
		const txt = renderToStaticMarkup(<TaiyiBoardSvg pan={pan} showBoardMark={false} selectedPalace={null} onSelectPalace={() => {}} />).replace(/<[^>]+>/g, '¦');
		expect(txt.indexOf('主事:')).toBe(-1);
	});
});
