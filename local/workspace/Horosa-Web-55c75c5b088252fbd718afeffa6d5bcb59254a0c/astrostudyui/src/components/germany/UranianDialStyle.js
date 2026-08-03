import { safeLocalStorageSet } from '../../utils/safeStorage';
import { memoEnabled } from '../../utils/memoBySignature';
// 汉堡 90°中点盘显示偏好 = 组件 state + 专用 localStorage（镜像 GuoLaoChartStyle）。
// 显示偏好不进 app.js globalSetup（那是跨技法全局开关专用）；切换即时重绘、不触发后端重取。

const KEY = 'horosa.uranian.dial.v1';
// 谐波盘基 H1..H512（窗口 W = 360/H）。折叠/模数皆按 W 计算，刻度自适应。
const VALID_BASES = [360, 180, 120, 90, 60, 45, 30, 22.5, 15, 7.5, 5.625, 3.75, 2.8125, 1.875, 1.40625, 0.9375, 0.703125];
// 盘基 → 谐波号(Hn)标签。
export const DIAL_BASE_HARMONIC = {
	360: 'H1', 180: 'H2', 120: 'H3', 90: 'H4', 60: 'H6', 45: 'H8', 30: 'H12', 22.5: 'H16',
	15: 'H24', 7.5: 'H48', 5.625: 'H64', 3.75: 'H96', 2.8125: 'H128', 1.875: 'H192',
	1.40625: 'H256', 0.9375: 'H384', 0.703125: 'H512',
};
// 盘基 → 显示文案(度分秒)。
export function dialBaseLabel(b){
	const h = DIAL_BASE_HARMONIC[b] || '';
	const deg = Math.floor(b);
	const minF = (b - deg) * 60;
	const min = Math.floor(minF);
	const sec = Math.round((minF - min) * 60);
	let dms = `${deg}°`;
	if (min || sec) dms += `${min}′`;
	if (sec) dms += `${sec}″`;
	return `${h} ${dms}`;
}

const DEFAULTS = {
	dialStyle: 'folded',  // folded=90°折叠盘 / modulus=真360°多环模数盘 / cosmogram=宇宙图盘式
	dialBase: 90,
	showTnp: true,
	orb: 1,        // 指针读数容许度（黄道度）
	showPicture: true,
	showTransit: false,
	showSolarArc: false,
	onlyPersonal: true,
	saKey: 'naibod', // 太阳弧换算：naibod / oneDeg / cardan(B9 三选一)
	showPlanetPicture: false, // 行星图 A+B−C=D 解算面板
	showMidpointList: false,  // 中点扁平排序列表
	showAntiscia: false,      // 映点 Spiegelpunkt（盘上标记 + 接触列表）
	openPanels: ['readout', 'tree', 'pic', 'list', 'spiegel'], // 右栏可收放卡片的展开项(Tab 内每卡仍可收放)
	activeRightTab: 'reading', // 右栏分组 Tab 当前页(reading 读数 / midpoint 中点 / solararc 太阳弧 / contact 接触)
	// —— 量化盘四流派软预设(WP-1)新键;默认值全=现状口径(classic 零回归)——
	school: 'classic',           // 流派:classic / pure / uranian / cosmo
	crossPointer: false,       // 十字指针(22.5° 四向辅助;纯净派默认开)
	orbPersonal: 1.0,          // 个人点(Basic Five)放宽容许度;下发后端 personalOrb
	showHouseFrames: true,     // 六宫框(汉堡/美国对称开;纯净派/宇宙生物学关)
	showDeclination: true,     // 赤纬接触(WP-11;平行/反平行;后端只增 declination 字段,默认开)
	strictFactors: false,      // 严格汉堡因子集(D2;true=后端剔黑月/紫气;默认关=现状字节零回归)
	showComposite: false,      // B5 组合中点盘环(逐因子近中点;需已选合盘叠加对象;默认关)
	showDavison: false,        // B5 戴维森环(时空中点真实起盘,后端只增字段;默认关)
	showEastPoint: false,      // B7 东点(赤道上升,houseFrames.eastPoint;默认关)
	showVertex: false,         // B7 宿命点(Vertex,houseFrames.vertex;默认关)
	extendedAxes: false,       // B8 扩展映点轴(15°固定星座;折叠盘与基本轴重合,仅360°盘有别;默认关)
	cosmogram: false,          // 宇宙图盘式(放开 dialStyle 第三态 cosmogram)
	showSumPoints: false,      // 和点读数(WP-5;指针对齐处追加 A+B 和点项)
	showArcOpenings: false,    // 差距读数(WP-5;指针对齐处追加 A∠B 差距项)
	showDiffList: false,       // 差值表(WP-3;太阳弧到期 全/半/倍 + 目标年龄)
	diffTargetAge: 30,         // 差值表目标年龄(命中该龄的到期行高亮)
	// —— WP-9 合盘叠盘:选中的叠盘人(取页面 fieldsAry 条目的 name,上限 4 人)——
	synastryPeople: [],        // [name,...] 当前叠加的合盘人名(对应 fieldsAry 条目)
	// —— WP-10 校时(只读预览):待校事件列表 ——
	rectifyEvents: [],         // [{label, date(ISO), type}] 校时事件(date 反推年龄→弧)
};

// dialStyle 三态:folded / modulus / cosmogram(其余非法值回退默认 folded)。
function parseDialStyle(v){
	return (v === 'modulus' || v === 'cosmogram') ? v : DEFAULTS.dialStyle;
}
// 流派合法集;非法回退 classic。
const SCHOOL_SET = new Set(['classic', 'pure', 'uranian', 'cosmo']);

// horosa_aux_render_slice_v1(A2):模块级解析缓存 —— 原来每调一次就 localStorage.getItem +
// JSON.parse + ~30 键规范化(AstroGermany 每 render 1 次、AstroMidpoint 请求/快照路径 4 处、
// 90°盘/六宫框构造各 1 次)。本键唯一写入口就是下方 saveUranianDisplay(KEY 未导出,全站 grep
// 核实全部写者:UranianDialMain saveDisp/changeSchool/onRectifyEventsChange 三处),故在写点
// 同步置空缓存即「写驱动失效」:失效点=写点,零轮询、零事件面、外部无从绕过。
// 返回浅拷贝,保持「每次调用全新顶层对象」的既有契约(调用方可安全 spread/覆写顶层键);嵌套数组
// (openPanels/synastryPeople/rectifyEvents)按只读契约共享 —— 全部消费方已核:构造函数 slice/map
// 复制、其余只读(全站无 disp.xxx.push/sort/splice)。kill-switch 复用 horosa.perf.localEngineMemo
// (memoEnabled;关=逐次重解析旧行为)。
let _dispCache = null;

export function getStoredUranianDisplay(){
	if (memoEnabled() && _dispCache) return { ..._dispCache };
	try {
		const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
		if (!raw){
			if (memoEnabled()) _dispCache = { ...DEFAULTS };
			return { ...DEFAULTS };
		}
		const obj = JSON.parse(raw) || {};
		const parsed = {
			dialStyle: parseDialStyle(obj.dialStyle),
			dialBase: VALID_BASES.indexOf(Number(obj.dialBase)) >= 0 ? Number(obj.dialBase) : DEFAULTS.dialBase,
			showTnp: obj.showTnp === undefined ? DEFAULTS.showTnp : !!obj.showTnp,
			orb: Number.isFinite(Number(obj.orb)) && Number(obj.orb) > 0 ? Number(obj.orb) : DEFAULTS.orb,
			showPicture: obj.showPicture === undefined ? DEFAULTS.showPicture : !!obj.showPicture,
			showTransit: obj.showTransit === undefined ? DEFAULTS.showTransit : !!obj.showTransit,
			showSolarArc: obj.showSolarArc === undefined ? DEFAULTS.showSolarArc : !!obj.showSolarArc,
			onlyPersonal: obj.onlyPersonal === undefined ? DEFAULTS.onlyPersonal : !!obj.onlyPersonal,
			saKey: (obj.saKey === 'oneDeg' || obj.saKey === 'cardan') ? obj.saKey : DEFAULTS.saKey,
			showPlanetPicture: obj.showPlanetPicture === undefined ? DEFAULTS.showPlanetPicture : !!obj.showPlanetPicture,
			showMidpointList: obj.showMidpointList === undefined ? DEFAULTS.showMidpointList : !!obj.showMidpointList,
			showAntiscia: obj.showAntiscia === undefined ? DEFAULTS.showAntiscia : !!obj.showAntiscia,
			openPanels: Array.isArray(obj.openPanels) ? obj.openPanels : DEFAULTS.openPanels,
			activeRightTab: (['reading', 'midpoint', 'solararc', 'contact', 'rectify', 'tnp'].indexOf(obj.activeRightTab) >= 0) ? obj.activeRightTab : DEFAULTS.activeRightTab,
			// —— WP-1 四流派软预设键 ——
			school: SCHOOL_SET.has(obj.school) ? obj.school : DEFAULTS.school,
			crossPointer: obj.crossPointer === undefined ? DEFAULTS.crossPointer : !!obj.crossPointer,
			orbPersonal: Number.isFinite(Number(obj.orbPersonal)) && Number(obj.orbPersonal) > 0 ? Number(obj.orbPersonal) : DEFAULTS.orbPersonal,
			showHouseFrames: obj.showHouseFrames === undefined ? DEFAULTS.showHouseFrames : !!obj.showHouseFrames,
			showDeclination: obj.showDeclination === undefined ? DEFAULTS.showDeclination : !!obj.showDeclination,
			strictFactors: obj.strictFactors === undefined ? DEFAULTS.strictFactors : !!obj.strictFactors,
			showComposite: obj.showComposite === undefined ? DEFAULTS.showComposite : !!obj.showComposite,
			showDavison: obj.showDavison === undefined ? DEFAULTS.showDavison : !!obj.showDavison,
			showEastPoint: obj.showEastPoint === undefined ? DEFAULTS.showEastPoint : !!obj.showEastPoint,
			showVertex: obj.showVertex === undefined ? DEFAULTS.showVertex : !!obj.showVertex,
			extendedAxes: obj.extendedAxes === undefined ? DEFAULTS.extendedAxes : !!obj.extendedAxes,
			cosmogram: obj.cosmogram === undefined ? DEFAULTS.cosmogram : !!obj.cosmogram,
			showSumPoints: obj.showSumPoints === undefined ? DEFAULTS.showSumPoints : !!obj.showSumPoints,
			showArcOpenings: obj.showArcOpenings === undefined ? DEFAULTS.showArcOpenings : !!obj.showArcOpenings,
			showDiffList: obj.showDiffList === undefined ? DEFAULTS.showDiffList : !!obj.showDiffList,
			diffTargetAge: Number.isFinite(Number(obj.diffTargetAge)) && Number(obj.diffTargetAge) >= 0 ? Number(obj.diffTargetAge) : DEFAULTS.diffTargetAge,
			// —— WP-9 合盘叠盘人:名数组,上限 4(超出截断);非数组回退空。
			synastryPeople: Array.isArray(obj.synastryPeople) ? obj.synastryPeople.filter((x) => typeof x === 'string').slice(0, 4) : DEFAULTS.synastryPeople,
			// —— WP-10 校时事件:[{label,date,type}] 数组;非数组回退空(date 为 ISO 串,解析交给组件)。
			rectifyEvents: Array.isArray(obj.rectifyEvents) ? obj.rectifyEvents.filter((x) => x && typeof x === 'object') : DEFAULTS.rectifyEvents,
		};
		if (memoEnabled()) _dispCache = parsed;
		return { ...parsed };
	} catch (e) {
		// 读/解析异常(隐私模式、串损坏):不缓存,行为=现状逐次重试,坏环境不被粘住。
		return { ...DEFAULTS };
	}
}

export function saveUranianDisplay(next){
	try {
		const merged = { ...getStoredUranianDisplay(), ...(next || {}) };
		if (typeof localStorage !== 'undefined') safeLocalStorageSet(KEY, JSON.stringify(merged));
		// horosa_aux_render_slice_v1(A2):写点失效 —— 下一次读重新解析真实落盘值
		// (含 safeLocalStorageSet 配额失败静默时回读旧值的语义,与无缓存时逐次重读完全一致)。
		_dispCache = null;
		return merged;
	} catch (e) {
		_dispCache = null; // 兜底:异常路径同样失效,绝不让缓存领先于存储
		return { ...getStoredUranianDisplay(), ...(next || {}) };
	}
}

export const URANIAN_DIAL_BASES = VALID_BASES;
