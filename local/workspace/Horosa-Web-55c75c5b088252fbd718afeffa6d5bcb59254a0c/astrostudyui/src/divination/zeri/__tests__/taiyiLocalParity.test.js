// [Z3·太乙择日] 本地引擎↔后端 kentang parity 网格金标(决策10:扫描用本地引擎的接入门槛)。
// 真值采集:2026-08-28 后端 /taiyi/pan 实采五锚(键名 year/month/day/hour/minute 数值形——
// 首采曾用 date/time 串形被后端静默忽略、三时刻同盘,判别纪律当场抓获假请求)。
// 五锚判别力自证:换刻变盘/tn 档变盘/style 档变盘(定案19 三层断言之「确不同」)。
// 失败=本地引擎与后端漂移,先修引擎再谈扫描(dunjiaBackendParity 同律);勿改锚将就。
// 🔴 供数=扫描引擎同一链(computeTaiyiScanPan:lite+liteToTaiyiNongli 适配+calcTaiyi)——
// 首跑三轮实抓:①date/time 串形请求被后端忽略(三时刻同盘)②nongli=null 阴阳遁误判+计神空
// ③lite nongli 键形与生产 preciseNongli 不同构(year=中文年)→适配器 liteToTaiyiNongli 根治。
import { computeTaiyiScanPan } from '../taiyiZeriScanEngine';

const pan = (dateStr, timeStr, options)=>computeTaiyiScanPan({ zone: '+08:00', ad: 1 }, options || {}, dateStr, timeStr);

// 后端真值(2026-08-28 实采):[date,time,opts,期望]
const ANCHORS = [
	['2026-01-01', '12:30:00', { style: 3, tn: 0 }, { kook: '陽遁六十七局', taiyiPalace: '子', taiyiNum: 8, skyeyes: '巽', sf: '戌', homeCal: 25, awayCal: 2, setCal: 26, homeGeneral: 5, awayGeneral: 2, jigod: '申', hegod: '未', wufuNum: 1 }],
	['2026-07-01', '09:30:00', { style: 3, tn: 0 }, { kook: '陰遁六局', taiyiPalace: '午', taiyiNum: 8, skyeyes: '巳', sf: '辰', homeCal: 17, awayCal: 26, setCal: 10, homeGeneral: 7, awayGeneral: 6, jigod: '卯', hegod: '申', wufuNum: 1 }],
	['2015-12-22', '13:00:00', { style: 3, tn: 0 }, { kook: '陽遁三十二局', taiyiPalace: '艮', taiyiNum: 3, skyeyes: '巳', sf: '子', homeCal: 25, awayCal: 8, setCal: 24, homeGeneral: 5, awayGeneral: 8, jigod: '未', hegod: '午', wufuNum: 5 }],
	['2026-01-01', '12:30:00', { style: 3, tn: 1 }, { kook: '陽遁十九局', taiyiPalace: '子', taiyiNum: 8, skyeyes: '申', sf: '艮', homeCal: 8, awayCal: 32, setCal: 14, homeGeneral: 8, awayGeneral: 2, jigod: '申', hegod: '未', wufuNum: 1 }],
	['2026-08-15', '15:30:00', { style: 3, tn: 0 }, { kook: '陰遁四十五局', taiyiPalace: '子', taiyiNum: 2, skyeyes: '坤', sf: '酉', homeCal: 38, awayCal: 31, setCal: 25, homeGeneral: 8, awayGeneral: 1, jigod: '子', hegod: '巳', wufuNum: 1 }],
	['2026-09-10', '11:00:00', { style: 3, tn: 0 }, { kook: '陰遁六十七局', taiyiPalace: '子', taiyiNum: 2, skyeyes: '乾', sf: '戌', homeCal: 25, awayCal: 26, setCal: 26, homeGeneral: 5, awayGeneral: 6, jigod: '寅', hegod: '未', wufuNum: 1 }],
];
// style=5(命法)后端真值已采但不入锚:命法按生辰非候选时刻,不是择日扫描对象;
// 扫描引擎 style 恒 3(taiyiZeriScanEngine 定谳),本地引擎亦未实现命法档。

describe('[Z3] 太乙本地引擎↔后端五锚 parity(扫描接入门槛)', ()=>{
	ANCHORS.forEach(([d, t, opts, exp], i)=>{
		it(`🔴 锚${i + 1}: ${d} ${t} style=${opts.style} tn=${opts.tn} 判定面逐键 == 后端`, ()=>{
			const p = pan(d, t, opts);
			expect(p).toBeTruthy();
			// kook 文本简繁归一(本地简体/后端繁体——判定同、字形异,非漂移)
			const t2s = (x)=>`${x || ''}`.replace(/陽/g, '阳').replace(/陰/g, '阴').replace(/遁/g, '遁');
			expect(t2s(p.kook && p.kook.text)).toBe(t2s(exp.kook));
			expect(p.taiyiPalace).toBe(exp.taiyiPalace);
			expect(p.taiyiNum).toBe(exp.taiyiNum);
			expect(p.skyeyes).toBe(exp.skyeyes);
			expect(p.sf).toBe(exp.sf);
			expect(p.homeCal).toBe(exp.homeCal);
			expect(p.awayCal).toBe(exp.awayCal);
			expect(p.setCal).toBe(exp.setCal);
			expect(p.homeGeneral).toBe(exp.homeGeneral);
			expect(p.awayGeneral).toBe(exp.awayGeneral);
			expect(p.jigod).toBe(exp.jigod);
			expect(p.hegod).toBe(exp.hegod);
			expect(p.wufuNum).toBe(exp.wufuNum);
		});
	});

	it('判别力自证:五锚两两至少一键不同(防恒同盘假绿——首采实抓过)', ()=>{
		const pans = ANCHORS.map(([d, t, o])=>pan(d, t, o));
		for(let i = 0; i < pans.length; i++){
			for(let j = i + 1; j < pans.length; j++){
				const same = ['taiyiPalace', 'skyeyes', 'sf', 'homeCal', 'awayCal'].every((k)=>pans[i][k] === pans[j][k]);
				expect(same).toBe(false);
			}
		}
	});
});
