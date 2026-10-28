// 对拍:「显示进阶对应」开着时,页面卡片 / 牌义表「对应」格带进阶叠层后缀(路径连 X–Y / 质点 / 象限),
// AI 快照(页面自身快照与 AI 挂载重算同一个 buildReadingText)的「占象」格照页面同样带;关着时两边都不带。
// 判据:同一份牌面与设置,真渲染页面里出现的后缀集合 = 快照里出现的后缀集合(候选 = 本局各牌的 correspondenceSuffix)。
import React from 'react';
import ReactDOM from 'react-dom';
import TarotMain, { buildTarotSnapshotForFields } from '../TarotMain';
import { buildReadingText } from '../engine/reportText';
import { correspondenceSuffix } from '../engine/cardSchema';

jest.setTimeout(60000);

if(!window.matchMedia){
	window.matchMedia = (query) => ({
		matches: false, media: query, onchange: null,
		addListener: () => {}, removeListener: () => {},
		addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
	});
}

let container;
let inst;
function mount(){
	container = document.createElement('div');
	document.body.appendChild(container);
	inst = ReactDOM.render(<TarotMain height={800} fields={{}} />, container);
}
afterEach(() => {
	if(container){ ReactDOM.unmountComponentAtNode(container); container.remove(); container = null; }
	inst = null;
	try{ window.localStorage.clear(); }catch(e){ /* 无存储环境 */ }
});
const set = (patch) => ReactDOM.unstable_batchedUpdates(() => { inst.setState(patch); });

// 候选后缀:本局每张牌在当前变体下的叠层后缀(空的不算)
const candidates = (reading) => Array.from(new Set(reading.draws.map((d) => correspondenceSuffix(d.card, reading.settings.variant)).filter(Boolean)));
const pageCells = () => Array.from(container.querySelectorAll('.horosa-tarot-corr:not(.horosa-tarot-scales), .horosa-tarot-td-corr')).map((n) => n.textContent || '');
// 快照「占象」列(逐牌详解表第 6 格)
const snapCells = (text) => `${text || ''}`.split('\n').filter((l) => /^\| 位置\d/.test(l)).map((l) => l.split('|')[5] || '');
const present = (cands, cells) => cands.filter((c) => cells.some((t) => t.includes(c))).sort();

function pageCase(deckId, spreadType, seed, settings){
	mount();
	ReactDOM.unstable_batchedUpdates(() => { inst.changeDeck(deckId); });   // 换牌组走页面自己的入口(五项吸附该牌组缺省)
	set({ spreadType, ...settings, rightPanelTab: 'meanings' });
	inst.applyRecompute(seed);
	const reading = inst.state.reading;
	return { reading, cells: pageCells(), snap: buildReadingText(reading, '') };
}

describe('进阶对应叠层后缀:页面 = 快照', () => {
	test('开着(托特缺省开,变体 B):页面卡片与牌义表出现的后缀 = 快照占象格出现的后缀 = 本局全部候选', () => {
		// 三张阵:中栏卡片(不压缩)与牌义表两处都出对应格;凯尔特十字:卡片压缩不出对应格,只看牌义表
		[['three', 2, 2], ['celtic', 4, 1]].forEach(([spread, minCands, perCard]) => {
			const { reading, cells, snap } = pageCase('thoth', spread, 'corr-suffix-parity', {});
			expect(reading.settings.showCorrespondences).toBe(true);
			const cands = candidates(reading);
			expect(`${spread}:${cands.length >= minCands}`).toBe(`${spread}:true`);
			expect(`${spread}:${cells.length}`).toBe(`${spread}:${reading.draws.length * perCard}`);
			expect(present(cands, cells)).toEqual(cands.slice().sort());
			expect(present(cands, snapCells(snap))).toEqual(present(cands, cells));
			ReactDOM.unmountComponentAtNode(container); container.remove(); container = null;
		});
	});
	test('关着(rws 显式关):页面与快照都不带任何后缀', () => {
		const { reading, cells, snap } = pageCase('rws', 'celtic', 'corr-suffix-parity', { showCorrespondences: false });
		expect(reading.settings.showCorrespondences).toBe(false);
		const cands = candidates(reading);
		expect(cands.length).toBeGreaterThan(3);
		expect(cells.length).toBe(reading.draws.length);   // 牌义表对应格照出(只是不带后缀)
		expect(present(cands, cells)).toEqual([]);
		expect(present(cands, snapCells(snap))).toEqual([]);
	});
	test('开着 + 变体 C(大牌不附路径):两边同样只带质点 / 象限', () => {
		const { reading, cells, snap } = pageCase('rws', 'celtic', 'corr-suffix-parity', { showCorrespondences: true, variant: 'C' });
		const cands = candidates(reading);
		expect(cands.some((c) => c.includes('路径连'))).toBe(false);
		expect(present(cands, cells)).toEqual(cands.slice().sort());
		expect(present(cands, snapCells(snap))).toEqual(present(cands, cells));
	});
	test('AI 挂载重算路径同一口径:记录里存的「显示进阶对应」决定带不带', async () => {
		const base = { deckId: 'rws', spreadType: 'celtic', seed: 'corr-suffix-parity', question: '', noPageFallback: true };
		const on = await buildTarotSnapshotForFields({}, { ...base, settings: { showCorrespondences: true, variant: 'B' } });
		const off = await buildTarotSnapshotForFields({}, { ...base, settings: { showCorrespondences: false, variant: 'B' } });
		const onCells = snapCells(on);
		expect(onCells.some((t) => / · (路径连 |[A-Z][a-z]+ )/.test(t))).toBe(true);
		expect(snapCells(off).some((t) => /路径连 /.test(t))).toBe(false);
		// 同一局:关着时每格 = 开着那格去掉后缀
		const offCells = snapCells(off);
		expect(offCells.length).toBe(onCells.length);
		offCells.forEach((t, i) => { expect(onCells[i].startsWith(t.replace(/\s+$/, ''))).toBe(true); });
	});
});
