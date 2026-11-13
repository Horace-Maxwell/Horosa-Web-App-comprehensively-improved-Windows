// 星运带盘页右栏的小窗兜底:表格区下限随表卡数给足,固定头 + 下限放不下时右栏整列自己滚(不裁掉下沿、不出只能滚三行的缝)。
import fs from 'fs';
import path from 'path';
import { sideBodyMinHeight, cardMinHeight, allocateCardHeights, PAGE_GAP } from '../progPageLayout';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'progPageLayout.js'), 'utf8');

describe('右栏表格区下限', ()=>{
	it('没有表卡:保底 160', ()=>{
		expect(sideBodyMinHeight([], 0)).toBe(160);
		expect(sideBodyMinHeight(null)).toBe(160);
	});
	it('两张都要滚的表:每张至少 168,加间距', ()=>{
		expect(sideBodyMinHeight([{ natural: 900 }, { natural: 400 }])).toBe(168 * 2 + PAGE_GAP + 4);
	});
	it('内容矮的表按内容高算,不多占', ()=>{
		expect(sideBodyMinHeight([{ natural: 90 }, { natural: 2000 }])).toBe(90 + 168 + PAGE_GAP + 4);
		expect(sideBodyMinHeight([{ natural: 60 }])).toBe(160);
	});
	it('页面自报的下限(不是表卡的自定内容)取大者', ()=>{
		expect(sideBodyMinHeight([], 460)).toBe(460);
		expect(sideBodyMinHeight([{ natural: 900 }, { natural: 900 }, { natural: 900 }], 200)).toBe(168 * 3 + PAGE_GAP * 2 + 4);
	});
});

describe('表卡自报的下限', ()=>{
	it('卡报了下限就用它(不超过内容高);没报的按内容高封顶到 168', ()=>{
		expect(cardMinHeight({ natural: 900, min: 190 })).toBe(190);
		expect(cardMinHeight({ natural: 150, min: 190 })).toBe(150);
		expect(cardMinHeight({ natural: 900 })).toBe(168);
		expect(sideBodyMinHeight([{ natural: 900, min: 190 }, { natural: 230, min: 230 }])).toBe(190 + 230 + PAGE_GAP + 4);
	});
});

describe('高度分配:不让哪张卡低于自己的下限', ()=>{
	const sum = (o)=>Object.keys(o).reduce((a, k)=>a + o[k], 0);
	it('放得下各卡下限时:原算法给的数不动(没有哪张低于下限)', ()=>{
		const cards = [{ id: 1, natural: 900, grow: true, min: 190 }, { id: 2, natural: 600, min: 190 }];
		const withMin = allocateCardHeights(cards, 700);
		const noMin = allocateCardHeights(cards.map(({ min, ...c })=>c), 700);
		expect(withMin).toEqual(noMin);
	});
	it('不能在卡内滚的卡(下限 = 内容全高)分少了:从能滚的那张匀过来,总高不变', ()=>{
		// 平分会给各 250:第二张内容 300 且不能滚 → 溢出卡外 50px
		const cards = [{ id: 1, natural: 2000, grow: true, min: 184 }, { id: 2, natural: 300, min: 300 }];
		const out = allocateCardHeights(cards, 500);
		expect(out[2]).toBe(300);
		expect(out[1]).toBe(200);
		expect(sum(out)).toBe(500);
	});
	it('两张都能滚、固定部分一高一矮:矮窗口里两张的表都不低于下限', ()=>{
		const cards = [{ id: 1, natural: 800, grow: true, min: 184 }, { id: 2, natural: 700, min: 220 }];
		const out = allocateCardHeights(cards, 184 + 220);
		expect(out[1]).toBeGreaterThanOrEqual(184);
		expect(out[2]).toBeGreaterThanOrEqual(220);
	});
});

describe('右栏整列可滚(兜底)', ()=>{
	it('右栏根节点 overflow-y auto,表格区下限走 sideBodyMinHeight', ()=>{
		expect(SRC).toMatch(/className=\{`horosa-prog-side \$\{styles\.scrollbar\}/);
		expect(SRC).toMatch(/paddingTop: SIDE_TOP_PAD, overflowY: 'auto', overflowX: 'hidden', \.\.\.style \}\}/);
		expect(SRC).toMatch(/const bodyMinHeight = sideBodyMinHeight\(scrollBody \? \[\] : cards, bodyMin\);/);
		expect(SRC).toMatch(/minHeight: bodyMinHeight, marginTop: PAGE_GAP/);
	});
	it('波斯向运把两张自滚表的下限合计报给右栏', ()=>{
		const { jsxElements } = require('../../../utils/__tests__/helpers/jsxProps');
		const persian = fs.readFileSync(path.resolve(__dirname, '..', 'AstroPersianDirected.js'), 'utf8');
		expect(jsxElements(persian, 'SideColumn').map((e)=>e.bodyMin)).toContain('nearbyHits.length ? 460 : 380');
	});
});
