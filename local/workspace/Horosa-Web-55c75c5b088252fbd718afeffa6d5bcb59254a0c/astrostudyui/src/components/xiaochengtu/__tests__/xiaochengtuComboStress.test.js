// [P3] 小成图 · 组合压测:起卦法三模式 × 配数流派 × 动爻多选 × 用宫全档 —— 起卦/佈局/推导/快照全链。
import {
	qiGuaManual, qiGuaByNumbers, qiGuaByStock, guaByTianDiShu, guaByXianTian, flipYao, linesOfHex,
} from '../core/xiaochengtuQiGua';
import { buildPan, tuiDao, shuZhan, siXiangOfHex, fuDu } from '../core/xiaochengtuPan';
import { DI_PAN } from '../core/xiaochengtuConst';
import { buildXiaoChengTuSnapshotText } from '../XiaoChengTuMain';

const GUA8 = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const DONG_SETS = [[], [1], [6], [1, 2, 3, 4], [1, 2, 3, 4, 5, 6], [3, 5]];
const GONGS = Object.keys(DI_PAN).map(Number); // 1,2,3,4,6,7,8,9(无中五)

describe('[P3] 小成图组合压测 · 手动本卦(8×8 卦 × 6 组动爻 × 8 用宫 = 3072 链)', ()=>{
	test('全组合:起卦不抛,之卦=翻动爻自洽,佈局/推导/数占/四象/快照全链非空', ()=>{
		GUA8.forEach((up)=>{
			GUA8.forEach((lo)=>{
				DONG_SETS.forEach((dongYaos)=>{
					const qi = qiGuaManual({ up, lo, dongYaos });
					expect(qi).toBeTruthy();
					// 之卦自洽:动爻空 → 之=本;有动 → 逐爻翻转
					const ben = linesOfHex(up, lo);
					const expZhi = dongYaos.length ? flipYao(ben, dongYaos) : ben;
					expect(qi.zhi.lines).toEqual(expZhi);
					const pan = buildPan(qi);
					expect(pan).toBeTruthy();
					GONGS.forEach((g0)=>{
						const td = tuiDao(pan, g0);
						expect(td).toBeTruthy(); // 伏位或含步链
						if(!td.fuWei){ expect(td.steps.length).toBeGreaterThan(0); }
						const sz = shuZhan(pan, g0);
						expect(sz).toBeTruthy();
					});
					expect(siXiangOfHex(qi.ben)).toBeTruthy();
					const txt = buildXiaoChengTuSnapshotText(pan, qi, {});
					expect(typeof txt).toBe('string');
					expect(txt).toContain(qi.ben.name);
				});
			});
		});
	});

	test('动爻越界值静默过滤(0/7/负/字符串)——UI 多选下拉护住,引擎再守一层', ()=>{
		const qi = qiGuaManual({ up: '乾', lo: '兑', dongYaos: [0, 1, 7, -2, 'x', 6] });
		expect(qi.dongYaos).toEqual([1, 6]);
	});

	test('非法卦名 → null 安全', ()=>{
		expect(qiGuaManual({ up: '天', lo: '兑' })).toBe(null);
		expect(qiGuaManual({ up: null, lo: '兑' })).toBe(null);
	});
});

describe('[P3] 小成图组合压测 · 两数配卦(数域 × 两流派)', ()=>{
	test('天地数:mod10 余0作10;先天:mod8 余0作8 —— 1..40 全域自洽', ()=>{
		for(let n = 1; n <= 40; n += 1){
			const td = guaByTianDiShu(n);
			expect(td.num).toBe(n % 10 || 10);
			const xt = guaByXianTian(n);
			expect(xt.num).toBe(n % 8 || 8);
		}
	});
	test('两数 1..16 × 两流派(512 组):起卦成立且上下卦与配数函数一致', ()=>{
		['tiandi', 'xiantian'].forEach((qiguaShu)=>{
			const fn = qiguaShu === 'xiantian' ? guaByXianTian : guaByTianDiShu;
			for(let u = 1; u <= 16; u += 1){
				for(let l = 1; l <= 16; l += 1){
					const qi = qiGuaByNumbers({ upNum: u, loNum: l, qiguaShu });
					expect(qi).toBeTruthy();
					expect(qi.steps[0].value).toBe(fn(u).gua);
					expect(qi.steps[1].value).toBe(fn(l).gua);
				}
			}
		});
	});
	test('边界:0/负/空 → null(UI 报「请录上下两数」)', ()=>{
		expect(qiGuaByNumbers({ upNum: 0, loNum: 3 })).toBe(null);
		expect(qiGuaByNumbers({ upNum: 3, loNum: null })).toBe(null);
	});
});

describe('[P3] 小成图组合压测 · 股价起卦', ()=>{
	test('数位和取余口径(整数位/小数位分立;字符串保尾 0)', ()=>{
		const qi = qiGuaByStock({ open: '12.34', close: '56.70' });
		expect(qi).toBeTruthy();
		// 开盘整数位 1+2=3→离;小数位 3+4=7→艮
		expect(qi.steps[0].value).toBe(guaByXianTian(3).gua);
		expect(qi.steps[1].value).toBe(guaByXianTian(7).gua);
		// 收盘 5+6=11%8=3;7+0=7
		expect(qi.steps[2].value).toBe(guaByXianTian(11).gua);
		expect(qi.steps[3].value).toBe(guaByXianTian(7).gua);
	});
	test('无小数位价格:数字和 0 走「整除作坤」口径(guaByXianTian 有意 v!==0 特判)——成卦且该位=坤', ()=>{
		expect(guaByXianTian(0).gua).toBe('坤');
		const qi = qiGuaByStock({ open: '100', close: '3.14' });
		expect(qi).toBeTruthy();
		expect(qi.steps[1].value).toBe('坤'); // 开盘无小数位 → 主卦下=坤
	});
	test('涨跌/幅度派生不抛(八卦全档)', ()=>{
		GUA8.forEach((g)=>{ expect(()=>fuDu(g)).not.toThrow(); });
	});
});
