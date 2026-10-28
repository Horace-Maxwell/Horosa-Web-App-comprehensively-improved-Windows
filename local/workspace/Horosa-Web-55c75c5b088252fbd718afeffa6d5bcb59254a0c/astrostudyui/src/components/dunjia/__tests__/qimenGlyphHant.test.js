// 界面繁体:奇门盘 / 三式合一盘格子里单字画的九星、八门按全名定字 —— 单字「冲」与值符行、提示里的「天冲」写法一致
// (通用词典单看「冲」作「沖」,全名「天冲」作「天衝」,同一颗星两种写法)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import { qimenGlyphScriptAttrs } from '../DunJiaCalc';
import DunJiaBoard from '../DunJiaBoard';
import { toHant } from '../../../utils/scriptConvert/hantConverter';
import { applyScriptMode, SCRIPT_HANT, __resetScriptModeForTest, __setConverterForTest } from '../../../utils/scriptMode';

const STARS = { 蓬: '天蓬', 任: '天任', 冲: '天冲', 辅: '天辅', 英: '天英', 芮: '天芮', 禽: '天禽', 柱: '天柱', 心: '天心', 内: '天内' };
const DOORS = { 休: '休门', 生: '生门', 伤: '伤门', 杜: '杜门', 景: '景门', 死: '死门', 惊: '惊门', 开: '开门' };
const want = (full, ch)=>Array.from(toHant(full))[Array.from(full).indexOf(ch)];

beforeEach(()=>{ __resetScriptModeForTest(); __setConverterForTest(toHant); document.body.innerHTML = ''; });
afterAll(()=>{ __resetScriptModeForTest(); });

describe('单字九星 / 八门经显示层 = 全名转换的对应位', ()=>{
	test('属性表覆盖全部九星(含内 / 芮 / 禽)与八门;非单字 / 非星门不挂', ()=>{
		Object.keys(STARS).forEach((c)=>{ expect(qimenGlyphScriptAttrs('star', c)['data-hant-word']).toBe(STARS[c]); });
		Object.keys(DOORS).forEach((c)=>{ expect(qimenGlyphScriptAttrs('door', c)['data-hant-word']).toBe(DOORS[c]); });
		expect(qimenGlyphScriptAttrs('star', '天冲')).toEqual({});
		expect(qimenGlyphScriptAttrs('door', '中')).toEqual({});
		expect(qimenGlyphScriptAttrs('god', '冲')).toEqual({});
	});

	test('挂了属性的单字节点在繁体下逐个等于全名转换的那一位(「冲」作「衝」)', async ()=>{
		const host = document.createElement('div');
		const cases = [...Object.keys(STARS).map((c)=>['star', c, STARS[c]]), ...Object.keys(DOORS).map((c)=>['door', c, DOORS[c]])];
		cases.forEach(([type, c])=>{
			const el = document.createElement('div');
			const attrs = qimenGlyphScriptAttrs(type, c);
			Object.keys(attrs).forEach((k)=>el.setAttribute(k, attrs[k]));
			el.textContent = c;
			host.appendChild(el);
		});
		document.body.appendChild(host);
		await applyScriptMode(SCRIPT_HANT);
		expect(Array.from(host.children).map((e)=>e.textContent)).toEqual(cases.map(([, c, full])=>want(full, c)));
		expect(want('天冲', '冲')).toBe('衝');
	});

	test('奇门盘格子的九星节点真带上属性(DunJiaBoard 悬停节点)', async ()=>{
		const host = document.createElement('div');
		document.body.appendChild(host);
		const fake = { renderQimenDocPopover: ()=>null };
		const node = DunJiaBoard.prototype.renderQimenHoverNode.call(fake, 'star', '冲', {}, 'k');
		await act(async ()=>{ ReactDOM.render(<div>{node}</div>, host); });
		const el = Array.from(host.querySelectorAll('div')).find((d)=>d.textContent === '冲' && d.children.length === 0);
		expect(el.getAttribute('data-hant-word')).toBe('天冲');
		await applyScriptMode(SCRIPT_HANT);
		expect(el.textContent).toBe('衝');
		ReactDOM.unmountComponentAtNode(host);
	});

	test('三式合一盘与奇门金函大字同用这份属性(三式同步)', ()=>{
		const sanshi = fs.readFileSync(path.join(__dirname, '../../sanshi/SanshiUnitedBoard.js'), 'utf8');
		expect(sanshi).toMatch(/className=\{styles\.qmStar\}[^>]*\{\.\.\.qimenGlyphScriptAttrs\('star', cell\.tianXing\)\}/);
		expect(sanshi).toMatch(/className=\{styles\.qmDoor\} \{\.\.\.qimenGlyphScriptAttrs\('door', cell\.door\)\}/);
		const board = fs.readFileSync(path.join(__dirname, '../DunJiaBoard.js'), 'utf8');
		expect(board).toMatch(/\{\.\.\.qimenGlyphScriptAttrs\('star', cell\.tianXing\)\}>\{cell\.tianXing\}/);
		expect(board).toMatch(/\{\.\.\.qimenGlyphScriptAttrs\(type, raw\)\}/);
	});
});
