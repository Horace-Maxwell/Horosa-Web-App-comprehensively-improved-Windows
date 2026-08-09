// [制度化] 🔴 奇门导出段登记双向哨兵(L3):真引擎产两形态快照(常规全开+金函),
//   机械提取段头 ↔ AI_EXPORT_PRESET_SECTIONS.qimen 对照——
//   「快照有段而 preset 无」=漏登记(自定义过段集的用户新段被静默滤空,indiachart 教训);
//   「preset 有段而快照无」须在条件段白名单成文(僵尸登记也判红)。
import { calcDunJia, buildDunJiaSnapshotText } from '../../components/dunjia/DunJiaCalc';
import { buildLocalBaziResult } from '../baziLunarLocal';
import fs from 'fs';
import path from 'path';

function getGanzi(p){ return (p && (p.ganzhi || p.ganZhi)) || ''; }
function localNongli(date, time){
	const local = buildLocalBaziResult({ date, time, zone: '+08:00', lon: '120e00', lat: '0n00', gpsLon: 120, gpsLat: 0, ad: 1, gender: 1, timeAlg: 1, after23NewDay: 0 });
	const four = local.bazi.fourColumns;
	return { ...local.bazi.nongli, bazi: local.bazi, yearGanZi: getGanzi(four.year), monthGanZi: getGanzi(four.month), dayGanZi: getGanzi(four.day), time: getGanzi(four.time), timeGanZi: getGanzi(four.time) };
}
function makeFields(d, t){ return { date: { value: { format: ()=>d } }, time: { value: { format: ()=>t } }, zone: { value: '+08:00' } }; }
function extractSections(txt){
	const out = [];
	`${txt || ''}`.split('\n').forEach((ln)=>{
		const t = ln.trim();
		let m = t.match(/^\[(.+)\]$/);
		if(!m){ m = t.match(/^【(.+)】$/); }
		if(m && m[1]){ out.push(m[1]); }
	});
	return [...new Set(out)];
}
function readPreset(){
	const src = fs.readFileSync(path.join(__dirname, '../aiExport.js'), 'utf8');
	const i = src.indexOf('AI_EXPORT_PRESET_SECTIONS');
	const j = src.indexOf('qimen:', i);
	const seg = src.slice(j, src.indexOf('],', j));
	return [...seg.matchAll(/'([^']+)'/g)].map((m)=>m[1]);
}

// 条件段白名单:preset 登记但本样本快照不产的段(理由成文;新增须写理由)
const CONDITIONAL = {
	'日家占方（古籍金函系）': '金函形态专段(仅 paiPanType=6 产;由金函样本覆盖)',
};

describe('[制度化] 奇门导出段登记双向哨兵', ()=>{
	const nongli = localNongli('2026-02-17', '09:05:00');
	const regular = buildDunJiaSnapshotText(calcDunJia(makeFields('2026-02-17', '09:05:00'), nongli, {
		paiPanType: 2, school: '飞盘', qijuMethod: 'zhirun', sex: 1,
		godsPreset: 'system', jiGongMode: 'gen', anGanMode: 'dipan', showAnZhi: true,
		kongMarkBoth: true, showAllKong: true, shiftPalace: 2, shiftZhiFuMode: 'recalc',
		dayJiaJu: 'shitian', feiXingShun: true, feiMenZhongCan: false, fengJu: true,
	}, {}));
	const jinhan = buildDunJiaSnapshotText(calcDunJia(makeFields('2026-02-17', '09:05:00'), nongli, { paiPanType: 6, sex: 1 }, {}));
	const preset = readPreset();
	const snapSections = [...new Set([...extractSections(regular), ...extractSections(jinhan)])];

	test('提取自证:快照段≥17、preset≥18(塌缩必红)', ()=>{
		expect(snapSections.length).toBeGreaterThanOrEqual(17);
		expect(preset.length).toBeGreaterThanOrEqual(18);
	});

	test('🔴 快照段 ⊆ preset(漏登记=自定义段集用户新段被静默滤空)', ()=>{
		const p = new Set(preset);
		expect(snapSections.filter((sct)=>!p.has(sct))).toEqual([]);
	});

	test('🔴 preset ⊆ 快照段 ∪ 条件段白名单(僵尸登记判红)', ()=>{
		const sset = new Set(snapSections);
		expect(preset.filter((sct)=>!sset.has(sct) && !CONDITIONAL[sct])).toEqual([]);
	});

	test('金函专段实登:金函快照产【日家占方（古籍金函系）】且 preset 已含', ()=>{
		expect(extractSections(jinhan)).toContain('日家占方（古籍金函系）');
		expect(preset).toContain('日家占方（古籍金函系）');
	});

	test('脏行防线:快照不含「undefined」字样(命式行缺 sex 时应整行不出)', ()=>{
		const nosex = buildDunJiaSnapshotText(calcDunJia(makeFields('2026-02-17', '09:05:00'), nongli, { paiPanType: 2, school: '转盘', qijuMethod: 'zhirun' }, {}));
		expect(nosex.includes('undefined')).toBe(false);
		expect(regular.includes('undefined')).toBe(false);
		expect(jinhan.includes('undefined')).toBe(false);
	});
});

// 端到端联动锁:段过滤器真跑——勾选集变化必须真实改变导出内容(「勾了没用」当场红)。
describe('[制度化] 段勾选→导出内容端到端联动', ()=>{
	const { filterContentByWantedSections } = require('../aiExport');
	const nongli2 = localNongli('2026-02-17', '09:05:00');
	const jinhanTxt = buildDunJiaSnapshotText(calcDunJia(makeFields('2026-02-17', '09:05:00'), nongli2, { paiPanType: 6, sex: 1 }, {}));
	const regularTxt = buildDunJiaSnapshotText(calcDunJia(makeFields('2026-02-17', '09:05:00'), nongli2, { paiPanType: 2, school: '转盘', qijuMethod: 'zhirun', sex: 1, anGanMode: 'dipan' }, {}));

	test('金函段勾选联动:勾含金函段=保留;不勾=滤空', ()=>{
		const on = filterContentByWantedSections(jinhanTxt, new Set(['日家占方（古籍金函系）']));
		expect(on.includes('八方星门：')).toBe(true);
		const off = filterContentByWantedSections(jinhanTxt, new Set(['起盘信息']));
		expect(off.includes('八方星门：')).toBe(false);
	});

	test('常规盘段联动:只勾[盘型]=新档注记保留而八宫详解滤除;不勾[盘型]=暗干注记消失', ()=>{
		const only = filterContentByWantedSections(regularTxt, new Set(['盘型']));
		expect(only.includes('暗干：')).toBe(true);
		expect(only.includes('[八宫详解]')).toBe(false);
		const without = filterContentByWantedSections(regularTxt, new Set(['起盘信息', '八宫详解']));
		expect(without.includes('暗干：')).toBe(false);
		expect(without.includes('[八宫详解]')).toBe(true);
	});
});
