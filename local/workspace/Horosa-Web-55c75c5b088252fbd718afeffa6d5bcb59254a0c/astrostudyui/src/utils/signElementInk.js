// 星座 → 西占四元素的界面字色(明暗成对的主题语义色 --horosa-element-*)。
// 界面表格 / 列表里的星座符号用它;盘面(svg / canvas)里的星座色仍走用户选的盘面配色 AstroConst.AstroColor ——
// 盘面配色是为盘面底挑的(有的整套是浅色,专配暗盘底),直接拿来当界面字色会在宣纸底上隐身。
const SIGN_ELEMENT = {
	Aries: 'fire', Leo: 'fire', Sagittarius: 'fire',
	Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
	Gemini: 'air', Libra: 'air', Aquarius: 'air',
	Cancer: 'water', Scorpio: 'water', Pisces: 'water',
};

export function signElementInk(sign, fallback = 'inherit'){
	const el = SIGN_ELEMENT[sign];
	return el ? `var(--horosa-element-${el})` : fallback;
}

export default signElementInk;
