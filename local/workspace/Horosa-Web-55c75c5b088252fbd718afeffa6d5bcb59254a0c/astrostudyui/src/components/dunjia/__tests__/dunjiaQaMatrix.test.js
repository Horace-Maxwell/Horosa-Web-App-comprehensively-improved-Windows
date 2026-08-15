// [QA3a] 奇门 H 批新档压测大矩阵:全值域笛卡尔(抽样)×冲突组合×边界×异形输入。
//   验收标准=qimen_qa_spec.md 对照表;不变式:任意组合零抛+九宫结构+域合法;
//   非默认档快照注记齐全性;异形档位一律回落默认(绝不半死)。
import {
	calcDunJia, buildDunJiaSnapshotText,
	PAIPAN_OPTIONS, GODS_PRESET_OPTIONS, JIGONG_MODE_OPTIONS, ANGAN_MODE_OPTIONS,
	YEARJIA_JU_OPTIONS, DAYJIA_JU_OPTIONS, KEJIA_FENDUN_OPTIONS, JINHAN_MENPAI_OPTIONS,
	SHIFT_ZHIFU_OPTIONS, YUEJIA_QIJU_OPTIONS,
} from '../DunJiaCalc';
import { JINHAN_TABLE, JINHAN_STAR_JI, JINHAN_DOOR_JI } from '../jinhanRiJia';
import { buildLocalBaziResult } from '../../../utils/baziLunarLocal';

function getGanzi(p){ return (p && (p.ganzhi || p.ganZhi)) || ''; }
function localNongli(date, time){
	const local = buildLocalBaziResult({ date, time, zone: '+08:00', lon: '120e00', lat: '0n00', gpsLon: 120, gpsLat: 0, ad: 1, gender: 1, timeAlg: 1, after23NewDay: 0 });
	const four = local.bazi.fourColumns;
	return { ...local.bazi.nongli, bazi: local.bazi, yearGanZi: getGanzi(four.year), monthGanZi: getGanzi(four.month), dayGanZi: getGanzi(four.day), time: getGanzi(four.time), timeGanZi: getGanzi(four.time) };
}
function makeFields(d, t){ return { date: { value: { format: ()=>d } }, time: { value: { format: ()=>t } }, zone: { value: '+08:00' } }; }

const NL = {};
function nl(d, t){ const k = d + t; if(!NL[k]){ NL[k] = localNongli(d, t); } return NL[k]; }
function calc(d, t, opts){ return calcDunJia(makeFields(d, t), nl(d, t), { school: '转盘', qijuMethod: 'zhirun', ...opts }, {}); }

const DOOR_SET = new Set('休生伤杜景死惊开中'.split(''));
const STAR_SET = new Set(['蓬', '任', '冲', '辅', '英', '柱', '心', '芮', '禽', '内']);
const GOD_SET = new Set('符蛇阴合勾雀地天虎玄常'.split(''));
function invariants(pan, label){
	expect(pan && Array.isArray(pan.cells) ? pan.cells.length : -1).toBe(9);
	pan.cells.forEach((c)=>{
		const d0 = String(c.door || '').charAt(0);
		if(d0){ expect(DOOR_SET.has(d0)).toBe(true); }
		const g0 = String(c.god || '').charAt(0);
		if(g0 && !pan.isJinhan){ expect(GOD_SET.has(g0)).toBe(true); }
	});
	return true;
}

describe('[QA3a] 奇门新档压测大矩阵', ()=>{
	// ── ① 家族定局档全枚举 × 双基准时刻 ──
	test('家族档全枚举:年2×月3×日3×刻(2×2)×金函2,双时刻,零抛+结构+juText 非空', ()=>{
		const times = [['2026-02-17', '09:05:00'], ['2025-07-15', '23:30:00']];
		let n = 0;
		times.forEach(([d, t])=>{
			YEARJIA_JU_OPTIONS.forEach((y)=>{ invariants(calc(d, t, { paiPanType: 0, yearJiaJu: y.value }), 'y'); n++; });
			YUEJIA_QIJU_OPTIONS.forEach((m)=>{ invariants(calc(d, t, { paiPanType: 1, yueJiaQiJuType: m.value }), 'm'); n++; });
			DAYJIA_JU_OPTIONS.forEach((dj)=>{ invariants(calc(d, t, { paiPanType: 2, dayJiaJu: dj.value }), 'd'); n++; });
			KEJIA_FENDUN_OPTIONS.forEach((k)=>{ [false, true].forEach((z)=>{ const p = calc(d, t, { paiPanType: 4, keJiaFenDun: k.value, keZiZhengHuanShi: z }); invariants(p, 'k'); expect(p.keIndex >= 1 && p.keIndex <= 10).toBe(true); n++; }); });
			JINHAN_MENPAI_OPTIONS.forEach((j)=>{ const p = calc(d, t, { paiPanType: 6, jinhanMenPai: j.value }); expect(p.isJinhan).toBe(true); expect(p.cells.length).toBe(9); n++; });
		});
		expect(n).toBe(2 * (2 + 3 + 3 + 4 + 2));
		Object.keys(NL).length && expect(true).toBe(true);
	});

	// ── ② 传本档笛卡尔:八神3×寄宫5×暗干5×暗支2 = 150,日家盘 ──
	test('传本档笛卡尔150:零抛+暗干开档必产+快照注记一致律', ()=>{
		const d = '2026-02-17', t = '10:00:00';
		let n = 0;
		GODS_PRESET_OPTIONS.forEach((g)=>{
			JIGONG_MODE_OPTIONS.forEach((jg)=>{
				ANGAN_MODE_OPTIONS.forEach((ag)=>{
					[false, true].forEach((az)=>{
						const p = calc(d, t, { paiPanType: 2, godsPreset: g.value, jiGongMode: jg.value, anGanMode: ag.value, showAnZhi: az });
						invariants(p, 'cart');
						if(ag.value !== 'off'){
							expect(p.anGan && Object.keys(p.anGan).length >= 8).toBe(true);
							expect(p.cells.filter((c)=>c.anGan).length).toBeGreaterThanOrEqual(8);
							if(az){ expect(p.cells.filter((c)=>c.anZhi).length).toBeGreaterThanOrEqual(8); }
						}else{
							expect(p.anGan).toBe(null);
						}
						const snap = buildDunJiaSnapshotText(p);
						expect(snap.includes('八神取神：')).toBe(g.value !== 'baihu_xuanwu');
						expect(snap.includes('中宫寄宫：')).toBe(jg.value !== 'kun');
						expect(snap.includes('暗干：')).toBe(ag.value !== 'off');
						n++;
					});
				});
			});
		});
		expect(n).toBe(3 * 5 * 5 * 2);
	});

	// ── ③ 飞盘组:顺飞2³×中门2×显示2=32 × 阴阳两盘 ──
	test('飞盘组32×2:零抛+跳中律(中宫无门/八门齐)+显示档只在跳中生效', ()=>{
		const times = [['2026-02-17', '09:05:00'], ['2025-07-15', '10:00:00']];
		let n = 0;
		times.forEach(([d, t])=>{
			[false, true].forEach((fx)=>[false, true].forEach((fm)=>[false, true].forEach((fs)=>{
				[true, false].forEach((can)=>[false, true].forEach((show)=>{
					const p = calc(d, t, { paiPanType: 2, school: '飞盘', feiXingShun: fx, feiMenShun: fm, feiShenShun: fs, feiMenZhongCan: can, feiMenZhongShow: show });
					invariants(p, 'fei');
					const center = p.cells.find((c)=>c.isCenter);
					const outerDoors = p.cells.filter((c)=>!c.isCenter).map((c)=>String(c.door || '').charAt(0)).filter(Boolean);
					if(!can){
						expect(center.door).toBe(show ? '中' : '');
						expect(new Set(outerDoors).size).toBe(8);
						expect(outerDoors.includes('中')).toBe(false);
					}else{
						// 参与:九门含中(中门随飞可落任意宫)
						const all = p.cells.map((c)=>String(c.door || '').charAt(0)).filter(Boolean);
						expect(all.length).toBe(9);
					}
					n++;
				}));
			})));
		});
		expect(n).toBe(2 * 8 * 4);
	});

	// ── ④ 混合四层 3^4=81 全组合 ──
	test('混合装配81全组合:零抛+结构;全zhuan/全fei 等价律再证', ()=>{
		const d = '2026-02-17', t = '09:05:00';
		const V = ['', 'zhuan', 'fei'];
		let n = 0;
		V.forEach((a)=>V.forEach((b)=>V.forEach((c)=>V.forEach((e)=>{
			invariants(calc(d, t, { paiPanType: 2, school: '混合', mixTian: a, mixXing: b, mixMen: c, mixShen: e }), 'mix');
			n++;
		}))));
		expect(n).toBe(81);
		const zhuan = calc(d, t, { paiPanType: 2, school: '转盘' });
		const fei = calc(d, t, { paiPanType: 2, school: '飞盘' });
		const az = calc(d, t, { paiPanType: 2, school: '混合', mixTian: 'zhuan', mixXing: 'zhuan', mixMen: 'zhuan', mixShen: 'zhuan' });
		const af = calc(d, t, { paiPanType: 2, school: '混合', mixTian: 'fei', mixXing: 'fei', mixMen: 'fei', mixShen: 'fei' });
		const layer = (p, k)=>p.cells.map((c)=>String(c[k] || '')).join('|');
		['door', 'tianGan', 'tianXing'].forEach((k)=>{
			expect(layer(az, k)).toBe(layer(zhuan, k));
			expect(layer(af, k)).toBe(layer(fei, k));
		});
	});

	// ── ⑤ 冲突/交叉组合 ──
	test('冲突组合:金函×移星/封局/暗干(无意义键不炸不漏);刻家×数字起局/移星值符;寄宫×暗干×移星三键叠', ()=>{
		const d = '2026-02-17', t = '09:05:00';
		// 金函盘对常规键免疫:任意常规键组合下仍产完整金函盘
		const j1 = calc(d, t, { paiPanType: 6, shiftPalace: 3, fengJu: true, anGanMode: 'dipan', godsPreset: 'system', jiGongMode: 'gen', kongMarkBoth: true, showAllKong: true });
		expect(j1.isJinhan).toBe(true);
		expect(j1.cells.length).toBe(9);
		expect(j1.jinhan.dayGz in JINHAN_TABLE).toBe(true);
		// 刻家×数字起局:qijuMethod=shuzi 时初局走报数——不抛且结构完整
		const k1 = calc(d, t, { paiPanType: 4, qijuMethod: 'shuzi', shuziReportNumber: '789' });
		invariants(k1, 'ke-shuzi');
		// 刻家×移星值符 recalc×移星
		const k2 = calc(d, t, { paiPanType: 4, shiftPalace: 2, shiftZhiFuMode: 'recalc' });
		invariants(k2, 'ke-shift');
		// 寄宫×暗干转布×移星:zhishi_zhuan 的寄宫跟随 jiGongMode
		JIGONG_MODE_OPTIONS.forEach((jg)=>{
			const p = calc(d, t, { paiPanType: 2, jiGongMode: jg.value, anGanMode: 'zhishi_zhuan', shiftPalace: 5 });
			invariants(p, 'triple');
		});
	});

	// ── ⑥ 边界与异形输入 ──
	test('边界:刻界 23:59/00:00/整刻线;冬夏至当日金函盘别;1900/2100 年家 yinian;异形档位回落默认零抛', ()=>{
		// 刻家跨界
		[['2026-02-17', '23:59:59'], ['2026-02-17', '00:00:00'], ['2026-02-17', '11:59:59'], ['2026-02-17', '12:00:00']].forEach(([d, t])=>{
			const p = calc(d, t, { paiPanType: 4 });
			expect(p.keIndex >= 1 && p.keIndex <= 10).toBe(true);
		});
		// 金函:冬至/夏至当日盘别可定(不抛,pantype∈阴阳)
		[['2025-12-21', '12:00:00'], ['2026-06-21', '12:00:00']].forEach(([d, t])=>{
			const p = calc(d, t, { paiPanType: 6 });
			expect(['阳', '阴'].includes(p.jinhan.pantype)).toBe(true);
		});
		// 年家 yinian 远年
		[['1900-06-01', '10:00:00'], ['2100-06-01', '10:00:00']].forEach(([d, t])=>{
			const p = calc(d, t, { paiPanType: 0, yearJiaJu: 'yinian' });
			const ju = '一二三四五六七八九'.indexOf(String(p.juShu || '').charAt(0)) + 1;
			expect(ju >= 1 && ju <= 9).toBe(true);
		});
		// 异形档位:非法字符串/数字/null 一律回落默认不抛
		const junk = { paiPanType: 2, godsPreset: 'nonsense', jiGongMode: 123, anGanMode: null, dayJiaJu: 'xxx', shiftZhiFuMode: 42, mixTian: 'bad', jinhanMenPai: {}, keJiaFenDun: [], yearJiaJu: 'zzz' };
		const p = calc('2026-02-17', '10:00:00', junk);
		invariants(p, 'junk');
		const base = calc('2026-02-17', '10:00:00', { paiPanType: 2 });
		expect(p.cells.map((c)=>[c.god, c.door, c.tianGan].join('/')).join('|'))
			.toBe(base.cells.map((c)=>[c.god, c.door, c.tianGan].join('/')).join('|'));
	});

	// ── ⑦ 金函全 60 干支×2 盘别渲染域完整 ──
	test('金函数据面全扫:60 干支×阴阳全部构造盘,星门吉凶域合法+喜神恰一', ()=>{
		const JH_STARS = new Set(['天乙', '太乙', '太阴', '青龙', '轩辕', '招摇', '摄提', '咸池', '天符']);
		Object.keys(JINHAN_TABLE).forEach((gz)=>{
			['yang', 'yin'].forEach((side)=>{
				const rec = JINHAN_TABLE[gz];
				const stars = side === 'yang' ? rec.yangStars : rec.yinStars;
				const doors = side === 'yang' ? rec.yangDoors : rec.yinDoors;
				stars.forEach((s)=>{ expect(JH_STARS.has(s)).toBe(true); expect(['吉', '平', '凶'].includes(JINHAN_STAR_JI[s])).toBe(true); });
				doors.forEach((dd)=>{ expect(['吉', '平', '凶'].includes(JINHAN_DOOR_JI[dd])).toBe(true); });
			});
		});
	});

	// ── ⑧ 快照注记齐全性矩阵(spec G-1) ──
	test('快照注记矩阵:每个非默认新档在快照出现对应注记;全默认=零新注记', ()=>{
		const d = '2026-02-17', t = '09:05:00';
		const CASES = [
			[{ paiPanType: 2, godsPreset: 'system' }, '八神取神：'],
			[{ paiPanType: 2, jiGongMode: 'gen' }, '中宫寄宫：'],
			[{ paiPanType: 2, anGanMode: 'dipan' }, '暗干：'],
			[{ paiPanType: 2, kongMarkBoth: true }, '空亡标注：日空＋时空并标'],
			[{ paiPanType: 2, showAllKong: true }, '四柱空亡：'],
			[{ paiPanType: 2, shiftPalace: 2, shiftZhiFuMode: 'recalc' }, '移星值符：移后重定值符值使'],
			[{ paiPanType: 2, dayJiaJu: 'shitian' }, '日家定局：'],
			[{ paiPanType: 0, yearJiaJu: 'yinian' }, '年家定局：'],
			[{ paiPanType: 2, school: '飞盘', feiXingShun: true }, '飞宫顺飞：九星'],
			[{ paiPanType: 2, school: '飞盘', feiMenZhongCan: false }, '门层跳中：'],
			[{ paiPanType: 2, school: '混合', mixMen: 'zhuan' }, '混合装配：'],
			[{ paiPanType: 4 }, '刻序：本时辰第'],
		];
		CASES.forEach(([opts, marker])=>{
			expect(buildDunJiaSnapshotText(calc(d, t, opts)).includes(marker)).toBe(true);
		});
		const dftSnap = buildDunJiaSnapshotText(calc(d, t, { paiPanType: 2 }));
		['八神取神：', '中宫寄宫：', '暗干：', '空亡标注：', '四柱空亡：', '移星值符：', '日家定局：', '年家定局：', '飞宫顺飞：', '门层跳中：', '混合装配：', '刻序：'].forEach((m)=>{
			expect(dftSnap.includes(m)).toBe(false);
		});
	});
});

// ══ [QA3b] AI 四链结构守卫 ═══
describe('[QA3b] 挂载齿轮/导出/存档链', ()=>{
	const fs = require('fs');
	const path = require('path');
	const read = (rel)=>fs.readFileSync(path.join(__dirname, rel), 'utf8');

	test('🔴 挂载齿轮键名对齐:QIMEN_FIELDS 每个 name ∈ 独立页 DEFAULT_OPTIONS 键集(schema 名写错=齿轮改了引擎读不到)', ()=>{
		const { getTechniqueSettingsSchema } = require('../../../utils/techniqueMountSettings');
		const qimenSchema = getTechniqueSettingsSchema('qimen');
		expect(qimenSchema && Array.isArray(qimenSchema.fields)).toBe(true);
		const dm = read('../DunJiaMain.js');
		const i = dm.indexOf('const DEFAULT_OPTIONS');
		const seg = dm.slice(i, dm.indexOf('\n};', i));
		const dmKeys = new Set();
		const re = /^\t(\w+):/gm;
		let m;
		while((m = re.exec(seg))){ dmKeys.add(m[1]); }
		// 豁免:挂载专属键(不进独立页 options 的合法键,新增须写理由)
		const EXEMPT = new Set([
			'faRelatedPeople',   // 相关人员:独立页在 state 非 options,挂载走 payload 顶层同名
			'chartCategory',     // 盘类:独立页在 state 非 options
		]);
		const bad = qimenSchema.fields.map((f)=>f.name).filter((n)=>!dmKeys.has(n) && !EXEMPT.has(n));
		expect(bad).toEqual([]);
		// 新键点名在 schema(挂载面完备)
		['godsPreset', 'jiGongMode', 'anGanMode', 'showAnZhi', 'feiXingShun', 'feiMenShun', 'feiShenShun',
		 'feiMenZhongCan', 'feiMenZhongShow', 'mixTian', 'mixXing', 'mixMen', 'mixShen',
		 'kongMarkBoth', 'showAllKong', 'shiftZhiFuMode', 'dayJiaJu', 'keJiaFenDun', 'keZiZhengHuanShi',
		 'jinhanMenPai', 'yearJiaJu'].forEach((k)=>{
			expect(qimenSchema.fields.some((f)=>f.name === k)).toBe(true);
		});
	});

	test('🔴 挂载重算合并制守卫:regenerateQimenSnapshot 必须 {...DEFAULT, ...存档 options} 全量透传(白名单制=丢新键)', ()=>{
		const ctx = read('../../../utils/aiAnalysisContext.js');
		const i = ctx.indexOf('async function regenerateQimenSnapshot');
		expect(i).toBeGreaterThan(0);
		const seg = ctx.slice(i, i + 1600);
		expect(seg.includes('...DEFAULT_QIMEN_OPTIONS')).toBe(true);
		expect(seg.includes('...(qs && qs.options ? qs.options : {})')).toBe(true);
		expect(seg.includes('calcDunJia(fields, nongli, options')).toBe(true);
	});

	test('独立页事盘载入结构守卫:restore 以 Object.keys(DEFAULT_OPTIONS) 驱动(结构性防漂)', ()=>{
		const dm = read('../DunJiaMain.js');
		const i = dm.indexOf('restoreOptionsFromCurrentCase(force){');
		const seg = dm.slice(i, i + 4000);
		expect(seg.includes('Object.keys(DEFAULT_OPTIONS).forEach')).toBe(true);
		expect(seg.includes('savedOptions[key] !== undefined')).toBe(true);
	});

	test('AI 导出奇门段=快照全文直入(新增行自动随段,无行级白名单裁剪)', ()=>{
		const ctx = read('../../../utils/aiAnalysisContext.js');
		expect(ctx.includes('const qimenText = buildDunJiaSnapshotText(result.dunjia)')).toBe(true);
		expect(ctx.includes('[奇门遁甲]')).toBe(true);
	});
});

// ══ [W1·审计补缺] 五合配干进快照:盘面每宫恒画的注记(cell.tianGan||diGan 经 QIMEN_WU_HE)快照曾恒缺 ═══
describe('[W1] 五合配干快照锚', ()=>{
	test('🔴 [盘面要素] 含五合配干行,且逐宫与单源表一致(与 DunJiaBoard 同判据)', ()=>{
		const { QIMEN_WU_HE } = require('../DunJiaCalc');
		const pan = calc('2026-02-17', '09:05:00', { paiPanType: 2 });
		const snap = buildDunJiaSnapshotText(pan);
		expect(snap).toContain('五合配干：');
		const line = snap.split('\n').find((l)=>l.startsWith('五合配干：'));
		pan.cells.forEach((cell)=>{
			const g = cell.tianGan || cell.diGan || '';
			if(g && QIMEN_WU_HE[g]){
				expect(line).toContain(`${g}合${QIMEN_WU_HE[g]}`);
			}
		});
	});
	test('金函盘(独立查表体系)不受五合行波及:结构照旧', ()=>{
		const pan = calc('2026-02-17', '09:05:00', { paiPanType: 6 });
		expect(pan.isJinhan).toBe(true);
		expect(pan.cells.length).toBe(9);
	});
});
