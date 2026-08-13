// 三合十三水法 golden —— 火局（壬山丙向／子山午向）逐条对传本原文，其余三局验旋转机制。
// 🔴 火局这 13 条是**逐字金标**：模板渲染出来必须与传本一字不差；差一字即模板被改坏。
import { sanhe } from '../sanhe';
import { shuifa13, shuifa13Hit, SHUIFA_13_TPL } from '../fengshuiSanheShuifa';
import { sanheChangshengTable } from '../liqiCore';
import { SANHE_STAGE_JX } from '../fengshuiData';

const ringOf = (ju)=>sanheChangshengTable().map((r)=>({ shuangshan: r.shuangshan, zhi: r.zhi, stage: r[ju], jx: SANHE_STAGE_JX[r[ju]] }));

// 传本原文（壬山丙向／子山午向＝火局正旺向），逐条。
const HUO_GOLDEN = [
	'水从左来倒右，出辛戌两字间，谓之正旺向，名三合联珠，合杨公进神水法，生来会旺玉带缠腰，主发富旺丁，若得山肥水聚更美。',
	'水从左倒右，水口在丁未两字间，为自旺向，主财丁富贵。',
	'水从右倒左，从甲字沐浴方消水，名禄存流尽佩金鱼，主发富贵旺人丁；若水犯寅卯二字，非淫即绝，不可轻用。',
	'水从巽巳方出，为冲破向上临官，犯杀人大黄泉，主丧成才之子，并犯风瘫血症，先伤二房，次及他房。',
	'水从乙辰方出，流破向上冠带，主伤聪明幼子少女，退败田产，终归败绝。',
	'水出癸丑方，冲破向上养位，主败绝乏嗣。',
	'水出壬子方，冲破胎神，主堕胎伤人，有财无寿。',
	'水出乾亥方，名过宫水，主早贫而晚贵多寿。',
	'水出庚酉方，犯颜回夭寿水，虽主幼年稍利，有功名即失血夭亡，终必败绝。',
	'水出坤申病方，犯短命寡宿水，主男人短寿，必出寡孀，先败三房，次及别房。',
	'水出艮寅方，为旺去冲生，主富而无子，十有九绝。',
	'右水倒左，从向上丙字出去，不犯午字，犹须百步关栏，合胎向胎方出水，谓之出煞，不作冲胎论，主大富贵，旺人丁，间有男子短寿，出幼妇寡孀。',
	'若左水倒右，出丙午二方，即变为生来破旺，有丁无财，一贫如洗，切不可误作胎向胎方去水。',
];

describe('十三水法 · 火局逐字金标（传本原例）', ()=>{
	const t = shuifa13('火局', ringOf('火局'));
	it('恰十三条，序号 1..13', ()=>{
		expect(t.rows).toHaveLength(13);
		expect(t.rows.map((r)=>r.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
	});
	HUO_GOLDEN.forEach((g, i)=>{
		it(`第 ${i + 1} 条逐字相同`, ()=>{ expect(t.rows[i].text).toBe(g); });
	});
	it('火局标为传本原例、非推导', ()=>{
		expect(t.derived).toBe(false);
		expect(t.source).toMatch(/传本原例/);
	});
	it('🔴 向法限制必须随表标出（他向法传本未载，不臆造）', ()=>{
		expect(t.xiangFaNote).toMatch(/正旺向/);
		expect(t.xiangFaNote).toMatch(/未载/);
	});
});

describe('十三水法 · 其余三局按长生环旋转', ()=>{
	['金局', '水局', '木局'].forEach((ju)=>{
		it(`${ju}：十三条齐、逐条用字取自本局双山、标为旋转填字`, ()=>{
			const t = shuifa13(ju, ringOf(ju));
			expect(t.rows).toHaveLength(13);
			expect(t.derived).toBe(true);
			expect(t.source).toMatch(/旋转填字/);
			const ring = ringOf(ju);
			t.rows.forEach((r)=>{
				const hit = ring.find((x)=>x.stage === r.stage);
				expect(r.shuangshan).toBe(hit.shuangshan);      // 用的是本局该阶之双山
				expect(r.text).toContain(r.part === 'gan' ? r.gan : r.shuangshan);
				expect(r.text).not.toContain('{');              // 占位符全部填掉
			});
		});
	});
	it('四局同阶断语结构一致（只换字，不换判）', ()=>{
		const js = ['火局', '金局', '水局', '木局'].map((ju)=>shuifa13(ju, ringOf(ju)));
		SHUIFA_13_TPL.forEach((tpl, i)=>{
			const set = new Set(js.map((t)=>`${t.rows[i].jx}|${t.rows[i].name}|${t.rows[i].flow}`));
			expect(set.size).toBe(1);
			expect(js[0].rows[i].no).toBe(tpl.no);
		});
	});
	it('🔴 各局用字互不相同（旋转真的发生了，不是四份复制）', ()=>{
		const firsts = ['火局', '金局', '水局', '木局'].map((ju)=>shuifa13(ju, ringOf(ju)).rows[0].shuangshan);
		expect(new Set(firsts).size).toBe(4);
		expect(firsts).toEqual(['辛戌', '癸丑', '乙辰', '丁未']);   // 四局之墓库
	});
});

describe('十三水法 · 当前水口落条', ()=>{
	const t = shuifa13('火局', ringOf('火局'));
	it('墓库 + 左倒右 → 第 1 条正旺向', ()=>{
		expect(shuifa13Hit(t, '辛', 'leftToRight').no).toBe(1);
		expect(shuifa13Hit(t, '戌', 'leftToRight').no).toBe(1);
	});
	it('🔴 帝旺按水流方向二分：右倒左→第12(出煞)、左倒右→第13(生来破旺)', ()=>{
		expect(shuifa13Hit(t, '丙', 'rightToLeft').no).toBe(12);
		expect(shuifa13Hit(t, '丙', 'leftToRight').no).toBe(13);
	});
	it('不限方向之条不受水流影响（临官恒第 4 条）', ()=>{
		expect(shuifa13Hit(t, '巽', 'leftToRight').no).toBe(4);
		expect(shuifa13Hit(t, '巽', 'rightToLeft').no).toBe(4);
	});
	it('水口不在环上或未给 → 不落条（不硬凑）', ()=>{
		expect(shuifa13Hit(t, 'X', 'leftToRight')).toBeNull();
		expect(shuifa13Hit(t, '', 'leftToRight')).toBeNull();
		expect(shuifa13Hit(null, '辛', 'leftToRight')).toBeNull();
	});
});

describe('十三水法 · 接入 sanhe 主入口', ()=>{
	it('未定局（无水口）→ 不出表（零回归）', ()=>{
		expect(sanhe({}).shuiFa13).toBeNull();
		expect(sanhe({}).shuiFa13Cur).toBeNull();
	});
	it('水口辛（火局）→ 表出且当前条为正旺向', ()=>{
		const r = sanhe({ shuiKou: '辛', waterFlow: 'leftToRight' });
		expect(r.shuiFa13.ju).toBe('火局');
		expect(r.shuiFa13.rows).toHaveLength(13);
		expect(r.shuiFa13Cur.no).toBe(1);
		expect(r.shuiFa13Cur.text).toBe(HUO_GOLDEN[0]);
	});
	it('四局入口皆通、各出十三条', ()=>{
		[['辛', '火局'], ['癸', '金局'], ['乙', '水局'], ['丁', '木局']].forEach(([sk, ju])=>{
			const r = sanhe({ shuiKou: sk, waterFlow: 'leftToRight' });
			expect(r.shuiFa13.ju).toBe(ju);
			expect(r.shuiFa13.rows).toHaveLength(13);
			expect(r.shuiFa13Cur.no).toBe(1);          // 四局水口皆落各自墓库
		});
	});
	it('黄泉之忌随表标出', ()=>{
		expect(sanhe({ shuiKou: '辛' }).shuiFa13.ji).toBe('三合水法尤忌黄泉。');
	});
});
