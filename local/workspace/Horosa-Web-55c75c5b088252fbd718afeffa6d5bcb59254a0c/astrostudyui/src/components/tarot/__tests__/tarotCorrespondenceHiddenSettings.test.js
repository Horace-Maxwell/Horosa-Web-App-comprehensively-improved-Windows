// 对拍:「显示进阶对应」关着时,左栏不出现的四项(字母/路径变体、现代行星注、宫廷元素体系、宫廷星座体系)
// 即使存着非缺省值,也不改页面牌义表「对应」列、单牌详情「占象」与 AI 快照「占象」列 —— 三处都按缺省口径
// (变体 = 牌组缺省,其余三项出厂值);开着时三处照用这四项。
// 判据:真渲染页面(jsdom)读 DOM 文本,与快照文本逐格比;缺省口径另由 astroLine 直接按缺省参数算(不经被测的门控)。
import React from 'react';
import ReactDOM from 'react-dom';
import TarotMain, { buildTarotSnapshotForFields } from '../TarotMain';
import { buildReading } from '../engine/reading';
import { buildReadingText } from '../engine/reportText';
import { getDeck } from '../engine/deckRegistry';
import { astroLine } from '../engine/cardSchema';
import { MODERN_PLANET, PATH_JOIN_VARIANT_B } from '../decks/correspondences';

jest.setTimeout(60000);

if(!window.matchMedia){
	window.matchMedia = (query) => ({
		matches: false, media: query, onchange: null,
		addListener: () => {}, removeListener: () => {},
		addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
	});
}

// 四项都拨到非缺省(rws 牌组缺省:变体 A / 不附现代行星注 / 元素中元素 / 跨段)
const HIDDEN = { variant: 'B', astroModern: true, courtElementSystem: 'alt', courtZodiacSystem: 'simple' };

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

// 找一局凯尔特十字:同时含变体 B 换路径的大牌、现代行星注大牌与宫廷牌 —— 四项各有一格能看出差别
function findSeed(){
	for(let i = 0; i < 2000; i++){
		const seed = `hidden-corr-${i}`;
		const r = buildReading('rws', 'celtic', seed, {});
		const sids = r.draws.map((d) => d.card && d.card.sid);
		const hasB = sids.some((s) => PATH_JOIN_VARIANT_B[s]);
		const hasModern = sids.some((s) => MODERN_PLANET[s]);
		const hasCourt = r.draws.some((d) => d.card && d.card.court);
		if(hasB && hasModern && hasCourt){ return seed; }
	}
	throw new Error('找不到合适的种子');
}
const SEED = findSeed();

function pageCase(settings){
	mount();
	ReactDOM.unstable_batchedUpdates(() => { inst.changeDeck('rws'); });
	ReactDOM.unstable_batchedUpdates(() => { inst.setState({ spreadType: 'celtic', ...settings, rightPanelTab: 'meanings' }); });
	inst.applyRecompute(SEED);
	const reading = inst.state.reading;
	const cells = Array.from(container.querySelectorAll('.horosa-tarot-td-corr')).map((n) => (n.textContent || '').trim());
	return { reading, cells, snap: buildReadingText(reading, '') };
}
const snapCells = (text) => `${text || ''}`.split('\n').filter((l) => /^\| 位置\d/.test(l)).map((l) => (l.split('|')[5] || '').trim());
// 缺省口径:astroLine 按牌组缺省变体、无现代注、宫廷出厂体系直接算
const deck = getDeck('rws');
const defaultLines = (reading) => reading.draws.map((d) => astroLine(d.card, deck, deck.variant || 'A', false, { elementSystem: 'gd', zodiacSystem: 'gd_span' }));
const hiddenLines = (reading) => reading.draws.map((d) => astroLine(d.card, deck, HIDDEN.variant, HIDDEN.astroModern, { elementSystem: HIDDEN.courtElementSystem, zodiacSystem: HIDDEN.courtZodiacSystem }));

describe('进阶对应关着:看不见的四项不生效(页面 = 快照 = 缺省口径)', () => {
	test('选局本身能看出四项的差别(判别力)', () => {
		const r = buildReading('rws', 'celtic', SEED, {});
		const dft = defaultLines(r);
		const hid = hiddenLines(r);
		const diff = dft.filter((x, i) => x !== hid[i]);
		// 变体 B 换字母 / 现代行星注 / 宫廷两体系:至少三格不同
		expect(diff.length).toBeGreaterThanOrEqual(3);
	});

	test('关着 + 四项非缺省:牌义表对应列 = 快照占象列 = 缺省口径', () => {
		const { reading, cells, snap } = pageCase({ showCorrespondences: false, ...HIDDEN });
		expect(reading.settings.showCorrespondences).toBe(false);
		expect(reading.settings.variant).toBe('B');   // 存着的值照存(只是不生效)
		expect(cells).toEqual(defaultLines(reading));
		expect(snapCells(snap)).toEqual(cells);
	});

	test('关着:与四项全缺省的同一局逐字相同(页面与快照两边)', () => {
		const a = pageCase({ showCorrespondences: false, ...HIDDEN });
		ReactDOM.unmountComponentAtNode(container); container.remove(); container = null;
		const b = pageCase({ showCorrespondences: false, variant: 'A', astroModern: false, courtElementSystem: 'gd', courtZodiacSystem: 'gd_span' });
		expect(a.cells).toEqual(b.cells);
		expect(snapCells(a.snap)).toEqual(snapCells(b.snap));
	});

	test('开着:四项照用(页面与快照同为按四项算的那一格,再带叠层后缀)', () => {
		const { reading, cells, snap } = pageCase({ showCorrespondences: true, ...HIDDEN });
		const want = hiddenLines(reading);
		expect(cells.length).toBe(want.length);
		cells.forEach((t, i) => { expect(t.startsWith(want[i])).toBe(true); });
		expect(snapCells(snap)).toEqual(cells);
		expect(cells).not.toEqual(defaultLines(reading));
	});

	test('单牌详情「占象」:关着按缺省口径,开着按四项', () => {
		const findOccult = () => {
			const rows = Array.from(document.querySelectorAll('.horosa-tarot-detail-drawer div'))
				.filter((n) => /^占象：/.test(n.textContent || '') && n.children.length === 1);
			return rows.length ? rows[0].textContent.replace(/^占象：/, '') : null;
		};
		const pick = (reading) => reading.draws.find((d) => PATH_JOIN_VARIANT_B[d.card.sid]).card;
		const off = pageCase({ showCorrespondences: false, ...HIDDEN });
		const cardOff = pick(off.reading);
		ReactDOM.unstable_batchedUpdates(() => { inst.setState({ detailCard: cardOff }); });
		const tOff = findOccult();
		expect(tOff).not.toBe(null);
		expect(tOff.startsWith(astroLine(cardOff, deck, 'A', false, null))).toBe(true);
		ReactDOM.unmountComponentAtNode(container); container.remove(); container = null;
		document.querySelectorAll('.horosa-tarot-detail-drawer').forEach((n) => { const w = n.closest('.ant-drawer'); if(w){ w.remove(); } });
		const on = pageCase({ showCorrespondences: true, ...HIDDEN });
		const cardOn = pick(on.reading);
		ReactDOM.unstable_batchedUpdates(() => { inst.setState({ detailCard: cardOn }); });
		const tOn = findOccult();
		expect(tOn.startsWith(astroLine(cardOn, deck, 'B', true, null))).toBe(true);
		expect(tOn).not.toBe(tOff);
	});

	test('AI 挂载重算路径同一口径:记录关着时四项不生效,开着时生效', async () => {
		const base = { deckId: 'rws', spreadType: 'celtic', seed: SEED, question: '', noPageFallback: true };
		const off = await buildTarotSnapshotForFields({}, { ...base, settings: { showCorrespondences: false, ...HIDDEN } });
		const offDefault = await buildTarotSnapshotForFields({}, { ...base, settings: { showCorrespondences: false } });
		const on = await buildTarotSnapshotForFields({}, { ...base, settings: { showCorrespondences: true, ...HIDDEN } });
		const r = buildReading('rws', 'celtic', SEED, {});
		expect(snapCells(off)).toEqual(defaultLines(r));
		expect(snapCells(off)).toEqual(snapCells(offDefault));
		snapCells(on).forEach((t, i) => { expect(t.startsWith(hiddenLines(r)[i])).toBe(true); });
	});
});
