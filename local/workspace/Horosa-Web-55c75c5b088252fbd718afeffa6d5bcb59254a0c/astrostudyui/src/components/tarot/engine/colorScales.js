// 金色黎明四色阶之 King 阶(王阶,Atziluth/火界):22 大牌主色(路径主色)。色名为公有领域体系事实(Liber 777/Regardie),
// hex 为按色名的渲染近似。键=sid。BOTA/金色黎明 牌可显此色点;其余色阶(Queen/Prince/Princess)为 128 格大表,按需扩。
export const KING_SCALE = {
	the_fool: { name: '亮淡黄', hex: '#F3EDA6' },
	the_magician: { name: '黄', hex: '#F2DE2B' },
	high_priestess: { name: '蓝', hex: '#2F66E0' },
	the_empress: { name: '翠绿', hex: '#2FBE6E' },
	the_emperor: { name: '猩红', hex: '#E0241C' },
	the_hierophant: { name: '红橙', hex: '#E0531C' },
	the_lovers: { name: '橙', hex: '#E0881C' },
	the_chariot: { name: '琥珀', hex: '#E0AE1C' },
	strength: { name: '偏绿之黄', hex: '#C6D52B' },
	the_hermit: { name: '偏黄之绿', hex: '#8AC62B' },
	wheel_of_fortune: { name: '紫', hex: '#7B2CD6' },
	justice: { name: '翠绿', hex: '#2FBE6E' },
	hanged_man: { name: '深蓝', hex: '#16308A' },
	death: { name: '绿蓝', hex: '#1C9C9C' },
	temperance: { name: '蓝', hex: '#2F66E0' },
	the_devil: { name: '靛', hex: '#3B2C8A' },
	the_tower: { name: '猩红', hex: '#E0241C' },
	the_star: { name: '紫', hex: '#7B2CD6' },
	the_moon: { name: '绯红', hex: '#C81C4E' },
	the_sun: { name: '橙', hex: '#E0881C' },
	judgement: { name: '炽橙猩红', hex: '#F0461C' },
	the_world: { name: '靛/青黑', hex: '#2B2C5C' },
};

export function kingScaleColor(card){
	if(!card || card.arcana !== 'major'){ return null; }
	return KING_SCALE[card.sid] || null;
}

// 金色黎明四色阶（King/Queen/Prince/Princess = Atziluth/Briah/Yetzirah/Assiah 四界之色）。
// 古籍仅逐条给出 King 阶 22 大牌色名（本文件上方 KING_SCALE，hex 为渲染近似）；
// Queen/Prince/Princess 三阶逐质点/逐大牌之色属 Liber 777 核心大表（128 格），古籍未展开 → 逐条色标「待校」，
// 不臆造 hex。此处给出四界属性描述（古籍 8.5 有文字），供 UI 显示与切换；逐条色仅 King 阶可用。
export const SCALE_META = {
	king: { key: 'king', label: '王阶 King', world: 'Atziluth 原型界', element: '火', note: '纯净·明亮（路径主色）', hasColors: true },
	queen: { key: 'queen', label: '后阶 Queen', world: 'Briah 创造界', element: '水', note: '柔和·粉彩（质点主色）', hasColors: true },
	prince: { key: 'prince', label: '子阶 Prince', world: 'Yetzirah 形成界', element: '风', note: '浓郁·饱和（混合/旗帜色）', hasColors: true },
	princess: { key: 'princess', label: '女阶 Princess', world: 'Assiah 行动界', element: '土', note: '斑驳·复合（落地/纹理色）', hasColors: true },
};
export const SCALE_ORDER = ['king', 'queen', 'prince', 'princess'];
// Queen/Prince/Princess 三阶 22 大牌（路径）色名——据 Liber 777 传统四色阶（公有领域体系事实；hex 为按色名的渲染近似）。键=sid。
export const QUEEN_SCALE = {
	the_fool: { name: '天蓝', hex: '#87CEEB' }, the_magician: { name: '紫', hex: '#7B2CD6' }, high_priestess: { name: '银', hex: '#C7CCD1' },
	the_empress: { name: '天蓝', hex: '#87CEEB' }, the_emperor: { name: '红', hex: '#D8281E' }, the_hierophant: { name: '深靛', hex: '#2B2C5C' },
	the_lovers: { name: '淡藕紫', hex: '#C8A2C8' }, the_chariot: { name: '栗褐', hex: '#7B2E2E' }, strength: { name: '深紫', hex: '#5B2A83' },
	the_hermit: { name: '青灰', hex: '#708090' }, wheel_of_fortune: { name: '蓝', hex: '#2F66E0' }, justice: { name: '蓝', hex: '#2F66E0' },
	hanged_man: { name: '海绿', hex: '#2E8B7B' }, death: { name: '暗棕', hex: '#6B5030' }, temperance: { name: '黄', hex: '#F2DE2B' },
	the_devil: { name: '黑', hex: '#1A1A1A' }, the_tower: { name: '红', hex: '#D8281E' }, the_star: { name: '天蓝', hex: '#87CEEB' },
	the_moon: { name: '缓黄银白点', hex: '#E0D8C0' }, the_sun: { name: '金黄', hex: '#F0C830' }, judgement: { name: '朱红', hex: '#E0341C' }, the_world: { name: '黑', hex: '#1A1A1A' },
};
export const PRINCE_SCALE = {
	the_fool: { name: '蓝翠绿', hex: '#2FA98B' }, the_magician: { name: '灰', hex: '#9098A0' }, high_priestess: { name: '冷淡蓝', hex: '#A9C7E8' },
	the_empress: { name: '早春绿', hex: '#9ED96B' }, the_emperor: { name: '灿焰', hex: '#F0461C' }, the_hierophant: { name: '暖橄榄', hex: '#6B6B2E' },
	the_lovers: { name: '新黄皮革', hex: '#D9C77A' }, the_chariot: { name: '亮赤褐', hex: '#A0522D' }, strength: { name: '灰', hex: '#9098A0' },
	the_hermit: { name: '绿灰', hex: '#7D8B7D' }, wheel_of_fortune: { name: '浓紫', hex: '#6A2C91' }, justice: { name: '深蓝绿', hex: '#1C7A7A' },
	hanged_man: { name: '深橄榄绿', hex: '#556B2F' }, death: { name: '极暗棕', hex: '#3B2A1A' }, temperance: { name: '绿', hex: '#2FA84F' },
	the_devil: { name: '蓝黑', hex: '#16162B' }, the_tower: { name: '威尼斯红', hex: '#A83232' }, the_star: { name: '蓝藕紫', hex: '#8A7BC8' },
	the_moon: { name: '半透粉棕', hex: '#D8B0A0' }, the_sun: { name: '浓琥珀', hex: '#E0A81C' }, judgement: { name: '朱红点金', hex: '#E0441C' }, the_world: { name: '蓝黑', hex: '#16162B' },
};
export const PRINCESS_SCALE = {
	the_fool: { name: '翠绿点金', hex: '#3DA35D' }, the_magician: { name: '靛紫辉', hex: '#4B2C83' }, high_priestess: { name: '银映天蓝', hex: '#B8CBE0' },
	the_empress: { name: '亮玫映淡绿', hex: '#E86A9B' }, the_emperor: { name: '炽红', hex: '#E63020' }, the_hierophant: { name: '浓褐', hex: '#6B4423' },
	the_lovers: { name: '偏藕暗灰', hex: '#A88B8B' }, the_chariot: { name: '暗绿褐', hex: '#4A5D3A' }, strength: { name: '赤琥珀', hex: '#C8791E' },
	the_hermit: { name: '梅红', hex: '#8E4585' }, wheel_of_fortune: { name: '亮蓝映黄', hex: '#3D7AD6' }, justice: { name: '淡绿', hex: '#A8D5A8' },
	hanged_man: { name: '白映紫(珠光)', hex: '#D8CBE0' }, death: { name: '青黑褐', hex: '#2A2530' }, temperance: { name: '暗鲜蓝', hex: '#1C3D8A' },
	the_devil: { name: '近黑冷灰', hex: '#2B2B30' }, the_tower: { name: '亮红映青翠', hex: '#E0341C' }, the_star: { name: '白泛紫', hex: '#D8CBE8' },
	the_moon: { name: '石色', hex: '#B8B0A0' }, the_sun: { name: '琥珀映红', hex: '#E0902C' }, judgement: { name: '朱映绯翠', hex: '#D0301C' }, the_world: { name: '黑映蓝', hex: '#1C2540' },
};
const SCALE_TABLES = { king: KING_SCALE, queen: QUEEN_SCALE, prince: PRINCE_SCALE, princess: PRINCESS_SCALE };
export function scaleColor(card, scaleKey){
	if(!card || card.arcana !== 'major'){ return null; }
	const t = SCALE_TABLES[scaleKey] || KING_SCALE;
	return t[card.sid] || null;
}
