// 合同:「显示进阶对应」关着时,页面不出「字母/路径变体 · 宫廷元素体系 · 宫廷星座体系」三个控件,
// AI 快照的设置行也不写这三项(页面看不见的设置不进 AI 内容);开着时三项照写。
// 页面自身快照与 AI 挂载重算走同一个 buildReadingText,两路各验一遍。
import { buildReading } from '../engine/reading';
import { buildReadingText } from '../engine/reportText';
import { buildTarotSnapshotForFields } from '../TarotMain';

const ADV = { variant: 'C', courtElementSystem: 'alt', courtZodiacSystem: 'simple' };
const settingsLine = (text)=>`${text || ''}`.split('\n').find((l)=>l.startsWith('设置:')) || '';
const ADV_RE = /变体|宫廷元素|宫廷星座/;

describe('进阶对应门控:快照设置行 = 页面左栏可见项', ()=>{
	test('关着:设置行不写变体 / 宫廷两体系;开着:三项照写', ()=>{
		const off = buildReadingText(buildReading('rws', 'celtic', 'corr-gate', { ...ADV, showCorrespondences: false }), '');
		expect(settingsLine(off)).not.toMatch(ADV_RE);
		const on = buildReadingText(buildReading('rws', 'celtic', 'corr-gate', { ...ADV, showCorrespondences: true }), '');
		expect(settingsLine(on)).toContain('变体 C');
		expect(settingsLine(on)).toContain('宫廷元素 位阶制');
		expect(settingsLine(on)).toContain('宫廷星座 单座制');
	});
	test('没单独设过「显示进阶对应」时按牌组缺省:缺省关的牌组不写,缺省开的牌组照写', ()=>{
		const rws = buildReading('rws', 'three', 'corr-gate', { variant: 'A' });
		expect(rws.settings.showCorrespondences).toBe(false);
		expect(settingsLine(buildReadingText(rws, ''))).not.toMatch(ADV_RE);
		const thoth = buildReading('thoth', 'three', 'corr-gate', {});
		expect(thoth.settings.showCorrespondences).toBe(true);
		expect(settingsLine(buildReadingText(thoth, ''))).toMatch(/变体 B/);
	});
	test('AI 挂载重算路径同一口径(记录里存的「显示进阶对应」决定写不写)', async ()=>{
		const base = { deckId: 'rws', spreadType: 'celtic', seed: 'corr-gate', question: '', noPageFallback: true };
		const off = await buildTarotSnapshotForFields({}, { ...base, settings: { ...ADV, showCorrespondences: false } });
		const on = await buildTarotSnapshotForFields({}, { ...base, settings: { ...ADV, showCorrespondences: true } });
		expect(settingsLine(off)).toMatch(/^设置:/);
		expect(settingsLine(off)).not.toMatch(ADV_RE);
		expect(settingsLine(on)).toContain('变体 C');
		expect(settingsLine(on)).toContain('宫廷元素 位阶制');
	});
});
