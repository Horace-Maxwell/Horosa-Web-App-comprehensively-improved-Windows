// [H-H] 🔴 奇门盘缓存键维度完备哨兵(L3):独立页与三式的 getQimenOptionsKey 必须覆盖
// DEFAULT_OPTIONS 里全部影响 calcDunJia 输出的键。漏键=起盘后改档命中旧缓存=死开关
// (真机实抓:anGanMode 切档盘面纹丝不动)。机械提取两侧,豁免键必须理由成文。
import fs from 'fs';
import path from 'path';

const read = (rel)=>fs.readFileSync(path.join(__dirname, rel), 'utf8');

function extractDefaultOptionKeys(src){
	const i = src.indexOf('const DEFAULT_OPTIONS');
	const seg = src.slice(i, src.indexOf('\n};', i));
	const keys = [];
	const re = /^\t(\w+):/gm;
	let m;
	while((m = re.exec(seg))){ keys.push(m[1]); }
	return keys;
}
function extractCacheKeyRefs(src, fnName){
	const i = src.indexOf(`function ${fnName}(options)`);
	const seg = src.slice(i, src.indexOf('\n}', i));
	const refs = new Set();
	const re = /options\.(\w+)/g;
	let m;
	while((m = re.exec(seg))){ refs.add(m[1]); }
	return refs;
}

// 豁免:不进 calcDunJia 或不影响其输出的键(每键理由成文;新增豁免必须写理由)
const EXEMPT = {
	timeAlg: '经 getTimeAlgValue(options) 入键(提取正则以 options.timeAlg 直引兜住,此行仅备注)',
	after23NewDay: '经 getAfter23NewDayValue(options) 入键(独立页);三式直引',
};

describe('[H-H] 奇门盘缓存键维度完备哨兵(L3)', ()=>{
	const dm = read('../DunJiaMain.js');
	const sm = read('../../sanshi/SanShiUnitedMain.js');
	const dmDefaults = extractDefaultOptionKeys(dm);
	const dmRefs = extractCacheKeyRefs(dm, 'getQimenOptionsKey');
	const smRefs = extractCacheKeyRefs(sm, 'getQimenOptionsKey');

	test('提取自证:默认键≥40,两侧缓存键引用≥35(正则漂移塌缩必红)', ()=>{
		expect(dmDefaults.length).toBeGreaterThanOrEqual(40);
		expect(dmRefs.size).toBeGreaterThanOrEqual(35);
		expect(smRefs.size).toBeGreaterThanOrEqual(35);
	});

	test('🔴 独立页:DEFAULT_OPTIONS ⊆ 缓存键引用 ∪ 豁免', ()=>{
		const missing = dmDefaults.filter((k)=>!dmRefs.has(k) && !EXEMPT[k]);
		expect(missing).toEqual([]);
	});

	test('🔴 三式:DEFAULT_OPTIONS ⊆ 缓存键引用 ∪ 豁免', ()=>{
		const missing = dmDefaults.filter((k)=>!smRefs.has(k) && !EXEMPT[k]);
		expect(missing).toEqual([]);
	});

	test('H 批新键点名入键(两侧)', ()=>{
		['godsPreset', 'jiGongMode', 'anGanMode', 'showAnZhi', 'fullNameTips',
		 'feiXingShun', 'feiMenShun', 'feiShenShun', 'feiMenZhongCan', 'feiMenZhongShow',
		 'mixTian', 'mixXing', 'mixMen', 'mixShen',
		 'kongMarkBoth', 'showAllKong', 'shiftZhiFuMode',
		 'dayJiaJu', 'keJiaFenDun', 'keZiZhengHuanShi', 'jinhanMenPai'].forEach((k)=>{
			expect(dmRefs.has(k)).toBe(true);
			expect(smRefs.has(k)).toBe(true);
		});
	});
});
