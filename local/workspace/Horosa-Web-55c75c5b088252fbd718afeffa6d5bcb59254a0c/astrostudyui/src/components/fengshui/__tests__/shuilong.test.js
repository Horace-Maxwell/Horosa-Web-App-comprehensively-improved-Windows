// 水龙（平洋）golden —— 古籍口径逐条锚；重点守「与山龙相反」的几处不可套用。
import { shuilong, fenPai } from '../shuilong';
import {
	SHUILONG_4JI, SHUI_8JI_ZI, SHUI_8XIONG_ZI, SHUILONG_XUE_6, SHUILONG_3GE, XIDAO_LOUDAO,
	SHUILONG_JIGE, SHUILONG_XIONGGE, SHUILONG_WUXING, PINGYANG_4, SHUIXUE_ZANGFA, HUANBAO_GRADE, ZHUANZHE_GRADE,
} from '../fengshuiShuilongData';

describe('水龙 · 顶层分派', ()=>{
	test('五地形二分派：山区/丘陵→山龙，平原/水乡→水龙', ()=>{
		expect(fenPai('山区').fa).toBe('shan');
		expect(fenPai('丘陵').fa).toBe('shan');
		expect(fenPai('平原').fa).toBe('shui');
		expect(fenPai('水乡').fa).toBe('shui');
	});
	test('平冈按见水与否二次判定（古籍：高一寸为山、低一寸为水）', ()=>{
		expect(fenPai('平冈', true).fa).toBe('shui');
		expect(fenPai('平冈', false).fa).toBe('shan');
		expect(shuilong({ dixing: '平冈', pingGangJianShui: false }).pai.fa).toBe('shan');
		expect(shuilong({ dixing: '平原' }).gaocun).toMatch(/高一寸为山/);
	});
	test('非法地形返回不可用', ()=>{
		expect(shuilong({ dixing: 'X' }).available).toBe(false);
	});
});

describe('水龙 · 数据完整性（古籍枚举）', ()=>{
	test('四级/八吉字/八凶字/穴形六/三大格/吉格8类18图/凶格6类', ()=>{
		expect(SHUILONG_4JI).toHaveLength(4);
		expect(SHUI_8JI_ZI).toHaveLength(8);
		expect(SHUI_8XIONG_ZI).toHaveLength(8);
		expect(SHUI_8JI_ZI.map((z)=>z.zi).join('')).toBe('眷恋廻环交锁织结');
		expect(SHUI_8XIONG_ZI.map((z)=>z.zi).join('')).toBe('穿牵割射反直斜冲');
		expect(SHUILONG_XUE_6.map((x)=>x.name).join('')).toBe('节苞珠乳窝钳');
		expect(SHUILONG_3GE).toHaveLength(3);
		expect(SHUILONG_JIGE).toHaveLength(8);
		// 吉格逐类图数＝古籍图 5-7～5-28（1+3+6+2+2+2+4+2＝22 幅）。
		expect(SHUILONG_JIGE.reduce((a, g)=>a + g.n, 0)).toBe(22);
		expect(SHUILONG_XIONGGE).toHaveLength(6);
		expect(PINGYANG_4).toHaveLength(4);
	});
	test('🔴 水龙五星与山龙相反：金水土吉、木火最忌，且显式标注反差', ()=>{
		expect(SHUILONG_WUXING.ji).toEqual(['金', '水', '土']);
		expect(SHUILONG_WUXING.xiong).toEqual(['木', '火']);
		expect(SHUILONG_WUXING.fanCha).toMatch(/与山龙相反/);
	});
	test('🔴 葬深硬上限 2 米（过深水泡棺）', ()=>{
		expect(SHUIXUE_ZANGFA.maxDepthM).toBe(2);
		expect(SHUIXUE_ZANGFA.jinji).toMatch(/不能像山穴一样挖 2 米/);
	});
});

describe('水龙 · 逐项判定与计分', ()=>{
	const S = (o)=>shuilong({ dixing: '平原', ...o });

	test('玄武之水：绕抱为吉、直横反跳为割脉凶', ()=>{
		expect(S({ xuanwu: 'rao' }).items.find((i)=>i.key === 'xuanwu').score).toBe(2);
		expect(S({ xuanwu: 'ge' }).items.find((i)=>i.key === 'xuanwu').jx).toBe('bad');
	});
	test('取支不取干：干龙扣分、支龙加分', ()=>{
		expect(S({ ji: '大干龙' }).items.find((i)=>i.key === 'ji').jx).toBe('bad');
		expect(S({ ji: '小支流' }).items.find((i)=>i.key === 'ji').jx).toBe('good');
	});
	test('枝水缠护层数递增（一水单缠→双流界抱→层层包裹）', ()=>{
		expect(S({ chanRao: 1 }).items.find((i)=>i.key === 'chanrao').score).toBe(1);
		expect(S({ chanRao: 3 }).items.find((i)=>i.key === 'chanrao').score).toBe(3);
	});
	test('八吉字加分、八凶字扣分（各封顶 4）', ()=>{
		expect(S({ jiZi: ['眷', '恋', '环'] }).items.find((i)=>i.key === 'jizi').score).toBe(3);
		expect(S({ jiZi: SHUI_8JI_ZI.map((z)=>z.zi) }).items.find((i)=>i.key === 'jizi').score).toBe(4);
		expect(S({ xiongZi: ['穿', '牵'] }).items.find((i)=>i.key === 'xiongzi').score).toBe(-2);
		expect(S({ xiongZi: SHUI_8XIONG_ZI.map((z)=>z.zi) }).items.find((i)=>i.key === 'xiongzi').score).toBe(-4);
		expect(S({ jiZi: ['X'] }).items.find((i)=>i.key === 'jizi')).toBeUndefined();   // 非法字被滤
	});
	test('🔴 息道/漏道：漏道为重扣（多转总成空）、息道为吉', ()=>{
		expect(S({ xidao: '息道' }).items.find((i)=>i.key === 'xidao').score).toBe(2);
		const lou = S({ xidao: '漏道' }).items.find((i)=>i.key === 'xidao');
		expect(lou.score).toBe(-4);
		expect(lou.verdict).toMatch(/泄气不吉/);
	});
	test('环抱重数与转折数按档计（1／2-3／≥4）', ()=>{
		expect(S({ huanbao: 1 }).huanbao.rank).toBe('吉穴');
		expect(S({ huanbao: 3 }).huanbao.rank).toBe('大吉穴');
		expect(S({ huanbao: 5 }).huanbao.rank).toBe('富贵无双之穴');
		expect(S({ zhuanzhe: 1 }).zhuanzhe.rank).toMatch(/抱穴/);
		expect(S({ zhuanzhe: 4 }).zhuanzhe.rank).toMatch(/卿相/);
		expect(S({ huanbao: 0 }).huanbao).toBeNull();
	});
	test('🔴 穴后：水穴后空为吉、后高为凶（与山龙相反）', ()=>{
		const kong = S({ houKong: true }).items.find((i)=>i.key === 'houkong');
		const gao = S({ houKong: false }).items.find((i)=>i.key === 'houkong');
		expect(kong.jx).toBe('good');
		expect(gao.jx).toBe('bad');
		expect(gao.detail).toMatch(/山穴后高丁禄盛，水穴后高绝无踪/);
	});
	test('🔴 五星：金水土加分、木火重扣（与山龙相反）', ()=>{
		expect(S({ wuxing: '金' }).items.find((i)=>i.key === 'wuxing').score).toBe(2);
		expect(S({ wuxing: '火' }).items.find((i)=>i.key === 'wuxing').score).toBe(-3);
	});
	test('吉格 +3 带名局实例、凶格 −4', ()=>{
		const j = S({ jiGe: '干水城垣格' });
		expect(j.items.find((i)=>i.key === 'jige').score).toBe(3);
		expect(j.items.find((i)=>i.key === 'jige').detail).toMatch(/柳州|阆中/);
		expect(S({ xiongGe: '水城反跳' }).items.find((i)=>i.key === 'xiongge').score).toBe(-4);
	});
	test('总分＝逐项和；grade 分五档', ()=>{
		const r = S({ xuanwu: 'rao', ji: '小支流', chanRao: 3, jiZi: ['眷', '恋', '环', '交'],
			xueXing: '窝', geKey: 'zuoshui', xidao: '息道', huanbao: 5, zhuanzhe: 4, houKong: true, wuxing: '金', jiGe: '曲水朝堂格' });
		expect(r.total).toBe(r.items.reduce((a, x)=>a + x.score, 0));
		expect(r.grade.jx).toBe('good');
		const bad = S({ xuanwu: 'ge', ji: '大干龙', xiongZi: SHUI_8XIONG_ZI.map((z)=>z.zi), xidao: '漏道', houKong: false, wuxing: '火', xiongGe: '干龙散气格' });
		expect(bad.grade.jx).toBe('bad');
	});
});

describe('水龙 · 三大格与玄空立向联动', ()=>{
	test('坐水骑龙＝最上格，立向出上山下水/双星会坐，并带后荫门槛', ()=>{
		const r = shuilong({ dixing: '平原', geKey: 'zuoshui' });
		expect(r.ge.rank).toMatch(/最上格/);
		expect(r.lixiang[0].how).toMatch(/上山下水|双星会坐/);
		expect(r.ge.houyin).toMatch(/不可有小枝流分流/);
	});
	test('向水攀龙＝双星会向，且列四种情况', ()=>{
		const r = shuilong({ dixing: '平原', geKey: 'xiangshui' });
		expect(r.lixiang[0].how).toMatch(/双星会向/);
		expect(r.ge.situations).toHaveLength(4);
	});
	test('挟龙倚水＝生旺之星挨排该宫（不二法门），并带「不可径直朝向该宫」告诫', ()=>{
		const r = shuilong({ dixing: '平原', geKey: 'xielong' });
		expect(r.lixiang[0].how).toMatch(/生旺之星挨排在该宫/);
		expect(r.ge.zhuyi).toMatch(/脱龙气/);
	});
});

describe('水龙 · 健壮性与无死开关', ()=>{
	test('脏入参不抛不 NaN', ()=>{
		[{}, { dixing: '平原', jiZi: null, xiongZi: 'x', chanRao: -5, huanbao: 'a', zhuanzhe: {} },
			{ dixing: '水乡', geKey: 'X', xidao: 'X', jiGe: 'X', xiongGe: 'X', wuxing: 'X' }].forEach((o)=>{
			const r = shuilong(o);
			expect(r.available).toBe(true);
			expect(Number.isFinite(r.total)).toBe(true);
		});
	});
	test('每个控件取值都真影响输出（无死开关）', ()=>{
		const b = shuilong({ dixing: '平原' }).total;
		[{ xuanwu: 'rao' }, { ji: '小支流' }, { chanRao: 2 }, { jiZi: ['眷'] }, { xiongZi: ['穿'] },
			{ xueXing: '窝' }, { geKey: 'zuoshui' }, { xidao: '息道' }, { huanbao: 2 }, { zhuanzhe: 2 },
			{ xiuchi: '秀龙' }, { houKong: true }, { zhaoshen: ZHAOSHEN_WHEN }, { jiGe: '干水城垣格' },
			{ xiongGe: '水分如叉' }, { wuxing: '金' }].forEach((patch)=>{
			expect(shuilong({ dixing: '平原', ...patch }).total).not.toBe(b);
		});
	});
});
const ZHAOSHEN_WHEN = '照神有力';
