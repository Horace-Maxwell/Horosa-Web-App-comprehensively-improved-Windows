// 量化盘 四流派软预设(WP-1):原始汉堡 / 纯净派 / 美国对称 / 宇宙生物学。
// 每派一组默认(虚星/个人点集/容许度/盘基/十字指针/宫框/盘式);选派=套该派默认,用户可逐项覆盖。
// 默认 classic = 现状默认(虚星开/90°盘/orb 1/无十字指针/无宫框/折叠盘)→ 切 classic 即零回归基线。
import { SUN, MOON, ASC, MC, NORTH_NODE, SOUTH_NODE, ARIES_POINT } from '../../constants/AstroConst';

export const SCHOOL = {
	CLASSIC: 'classic',
	PURE: 'pure',
	URANIAN: 'uranian',
	COSMO: 'cosmo',
};

export const SCHOOL_OPTIONS = [
	{ value: 'classic', label: '原始汉堡' },
	{ value: 'pure', label: '纯净派' },
	{ value: 'uranian', label: '美国对称' },
	{ value: 'cosmo', label: '宇宙生物学' },
];

// personalKeys:个人点集(汉堡六点含白羊点;宇宙生物学 Basic Five 无白羊点/无南交)。
// includeTnp:是否纳入 8 虚星(宇宙生物学不用虚星)。
// dialBase:盘基谐波(默认 90)。crossPointer:十字指针 22.5°(纯净派默认开)。
// showHouseFrames:六宫框(汉堡/美国对称开;纯净派/宇宙生物学关)。
// orbMidpoint / orbPersonal:中点 / 个人点容许度。ephemBase:图形星历盘基(宇宙生物学 45°)。
// cosmogramDefault:默认切宇宙图盘式(宇宙生物学建议)。
export const SCHOOL_PRESETS = {
	classic: {
		includeTnp: true, personalKeys: [SUN, MOON, ASC, MC, NORTH_NODE, SOUTH_NODE, ARIES_POINT],
		dialBase: 90, crossPointer: false, showHouseFrames: true, orbMidpoint: 1.0, orbPersonal: 1.0, ephemBase: 22.5, cosmogramDefault: false,
		extendedAxes: false, strictFactors: false,
	},
	pure: {
		includeTnp: true, personalKeys: [SUN, MOON, ASC, MC, NORTH_NODE, SOUTH_NODE, ARIES_POINT],
		dialBase: 90, crossPointer: true, showHouseFrames: false, orbMidpoint: 0.5, orbPersonal: 1.0, ephemBase: 22.5, cosmogramDefault: false,
		extendedAxes: false, strictFactors: false,
	},
	uranian: {
		includeTnp: true, personalKeys: [SUN, MOON, ASC, MC, NORTH_NODE, SOUTH_NODE, ARIES_POINT],
		dialBase: 90, crossPointer: false, showHouseFrames: true, orbMidpoint: 1.0, orbPersonal: 1.5, ephemBase: 22.5, cosmogramDefault: false,
		// 映点扩展至 15° 固定星座轴为该支独有口径。
		extendedAxes: true, strictFactors: false,
	},
	cosmo: {
		includeTnp: false, personalKeys: [SUN, MOON, ASC, MC, NORTH_NODE],   // Basic Five:无白羊点 / 无南交
		dialBase: 90, crossPointer: false, showHouseFrames: false, orbMidpoint: 1.5, orbPersonal: 5.0, ephemBase: 45, cosmogramDefault: true,
		extendedAxes: false, strictFactors: false,
	},
};

// B4:四流派设置对照行(从 SCHOOL_PRESETS 实值派生渲染,天然防文档与代码 drift;全中性表述)。
// 供左栏「流派对照」Modal 与帮助文档共用同一数据源。
export function schoolComparisonRows() {
	const P = SCHOOL_PRESETS;
	const onoff = (v) => (v ? '开' : '关');
	const row = (k, f) => ({ k, classic: f(P.classic), pure: f(P.pure), uranian: f(P.uranian), cosmo: f(P.cosmo) });
	return [
		row('8 虚星', (p) => (p.includeTnp ? '全用' : '不用')),
		row('个人点集', (p) => (p.personalKeys.length >= 7 ? '六点＋白羊点' : 'Basic Five')),
		row('主用盘基', (p) => `${p.dialBase}°`),
		row('十字指针 22.5°', (p) => onoff(p.crossPointer)),
		row('六宫框', (p) => onoff(p.showHouseFrames)),
		row('中点容许度', (p) => `${p.orbMidpoint}°`),
		row('个人点容许度', (p) => `${p.orbPersonal}°`),
		row('扩展映点轴 15°', (p) => onoff(p.extendedAxes)),
		row('默认盘式', (p) => (p.cosmogramDefault ? '宇宙图' : '折叠盘')),
		row('图形星历盘基', (p) => `${p.ephemBase}°`),
	];
}

export function presetForSchool(s) {
	return SCHOOL_PRESETS[s] || SCHOOL_PRESETS.classic;
}

// 个人点集(Set,供 cursorReadout / midpointTree / planetaryPictures 的 personal 选项)。
export function personalSetForSchool(s) {
	return new Set(presetForSchool(s).personalKeys);
}

// 流派 → 后端请求参数(/germany/midpoint 经 schoolToBackendParams + orb 下发)。
// ⚠️ 新增任何键必须同步登记 GermanyTechController.getParams() 白名单,否则 Java 层静默丢参。
// 白名单现登记:orb / personalOrb / school / frames / declination / strictFactors / davison。
// 后端 include_tnp 由 school 反推(cosmo→无虚星),orb/personalOrb 由调用方 live 值覆盖 ——
// 故此处只发 school + frames(frames 供六宫框独立页等无 live 状态的调用方作预设兜底;
// 90°盘主链在 schoolRequestParams 里以 live state.showHouseFrames 覆盖)。
export function schoolToBackendParams(s) {
	const p = presetForSchool(s);
	return { school: s, frames: p.showHouseFrames };
}
