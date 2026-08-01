// 命理派（8.4 · 以命配宅）：不另起方位盘，以命卦配宅之坐向与八宅吉方，
// 依附八宅/玄空/三合而行 —— 故本模块只出「人—宅对照 + 个人吉方」，不造新盘。
import { GONG_GUA, GONG_NAME, POS_NAME, HOUTIAN_POS, MINGLI_GUA_PROFILE, MINGLI_RELATION, MINGLI_NOTE, WUXING_SHENG, WUXING_KE, GUA8_WUXING } from './fengshuiData';
import { mingGua, mingGroup, yearGanZhi } from './liqiCore';
import { dayouNian, guaRelation } from './bazhai';

// 生我者（印）/ 克我者（煞）反查。
const shengMe = (wx)=>Object.keys(WUXING_SHENG).find((k)=>WUXING_SHENG[k] === wx) || null;
const keMe = (wx)=>Object.keys(WUXING_KE).find((k)=>WUXING_KE[k] === wx) || null;

// 宅命五行关系（以宅卦五行对命卦五行）。
function relationOf(zhaiWx, mingWx) {
	if (!zhaiWx || !mingWx) { return null; }
	if (zhaiWx === mingWx) { return MINGLI_RELATION.same; }
	if (WUXING_SHENG[zhaiWx] === mingWx) { return MINGLI_RELATION.zhaiShengMing; }
	if (WUXING_SHENG[mingWx] === zhaiWx) { return MINGLI_RELATION.mingShengZhai; }
	if (WUXING_KE[zhaiWx] === mingWx) { return MINGLI_RELATION.zhaiKeMing; }
	return MINGLI_RELATION.mingKeZhai;
}

// 命理派：{ mingYear, isMale, zhaiZuoGua }
export function mingli({ mingYear = 1990, isMale = true, zhaiZuoGua = '坎' } = {}) {
	// 空串/null 经 Number() 成 0，会静默算出「0 年」的命卦 → 显式挡掉，只收正整年。
	const raw = `${mingYear === null || mingYear === undefined ? '' : mingYear}`.trim();
	const yr = raw === '' ? NaN : Math.trunc(Number(raw));
	if (!Number.isFinite(yr) || yr <= 0 || !(zhaiZuoGua in GUA8_WUXING)) { return { available: false }; }
	const g = mingGua(yr, isMale !== false);
	const mingGuaName = GONG_GUA[g];
	const group = mingGroup(g);
	const prof = MINGLI_GUA_PROFILE[mingGuaName] || null;

	// 个人吉方：以命卦为伏位起大游年，四吉（生气/延年/天医/伏位）为吉方。
	const stars = dayouNian(mingGuaName) || {};
	const fangwei = Object.keys(stars).map((k)=>{
		const gong = +k; const s = stars[gong];
		return { gong, dir: POS_NAME[gong], gua: s.gua, star: s.name, rank: s.rank, jx: s.jx, desc: s.desc };
	}).sort((a, b)=>a.gong - b.gong);
	const jiFang = fangwei.filter((f)=>f.jx === 'good');
	const xiongFang = fangwei.filter((f)=>f.jx === 'bad');

	// 人—宅相配：①东西四命宅是否同组 ②宅坐卦对命卦的大游年星 ③五行生克。
	const zhaiGroup = mingGroup(HOUTIAN_POS[zhaiZuoGua]);
	const sameGroup = zhaiGroup === group;
	const rel = guaRelation(zhaiZuoGua, mingGuaName);              // 宅坐为伏位，看命卦落宫得何星
	const wxRel = relationOf(GUA8_WUXING[zhaiZuoGua], prof ? prof.wuxing : null);
	const okN = (sameGroup ? 1 : 0) + (rel && rel.jx === 'good' ? 1 : 0) + (wxRel && wxRel.jx === 'good' ? 1 : 0);
	const verdict = okN >= 3 ? { text: '宅命全合·上吉', jx: 'good' }
		: okN === 2 ? { text: '宅命大体相得', jx: 'good' }
			: okN === 1 ? { text: '宅命半合·可调', jx: 'neutral' }
				: { text: '宅命不配·宜择他宅或重调门主灶', jx: 'bad' };

	return {
		available: true,
		ming: {
			year: yr, ganzhi: yearGanZhi(yr), isMale: isMale !== false, gua: mingGuaName, gong: g, group,
			wuxing: prof ? prof.wuxing : null, fangwei: prof ? prof.fangwei : null,
			color: prof ? prof.color : null, hex: prof ? prof.hex : null, hetu: prof ? prof.hetu : null,
			yiJu: prof ? `宜居${prof.fangwei}方，宜用${prof.color}` : null,
			xiYong: prof ? `喜${shengMe(prof.wuxing)}（生我）与${prof.wuxing}（比和）；忌${keMe(prof.wuxing)}（克我）、${prof.sheng}（泄气）` : null,
		},
		zhai: { zuoGua: zhaiZuoGua, gong: HOUTIAN_POS[zhaiZuoGua], dir: GONG_NAME[HOUTIAN_POS[zhaiZuoGua]], group: zhaiGroup, wuxing: GUA8_WUXING[zhaiZuoGua] },
		match: {
			sameGroup, groupText: sameGroup ? `${group}人居${zhaiGroup}宅·同组相得` : `${group}人居${zhaiGroup}宅·东西相混`,
			star: rel, wuxing: wxRel, okN, verdict,
		},
		fangwei, jiFang, xiongFang,
		note: MINGLI_NOTE,
	};
}

export default mingli;
