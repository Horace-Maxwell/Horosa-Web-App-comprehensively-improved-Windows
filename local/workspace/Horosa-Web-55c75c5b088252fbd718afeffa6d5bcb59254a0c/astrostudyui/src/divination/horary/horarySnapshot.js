// divination/horary/horarySnapshot.js
// 把卜卦判断结果拼成 AI 快照文本（[小节标题] + markdown 列表），供 saveModuleAISnapshot('horary', ...)。
import { PLANETS } from '../data/planets';
import { SIGNS } from '../data/signs';
import { CATEGORY_DEF } from './significators';
import { schoolOf } from './horarySchools';
import * as AstroText from '../../constants/AstroText';

function cn(k){ return (PLANETS[k] || {}).cn || k || '—'; }
const ASPECT_CN = { 0: '合相', 60: '六合', 90: '四分(刑)', 120: '三合', 180: '对分(冲)' };
const ANG_CN = { angular: '角宫·有力', succedent: '续宫·中等', cadent: '果宫·偏弱' };

// [征象力量] 单星状态行:与 HoraryJudgment.plainState 同构(同 facts.planets 取数,文案逐字一致);
// 不 import 组件文件(HoraryJudgment 已 import 本文件,反向引会成环)。
function planetPlainState(facts, k){
	const p = facts && facts.planets ? facts.planets[k] : null;
	if(!p) return '';
	const sgn = (SIGNS[p.sign] || {}).cn || p.sign;
	const ang = ANG_CN[p.angularity] || '';
	const dig = p.dignityScore >= 4 ? '入庙旺·有力' : (p.dignityScore <= -4 ? '落陷失势·无力' : (p.peregrine ? '游走·无尊贵' : '尊贵平平'));
	const extra = [];
	if(p.retro) extra.push('逆行');
	if(p.combustion === 'combust') extra.push('燃烧受灼');
	else if(p.combustion === 'cazimi') extra.push('居日心·极强');
	else if(p.combustion === 'under_beams') extra.push('日光束下');
	return `落 ${sgn}座 · 第${p.house || '?'}宫 · ${ang} · ${dig}${extra.length ? ' · ' + extra.join('/') : ''}`;
}

// [古典接纳] 行星/尊贵中文:chart.receptions/mutuals 的 id 是后端盘面 id(Sun/Moon…),
// 与「占星·古典」同源取中文(AstroMsgCN 全名优先);尊贵 token(ruler/exalt/term…)走 AstroMsg 中文表。
function clsPlanetCn(id){ return AstroText.AstroMsgCN[id] || AstroText.AstroTxtMsg[id] || id || '—'; }
function clsDignCn(ary){ return (ary || []).map((t) => AstroText.AstroMsg[t] || t).join('+'); }
function clsHasRefuse(tokens){ return (tokens || []).some((t) => t === 'exile' || t === 'fall'); }

export function buildHorarySnapshot(j, chart){
	if(!j) return '';
	const L = [];
	const sig = j.significators;
	const school = schoolOf(j.school);
	L.push('[起卦信息]');
	L.push(`问题类别：${(CATEGORY_DEF[j.category] && CATEGORY_DEF[j.category].quesitedLabel) || j.category}`);
	L.push(`判读流派：${school.cn}（${school.desc}）`);
	L.push(`时主星（活跃征象）：${cn(j.hourRuler)}`);
	L.push('[根本性]');
	L.push(j.radicality.suitable ? '适合判断。' : ('有警告（不阻断）：' + j.radicality.warnings.map((w) => w.text).join('；')));
	L.push('[征象星指派]');
	L.push(`问卜者 = 1宫主 ${cn(sig.querentKey)} ＋ 月亮`);
	L.push(`${sig.quesitedLabel || '事项'} = ${sig.quesitedHouse ? sig.quesitedHouse + '宫主 ' : ''}${cn(sig.quesitedKey)}${sig.natural ? '（自然征象星 ' + cn(sig.natural) + '）' : ''}`);
	L.push('[完成分析]');
	if(j.perfection){ j.perfection.detail.forEach((d) => L.push('- ' + d)); }
	L.push(`完成度三分：安全征象 ${j.thirds.count}/${j.thirds.total} → ${j.thirds.fraction}`);
	if(j.moonStory){
		L.push('[月亮的故事]');
		(j.moonStory.separating || []).slice(0, 2).forEach((a) => L.push(`- 月刚离开 ${cn(a.other)}（${ASPECT_CN[a.angle] || a.angle + '°'}，已过 ${a.orb.toFixed(1)}°）→ 事情来由/已过`));
		const app = j.moonStory.applying || [];
		if(app.length) app.slice(0, 3).forEach((a) => L.push(`- 月接下来会 ${cn(a.other)}（${ASPECT_CN[a.angle] || a.angle + '°'}，还差 ${a.orb.toFixed(1)}°）→ 事情走向/将发生`));
		else L.push('- 月亮接下来无主相位（空亡）');
	}
	if(j.allAspects && j.allAspects.length){
		L.push('[相位全览]');
		L.push('| 星A | 相位 | 星B | 状态 | 误差 |');
		L.push('| --- | --- | --- | --- | --- |');
		j.allAspects.forEach((a) => L.push(`| ${cn(a.a)} | ${ASPECT_CN[a.angle] || a.angle + '°'} | ${cn(a.b)} | ${a.applying ? '入相/将成' : '出相/已过'} | 差 ${a.orb.toFixed(1)}°${a.exact ? '·正相位' : ''} |`));
	}
	L.push('[裁决]');
	L.push('倾向：' + j.verdict.summary);
	if(j.verdict.positive.length) L.push('有利证词：' + j.verdict.positive.map((p) => p.text).join('；'));
	if(j.verdict.negative.length) L.push('不利证词：' + j.verdict.negative.map((n) => n.text).join('；'));
	L.push(`Query：①能否成事=${j.queries.canHappen.text} ②好坏=${j.queries.goodEvil.text} ③真假=${j.queries.reportTrue.text}`);
	L.push('[应期方位]');
	L.push((j.timing ? j.timing.text : '无准确相位，应期不定') + '；方位：' + (j.queries.where ? `${j.queries.where.dir}（${j.queries.where.terrain}），${j.queries.where.distance}` : '—'));
	if(j.lots){
		L.push(`阿拉伯点（${j.lots.convention}）：福点 ${j.lots.fortune.signCn}座 ${j.lots.fortune.signlon.toFixed(1)}°${j.lots.fortune.dispCn ? '·定位星' + j.lots.fortune.dispCn : ''}；精神点 ${j.lots.spirit.signCn}座 ${j.lots.spirit.signlon.toFixed(1)}°`);
	}
	if(j.topic){
		L.push(`[专题深化·${j.topic.title}]`);
		j.topic.lines.forEach((t) => L.push('- ' + t.text));
	}
	if(j.describe && j.describe.length){
		L.push('[描述]');
		j.describe.forEach((d) => L.push(`- ${d.role}：${d.title}${d.temper ? '（' + d.temper + '）' : ''} ${d.body}`));
	}
	L.push('（裁决只呈现证据与倾向，不替用户下命定结论。）');
	// [YA v42] +古典接纳:chart.receptions/chart.mutuals(古典 tab 已显示,与「占星·古典」同一套后端数据)
	// 此前被判词-only 快照丢弃。chart 为可选第二参:旧调用不传 → 不产段(零回归);
	// 传入处 = HoraryJudgment.saveSnap(props.chart) / aiAnalysisContext.regenerateHorarySnapshot(fetch 的 chart)。
	const recp = (chart && chart.receptions) || {};
	const mut = (chart && chart.mutuals) || {};
	const recNormal = recp.normal || [];
	const recAbnormal = recp.abnormal || [];
	const mutNormal = mut.normal || [];
	const mutAbnormal = mut.abnormal || [];
	if(recNormal.length || recAbnormal.length || mutNormal.length || mutAbnormal.length){
		L.push('[古典接纳]');
		if(recNormal.length || recAbnormal.length){
			L.push('◆ 接纳关系');
			recNormal.forEach((it) => L.push(`- 正接纳：${clsPlanetCn(it.beneficiary)} 被 ${clsPlanetCn(it.supplier)} 接纳（${clsDignCn(it.supplierRulerShip)}）${clsHasRefuse(it.supplierRulerShip) ? ' · 拒绝' : ''}`));
			recAbnormal.forEach((it) => L.push(`- 邪接纳（借次尊贵/弱位）：${clsPlanetCn(it.beneficiary)} 被 ${clsPlanetCn(it.supplier)} 接纳（${clsDignCn(it.supplierRulerShip)}）${clsHasRefuse(it.supplierRulerShip) ? ' · 拒绝' : ''}`));
		}
		if(mutNormal.length || mutAbnormal.length){
			L.push('◆ 互容');
			mutNormal.forEach((m) => L.push(`- 正互容：${clsPlanetCn((m.planetA || {}).id)}（${clsDignCn((m.planetA || {}).rulerShip)}） 与 ${clsPlanetCn((m.planetB || {}).id)}（${clsDignCn((m.planetB || {}).rulerShip)}） 互容`));
			mutAbnormal.forEach((m) => L.push(`- 邪互容：${clsPlanetCn((m.planetA || {}).id)}（${clsDignCn((m.planetA || {}).rulerShip)}） 与 ${clsPlanetCn((m.planetB || {}).id)}（${clsDignCn((m.planetB || {}).rulerShip)}） 互容`));
		}
		L.push(`三分制口径：${j.tripSystem === 'dorothean' ? '三主制（含参与主，水象日主取金星）' : '简约制（水象三分主取火星）'}`);
		L.push('正接纳＝居对方庙旺等强位可化解凶相；互容尤吉；供方落陷弱位标「拒绝」。');
	}
	// [YA v42] +征象力量:各征象星尊贵力量分(征象 tab 已显示:力量分/状态行/逐条证词)此前不入快照;
	// 取数与 UI 同源(j.conditions 的 score/findings.text_zh + facts.planets 状态)。
	const conds = j.conditions || {};
	const condKeys = Object.keys(conds);
	if(condKeys.length){
		L.push('[征象力量]');
		L.push('入庙旺=有力；落陷/游走/燃烧/逆行=无力或受损；角宫快而有力，果宫弱而拖延。');
		condKeys.forEach((k) => {
			const c = conds[k] || {};
			const role = k === sig.querentKey ? '（问卜者）' : (k === sig.quesitedKey ? '（' + (sig.quesitedLabel || '事项') + '）' : (k === 'moon' ? '（共同征象）' : ''));
			const score = c.score || 0;
			L.push(`◆ ${cn(k)}${role}：力量 ${score > 0 ? '+' : ''}${score}`);
			const state = planetPlainState(j.facts, k);
			if(state) L.push(state);
			(c.findings || []).forEach((f) => L.push('- ' + (f.text_zh || '')));
		});
	}
	return L.join('\n');
}

export default buildHorarySnapshot;
