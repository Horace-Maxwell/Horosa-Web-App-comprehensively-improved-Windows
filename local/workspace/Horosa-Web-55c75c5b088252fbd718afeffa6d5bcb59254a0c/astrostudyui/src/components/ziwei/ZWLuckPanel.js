import { Component } from 'react';
import { julianDayIndex } from '../../utils/julianDayIndex';
import { Lunar, LunarMonth } from 'lunar-javascript';
import * as ZWConst from '../../constants/ZWConst';
import { chartSCUEnabled } from '../../utils/perfFlags';
import * as ZiWeiHelper from './ZiWeiHelper';
import { parseYearFromDateStr } from '../../utils/dateStrSafe';
import { ganzhiYearBase } from '../../utils/ganzhiYearBase';
import { childLimits, zhongxianOf } from './ziweiCore';   // WP-1 童限 / WP-2 沈氏三限
import { XIAOXIAN_START } from './data/ziweiTables';      // [B15b] 小限起宫表单源(曾双源字面量,金标对拍锁)
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { ZWEngineOptions } from './ziweiOptions';

const DIZI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const LUNAR_MONTH = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// [D0] 四化底色并入 ZWConst.ZWColor 单源(本地副本已删;值经逐项核对相同)。
const LEVEL_LABEL = { daxian: '大限', liunian: '流年小限', xiaoxian: '小限', liuyue: '流月', liuri: '流日', liushi: '流时' };

// ——— 干支基础（纯前端，绝不返回 undefined） ———
function yearGanzi(year) {
	if (!Number.isFinite(year)) return '';
	const gi = (((year - 4) % 10) + 10) % 10;
	const zi = (((year - 4) % 12) + 12) % 12;
	return GANS[gi] + DIZI[zi];
}
// 五虎遁：年干 → 正月天干顺推
function monthGan(yearGan, monthIdx /*0=正月*/) {
	const start = ZWConst.WuHuDun ? ZWConst.WuHuDun[yearGan] : null;
	const si = GANS.indexOf(start);
	if (si < 0) return '';
	return GANS[(si + monthIdx) % 10];
}
// 五鼠遁：日干 → 子时天干
const ZI_HOUR_START = { '甲': '甲', '己': '甲', '乙': '丙', '庚': '丙', '丙': '戊', '辛': '戊', '丁': '庚', '壬': '庚', '戊': '壬', '癸': '壬' };
function hourGan(dayGan, hourIdx /*0=子*/) {
	const si = GANS.indexOf(ZI_HOUR_START[dayGan]);
	if (si < 0) return '';
	return GANS[(si + hourIdx) % 10];
}
// 连续 JDN → 日干支（锚点 2026-05-18=壬辰[jiazi 28]，与 BaZiLuckFlowPanel 同源，绝对单调）
const DAY_ANCHOR_JDI = julianDayIndex(2026, 5, 18);
const DAY_ANCHOR_IDX = 28;
function dayGanziByDate(date) {
	const jdi = julianDayIndex(date.getFullYear(), date.getMonth() + 1, date.getDate());
	const idx = (((jdi - DAY_ANCHOR_JDI + DAY_ANCHOR_IDX) % 60) + 60) % 60;
	return GANS[idx % 10] + DIZI[idx % 12];
}
// 小限起宫(虚岁一岁)：寅午戌→辰、申子辰→戌、亥卯未→丑、巳酉丑→未 —— 表已单源化到 ziweiTables.XIAOXIAN_START。

// houses[] 是连续地支但起始宫不固定 → 必须按地支搜数组下标，不可用 DIZI 位置
function houseIdxByBranch(chart, zhi) {
	if (!chart || !chart.houses || !zhi) return -1;
	return chart.houses.findIndex((h) => h && h.ganzi && h.ganzi.charAt(1) === zhi);
}
function houseName(chart, idx, short) {
	if (!chart || !chart.houses || idx === undefined || idx === null || idx < 0) return '—';
	const h = chart.houses[idx];
	const name = h && h.name ? h.name : '—';
	return short ? name.replace(/[宫宮]$/, '') : name;
}
// [Issue#53 同族·同类未扩面] 流年/小限的公历年基准必须是**干支年**,不是出生公历年:
// 两者只在换年界(立春或正月初一,随 ziweiOptions.yearBoundary)之后才重合。界前出生者直接
// 拿 parseYearFromDateStr(生日) 当 base,会让运限首年整体错一位——盘面生年干支与右栏流年
// 首条自相矛盾,且本函数同时供 AI 挂载复算(见下方注释),错会一并进快照文本。
// 口径同 utils/ganzhiYearBase:不自判界,从**引擎已算好的生年干支**(chart.yearGan/yearZi,
// 紫微引擎按所选 yearBoundary 产出)反推公历年;缺字段则退回旧行为(绝不抛)。
function birthYearOf(chart) {
	if (chart && chart.birth) {
		const y = parseYearFromDateStr(`${chart.birth}`);
		if (!Number.isNaN(y)) {
			const gz = `${(chart.yearGan || '')}${(chart.yearZi || '')}`.trim();
			return gz.length >= 2 ? ganzhiYearBase(y, gz) : y;
		}
	}
	return 2000;
}

// ——— 各层 item 构造 ———
// 说明:以下 build*Items 为纯函数(只读 chart + 选定层 item,无副作用/无后端调用),
// 既供 ZWLuckPanel 交互渲染,也供 AI 挂载快照(buildZiweiSnapshotForParams)按所选运限复算同一层数据,
// 确保「挂载设置·运限」改动后快照逐字对齐盘面交互(round-trip 通)。导出供复用,杜绝两份口径漂移。
function buildDaxianItems(chart) {
	if (!chart || !chart.houses) return [];
	const arr = [];
	for (let i = 0; i < 12; i++) {
		const d = chart.houses[i] && chart.houses[i].direction;
		if (d) arr.push({ i, start: d[0], end: d[1], ganzi: chart.houses[i].ganzi });
	}
	arr.sort((a, b) => a.start - b.start);
	return arr.map((x) => ({
		id: `dx-${x.i}`, level: 'daxian', mingIndex: x.i, ganzi: x.ganzi,
		gan: x.ganzi.charAt(0), zhi: x.ganzi.charAt(1), start: x.start, end: x.end,
		top: `${x.start}~${x.end}`, sub: `${x.ganzi}限`,
	}));
}
// 流年：大限内 10 年（虚岁 n → 公历 birthYear+n-1）
function buildLiunianItems(chart, daxian) {
	if (!chart || !daxian) return [];
	const birthY = birthYearOf(chart);
	const startYear = birthY + daxian.start - 1;
	const out = [];
	for (let k = 0; k < (daxian.end - daxian.start + 1); k++) {
		const year = startYear + k;
		const gz = yearGanzi(year);
		if (!gz || gz.length < 2) continue;
		const zhi = gz.charAt(1);
		const mingIndex = houseIdxByBranch(chart, zhi);
		const item = {
			id: `ln-${year}`, level: 'liunian', year, age: daxian.start + k, ganzi: gz,
			gan: gz.charAt(0), zhi, mingIndex,
			top: `${year}`, sub: `${gz}`,
		};
		// [B10] 流年四化取干两法:ming_gong_gan=以流年命宫宫干起四化(飞星系用法)。
		// 默认档不加字段(item 形状字节稳);消费点统一 `layer.sihuaGan || layer.gan`。
		// 流曜恒用 layer.gan(流曜按流年干,不随此档);流月干独立五虎遁不受染。
		if(ZWEngineOptions.liunianSihuaGan === 'ming_gong_gan' && mingIndex >= 0 && chart.houses[mingIndex] && chart.houses[mingIndex].ganzi){
			item.sihuaGan = chart.houses[mingIndex].ganzi.charAt(0);
		}
		out.push(item);
	}
	return out;
}
// 小限：与流年同级——大限内 10 个虚岁（男顺女逆、不分阴阳；干支复用本命宫位）
function buildXiaoxianItems(chart, daxian) {
	if (!chart || !chart.houses || !chart.yearZi || !daxian) return [];
	const startZhi = XIAOXIAN_START[chart.yearZi];
	if (!startZhi) return [];
	const startIdx = houseIdxByBranch(chart, startZhi);
	if (startIdx < 0) return [];
	// P1-B 小限顺逆：'0'=男顺女逆(现状默认，零回归) / '1'=阳男阴女顺、阴男阳女逆(中州)。
	// [B15] 迁入 ZWEngineOptions 单例(挂载/导出走 builder set/finally 临时覆盖,不再兜转 localStorage);
	// LS 键 ziweiXiaoxianYinyang 沿用,由 ZiWeiInput 构造器读入单例。
	// [B15b] 判定单源化:ZiWeiHelper.xiaoxianClockwise(内核=ziweiCore.xiaoxianClockwiseFor,读同一单例)——
	// 盘面岁数条/本地引擎与本函数三消费点同口径,金标对拍锁(ziweiXiaoxianSyncWiring)。
	const clockwise = ZiWeiHelper.xiaoxianClockwise(chart);
	const birthY = birthYearOf(chart);
	const out = [];
	for (let age = daxian.start; age <= daxian.end; age++) {
		const step = age - 1;
		const idx = clockwise ? (startIdx + step) % 12 : ((startIdx - step) % 12 + 12) % 12;
		const house = chart.houses[idx];
		if (!house) continue;
		const ganzi = house.ganzi;
		out.push({
			id: `xx-${age}`, level: 'xiaoxian', age, year: birthY + age - 1, mingIndex: idx,
			ganzi, gan: ganzi.charAt(0), zhi: ganzi.charAt(1),
			top: `${age}岁`, sub: `${ganzi}`,
		});
	}
	return out;
}
// 流月：由当前年(流年或小限所在年)展开。斗君宫=getDouJun(子斗,年支)；正月起斗君宫顺行
function buildLiuyueItems(chart, year) {
	if (!chart || !Number.isFinite(year)) return [];
	const gz = yearGanzi(year);
	const yearGan = gz.charAt(0);
	const yearZhi = gz.charAt(1);
	// [P3c] 流月起法两档:doujun 斗君宫起正月(默认=现状,三合/四化主流) / taisui 太岁宫(流年支所在宫)起正月。
	// 本函数同时喂 UI 面板与快照 builder(ZiWeiMain import),两处口径自动一致。
	const anchorZhi = ZWEngineOptions.liuYueBasis === 'taisui'
		? yearZhi
		: ZiWeiHelper.getDouJun(chart.zidou, yearZhi);
	const anchorIdx = houseIdxByBranch(chart, anchorZhi);
	const out = [];
	for (let m = 0; m < 12; m++) {
		const gan = monthGan(yearGan, m);
		const zhi = DIZI[(2 + m) % 12]; // 正月建寅
		const mingIndex = anchorIdx < 0 ? -1 : (anchorIdx + m) % 12;
		out.push({
			id: `ly-${year}-${m}`, level: 'liuyue', month: m + 1, year,
			ganzi: gan + zhi, gan, zhi, mingIndex,
			top: LUNAR_MONTH[m], sub: `${gan}${zhi}`,
		});
	}
	return out;
}
// 流日：流月命宫 + (日-1)；日干支连续 JDN
function buildLiuriItems(chart, year, liuyue) {
	if (!chart || !liuyue) return [];
	let days = 30;
	let firstSolar = null;
	try {
		const lm = LunarMonth.fromYm(year, liuyue.month);
		if (lm && typeof lm.getDayCount === 'function') days = lm.getDayCount();
	} catch (e) { days = 30; }
	try {
		const s = Lunar.fromYmd(year, liuyue.month, 1).getSolar();
		// AD 1-99 绕开 Date 构造器 0-99→1900+ 映射(流日轴日干支曾整体平移 1900 年)
		firstSolar = new Date(0);
		firstSolar.setFullYear(s.getYear(), s.getMonth() - 1, s.getDay());
		firstSolar.setHours(0, 0, 0, 0);
	} catch (e) { firstSolar = null; }
	const out = [];
	for (let d = 1; d <= days; d++) {
		let ganzi = '';
		if (firstSolar) {
			const dt = new Date(0);
			dt.setFullYear(firstSolar.getFullYear(), firstSolar.getMonth(), firstSolar.getDate() + (d - 1));
			dt.setHours(0, 0, 0, 0);
			ganzi = dayGanziByDate(dt);
		}
		const zhi = ganzi ? ganzi.charAt(1) : '';
		const mingIndex = (liuyue.mingIndex + (d - 1)) % 12;
		out.push({
			id: `lr-${year}-${liuyue.month}-${d}`, level: 'liuri', day: d, year,
			ganzi, gan: ganzi ? ganzi.charAt(0) : '', zhi, mingIndex,
			top: `${d}`, sub: ganzi || `${d}日`,
		});
	}
	return out;
}
// 流时：流日命宫 + 时辰序；五鼠遁日干→时干
function buildLiushiItems(chart, liuri) {
	if (!chart || !liuri || !liuri.gan) return [];
	const out = [];
	for (let h = 0; h < 12; h++) {
		const gan = hourGan(liuri.gan, h);
		const zhi = DIZI[h];
		const mingIndex = (liuri.mingIndex + h) % 12;
		out.push({
			id: `ls-${liuri.day}-${h}`, level: 'liushi', hourIdx: h,
			ganzi: gan + zhi, gan, zhi, mingIndex,
			top: `${SHICHEN[h]}时`, sub: `${gan}${zhi}`,
		});
	}
	return out;
}

// ——— 运限选择状态机（纯函数·受控）：返回新的 luckSel；供 ZWLuckPanel 与命盘九宫格(ZiWeiMain)共用，杜绝两处分叉 ———
function emptyLuckSel() {
	return { daxian: null, liunian: null, xiaoxian: null, liuyue: null, liuri: null, liushi: null };
}
function matchXiaoxian(chart, daxian, age) {
	if (!chart || !daxian || age === undefined || age === null) return null;
	return buildXiaoxianItems(chart, daxian).find((x) => x.age === age) || null;
}
// 选大限：仅定大限、清空更深层（不自动补流年 → 四化窗口=[本命,大限]，符合需求5）。
function luckSelectDaxian(chart, item, prev) {
	return { ...(prev || emptyLuckSel()), daxian: item, liunian: null, xiaoxian: null, liuyue: null, liuri: null, liushi: null };
}
// 选「流年小限」(合并)：该年同时定 流年(按年支) 与 小限(按虚岁对齐)，清空更深层。
function luckSelectLiunian(chart, item, prev) {
	const base = prev || emptyLuckSel();
	const xx = matchXiaoxian(chart, base.daxian, item ? item.age : null);
	return { ...base, liunian: item, xiaoxian: xx, liuyue: null, liuri: null, liushi: null };
}
function luckSelectLiuyue(chart, item, prev) {
	return { ...(prev || emptyLuckSel()), liuyue: item, liuri: null, liushi: null };
}
function luckSelectLiuri(chart, item, prev) {
	return { ...(prev || emptyLuckSel()), liuri: item, liushi: null };
}
function luckSelectLiushi(chart, item, prev) {
	return { ...(prev || emptyLuckSel()), liushi: item };
}
// [B15b] 运限口径改档(小限顺逆/流年四化取干/流月起法…)后,已选运限是「点击时刻的快照对象」——
// 不重派生就会与按钮列表自相矛盾(实测:改小限顺逆后芯片列表已按新口径,详情卡/叠宫层/AI period 仍旧口径)。
// 本函数按各层身份键(start/year/age/month/day/hourIdx)在新口径 build 结果里整链重找:
// 口径未变时逐层值等(幂等,仅换引用);变了则 mingIndex/ganzi/sihuaGan 全部跟随。ZiWeiMain 广播监听统一调用。
function rederiveLuckSel(chart, sel) {
	if (!sel || !chart || !chart.houses) { return sel; }
	if (!sel.daxian && !sel.liunian && !sel.xiaoxian && !sel.liuyue && !sel.liuri && !sel.liushi) { return sel; }
	const out = emptyLuckSel();
	if (sel.daxian) { out.daxian = buildDaxianItems(chart).find((d) => d.start === sel.daxian.start) || sel.daxian; }
	if (sel.liunian && out.daxian) { out.liunian = buildLiunianItems(chart, out.daxian).find((l) => l.year === sel.liunian.year) || null; }
	if (sel.xiaoxian && out.daxian) { out.xiaoxian = matchXiaoxian(chart, out.daxian, sel.xiaoxian.age); }
	if (sel.liuyue) { out.liuyue = buildLiuyueItems(chart, sel.liuyue.year).find((m) => m.month === sel.liuyue.month) || null; }
	if (sel.liuri && out.liuyue) { out.liuri = buildLiuriItems(chart, sel.liuri.year, out.liuyue).find((d) => d.day === sel.liuri.day) || null; }
	if (sel.liushi && out.liuri) { out.liushi = buildLiushiItems(chart, out.liuri).find((h) => h.hourIdx === sel.liushi.hourIdx) || null; }
	return out;
}

// 导出纯构造器 + 宫位定位工具 + 运限状态机,供 AI 挂载快照与命盘九宫格按同一口径复用(见 ZiWeiMain)。
export {
	buildDaxianItems,
	buildLiunianItems,
	buildXiaoxianItems,
	buildLiuyueItems,
	buildLiuriItems,
	buildLiushiItems,
	houseName,
	houseIdxByBranch,
	LEVEL_LABEL,
	emptyLuckSel,
	matchXiaoxian,
	luckSelectDaxian,
	luckSelectLiunian,
	luckSelectLiuyue,
	luckSelectLiuri,
	luckSelectLiushi,
	rederiveLuckSel,
};

class ZWLuckPanel extends Component {
	// 受控组件：选择态由父级(ZiWeiMain)的 luckSel 单一真值源驱动(props.value)，pick* 经 props.onChange 上报。
	// 初值/默认/最深层高亮 全由 ZiWeiMain 派生（与命盘九宫格共用同一 luckSel），本组件不持本地选择态。
	// [D3] 例外:版式(compact 单行横滚/wrap 折行)是右栏 React 局部显示态,自持 setState 即可——
	// 豁免 bumpZwDisplayRev(广播只为 SVG 盘面组件解 requestDedupe;本面板是 React 树,setState 自然重渲)。
	constructor(props){
		super(props);
		let lay = 'compact';
		try{ lay = localStorage.getItem('ziweiLuckPanelLayout') === 'wrap' ? 'wrap' : 'compact'; }catch(e){ /* noop */ }
		this.state = { layout: lay };
	}

	toggleLayout(){
		const next = this.state.layout === 'wrap' ? 'compact' : 'wrap';
		safeLocalStorageSet('ziweiLuckPanelLayout', next);   // [125] 配额满自动清理重试,禁裸 setItem
		this.setState({ layout: next });
	}
	sel() {
		return this.props.value || emptyLuckSel();
	}
	change(next) {
		if (this.props.onChange) {
			this.props.onChange(next);
		}
	}
	pickDaxian(item) { this.change(luckSelectDaxian(this.props.chart || {}, item, this.sel())); }
	pickLiunian(item) { this.change(luckSelectLiunian(this.props.chart || {}, item, this.sel())); }
	pickLiuyue(item) { this.change(luckSelectLiuyue(this.props.chart || {}, item, this.sel())); }
	pickLiuri(item) { this.change(luckSelectLiuri(this.props.chart || {}, item, this.sel())); }
	pickLiushi(item) { this.change(luckSelectLiushi(this.props.chart || {}, item, this.sel())); }

	// horosa_ziwei_luck_scu_v1:本面板是**纯受控无 state** 组件 —— 输出完全由 props
	// (chart / value=luckSel / onChange / onAi)决定。父级因无关 state(updating 角标 / tips /
	// centerInfoVisible / 右栏页签)重渲时,原先会连带重跑 build*Items×5 + 全部 chip/卡片 reconcile。
	// 逐 props 浅比(含函数型 —— 上游已全部改为构造期绑定的稳定引用),任一变化即照常渲染;
	// 键集合变化保守判「变了」。取向:宁可多渲、绝不漏渲。kill-switch 同 chartSCU。
	shouldComponentUpdate(nextProps) {
		if (!chartSCUEnabled()) {
			return true;
		}
		const prev = this.props;
		if (prev === nextProps) {
			return false;
		}
		if (!prev || !nextProps) {
			return true;
		}
		const pk = Object.keys(prev);
		const nk = Object.keys(nextProps);
		if (pk.length !== nk.length) {
			return true;
		}
		for (let i = 0; i < nk.length; i += 1) {
			if (prev[nk[i]] !== nextProps[nk[i]]) {
				return true;
			}
		}
		return false;
	}

	renderAxis(label, items, selectedId, onClick, key) {
		if (!items || !items.length) return null;
		return (
			<div className="horosa-ziwei-luck-axis-row" key={key || label}>
				<div className="horosa-ziwei-luck-axis-label">{label}</div>
				<div className="horosa-ziwei-luck-axis">
					{items.map((item) => (
						<button type="button" key={item.id}
							className={`horosa-ziwei-luck-chip ${item.id === selectedId ? 'is-selected' : ''}`}
							onClick={() => onClick(item)}>
							<span className="chip-top">{item.top}</span>
							<span className="chip-sub">{item.sub}</span>
						</button>
					))}
				</div>
			</div>
		);
	}

	// WP-1/2 信息轴(童限/中限):童限点选高亮对应本命宫(金框,不入 luckSel 四化滑窗);再点同宫取消。
	// readOnly=true(沈氏中限):纯静态展示、不可点击(中限=大限内时间四分,宫位沿大限宫,无独立高亮语义)。
	renderInfoAxis(label, items, key, readOnly) {
		if (!items || !items.length) return null;
		const hi = this.props.tonglianHi;
		return (
			<div className="horosa-ziwei-luck-axis-row" key={key || label}>
				<div className="horosa-ziwei-luck-axis-label">{label}</div>
				<div className="horosa-ziwei-luck-axis">
					{items.map((item) => (readOnly ? (
						<div key={item.id} className="horosa-ziwei-luck-chip is-readonly">
							<span className="chip-top">{item.top}</span>
							<span className="chip-sub">{item.sub}</span>
						</div>
					) : (
						<button type="button" key={item.id}
							className={`horosa-ziwei-luck-chip ${item.houseIndex != null && item.houseIndex === hi ? 'is-selected' : ''}`}
							onClick={() => { if (this.props.onTonglianHighlight && item.houseIndex != null) { this.props.onTonglianHighlight(item.houseIndex); } }}>
							<span className="chip-top">{item.top}</span>
							<span className="chip-sub">{item.sub}</span>
						</button>
					)))}
				</div>
			</div>
		);
	}

	// 「流年小限」合并行（需求2）：每个 chip = 流年年份 + 流年干支/小限干支·虚岁；选中即同时定 流年(按年支)+小限(按虚岁)。
	renderMergedAnnual(liunianItems, xiaoxianItems) {
		if (!liunianItems || !liunianItems.length) return null;
		const sel = this.sel();
		const selId = sel.liunian ? sel.liunian.id : '';
		const xxByAge = new Map((xiaoxianItems || []).map((x) => [x.age, x]));
		return (
			<div className="horosa-ziwei-luck-axis-row">
				<div className="horosa-ziwei-luck-axis-label">流年小限</div>
				<div className="horosa-ziwei-luck-axis">
					{liunianItems.map((item) => {
						const xx = xxByAge.get(item.age);
						// 上行=流年(年份+流年干支)、下行=小限(小限干支+虚岁)，与左侧「流年/小限」竖标对应；不再用「/」分隔。
						const topLine = `${item.top} ${item.ganzi}`;
						const subLine = xx ? `${xx.ganzi} ${xx.age}岁` : `${item.age}岁`;
						return (
							<button type="button" key={item.id}
								className={`horosa-ziwei-luck-chip ${item.id === selId ? 'is-selected' : ''}`}
								onClick={() => this.pickLiunian(item)}>
								<span className="chip-top">{topLine}</span>
								<span className="chip-sub">{subLine}</span>
							</button>
						);
					})}
				</div>
			</div>
		);
	}

	// 单层四化卡
	renderLayerCard(layer) {
		if (!layer) return null;
		const chart = this.props.chart || {};
		const mingIdx = layer.mingIndex;
		const oppIdx = (mingIdx + 6) % 12;
		// [B10-fix] 流年四化取干:消费期现算(effLayerSihuaGan)——切档立即生效于已选流年,不再吃 item 快照
		const sihua = ZiWeiHelper.getLayerSihua(chart, ZiWeiHelper.effLayerSihuaGan(chart, layer)) || [];
		// P0-2：流曜下沉到全部层级（大限/流年/小限/流月/流日/流时各按本层干支起流曜），不再只限流年。
		const flowStars = ZiWeiHelper.getFlowStars(layer.gan, layer.zhi, ZiWeiHelper.hourZhiOf(chart)) || [];
		let sub = '';
		if (layer.level === 'liunian' && layer.year) sub = `${layer.year}年`;
		else if (layer.level === 'xiaoxian' && layer.age) sub = `${layer.age}虚岁`;
		else if (layer.level === 'liuyue' && layer.month) sub = LUNAR_MONTH[layer.month - 1] || '';
		else if (layer.level === 'liuri' && layer.day) sub = `${layer.day}日`;
		else if (layer.level === 'daxian') sub = `${layer.start}~${layer.end}岁`;
		return (
			<div className={`horosa-ziwei-luck-card cat-${layer.level}`} key={layer.id}>
				<div className="horosa-ziwei-luck-card-head">
					<span className="horosa-ziwei-luck-badge">{LEVEL_LABEL[layer.level]}</span>
					<span className="horosa-ziwei-luck-ganzi">{layer.ganzi}</span>
					{sub && <span className="horosa-ziwei-luck-sub-tag">{sub}</span>}
					<span className="horosa-ziwei-luck-pal-inline">命【{houseName(chart, mingIdx, true)}】·对【{houseName(chart, oppIdx, true)}】</span>
				</div>
				{layer.level === 'liunian' && this.sel().xiaoxian && (
					<div className="horosa-ziwei-luck-xiaoxian" style={{ fontSize: 11.5, color: 'var(--horosa-text-soft, #888)', margin: '2px 0 4px' }}>
						小限：{this.sel().xiaoxian.ganzi}·{this.sel().xiaoxian.age}虚岁 命【{houseName(chart, this.sel().xiaoxian.mingIndex, true)}】
					</div>
				)}
				<div className="horosa-ziwei-luck-sihua">
					{sihua.map((h) => (
						<span key={h.star} className="hua" style={{ background: (ZWConst.ZWColor[h.hua] && ZWConst.ZWColor[h.hua].bg) || '#888' }}>
							<b>{h.hua}</b>{h.star}<i>{houseName(chart, h.houseIndex, true)}</i>
						</span>
					))}
				</div>
				{flowStars.length > 0 && (
					<div className="horosa-ziwei-luck-flow">
						{flowStars.map((s) => (
							<span key={s.name} className="flow-chip">{s.name}<i>{houseName(chart, houseIdxByBranch(chart, s.zhi), true)}</i></span>
						))}
					</div>
				)}
				{layer.level === 'liunian' && this.renderFlowJiangSui(chart, layer)}
				{this.renderFourPalaces(chart, mingIdx)}
			</div>
		);
	}

	// 运限三合(用户修正): 显该层级运财帛宫 + 运官禄宫(本宫和对宫已在 head 行不重复)
	// 2 个小卡片, 标"运财帛宫"/"运官禄宫" 让用户/AI 明确这是该段时间的三合宫位
	renderFourPalaces(chart, mingIdx) {
		try {
			const sanhe = ZiWeiHelper.collectSanhePalaces(chart, mingIdx);
			if (!sanhe || sanhe.length !== 2) return null;
			return (
				<div className="horosa-ziwei-luck-sanhe" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--horosa-border, rgba(0,0,0,0.08))' }}>
					<div style={{ fontSize: 11, color: 'var(--horosa-text-soft, #888)', marginBottom: 4 }}>运限三合</div>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
						{sanhe.map((p, idx) => {
							const colors = ['#fff5d6', '#e0f5e9']; // 运财帛=金黄, 运官禄=浅绿(术数语义中性, 明暗皆可读)
							return (
								<div key={idx} style={{
									padding: '4px 6px',
									background: colors[idx % 2],
									borderRadius: 4,
									fontSize: 11.5,
									lineHeight: 1.4,
								}}>
									<div style={{ fontWeight: 600, color: '#555' }}>
										{p.runName}：<span style={{ color: '#222' }}>{p.palaceName}</span>
										{p.ganZhi && <span style={{ color: '#999', marginLeft: 4 }}>{p.ganZhi}</span>}
									</div>
									<div style={{ color: '#444', marginTop: 2 }}>
										{p.stars && p.stars.length ? p.stars.join('、') : <span style={{ color: '#bbb' }}>(无主辅星)</span>}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			);
		} catch (e) {
			return null;
		}
	}

	// P1-C 流年「流将前/流岁前」十二神（仅流年层显示，年神煞不下沉到流月流日）。
	renderFlowJiangSui(chart, layer) {
		const js = ZiWeiHelper.getFlowJiangSui(layer.zhi) || [];
		if (!js.length) {
			return null;
		}
		return (
			<div className="horosa-ziwei-luck-jiangsui">
				<span className="js-label">流年神煞</span>
				{js.map((s) => (
					<span key={s.name} className={`js-chip js-${s.group}`}>{s.name}<i>{houseName(chart, houseIdxByBranch(chart, s.zhi), true)}</i></span>
				))}
			</div>
		);
	}

	render() {
		const chart = this.props.chart || {};
		const s = this.sel();
		if (!chart || !chart.houses) {
			return <div className="horosa-empty-hint">起盘后查看运限</div>;
		}
		const daxianItems = buildDaxianItems(chart);
		const liunianItems = s.daxian ? buildLiunianItems(chart, s.daxian) : [];
		const xiaoxianItems = s.daxian ? buildXiaoxianItems(chart, s.daxian) : [];
		const year = (s.liunian && Number.isFinite(s.liunian.year)) ? s.liunian.year : null;
		const liuyueItems = year ? buildLiuyueItems(chart, year) : [];
		const liuriItems = (year && s.liuyue) ? buildLiuriItems(chart, year, s.liuyue) : [];
		const liushiItems = s.liuri ? buildLiushiItems(chart, s.liuri) : [];

		// WP-1 童限:上大限前逐岁本命宫(开关开时显,独立信息轴)。WP-2 沈氏三限:选中大限后细分4段中限。
		const tonglianItems = ZWEngineOptions.childLimit
			? childLimits(chart.wuxingJu, chart.lifeHouseIndex).map((x) => ({ id: `tl-${x.age}`, top: `${x.age}岁`, sub: houseName(chart, x.houseIndex, true), houseIndex: x.houseIndex }))
			: [];
		const fmtHalf = (a) => (Number.isInteger(a) ? `${a}岁` : `${Math.floor(a)}岁半`);
		const zhongxianItems = (ZWEngineOptions.zhongxian && s.daxian)
			? zhongxianOf(s.daxian.start, s.daxian.mingIndex).map((z) => ({ id: `zx-${z.index}`, top: `${fmtHalf(z.startAge)}~${fmtHalf(z.endAge)}`, sub: `中限${z.index + 1}`, houseIndex: s.daxian.mingIndex }))
			: [];

		// 卡片栈：每个已选层级各一张（大限 + 流年小限 + 流月? + 流日? + 流时?）
		const cards = [];
		if (s.daxian) cards.push(s.daxian);
		if (s.liunian) cards.push(s.liunian);
		if (s.liuyue) cards.push(s.liuyue);
		if (s.liuri) cards.push(s.liuri);
		if (s.liushi) cards.push(s.liushi);

		return (
			<div className={`horosa-ziwei-luck ${this.state.layout === 'wrap' ? 'is-wrap' : ''}`}>
				<button type="button" className="horosa-ziwei-luck-layout-btn" onClick={()=>this.toggleLayout()}>
					{this.state.layout === 'wrap' ? '紧凑版式' : '展开版式'}
				</button>
				<div className="horosa-ziwei-luck-axes">
					{this.renderInfoAxis('童限', tonglianItems, 'tl')}
					{this.renderAxis('大限', daxianItems, s.daxian ? s.daxian.id : '', (i) => this.pickDaxian(i), 'dx')}
					{this.renderInfoAxis('中限', zhongxianItems, 'zx', true)}
					{this.renderMergedAnnual(liunianItems, xiaoxianItems)}
					{liuyueItems.length > 0 && this.renderAxis('流月', liuyueItems, s.liuyue ? s.liuyue.id : '', (i) => this.pickLiuyue(i), 'ly')}
					{liuriItems.length > 0 && this.renderAxis('流日', liuriItems, s.liuri ? s.liuri.id : '', (i) => this.pickLiuri(i), 'lr')}
					{liushiItems.length > 0 && this.renderAxis('流时', liushiItems, s.liushi ? s.liushi.id : '', (i) => this.pickLiushi(i), 'ls')}
				</div>
				<div className="horosa-ziwei-luck-cards">
					{cards.map((c) => this.renderLayerCard(c))}
				</div>
				<div className="horosa-ziwei-luck-note">
					<span>断同大限，尤重对宫与三合</span>
					{this.props.onAi && <a onClick={this.props.onAi}>AI解读 ›</a>}
				</div>
			</div>
		);
	}
}

export default ZWLuckPanel;
