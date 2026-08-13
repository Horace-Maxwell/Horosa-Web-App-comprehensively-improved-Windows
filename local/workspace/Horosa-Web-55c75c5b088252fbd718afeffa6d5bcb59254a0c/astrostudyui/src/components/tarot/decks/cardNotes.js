// 牌面笔记层:图像要点/符号清单/逆位图像演绎/人物朝向/特例护栏。原创中文撰写(图像描述据公有领域牌面客观记述)。
// 结构:NOTES[sid] = { image 牌面要点, symbols[] 符号清单, reverseImage 逆位图像演绎(倒转看图的读法),
//   gaze 'left'|'right'|'front'|null 人物视线(以观者坐标;供对读引擎的视线互动,宁缺勿错——版本朝向有别者一律 null),
//   special 特例护栏/专属规则文案 }。Wave A 已录:大牌 22 全 + 有图像演绎传统的数字牌 6 张;accessor 缺条返回 null。
export const NOTES = {
	// ——— 大阿卡纳 22 ———
	the_fool: {
		image: '行者临崖举步,一手擎白花一手挑行囊,小白犬在足边跃动,白日高悬。',
		symbols: ['悬崖=未知之界', '行囊=已积的经验', '白犬=本能的提醒', '白花=未染的热忱', '高日=照见而不干预'],
		reverseImage: '倒转则如坠崖之势——步子的代价被放大:先看脚下,再谈远方。',
		gaze: null, // 各版本朝向不一(有向左仰望者、有向右行进者),不作视线判定
		special: '此牌亦可当作「空白牌」用:视为空白时正逆同义,主未揭示的更大安排。',
	},
	the_magician: {
		image: '术者一手指天一手指地,案上并陈四器,腰缠衔尾之蛇,头上悬无限之号。',
		symbols: ['指天指地=上下相通', '四器=杯为动机·剑为筹划·杖为热忱·币为落实', '衔尾蛇=循环不息', '案上花草=才具已备'],
		reverseImage: '倒转则器物欲落案下——本事仍在,却使不上力或用错了地方。',
		gaze: 'front',
		special: null,
	},
	high_priestess: {
		image: '素衣者端坐两柱之间,膝上半掩经卷,幔帐绘石榴,足前偃月。',
		symbols: ['双柱=阴阳两极(一柱主受·一柱主动)', '幔帐=未启之秘', '经卷半掩=知而不宣', '偃月=潮汐与周期'],
		reverseImage: '倒转则幔帐欲落——秘密将泄,或内在之声被外声盖过。',
		gaze: 'front',
		special: null,
	},
	the_empress: {
		image: '丰饶妇人倚卧于野,冠十二星,座畔麦熟,身后水流不息。',
		symbols: ['十二星=周天之序', '麦田=已熟之果', '流水=情感与滋养', '心形盾牌=金星之属'],
		reverseImage: '倒转则果实欲坠——滋养过度成溺,或该结的果迟迟不结。',
		gaze: 'front',
		special: null,
	},
	the_emperor: {
		image: '王者据石座,座角作羊首,手擎权符,甲胄未卸,身后是赤裸山岩。',
		symbols: ['羊首=开创之力', '权符=秩序与号令', '甲胄=时刻备战', '荒山=不靠外缘的自立'],
		reverseImage: '倒转则冠冕欲落——威权失据,或以硬撑代替真正的秩序。',
		gaze: 'front',
		special: null,
	},
	the_hierophant: {
		image: '教尊坐于两柱之下,手作祝祷,足前交叉双钥,阶下二人受教。',
		symbols: ['双钥=显义与隐义两把钥匙(传统一金一银,亦有版本两把同色)', '三重冠=身心灵三界', '受教二人=传承与被传承'],
		reverseImage: '倒转则钥匙落地——法度松动:或破格得自由,或失了准绳。',
		gaze: 'front',
		special: null,
	},
	the_lovers: {
		image: '男女赤身分立,女望天使,男望女,身后一树结果、一树生焰。',
		symbols: ['天使=更高的裁量', '果树与焰树=知与欲两端', '男望女·女望天=情理相递的次第'],
		reverseImage: '倒转则天使之光转向别处——所倚的价值尺度先乱,再乱的才是关系。',
		gaze: 'front',
		special: null,
	},
	the_chariot: {
		image: '甲士立于车中,车前二兽一黑一白,冠有星辰,幔上绘星空。',
		symbols: ['黑白二兽=相反的两股拉力', '星幔=天意所覆', '不执缰=以意志驭之,非以蛮力'],
		reverseImage: '倒转则二兽失驭——方向先乱于内,车才偏于外。',
		gaze: 'front',
		special: null,
	},
	strength: {
		image: '素衣女子俯身抚狮之口,狮驯然仰首,头上悬无限之号。',
		symbols: ['狮=本能与欲力', '花冠花带=以柔驯之', '无限号=不竭之力'],
		reverseImage: '倒转则人兽易位——不是力不足,是被自己的力拽着走。',
		gaze: null,
		special: null,
	},
	the_hermit: {
		image: '老者独立雪岭,提灯照前路,灯中一星,手执长杖。',
		symbols: ['灯中之星=内明', '长杖=经验所倚', '雪岭=退处高寒'],
		reverseImage: '倒转则灯焰欲熄——不是无光,是无人愿看,或自己不肯举灯。',
		gaze: 'left',
		special: null,
	},
	wheel_of_fortune: {
		image: '巨轮悬空,四角各有一物执卷,轮上蛇降豺升,顶端狮身人面持剑静坐。',
		symbols: ['四角四活物=四固定星座与四界', '蛇与豺=降与升', '顶端持剑者=在变动之上不动'],
		reverseImage: '倒转则轮转反向——机会仍在,只是这一程要逆着走。',
		gaze: null,
		special: null,
	},
	justice: {
		image: '持剑执衡者正坐,剑锋垂直向上,幔帐之后有柱。',
		symbols: ['剑=判断', '天平=权衡', '剑直立=不偏不倚'],
		reverseImage: '倒转则天平先倾——先失了衡,才谈得上偏私。',
		gaze: 'front',
		special: '此牌为「回退前课」法的明示例外:因果之律不因倒置而改,逆位照正位读。',
	},
	hanged_man: {
		image: '一人倒悬于丁字木上,单足系缚,另一腿屈成十字,首绕光晕,神色安然。',
		symbols: ['丁字木=活木非死柱', '倒悬=颠倒的视角', '光晕=颠倒中的了悟', '背手=甘心不动'],
		reverseImage: '倒转反成正立——失了「换个角度」的便宜:落回常识里,反而看不见先前看见的。',
		gaze: 'front',
		special: '此牌本身即是倒置之象:寻常逆位所论的诸义,多已含在其正位之中。',
	},
	death: {
		image: '白骨骑士按辔徐行,旗上绘白花,前有伏者与跪者,远处双塔间日初升。',
		symbols: ['白花旗=凋而复荣', '双塔之间的日=过门即新天', '不为所动的辔=进程不由人拦'],
		reverseImage: '倒转则马首欲回——不是不来,是被拖住:该了的事迟迟不了。',
		gaze: 'left',
		special: '护栏:此牌无论正逆,义为「结束与转化」,不作死亡预兆解;健康问题请以就医为准。',
	},
	temperance: {
		image: '有翼者一足踏水一足踏岸,两器之间水流不断,身后小径通向远山之日。',
		symbols: ['两器互注=不停的调剂', '一水一陆=两界之间', '额前之日=方向清明'],
		reverseImage: '倒转则水泼出器外——调不成剂:或过或不及,或两头都不肯让。',
		gaze: 'front',
		special: null,
	},
	the_devil: {
		image: '有角者踞于方座,座下二人系颈以链,链环宽松,座上倒五芒。',
		symbols: ['链宽松=可脱而不脱', '倒五芒=物欲当头', '角与蹄=未驯的本能', '火炬向下=火用错了地方'],
		reverseImage: '倒转则链欲滑落——束缚开始松动:第一步是承认自己戴着它。',
		gaze: 'front',
		special: null,
	},
	the_tower: {
		image: '高塔遭雷击,冠冕震落,二人自塔上坠下,火星如点。',
		symbols: ['雷=不由分说的介入', '冠冕落=旧的正当性瓦解', '二人俱坠=无人幸免', '塔基未毁=可重建'],
		reverseImage: '倒转则雷自下起——震动来自内部;或坠势稍缓,得以拆而后建。',
		gaze: null,
		special: '护栏:此牌主「骤变与结构瓦解」,不作灾祸恐吓解;宜配「如何减震、如何重建」的行动建议。',
	},
	the_star: {
		image: '裸身者一膝跪岸,双器倾注,一注入池一注入地,天悬大星与七小星,树上有鸟。',
		symbols: ['大星与七星=主愿与诸缘', '一注水一注地=兼济内外', '鸟=灵讯', '裸身=无所遮蔽的坦诚'],
		reverseImage: '倒转则倾注反向——所予者尽而不返,或把水倒回了过去。',
		gaze: null,
		special: null,
	},
	the_moon: {
		image: '月含日面,两塔夹道,犬与狼向月而嗥,水中甲虫初上岸。',
		symbols: ['两塔=通与不通的门户', '犬狼=驯与未驯的同一物', '甲虫出水=潜意识浮出', '曲径=非直行之路'],
		reverseImage: '倒转则月光渐退——迷雾散去,或该看的仍不肯看。',
		gaze: null,
		special: null,
	},
	the_sun: {
		image: '赤子乘白马出墙,墙内向日葵四开,大日当空,红旗轻扬。',
		symbols: ['赤子=不设防的生机', '白马无鞍=不必勒驭', '墙=已越过的界', '向日葵=向明而生'],
		reverseImage: '倒转则日光被遮一分——喜仍是喜,只是迟些、暗些,或被自夸掩了。',
		gaze: 'front',
		special: null,
	},
	judgement: {
		image: '有翼者吹号,旗作十字,棺中众人举臂应召,远处雪岭。',
		symbols: ['号角=不可抗的召唤', '十字旗=清算与更新', '众人俱起=事关一群人', '雪岭=已过的冷寂'],
		reverseImage: '倒转则号声先弱——听见了却装作没听见,或时候未到。',
		gaze: 'front',
		special: null,
	},
	the_world: {
		image: '舞者悬于花环之中,两手各持一杖,四角四活物环视。',
		symbols: ['花环=闭合的周期', '双杖=两端在手', '四活物=四界俱全', '足步交错=与倒悬者同式而意反'],
		reverseImage: '倒转则花环欲解——功将成而未成:差的常是收尾的那一步。',
		gaze: 'front',
		special: null,
	},
	// ——— 有「图像倒转」传统读法的数字牌 ———
	cups_05: {
		image: null, symbols: null, gaze: null,
		reverseImage: '倒转则倾倒之杯复立——洒出的收不回,尚立的还在:目光该挪一挪了。',
		special: null,
	},
	swords_03: {
		image: null, symbols: null, gaze: null,
		reverseImage: '倒转则剑锋改指他向——伤或不在自己这边;亦主剑将脱出,痛开始退。',
		special: null,
	},
	swords_10: {
		image: null, symbols: null, gaze: null,
		reverseImage: '倒转则众剑欲落——最坏已过,伤仍在,起身是唯一的路。',
		special: '护栏:此牌为「谷底与了断」,画中天际已见微明;不作生死断语。',
	},
	wands_07: {
		image: null, symbols: null, gaze: null,
		reverseImage: '倒转则由高处落到低处——同一场仗,位置先输了:先问这仗值不值得打。',
		special: null,
	},
	pentacles_04: {
		image: null, symbols: null, gaze: null,
		reverseImage: '倒转则所抱之币纷纷坠落——抓得越紧,失得越干脆。',
		special: null,
	},
	swords_08: {
		image: null, symbols: null, gaze: null,
		reverseImage: '倒转则缚绳松而剑阵开——门一直没锁,只差挪脚。',
		special: null,
	},
};

export function noteOf(card){
	if(!card || !card.sid){ return null; }
	return NOTES[card.sid] || null;
}
