// 紫微双引擎对拍(WP-D 转正闸)—— 本地 ZiweiCalc vs Java /ziwei/birth 逐字段。
//
// 🔴 fixture = 真后端 24 例参数网格响应(scripts/ziwei_dual_engine_grid.js 抓取固化:
//    年代 1950-2026 × 性别 × 晚子时 × 闰二月 × 立春界)。单测绝不依赖本机服务(坑3),
//    故网络抓取独立成脚本、此处离线比对。
//
// 🔴 转正闸(默认 Java 字节零回归的历史契约由 ziweiLocalFirst 开关承接):
//    本组【全绿】= 排盘核心零分歧,方可把开关默认置开;任何红 = 未决 diff,先定性再谈切换。
//    比对面 = 排盘核心(宫干支/主星/辅星/四化/命身/五行局/命主身主/斗君),
//    不比 Java 专属的顶层兼容字段(nongli 文本等 —— 本地转正后仍由组装层保留 Java 形状)。
import fs from 'fs';
import path from 'path';
import { calcZiwei } from '../ZiweiCalc';

const GRID = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ziweiJavaGrid.json'), 'utf8'));

// 与 ZiWeiMain.requestZiWei 本地分支【同形】的入参组装(birth + Java 兼容档 opts)。
// Java 兼容档(2026-07-19 考据定谳,三键消 ①②③ 三类口径差):
//   · yearBoundary:'lunar_1_1' —— Java 年柱=nongli.year(正月初一换年),非立春;
//   · ziweiLunarBasis:'calendar' —— Java 安命/安紫微用日历农历日(23:30 不进日;八字四柱仍进=「柱进盘不进」混合口径);
//   · lifeMasterBy:'year_branch' —— Java 命主按【生年支】查 ziweizu.json(经典法按命宫支)。
export const ZIWEI_JAVA_COMPAT_OPTS = Object.freeze({
	yearBoundary: 'lunar_1_1',
	ziweiLunarBasis: 'calendar',
	lifeMasterBy: 'year_branch',
});

function localChartOf(entry){
	const p = entry.params;
	const birth = {
		date: p.date, time: p.time, zone: p.zone, lon: p.lon, lat: p.lat,
		gpsLon: p.gpsLon, gpsLat: p.gpsLat, ad: 1, gender: p.gender,
	};
	const opts = {
		timeAlg: p.timeAlg, after23NewDay: p.after23NewDay, lateZiHourUseNextDay: p.lateZiHourUseNextDay,
		...ZIWEI_JAVA_COMPAT_OPTS,
	};
	return calcZiwei(birth, opts);
}

// ④类勘定:辅星等仅【序】差(安星次序实现细节),集合相同即同盘 → 星集比较排序后比。
const starNames = (list) => (Array.isArray(list) ? list.map((s) => (s && s.name) || s).sort().join(',') : String(list));

// 🔴 闸判定(2026-07-15 首跑):24/24 有系统性 diff,四类未决口径差 ——
//    ① 年界(4 例,全在立春界当日):年柱 本地丙午 vs Java 乙巳(立春换年 vs 正月换年),
//       连带 wuxingJu/bodyMaster/doujun/宫干支同源全错;
//    ② 晚子时(12 例=全部 23:30 例):ziweiIndex 位移 → 主星整盘挪宫;
//    ③ 命主表两套(20 例):本地文曲系 vs Java 禄存系(两种命主取法);
//    ④ 辅星 16 例仅【序】差(集合相同)—— 此类是比较法太严,非引擎分歧。
//    ①②大概率=本地引擎选项默认档未对齐 Java 口径(引擎有 yearBoundary/lateZi 开关);
//    ③需考据 Java 用的命主表并在本地补齐该档。→ 对齐三档+集合比后重跑此闸,
//    全绿才许把 ziweiLocalFirst 切默认。闸未过 → 该开关已改为 opt-in(默认关,Java 现状)。
describe('🔴 紫微双引擎 24 例网格对拍(转正闸:全绿才许切默认)', () => {
	test('fixture 在位且成例', () => {
		expect(GRID.length).toBe(24);
	});

	test('🔴 闸哨兵:对拍未全绿期间,ziweiLocalFirst 必须是 opt-in(默认关)', () => {
		const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'utils', 'perfFlags.js'), 'utf8');
		const fn = (src.match(/export function ziweiLocalFirstEnabled\(\)\{[\s\S]*?\n\}/) || [''])[0];
		expect(fn).toContain("=== '1'");        // opt-in 判定
		expect(fn).not.toContain("!== '0'");    // 绝不是默认开的形
	});

	// 对拍例(2026-07-19 起全绿=排盘核心字节证明;切默认另需全响应形状装配审计,闸哨兵仍钉 opt-in)
	test.each(GRID.map((g) => [g.why, g]))('%s', (why, g) => {
		const local = localChartOf(g);
		const java = g.chart;
		expect(local).toBeTruthy();
		expect(Array.isArray(local.houses) && local.houses.length === 12).toBe(true);
		// 盘骨架
		expect(local.lifeHouseIndex).toBe(java.lifeHouseIndex);
		expect(local.bodyHouseIndex).toBe(java.bodyHouseIndex);
		expect(local.wuxingJu).toBe(java.wuxingJu);
		expect(local.ziweiIndex).toBe(java.ziweiIndex);
		expect(local.yearGan).toBe(java.yearGan);
		expect(local.yearZi).toBe(java.yearZi);
		expect(local.timeZi).toBe(java.timeZi);
		expect(local.lifeMaster).toBe(java.lifeMaster);
		expect(local.bodyMaster).toBe(java.bodyMaster);
		expect(local.zidou).toBe(java.zidou);
		expect(local.doujun).toBe(java.doujun);
		// 十二宫逐宫:宫名/干支/主星集/辅星集/煞星集(星曜名含四化后缀时以名串比)
		for(let i = 0; i < 12; i += 1){
			const lh = local.houses[i];
			const jh = java.houses[i];
			expect(`${i}:${lh.name}`).toBe(`${i}:${jh.name}`);
			expect(`${i}:${lh.ganzi}`).toBe(`${i}:${jh.ganzi}`);
			expect(`${i}:${starNames(lh.starsMain)}`).toBe(`${i}:${starNames(jh.starsMain)}`);
			expect(`${i}:${starNames(lh.starsAssist)}`).toBe(`${i}:${starNames(jh.starsAssist)}`);
			expect(`${i}:${starNames(lh.starsEvil)}`).toBe(`${i}:${starNames(jh.starsEvil)}`);
		}
	});
});
