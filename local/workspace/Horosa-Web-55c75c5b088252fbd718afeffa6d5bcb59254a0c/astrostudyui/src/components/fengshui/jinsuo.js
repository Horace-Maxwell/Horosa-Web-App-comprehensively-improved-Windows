// 金锁玉关（过路阴阳）· 八方砂水 + 得位/失位 + 断语。
// 核心原则:后天 1234(坎坤震巽)要砂主丁、6789(乾兑艮离)要水主财(7.A.1);48 细断逐卦含义(7.A.5)。
// 注:与现有「纳气盘 6789=气位」是不同体系,不可混用。
import { HOUTIAN_POS, POS_NAME, ZIBAI_STAR, YUN_YEARS } from './fengshuiData';
import { zibaiYearCenter } from './liqiCore';
import { JINSUO_SHAN_DUAN, JINSUO_GONG_QUAN, JINSUO_KUA_GONG, JINSUO_XING, JINSUO_DUANJUE_NOTE } from './fengshuiJinsuoDuanjue';

// 24 山按宫分组（断诀库以山为粒度，本文件以宫为粒度，此表是两者的桥）。
const GUA_SHANS = {
	坎: ['壬', '子', '癸'], 坤: ['未', '坤', '申'], 震: ['甲', '卯', '乙'], 巽: ['辰', '巽', '巳'],
	乾: ['戌', '乾', '亥'], 兑: ['庚', '酉', '辛'], 艮: ['丑', '艮', '寅'], 离: ['丙', '午', '丁'],
};

// 24 山实况 → 八宫实况。显式给了 sectors 的宫以 sectors 为准；否则由三山归纳：
// 🔴 三山一致才作该宫之实况，参差者作「未定(flat)」并标 mixed —— 不臆断哪一山说了算。
function sectorsFromShans(shans, sectors) {
	const out = {}; const mixed = [];
	Object.keys(GUA_SHANS).forEach((gua)=>{
		const vals = GUA_SHANS[gua].map((s)=>shans[s] || 'flat');
		const nonFlat = vals.filter((v)=>v !== 'flat');
		// 🔴 三山一个都没录的宫才退回八方档。若按 `sectors[gua]` 真值先判，
		//    八方档遗留的 'flat'（非空串＝truthy）会把细式录入整宫吞掉 —— 典型死开关。
		if (!nonFlat.length) { out[gua] = (sectors && sectors[gua]) || 'flat'; return; }
		const uniq = Array.from(new Set(nonFlat));
		if (uniq.length === 1) { out[gua] = uniq[0]; return; }
		out[gua] = 'flat';
		mixed.push(gua);
	});
	return { sectors: out, mixed };
}

// 条件满足判定：req 登记的是「某山须为砂/水」，any=true 表任一命中即可。
function reqHit(w, shans) {
	if (!w || !Array.isArray(w.req) || !w.req.length) { return false; }
	const one = (r)=>(shans[r.shan] || 'flat') === r.side;
	return w.any ? w.req.some(one) : w.req.every(one);
}

// 断诀查检（24 山粒度）。只出断语，不改得位/失位之判。
//   shans: {山: 'sand'|'water'|'flat'}；xings: {山: 形态key}（形态条件命中才并入）。
function duanjueOf(shans, xings, effSectors) {
	const rows = [];
	Object.keys(JINSUO_SHAN_DUAN).forEach((shan)=>{
		const actual = shans[shan] || 'flat';
		if (actual === 'flat') { return; }
		const meta = JINSUO_SHAN_DUAN[shan];
		const side = actual === 'water' ? 'shui' : 'sha';
		const d = meta[side];
		if (!d) { return; }
		const xingKey = xings[shan] || '';
		const xingLabel = (JINSUO_XING.find((x)=>x.key === xingKey) || {}).label || '';
		const fired = []; const conds = [];
		d.when.forEach((w)=>{
			if (w.kind === 'zhao') {
				if (reqHit(w, shans)) { fired.push({ ...w, by: '对照命中' }); } else { conds.push(w); }
			} else if (w.kind === 'xing') {
				// 形态条件：左栏选中的形与该条件文字相扣才算命中（未选＝只列为待验条件）。
				if (xingLabel && (w.cond.indexOf(xingLabel) >= 0 || xingLabel.indexOf(w.cond) >= 0)) { fired.push({ ...w, by: '形态命中' }); } else { conds.push(w); }
			} else { conds.push(w); }
		});
		const need = ['坎', '坤', '震', '巽'].indexOf(meta.gua) >= 0 ? 'sand' : 'water';
		rows.push({
			shan, gua: meta.gua, actual, side, deWei: actual === need,
			base: d.base, fang: d.fang, xing: xingLabel,
			fired, conds,
			text: [d.base].concat(fired.map((f)=>`（${f.cond}）${f.text}`)).join('；'),
		});
	});
	// 本宫全砂/全水
	//   「都是水/全是砂」＝三山逐一录满该值；一山未录即不算（不足而断＝造假阳）。
	const quan = (gua, want)=>{
		const vals = GUA_SHANS[gua].map((s)=>shans[s] || 'flat');
		if (vals.every((v)=>v === want)) { return true; }
		return vals.every((v)=>v === 'flat') && effSectors[gua] === want;   // 该宫未录细式 → 退回八方档
	};
	const gongQuan = JINSUO_GONG_QUAN.filter((g)=>quan(g.gua, g.side === 'shui' ? 'water' : 'sand'))
		.map((g)=>({ ...g, extraFired: g.extra && reqHit(g.extra, shans) ? g.extra : null }));
	// 跨宫组合
	const kuaGong = JINSUO_KUA_GONG.filter((k)=>k.guas.every((gua)=>quan(gua, k.side === 'shui' ? 'water' : 'sand')));
	return { rows, gongQuan, kuaGong, note: JINSUO_DUANJUE_NOTE };
}

// 后天宫数 → 卦。
const GONG_GUA8 = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
const SAND_GONG = new Set([1, 2, 3, 4]);    // 要砂(主丁)
const WATER_GONG = new Set([6, 7, 8, 9]);   // 要水(主财)
// 八卦得位/失位简断（人物·应事;金锁玉关二十四山砂水诀，公有）。
const JINSUO_DESC = {
	坎: { de: '中男聪秀·肾耳健·进田', shi: '中男损·肾耳血疾·漂荡' },
	坤: { de: '老母旺·田产丰·人丁众', shi: '老母病·腹疾·寡居' },
	震: { de: '长男发·权威·足健', shi: '长男损·肝足·官非' },
	巽: { de: '长女贵·文昌·风发', shi: '长女病·风疾·自缢' },
	乾: { de: '老父贵·官禄·财丰', shi: '老父损·头疾·破财' },
	兑: { de: '少女悦·口才·偏财', shi: '少女损·口喉·盗劫' },
	艮: { de: '少男旺·田宅·孝义', shi: '少男损·脾鼻·小口' },
	离: { de: '中女丽·文明·进财', shi: '中女病·目疾·心火·官讼' },
};

// 紫白流年星入中顺飞九宫（与 zibai/xuankong 同一飞法）。
const XIONG_STARS = new Set([2, 3, 5, 7]);   // 二黑病符·三碧蚩尤·五黄廉贞·七赤破军
function flyStar(center) { const pan = {}; const f = (n)=>(n - 5 + 9) % 9; for (let g = 1; g <= 9; g++) { pan[g] = (center - 1 + f(g)) % 9 + 1; } return pan; }
// 自 fromYear 起找该宫「本卦星飞临本宫」的年份（九年一循环）。
function nextBenGuaYears(gong, fromYear, count = 3) {
	const out = [];
	for (let y = fromYear; y < fromYear + 9 && out.length < count; y++) {
		if (flyStar(zibaiYearCenter(y))[gong] === gong) { out.push(y); }
	}
	// 九年周期：补足后续
	while (out.length && out.length < count) { out.push(out[out.length - 1] + 9); }
	return out;
}

// 金锁玉关排盘：八方各「砂/水/平」→ 逐方得位失位 + 断 + 化解 + 应期。
//   sectors: {坎:'sand'|'water'|'flat', …}；yun/year 给了才出应期（缺省零回归）。
//   应期(7.A.7)：得位之方逢其卦当运或流年本卦星飞临 → 吉应显；失位之方逢凶星飞临 → 灾应。
export function jinsuo({ sectors = {}, shans = null, xings = {}, yun, year } = {}) {
	// 24 山细式（additive）：给了 shans 才启用；不给时与旧路逐字节等（零回归）。
	const hasShan = !!shans && typeof shans === 'object' && Object.keys(shans).some((k)=>shans[k] && shans[k] !== 'flat');
	const derived = hasShan ? sectorsFromShans(shans, sectors) : null;
	const effSectors = derived ? derived.sectors : sectors;
	const hasYun = yun != null && yun !== '' && !Number.isNaN(Number(yun));
	const hasYear = year != null && year !== '' && !Number.isNaN(Number(year));
	const yunN = hasYun ? Math.trunc(Number(yun)) : null;
	const yearN = hasYear ? Math.trunc(Number(year)) : null;
	const yearPan = hasYear ? flyStar(zibaiYearCenter(yearN)) : null;
	const palaces = [];
	for (let g = 1; g <= 9; g++) {
		if (g === 5) { continue; }
		const gua = GONG_GUA8[g];
		const actual = effSectors[gua] || 'flat';
		const need = SAND_GONG.has(g) ? 'sand' : 'water';
		const deWei = actual === need;
		const wantsSand = need === 'sand';
		const d = JINSUO_DESC[gua];
		let desc; let remedy = null;
		if (actual === 'flat') { desc = `平洋未现，${wantsSand ? '宜实起砂' : '宜低见水'}`; }
		else if (deWei) { desc = `得位·${d.de}`; }
		else {
			desc = `失位·${d.shi}`;
			remedy = wantsSand ? '宜填实堆高（砂宫见水→填实化解）' : '宜疏低引水（水宫见砂→疏导化解）';
		}
		const p = {
			gong: g, gua, dir: POS_NAME[g], need, needLabel: wantsSand ? '要砂(主丁)' : '要水(主财)',
			actual, deWei, desc, remedy,
		};
		if (hasYun || hasYear) {
			const yunHit = hasYun && yunN === g;
			const yearStar = yearPan ? yearPan[g] : null;
			const yearHit = yearStar === g;
			const badHit = yearStar != null && XIONG_STARS.has(yearStar);
			// 触发因（当运/本星飞临）与本年星况分开叙述，避免吉应句里夹一句凶星读作矛盾。
			const trig = [];
			if (yunHit) { trig.push(`${ZIBAI_STAR[g]}当运（${yunN}运 ${YUN_YEARS[yunN] ? `${YUN_YEARS[yunN][0]}–${YUN_YEARS[yunN][1]}` : ''}）`); }
			if (hasYear && yearHit) { trig.push(`${yearN} 年${ZIBAI_STAR[g]}飞临本宫`); }
			const yearNote = (hasYear && !yearHit && yearStar != null)
				? `${yearN} 年${ZIBAI_STAR[yearStar]}到${badHit ? '，动土修造须避' : ''}` : '';
			const tail = (s)=>(yearNote ? `${s}；${yearNote}` : s);
			let jx = 'neutral'; let text;
			if (actual === 'flat') { text = tail('砂水未现，应期待定'); }
			else if (deWei && (yunHit || yearHit)) { jx = 'good'; text = tail(`得位逢时·吉应显（${trig.join('；')}）`); }
			else if (!deWei && badHit) { jx = 'bad'; text = `失位又逢凶星·灾应（${yearN} 年${ZIBAI_STAR[yearStar]}到）`; }
			else if (deWei) { text = tail('得位待时（未逢当运，本星未临）'); }
			else { text = tail('失位未逢凶星'); }
			p.yearStar = yearStar;
			p.yingqi = { jx, text, yunHit, yearHit, badHit, nextYears: hasYear ? nextBenGuaYears(g, yearN) : [] };
		}
		palaces.push(p);
	}
	const deCount = palaces.filter((p)=>p.deWei).length;
	const duanjue = hasShan ? duanjueOf(shans, xings || {}, effSectors) : null;
	return {
		available: true, palaces,
		deCount, score: Math.round(deCount / 8 * 100),
		remedies: palaces.filter((p)=>p.remedy).map((p)=>`${p.dir}：${p.remedy}`),
		yun: yunN, year: yearN, yearPan,
		granularity: hasShan ? 'shan24' : 'gong8', shans: hasShan ? shans : null,
		mixedGuas: derived ? derived.mixed : [], duanjue,
		yingqiList: (hasYun || hasYear) ? palaces.filter((p)=>p.yingqi && p.yingqi.jx !== 'neutral').map((p)=>({ dir: p.dir, gua: p.gua, ...p.yingqi })) : [],
		note: '1234坎坤震巽要砂主丁、6789乾兑艮离要水主财;得位吉失位凶'
			+ (hasShan ? ';24山细式(三山参差之宫作未定)' : '')
			+ ((hasYun || hasYear) ? ';应期配元运与流年九星' : ';填元运/流年可出应期'),
	};
}
