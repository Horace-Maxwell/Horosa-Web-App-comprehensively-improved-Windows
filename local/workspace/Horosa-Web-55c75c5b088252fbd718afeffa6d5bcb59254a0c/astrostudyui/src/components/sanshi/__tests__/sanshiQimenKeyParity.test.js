// [H-H] 三式合一奇门键位同步清单哨兵(L3):独立页 DEFAULT_OPTIONS 键集 ⊆ 三式 QIMEN_OPTIONS 键集 ∪ 豁免。
//   语义:独立页每加一个引擎/口径键,三式必须同步透传(三式合一同步铁律);豁免键必须理由成文。
//   机械提取两文件字面量(剥不掉就红),不手抄清单——新键漏同步当场判红。
import fs from 'fs';
import path from 'path';

const read = (rel)=>fs.readFileSync(path.join(__dirname, rel), 'utf8');

function extractObjKeys(src, marker){
	const i = src.indexOf(marker);
	if(i < 0){ return null; }
	const seg = src.slice(i, src.indexOf('\n};', i));
	const keys = [];
	const re = /^\t(\w+):/gm;
	let m;
	while((m = re.exec(seg))){ keys.push(m[1]); }
	return keys;
}

// 豁免:独立页键不进三式 QIMEN_OPTIONS 的合法理由(每键一句,新增豁免必须写理由)
const EXEMPT = {
	after23NewDay: '三式全局时间设置层专门处理(sanshiRecalcKeysCompleteness 豁免锚已锁)',
	lateZiHourUseNextDay: '同上:晚子时归属走三式全局时间层',
	timeAlg: '同上:真太阳时/直接时间走三式全局时间层',
	fullNameTips: '独立页专属显示档(词条标题全名只作用于独立页悬停词条,三式不产此 UI)',
};

describe('[H-H] 三式奇门键位同步清单哨兵(L3)', ()=>{
	const dm = read('../../dunjia/DunJiaMain.js');
	const sm = read('../SanShiUnitedMain.js');
	const dmKeys = extractObjKeys(dm, 'const DEFAULT_OPTIONS');
	const smKeys = extractObjKeys(sm, 'const QIMEN_OPTIONS');

	test('提取自证:两键集规模下限(正则漂移塌缩必红)', ()=>{
		expect(dmKeys && dmKeys.length).toBeGreaterThanOrEqual(40);
		expect(smKeys && smKeys.length).toBeGreaterThanOrEqual(38);
	});

	test('🔴 独立页 ⊆ 三式 ∪ 豁免(漏同步键当场红)', ()=>{
		const smSet = new Set(smKeys);
		const missing = dmKeys.filter((k)=>!smSet.has(k) && !EXEMPT[k]);
		expect(missing).toEqual([]);
	});

	test('豁免不冗余:豁免键必须真的不在三式(在了就该删豁免)', ()=>{
		const smSet = new Set(smKeys);
		const stale = Object.keys(EXEMPT).filter((k)=>smSet.has(k));
		expect(stale).toEqual([]);
	});

	test('H 批新键点名在场(两侧):寄宫/飞盘细项/混合/空亡/移星值符/日刻家/金函', ()=>{
		const must = ['godsPreset', 'anGanMode', 'showAnZhi', 'jiGongMode',
			'feiXingShun', 'feiMenShun', 'feiShenShun', 'feiMenZhongCan', 'feiMenZhongShow',
			'mixTian', 'mixXing', 'mixMen', 'mixShen',
			'kongMarkBoth', 'showAllKong', 'shiftZhiFuMode',
			'dayJiaJu', 'keJiaFenDun', 'keZiZhengHuanShi', 'jinhanMenPai'];
		const dmSet = new Set(dmKeys);
		const smSet = new Set(smKeys);
		must.forEach((k)=>{
			expect(dmSet.has(k)).toBe(true);
			expect(smSet.has(k)).toBe(true);
		});
	});
});

// [QA1] 🔴 三式事盘载入键完整性守卫:载入段必须有「QIMEN_OPTIONS 键集驱动灌注」循环
// (病史:手写白名单缺 23 个新键=存档带新档设置重开全部丢回默认,存了白存)。
describe('[QA1] 三式事盘载入键集驱动守卫', ()=>{
	const sm = read('../SanShiUnitedMain.js');
	test('键集驱动循环在位(Object.keys(QIMEN_OPTIONS) 遍历灌 payload.options)', ()=>{
		const i = sm.indexOf('Object.keys(QIMEN_OPTIONS).forEach((qk)=>{');
		expect(i).toBeGreaterThan(0);
		const seg = sm.slice(i, i + 220);
		expect(seg.includes('payload.options[qk] !== undefined')).toBe(true);
		expect(seg.includes('options[qk] = payload.options[qk]')).toBe(true);
	});
	test('负锚:该循环必须在载入函数体内(parseCasePayload 消费之后)', ()=>{
		const iLoad = sm.indexOf('const payload = this.parseCasePayload(currentCase.payload');
		const iLoop = sm.indexOf('Object.keys(QIMEN_OPTIONS).forEach((qk)=>{');
		expect(iLoad).toBeGreaterThan(0);
		expect(iLoop).toBeGreaterThan(iLoad);
		expect(iLoop - iLoad).toBeLessThan(12000);
	});
});
