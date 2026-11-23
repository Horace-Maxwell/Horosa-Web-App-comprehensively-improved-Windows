// 古典分析段(围攻 / 包夹 / 格局概览 / 状态与配置)
// 从 astroAiSnapshot.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { SIGNS } from '../../divination/data/signs';
import { buildPatternOverview } from '../astroPatternOverview';
import { bodyPartsOf, degreePosition } from '../../divination/data/bodyParts';
import { msg, resolveOnlyRulerExaltReception, round3, formatSignDegree, lonToSignDegree } from './format';
import { getObjectsMapPure as getObjectsMap } from '../fortuneChartPrimitives';   // 盘面原语单源
import { buildSectionText } from './chartSections';

// === 古典占星(WI-00..28 逐曜状态 + 围攻详断);标签与 AstroInfo.js 古典渲染严格一致(单一语义源)。===
const CLS_STATUS_IDS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

// 数值安全短格式(两位内去尾零;非数原样)——恒星触发容许度/参照星黄经距等补列用。
const fmtNumSafe = (v)=>{ const n = Number(v); return Number.isFinite(n) ? `${Math.round(n * 100) / 100}` : `${v}`; };

const CLS_PHASE = { cazimi: '核心', combust: '焦伤', underBeams: '日光束下', free: '自由光' };

const CLS_PHASE_EVENT = { morningRising: '晨星初现', eveningSetting: '昏星初没' };

const CLS_QUALITY = { B: '明度', D: '暗度', E: '空度', S: '烟度' };

const CLS_SPECIAL = { pitted: '陷度', azemene: '慢病度', fortune: '增福度' };

const CLS_APOGEE = { rising: '升·趋远地点', falling: '降·趋近地点' };

const CLS_NUM = { increasing: '数增·渐疾', decreasing: '数减·渐迟' };

const CLS_LIGHT = { waxing: '光增·渐盈', waning: '光减·渐亏' };

const CLS_SEASON = { '春': '春·主宰', '夏': '夏·宰执', '秋': '秋·受制', '冬': '冬·被执', '中': '中' };

const CLS_MEAN_ATK = { Sun: '精神阴暗·心灵扭曲', Moon: '凶死夭折·绝症残疾', Mercury: '智力特异·语言障碍', Venus: '欲望混乱·专断残暴', Jupiter: '世俗无成·离经叛道', Mars: '自身受困崩坏', Saturn: '自身受困崩坏' };

function fixedNum(val, digits){
	const n = Number(val);
	return Number.isNaN(n) ? '' : n.toFixed(digits);
}

// 围攻详断(《围攻》十六式):三种围 + 春秋势 + 宰执夏冬 + 协防 + 围魏救赵 + 日木互容制约 + 逆行 + 断语。
function buildBesiegementLines(chartObj){
	const list = (chartObj && chartObj.surround && chartObj.surround.besiegement) || [];
	const lines = [];
	(list || []).forEach((b)=>{
		if(!b || !Array.isArray(b.besiegers)){
			return;
		}
		const besiegers = b.besiegers.map((x)=>{
			let s = `${msg(x.id)}（${CLS_SEASON[x.season] || x.season}`;
			if(x.retro){ s += '·逆行'; }
			if(x.restrained && x.restrained.length){ s += '·日木制约凶减半'; }
			if(x.counterBesieged){ s += '·围魏救赵'; }
			return `${s}）`;
		}).join(' 与 ');
		let head = `${msg(b.target)}${b.targetRetro ? '（逆行）' : ''} 被 ${besiegers} ${b.kind}（${b.nature}）`;
		if(b.severe){ head += '·凶剧见血'; }
		lines.push(head);
		if(b.defense && b.defense.length){
			const d = b.defense.map((y)=> `${msg(y.id)}（${y.byBody ? '以身作盾' : '遥光'}·护${y.against ? msg(y.against) : y.side}侧·${y.strong ? '强' : '弱'}）`).join('，');
			lines.push(`协防：${d}`);
		}
		const mean = b.kind === '围攻' ? (CLS_MEAN_ATK[b.target] || '') : (b.kind === '围荣' ? '致富·舒适自由·财帛丰盈' : '致贵·领袖魅力·载众载民');
		if(mean){ lines.push(`断语：${mean}`); }
	});
	return lines;
}

// 围绕:某星 C 被紧邻两侧七政 A、B 夹持,过 C 黄道弧 < 90°,A-C/B-C 间无他星(取紧邻自然满足)。与 AstroInfo.genSurroundEncircleDom 同算法(七政按黄经排序、环形紧邻、span<90)。快照=全七政几何(无显示过滤)。
function buildEncircleLines(chartObj){
	const objectMap = getObjectsMap(chartObj);
	const bodies = CLS_STATUS_IDS.map((id)=> objectMap[id]).filter((o)=> o && typeof o.lon === 'number');
	if(bodies.length < 3){
		return [];
	}
	const sorted = bodies.slice().sort((a, b)=> a.lon - b.lon);
	const n = sorted.length;
	const norm = (x)=> ((x % 360) + 360) % 360;
	const lines = [];
	for(let i=0; i<n; i++){
		const mid = sorted[i];
		const left = sorted[(i - 1 + n) % n];
		const right = sorted[(i + 1) % n];
		const span = norm(mid.lon - left.lon) + norm(right.lon - mid.lon);
		if(span < 90){
			lines.push(`${msg(left.id)} 与 ${msg(right.id)} 围绕 ${msg(mid.id)}（跨${span.toFixed(1)}°）`);
		}
	}
	return lines;
}

function patSignCn(s){ const k = s ? String(s).toLowerCase() : null; return (SIGNS[k] && SIGNS[k].cn) || s || ''; }

// 古典格局(龙脉/孤月独明/月水心性智识/职业·皇室伴寝/强吉木·照耀/后天凶星) —— 复用 buildPatternOverview 单一真值，
// 经 buildClassicalSection→[古典]段，贯通 AI 导出/挂载/储存。绝不抛(失败回空)。
function buildPatternOverviewLines(chartObj){
	let data;
	// 先验权力等取自互容/接纳联结,须与「仅按本垣擢升计算互容接纳」设置同步(同信息/格局 tab 口径)。
	const onlyRulExalt = resolveOnlyRulerExaltReception();
	try{ data = buildPatternOverview(chartObj.chart, chartObj, { onlyRulExalt }); }catch(_){ return []; }
	if(!data || data.empty){ return []; }
	const lines = [];
	const d = data.dragon;
	if(d && d.has){
		if(d.kind === '龙拥'){ lines.push(`龙脉：龙拥（${d.note || '七星聚一侧'}）`); }
		else if(d.pair){ lines.push(`龙脉：龙截 ${d.pair.map((x)=> msg(x)).join('')}（两星联结）`); }
		else { lines.push(`龙脉：龙截 ${msg(d.lone)}（${patSignCn(d.loneSign)}${d.loneHouse ? `·${d.loneHouse}宫` : ''}${(d.loneRules && d.loneRules.length) ? `·主${d.loneRules.join('/')}宫` : ''}）`); }
	}
	if(data.loneMoon && data.loneMoon.has){ lines.push('孤月独明：是（夜生·唯月在地平上）'); }
	const ap = data.apriori || {};
	if(ap.has){ lines.push(`先验权力：${ap.links.map((lk)=> `${msg(lk.a)}${lk.kind}${msg(lk.b)}(${lk.which})`).join('、')}${ap.eightKill ? '·夜生·八杀朝天大贵' : '·昼生·非八杀朝天'}`); }
	const mm = data.moonMercury || {};
	const oneMM = (o)=> o ? `${patSignCn(o.sign)}${o.modality ? `·${o.modality}` : ''}${o.ruler ? `·主${msg(o.ruler)}${o.rulerDign || ''}` : ''}${o.flags && o.flags.length ? `·${o.flags.join('')}` : ''}` : '';
	if(mm.moon){ lines.push(`心性(月)：${oneMM(mm.moon)}`); }
	if(mm.mercury){ lines.push(`智识(水)：${oneMM(mm.mercury)}`); }
	const v = data.vocation || {};
	if(v.career){ lines.push(`职业(月第一西没)：${msg(v.career.id)} ${patSignCn(v.career.sign)}${v.career.house ? `·${v.career.house}宫` : ''}`); }
	if(v.style){ lines.push(`行事(日第一西没)：${msg(v.style.id)} ${patSignCn(v.style.sign)}${v.style.house ? `·${v.style.house}宫` : ''}`); }
	const j = data.jupiter;
	if(j && j.present){ lines.push(`木星：${j.strong ? '强吉' : '非强吉'}·${patSignCn(j.sign)}${j.dign ? `·${j.dign}` : ''}·照耀${j.litCount}星${j.lit && j.lit.length ? `（${j.lit.map((x)=> msg(x)).join('、')}）` : ''}`); }
	if((data.afflictedRulers || []).length){ lines.push(`后天凶星：${data.afflictedRulers.map((x)=> msg(x)).join('、')}`); }
	return lines;
}

// 逐曜古典状态:出界/偕日相/喜乐/宗派/野逸/度数性质·阳阴/月站/远地点·数·光/单度·九分·Darijan + 围攻详断 + 围绕 + 古典格局。
export function buildClassicalSection(chartObj){
	const lines = [];
	const objectMap = getObjectsMap(chartObj);
	const profile = [];
	CLS_STATUS_IDS.forEach((id)=>{
		const o = objectMap[id];
		if(!o){
			return;
		}
		const parts = [];
		if(o.outOfBounds){
			const mode = (id === 'Moon' && o.oobMode) ? (o.oobMode === 'going' ? '远行' : '回归') : '';
			parts.push(`出界+${fixedNum(o.oobDelta, 2)}°${mode ? `（${mode}）` : ''}`);
		}
		if(o.phase){
			let p = CLS_PHASE[o.phase] || o.phase;
			if(o.phasisElong != null){ p += `（距日${fixedNum(o.phasisElong, 1)}°）`; }
			if(o.phasisEvent){ p += `·${CLS_PHASE_EVENT[o.phasisEvent] || o.phasisEvent}`; }
			parts.push(p);
		}
		if(o.joy){ parts.push(`喜乐（${o.joyHouse}宫）`); }
		if(o.ofSect !== undefined && o.ofSect !== null){ parts.push(o.ofSect ? '同宗' : '异宗'); }
		if(o.feral){ parts.push('野逸'); }
		if(o.degreeQuality){ parts.push(CLS_QUALITY[o.degreeQuality] || `${o.degreeQuality}度`); }
		if(o.degreeGender){ parts.push(o.degreeGender === 'masculine' ? '阳性度' : '阴性度'); }
		if(o.specialDegree){
			const tags = Object.keys(o.specialDegree).filter((k)=> o.specialDegree[k]).map((k)=> CLS_SPECIAL[k] || k);
			if(tags.length){ parts.push(tags.join('·')); }
		}
		if(o.mansion && o.mansion.cn){ parts.push(`月站${o.mansion.cn}（${o.mansion.nature}）`); }
		if(o.apogeeDir){
			let a = CLS_APOGEE[o.apogeeDir] || o.apogeeDir;
			if(o.numberTrend){ a += `·${CLS_NUM[o.numberTrend] || ''}`; }
			if(o.lightTrend){ a += `·${CLS_LIGHT[o.lightTrend] || ''}`; }
			parts.push(a);
		}
		const dl = [];
		if(o.monomoiria){ dl.push(`单度主星${msg(o.monomoiria)}`); }
		if(o.ninthPart){ dl.push(`九分${msg(o.ninthPart)}`); }
		// FIX-13 度数主星补 Face(对齐 AstroInfo.genDegreeLordsDom 单度/九分/面/Darijan 四列)。
		if(o.dignities && o.dignities.face){ dl.push(`面主${msg(o.dignities.face)}`); }
		if(o.darijan){ dl.push(`Darijan${msg(o.darijan)}`); }
		if(dl.length){ parts.push(dl.join('·')); }
		if(parts.length){ profile.push(`${msg(id)}：${parts.join('；')}`); }
	});
	if(profile.length){
		lines.push('逐曜古典状态');
		lines.push(...profile);
	}
	const asc = objectMap.Asc;
	if(asc && asc.mansion && asc.mansion.cn){
		lines.push(`上升宿：${asc.mansion.cn}（${asc.mansion.nature} · ${asc.mansion.use}）`);
	}
	const bsg = buildBesiegementLines(chartObj);
	if(bsg.length){
		lines.push('围攻详断');
		lines.push(...bsg);
	}
	const enc = buildEncircleLines(chartObj);
	if(enc.length){
		lines.push('围绕');
		lines.push(...enc);
	}
	const pat = buildPatternOverviewLines(chartObj);
	if(pat.length){
		lines.push('古典格局');
		lines.push(...pat);
	}
	// FIX-11 全身部位 Melothesia(每星所落星座主管部位 + 度数上中下,对齐 AstroInfo.genMelothesiaDom)。
	const melo = [];
	CLS_STATUS_IDS.forEach((id)=>{
		const o = objectMap[id];
		if(!o || !o.sign) return;
		const parts = bodyPartsOf(String(o.sign).toLowerCase());
		if(!parts || !parts.length) return;
		const pos = (o.signlon != null) ? degreePosition(o.signlon) : '';
		melo.push(`${msg(id)}：${pos ? pos + '·' : ''}${parts.join('、')}`);
	});
	if(melo.length){
		lines.push('身体部位(Melothesia)');
		lines.push(...melo);
	}
	return lines;
}

const CLS_OVR_ASP = { sextile: '六分', square: '四分', trine: '三分', conjunction: '合', opposition: '冲' };

// 阿拉伯点中文名(与 AstroAnalysisLab.js:8 LOT_CN 同源,保持单源 — 改名同步两侧)。
const CLS_LOT_CN = {
	'Pars Fortuna': '福点', 'Pars Fortunae': '福点', 'Pars Spirit': '精神点', 'Pars Faith': '信仰点', 'Pars Substance': '资财点',
	'Pars Wedding [Male]': '婚姻点(男)', 'Pars Wedding [Female]': '婚姻点(女)', 'Pars Sons': '子女点',
	'Pars Father': '父亲点', 'Pars Mother': '母亲点', 'Pars Brothers': '兄弟点', 'Pars Diseases': '疾厄点',
	'Pars Death': '死亡点', 'Pars Travel': '旅行点', 'Pars Friends': '朋友点', 'Pars Enemies': '仇敌点',
	'Pars Saturn': '土星点', 'Pars Jupiter': '木星点', 'Pars Mars': '火星点', 'Pars Venus': '金星点',
	'Pars Mercury': '水星点', 'Pars Horsemanship': '骑术点', 'Pars Life': '生命点', 'Pars Radix': '本源点',
	'Pars Eros': '爱欲点', 'Pars Necessity': '必然点', 'Pars Courage': '勇气点', 'Pars Victory': '胜利点',
	'Pars Nemesis': '报应点',
	// 希腊化补全六点(「根基点」全仓专指 Basis:择日点引擎/词汇表/显赫指标同名;Radix 改「本源点」消歧)
	'Pars Basis': '根基点', 'Pars Exaltation': '擢升点', 'Pars Sons Valens': '儿子点',
	'Pars Daughters': '女儿点', 'Pars Praxis': '事业点', 'Pars Wedding Dorothean': '婚姻点(通式)',
};

const CLS_ELEM = { Fire: '火', Earth: '土', Air: '风', Water: '水' };

const CLS_MODE = { Cardinal: '始', Fixed: '固', Mutable: '变' };

const CLS_HEMI = { east: '东', west: '西', above: '地平上', below: '地平下' };

const CLS_TEMPER = { Choleric: '胆汁(热干)', Melancholic: '忧郁(冷干)', Sanguine: '多血(热湿)', Phlegmatic: '黏液(冷湿)' };

const CLS_QUAL = { Hot: '热', Cold: '冷', Dry: '干', Humid: '湿' };

// 古典格局派生分析(astroextra.analyze_chart):护卫/优势相位/度数围攻 + 传光/聚光/不合意/交点弯曲 +
// 逐题主星 + 偶然尊贵 + 恒星触发 + 行星时值日 + 埃及历 + 巴比伦参照星。与「古典」(逐曜本盘状态)互补,
// 由 AI 挂载/导出按需 fetch /astroextra/analysis 后拼到快照(非每盘预建,避免极区 heliacal 拖慢信息tab)。
export function buildClassicalAnalysisSection(analysis){
	if(!analysis || typeof analysis !== 'object'){
		return '';
	}
	const lines = [];
	const cp = analysis.classicalPatterns || {};
	const dory = (cp.doryphory || []).map((d)=> `${msg(d.planet)} 护卫 ${msg(d.light)}（距${round3(d.elong)}°）`);
	const over = (cp.overcoming || []).map((o)=> `${msg(o.over)}(${msg(o.overSign)}) 凌驾 ${msg(o.under)}(${msg(o.underSign)})·${CLS_OVR_ASP[o.aspect] || o.aspect}`);
	const bsgd = (cp.besieging || []).map((b)=> `${msg(b.planet)} 被 ${msg(b.left)}/${msg(b.right)} 度数围攻`);
	if(dory.length || over.length || bsgd.length){
		lines.push('古典格局');
		if(dory.length){ lines.push(`护卫：${dory.join('；')}`); }
		if(over.length){ lines.push(`优势相位：${over.join('；')}`); }
		if(bsgd.length){ lines.push(`度数围攻：${bsgd.join('；')}`); }
	}
	const ad = analysis.aspectDynamics || {};
	const trans = (ad.translation || []).map((t)=> `${msg(t.mover)} 自 ${msg(t.from)} 传光予 ${msg(t.to)}`);
	const coll = (ad.collection || []).map((c)=> `${msg(c.collector)} 聚 ${msg(c.p1)}、${msg(c.p2)} 之光`);
	const aver = (ad.aversion || []).map((v)=> `${msg(v.a)} 与 ${msg(v.b)} 不合意`);
	const bend = (ad.bending || []).map((b)=> `${msg(b.planet)} 交点弯曲${b.at ? `（${b.at}）` : ''}`);
	// G10 连接学说后四式:空亡/阻止/挫败/收回(后端 aspectDynamics 追加,缺则空)。
	const voidc = (ad.void || []).map((v)=> `${msg(v.planet)} 空亡（${v.mode === 'classical' ? '30°内' : '本座内'}不再成相）`);
	const prohib = (ad.prohibition || []).map((p)=> `${msg(p.blocker)} 阻止 ${msg(p.between)}→${msg(p.to)} 入相`);
	const frust = (ad.frustration || []).map((f)=> `${msg(f.frustrated)} 挫败（${msg(f.via)} 先成相 ${msg(f.to)}）`);
	const refran = (ad.refranation || []).map((r)=> `${msg(r.planet)} 收回（趋留撤离 ${msg(r.to)}）`);
	if(trans.length || coll.length || aver.length || bend.length || voidc.length || prohib.length || frust.length || refran.length){
		lines.push('相位动态');
		if(trans.length){ lines.push(`传光：${trans.join('；')}`); }
		if(coll.length){ lines.push(`聚光：${coll.join('；')}`); }
		if(aver.length){ lines.push(`不合意：${aver.join('；')}`); }
		if(bend.length){ lines.push(`交点弯曲：${bend.join('；')}`); }
		if(voidc.length){ lines.push(`空亡：${voidc.join('；')}`); }
		if(prohib.length){ lines.push(`阻止：${prohib.join('；')}`); }
		if(frust.length){ lines.push(`挫败：${frust.join('；')}`); }
		if(refran.length){ lines.push(`收回：${refran.join('；')}`); }
	}
	// FIX-3 Topical Almuten 补 significator(自然象征,对齐侧栏列)。
	const ta = (analysis.topicAlmuten || []).filter((t)=> t && t.almuten).map((t)=>{
		const sig = t.significator ? `·自然象征${msg(t.significator)}` : '';
		return `${t.topic}（${t.house}宫${sig}）主星${msg(t.almuten)}`;
	});
	if(ta.length){ lines.push('逐题主星'); lines.push(ta.join('；')); }
	const acc = (analysis.accidentalDignity || []).filter((r)=> r && r.planet).map((r)=> `${msg(r.planet)} ${r.score}（${(r.factors || []).join('·')}）`);
	if(acc.length){ lines.push('偶然尊贵'); lines.push(...acc); }
	// 补 位置/容许度 两列(右栏恒星触发表渲染有快照曾无;字段缺省不产,零回归)。
	const fs = (analysis.fixedStarHits || []).map((s)=>{
		const pos = (s.sign && s.signlon !== undefined && s.signlon !== null) ? `·${formatSignDegree(s.sign, s.signlon)}` : '';
		const orb = (s.orb !== undefined && s.orb !== null) ? `·容许${fmtNumSafe(s.orb)}°` : '';
		return `${msg(s.point)} 合 ${s.cn || s.star}${pos}${orb}${s.behenian ? '·比尼' : ''}${s.royal ? `·王者${s.royal}` : ''}`;
	});
	if(fs.length){ lines.push('恒星触发'); lines.push(fs.join('；')); }
	const ph = analysis.planetaryHours;
	if(ph && ph.dayRuler){
		lines.push(`行星时：值日星 ${msg(ph.dayRuler)}（日出 ${ph.sunrise} / 日落 ${ph.sunset}）`);
		// FIX-4 24 时辰表(昼12+夜12),逐时 index/ruler/diurnal/current 全输出,对齐侧栏 renderPlanetaryHours。
		if(Array.isArray(ph.hours) && ph.hours.length){
			const day = ph.hours.filter((h)=> h && h.diurnal);
			const night = ph.hours.filter((h)=> h && !h.diurnal);
			// 组内序号(与 UI AstroAnalysisLab 同修):默认档已是 sunrise 等长制,
			// 短昼盘昼弧≠12 行,旧「index-12」在夜组出 -1/0 假标签;equal24 用整点数。
			const single = ph.hourMode === 'equal24';
			const fmtHour = (h, i)=> `${single ? h.index - 1 : i + 1}.${msg(h.ruler)}${h.current ? '←当前' : ''}`;
			if(ph.hourMode){ lines.push(`行星时制式：${({ sunrise: '日出起等长', unequal: '昼夜不等时', equal24: '廿四时等分' })[ph.hourMode] || ph.hourMode}`); }
			if(day.length){ lines.push(`昼时：${day.map(fmtHour).join(' / ')}`); }
			if(night.length){ lines.push(`夜时：${night.map(fmtHour).join(' / ')}`); }
		}
	}
	const eg = analysis.egyptianCalendar;
	if(eg && (eg.siriusRising || eg.decanIndex)){
		// 极区 siriusRising 可能为 null,但上升十分宫仍有 → 各自独立呈现,勿因天狼缺失整块丢失(对齐 UI renderEgyptian)。
		const parts = [];
		if(eg.siriusRising){ parts.push(`天狼偕日升 ${eg.siriusRising}`); }
		// FIX-5 补 siriusYear(岁年),对齐侧栏 renderEgyptian 完整显示。
		if(eg.siriusYear){ parts.push(`岁年 ${eg.siriusYear}`); }
		if(eg.decanIndex){ parts.push(`上升第${eg.decanIndex}旬（${msg(eg.decanSign)}）面主${msg(eg.decanRuler)}`); }
		if(parts.length){ lines.push(`埃及历：${parts.join('；')}`); }
	}
	// 曾 .filter(b.conj) 只留合相行且丢黄经距——右栏参照星定位表渲染全部行(含 dist);
	// 现全行输出,合相加注、非合相带距(与渲染同宽)。
	const bab = (analysis.babylonianStars || []).filter((b)=> b && (b.planet || b.star)).map((b)=> {
		// 定名距星表升级:附楔文读法(上/下·前/后 X 肘 Y 指);老数据无此键时保持原行(零回归)。
		const rd = (b.latDir !== undefined) ? `(${b.latDir}${b.lonDir} ${b.cubits} 肘 ${b.fingers} 指)` : '';
		const dist = (b.dist !== undefined && b.dist !== null) ? `·距${fmtNumSafe(b.dist)}°` : '';
		return b.conj
			? `${msg(b.planet)} 合参照星 ${b.cn || b.star}${rd}${dist}`
			: `${msg(b.planet)} 近参照星 ${b.cn || b.star}${rd}${dist}`;
	});
	if(bab.length){ lines.push('巴比伦参照星'); lines.push(bab.join('；')); }
	// 相位格局(Grand Trine/T-Square/Yod/Stellium…)、分布权重(元素/模态/半球)、气质(四液)、Almuten 总主 —
	// 格局tab 同源,补入 AI 避免遗漏(与逐曜古典/古典格局互补)。标签对齐 AstroAnalysisLab。
	const pats = (analysis.patterns || []).map((p)=> `${p.label || p.type}（${(p.points || []).map((x)=> msg(x)).join('·')}${p.apex ? `,顶点${msg(p.apex)}` : ''}）`);
	if(pats.length){ lines.push('相位格局'); lines.push(pats.join('；')); }
	const dist = analysis.distribution;
	if(dist && (dist.elements || dist.modes || dist.hemispheres)){
		const kv = (obj, map)=> Object.keys(obj || {}).map((k)=> `${(map && map[k]) || k}${obj[k]}`).join(' ');
		const dl = [];
		if(dist.elements){ dl.push(`元素 ${kv(dist.elements, CLS_ELEM)}`); }
		if(dist.modes){ dl.push(`模态 ${kv(dist.modes, CLS_MODE)}`); }
		if(dist.hemispheres){ dl.push(`半球 ${kv(dist.hemispheres, CLS_HEMI)}`); }
		if(dl.length){ lines.push('分布权重'); lines.push(dl.join('；')); }
	}
	const temp = analysis.temperament;
	if(temp && (temp.temperaments || temp.qualities)){
		const kv = (obj, map)=> Object.keys(obj || {}).map((k)=> `${(map && map[k]) || k}${obj[k]}`).join(' ');
		const tl = [];
		if(temp.temperaments){ tl.push(`气质 ${kv(temp.temperaments, CLS_TEMPER)}`); }
		if(temp.qualities){ tl.push(`性质 ${kv(temp.qualities, CLS_QUAL)}`); }
		if(tl.length){ lines.push('气质评估'); lines.push(tl.join('；')); }
	}
	const am = analysis.almutem;
	if(am && am.winner){
		// 滤掉 0 分行(满屏 0 噪音),按分降序展开。
		const totals = Object.keys(am.totals || {})
			.map((k)=> [k, am.totals[k]])
			.filter((t)=> t[1] > 0)
			.sort((a, b)=> b[1] - a[1]);
		lines.push(`Almuten 总主：${msg(am.winner)}`);
		if(totals.length){
			lines.push('Almuten 逐星得分：');
			lines.push(...totals.map((t)=> `${msg(t[0])} ${t[1]}`));
		}
	}
	// R2 修:bonification(吉化/凶化,每星受惠/受厄关系)engine 已算但 UI 与 snapshot 双双未渲染 → AI 漏。
	// 显式入快照(对齐 analyze_chart 完整 14 键)。
	const bn = (analysis.bonification || []).filter((b)=> b && b.planet && (
		(Array.isArray(b.bonified) && b.bonified.length) ||
		(Array.isArray(b.maltreated) && b.maltreated.length)
	));
	if(bn.length){
		lines.push('吉化/凶化');
		bn.forEach((b)=>{
			const ok = (b.bonified || []).map((x)=> `${msg(x.by)}·${x.rel || '会合'}`).join('、');
			const bad = (b.maltreated || []).map((x)=> `${msg(x.by)}·${x.rel || '会合'}`).join('、');
			const segs = [];
			if(ok) segs.push(`受惠[${ok}]`);
			if(bad) segs.push(`受厄[${bad}]`);
			lines.push(`${msg(b.planet)}：${segs.join('；')}`);
		});
	}
	// FIX-6 阿拉伯点扩展 extraLots(LOT_CN 中文 28 种,带 category 题别;前 60 控总长)。
	// 标签英→中(对齐 UI renderLots);度数缺 sign 时用绝对黄经 fallback,避免尾冒号空值。
	const extra = (analysis.extraLots || []).filter((l)=> l && l.label);
	if(extra.length){
		lines.push('阿拉伯点(扩展)');
		// 截断上限对齐 UI(渲染 120,快照曾 60——61-120 条渲染有快照无)。
		extra.slice(0, 120).forEach((l)=>{
			const cnLabel = CLS_LOT_CN[l.label] || l.label;
			const cat = l.category ? `（${l.category}）` : '';
			let dg = '';
			if(l.sign && l.signlon !== undefined && l.signlon !== null){
				dg = formatSignDegree(l.sign, l.signlon);
			} else if(l.lon !== undefined && l.lon !== null){
				dg = lonToSignDegree(l.lon);
			} else if(l.sign){
				dg = msg(l.sign);
			}
			lines.push(`${cnLabel}${cat}：${dg || '-'}`);
		});
	}
	return buildSectionText('古典格局', lines);
}
