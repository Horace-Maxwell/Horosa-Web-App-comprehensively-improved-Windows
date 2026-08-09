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

// ══ [B2] 《全书》七档全表 quanshu_full 数据金标(锚点+规则式,不做全表快照) ═══
// 谱系=通行整理表(2026-08-07 考据签字);全表快照抓不到语义错,规则式恰是本轮抓出两个
// 参考源数据腐坏(索引基错位/行内复制错)的手段。
describe('[B2] quanshu_full 七档全表数据金标', ()=>{
	const { STAR_LIGHT_SOURCES } = require('../data/ziweiTables');
	const FULL = STAR_LIGHT_SOURCES.quanshu_full;
	const LEVELS7 = new Set(['庙', '旺', '得', '利', '平', '不', '陷']);
	test('形状:20 星(十四正曜+昌曲+火铃+羊陀)×12 支全键;词汇 ⊆ 七档 ∪ null', ()=>{
		expect(Object.keys(FULL).length).toBe(20);
		Object.keys(FULL).forEach((s)=>{
			expect(Object.keys(FULL[s]).length).toBe(12);
			ZHI.forEach((z)=>{
				const v = FULL[s][z];
				expect(v === null || LEVELS7.has(v)).toBe(true);
			});
		});
	});
	test('🔴 null 结构逐格===基表(结构性不可落宫不变量:羊缺寅巳申亥/陀缺子卯午酉)', ()=>{
		Object.keys(FULL).forEach((s)=>{
			ZHI.forEach((z)=>{
				expect(`${s}${z}:${FULL[s][z] === null}`).toBe(`${s}${z}:${(STAR_LIGHT[s] || {})[z] === undefined || (STAR_LIGHT[s] || {})[z] === null ? true : false}`);
			});
		});
	});
	test('火铃三合四循环(寅午戌庙/申子辰陷/巳酉丑得/亥卯未利)', ()=>{
		[['寅午戌', '庙'], ['申子辰', '陷'], ['巳酉丑', '得'], ['亥卯未', '利']].forEach(([grp, exp])=>{
			grp.split('').forEach((z)=>{
				expect(`火${z}=${FULL['火星'][z]}`).toBe(`火${z}=${exp}`);
				expect(`铃${z}=${FULL['铃星'][z]}`).toBe(`铃${z}=${exp}`);
			});
		});
	});
	test('签字锚点格(含跨派展示格:天府酉 基表陷/七档旺;紫微午庙/太阳卯庙/太阴亥庙/文昌丑庙)', ()=>{
		expect(FULL['天府']['酉']).toBe('旺');
		expect(STAR_LIGHT['天府']['酉']).toBe('陷');
		expect(FULL['紫微']['午']).toBe('庙');
		expect(FULL['太阳']['卯']).toBe('庙');
		expect(FULL['太阳']['戌']).toBe('不');
		expect(FULL['太阴']['亥']).toBe('庙');
		expect(FULL['文昌']['丑']).toBe('庙');
		expect(FULL['擎羊']['辰']).toBe('庙');
		expect(FULL['破军']['子']).toBe('庙');   // 破军子午庙(通说)
		expect(FULL['巨门']['寅']).toBe('庙');   // 巨机居卯庙旺之乡(寅卯庙)
	});
	test('🔴 [G4] 每非默认源效差集非空且两两不同(防死选项/重复选项)', ()=>{
		const { BRIGHTNESS_SOURCE_OPTIONS } = require('../ziweiOptions');
		const allStars = Object.keys(STAR_LIGHT);
		const diffMap = (src)=>{
			const d = [];
			allStars.forEach((s)=>ZHI.forEach((z)=>{
				const a = starLightOf(s, z, 'zi_jian'), b = starLightOf(s, z, src);
				if(a !== b){ d.push(`${s}${z}:${b}`); }
			}));
			return d.join('|');
		};
		const sigs = {};
		// custom 档豁免:其效差=用户逐格自定义(无表时=基表),死选项判据不适用;
		// 注入/LS/回落三层行为由 ziweiBrightnessCustom.test.js 专项金标锁。
		BRIGHTNESS_SOURCE_OPTIONS.map((o)=>o.value).filter((v)=>v !== 'zi_jian' && v !== 'custom').forEach((src)=>{
			const sig = diffMap(src);
			expect(`${src}:${sig === '' ? 'EMPTY' : 'ok'}`).toBe(`${src}:ok`);
			sigs[src] = sig;
		});
		const keys = Object.keys(sigs);
		for(let i = 0; i < keys.length; i++){
			for(let j = i + 1; j < keys.length; j++){
				expect(sigs[keys[i]]).not.toBe(sigs[keys[j]]);
			}
		}
	});
});
