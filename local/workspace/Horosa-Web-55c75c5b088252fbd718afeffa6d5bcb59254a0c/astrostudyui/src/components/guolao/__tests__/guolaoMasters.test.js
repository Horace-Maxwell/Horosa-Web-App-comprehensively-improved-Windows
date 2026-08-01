// 七政四余 三主/命宫配干(五虎遁)/化曜 前端派生 golden(deriveGuolaoMasters,古法立成)。
import { deriveGuolaoMasters, isCombustObj, mergeOrderedYearStars } from '../GuoLaoMoiraPanel';
import * as AstroConst from '../../../constants/AstroConst';

describe('西占 8° 焦伤判定 isCombustObj(非 Moira 3° 伏——那是 starCombust 单一真值)', () => {
	test('七政近日(<8°)或 combust phase → 伏;远离/太阳/四余 → 否', () => {
		expect(isCombustObj({ phase: 'combust' }, 100, 200, AstroConst.MERCURY)).toBe(true);   // phase
		expect(isCombustObj({ phase: 'cazimi' }, 100, 200, AstroConst.VENUS)).toBe(true);       // 核心
		expect(isCombustObj({}, 105, 100, AstroConst.VENUS)).toBe(true);    // 距5°<8
		expect(isCombustObj({}, 120, 100, AstroConst.MARS)).toBe(false);    // 距20°
		expect(isCombustObj({}, 358, 2, AstroConst.MOON)).toBe(true);       // 跨0°环绕 距4°
		expect(isCombustObj({}, 100, 100, AstroConst.SUN)).toBe(false);     // 太阳本身不判
		expect(isCombustObj({}, 100, 100, AstroConst.SOUTH_NODE)).toBe(false);  // 四余(计)不判
		expect(isCombustObj({}, 100, 100, AstroConst.PURPLE_CLOUDS)).toBe(false); // 炁不判
		expect(isCombustObj(null, 100, 100, AstroConst.MARS)).toBe(false);  // 防御
	});
});

describe('deriveGuolaoMasters 古法派生', () => {
	test('命午身酉·命度角宿·甲年:三主/五虎遁/化曜', () => {
		const ms = deriveGuolaoMasters({ zi: '午' }, { zi: '酉' }, '角', '甲');
		expect(ms.lifeMaster).toBe('日');   // 午=狮子宫主日
		expect(ms.bodyMaster).toBe('金');   // 酉=金牛宫主金
		expect(ms.degMaster).toBe('木');    // 角宿度主木
		expect(ms.mingStem).toBe('庚');     // 甲年→寅宫丙;命宫午:丙+4=庚
		expect(ms.mingPalaceZi).toBe('午');
		expect(ms.huayao).toBe('火');       // 甲化火
	});
	test('五虎遁锚点:甲年命寅=丙寅、己年命寅=丙寅、命卯=丁', () => {
		expect(deriveGuolaoMasters({ zi: '寅' }, {}, '', '甲').mingStem).toBe('丙');
		expect(deriveGuolaoMasters({ zi: '寅' }, {}, '', '己').mingStem).toBe('丙');
		expect(deriveGuolaoMasters({ zi: '卯' }, {}, '', '甲').mingStem).toBe('丁');
		expect(deriveGuolaoMasters({ zi: '寅' }, {}, '', '乙').mingStem).toBe('戊');   // 乙庚戊为头
	});
	test('zi 含「宫」后缀也能取地支;缺数据防御不抛', () => {
		const ms = deriveGuolaoMasters({ zi: '子宫' }, { zi: '' }, '', '');
		expect(ms.lifeMaster).toBe('土');   // 子=宝瓶宫主土
		expect(ms.bodyMaster).toBe('');     // 身宫缺→空
		expect(ms.huayao).toBe('');
		expect(()=>deriveGuolaoMasters(null, null, null, null)).not.toThrow();
	});
	test('化曜全 10 干', () => {
		const exp = { 甲: '火', 乙: '月孛', 丙: '木', 丁: '金', 戊: '土', 己: '太阴', 庚: '水', 辛: '紫炁', 壬: '计都', 癸: '罗睺' };
		Object.keys(exp).forEach((g)=>{
			expect(deriveGuolaoMasters({ zi: '子' }, {}, '', g).huayao).toBe(exp[g]);
		});
	});
});

// 宫位化曜合并表(星曜tab):mergeOrderedYearStars 纯函数——钦定宫序 命财兄田子奴夫疾迁官福相 + 本命/流年双化曜同格 + 男女↔子女别名。
describe('宫位化曜合并表 mergeOrderedYearStars', () => {
	// 造 12 宫年曜行(本仓 live 结构:name/star/shortName/quality/zi/signName;子女宫数据名=男女)。
	const P = [
		['命宫', '辰', '天秤'], ['财帛', '卯', '天蝎'], ['兄弟', '寅', '射手'], ['田宅', '丑', '摩羯'],
		['男女', '子', '水瓶'], ['奴仆', '亥', '双鱼'], ['夫妻', '戌', '白羊'], ['疾厄', '酉', '金牛'],
		['迁移', '申', '双子'], ['官禄', '未', '巨蟹'], ['福德', '午', '狮子'], ['相貌', '巳', '处女'],
	];
	function rows(starOf){ return P.map(([name, zi, signName], i)=>({ name, star: starOf(i), shortName: `S${i}`, quality: '正宫', zi, signName })); }

	test('输出恰为钦定 12 宫序 命财兄田子(男女)奴夫疾迁官福相', () => {
		const merged = mergeOrderedYearStars(rows(()=>'孛'), rows(()=>'木'));
		expect(merged.map((r)=>r.name)).toEqual(['命宫', '财帛', '兄弟', '田宅', '男女', '奴仆', '夫妻', '疾厄', '迁移', '官禄', '福德', '相貌']);
	});
	test('本命/流年化曜各自成列(化曜+曜名同格),宫性取共享', () => {
		const merged = mergeOrderedYearStars(rows((i)=>`N${i}`), rows((i)=>`T${i}`));
		const cmd = merged.find((r)=>r.name === '命宫');
		expect(cmd.natalText).toBe('N0 S0');       // 本命化曜·曜名
		expect(cmd.transitText).toBe('T0 S0');      // 流年化曜·曜名
		expect(cmd.sign).toBe('正宫 · 辰 · 天秤');   // 宫性(命/流共享)
	});
	test('男女宫按「子」位排入子女序位(第5),不落末尾', () => {
		const merged = mergeOrderedYearStars(rows(()=>'孛'), rows(()=>'木'));
		expect(merged[4].name).toBe('男女');
	});
	test('缺流年(空)时 transitText 为空,本命仍全序输出', () => {
		const merged = mergeOrderedYearStars(rows(()=>'孛'), []);
		expect(merged).toHaveLength(12);
		expect(merged[0].transitText).toBe('');
		expect(merged[0].natalText).toBe('孛 S0');
	});
	test('空入参 → 空数组(向后兼容,不崩)', () => {
		expect(mergeOrderedYearStars([], [])).toEqual([]);
		expect(mergeOrderedYearStars(null, undefined)).toEqual([]);
	});
});
