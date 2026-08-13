// 罗盘升级 golden —— 盘式 / 分金择优 / 兼线校验 / 磁偏角 / 判向向导。
// 🔴 三条口径钉死：
//   ① 三元盘（蒋盘）**没有**人盘中针、天盘缝针廿四山，也没有七十二龙/一百二十龙/六十龙分金
//      —— 切档时这些层必须真的被滤掉，不能只换标题。
//   ② 一百二十分金只有纳甲为丙丁庚辛者可用（全盘四十八线位）；穿山七十二龙只有丙子/庚子旬可用。
//   ③ 磁偏角本表**西偏为正**，WMM/IGRF **东偏为正**——换源须取负，否则整盘反向偏。
import {
	fenjinPick, chuanshanPick, jianCheck, magneticWizard, panxiangWizard, degToShan,
	FENJIN_USABLE_GAN, CHUANSHAN_USABLE_GAN, JIAN_RULES, JIAN_DEG_RULES,
	LIXIANG_STEPS, PANXIANG_WUXIANG, PANXIANG_DANYUAN, YIYANG_WEIGH, PANXIANG_CONCEPTS,
} from '../luopanTools';
import {
	DECLINATION_TABLE, DECLINATION_INDEX, DECLINATION_CITY_COUNT, DECLINATION_EPOCH,
	declinationOf, trueToMagnetic,
} from '../fengshuiDeclinationData';
import {
	LUOPAN_TYPES, LUOPAN_PARTS, TIANXING_JI, TIANXING_BAGUI, DIMU9_STARS,
	JIEQI_24, JIEQI_TAIYANG, JIEQI_TAIYIN, YAO384_TICKS, YIPAN_CONTENT,
	XIA_LUOPAN_NEI, XIA_LUOPAN_WAI, LUOPAN_USE_RULES, PAI_NEEDLE_USE, TIANXING_NOTE, DIMU9_NOTE,
} from '../fengshuiLuopanData';
import { SHAN_ORDER } from '../fengshuiData';

describe('罗盘三型与构成', ()=>{
	it('三型齐备（三合／三元／综合），构成四大件', ()=>{
		expect(LUOPAN_TYPES.map((t)=>t.key)).toEqual(['sanhe', 'sanyuan', 'zonghe']);
		expect(LUOPAN_PARTS.map((p)=>p.key)).toEqual(['neipan', 'waipan', 'tianchi', 'tianxin']);
	});
	it('🔴 三元盘明确无三针余两针、无三龙分金（层集判据，不是标题差别）', ()=>{
		const sy = LUOPAN_TYPES.find((t)=>t.key === 'sanyuan');
		['renpan', 'tianpan', 'chuanshan', 'toudi', 'fenjin'].forEach((k)=>{
			expect(sy.not).toContain(k);
			expect(sy.has).not.toContain(k);
		});
		expect(sy.note).toMatch(/均只用地盘正针/);
	});
	it('三合盘有三针与三龙分金，但无易卦层', ()=>{
		const sh = LUOPAN_TYPES.find((t)=>t.key === 'sanhe');
		['dipan', 'renpan', 'tianpan', 'chuanshan', 'toudi', 'fenjin'].forEach((k)=>expect(sh.has).toContain(k));
		['gua64Inner', 'gua64Outer', 'yao384'].forEach((k)=>expect(sh.not).toContain(k));
	});
	it('综合盘全部层可选（has 为 null）', ()=>{
		expect(LUOPAN_TYPES.find((t)=>t.key === 'zonghe').has).toBeNull();
	});
	it('各派采参所用之盘：玄空/大玄空/过路阴阳只用正针，三合用三盘', ()=>{
		expect(PAI_NEEDLE_USE.xuankong.needles).toEqual(['zheng']);
		expect(PAI_NEEDLE_USE.daxuankong.needles).toEqual(['zheng']);
		expect(PAI_NEEDLE_USE.jinsuo.needles).toEqual(['zheng']);
		expect(PAI_NEEDLE_USE.sanhe.needles).toEqual(['zheng', 'ren', 'feng']);
	});
});

describe('🔴 分金择优器（纳甲判据）', ()=>{
	it('可用纳甲：分金丙丁庚辛、穿山丙庚', ()=>{
		expect(FENJIN_USABLE_GAN).toEqual(['丙', '丁', '庚', '辛']);
		expect(CHUANSHAN_USABLE_GAN).toEqual(['丙', '庚']);
	});
	it('古籍例：子山、癸山各得丙子/庚子可用', ()=>{
		['子', '癸'].forEach((s)=>{
			const p = fenjinPick(s);
			expect(p.usable.map((r)=>r.ganzhi).sort()).toEqual(['丙子', '庚子']);
		});
	});
	it('古籍例：丑山、艮山各得丁丑/辛丑可用', ()=>{
		['丑', '艮'].forEach((s)=>{
			const p = fenjinPick(s);
			expect(p.usable.map((r)=>r.ganzhi).sort()).toEqual(['丁丑', '辛丑']);
		});
	});
	it('每山恰五分金；全盘可用线位恰四十八', ()=>{
		let total = 0;
		SHAN_ORDER.forEach((s)=>{
			const p = fenjinPick(s);
			expect(p.rows).toHaveLength(5);
			total += p.usable.length;
		});
		expect(total).toBe(48);          // 古籍：罗盘面上只标注四十八个分金线位
	});
	it('不可用者逐条说明为何不可用（戊己标龟甲空亡）', ()=>{
		const p = fenjinPick('子');
		const wu = p.rows.find((r)=>r.gan === '戊');
		expect(wu.usable).toBe(false);
		expect(wu.why).toMatch(/龟甲空亡/);
		const jia = p.rows.find((r)=>r.gan === '甲');
		expect(jia.why).toMatch(/不在丙丁庚辛之列/);
	});
	it('首选取距山心最近之可用线位', ()=>{
		const p = fenjinPick('子');
		expect(p.best).toBeTruthy();
		expect(p.usable.map((r)=>r.ganzhi)).toContain(p.best.ganzhi);
	});
	it('穿山每山三龙，可用者天干丙或庚', ()=>{
		SHAN_ORDER.forEach((s)=>{
			const p = chuanshanPick(s);
			expect(p.rows).toHaveLength(3);
			p.usable.forEach((r)=>expect(CHUANSHAN_USABLE_GAN).toContain(r.gan));
		});
	});
	it('非法山返回 null（不硬凑）', ()=>{
		expect(fenjinPick('X')).toBeNull();
		expect(chuanshanPick('')).toBeNull();
	});
});

describe('🔴 兼线合法性', ()=>{
	it('三元龙相兼六组齐备，且「不能太多」之限只在人兼地、地兼人两组', ()=>{
		expect(JIAN_RULES).toHaveLength(6);
		const few = JIAN_RULES.filter((r)=>r.limit === 'few').map((r)=>`${r.from}${r.to}`).sort();
		expect(few).toEqual(['人地', '地人']);
	});
	it('出卦即不合（坐山与兼向之山分属两卦）', ()=>{
		const r = jianCheck('子', '艮', 3);      // 子属坎宫、艮属艮宫
		expect(r.sameGua).toBe(false);
		expect(r.items.find((x)=>x.key === 'chugua').ok).toBe(false);
		expect(r.ok).toBe(false);
	});
	it('同卦内天兼人合法（坎宫：子兼癸）', ()=>{
		const r = jianCheck('子', '癸', 3);
		expect(r.sameGua).toBe(true);
		expect(r.yuanA).toBe('天'); expect(r.yuanB).toBe('人');
		expect(r.rule.text).toMatch(/天元父母可兼人元顺子/);
		expect(r.ok).toBe(true);
	});
	it('🔴 度界：玄空天人相兼最多 6.5°、人地相兼 3° 以内', ()=>{
		expect(jianCheck('子', '癸', 6).degMax).toBe(6.5);       // 天兼人
		expect(jianCheck('子', '癸', 6).items.find((x)=>x.key === 'deg').ok).toBe(true);
		expect(jianCheck('子', '癸', 7).items.find((x)=>x.key === 'deg').ok).toBe(false);
		expect(jianCheck('癸', '壬', 3).degMax).toBe(3);          // 人兼地
		expect(jianCheck('癸', '壬', 4).items.find((x)=>x.key === 'deg').ok).toBe(false);
	});
	it('三合派度界恒 3°（须落在丙丁庚辛分金线位内）', ()=>{
		expect(jianCheck('子', '癸', 6, 'sanhe').degMax).toBe(3);
		expect(jianCheck('子', '癸', 6, 'sanhe').items.find((x)=>x.key === 'deg').ok).toBe(false);
		expect(JIAN_DEG_RULES.find((x)=>x.school === 'sanhe').max).toBe(3);
	});
	it('压正线（兼 0°）单列告诫，不当作合法兼线', ()=>{
		const r = jianCheck('子', '癸', 0);
		const d = r.items.find((x)=>x.key === 'deg');
		expect(d.ok).toBe(false);
		expect(d.text).toMatch(/压正线/);
		expect(r.note).toMatch(/一般情况下不立正线/);
	});
	it('非法山返回 null', ()=>{
		expect(jianCheck('X', '癸', 3)).toBeNull();
		expect(jianCheck('子', '', 3)).toBeNull();
	});
});

describe('🔴 磁偏角表与换算', ()=>{
	it('表规模：27 省级单位 / 358 城，时点 2013-06', ()=>{
		expect(Object.keys(DECLINATION_TABLE)).toHaveLength(27);
		expect(DECLINATION_CITY_COUNT).toBe(358);
		expect(DECLINATION_EPOCH).toBe('2013-06');
	});
	it('四直辖市在册；上海 5.53 与正文「上海要加5.53度」自洽', ()=>{
		['北京市', '天津市', '上海市', '重庆市'].forEach((c)=>{
			expect(DECLINATION_INDEX[c]).toBeTruthy();
		});
		expect(DECLINATION_INDEX['上海市'].dec).toBe(5.53);
		expect(declinationOf('上海').dec).toBe(5.53);      // 去「市」亦可查
	});
	it('🔴 符号相反：本表西偏为正直接加；WMM/IGRF 东偏为正须取负', ()=>{
		const book = trueToMagnetic(100, 5.53, 'book');
		const wmm = trueToMagnetic(100, 5.53, 'wmm');
		expect(book.magnetic).toBeCloseTo(105.53, 6);
		expect(wmm.magnetic).toBeCloseTo(94.47, 6);
		expect(book.applied).toBe(5.53);
		expect(wmm.applied).toBe(-5.53);
		expect(wmm.note).toMatch(/东偏为正，已取负/);
	});
	it('换算落山：真 25.34° + 上海 5.53° = 30.87° 落丑山', ()=>{
		const r = magneticWizard({ trueDeg: 25.34, city: '上海市' });
		expect(r.magnetic).toBeCloseTo(30.87, 2);
		expect(r.shan).toBe('丑');                          // 丑山中心 30°，区间 22.5–37.5
		expect(r.offset).toBeCloseTo(0.87, 2);
		expect(r.verdict.text).toMatch(/落 丑 山/);
	});
	it('查不到城市时据实说明，不猜', ()=>{
		const r = magneticWizard({ trueDeg: 100, city: '不存在城' });
		expect(r.dec).toBeNull();
		expect(r.verdict.jx).toBe('neutral');
		expect(r.verdict.text).toMatch(/未查到该地磁偏角/);
	});
	it('可直接填磁偏角覆盖城市表', ()=>{
		expect(magneticWizard({ trueDeg: 0, decOverride: 10 }).magnetic).toBe(10);
	});
	it('degToShan：中心与偏移正确（0°＝子山正线）', ()=>{
		expect(degToShan(0)).toEqual({ shan: '子', center: 0, offset: 0 });
		expect(degToShan(3).shan).toBe('子');
		expect(degToShan(3).offset).toBe(3);
		expect(degToShan(15).shan).toBe('癸');
	});
	it('缺参一律 null', ()=>{
		expect(magneticWizard({})).toBeNull();
		expect(trueToMagnetic('x', 1)).toBeNull();
		expect(declinationOf('')).toBeNull();
	});
});

describe('判向向导', ()=>{
	it('三概念齐备（屋向/门向/门位）', ()=>{
		expect(PANXIANG_CONCEPTS.map((c)=>c.key)).toEqual(['wuxiang', 'menxiang', 'menwei']);
	});
	it('单门独户三法有优先级：以水 > 以明堂 > 以大门', ()=>{
		expect(PANXIANG_WUXIANG.map((m)=>m.rank)).toEqual([1, 2, 3]);
		expect(panxiangWizard({ hasWater: true }).pick.key).toBe('shui');
		expect(panxiangWizard({ hasWater: false, hasMingtang: true, mingtangDominant: true }).pick.key).toBe('mingtang');
		expect(panxiangWizard({ hasWater: false, hasMingtang: false, fourSidesSimilar: true }).pick.key).toBe('damen');
	});
	it('🔴 明堂气场未超过其他三方时不得用以明堂为向', ()=>{
		const r = panxiangWizard({ hasWater: false, hasMingtang: true, mingtangDominant: false });
		expect(r.pick).toBeNull();
		expect(r.steps.some((s)=>s.jx === 'bad' && /不宜用/.test(s.text))).toBe(true);
	});
	it('实况不足时据实说明，不硬判', ()=>{
		const r = panxiangWizard({});
		expect(r.pick).toBeNull();
		expect(r.verdict.jx).toBe('neutral');
		expect(r.verdict.text).toMatch(/实况登记不足/);
	});
	it('城市单元住宅：以阳定向为主，并按内外局三种权衡', ()=>{
		expect(PANXIANG_DANYUAN[0].key).toBe('yiyang');
		expect(PANXIANG_DANYUAN[0].main).toBe(true);
		expect(YIYANG_WEIGH).toHaveLength(3);
		expect(panxiangWizard({ isDanyuan: true, innerOuterMatch: true }).steps[1].text).toMatch(/最纯正/);
		expect(panxiangWizard({ isDanyuan: true, innerOuterMatch: false }).steps[1].text).toMatch(/以\*\*内局的阳面\*\*取向|内局的阳面/);
		expect(panxiangWizard({ isDanyuan: true, outerStrong: true }).steps[1].text).toMatch(/外局/);
	});
	it('单元住宅未登记内外局时据实提示补录', ()=>{
		expect(panxiangWizard({ isDanyuan: true }).steps[1].text).toMatch(/未登记内外局实况/);
	});
});

describe('新增圈层数据', ()=>{
	it('廿四节气两式：太阳自壬起逆行、太阴自艮起顺行，各 24 格', ()=>{
		expect(JIEQI_24).toHaveLength(24);
		expect(JIEQI_TAIYANG).toHaveLength(24);
		expect(JIEQI_TAIYIN).toHaveLength(24);
		expect(JIEQI_TAIYANG.find((c)=>c.label === '立春').shan).toBe('壬');
		expect(JIEQI_TAIYIN.find((c)=>c.label === '立春').shan).toBe('艮');
		// 逆行＝度数递减：壬 345° → 雨水落亥 330°；顺行＝度数递增：艮 45° → 雨水落寅 60°
		expect(JIEQI_TAIYANG.find((c)=>c.label === '雨水').shan).toBe('亥');
		expect(JIEQI_TAIYIN.find((c)=>c.label === '雨水').shan).toBe('寅');
		// 中心度基准：壬＝345°、艮＝45°（SHAN_ORDER 自壬起，非 idx*15）
		expect(JIEQI_TAIYANG.find((c)=>c.label === '立春').deg0).toBeCloseTo(337.5, 6);
		expect(JIEQI_TAIYIN.find((c)=>c.label === '立春').deg0).toBeCloseTo(37.5, 6);
	});
	it('384 爻刻度：384 格、每格 0.9375°、每卦六爻循环', ()=>{
		expect(YAO384_TICKS).toHaveLength(384);
		expect(YAO384_TICKS[0].yao).toBe(1);
		expect(YAO384_TICKS[5].yao).toBe(6);
		expect(YAO384_TICKS[6].yao).toBe(1);
		expect(YAO384_TICKS[1].deg0 - YAO384_TICKS[0].deg0).toBeCloseTo(0.9375, 6);
	});
	it('🔴 天星逐山星名与地母翻卦逐山配星均不臆造，只标「须按所宗盘」', ()=>{
		expect(TIANXING_NOTE).toMatch(/逐山星名须按所宗罗盘自校/);
		expect(DIMU9_NOTE).toMatch(/不臆造映射/);
		expect(DIMU9_STARS).toHaveLength(9);
	});
	it('天星三吉六秀八贵逐条与古籍同', ()=>{
		expect(TIANXING_JI.siGui.shans).toEqual(['亥', '艮', '巽', '酉']);
		expect(TIANXING_JI.sanJi.shans).toEqual(['艮', '巽', '酉']);
		expect(TIANXING_JI.liuXiu.shans).toEqual(['艮', '巽', '酉', '丙', '辛', '丁']);
		expect(TIANXING_JI.diDu.shans).toEqual(['亥', '巳']);
		expect(TIANXING_BAGUI.sort()).toEqual(['丁', '丙', '亥', '巳', '巽', '艮', '辛', '酉'].sort());
		expect(TIANXING_BAGUI).toHaveLength(8);
	});
	it('易盘七项内容在册；384 爻明写不作吉凶着色', ()=>{
		expect(YIPAN_CONTENT).toHaveLength(7);
		expect(YIPAN_CONTENT.find((y)=>y.key === 'yao384').text).toMatch(/这是不一定的/);
	});
	it('下罗盘位置：内六事五条、外六事三条，并带「位置不对吉凶迥异」之诫', ()=>{
		expect(XIA_LUOPAN_NEI).toHaveLength(5);
		expect(XIA_LUOPAN_WAI).toHaveLength(3);
		expect(XIA_LUOPAN_NEI[0].how).toMatch(/要在室外打盘/);
	});
	it('🔴 钢混结构必须室外离墙 10 米以上、绝不能室内打盘', ()=>{
		const g = LUOPAN_USE_RULES.find((r)=>r.key === 'gangjin');
		expect(g.text).toMatch(/室外离墙体 10 米以上/);
		expect(g.text).toMatch(/绝对不能在室内打盘/);
	});
});

describe('立向向导', ()=>{
	it('三要齐备且以形势为体', ()=>{
		expect(LIXIANG_STEPS.map((s)=>s.key)).toEqual(['shunshi', 'jianxian', 'shoushan']);
	});
});
