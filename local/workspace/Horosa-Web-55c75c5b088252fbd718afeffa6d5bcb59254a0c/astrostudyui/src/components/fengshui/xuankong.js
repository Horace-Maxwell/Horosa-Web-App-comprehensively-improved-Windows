// 玄空飞星派（沈氏）· 下卦/替卦全盘 + 结构断（合十/反吟/伏吟/入囚/三般卦/零正/城门/七星打劫/流年月）。
import { flyChart, flyChartTi, jianXiangByDeg } from './liqiCore';
import { GONG_NAME, GONG_GUA, OPP_GONG, NINE_STAR_MEANING, YUN_YEARS, ROB_GROUPS, FANGWEI_RING,
	XUANKONG_SCHOOLS, WUHUANG_LIANGYUAN } from './fengshuiData';
import { monthCenter } from './zibai';

const OUTER = [1, 2, 3, 4, 6, 7, 8, 9];   // 八外宫（去中5）
const ALL9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WUXING_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

// 当运/失令：星 == 运为当令旺、星 > 运近期可用(生)、否则失令。
function timeliness(star, yun) {
	if (star === yun) { return '当令旺'; }
	if (star === (yun % 9) + 1 || star === ((yun + 1) % 9) + 1) { return '未来生气'; }
	return '失令';
}

// 双星组合断（山·向）：经典凶吉组合(正统古法)优先，余以九星本义 + 五行生克。
const BAD_PAIR = {
	'2·5': '二五交加·疾病损主', '5·2': '五二·重病死亡', '3·7': '斗牛煞·穿心·盗劫官非',
	'7·3': '穿心·口舌劫盗', '6·7': '交剑煞·斗争', '7·6': '交剑·争讼', '2·3': '斗牛·是非官讼',
	'3·2': '斗牛·母子不和', '5·9': '五九·火灾血光', '9·5': '九五·目疾·愚钝', '5·7': '毒药·横死',
	'7·5': '五七·口毒', '5·3': '穷五·破耗', '3·5': '穷困·肝病', '9·7': '回禄·火灾', '7·9': '先天火数·火灾',
	'4·3': '是非·风木相争', '3·4': '木盛·官非', '5·1': '五黄克水·肾耳', '1·5': '一五·中男病',
};
const GOOD_PAIR = {
	'1·4': '文昌·科甲', '4·1': '文昌·名士', '1·6': '官贵·文武双全', '6·1': '六一·武贵生水',
	'6·8': '富贵·武曲生土', '8·6': '财官并茂', '8·9': '婚喜·进财', '9·8': '喜庆·田产',
	'1·8': '一八·进田富', '8·1': '财丁·少男中男', '4·9': '木火通明·文章', '9·4': '文明·科甲',
	'8·8': '当令双旺·财气', '9·9': '双九·喜庆', '1·1': '双一·文秀', '6·6': '双六·武权', '4·6': '四六·文武',
	'9·1': '水火既济·婚喜贵', '1·9': '既济·桃花贵', '6·9': '六九·火照天门(当令荣显)', '9·6': '九六·官贵',
};
// 桃花组（4.21：当令异性缘、失令酒色破败）。
const TAOHUA = new Set(['4·7', '7·4', '1·7', '7·1']);

function comboBrief(shan, xiang) {
	const s = NINE_STAR_MEANING[shan];
	const x = NINE_STAR_MEANING[xiang];
	const pair = `${shan}·${xiang}`;
	if (BAD_PAIR[pair]) { return { pair, note: BAD_PAIR[pair], badge: 'bad' }; }
	if (GOOD_PAIR[pair]) { return { pair, note: GOOD_PAIR[pair], badge: 'good' }; }
	if (TAOHUA.has(pair)) { return { pair, note: '桃花·异性缘(失令酒色破败)', badge: 'mild' }; }
	if (!s || !x) { return { pair, note: '', badge: '' }; }
	// 五行生克（山→向）。
	let rel = '比和';
	if (s.wuxing !== x.wuxing) {
		if (WUXING_SHENG[s.wuxing] === x.wuxing) { rel = '山生向（泄气）'; }
		else if (WUXING_SHENG[x.wuxing] === s.wuxing) { rel = '向生山（生入）'; }
		else if (WUXING_KE[s.wuxing] === x.wuxing) { rel = '山克向'; }
		else { rel = '向克山'; }
	}
	return { pair, note: `${s.name.slice(2)}${x.name.slice(2)}·${rel}`, badge: '' };
}

// 城门诀（4.14）：向首两旁宫，向星当运/生气旺、或运盘与向首合十 → 正/副城门。
function cityGate(xiangPan, yunPan, gXiang, yun) {
	const i = FANGWEI_RING.indexOf(gXiang);
	if (i < 0) { return { available: false }; }
	const sheng = (yun % 9) + 1;
	const evalG = (g)=>{
		const vx = xiangPan[g];
		const wang = (vx === yun || vx === sheng);
		const heShi = (yunPan[g] + yunPan[gXiang] === 10);
		return { gong: g, name: GONG_NAME[g], gua: GONG_GUA[g], xiangStar: vx, wang, heShi, ok: wang || heShi };
	};
	const L = evalG(FANGWEI_RING[(i - 1 + 8) % 8]);
	const R = evalG(FANGWEI_RING[(i + 1) % 8]);
	const rank = (c)=>(c.xiangStar === yun ? 3 : (c.wang ? 2 : (c.heShi ? 1 : 0)));
	let zheng = null; let fu = null;
	if (L.ok || R.ok) {
		const hi = rank(L) >= rank(R) ? L : R;
		const lo = hi === L ? R : L;
		zheng = hi.ok ? hi : null;
		fu = lo.ok ? lo : null;
	}
	return { left: L, right: R, zheng, fu, available: !!(zheng || fu) };
}

// 七星打劫（4.13）：向星三宫(离震乾369真 / 坎巽兑147假)成父母三般卦连珠。
function sevenStarRob(xiangPan) {
	const SETS = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];
	const isSanban = (gongs)=>{
		const v = gongs.map((g)=>xiangPan[g]).slice().sort((a, b)=>a - b);
		return SETS.some((s)=>s[0] === v[0] && s[1] === v[1] && s[2] === v[2]);
	};
	const out = [];
	Object.keys(ROB_GROUPS).forEach((k)=>{
		const grp = ROB_GROUPS[k];
		if (isSanban(grp.gongs)) { out.push({ key: k, name: grp.name, nature: grp.nature, gongs: grp.gongs }); }
	});
	return out;
}

// 紫白年/月入中顺飞九宫。
function flyStar(center) {
	const pan = {}; const idxF = (n)=>(n - 5 + 9) % 9;
	for (let g = 1; g <= 9; g++) { pan[g] = (center - 1 + idxF(g)) % 9 + 1; }
	return pan;
}
function yearCenter(year) {
	let s = String(Math.abs(Math.trunc(Number(year) || 0))).split('').reduce((a, d)=>a + (+d), 0);
	while (s > 9) { s = String(s).split('').reduce((a, d)=>a + (+d), 0); }
	let c = 11 - s; if (c > 9) { c -= 9; } if (c <= 0) { c += 9; }
	return c;
}
// 流年/月会断（4.20）：流年星入宫与宅山向星相会引动。
function huiOf(shanPan, xiangPan, flyPan, label) {
	if (!flyPan) { return []; }
	const out = [];
	for (let g = 1; g <= 9; g++) {
		const set = [shanPan[g], xiangPan[g], flyPan[g]];
		const has = (n)=>set.indexOf(n) >= 0;
		if (flyPan[g] === 5) { out.push({ gong: g, warn: `${label}五黄到·忌动土修造`, jx: 'bad' }); }
		if (has(2) && has(5)) { out.push({ gong: g, warn: `${label}二五交加·病符损主`, jx: 'bad' }); }
		else if (has(3) && has(7)) { out.push({ gong: g, warn: `${label}三七叠临·盗劫官灾`, jx: 'bad' }); }
		else if (has(6) && has(7)) { out.push({ gong: g, warn: `${label}交剑煞·争斗`, jx: 'bad' }); }
		else if (has(1) && has(4)) { out.push({ gong: g, warn: `${label}一四同宫·科名文喜`, jx: 'good' }); }
		else if (has(8) && has(9)) { out.push({ gong: g, warn: `${label}八九·进财添丁婚喜`, jx: 'good' }); }
	}
	return out;
}

// 五黄分运（8.5）：仅改元属标注文案，绝不动下卦飞星字节。
//   xiagua   —— 五运二十年整体作五运论（沈氏多用，默认）。
//   liangyuan —— 五黄分属二·八：前十年归二运(上元)、后十年归八运(下元)（中州/大卦一路）。
function wuHuangNote(yun, split) {
	if (yun !== 5 || split !== 'liangyuan') { return null; }
	const a = WUHUANG_LIANGYUAN.first; const b = WUHUANG_LIANGYUAN.second;
	return {
		split: 'liangyuan',
		text: `五运两元八运：${a.years[0]}–${a.years[1]} 寄${a.yun}运（${a.yuan}）、${b.years[0]}–${b.years[1]} 寄${b.yun}运（${b.yuan}）`,
		segments: [a, b],
	};
}

// 玄空飞星 排盘 + 结构断。
//   opts: {year, month, jian(兼向起替), tiVariant(替星方案), deg(向首度数自动判别), yinYangZhai('yang'|'yin'),
//          school(门派·仅描述与侧重), jianBoundary(起替度界 3|4.5|6), wuHuangSplit('xiagua'|'liangyuan')}。
//   🔴 门派不暗改替星表与度界——古籍只列分歧维度、从不指名归派；三者彼此独立、任意组合。
export function xuankong(yun, xiangShan, opts = {}) {
	const tiVariant = opts.tiVariant || 'shen';
	const school = XUANKONG_SCHOOLS.find((s)=>s.key === opts.school) || null;
	const jianBoundary = [3, 4.5, 6].indexOf(Number(opts.jianBoundary)) >= 0 ? Number(opts.jianBoundary) : 3;
	const wuHuangSplit = opts.wuHuangSplit === 'liangyuan' ? 'liangyuan' : 'xiagua';
	// 兼向度数自动判别(4.5/4.12)：给 deg 则由度数定向首;起卦法(替/下)仍由 opts.jian 主控(下卦零回归)。
	let effXiang = xiangShan; let jianInfo = null;
	if (opts.deg != null && opts.deg !== '' && !Number.isNaN(Number(opts.deg))) {
		jianInfo = jianXiangByDeg(opts.deg, jianBoundary);
		effXiang = jianInfo.xiangShan;
	}
	const jian = !!opts.jian;
	const c = jian ? flyChartTi(yun, effXiang, tiVariant) : flyChart(yun, effXiang);
	if (!c) { return { available: false }; }
	const { yunPan, shanPan, xiangPan, gZuo, gXiang, ge, zuoShan } = c;

	const palaces = [];
	for (let g = 1; g <= 9; g++) {
		palaces.push({
			gong: g, name: GONG_NAME[g], gua: GONG_GUA[g],
			shan: shanPan[g], xiang: xiangPan[g], yun: yunPan[g],
			combo: comboBrief(shanPan[g], xiangPan[g]),
			shanTime: timeliness(shanPan[g], yun), xiangTime: timeliness(xiangPan[g], yun),
		});
	}

	// 反吟/伏吟/合十/入囚。
	const shanFan = OUTER.every((g)=>shanPan[g] === OPP_GONG[g]);
	const shanFu = OUTER.every((g)=>shanPan[g] === g);
	const xiangFan = OUTER.every((g)=>xiangPan[g] === OPP_GONG[g]);
	const xiangFu = OUTER.every((g)=>xiangPan[g] === g);
	const shanHeShi = ALL9.every((g)=>shanPan[g] + yunPan[g] === 10);
	const xiangHeShi = ALL9.every((g)=>xiangPan[g] + yunPan[g] === 10);
	const xiangRuQiu = xiangPan[5] === yun;
	const shanRuQiu = shanPan[5] === yun;

	// 三般卦。
	const groupOf = (n, sets)=>sets.findIndex((s)=>s.indexOf(n) >= 0);
	const PARENT = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];
	const SERIAL = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
	const triSameSet = (sets)=>[1, 2, 3, 4, 6, 7, 8, 9].every((g)=>{
		const a = groupOf(yunPan[g], sets), b = groupOf(shanPan[g], sets), cc = groupOf(xiangPan[g], sets);
		return a >= 0 && a === b && b === cc;
	});
	const fuMuSanBan = triSameSet(PARENT);
	const lianZhuSanBan = triSameSet(SERIAL);

	// 零正。
	const zhengShen = { gong: gXiang, name: GONG_NAME[gXiang], gua: GONG_GUA[gXiang] };
	const lingShen = { gong: OPP_GONG[gXiang], name: GONG_NAME[OPP_GONG[gXiang]], gua: GONG_GUA[OPP_GONG[gXiang]] };

	const flags = [];
	if (shanFan) { flags.push({ key: 'shanFanyin', label: '山盘反吟', nature: 'bad' }); }
	if (shanFu) { flags.push({ key: 'shanFuyin', label: '山盘伏吟', nature: 'bad' }); }
	if (xiangFan) { flags.push({ key: 'xiangFanyin', label: '向盘反吟', nature: 'bad' }); }
	if (xiangFu) { flags.push({ key: 'xiangFuyin', label: '向盘伏吟', nature: 'bad' }); }
	if (shanHeShi) { flags.push({ key: 'shanHeshi', label: '山盘合十', nature: 'good' }); }
	if (xiangHeShi) { flags.push({ key: 'xiangHeshi', label: '向盘合十', nature: 'good' }); }
	if (xiangRuQiu) { flags.push({ key: 'xiangRuqiu', label: '向星入囚', nature: 'bad' }); }
	if (shanRuQiu) { flags.push({ key: 'shanRuqiu', label: '山星入囚', nature: 'bad' }); }
	if (fuMuSanBan) { flags.push({ key: 'fuMuSanBan', label: '父母三般卦', nature: 'good' }); }
	if (lianZhuSanBan) { flags.push({ key: 'lianZhuSanBan', label: '连珠三般卦', nature: 'good' }); }

	// 城门 / 七星打劫。真打劫(离宫369)入吉、假打劫(坎宫147)只作 mild —— nature 照数据层原值，
	// 勿再压平成 good（曾有「三元表达式两分支同值」把假打劫吞成真的写法）。
	const gate = cityGate(xiangPan, yunPan, gXiang, yun);
	const rob = sevenStarRob(xiangPan);
	rob.forEach((r)=>flags.push({ key: `rob_${r.key}`, label: r.name, nature: r.nature }));

	// 流年 / 流月飞星 + 会断（4.20）。
	let yearPan = null; let monthPan = null; let yearHui = null; let monthHui = null;
	if (opts.year) { yearPan = flyStar(yearCenter(opts.year)); yearHui = huiOf(shanPan, xiangPan, yearPan, '流年'); }
	if (opts.year && opts.month) { monthPan = flyStar(monthCenter(opts.year, opts.month)); monthHui = huiOf(shanPan, xiangPan, monthPan, '流月'); }

	// 阴阳宅（4.19）：立向口径提示。
	const yinYangZhai = opts.yinYangZhai === 'yin' ? 'yin' : 'yang';

	// ── 收山出煞（古籍口径·环境合参层）───────────────────────────────────────
	//   opts.shousha = { [gong]: 'shan'|'shui'|'kong'|'gao'|'' }（八方实况：见山/见水/空地/高物）
	//   四原则：旺生山星方宜见山不宜见水（收山）；退死山星方宜见水不宜见山（出煞）；
	//           旺生向星方宜见水不宜见山（收水）；退死向星方宜见山不宜见水（出煞）。
	//   🔴 本层是「形势与理气合参」的独立结论，**不改四大局 ge 的本判**（ge 恒按飞星格局给出）；
	//      古籍另有「能收山出煞者虽上山下水亦吉、不能者虽旺山旺向亦凶」之说，故此处并陈两说不相覆盖。
	let shousha = null;
	if (opts.shousha && typeof opts.shousha === 'object') {
		const sanJi = [yun, (yun % 9) + 1, ((yun + 1) % 9) + 1];   // 当令 + 生气 + 次生（三吉）
		const isWang = (star)=>sanJi.indexOf(star) >= 0;
		const rows = [];
		palaces.forEach((p)=>{
			if (p.gong === 5) { return; }
			const env = opts.shousha[p.gong] || '';
			// 🔴 只认四个合法实况值。杂值既不算见山也不算见水，两面判据会双双落 false，
			//    凭空造出「全违」的凶断 —— 故此处白名单硬闸，非法值等同未录。
			if (['shan', 'gao', 'shui', 'kong'].indexOf(env) < 0) { return; }
			const isShanLike = env === 'shan' || env === 'gao';
			const isShuiLike = env === 'shui' || env === 'kong';
			const shanWang = isWang(p.shan);
			const xiangWang = isWang(p.xiang);
			const hits = [];
			// 山星面
			if (shanWang) {
				hits.push(isShanLike ? { ok: true, text: `山星${p.shan}当旺得山——收山（山上龙神不下水）` }
					: { ok: false, text: `山星${p.shan}当旺却见水空——山上龙神下水` });
			} else {
				hits.push(isShuiLike ? { ok: true, text: `山星${p.shan}退死见水空——出煞` }
					: { ok: false, text: `山星${p.shan}退死却见山高——衰星得山，凶` });
			}
			// 向星面
			if (xiangWang) {
				hits.push(isShuiLike ? { ok: true, text: `向星${p.xiang}当旺得水——收水（水里龙神不上山）` }
					: { ok: false, text: `向星${p.xiang}当旺却见山高——水里龙神上山` });
			} else {
				hits.push(isShanLike ? { ok: true, text: `向星${p.xiang}退死见山高——出煞` }
					: { ok: false, text: `向星${p.xiang}退死却见水空——衰星得水，凶` });
			}
			rows.push({ gong: p.gong, name: p.name, gua: p.gua, env,
				shan: p.shan, xiang: p.xiang, shanWang, xiangWang, hits,
				okN: hits.filter((h)=>h.ok).length, badN: hits.filter((h)=>!h.ok).length });
		});
		const okN = rows.reduce((a, r)=>a + r.okN, 0);
		const badN = rows.reduce((a, r)=>a + r.badN, 0);
		shousha = {
			rows, okN, badN, sanJi,
			verdict: !rows.length ? { text: '未录八方实况——收山出煞须以形势实况判定', jx: 'neutral' }
				: (badN === 0 ? { text: '八方形势与山向星相得——能收山出煞', jx: 'good' }
					: (okN >= badN ? { text: `合${okN}违${badN}——大体能收山出煞，尚有瑕疵`, jx: 'neutral' }
						: { text: `合${okN}违${badN}——不能收山出煞`, jx: 'bad' })),
			note: '古籍另说：能收山出煞者虽上山下水亦吉，不能者虽旺山旺向亦凶。本模块两说并陈——格局仍按飞星本判，此处只出环境合参之结论。',
		};
	}

	return {
		available: true, yun, yunRange: YUN_YEARS[yun], xiangShan: effXiang, zuoShan, ge, shousha,
		gZuo, gXiang, yunPan, shanPan, xiangPan, palaces, flags,
		zhengShen, lingShen, fuMuSanBan, lianZhuSanBan, yearPan, monthPan, yearHui, monthHui,
		gate, rob, jian, tiVariant, jianInfo, yinYangZhai, sameAsXiaGua: c.sameAsXiaGua, method: c.method || '下卦',
		school: school ? { key: school.key, name: school.name, person: school.person, desc: school.desc, focus: school.focus } : null,
		jianBoundary, wuHuangSplit, wuHuang: wuHuangNote(yun, wuHuangSplit),
	};
}
