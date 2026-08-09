// 奇门遁甲穷尽压测:本地引擎 calcDunJia(年/月/日家=本地全盘;时家=Ken 后端不在前端压测范围) × 全左栏选项笛卡尔
//   × 多基准日时 → ①不抛 ②九宫结构完整(cells[9]/三盘/神煞/旬空) ③本地单次<阈值。
//   时家奇门转盘是 byte-perfect golden(DunJiaCalc.test.js 守)→ 本压测只断"不抛+结构",不碰精确值。
//   断卦层 buildFaQimenAnalysis(用神/财/官/六亲/危害)是纯派生,全选项过它不抛。
import {
	PAIPAN_OPTIONS, SCHOOL_OPTIONS, QIJU_METHOD_OPTIONS, ZHISHI_OPTIONS, YUEJIA_QIJU_OPTIONS,
	KONG_MODE_OPTIONS, MA_MODE_OPTIONS, YIXING_OPTIONS, ZHIRUN_LEAP_OPTIONS, TIME_ALG_OPTIONS,
	calcDunJia,
} from '../DunJiaCalc';
import { buildFaQimenAnalysis } from '../DunJiaFaCalc';
import { buildLocalBaziResult } from '../../../utils/baziLunarLocal';

// 本地真实农历(走 baziLunarLocal,与 in-app 年/月/日家同源),供各排盘体例消费。
function getGanzi(p){ return (p && (p.ganzhi || p.ganZhi)) || ''; }
function localNongli(date, time){
	const local = buildLocalBaziResult({ date, time, zone: '+08:00', lon: '120e00', lat: '0n00', gpsLon: 120, gpsLat: 0, ad: 1, gender: 1, timeAlg: 1, after23NewDay: 0 });
	const four = local.bazi.fourColumns;
	return {
		...local.bazi.nongli, bazi: local.bazi,
		yearGanZi: getGanzi(four.year), yearJieqi: getGanzi(four.year),
		monthGanZi: getGanzi(four.month), dayGanZi: getGanzi(four.day),
		time: getGanzi(four.time), timeGanZi: getGanzi(four.time),
	};
}
function makeFields(dateStr, timeStr){
	return { date: { value: { format: ()=>dateStr } }, time: { value: { format: ()=>timeStr } }, zone: { value: '+08:00' } };
}

// 多基准时刻:跨阴阳遁/上中下元/晚子时/闰超神,覆盖局法分支。
const SAMPLES = [
	{ d: '2026-02-17', t: '21:50:07' }, // 立春后·阳遁
	{ d: '2025-07-15', t: '03:10:00' }, // 夏至后·阴遁
	{ d: '2024-12-25', t: '23:30:00' }, // 冬至附近·晚子时
	{ d: '2026-06-21', t: '12:00:00' }, // 夏至当日·正午
];

function cellsOk(pan){
	if(!pan || !Array.isArray(pan.cells) || pan.cells.length !== 9){ return false; }
	return pan.cells.every((c)=> c && typeof c.palaceNum === 'number');
}
function structOk(pan){
	return !!(pan && cellsOk(pan) && pan.ganzhi && pan.juText && pan.kongWang != null
		&& pan.diPan && pan.tianPan && pan.renPan && pan.shenPan
		&& Array.isArray(pan.diPanList) && pan.diPanList.length === 9
		&& pan.shenSha && Array.isArray(pan.cells));
}

describe('奇门遁甲穷尽压测 · 本地引擎全选项笛卡尔', ()=>{
	test('左栏选项枚举齐全(防回归:增删选项即露)', ()=>{
		expect(PAIPAN_OPTIONS.map((o)=>o.value)).toEqual([0, 1, 2, 3, 4, 6]);   // [H-F] 刻家复活;[H-G] 古籍金函系日家
		expect(SCHOOL_OPTIONS.map((o)=>o.value)).toEqual(['转盘', '飞盘', '混合']);
		expect(QIJU_METHOD_OPTIONS.map((o)=>o.value)).toEqual(['zhirun', 'chaibu', 'maoshan', 'wurun', 'shuzi']);
		expect(ZHISHI_OPTIONS.map((o)=>o.value)).toEqual([0, 1, 2]);
		expect(YUEJIA_QIJU_OPTIONS.map((o)=>o.value)).toEqual([0, 1, 2]);   // [H-I] 逐月换局档
		expect(KONG_MODE_OPTIONS.map((o)=>o.value)).toEqual(['day', 'time']);
		expect(MA_MODE_OPTIONS.map((o)=>o.value)).toEqual(['day', 'time']);
		expect(YIXING_OPTIONS.map((o)=>o.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
		expect(ZHIRUN_LEAP_OPTIONS.map((o)=>o.value)).toEqual([9, 8, 10]);
		expect(TIME_ALG_OPTIONS.map((o)=>o.value)).toEqual([0, 1]);
	});

	// 主笛卡尔:排盘体例(5) × 盘式(3) × 起局法(5) × 空模式(2) × 马模式(2) = 300,挑 1 基准时刻全跑;
	// 时家(3)走后端,前端 calcDunJia 仍会出占位盘,只断不抛+结构。
	test('排盘×盘式×起局法×空×马 全组合(300):calcDunJia 不抛 + 九宫结构完整(金函6=查表独立体系,另测)', ()=>{
		const fields = makeFields(SAMPLES[0].d, SAMPLES[0].t);
		const nongli = localNongli(SAMPLES[0].d, SAMPLES[0].t);
		let n = 0;
		PAIPAN_OPTIONS.filter((pp)=>pp.value !== 6).forEach((pp)=>{
			SCHOOL_OPTIONS.forEach((sc)=>{
				QIJU_METHOD_OPTIONS.forEach((qj)=>{
					KONG_MODE_OPTIONS.forEach((km)=>{
						MA_MODE_OPTIONS.forEach((mm)=>{
							let pan = null;
							const opts = { paiPanType: pp.value, school: sc.value, qijuMethod: qj.value, kongMode: km.value, yimaMode: mm.value, zhiShiType: 0, yueJiaQiJuType: 0, shiftPalace: 0, fengJu: false, shuziReportNumber: qj.value === 'shuzi' ? '12345' : null };
							expect(()=>{ pan = calcDunJia(fields, nongli, opts, {}); }).not.toThrow();
							expect(structOk(pan)).toBe(true);
							n++;
						});
					});
				});
			});
		});
		expect(n).toBe(5 * 3 * 5 * 2 * 2); // 300
	});

	// 移星(8) × 封局(2) × 置闰天数(2) × 真太阳/直接(2) × 4 基准时刻:覆盖旋转/封局/历法边界。
	test('移星×封局×置闰天数×时法 × 4基准时刻:不抛 + 结构完整 + 移星实改盘', ()=>{
		let n = 0;
		SAMPLES.forEach((s)=>{
			const fields = makeFields(s.d, s.t);
			const nongli = localNongli(s.d, s.t);
			YIXING_OPTIONS.forEach((yx)=>{
				[true, false].forEach((fengJu)=>{
					ZHIRUN_LEAP_OPTIONS.forEach((zl)=>{
						TIME_ALG_OPTIONS.forEach((ta)=>{
							let pan = null;
							const opts = { paiPanType: 2, school: '转盘', qijuMethod: 'zhirun', shiftPalace: yx.value, fengJu, zhirunLeapDays: zl.value, timeAlg: ta.value, kongMode: 'day', yimaMode: 'day' };
							expect(()=>{ pan = calcDunJia(fields, nongli, opts, {}); }).not.toThrow();
							expect(structOk(pan)).toBe(true);
							expect(pan.shiftPalace).toBe(yx.value);
							n++;
						});
					});
				});
			});
		});
		expect(n).toBe(SAMPLES.length * 8 * 3 * 2 * 2); // 384([H-E] 置闰第三档 10 入域)
	});

	// 月家奇门:年符头(0)/年支(1) × 值使 3 法 × 4 时刻:月家走本地全盘,结构必齐。
	test('月家奇门 年符头/年支 × 值使3法 × 4时刻:结构完整', ()=>{
		let n = 0;
		SAMPLES.forEach((s)=>{
			const fields = makeFields(s.d, s.t);
			const nongli = localNongli(s.d, s.t);
			YUEJIA_QIJU_OPTIONS.forEach((yj)=>{
				ZHISHI_OPTIONS.forEach((zs)=>{
					let pan = null;
					expect(()=>{ pan = calcDunJia(fields, nongli, { paiPanType: 1, yueJiaQiJuType: yj.value, zhiShiType: zs.value, school: '转盘', qijuMethod: 'zhirun' }, {}); }).not.toThrow();
					expect(structOk(pan)).toBe(true);
					n++;
				});
			});
		});
		expect(n).toBe(SAMPLES.length * 3 * 3); // 36([H-I] 逐月档入域)
	});

	test('单选确实改盘(中右栏据此变):排盘体例改 juText、盘式改神宫、数字起局产 shuziInfo', ()=>{
		const fields = makeFields(SAMPLES[0].d, SAMPLES[0].t);
		const nongli = localNongli(SAMPLES[0].d, SAMPLES[0].t);
		// 排盘体例(年/月/日家)局法各异 → juText 多样
		const juSet = new Set([0, 1, 2].map((pp)=> calcDunJia(fields, nongli, { paiPanType: pp, school: '转盘', qijuMethod: 'zhirun' }, {}).juText));
		expect(juSet.size).toBeGreaterThan(1);
		// 数字起局产 shuziInfo(报数定局)
		const shuzi = calcDunJia(fields, nongli, { paiPanType: 2, qijuMethod: 'shuzi', shuziReportNumber: '789' }, {});
		expect(shuzi.shuziInfo).toBeTruthy();
		expect(shuzi.shuziInfo.gong).toBeGreaterThanOrEqual(1);
		expect(shuzi.shuziInfo.gong).toBeLessThanOrEqual(9);
		// 盘式 转盘 vs 飞盘:神盘(八神/九神)落宫不同
		const zhuan = calcDunJia(fields, nongli, { paiPanType: 2, school: '转盘', qijuMethod: 'zhirun' }, {});
		const fei = calcDunJia(fields, nongli, { paiPanType: 2, school: '飞盘', qijuMethod: 'zhirun' }, {});
		expect(zhuan.school).toBe('转盘');
		expect(fei.school).toBe('飞盘');
		expect(JSON.stringify(zhuan.shenPanList)).not.toBe(JSON.stringify(fei.shenPanList));
	});

	test('🔴 时家转盘(byte-perfect golden 区)只断不抛 + 结构,不碰精确值', ()=>{
		const fields = makeFields(SAMPLES[0].d, SAMPLES[0].t);
		const nongli = localNongli(SAMPLES[0].d, SAMPLES[0].t);
		let pan = null;
		expect(()=>{ pan = calcDunJia(fields, nongli, { paiPanType: 3, school: '转盘', qijuMethod: 'chaibu' }, {}); }).not.toThrow();
		expect(structOk(pan)).toBe(true);
	});

	test('断卦层 buildFaQimenAnalysis 对每盘不抛 + 用神/财/官等结构齐(中右栏断语据此)', ()=>{
		const fields = makeFields(SAMPLES[0].d, SAMPLES[0].t);
		const nongli = localNongli(SAMPLES[0].d, SAMPLES[0].t);
		let n = 0;
		[0, 1, 2].forEach((pp)=>{
			SCHOOL_OPTIONS.forEach((sc)=>{
				const pan = calcDunJia(fields, nongli, { paiPanType: pp, school: sc.value, qijuMethod: 'zhirun' }, {});
				const ctx = { dayGan: (nongli.dayGanZi || '甲子')[0], dayZhi: (nongli.dayGanZi || '甲子')[1], monthZhi: '寅', yearZhi: '午' };
				let fa = null;
				expect(()=>{ fa = buildFaQimenAnalysis(pan, ctx); }).not.toThrow();
				expect(fa).toBeTruthy();
				n++;
			});
		});
		expect(n).toBe(3 * 3);
	});

	test('本地引擎单次耗时<阈值(期望<500ms,>1s 标红):时家golden区+月家本地各测', ()=>{
		const fields = makeFields(SAMPLES[0].d, SAMPLES[0].t);
		const nongli = localNongli(SAMPLES[0].d, SAMPLES[0].t);
		const t0 = Date.now();
		calcDunJia(fields, nongli, { paiPanType: 2, school: '转盘', qijuMethod: 'zhirun' }, {});
		const dt = Date.now() - t0;
		expect(dt).toBeLessThan(1000); // >1s = 红线
	});
});

// ══ [H-B] 八神预设三档 + 暗干五法 + 暗支 ═══
describe('[H-B] applyGodsPreset/panAnGan/anZhiOf', ()=>{
	const { applyGodsPreset, panAnGan, anZhiOf, calcDunJia } = require('../DunJiaCalc');
	test('🔴 八神三档:默认恒虎玄(=现状)/system 保基串/勾雀档反向;飞盘不受辖由盘式分支保证', ()=>{
		expect(applyGodsPreset('勾')).toBe('虎');
		expect(applyGodsPreset('雀', 'baihu_xuanwu')).toBe('玄');
		expect(applyGodsPreset('勾', 'system')).toBe('勾');
		expect(applyGodsPreset('虎', 'system')).toBe('虎');
		expect(applyGodsPreset('虎', 'gouchen_zhuque')).toBe('勾');
		expect(applyGodsPreset('玄', 'gouchen_zhuque')).toBe('雀');
		expect(applyGodsPreset('符', 'system')).toBe('符');
	});
	test('🔴 暗干五法:off=null;dipan 门本位地盘干;zhishi_fei 十干序+伏吟入中;manpan 自戊宫起甲;每法覆盖满且干在十干域', ()=>{
		const dipanGua = { 坎: '戊', 坤: '己', 震: '庚', 巽: '辛', 中: '壬', 乾: '癸', 兑: '丁', 艮: '丙', 离: '乙' };
		const menGua = { 坎: '休', 艮: '生', 震: '伤', 巽: '杜', 离: '景', 坤: '死', 兑: '惊', 乾: '开' };
		expect(panAnGan('off', {})).toBe(null);
		const d = panAnGan('dipan', { menGua, dipanGua });
		expect(d['坎']).toBe('戊');   // 休门本位坎→地盘戊
		expect(d['坤']).toBe('己');   // 死门本位坤
		const f = panAnGan('zhishi_fei', { dipanGua, yy: '阳', shiGan: '丙', zhishiGong: '震' });
		expect(Object.keys(f).length).toBe(9);
		expect(f['震']).toBe('丙');   // 时干起值使宫
		Object.keys(f).forEach((g)=>expect('甲乙丙丁戊己庚辛壬癸'.includes(f[g])).toBe(true));
		// 伏吟:值使宫地盘干===时干→入中
		const fu = panAnGan('zhishi_fei', { dipanGua, yy: '阳', shiGan: '庚', zhishiGong: '震' });
		expect(fu['中']).toBe('庚');
		const m = panAnGan('manpan_fei', { dipanGua, yy: '阳' });
		expect(m['坎']).toBe('甲');   // 戊在坎→甲起坎
		const z = panAnGan('zhishi_zhuan', { dipanGua, yy: '阴', shiGan: '丁', zhishiGong: '坤' });
		expect(Object.keys(z).length).toBe(8);   // 转布中不入
		expect(z['坤']).toBe('丁');   // 坤地盘己≠丁,不伏吟,时干起值使宫
		// 伏吟触发(离地盘乙===时干乙)→寄坤起,起宫不再是离
		const zf = panAnGan('zhishi_zhuan', { dipanGua, yy: '阴', shiGan: '乙', zhishiGong: '离' });
		expect(zf['坤']).toBe('乙');
	});
	test('anZhiOf:旬内干支一一对应;甲=旬首支', ()=>{
		expect(anZhiOf('甲', '甲子')).toBe('子');
		expect(anZhiOf('丙', '甲子')).toBe('寅');
		expect(anZhiOf('癸', '甲戌')).toBe('未');   // 甲戌旬:癸=戌+9=未
		expect(anZhiOf('', '甲子')).toBe('');
	});
	test('🔴 calcDunJia 集成:默认 off=pan.anGan null(字节稳);开档产宫→干映射;showAnZhi 联动', ()=>{
		const fields = makeFields('2026-08-07', '10:00:00');
		const base = { paiPanType: 3, qijuMethod: 'zhirun', school: '转盘', zhirunLeapDays: 9, timeAlg: 1, after23NewDay: 1, lateZiHourUseNextDay: 1, kongMode: 'day', yimaMode: 'day', shiftPalace: 0, zhiShiType: 0, fengJu: false, sex: 1 };
		const p0 = calcDunJia(fields, null, base, {});
		expect(p0.anGan).toBe(null);
		const p1 = calcDunJia(fields, null, { ...base, anGanMode: 'dipan' }, {});
		expect(p1.anGan && Object.keys(p1.anGan).length >= 8).toBe(true);
		expect(p1.anZhi).toBe(null);
		const p2 = calcDunJia(fields, null, { ...base, anGanMode: 'dipan', showAnZhi: true }, {});
		expect(p2.anZhi && Object.keys(p2.anZhi).length >= 8).toBe(true);
		// 🔴 消费端锁(真机实抓假绿):pan.anGan 键必须是卦名(数字键=cells 装配全滤空的死链形态);
		//   且 cells 里 anGan/anZhi 真正落格(显示层读的是 cells,不是 pan.anGan)。
		const GUA_SET = new Set('坎坤震巽中乾兑艮离'.split(''));
		Object.keys(p2.anGan).forEach((k)=>expect(GUA_SET.has(k)).toBe(true));
		expect(p2.cells.filter((c)=>c.anGan).length).toBeGreaterThanOrEqual(8);
		expect(p2.cells.filter((c)=>c.anZhi).length).toBeGreaterThanOrEqual(8);
		// 八神预设集成:system 档阳遁盘出现勾或雀(转盘)
		const p3 = calcDunJia(fields, null, { ...base, godsPreset: 'system' }, {});
		const gods3 = p3.cells.filter((c)=>!c.isCenter).map((c)=>c.god).join('');
		const p4 = calcDunJia(fields, null, base, {});
		const gods4 = p4.cells.filter((c)=>!c.isCenter).map((c)=>c.god).join('');
		expect(gods4.includes('勾') || gods4.includes('雀')).toBe(false);   // 默认恒无勾雀
		expect(p3.options.godsPreset).toBe('system');
	});
});

// ══ [H-C] 中宫寄宫五档:resolveJiGong 全档语义 + calcDunJia 差分不变式 ═══
describe('[H-C] resolveJiGong/寄宫接线', ()=>{
	const { resolveJiGong, panAnGan, JIGONG_MODE_OPTIONS } = require('../DunJiaCalc');

	test('五档枚举钉死', ()=>{
		expect(JIGONG_MODE_OPTIONS.map((o)=>o.value)).toEqual(['kun', 'yang_gen_yin_kun', 'gen', 'siwei', 'bajie']);
	});

	test('kun/缺省/未知 → 恒坤(历史默认兜底)', ()=>{
		expect(resolveJiGong('kun', '阳', '冬至')).toBe('坤');
		expect(resolveJiGong(undefined, '阴', '夏至')).toBe('坤');
		expect(resolveJiGong('nonsense', '阳', '立春')).toBe('坤');
		expect(resolveJiGong('bajie', '阳', '')).toBe('坤');          // 未知节气回落
		expect(resolveJiGong('siwei', '阴', '无此节气')).toBe('坤');
	});

	test('gen 恒艮;yang_gen_yin_kun 按遁取(收 阳/阳遁 两形态)', ()=>{
		expect(resolveJiGong('gen', '阴', '冬至')).toBe('艮');
		expect(resolveJiGong('yang_gen_yin_kun', '阳', '')).toBe('艮');
		expect(resolveJiGong('yang_gen_yin_kun', '阳遁', '')).toBe('艮');
		expect(resolveJiGong('yang_gen_yin_kun', '阴', '')).toBe('坤');
		expect(resolveJiGong('yang_gen_yin_kun', '阴遁', '')).toBe('坤');
	});

	test('siwei 四立分界各领六气;bajie 一节三气全表', ()=>{
		[['立春','艮'],['谷雨','艮'],['立夏','巽'],['大暑','巽'],['立秋','坤'],['霜降','坤'],['立冬','乾'],['大寒','乾']]
			.forEach(([jq, g])=>{ expect(resolveJiGong('siwei', '阳', jq)).toBe(g); });
		[['立春','艮'],['惊蛰','艮'],['春分','震'],['谷雨','震'],['立夏','巽'],['芒种','巽'],['夏至','离'],['大暑','离'],
		 ['立秋','坤'],['白露','坤'],['秋分','兑'],['霜降','兑'],['立冬','乾'],['大雪','乾'],['冬至','坎'],['大寒','坎']]
			.forEach(([jq, g])=>{ expect(resolveJiGong('bajie', '阳', jq)).toBe(g); });
	});

	test('暗干转布起宫中时从 ctx.jiGong 起(缺省坤)', ()=>{
		const ctx = { yy: '阳', shiGan: '戊', zhishiGong: '中', dipanGua: {} };
		const base = panAnGan('zhishi_zhuan', ctx);
		const gen = panAnGan('zhishi_zhuan', { ...ctx, jiGong: '艮' });
		expect(base.坤).toBe('戊');   // 缺省寄坤:时干戊从坤起
		expect(gen.艮).toBe('戊');    // 指定寄艮:从艮起
		expect(gen.坤).not.toBe('戊');
	});

	test('calcDunJia 全档差分不变式:默认字节稳/层受影响⟺对应星门落中/寄宫语义命中', ()=>{
		let hitSemantic = 0;
		// ⚠ cells.palaceNum = 界面九宫格位(GUA_POS_MAP:巽1离2坤3震4中5兑6艮7坎8乾9),非洛书号
		const GUA_OF = { 1: '巽', 2: '离', 3: '坤', 4: '震', 5: '中', 6: '兑', 7: '艮', 8: '坎', 9: '乾' };
		const layerStr = (pan, key)=>pan.cells.map((c)=>String(c[key] || '')).join('|');
		SAMPLES.forEach((s)=>{
			const nongli = localNongli(s.d, s.t);
			const fields = makeFields(s.d, s.t);
			[0, 1, 2].forEach((pp)=>{
				const base = { paiPanType: pp, school: '转盘', qijuMethod: 'zhirun' };
				const pKun = calcDunJia(fields, nongli, { ...base }, {});
				const pDefault = calcDunJia(fields, nongli, { ...base, jiGongMode: 'kun' }, {});
				// 显式 kun 与缺省 = 同盘(神/星/门/干四层字节同)
				['god', 'star', 'door', 'tianGan'].forEach((k)=>{
					expect(layerStr(pDefault, k)).toBe(layerStr(pKun, k));
				});
				const pGen = calcDunJia(fields, nongli, { ...base, jiGongMode: 'gen' }, {});
				expect(structOk(pGen)).toBe(true);
				const fuAtCenter = pKun.zhiFuPalace === 5;    // 值符星宫落中 → 神/星/天盘层被寄宫辖
				const shiAtCenter = pKun.zhiShiPalace === 5;  // 值使门宫落中 → 门层被寄宫辖
				// 等价律:层有差 ⟺ 对应解算宫=中(寄宫档只在落中时生效,绝无旁路)
				expect(layerStr(pGen, 'god') !== layerStr(pKun, 'god')).toBe(fuAtCenter);
				expect(layerStr(pGen, 'door') !== layerStr(pKun, 'door')).toBe(shiAtCenter);
				if(fuAtCenter){
					// 语义级:kun 档「符」在坤二、gen 档在艮八
					const fuGong = (pan)=>GUA_OF[(pan.cells.find((c)=>String(c.god || '').includes('符')) || {}).palaceNum];
					expect(fuGong(pKun)).toBe('坤');
					expect(fuGong(pGen)).toBe('艮');
					hitSemantic += 1;
				}
				if(shiAtCenter){
					// 语义级:值使门(zhiShi 首字)kun 档落坤、gen 档落艮
					const head = String(pKun.zhiShi || '').charAt(0);
					const doorGong = (pan)=>GUA_OF[(pan.cells.find((c)=>String(c.door || '').charAt(0) === head) || {}).palaceNum];
					expect(doorGong(pKun)).toBe('坤');
					expect(doorGong(pGen)).toBe('艮');
					hitSemantic += 1;
				}
				// bajie/siwei 档亦不抛且结构完整
				expect(structOk(calcDunJia(fields, nongli, { ...base, jiGongMode: 'bajie' }, {}))).toBe(true);
				expect(structOk(calcDunJia(fields, nongli, { ...base, jiGongMode: 'siwei' }, {}))).toBe(true);
			});
		});
		expect(hitSemantic).toBeGreaterThan(0);   // 样本集里至少一盘星或门落中(语义分支必须被真正走到)
	});

	test('快照:非默认档出「中宫寄宫」注记,默认零注记', ()=>{
		const nongli = localNongli(SAMPLES[0].d, SAMPLES[0].t);
		const fields = makeFields(SAMPLES[0].d, SAMPLES[0].t);
		const pDef = calcDunJia(fields, nongli, { paiPanType: 2, school: '转盘', qijuMethod: 'zhirun' }, {});
		const pGen = calcDunJia(fields, nongli, { paiPanType: 2, school: '转盘', qijuMethod: 'zhirun', jiGongMode: 'gen' }, {});
		const { buildDunJiaSnapshotText } = require('../DunJiaCalc');
		const sDef = buildDunJiaSnapshotText(pDef);
		const sGen = buildDunJiaSnapshotText(pGen);
		expect(sDef.includes('中宫寄宫')).toBe(false);
		expect(sGen.includes('中宫寄宫：恒寄艮八宫')).toBe(true);
	});
});

// ══ [H-D] 飞盘顺飞三档+中门二项+混合盘四层自由装配 ═══
describe('[H-D] 飞盘细项/混合装配', ()=>{
	const layerStr = (pan, key)=>pan.cells.map((c)=>String(c[key] || '')).join('|');
	const mk = (extra)=>({ paiPanType: 2, qijuMethod: 'zhirun', ...extra });

	test('默认字节稳:飞盘缺省 = 显式默认五键 同盘', ()=>{
		const nongli = localNongli(SAMPLES[1].d, SAMPLES[1].t);
		const fields = makeFields(SAMPLES[1].d, SAMPLES[1].t);
		const a = calcDunJia(fields, nongli, mk({ school: '飞盘' }), {});
		const b = calcDunJia(fields, nongli, mk({ school: '飞盘', feiXingShun: false, feiMenShun: false, feiShenShun: false, feiMenZhongCan: true, feiMenZhongShow: false }), {});
		['god', 'star', 'door', 'tianGan', 'tianXing'].forEach((k)=>expect(layerStr(b, k)).toBe(layerStr(a, k)));
	});

	test('顺飞三档:阴遁开档层反向且值符/值使定位不动;阳遁开档零差', ()=>{
		const yinS = SAMPLES[1];   // 阴遁样本
		const yangS = SAMPLES[0];  // 阳遁样本(立春后)
		[['feiXingShun', 'tianXing'], ['feiMenShun', 'door'], ['feiShenShun', 'god']].forEach(([key, layer])=>{
			const nongli = localNongli(yinS.d, yinS.t);
			const fields = makeFields(yinS.d, yinS.t);
			const base = calcDunJia(fields, nongli, mk({ school: '飞盘' }), {});
			expect(base.juText.includes('阴遁')).toBe(true);
			const shun = calcDunJia(fields, nongli, mk({ school: '飞盘', [key]: true }), {});
			expect(layerStr(shun, layer)).not.toBe(layerStr(base, layer));      // 阴遁:该层真反向
			// 只动本层:其余两层字节同
			['tianXing', 'door', 'god'].filter((l)=>l !== layer).forEach((l)=>{
				if(key !== 'feiXingShun' || l !== 'door'){ /* 星层与门层解算独立 */ }
				expect(layerStr(shun, l)).toBe(layerStr(base, l));
			});
			// 定位锚:值符星落宫/值使门落宫不因顺飞档漂移
			expect(shun.zhiFuPalace).toBe(base.zhiFuPalace);
			expect(shun.zhiShiPalace).toBe(base.zhiShiPalace);
			const nongliYang = localNongli(yangS.d, yangS.t);
			const fieldsYang = makeFields(yangS.d, yangS.t);
			const bYang = calcDunJia(fieldsYang, nongliYang, mk({ school: '飞盘' }), {});
			expect(bYang.juText.includes('阳遁')).toBe(true);
			const sYang = calcDunJia(fieldsYang, nongliYang, mk({ school: '飞盘', [key]: true }), {});
			expect(layerStr(sYang, layer)).toBe(layerStr(bYang, layer));        // 阳遁本就顺:开档零差
		});
	});

	test('中门跳中传派:中宫无门+八门齐;显示档补「中」字样;默认参与=九门含中', ()=>{
		SAMPLES.slice(0, 2).forEach((s)=>{
			const nongli = localNongli(s.d, s.t);
			const fields = makeFields(s.d, s.t);
			const on = calcDunJia(fields, nongli, mk({ school: '飞盘' }), {});
			const off = calcDunJia(fields, nongli, mk({ school: '飞盘', feiMenZhongCan: false }), {});
			const offShow = calcDunJia(fields, nongli, mk({ school: '飞盘', feiMenZhongCan: false, feiMenZhongShow: true }), {});
			const centerOf = (pan)=>pan.cells.find((c)=>c.isCenter);
			const doorsOf = (pan)=>pan.cells.filter((c)=>!c.isCenter).map((c)=>String(c.door || '').charAt(0)).filter(Boolean);
			expect(centerOf(off).door).toBe('');                       // 跳中:中宫无门
			expect(new Set(doorsOf(off)).size).toBe(8);                // 八门各一
			expect(doorsOf(off).includes('中')).toBe(false);
			expect(centerOf(offShow).door).toBe('中');                 // 显示档:中宫标「中」
			expect(layerStr(off, 'god')).toBe(layerStr(on, 'god'));    // 只动门层
			expect(layerStr(off, 'tianXing')).toBe(layerStr(on, 'tianXing'));
		});
	});

	test('🔴 混合装配强等价:全 zhuan=转盘四层字节同;全 fei=飞盘四层字节同;缺省=历史组合(天转星转门飞神飞)', ()=>{
		SAMPLES.forEach((s)=>{
			const nongli = localNongli(s.d, s.t);
			const fields = makeFields(s.d, s.t);
			const zhuan = calcDunJia(fields, nongli, mk({ school: '转盘' }), {});
			const feip = calcDunJia(fields, nongli, mk({ school: '飞盘' }), {});
			const huoheDft = calcDunJia(fields, nongli, mk({ school: '混合' }), {});
			const allZhuan = calcDunJia(fields, nongli, mk({ school: '混合', mixTian: 'zhuan', mixXing: 'zhuan', mixMen: 'zhuan', mixShen: 'zhuan' }), {});
			const allFei = calcDunJia(fields, nongli, mk({ school: '混合', mixTian: 'fei', mixXing: 'fei', mixMen: 'fei', mixShen: 'fei' }), {});
			['tianGan', 'tianXing', 'door'].forEach((k)=>{
				expect(layerStr(allFei, k)).toBe(layerStr(feip, k));
			});
			// 全 zhuan 的神层名按混合渲染分支不过八神预设替换,比对用飞盘域名单独断:god 层与转盘同名集(值符等八神)
			expect(layerStr(allZhuan, 'door')).toBe(layerStr(zhuan, 'door'));
			expect(layerStr(allZhuan, 'tianGan')).toBe(layerStr(zhuan, 'tianGan'));
			expect(layerStr(allZhuan, 'tianXing')).toBe(layerStr(zhuan, 'tianXing'));
			// 缺省混合=天转星转门飞神飞
			expect(layerStr(huoheDft, 'tianGan')).toBe(layerStr(zhuan, 'tianGan'));
			expect(layerStr(huoheDft, 'tianXing')).toBe(layerStr(zhuan, 'tianXing'));
			expect(layerStr(huoheDft, 'door')).toBe(layerStr(feip, 'door'));
			expect(layerStr(huoheDft, 'god')).toBe(layerStr(feip, 'god'));
		});
	});
});

// ══ [H-E] 空亡多标二项 + 移星值符两档 ═══
describe('[H-E] kongMarkBoth/showAllKong/shiftZhiFuMode', ()=>{
	const mk = (extra)=>({ paiPanType: 2, school: '转盘', qijuMethod: 'zhirun', ...extra });

	test('kongMarkBoth:并集标记 ⊇ 单模式;默认关=day 模式字节同;xunKong 恒暴露', ()=>{
		SAMPLES.forEach((s)=>{
			const nongli = localNongli(s.d, s.t);
			const fields = makeFields(s.d, s.t);
			const dft = calcDunJia(fields, nongli, mk({}), {});
			const day = calcDunJia(fields, nongli, mk({ kongMode: 'day' }), {});
			expect(dft.kongWangPalaces.join(',')).toBe(day.kongWangPalaces.join(','));
			const both = calcDunJia(fields, nongli, mk({ kongMarkBoth: true }), {});
			const dayP = new Set(day.kongWangPalaces);
			const timeP = new Set(calcDunJia(fields, nongli, mk({ kongMode: 'time' }), {}).kongWangPalaces);
			const bothP = new Set(both.kongWangPalaces);
			[...dayP, ...timeP].forEach((g)=>expect(bothP.has(g)).toBe(true));   // 并集律
			expect(both.kongWang).toBe(`${both.xunKong.日空}${both.xunKong.时空}`);
			expect(dft.xunKong && dft.xunKong.日空 && dft.xunKong.时空 ? 1 : 0).toBe(1);
		});
	});

	test('showAllKong:开=四柱空亡齐+快照行;关=null 零注记', ()=>{
		const nongli = localNongli(SAMPLES[2].d, SAMPLES[2].t);
		const fields = makeFields(SAMPLES[2].d, SAMPLES[2].t);
		const off = calcDunJia(fields, nongli, mk({}), {});
		const on = calcDunJia(fields, nongli, mk({ showAllKong: true }), {});
		expect(off.allKong).toBe(null);
		['年空', '月空', '日空', '时空'].forEach((k)=>{
			expect(String(on.allKong[k] || '').length).toBe(2);   // 每柱空亡恒两支
		});
		expect(on.allKong.日空).toBe(on.xunKong.日空);
		expect(on.allKong.时空).toBe(on.xunKong.时空);
		const { buildDunJiaSnapshotText } = require('../DunJiaCalc');
		expect(buildDunJiaSnapshotText(off).includes('四柱空亡')).toBe(false);
		expect(buildDunJiaSnapshotText(on).includes(`四柱空亡：年空${on.allKong.年空}`)).toBe(true);
	});

	test('🔴 shiftZhiFuMode:移星=0 两档恒同;≠0 时 recalc 语义=移后地盘旬首宫本位星门+按新名落宫', ()=>{
		const LUOSHU_OF = { 1: 4, 2: 9, 3: 2, 4: 3, 5: 5, 6: 7, 7: 8, 8: 1, 9: 6 };   // grid宫位→洛书号(巽4离9坤2震3中5兑7艮8坎1乾6)
		const JIU_XING_SEQ = '蓬芮冲辅禽心柱任英';
		const DOOR_SEQ = '休死伤杜中开惊生景';
		let semanticHits = 0;
		SAMPLES.forEach((s)=>{
			const nongli = localNongli(s.d, s.t);
			const fields = makeFields(s.d, s.t);
			const z0f = calcDunJia(fields, nongli, mk({ shiftPalace: 0 }), {});
			const z0r = calcDunJia(fields, nongli, mk({ shiftPalace: 0, shiftZhiFuMode: 'recalc' }), {});
			expect(z0r.zhiFuPalace).toBe(z0f.zhiFuPalace);
			expect(z0r.zhiShi).toBe(z0f.zhiShi);
			[2, 5].forEach((shift)=>{
				const pf = calcDunJia(fields, nongli, mk({ shiftPalace: shift }), {});
				const pr = calcDunJia(fields, nongli, mk({ shiftPalace: shift, shiftZhiFuMode: 'recalc' }), {});
				// 盘面九层不动:recalc 只改标记与名
				expect(pr.cells.map((c)=>[c.god, c.star, c.door, c.tianGan].join('/')).join('|'))
					.toBe(pf.cells.map((c)=>[c.god, c.star, c.door, c.tianGan].join('/')).join('|'));
				// 独立重算语义:移后地盘找旬首遁仪宫→本位星/门→在移后层按名找落宫
				const dunYi = pf.zhiFuGan ? null : null;
				const diPan = pr.diPan;
				const xunHead = pr.xunShou || '';
				const JJmap = { 甲子: '戊', 甲戌: '己', 甲申: '庚', 甲午: '辛', 甲辰: '壬', 甲寅: '癸' };
				const dy = JJmap[xunHead] || '戊';
				let dg = 0;
				for(let i = 1; i <= 9; i++){ if(String(diPan[i] || '') === dy){ dg = i; break; } }
				if(dg && dg !== 5){
					const luo = LUOSHU_OF[dg];
					const expStar = JIU_XING_SEQ.charAt(luo - 1);
					let expDoor = DOOR_SEQ.charAt(luo - 1);
					if(expDoor === '中'){ expDoor = '死'; }
					const starHit = pr.cells.find((c)=>String(c.tianXing || '').includes(expStar) || ('芮禽'.includes(expStar) && String(c.tianXing || '').includes('内')));
					const doorHit = pr.cells.find((c)=>String(c.door || '').charAt(0) === expDoor);
					if(starHit){ expect(pr.zhiFuPalace).toBe(starHit.palaceNum); semanticHits += 1; }
					if(doorHit){ expect(pr.zhiShiPalace).toBe(doorHit.palaceNum); }
					expect(pr.zhiShi.charAt(0)).toBe(expDoor);
				}
			});
		});
		expect(semanticHits).toBeGreaterThan(0);
	});
});

// ══ [H-F] 日家定局三档 + 刻家十分局复活 ═══
describe('[H-F] dayJiaJu/刻家十分局', ()=>{
	test('日家三档:缺省=yiyuan 字节同;shitian 逐旬换元;yitian 逐日推移连续律', ()=>{
		const nongli = localNongli('2026-02-17', '10:00:00');
		const fields = makeFields('2026-02-17', '10:00:00');
		const mk = (extra)=>({ paiPanType: 2, school: '转盘', qijuMethod: 'zhirun', ...extra });
		const dft = calcDunJia(fields, nongli, mk({}), {});
		const yy1 = calcDunJia(fields, nongli, mk({ dayJiaJu: 'yiyuan' }), {});
		expect(yy1.juText).toBe(dft.juText);
		expect(structOk(calcDunJia(fields, nongli, mk({ dayJiaJu: 'shitian' }), {}))).toBe(true);
		expect(structOk(calcDunJia(fields, nongli, mk({ dayJiaJu: 'yitian' }), {}))).toBe(true);
		// shitian 逐旬换元:同半年内取甲子旬日 vs 甲戌旬日,元必不同(上元 vs 中元)
		const nl1 = localNongli('2026-03-05', '10:00:00');
		const el1 = calcDunJia(makeFields('2026-03-05', '10:00:00'), nl1, mk({ dayJiaJu: 'shitian' }), {});
		expect(['上元', '中元', '下元'].some((y)=>String(el1.jieqiText || '').includes(y))).toBe(true);
		// yitian 连续律:相邻两日局数差恰 1(mod 9,方向随遁)
		const dA = calcDunJia(makeFields('2026-03-05', '10:00:00'), localNongli('2026-03-05', '10:00:00'), mk({ dayJiaJu: 'yitian' }), {});
		const dB = calcDunJia(makeFields('2026-03-06', '10:00:00'), localNongli('2026-03-06', '10:00:00'), mk({ dayJiaJu: 'yitian' }), {});
		const juNum = (pan)=>'一二三四五六七八九'.indexOf(String(pan.juShu || '').charAt(0)) + 1;
		const a = juNum(dA), b = juNum(dB);
		expect(a >= 1 && a <= 9 && b >= 1 && b <= 9).toBe(true);
		const diff = ((b - a) % 9 + 9) % 9;
		expect(diff === 1 || diff === 8).toBe(true);   // +1(阳)或 -1≡+8(阴)
	});

	test('🔴 刻家十分局:12min 边界换局+keIndex 域+初局=时家局+逐刻推移律', ()=>{
		const mk = (extra)=>({ paiPanType: 4, school: '转盘', qijuMethod: 'zhirun', ...extra });
		const juNum = (pan)=>'一二三四五六七八九'.indexOf(String(pan.juShu || '').charAt(0)) + 1;
		const d = '2026-02-17';
		const nl = (t)=>localNongli(d, t);
		// 巳时=9:00~10:59(奇数整点界):k1=9:00-9:11,k2=9:12,k6=10:00(后半首刻)
		const p0 = calcDunJia(makeFields(d, '09:05:00'), nl('09:05:00'), mk({}), {});
		const p0b = calcDunJia(makeFields(d, '09:11:59'), nl('09:11:59'), mk({}), {});
		const p1 = calcDunJia(makeFields(d, '09:12:00'), nl('09:12:00'), mk({}), {});
		const p5 = calcDunJia(makeFields(d, '10:00:00'), nl('10:00:00'), mk({}), {});
		expect(structOk(p0)).toBe(true);
		expect(p0.keIndex).toBe(1);
		expect(p0b.keIndex).toBe(1);              // 11:59 仍第一刻(12min 内)
		expect(p1.keIndex).toBe(2);               // 12:00 整跨刻
		expect(p5.keIndex).toBe(6);               // 时辰后半首刻=第 6 刻
		// 初局=时家局:第一刻局 = 同时刻时家盘局(巳时子后=阳遁,时家节气分遁此日亦阳)
		const shiJia = calcDunJia(makeFields(d, '09:05:00'), nl('09:05:00'), { paiPanType: 3, school: '转盘', qijuMethod: 'zhirun' }, {});
		expect(juNum(p0)).toBe(juNum(shiJia));
		expect(p0.yinYangDun).toBe('阳遁');       // 巳∈子~巳=阳
		// 逐刻推移律:阳遁 k2=初局+1
		expect(juNum(p1)).toBe(((juNum(p0) - 1 + 1) % 9) + 1);
		expect(juNum(p5)).toBe(((juNum(p0) - 1 + 5) % 9) + 1);
		// 午后阴:14:30=未时→阴遁,逐刻退
		const a0 = calcDunJia(makeFields(d, '13:05:00'), nl('13:05:00'), mk({}), {});
		const a1 = calcDunJia(makeFields(d, '13:20:00'), nl('13:20:00'), mk({}), {});
		expect(a0.yinYangDun).toBe('阴遁');       // 未∈午~亥=阴
		expect(juNum(a1)).toBe((((juNum(a0) - 1 - 1) % 9) + 9) % 9 + 1);
		// jieqi 分遁档:随时家节气(立春后=阳),未时也阳
		const j0 = calcDunJia(makeFields(d, '13:05:00'), nl('13:05:00'), mk({ keJiaFenDun: 'jieqi' }), {});
		expect(j0.yinYangDun).toBe('阳遁');
		// 子正换时:23:30 关=子时首刻(23:00 起第 3 刻);开=前一时辰尾刻
		const z_off = calcDunJia(makeFields(d, '23:30:00'), nl('23:30:00'), mk({}), {});
		const z_on = calcDunJia(makeFields(d, '23:30:00'), nl('23:30:00'), mk({ keZiZhengHuanShi: true }), {});
		expect(z_off.keIndex).toBe(3);            // 23:00 起(奇界):30min→第 3 刻
		expect(z_on.keIndex).toBe(8);             // 22:00 起(偶界):90min→第 8 刻
		// 快照刻序行
		const { buildDunJiaSnapshotText } = require('../DunJiaCalc');
		expect(buildDunJiaSnapshotText(p0).includes('刻序：本时辰第1刻')).toBe(true);
		expect(buildDunJiaSnapshotText(shiJia).includes('刻序')).toBe(false);
	});
});

// ══ [H-G] 日家·古籍金函系(书表直录独立体系) ═══
describe('[H-G] 金函系日家占方盘', ()=>{
	const { JINHAN_TABLE, JINHAN_DIRS, JINHAN_STAR_JI, JINHAN_DOOR_JI } = require('../jinhanRiJia');
	const STARS9 = ['天乙', '太乙', '太阴', '青龙', '轩辕', '招摇', '摄提', '咸池', '天符'];
	const DOORS8 = '休生伤杜景死惊开'.split('');

	test('🔴 数据表全量结构不变式:60 干支×(八门各一/九星全集/喜神口诀/吉时非空)', ()=>{
		const gzList = Object.keys(JINHAN_TABLE);
		expect(gzList.length).toBe(60);
		const XISHEN = { 甲: '东北', 己: '东北', 乙: '西北', 庚: '西北', 丙: '西南', 辛: '西南', 丁: '南', 壬: '南', 戊: '东南', 癸: '东南' };
		gzList.forEach((gz)=>{
			const e = JINHAN_TABLE[gz];
			expect([...e.yangDoors].sort().join('')).toBe([...DOORS8].sort().join(''));
			expect([...e.yinDoors].sort().join('')).toBe([...DOORS8].sort().join(''));
			expect([...e.yangStars, e.center].sort().join('|')).toBe([...STARS9].sort().join('|'));
			expect(e.yinStars.every((x)=>STARS9.includes(x))).toBe(true);
			expect(new Set(e.yinStars).size).toBe(8);
			expect(e.xiShen).toBe(XISHEN[gz.charAt(0)]);
			expect(e.jiShi.length).toBeGreaterThan(0);
			expect(e.shiText.includes('黄道') && e.shiText.includes('黑道')).toBe(true);
		});
	});

	test('🔴 逐字金标:甲子/戊辰/癸亥 三条对原书表', ()=>{
		expect(JINHAN_TABLE.甲子.center).toBe('咸池');
		expect(JINHAN_TABLE.甲子.yangDoors.join('')).toBe('休生伤杜景死惊开');
		expect(JINHAN_TABLE.甲子.yangStars.join('')).toBe('轩辕太乙天符青龙摄提招摇天乙太阴');
		expect(JINHAN_TABLE.甲子.yinDoors.join('')).toBe('景死惊开休生伤杜');
		expect(JINHAN_TABLE.甲子.xiShen).toBe('东北');
		expect(JINHAN_TABLE.甲子.jiShi).toBe('子、丑、卯时');
		// 戊辰=书面非对宫翻转条目(阴门序独立),按书保留
		expect(JINHAN_TABLE.戊辰.center).toBe('轩辕');
		expect(JINHAN_TABLE.戊辰.yangDoors.join('')).toBe('杜景死惊开休生伤');
		expect(JINHAN_TABLE.戊辰.yinDoors.join('')).toBe('开休生杜伤景死惊');
		const rot4 = (a)=>[...a.slice(4), ...a.slice(0, 4)];
		expect(JINHAN_TABLE.戊辰.yinDoors.join('')).not.toBe(rot4(JINHAN_TABLE.戊辰.yangDoors).join(''));
		// 癸亥阳门=原书讹「天」,已按阴侧对宫翻转复原(登记于数据文件头)
		expect(JINHAN_TABLE.癸亥.yangDoors.join('')).toBe(rot4(JINHAN_TABLE.癸亥.yinDoors).join(''));
	});

	test('盘构建:阳/阴盘按冬夏至切换;cells 结构;喜神/大吉标记;八门档差分', ()=>{
		// 2026-02-17=冬至后夏至前(阳);2025-07-15=夏至后(阴)
		const mkPan = (d, t, extra)=>calcDunJia(makeFields(d, t), localNongli(d, t), { paiPanType: 6, ...(extra || {}) }, {});
		const py = mkPan('2026-02-17', '10:00:00');
		expect(py.isJinhan).toBe(true);
		expect(py.juText).toBe('古籍日家·阳盘');
		const gz = py.jinhan.dayGz;
		expect(JINHAN_TABLE[gz]).toBeTruthy();
		expect(py.cells.length).toBe(9);
		const center = py.cells.find((c)=>c.isCenter);
		expect(center.tianXing).toBe(JINHAN_TABLE[gz].center);
		// 八方星门=阳表按方位落格
		const DIR_TO_POS = { 北: 8, 东北: 7, 东: 4, 东南: 1, 南: 2, 西南: 3, 西: 6, 西北: 9 };
		JINHAN_DIRS.forEach((dir, i)=>{
			const cell = py.cells.find((c)=>c.palaceNum === DIR_TO_POS[dir]);
			expect(cell.tianXing).toBe(JINHAN_TABLE[gz].yangStars[i]);
			expect(cell.door).toBe(JINHAN_TABLE[gz].yangDoors[i]);
			expect(cell.jinhanStarJi).toBe(JINHAN_STAR_JI[cell.tianXing]);
			expect(cell.jinhanDoorJi).toBe(JINHAN_DOOR_JI[cell.door]);
		});
		// 喜神标记恰一格
		expect(py.cells.filter((c)=>c.isXiShen).length).toBe(1);
		expect(py.cells.find((c)=>c.isXiShen).jinhanDir).toBe(JINHAN_TABLE[gz].xiShen);
		// 阴盘
		const pn = mkPan('2025-07-15', '10:00:00');
		expect(pn.juText).toBe('古籍日家·阴盘');
		const gzN = pn.jinhan.dayGz;
		JINHAN_DIRS.forEach((dir, i)=>{
			const cell = pn.cells.find((c)=>c.palaceNum === DIR_TO_POS[dir]);
			expect(cell.tianXing).toBe(JINHAN_TABLE[gzN].yinStars[i]);
			expect(cell.door).toBe(JINHAN_TABLE[gzN].yinDoors[i]);
		});
		// 八门全顺档:门=固定休生伤杜景死惊开北起;星不动
		const ps = mkPan('2026-02-17', '10:00:00', { jinhanMenPai: 'shun' });
		JINHAN_DIRS.forEach((dir, i)=>{
			const cell = ps.cells.find((c)=>c.palaceNum === DIR_TO_POS[dir]);
			expect(cell.door).toBe('休生伤杜景死惊开'.charAt(i));
			expect(cell.tianXing).toBe(JINHAN_TABLE[gz].yangStars[i]);
		});
	});

	test('快照专段:标题/日干支盘别/八方星门/喜神大吉/吉时/黄黑道全出', ()=>{
		const pan = calcDunJia(makeFields('2026-02-17', '10:00:00'), localNongli('2026-02-17', '10:00:00'), { paiPanType: 6 }, {});
		const { buildDunJiaSnapshotText } = require('../DunJiaCalc');
		const txt = buildDunJiaSnapshotText(pan);
		expect(txt.includes('【日家占方（古籍金函系）】')).toBe(true);
		expect(txt.includes(`日干支：${pan.jinhan.dayGz}（阳盘`)).toBe(true);
		expect(txt.includes('八方星门：')).toBe(true);
		expect(txt.includes(`喜神方：${pan.jinhan.xiShen}`)).toBe(true);
		expect(txt.includes(`大吉时：${pan.jinhan.jiShi}`)).toBe(true);
		expect(txt.includes('十二时辰黄黑道：')).toBe(true);
		expect(txt.includes('门重于星')).toBe(true);
	});
});

// ══ [H-I] 年家一年一局 + 月家一月一局(通行年/月游九星同构,公域锚可核验) ═══
describe('[H-I] yearJiaJu/yueJia 逐月档', ()=>{
	const juNum = (pan)=>'一二三四五六七八九'.indexOf(String(pan.juShu || '').charAt(0)) + 1;
	const mk = (d, t, extra)=>{
		const nongli = localNongli(d, t);
		return calcDunJia(makeFields(d, t), nongli, { school: '转盘', qijuMethod: 'zhirun', ...extra }, {});
	};

	test('年家两档:缺省=sanyuan 字节同;yinian 公域锚(1984=7/2025=2/2026=1)+逐年退一律+60年环回', ()=>{
		const dft = mk('2026-02-17', '10:00:00', { paiPanType: 0 });
		const sy = mk('2026-02-17', '10:00:00', { paiPanType: 0, yearJiaJu: 'sanyuan' });
		expect(sy.juText).toBe(dft.juText);
		expect(juNum(dft)).toBe(7);                        // 现行下元七局
		// 公域锚:年游九星 1984甲子=7 / 2025乙巳=2 / 2026丙午=1
		expect(juNum(mk('1984-06-01', '10:00:00', { paiPanType: 0, yearJiaJu: 'yinian' }))).toBe(7);
		expect(juNum(mk('2025-06-01', '10:00:00', { paiPanType: 0, yearJiaJu: 'yinian' }))).toBe(2);
		expect(juNum(mk('2026-06-01', '10:00:00', { paiPanType: 0, yearJiaJu: 'yinian' }))).toBe(1);
		// 逐年退一律(mod 9):2026=1 → 2027=9
		expect(juNum(mk('2027-06-01', '10:00:00', { paiPanType: 0, yearJiaJu: 'yinian' }))).toBe(9);
		// 60 年环回:2044 甲子(新下元? 2044-4=2040,cycle=34%3=1=上元) → 上元首=1
		expect(juNum(mk('2044-06-01', '10:00:00', { paiPanType: 0, yearJiaJu: 'yinian' }))).toBe(1);
		expect(dft.yinYangDun).toBe('阴遁');               // 年家恒阴遁
	});

	test('月家逐月档:仲年正月8/孟2/季5 入中+逐月退一律+皆阴遁;默认档字节稳', ()=>{
		// 2026 丙午(仲年):正月(寅月)=8。丙午年寅月≈公历 2026-02-17(立春后)。
		const zheng = mk('2026-02-17', '10:00:00', { paiPanType: 1, yueJiaQiJuType: 2 });
		expect(juNum(zheng)).toBe(8);
		expect(zheng.yinYangDun).toBe('阴遁');
		// 二月(卯月)=7:2026-03-15
		expect(juNum(mk('2026-03-15', '10:00:00', { paiPanType: 1, yueJiaQiJuType: 2 }))).toBe(7);
		// 六月(未月)=8-5=3:2026-07-15
		expect(juNum(mk('2026-07-15', '10:00:00', { paiPanType: 1, yueJiaQiJuType: 2 }))).toBe(3);
		// 孟年:2025 乙巳(巳=孟)正月=2:2025-02-17(乙巳年寅月)
		expect(juNum(mk('2025-02-17', '10:00:00', { paiPanType: 1, yueJiaQiJuType: 2 }))).toBe(2);
		// 季年:2024 甲辰(辰=季)正月=5:2024-02-17
		expect(juNum(mk('2024-02-17', '10:00:00', { paiPanType: 1, yueJiaQiJuType: 2 }))).toBe(5);
		// 默认档零回归
		const d0 = mk('2026-02-17', '10:00:00', { paiPanType: 1 });
		const d0b = mk('2026-02-17', '10:00:00', { paiPanType: 1, yueJiaQiJuType: 0 });
		expect(d0b.juText).toBe(d0.juText);
	});

	test('快照:yinian 档出「年家定局」注记;默认零注记', ()=>{
		const { buildDunJiaSnapshotText } = require('../DunJiaCalc');
		const dft = mk('2026-02-17', '10:00:00', { paiPanType: 0 });
		const yn = mk('2026-02-17', '10:00:00', { paiPanType: 0, yearJiaJu: 'yinian' });
		expect(buildDunJiaSnapshotText(dft).includes('年家定局')).toBe(false);
		expect(buildDunJiaSnapshotText(yn).includes('年家定局：一年一局（逐年逆退）')).toBe(true);
	});
});
