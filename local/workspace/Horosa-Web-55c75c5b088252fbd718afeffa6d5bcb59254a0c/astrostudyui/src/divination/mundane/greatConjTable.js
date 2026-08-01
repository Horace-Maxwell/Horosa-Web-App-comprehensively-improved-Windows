// 木土大会合参考纪年表(1603–2100,古籍已核实版)。静态对照数据,与实时 swisseph 精算并列
// 供核对;亦作历史会合分期(conjunctionEras)的 golden 锚(2020 大变迁→风/1643·1821 过渡振荡)。
// sign 用内部小写键;element fire/earth/air/water;note 原文时代标注。
export const GREAT_CONJ_TABLE = [
	{ year: 1603, deg: 8, sign: 'sagittarius', element: 'fire', note: '火三角期' },
	{ year: 1623, deg: 6, sign: 'leo', element: 'fire', note: '' },
	{ year: 1643, deg: 25, sign: 'pisces', element: 'water', note: '过渡异常' },
	{ year: 1663, deg: 12, sign: 'sagittarius', element: 'fire', note: '' },
	{ year: 1683, deg: 19, sign: 'leo', element: 'fire', note: '' },
	{ year: 1703, deg: 6, sign: 'aries', element: 'fire', note: '' },
	{ year: 1723, deg: 22, sign: 'sagittarius', element: 'fire', note: '' },
	{ year: 1743, deg: 27, sign: 'leo', element: 'fire', note: '' },
	{ year: 1762, deg: 12, sign: 'aries', element: 'fire', note: '' },
	{ year: 1782, deg: 28, sign: 'sagittarius', element: 'fire', note: '' },
	{ year: 1802, deg: 5, sign: 'virgo', element: 'earth', note: '变迁→土起' },
	{ year: 1821, deg: 24, sign: 'aries', element: 'fire', note: '回火（过渡振荡）' },
	{ year: 1842, deg: 8, sign: 'capricorn', element: 'earth', note: '土三角稳定' },
	{ year: 1861, deg: 18, sign: 'virgo', element: 'earth', note: '' },
	{ year: 1881, deg: 1, sign: 'taurus', element: 'earth', note: '' },
	{ year: 1901, deg: 13, sign: 'capricorn', element: 'earth', note: '' },
	{ year: 1921, deg: 26, sign: 'virgo', element: 'earth', note: '' },
	{ year: 1940, deg: 9, sign: 'taurus', element: 'earth', note: '1940–41 三次合（逆行）' },
	{ year: 1961, deg: 25, sign: 'capricorn', element: 'earth', note: '' },
	{ year: 1980, deg: 9, sign: 'libra', element: 'air', note: '1980–81 风的「初尝」（三次合）' },
	{ year: 2000, deg: 22, sign: 'taurus', element: 'earth', note: '回土（最后一次土）' },
	{ year: 2020, deg: 0, sign: 'aquarius', element: 'air', note: '大变迁→风（2020-12-21）' },
	{ year: 2040, deg: 17, sign: 'libra', element: 'air', note: '' },
	{ year: 2060, deg: 0, sign: 'gemini', element: 'air', note: '' },
	{ year: 2080, deg: 11, sign: 'aquarius', element: 'air', note: '' },
	{ year: 2100, deg: 25, sign: 'libra', element: 'air', note: '' },
];

export default GREAT_CONJ_TABLE;
