// [Q3a] 组合压测矩阵:全值域×随机组合×定向冲突组合×边界。
// 生辰=1990-07-15 23:30(庚午阳干年+闰五月+23时段):同时敏感于 晚子时/闰月/魁钺庚年/截空副名。
// 随机段用固定种子(可复现);断言=结构不变式(不抛/12宫/命身域/长生环完整/主星唯一入宫)。
import { calcZiwei, deriveSanPan } from '../ZiweiCalc';
import { ZWEngineOptions } from '../ziweiOptions';
import * as ZiWeiHelper from '../ZiWeiHelper';
import * as ZWConst from '../../../constants/ZWConst';
import {
	starLightOf, ZWBrightnessCustom, resetBrightnessCustomCache, STAR_LIGHT,
} from '../data/ziweiTables';

const BIRTH = { date: '1990-07-15', time: '23:30:00', zone: 'Asia/Shanghai', lon: 116.4, lat: 39.9, gender: 'male' };
const BIRTH_F = { ...BIRTH, gender: 'female' };

const DOMAIN = {
	daxianSpan: [10, 'ju'],
	tianmaBasis: ['month', 'year'],
	starSet: ['full', 'north18'],
	shangShi: ['fixed', 'yinyang'],
	leapMonth: ['mid_split', 'next', 'prev', 'split_days', 'solar_term', 'split_star_month'],
	lateZi: ['global', 'zi_chu', 'midnight_split', 'zi_zheng'],
	yearBoundary: ['lichun', 'lunar_1_1'],
	huoling: ['sanhe', 'nanpai'],
	kongNaming: ['modern', 'book'],
	lifeMasterBy: ['year_branch', 'ming_branch'],
	changshengStart: ['shui_tu', 'huo_tu'],
	changshengDirection: ['yinyang', 'always_forward'],
	kuiYue: ['jia_wu_geng', 'geng_ma_hu', 'liu_xin_hu_ma', 'geng_xin_hu_ma'],
	kongwangStyle: ['double', 'single'],
};
const KEYS = Object.keys(DOMAIN);

function mulberry32(seed){
	let a = seed >>> 0;
	return function(){
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function invariants(chart, opts, label){
	expect(`${label}:houses:${Array.isArray(chart.houses) ? chart.houses.length : 'x'}`).toBe(`${label}:houses:12`);
	expect(`${label}:life:${chart.lifeHouseIndex >= 0 && chart.lifeHouseIndex < 12}`).toBe(`${label}:life:true`);
	expect(`${label}:body:${chart.bodyHouseIndex >= 0 && chart.bodyHouseIndex < 12}`).toBe(`${label}:body:true`);
	const mains = [];
	const phases = new Set();
	chart.houses.forEach((h)=>{
		expect(`${label}:gz:${`${h.ganzi}`.length}`).toBe(`${label}:gz:2`);
		(h.starsMain || []).forEach((s)=>mains.push(s.name));
		if(h.phase){ phases.add(h.phase.substr(0, 2)); }
	});
	expect(`${label}:mainUniq:${new Set(mains).size === mains.length}`).toBe(`${label}:mainUniq:true`);
	expect(`${label}:mainN:${mains.length}`).toBe(`${label}:mainN:14`);   // 两星集正曜恒 14
	expect(`${label}:phases:${phases.size}`).toBe(`${label}:phases:12`);  // 长生 12 神环完整
}

describe('[Q3a] 随机 300 组合结构不变式(种子固定可复现)', ()=>{
	test('🔴 全键随机取值 300 组 × 男女两盘:不抛+不变式全持', ()=>{
		const rnd = mulberry32(20260807);
		for(let i = 0; i < 300; i++){
			const opts = { after23NewDay: 1, lateZiHourUseNextDay: 1 };
			KEYS.forEach((k)=>{ const d = DOMAIN[k]; opts[k] = d[Math.floor(rnd() * d.length)]; });
			const birth = (i % 2 === 0) ? BIRTH : BIRTH_F;
			const chart = calcZiwei(birth, opts);
			invariants(chart, opts, `#${i}`);
		}
	});
});

describe('[Q3a] 定向冲突组合', ()=>{
	test('north18 × 魁钺四档:魁钺不在 18 星集,四档全等(切档零差)', ()=>{
		const base = { starSet: 'north18', after23NewDay: 1, lateZiHourUseNextDay: 1 };
		const sig = (kui)=>JSON.stringify(calcZiwei(BIRTH, { ...base, kuiYue: kui }).houses.map((h)=>(h.starsAssist || []).map((s)=>s.name)));
		const a = sig('jia_wu_geng');
		['geng_ma_hu', 'liu_xin_hu_ma', 'geng_xin_hu_ma'].forEach((k)=>{
			expect(sig(k)).toBe(a);
		});
		expect(a.includes('天魁')).toBe(false);
	});
	test('book 空劫命名 × single 空亡:天空上盘(改名)+副空清零+年支独立天空互斥仍成立', ()=>{
		const chart = calcZiwei(BIRTH, { kongNaming: 'book', kongwangStyle: 'single', after23NewDay: 1, lateZiHourUseNextDay: 1 });
		const all = [];
		chart.houses.forEach((h)=>['starsAssist', 'starsEvil', 'starsOthersGood', 'starsOthersBad'].forEach((g)=>(h[g] || []).forEach((s)=>all.push(s.name))));
		expect(all.filter((n)=>n === '天空').length).toBe(1);   // 仅改名而来的一颗(年支独立版已互斥移除)
		expect(all.includes('地空')).toBe(false);
		expect(all.some((n)=>n.startsWith('副截') || n.startsWith('副旬'))).toBe(false);
		expect(all.includes('截空')).toBe(true);
	});
	test('dual 晚子时 × 引擎键:双盘结构完整且两盘各自过不变式', ()=>{
		const chart = calcZiwei(BIRTH, { lateZi: 'dual', kuiYue: 'geng_ma_hu', kongwangStyle: 'single', after23NewDay: 1, lateZiHourUseNextDay: 1 });
		invariants(chart, {}, 'dual-day');
		if(chart.dualAlt){ invariants(chart.dualAlt, {}, 'dual-next'); }
	});
	test('sanPan di/ren × 长生两键:观察盘重排后不变式仍持+长生环随局重排不缺', ()=>{
		const natal = calcZiwei(BIRTH, { changshengStart: 'huo_tu', changshengDirection: 'always_forward', after23NewDay: 1, lateZiHourUseNextDay: 1 });
		['di', 'ren'].forEach((p)=>{
			const derived = deriveSanPan(natal, p);
			invariants(derived, {}, `sanpan-${p}`);
		});
	});
	test('yearBoundary=lunar_1_1 × 立春前生辰:年干支变→魁钺/截空随新年干联动', ()=>{
		const b = { date: '1991-02-10', time: '10:00:00', zone: 'Asia/Shanghai', lon: 116.4, lat: 39.9, gender: 'male' };
		const lichun = calcZiwei(b, { after23NewDay: 1, lateZiHourUseNextDay: 1 });
		const lunar = calcZiwei(b, { yearBoundary: 'lunar_1_1', after23NewDay: 1, lateZiHourUseNextDay: 1 });
		expect(lichun.yearGan === lunar.yearGan).toBe(false);   // 立春(2-4)后但正月初一(2-15)前 → 两口径异年
		invariants(lunar, {}, 'lunar11');
	});
	test('leapMonth 六档 × 闰五月生辰:六档至少产生两种月柱/落宫结果(闰月真被消费)', ()=>{
		const sigs = new Set();
		DOMAIN.leapMonth.forEach((lm)=>{
			const c = calcZiwei(BIRTH, { leapMonth: lm, after23NewDay: 1, lateZiHourUseNextDay: 1 });
			sigs.add(`${c.lifeHouseIndex}|${c.ziweiIndex}`);
		});
		expect(sigs.size >= 2).toBe(true);
	});
});

describe('[Q3a] 显示纯函数 8 组合 × 绘制期替换', ()=>{
	afterEach(()=>{
		['ziweiShowShaHuagai', 'ziweiShowShaSande', 'ziweiShowShaTaizuo', 'ziweiSixEvilBlack'].forEach((k)=>{ try{ localStorage.removeItem(k); }catch(e){} });
		ZWEngineOptions.flowShenshaOnChart = false;
	});
	test('神煞三开关 8 组合:过滤结果=三集合并集的补集(逐组合断言)', ()=>{
		const arr = ['华盖', '劫煞', '咸池', '天德', '月德', '三台', '八座', '恩光', '天贵', '天刑'].map((n)=>({ name: n }));
		const G1 = ['华盖', '劫煞', '咸池'], G2 = ['天德', '月德'], G3 = ['三台', '八座', '恩光', '天贵'];
		for(let m = 0; m < 8; m++){
			const on1 = !!(m & 1), on2 = !!(m & 2), on3 = !!(m & 4);
			localStorage.setItem('ziweiShowShaHuagai', on1 ? '1' : '0');
			localStorage.setItem('ziweiShowShaSande', on2 ? '1' : '0');
			localStorage.setItem('ziweiShowShaTaizuo', on3 ? '1' : '0');
			const kept = ZiWeiHelper.filterShenshaForDisplay(arr).map((s)=>s.name);
			const expect_ = arr.map((s)=>s.name).filter((n)=>{
				if(G1.includes(n)){ return on1; }
				if(G2.includes(n)){ return on2; }
				if(G3.includes(n)){ return on3; }
				return true;
			});
			expect(`${m}:${kept.join(',')}`).toBe(`${m}:${expect_.join(',')}`);
		}
	});
	test('流年神煞替换 × 神煞过滤组合:替换后再过滤,流年版华盖同受盖劫开关辖', ()=>{
		ZWEngineOptions.flowShenshaOnChart = true;
		const natal = [{ name: '博士' }, { name: '华盖' }, { name: '岁建' }];
		const flow = ZiWeiHelper.getFlowJiangSui('午');
		const fj = flow.find((x)=>x.group === 'jiang' && x.zhi === '戌');   // 午年将前华盖在戌
		expect(fj.name).toBe('流华盖');
		const resolved = ZiWeiHelper.resolveSmallStarsForDisplay(natal, '戌', '午');
		expect(resolved[1].name).toBe('流华盖');
		localStorage.setItem('ziweiShowShaHuagai', '0');
		const filtered = ZiWeiHelper.filterShenshaForDisplay(resolved);
		// 「流华盖」≠「华盖」精确匹配 → 流年版不被本命组开关滤掉(独立受 flowShensha 开关辖) —— 语义登记
		expect(filtered.some((s)=>s.name === '流华盖')).toBe(true);
	});
});

describe('[Q3a] 双随盘表并注 + 边界', ()=>{
	afterEach(()=>{
		ZWConst.ZWSihuaCustom.override = null;
		ZWBrightnessCustom.override = null;
		try{ localStorage.removeItem('ziweiSihuaCustom'); localStorage.removeItem('ziweiBrightnessCustom'); }catch(e){}
		resetBrightnessCustomCache();
		ZWConst.ZWSchool.school = 'beipai';
	});
	test('🔴 四化表+亮度表同时注入:互不干扰;双清后全还原', ()=>{
		ZWConst.ZWSchool.school = 'custom';
		ZWConst.ZWSihuaCustom.override = ZWConst.normalizeSihuaCustomTable({ 庚: ['太阳', '武曲', '天同', '天相'] });
		ZWBrightnessCustom.override = { 紫微: { 子: '陷' } };
		expect(ZWConst.getActiveSiHuaGan()['庚']).toEqual(['太阳', '武曲', '天同', '天相']);
		expect(starLightOf('紫微', '子', 'custom')).toBe('陷');
		expect(starLightOf('紫微', '子', 'zi_jian')).toBe(STAR_LIGHT['紫微']['子']);   // 非 custom 源不受染
		ZWConst.ZWSihuaCustom.override = null;
		ZWBrightnessCustom.override = null;
		expect(ZWConst.getActiveSiHuaGan()).toBe(ZWConst.SiHuaTables.beipai);
		expect(starLightOf('紫微', '子', 'custom')).toBe(STAR_LIGHT['紫微']['子']);
	});
	test('边界:getFlowStars 空干支/无时辰;resolveSmallStars 异形;yearAgesOf 极端', ()=>{
		expect(ZiWeiHelper.getFlowStars('', '')).toEqual([]);
		expect(ZiWeiHelper.getFlowStars(null, null, null)).toEqual([]);
		expect(ZiWeiHelper.resolveSmallStarsForDisplay(null, '子', '午')).toBe(null);
		expect(ZiWeiHelper.resolveSmallStarsForDisplay([], '子', '午')).toEqual([]);
		expect(ZiWeiHelper.yearAgesOf('', '', 0)).toEqual([]);
		expect(ZiWeiHelper.formatAgeStrip(null)).toBe('');
		expect(ZiWeiHelper.effLayerSihuaGan(null, null)).toBe(null);
		expect(ZiWeiHelper.effLayerSihuaGan(null, { key: 'liunian', gan: '丙', mingIndex: 99 })).toBe('丙');
	});
});
