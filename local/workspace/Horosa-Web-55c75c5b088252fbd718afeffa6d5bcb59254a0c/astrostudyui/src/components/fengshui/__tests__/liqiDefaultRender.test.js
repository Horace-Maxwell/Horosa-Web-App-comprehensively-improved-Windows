// 理气各派在缺省参数下都能渲染(进页 / 切流派即是这一态):参数不全的派(compute 返回 available:false)
// 只出提示,不许让整个风水页报错 —— 流派随页保存,一派在缺省态报错 = 之后每次进页都报错。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LiqiWorkspace, { SCHOOL_CN, LIQI_UNAVAILABLE_HINT } from '../LiqiWorkspace';
import { mingli } from '../mingli';

const LIQI = Object.keys(SCHOOL_CN).filter((k) => k !== 'naqi' && k !== 'bagua');

describe('理气各派缺省参数渲染', () => {
	it('流派表非空(防零迭代判绿)', () => {
		expect(LIQI.length).toBeGreaterThanOrEqual(15);
	});
	it.each(LIQI)('%s:缺省参数渲染不抛错', (school) => {
		expect(() => renderToStaticMarkup(<LiqiWorkspace school={school} />)).not.toThrow();
	});
	it('命理派缺省(命主年为空)= 参数不全 → 盘区出提示、右栏不渲染', () => {
		expect(mingli({ mingYear: null }).available).toBe(false);
		const out = renderToStaticMarkup(<LiqiWorkspace school="mingli" />);
		expect(out).toContain(LIQI_UNAVAILABLE_HINT.mingli);
		expect(out).toContain('horosa-fengshui-liqi-unavailable');
	});
	it('参数齐全的派不出提示', () => {
		const out = renderToStaticMarkup(<LiqiWorkspace school="bazhai" />);
		expect(out).not.toContain('horosa-fengshui-liqi-unavailable');
	});
});
