// 主题占断层(按问题域细分的牌义:感情/事业/学业/健康/出行/财务/文书讼务)。原创中文撰写。
// 结构:DOMAIN_MAJOR[sid][domainKey] · DOMAIN_PIP[suit][rank][domainKey] · DOMAIN_COURT[suit][court][domainKey],值=正位向短句;
// 逆位域义由逆位模式引擎在正位域义上派生,不另存逆位域表(与 reversalModes 单一真值协同)。
// 健康域显示端恒挂「传统占验视角,非医疗建议」免责(护栏在消费端统一加,不入数据)。
// 已录:大牌 22(以健康与主干域为主) · 数字牌 40 全 · 宫廷 16(人物与事件向);accessor 对缺条返回 null。
import { isTrumpArcana } from '../engine/arcana.js'; // [QA-9] 王牌判据单一真值源
export const DOMAIN_KEYS = ['love', 'career', 'study', 'health', 'travel', 'money', 'legal'];
export const DOMAIN_CN = { love: '感情', career: '事业', study: '学业', health: '健康', travel: '出行', money: '财务', legal: '文书讼务' };

export const DOMAIN_MAJOR = {
	the_fool: { love: '冲动入情,重过程而难承诺', career: '不合常轨的路数;非创意之职则难见容', study: '不够用功或方向走偏,事倍功半', health: '精力尚足,防冒失小伤', travel: '未经计划的漫游;亦主搬家转学', money: '小额试水,忌孤注一掷', legal: '文书尚未成形' },
	the_magician: { love: '善言者近身,辨其诚伪', career: '沟通联络之务(演讲·写作·中介·代理·外交);开局良时', study: '学法灵巧,举一反三', health: '如医者问诊解厄;逆位则心神与神经之扰', travel: '短程往来频密', money: '有本事变现,防巧言之诱', legal: '话术胜于实据,留字为凭' },
	high_priestess: { love: '单恋、暗恋或独身静守', career: '幕后与研究之职', study: '静学有成,重记忆与直觉', health: '妇科与经期之扰,睡眠宜调', travel: '不宜远行,宜静修', money: '暗中积蓄,不宜声张', legal: '内情未明,勿轻下判' },
	the_empress: { love: '婚嫁、悦情,或女方主动;亦主极具吸引力的女性', career: '收获丰硕;或遇热心女性贵人', study: '艺文见长', health: '孕产之象;逆位或营养不良、孕产不顺', travel: '近郊养息之行', money: '入项渐丰,重享用', legal: '以和为贵,少讼' },
	the_emperor: { love: '男方主动,或两情少交流;情人有担当而不甜言', career: '以权威与专业领众,并自律甚严', study: '按部就班,重纪律', health: '劳心成疾、头风与创伤后紧张', travel: '公务出行', money: '资产可守,宜立制度', legal: '契约与法规当头,占理' },
	the_hierophant: { love: '传统之缘(相亲、名分)或精神之交;佳时论婚', career: '机关团体与学校之务;有长辈贵人', study: '在校如鱼得水,问考必顺', health: '耳鼻喉与筋骨僵痛', travel: '随团受教之行', money: '循常规理财,忌走偏门', legal: '照章办事,可获裁准' },
	the_lovers: { love: '两情相吸、影响深远;逆则失恋或不顺', career: '职场人和至关重大,须学合作;或办公室之情', study: '兴趣分岔,须择一', health: '心神系于关系;逆或涉私密之扰', travel: '结伴同行', money: '价值取舍决定进项', legal: '协议须双方签押' },
	the_chariot: { love: '少软语交流;或有竞争者,或己即竞争者', career: '进取见功,防躁进', study: '冲刺有成', health: '压力性溃疡与外伤,防意外', travel: '陆路远行与交通工具;逆或延期、事故', money: '进取可得,忌恃胜追高', legal: '争而后胜,代价不小' },
	strength: { love: '以柔克刚,情长而稳', career: '耐力型的胜出', study: '久攻自破', health: '如病者伏其疾,重拾活力之吉兆;逆则宜多留意', travel: '路远而能持', money: '缓进缓收', legal: '以理服人,不宜硬碰' },
	the_hermit: { love: '单身或暂退一步深思;在情中亦需独处之空', career: '专精独行的路数', study: '自修与深研', health: '消化与老化诸候,睡眠视听渐弱', travel: '独行静旅', money: '守成节用', legal: '宜咨询老练之人' },
	wheel_of_fortune: { love: '姻缘天定或一见倾心的新起', career: '时来运转,常有意外之喜', study: '成绩起伏', health: '病情起伏、复发与季节之扰', travel: '临时起意之行', money: '意外之喜;逆则运滞,忌投机赌博', legal: '事在时机,拖则生变' },
	justice: { love: '论公平与责任', career: '考评与裁定当头', study: '考较即另一种裁决,须比人更用功', health: '代谢失衡、肝胆与解毒之累', travel: '因公务或诉讼而行', money: '账目须清,分配求平', legal: '讼事契约当头,可得公允;逆或裁断不公、契中有诈' },
	hanged_man: { love: '暂无进展;或须默默等待之人', career: '暂停与蛰伏', study: '停一停反有所得', health: '身心互扰,忌以瘾避苦', travel: '行程延宕', money: '资金暂被套住', legal: '案悬不决,静候' },
	death: { love: '关系了结(分手离异)或结束单身而成婚', career: '生涯段落之终,转职在即', study: '毕业,即学阶之结束', health: '主旧习之终(戒烟酒赌);肉身之死于占卜极罕,不作此断', travel: '单程之行、不复返', money: '旧财路断、新路未开', legal: '旧案了结' },
	temperance: { love: '异国之缘或跨界之情', career: '跨国与文化交流之务,应付裕如', study: '教与学皆是沟通', health: '疗愈之力,旧疾随时渐愈;逆或因过度而伤', travel: '跨国与洲际之行', money: '收支调匀', legal: '调解可成' },
	the_devil: { love: '束缚性的关系:明知不宜而不肯了;或有欲无情、以财易情', career: '奋力求取名利常是吉征,唯须自省是否利欲熏心', study: '沉迷分心;戒不择手段', health: '成瘾、烟酒与私密之疾;逆位主戒断', travel: '为欲而行', money: '名利可得;亦诫勿为物所役', legal: '契约暗藏束缚条款' },
	the_tower: { love: '骤然争吵分手,或外力冲击(家人反对、两地分隔)', career: '突遭打击', study: '成绩剧变', health: '疾病突发、意外、住院或天灾之伤', travel: '行程突变', money: '突发损耗', legal: '突生变故,速理为上' },
	the_star: { love: '疗愈与希望重生', career: '愿景清朗,得人赏识', study: '灵感与自信回归', health: '若病,主平静地愈其身心', travel: '清爽之旅', money: '细水长流,渐回稳', legal: '事有转机' },
	the_moon: { love: '于情多惧、少信而易情绪化', career: '前路朦胧,情报不足', study: '思绪纷乱,状态摇摆', health: '睡眠、神智与情绪之扰;亦主成瘾', travel: '夜行水路,慎行', money: '账目不明,防欺瞒', legal: '证据未明,勿轻信' },
	the_sun: { love: '问情可成,婚姻和合', career: '事业腾达', study: '金榜题名', health: '康健无虞;唯防暑热曝晒', travel: '宜日光与炎热之地;占天气主晴', money: '进项光明', legal: '真相大白,有利' },
	judgement: { love: '破镜可圆', career: '升迁、转业与成长', study: '重考与重修有成', health: '痊愈重启;逆则非吉,问术恐不顺', travel: '因召而行', money: '旧账清算', legal: '得有利之判;逆则讼考己方不利,宜多备' },
	the_world: { love: '走到完成:或步入礼堂,或好聚好散', career: '事业到达成功的段落', study: '学业顺利完成', health: '整体康健;若病则在骨、脊与免疫', travel: '大范围航空之旅乃至环游;亦主搬迁移居', money: '收获圆满', legal: '结案' },
};

// 东方文化对应人物(此中文教程独有的一层记忆抓手;仅录书中明列者)。键=sid。
export const EASTERN_FIGURES = {
	the_fool: '夸父、韩湘子、济公、周伯通',
	the_magician: '诸葛亮、刘伯温、黄蓉',
	high_priestess: '观世音、小龙女',
	the_empress: '女娲、嫘祖',
	the_emperor: '玉皇大帝、黄帝',
	the_hierophant: '孔子、玄奘',
	wheel_of_fortune: '塞翁(失马之喻)',
	hanged_man: '文天祥、勾践',
	death: '牛头马面、黑白无常',
	the_devil: '岳不群',
	judgement: '阎罗王',
};
export function easternFigureOf(card){
	if(!card || !isTrumpArcana(card.arcana)){ return null; }
	return EASTERN_FIGURES[card.sid] || null;
}

export const DOMAIN_PIP = {
	wands: {
		1: { career: '新局开端,前景光明,勿蹉跎', health: '亦可主新生命之始', money: '新计划带来的进项' },
		2: { career: '合宜之谋与胆识带来开局', money: '合伙、置产之机', study: '拟定长远之计' },
		3: { career: '略有小成、协商顺遂,得新案', travel: '出国进修或出差', love: '远距之缘或探寻新对象' },
		4: { love: '情事安稳、婚庆之象', career: '目标达成、庆功', study: '旧日根基打得牢' },
		5: { love: '情场的角力与磨合', career: '竞争与内耗', study: '考场之争', money: '财场之争,费力方得' },
		6: { love: '抱得佳人或获知对方有意', career: '久候的机会主动上门', study: '金榜题名、实力大进' },
		7: { love: '相持不下则伤情', career: '据高守成,凭勇得胜', study: '顶住压力可成' },
		8: { love: '骤逢热恋之机', career: '灵感与新任骤至', travel: '突然的旅行,尤主航空', money: '消息带来的机会' },
		9: { love: '设防太重则伤情', health: '外伤,尤在头部', career: '守成待敌、蓄力再战' },
		10: { love: '独揽重担反伤两人', career: '压力与责任,伴随成功而来', money: '收获与负担并至' },
	},
	cups: {
		1: { love: '新情新谊的好兆;久情则察其外缘', health: '感受敏锐、心神富足', career: '以善意化解' },
		2: { love: '心心相印、对等结合', career: '合伙愉快、合约可签', study: '相异之长的结合' },
		3: { love: '团体中生情;亦防三人之扰', career: '结盟与庆功', health: '问疾病或哀伤时为吉兆' },
		4: { love: '倦怠退缩,或见异思迁', career: '安稳久了反觉无趣', health: '情绪低落、意兴阑珊' },
		5: { love: '离散与哀悼,尚有余杯可依', career: '计划落空之憾', money: '损失之痛' },
		6: { love: '如初恋般单纯,或旧人重逢', money: '馈赠与遗产、受人照拂', study: '经验与教诲的传递' },
		7: { love: '一厢情愿的幻想', career: '前景看好恐属虚拟', health: '亦主借酒药逃避之瘾' },
		8: { love: '放下现有、另寻所愿', career: '舍旧图新的牺牲', travel: '离开旧地之行' },
		9: { love: '情财两得的许愿之牌', money: '愿望成真、感官丰足', career: '订婚成业皆吉' },
		10: { love: '越过热恋、共组家庭之象', career: '和睦的团体', health: '家和则身安' },
	},
	swords: {
		1: { career: '新挑战开端,成败皆有,须备勇气', health: '手术或针药之象', legal: '正义与权威当头' },
		2: { love: '冷战与回避,勿再拖延', health: '长期紧绷致肩臂酸痛', career: '僵局与假性和平' },
		3: { love: '离情、背叛与心碎', health: '创口与手术,待时而愈', career: '延迟与缺席' },
		4: { career: '暂停蓄力,是为走更远', health: '住院或静养', study: '停下沉思再上路' },
		5: { love: '争赢了却输了情', career: '损人不利己的空胜', legal: '争执与不择手段' },
		6: { health: '受伤后的痊愈之程', travel: '旅行,尤与水相关', love: '带着旧伤平稳前行' },
		7: { career: '独行与机巧,或遭欺瞒', money: '恐有金钱之失或面子攸关', legal: '防人背信,亦戒己之不诚' },
		8: { love: '自困于牛角尖', health: '生病之象', career: '划地自限、坏消息' },
		9: { health: '失眠、噩梦、头颈胸之疾', love: '深夜的忧惧', career: '焦虑压顶' },
		10: { love: '痛苦的了结', career: '事业的谷底与终结', health: '背脊之患;黎明在后' },
	},
	pentacles: {
		1: { love: '安稳而有实感的关系、定情之物', career: '与钱物相关的新局', health: '问身体皆吉兆', money: '加薪、进项、投资之机' },
		2: { love: '感情亦在波动中求平', career: '一心多用、八面周旋', money: '收支勉强持平', study: '学业与工作两头兼顾' },
		3: { career: '团队协作、初步成果与升迁', study: '好成绩与学位', love: '重物质而少交心之虑' },
		4: { love: '善妒而占有', money: '获利与稳守,亦近吝啬', career: '不肯松手的掌控' },
		5: { love: '贫贱相守、患难见真情', health: '身体的病困', money: '匮乏与无援' },
		6: { love: '施与受的不对等', money: '理财得宜、受助或偿债', study: '经验技艺的传授' },
		7: { career: '暂停回看成果,再定下一步', money: '略有小成,善用为要', love: '长久之后须定去从' },
		8: { career: '勤勉精进、求职将成', study: '苦练有功', love: '为立业而疏于情' },
		9: { money: '富足自给、可享闲暇', love: '成功之后的孤独课题', health: '自律带来的安好' },
		10: { money: '财运与事业大吉、传承之象', career: '家族与团体之业', love: '安稳有余而交心不足' },
	},
};

export const DOMAIN_COURT = {
	wands: {
		king: { career: '开创立业之人,行动力最强', love: '健谈幽默、正直可敬', study: '有创见而少细则' },
		queen: { career: '独立能干、多线并进', love: '热情外向、不喜被利用', study: '兴趣广博' },
		knight: { travel: '远行、迁居或远客将至', love: '热烈而不定', career: '冲劲十足' },
		page: { travel: '愉快的旅程在即', career: '新消息与新点子', study: '兴致高而难持久' },
	},
	cups: {
		king: { love: '情感成熟而含蓄的男性', career: '受人敬重的专业者', health: '宜多留意内心感受' },
		queen: { love: '温柔共情、可托心事', career: '直觉敏锐的支持者', health: '善抚人心' },
		knight: { love: '浪漫追求者、白马之姿;亦防其不专', travel: '水边或潮湿之地的行程', career: '邀约与机会临门' },
		page: { love: '纯真温暖的相伴', study: '以灵性眼光重看生命', career: '善意的消息' },
	},
	swords: {
		king: { career: '智略与判断力强,可请其指点', legal: '法务与裁断之人', study: '学者型的严谨' },
		queen: { career: '独立清明、洞见非凡', love: '严厉孤高、不轻受助', study: '分析与沟通俱佳' },
		knight: { career: '来去皆快,须速作决断', love: '吸引力强而难长久', travel: '急促的行程' },
		page: { legal: '将收重要文件或合约,细读防误', career: '探查与研究新域', study: '开启新学问' },
	},
	pentacles: {
		king: { money: '守信重诺、稳健慷慨的生意人', career: '经营有成、知足常乐', health: '生活安适' },
		queen: { career: '职业女性、经营与财务见长', money: '务实理财、社会地位稳', love: '重视家人而少形于色' },
		knight: { career: '最可靠的执行者、守时守信', money: '谨慎务实的投资', travel: '陆路或商务的慢行' },
		page: { study: '正式的学徒与课业', money: '财务上的初次接触', career: '专注于工作的新手' },
	},
};

export function domainsOf(card){
	if(!card){ return null; }
	let m = null;
	if(isTrumpArcana(card.arcana)){ m = DOMAIN_MAJOR[card.sid]; }
	else if(card.court){ m = DOMAIN_COURT[card.suit] && DOMAIN_COURT[card.suit][card.court]; }
	else if(card.number >= 1 && card.number <= 10){ m = DOMAIN_PIP[card.suit] && DOMAIN_PIP[card.suit][card.number]; }
	return m || null;
}
