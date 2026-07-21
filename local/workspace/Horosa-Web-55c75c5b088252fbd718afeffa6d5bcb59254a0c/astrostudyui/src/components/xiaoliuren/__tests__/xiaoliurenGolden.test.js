// 小六壬 · 金标(golden)—— 今传本文档载例逐字对齐。
// 🔴 失败 = 引擎错,不得改测试将就。
import {
	MAIN_RING, MAIN_PALM, DAO_RING, DAO_NINE, DAO_YI, BAI_JIE,
	SHENG_WO_DUAN, WO_KE_DUAN, TE_LI, STAGE_ROLES,
	BING_FU_DISCREPANCY_NOTE, WUXING_SHENG, WUXING_KE,
} from '../core/xiaoliurenConst';
import { sanChuan, analyze, qiKe, teLi } from '../core/xiaoliurenKe';

describe('金标① 主流六宫载例:五月二十三日戌时(5,23,11)', () => {
	test('三传 = [小吉, 速喜, 大安]', () => {
		const r = sanChuan({ m: 5, d: 23, h: 11, school: 'main' });
		expect(r.chuan).toEqual(['小吉', '速喜', '大安']);
	});
	test('三阶段:前我/中他人外界/后结果;同名神含义标「同神同义」', () => {
		const a = analyze(sanChuan({ m: 5, d: 23, h: 11, school: 'main' }));
		expect(a.stages.map((s) => s.role)).toEqual(STAGE_ROLES);
		expect(a.stages.every((s) => s.tongShenTongYi)).toBe(true);
		expect(a.pairs).toEqual([]);           // 主流不调取五行生克
		expect(a.tongShenNote).toMatch(/同神同义/);
	});
});

describe('金标② 道门九宫载例:五月二十三日戌时(5,23,11)', () => {
	const r = sanChuan({ m: 5, d: 23, h: 11, school: 'dao' });
	const a = analyze(r);
	test('三传 = [小吉(坎水), 天德(乾金), 大安(震木)]', () => {
		expect(r.chuan).toEqual(['小吉', '天德', '大安']);
		expect(r.chuan.map((c) => DAO_NINE[c].gua + DAO_NINE[c].wuxing)).toEqual(['坎水', '乾金', '震木']);
	});
	test('一二阶段:天德金生小吉水(二生一)→ 贵人相助,生我,爱我,保护我', () => {
		const p = a.pairs[0];
		expect(p.a.name).toBe('小吉');
		expect(p.b.name).toBe('天德');
		expect(p.rel).toBe('被生');
		expect(p.relText).toBe('天德金生小吉水(2生1)');
		expect(p.duan).toBe(SHENG_WO_DUAN);
	});
	test('二三阶段:天德克大安,金克木(二克三)→ 我克者为财,第三阶段为第二阶段之财', () => {
		const p = a.pairs[1];
		expect(p.a.name).toBe('天德');
		expect(p.b.name).toBe('大安');
		expect(p.rel).toBe('克');
		expect(p.relText).toBe('天德金克大安木(2克3)');
		expect(p.duan).toBe(`${WO_KE_DUAN};第三阶段为第二阶段之财`);
	});
	test('一↔三仅列关系,注「文档无定论」', () => {
		expect(a.across.rel).toBe('生'); // 小吉水生大安木,仅列关系
		expect(a.across.note).toMatch(/文档无定论/);
	});
	test('拜解:被克之大安,可拜克方天德所对应之紫微', () => {
		expect(a.baiJie).toEqual([{ victim: '大安', aggressor: '天德', bai: '紫微' }]);
	});
});

describe('金标③ 环长边界', () => {
	test('主流:数 6 = 空亡,数 7 回大安', () => {
		expect(sanChuan({ m: 6, d: 1, h: 1, school: 'main' }).chuan[0]).toBe('空亡');
		expect(sanChuan({ m: 7, d: 1, h: 1, school: 'main' }).chuan[0]).toBe('大安');
	});
	test('道门:数 9 = 天德,数 10 回大安', () => {
		expect(sanChuan({ m: 9, d: 1, h: 1, school: 'dao' }).chuan[0]).toBe('天德');
		expect(sanChuan({ m: 10, d: 1, h: 1, school: 'dao' }).chuan[0]).toBe('大安');
	});
	test('「后一个数字的起点在上一个数字的开始」:作 1 递进', () => {
		// 主流 (2,1,1):第一传留连;第二传自留连作 1 → 仍留连;第三传亦然
		expect(sanChuan({ m: 2, d: 1, h: 1, school: 'main' }).chuan).toEqual(['留连', '留连', '留连']);
	});
	test('非法输入 → null', () => {
		expect(sanChuan({ m: 0, d: 3, h: 3 })).toBeNull();
		expect(sanChuan({ m: 5, d: -1, h: 3 })).toBeNull();
	});
});

describe('金标④ 特例警语', () => {
	test('两留连 → 「这事就算了,别折腾自己了」', () => {
		const r = qiKe({ m: 2, d: 7, h: 3, school: 'main' }); // [留连,留连,赤口]
		expect(r.chuan).toEqual(['留连', '留连', '赤口']);
		expect(r.analysis.teLi.map((t) => t.key)).toContain('两留连');
		expect(r.analysis.teLi.find((t) => t.key === '两留连').text).toBe(TE_LI.两留连);
	});
	test('两赤口 → 血光警语', () => {
		const r = qiKe({ m: 4, d: 7, h: 2, school: 'main' }); // [赤口,赤口,小吉]
		expect(r.chuan).toEqual(['赤口', '赤口', '小吉']);
		expect(r.analysis.teLi.find((t) => t.key === '两赤口').text).toMatch(/血光/);
	});
	test('空亡入传 → 忌钱财、虚幻反吉警语', () => {
		const hits = teLi(['空亡', '大安', '速喜']);
		expect(hits.find((t) => t.key === '空亡').text).toMatch(/现实之事遇空亡很差,虚幻之事遇空亡很好/);
	});
});

describe('金标⑤ 道门九宫结构完备(文档表格逐项)', () => {
	test('九宫号数 1..9 与环序一致', () => {
		expect(DAO_RING).toEqual(['大安', '留连', '速喜', '赤口', '小吉', '空亡', '病符', '桃花', '天德']);
		DAO_RING.forEach((name, i) => expect(DAO_NINE[name].num).toBe(i + 1));
	});
	test('卦·五行·方位逐项(1震木东 2巽木东南 3离火南 4兑金西 5坎水北 6中土内 7坤土西南 8艮土东北 9乾金西北)', () => {
		expect(DAO_NINE.大安).toMatchObject({ gua: '震', wuxing: '木', fangwei: '正东' });
		expect(DAO_NINE.留连).toMatchObject({ gua: '巽', wuxing: '木', fangwei: '东南' });
		expect(DAO_NINE.速喜).toMatchObject({ gua: '离', wuxing: '火', fangwei: '正南' });
		expect(DAO_NINE.赤口).toMatchObject({ gua: '兑', wuxing: '金', fangwei: '正西' });
		expect(DAO_NINE.小吉).toMatchObject({ gua: '坎', wuxing: '水', fangwei: '正北' });
		expect(DAO_NINE.空亡).toMatchObject({ gua: '中', wuxing: '土', fangwei: '内' });
		expect(DAO_NINE.病符).toMatchObject({ gua: '坤', wuxing: '土', fangwei: '西南' });
		expect(DAO_NINE.桃花).toMatchObject({ gua: '艮', wuxing: '土', fangwei: '东北' });
		expect(DAO_NINE.天德).toMatchObject({ gua: '乾', wuxing: '金', fangwei: '西北' });
	});
	test('掌位:主流六宫与道门九宫各按文档表格', () => {
		expect(MAIN_PALM.大安).toEqual({ finger: '食指', jie: 1 });
		expect(MAIN_PALM.留连).toEqual({ finger: '食指', jie: 3 });
		expect(MAIN_PALM.空亡).toEqual({ finger: '中指', jie: 1 });
		expect(DAO_NINE.大安.palm).toEqual({ finger: '食指', jie: 2 });
		expect(DAO_NINE.桃花.palm).toEqual({ finger: '食指', jie: 1 });
		expect(DAO_NINE.天德.palm).toEqual({ finger: '无名指', jie: 1 });
	});
	test('拜解表九神全:大安三清/留连文昌/速喜雷祖/赤口将帅/小吉真武/空亡玉皇/病符后土/桃花城隍/天德紫微', () => {
		expect(BAI_JIE).toEqual({
			大安: '三清', 留连: '文昌', 速喜: '雷祖', 赤口: '将帅', 小吉: '真武',
			空亡: '玉皇', 病符: '后土', 桃花: '城隍', 天德: '紫微',
		});
		// 拜解与九神含义末句一一对应
		Object.keys(BAI_JIE).forEach((shen) => {
			expect(DAO_YI[shen]).toMatch(new RegExp(`可拜${BAI_JIE[shen]}`));
		});
	});
	test('九神含义全文九条俱在,主流六神名全部同名可查(同神同义)', () => {
		expect(Object.keys(DAO_YI)).toHaveLength(9);
		MAIN_RING.forEach((name) => expect(DAO_YI[name]).toBeTruthy());
	});
	test('病符歧异照录:题头「金·西南」,结构化从九宫表取土,并存注记', () => {
		expect(DAO_YI.病符).toMatch(/^病符:金·西南/);
		expect(DAO_NINE.病符.wuxing).toBe('土');
		expect(BING_FU_DISCREPANCY_NOTE).toMatch(/前后不一/);
	});
	test('五行生克环自洽', () => {
		expect(Object.keys(WUXING_SHENG)).toHaveLength(5);
		Object.keys(WUXING_SHENG).forEach((e) => {
			expect(WUXING_KE[e]).toBe(WUXING_SHENG[WUXING_SHENG[e]]); // 克 = 生之所生(隔位相克)
		});
	});
});

describe('showOneThree 开关(挂载设置真生效,非死开关)', () => {
	const { buildXiaoLiuRenSnapshotForCase } = require('../XiaoLiuRenMain');
	const payload = { nums: [5, 23, 11], options: { school: 'dao' }, askEvent: '' };
	it('默认(true):道门快照含一↔三行', () => {
		expect(buildXiaoLiuRenSnapshotForCase(payload, { school: 'dao' })).toContain('一↔三');
	});
	it('关(false):一↔三行消失,其余不变', () => {
		const on = buildXiaoLiuRenSnapshotForCase(payload, { school: 'dao', showOneThree: true });
		const off = buildXiaoLiuRenSnapshotForCase(payload, { school: 'dao', showOneThree: false });
		expect(off).not.toContain('一↔三');
		expect(off.length).toBeLessThan(on.length);
		expect(off).toContain('[生克]');
	});
});
