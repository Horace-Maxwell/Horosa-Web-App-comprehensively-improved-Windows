// 卜卦判读参数「死开关」矩阵审计(L1 层)。
//
// 为什么必须在纯函数层做,而不是在界面上点:
//   这些参数绝大多数是**条件性**的 —— 光线切断要盘上真有「第三星先完成而切断」的格局、
//   四座豁免要月亮空亡且落在金牛/巨蟹/射手/双鱼、汇集要有 collection 格局……
//   随便打开一张卜卦盘去点开关,十有八九一个条件都没碰上,于是「点了没反应」既可能是死开关,
//   也可能只是这张盘没赶上。单盘运行时差分对这类参数天然给不出结论(2026-07-31 实测踩实)。
//
// ── 2026-08-01 复盘:此前「200 张随机盘仍 28 个无差异」的真因(手册 §6 卡点,已解)──
//   ① 探针随机化曾是 no-op:findObj 按小写 id('sun'/'asc')精确匹配,而 fixture 的 id 全是
//      PascalCase('Sun'/'Asc')→ 每个天体都提前 return,「200 张随机盘」实为同一张盘的 201 份
//      逐字节副本。这就是为什么 9 张手工盘 / 200 张随机盘 / 换 digest 口径,28 纹丝不动 ——
//      后两次改动的样本增益是 0。教训:**探针必须自证与基线不同**(见下「探针自证」测试)。
//   ② 相位层不由黄经派生:aspectsEngine 直接读 result.aspects.normalAsp(fixture 手写,仅
//      Moon/Venus 两键)→ 只撒黄经不合成相位表,入相位主干(切断/抢先/撤回/应期)一次都不会
//      被调用。探针现按随机黄经+速度**真算合成** normalAsp / antiscias / receptions ——
//      它们是后端数据的诚实等价物(mover 语义与 fixture 一致:快星条目列被入相星)。
//   ③ 手册原三假设(引擎内部重算 opts / 读 school 预设分支 / 缓存)逐一证伪:runHorary 全程
//      零次调用 horaryJudgeOpts,opts.school 仅回显,无记忆化。
//
// 判据:对每个参数,在一组盘上逐一取值跑 runHorary,任意一张盘产生不同输出即证接线通;
//   一张都没有 → 落 EXPECT_CONTEXT(探针覆盖不到,写明原因)或 KNOWN_DEAD_PENDING
//   (已确证真死、修复待拍板)双账,**精确相等断言**,不允许默默放过。
import { buildMockResult } from '../../election/__tests__/electionFixture';
import { runHorary } from '../horaryEngine';
import { HORARY_PARAM_SPEC, horaryJudgeOpts } from '../horarySchools';
import { CATEGORY_DEF } from '../significators';
import { signOfLon, SIGNS } from '../../data/signs';
import { chartIdOfKey, keyOfChartId } from '../../engine/utils';

const BASE = buildMockResult();

function clone(r){ return JSON.parse(JSON.stringify(r)); }
function findObj(r, id){ return (r.chart.objects || []).find((o) => o.id === id); }
const norm = (x) => ((x % 360) + 360) % 360;

// —— 探针盘组 ——
// 手工造格局覆盖不了这些参数的生效条件(实测 9 张精心构造的盘仍让 28 个参数「无差异」):
// 光线切断要三星恰成序列、汇集要有 collection、撤回要逆行恰好脱离…… 靠人脑枚举必然挂一漏万。
// 改用**确定性随机大样本**(照地占 preflight[57]⑪ 的种子先例):随机撒开行星经度/速度/逆行/
// 上升/昼夜,并同步重建宫位表与相位/映点/容纳,样本量一大,各种格局自然都会出现。
// 种子固定 → 结果可复现,不是碰运气的 flaky 测试。
// 🔴 id 一律用 fixture 的 PascalCase;字段一律用引擎实际读的名字(lonspeed/movedir),
//    sign 置 null 让引擎走 signOfLon(lon) 单源回退 —— 手抄派生字段就是上一版 no-op 的根。
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const OUTERS = ['Uranus', 'Neptune', 'Pluto'];
const MOVING = BODIES.concat(OUTERS);
// 类别键必须取 CATEGORY_DEF 真名(旧版的 parents/illness/money 不存在,静默回落 general,
// parentHousesVariant 的 parentRole 分支因此永不可达)。含 father/mother(转宫)、health
// (patientIsQuerent)、lost/lawsuit(专题模块)以拉开类别覆盖。
const CATS = ['general', 'marriage', 'father', 'mother', 'health', 'wealth', 'career', 'travel', 'lost', 'lawsuit'];

// 线性同余伪随机:同 seed 恒同序列(Math.random 会让失败无法复现)
function lcg(seed){
	let s = seed >>> 0;
	return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const SPEED_BASE = { Sun: 1, Moon: 13, Mercury: 1.2, Venus: 1.2, Mars: 0.6, Jupiter: 0.12, Saturn: 0.11, Uranus: 0.05, Neptune: 0.03, Pluto: 0.02 };

// 等宫自上升(与 fixture 的 15°+30°(i-1) 同构):宫 i 覆盖 [asc+30(i-1), asc+30i)
function houseNumOf(lon, ascLon){ return 1 + Math.floor(norm(lon - ascLon) / 30); }

function setBody(o, lon, ascLon){
	o.lon = lon;
	o.sign = null;                       // 引擎按 signOfLon(lon) 自算,单源
	o.signlon = norm(lon) % 30;
	o.house = 'House' + houseNumOf(lon, ascLon);
	o.aboveHorizon = houseNumOf(lon, ascLon) >= 7;
	// 必然尊贵按新黄经重算 —— SIGNS 自带 domicile/exaltation/detriment/fall 完整单源表,
	// 四种尊贵全部真算(fixture 手写的 selfDignity 与随机黄经已不符,必须重建)。
	const sg = SIGNS[signOfLon(lon)] || {};
	const key = keyOfChartId(o.id);
	const dig = [];
	if(sg.domicile === key){ dig.push('ruler'); }
	if(sg.exaltation && sg.exaltation.planet === key){ dig.push('exalt'); }
	if(Array.isArray(sg.detriment) && sg.detriment.indexOf(key) >= 0){ dig.push('exile'); }
	if(sg.fall === key){ dig.push('fall'); }
	o.selfDignity = dig;
}

// 宫位表重建:sign/ruler 由 SIGNS.domicile 单源推出(chartFacts 会 keyOfChartId 归一),
// planets 按各天体新落宫归位 —— lord1/事项主随上升真变,同主一星等格局才可能出现。
function rebuildHouses(r, ascLon){
	const hm = {};
	for(let i = 1; i <= 12; i++){
		const lon = norm(ascLon + (i - 1) * 30);
		const sign = signOfLon(lon);
		hm['House' + i] = { sign, lon, ruler: chartIdOfKey(SIGNS[sign].domicile), planets: [] };
	}
	(r.chart.objects || []).forEach((o) => {
		if(o.id === 'Asc' || o.id === 'MC' || o.id === 'Desc' || o.id === 'IC'){ return; }
		const h = 'House' + houseNumOf(o.lon, ascLon);
		o.house = h;
		hm[h].planets.push(o.id);
	});
	r.houseMap = hm;
}

// 相位合成:按随机黄经真算(0/60/90/120/180,容许 6°),入/出相由相对速度决定
// (夹角是否在收窄)。条目挂在 mover(|速度| 更大者)名下 —— 与 fixture 及 aspectsEngine
// 头注的语义一致:「X.Applicative = X 正入相位这些星」。
const ASPECT_ANGLES = [0, 60, 90, 120, 180];
const MAX_ORB = 6;
function synthAspects(r){
	const na = {};
	const bodies = MOVING.map((id) => findObj(r, id)).filter(Boolean);
	for(let a = 0; a < bodies.length; a++){
		for(let b = a + 1; b < bodies.length; b++){
			const A = bodies[a], B = bodies[b];
			const s = norm(A.lon - B.lon);
			const ang = s > 180 ? 360 - s : s;
			let best = null;
			ASPECT_ANGLES.forEach((x) => {
				const orb = Math.abs(ang - x);
				if(orb <= MAX_ORB && (!best || orb < best.orb)){ best = { asp: x, orb }; }
			});
			if(!best){ continue; }
			const rel = A.lonspeed - B.lonspeed;         // d(s)/dt, s = lonA − lonB
			const dAng = s > 180 ? -rel : rel;           // d(夹角)/dt
			const applying = best.orb < 0.05 ? true : (ang > best.asp ? dAng < 0 : dAng > 0);
			const mover = Math.abs(A.lonspeed) >= Math.abs(B.lonspeed) ? A : B;
			const other = mover === A ? B : A;
			const entry = na[mover.id] = na[mover.id] || { Applicative: [], Separative: [], Exact: [], None: [], Obvious: [] };
			const rec = { id: other.id, asp: best.asp, orb: Math.round(best.orb * 100) / 100 };
			if(best.orb <= 0.05){ entry.Exact.push(rec); }
			else if(applying){ entry.Applicative.push(rec); }
			else { entry.Separative.push(rec); }
		}
	}
	return na;
}

// 映点合成:λ' = 180 − λ(至点轴镜像,白羊↔处女);|λ'A − λB| ≤ 1.5° 记一对。
function synthAntiscia(r){
	const out = [];
	const bodies = MOVING.map((id) => findObj(r, id)).filter(Boolean);
	for(let a = 0; a < bodies.length; a++){
		for(let b = 0; b < bodies.length; b++){
			if(a === b){ continue; }
			const mirror = norm(180 - bodies[a].lon);
			let d = Math.abs(norm(mirror - bodies[b].lon));
			if(d > 180){ d = 360 - d; }
			if(d <= 1.5){ out.push([bodies[a].id, bodies[b].id, Math.round(d * 100) / 100]); }
		}
	}
	return out;
}

// 容纳合成:只出「庙容纳」(A 落在 R 的庙座 → R 收 A)—— domicile 有单源表可诚实推出;
// 界/曜升等容纳无前端单源表,不臆造(fixture 手写的界容纳与新黄经已不符,一并弃用)。
function synthReceptions(r){
	const normal = [];
	MOVING.forEach((id) => {
		const o = findObj(r, id);
		if(!o){ return; }
		const host = SIGNS[signOfLon(o.lon)] && SIGNS[signOfLon(o.lon)].domicile;
		if(host && host !== keyOfChartId(id)){
			normal.push({ beneficiary: id, beneficiaryDignity: [], supplier: chartIdOfKey(host), supplierRulerShip: ['ruler'] });
		}
	});
	return { normal, abnormal: [] };
}

function randomProbe(seed){
	const rnd = lcg(seed);
	const r = clone(BASE);
	// 上升与四轴(Desc/IC 保持对冲自洽;MC 独立随机)。
	// 🔴 四轴的 sign 必须写真值,不能像行星那样置 null 走回退:chartFacts 的 meta.ascSign 是
	//    `String(asc.sign).toLowerCase()` **无 lon 回退**,置 null 会变成字符串 'null' →
	//    ascRulerKey 恒 null → querentKey 恒 null → analyzePerfection「征象星不全」早退,
	//    完成法/应期/切断/撤回/冲相整族被探针自己毒死(首轮诊断实测 17 死,其中一大族即此因)。
	const ascLon = rnd() * 360;
	const mcLon = norm(ascLon + 230 + rnd() * 80);
	[['Asc', ascLon], ['Desc', norm(ascLon + 180)], ['MC', mcLon], ['IC', norm(mcLon + 180)]].forEach(([id, lon]) => {
		const o = findObj(r, id);
		if(o){ o.lon = lon; o.sign = signOfLon(lon); o.signlon = norm(lon) % 30; }
	});
	// 十曜:黄经/速度/逆行(三成,日月除外)
	MOVING.forEach((id) => {
		const o = findObj(r, id);
		if(!o){ return; }
		const lon = rnd() * 360;
		const retro = rnd() < 0.3 && id !== 'Sun' && id !== 'Moon';
		setBody(o, lon, ascLon);
		o.movedir = retro ? 'Retrograde' : 'Direct';
		o.lonspeed = (retro ? -1 : 1) * SPEED_BASE[id] * (0.4 + rnd() * 1.2);
	});
	// 月亮空亡旗随机化:vocMode='classic'(默认档)读的是后端旗 m.isVOC(chartFacts:74 直透),
	// fixture 恒 false → 不随机化则 classic 档 voc 恒 false,vocMitigateSigns(需 voc===true
	// 且月落四豁免座)结构性不可达 —— 首轮诊断 dead 名单里它就是这个死法。
	const moonObj = findObj(r, 'Moon');
	if(moonObj){ moonObj.isVOC = rnd() < 0.5; }
	// 映点注入:随机 2 对强制互为映点(λ' ≈ 180−λ)。两随机星恰成映点(orb≤1.5°)概率 <1%/张,
	// 不注入则 perfection 的映点促成分支(method='antiscion',antiscia 开关门控)在 200 张里探不到。
	for(let k = 0; k < 2; k++){
		const ai = Math.floor(rnd() * MOVING.length);
		let bi = Math.floor(rnd() * MOVING.length);
		if(bi === ai){ bi = (bi + 1) % MOVING.length; }
		const ao = findObj(r, MOVING[ai]);
		const bo = findObj(r, MOVING[bi]);
		if(ao && bo){ setBody(bo, norm(180 - ao.lon + (rnd() - 0.5) * 1.6), ascLon); }
	}
	// 南北交成对对冲
	const nn = findObj(r, 'North Node');
	if(nn){
		setBody(nn, rnd() * 360, ascLon);
		const sn = findObj(r, 'South Node');
		if(sn){ setBody(sn, norm(nn.lon + 180), ascLon); }
	}
	// 宫位表 + 派生数据层(相位/映点/容纳)整体重建
	rebuildDerived(r, ascLon);
	// 昼夜/时主/日主/星期随机(宗派、时主一致、行星日分支)
	r.chart.isDiurnal = rnd() < 0.5;
	r.chart.timerStar = BODIES[Math.floor(rnd() * BODIES.length)];
	r.chart.dayerStar = BODIES[Math.floor(rnd() * BODIES.length)];
	r.chart.dayofweek = Math.floor(rnd() * 7);
	return { name: 'rnd#' + seed, r, cat: CATS[seed % CATS.length] };
}

// 派生数据层整体重建(宫位表/相位/映点/容纳)—— randomProbe 与剧本盘共用,防双份漂移。
function rebuildDerived(r, ascLon){
	rebuildHouses(r, ascLon);
	r.aspects = { normalAsp: synthAspects(r) };
	r.antiscias = synthAntiscia(r);
	r.receptions = synthReceptions(r);
}

// 结构剧本盘:「命主/事主=太阳 且 另一征象星对太阳 applying 合相」在纯随机盘上联合概率 ~1%,
// 可达性全靠碰运气(三诊实证:映点注入重摆星位后 combustExemptConjAnswer 从活变死)。
// 剧本:狮子上升(命主=太阳)+ cat=marriage(等宫 7 宫头=水瓶,事主=土星)+ 土星摆在太阳
// 前方 1–4° 顺行(mover=太阳,入相合;角距 <8.5° 必燃烧)→ 「合日即所求」豁免分支结构性可达。
function scenarioSunConjProbe(seed){
	const rnd = lcg(seed * 13 + 5);
	const p = randomProbe(seed * 31 + 7);
	const r = p.r;
	const ascLon = 122 + rnd() * 26;			// 狮子 2°–28°
	[['Asc', ascLon], ['Desc', norm(ascLon + 180)], ['MC', norm(ascLon + 260)], ['IC', norm(ascLon + 80)]].forEach(([id, lon]) => {
		const o = findObj(r, id);
		if(o){ o.lon = lon; o.sign = signOfLon(lon); o.signlon = norm(lon) % 30; }
	});
	// 四轴变了 → 全部星体按新上升重派生落宫/地平(lon 不变,只重算派生字段)
	MOVING.forEach((id) => {
		const o = findObj(r, id);
		if(o){ setBody(o, o.lon, ascLon); }
	});
	const sun = findObj(r, 'Sun');
	const sat = findObj(r, 'Saturn');
	if(sun && sat){
		setBody(sat, norm(sun.lon + 1 + rnd() * 3), ascLon);
		sat.movedir = 'Direct';
		sat.lonspeed = SPEED_BASE.Saturn;
	}
	rebuildDerived(r, ascLon);
	return { name: 'sun-conj#' + seed, r, cat: 'marriage' };
}

const PROBE_COUNT = 200;
const SCENARIO_COUNT = 12;
let _probes = null;
function probes(){
	if(_probes){ return _probes; }
	_probes = [{ name: '基线', r: clone(BASE), cat: 'general' }];
	for(let i = 1; i <= PROBE_COUNT; i++){ _probes.push(randomProbe(i * 7919)); }
	for(let i = 1; i <= SCENARIO_COUNT; i++){ _probes.push(scenarioSunConjProbe(i)); }
	return _probes;
}

// 输出摘要:**全量** stringify。
// ⚠ 初版手挑了 verdict/testimonies/score 等字段,其中 testimonies 与 score 在引擎里**根本不存在**,
//   digest 于是恒等,28 个参数被一股脑误判成死开关。runHorary 是纯函数(同输入同输出),
//   全量摘要没有非确定性风险,也不会因为漏挑字段而假绿 —— 手挑字段就是给自己留假绿的口子。
function digest(j){
	if(!j){ return 'null'; }
	try{ return JSON.stringify(j); }
	catch(e){ return 'ERR:' + String(e); }
}

// 二级门控参数:它们只有在「门」开着时才进分支 ——「一次只改一个参数」的矩阵设计对这类参数
// **结构性不可达**(partileDef 被 accidentalMode==='lilly' 门控、refranationIncludeSignChange
// 被 refranationAsDestruction 门控)。这是测试设计缺陷,不是引擎死:差分这些键时把门显式打开。
const GATED = {
	partileDef: { accidentalMode: 'lilly' },
	refranationIncludeSignChange: { refranationAsDestruction: true },
	// vocIncludeOuter 仅作用于前端解算的四模式(moon.js:38 注释成文);默认档 vocMode='classic'
	// 读后端 isVOC 旗不走 moonApps → 单独改它结构性无差异,须配 kenodromia 档才可达。
	vocIncludeOuter: { vocMode: 'kenodromia' },
};

// 在一组盘上跑某参数的全部取值;存在任一差异即早停(anyDiff 是存在量词,语义不变、省一个量级时间)
function variance(param){
	const values = param.type === 'switch'
		? [true, false]
		: (param.options || []).map((o) => o.value);
	if(values.length < 2){ return { values: values.length, anyDiff: false }; }
	const all = probes();
	for(let i = 0; i < all.length; i++){
		const p = all[i];
		const seen = new Set();
		for(let j = 0; j < values.length; j++){
			const opts = { ...horaryJudgeOpts('classical'), ...(GATED[param.key] || {}), [param.key]: values[j] };
			let d;
			try{ d = digest(runHorary(clone(p.r), p.cat, opts)); }
			catch(e){ d = 'THROW:' + String(e).slice(0, 60); }
			seen.add(d);
			if(seen.size > 1){ return { values: values.length, anyDiff: true, firstProbe: p.name }; }
		}
	}
	return { values: values.length, anyDiff: false };
}

// 已知「本探针组覆盖不到」的参数 —— 必须写清原因,不允许空着敷衍过去。
const EXPECT_CONTEXT = {
	hsys: '起盘期宫制:由后端排盘决定宫位,判读引擎收到的已是排好的盘,故在纯函数层恒无差异(接线锁见 horaryParamsWiring)',
	termsVariant: '同上:界系在排盘期生效,引擎读的是已定界的盘',
	geminiBoundEmended: '同上:仅改双子座界表,须排盘期生效且征象星落双子 21–30° 才显形',
	tradition: '同上:星群(是否含三王星)在排盘期决定 objects 集合',
};

// 已确证「真死、修复待拍板」的参数(与 EXPECT_CONTEXT 语义不同:这里每一条都是实锤的
// 接线断裂,登记只为让矩阵可运行地守住「不再新增死开关」,绝非豁免 —— 修掉一条就删一条,
// 修完即空表,断言随之收敛回「零死开关」)。僵尸登记(修好了还挂着)同样判红。
const KNOWN_DEAD_PENDING = {};
// combustMitigateSameSign 已于 2026-08-02 经用户拍板修复销账(chartFacts combustionState 加
// 同座门:显式 true 才限,异座近日降级 under_beams;不传 opts 的世俗/寿限/返照旧行为字节不变)。

describe('卜卦判读参数矩阵审计', () => {
	const params = HORARY_PARAM_SPEC.filter((p) => p && p.key);

	test('参数表非空且带取值域(表被清空时不该假绿)', () => {
		expect(params.length).toBeGreaterThan(15);
	});

	// —— 探针自证(上一版的教训:随机化 no-op 时,一切矩阵结论都是幻觉) ——
	test('探针自证:每张随机盘都真的不同于基线,且相位表随黄经变化', () => {
		const all = probes();
		const baseDigest = digest(BASE);
		const sameAsBase = all.slice(1).filter((p) => digest(p.r) === baseDigest);
		expect(sameAsBase.map((p) => p.name)).toEqual([]);	// 100% 不同,一张都不许等于基线
		// 相位表本身也必须张张有别(≥95% 互异;两张盘恰好同表在 45 对×6° 容许下概率趋零)
		const aspDigests = new Set(all.slice(1, 51).map((p) => digest(p.r.aspects.normalAsp)));
		expect(aspDigests.size).toBeGreaterThanOrEqual(48);
		// 入相与出相两种状态都必须真实出现(只有一种=applying 判定失灵)
		let hasApp = false, hasSep = false;
		all.slice(1, 31).forEach((p) => {
			Object.keys(p.r.aspects.normalAsp).forEach((k) => {
				if(p.r.aspects.normalAsp[k].Applicative.length){ hasApp = true; }
				if(p.r.aspects.normalAsp[k].Separative.length){ hasSep = true; }
			});
		});
		expect({ hasApp, hasSep }).toEqual({ hasApp: true, hasSep: true });
	}, 120000);

	test('探针自证:类别键全部真实存在于 CATEGORY_DEF(不存在的键会静默回落 general)', () => {
		const missing = CATS.filter((k) => !CATEGORY_DEF[k]);
		expect(missing).toEqual([]);
	});

	test('🔴 每个判读期参数都必须改变输出,或落显式双账(新死开关=红;已修未销账=红)', () => {
		const dead = [];
		params.forEach((p) => {
			if(EXPECT_CONTEXT[p.key]){ return; }          // 已登记原因者跳过
			const v = variance(p);
			if(v.values < 2){ return; }                    // 单值参数无从差分
			if(!v.anyDiff){ dead.push(`${p.key}(${p.label})`); }
		});
		const registered = Object.keys(KNOWN_DEAD_PENDING).map((k) => {
			const p = params.find((x) => x.key === k);
			return `${k}(${p ? p.label : '?'})`;
		});
		expect(dead.sort()).toEqual(registered.sort());
	}, 600000);

	test('登记表里的每一条都必须写明原因(不允许空字符串敷衍)', () => {
		Object.keys(EXPECT_CONTEXT).forEach((k) => {
			expect(String(EXPECT_CONTEXT[k] || '').length).toBeGreaterThan(10);
		});
		Object.keys(KNOWN_DEAD_PENDING).forEach((k) => {
			expect(String(KNOWN_DEAD_PENDING[k] || '').length).toBeGreaterThan(10);
		});
	});
});
