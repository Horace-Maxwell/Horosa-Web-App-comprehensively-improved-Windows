// 印占页:引擎子块未能计算(jyotish.partialErrors)在页面上一行写明,不让该段静默消失;正常盘不出提示。
// 段名表页面与 AI 快照共用 indiaMain/jyotishData.INDIA_PARTIAL_LABELS。
import { renderToStaticMarkup } from 'react-dom/server';
import IndiaChartMain from '../../components/astro/IndiaChartMain';
import {
	jyotishPartialNotice, jyotishPartialErrorLabel, isDashaPartialName, isKpMuhurtaPartialName, buildDashaFieldsKey,
} from '../../components/astro/indiaMain/jyotishData';
import { indiaPartialErrorLines } from '../../components/astro/IndiaChart';

const moment = require('moment');
// 组件 JSX 依赖构建期注入的全局 React(umi);测试里显式挂上
global.React = require('react');

function fakePage(jyotish){
	// 面板里顺带调用的其它子渲染方法一律当空渲染(只看本面板的未能计算提示)
	const base = {
		// 走正常路径:当前盘 + 与本次字段一致的盘键(回退盘 lastChartObj 要与当前命主签名一致才用,不在本测范围)
		state: { mainChartObj: { jyotish }, mainChartKey: buildDashaFieldsKey(FIELDS), dashaSystem: 'vimshottari', dashaSeed: 'moon', indiaDashaYearLength: 365.25 },
		props: {},
		changeDashaSystem(){}, changeDashaSeed(){}, changeDashaYearLength(){},
		dashaYearDaysOf(){ return 365.25; },
		getMemoizedDasha(){ return null; },
	};
	return new Proxy(base, {
		get(target, prop){
			if(prop in target){ return target[prop]; }
			return typeof IndiaChartMain.prototype[prop] === 'function' ? ()=>null : undefined;
		},
	});
}
const FIELDS = { date: { value: moment('1990-05-18 10:30:00') }, time: { value: moment('1990-05-18 10:30:00') }, zone: { value: '+05:30' }, lat: { value: '28n36' }, lon: { value: '77e12' } };

describe('印占页未能计算提示', ()=>{
	test('段名单源:页面与快照同一张表,未登记的名字原样写出', ()=>{
		expect(jyotishPartialErrorLabel('kp.deep')).toMatch(/KP 深化/);
		expect(jyotishPartialErrorLabel('dasha.yogini')).toBe('大运·yogini');
		expect(jyotishPartialErrorLabel('kalachakra')).toBe('kalachakra');
		const j = { partialErrors: ['kp.deep', 'muhurta.panchaka', 'dashaSeed', 'dasha.yogini'] };
		expect(jyotishPartialNotice(j, isKpMuhurtaPartialName)).toMatch(/KP 深化.*Panchaka/);
		expect(jyotishPartialNotice(j, isKpMuhurtaPartialName)).not.toMatch(/大运/);
		expect(jyotishPartialNotice(j, isDashaPartialName)).toMatch(/大运所选起点.*大运·yogini/);
		expect(jyotishPartialNotice({}, isDashaPartialName)).toBe('');
		expect(indiaPartialErrorLines({ jyotish: j })[0]).toMatch(/KP 深化/);
	});

	test('KP / Muhurta 面板:落账时出提示行与「未能计算」行;正常盘没有', ()=>{
		expect(buildDashaFieldsKey(FIELDS)).toBeTruthy();
		const failed = { partialErrors: ['kp.deep', 'muhurta.panchaka'], kp: { sublords: {}, partialErrors: ['kpDeep'] },
			muhurta: { sunrise: '05:30', panchaka: null, partialErrors: ['panchaka'] } };
		const html = renderToStaticMarkup(IndiaChartMain.prototype.renderKpMuhurtaPanel.call(fakePage(failed), FIELDS));
		expect(html).toMatch(/本次未能计算:KP 深化/);
		expect(html).toContain('<span>Panchaka</span><strong class="is-warn">未能计算</strong>');
		const ok = { kp: { sublords: {} }, muhurta: { sunrise: '05:30', panchaka: { isPanchaka: false, typeLabel: '无忌(吉)', remainder: 0 } } };
		const okHtml = renderToStaticMarkup(IndiaChartMain.prototype.renderKpMuhurtaPanel.call(fakePage(ok), FIELDS));
		expect(okHtml).not.toMatch(/未能计算/);
	});

	test('大运面板:起点 / 体系未能计算时出提示行', ()=>{
		const failed = { partialErrors: ['dashaSeed', 'dasha.vimshottari'], dasha: {} };
		const html = renderToStaticMarkup(IndiaChartMain.prototype.renderDashaPanel.call(fakePage(failed), FIELDS));
		expect(html).toContain('本次未能计算:大运所选起点(已按月亮起运)、大运·vimshottari');
		const okHtml = renderToStaticMarkup(IndiaChartMain.prototype.renderDashaPanel.call(fakePage({ dasha: {} }), FIELDS));
		expect(okHtml).not.toMatch(/未能计算/);
	});
});
