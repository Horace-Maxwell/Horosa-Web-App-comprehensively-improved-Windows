// 大牌逆位「旅程叙事」层(神话-心理向的 22 条逆位叙事;传统母题综合,原创中文转述,仅供联想非定义)。
// 三段式分组逻辑:1-7 逆位≈与正位相反;8-14 逆位=把力量投射于他人;15-21 逆位=转入内在层面运作。键=sid。
import { isTrumpArcana } from '../engine/arcana.js'; // [QA-9] 王牌判据单一真值源
export const HEROINE_GROUPS = [
	{ range: [0, 7], label: '与正位相反(处境倒置)' },
	{ range: [8, 14], label: '投射于他人(力量外置)' },
	{ range: [15, 21], label: '内在化运作(深层蜕变)' },
];

export const HEROINE_NARRATIVE = {
	the_fool: '悄然启程或仓促逃离,无人注意她已上路。',
	the_magician: '聪慧却未受训、未获认可,只得以暗中的机巧为自己开路。',
	high_priestess: '被隔绝深藏,只许扮演一种角色;而附近正藏着一位魔法女性(真母亲/教母/女神)。',
	the_empress: '失母或被弃、遇苛刻的继母;在向外证明自己中无暇孕育。',
	the_emperor: '想借权柄得利,有才干却被斥不合身份;父亲受人爱戴却软弱或缺席。',
	the_hierophant: '沦为规条的仆役;人生大事由他人设下的试炼决定。',
	the_lovers: '等着被选中,或回绝一切来者;被二分为圣女或荡妇;理想伴侣并不存在。',
	the_chariot: '跌下驾驶座、失去外界声望;被劝「回家安分」,或空等一位拯救者。',
	strength: '有热情却被否定,拒认己力;唯一的帮手是起初不敢信任的野兽。',
	the_hermit: '被放逐或锁进高塔;走入荒野与幽冥;好奇照亮禁忌,既速祸亦启救赎。',
	wheel_of_fortune: '境遇剧变崩解,方向尽失,命运一时落入他人之手。',
	justice: '被苛评、定罪甚至构陷;独自承受众人的指责。',
	hanged_man: '被责罚与遗弃,成为非自愿的祭品。',
	death: '死去、长眠或坠入幽冥;恰在死亡之地开始寻找真我。',
	temperance: '不知不觉获援手引入善境;直觉开启,开始为自己的疗愈负责。',
	the_devil: '阴影派下不可能的任务、勾起「不够好」的恐惧;恶龙实为创造力入口的守卫,须与之结盟。',
	the_tower: '绝望中猛醒:旧的自我形象必须粉碎;不再等英雄解救,亲手拆掉虚假的限制。',
	the_star: '在幽冥中亦自发光;完成筛分之试,给出并接受大地的疗愈;看见真正的美。',
	the_moon: '暗夜中的生灵现身相助,各授天性的智慧;穿越灵魂暗夜,带回重生的希望。',
	the_sun: '辉煌归来,被「宇宙之家」接纳;诞下与天性相连的新生命。',
	judgement: '亲族团聚,自身成圣,新纪元展开;她的故事流传泽人。',
	the_world: '知道自己是有边界的完整智者;携盟友扬升,或有意识地重返人间。',
};

export function heroineOf(card){
	if(!card || !isTrumpArcana(card.arcana)){ return null; }
	return HEROINE_NARRATIVE[card.sid] || null;
}
