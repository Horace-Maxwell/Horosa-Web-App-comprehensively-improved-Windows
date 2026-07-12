// 七政四余 AI 快照段·表化证明测试的共享输入 fixture（改前基线与改后实跑同源同参，保证「仅排版变、值不变」可比）。
// 值均为构造盘，覆盖：空宫/多宿/合日伏/无庙旺(天海冥)/角点(升顶)/洞微飞星吊度/相位四态(入离精容)。
import * as AstroConst from '../../../../constants/AstroConst';

export const GL_LIMIT_CHART = { displayCoord: 'ecliptic', objects: [
	{ id: AstroConst.LIFEMASTERDEG74, lon: 250.713 },
	{ id: AstroConst.ASC, lon: 250.713 },
	{ id: AstroConst.SUN, lon: 75.5, lonspeed: 0.95 },
] };
export const GL_LIMIT_PARAMS = { date: '1990/01/15', time: '12:00:00' };

export const GL_ASPECT_RESULT = { chart: { aspects: { normalAsp: {
	Sun: {
		Applicative: [{ id: 'Moon', asp: 120, orb: 2.5347 }],
		Exact: [],
		Separative: [{ id: 'Venus', asp: 90, orb: 0 }],
		None: [{ id: 'Mars', asp: 60 }],
	},
	Jupiter: {
		Applicative: [],
		Exact: [{ id: 'Saturn', asp: 0, orb: 0.25 }],
		Separative: [],
		None: [],
	},
} } } };

export const GL_HOUSESU_RESULT = { chart: {
	houses: Array.from({ length: 12 }, (_, i)=>({ id: `House${i + 1}`, lon: i * 30 })),
	objects: [
		{ id: AstroConst.ASC, ra: 0 },
		{ id: AstroConst.SUN, house: 'House1', ra: 5.2, signlon: 5.2, su28: '奎' },
		{ id: AstroConst.MOON, house: 'House1', ra: 8.4, signlon: 8.4, su28: '奎' },
		{ id: AstroConst.MERCURY, house: 'House1', ra: 27.9, signlon: 27.9, su28: '胃' },
		{ id: AstroConst.VENUS, house: 'House2', ra: 41.0, signlon: 11.0, su28: '昴' },
	],
	fixedStarSu28: [{ name: '奎', ra: 0 }, { name: '胃', ra: 20 }, { name: '昴', ra: 38 }],
} };

export const GL_DIGNITY_RESULT = { chart: { displayCoord: 'ecliptic', objects: [
	{ id: AstroConst.SUN, lon: 100.0, lonspeed: 0.98 },
	{ id: AstroConst.MOON, lon: 42.0, lonspeed: 13.1 },
	{ id: AstroConst.VENUS, lon: 103.0, lonspeed: 0.1 },
	{ id: AstroConst.JUPITER, lon: 200.5, lonspeed: -0.05 },
	{ id: AstroConst.MERCURY, lon: 88.0, lonspeed: -0.6 },
	{ id: AstroConst.MARS, lon: 355.0, lonspeed: 0.5 },
	{ id: AstroConst.SATURN, lon: 310.2, lonspeed: 0.03 },
	{ id: AstroConst.SOUTH_NODE, lon: 15.0 },
	{ id: AstroConst.NORTH_NODE, lon: 195.0 },
	{ id: AstroConst.PURPLE_CLOUDS, lon: 66.6, lonspeed: 0.03 },
	{ id: AstroConst.DARKMOON, lon: 123.4, lonspeed: 0.11 },
	{ id: AstroConst.URANUS, lon: 250.0, lonspeed: 0.055 },
	{ id: AstroConst.NEPTUNE, lon: 355.9, lonspeed: -0.01 },
	{ id: AstroConst.PLUTO, lon: 280.1, lonspeed: 0.002 },
	{ id: AstroConst.ASC, lon: 250.713 },
	{ id: AstroConst.MC, lon: 160.0 },
] } };
