// 奇门盘面附加层合同:天盘干序转暗干 / 寄干与天禽落宫 / 翻宫链 / 转宫(空亡对冲 · 大伏吟先天位)/ 十二建星。
// 全部默认关:缺省盘不出任何新键(零回归);开关开才在格子与快照里出现。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { panAnGan, ANGAN_MODE_OPTIONS } from '../calc/options';
import { resolveJiGan, resolveYongShenGong, qimenFanGong, qimenZhuanGong, tuiYanRows, tuiYanLines, jiGanRows, TUIYAN_GONG_OPTIONS } from '../calc/overlay';
import { displayTuiYanTag, describeTuiYanTag, tuiYanLegend } from '../qimenCellLayout';
import { buildDunJiaSnapshotText } from '../DunJiaCalc';
import { computeQimenScanPan, buildQimenScanSeeds } from '../../../divination/zeri/qimenScanEngine';
import { jianChuOf, jianChuLines, jianChuRing, jianChuMonthZhi, JIANCHU_12 } from '../../../utils/jianChu';
import { getDayGanZhi } from '../../../utils/localNongliAdapter';
import { JIANCHU_12 as FS_JIANCHU_12, JIANCHU_JX as FS_JIANCHU_JX } from '../../fengshui/fengshuiData';
import SanshiUnitedBoard from '../../sanshi/SanshiUnitedBoard';
import DunJiaBoard from '../DunJiaBoard';

const GEO = { zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
const BASE = { paiPanType: 3, qijuMethod: 'chaibu', zhiShiType: 0, yueJiaQiJuType: 1, kongMode: 'day', yimaMode: 'day', shiftPalace: 0, fengJu: false, timeAlg: 1, school: '转盘', after23NewDay: 0, lateZiHourUseNextDay: 1 };
const SEEDS = buildQimenScanSeeds(2026, 2026, '+08:00');
const panAt = (extra, date = '2026-11-19', time = '15:30:00')=>computeQimenScanPan(GEO, { ...BASE, ...(extra || {}) }, SEEDS, date, time);
const cellOf = (pan, n)=>pan.cells.find((c)=>c.palaceNum === n);

describe('暗干第六法:时干加值使·按天盘干序转', ()=>{
	it('选项表里有,标签写明按天盘干序', ()=>{
		expect(ANGAN_MODE_OPTIONS.map((o)=>o.value)).toContain('tianpan_zhuan');
	});
	it('例盘(阴三局,值使生门落坎,时干辛;坎宫天盘己+寄干丙):逐宫对拍', ()=>{
		const out = panAnGan('tianpan_zhuan', {
			tianpanGua: { 坎: '己', 艮: '癸', 震: '丁', 巽: '庚', 离: '壬', 坤: '戊', 兑: '乙', 乾: '辛' },
			jiTian: { gua: '坎', gan: '丙' }, shiGan: '辛', zhishiGong: '坎', yy: '阴',
		});
		expect(out).toEqual({ 坎: '辛', 艮: '己丙', 震: '癸', 巽: '丁', 离: '庚', 坤: '壬', 兑: '戊', 乾: '乙' });
	});
	it('时干为甲取旬首遁仪;值使落中从寄宫起;伏吟(时干在值使宫天盘)= 天盘原样', ()=>{
		const tp = { 坎: '戊', 艮: '己', 震: '庚', 巽: '辛', 离: '壬', 坤: '癸', 兑: '丁', 乾: '丙' };
		expect(panAnGan('tianpan_zhuan', { tianpanGua: tp, shiGan: '甲', shiDun: '庚', zhishiGong: '坎' }).坎).toBe('庚');
		expect(panAnGan('tianpan_zhuan', { tianpanGua: tp, shiGan: '辛', zhishiGong: '中', jiGong: '坤' }).坤).toBe('辛');
		expect(panAnGan('tianpan_zhuan', { tianpanGua: tp, shiGan: '戊', zhishiGong: '坎' })).toEqual(tp);
	});
	it('其余五法不读新上下文(零回归):给不给天盘 / 寄干,结果一样', ()=>{
		const ctx = { menGua: { 坎: '休', 艮: '生' }, dipanGua: { 坎: '戊', 艮: '己' }, yy: '阳', shiGan: '丙', zhishiGong: '坎', jiGong: '坤' };
		['dipan', 'zhishi_fei', 'zhishi_zhuan', 'manpan_fei'].forEach((m)=>{
			expect(panAnGan(m, { ...ctx, tianpanGua: { 坎: '乙' }, jiTian: { gua: '坎', gan: '丁' }, shiDun: '戊' })).toEqual(panAnGan(m, ctx));
		});
	});
	it('整盘接线:天盘干序转的暗干 = 天盘圈整体转动(含中五寄干),时干落值使宫', ()=>{
		const pan = panAt({ anGanMode: 'tianpan_zhuan' });
		const t = pan.ganzhi.time.charAt(0);
		if(t !== '甲'){ expect(cellOf(pan, pan.zhiShiPalace).anGan).toContain(t); }
		const ring = [1, 2, 3, 6, 9, 8, 7, 4];
		const sorted = (str)=>str.split('').sort().join('');
		expect(sorted(ring.map((n)=>cellOf(pan, n).anGan).join(''))).toBe(sorted(ring.map((n)=>cellOf(pan, n).tianGan).join('') + cellOf(pan, 5).tianGan));
	});
});

describe('寄干 / 天禽落宫', ()=>{
	const diBase = { 1: '辛', 2: '乙', 3: '壬', 4: '庚', 5: '己', 6: '丁', 7: '丙', 8: '癸', 9: '戊' };
	it('缺省寄坤:地盘寄坤,天盘寄到「天盘干 = 坤宫原地盘干」那一宫', ()=>{
		const tian = { 1: '丙', 2: '辛', 3: '庚', 4: '癸', 6: '丁', 7: '戊', 8: '乙', 9: '壬' };
		expect(resolveJiGan({ isFeipan: false, diPanBase: diBase, diPan: diBase, tianPan: tian, jiGongGua: '坤' })).toEqual({ gan: '己', diNum: 3, tianNum: 9 });
	});
	it('寄艮:跟着艮宫原地盘干走', ()=>{
		const tian = { 1: '丙', 2: '辛', 3: '庚', 4: '癸', 6: '丁', 7: '戊', 8: '乙', 9: '壬' };
		expect(resolveJiGan({ isFeipan: false, diPanBase: diBase, diPan: diBase, tianPan: tian, jiGongGua: '艮' })).toEqual({ gan: '己', diNum: 7, tianNum: 1 });
	});
	it('飞盘中宫自有干,不寄', ()=>{
		expect(resolveJiGan({ isFeipan: true, diPanBase: diBase, diPan: diBase, tianPan: diBase, jiGongGua: '坤' })).toBe(null);
	});
	it('整盘:开关开才出格子键;天禽标在天盘寄宫;快照写寄干行', ()=>{
		const off = panAt();
		expect(off.cells.some((c)=>'jiTianGan' in c || 'jiDiGan' in c || 'tianQin' in c)).toBe(false);
		expect('jiGan' in off).toBe(false);
		const on = panAt({ showJiGan: true, showTianQin: true });
		const tianCell = on.cells.find((c)=>c.jiTianGan);
		const diCell = on.cells.find((c)=>c.jiDiGan);
		expect(tianCell && diCell).toBeTruthy();
		expect(tianCell.tianQin).toBe(true);
		expect(cellOf(on, 5).tianGan).toBe(tianCell.jiTianGan);   // 寄的就是中五宫的干
		expect(buildDunJiaSnapshotText(on)).toMatch(/寄干：中五宫.+地盘寄.+天盘随星寄/);
		expect(buildDunJiaSnapshotText(on)).toMatch(/天禽：随寄宫之星落/);
		expect(jiGanRows(on.jiGan).length).toBe(2);
	});
	it('飞盘整盘:即使开关开也不出寄干键', ()=>{
		const fei = panAt({ school: '飞盘', showJiGan: true, showTianQin: true });
		expect(fei.cells.some((c)=>'jiTianGan' in c || 'tianQin' in c)).toBe(false);
	});
});

describe('翻宫', ()=>{
	const tian = { 1: '丙', 2: '辛', 3: '庚', 4: '癸', 6: '丁', 7: '戊', 8: '乙', 9: '壬' };
	const di = { 1: '庚', 2: '丁', 3: '壬', 4: '辛', 6: '乙', 7: '丙', 8: '癸', 9: '戊' };
	it('上翻:天盘干 → 地盘同干之宫;下翻:地盘干 → 天盘同干之宫;各三步', ()=>{
		const f = qimenFanGong({ tianPan: tian, diPan: di, ji: null, start: 7 });
		expect(f.fuyin).toBe(false);
		expect(f.up).toEqual([{ num: 9, gan: '戊' }, { num: 3, gan: '壬' }, { num: 1, gan: '庚' }]);
		expect(f.down).toEqual([{ num: 1, gan: '丙' }, { num: 3, gan: '庚' }, { num: 9, gan: '壬' }]);
	});
	it('寄干参与匹配:要找的干只在寄宫时,落到寄宫', ()=>{
		const f = qimenFanGong({ tianPan: { ...tian, 7: '己' }, diPan: di, ji: { gan: '己', diNum: 3, tianNum: 9 }, start: 7 });
		expect(f.up[0]).toEqual({ num: 3, gan: '己' });
	});
	it('伏吟(天地同干):翻宫无效,行里写明改看转宫', ()=>{
		const f = qimenFanGong({ tianPan: di, diPan: di, ji: null, start: 7 });
		expect(f.fuyin).toBe(true);
		expect(f.up).toEqual([]);
		const rows = tuiYanRows({ view: 'fan', start: 7, gongLabel: '指定', fan: f });
		expect(rows.rows.map((r)=>r[1]).join('')).toMatch(/翻宫无效.*转宫/);
	});
});

describe('转宫', ()=>{
	const HOME_STAR = { 8: '蓬', 7: '任', 4: '冲', 1: '辅', 2: '英', 3: '内', 6: '柱', 9: '心' };
	const HOME_DOOR = { 8: '休', 7: '生', 4: '伤', 1: '杜', 2: '景', 3: '死', 6: '惊', 9: '开' };
	it('空亡转对冲宫', ()=>{
		const z = qimenZhuanGong({ star: {}, men: {}, kongPalaces: [1, 2], start: 2 });
		expect(z.kong).toEqual([{ from: 1, to: 9 }, { from: 2, to: 8 }]);
		expect(z.startKong).toBe(true);
		expect(z.daFuyin).toBe(false);
	});
	it('星门全伏吟 = 大伏吟,用神宫转先天八卦位(坎→兑、离→震、乾→离、坤→坎、震→艮、巽→坤、艮→乾、兑→巽)', ()=>{
		const expectTo = { 8: 6, 2: 4, 9: 2, 3: 8, 4: 7, 1: 3, 7: 9, 6: 1 };
		Object.keys(expectTo).forEach((n)=>{
			const z = qimenZhuanGong({ star: HOME_STAR, men: HOME_DOOR, kongPalaces: [], start: Number(n) });
			expect(z.daFuyin).toBe(true);
			expect(z.startXianTian).toBe(expectTo[n]);
		});
	});
	it('只门伏吟不算大伏吟', ()=>{
		expect(qimenZhuanGong({ star: { ...HOME_STAR, 8: '任', 7: '蓬' }, men: HOME_DOOR, kongPalaces: [], start: 8 }).daFuyin).toBe(false);
	});
});

describe('推演整盘接线(默认关零回归)', ()=>{
	it('缺省盘不出推演键;快照不出推演行', ()=>{
		const off = panAt();
		expect('tuiYan' in off).toBe(false);
		expect(off.cells.some((c)=>'tuiYanTags' in c)).toBe(false);
		expect(Object.keys(off.options).some((k)=>/tuiYan|JiGan|TianQin/.test(k))).toBe(false);
		expect(buildDunJiaSnapshotText(off)).not.toMatch(/推演|寄干|天禽：/);
	});
	it('翻宫:用神宫打「用」,链上打 上N / 下N;快照写推演', ()=>{
		const on = panAt({ tuiYanView: 'fan' });
		expect(on.tuiYan.start).toBe(resolveYongShenGong('shigan', { tianPan: on.tianPan, shiGan: on.ganzhi.time.charAt(0), shiDun: '', ji: null }) || on.tuiYan.start);
		expect(cellOf(on, on.tuiYan.start).tuiYanTags).toContain('用');
		on.tuiYan.fan.up.forEach((st, i)=>expect(cellOf(on, st.num).tuiYanTags).toContain(`上${i + 1}`));
		expect(tuiYanLines(on.tuiYan)[0]).toMatch(/^推演 · 翻宫：用神宫/);
		expect(tuiYanLines(on.tuiYan)[0]).not.toMatch(/\([^)]*\(/);   // 用神宫标签不出现括号套括号
		expect(buildDunJiaSnapshotText(on)).toMatch(/推演 · 翻宫：/);
	});
	it('转宫:空亡宫打「空转X」;指定用神宫生效', ()=>{
		const on = panAt({ tuiYanView: 'zhuan', tuiYanGong: '8' });
		expect(on.tuiYan.start).toBe(8);
		on.tuiYan.zhuan.kong.forEach((k)=>expect(cellOf(on, k.from).tuiYanTags.join()).toMatch(/空转/));
		expect(buildDunJiaSnapshotText(on)).toMatch(/推演 · 转宫：/);
	});
	it('用神宫选项含时干 / 值符 / 值使 + 八宫', ()=>{
		expect(TUIYAN_GONG_OPTIONS.map((o)=>o.value)).toEqual(['shigan', 'zhifu', 'zhishi', '8', '3', '4', '1', '9', '6', '7', '2']);
	});
	it('盘面标记两盘同一写法(不用箭头:↑ 在苹方里是全角宽、与数字不齐),每个标记都有释义,图例按推演方式', ()=>{
		expect(['上1', '下3', '空转乾', '先天位', '用'].map(displayTuiYanTag)).toEqual(['上1', '下3', '转乾', '先天', '用']);
		expect(describeTuiYanTag('上2')).toBe('上翻第 2 步（往过去）');
		expect(describeTuiYanTag('空转乾')).toBe('本宫空亡，信息转看对冲乾宫');
		expect(tuiYanLegend('fan')).toMatch(/上N = 上翻第 N 步/);
		expect(tuiYanLegend('zhuan')).toMatch(/转X/);
		expect(tuiYanLegend('off')).toBe('');
	});
});

describe('十二建星(单一来源)', ()=>{
	it('风水 / 黄历那份就是同一份', ()=>{
		expect(FS_JIANCHU_12).toBe(JIANCHU_12);
		expect(FS_JIANCHU_JX.破).toBe('bad');
	});
	it('月建起建顺数:寅月寅日建、卯日除、申日破;时值以日支为建', ()=>{
		expect(jianChuOf('丙寅', '甲寅').name).toBe('建');
		expect(jianChuOf('丙寅', '乙卯').name).toBe('除');
		expect(jianChuOf('丙寅', '庚申')).toMatchObject({ name: '破', jx: 'bad' });
		expect(jianChuOf('', '甲子')).toBe(null);
		expect(jianChuLines({ month: '丙寅', day: '甲寅', time: '丙寅' })[0]).toMatch(/^十二建星：日值建（平）、时值建（平）/);
	});
});

describe('三式盘:上挂下注 —— 暗干与推演在格旁空格,寄干天禽在格内', ()=>{
	const cellsWith = (one)=>[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n)=>({ palaceNum: n, tianGan: '丙', diGan: '戊', god: '符', tianXing: '蓬', door: '休', ...(n === 1 ? one : {}) }));
	it('暗干带前缀小「暗」画在巽宫顺时针一侧那一格(格旁空格),不再挤在格子里', ()=>{
		const html = renderToStaticMarkup(<SanshiUnitedBoard dunjia={{ cells: cellsWith({ anGan: '庚', anZhi: '午' }) }} keData={{ raw: [] }} sanChuan={{}} lrLayout={{}} boardSize={600} />);
		const side = html.match(/<div[^>]*data-qimen-side="1"[^>]*style="left:([\d.]+)%;top:([\d.]+)%[^"]*"[^>]*>(.*?)<\/div><\/div><\/div>/);
		expect(side).toBeTruthy();
		expect([Math.round(Number(side[1]) * 9 / 100), Math.round(Number(side[2]) * 9 / 100)]).toEqual([2, 1]);
		expect(side[3]).toMatch(/data-qimen-ov="anGan" title="暗干 庚 · 暗支 午"/);
		expect(side[3]).toMatch(/<span class="horosa-qimen-ov-pre">暗<\/span>庚午/);
		// 格子里(qmBlock)不再出暗干
		expect(html.split('data-qimen-side')[0]).not.toMatch(/data-qimen-ov="anGan"/);
	});
	it('暗干与推演标记都有时上下各占格旁空格一半;寄干紧跟天盘干小写一个干', ()=>{
		const html = renderToStaticMarkup(<SanshiUnitedBoard dunjia={{ cells: cellsWith({ anGan: '辛戊', anZhi: '酉', tuiYanTags: ['用', '上1'], jiTianGan: '辛' }) }} keData={{ raw: [] }} sanChuan={{}} lrLayout={{}} boardSize={600} />);
		expect(html).toMatch(/data-qimen-ov="tuiYan"[^>]*><div class="horosa-qimen-ov-line"><span class="horosa-qimen-ov-tag">用<\/span><span class="horosa-qimen-ov-tag">上1<\/span>/);
		expect(html).toMatch(/data-qimen-ov="jiTian" title="天盘寄干 辛[^"]*"[^>]*><div class="horosa-qimen-ov-line">辛<\/div>/);
	});
	it('十二建星开着:外圈每个地支旁挂建星,日值那一支加框;不开 = 一个都不出', ()=>{
		const ganzhi = { month: '丁亥', day: '癸亥', time: '癸丑' };
		const props = { dunjia: { cells: cellsWith({}), ganzhi }, keData: { raw: [] }, sanChuan: {}, lrLayout: {}, boardSize: 600 };
		const off = renderToStaticMarkup(<SanshiUnitedBoard {...props} />);
		expect(off).not.toMatch(/data-jianchu-mark/);
		const on = renderToStaticMarkup(<SanshiUnitedBoard {...props} showJianChu />);
		expect((on.match(/data-jianchu-mark=/g) || []).length).toBe(12);
		expect(on).toMatch(/class="horosa-qimen-jx is-day" data-jianchu-mark="建" title="亥 值建（平） · 今日日值"/);
		expect((on.match(/horosa-qimen-jx is-day/g) || []).length).toBe(1);
	});
});

describe('十二建星外环(奇门页)', ()=>{
	it('月建起建:每支一个建星,日支那一格是今日日值;时值以日支为建另起', ()=>{
		const ring = jianChuRing({ month: '丁亥', day: '甲子', time: '丙寅' });   // 不给日期 = 按盘上月柱
		expect(ring.byZhi.亥.name).toBe('建');
		expect(ring.byZhi.子).toMatchObject({ name: '除', isDay: true });
		expect(Object.values(ring.byZhi).filter((j)=>j.isDay).length).toBe(1);
		expect(ring.hour.name).toBe('满');   // 时值以日支子为建:子建 丑除 寅满
		expect(ring.hour).toEqual(jianChuOf('甲子', '丙寅'));
		expect(jianChuRing({ month: '', day: '甲子' })).toBe(null);
	});
	it('逢节重复:交节当天整天按新月建(与黄历 lunar getZhiXing 逐日同口径),23 点换日后按次日;交节前后几个时刻都对', ()=>{
		const { Solar } = require('lunar-javascript');
		const bad = [];
		// 2026 年十二个节(小寒 … 大雪)所在日,交节前(早上)、午后与 23:30(两种换日档)
		['2026-01-05', '2026-02-04', '2026-03-05', '2026-04-05', '2026-05-05', '2026-06-05', '2026-07-07', '2026-08-07', '2026-09-07', '2026-10-08', '2026-11-07', '2026-12-07'].forEach((date)=>{
			const [y, m, d] = date.split('-').map(Number);
			const sol = Solar.fromYmd(y, m, d);
			expect([date, sol.getLunar().getMonthZhi() !== sol.next(-1).getLunar().getMonthZhi()]).toEqual([date, true]);   // 确是交节日
			[['06:00:00', 0], ['15:00:00', 0], ['23:30:00', 0], ['23:30:00', 1]].forEach(([time, a23])=>{
				const pan = panAt({ showJianChu: true, after23NewDay: a23 }, date, time);
				const exp = (time === '23:30:00' && a23 === 1 ? sol.next(1) : sol).getLunar().getZhiXing();
				if(pan.jianChu.day.name !== exp){ bad.push([date, time, a23, exp, pan.jianChu.day.name]); }
				// 外环上日支那一格 = 日值;右栏卡 / 快照与外环同一份
				expect(pan.jianChu.byZhi[pan.ganzhi.day.slice(-1)].name).toBe(pan.jianChu.day.name);
				expect(buildDunJiaSnapshotText(pan)).toContain(`日值${pan.jianChu.day.name}`);
			});
		});
		expect(bad).toEqual([]);
	});
	it('逢节重复只在历法库可信域内采用(公元 1–9999):域外它不报错但月支是错的 —— 一律退回盘上月柱', ()=>{
		// 公元前 500 年 3 月 5 日:本软件日柱与历法库相同(庚寅),历法库却给出「亥」月;盘上是寅月
		expect(getDayGanZhi(-500, 3, 5)).toBe('庚寅');
		expect(jianChuMonthZhi({ month: '甲寅', day: '庚寅' }, '-0500-03-05')).toBe('寅');
		expect(jianChuMonthZhi({ month: '甲子', day: getDayGanZhi(10000, 1, 1) }, '10000-01-01')).toBe('子');
		expect(jianChuRing({ month: '甲寅', day: '庚寅', time: '壬午' }, '-0500-03-05').byZhi.寅.name).toBe('建');
		// 贴着域边:公元 1 年 1 月 1 日的「前一天」已出域,不采(日柱取前一天的干支也只会退回盘上月柱)
		expect(jianChuMonthZhi({ month: '甲子', day: getDayGanZhi(0, 12, 31) }, '0001-01-01')).toBe('子');
		// 1582 年 10 月改历空档(历法库抛错)、认不出的日期、没给日期:都退回,不抛
		expect(jianChuMonthZhi({ month: '甲戌', day: '甲子' }, '1582-10-10')).toBe('戌');
		expect(jianChuMonthZhi({ month: '甲戌', day: '甲子' }, 'x')).toBe('戌');
		expect(jianChuMonthZhi({ month: '甲戌', day: '甲子' })).toBe('戌');
	});
	it('自检:节令月支只可能是盘上月支或它的下一支;对不上(两边历法不同源)信盘,外环的「建」不落到与月柱无关的支上', ()=>{
		const { Solar } = require('lunar-javascript');
		const lunar = Solar.fromYmd(2026, 3, 20).getLunar();   // 卯月(惊蛰后、清明前)
		const day = lunar.getDayInGanZhi();
		expect(lunar.getMonthZhi()).toBe('卯');
		expect(jianChuMonthZhi({ month: '辛卯', day }, '2026-03-20')).toBe('卯');   // 同月:采
		expect(jianChuMonthZhi({ month: '庚寅', day }, '2026-03-20')).toBe('卯');   // 盘上还是上一支(交节当天交节前的形态):采下一支
		expect(jianChuMonthZhi({ month: '壬辰', day }, '2026-03-20')).toBe('辰');   // 盘上已是下一支而历法库还在上一支:信盘
		expect(jianChuMonthZhi({ month: '甲午', day }, '2026-03-20')).toBe('午');   // 完全对不上:信盘
	});
	it('左栏 / 盘下按钮开了:排盘结果带 jianChu,快照多一行;默认不出键、快照逐字不变', ()=>{
		const off = panAt({});
		expect(off.jianChu).toBeUndefined();
		expect(buildDunJiaSnapshotText(off)).not.toMatch(/十二建星/);
		const on = panAt({ showJianChu: true });
		expect(on.jianChu.byZhi[on.ganzhi.day.slice(-1)].isDay).toBe(true);
		expect(on.options.showJianChu).toBe(true);
		expect(buildDunJiaSnapshotText(on)).toContain(jianChuLines(on.ganzhi, on.dateStr)[0]);
		// 金函日家盘同样认这个键(按钮在金函盘上不是死开关)
		const jin = panAt({ paiPanType: 6, showJianChu: true });
		expect(jin.isJinhan).toBe(true);
		expect(jin.jianChu && jin.jianChu.byZhi).toBeTruthy();
		expect(buildDunJiaSnapshotText(jin)).toMatch(/十二建星：日值/);
	});
	it('盘面:外环一圈十二支 + 九宫等比缩进原边长;盘下按钮只在主页出现,按下状态随外环', ()=>{
		const on = panAt({ showJianChu: true });
		const html = renderToStaticMarkup(<DunJiaBoard pan={on} boardScale={0.85} onToggleJianChu={()=>{}} />);
		expect((html.match(/data-jianchu="/g) || []).length).toBe(12);
		expect(html).toMatch(/horosa-dunjia-grid-wrap has-ring" style="position:relative;width:662px;height:662px/);
		expect(html).toMatch(/horosa-qimen-ring-stage" style="position:absolute;left:0;top:0;width:742px;height:742px;transform:scale\(0\.892/);
		expect(html).toMatch(/aria-pressed="true"[^>]*>(<span>)?十二建星/);
		const off = renderToStaticMarkup(<DunJiaBoard pan={panAt({})} boardScale={0.85} onToggleJianChu={()=>{}} />);
		expect(off).not.toMatch(/data-jianchu=/);
		expect(off).toMatch(/aria-pressed="false"[^>]*>(<span>)?十二建星/);
		const embedded = renderToStaticMarkup(<DunJiaBoard pan={on} boardScale={0.85} />);
		expect(embedded).not.toMatch(/十二建星<\//);
	});
	it('主字内缩:盘上没有附注 = 老位置(左 52 / 上 40,零回归);有附注 = 整盘换留白档', ()=>{
		const plain = renderToStaticMarkup(<DunJiaBoard pan={panAt({})} boardScale={0.85} />);
		expect(plain).toMatch(/left:52px;top:40px;font-size:34px/);
		expect(plain).not.toMatch(/left:46px;top:32px;font-size:34px/);
		const busy = renderToStaticMarkup(<DunJiaBoard pan={panAt({ showJiGan: true })} boardScale={0.85} />);
		expect(busy).toMatch(/left:46px;top:32px;font-size:34px/);
		expect(busy).not.toMatch(/left:52px;top:40px;font-size:34px/);
	});
});

describe('奇门页转盘中宫的暗干(飞布 / 满盘旋转飞两法把暗干排入中五宫)', ()=>{
	const CENTER_AN = /五合.<\/div><\/div><div class="horosa-qimen-ov is-minor" data-qimen-ov="anGan" title="暗干 ([^" ]+)( · 暗支 ([^"]+))?"[^>]*><div class="horosa-qimen-ov-line"><span class="horosa-qimen-ov-pre">暗<\/span>([^<]+)<\/div>/;
	const count = (html)=>(html.match(/data-qimen-ov="anGan"/g) || []).length;
	it('两法:中宫格两行大字下方多一行「暗 X」,内容 = 排盘结果里中五宫的暗干暗支(与快照「暗干分布」的中宫同一个值)', ()=>{
		['zhishi_fei', 'manpan_fei'].forEach((mode)=>{
			const pan = panAt({ anGanMode: mode, showAnZhi: true });
			const c5 = cellOf(pan, 5);
			expect([mode, !!c5.anGan]).toEqual([mode, true]);
			const html = renderToStaticMarkup(<DunJiaBoard pan={pan} boardScale={0.85} />);
			const m = CENTER_AN.exec(html);
			expect([mode, !!m]).toEqual([mode, true]);
			expect(m[1]).toBe(c5.anGan);
			expect(m[4]).toBe(`${c5.anGan}${c5.anZhi || ''}`);
			expect(count(html)).toBe(9);   // 八宫 + 中宫
			expect(buildDunJiaSnapshotText(pan)).toContain(`中${c5.anGan}${c5.anZhi || ''}`);
			// 不开暗支:只写暗干
			const noZhi = renderToStaticMarkup(<DunJiaBoard pan={panAt({ anGanMode: mode })} boardScale={0.85} />);
			expect(CENTER_AN.exec(noZhi)[4]).toBe(c5.anGan);
		});
	});
	it('暗干不入中宫的起法、关暗干、飞盘(中宫本来就是常规格):中宫格不多这一行', ()=>{
		['tianpan_zhuan', 'zhishi_zhuan', 'dipan'].forEach((mode)=>{
			const pan = panAt({ anGanMode: mode, showAnZhi: true });
			expect([mode, cellOf(pan, 5).anGan || '']).toEqual([mode, '']);
			const html = renderToStaticMarkup(<DunJiaBoard pan={pan} boardScale={0.85} />);
			expect([mode, CENTER_AN.test(html), count(html)]).toEqual([mode, false, 8]);
		});
		expect(CENTER_AN.test(renderToStaticMarkup(<DunJiaBoard pan={panAt({})} boardScale={0.85} />))).toBe(false);
		// 飞盘:中宫走常规格(暗干在门位上方,不带「暗」前缀),不走这块几何
		const fei = renderToStaticMarkup(<DunJiaBoard pan={panAt({ school: '飞盘', anGanMode: 'zhishi_fei' })} boardScale={0.85} />);
		expect(CENTER_AN.test(fei)).toBe(false);
		expect(count(fei)).toBe(9);
	});
});

describe('每个附注开关真改两张盘(开才出、关就没)', ()=>{
	const count = (html, key)=>(html.match(new RegExp(`data-qimen-ov="${key}"`, 'g')) || []).length;
	const CASES = [
		['anGan', { anGanMode: 'tianpan_zhuan' }],
		['jiTian', { showJiGan: true }],
		['jiDi', { showJiGan: true }],
		['tianQin', { showTianQin: true }],
		['tuiYan', { tuiYanView: 'fan' }],
		['tuiYan', { tuiYanView: 'zhuan' }],
	];
	it('奇门页大盘', ()=>{
		const off = renderToStaticMarkup(<DunJiaBoard pan={panAt({})} boardScale={0.85} />);
		['anGan', 'jiTian', 'jiDi', 'tianQin', 'tuiYan'].forEach((k)=>expect([k, count(off, k)]).toEqual([k, 0]));
		CASES.forEach(([key, opt])=>{
			const html = renderToStaticMarkup(<DunJiaBoard pan={panAt(opt)} boardScale={0.85} />);
			expect([key, JSON.stringify(opt), count(html, key) > 0]).toEqual([key, JSON.stringify(opt), true]);
		});
		// 暗支随暗干:开了暗干两字以上的写法里带暗支(title 里有「暗支」)
		const withZhi = renderToStaticMarkup(<DunJiaBoard pan={panAt({ anGanMode: 'tianpan_zhuan', showAnZhi: true })} boardScale={0.85} />);
		expect(withZhi).toMatch(/data-qimen-ov="anGan" title="暗干 [^"]+ · 暗支 /);
		expect(renderToStaticMarkup(<DunJiaBoard pan={panAt({ anGanMode: 'tianpan_zhuan' })} boardScale={0.85} />)).not.toMatch(/· 暗支 /);
	});
	it('三式合一盘(同一份奇门盘数据;格内 = 寄干天禽,格旁空格 = 暗干推演;十二建星按页面开关)', ()=>{
		const board = (opt, extra)=>renderToStaticMarkup(<SanshiUnitedBoard dunjia={panAt(opt)} keData={{ raw: [] }} sanChuan={{}} lrLayout={{}} boardSize={600} {...(extra || {})} />);
		const off = board({});
		['anGan', 'jiTian', 'jiDi', 'tianQin', 'tuiYan'].forEach((k)=>expect([k, count(off, k)]).toEqual([k, 0]));
		expect(off).not.toMatch(/data-qimen-side=/);
		CASES.forEach(([key, opt])=>{
			const html = board(opt);
			expect([key, JSON.stringify(opt), count(html, key) > 0]).toEqual([key, JSON.stringify(opt), true]);
		});
		expect(board({ anGanMode: 'tianpan_zhuan' })).toMatch(/data-qimen-side=/);
		expect(board({}, { showJianChu: true })).toMatch(/data-jianchu-mark=/);
		expect(board({ showJianChu: true })).not.toMatch(/data-jianchu-mark=/);   // 三式只认页面开关(不经奇门起盘)
	});
});


describe('出厂口径走后端合并路径时,盘面附加层不丢', ()=>{
	const { normalizeKinqimenData, isQimenLocalRoute, OVERLAY_CELL_KEYS } = require('../calc/kinqimen');
	const NAME = { 1: '巽', 2: '离', 3: '坤', 4: '震', 5: '中', 6: '兑', 7: '艮', 8: '坎', 9: '乾' };
	const toGua = (m)=>{ const o = {}; for(let i = 1; i <= 9; i++){ if(m[i]){ o[NAME[i]] = m[i]; } } return o; };
	// 仿后端回包:各层取本地结果(出厂口径下后端与本地逐字相同)
	const backendOf = (local)=>{
		const star = {}; local.cells.forEach((c)=>{ star[c.palaceNum] = c.tianXing; });
		return { selected: { 天盘: toGua(local.tianPan), 地盘: toGua(local.diPan), 门: toGua(local.renPan), 星: toGua(star), 神: toGua(local.shenPan),
			值符值使: { 值符星宫: [local.zhiFu.replace('天', ''), NAME[local.zhiFuPalace]], 值使门宫: [local.zhiShi.replace('门', ''), NAME[local.zhiShiPalace]] }, 排局: local.juText }, mode: 'hour' };
	};
	const pick = (p)=>p.cells.filter((c)=>OVERLAY_CELL_KEYS.some((k)=>c[k] !== undefined)).map((c)=>[c.palaceNum, c.jiTianGan, c.jiDiGan, c.tianQin, c.tuiYanTags]);
	it('🔴 只开寄干 / 天禽 / 推演(都不改排盘):仍走后端路由;合并后格子上的标注与本地盘逐宫相同', ()=>{
		[{ showJiGan: true }, { showTianQin: true }, { tuiYanView: 'fan' }, { tuiYanView: 'zhuan', tuiYanGong: 'zhishi' }, { showJiGan: true, showTianQin: true, tuiYanView: 'fan' }].forEach((extra)=>{
			const opts = { ...BASE, ...extra };
			expect(isQimenLocalRoute(opts)).toBe(false);
			const local = computeQimenScanPan(GEO, opts, SEEDS, '2026-03-10', '10:30:00');
			const merged = normalizeKinqimenData(backendOf(local), local, opts, null);
			expect(pick(local).length).toBeGreaterThan(0);
			expect([JSON.stringify(extra), pick(merged)]).toEqual([JSON.stringify(extra), pick(local)]);
		});
		// 全关:合并后的格子上一个附加键都没有
		const plain = computeQimenScanPan(GEO, BASE, SEEDS, '2026-03-10', '10:30:00');
		expect(pick(normalizeKinqimenData(backendOf(plain), plain, BASE, null))).toEqual([]);
	});
});

describe('推演用神宫落中五宫', ()=>{
	it('🔴 转盘:值符 / 值使落中五宫时用神宫取寄宫(星门神实际排在那里),不拿中宫的天地盘同干当伏吟', ()=>{
		const ji = { gan: '戊', diNum: 3, tianNum: 8 };
		expect(resolveYongShenGong('zhifu', { tianPan: {}, ji, zhiFuPalace: 5, zhiShiPalace: 5 })).toBe(3);
		expect(resolveYongShenGong('zhishi', { tianPan: {}, ji, zhiFuPalace: 5, zhiShiPalace: 5 })).toBe(3);
		expect(resolveYongShenGong('zhishi', { tianPan: {}, ji, zhiFuPalace: 2, zhiShiPalace: 7 })).toBe(7);
		// 全年扫:值符 / 值使两档的用神宫都不落中五宫;翻宫不再出「伏吟」而寄宫其实不伏吟的句子
		let hit5 = 0; let n = 0;
		['zhifu', 'zhishi'].forEach((gong)=>{
			for(let mo = 1; mo <= 12; mo++){ for(let d = 1; d <= 28; d += 3){ for(let h = 0; h < 24; h += 2){
				const pan = panAt({ tuiYanView: 'fan', tuiYanGong: gong }, `2026-${`${mo}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`, `${`${h}`.padStart(2, '0')}:30:00`);
				n += 1;
				if(pan.tuiYan.start === 5){ hit5 += 1; }
				if(pan.tuiYan.fan.fuyin){ const c = cellOf(pan, pan.tuiYan.start); expect(c.tianGan.charAt(0)).toBe(c.diGan.charAt(0)); }
			} } }
		});
		expect(n).toBeGreaterThan(2000);
		expect(hit5).toBe(0);
	});
	it('🔴 飞盘:时干就在中五宫 → 用神宫照实是中宫(不写「未找到」),翻宫写明不取;值符落中宫的写法不出 undefined', ()=>{
		expect(resolveYongShenGong('shigan', { tianPan: { 5: '己', 1: '甲' }, shiGan: '己', shiDun: '', ji: null })).toBe(5);
		expect(resolveYongShenGong('shigan', { tianPan: { 5: '己', 1: '甲' }, shiGan: '壬', shiDun: '', ji: null })).toBe(0);
		expect(qimenFanGong({ tianPan: { 5: '己' }, diPan: { 5: '己' }, ji: null, start: 5 })).toEqual({ start: 5, fuyin: false, up: [], down: [] });
		const rows = tuiYanRows({ view: 'fan', gongLabel: '时干落宫', start: 5, fan: { start: 5, fuyin: false, up: [], down: [] } });
		expect(rows.rows[0][1]).toBe('中宫（时干落宫）');
		expect(rows.rows[1]).toEqual(['翻宫', '用神宫在中五宫，翻宫只在外八宫之间取，此局不取']);
		let seen5 = 0;
		for(let d = 1; d <= 28; d++){ for(let h = 0; h < 24; h += 2){
			const pan = panAt({ school: '飞盘', tuiYanView: 'fan' }, `2026-03-${`${d}`.padStart(2, '0')}`, `${`${h}`.padStart(2, '0')}:30:00`);
			const text = buildDunJiaSnapshotText(pan);
			expect(text).not.toMatch(/undefined/);
			expect(text).not.toMatch(/用神宫 未找到/);
			if(pan.tuiYan.start === 5){ seen5 += 1; }
		} }
		expect(seen5).toBeGreaterThan(0);
	});
	it('混合盘星层取飞:不出「天禽随寄宫之星」的附注(禽在星层自有落宫)', ()=>{
		const pan = panAt({ school: '混合', mixXing: 'fei', showTianQin: true, showJiGan: true }, '2026-03-01', '02:30:00');
		expect(pan.cells.some((c)=>c.tianQin)).toBe(false);
		expect(jiGanRows(pan.jiGan).some(([k])=>k === '天禽')).toBe(false);
	});
	it('值使取法非缺省档进快照「盘型」;缺省不出这一行', ()=>{
		expect(buildDunJiaSnapshotText(panAt({}))).not.toMatch(/值使取法/);
		const t = buildDunJiaSnapshotText(panAt({ zhiShiType: 1 }));
		expect(t).toMatch(/\n值使取法：.+\n/);
		expect(buildDunJiaSnapshotText(panAt({ school: '飞盘', zhiShiType: 1 }))).not.toMatch(/值使取法/);
	});
});
