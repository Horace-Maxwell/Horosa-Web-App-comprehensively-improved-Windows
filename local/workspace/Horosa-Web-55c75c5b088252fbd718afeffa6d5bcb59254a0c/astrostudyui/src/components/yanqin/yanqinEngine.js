// 演禽 · 起禽核心引擎(纯函数,无副作用,无星历依赖=纯历法引擎)。
// 复现两份权威复原文档「已程序验证」的起禽四法 + 翻禽倒将活曜 + 投胎度数。
// 所有结论由 yanqinEngine.golden.test.js 锁死(文档锚点 = 法律)。
import {
	MANSIONS, mansionByIdx, MANSION_HEAD_TO_IDX, MANSION_NAME_TO_IDX,
	YAO_CYCLE, YAO_TO_WEEKDAY, YAO_TO_WUXING, YAO_ORDER, WEEKDAY_TO_YAO,
	TIANGAN, DIZHI, DIZHI_TO_IDX,
	R_RING, MONTHQIN_START_BY_YAO, MONTHQIN_START_BY_YAO_B,
	HUOYAO_START_BY_YAO, FANHUOYAO_START_BY_YAO,
	HESU_OF, TOUTAI_BIRDS, WUXING_KE,
} from './yanqinConst';

const ANCHOR_MANSION_IDX = 11; // 虚日鼠
const ANCHOR_GANZHI = 0;       // 甲子

function mod(n, m) { return ((n % m) + m) % m; }

// 🔴 连续日序 = 儒略/格里 JDN(含 1582-10-15 切换),而非 JS Date.UTC(proleptic Gregorian)。
// 后者对 1582 前(尤其 BC)与真实儒略历日序偏差(实测 BC12026 日禽/日干支偏约 28 位,全错);
// year=带符号显示年(BC 负、无 0 年)→ 天文年(BC1=0)。现代域(1582 后)走格里分支,与旧 Date.UTC
// 差常数、diff 不变=零回归(golden 用现代日期不受影响);BC/1582 前走儒略分支,日序修正。
export function dayNumber(year, month, day) {
	const ay = year < 0 ? year + 1 : year;
	const a = Math.floor((14 - month) / 12);
	const y = ay + 4800 - a;
	const m = month + 12 * a - 3;
	const isGreg = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
	if (isGreg) {
		return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
	}
	return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

// 锚点:1996-01-28 = 甲子日 = 虚日鼠(序11) = 一元一将(七元甲子最干净起点)。以同一 JDN 函数
// 求锚,现代域 diff = dayNumber - ANCHOR 与旧 Date.UTC 口径逐日一致(零回归);大全§1.7/§10.2 实测坐实。
const ANCHOR_DAY_NUMBER = dayNumber(1996, 1, 28);

// —— 日禽:周历机制(一日一换,28日一轮)✅ ——
// 序号 = ((日序 − 锚点日序 + 锚点宿序 − 1) mod 28) + 1
export function mansionIdxOfDay(year, month, day) {
	const diff = dayNumber(year, month, day) - ANCHOR_DAY_NUMBER;
	return mod(diff + ANCHOR_MANSION_IDX - 1, 28) + 1;
}
export function mansionOfDay(year, month, day) { return mansionByIdx(mansionIdxOfDay(year, month, day)); }

// —— 干支(日)✅:锚 1996-01-28=甲子 ——
export function ganzhiIdxOfDay(year, month, day) {
	const diff = dayNumber(year, month, day) - ANCHOR_DAY_NUMBER;
	return mod(diff + ANCHOR_GANZHI, 60);
}
export function ganzhiOfDay(year, month, day) {
	const g = ganzhiIdxOfDay(year, month, day);
	return TIANGAN[g % 10] + DIZHI[g % 12];
}

// —— 七元 / 四将 ✅:一元=60日、七元=420日;元=⌊(diff mod420)/60⌋+1、将=⌊(diff mod60)/15⌋+1 ——
export function yuanJiangOfDay(year, month, day) {
	const diff = dayNumber(year, month, day) - ANCHOR_DAY_NUMBER;
	const yuan = Math.floor(mod(diff, 420) / 60) + 1; // 1..7
	const jiang = Math.floor(mod(diff, 60) / 15) + 1; // 1..4
	return { yuan, jiang };
}

// 宿名第二字(七曜)
export function elementOf(mansionName) {
	const name = typeof mansionName === 'object' ? mansionName.name : mansionName;
	return name && name.length >= 2 ? name[1] : null;
}

// —— 年禽(A系)✅:(year+15) mod 28,0→28 ——
export function yearQin(year) {
	const idx = mod(year + 15, 28) || 28;
	return mansionByIdx(idx);
}

// —— 月禽 ✅:年禽曜→正月起宿,顺数填月。verse 'A'(主流,默认)| 'B'(异系) ——
export function monthQin(year, lunarMonth, verse) {
	const yq = yearQin(year);
	const tbl = verse === 'B' ? MONTHQIN_START_BY_YAO_B : MONTHQIN_START_BY_YAO;
	const startIdx = MANSION_NAME_TO_IDX[tbl[yq.yao]];
	return mansionByIdx(mod(startIdx - 1 + (lunarMonth - 1), 28) + 1);
}

// —— 禽星五行 ✅:按七政(宿曜第二字)——
export function wuxingOfMansion(mansion) {
	if (!mansion) { return null; }
	return YAO_TO_WUXING[mansion.yao];
}

// —— 时禽(元元相轮 + 旬头位移)⚠️ 大全§10.5 ——
// 子时正禽 = R[(曜序 + 元-1 + 旬头位移) mod 7];旬头位移 = 日干支序 mod 10(甲日=0)。
// §4.3「七元甲子时禽表」= 基准(useXun=false 即无位移,等价甲子日)。
// ⚠️ 文档冲突:§10.5 判旬头位移强制(T1 庚午卯=井木犴 需位移);但 §4.5 的 T2、§5.5 翻禽 F1
//   两算例均"无位移"。三锚不能同时满足。useXun 做成开关交流派/用户定;默认依 §10.5 = true。
// 基准子时起宿(无位移)idx:R[(曜序+元-1) mod 7]
export function hourZiBaseIdx(dayYao, yuan) {
	const rIdx = mod(YAO_ORDER[dayYao] + (yuan - 1), 7);
	return MANSION_HEAD_TO_IDX[R_RING[rIdx]];
}
export function hourZiStartIdx(year, month, day, useXun) {
	const dayM = mansionOfDay(year, month, day);
	const { yuan } = yuanJiangOfDay(year, month, day);
	const baseR = mod(YAO_ORDER[dayM.yao] + (yuan - 1), 7);
	const xun = (useXun === false) ? 0 : (ganzhiIdxOfDay(year, month, day) % 10);
	return MANSION_HEAD_TO_IDX[R_RING[mod(baseR + xun, 7)]];
}
// hourBranch: 0=子 … 11=亥
export function hourQin(year, month, day, hourBranch, useXun) {
	const ziIdx = hourZiStartIdx(year, month, day, useXun);
	return mansionByIdx(mod(ziIdx - 1 + hourBranch, 28) + 1);
}

// —— 翻禽(他禽)✅ 大全§5.5 ——
// 当日盘 = 子时正禽置子、顺地支排28宿;从时禽地支顺数(地支+宿同进)至日禽宿,记落地支,
// 在当日盘读该地支之禽 = 翻禽。
export function fanQin(year, month, day, hourBranch, useXun) {
	const ziIdx = hourZiStartIdx(year, month, day, useXun);   // 子时正禽 Z
	const hourMansionIdx = mod(ziIdx - 1 + hourBranch, 28) + 1; // 时禽 T
	const dayIdx = mansionIdxOfDay(year, month, day);          // 日禽 D
	const k = mod(dayIdx - hourMansionIdx, 28);                // 顺数步数 T→D
	const landBranch = mod(hourBranch + k, 12);               // 落地支
	const idx = mod(ziIdx - 1 + landBranch, 28) + 1;          // 当日盘读落点
	return { fan: mansionByIdx(idx), hourMansion: mansionByIdx(hourMansionIdx), landBranch };
}

// —— 倒将(主将/次将)✅ 大全§5.3 ——
// 次将 = 气将本宫→顺数→时将之宫所得宿;主将 = 时将之宫→倒回(逆数)→气将之位所得宿。
// 气将 = 当日值日宿(28将=28宿,落本日地支);时将 = 时禽。此处给程序化次/主将。
export function daoJiang(year, month, day, hourBranch, useXun) {
	const dayIdx = mansionIdxOfDay(year, month, day);
	const dayBranch = ganzhiIdxOfDay(year, month, day) % 12; // 气将本宫(日支)
	const { hourMansion } = fanQin(year, month, day, hourBranch, useXun);
	const hourMansionIdx = hourMansion.idx;
	const step = mod(hourBranch - dayBranch, 12);            // 气将宫→时将宫 宫数
	const ciJiang = mansionByIdx(mod(dayIdx - 1 + step, 28) + 1);   // 次将:顺数
	const zhuJiang = mansionByIdx(mod(hourMansionIdx - 1 - step, 28) + 1); // 主将:倒回
	return { ciJiang, zhuJiang };
}

// —— 活曜(番禽活曜头诀,自寅起)✅ 大全§5.4 ——
// variant: 'fanqin'(番禽系,土→翼)| 'fanqin2'(翻禽系异本,土→箕)
export function huoYao(year, month, day, hourBranch, variant) {
	const dayM = mansionOfDay(year, month, day);
	const tbl = variant === 'fanqin2' ? FANHUOYAO_START_BY_YAO : HUOYAO_START_BY_YAO;
	const startHead = tbl[dayM.yao];
	const startIdx = MANSION_HEAD_TO_IDX[startHead];
	// 自寅位(寅=2)起轮:寅时即起宿,顺数到所求时支
	const steps = mod(hourBranch - 2, 12);
	return mansionByIdx(mod(startIdx - 1 + steps, 28) + 1);
}

// —— 投胎度数→十二禽兽(体系A 禄命)✅ 大全§5.1 ——
// 寅时(2)正月(1)固定起凤凰(环序0);月进一→度退一(环-1),时进一→环+1。
export function toutaiDu(lunarMonth, hourBranch) {
	// TOUTAI_BIRDS 已按"度反序"排环。月进一→度退一=环 index+1;时进一→度进一=环 index-1。
	// 寅时正月起凤凰(index0)。ringPos = (月-正月) − (时支-寅)。
	const ringPos = mod((lunarMonth - 1) - (hourBranch - 2), 12);
	return TOUTAI_BIRDS[ringPos];
}

// —— 命星→身星(合宿歌法,体系C 禄命)✅ 大全§5.3.2 ——
// ① 命星之宿取合宿;② 合宿置子,沿28宿顺地支前行;③ 数到生年地支落点之禽=身星。
export function shenStarFromMingStar(mingStarHead, birthYearBranchIdx) {
	const heHead = HESU_OF[mingStarHead];
	if (!heHead) { return null; }
	const startIdx = MANSION_HEAD_TO_IDX[heHead];
	return mansionByIdx(mod(startIdx - 1 + birthYearBranchIdx, 28) + 1);
}

// —— 禽课吉凶基元:我禽 vs 彼禽 五行胜负 ✅ ——
// 直接吃五行:'meWin'我克彼|'theyWin'彼克我|'meSheng'我生彼|'theySheng'彼生我|'peace'比和
export function qinKeByWuxing(a, b) {
	if (!a || !b) { return 'peace'; }
	if (a === b) { return 'peace'; }
	if (WUXING_KE[a] === b) { return 'meWin'; }
	if (WUXING_KE[b] === a) { return 'theyWin'; }
	const sheng = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
	if (sheng[a] === b) { return 'meSheng'; }
	if (sheng[b] === a) { return 'theySheng'; }
	return 'peace';
}
// 吃宿名第二字(七曜)的便捷版(默认七政五行)
export function qinKeJudge(meYao, theyYao) {
	return qinKeByWuxing(YAO_TO_WUXING[meYao], YAO_TO_WUXING[theyYao]);
}

// 一站式:给公历日期+时支,出该时刻四禽 + 翻禽倒将活曜(择日/占卜共用)。
export function castQinChart(year, month, day, hourBranch, opts) {
	const o = opts || {};
	const useXun = o.useXun;
	const dayMansion = mansionOfDay(year, month, day);
	const { yuan, jiang } = yuanJiangOfDay(year, month, day);
	const ganzhi = ganzhiOfDay(year, month, day);
	const hour = (hourBranch !== undefined && hourBranch !== null)
		? hourQin(year, month, day, hourBranch, useXun) : null;
	const fan = (hourBranch !== undefined && hourBranch !== null)
		? fanQin(year, month, day, hourBranch, useXun) : null;
	const dao = (hourBranch !== undefined && hourBranch !== null)
		? daoJiang(year, month, day, hourBranch, useXun) : null;
	// 活曜:huoYaoVariant='off'(如池本理不载活曜)→ 不出;番禽系/翻禽系土曜起宿不同。
	const huo = (hourBranch !== undefined && hourBranch !== null && o.huoYaoVariant !== 'off')
		? huoYao(year, month, day, hourBranch, o.huoYaoVariant) : null;
	const ziStart = (hourBranch !== undefined && hourBranch !== null)
		? mansionByIdx(hourZiStartIdx(year, month, day, useXun)) : null;
	return {
		ganzhi, yuan, jiang, ziStart,
		weekday: WEEKDAY_TO_YAO[ (function(){ const d = new Date(Date.UTC(year, month - 1, day)); return d.getUTCDay(); })() ],
		yearQin: yearQin(year),
		dayQin: dayMansion,
		hourQin: hour,
		fanQin: fan ? fan.fan : null,
		daoJiang: dao,
		huoYao: huo,
		hourBranch: (hourBranch !== undefined && hourBranch !== null) ? hourBranch : null,
	};
}
