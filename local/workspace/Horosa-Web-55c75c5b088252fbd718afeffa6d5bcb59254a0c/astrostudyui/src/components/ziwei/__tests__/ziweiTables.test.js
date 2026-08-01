import {
	NORTH_MAIN_STEP, SOUTH_MAIN_STEP, STARS_YEAR_GAN, STARS_HUOLIN, STARS_JIANG,
	XIAOXIAN_START, HOUSES, CHANGSHENG_12, STARS_BOSI, STARS_TAISUI,
	LIFE_MASTER, BODY_MASTER, DOUJUN, STAR_LIGHT, STAR_LIGHT_QUANSHU, starLightOf, GE_PATTERNS, monthCnOf,
} from '../data/ziweiTables';
import { assembleNatalChart } from '../ZiweiCalc';
import { ZWEngineOptions } from '../ziweiOptions';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

describe('ziweiTables · 数据表 loader 完整性', ()=>{
	test('主星步长:北6南8', ()=>{
		expect(Object.keys(NORTH_MAIN_STEP).length).toBe(6);
		expect(Object.keys(SOUTH_MAIN_STEP).length).toBe(8);
		expect(NORTH_MAIN_STEP['紫微']).toBe(0);
		expect(SOUTH_MAIN_STEP['破军']).toBe(10);
	});
	test('年干系含 禄存/擎羊/陀罗/魁钺/截空,各 10 干;截空双字', ()=>{
		['天魁', '天钺', '禄存', '擎羊', '陀罗', '截空', '天官', '天福', '天厨'].forEach((s)=>{
			expect(STARS_YEAR_GAN[s]).toBeTruthy();
			expect(Object.keys(STARS_YEAR_GAN[s].pos).length).toBe(10);
		});
		expect(STARS_YEAR_GAN['禄存'].pos['甲']).toBe('寅');     // 甲禄存在寅(锚点)
		expect(STARS_YEAR_GAN['截空'].pos['甲'].length).toBe(2); // 双星 2 字
	});
	test('三合组表已拆成 12 支:火铃/将前/小限', ()=>{
		ZHI.forEach((zhi)=>{
			expect(STARS_HUOLIN[zhi]).toBeTruthy();
			expect(STARS_HUOLIN[zhi]['火星']).toBeTruthy();
			expect(STARS_HUOLIN[zhi]['铃星']).toBeTruthy();
			expect(STARS_JIANG[zhi]).toBeTruthy();
			expect(XIAOXIAN_START[zhi]).toBeTruthy();
		});
		// 寅午戌 同组 → 火星起宫一致
		expect(STARS_HUOLIN['寅']).toEqual(STARS_HUOLIN['午']);
		expect(STARS_HUOLIN['午']).toEqual(STARS_HUOLIN['戌']);
	});
	test('小星组 12 长度 + 命主身主 12 支 + 斗君 12 月 + 庙旺/格局非空', ()=>{
		expect(HOUSES.length).toBe(12);
		expect(CHANGSHENG_12.length).toBe(12);
		expect(STARS_BOSI.length).toBe(12);
		expect(STARS_TAISUI.length).toBe(12);
		expect(Object.keys(LIFE_MASTER).length).toBe(12);
		expect(Object.keys(BODY_MASTER).length).toBe(12);
		expect(Object.keys(DOUJUN).length).toBe(12);
		expect(Object.keys(STAR_LIGHT).length).toBeGreaterThan(0);
		expect(Object.keys(GE_PATTERNS).length).toBeGreaterThan(0);
	});
	test('月名映射:1→正月,11→冬月,12→腊月', ()=>{
		expect(monthCnOf(1)).toBe('正月');
		expect(monthCnOf(11)).toBe('冬月');
		expect(monthCnOf(12)).toBe('腊月');
	});
});

describe('WP-L 亮度《全书》版切换', ()=>{
	test('quanshu delta 全部与默认表不同(仅存差异格)', ()=>{
		Object.keys(STAR_LIGHT_QUANSHU).forEach((star)=>{
			Object.keys(STAR_LIGHT_QUANSHU[star]).forEach((zhi)=>{
				expect(STAR_LIGHT_QUANSHU[star][zhi]).not.toBe((STAR_LIGHT[star] || {})[zhi]);
			});
		});
	});
	test('starLightOf:zi_jian 源逐格===默认表(零回归)', ()=>{
		['擎羊', '铃星', '火星', '紫微', '太阳', '太阴'].forEach((star)=>{
			ZHI.forEach((zhi)=>{
				expect(starLightOf(star, zhi, 'zi_jian')).toBe((STAR_LIGHT[star] || {})[zhi]);
			});
		});
	});
	test('starLightOf:quanshu 命中 delta 用《全书》值,缺格回落默认', ()=>{
		expect(starLightOf('擎羊', '子', 'quanshu')).toBe('旺');   // 默认陷→全书旺
		expect(starLightOf('擎羊', '酉', 'quanshu')).toBe('旺');
		expect(starLightOf('铃星', '亥', 'quanshu')).toBe('陷');   // 默认庙→全书陷
		expect(starLightOf('火星', '卯', 'quanshu')).toBe('得');   // 默认平→全书得
		// 未被 delta 覆盖的格回落默认表
		expect(starLightOf('擎羊', '丑', 'quanshu')).toBe(STAR_LIGHT['擎羊']['丑']);
		expect(starLightOf('紫微', '子', 'quanshu')).toBe(STAR_LIGHT['紫微']['子']);
	});
	test('亮度纯显示层:decorateStar 恒存【基础(zi_jian)】值,不随亮度源变(memo稳定/不改安星)', ()=>{
		// 壬年禄存在亥→擎羊在子。盘数据(star.starlight)恒=陷(基础),与 brightnessSource 无关;
		// 《全书》庙旺覆盖(擎羊子→旺)在显示层(ZWCommHouse.effStarLight,用 starLightOf/STAR_LIGHT_QUANSHU),
		// 故切亮度绝不重排盘/改命主(实测坑修复)。
		const prev = ZWEngineOptions.brightnessSource;
		try{
			['zi_jian', 'quanshu'].forEach((src)=>{
				ZWEngineOptions.brightnessSource = src;
				const c = assembleNatalChart({ yearGan: '壬', yearZi: '子', monthInt: 3, leap: false, dayInt: 10, timeZi: '卯', male: true });
				const yang = findStar(c, '擎羊');
				expect(yang && yang.branch).toBe('子');
				expect(yang.starlight).toBe('陷');   // 盘数据恒=基础值,不因亮度源变(memo稳定)
			});
			// 显示层覆盖逻辑(effStarLight 等价):quanshu 时擎羊子取《全书》旺
			expect(starLightOf('擎羊', '子', 'quanshu')).toBe('旺');
			expect(starLightOf('擎羊', '子', 'zi_jian')).toBe('陷');
		}finally{ ZWEngineOptions.brightnessSource = prev; }
	});
});

function findStar(chart, name){
	for(let i = 0; i < 12; i++){
		const h = chart.houses[i];
		const fields = ['starsMain', 'starsAssist', 'starsEvil', 'starsOthersGood', 'starsOthersBad', 'starsSmall'];
		for(const f of fields){
			const hit = (h[f] || []).find((s)=>(s.name || '').replace(/^副/, '') === name);
			if(hit){ return { branch: ZHI[i], starlight: hit.starlight }; }
		}
	}
	return null;
}
