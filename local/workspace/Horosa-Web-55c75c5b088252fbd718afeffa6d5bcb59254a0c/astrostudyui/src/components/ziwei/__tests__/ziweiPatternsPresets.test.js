// WP-G 格局检测(本地盘)+ WP-D 流派预设 golden。
import { assembleNatalChart } from '../ZiweiCalc';
import { detectPatterns } from '../ziweiPatterns';
import { ZIWEI_SCHOOL_PRESETS, presetMatches, presetOf } from '../ziweiPresets';
import GE_PATTERNS from '../data/tables/ziweige.json';

const PATTERN_NAMES = new Set(Object.keys(GE_PATTERNS));

describe('WP-G 格局检测(ziweiPatterns)', () => {
	test('对合法盘输出与 Java 同形数组(name/category/duanyi/broken)', () => {
		const c = assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true });
		const ps = detectPatterns(c);
		expect(Array.isArray(ps)).toBe(true);
		ps.forEach((p)=>{
			expect(PATTERN_NAMES.has(p.name)).toBe(true);
			expect(typeof p.category).toBe('string');
			expect(typeof p.duanyi).toBe('string');
			expect(typeof p.broken).toBe('boolean');
			expect('conditions' in p).toBe(true);
		});
	});
	test('确定性:同盘两次检测结果一致', () => {
		const mk = ()=>assembleNatalChart({ yearGan: '壬', yearZi: '辰', monthInt: 5, leap: false, dayInt: 20, timeZi: '卯', male: true });
		const a = detectPatterns(mk()).map((p)=>p.name + ':' + p.broken).join('|');
		const b = detectPatterns(mk()).map((p)=>p.name + ':' + p.broken).join('|');
		expect(a).toBe(b);
	});
	test('命无正曜盘 → 命中「命无正曜」类(若 JSON 含该 op 规则)', () => {
		// 扫年/月/时找一个命宫无主星的盘,断言 mingNoMainStar 规则(若存在)被命中。
		let found = false;
		const hasMingNoMain = Object.values(GE_PATTERNS).some((r)=>JSON.stringify(r.conditions || '').indexOf('mingNoMainStar') >= 0);
		if(!hasMingNoMain){ return; }   // JSON 无该规则则跳过
		outer:
		for(let m = 1; m <= 12 && !found; m++){
			for(let t = 0; t < 12; t++){
				const c = assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: m, leap: false, dayInt: 10, timeZi: ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][t], male: true });
				if((c.houses[c.lifeHouseIndex].starsMain || []).length === 0){
					const ps = detectPatterns(c).map((p)=>p.name);
					const names = Object.keys(GE_PATTERNS).filter((k)=>JSON.stringify(GE_PATTERNS[k].conditions || '').indexOf('mingNoMainStar') >= 0);
					expect(names.some((nm)=>ps.indexOf(nm) >= 0)).toBe(true);
					found = true; break outer;
				}
			}
		}
	});
	test('压测:全 60 甲子年 × 月1/6/12 × 时子午 不抛 + 输出合法', () => {
		const GAN = '甲乙丙丁戊己庚辛壬癸'.split(''); const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
		for(let n = 0; n < 60; n++){
			const c = assembleNatalChart({ yearGan: GAN[n % 10], yearZi: ZHI[n % 12], monthInt: [1, 6, 12][n % 3], leap: false, dayInt: 1 + (n % 28), timeZi: n % 2 ? '午' : '子', male: n % 2 === 0 });
			const ps = detectPatterns(c);
			expect(Array.isArray(ps)).toBe(true);
			ps.forEach((p)=>expect(PATTERN_NAMES.has(p.name)).toBe(true));
		}
	});
	// WP-G 新增 11 格局:各一触发命例 golden(命例经全域枚举搜出;缺一格局即回归)。
	const NEW_GE_TRIGGERS = {
		武贪同行: { yearGan: '甲', yearZi: '子', monthInt: 1, dayInt: 20, timeZi: '丑', male: true },
		紫府朝垣: { yearGan: '甲', yearZi: '子', monthInt: 1, dayInt: 1, timeZi: '申', male: true },
		日月夹命: { yearGan: '甲', yearZi: '子', monthInt: 1, dayInt: 5, timeZi: '丑', male: true },
		紫府夹命: { yearGan: '甲', yearZi: '子', monthInt: 1, dayInt: 5, timeZi: '子', male: true },
		禄合鸳鸯: { yearGan: '甲', yearZi: '子', monthInt: 1, dayInt: 18, timeZi: '丑', male: true },
		君子在野: { yearGan: '甲', yearZi: '子', monthInt: 2, dayInt: 1, timeZi: '酉', male: true },
		两重华盖: { yearGan: '甲', yearZi: '子', monthInt: 2, dayInt: 18, timeZi: '寅', male: true },
		铃昌陀武: { yearGan: '乙', yearZi: '丑', monthInt: 1, dayInt: 1, timeZi: '辰', male: true },
		杀拱廉贞: { yearGan: '丙', yearZi: '子', monthInt: 1, dayInt: 1, timeZi: '子', male: true },
		日月藏辉: { yearGan: '甲', yearZi: '子', monthInt: 1, dayInt: 5, timeZi: '未', male: true },
		文星失位: { yearGan: '甲', yearZi: '子', monthInt: 1, dayInt: 1, timeZi: '子', male: true },
	};
	test('新增 11 格局全部在 JSON 中且各有一触发命例', () => {
		Object.keys(NEW_GE_TRIGGERS).forEach((name)=>{
			expect(PATTERN_NAMES.has(name)).toBe(true);
			const b = NEW_GE_TRIGGERS[name];
			const c = assembleNatalChart({ ...b, leap: false });
			const hit = detectPatterns(c).map((p)=>p.name);
			expect(hit.indexOf(name) >= 0).toBe(true);
		});
	});
	test('新增 op noneInTrine/notInMing:未接线时不误命中(君子在野需紫微在命)', () => {
		// 一个紫微不在命的盘绝不命中君子在野(负判正确性)。
		const c = assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true });
		const life = c.lifeHouseIndex;
		const ziweiInMing = (c.houses[life].starsMain || []).some((s)=>(s.name || '').indexOf('紫微') >= 0);
		if(!ziweiInMing){ expect(detectPatterns(c).map((p)=>p.name).indexOf('君子在野')).toBe(-1); }
	});
});

describe('WP-D 流派预设', () => {
	test('10 预设结构齐(sihua + 全开关含亮度/overlay)', () => {
		const keys = ['daxianSpan', 'tianmaBasis', 'starSet', 'sanPan', 'shangShi', 'leapMonth', 'lateZi', 'yearBoundary', 'huoling', 'kongNaming', 'brightnessSource', 'childLimit', 'zhongxian', 'huoPan', 'qishuWei', 'borrowPalace', 'taiSuiRuGua'];
		['sanhe', 'feixing', 'zhongzhou', 'qintian', 'quanshu', 'heluo', 'ziyun', 'shenshi', 'toupai', 'zhanyan'].forEach((k)=>{
			const p = ZIWEI_SCHOOL_PRESETS[k];
			expect(p).toBeTruthy();
			expect(typeof p.sihua).toBe('string');
			keys.forEach((kk)=>expect(p[kk] !== undefined).toBe(true));
		});
	});
	test('招牌 preset:中州借宫+阴阳互换/河洛气数位/紫云太岁/沈氏三限/透派活盘/占验立极', () => {
		expect(ZIWEI_SCHOOL_PRESETS.zhongzhou.sihua).toBe('zhongzhou');
		expect(ZIWEI_SCHOOL_PRESETS.zhongzhou.shangShi).toBe('yinyang');
		expect(ZIWEI_SCHOOL_PRESETS.zhongzhou.borrowPalace).toBe(true);
		expect(ZIWEI_SCHOOL_PRESETS.qintian.daxianSpan).toBe('ju');
		expect(ZIWEI_SCHOOL_PRESETS.quanshu.sihua).toBe('quanshu');
		// [B3] 全书派四化+亮度同套(修「选全书派不切全书亮度」接线洞);中州派亮度=默认表(基表即中州口径)
		expect(ZIWEI_SCHOOL_PRESETS.quanshu.brightnessSource).toBe('quanshu');
		expect(ZIWEI_SCHOOL_PRESETS.zhongzhou.brightnessSource).toBe('zi_jian');
		expect(ZIWEI_SCHOOL_PRESETS.heluo.starSet).toBe('north18');
		expect(ZIWEI_SCHOOL_PRESETS.heluo.qishuWei).toBe(true);
		expect(ZIWEI_SCHOOL_PRESETS.ziyun.taiSuiRuGua).toBe(true);
		expect(ZIWEI_SCHOOL_PRESETS.shenshi.zhongxian).toBe(true);
		expect(ZIWEI_SCHOOL_PRESETS.toupai.huoPan).toBe(true);
		expect(ZIWEI_SCHOOL_PRESETS.zhanyan.huoPan).toBe(true);
		expect(ZIWEI_SCHOOL_PRESETS.zhanyan.starSet).toBe('north18');
	});
	test('presetMatches/presetOf:默认=三合;改一项→custom', () => {
		const dflt = { daxianSpan: 10, tianmaBasis: 'month', starSet: 'full', sanPan: 'tian', shangShi: 'fixed', leapMonth: 'mid_split', lateZi: 'global', yearBoundary: 'lichun', huoling: 'sanhe', kongNaming: 'modern', brightnessSource: 'zi_jian', lifeMasterBy: 'year_branch', liuYueBasis: 'doujun', liunianSihuaGan: 'year_gan', changshengStart: 'shui_tu', changshengDirection: 'yinyang', kuiYue: 'jia_wu_geng', kongwangStyle: 'double', xiaoxianMode: '0', flowLuanXi: false, flowHuoLing: false, flowShenshaOnChart: false, childLimit: false, zhongxian: false, huoPan: false, qishuWei: false, borrowPalace: false, taiSuiRuGua: false };
		expect(presetMatches('sanhe', 'beipai', dflt)).toBe(true);
		expect(presetOf('beipai', dflt, 'sanhe')).toBe('sanhe');
		expect(presetOf('beipai', dflt, 'feixing')).toBe('feixing');   // 同源消歧:保留用户所选
		const tweaked = { ...dflt, daxianSpan: 'ju' };
		expect(presetOf('beipai', tweaked, 'sanhe')).toBe('qintian');  // 改成局数年→钦天
		const offAll = { ...dflt, starSet: 'north18', huoling: 'nanpai' };
		expect(presetOf('beipai', offAll, 'sanhe')).toBe('custom');    // 无单一 preset 匹配→自定义
	});
});
