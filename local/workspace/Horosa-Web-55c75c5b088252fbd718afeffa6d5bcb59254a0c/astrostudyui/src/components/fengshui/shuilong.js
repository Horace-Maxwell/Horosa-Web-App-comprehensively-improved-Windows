// 风水 · 水龙（平洋）形势判定引擎。古籍水龙一路：以水为龙、取支不取干、得水为先。
// 🔴 与山龙形势（xingshi.js）并行两路，互不复用判据（五星吉凶、穴后高低、开面判据均相反）。
import {
	LONGFA_SPLIT, PINGGANG_RULE, GAOCUN_RULE, SHUILONG_4JI, CHAJIE_GUIMO, XUANWU_SHUI, SHUILONG_SHA,
	SHUI_8JI_ZI, SHUI_8XIONG_ZI, SHUILONG_XUE_6, SHUI_BU_WEI_XUE, PINGYANG_KAIMIAN, SHUILONG_3GE,
	XIDAO_LOUDAO, HUANBAO_GRADE, ZHUANZHE_GRADE, XIU_CHI_LONG, SHUIXUE_HOUKONG, SHUIXUE_ZANGFA,
	ZHAOSHEN, PINGYANG_4, SHUILONG_JIGE, SHUILONG_XIONGGE, SHUILONG_WUXING, SHUILONG_NOTE, SHUI_PRIORITY,
	DIXING_EQUIV_NOTE,
} from './fengshuiShuilongData';

const gradeOf = (total)=>{
	if (total >= 10) { return { text: '水龙真结·富贵无双之局', jx: 'good' }; }
	if (total >= 5) { return { text: '合法可用·美地', jx: 'good' }; }
	if (total >= 1) { return { text: '小结可用·须细察剪裁', jx: 'neutral' }; }
	if (total >= -3) { return { text: '平常存疑·非真结', jx: 'neutral' }; }
	return { text: '气散水劫·难以结作', jx: 'bad' };
};

// 分派：地形 → 山龙/水龙（平冈按见水与否二次判定）。
export function fenPai(dixing, pingGangJianShui) {
	const hit = LONGFA_SPLIT.find((x)=>x.dixing === dixing);
	if (!hit) { return null; }
	if (hit.fa !== 'ask') { return { fa: hit.fa, label: hit.label, by: '地形直判' }; }
	const r = pingGangJianShui ? PINGGANG_RULE.jianShui : PINGGANG_RULE.buJianShui;
	return { fa: r.fa, label: r.fa === 'shui' ? '水龙（平洋龙）' : '山龙', by: r.text };
}

// 环抱重数 / 转折数 → 档位。
const gradeByN = (table, n)=>{
	const v = Math.max(0, Math.trunc(Number(n) || 0));
	let hit = null;
	table.forEach((t)=>{ if (v >= t.n) { hit = t; } });
	return hit;
};

// 水龙主入口。
//   { dixing, pingGangJianShui, ji(四级), xuanwu, chanRao(层数), jiZi[], xiongZi[],
//     xueXing, geKey, xidao, huanbao, zhuanzhe, xiuchi, houKong, zhaoshen, jiGe, xiongGe, wuxing, yun }
export function shuilong({
	dixing = '平原', pingGangJianShui = null, ji = '', xuanwu = '', chanRao = 1,
	jiZi = [], xiongZi = [], xueXing = '', geKey = '', xidao = '', huanbao = 0, zhuanzhe = 0,
	xiuchi = '', houKong = null, zhaoshen = '', jiGe = '', xiongGe = '', wuxing = '',
} = {}) {
	const pai = fenPai(dixing, pingGangJianShui);
	if (!pai) { return { available: false }; }

	const items = [];
	const push = (key, name, verdict, score, jx, detail)=>items.push({ key, name, verdict, score, jx, detail });

	// ① 玄武之水（水龙之龙）
	if (xuanwu) {
		const ok = xuanwu === 'rao';
		push('xuanwu', '玄武之水（龙身）', ok ? XUANWU_SHUI.good : XUANWU_SHUI.bad, ok ? 2 : -2, ok ? 'good' : 'bad', XUANWU_SHUI.def);
	}
	// ② 四级与取支不取干
	const jiHit = SHUILONG_4JI.find((x)=>x.name === ji) || null;
	if (jiHit) {
		const isGan = jiHit.name.indexOf('干龙') >= 0;
		push('ji', '水龙四级', `${jiHit.name}${isGan ? '（干龙气未脱杀，须支水插界方结）' : '（支水屈曲情相得，穴法取支不取干）'}`,
			isGan ? -1 : 1, isGan ? 'bad' : 'good', jiHit.def);
	}
	// ③ 缠护层数
	const ceng = SHUILONG_SHA.ceng.filter((c)=>c.n <= Math.max(1, Math.trunc(Number(chanRao) || 1)));
	if (ceng.length) {
		const top = ceng[ceng.length - 1];
		push('chanrao', '枝水缠护', `${top.name}——${top.pt}`, Math.min(3, top.n), 'good', SHUILONG_SHA.def);
	}
	// ④ 八吉字 / 八凶字
	const jz = (Array.isArray(jiZi) ? jiZi : []).filter((z)=>SHUI_8JI_ZI.some((x)=>x.zi === z));
	const xz = (Array.isArray(xiongZi) ? xiongZi : []).filter((z)=>SHUI_8XIONG_ZI.some((x)=>x.zi === z));
	if (jz.length) { push('jizi', '水形八吉字', jz.join('、') + '（气之所在）', Math.min(4, jz.length), 'good'); }
	if (xz.length) { push('xiongzi', '水形八凶字', xz.join('、') + '（气之所离，故凶）', -Math.min(4, xz.length), 'bad'); }
	// ⑤ 穴形六种
	const xh = SHUILONG_XUE_6.find((x)=>x.name === xueXing) || null;
	if (xh) { push('xuexing', '水龙穴形', `${xh.name}——${xh.def}`, 1, 'good', SHUI_BU_WEI_XUE); }
	// ⑥ 三大格 + 玄空立向联动
	const ge = SHUILONG_3GE.find((g)=>g.key === geKey) || null;
	if (ge) {
		push('ge', '水龙三大格', `${ge.name}${ge.rank ? `（${ge.rank}）` : ''}`, ge.key === 'zuoshui' ? 3 : 2, 'good', ge.def);
	}
	// ⑦ 息道/漏道（一票否决级）
	const xd = XIDAO_LOUDAO.find((x)=>x.name === xidao) || null;
	if (xd) { push('xidao', '息道/漏道', `${xd.name}——${xd.zhu}`, xd.jx === 'good' ? 2 : -4, xd.jx, xd.def); }
	// ⑧ 环抱重数 / 转折数
	const hb = gradeByN(HUANBAO_GRADE, huanbao);
	if (hb) { push('huanbao', '环抱重数', `${hb.label}——${hb.rank}`, hb.score, 'good'); }
	const zz = gradeByN(ZHUANZHE_GRADE, zhuanzhe);
	if (zz) { push('zhuanzhe', '水之转折', `${zz.label}——${zz.rank}`, zz.score, 'good', '直龙直去龙之僵，有湾有动龙之活'); }
	// ⑨ 秀龙/痴龙
	const xc = XIU_CHI_LONG.find((x)=>x.name === xiuchi) || null;
	if (xc) { push('xiuchi', '秀龙/痴龙', `${xc.name}——${xc.pt}`, xc.jx === 'good' ? 2 : (xc.jx === 'bad' ? -2 : 0), xc.jx); }
	// ⑩ 穴后空（与山龙相反）
	if (houKong === true) { push('houkong', '穴后', '穴后空、有吉水——合水龙法', 2, 'good', SHUIXUE_HOUKONG.jue); }
	else if (houKong === false) { push('houkong', '穴后', '穴后高——水穴后高绝无踪', -3, 'bad', SHUIXUE_HOUKONG.jue); }
	// ⑪ 照神
	const zs = ZHAOSHEN.find((x)=>x.when === zhaoshen) || null;
	if (zs) { push('zhaoshen', '照神夺气', `${zs.when} → ${zs.then}`, zs.jx === 'bad' ? -1 : 0, zs.jx); }
	// ⑫ 吉格 / 凶格
	const jg = SHUILONG_JIGE.find((g)=>g.name === jiGe) || null;
	if (jg) { push('jige', '水龙吉格', `${jg.name}——${jg.duan}`, 3, 'good', jg.li ? `名局实例：${jg.li.join('、')}` : ''); }
	const xg = SHUILONG_XIONGGE.find((g)=>g.name === xiongGe) || null;
	if (xg) { push('xiongge', '水龙凶格', `${xg.name}——${xg.duan || (xg.items || []).join('；')}`, -4, 'bad'); }
	// ⑬ 水龙五星（与山龙相反）
	if (wuxing) {
		const isJi = SHUILONG_WUXING.ji.indexOf(wuxing) >= 0;
		push('wuxing', '水龙五星', `${wuxing}星——${isJi ? '金水土为吉' : '木火最忌'}`, isJi ? 2 : -3, isJi ? 'good' : 'bad', SHUILONG_WUXING.fanCha);
	}

	const total = items.reduce((a, x)=>a + x.score, 0);
	const goodN = items.filter((x)=>x.jx === 'good').length;
	const badN = items.filter((x)=>x.jx === 'bad').length;
	// 立向建议（三大格 → 玄空格局；水龙板块只出建议，不改玄空引擎本判）。
	const lixiang = ge ? ge.lixiang : [];

	return {
		available: true, isShuilong: true,
		pai, gaocun: GAOCUN_RULE, dixingEquivNote: DIXING_EQUIV_NOTE,
		ji: jiHit, ge, xueXing: xh, xidao: xd, huanbao: hb, zhuanzhe: zz, xiuchi: xc,
		jiZi: jz, xiongZi: xz, houKong, zhaoshen: zs, jiGe: jg, xiongGe: xg,
		items, total, goodN, badN, grade: gradeOf(total),
		lixiang, guimo: CHAJIE_GUIMO,
		kaimian: PINGYANG_KAIMIAN, siYuanZe: PINGYANG_4, priority: SHUI_PRIORITY,
		zangfa: SHUIXUE_ZANGFA, houkongRule: SHUIXUE_HOUKONG,
		note: SHUILONG_NOTE,
	};
}

export default shuilong;
