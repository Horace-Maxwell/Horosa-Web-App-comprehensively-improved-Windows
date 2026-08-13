// 择日深化 golden —— 用事十四事 / 紫白法 / 三步选课干支自动检测 / 斗首法。
// 🔴 传本载例：葬课「丁亥 丙午 乙未 己卯」——亥卯未三合木局、午未六合、乙丙丁三奇逆布、
//    八字一团和气无争战、夏令有亥水可调候。本测以此为主锚逐项对拍。
import { zeriDeep, ganZhiCheck, zibaiCombo, zibaiChongFu, huaShaStar, doushou, YONGSHI_ALL } from '../zeriDeep';
import { zaoMing } from '../zeri';
import {
	YONGSHI_JIANZAO_8, YONGSHI_SANGZANG_6, ZIBAI_JUE_4, ZIBAI_WUXING, ZIBAI_SHIJIAN,
	ZIBAI_KONGJIAN, YONGSHI_GONG_4, HUASHA_XUANXING, SANBU_2_GANZHI, SANBU_3_GOUTONG,
	DOUSHOU_SHAN_WUXING, DOUSHOU_GAN_HUAQI, DOUSHOU_LIUQIN, ZONGJING_YU, ZHUJI_SHUZHENG,
} from '../fengshuiZeriDeepData';

const BOOK_KE = ['丁亥', '丙午', '乙未', '己卯'];

describe('用事十四事', ()=>{
	it('建造类八 + 丧葬类六 ＝ 十四，键不重复', ()=>{
		expect(YONGSHI_JIANZAO_8).toHaveLength(8);
		expect(YONGSHI_SANGZANG_6).toHaveLength(6);
		expect(YONGSHI_ALL).toHaveLength(14);
		expect(new Set(YONGSHI_ALL.map((x)=>x.key)).size).toBe(14);
	});
	it('两类各带类名，且建造类三重事与丧葬类三重事标为 rank 1', ()=>{
		const j = YONGSHI_ALL.filter((x)=>x.cls === '建造类' && x.rank === 1).map((x)=>x.name);
		expect(j).toEqual(['动土', '行墙（下基）', '安门']);
		const s = YONGSHI_ALL.filter((x)=>x.cls === '丧葬类' && x.rank === 1).map((x)=>x.name);
		expect(s).toEqual(['破土', '安葬', '立碑']);
	});
	it('🔴 阳宅开工为动土、阴宅开工为破土，两者不能混淆（此告诫必须在册）', ()=>{
		expect(YONGSHI_ALL.find((x)=>x.key === 'potu').text).toMatch(/阳宅开工为「动土」、阴宅开工为「破土」，两者不能混淆/);
	});
	it('选中某事即出该事，未选不出', ()=>{
		expect(zeriDeep({ yongShi: 'anmen' }).yongShi.name).toBe('安门');
		expect(zeriDeep({}).yongShi).toBeNull();
	});
});

describe('紫白法', ()=>{
	it('四流歌诀齐备且逐条有正文', ()=>{
		expect(ZIBAI_JUE_4.map((j)=>j.key)).toEqual(['nian', 'yue', 'ri', 'shi']);
		ZIBAI_JUE_4.forEach((j)=>{ expect(j.lines.length).toBeGreaterThanOrEqual(2); });
		expect(ZIBAI_JUE_4[0].lines[0]).toBe('上元甲子一白求，中元四绿甲子游；');
	});
	it('九星五行：一水 / 二五八土 / 三四木 / 六七金 / 九火', ()=>{
		expect(ZIBAI_WUXING).toEqual({ 1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火' });
	});
	it('组合宜忌逐条：相生宜 / 相战不宜 / 虽相生仍不宜 / 尤忌 / 另论', ()=>{
		expect(zibaiCombo(6, 2).jx).toBe('good');
		expect(zibaiCombo(1, 6).jx).toBe('good');
		expect(zibaiCombo(6, 3).jx).toBe('bad');
		expect(zibaiCombo(1, 2).jx).toBe('bad');
		expect(zibaiCombo(9, 2).text).toMatch(/虽相生仍不宜/);
		expect(zibaiCombo(9, 5).text).toMatch(/尤忌/);
		expect(zibaiCombo(1, 9).text).toMatch(/因各运不同而另论/);
	});
	it('🔴 75／57 只有五运时可以组合', ()=>{
		expect(zibaiCombo(7, 5, 5).jx).toBe('neutral');
		expect(zibaiCombo(7, 5, 5).text).toMatch(/只有五运时可以组合/);
		expect(zibaiCombo(7, 5, 8).jx).toBe('bad');
	});
	it('组合无序（正反同判）；传本未列者据实标「不臆断」', ()=>{
		expect(zibaiCombo(6, 2).jx).toBe(zibaiCombo(2, 6).jx);
		expect(zibaiCombo(3, 3).text).toMatch(/传本未列此组，不臆断/);
	});
	it('冲伏：星到本宫为伏（助旺）、到对宫为冲（减力）', ()=>{
		expect(zibaiChongFu(1, 1).kind).toBe('伏');
		expect(zibaiChongFu(1, 9).kind).toBe('冲');
		expect(zibaiChongFu(6, 6).kind).toBe('伏');
		expect(zibaiChongFu(6, 4).kind).toBe('冲');
		expect(zibaiChongFu(8, 8).kind).toBe('伏');
		expect(zibaiChongFu(8, 2).kind).toBe('冲');
		expect(zibaiChongFu(9, 9).kind).toBe('伏');
		expect(zibaiChongFu(9, 1).kind).toBe('冲');
		expect(zibaiChongFu(5, 5).kind).toBe('伏');       // 五黄入中为伏
		expect(zibaiChongFu(1, 3).kind).toBe('常');
		expect(zibaiChongFu(0, 1)).toBeNull();
	});
	it('时间旺衰五组、空间旺衰五组齐备', ()=>{
		expect(ZIBAI_SHIJIAN).toHaveLength(5);
		expect(ZIBAI_KONGJIAN).toHaveLength(5);
		expect(ZIBAI_SHIJIAN.find((x)=>x.stars.join() === '1').wang).toMatch(/秋冬旺相/);
		expect(ZIBAI_SHIJIAN.find((x)=>x.stars.join() === '9').wang).toMatch(/春夏旺相/);
	});
	it('🔴 两说并陈不判孰是（《宗镜》vs《诹吉述正》）', ()=>{
		expect(ZONGJING_YU).toMatch(/作木山宜一白而忌六白/);
		expect(ZHUJI_SHUZHENG).toMatch(/不必拘泥/);
		expect(ZHUJI_SHUZHENG).toMatch(/两说并陈，本页不判孰是/);
		const d = zeriDeep({});
		expect(d.zibai.liangShuo.zongJing).toBe(ZONGJING_YU);
		expect(d.zibai.liangShuo.zhuJi).toBe(ZHUJI_SHUZHENG);
	});
	it('用事宫四选齐备（坐山/向首/中宫/动象）', ()=>{
		expect(YONGSHI_GONG_4.map((g)=>g.key)).toEqual(['zuo', 'xiang', 'zhong', 'dong']);
		expect(YONGSHI_GONG_4.find((g)=>g.key === 'zhong').text).toMatch(/95 合局煞/);
	});
	it('化煞选星三档：土煞→六白 / 火煞→八白 / 木煞→九紫', ()=>{
		expect(HUASHA_XUANXING).toHaveLength(3);
		expect(huaShaStar('21').star).toBe(6);
		expect(huaShaStar('12').star).toBe(6);      // 反序同判
		expect(huaShaStar('79').star).toBe(8);
		expect(huaShaStar('96').star).toBe(8);
		expect(huaShaStar('34').star).toBe(9);
		expect(huaShaStar('43').star).toBe(9);
		expect(huaShaStar('88')).toBeNull();
		expect(huaShaStar('')).toBeNull();
	});
	it('化煞选星带「年星不到可用月星、日时星力小」之告诫', ()=>{
		expect(huaShaStar('34').note).toMatch(/日时星力小/);
	});
});

describe('🔴 三步选课 · 干支搭配自动检测（传本葬课为主锚）', ()=>{
	const r = ganZhiCheck(BOOK_KE, 'xia');
	it('识出亥卯未三合、午未六合、乙丙丁三奇', ()=>{
		const t = r.tuanJie.map((x)=>x.text);
		expect(t).toContain('亥卯未三合');
		expect(t).toContain('午未六合');
		expect(t).toContain('乙丙丁三奇');
	});
	it('八字一团和气：无相战，判吉', ()=>{
		expect(r.xiangZhan).toHaveLength(0);
		expect(r.zhanWeight).toBe(0);
		expect(r.verdict.jx).toBe('good');
		expect(r.verdict.text).toMatch(/八字团结/);
	});
	it('夏令有亥水可调候', ()=>{
		expect(r.hanNuan.ok).toBe(true);
		expect(r.hanNuan.got).toContain('亥');
	});
	it('地支贴冲按柱位加权：月日冲/日时冲最重', ()=>{
		const a = ganZhiCheck(['甲子', '丙午', '戊子', '庚寅'], '');    // 月日冲(午子)
		expect(a.xiangZhan.some((z)=>z.text.indexOf('贴冲') >= 0)).toBe(true);
		expect(a.zhanWeight).toBeGreaterThanOrEqual(3);
		expect(a.verdict.jx).toBe('bad');
		// 无冲无刑无害之课：子丑合、子辰半三合（有中神子），余两两无战。
		const b = ganZhiCheck(['甲子', '乙丑', '丙辰', '丁巳'], '');
		expect(b.zhanWeight).toBe(0);
		expect(b.tuanJie.map((t)=>t.text)).toContain('子丑六合');
	});
	it('半三合须有中神方计（无中神不算）', ()=>{
		expect(ganZhiCheck(['甲申', '丙子', '戊寅', '庚辰'], '').tuanJie.some((t)=>t.text.indexOf('半三合') >= 0 || t.text === '申子辰三合')).toBe(true);
		const noMid = ganZhiCheck(['甲申', '丙辰', '戊寅', '庚寅'], '');
		expect(noMid.tuanJie.some((t)=>t.kind === '半三合(有中神)')).toBe(false);
	});
	it('冬令须暖干支、夏令须湿干支', ()=>{
		const dong = ganZhiCheck(['壬子', '癸丑', '壬申', '辛亥'], 'dong');
		expect(dong.hanNuan.ok).toBe(false);
		const dong2 = ganZhiCheck(['丙子', '癸丑', '壬申', '辛亥'], 'dong');
		expect(dong2.hanNuan.ok).toBe(true);
		expect(ganZhiCheck(BOOK_KE, '').hanNuan).toBeNull();     // 非冬非夏不判寒暖
	});
	it('四条干支搭配原则在册；三沟通两纲在册', ()=>{
		expect(SANBU_2_GANZHI).toHaveLength(4);
		expect(r.rules).toBe(SANBU_2_GANZHI);
		expect(SANBU_3_GOUTONG.map((g)=>g.key)).toEqual(['diqi', 'renqi']);
	});
	it('空/脏入参返回 null 或不抛', ()=>{
		expect(ganZhiCheck([], '')).toBeNull();
		expect(ganZhiCheck(['XX'], '')).toBeNull();
		expect(()=>ganZhiCheck(null, '')).not.toThrow();
	});
});

describe('🔴 斗首法（传本乾山例逐条对拍）', ()=>{
	it('三套五行口诀数据化：斗首山五行 / 天干化气 / 地支正五行', ()=>{
		expect(DOUSHOU_SHAN_WUXING['乾']).toBe('火');
		expect(DOUSHOU_SHAN_WUXING['壬']).toBe('土');
		expect(DOUSHOU_SHAN_WUXING['艮']).toBe('木');
		expect(DOUSHOU_SHAN_WUXING['庚']).toBe('金');
		expect(DOUSHOU_SHAN_WUXING['坤']).toBe('水');
		expect(Object.keys(DOUSHOU_SHAN_WUXING)).toHaveLength(24);
		expect(DOUSHOU_GAN_HUAQI).toEqual({ 甲: '土', 己: '土', 乙: '金', 庚: '金', 丁: '木', 壬: '木', 丙: '水', 辛: '水', 戊: '火', 癸: '火' });
	});
	it('乾山（火）：戊癸元辰 / 乙庚武财 / 甲己廉子 / 丁壬贪狼 / 丙辛破鬼', ()=>{
		const r = doushou('乾', ['戊子', '乙丑', '甲寅', '丁卯']);
		const by = {}; r.rows.forEach((x)=>{ by[x.gan] = x.liuQin; });
		expect(r.myWuxing).toBe('火');
		expect(by['戊']).toBe('元辰');
		expect(by['乙']).toBe('武财');
		expect(by['甲']).toBe('廉子');
		expect(by['丁']).toBe('贪狼');
		const p = doushou('乾', ['丙子']);
		expect(p.rows[0].liuQin).toBe('破鬼');
	});
	it('六亲五要点逐条给判：元辰须现、廉子只宜一位、贪狼/破鬼宜不现', ()=>{
		const r = doushou('乾', ['甲子', '己丑', '甲寅', '丁卯']);   // 廉子三位（甲己甲）+贪狼一位（丁）
		const by = {}; r.checks.forEach((c)=>{ by[c.key] = c; });
		expect(by.lianzi.n).toBe(3);
		expect(by.lianzi.ok).toBe(false);
		expect(by.lianzi.text).toMatch(/廉子重见/);
		expect(by.tanlang.n).toBe(1);
		expect(by.tanlang.ok).toBe(false);
		expect(by.yuanchen.n).toBe(0);
		expect(by.yuanchen.text).toMatch(/无元辰/);
	});
	it('当令口径随判带出（春夏木火旺 或 元辰在日课地支得长生冠带临官帝旺墓胎养）', ()=>{
		expect(doushou('乾', ['戊子']).dangLing).toMatch(/长生、冠带、临官、帝旺、墓、胎、养/);
	});
	it('五要点条目齐备且关系正确（元辰比和/武财我克/廉子我生/贪狼生我/破鬼克我）', ()=>{
		expect(DOUSHOU_LIUQIN).toHaveLength(5);
		const rel = {}; DOUSHOU_LIUQIN.forEach((q)=>{ rel[q.key] = q.rel; });
		expect(rel).toEqual({ yuanchen: '比和', wucai: '我克', lianzi: '我生', tanlang: '生我', pogui: '克我' });
	});
	it('非二十四山之坐山 → null（不硬凑）', ()=>{
		expect(doushou('X', ['甲子'])).toBeNull();
		expect(doushou('', ['甲子'])).toBeNull();
	});
});

describe('接入 zaoMing（additive · 零回归）', ()=>{
	const base = { zuoShan: '子', y: 2026, m: 6, d: 15 };
	it('不开 showDeep → deep 为 null，其余字段逐字节不变', ()=>{
		const off = zaoMing(base);
		const on = zaoMing({ ...base, showDeep: true });
		expect(off.deep).toBeNull();
		const strip = (o)=>{ const c = { ...o }; delete c.deep; return JSON.stringify(c); };
		expect(strip(on)).toBe(strip(off));
	});
	it('开 showDeep → 四段齐出（用事/紫白/三步/斗首）', ()=>{
		const d = zaoMing({ ...base, showDeep: true, yongShi: 'anmen' }).deep;
		expect(d.yongShi.name).toBe('安门');
		expect(d.zibai.jue4).toHaveLength(4);
		expect(d.sanBu.ganZhi).toBeTruthy();
		expect(d.douShou).toBeTruthy();
		expect(d.douShou.myWuxing).toBe('土');       // 子山斗首五行为土
	});
	it('可另给时柱，三步检测随之把四柱都算进去', ()=>{
		const a = zaoMing({ ...base, showDeep: true }).deep.sanBu.ganZhi.pillars;
		const b = zaoMing({ ...base, showDeep: true, hourGanZhi: '甲子' }).deep.sanBu.ganZhi.pillars;
		expect(a).toHaveLength(3);
		expect(b).toHaveLength(4);
		expect(b[3]).toBe('甲子');
	});
	it('季节由月自动定（11-1 冬 / 5-7 夏 / 其余不判寒暖）', ()=>{
		expect(zaoMing({ ...base, m: 12, showDeep: true }).deep.sanBu.ganZhi.hanNuan.need).toMatch(/暖干支/);
		expect(zaoMing({ ...base, m: 6, showDeep: true }).deep.sanBu.ganZhi.hanNuan.need).toMatch(/湿干支/);
		expect(zaoMing({ ...base, m: 3, showDeep: true }).deep.sanBu.ganZhi.hanNuan).toBeNull();
	});
	it('脏入参不抛', ()=>{
		[{ ...base, showDeep: true, yongShi: 'X' }, { ...base, showDeep: true, hourGanZhi: 'XX' },
			{ ...base, showDeep: true, zibaiA: 'x', zibaiB: null }, { ...base, showDeep: true, dongCombo: 123 }]
			.forEach((o)=>{ expect(()=>zaoMing(o)).not.toThrow(); });
	});
});
