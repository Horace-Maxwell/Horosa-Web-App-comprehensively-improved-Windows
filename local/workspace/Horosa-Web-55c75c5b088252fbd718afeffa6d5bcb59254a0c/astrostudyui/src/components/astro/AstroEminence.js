// G18 显赫格局 Eminence(希腊化古典占星):显赫程度计分卡,嵌本命「古典」tab。
// 纯前端派生,零后端,零回归:只读现成 chartObj(chart.objects[].selfDignity/score/ofSect/house/phase + chart.houses + 希腊点 + chart.aspects.normalAsp)。
// 五指标各 0-2 分,总分 0-10 → 等级。各分值为「非古典硬数值的现代计分」(便于横向比较,非典籍原文权重)。
// 角宫判定复用现成宫位分类(1/4/7/10 角宫);夜盘区间光体=月,缺福点/朔望降级。中性表述。
import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import { SmallTable, astroSymbol } from './AstroExtraCommon';

const MUTED = 'var(--horosa-muted, #999)';
const GOLD = 'var(--horosa-gold, #b8860b)';
const JADE = 'var(--horosa-jade, #3a9a6a)';
const DANGER = 'var(--horosa-danger, #cf1322)';

// 「有用宫」(尊贵宫/可见且与上升成相位之宫):命1·官10·福11·夫7·田4·迁9·子5。
const USEFUL_HOUSES = [1, 10, 11, 7, 4, 9, 5];
const ANGULAR_HOUSES = [1, 4, 7, 10];
const BENEFICS = [AstroConst.VENUS, AstroConst.JUPITER];
const LIGHTS = [AstroConst.SUN, AstroConst.MOON];

// chart.objects 取星(按 id)。
function findObj(chart, id){
	const objs = (chart && chart.objects) || [];
	return objs.find((x) => x && x.id === id) || null;
}

// 宫号:o.house 形如 'House5' 或数字。
function houseNum(h){
	if(h == null){ return null; }
	if(typeof h === 'number'){ return h; }
	const m = String(h).match(/(\d+)/);
	return m ? Number(m[1]) : null;
}

// 黄经:优先 o.lon,退而由 sign + signlon 推算。
function lonOf(o){
	if(!o){ return null; }
	if(o.lon !== undefined && o.lon !== null){ return Number(o.lon); }
	const idx = AstroConst.LIST_SIGNS.indexOf(o.sign);
	if(idx >= 0 && o.signlon !== undefined && o.signlon !== null){ return idx * 30 + Number(o.signlon); }
	return null;
}

// 星座(SignsProp 键为首字母大写英文)。
function signOf(o){
	if(o && o.sign){ return o.sign; }
	const lon = lonOf(o);
	if(lon == null){ return null; }
	return AstroConst.LIST_SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)] || null;
}

// selfDignity 数组 → 是否有本垣/擢升级尊贵(强尊贵)。
function hasStrongDignity(o){
	const d = (o && o.selfDignity) || [];
	return d.indexOf('ruler') >= 0 || d.indexOf('exalt') >= 0;
}
// 任意尊贵(含界/面/三分)。
function hasAnyDignity(o){
	const d = (o && o.selfDignity) || [];
	return ['ruler', 'exalt', 'dayTrip', 'nightTrip', 'partTrip', 'term', 'face'].some((t) => d.indexOf(t) >= 0);
}
// 落陷/落弱(受损)。
function isDebilitated(o){
	const d = (o && o.selfDignity) || [];
	return d.indexOf('exile') >= 0 || d.indexOf('fall') >= 0;
}

// 某星座的庙主(本垣主星 id)。
function rulerOfSign(sign){
	const sp = sign ? AstroConst.SignsProp[sign] : null;
	return sp ? sp.Ruler : null;
}

// idA 是否被 idB 以相位照映(含合相):走现成 chart.aspects.normalAsp。
function isAspectedBy(chart, idA, idB){
	const na = chart && chart.aspects && chart.aspects.normalAsp;
	if(!na || !na[idA]){ return false; }
	const cats = ['Exact', 'Applicative', 'Separative', 'None'];
	return cats.some((c) => (na[idA][c] || []).some((x) => x && x.id === idB));
}
// 是否受任一吉星照映。
function aspectedByBenefic(chart, id){
	return BENEFICS.some((b) => isAspectedBy(chart, id, b));
}

// 度数围攻:同星座内左右最近的可见星皆为凶星(土/火),且本星夹其间。粗判:同宫有两凶星且本星黄经居中。
function isBesieged(chart, o){
	const lon = lonOf(o);
	if(lon == null){ return false; }
	const malefics = [AstroConst.MARS, AstroConst.SATURN]
		.map((id) => findObj(chart, id))
		.filter((m) => m && houseNum(m.house) === houseNum(o.house) && lonOf(m) != null);
	if(malefics.length < 2){ return false; }
	const lefts = malefics.filter((m) => lonOf(m) < lon);
	const rights = malefics.filter((m) => lonOf(m) > lon);
	return lefts.length >= 1 && rights.length >= 1;
}

// 持矛 doryphoria(护卫)派生:区间光体被同宗吉星(及尊贵星)在其前后随侍。
// 若 chartObj 已带分析数据(chart.analysis.doryphory),优先复用;否则自盘面轻量派生。
function deriveDoryphory(chart){
	// 优先复用现成派生(后端/分析挂载若已注入)。
	const fromAnalysis = chart && chart.analysis && chart.analysis.doryphory;
	if(Array.isArray(fromAnalysis) && fromAnalysis.length){
		return { has: true, count: fromAnalysis.length, source: 'analysis' };
	}
	const isDay = !!chart.isDiurnal;
	const lightId = isDay ? AstroConst.SUN : AstroConst.MOON;
	const light = findObj(chart, lightId);
	if(!light){ return { has: false, count: 0 }; }
	const lh = houseNum(light.house);
	// 随侍:同宗吉星 + 任意带强尊贵的可见星,落于光体所在宫或相邻宫(护卫语义之轻量近似)。
	const guards = [];
	const candidateIds = [AstroConst.VENUS, AstroConst.JUPITER, AstroConst.MERCURY, AstroConst.MARS, AstroConst.SATURN];
	candidateIds.forEach((id) => {
		const g = findObj(chart, id);
		if(!g){ return; }
		const sameSect = g.ofSect === true;
		const dignified = hasStrongDignity(g);
		if(!sameSect && !dignified){ return; }
		const gh = houseNum(g.house);
		if(lh != null && gh != null){
			// 宫位是环:12↔1 相邻(|12-1|=11 曾漏计,光体落 1/12 宫时邻宫吉星全丢)
			const dd = Math.abs(gh - lh);
			if(Math.min(dd, 12 - dd) <= 1){ guards.push(id); }
		}
	});
	return { has: guards.length > 0, count: guards.length, guards };
}

// 盘主(almuten)派生:复用现成 almuten(若已挂载),否则取上升星座庙主为近似盘主。
function deriveAlmuten(chart){
	const fromAnalysis = chart && chart.analysis && chart.analysis.almutem;
	if(fromAnalysis && fromAnalysis.winner){ return { id: fromAnalysis.winner, source: 'analysis' }; }
	const asc = findObj(chart, AstroConst.ASC);
	const ascSign = asc ? signOf(asc) : null;
	const ruler = ascSign ? rulerOfSign(ascSign) : null;
	return { id: ruler, source: 'ascRuler' };
}

// 显赫点对象:福点在 chart.objects,其余阿拉伯点在 Result.lots 独立数组。
// 🔴 曾只查 objects → 四点恒只命中福点一个,s5 上限从 2 分压到 0.5、显赫判级系统性下压。
function lotObj(chart, id, lots){
	const o = findObj(chart, id);
	if(o){ return o; }
	const list = Array.isArray(lots) ? lots : [];
	return list.find((x)=>x && x.id === id) || null;
}

// 核心:计五指标 + 总分 + 等级。返回 { ok, rows, total, level, note }。
export function computeEminence(chartObj){
	const chart = chartObj && chartObj.chart;
	const lots = (chartObj && Array.isArray(chartObj.lots)) ? chartObj.lots : [];
	if(!chart || !Array.isArray(chart.objects) || !chart.objects.length){
		return { ok: false };
	}
	const isDay = !!chart.isDiurnal;
	const sun = findObj(chart, AstroConst.SUN);
	const moon = findObj(chart, AstroConst.MOON);
	if(!sun || !moon){ return { ok: false }; }

	const rows = [];

	// 指标 1 两光位置:日月各落「有用宫」给分,落角宫额外加权;被围攻则扣回。
	let s1 = 0;
	const lightDetail = [];
	LIGHTS.forEach((id) => {
		const o = id === AstroConst.SUN ? sun : moon;
		const h = houseNum(o.house);
		let pt = 0;
		if(h != null && USEFUL_HOUSES.indexOf(h) >= 0){ pt = ANGULAR_HOUSES.indexOf(h) >= 0 ? 1 : 0.5; }
		if(isBesieged(chart, o)){ pt = 0; }
		s1 += pt;
		lightDetail.push(`${id === AstroConst.SUN ? '日' : '月'}${h != null ? h + '宫' : '—'}${pt > 0 ? '✓' : ''}`);
	});
	s1 = Math.min(2, Math.round(s1 * 2) / 2);
	rows.push({
		key: 'lights', name: '两光位置', score: s1,
		factors: lightDetail.join(' / ') + '（有用宫·角宫加权·不被围攻）',
	});

	// 指标 2 福点及其主星:福点落角宫 +1;福点主星有尊贵或受吉星照 +1。缺福点降级。
	let s2 = 0;
	const fortune = lotObj(chart, AstroConst.PARS_FORTUNA, lots);
	let fortuneFactors;
	if(!fortune){
		fortuneFactors = '缺福点（降级）';
	}else{
		const fh = houseNum(fortune.house);
		const inAngle = fh != null && ANGULAR_HOUSES.indexOf(fh) >= 0;
		if(inAngle){ s2 += 1; }
		const fSign = signOf(fortune);
		const lordId = fSign ? rulerOfSign(fSign) : null;
		const lord = lordId ? findObj(chart, lordId) : null;
		const lordGood = lord && (hasAnyDignity(lord) || aspectedByBenefic(chart, lordId));
		if(lordGood){ s2 += 1; }
		fortuneFactors = `福点${fh != null ? fh + '宫' : '—'}${inAngle ? '·角宫✓' : ''}` +
			`　主星${lordId ? '' : '—'}${lordGood ? '·有力✓' : (lordId ? '·平' : '')}`;
	}
	s2 = Math.min(2, s2);
	rows.push({ key: 'fortune', name: '福点及主星', score: s2, factors: fortuneFactors });

	// 指标 3 持矛 doryphoria:复用现成护卫派生;有护卫给 1,护卫含强尊贵星给 2。
	let s3 = 0;
	const dory = deriveDoryphory(chart);
	if(dory.has){ s3 = dory.count >= 2 ? 2 : 1; }
	const doryFactors = dory.has
		? `区间光体受 ${dory.count} 星随侍${dory.source === 'analysis' ? '' : '（盘面派生）'}`
		: '无明显护卫';
	rows.push({ key: 'doryphory', name: '持矛护卫', score: s3, factors: doryFactors });

	// 指标 4 盘主有力:盘主落角宫 +1;盘主带尊贵 +1。
	let s4 = 0;
	const alm = deriveAlmuten(chart);
	let almFactors;
	if(!alm.id){
		almFactors = '盘主不可定';
	}else{
		const ao = findObj(chart, alm.id);
		const ah = ao ? houseNum(ao.house) : null;
		const inAngle = ah != null && ANGULAR_HOUSES.indexOf(ah) >= 0;
		if(inAngle){ s4 += 1; }
		const dignified = ao && hasStrongDignity(ao);
		if(dignified){ s4 += 1; }
		almFactors = `盘主${alm.source === 'ascRuler' ? '（上升主）' : ''} ${ah != null ? ah + '宫' : '—'}` +
			`${inAngle ? '·角宫✓' : ''}${dignified ? '·尊贵✓' : ''}`;
	}
	s4 = Math.min(2, s4);
	rows.push({ key: 'almuten', name: '盘主有力', score: s4, almuten: alm.id, factors: almFactors });

	// 指标 5 四显赫点:福点/精神点/根基点/擢升点 + 各点主星状态(受损扣分)。
	// 根基点 Basis、擢升点 Exaltation 若 chart.objects 未提供则跳过(优雅降级)。
	let s5 = 0;
	const EMINENCE_POINTS = [
		{ id: AstroConst.PARS_FORTUNA, cn: '福点' },
		{ id: AstroConst.PARS_SPIRIT, cn: '精神点' },
		{ id: 'Pars Basis', cn: '根基点' },
		{ id: 'Pars Exaltation', cn: '擢升点' },
	];
	const ptDetail = [];
	let present = 0;
	EMINENCE_POINTS.forEach((p) => {
		const o = lotObj(chart, p.id, lots);
		if(!o){ return; }
		present += 1;
		const h = houseNum(o.house);
		const inUseful = h != null && USEFUL_HOUSES.indexOf(h) >= 0;
		const lordId = rulerOfSign(signOf(o));
		const lord = lordId ? findObj(chart, lordId) : null;
		const lordOk = lord && !isDebilitated(lord);
		// 每点:落有用宫且主星不受损 → 0.5。
		if(inUseful && lordOk){ s5 += 0.5; }
		ptDetail.push(`${p.cn}${h != null ? h + '宫' : ''}${inUseful && lordOk ? '✓' : ''}`);
	});
	if(!present){ ptDetail.push('显赫点数据不足'); }
	s5 = Math.min(2, Math.round(s5 * 2) / 2);
	rows.push({ key: 'points', name: '四显赫点', score: s5, factors: ptDetail.join(' / ') });

	const total = Math.round((s1 + s2 + s3 + s4 + s5) * 2) / 2;
	let level;
	let levelColor;
	if(total >= 8){ level = '显赫'; levelColor = GOLD; }
	else if(total >= 6){ level = '显著'; levelColor = JADE; }
	else if(total >= 3){ level = '平凡'; levelColor = MUTED; }
	else { level = '暗晦'; levelColor = DANGER; }

	// 朔望(日月会合)边界:若日月同宫(新月)则两光合一,显赫判读降级提示。
	const sameSign = signOf(sun) && signOf(sun) === signOf(moon);
	const note = sameSign ? '日月同座(近朔)·两光合一,显赫判读宜降级看待。' : '';

	return { ok: true, rows, total, level, levelColor, isDay, note };
}

class AstroEminence extends Component{
	constructor(props){
		super(props);
		this.state = { open: false };
	}
	render(){
		const { open } = this.state;
		const chartObj = this.props.value;
		const data = computeEminence(chartObj);
		return (
			<div className="horosa-info-card horosa-classical-card">
				<div className="horosa-classical-card-title" style={{ cursor: 'pointer', justifyContent: 'space-between' }}
					onClick={() => this.setState({ open: !open })}>
					<span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
						<span className="horosa-classical-zh">显赫程度</span>
						<span className="horosa-classical-en">Eminence</span>
					</span>
					<span style={{ color: MUTED, fontSize: 12, flex: '0 0 auto' }}>
						{data.ok ? <span style={{ color: data.levelColor, fontWeight: 600, marginRight: 8 }}>{data.level}　{data.total}/10</span> : null}
						{open ? '收起 ▲' : '展开 ▼'}
					</span>
				</div>
				{open ? (
					!data.ok ? (
						<div style={{ marginTop: 8, color: MUTED, fontSize: 12 }}>数据不足,暂无法评估显赫程度。</div>
					) : (
						<div style={{ marginTop: 8 }}>
							<div style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>
								{data.isDay ? '昼生盘(区间光体=日)' : '夜生盘(区间光体=月)'}。五指标各 0-2 分,合计映射显赫等级。
								<span style={{ marginLeft: 6 }}>各分值为便于横向比较之现代计分,非典籍原文权重。</span>
							</div>
							<SmallTable
								rowKey={(r) => r.key}
								rows={data.rows}
								columns={[
									{ key: 'name', title: '指标', render: (v, r) => (
										<span>{v}{r.almuten ? <span style={{ marginLeft: 4 }}>{astroSymbol(r.almuten)}</span> : null}</span>
									) },
									{ key: 'factors', title: '满足要素' },
									{ key: 'score', title: '小分', render: (v) => (
										<span style={{ fontWeight: 600, color: v >= 1.5 ? GOLD : (v > 0 ? 'inherit' : MUTED) }}>{v}</span>
									) },
								]}
							/>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--horosa-border, rgba(120,120,120,0.28))' }}>
								<span style={{ fontWeight: 600 }}>总分 {data.total} / 10</span>
								<span style={{ color: data.levelColor, fontWeight: 700 }}>{data.level}</span>
							</div>
							<div style={{ color: MUTED, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
								显赫由两光位置、福点、护卫、盘主、四显赫点综合判定:总分 ≥8 显赫 / 6-7 显著 / 3-5 平凡 / &lt;3 暗晦。
								{data.note ? <div style={{ color: GOLD, marginTop: 2 }}>{data.note}</div> : null}
							</div>
						</div>
					)
				) : null}
			</div>
		);
	}
}

export default AstroEminence;
