// [#79] 主宰星链面板两表渲染合同(此前零组件级覆盖):整宫表/分宫表标题与折叠、极区回退表头、译名。
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AstroDispositor from '../AstroDispositor';

const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../divination/engine/__tests__/fixtures/realChartResult.json'), 'utf8'));
const html = (props)=>renderToStaticMarkup(<AstroDispositor {...props} />);

describe('AstroDispositor 两表', ()=>{
	it('分宫制盘(Regiomontanus):两表都渲染,分宫表头带当前制名', ()=>{
		const out = html({ value: REAL, fields: { hsys: { value: 2 } } });
		expect(out).toContain('整宫制宫主表(wholeSignRulers)');
		expect(out).toContain('当前分宫制(Regiomontanus)宫神星表(houseRows)');
		expect(out).not.toContain('当前分宫制即整宫制');
		expect((out.match(/宫主落宫\(整宫\)/g) || []).length).toBe(1);
	});
	it('上升整宫制盘(fields hsys 0):分宫表折叠成一行说明', ()=>{
		const out = html({ value: REAL, fields: { hsys: { value: 0 } } });
		expect(out).toContain('当前分宫制即整宫制：与上表逐行相同，不再重复列出。');
		expect(out).toContain('当前分宫制(整宫制)宫神星表(houseRows)');
	});
	it('福点整宫制(fields hsys 24):不折叠,表头标 福点整宫制', ()=>{
		const out = html({ value: REAL, fields: { hsys: { value: 24 } } });
		expect(out).toContain('当前分宫制(福点整宫制)宫神星表(houseRows)');
		expect(out).not.toContain('当前分宫制即整宫制');
	});
	it('极区回退:表头说真话「Placidus→回退Porphyry」', ()=>{
		const co = { ...REAL, chart: { ...REAL.chart, houses: REAL.chart.houses.map((h)=>({ ...h, hsysFallback: 'Porphyry' })) } };
		const out = html({ value: co, fields: { hsys: { value: 3 } } });
		expect(out).toContain('当前分宫制(Placidus→回退Porphyry)宫神星表(houseRows)');
	});
	it('后端回显 Whole Sign 走 AstroMsg 译名;缺 chart 渲染空', ()=>{
		const co = { ...REAL, params: {}, chart: { ...REAL.chart, hsys: 'Whole Sign' } };
		const out = html({ value: co, fields: null });
		expect(out).toContain('整宫制');
		expect(html({ value: null })).toBe('');
	});
});
