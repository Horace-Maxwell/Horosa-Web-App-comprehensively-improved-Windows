// 双盘挂载 · 中式合盘数据(纯前端、确定性):八字合婚 + 紫微合盘。只给能按两人出生资料直接算出的对照事实,不给「合婚分数」。
// 八字:年命(生肖冲合刑害 + 纳音生克,复用日子馆 hehunPair 同一口径)· 四柱逐柱对照(天干合冲 / 地支合冲刑害)·
//       两人地支合局(两人八支合起来才齐的三合 / 三会 / 三刑)· 日柱 / 夫妻宫(日干五合、日支合冲刑害、日主五行生克)·
//       喜忌互补(一方的喜用 / 忌神五行与另一方日主、年命纳音五行的对照)。干支关系一律走八字引擎同一套规则表。
// 紫微:对方生年四化落入本人哪个宫(反之亦然;四化表按给出四化那一方的流派 —— 记录里存了就用记录的,没存用当前设置)·
//       对方命宫 / 身宫地支落在本人哪个宫(反之亦然;按宫位地支找,不按宫位下标)· 双方命宫 / 夫妻宫主星对照。
// 输入是已建好的八字参数 / 紫微出生资料(由调用方从记录构造),本模块不读记录、不发请求。
import { personBazi, hehunPair } from '../components/calendar/riziEngine';
import { pairStemRelations, pairBranchRelations, crossBranchFormations } from './baziLunarLocal';
import { calcZiwei, deriveSanPan } from '../components/ziwei/ZiweiCalc';
import { sihuaTableFor, zwSihuaSchoolLabel, ZWSchool } from '../constants/ZWConst';

const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const WX_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WX_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const ruleWx = (key)=>`${key || ''}`.slice(-1);

// 三合局的中神(帝旺位):两支里有它 = 半合,缺它(生地 + 墓地)= 拱合 —— 古法力量有别,分开写明
const SANHE_MID = { 水: '子', 木: '卯', 火: '午', 金: '酉' };
// 两支之间的关系(按常用次序列出全部成立项;一项都没有 = 「无冲合刑害」)
const ZHI_REL_ORDER = ['ziCong', 'ziHe6', 'ziHe3', 'ziXing', 'ziCuan'];
export function zhiRelations(a, b){
	if(!a || !b){ return []; }
	const hits = pairBranchRelations(a, b);
	const out = [];
	ZHI_REL_ORDER.forEach((kind)=>{
		hits.filter((h)=>h.kind === kind).forEach((h)=>{
			if(kind === 'ziCong'){ out.push('六冲'); }
			else if(kind === 'ziHe6'){ out.push('六合'); }
			else if(kind === 'ziHe3'){ const wx = ruleWx(h.key); out.push(`三合(${wx}·${a === SANHE_MID[wx] || b === SANHE_MID[wx] ? '半合' : '拱合'})`); }
			else if(kind === 'ziXing'){ out.push(a === b ? '自刑' : '相刑'); }
			else { out.push('六害'); }
		});
	});
	return out;
}
// 两干之间的关系:天干五合(合化 X)/ 天干相冲
export function ganRelations(a, b){
	if(!a || !b){ return []; }
	return pairStemRelations(a, b).map((h)=>(h.kind === 'ganHe' ? `五合(合化${ruleWx(h.key)})` : '相冲'));
}

// 两种五行之间的生克(以 a 为主语)
export function wuxingRelation(a, b){
	if(!a || !b){ return ''; }
	if(a === b){ return '比和'; }
	if(WX_SHENG[a] === b){ return `${a}生${b}`; }
	if(WX_SHENG[b] === a){ return `${b}生${a}`; }
	if(WX_KE[a] === b){ return `${a}克${b}`; }
	if(WX_KE[b] === a){ return `${b}克${a}`; }
	return '';
}

const listText = (arr)=>(Array.isArray(arr) && arr.length ? arr.join('') : '—');
function fit(wx, person, who){
	if(!wx){ return ''; }
	if((person.xi || []).indexOf(wx) >= 0){ return `属${who}喜用`; }
	if((person.ji || []).indexOf(wx) >= 0){ return `属${who}忌神`; }
	return `不在${who}喜忌中`;
}

const PILLARS = [['年柱', 'yearGZ'], ['月柱', 'monthGZ'], ['日柱', 'dayGZ'], ['时柱', 'hourGZ']];
function branchItemsOf(p){
	return PILLARS.map(([label, field])=>({ cell: `${p[field] || ''}`.charAt(1), label: `${label.charAt(0)}支` })).filter((x)=>x.cell);
}
function formationLabel(f){
	const cells = `${f.key || ''}`.slice(0, 3);
	if(f.kind === 'ziHe3'){ return `${cells}三合${ruleWx(f.key)}局`; }
	if(f.kind === 'ziHui'){ return `${cells}三会${ruleWx(f.key)}局`; }
	return `${cells}三刑`;
}

// 八字合婚(纯):selfParams / otherParams = 与八字页同形的排盘参数(buildChartBaziParams 产出)
export function buildBaziHehunText(selfParams, otherParams, { selfName = '本人', otherName = '对方' } = {}){
	const a = personBazi(selfParams);
	const b = personBazi(otherParams);
	const hp = hehunPair(a, b) || {};
	const lines = [];
	lines.push('[年命]');
	lines.push(`本人「${selfName}」:${a.yearGZ}年(${a.nayinYear || '—'}),属${a.shengxiao || '—'};对方「${otherName}」:${b.yearGZ}年(${b.nayinYear || '—'}),属${b.shengxiao || '—'}`);
	const yr = zhiRelations(a.yearZhi, b.yearZhi);
	lines.push(`生肖(年支 ${a.yearZhi}${b.yearZhi}):${yr.length ? yr.join('、') : '无冲合刑害'}`);
	const ny = wuxingRelation(a.nayinYearWx, b.nayinYearWx);
	lines.push(`年命纳音:${a.nayinYearWx || '—'} 与 ${b.nayinYearWx || '—'}${ny ? `,${ny}` : ''}${hp.verdict ? `(年命合婚口径:${hp.verdict})` : ''}`);
	// 四柱逐柱对照:同一柱两人干对干、支对支(时柱缺 = 不列)
	lines.push('[四柱逐柱对照](本人 × 对方,同柱对照;天干看五合 / 相冲,地支看六合 / 三合 / 六冲 / 相刑 / 六害)');
	PILLARS.forEach(([label, field])=>{
		const ga = `${a[field] || ''}`;
		const gb = `${b[field] || ''}`;
		if(ga.length < 2 || gb.length < 2){ return; }
		const gr = ganRelations(ga.charAt(0), gb.charAt(0));
		const zr = zhiRelations(ga.charAt(1), gb.charAt(1));
		lines.push(`${label} ${ga} × ${gb}:天干 ${ga.charAt(0)}${gb.charAt(0)} ${gr.length ? gr.join('、') : '无合冲'};地支 ${ga.charAt(1)}${gb.charAt(1)} ${zr.length ? zr.join('、') : '无冲合刑害'}${ga === gb ? '(两人此柱干支相同)' : ''}`);
	});
	// 两人地支合局:两人八支合起来才齐(任一方自己凑不齐)的三合局 / 三会局 / 三刑
	lines.push('[两人地支合局](两人四柱地支合起来才齐的三合 / 三会 / 三刑)');
	const forms = crossBranchFormations(branchItemsOf(a), branchItemsOf(b));
	if(forms.length){
		forms.forEach((f)=>{
			const who = (items)=>items.map((x)=>`${x.label}${x.cell}`).join('、');
			lines.push(`${formationLabel(f)}:本人 ${who(f.fromA)};对方 ${who(f.fromB)}`);
		});
	}else{
		lines.push('无(两人地支合起来没有新齐的三合局 / 三会局 / 三刑)');
	}
	lines.push('[日柱 · 夫妻宫]');
	lines.push(`本人日柱 ${a.dayGZ},对方日柱 ${b.dayGZ}`);
	const dg = ganRelations(a.dayGan, b.dayGan);
	lines.push(`日干 ${a.dayGan}${b.dayGan}:${dg.length ? dg.map((t)=>`天干${t}`).join('、') : '无合冲'};日主五行 ${a.dayGanWx || GAN_WX[a.dayGan] || '—'} 与 ${b.dayGanWx || GAN_WX[b.dayGan] || '—'}${wuxingRelation(a.dayGanWx, b.dayGanWx) ? `,${wuxingRelation(a.dayGanWx, b.dayGanWx)}` : ''}`);
	const dr = zhiRelations(a.dayZhi, b.dayZhi);
	lines.push(`日支(夫妻宫)${a.dayZhi}${b.dayZhi}:${dr.length ? dr.join('、') : '无冲合刑害'}`);
	// 喜忌按各自所选的用神流派(传统综合 / 盲派 / 纳音古法不单列喜忌,取扶抑派)
	const ysTag = (p)=>`${p.ysSchool || '扶抑派'}${p.ysFallback ? '(所选流派不单列喜忌)' : ''}`;
	lines.push(`[喜忌互补](喜用取法:本人${ysTag(a)};对方${ysTag(b)})`);
	lines.push(`本人喜用 ${listText(a.xi)},忌 ${listText(a.ji)}${a.verdict ? `(${a.verdict})` : ''};对方日主${b.dayGanWx || '—'}${fit(b.dayGanWx, a, '本人') ? `(${fit(b.dayGanWx, a, '本人')})` : ''},对方年命纳音${b.nayinYearWx || '—'}${fit(b.nayinYearWx, a, '本人') ? `(${fit(b.nayinYearWx, a, '本人')})` : ''}`);
	lines.push(`对方喜用 ${listText(b.xi)},忌 ${listText(b.ji)}${b.verdict ? `(${b.verdict})` : ''};本人日主${a.dayGanWx || '—'}${fit(a.dayGanWx, b, '对方') ? `(${fit(a.dayGanWx, b, '对方')})` : ''},本人年命纳音${a.nayinYearWx || '—'}${fit(a.nayinYearWx, b, '对方') ? `(${fit(a.nayinYearWx, b, '对方')})` : ''}`);
	lines.push('[说明] 以上为按两人出生资料直接算出的对照事实,不含评分;判断须结合两人各自的完整八字。');
	return lines.join('\n');
}

const HUA = ['禄', '权', '科', '忌'];
const STAR_FIELDS = ['starsMain', 'starsAssist', 'starsEvil', 'starsOthersGood', 'starsOthersBad', 'starsSmall'];
// 宫位地支:一律取宫干支的第二字(houses[] 下标随盘而变,不等于固定地支位)
const houseZhi = (h)=>`${(h && h.ganzi) || ''}`.charAt(1);
const houseLabel = (h)=>{ const z = houseZhi(h); return `${(h && h.name) || ''}${z ? `(${z})` : ''}`; };
function houseOfStar(chart, starName){
	const houses = (chart && chart.houses) || [];
	for(let i = 0; i < houses.length; i++){
		const h = houses[i] || {};
		for(const f of STAR_FIELDS){
			if((h[f] || []).some((s)=>{ const n = `${(s && s.name) || ''}`; return n === starName || (n.charAt(0) === '副' && n.slice(1) === starName); })){ return houseLabel(h); }
		}
	}
	return '';
}
// 按地支找宫(另一张盘的命宫 / 身宫地支落在这张盘的哪个宫)
function houseByZhi(chart, zhi){
	return ((chart && chart.houses) || []).find((h)=>h && houseZhi(h) === zhi) || null;
}
// 命宫 / 身宫:先认宫上的标记,缺标记再按下标(两者同源,标记更稳)
function lifeHouseOf(chart){
	const houses = (chart && chart.houses) || [];
	return houses.find((h)=>h && h.isLife) || houses[chart && chart.lifeHouseIndex] || null;
}
function bodyHouseOf(chart){
	const houses = (chart && chart.houses) || [];
	return houses.find((h)=>h && h.isBody) || houses[chart && chart.bodyHouseIndex] || null;
}
function palaceInto(fromChart, intoChart, fromWho, intoWho){
	const one = (label, h)=>{
		const z = houseZhi(h);
		if(!z){ return `${fromWho}${label}地支不明`; }
		const hit = houseByZhi(intoChart, z);
		return `${fromWho}${label}在${z} → ${intoWho}${hit && hit.name ? hit.name : '(未找到同支宫位)'}`;
	};
	const life = lifeHouseOf(fromChart);
	const body = bodyHouseOf(fromChart);
	const sameLB = life && body && houseZhi(life) && houseZhi(life) === houseZhi(body);
	return `${one('命宫', life)};${one('身宫', body)}${sameLB ? '(命身同宫)' : ''}`;
}
// 宫名归一:引擎宫名带「宫」字(命宫 / 夫妻宫 / 官禄宫),也接受不带的写法
const baseHouseName = (n)=>`${n || ''}`.replace(/宫$/, '');
const mainStarsOf = (chart, houseName)=>{
	const h = ((chart && chart.houses) || []).find((x)=>x && baseHouseName(x.name) === baseHouseName(houseName));
	const names = h ? (h.starsMain || []).map((s)=>s && s.name).filter(Boolean) : [];
	return names.length ? names.join(' ') : '无主星(借对宫)';
};
// 一方的四化流派:本次挂载设置改了的按它;记录里存了(person.sihua.school)用记录的,没存用当前设置;
// 自定义档优先用随盘的表,没带表时用本机的自定义表(标题如实写)
function sihuaOf(person){
	const sh = (person && person.sihua) || {};
	const fromRecord = !!sh.school;
	const school = fromRecord ? `${sh.school}` : ZWSchool.school;
	const source = sh.source === 'mount' ? 'mount' : (fromRecord ? 'record' : 'current');
	const localCustom = school === 'custom' && !(typeof sh.customTable === 'string' && sh.customTable.trim() !== '');
	return { school, fromRecord, source, localCustom, table: sihuaTableFor(school, sh.customTable) || {} };
}
function sihuaSourceText(sh, who){
	const tail = sh.localCustom ? ',自定义表没随盘,用本机的自定义表' : '';
	if(sh.source === 'mount'){ return `按本次挂载设置的流派${tail}`; }
	if(sh.source === 'record'){ return `按${who}记录的流派${tail}`; }
	return `${who}记录没存流派,按当前设置${tail}`;
}
const SAN_PAN_LABEL = { di: '地盘', ren: '人盘' };
function pairChartOf(person){
	const chart = calcZiwei(person.birth, person.opts || {});
	return person.sanPan && SAN_PAN_LABEL[person.sanPan] ? deriveSanPan(chart, person.sanPan) : chart;
}
function huaInto(fromChart, intoChart, table){
	const gan = fromChart && fromChart.yearGan;
	const stars = (table || {})[gan] || [];
	return stars.map((star, i)=>{
		const where = houseOfStar(intoChart, star);
		return `${star}化${HUA[i]} → ${where ? where : '(不在盘中星曜内)'}`;
	});
}

// 紫微合盘(纯):birth = calcZiwei 出生资料,opts = calcZiwei 选项(晚子时 / 时间算法等,由调用方从记录构造)
export function buildZiweiPairText(self, other, { selfName = '本人', otherName = '对方' } = {}){
	const a = pairChartOf(self);
	const b = pairChartOf(other);
	const sa = sihuaOf(self);
	const sb = sihuaOf(other);
	const panTag = (person)=>(person.sanPan && SAN_PAN_LABEL[person.sanPan] ? `(${SAN_PAN_LABEL[person.sanPan]})` : '');
	const lines = [];
	lines.push(`[对方生年四化入本人宫位](四化表:${zwSihuaSchoolLabel(sb.school)},${sihuaSourceText(sb, '对方')})`);
	lines.push(`对方「${otherName}」生年 ${b.yearGan}:${huaInto(b, a, sb.table).join(';')}`);
	lines.push(`[本人生年四化入对方宫位](四化表:${zwSihuaSchoolLabel(sa.school)},${sihuaSourceText(sa, '本人')})`);
	lines.push(`本人「${selfName}」生年 ${a.yearGan}:${huaInto(a, b, sa.table).join(';')}`);
	// 选了地盘 / 人盘的一方:命宫与宫名都按那一盘(与单盘挂载同),标题注明
	const panNote = (first, firstWho, second, secondWho)=>{
		const notes = [[first, firstWho], [second, secondWho]].filter(([p])=>p.sanPan && SAN_PAN_LABEL[p.sanPan]).map(([p, w])=>`${w}按${SAN_PAN_LABEL[p.sanPan]}`);
		return notes.length ? `(${notes.join('、')})` : '';
	};
	lines.push(`[对方命宫 / 身宫落入本人宫位]${panNote(other, '对方', self, '本人')}`);
	lines.push(palaceInto(b, a, '对方', '本人'));
	lines.push(`[本人命宫 / 身宫落入对方宫位]${panNote(self, '本人', other, '对方')}`);
	lines.push(palaceInto(a, b, '本人', '对方'));
	lines.push('[命宫 / 夫妻宫主星对照]');
	lines.push(`本人${panTag(self)}:命宫 ${mainStarsOf(a, '命宫')};夫妻宫 ${mainStarsOf(a, '夫妻')}`);
	lines.push(`对方${panTag(other)}:命宫 ${mainStarsOf(b, '命宫')};夫妻宫 ${mainStarsOf(b, '夫妻')}`);
	lines.push('[说明] 以上为按两人出生资料直接排出的对照事实,不含评分;判断须结合两人各自的完整命盘。');
	return lines.join('\n');
}

// 挂了哪门才附哪门(两人都按同一组技法挂载):八字 → 八字合婚;紫微 → 紫微合盘
export function pairChineseWanted(techniqueKeys){
	const keys = Array.isArray(techniqueKeys) ? techniqueKeys : [];
	return { bazi: keys.indexOf('bazi') >= 0, ziwei: keys.indexOf('ziwei') >= 0 };
}

