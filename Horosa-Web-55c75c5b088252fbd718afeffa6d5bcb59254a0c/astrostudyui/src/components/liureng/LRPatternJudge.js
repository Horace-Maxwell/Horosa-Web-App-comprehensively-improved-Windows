import * as LRConst from './LRConst';
import { ZhangSheng } from './LRZhangSheng';
import { getLiuRengPatternFullText } from './LRJudgePanelHelper';

const DAGE_NAME_BY_CHUANG_FALLBACK = {
	元首课: { name: '元首', basis: '三传课式为元首课（贼摄单摄）' },
	重审课: { name: '重审', basis: '三传课式为重审课（贼摄单贼）' },
	知一课: { name: '知一', basis: '三传课式为知一课（比用）' },
	涉害课: { name: '见机', basis: '三传课式为涉害课（见机）' },
	见机课: { name: '见机', basis: '三传课式为见机课（涉害）' },
	察微课: { name: '见机', basis: '三传课式为察微课（涉害分支）' },
	缀瑕课: { name: '见机', basis: '三传课式为缀瑕课（涉害分支）' },
	蒿矢课: { name: '矢射', basis: '三传课式为蒿矢课（遥克）' },
	弹射课: { name: '矢射', basis: '三传课式为弹射课（遥克）' },
	虎视课: { name: '虎视', basis: '三传课式为虎视课（昴星）' },
	掩目课: { name: '虎视', basis: '三传课式为掩目课（昴星分支）' },
	芜淫课: { name: '芜淫', basis: '三传课式为芜淫课（别责）' },
	八专课: { name: '帷簿', basis: '三传课式为八专课（帷簿）' },
	不虞课: { name: '信任', basis: '三传课式为不虞课（伏吟）' },
	自任课: { name: '信任', basis: '三传课式为自任课（伏吟）' },
	杜传课: { name: '信任', basis: '三传课式为杜传课（伏吟）' },
	无依课: { name: '无依', basis: '三传课式为无依课（反吟）' },
};

const DAGE_METHOD_NAMES = {
	JIESHE: '贼摄',
	BIYONG: '比用',
	SHEHAI: '涉害',
	YAOKE: '遥克',
	MAOXING: '昴星',
	BIEZE: '别责',
	BAZHUAN: '八专',
};

const WUXING_JU_RULES = [
	{ name: '炎上', set: new Set(['寅', '午', '戌']) },
	{ name: '曲直', set: new Set(['亥', '卯', '未']) },
	{ name: '稼穑', set: new Set(['辰', '戌', '丑', '未']) },
	{ name: '从革', set: new Set(['巳', '酉', '丑']) },
	{ name: '润下', set: new Set(['申', '子', '辰']) },
];
const GAN_HE_TYPED_RULES = [
	{ name: '甲己', a: '甲', b: '己' },
	{ name: '乙庚', a: '乙', b: '庚' },
	{ name: '丙辛', a: '丙', b: '辛' },
	{ name: '丁壬', a: '丁', b: '壬' },
	{ name: '戊癸', a: '戊', b: '癸' },
];

const GAN_HE = LRConst.GanHe || {};

const JIANG_JI = new Set(['贵人', '青龙', '六合', '太常', '太阴', '天后']);
const JIANG_XIONG = new Set(['螣蛇', '朱雀', '勾陈', '天空', '白虎', '玄武']);
const NINE_CHOU_DAYS = new Set(['乙卯', '己卯', '辛卯', '乙酉', '己酉', '辛酉', '戊子', '壬子', '戊午', '壬午']);
const JIEQI_LI = new Set(['立春', '立夏', '立秋', '立冬']);
const JIEQI_FENZHI = new Set(['春分', '夏至', '秋分', '冬至']);
const XING_WUXING_BY_DAY_ZHI = {
	寅: '火',
	午: '火',
	戌: '火',
	申: '木',
	子: '木',
	辰: '木',
	巳: '金',
	酉: '金',
	丑: '金',
	亥: '水',
	卯: '水',
	未: '水',
};
const DE_WUXING_BY_DAY_GAN = {
	甲: '木',
	己: '木',
	乙: '金',
	庚: '金',
	丙: '火',
	辛: '火',
	丁: '水',
	壬: '水',
	戊: '土',
	癸: '土',
};
const WUXING_SHENG = {
	木: '火',
	火: '土',
	土: '金',
	金: '水',
	水: '木',
};
const WUXING_KE = {
	木: '土',
	土: '水',
	水: '火',
	火: '金',
	金: '木',
};

const PATTERN_DETAIL_BY_NAME = {
	元首: '上摄下之首格，主权柄先机、秩序主导，宜先手决断。',
	重审: '下贼上之审格，主逆势反复、小人暗动，宜复核细察。',
	知一: '多重矛盾并发而择其同类为用，主取主轴、断次要。',
	见机: '涉害见机，主暗处探缝、临机而断，重侦查与策略。',
	矢射: '遥克之象，主远扰流言、隔空牵制，影响在远不在近。',
	虎视: '昴星刚烈，主高压监视与攻伐，宜防冲突升级。',
	芜淫: '别责不备，主关系失衡、欲望争夺与家内失和。',
	帷簿: '八专同牵，主边界模糊、私情牵连、协作与混乱并见。',
	信任: '伏吟粘连，主原地循环、进展迟滞，宜守成缓动。',
	无依: '反吟对冲，主变动分散、往复波折，宜预留回旋。',
	后合: '天后六合同传，主男女情事牵连、婚恋信号增强。',
	泆女: '初后末合，主女方主因之情欲外溢，关系易失衡。',
	狡童: '初合末后，主男方主因之诱合牵缠，事多暧昧。',
	元胎: '三传皆孟，主新生初启、孕育萌动、事势方起。',
	三交: '三传四仲并见太阴六合，主隐情交错、暗线并发。',
	斩关: '辰戌压临日辰，主破关脱困或强阻在前，宜取木火助解。',
	游子: '三传皆季且丁马并见，主远游漂泊、迁转不定。',
	孤寡: '孤辰寡宿旬空同入，主人事疏离、助力不足。',
	闭口: '旬首玄武、旬尾发用，主封口匿迹、讯息闭塞。',
	绝嗣: '四课俱摄，上强下弱，主压制偏重、下情难达。',
	无禄: '四课俱贼，下反上逆，主秩序失衡、争执频仍。',
	乱首: '日尊受克之局，主主位失控、纲纪紊乱。',
	解离: '日干日支互逆互克，主关系解体、两端离散。',
	赘婿: '日干临支且克支，主主客倒挂、责任牵缠。',
	龙战: '卯酉日并卯酉发用，主正面冲突、胜负速决。',
	天网: '时支与初传同克日干，主多方掣肘、行事受网。',
	轩盖: '子卯午成象并当令，主车盖名位、出行迁动。',
	铸印: '巳戌卯同传，主权印成形、职位与资源凝聚。',
	斫轮: '卯临申之局，主成器加工、推进落地见形。',
	励德: '贵人临卯或酉，主德助与贵援，事务可被提携。',
	龙德: '年支与月将同乘贵人且发用，主高位资源介入。',
	三奇: '课传见乙丙丁，主奇机突现、转机可用。',
	六仪: '旬仪或支仪入课传，主秩序规制、框架性影响增强。',
	官爵: '戌乘太常发用且马入课传，主职位迁升、任命流转。',
	飞魂: '游魂临行年日辰，主心神不宁、惊扰外来。',
	丧门: '丧门临行年日辰，主衰耗丧忧、气势下行。',
	伏殃: '天鬼临行年日辰，主灾殃潜伏、扩散风险。',
	罗网: '天罗地网临行年日辰，主拘束讼缠、行动受限。',
	连珠: '三传递进或递退，主事件连续、趋势延展。',
	炎上: '三传火局，主急促炽烈、执行力强而燥。',
	曲直: '三传木局，主生发伸展、进取与柔韧并行。',
	稼穑: '三传土局，主沉稳积累、务实经营与承载。',
	从革: '三传金局，主整肃更替、决断与切割并见。',
	润下: '三传水局，主流动渗透、应变与隐行并见。',
	三奇连珠: '亥子丑连珠并见，主非常态转机与连续变化。',
	天合局: '三传天干见合，主和合牵连、协商或绑定关系。',
	甲己: '天合甲己，主木土和合与强弱互制，宜辨外合内势。',
	乙庚: '天合乙庚，主金木相合与权衡调和，宜察进退得失。',
	丙辛: '天合丙辛，主火金相济与冷热转折，宜把握时机。',
	丁壬: '天合丁壬，主水火既济与情势回环，宜审动静缓急。',
	戊癸: '天合戊癸，主土水互济与蓄泄更替，宜定周期应期。',
	旺孕: '夫妇行年并旺并合，主孕育动象增强。',
	德孕: '夫妇行年天干见合，主德气相引、胎意可成。',
	刑德: '按日支定刑、按日干定德，比较德刑胜负以断捕获与阻滞。',
	物气: '以发用（初传）对日干之六亲关系取象，辨事类与所主。',
	新故: '以阴阳与长生阶段辨新旧、少老、初终，主事态时序感。',
	迍福: '统计发用所受凶压与吉助层数，层叠越多其象越显。',
	始终: '以初传为始、末传为终，观其由吉转凶或由凶转吉。',
	九丑: '九丑日并见丑临日支，主郁滞失序、名誉与情欲风险并发。',
	二烦: '日月临四仲并见斗罡加丑未，主烦扰反复、祸散复聚。',
	天祸: '四立日触发且绝神叠现，主节令敏感期内两难与灾咎。',
	天寇: '分至日叠离神，主旅途劫耗与阴杀暗动。',
	天狱: '辰塞日干长生且发用受困，主受制、萎靡、进退维艰。',
	死奇: '北斗（辰）临要位而成死奇，主死丧阴压与应期紧迫。',
	魄化: '白虎携死神并临日辰行年，主重击血光与魂魄不宁。',
	三阴: '贵逆、武虎先行、初末休囚并时克行年，主阴弱受困。',
	三光: '日辰与发用旺相并传乘吉将，主光明开敞、灾可化轻。',
	三阳: '贵顺且日辰居前并旺相，主朝阳开局、诸事易通。',
	富贵: '贵人旺相临年日辰且三传有气，主高位资助、名禄可期。',
	绛宫时: '宫时绛宫，四孟临四仲（四仲临四季、四季临四孟），主私行潜入与避追。',
	明堂时: '宫时明堂，四仲临四仲（四孟临四孟、四季临四季），主举动多顺、内外俱利。',
	玉堂时: '宫时玉堂，四季临四仲（四孟临四季、四仲临四孟），主小不利与行止受牵。',
	斗孟: '北斗局辰临孟，主事在开端、变动先起，宜先谋后动。',
	斗仲: '北斗局辰临仲，主事在中途、凝滞留连，宜稳守待机。',
	斗季: '北斗局辰临季，主事在结果、沉积郁结，宜防终局反覆。',
};

function safeText(v){
	return `${v === undefined || v === null ? '' : v}`.trim();
}

function enrichHit(item){
	if(!item || !item.name){
		return null;
	}
	const name = safeText(item.name);
	if(!name){
		return null;
	}
	const logic = safeText(item.logic || item.basis) || '命中';
	const fullText = safeText(item.fullText) || safeText(getLiuRengPatternFullText(name));
	const detail = safeText(item.detail);
	return {
		...item,
		name,
		basis: logic,
		logic,
		detail,
		fullText: fullText || undefined,
	};
}

function uniquePush(list, item){
	const hit = enrichHit(item);
	if(!hit || !hit.name){
		return;
	}
	if(list.some((it)=>it.name === hit.name)){
		return;
	}
	list.push(hit);
}

function extractBranch(token){
	const txt = safeText(token);
	for(let i = txt.length - 1; i >= 0; i--){
		const c = txt.substring(i, i + 1);
		if(LRConst.ZiList.indexOf(c) >= 0){
			return c;
		}
	}
	return '';
}

function extractGan(token){
	const txt = safeText(token);
	if(!txt){
		return '';
	}
	const head = txt.substring(0, 1);
	return LRConst.GanList.indexOf(head) >= 0 ? head : '';
}

function flattenBranches(value, outSet){
	if(value === undefined || value === null){
		return;
	}
	if(value instanceof Array){
		value.forEach((item)=>flattenBranches(item, outSet));
		return;
	}
	if(typeof value === 'object'){
		Object.keys(value).forEach((k)=>flattenBranches(value[k], outSet));
		return;
	}
	const txt = safeText(value);
	if(!txt){
		return;
	}
	txt.split('').forEach((c)=>{
		if(LRConst.ZiList.indexOf(c) >= 0){
			outSet.add(c);
		}
	});
}

function collectByKeyDeep(obj, key, outSet){
	if(!obj || typeof obj !== 'object'){
		return;
	}
	Object.keys(obj).forEach((k)=>{
		const val = obj[k];
		if(k === key){
			flattenBranches(val, outSet);
		}
		if(val && typeof val === 'object'){
			collectByKeyDeep(val, key, outSet);
		}
	});
}

function getShenShaBranches(liureng, key){
	const out = new Set();
	if(!liureng){
		return out;
	}
	[liureng.gods, liureng.godsGan, liureng.godsMonth, liureng.godsZi, liureng.godsYear, liureng.xun].forEach((obj)=>{
		if(!obj || typeof obj !== 'object'){
			return;
		}
		collectByKeyDeep(obj, key, out);
	});
	return out;
}

function hasAnyBranch(targets, branches){
	for(let i=0; i<branches.length; i++){
		if(targets.has(branches[i])){
			return true;
		}
	}
	return false;
}

function hasAllBranches(targets, branches){
	for(let i=0; i<branches.length; i++){
		if(!targets.has(branches[i])){
			return false;
		}
	}
	return true;
}

function allInSet(branches, setObj){
	if(!branches.length){
		return false;
	}
	return branches.every((b)=>setObj.has(b));
}

function toUnionSet(ctx){
	const out = new Set();
	(ctx.chuanZi || []).forEach((b)=>out.add(b));
	(ctx.keBranchSet ? [...ctx.keBranchSet] : []).forEach((b)=>out.add(b));
	return out;
}

function hasAnyInUnion(unionSet, branchSet){
	if(!unionSet || !branchSet || !(branchSet instanceof Set)){
		return false;
	}
	const arr = [...unionSet];
	return hasAnyBranch(branchSet, arr);
}

function hasAllTargetsInSet(setObj, targets){
	if(!setObj || !targets || !targets.length){
		return false;
	}
	return targets.every((b)=>!!b && setObj.has(b));
}

function getPrevGan(gan){
	const idx = LRConst.GanList.indexOf(gan);
	if(idx < 0){
		return '';
	}
	return LRConst.GanList[(idx + 9) % 10];
}

function getPrevZhi(zhi){
	const idx = LRConst.ZiList.indexOf(zhi);
	if(idx < 0){
		return '';
	}
	return LRConst.ZiList[(idx + 11) % 12];
}

function isYueLingYouQi(monthZhi, target){
	if(!monthZhi || !target){
		return false;
	}
	if(monthZhi === target){
		return true;
	}
	return LRConst.isBrother(monthZhi, target)
		|| LRConst.isAccrue(monthZhi, target)
		|| LRConst.isAccrue(target, monthZhi);
}

function isYueLingWeak(monthZhi, target){
	if(!monthZhi || !target){
		return false;
	}
	if(LRConst.isRestrain(monthZhi, target)){
		return true;
	}
	return !isYueLingYouQi(monthZhi, target);
}

function getZhangShengPhase(dayGan, branch){
	if(!dayGan || !branch || !ZhangSheng || !ZhangSheng.ganzi){
		return '';
	}
	return safeText(ZhangSheng.ganzi[`${dayGan}_${branch}`]);
}

function isZhangShengStrong(phase){
	return ['长生', '冠带', '临官', '帝旺'].indexOf(phase) >= 0;
}

function isZhangShengWeak(phase){
	return ['衰', '病', '死', '墓', '绝'].indexOf(phase) >= 0;
}

function isWuXingWin(a, b){
	if(!a || !b){
		return false;
	}
	return WUXING_KE[a] === b || WUXING_SHENG[b] === a;
}

function directionalDistance(fromIdx, toIdx, forward){
	if(fromIdx < 0 || toIdx < 0){
		return -1;
	}
	if(forward){
		return (toIdx - fromIdx + 12) % 12;
	}
	return (fromIdx - toIdx + 12) % 12;
}

function isAheadOf(referenceIdx, targetIdx, forward){
	const dist = directionalDistance(referenceIdx, targetIdx, forward);
	return dist > 0 && dist <= 5;
}

function getTianJiangIndex(layout, jiang){
	if(!layout || !layout.houseTianJiang || !jiang){
		return -1;
	}
	return layout.houseTianJiang.findIndex((name)=>safeText(name) === jiang);
}

function getBranchOfTianJiang(layout, jiang){
	const idx = getTianJiangIndex(layout, jiang);
	if(idx < 0){
		return '';
	}
	return layout.downZi && layout.downZi[idx] ? layout.downZi[idx] : '';
}

function isGuiRenForward(layout){
	if(!layout || !layout.houseTianJiang || !layout.houseTianJiang.length){
		return false;
	}
	const idxGui = getTianJiangIndex(layout, '贵人');
	if(idxGui < 0){
		return false;
	}
	return safeText(layout.houseTianJiang[(idxGui + 1) % 12]) === '螣蛇';
}

function getUpOnDown(layout, downBranch){
	if(!layout || !layout.downZi || !layout.upZi || !downBranch){
		return '';
	}
	const idx = layout.downZi.indexOf(downBranch);
	if(idx < 0){
		return '';
	}
	return safeText(layout.upZi[idx]);
}

function hasUpOnDown(layout, downBranch, upBranch){
	return getUpOnDown(layout, downBranch) === upBranch;
}

function getBranchGroup(branch){
	const b = safeText(branch);
	if(!b){
		return '';
	}
	if(LRConst.ZiMeng.indexOf(b) >= 0){
		return 'M';
	}
	if(LRConst.ZiZong.indexOf(b) >= 0){
		return 'Z';
	}
	if(LRConst.ZiJi.indexOf(b) >= 0){
		return 'J';
	}
	return '';
}

function isGongShiRule(layout, ruleMap){
	if(!layout || !layout.downZi || !layout.upZi){
		return false;
	}
	if(layout.downZi.length !== layout.upZi.length || !layout.downZi.length){
		return false;
	}
	for(let i=0; i<layout.downZi.length; i++){
		const downGroup = getBranchGroup(layout.downZi[i]);
		const upGroup = getBranchGroup(layout.upZi[i]);
		if(!downGroup || !upGroup){
			return false;
		}
		if(upGroup !== ruleMap[downGroup]){
			return false;
		}
	}
	return true;
}

function phaseScore(phase){
	if(isZhangShengStrong(phase)){
		return 1;
	}
	if(isZhangShengWeak(phase)){
		return -1;
	}
	return 0;
}

function buildContext(params){
	const liureng = params && params.liureng ? params.liureng : {};
	const layout = params && params.layout ? params.layout : {};
	const keRaw = params && params.keRaw ? params.keRaw : [];
	const sanChuan = params && params.sanChuan ? params.sanChuan : {};
	const dayGanZi = safeText(liureng.nongli && liureng.nongli.dayGanZi);
	const dayGan = dayGanZi.substring(0, 1);
	const dayZhi = dayGanZi.substring(dayGanZi.length - 1);
	const jieqi = safeText(liureng.nongli && liureng.nongli.jieqi);
	const yearGanZi = safeText(
		(liureng.nongli && liureng.nongli.yearGanZi)
			|| (liureng.fourColumns && liureng.fourColumns.year)
	);
	const monthGanZi = safeText(
		(liureng.nongli && liureng.nongli.monthGanZi)
			|| (liureng.fourColumns && liureng.fourColumns.month)
	);
	const timeGanZi = safeText(
		(liureng.nongli && liureng.nongli.time)
			|| (liureng.fourColumns && liureng.fourColumns.time)
	);
	const monthZhi = extractBranch(monthGanZi);
	const timeZhi = extractBranch(timeGanZi);
	const yearZhi = extractBranch(yearGanZi);
	const monthGan = extractGan(monthGanZi);
	const timeGan = extractGan(timeGanZi);
	const yearGan = extractGan(yearGanZi);
	const runyear = params && params.runyear ? params.runyear : null;
	const runYearGanZi = safeText(
		(runyear && runyear.year)
			|| (runyear && runyear.ganzhi)
			|| (liureng.runyear && liureng.runyear.year)
			|| (liureng.runyear && liureng.runyear.ganzhi)
	);
	const runYearBranch = extractBranch(
		runYearGanZi
	);
	const runYearGan = extractGan(runYearGanZi);
	let xunShou = extractBranch(liureng && liureng.xun ? liureng.xun['旬首'] : '');
	let xunWei = extractBranch(liureng && liureng.xun ? liureng.xun['旬尾'] : '');
	if((!xunShou || !xunWei) && dayGan && dayZhi && typeof LRConst.getXun === 'function'){
		const xunList = LRConst.getXun(dayGan, dayZhi);
		if(xunList && xunList.length){
			if(!xunShou){
				xunShou = xunList[0];
			}
			if(!xunWei){
				xunWei = xunList[xunList.length - 1];
			}
		}
	}
	const ke1Top = keRaw[0] && keRaw[0][1] ? safeText(keRaw[0][1]) : '';
	const ke3Top = keRaw[2] && keRaw[2][1] ? safeText(keRaw[2][1]) : '';
	const chuanZi = (sanChuan && sanChuan.cuang ? sanChuan.cuang : []).map((item)=>extractBranch(item)).filter((b)=>!!b);
	const chuanGan = (sanChuan && sanChuan.cuang ? sanChuan.cuang : []).map((item)=>extractGan(item)).filter((g)=>!!g);
	const chuanTianJiang = (sanChuan && sanChuan.tianJiang ? sanChuan.tianJiang : []).map((item)=>safeText(item));
	const chuanSet = new Set(chuanZi);
	const keBranchSet = new Set();
	(keRaw || []).forEach((ke)=>{
		if(!ke){
			return;
		}
		const up = extractBranch(ke[1]);
		const down = extractBranch(ke[2]);
		if(up){
			keBranchSet.add(up);
		}
		if(down){
			keBranchSet.add(down);
		}
	});
	return {
		liureng,
		layout,
		keRaw,
		sanChuan,
		dayGanZi,
		dayGan,
		dayZhi,
		jieqi,
		yearGan,
		yearZhi,
		monthGan,
		monthZhi,
		timeGan,
		timeZhi,
		runYearGanZi,
		runYearGan,
		runYearBranch,
		xunShou,
		xunWei,
		dayGanJi: LRConst.GanJiZi[dayGan] || '',
		ke1Top,
		ke3Top,
		chuanZi,
		chuanGan,
		chuanTianJiang,
		chuanSet,
		keBranchSet,
	};
}

function isYangDayGan(dayGan){
	return !!dayGan && LRConst.YangGan.indexOf(dayGan) >= 0;
}

function getKeDescriptors(keRaw){
	const raw = Array.isArray(keRaw) ? keRaw : [];
	return raw.map((ke, idx)=>{
		const upRaw = safeText(ke && ke[1]);
		const downRaw = safeText(ke && ke[2]);
		return {
			index: idx,
			upRaw,
			downRaw,
			topBranch: extractBranch(upRaw),
			downBranch: extractBranch(downRaw),
		};
	});
}

function uniqueBranches(branches){
	const out = [];
	(branches || []).forEach((b)=>{
		if(!b){
			return;
		}
		if(out.indexOf(b) >= 0){
			return;
		}
		out.push(b);
	});
	return out;
}

function getDownByUp(layout, upBranch){
	if(!layout || !layout.upZi || !layout.downZi || !upBranch){
		return '';
	}
	const idx = layout.upZi.indexOf(upBranch);
	if(idx < 0){
		return '';
	}
	return safeText(layout.downZi[idx]);
}

function getUpByDown(layout, downBranch){
	if(!layout || !layout.downZi || !layout.upZi || !downBranch){
		return '';
	}
	const idx = layout.downZi.indexOf(downBranch);
	if(idx < 0){
		return '';
	}
	return safeText(layout.upZi[idx]);
}

function getSequentialChuan(layout, firstBranch){
	const first = safeText(firstBranch);
	if(!first){
		return ['', '', ''];
	}
	const second = getUpByDown(layout, first);
	const third = getUpByDown(layout, second);
	return [first, second, third];
}

function getSeHaiCount(layout, topBranch){
	const branch = safeText(topBranch);
	if(!branch || !layout || !layout.upZi || !layout.downZi){
		return 0;
	}
	const upIdx = layout.upZi.indexOf(branch);
	let downIdx = layout.downZi.indexOf(branch);
	if(upIdx < 0 || downIdx < 0){
		return 0;
	}
	let cnt = 0;
	downIdx = downIdx >= upIdx ? downIdx : downIdx + 12;
	for(let i=upIdx; i<downIdx; i++){
		const idx = i % 12;
		const downBranch = safeText(layout.downZi[idx]);
		if(!downBranch){
			continue;
		}
		if(LRConst.isRestrain(downBranch, branch)){
			cnt = cnt + 1;
		}
		const hiddenGan = safeText(LRConst.ZiHanGan ? LRConst.ZiHanGan[downBranch] : '');
		if(hiddenGan){
			hiddenGan.split('').forEach((g)=>{
				if(LRConst.isRestrain(g, branch)){
					cnt = cnt + 1;
				}
			});
		}
	}
	return cnt;
}

function pickByBiYongAndSeHai(ctx, candidateBranches){
	const candidates = uniqueBranches(candidateBranches);
	if(!candidates.length){
		return {
			method: '',
			top: '',
			reason: '',
		};
	}
	const sameYingYang = ctx.dayGan
		? LRConst.sameYingYang(ctx.dayGan, candidates)
		: { cnt: 0, data: candidates };
	if(sameYingYang && sameYingYang.cnt === 1 && sameYingYang.data && sameYingYang.data[0]){
		return {
			method: DAGE_METHOD_NAMES.BIYONG,
			top: sameYingYang.data[0],
			reason: '多克择比，与日干阴阳同类者唯一',
		};
	}

	const sheHaiPool = uniqueBranches(
		(sameYingYang && sameYingYang.data && sameYingYang.data.length)
			? sameYingYang.data
			: candidates
	);
	const scoreMap = {};
	let maxScore = Number.NEGATIVE_INFINITY;
	sheHaiPool.forEach((b)=>{
		scoreMap[b] = getSeHaiCount(ctx.layout, b);
		if(scoreMap[b] > maxScore){
			maxScore = scoreMap[b];
		}
	});
	let winners = sheHaiPool.filter((b)=>scoreMap[b] === maxScore);
	if(winners.length === 1){
		return {
			method: DAGE_METHOD_NAMES.SHEHAI,
			top: winners[0],
			reason: `比用不决，按涉害深浅取用（受克${maxScore}层）`,
		};
	}

	const groups = [
		{ name: '孟', list: LRConst.ZiMeng },
		{ name: '仲', list: LRConst.ZiZong },
		{ name: '季', list: LRConst.ZiJi },
	];
	for(let i=0; i<groups.length; i++){
		const g = groups[i];
		const picked = winners.filter((upBranch)=>{
			const downBranch = getDownByUp(ctx.layout, upBranch);
			return !!downBranch && g.list.indexOf(downBranch) >= 0;
		});
		if(picked.length === 1){
			return {
				method: DAGE_METHOD_NAMES.SHEHAI,
				top: picked[0],
				reason: `涉害同分，按孟仲季取${g.name}`,
			};
		}
		if(picked.length > 1){
			winners = picked;
			break;
		}
	}

	const fallbackByDay = isYangDayGan(ctx.dayGan) ? extractBranch(ctx.ke1Top) : extractBranch(ctx.ke3Top);
	const fallback = fallbackByDay && winners.indexOf(fallbackByDay) >= 0
		? fallbackByDay
		: (fallbackByDay && candidates.indexOf(fallbackByDay) >= 0 ? fallbackByDay : winners[0]);
	return {
		method: DAGE_METHOD_NAMES.SHEHAI,
		top: fallback || winners[0] || candidates[0],
		reason: '涉害同分，按刚柔取日干/日支上神',
	};
}

function resolveNearMechanism(ctx, keDescriptors){
	const lowers = keDescriptors
		.filter((ke)=>ke.topBranch && ke.downRaw && LRConst.isRestrain(ke.downRaw, ke.upRaw))
		.map((ke)=>ke.topBranch);
	const uppers = keDescriptors
		.filter((ke)=>ke.topBranch && ke.downRaw && LRConst.isRestrain(ke.upRaw, ke.downRaw))
		.map((ke)=>ke.topBranch);
	const lowerList = uniqueBranches(lowers);
	const upperList = uniqueBranches(uppers);
	let relation = '';
	let candidates = [];
	if(lowerList.length){
		relation = '贼';
		candidates = lowerList;
	}else if(upperList.length){
		relation = '摄';
		candidates = upperList;
	}
	if(!relation || !candidates.length){
		return null;
	}
	if(candidates.length === 1){
		return {
			method: DAGE_METHOD_NAMES.JIESHE,
			relation,
			first: candidates[0],
			logic: `近克单一，${relation}先取发用`,
		};
	}
	const picked = pickByBiYongAndSeHai(ctx, candidates);
	return {
		method: picked.method || DAGE_METHOD_NAMES.SHEHAI,
		relation,
		first: picked.top,
		logic: `${relation}多克并见，${picked.reason || '择比涉害取用'}`,
	};
}

function resolveYaoKeMechanism(ctx, keDescriptors){
	if(!ctx.dayGan){
		return null;
	}
	const remote = keDescriptors.filter((ke)=>ke.index > 0);
	const sheList = uniqueBranches(
		remote
			.filter((ke)=>ke.topBranch && LRConst.isRestrain(ke.upRaw, ctx.dayGan))
			.map((ke)=>ke.topBranch)
	);
	if(sheList.length){
		if(sheList.length === 1){
			return {
				method: DAGE_METHOD_NAMES.YAOKE,
				relation: '遥摄',
				first: sheList[0],
				logic: '无近克，诸课上神有克日，取遥摄为用',
			};
		}
		const picked = pickByBiYongAndSeHai(ctx, sheList);
		return {
			method: DAGE_METHOD_NAMES.YAOKE,
			relation: '遥摄',
			first: picked.top,
			logic: `遥摄多课，${picked.reason || '择比涉害取用'}`,
		};
	}

	const zeiList = uniqueBranches(
		remote
			.filter((ke)=>ke.topBranch && LRConst.isRestrain(ctx.dayGan, ke.upRaw))
			.map((ke)=>ke.topBranch)
	);
	if(!zeiList.length){
		return null;
	}
	if(zeiList.length === 1){
		return {
			method: DAGE_METHOD_NAMES.YAOKE,
			relation: '遥贼',
			first: zeiList[0],
			logic: '无近克且无遥摄，取日干遥贼他课上神',
		};
	}
	const picked = pickByBiYongAndSeHai(ctx, zeiList);
	return {
		method: DAGE_METHOD_NAMES.YAOKE,
		relation: '遥贼',
		first: picked.top,
		logic: `遥贼多课，${picked.reason || '择比涉害取用'}`,
	};
}

function hasDuplicateKeTop(keDescriptors){
	const tops = keDescriptors.map((ke)=>ke.topBranch).filter((b)=>!!b);
	for(let i=0; i<tops.length; i++){
		for(let j=i+1; j<tops.length; j++){
			if(tops[i] === tops[j]){
				return true;
			}
		}
	}
	return false;
}

function resolveBaZhuanChuan(ctx, keDescriptors){
	const ke1Top = extractBranch(keDescriptors[0] && keDescriptors[0].topBranch);
	const ke3Top = extractBranch(keDescriptors[2] && keDescriptors[2].topBranch);
	const ke4Top = extractBranch(keDescriptors[3] && keDescriptors[3].topBranch);
	if(!ke1Top || !ke3Top || ke1Top !== ke3Top || !ctx.layout || !ctx.layout.upZi){
		return null;
	}
	let first = '';
	if(isYangDayGan(ctx.dayGan)){
		const idx = ctx.layout.upZi.indexOf(ke1Top);
		first = idx >= 0 ? safeText(ctx.layout.upZi[(idx + 2) % 12]) : '';
	}else{
		const idx = ctx.layout.upZi.indexOf(ke4Top);
		first = idx >= 0 ? safeText(ctx.layout.upZi[(idx + 10) % 12]) : '';
	}
	return {
		method: DAGE_METHOD_NAMES.BAZHUAN,
		relation: '',
		first,
		chuan: [first, ke1Top, ke1Top],
		logic: '无近无遥且一三同课，依刚顺柔逆数三取用',
	};
}

function resolveBieZeChuan(ctx, keDescriptors){
	if(!hasDuplicateKeTop(keDescriptors)){
		return null;
	}
	const ke1Top = extractBranch(keDescriptors[0] && keDescriptors[0].topBranch);
	if(!ke1Top){
		return null;
	}
	let first = '';
	if(isYangDayGan(ctx.dayGan)){
		const heGan = safeText(GAN_HE[ctx.dayGan]);
		const heZhi = safeText(LRConst.GanJiZi ? LRConst.GanJiZi[heGan] : '');
		const idx = heZhi && ctx.layout && ctx.layout.downZi ? ctx.layout.downZi.indexOf(heZhi) : -1;
		first = idx >= 0 && ctx.layout.upZi ? safeText(ctx.layout.upZi[idx]) : '';
	}else{
		const triad = LRConst.ZiSangHe ? LRConst.ZiSangHe[ctx.dayZhi] : null;
		first = triad && triad[1] ? triad[1] : '';
	}
	return {
		method: DAGE_METHOD_NAMES.BIEZE,
		relation: '',
		first,
		chuan: [first, ke1Top, ke1Top],
		logic: '无近无遥且双课一体，刚取干合、柔取支合发用',
	};
}

function resolveMaoXingChuan(ctx, keDescriptors){
	const ke1Top = extractBranch(keDescriptors[0] && keDescriptors[0].topBranch);
	const ke3Top = extractBranch(keDescriptors[2] && keDescriptors[2].topBranch);
	if(!ctx.layout || !ctx.layout.downZi || !ctx.layout.upZi){
		return null;
	}
	let first = '';
	let second = '';
	let third = '';
	if(isYangDayGan(ctx.dayGan)){
		const idx = ctx.layout.downZi.indexOf('酉');
		first = idx >= 0 ? safeText(ctx.layout.upZi[idx]) : '';
		second = ke3Top;
		third = ke1Top;
	}else{
		const idx = ctx.layout.upZi.indexOf('酉');
		first = idx >= 0 ? safeText(ctx.layout.downZi[idx]) : '';
		second = ke1Top;
		third = ke3Top;
	}
	return {
		method: DAGE_METHOD_NAMES.MAOXING,
		relation: '',
		first,
		chuan: [first, second, third],
		logic: '无近无遥，以酉（昴星）定发用，刚柔分取中末',
	};
}

function resolveNoKeMechanism(ctx, keDescriptors){
	const baZhuan = resolveBaZhuanChuan(ctx, keDescriptors);
	if(baZhuan){
		return baZhuan;
	}
	const bieZe = resolveBieZeChuan(ctx, keDescriptors);
	if(bieZe){
		return bieZe;
	}
	return resolveMaoXingChuan(ctx, keDescriptors);
}

function buildFuYinChuan(ctx, firstBranch){
	const first = safeText(firstBranch);
	if(!first){
		return ['', '', ''];
	}
	const xingFirst = safeText(LRConst.ZiXing ? LRConst.ZiXing[first] : '');
	let second = xingFirst;
	if(!xingFirst || xingFirst === first){
		second = extractBranch(ctx.ke3Top);
	}
	const xingSecond = safeText(LRConst.ZiXing ? LRConst.ZiXing[second] : '');
	let third = xingSecond;
	if(!xingSecond || xingSecond === second){
		third = safeText(LRConst.ZiCong ? LRConst.ZiCong[second] : '');
	}
	return [first, second, third];
}

function buildFanYinNoKeChuan(ctx){
	const first = safeText(LRConst.ZiYiMa ? LRConst.ZiYiMa[ctx.dayZhi] : '');
	const second = safeText(LRConst.ZiCong ? LRConst.ZiCong[first] : '');
	const third = safeText(LRConst.ZiXing ? LRConst.ZiXing[second] : '');
	return [first, second, third];
}

function getPanType(ctx){
	if(!ctx.layout || !ctx.layout.downZi || !ctx.layout.upZi || !ctx.layout.downZi.length || !ctx.layout.upZi.length){
		return '';
	}
	const down0 = safeText(ctx.layout.downZi[0]);
	const up0 = safeText(ctx.layout.upZi[0]);
	if(!down0 || !up0){
		return '';
	}
	if(down0 === up0){
		return '伏吟';
	}
	if(down0 === safeText(LRConst.ZiCong ? LRConst.ZiCong[up0] : '')){
		return '返吟';
	}
	return '';
}

function deriveStrictDageCase(ctx){
	const keDescriptors = getKeDescriptors(ctx.keRaw);
	if(keDescriptors.length !== 4){
		return null;
	}
	const near = resolveNearMechanism(ctx, keDescriptors);
	const panType = getPanType(ctx);

	if(panType === '伏吟'){
		const defaultFirst = isYangDayGan(ctx.dayGan)
			? extractBranch(keDescriptors[0] && keDescriptors[0].topBranch)
			: extractBranch(keDescriptors[2] && keDescriptors[2].topBranch);
		const first = near && near.first ? near.first : defaultFirst;
		const chuan = buildFuYinChuan(ctx, first);
		return {
			panType,
			method: near ? near.method : '',
			relation: near ? near.relation : '',
			first: chuan[0],
			chuan,
			logic: near
				? `伏吟有近克，仍依${near.logic}，中末改取递刑`
				: '伏吟无近克，刚日取干上、柔日取支上，中末递刑',
		};
	}

	if(panType === '返吟'){
		if(near && near.first){
			return {
				panType,
				method: near.method,
				relation: near.relation,
				first: near.first,
				chuan: getSequentialChuan(ctx.layout, near.first),
				logic: `返吟有近克，仍依${near.logic}，中末递取`,
			};
		}
		const chuan = buildFanYinNoKeChuan(ctx);
		return {
			panType,
			method: '',
			relation: '',
			first: chuan[0],
			chuan,
			logic: '返吟无近克，以日支驿马发用，中冲末刑',
		};
	}

	if(near && near.first){
		return {
			panType: '',
			method: near.method,
			relation: near.relation,
			first: near.first,
			chuan: getSequentialChuan(ctx.layout, near.first),
			logic: near.logic,
		};
	}

	const yaoKe = resolveYaoKeMechanism(ctx, keDescriptors);
	if(yaoKe && yaoKe.first){
		return {
			panType: '',
			method: yaoKe.method,
			relation: yaoKe.relation,
			first: yaoKe.first,
			chuan: getSequentialChuan(ctx.layout, yaoKe.first),
			logic: yaoKe.logic,
		};
	}

	const noKe = resolveNoKeMechanism(ctx, keDescriptors);
	if(!noKe){
		return null;
	}
	return {
		panType: '',
		method: noKe.method,
		relation: noKe.relation,
		first: noKe.first,
		chuan: noKe.chuan,
		logic: noKe.logic,
	};
}

function mapStrictCaseToDageName(strictCase){
	if(!strictCase){
		return '';
	}
	if(strictCase.panType === '伏吟'){
		return '信任';
	}
	if(strictCase.panType === '返吟'){
		return '无依';
	}
	switch(strictCase.method){
	case DAGE_METHOD_NAMES.JIESHE:
		return strictCase.relation === '摄' ? '元首' : '重审';
	case DAGE_METHOD_NAMES.BIYONG:
		return '知一';
	case DAGE_METHOD_NAMES.SHEHAI:
		return '见机';
	case DAGE_METHOD_NAMES.YAOKE:
		return '矢射';
	case DAGE_METHOD_NAMES.MAOXING:
		return '虎视';
	case DAGE_METHOD_NAMES.BIEZE:
		return '芜淫';
	case DAGE_METHOD_NAMES.BAZHUAN:
		return '帷簿';
	default:
		return '';
	}
}

function buildStrictDageBasis(strictCase){
	if(!strictCase){
		return '';
	}
	const chunks = [];
	if(strictCase.panType){
		chunks.push(`${strictCase.panType}盘体`);
	}
	if(strictCase.method === DAGE_METHOD_NAMES.JIESHE){
		chunks.push(`近克${strictCase.relation || ''}单一取用（贼优先于摄）`);
	}else if(strictCase.method === DAGE_METHOD_NAMES.BIYONG){
		chunks.push('近克多课，按与日干同阴阳取比用');
	}else if(strictCase.method === DAGE_METHOD_NAMES.SHEHAI){
		chunks.push('比用不决，按涉害深浅并以孟仲季/刚柔决断');
	}else if(strictCase.method === DAGE_METHOD_NAMES.YAOKE){
		chunks.push(`无近克，按${strictCase.relation || '遥克'}发用`);
	}else if(strictCase.method === DAGE_METHOD_NAMES.MAOXING){
		chunks.push('无近无遥，取昴星法');
	}else if(strictCase.method === DAGE_METHOD_NAMES.BIEZE){
		chunks.push('无近无遥且双课一体，取别责');
	}else if(strictCase.method === DAGE_METHOD_NAMES.BAZHUAN){
		chunks.push('无近无遥且一三同课，取八专');
	}
	if(strictCase.logic){
		chunks.push(strictCase.logic);
	}
	if(strictCase.chuan && strictCase.chuan[0]){
		const c1 = strictCase.chuan[0] || '—';
		const c2 = strictCase.chuan[1] || '—';
		const c3 = strictCase.chuan[2] || '—';
		chunks.push(`三传取法：初${c1} / 中${c2} / 末${c3}`);
	}
	return chunks.join('；');
}

function evalDage(ctx){
	const hits = [];
	const strictCase = deriveStrictDageCase(ctx);
	const strictName = mapStrictCaseToDageName(strictCase);
	if(strictName){
		uniquePush(hits, {
			name: strictName,
			basis: buildStrictDageBasis(strictCase),
		});
		return hits;
	}

	const cuangName = safeText(ctx.sanChuan && ctx.sanChuan.name);
	if(cuangName && DAGE_NAME_BY_CHUANG_FALLBACK[cuangName]){
		uniquePush(hits, DAGE_NAME_BY_CHUANG_FALLBACK[cuangName]);
	}
	return hits;
}

function evalXiaoju(ctx){
	const hits = [];
	const unionSet = toUnionSet(ctx);
	const firstJiang = ctx.chuanTianJiang[0] || '';
	const lastJiang = ctx.chuanTianJiang[2] || '';
	const hasTianHou = ctx.chuanTianJiang.indexOf('天后') >= 0;
	const hasLiuHe = ctx.chuanTianJiang.indexOf('六合') >= 0;
	const hasTaiYin = ctx.chuanTianJiang.indexOf('太阴') >= 0;
	const firstChuan = ctx.chuanZi[0] || '';
	const lastChuan = ctx.chuanZi[2] || '';
	const firstPhase = getZhangShengPhase(ctx.dayGan, firstChuan);
	const lastPhase = getZhangShengPhase(ctx.dayGan, lastChuan);
	const spouseRunYearGanZi = safeText(
		(ctx.liureng && (ctx.liureng.spouseRunYearGanZi || ctx.liureng.spouseRunyearGanZi || ctx.liureng.partnerRunYearGanZi))
		|| (ctx.liureng && ctx.liureng.spouseRunyear && (ctx.liureng.spouseRunyear.year || ctx.liureng.spouseRunyear.ganzhi))
		|| (ctx.liureng && ctx.liureng.partnerRunyear && (ctx.liureng.partnerRunyear.year || ctx.liureng.partnerRunyear.ganzhi))
	);
	const spouseRunYearBranch = extractBranch(spouseRunYearGanZi);
	const spouseRunYearGan = extractGan(spouseRunYearGanZi);
	const sunBranch = extractBranch(
		safeText(
			(ctx.liureng && ctx.liureng.nongli && (ctx.liureng.nongli.sunBranch || ctx.liureng.nongli.sunXiuBranch))
			|| (ctx.liureng && (ctx.liureng.sunBranch || ctx.liureng.sunXiuBranch))
		)
	);
	const moonBranch = extractBranch(
		safeText(
			(ctx.liureng && ctx.liureng.nongli && (ctx.liureng.nongli.moonBranch || ctx.liureng.nongli.moonXiuBranch))
			|| (ctx.liureng && (ctx.liureng.moonBranch || ctx.liureng.moonXiuBranch))
		)
	);

	if(hasTianHou && hasLiuHe){
		uniquePush(hits, { name: '后合', basis: '三传天将同见“天后、六合”' });
		if(firstJiang === '天后' && lastJiang === '六合'){
			uniquePush(hits, { name: '泆女', basis: '初传天后、末传六合' });
		}
		if(firstJiang === '六合' && lastJiang === '天后'){
			uniquePush(hits, { name: '狡童', basis: '初传六合、末传天后' });
		}
	}

	if(allInSet(ctx.chuanZi, new Set(LRConst.ZiMeng))){
		uniquePush(hits, { name: '元胎', basis: '三传皆孟（寅申巳亥）' });
	}

	if(allInSet(ctx.chuanZi, new Set(LRConst.ZiZong)) && hasTaiYin && hasLiuHe){
		uniquePush(hits, { name: '三交', basis: '三传皆仲且三传同见太阴、六合' });
	}

	if(ctx.ke1Top && (ctx.ke1Top === '辰' || ctx.ke1Top === '戌')){
		uniquePush(hits, { name: '斩关', basis: '辰/戌临日干（四课上神命中）' });
	}
	if(ctx.ke3Top && (ctx.ke3Top === '辰' || ctx.ke3Top === '戌')){
		uniquePush(hits, { name: '斩关', basis: '辰/戌临日支（四课上神命中）' });
	}

	const tianMaSet = getShenShaBranches(ctx.liureng, '天马');
	const xunDingSet = getShenShaBranches(ctx.liureng, '旬丁');
	if(allInSet(ctx.chuanZi, new Set(LRConst.ZiJi))
		&& (hasAnyBranch(tianMaSet, ctx.chuanZi) || hasAnyBranch(xunDingSet, ctx.chuanZi)
			|| hasAnyBranch(tianMaSet, [...ctx.keBranchSet]) || hasAnyBranch(xunDingSet, [...ctx.keBranchSet]))){
		uniquePush(hits, { name: '游子', basis: '三传皆季，且课传见旬丁/天马' });
	}

	const guChenSet = getShenShaBranches(ctx.liureng, '孤辰');
	const guaXiuSet = getShenShaBranches(ctx.liureng, '寡宿');
	const xunKongSet = new Set();
	flattenBranches(ctx.liureng && ctx.liureng.xun ? ctx.liureng.xun['旬空'] : '', xunKongSet);
	flattenBranches(ctx.liureng && ctx.liureng.xun ? ctx.liureng.xun['日空'] : '', xunKongSet);
	flattenBranches(ctx.liureng && ctx.liureng.xun ? ctx.liureng.xun['时空'] : '', xunKongSet);
	if(hasAnyInUnion(unionSet, guChenSet) && hasAnyInUnion(unionSet, guaXiuSet) && hasAnyInUnion(unionSet, xunKongSet)){
		uniquePush(hits, { name: '孤寡', basis: '孤辰、寡宿、旬空皆入课传' });
	}

	const xunShou = ctx.xunShou || '';
	const xunWei = ctx.xunWei || '';
	if(xunShou && xunWei && ctx.layout && ctx.layout.downZi && ctx.layout.upZi && ctx.layout.houseTianJiang){
		const idxHead = ctx.layout.downZi.indexOf(xunShou);
		if(idxHead >= 0){
			const onHead = safeText(ctx.layout.houseTianJiang[idxHead]);
			const upOnHead = safeText(ctx.layout.upZi[idxHead]);
			const firstChuan = ctx.chuanZi[0] || '';
			if(onHead === '玄武' && upOnHead === xunWei && firstChuan === xunWei){
				uniquePush(hits, { name: '闭口', basis: '旬首乘玄武、旬尾临旬首、旬尾发用' });
			}
		}
	}

	if(ctx.keRaw.length === 4){
		const allUpperRestrain = ctx.keRaw.every((ke)=>ke && ke[1] && ke[2] && LRConst.isRestrain(ke[1], ke[2]));
		if(allUpperRestrain){
			uniquePush(hits, { name: '绝嗣', basis: '四课俱摄（上克下）' });
		}
		const allLowerRestrain = ctx.keRaw.every((ke)=>ke && ke[1] && ke[2] && LRConst.isRestrain(ke[2], ke[1]));
		if(allLowerRestrain){
			uniquePush(hits, { name: '无禄', basis: '四课俱贼（下克上）' });
		}
	}

	if(ctx.dayGan && ctx.dayZhi && ctx.ke1Top && ctx.ke3Top){
		if(ctx.ke1Top === ctx.dayZhi && LRConst.isRestrain(ctx.dayZhi, ctx.dayGan)){
			uniquePush(hits, { name: '乱首', basis: '日干临日支且被日支所克' });
		}
		if(LRConst.isRestrain(ctx.dayGan, ctx.ke3Top) && LRConst.isRestrain(ctx.dayZhi, ctx.ke1Top)){
			uniquePush(hits, { name: '解离', basis: '日干克日支上神且日支克日干上神' });
		}
		if(ctx.ke1Top === ctx.dayZhi && LRConst.isRestrain(ctx.dayGan, ctx.dayZhi)){
			uniquePush(hits, { name: '赘婿', basis: '日干临日支，且日干克日支' });
		}
	}

	if((ctx.dayZhi === '卯' || ctx.dayZhi === '酉') && (ctx.chuanZi[0] === '卯' || ctx.chuanZi[0] === '酉')){
		if(!ctx.runYearBranch || ctx.runYearBranch === '卯' || ctx.runYearBranch === '酉'){
			uniquePush(hits, { name: '龙战', basis: ctx.runYearBranch ? '卯酉日、卯酉发用、行年卯酉' : '卯酉日、卯酉发用（行年缺失按课传判）' });
		}
	}

	if(ctx.timeZhi && ctx.dayGan && ctx.chuanZi[0]){
		if(LRConst.isRestrain(ctx.timeZhi, ctx.dayGan) && LRConst.isRestrain(ctx.chuanZi[0], ctx.dayGan)){
			uniquePush(hits, { name: '天网', basis: '时支与初传同克日干' });
		}
	}

	if(hasAllBranches(ctx.chuanSet, ['子', '卯', '午']) && (ctx.monthZhi === '寅' || ctx.monthZhi === '申')){
		uniquePush(hits, { name: '轩盖', basis: '三传见子卯午，且时值正月/七月（寅/申月）' });
	}

	if(hasAllBranches(ctx.chuanSet, ['巳', '戌', '卯'])){
		uniquePush(hits, { name: '铸印', basis: '三传同见巳、戌、卯' });
	}

	if(ctx.layout && ctx.layout.downZi && ctx.layout.upZi){
		const idxShen = ctx.layout.downZi.indexOf('申');
		if(idxShen >= 0 && safeText(ctx.layout.upZi[idxShen]) === '卯'){
			uniquePush(hits, { name: '斫轮', basis: '天地盘见“卯临申”' });
		}
		const guirenOnMaoYou = ['卯', '酉'].some((branch)=>{
			const idx = ctx.layout.downZi.indexOf(branch);
			if(idx < 0){
				return false;
			}
			return safeText(ctx.layout.houseTianJiang && ctx.layout.houseTianJiang[idx]) === '贵人';
		});
		if(guirenOnMaoYou){
			uniquePush(hits, { name: '励德', basis: '贵人临卯或酉' });
		}
		if(ctx.yearZhi && ctx.layout.yue){
			const idxYear = ctx.layout.downZi.indexOf(ctx.yearZhi);
			const idxYue = ctx.layout.downZi.indexOf(ctx.layout.yue);
			const yearRideGui = idxYear >= 0 && safeText(ctx.layout.houseTianJiang && ctx.layout.houseTianJiang[idxYear]) === '贵人';
			const yueRideGui = idxYue >= 0 && safeText(ctx.layout.houseTianJiang && ctx.layout.houseTianJiang[idxYue]) === '贵人';
			if(yearRideGui && yueRideGui && firstJiang === '贵人'){
				uniquePush(hits, { name: '龙德', basis: '年支与月将同乘贵人，且贵人发用' });
			}
		}
	}

	if(ctx.chuanGan.some((g)=>g === '乙' || g === '丙' || g === '丁')){
		uniquePush(hits, { name: '三奇', basis: '课传见乙/丙/丁（三奇）' });
	}

	const xunYiSet = getShenShaBranches(ctx.liureng, '旬仪');
	const zhiYiSet = getShenShaBranches(ctx.liureng, '支仪');
	if(hasAnyInUnion(unionSet, xunYiSet) || hasAnyInUnion(unionSet, zhiYiSet)){
		uniquePush(hits, { name: '六仪', basis: '旬仪或支仪入课传' });
	}

	if(ctx.chuanZi[0] === '戌' && firstJiang === '太常'){
		const yiMaSet = getShenShaBranches(ctx.liureng, '驿马');
		const tianMaSet2 = getShenShaBranches(ctx.liureng, '天马');
		if(hasAnyInUnion(unionSet, yiMaSet) || hasAnyInUnion(unionSet, tianMaSet2)){
			uniquePush(hits, { name: '官爵', basis: '戌乘太常发用，驿马/天马入课传' });
		}
	}

	const targetTriad = [ctx.runYearBranch, ctx.dayGanJi, ctx.dayZhi].filter((b)=>!!b);
	if(targetTriad.length === 3){
		const youHunSet = getShenShaBranches(ctx.liureng, '游魂');
		if(hasAllTargetsInSet(youHunSet, targetTriad)){
			uniquePush(hits, { name: '飞魂', basis: '游魂临行年、日干寄宫、日支' });
		}
		const sangMenSet = getShenShaBranches(ctx.liureng, '丧门');
		if(hasAllTargetsInSet(sangMenSet, targetTriad)){
			uniquePush(hits, { name: '丧门', basis: '丧门临行年、日干寄宫、日支' });
		}
		const tianGuiSet = getShenShaBranches(ctx.liureng, '天鬼');
		if(hasAllTargetsInSet(tianGuiSet, targetTriad)){
			uniquePush(hits, { name: '伏殃', basis: '天鬼临行年、日干寄宫、日支' });
		}
		const tianLuoSet = getShenShaBranches(ctx.liureng, '天罗');
		const diWangSet = getShenShaBranches(ctx.liureng, '地网');
		if(hasAllTargetsInSet(tianLuoSet, targetTriad) || hasAllTargetsInSet(diWangSet, targetTriad)){
			uniquePush(hits, { name: '罗网', basis: '天罗或地网临行年、日干寄宫、日支' });
		}
	}

	if(ctx.chuanZi.length === 3){
		const idx = ctx.chuanZi.map((b)=>LRConst.ZiList.indexOf(b));
		const isForward = idx[1] === (idx[0] + 1) % 12 && idx[2] === (idx[1] + 1) % 12;
		const isBackward = idx[1] === (idx[0] + 11) % 12 && idx[2] === (idx[1] + 11) % 12;
		if(isForward || isBackward){
			uniquePush(hits, { name: '连珠', basis: isForward ? '三传顺连珠（递进）' : '三传退连珠（递退）' });
		}
	}

	WUXING_JU_RULES.forEach((rule)=>{
		if(allInSet(ctx.chuanZi, rule.set)){
			uniquePush(hits, { name: rule.name, basis: `三传同属${rule.name}五行局` });
		}
	});

	if(hasAllBranches(ctx.chuanSet, ['亥', '子', '丑'])){
		uniquePush(hits, { name: '三奇连珠', basis: '三传同时包含亥、子、丑' });
	}

	const heGanSet = new Set(ctx.chuanGan.filter((g)=>!!g));
	(ctx.keRaw || []).forEach((ke)=>{
		if(!ke){
			return;
		}
		const upGan = extractGan(ke[1]);
		const downGan = extractGan(ke[2]);
		if(upGan){
			heGanSet.add(upGan);
		}
		if(downGan){
			heGanSet.add(downGan);
		}
	});
	const heTypedHits = [];
	GAN_HE_TYPED_RULES.forEach((rule)=>{
		if(heGanSet.has(rule.a) && heGanSet.has(rule.b)){
			heTypedHits.push(rule.name);
			uniquePush(hits, { name: rule.name, basis: `课传见${rule.a}${rule.b}相合` });
		}
	});
	if(heTypedHits.length){
		uniquePush(hits, { name: '天合局', basis: `课传天干见合：${heTypedHits.join('、')}` });
	}else if(ctx.chuanGan.length >= 2){
		for(let i=0; i<ctx.chuanGan.length; i++){
			for(let j=i+1; j<ctx.chuanGan.length; j++){
				const a = ctx.chuanGan[i];
				const b = ctx.chuanGan[j];
				if(GAN_HE[a] === b || GAN_HE[b] === a){
					uniquePush(hits, { name: '天合局', basis: `三传天干出现${a}${b}相合` });
				}
			}
		}
	}

	if(ctx.runYearBranch && spouseRunYearBranch && ctx.monthZhi){
		const triad = new Set([ctx.runYearBranch, ...(LRConst.ZiSangHe[ctx.runYearBranch] || [])]);
		const triadReady = triad.has(spouseRunYearBranch) && triad.has(ctx.monthZhi);
		if(triadReady && isYueLingYouQi(ctx.monthZhi, ctx.runYearBranch) && isYueLingYouQi(ctx.monthZhi, spouseRunYearBranch)){
			uniquePush(hits, { name: '旺孕', basis: '夫妇行年同旺且成三合，并见月令有气' });
		}
	}

	if(ctx.runYearGan && spouseRunYearGan && (GAN_HE[ctx.runYearGan] === spouseRunYearGan || GAN_HE[spouseRunYearGan] === ctx.runYearGan)){
		uniquePush(hits, { name: '德孕', basis: `夫妇行年天干见五合（${ctx.runYearGan}${spouseRunYearGan}）` });
	}

	if(ctx.dayGan && ctx.dayZhi){
		const deElem = DE_WUXING_BY_DAY_GAN[ctx.dayGan] || '';
		const xingElem = XING_WUXING_BY_DAY_ZHI[ctx.dayZhi] || '';
		if(deElem && xingElem){
			let relation = '德刑同位';
			if(isWuXingWin(deElem, xingElem) && !isWuXingWin(xingElem, deElem)){
				relation = '德胜刑';
			}else if(isWuXingWin(xingElem, deElem) && !isWuXingWin(deElem, xingElem)){
				relation = '刑胜德';
			}
			uniquePush(hits, { name: '刑德', basis: `德行${deElem}、刑行${xingElem}，判为${relation}` });
		}
	}

	if(firstChuan && ctx.dayGan){
		const qin = safeText(LRConst.ZiLiuQin && LRConst.ZiLiuQin[firstChuan] ? LRConst.ZiLiuQin[firstChuan][ctx.dayGan] : '');
		if(qin){
			uniquePush(hits, { name: '物气', basis: `初传${firstChuan}对日干${ctx.dayGan}为${qin}` });
		}
	}

	if(firstChuan && ctx.dayGan){
		const phase = getZhangShengPhase(ctx.dayGan, firstChuan);
		let state = '中平';
		if(isZhangShengStrong(phase) || LRConst.YangZi.indexOf(firstChuan) >= 0){
			state = '偏新';
		}
		if(isZhangShengWeak(phase) || LRConst.YingZi.indexOf(firstChuan) >= 0){
			state = state === '偏新' ? state : '偏旧';
		}
		uniquePush(hits, { name: '新故', basis: `初传${firstChuan}在日干${ctx.dayGan}为${phase || '未知'}，判${state}` });
	}

	if(firstChuan && ctx.dayGan){
		let fu = 0;
		let dun = 0;
		if(isYueLingYouQi(ctx.monthZhi, firstChuan)){
			fu = fu + 1;
		}
		if(isYueLingWeak(ctx.monthZhi, firstChuan)){
			dun = dun + 1;
		}
		if(isZhangShengStrong(firstPhase)){
			fu = fu + 1;
		}
		if(isZhangShengWeak(firstPhase)){
			dun = dun + 1;
		}
		if(JIANG_JI.has(firstJiang)){
			fu = fu + 1;
		}
		if(JIANG_XIONG.has(firstJiang)){
			dun = dun + 1;
		}
		if(ctx.timeZhi && LRConst.isRestrain(ctx.timeZhi, firstChuan)){
			dun = dun + 1;
		}
		if(dun >= 2 || fu >= 2){
			uniquePush(hits, { name: '迍福', basis: `发用迍数${dun}、福数${fu}` });
		}
	}

	if(firstChuan && lastChuan){
		let startScore = phaseScore(firstPhase);
		let endScore = phaseScore(lastPhase);
		if(isYueLingYouQi(ctx.monthZhi, firstChuan)){
			startScore = startScore + 1;
		}
		if(isYueLingYouQi(ctx.monthZhi, lastChuan)){
			endScore = endScore + 1;
		}
		if(JIANG_JI.has(firstJiang)){
			startScore = startScore + 1;
		}
		if(JIANG_XIONG.has(firstJiang)){
			startScore = startScore - 1;
		}
		if(JIANG_JI.has(lastJiang)){
			endScore = endScore + 1;
		}
		if(JIANG_XIONG.has(lastJiang)){
			endScore = endScore - 1;
		}
		let trend = '首尾平衡';
		if(startScore < endScore){
			trend = '先凶后吉';
		}else if(startScore > endScore){
			trend = '先吉后凶';
		}
		uniquePush(hits, { name: '始终', basis: `初传评分${startScore}，末传评分${endScore}，判${trend}` });
	}

	if(NINE_CHOU_DAYS.has(ctx.dayGanZi) && ctx.ke3Top === '丑'){
		uniquePush(hits, { name: '九丑', basis: '九丑日且丑临日支' });
	}

	if(sunBranch && moonBranch
		&& LRConst.ZiZong.indexOf(sunBranch) >= 0
		&& LRConst.ZiZong.indexOf(moonBranch) >= 0
		&& (hasUpOnDown(ctx.layout, '丑', '辰') || hasUpOnDown(ctx.layout, '未', '辰'))){
		uniquePush(hits, { name: '二烦', basis: `太阳临${sunBranch}、太阴临${moonBranch}（皆四仲），且斗罡加丑/未` });
	}

	const jueBranch = safeText(ZhangSheng && ZhangSheng.ganphase ? ZhangSheng.ganphase[`${ctx.dayGan}_绝`] : '');
	if(JIEQI_LI.has(ctx.jieqi) && jueBranch && (ctx.ke1Top === jueBranch || ctx.ke3Top === jueBranch || firstChuan === jueBranch)){
		uniquePush(hits, { name: '天祸', basis: `值四立（${ctx.jieqi}），绝神${jueBranch}入课传` });
	}

	const prevDayZhi = getPrevZhi(ctx.dayZhi);
	if(JIEQI_FENZHI.has(ctx.jieqi) && prevDayZhi && moonBranch && moonBranch === prevDayZhi){
		uniquePush(hits, { name: '天寇', basis: `值分至（${ctx.jieqi}），太阴临离神（昨支${prevDayZhi}）` });
	}

	const changShengBranch = safeText(ZhangSheng && ZhangSheng.ganphase ? ZhangSheng.ganphase[`${ctx.dayGan}_长生`] : '');
	const chenOnChangSheng = changShengBranch ? hasUpOnDown(ctx.layout, changShengBranch, '辰') : false;
	const firstWeakByKe = !!firstChuan && ctx.keRaw.some((ke)=>{
		const up = extractBranch(ke && ke[1]);
		const down = extractBranch(ke && ke[2]);
		return up === firstChuan && !!down && LRConst.isRestrain(down, up);
	});
	if(chenOnChangSheng && firstChuan
		&& (isYueLingWeak(ctx.monthZhi, firstChuan) || isZhangShengWeak(firstPhase) || firstWeakByKe)){
		uniquePush(hits, { name: '天狱', basis: '辰临日干长生且发用受制（休囚/墓克）' });
	}

	if(ctx.layout && ctx.layout.downZi && ctx.layout.upZi){
		const douDown = [];
		for(let i=0; i<ctx.layout.downZi.length; i++){
			if(safeText(ctx.layout.upZi[i]) === '辰'){
				douDown.push(ctx.layout.downZi[i]);
			}
		}
		const keyBranches = [ctx.dayGanJi, ctx.dayZhi, ctx.runYearBranch].filter((b)=>!!b);
		const hitDou = douDown.filter((b)=>keyBranches.indexOf(b) >= 0);
		if(hitDou.length){
			const group = hitDou.map((b)=>{
				if(LRConst.ZiMeng.indexOf(b) >= 0){
					return `${b}(孟)`;
				}
				if(LRConst.ZiZong.indexOf(b) >= 0){
					return `${b}(仲)`;
				}
				return `${b}(季)`;
			}).join('、');
			uniquePush(hits, { name: '死奇', basis: `斗罡（辰）临${group}` });
		}

		if(douDown.some((b)=>LRConst.ZiMeng.indexOf(b) >= 0)){
			uniquePush(hits, { name: '斗孟', basis: '北斗（辰）加临四孟' });
		}
		if(douDown.some((b)=>LRConst.ZiZong.indexOf(b) >= 0)){
			uniquePush(hits, { name: '斗仲', basis: '北斗（辰）加临四仲' });
		}
		if(douDown.some((b)=>LRConst.ZiJi.indexOf(b) >= 0)){
			uniquePush(hits, { name: '斗季', basis: '北斗（辰）加临四季' });
		}
	}

	if(isGongShiRule(ctx.layout, { M: 'Z', Z: 'J', J: 'M' })){
		uniquePush(hits, { name: '绛宫时', basis: '宫时：四孟临四仲（四仲临四季、四季临四孟）' });
	}
	if(isGongShiRule(ctx.layout, { M: 'M', Z: 'Z', J: 'J' })){
		uniquePush(hits, { name: '明堂时', basis: '宫时：四仲临四仲（四孟临四孟、四季临四季）' });
	}
	if(isGongShiRule(ctx.layout, { M: 'J', Z: 'M', J: 'Z' })){
		uniquePush(hits, { name: '玉堂时', basis: '宫时：四季临四仲（四孟临四季、四仲临四孟）' });
	}

	const deadSet = getShenShaBranches(ctx.liureng, '死神');
	const baihuBranch = getBranchOfTianJiang(ctx.layout, '白虎');
	if(baihuBranch){
		const mainArr = [ctx.dayGanJi, ctx.dayZhi, ctx.runYearBranch].filter((b)=>!!b);
		const nearMain = mainArr.indexOf(baihuBranch) >= 0;
		const deadHit = deadSet.has(baihuBranch) || hasAnyInUnion(unionSet, deadSet);
		if(nearMain && deadHit){
			uniquePush(hits, { name: '魄化', basis: `白虎临${baihuBranch}并携死神` });
		}
	}

	if(ctx.layout && ctx.layout.downZi && ctx.layout.houseTianJiang){
		const guiIdx = getTianJiangIndex(ctx.layout, '贵人');
		const isForward = isGuiRenForward(ctx.layout);
		const dayGanJiIdx = ctx.layout.downZi.indexOf(ctx.dayGanJi);
		const dayZhiIdx = ctx.layout.downZi.indexOf(ctx.dayZhi);
		const xuanwuIdx = getTianJiangIndex(ctx.layout, '玄武');
		const baihuIdx = getTianJiangIndex(ctx.layout, '白虎');
		const dayStrong = isYueLingYouQi(ctx.monthZhi, ctx.dayGan) && isYueLingYouQi(ctx.monthZhi, ctx.dayZhi);
		const firstStrong = firstChuan && isYueLingYouQi(ctx.monthZhi, firstChuan);
		const noChuanRestrain = ctx.chuanZi.length === 3 && !(
			LRConst.isRestrain(ctx.chuanZi[0], ctx.chuanZi[1])
			|| LRConst.isRestrain(ctx.chuanZi[1], ctx.chuanZi[0])
			|| LRConst.isRestrain(ctx.chuanZi[1], ctx.chuanZi[2])
			|| LRConst.isRestrain(ctx.chuanZi[2], ctx.chuanZi[1])
			|| LRConst.isRestrain(ctx.chuanZi[0], ctx.chuanZi[2])
			|| LRConst.isRestrain(ctx.chuanZi[2], ctx.chuanZi[0])
		);
		const allJiJiang = ctx.chuanTianJiang.length === 3 && ctx.chuanTianJiang.every((jiang)=>JIANG_JI.has(jiang));
		if(dayStrong && firstStrong && allJiJiang && noChuanRestrain){
			uniquePush(hits, { name: '三光', basis: '日辰与发用旺相，三传乘吉将且无相克' });
		}
		if(isForward && guiIdx >= 0 && dayGanJiIdx >= 0 && dayZhiIdx >= 0
			&& isAheadOf(guiIdx, dayGanJiIdx, true) && isAheadOf(guiIdx, dayZhiIdx, true)
			&& dayStrong && firstStrong){
			uniquePush(hits, { name: '三阳', basis: '贵人顺治，日辰居贵前且日辰发用旺相' });
		}
		if(!isForward && dayGanJiIdx >= 0 && xuanwuIdx >= 0 && baihuIdx >= 0
			&& isAheadOf(dayGanJiIdx, xuanwuIdx, false)
			&& isAheadOf(dayGanJiIdx, baihuIdx, false)
			&& (isYueLingWeak(ctx.monthZhi, firstChuan) || isZhangShengWeak(firstPhase))
			&& (isYueLingWeak(ctx.monthZhi, lastChuan) || isZhangShengWeak(lastPhase))
			&& ctx.timeZhi && ctx.runYearBranch && LRConst.isRestrain(ctx.timeZhi, ctx.runYearBranch)){
			uniquePush(hits, { name: '三阴', basis: '贵逆、武虎居日前、初末休囚且时克行年' });
		}

		const guiBranch = getBranchOfTianJiang(ctx.layout, '贵人');
		const guiMain = [ctx.runYearBranch, ctx.dayGanJi, ctx.dayZhi].filter((b)=>!!b).indexOf(guiBranch) >= 0;
		const guiStrong = guiBranch && isYueLingYouQi(ctx.monthZhi, guiBranch);
		const chuanAllStrong = ctx.chuanZi.length === 3 && ctx.chuanZi.every((b)=>isYueLingYouQi(ctx.monthZhi, b));
		if(guiStrong && guiMain && chuanAllStrong){
			uniquePush(hits, { name: '富贵', basis: '贵人旺相临年/日辰且三传有气' });
		}
	}

	return hits;
}

export function evaluateLiuRengPatterns(params){
	const ctx = buildContext(params || {});
	const dageHits = evalDage(ctx);
	const xiaojuHits = evalXiaoju(ctx);
	return {
		dageHits,
		xiaojuHits,
		dageNames: dageHits.map((item)=>item.name),
		xiaojuNames: xiaojuHits.map((item)=>item.name),
	};
}

export function formatLiuRengPatternLines(hits, emptyText){
	const empty = emptyText || '无符合格局';
	if(!hits || !hits.length){
		return [empty];
	}
	return hits.map((item, idx)=>{
		const logic = safeText(item && (item.logic || item.basis)) || '命中';
		const detail = safeText(item && item.detail);
		return `${idx + 1}. ${item.name}：${logic}${detail ? `；${detail}` : ''}`;
	});
}
