import * as LRConst from '../liureng/LRConst';
import {
	appendQimenExplanation,
	appendQimenPatternExplanation,
} from '../../constants/QimenPatternTexts';

export const SEX_OPTIONS = [
	{ value: 1, label: '男' },
	{ value: 0, label: '女' },
];

export const DATE_TYPE_OPTIONS = [
	{ value: 0, label: '公历' },
	{ value: 1, label: '农历' },
];

export const LEAP_MONTH_OPTIONS = [
	{ value: 0, label: '不闰月' },
	{ value: 1, label: '使用闰月' },
];

export const XUSHI_OPTIONS = [
	{ value: 0, label: '虚岁' },
	{ value: 1, label: '实岁' },
];

export const JIEQI_OPTIONS = [
	{ value: 0, label: '节气按天' },
	{ value: 1, label: '节气按分' },
];

export const PAIPAN_OPTIONS = [
	{ value: 0, label: '年家奇门' },
	{ value: 1, label: '月家奇门' },
	{ value: 2, label: '日家奇门' },
	{ value: 3, label: '时家奇门' },
];

export const ZHISHI_OPTIONS = [
	{ value: 0, label: '天禽值符-死门' },
	{ value: 1, label: '天禽值符-阴阳遁' },
	{ value: 2, label: '天禽值符-节气' },
];

export const YUEJIA_QIJU_OPTIONS = [
	{ value: 0, label: '月家起局-年支' },
	{ value: 1, label: '月家起局-符头地支' },
];

export const YEAR_GZ_OPTIONS = [
	{ value: 0, label: '年干支-正月初一' },
	{ value: 1, label: '年干支-立春当天' },
	{ value: 2, label: '年干支-立春交接' },
];

export const MONTH_GZ_OPTIONS = [
	{ value: 0, label: '月干支-节交接当天' },
	{ value: 1, label: '月干支-节交接时刻' },
];

export const DAY_GZ_OPTIONS = [
	{ value: 0, label: '日干支-晚子时按当天' },
	{ value: 1, label: '日干支-晚子时按明天' },
];

export const QIJU_METHOD_OPTIONS = [
	{ value: 'zhirun', label: '置润' },
	{ value: 'chaibu', label: '拆补' },
];

export const KONG_MODE_OPTIONS = [
	{ value: 'day', label: '日空' },
	{ value: 'time', label: '时空' },
];

export const MA_MODE_OPTIONS = [
	{ value: 'day', label: '日马' },
	{ value: 'time', label: '时马' },
];

export const YIXING_OPTIONS = [
	{ value: 0, label: '原宫' },
	{ value: 1, label: '顺转一宫' },
	{ value: 2, label: '顺转二宫' },
	{ value: 3, label: '顺转三宫' },
	{ value: 4, label: '顺转四宫' },
	{ value: 5, label: '顺转五宫' },
	{ value: 6, label: '顺转六宫' },
	{ value: 7, label: '顺转七宫' },
];

const GAN = '甲乙丙丁戊己庚辛壬癸'.split('');
const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
const JIAZI = [];
for(let i=0; i<60; i++){
	JIAZI.push(`${GAN[i % 10]}${ZHI[i % 12]}`);
}
const GANZHI_INDEX_MAP = JIAZI.reduce((mapObj, item, idx)=>{
	mapObj[item] = idx;
	return mapObj;
}, {});
const YINYANGDUN_CACHE = new Map();
const MAX_YINYANGDUN_CACHE = 24;

const XUN_HEADS = JIAZI.filter((_, idx)=>idx % 10 === 0);
const SAN_YUAN_FU_TOU = ['甲子', '甲午', '甲寅', '甲申', '甲辰', '甲戌', '己卯', '己酉', '己巳', '己亥', '己丑', '己未'];
const SAN_YUAN_FU_TOU_SET = new Set(SAN_YUAN_FU_TOU);
const CNUMBER = '一二三四五六七八九'.split('');
const EIGHT_GUA = '坎坤震巽中乾兑艮离'.split('');
const CLOCKWISE_EIGHTGUA = '坎艮震巽离坤兑乾'.split('');
const DOOR_R = '休生伤杜景死惊开'.split('');
const STAR_R = '蓬任冲辅英禽柱心'.split('');
const JIU_XING = '蓬芮冲辅禽心柱任英'.split('');

const JIEQI_NAME = '春分清明谷雨立夏小满芒种夏至小暑大暑立秋处暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒立春雨水惊蛰'.match(/../g);
const YANG_JIEQI = newList(JIEQI_NAME, '冬至').slice(0, 12);

const JJ = {
	甲子: '戊',
	甲戌: '己',
	甲申: '庚',
	甲午: '辛',
	甲辰: '壬',
	甲寅: '癸',
};

const JIEQI2JU = {
	冬至: '一七四阳',
	惊蛰: '一七四阳',
	小寒: '二八五阳',
	大寒: '三九六阳',
	春分: '三九六阳',
	雨水: '九六三阳',
	清明: '四一七阳',
	立夏: '四一七阳',
	立春: '八五二阳',
	谷雨: '五二八阳',
	小满: '五二八阳',
	芒种: '六三九阳',
	夏至: '九三六阴',
	白露: '九三六阴',
	小暑: '八二五阴',
	寒露: '六九三阴',
	立冬: '六九三阴',
	处暑: '一四七阴',
	霜降: '五八二阴',
	小雪: '五八二阴',
	大雪: '四七一阴',
	大暑: '七一四阴',
	秋分: '七一四阴',
	立秋: '二五八阴',
};

const JIEQI_CODE = {
	冬至: '一七四',
	惊蛰: '一七四',
	小寒: '二八五',
	大寒: '三九六',
	春分: '三九六',
	立春: '八五二',
	雨水: '九六三',
	清明: '四一七',
	立夏: '四一七',
	谷雨: '五二八',
	小满: '五二八',
	芒种: '六三九',
	夏至: '九三六',
	白露: '九三六',
	小暑: '八二五',
	大暑: '七一四',
	秋分: '七一四',
	立秋: '二五八',
	处暑: '一四七',
	寒露: '六九三',
	立冬: '六九三',
	霜降: '五八二',
	小雪: '五八二',
	大雪: '四七一',
};

const ZHISHI_BY_JIEQI = [
	{ list: ['冬至', '小寒', '大寒'], door: '休' },
	{ list: ['立春', '雨水', '惊蛰'], door: '生' },
	{ list: ['春分', '清明', '谷雨'], door: '伤' },
	{ list: ['立夏', '小满', '芒种'], door: '杜' },
	{ list: ['夏至', '小暑', '大暑'], door: '景' },
	{ list: ['立秋', '处暑', '白露'], door: '死' },
	{ list: ['秋分', '寒露', '霜降'], door: '惊' },
	{ list: ['立冬', '小雪', '大雪'], door: '开' },
];

const GUA_POS_MAP = {
	巽: 1,
	离: 2,
	坤: 3,
	震: 4,
	中: 5,
	兑: 6,
	艮: 7,
	坎: 8,
	乾: 9,
	干: 9,
};

const POS_GUA_MAP = {
	1: '巽',
	2: '离',
	3: '坤',
	4: '震',
	5: '中',
	6: '兑',
	7: '艮',
	8: '坎',
	9: '乾',
};

const BRANCH_TO_POS = {
	辰: 1,
	巳: 1,
	午: 2,
	未: 3,
	申: 3,
	卯: 4,
	酉: 6,
	寅: 7,
	丑: 7,
	子: 8,
	亥: 9,
	戌: 9,
};

const JIU_XING_NAME = {
	蓬: '天蓬',
	任: '天任',
	冲: '天冲',
	辅: '天辅',
	英: '天英',
	芮: '芮禽',
	禽: '芮禽',
	柱: '天柱',
	心: '天心',
};

const BA_MEN_NAME = {
	休: '休门',
	生: '生门',
	伤: '伤门',
	杜: '杜门',
	景: '景门',
	死: '死门',
	惊: '惊门',
	开: '开门',
};

const GUXU = {
	甲子: '戌亥',
	甲戌: '申酉',
	甲申: '午未',
	甲午: '辰巳',
	甲辰: '寅卯',
	甲寅: '子丑',
};

const PALACE_GRID = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const PALACE_NAME = {
	1: '巽',
	2: '离',
	3: '坤',
	4: '震',
	5: '中',
	6: '兑',
	7: '艮',
	8: '坎',
	9: '乾',
};
const OUTER_RING_CLOCKWISE = [1, 2, 3, 6, 9, 8, 7, 4];
const QIMEN_EXPORT_CHAR_MAP = {
	門: '门',
	開: '开',
	傷: '伤',
	驚: '惊',
	陰: '阴',
	陽: '阳',
	離: '离',
	兌: '兑',
	黃: '黄',
	綠: '绿',
	藍: '蓝',
	騰: '腾',
	內: '内',
	沖: '冲',
	輔: '辅',
	麗: '丽',
	風: '风',
	險: '险',
	鬥: '斗',
	體: '体',
	臺: '台',
	與: '与',
	廣: '广',
	層: '层',
	醫: '医',
	氣: '气',
	關: '关',
	貴: '贵',
	龍: '龙',
	變: '变',
	遠: '远',
	飛: '飞',
	壯: '壮',
	闊: '阔',
	圖: '图',
	樓: '楼',
	處: '处',
	書: '书',
	證: '证',
	經: '经',
	網: '网',
};

const JI_XING_RULE = {
	1: '壬癸',
	2: '辛',
	3: '己',
	4: '戊',
	7: '庚',
};

const RU_MU_RULE = {
	1: '辛壬',
	3: '甲癸',
	7: '丁己庚',
	9: '乙丙戊',
};

const MEN_PO_RULE = {
	1: '开惊',
	2: '休',
	3: '伤杜',
	4: '开惊',
	6: '景',
	7: '伤杜',
	8: '生死',
	9: '景',
};

const PALACE_BASE_DOOR = {
	1: '杜',
	2: '景',
	3: '死',
	4: '伤',
	5: '',
	6: '惊',
	7: '生',
	8: '休',
	9: '开',
};

const TEN_GAN_RESPONSE_MAP = {
	丁丁: '星奇入太阴，文书证件即至，喜事从心、万事如意',
	丁丙: '星随月转，贵人越级高升，常人乐极生悲，要忍、不然因小的不忍，而引起大的不幸',
	丁乙: '人遁吉格，贵人加官进爵，常人婚姻财帛有喜',
	丁壬: '奇仪相合，贵人恩诏，诉狱公平',
	丁己: '火入勾陈，奸私仇怨，事因女人',
	丁庚: '星奇受阻，文书阻隔，行人必归',
	丁戊: '青龙转光，官人升迁，常人威昌',
	丁癸: '朱雀投江，文书口舌是非，经官动府、词诉不利，音信沉溺不到',
	丁辛: '朱雀入狱，罪人失囚，官人失位',
	丙丁: '星奇朱雀，贵人文书吉利，常人平静安乐，得三吉门为天遁',
	丙丙: '月奇悖师，文书逼迫，破耗遗失，主单据、票证，不明遗失',
	丙乙: '日月并行，公谋私为皆为吉',
	丙壬: '火入天罗，为客不利，是非颇多',
	丙己: '火悖入刑，囚人刑杖，文书不行，吉门得吉，凶门转凶',
	丙庚: '荧入太白，賊必去',
	丙戊: '飞鸟跌穴，事业可为，可谋大事，对好事大吉大利，如求婚、求财、考试、求官等，不用费多大力气，就能成功',
	丙癸: '月奇地网，阴人害事，灾祸频生，凡事暗昧不明',
	丙辛: '日月相会，谋事成就，病人不凶',
	乙丁: '奇仪相佐，最利文书、考试，百事可为',
	乙丙: '奇仪顺遂，吉星加官尽职，凶星夫妻反目离别',
	乙乙: '日奇伏吟，不宜见上级领导、贵人；求名求利及进取事不可求，只宜安分守己',
	乙壬: '日奇入天罗，尊婢悖乱，官讼是非，有人谋害之事',
	乙己: '日奇入墓，被土暗昧、门凶事必凶',
	乙庚: '日奇被刑，为争讼财产，夫妻各怀私意',
	乙戊: '阴害阳门，利于阴人阴事，不利于阳人阳事，就是说不利于公开的事情，利于女人/利于暗中行事',
	乙癸: '日奇入地网，宜退不宜进，隐匿藏形，躲灾避难为吉，此格局不利于进攻',
	乙辛: '青龙逃走，人亡财破，奴仆拐带，六畜皆伤',
	壬丁: '干合蛇刑，文书牵连，贵人匆匆，男吉女凶',
	壬丙: '水蛇入火，因为壬丙相冲克，故主官灾刑禁，络绎不绝，主两败俱伤，为客不利',
	壬乙: '小蛇得势，女人柔顺，男人通达',
	壬壬: '天狱自刑或蛇入地罗，壬为天罗又名天狱，辰辰自刑，故名',
	壬己: '反吟蛇刑，主官司败诉，大祸将至，顺守为吉，妄动必凶',
	壬庚: '太白擒蛇，因庚为太白，壬为蛇，故名',
	壬戊: '小蛇化龙，男人发达，女产婴童，做事要防耗散',
	壬癸: '幼女奸淫，主有家丑外扬之事发生；门吉星凶，反福为祸',
	壬辛: '腾蛇相缠，纵得吉门，亦不能安',
	己丁: '朱雀入狱，天盘甲戌己，地盘丁奇，因戌/丑都为火墓，丁奇为南方火，又名朱雀，所以叫朱雀入狱',
	己丙: '火悖地户，己在天盘，丙在地盘，戌为火墓，己为地户，阴阳颠倒，所以叫火悖地户凶格',
	己乙: '墓神不明，戌为乙木之墓，己又为地户，故名墓神不明，地户逢星，宜遁迹隐形为利',
	己壬: '地网高张，狡童佚女，奸情伤杀，凡事不吉，谋为不利',
	己己: '地户逢鬼，病者发凶或必死，百事不遂，暂不谋为，谋为则凶',
	己庚: '刑格返名，词讼先动者不利，如临阴星（凶星）则有谋害之情',
	己戊: '犬遇青龙，戌为犬，甲为龙，故名犬遇青龙',
	己癸: '地刑玄武，男女疾病垂危，有囚狱词讼之灾',
	己辛: '游魂入墓，易招阴邪鬼魅作祟',
	庚丁: '亭亭之格，因私匿或男女关系起官司是非，门吉有救；门凶，事必凶',
	庚丙: '太白入荧，贼必来，为客进利，为主破财',
	庚乙: '太白逢星，退吉进凶，谋为不利',
	庚壬: '移荡格，上格又名小格',
	庚己: '官府刑格，主有官司口舌，因官讼被判刑，住牢狱更凶，百事不利',
	庚庚: '太白同宫，又名战格，官灾横祸',
	庚戊: '天乙伏宫，百事不可谋，大凶',
	庚癸: '大格，因寅申相冲，庚为道路，故多主车祸，行人不至，官司不止，生育母子具伤，婚姻易鳏寡孤独',
	庚辛: '白虎干格，不宜远行，远行车折马伤，求财更为大凶，诸事有灾殃，时间越长越凶',
	戊丁: '青龙耀明，宜见上级领导、贵人，求功名，为事吉利',
	戊丙: '青龙返首，动作大吉，但若逢门迫、入墓、击刑，则吉事成凶',
	戊乙: '青龙和会，门吉事吉，门凶事也凶',
	戊壬: '青龙入天牢，凡阴阳事皆不吉利',
	戊己: '贵人入狱，公私皆不利',
	戊庚: '值符飞宫，吉事不吉，凶事更凶，求财没利益，测病也主凶',
	戊戊: '名为伏吟，凡事不利，道路闭塞，以守为好',
	戊癸: '青龙华盖，又戊癸相合，故逢吉门为吉，可招福临门；逢凶门，事多不利，为凶',
	戊辛: '青龙折足，吉门有生助，尚能谋事；若逢凶门，主招灾，失财或有足疾、折伤',
	癸丁: '腾蛇夭矫，文书官司，火焚也逃不掉，虚惊不宁',
	癸丙: '华盖悖师，贵贱逢之皆不利，唯上人见喜',
	癸乙: '华盖逢星，贵人禄位，常人平安',
	癸壬: '复见腾蛇，癸水、壬水均为水蛇，主嫁娶重婚，后嫁无子，不保年华',
	癸己: '华盖地户，男女测之，音信皆阻，躲灾避难方为吉',
	癸庚: '太白入网，主以暴力争讼，自邏罪责',
	癸戊: '天乙合会，吉门宜求财，婚姻喜美，吉人赞助成合',
	癸癸: '天网四张，主行人失伴，病讼皆伤',
	癸辛: '网盖天牢，主官司败诉，死罪难逃',
	辛丁: '狱神得奇，经商求财获利倍增，囚人逢天赦释免，办其他事，也会有意外的收获',
	辛丙: '干合悖师，荧惑出现，占雨无，占晴旱，占事必因财致讼',
	辛乙: '白虎猖狂，家败人亡（分家、婚散、破产），出行有惊恐，远行多灾殃，尊长不喜，车船俱伤',
	辛壬: '凶蛇入狱，因为壬为凶蛇，辛为牢狱，故名',
	辛己: '入狱自刑，辛为罪人，戌为午火之墓，故为入狱自刑，主奴仆背主，有苦诉讼难伸',
	辛庚: '白虎出力，刀刃相交，主客相残，逊让退步则安，强进血溅衣衫',
	辛戊: '困龙被伤，主官司破财，屈抑守分尚可，妄动则带来祸殃',
	辛癸: '天牢华盖，日月失明，误入天网，动止乖张',
	辛辛: '伏吟天庭，公废私就，讼狱自羅罪名',
};

const DOOR_BASE_RESPONSE_MAP = {
	休休: '求才进人口，谒贵吉，朝见上官，修造大利',
	休伤: '上官主喜庆',
	休开: '主开张店铺及见贵，求财等事大吉',
	休惊: '主损财、招非并疾病惊恐事',
	休景: '主谋望文书印信等事不成，反招口舌',
	休杜: '主破财、失物难寻',
	休死: '主文印官事不吉，远行，僧道事不吉，占病凶',
	休生: '得阴人财物',
	伤休: '主男人变动或托人谋事，财名不利',
	伤伤: '主变动、远行皆主折伤',
	伤开: '主见贵人、开张、走失、变动等事不利',
	伤惊: '主亲人疾病、惊忧，谋为不利，凶',
	伤景: '主文书、印信、口舌、惹是生非',
	伤杜: '主变动、失聪、官司、刑狱、百事凶',
	伤死: '主官司、印信凶，出行大忌，占病凶',
	伤生: '主房产、种植业等变动',
	开休: '主见贵人、财喜、开张店铺、贸易大利',
	开伤: '主变动、更改、移徙等事，皆不吉',
	开开: '主贵人、宝物、财喜、官运、事业皆吉',
	开惊: '词讼、惊疑之事',
	开景: '见贵人，因文书事不利',
	开杜: '主失脱文印、书契等，小凶',
	开死: '官司、惊忧、恶事，先忧后喜',
	开生: '见贵人，谋望所求遂意',
	惊休: '求财事或口舌事，迟吉',
	惊伤: '主因商议同谋害人事泄，惹讼凶',
	惊开: '主忧疑，官事惊恐，见喜贵则不凶',
	惊惊: '主疾病、忧虑、惊疑、惊恐',
	惊景: '主讼词不息，小口疾病，凶',
	惊杜: '失脱破财事，惊恐，不凶',
	惊死: '因田宅中怪异而生是非，凶',
	惊生: '主因妇人生产或求财而生惊忧，皆吉',
	景休: '主文书遗失，争讼不休',
	景伤: '主亲眷口舌，败财后平',
	景开: '官人升迁，求文印事皆吉',
	景惊: '主阳人小口疾病事凶。',
	景景: '主文状未动，有预先见之意，内有阳人、小口忧患',
	景杜: '主文书、印信阻隔，阳人小口疾病。',
	景死: '主官讼，争田宅事，多啾唧',
	景生: '主阴人生产大喜，更主求财旺利，行人大吉',
	杜休: '主求财小益',
	杜伤: '主兄弟田产破财',
	杜开: '主见贵人、官长谋事，先破财后吉',
	杜惊: '主门户内忧疑、惊恐、词讼事',
	杜景: '主文书、印信阻隔，阳人小口疾病',
	杜杜: '主因父母疾病、田宅出脱事，凶',
	杜死: '主田宅、文书失落，官司破财小凶',
	杜生: '主阳人小口破财，田宅求财不利',
	死休: '主求财物事不吉，向僧道求方吉',
	死伤: '官司变动遭刑杖凶',
	死开: '见贵人求文书、印信事利',
	死惊: '因官司事不结，忧疑患病凶',
	死景: '因文信、书契、财产事见官，先怒后喜不凶',
	死杜: '破财，妇人风疾，腹肿',
	死死: '主官事，无气、凶',
	死生: '主丧事，求财则得，占病死者复生',
	生休: '主阴人处，谋财利',
	生伤: '主亲友变动，道路不吉',
	生开: '主见贵人，求财大发',
	生惊: '主尊长财产、词讼，病迟愈，吉',
	生景: '主阴人、小口不宁及文书事',
	生杜: '主阴谋、阴人损财，不利',
	生死: '主田宅官司，病则主难救',
	生生: '主远行，求财，吉',
};

const DOOR_GAN_RESPONSE_MAP = {
	休丁: '百讼休歇',
	休丙: '文书和合喜庆',
	休乙: '求谋重，不得',
	休壬: '阴人词讼牵连',
	休己: '暗昧不宁',
	休庚: '文书词讼先结后解',
	休戊: '财物和合',
	休癸: '阴人词讼牵连',
	休辛: '疾病退愈，失物不得',
	伤丁: '印信不实',
	伤丙: '道路损失',
	伤乙: '求财不得，反盗耗失财',
	伤壬: '囚盗牵连',
	伤己: '财散人病',
	伤庚: '讼狱被刑杖',
	伤戊: '失脱难获',
	伤癸: '讼狱被冤，有理难伸',
	伤辛: '夫妻怀私怨怒',
	开丁: '远信必至',
	开丙: '贵人印绶',
	开乙: '小财可求',
	开壬: '远行有失',
	开己: '事绪不定',
	开庚: '道路词讼，谋为两歧',
	开戊: '财名俱得',
	开癸: '失财小凶',
	开辛: '阴人道路',
	惊丁: '词讼牵连',
	惊丙: '主文书印信惊恐',
	惊乙: '主谋财不得',
	惊壬: '官司囚禁、病者大凶',
	惊己: '恶犬伤人成讼',
	惊庚: '道路损伤、遇盗贼，凶',
	惊戊: '损财、信阻',
	惊癸: '主被贼盗，失物不获',
	惊辛: '因女人成讼，凶',
	景丁: '主因文书、印状招非',
	景丙: '文书急迫、火速不利',
	景乙: '讼事不成',
	景壬: '因贼牵连',
	景己: '官司牵连',
	景庚: '讼人自讼',
	景戊: '因财产至讼，远行则吉',
	景癸: '因奴婢受刑伤',
	景辛: '阴人词讼',
	杜丁: '主阳人讼狱',
	杜丙: '主文契遗失',
	杜乙: '主暗求财物，后则不明至讼',
	杜壬: '主奸盗事凶',
	杜己: '主私谋取、害人、招非',
	杜庚: '因女人词讼被刑',
	杜戊: '主谋事不易成，密处求财可得',
	杜癸: '主百事皆阻，病者不食',
	杜辛: '主打伤人至词讼，阳人小口凶',
	死丁: '老阳人疾病',
	死丙: '信息忧疑',
	死乙: '求事不成',
	死壬: '主讼人自讼自招',
	死己: '主病讼牵连凶',
	死庚: '主女人生产、子母并凶',
	死戊: '主作伪财',
	死癸: '主妇女嫁娶事凶',
	死辛: '主遭盗贼，失脱难获',
	生丁: '词讼、婚姻、财利，出行大吉',
	生丙: '贵人，印绶、婚姻、书信等喜事',
	生乙: '主阴人生产迟，吉',
	生壬: '遗失财物，后得，捕盗易获',
	生己: '得贵人维护支持，吉',
	生庚: '财产争讼、破耗遗失',
	生戊: '嫁娶、谒贵，求财皆吉',
	生癸: '主婚姻难成，余事皆吉',
	生辛: '主产妇疾病，后吉',
};

const JI_DOOR_SET = new Set(['开', '休', '生']);
const SAN_QI_SET = new Set(['乙', '丙', '丁']);
const GOD_ALIAS_MAP = {
	值符: '值符',
	符: '值符',
	螣蛇: '螣蛇',
	腾蛇: '螣蛇',
	蛇: '螣蛇',
	太阴: '太阴',
	阴: '太阴',
	六合: '六合',
	合: '六合',
	白虎: '白虎',
	虎: '白虎',
	玄武: '玄武',
	元武: '玄武',
	玄: '玄武',
	九地: '九地',
	地: '九地',
	九天: '九天',
	天: '九天',
};
const PALACE_BASE_STAR = {
	1: '辅',
	2: '英',
	3: '芮',
	4: '冲',
	5: '禽',
	6: '柱',
	7: '任',
	8: '蓬',
	9: '心',
};
const PALACE_OPPOSITE = {
	1: 9,
	2: 8,
	3: 7,
	4: 6,
	5: 5,
	6: 4,
	7: 3,
	8: 2,
	9: 1,
};
const PALACE_WUXING = {
	1: '木',
	2: '火',
	3: '土',
	4: '木',
	5: '土',
	6: '金',
	7: '土',
	8: '水',
	9: '金',
};
const DOOR_WUXING = {
	休: '水',
	生: '土',
	伤: '木',
	杜: '木',
	景: '火',
	死: '土',
	惊: '金',
	开: '金',
};
const GAN_WUXING = {
	甲: '木',
	乙: '木',
	丙: '火',
	丁: '火',
	戊: '土',
	己: '土',
	庚: '金',
	辛: '金',
	壬: '水',
	癸: '水',
};
const GAN_YINYANG = {
	甲: '阳',
	乙: '阴',
	丙: '阳',
	丁: '阴',
	戊: '阳',
	己: '阴',
	庚: '阳',
	辛: '阴',
	壬: '阳',
	癸: '阴',
};
const WUXING_SHENG = {
	木: '火',
	火: '土',
	土: '金',
	金: '水',
	水: '木',
};
const WUXING_KE = {
	木: '土',
	火: '金',
	土: '水',
	金: '木',
	水: '火',
};
const SAN_QI_DESHI_DAY_MAP = {
	甲: '丙',
	己: '丙',
	乙: '乙',
	庚: '乙',
	丙: '丙',
	辛: '丙',
	丁: '乙',
	壬: '乙',
	戊: '丁',
	癸: '丁',
};
const YUNV_SHOUMEN_TIME_MAP = {
	甲: '丙',
	己: '丙',
	乙: '辛',
	庚: '辛',
	丙: '乙',
	辛: '乙',
	丁: '己',
	壬: '己',
	戊: '壬',
	癸: '壬',
};
const TIANFU_SHI_TIME_MAP = {
	甲: '己巳',
	己: '己巳',
	乙: '甲申',
	庚: '甲申',
	丙: '甲午',
	辛: '甲午',
	丁: '甲辰',
	壬: '甲辰',
	戊: '甲寅',
	癸: '甲寅',
};
const QIYI_HE_SET = new Set([
	'乙庚', '庚乙',
	'丙辛', '辛丙',
	'丁壬', '壬丁',
	'戊癸', '癸戊',
	'甲己', '己甲',
]);

function normalizeGodName(god){
	const key = `${god || ''}`.trim();
	return GOD_ALIAS_MAP[key] || key;
}

function normalizeStarName(star){
	const txt = `${star || ''}`.trim();
	if(!txt){
		return '';
	}
	if(txt.indexOf('芮') >= 0 || txt.indexOf('内') >= 0 || txt.indexOf('內') >= 0){
		return '芮';
	}
	if(txt.indexOf('禽') >= 0){
		return '禽';
	}
	if(txt.indexOf('蓬') >= 0){
		return '蓬';
	}
	if(txt.indexOf('任') >= 0){
		return '任';
	}
	if(txt.indexOf('冲') >= 0 || txt.indexOf('沖') >= 0){
		return '冲';
	}
	if(txt.indexOf('辅') >= 0 || txt.indexOf('輔') >= 0){
		return '辅';
	}
	if(txt.indexOf('英') >= 0){
		return '英';
	}
	if(txt.indexOf('柱') >= 0){
		return '柱';
	}
	if(txt.indexOf('心') >= 0){
		return '心';
	}
	return txt.substring(0, 1);
}

function isJiDoor(doorHead){
	return JI_DOOR_SET.has(doorHead);
}

function isSanQi(gan){
	return SAN_QI_SET.has(gan);
}

function isGodOneOf(god, list){
	const norm = normalizeGodName(god);
	return list.indexOf(norm) >= 0;
}

function isWuxingSheng(from, to){
	return !!from && !!to && WUXING_SHENG[from] === to;
}

function isWuxingKe(from, to){
	return !!from && !!to && WUXING_KE[from] === to;
}

function isDoorShengGong(cell){
	const doorWuXing = DOOR_WUXING[cell.doorHead];
	const gongWuXing = PALACE_WUXING[cell.palaceNum];
	return isWuxingSheng(doorWuXing, gongWuXing);
}

function isGongShengDoor(cell){
	const doorWuXing = DOOR_WUXING[cell.doorHead];
	const gongWuXing = PALACE_WUXING[cell.palaceNum];
	return isWuxingSheng(gongWuXing, doorWuXing);
}

function isGongKeDoor(cell){
	const doorWuXing = DOOR_WUXING[cell.doorHead];
	const gongWuXing = PALACE_WUXING[cell.palaceNum];
	return isWuxingKe(gongWuXing, doorWuXing);
}

function isSameYinYang(ganA, ganB){
	return !!ganA && !!ganB && GAN_YINYANG[ganA] && GAN_YINYANG[ganA] === GAN_YINYANG[ganB];
}

function isFiveBuYuShi(dayGan, timeGan){
	const dayWuXing = GAN_WUXING[dayGan];
	const timeWuXing = GAN_WUXING[timeGan];
	return isSameYinYang(dayGan, timeGan) && isWuxingKe(timeWuXing, dayWuXing);
}

function isTianFuShi(dayGan, timeGanzhi){
	return !!dayGan && !!timeGanzhi && TIANFU_SHI_TIME_MAP[dayGan] === timeGanzhi;
}

function isQiYiHe(cell){
	return QIYI_HE_SET.has(`${cell.tianGan || ''}${cell.diGan || ''}`);
}

function isXingMenRuMu(cell){
	const star = normalizeStarName(cell.tianXing);
	const p = cell.palaceNum;
	if((cell.doorHead === '休' || star === '蓬' || cell.doorHead === '生' || cell.doorHead === '死' || star === '任' || star === '芮' || star === '禽') && p === 1){
		return true;
	}
	if((cell.doorHead === '惊' || cell.doorHead === '开' || star === '心' || star === '柱') && p === 7){
		return true;
	}
	if((cell.doorHead === '伤' || cell.doorHead === '杜' || star === '冲' || star === '辅') && p === 3){
		return true;
	}
	if((cell.doorHead === '景' || star === '英') && p === 9){
		return true;
	}
	return false;
}

function isFuYin(cell){
	const star = normalizeStarName(cell.tianXing);
	const starFuYin = star && PALACE_BASE_STAR[cell.palaceNum] === star;
	const doorFuYin = cell.doorHead && cell.baseDoor && cell.doorHead === cell.baseDoor;
	return !!(starFuYin || doorFuYin);
}

function isFanYin(cell){
	const opposite = PALACE_OPPOSITE[cell.palaceNum];
	if(!opposite){
		return false;
	}
	const star = normalizeStarName(cell.tianXing);
	const starFanYin = star && PALACE_BASE_STAR[opposite] === star;
	const doorFanYin = cell.doorHead && PALACE_BASE_DOOR[opposite] === cell.doorHead;
	return !!(starFanYin || doorFanYin);
}

const QIMEN_JI_RULES = [
	{
		name: '天遁',
		when: (cell)=>cell.tianGan === '丙' && cell.diGan === '丁' && isJiDoor(cell.doorHead),
	},
	{
		name: '地遁',
		when: (cell)=>cell.tianGan === '乙' && cell.diGan === '己' && cell.doorHead === '开'
			&& isGodOneOf(cell.god, ['九地', '太阴', '六合']),
	},
	{
		name: '人遁',
		when: (cell)=>cell.tianGan === '丁' && cell.diGan === '乙'
			&& (cell.doorHead === '休' || cell.doorHead === '生')
			&& isGodOneOf(cell.god, ['太阴']),
	},
	{
		name: '风遁',
		when: (cell)=>cell.tianGan === '乙'
			&& isJiDoor(cell.doorHead)
			&& cell.palaceNum === 1,
	},
	{
		name: '云遁',
		when: (cell)=>cell.tianGan === '乙' && cell.diGan === '辛'
			&& isJiDoor(cell.doorHead)
			&& cell.palaceNum === 3,
	},
	{
		name: '龙遁',
		when: (cell)=>cell.tianGan === '乙' && cell.diGan === '壬'
			&& isJiDoor(cell.doorHead)
			&& cell.palaceNum === 8,
	},
	{
		name: '虎遁',
		when: (cell)=>cell.tianGan === '乙' && cell.diGan === '辛'
			&& (cell.doorHead === '休' || cell.doorHead === '生')
			&& cell.palaceNum === 7,
	},
	{
		name: '神遁',
		when: (cell)=>cell.tianGan === '丙' && cell.doorHead === '生' && isGodOneOf(cell.god, ['九天']),
	},
	{
		name: '鬼遁',
		when: (cell)=>cell.tianGan === '辛' && cell.diGan === '丁'
			&& ['休', '生', '杜'].indexOf(cell.doorHead) >= 0
			&& cell.palaceNum === 7
			&& isGodOneOf(cell.god, ['九地']),
	},
	{
		name: '真诈',
		when: (cell)=>isSanQi(cell.tianGan) && isJiDoor(cell.doorHead) && isGodOneOf(cell.god, ['太阴']),
	},
	{
		name: '重诈',
		when: (cell)=>isSanQi(cell.tianGan) && isJiDoor(cell.doorHead) && isGodOneOf(cell.god, ['九地']),
	},
	{
		name: '休诈',
		when: (cell)=>isSanQi(cell.tianGan) && isJiDoor(cell.doorHead) && isGodOneOf(cell.god, ['六合']),
	},
	{
		name: '天假',
		when: (cell)=>cell.doorHead === '景' && isSanQi(cell.tianGan) && isGodOneOf(cell.god, ['九天']),
	},
	{
		name: '地假',
		when: (cell)=>cell.doorHead === '杜' && '丁己癸'.indexOf(cell.tianGan) >= 0 && isGodOneOf(cell.god, ['九地']),
	},
	{
		name: '人假',
		when: (cell)=>cell.doorHead === '惊' && cell.tianGan === '壬' && isGodOneOf(cell.god, ['九天']),
	},
	{
		name: '鬼假',
		when: (cell)=>cell.doorHead === '死' && '丁己癸'.indexOf(cell.tianGan) >= 0 && isGodOneOf(cell.god, ['九地']),
	},
	{
		name: '物假',
		when: (cell)=>cell.doorHead === '伤' && '丁己癸'.indexOf(cell.tianGan) >= 0 && isGodOneOf(cell.god, ['六合']),
	},
	{
		name: '青龙回首',
		when: (cell)=>cell.tianGan === '戊' && cell.diGan === '丙',
	},
	{
		name: '飞鸟跌穴',
		when: (cell)=>cell.tianGan === '丙' && cell.diGan === '戊',
	},
	{
		name: '三奇得使',
		when: (cell, ctx)=>!!cell.tianGan && SAN_QI_DESHI_DAY_MAP[ctx.dayGan] === cell.tianGan,
	},
	{
		name: '玉女守门',
		when: (cell, ctx)=>!!cell.tianGan && YUNV_SHOUMEN_TIME_MAP[ctx.timeGan] === cell.tianGan,
	},
	{
		name: '天辅时',
		when: (cell, ctx)=>ctx.isTianFuShi === true && cell.isZhiShi,
	},
	{
		name: '三奇升殿',
		when: (cell)=>(cell.tianGan === '乙' && cell.palaceNum === 4)
			|| (cell.tianGan === '丙' && cell.palaceNum === 2)
			|| (cell.tianGan === '丁' && cell.palaceNum === 6),
	},
	{
		name: '奇游禄位',
		when: (cell)=>(cell.tianGan === '乙' && cell.palaceNum === 4)
			|| (cell.tianGan === '丙' && cell.palaceNum === 1)
			|| (cell.tianGan === '丁' && cell.palaceNum === 2),
	},
	{
		name: '欢怡',
		when: (cell)=>cell.isZhiFu && isSanQi(cell.tianGan),
	},
	{
		name: '相佐',
		when: (cell)=>cell.isZhiFu && isSanQi(cell.diGan),
	},
	{
		name: '奇仪相合',
		when: (cell)=>isJiDoor(cell.doorHead) && isQiYiHe(cell),
	},
	{
		name: '交泰',
		when: (cell)=>isJiDoor(cell.doorHead) && ((cell.tianGan === '乙' && cell.diGan === '丁') || (cell.tianGan === '丁' && cell.diGan === '丙')),
	},
	{
		name: '天运昌气',
		when: (cell)=>isJiDoor(cell.doorHead) && cell.tianGan === '丁' && cell.diGan === '乙',
	},
	{
		name: '门宫和义',
		when: (cell)=>isJiDoor(cell.doorHead) && (isDoorShengGong(cell) || isGongShengDoor(cell)),
	},
];

const QIMEN_XIONG_RULES = [
	{
		name: '青龙逃走',
		when: (cell)=>cell.tianGan === '乙' && cell.diGan === '辛',
	},
	{
		name: '白虎猖狂',
		when: (cell)=>cell.tianGan === '辛' && cell.diGan === '乙',
	},
	{
		name: '螣蛇夭矫',
		when: (cell)=>cell.tianGan === '癸' && cell.diGan === '丁',
	},
	{
		name: '朱雀投江',
		when: (cell)=>cell.tianGan === '丁' && cell.diGan === '癸',
	},
	{
		name: '太白火荧',
		when: (cell)=>cell.tianGan === '庚' && cell.diGan === '丙',
	},
	{
		name: '荧入太白',
		when: (cell)=>cell.tianGan === '丙' && cell.diGan === '庚',
	},
	{
		name: '飞宫格',
		when: (cell)=>cell.isZhiFu && cell.diGan === '庚',
	},
	{
		name: '伏宫格',
		when: (cell)=>cell.tianGan === '庚' && cell.isZhiFu,
	},
	{
		name: '飞干格',
		when: (cell, ctx)=>cell.tianGan === ctx.dayGan && cell.diGan === '庚',
	},
	{
		name: '伏干格',
		when: (cell, ctx)=>cell.tianGan === '庚' && cell.diGan === ctx.dayGan,
	},
	{
		name: '大格',
		when: (cell)=>cell.tianGan === '庚' && cell.diGan === '癸',
	},
	{
		name: '小格',
		when: (cell)=>cell.tianGan === '庚' && cell.diGan === '壬',
	},
	{
		name: '刑格',
		when: (cell)=>cell.tianGan === '庚' && cell.diGan === '己',
	},
	{
		name: '悖格',
		when: (cell, ctx)=>cell.tianGan === '丙' && [ctx.yearGan, ctx.monthGan, ctx.dayGan, ctx.timeGan].indexOf(cell.diGan) >= 0,
	},
	{
		name: '年月日时格',
		when: (cell, ctx)=>cell.tianGan === '庚' && [ctx.yearGan, ctx.monthGan, ctx.dayGan, ctx.timeGan].indexOf(cell.diGan) >= 0,
	},
	{
		name: '天网四张格',
		when: (cell)=>cell.tianGan === '癸' && cell.diGan === '癸',
	},
	{
		name: '地罗遮格',
		when: (cell, ctx)=>cell.tianGan === '壬' && !!ctx.timeGan && cell.diGan === ctx.timeGan,
	},
	{
		name: '五不遇时',
		when: (cell, ctx)=>ctx.isFiveBuYuShi === true && cell.isZhiShi,
	},
	{
		name: '六仪击刑',
		when: (cell)=>cell.hasJiXing === true,
	},
	{
		name: '三奇入墓',
		when: (cell)=>(cell.tianGan === '乙' && (cell.palaceNum === 3 || cell.palaceNum === 9))
			|| (cell.tianGan === '丙' && cell.palaceNum === 9)
			|| (cell.tianGan === '丁' && cell.palaceNum === 7),
	},
	{
		name: '时干入墓',
		when: (cell, ctx)=>cell.tianGan === ctx.timeGan && cell.hasRuMu === true,
	},
	{
		name: '星门入墓',
		when: (cell)=>isXingMenRuMu(cell),
	},
	{
		name: '伏吟',
		when: (cell)=>isFuYin(cell),
	},
	{
		name: '返吟',
		when: (cell)=>isFanYin(cell),
	},
	{
		name: '门宫迫制',
		when: (cell)=>cell.hasMenPo === true || isGongKeDoor(cell),
	},
];

// 复用 Horosa-APP 的非八字神煞规则（奇门/六壬/六爻共用）
const QIMEN_SHENSHA_DAY_STEMS = {
	日禄: { 甲: ['寅'], 乙: ['卯'], 丙: ['巳'], 丁: ['午'], 戊: ['巳'], 己: ['午'], 庚: ['申'], 辛: ['酉'], 壬: ['亥'], 癸: ['子'] },
	日德: { 甲: ['寅'], 乙: ['申'], 丙: ['巳'], 丁: ['亥'], 戊: ['巳'], 己: ['寅'], 庚: ['申'], 辛: ['巳'], 壬: ['亥'], 癸: ['巳'] },
	文昌: { 甲: ['巳'], 乙: ['午'], 丙: ['申'], 丁: ['酉'], 戊: ['申'], 己: ['酉'], 庚: ['亥'], 辛: ['子'], 壬: ['寅'], 癸: ['卯'] },
	游都: { 甲: ['丑'], 乙: ['子'], 丙: ['寅'], 丁: ['巳'], 戊: ['申'], 己: ['丑'], 庚: ['子'], 辛: ['寅'], 壬: ['巳'], 癸: ['申'] },
};
const QIMEN_GUIREN_DAY_NIGHT = {
	甲: ['丑', '未'],
	乙: ['子', '申'],
	丙: ['亥', '酉'],
	丁: ['亥', '酉'],
	戊: ['丑', '未'],
	己: ['子', '申'],
	庚: ['丑', '未'],
	辛: ['午', '寅'],
	壬: ['卯', '巳'],
	癸: ['卯', '巳'],
};

const QIMEN_SHENSHA_DAY_BRANCH = {
	驿马: { 子: ['寅'], 丑: ['亥'], 寅: ['申'], 卯: ['巳'], 辰: ['寅'], 巳: ['亥'], 午: ['申'], 未: ['巳'], 申: ['寅'], 酉: ['亥'], 戌: ['申'], 亥: ['巳'] },
	日马: { 子: ['寅'], 丑: ['亥'], 寅: ['申'], 卯: ['巳'], 辰: ['寅'], 巳: ['亥'], 午: ['申'], 未: ['巳'], 申: ['寅'], 酉: ['亥'], 戌: ['申'], 亥: ['巳'] },
	桃花: { 子: ['酉'], 丑: ['午'], 寅: ['卯'], 卯: ['子'], 辰: ['酉'], 巳: ['午'], 午: ['卯'], 未: ['子'], 申: ['酉'], 酉: ['午'], 戌: ['卯'], 亥: ['子'] },
	破碎: { 子: ['巳'], 丑: ['丑'], 寅: ['酉'], 卯: ['巳'], 辰: ['丑'], 巳: ['酉'], 午: ['巳'], 未: ['丑'], 申: ['酉'], 酉: ['巳'], 戌: ['丑'], 亥: ['酉'] },
};

const QIMEN_SHENSHA_MONTH_BRANCH = {
	天马: { 子: ['寅'], 丑: ['辰'], 寅: ['午'], 卯: ['申'], 辰: ['戌'], 巳: ['子'], 午: ['寅'], 未: ['辰'], 申: ['午'], 酉: ['申'], 戌: ['戌'], 亥: ['子'] },
	医星: { 子: ['申', '寅'], 丑: ['酉', '卯'], 寅: ['戌', '辰'], 卯: ['亥', '巳'], 辰: ['子', '午'], 巳: ['丑', '未'], 午: ['寅', '申'], 未: ['卯', '酉'], 申: ['辰', '戌'], 酉: ['巳', '亥'], 戌: ['午', '子'], 亥: ['未', '丑'] },
	生气: { 子: ['戌'], 丑: ['亥'], 寅: ['子'], 卯: ['丑'], 辰: ['寅'], 巳: ['卯'], 午: ['辰'], 未: ['巳'], 申: ['午'], 酉: ['未'], 戌: ['申'], 亥: ['酉'] },
	死气: { 子: ['辰'], 丑: ['巳'], 寅: ['午'], 卯: ['未'], 辰: ['申'], 巳: ['酉'], 午: ['戌'], 未: ['亥'], 申: ['子'], 酉: ['丑'], 戌: ['寅'], 亥: ['卯'] },
	血支: { 子: ['亥'], 丑: ['子'], 寅: ['丑'], 卯: ['寅'], 辰: ['卯'], 巳: ['辰'], 午: ['巳'], 未: ['午'], 申: ['未'], 酉: ['申'], 戌: ['酉'], 亥: ['戌'] },
	成神: { 子: ['亥'], 丑: ['寅'], 寅: ['巳'], 卯: ['申'], 辰: ['亥'], 巳: ['寅'], 午: ['巳'], 未: ['申'], 申: ['亥'], 酉: ['寅'], 戌: ['巳'], 亥: ['申'] },
	会神: { 子: ['申'], 丑: ['辰'], 寅: ['未'], 卯: ['戌'], 辰: ['寅'], 巳: ['亥'], 午: ['酉'], 未: ['子'], 申: ['丑'], 酉: ['午'], 戌: ['巳'], 亥: ['卯'] },
	解神: { 子: ['午'], 丑: ['午'], 寅: ['申'], 卯: ['申'], 辰: ['戌'], 巳: ['戌'], 午: ['子'], 未: ['子'], 申: ['寅'], 酉: ['寅'], 戌: ['辰'], 亥: ['辰'] },
	天目: { 子: ['丑'], 丑: ['丑'], 寅: ['辰'], 卯: ['辰'], 辰: ['辰'], 巳: ['未'], 午: ['未'], 未: ['未'], 申: ['戌'], 酉: ['戌'], 戌: ['戌'], 亥: ['丑'] },
	月厌: { 子: ['子'], 丑: ['亥'], 寅: ['戌'], 卯: ['酉'], 辰: ['申'], 巳: ['未'], 午: ['午'], 未: ['巳'], 申: ['辰'], 酉: ['卯'], 戌: ['寅'], 亥: ['丑'] },
	月破: { 子: ['午'], 丑: ['未'], 寅: ['申'], 卯: ['酉'], 辰: ['戌'], 巳: ['亥'], 午: ['子'], 未: ['丑'], 申: ['寅'], 酉: ['卯'], 戌: ['辰'], 亥: ['巳'] },
	贼神: { 子: ['子'], 丑: ['子'], 寅: ['卯'], 卯: ['卯'], 辰: ['卯'], 巳: ['午'], 午: ['午'], 未: ['午'], 申: ['酉'], 酉: ['酉'], 戌: ['酉'], 亥: ['子'] },
	丧车: { 子: ['午'], 丑: ['午'], 寅: ['酉'], 卯: ['酉'], 辰: ['酉'], 巳: ['子'], 午: ['子'], 未: ['子'], 申: ['卯'], 酉: ['卯'], 戌: ['卯'], 亥: ['午'] },
};

const QIMEN_SHENSHA_YEAR_BRANCH = {
	年马: { 子: ['寅'], 丑: ['亥'], 寅: ['申'], 卯: ['巳'], 辰: ['寅'], 巳: ['亥'], 午: ['申'], 未: ['巳'], 申: ['寅'], 酉: ['亥'], 戌: ['申'], 亥: ['巳'] },
	病符: { 子: ['亥'], 丑: ['子'], 寅: ['丑'], 卯: ['寅'], 辰: ['卯'], 巳: ['辰'], 午: ['巳'], 未: ['午'], 申: ['未'], 酉: ['申'], 戌: ['酉'], 亥: ['戌'] },
	孤辰: { 子: ['寅'], 丑: ['寅'], 寅: ['巳'], 卯: ['巳'], 辰: ['巳'], 巳: ['申'], 午: ['申'], 未: ['申'], 申: ['亥'], 酉: ['亥'], 戌: ['亥'], 亥: ['寅'] },
	寡宿: { 子: ['戌'], 丑: ['戌'], 寅: ['丑'], 卯: ['丑'], 辰: ['丑'], 巳: ['辰'], 午: ['辰'], 未: ['辰'], 申: ['未'], 酉: ['未'], 戌: ['未'], 亥: ['戌'] },
	丧门: { 子: ['寅'], 丑: ['卯'], 寅: ['辰'], 卯: ['巳'], 辰: ['午'], 巳: ['未'], 午: ['申'], 未: ['酉'], 申: ['戌'], 酉: ['亥'], 戌: ['子'], 亥: ['丑'] },
	吊客: { 子: ['戌'], 丑: ['亥'], 寅: ['子'], 卯: ['丑'], 辰: ['寅'], 巳: ['卯'], 午: ['辰'], 未: ['巳'], 申: ['午'], 酉: ['未'], 戌: ['申'], 亥: ['酉'] },
};

function normalizeNum(v, defVal = 0){
	const n = parseInt(v, 10);
	return Number.isNaN(n) ? defVal : n;
}

function normalizeTimeAlg(v){
	return v === 1 ? 1 : 0;
}

function normalizeShiftPalace(v){
	const n = normalizeNum(v, 0);
	if(n < 0){
		return 0;
	}
	if(n > 7){
		return n % 8;
	}
	return n;
}

function normalizeText(s){
	if(!s){
		return '';
	}
	return `${s}`
		.replace(/穀/g, '谷')
		.replace(/滿/g, '满')
		.replace(/種/g, '种')
		.replace(/蟄/g, '蛰')
		.replace(/驚/g, '惊')
		.replace(/處/g, '处')
		.replace(/陰/g, '阴')
		.replace(/陽/g, '阳')
		.replace(/傷/g, '伤')
		.replace(/開/g, '开')
		.replace(/沖/g, '冲')
		.replace(/輔/g, '辅')
		.replace(/離/g, '离')
		.replace(/兌/g, '兑')
		.replace(/乾/g, '乾')
		.trim();
}

function normalizeGanZhi(gz){
	const t = normalizeText(gz);
	return t.substring(0, 2);
}

function normalizeJieqi(jieqi){
	return normalizeText(jieqi).substring(0, 2);
}

function getOptionLabel(list, value){
	const one = list.find((item)=>item.value === value);
	return one ? one.label : `${value}`;
}

function getGanzhiGan(gz){
	return normalizeGanZhi(gz).substring(0, 1);
}

function getGanzhiZhi(gz){
	return normalizeGanZhi(gz).substring(1, 2);
}

function parseDateTime(fields){
	if(!fields || !fields.date || !fields.time){
		return null;
	}
	const dateStr = fields.date.value.format('YYYY-MM-DD');
	const timeStr = fields.time.value.format('HH:mm:ss');
	const dparts = dateStr.split('-');
	const tparts = timeStr.split(':');
	if(dparts.length < 3 || tparts.length < 2){
		return null;
	}
	const year = normalizeNum(dparts[0], 0);
	const month = normalizeNum(dparts[1], 1);
	const day = normalizeNum(dparts[2], 1);
	const hour = normalizeNum(tparts[0], 0);
	const minute = normalizeNum(tparts[1], 0);
	const second = normalizeNum(tparts[2], 0);
	return {
		year,
		month,
		day,
		hour,
		minute,
		second,
		dateStr,
		timeStr,
	};
}

function parseBirthDateTimeParts(birthText){
	const txt = `${birthText || ''}`.trim();
	if(!txt){
		return null;
	}
	const matched = txt.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
	if(!matched){
		return null;
	}
	const year = normalizeNum(matched[1], 0);
	const month = normalizeNum(matched[2], 1);
	const day = normalizeNum(matched[3], 1);
	const hour = normalizeNum(matched[4], 0);
	const minute = normalizeNum(matched[5], 0);
	const second = normalizeNum(matched[6], 0);
	const pad2 = (n)=>`${n}`.padStart(2, '0');
	return {
		year,
		month,
		day,
		hour,
		minute,
		second,
		dateStr: `${year}-${pad2(month)}-${pad2(day)}`,
		timeStr: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
	};
}

function resolveQimenDateParts(dateParts, nongli, timeAlg){
	if(normalizeTimeAlg(timeAlg) !== 0){
		return dateParts;
	}
	const birthParts = parseBirthDateTimeParts(nongli && nongli.birth ? nongli.birth : '');
	return birthParts || dateParts;
}

function newList(list, start){
	const idx = list.indexOf(start);
	if(idx < 0){
		throw new Error(`start.not.found:${start}`);
	}
	return [...list.slice(idx), ...list.slice(0, idx)];
}

function newListR(list, start){
	const idx = list.indexOf(start);
	if(idx < 0){
		throw new Error(`start.not.found:${start}`);
	}
	const out = [];
	let p = idx;
	for(let i=0; i<list.length; i++){
		out.push(list[(p + list.length) % list.length]);
		p -= 1;
	}
	return out;
}

function zipToMap(keys, vals){
	const out = {};
	for(let i=0; i<keys.length; i++){
		out[keys[i]] = vals[i];
	}
	return out;
}

function invertMap(mapObj){
	const out = {};
	Object.keys(mapObj || {}).forEach((k)=>{
		out[mapObj[k]] = k;
	});
	return out;
}

function getGanzhiIndex(gz){
	const key = normalizeGanZhi(gz);
	const idx = GANZHI_INDEX_MAP[key];
	return idx >= 0 ? idx : 0;
}

function getXunHead(gz){
	const idx = getGanzhiIndex(gz);
	return JIAZI[Math.floor(idx / 10) * 10] || '甲子';
}

function nextGanZhi(gz){
	const idx = getGanzhiIndex(gz);
	return JIAZI[(idx + 1) % 60];
}

function prevGanZhi(gz){
	const idx = getGanzhiIndex(gz);
	return JIAZI[(idx + 59) % 60];
}

function getHourBranch(hour){
	if(hour === 23 || hour === 0){
		return '子';
	}
	const idx = Math.floor((hour + 1) / 2) % 12;
	return ZHI[idx];
}

function getHourGanZhi(dayGanZhi, hour){
	const dayGan = normalizeGanZhi(dayGanZhi).substring(0, 1);
	const branch = getHourBranch(hour);
	const startGan = (function getStartGan(){
		if('甲己'.includes(dayGan)) return '甲';
		if('乙庚'.includes(dayGan)) return '丙';
		if('丙辛'.includes(dayGan)) return '戊';
		if('丁壬'.includes(dayGan)) return '庚';
		return '壬';
	})();
	const ganIdx = GAN.indexOf(startGan);
	const zhiIdx = ZHI.indexOf(branch);
	return `${GAN[(ganIdx + zhiIdx) % 10]}${branch}`;
}

function getCurrentJieqi(nongli){
	const jq = normalizeJieqi(nongli && nongli.jieqi ? nongli.jieqi : '');
	if(jq){
		return jq;
	}
	const delta = `${(nongli && nongli.jiedelta) || ''}`;
	const idxAfter = delta.indexOf('后第');
	if(idxAfter > 0){
		return normalizeJieqi(delta.substring(0, idxAfter));
	}
	const idxBefore = delta.indexOf('前第');
	if(idxBefore > 0){
		return normalizeJieqi(delta.substring(0, idxBefore));
	}
	return '';
}

function resolveFuTouByBacktrack(dayGanZhi){
	let current = normalizeGanZhi(dayGanZhi || '甲子');
	for(let i=0; i<60; i++){
		if(SAN_YUAN_FU_TOU_SET.has(current)){
			return current;
		}
		current = prevGanZhi(current);
	}
	return getXunHead(dayGanZhi || '甲子');
}

function findYuan(dayGanZhi){
	const idx = getGanzhiIndex(dayGanZhi) % 15;
	if(idx < 5){
		return '上元';
	}
	if(idx < 10){
		return '中元';
	}
	return '下元';
}

function qimenJuNameChaibu(jieqi, dayGanZhi){
	const jq = normalizeJieqi(jieqi);
	const yy = YANG_JIEQI.includes(jq) ? '阳遁' : '阴遁';
	const yuan = findYuan(dayGanZhi);
	const code = JIEQI_CODE[jq] || '一七四';
	const yuanIdx = yuan === '上元' ? 0 : (yuan === '中元' ? 1 : 2);
	return `${yy}${code[yuanIdx]}局${yuan}`;
}

function juNumberToCn(num){
	const idx = Math.min(9, Math.max(1, normalizeNum(num, 1))) - 1;
	return CNUMBER[idx];
}

function buildQmjuByMeta(yinYangDun, juShu, sanYuan){
	const yy = `${yinYangDun || ''}`.indexOf('阴') >= 0 ? '阴遁' : '阳遁';
	return `${yy}${juNumberToCn(juShu)}局${sanYuan || '上元'}`;
}

function isYangDunJieqi(jieqi){
	return YANG_JIEQI.indexOf(normalizeJieqi(jieqi)) >= 0;
}

function calcYearJiaMeta(year){
	if(year >= 0 && year <= 3){
		return { sanYuan: '中元', juShu: 4, yinYangDun: '阴遁' };
	}
	const cycle = ((Math.floor((year - 4) / 60) % 3) + 3) % 3;
	if(cycle === 0){
		return { sanYuan: '下元', juShu: 7, yinYangDun: '阴遁' };
	}
	if(cycle === 1){
		return { sanYuan: '上元', juShu: 1, yinYangDun: '阴遁' };
	}
	return { sanYuan: '中元', juShu: 4, yinYangDun: '阴遁' };
}

function calcYueJiaMeta(ganzhi, yueJiaQiJuType){
	let zhi = getGanzhiZhi(ganzhi.year || '');
	if(normalizeNum(yueJiaQiJuType, 1) === 1){
		zhi = getGanzhiZhi(getXunHead(ganzhi.year || '甲子'));
	}
	if('寅申巳亥'.indexOf(zhi) >= 0){
		return { sanYuan: '上元', juShu: 1, yinYangDun: '阴遁' };
	}
	if('子午卯酉'.indexOf(zhi) >= 0){
		return { sanYuan: '中元', juShu: 7, yinYangDun: '阴遁' };
	}
	return { sanYuan: '下元', juShu: 4, yinYangDun: '阴遁' };
}

function calcDayJiaMeta(dateParts, dayGanZhi, jieqi){
	const dayDate = new Date(dateParts.year, dateParts.month - 1, dateParts.day);
	const firstDate = new Date(dateParts.year, 0, 1);
	const dayOfYear = Math.floor((dayDate.getTime() - firstDate.getTime()) / 86400000) + 1;
	let juShu = 6;
	if(dayOfYear <= 60){
		juShu = 1;
	}else if(dayOfYear <= 120){
		juShu = 7;
	}else if(dayOfYear <= 180){
		juShu = 4;
	}else if(dayOfYear <= 240){
		juShu = 9;
	}else if(dayOfYear <= 300){
		juShu = 3;
	}
	return {
		sanYuan: findYuan(dayGanZhi),
		juShu,
		yinYangDun: isYangDunJieqi(jieqi) ? '阳遁' : '阴遁',
	};
}

function calcShiJiaMeta(dayGanZhi, jieqi){
	const sanYuan = findYuan(dayGanZhi);
	const code = JIEQI_CODE[normalizeJieqi(jieqi)] || '一七四';
	const yuanIdx = sanYuan === '上元' ? 0 : (sanYuan === '中元' ? 1 : 2);
	const juShu = CNUMBER.indexOf(code[yuanIdx]) + 1;
	return {
		sanYuan,
		juShu: juShu > 0 ? juShu : 1,
		yinYangDun: isYangDunJieqi(jieqi) ? '阳遁' : '阴遁',
	};
}

function normalizeQijuMethod(method){
	return method === 'zhirun' ? 'zhirun' : 'chaibu';
}

function resolvePaiPanMeta(opts, ganzhi, jieqi, dateParts, context){
	const paiPanType = normalizeNum(opts && opts.paiPanType, 3);
	if(paiPanType === 0){
		return calcYearJiaMeta(dateParts.year);
	}
	if(paiPanType === 1){
		return calcYueJiaMeta(ganzhi, opts && opts.yueJiaQiJuType);
	}
	if(paiPanType === 2){
		return calcDayJiaMeta(dateParts, ganzhi.day, jieqi);
	}
	const base = calcShiJiaMeta(ganzhi.day, jieqi);
	if(normalizeQijuMethod(opts && opts.qijuMethod) === 'zhirun'){
		const qmju = qimenJuNameZhirun(dateParts, ganzhi.day, context && context.jieqiYearSeeds ? context.jieqiYearSeeds : {}, jieqi);
		const parsed = parseQmju(qmju);
		return {
			sanYuan: parsed.yuan,
			juShu: CNUMBER.indexOf(parsed.kook) + 1,
			yinYangDun: parsed.yy === '阴' ? '阴遁' : '阳遁',
			qmju,
		};
	}
	const qmju = qimenJuNameChaibu(jieqi, ganzhi.day);
	const parsed = parseQmju(qmju);
	return {
		sanYuan: parsed.yuan,
		juShu: CNUMBER.indexOf(parsed.kook) + 1,
		yinYangDun: parsed.yy === '阴' ? '阴遁' : '阳遁',
		qmju,
	};
}

function resolveSpecialZhiShi(zhiShiType, yinYangDun, jieqi){
	const type = normalizeNum(zhiShiType, 0);
	if(type === 1){
		return yinYangDun === '阳遁' ? '生' : '死';
	}
	if(type === 2){
		const jq = normalizeJieqi(jieqi);
		for(let i=0; i<ZHISHI_BY_JIEQI.length; i++){
			if(ZHISHI_BY_JIEQI[i].list.indexOf(jq) >= 0){
				return ZHISHI_BY_JIEQI[i].door;
			}
		}
	}
	return '死';
}

function parseQmju(qmju){
	const text = normalizeText(qmju);
	const yy = text.includes('阴遁') ? '阴' : '阳';
	const kook = (text.match(/[一二三四五六七八九]/) || ['一'])[0];
	const yuan = text.includes('上元') ? '上元' : (text.includes('中元') ? '中元' : '下元');
	return { text, yy, kook, yuan };
}

function buildGanzhiForQimen(nongli, dateParts){
	const dayFromNongli = normalizeGanZhi(nongli ? nongli.dayGanZi : '');
	let day = dayFromNongli || '甲子';
	if(!dayFromNongli && dateParts.hour === 23){
		day = nextGanZhi(day);
	}
	let time = normalizeGanZhi(nongli ? nongli.time : '');
	if(!time){
		time = getHourGanZhi(day, dateParts.hour);
	}
	return {
		year: normalizeGanZhi(nongli ? (nongli.yearJieqi || nongli.year) : ''),
		month: normalizeGanZhi(nongli ? nongli.monthGanZi : ''),
		day,
		time,
	};
}

function daykongShikong(dayGanZhi, hourGanZhi){
	const dk = getXunHead(dayGanZhi);
	const sk = getXunHead(hourGanZhi);
	return {
		日空: GUXU[dk] || '戌亥',
		时空: GUXU[sk] || '戌亥',
	};
}

function zhifuPai(qmju){
	const meta = parseQmju(qmju);
	const table = {
		阳: {
			一: '九八七一二三四五六',
			二: '一九八二三四五六七',
			三: '二一九三四五六七八',
			四: '三二一四五六七八九',
			五: '四三二五六七八九一',
			六: '五四三六七八九一二',
			七: '六五四七八九一二三',
			八: '七六五八九一二三四',
			九: '八七六九一二三四五',
		},
		阴: {
			九: '一二三九八七六五四',
			八: '九一二八七六五四三',
			七: '八九一七六五四三二',
			六: '七八九六五四三二一',
			五: '六七八五四三二一九',
			四: '五六七四三二一九八',
			三: '四五六三二一九八七',
			二: '三四五二一九八七六',
			一: '二三四一九八七六五',
		},
	};
	const pai = table[meta.yy][meta.kook];
	const yinlist = newListR(CNUMBER, meta.kook).slice(0, 6).map((x)=>x + pai);
	const yanglist = newList(CNUMBER, meta.kook).slice(0, 6).map((x)=>x + pai);
	return meta.yy === '阴' ? zipToMap(XUN_HEADS, yinlist) : zipToMap(XUN_HEADS, yanglist);
}

function zhishiPai(qmju){
	const meta = parseQmju(qmju);
	const newKook = newList(CNUMBER, meta.kook);
	const newRKook = newListR(CNUMBER, meta.kook);
	const yanglist = `${newKook.join('')}${newKook.join('')}${newKook.join('')}`;
	const yinlist = `${newRKook.join('')}${newRKook.join('')}${newRKook.join('')}`;
	const yinlist1 = newRKook.slice(0, 6).map((i)=>`${i}${yinlist.slice(yinlist.indexOf(i) + 1, yinlist.indexOf(i) + 12)}`);
	const yanglist1 = newKook.slice(0, 6).map((i)=>`${i}${yanglist.slice(yanglist.indexOf(i) + 1, yanglist.indexOf(i) + 12)}`);
	return meta.yy === '阴' ? zipToMap(XUN_HEADS, yinlist1) : zipToMap(XUN_HEADS, yanglist1);
}

function zhifuNZhishi(ganzhi, qmju, ext){
	const gongsCode = zipToMap(CNUMBER, EIGHT_GUA);
	const hgan = GAN.indexOf(ganzhi.time.substring(0, 1));
	const chour = getXunHead(ganzhi.time);
	const eg = '休死伤杜中开惊生景'.split('');
	const zspai = zhishiPai(qmju);
	const zfpai = zhifuPai(qmju);
	const zspaiKeys = Object.keys(zspai);
	const zspaiValues = Object.values(zspai);
	const zfKeys = Object.keys(zfpai);
	const zfValues = Object.values(zfpai);

	const a = zspaiValues.map((i)=>zipToMap(CNUMBER, eg)[i.substring(0, 1)]);
	const b = zfValues.map((i)=>zipToMap(CNUMBER, JIU_XING)[i.substring(0, 1)]);
	const c = zfValues.map((i)=>gongsCode[i.substring(hgan, hgan + 1)]);
	const d = zspaiValues.map((i)=>gongsCode[i.substring(hgan, hgan + 1)]);

	const star = zipToMap(zfKeys, b)[chour];
	const starGong = zipToMap(zfKeys, c)[chour];
	let door = zipToMap(zspaiKeys, a)[chour];
	// 仅“值符星=禽”时按天禽值符规则处理；值符落中宫并不等于天禽值符。
	const isTianQinAsZhiFu = star === '禽';
	if(isTianQinAsZhiFu){
		door = resolveSpecialZhiShi(ext && ext.zhiShiType, ext && ext.yinYangDun, ext && ext.jieqi);
	}else if(door === '中'){
		door = '死';
	}
	return {
		值符天干: [chour, JJ[chour]],
		值符星宫: [star, starGong],
		值使门宫: [door, zipToMap(zspaiKeys, d)[chour]],
	};
}

function panEarth(qmju){
	const meta = parseQmju(qmju);
	const palaces = newList(CNUMBER, meta.kook).map((x)=>zipToMap(CNUMBER, EIGHT_GUA)[x]);
	const vals = meta.yy === '阳' ? '戊己庚辛壬癸丁丙乙'.split('') : '戊乙丙丁癸壬辛庚己'.split('');
	return zipToMap(palaces, vals);
}

function panGod(ganzhi, qmju){
	const zfzs = zhifuNZhishi(ganzhi, qmju);
	const meta = parseQmju(qmju);
	const startingGong = zfzs.值符星宫[1];
	const rotate = meta.yy === '阳' ? CLOCKWISE_EIGHTGUA : [...CLOCKWISE_EIGHTGUA].reverse();
	const gongReorder = startingGong === '中' ? newList(rotate, '坤') : newList(rotate, startingGong);
	const vals = (meta.yy === '阳' ? '符蛇阴合勾雀地天' : '符蛇阴合虎玄地天').split('');
	const out = zipToMap(gongReorder, vals);
	Object.keys(out).forEach((k)=>{
		out[k] = out[k].replace(/勾/g, '虎').replace(/雀/g, '玄');
	});
	return out;
}

function panDoor(ganzhi, qmju){
	const zfzs = zhifuNZhishi(ganzhi, qmju);
	const meta = parseQmju(qmju);
	const startingDoor = zfzs.值使门宫[0];
	const startingGong = zfzs.值使门宫[1];
	const rotate = meta.yy === '阳' ? CLOCKWISE_EIGHTGUA : [...CLOCKWISE_EIGHTGUA].reverse();
	const gongReorder = startingGong === '中' ? newList(rotate, '坤') : newList(rotate, startingGong);
	const yydoor = meta.yy === '阳' ? newList(DOOR_R, startingDoor) : newList([...DOOR_R].reverse(), startingDoor);
	return zipToMap(gongReorder, yydoor);
}

function panStar(ganzhi, qmju){
	const zfzs = zhifuNZhishi(ganzhi, qmju);
	const meta = parseQmju(qmju);
	const startingStar = zfzs.值符星宫[0].replace(/芮/g, '禽');
	const startingGong = zfzs.值符星宫[1];
	const rotate = meta.yy === '阳' ? CLOCKWISE_EIGHTGUA : [...CLOCKWISE_EIGHTGUA].reverse();
	const stars = meta.yy === '阳' ? newList(STAR_R, startingStar) : newList([...STAR_R].reverse(), startingStar);
	const gongReorder = startingGong === '中' ? newList(rotate, '坤') : newList(rotate, startingGong);
	const out = zipToMap(gongReorder, stars);
	Object.keys(out).forEach((k)=>{
		out[k] = out[k].replace(/禽/g, '芮');
	});
	return out;
}

function panSky(ganzhi, qmju){
	const meta = parseQmju(qmju);
	const rotate = meta.yy === '阳' ? CLOCKWISE_EIGHTGUA : [...CLOCKWISE_EIGHTGUA].reverse();
	const earth = panEarth(qmju);
	const earthR = invertMap(earth);
	const zfzs = zhifuNZhishi(ganzhi, qmju);
	const fuHead = JJ[getXunHead(ganzhi.time)] || '戊';
	const fuLocation = earthR[ganzhi.time.substring(0, 1)];
	const fuHeadLocation = zfzs.值符星宫[1];
	const fuHeadLocation2 = earthR[fuHead];
	const ganHead = zfzs.值符天干[1];
	const zhifu = zfzs.值符星宫[0].replace(/芮/g, '禽');

	let a = rotate.map((g)=>earth[g]);
	let startGong = fuHeadLocation === '中' ? '坤' : fuHeadLocation;
	if(startGong !== '坤' && rotate.indexOf(startGong) < 0){
		startGong = '坤';
	}
	let startGan = fuHead;
	if(a.indexOf(startGan) < 0){
		startGan = ganHead && a.indexOf(ganHead) >= 0 ? ganHead : earth[startGong];
	}

	if(fuHeadLocation !== '中' && zhifu !== '禽' && fuHeadLocation2 === '中'){
		startGan = earth[startGong] || startGan;
	}
	if(fuLocation === undefined || fuLocation === null){
		startGan = earth[startGong] || startGan;
	}

	const ganReorder = newList(a, startGan);
	const gongReorder = newList(rotate, startGong);
	const out = zipToMap(gongReorder, ganReorder);
	out.中 = earth.中;
	return out;
}

function convertGuaMapToPos(mapObj){
	const out = {};
	Object.keys(POS_GUA_MAP).forEach((k)=>{
		out[k] = '';
	});
	Object.keys(mapObj || {}).forEach((gua)=>{
		const pos = GUA_POS_MAP[gua];
		if(pos){
			out[pos] = mapObj[gua] || '';
		}
	});
	return out;
}

function getKongByMode(mode, dayShiKong){
	return mode === 'time' ? (dayShiKong.时空 || '') : (dayShiKong.日空 || '');
}

function resolveKongWangPalaces(kongWang){
	const list = [];
	const palaces = [];
	const a = kongWang.substring(0, 1);
	const b = kongWang.substring(1, 2);
	[a, b].forEach((zhi)=>{
		const pos = BRANCH_TO_POS[zhi];
		if(pos && palaces.indexOf(pos) < 0){
			palaces.push(pos);
			list.push(`${PALACE_NAME[pos]}${pos}宫空亡`);
		}
	});
	return { list, palaces };
}

function getYiMaZhi(sourceZhi){
	if('申子辰'.indexOf(sourceZhi) >= 0){
		return '寅';
	}
	if('寅午戌'.indexOf(sourceZhi) >= 0){
		return '申';
	}
	if('巳酉丑'.indexOf(sourceZhi) >= 0){
		return '亥';
	}
	if('亥卯未'.indexOf(sourceZhi) >= 0){
		return '巳';
	}
	return '';
}

function resolveYiMa(mode, ganzhi){
	const source = mode === 'time' ? (ganzhi.time || '') : (ganzhi.day || '');
	const sourceZhi = source.substring(1, 2);
	const yimaZhi = getYiMaZhi(sourceZhi);
	const palace = BRANCH_TO_POS[yimaZhi] || 0;
	return {
		mode,
		source,
		sourceZhi,
		yimaZhi,
		palace,
		text: palace ? `${mode === 'time' ? '时马' : '日马'}：${yimaZhi}（${PALACE_NAME[palace]}${palace}宫）` : `${mode === 'time' ? '时马' : '日马'}：无`,
	};
}

function resolveSpecials(tianPan){
	const liuYi = [];
	const ruMu = [];
	const jiXingSet = new Set();
	const ruMuSet = new Set();
	for(let i=1; i<=9; i++){
		const gan = tianPan[i] || '';
		const jiRule = JI_XING_RULE[i] || '';
		const ruRule = RU_MU_RULE[i] || '';
		if(gan && jiRule && jiRule.indexOf(gan) >= 0){
			jiXingSet.add(i);
			liuYi.push(`${gan}击刑（${PALACE_NAME[i]}${i}宫）`);
		}
		if(gan && ruRule && ruRule.indexOf(gan) >= 0){
			ruMuSet.add(i);
			ruMu.push(`${gan}入墓（${PALACE_NAME[i]}${i}宫）`);
		}
	}
	return {
		liuYi,
		ruMu,
		jiXingPalaces: [...jiXingSet],
		ruMuPalaces: [...ruMuSet],
	};
}

function resolveMenPo(men){
	const list = [];
	const palaces = [];
	Object.keys(MEN_PO_RULE).forEach((k)=>{
		const i = parseInt(k, 10);
		const door = men[i] || '';
		const head = door.substring(0, 1);
		if(head && MEN_PO_RULE[i].indexOf(head) >= 0){
			palaces.push(i);
			list.push(`${head}门迫（${PALACE_NAME[i]}${i}宫）`);
		}
	});
	return { list, palaces };
}

function mapListByPos(mapObj){
	const out = [];
	for(let i=1; i<=9; i++){
		out.push(mapObj[i] || '');
	}
	return out;
}

function rotateOuterMapByShift(mapObj, shiftPalace){
	const step = normalizeShiftPalace(shiftPalace);
	const out = {};
	for(let i=1; i<=9; i++){
		out[i] = mapObj && mapObj[i] ? mapObj[i] : '';
	}
	if(step === 0){
		return out;
	}
	for(let i=0; i<OUTER_RING_CLOCKWISE.length; i++){
		const srcPalace = OUTER_RING_CLOCKWISE[i];
		const destPalace = OUTER_RING_CLOCKWISE[(i + step) % OUTER_RING_CLOCKWISE.length];
		out[destPalace] = mapObj && mapObj[srcPalace] ? mapObj[srcPalace] : '';
	}
	out[5] = mapObj && mapObj[5] ? mapObj[5] : '';
	return out;
}

function rotateOuterPalaceNum(palaceNum, shiftPalace){
	const step = normalizeShiftPalace(shiftPalace);
	if(step === 0 || palaceNum === 5){
		return palaceNum;
	}
	const idx = OUTER_RING_CLOCKWISE.indexOf(palaceNum);
	if(idx < 0){
		return palaceNum;
	}
	return OUTER_RING_CLOCKWISE[(idx + step) % OUTER_RING_CLOCKWISE.length];
}

function normalizeQimenGan(gan){
	if(!gan){
		return '';
	}
	return gan === '甲' ? '戊' : gan;
}

function buildTenGanResponse(tianGan, diGan){
	if(!tianGan || !diGan){
		return '';
	}
	const key = `${normalizeQimenGan(tianGan)}${normalizeQimenGan(diGan)}`;
	const body = TEN_GAN_RESPONSE_MAP[key];
	if(body){
		return `天${tianGan}加地${diGan}：${body}`;
	}
	return '';
}

function buildDoorBaseResponse(doorHead, baseDoor){
	if(!doorHead || !baseDoor){
		return '';
	}
	const key = `${doorHead}${baseDoor}`;
	const reverseKey = `${baseDoor}${doorHead}`;
	const body = DOOR_BASE_RESPONSE_MAP[key] || DOOR_BASE_RESPONSE_MAP[reverseKey];
	if(body){
		return `人${doorHead}加地${baseDoor}：${body}`;
	}
	return '';
}

function buildDoorGanResponse(doorHead, tianGan){
	if(!doorHead || !tianGan){
		return '';
	}
	const key = `${doorHead}${normalizeQimenGan(tianGan)}`;
	const body = DOOR_GAN_RESPONSE_MAP[key];
	if(body){
		return `人${doorHead}加天${tianGan}：${body}`;
	}
	return '';
}

function evaluateCellPatterns(cell, ctx){
	const jiSet = new Set();
	const xiongSet = new Set();
	QIMEN_JI_RULES.forEach((rule)=>{
		if(rule && typeof rule.when === 'function' && rule.when(cell, ctx)){
			const label = appendQimenPatternExplanation(rule.name);
			if(label){
				jiSet.add(label);
			}
		}
	});
	QIMEN_XIONG_RULES.forEach((rule)=>{
		if(rule && typeof rule.when === 'function' && rule.when(cell, ctx)){
			const label = appendQimenPatternExplanation(rule.name);
			if(label){
				xiongSet.add(label);
			}
		}
	});
	return { ji: [...jiSet], xiong: [...xiongSet] };
}

function collectPatternSummary(cells){
	const jiSet = new Set();
	const xiongSet = new Set();
	(cells || []).forEach((cell)=>{
		(cell.jiPatterns || []).forEach((name)=>jiSet.add(name));
		(cell.xiongPatterns || []).forEach((name)=>xiongSet.add(name));
	});
	return {
		ji: [...jiSet],
		xiong: [...xiongSet],
	};
}

function buildCells(diPan, tianPan, men, shen, star, zhiFuPalace, zhiShiPalace, status){
	const jiXingSet = new Set(status && status.jiXingPalaces ? status.jiXingPalaces : []);
	const ruMuSet = new Set(status && status.ruMuPalaces ? status.ruMuPalaces : []);
	const menPoSet = new Set(status && status.menPoPalaces ? status.menPoPalaces : []);
	const kongSet = new Set(status && status.kongWangPalaces ? status.kongWangPalaces : []);
	const yimaPalace = status && status.yimaPalace ? status.yimaPalace : 0;
	const dayGan = status && status.dayGan ? status.dayGan : '';
	const monthGan = status && status.monthGan ? status.monthGan : '';
	const yearGan = status && status.yearGan ? status.yearGan : '';
	const timeGan = status && status.timeGan ? status.timeGan : '';
	const timeGanzhi = status && status.timeGanzhi ? status.timeGanzhi : '';
	const isFiveBuYuShiFlag = status && status.isFiveBuYuShi === true;
	const isTianFuShiFlag = status && status.isTianFuShi === true;

	return PALACE_GRID.map((palaceNum)=>{
		const tianGanNow = tianPan[palaceNum] || '';
		const diGanNow = diPan[palaceNum] || '';
		const doorNow = men[palaceNum] || '';
		const doorHead = doorNow.substring(0, 1);
		const baseDoor = PALACE_BASE_DOOR[palaceNum] || '';
		const cell = {
			palaceNum,
			palaceName: PALACE_NAME[palaceNum] || `${palaceNum}`,
			diGan: diGanNow,
			tianXing: star[palaceNum] || '',
			door: doorNow,
			doorHead,
			baseDoor,
			god: shen[palaceNum] || '',
			tianGan: tianGanNow,
			isCenter: palaceNum === 5,
			isZhiFu: palaceNum === zhiFuPalace,
			isZhiShi: palaceNum === zhiShiPalace,
			hasJiXing: jiXingSet.has(palaceNum),
			hasRuMu: ruMuSet.has(palaceNum),
			hasMenPo: menPoSet.has(palaceNum),
			hasKongWang: kongSet.has(palaceNum),
			isYiMa: palaceNum === yimaPalace,
		};
		const patterns = evaluateCellPatterns(cell, {
			yearGan,
			monthGan,
			dayGan,
			timeGan,
			timeGanzhi,
			isFiveBuYuShi: isFiveBuYuShiFlag,
			isTianFuShi: isTianFuShiFlag,
		});
		cell.jiPatterns = patterns.ji;
		cell.xiongPatterns = patterns.xiong;
		cell.tenGanResponse = buildTenGanResponse(tianGanNow, diGanNow);
		cell.doorBaseResponse = buildDoorBaseResponse(doorHead, baseDoor);
		cell.doorGanResponse = buildDoorGanResponse(doorHead, tianGanNow);
		return cell;
	});
}

function parseDayFromTime(timeStr){
	if(!timeStr){
		return '';
	}
	const t = `${timeStr}`.trim();
	if(t.length < 10){
		return '';
	}
	return t.substring(0, 10).replace(/-/g, '');
}

function keyToUtcDay(key){
	if(!key || key.length !== 8){
		return NaN;
	}
	const y = normalizeNum(key.substring(0, 4), 0);
	const m = normalizeNum(key.substring(4, 6), 1);
	const d = normalizeNum(key.substring(6, 8), 1);
	return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function utcDayToKey(daynum){
	const dt = new Date(daynum * 86400000);
	const y = dt.getUTCFullYear();
	const m = `${dt.getUTCMonth() + 1}`.padStart(2, '0');
	const d = `${dt.getUTCDate()}`.padStart(2, '0');
	return `${y}${m}${d}`;
}

export function buildJieqiYearSeed(result){
	const seed = {};
	const list = result && result.jieqi24 ? result.jieqi24 : [];
	list.forEach((item)=>{
		const jq = normalizeJieqi(item && item.jieqi ? item.jieqi : '');
		if(!jq){
			return;
		}
		const time = item && item.time ? `${item.time}` : '';
		const dayGanzhi = normalizeGanZhi(item && item.bazi && item.bazi.fourColumns && item.bazi.fourColumns.day ? item.bazi.fourColumns.day.ganzi : '');
		seed[jq] = {
			term: jq,
			time,
			dateKey: parseDayFromTime(time),
			dayGanzhi,
		};
	});
	return seed;
}

function nextJieqi(name){
	const idx = JIEQI_NAME.indexOf(name);
	if(idx < 0){
		return '冬至';
	}
	return JIEQI_NAME[(idx + 1) % JIEQI_NAME.length];
}

function buildYinyangdunMap(year, yearSeeds){
	const prev = yearSeeds ? yearSeeds[year - 1] : null;
	const curr = yearSeeds ? yearSeeds[year] : null;
	if(!prev || !curr || !prev.大雪 || !curr.芒种 || !curr.大雪){
		return null;
	}
	const seedSig = [
		year,
		prev.大雪.dateKey || '',
		prev.大雪.dayGanzhi || '',
		curr.芒种.dateKey || '',
		curr.芒种.dayGanzhi || '',
		curr.大雪.dateKey || '',
		curr.大雪.dayGanzhi || '',
	].join('|');
	if(YINYANGDUN_CACHE.has(seedSig)){
		return YINYANGDUN_CACHE.get(seedSig);
	}
	const ret = {};

	const daxueStart = prev.大雪.dateKey;
	const daxueRizhu = normalizeGanZhi(prev.大雪.dayGanzhi || '甲子');
	let daxueIndex = getGanzhiIndex(daxueRizhu);
	let futouIndex = Math.floor(daxueIndex / 15) * 15;
	let tday = keyToUtcDay(daxueStart);
	let rizhuIndex = daxueIndex;

	for(let i=daxueIndex; i<futouIndex + 15; i++){
		ret[utcDayToKey(tday)] = `大雪${JIAZI[rizhuIndex]}`;
		tday += 1;
		rizhuIndex = (rizhuIndex + 1) % 60;
	}

	let jieqiCur = '冬至';
	if(daxueIndex - futouIndex >= 9){
		jieqiCur = '大雪';
	}

	let jieqiDays = 0;
	let mangzhongDay = null;
	for(let i=0; i<300; i++){
		ret[utcDayToKey(tday)] = `${jieqiCur}${JIAZI[rizhuIndex]}`;
		tday += 1;
		rizhuIndex = (rizhuIndex + 1) % 60;
		jieqiDays += 1;
		if(jieqiDays === 15){
			jieqiDays = 0;
			jieqiCur = nextJieqi(jieqiCur);
			if(jieqiCur === '芒种'){
				mangzhongDay = tday;
				for(let j=0; j<15; j++){
					ret[utcDayToKey(tday)] = `${jieqiCur}${JIAZI[rizhuIndex]}`;
					tday += 1;
					rizhuIndex = (rizhuIndex + 1) % 60;
				}
				break;
			}
		}
	}

	const mangzhongStartDay = keyToUtcDay(curr.芒种.dateKey);
	jieqiCur = '夏至';
	if(Number.isFinite(mangzhongStartDay) && mangzhongDay !== null && mangzhongStartDay > mangzhongDay + 9){
		jieqiCur = '芒种';
	}

	jieqiDays = 0;
	let daxueDay = null;
	for(let i=0; i<300; i++){
		ret[utcDayToKey(tday)] = `${jieqiCur}${JIAZI[rizhuIndex]}`;
		tday += 1;
		rizhuIndex = (rizhuIndex + 1) % 60;
		jieqiDays += 1;
		if(jieqiDays === 15){
			jieqiDays = 0;
			jieqiCur = nextJieqi(jieqiCur);
			if(jieqiCur === '大雪'){
				daxueDay = tday;
				for(let j=0; j<15; j++){
					ret[utcDayToKey(tday)] = `${jieqiCur}${JIAZI[rizhuIndex]}`;
					tday += 1;
					rizhuIndex = (rizhuIndex + 1) % 60;
				}
				break;
			}
		}
	}

	const daxueStartDay = keyToUtcDay(curr.大雪.dateKey);
	jieqiCur = '冬至';
	if(Number.isFinite(daxueStartDay) && daxueDay !== null && daxueStartDay > daxueDay + 9){
		jieqiCur = '大雪';
	}

	jieqiDays = 0;
	for(let i=0; i<300; i++){
		ret[utcDayToKey(tday)] = `${jieqiCur}${JIAZI[rizhuIndex]}`;
		tday += 1;
		rizhuIndex = (rizhuIndex + 1) % 60;
		jieqiDays += 1;
		if(jieqiDays === 15){
			jieqiDays = 0;
			jieqiCur = nextJieqi(jieqiCur);
			if(jieqiCur === '立春'){
				ret[utcDayToKey(tday)] = `${jieqiCur}${JIAZI[rizhuIndex]}`;
				break;
			}
		}
	}
	if(YINYANGDUN_CACHE.has(seedSig)){
		YINYANGDUN_CACHE.delete(seedSig);
	}
	YINYANGDUN_CACHE.set(seedSig, ret);
	if(YINYANGDUN_CACHE.size > MAX_YINYANGDUN_CACHE){
		const firstKey = YINYANGDUN_CACHE.keys().next().value;
		if(firstKey){
			YINYANGDUN_CACHE.delete(firstKey);
		}
	}
	return ret;
}

function qimenJuNameZhirun(dateParts, dayGanzhi, yearSeeds, fallbackJieqi){
	const yyd = buildYinyangdunMap(dateParts.year, yearSeeds);
	if(!yyd){
		return qimenJuNameChaibu(fallbackJieqi || '', dayGanzhi);
	}
	let dkey = `${dateParts.year}${`${dateParts.month}`.padStart(2, '0')}${`${dateParts.day}`.padStart(2, '0')}`;
	if(dateParts.hour === 23){
		dkey = utcDayToKey(keyToUtcDay(dkey) + 1);
	}
	const jqrz = yyd[dkey];
	if(!jqrz || jqrz.length < 4){
		return qimenJuNameChaibu(fallbackJieqi || '', dayGanzhi);
	}
	const jieqi = jqrz.substring(0, 2);
	const rizhu = jqrz.substring(2, 4);
	const idx = getGanzhiIndex(rizhu);
	const futou = Math.floor(idx / 15) * 15;
	const yuanId = Math.floor((idx - futou) / 5);
	const yuan = ['上元', '中元', '下元'][yuanId] || '上元';
	const code = JIEQI2JU[jieqi] || '一七四阳';
	const yy = code.substring(code.length - 1);
	return `${yy}遁${code.substring(yuanId, yuanId + 1)}局${yuan}`;
}

function joinList(list){
	if(!list || !list.length){
		return '无';
	}
	return list.join('、');
}

function normalizeQimenExportText(raw){
	// Keep trigram "乾" unchanged; do not convert it to "干".
	const txt = `${raw === undefined || raw === null ? '' : raw}`;
	if(!txt){
		return '';
	}
	return txt.replace(/[門開傷驚陰陽離兌黃綠藍騰內沖輔麗風險鬥體臺與廣層醫氣關貴龍變遠飛壯闊圖樓處書證經網]/g, (ch)=>QIMEN_EXPORT_CHAR_MAP[ch] || ch);
}

function getQimenShenShaValue(mapObj, name, key){
	if(!mapObj || !name || !key){
		return '';
	}
	const list = mapObj[name] && mapObj[name][key] ? mapObj[name][key] : [];
	return list.join('');
}

function resolveQimenGuiRen(dayGan, isDiurnal){
	const dayGui = LRConst.DayGuiDunJia[dayGan] || (QIMEN_GUIREN_DAY_NIGHT[dayGan] ? QIMEN_GUIREN_DAY_NIGHT[dayGan][0] : '');
	const nightGui = LRConst.NightGuiDunJia[dayGan] || (QIMEN_GUIREN_DAY_NIGHT[dayGan] ? QIMEN_GUIREN_DAY_NIGHT[dayGan][1] : '');
	if(!dayGui || !nightGui){
		return {
			dayGui,
			nightGui,
			trueGuiRen: '',
			muGuiRen: '',
			isDiurnal: null,
		};
	}
	const isDaytime = isDiurnal === true;
	const isNight = isDiurnal === false;
	const trueGuiRen = isDaytime ? dayGui : (isNight ? nightGui : '');
	const muGuiRen = isDaytime ? nightGui : (isNight ? dayGui : '');
	return {
		dayGui,
		nightGui,
		trueGuiRen,
		muGuiRen,
		isDiurnal,
	};
}

function buildQimenShenSha(ganzhi, isDiurnal){
	const dayGan = getGanzhiGan(ganzhi && ganzhi.day ? ganzhi.day : '');
	const dayZhi = getGanzhiZhi(ganzhi && ganzhi.day ? ganzhi.day : '');
	const monthZhi = getGanzhiZhi(ganzhi && ganzhi.month ? ganzhi.month : '');
	const yearZhi = getGanzhiZhi(ganzhi && ganzhi.year ? ganzhi.year : '');
	const timeZhi = getGanzhiZhi(ganzhi && ganzhi.time ? ganzhi.time : '');
	const guiren = resolveQimenGuiRen(dayGan, isDiurnal);
	const byName = {};

	const defs = [
		{ group: '日干', name: '日禄', map: QIMEN_SHENSHA_DAY_STEMS, key: dayGan },
		{ group: '日干', name: '日德', map: QIMEN_SHENSHA_DAY_STEMS, key: dayGan },
		{ group: '月支', name: '天马', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '日支', name: '日马', map: QIMEN_SHENSHA_DAY_BRANCH, key: dayZhi },
		{ group: '年支', name: '年马', map: QIMEN_SHENSHA_YEAR_BRANCH, key: yearZhi },
		{ group: '日支', name: '桃花', map: QIMEN_SHENSHA_DAY_BRANCH, key: dayZhi },
		{ group: '日支', name: '破碎', map: QIMEN_SHENSHA_DAY_BRANCH, key: dayZhi },
		{ group: '月支', name: '生气', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '月支', name: '死气', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '年支', name: '病符', map: QIMEN_SHENSHA_YEAR_BRANCH, key: yearZhi },
		{ group: '月支', name: '血支', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '年支', name: '孤辰', map: QIMEN_SHENSHA_YEAR_BRANCH, key: yearZhi },
		{ group: '年支', name: '寡宿', map: QIMEN_SHENSHA_YEAR_BRANCH, key: yearZhi },
		{ group: '年支', name: '丧门', map: QIMEN_SHENSHA_YEAR_BRANCH, key: yearZhi },
		{ group: '年支', name: '吊客', map: QIMEN_SHENSHA_YEAR_BRANCH, key: yearZhi },
		{ group: '月支', name: '成神', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '月支', name: '会神', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '月支', name: '解神', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '月支', name: '天目', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '月支', name: '医星', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '月支', name: '月厌', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '月支', name: '月破', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '月支', name: '贼神', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '日干', name: '贵人', value: guiren.trueGuiRen },
		{ group: '日干', name: '游都', map: QIMEN_SHENSHA_DAY_STEMS, key: dayGan },
		{ group: '日干', name: '文昌', map: QIMEN_SHENSHA_DAY_STEMS, key: dayGan },
		{ group: '月支', name: '丧车', map: QIMEN_SHENSHA_MONTH_BRANCH, key: monthZhi },
		{ group: '日干', name: '幕贵', value: guiren.muGuiRen },
	];

	const allItems = defs.map((item)=>{
		const value = (item.value !== undefined ? item.value : getQimenShenShaValue(item.map, item.name, item.key)) || '—';
		const one = { group: item.group, name: item.name, value };
		byName[item.name] = one;
		return one;
	});

	const groups = ['日干', '日支', '月支', '年支'].map((group)=>({
		group,
		items: allItems.filter((item)=>item.group === group),
	}));

	const summaryNames = ['日禄', '日德', '天马', '日马', '年马'];
	const summary = summaryNames
		.map((name)=>byName[name])
		.filter((item)=>!!item);

	return {
		summary,
		groups,
		allItems,
		refs: {
			dayGan,
			dayZhi,
			monthZhi,
			yearZhi,
			timeZhi,
			dayGui: guiren.dayGui,
			nightGui: guiren.nightGui,
			isDiurnal: guiren.isDiurnal,
		},
	};
}

export function calcDunJia(fields, nongli, options, context){
	const dateParts = parseDateTime(fields);
	if(!dateParts){
		return null;
	}
	const opts = {
		qijuMethod: 'zhirun',
		kongMode: 'day',
		yimaMode: 'day',
		shiftPalace: 0,
		fengJu: false,
		timeAlg: 1,
		...(options || {}),
	};
	opts.qijuMethod = normalizeQijuMethod(opts.qijuMethod);
	const shiftPalace = normalizeShiftPalace(opts.shiftPalace);
	const timeAlg = normalizeTimeAlg(opts.timeAlg);
	const calcDateParts = resolveQimenDateParts(dateParts, nongli || {}, timeAlg);

	const ganzhi = buildGanzhiForQimen(nongli || {}, calcDateParts);
	const jieqi = getCurrentJieqi(nongli || {});
	const paiPanMeta = resolvePaiPanMeta(opts, ganzhi, jieqi, calcDateParts, context || {});
	const qmju = paiPanMeta.qmju || buildQmjuByMeta(paiPanMeta.yinYangDun, paiPanMeta.juShu, paiPanMeta.sanYuan);
	const zfzs = zhifuNZhishi(ganzhi, qmju, {
		zhiShiType: opts.zhiShiType,
		yinYangDun: paiPanMeta.yinYangDun,
		jieqi,
	});
	const dipanGua = panEarth(qmju);
	const tianpanGua = panSky(ganzhi, qmju);
	const menGua = panDoor(ganzhi, qmju);
	const starGua = panStar(ganzhi, qmju);
	const shenGua = panGod(ganzhi, qmju);
	const xunkong = daykongShikong(ganzhi.day, ganzhi.time);

	const diPanBase = convertGuaMapToPos(dipanGua);
	const tianPanBase = convertGuaMapToPos(tianpanGua);
	const menBase = convertGuaMapToPos(menGua);
	const starBase = convertGuaMapToPos(starGua);
	const shenBase = convertGuaMapToPos(shenGua);
	const diPan = rotateOuterMapByShift(diPanBase, shiftPalace);
	const tianPan = rotateOuterMapByShift(tianPanBase, shiftPalace);
	const men = rotateOuterMapByShift(menBase, shiftPalace);
	const star = rotateOuterMapByShift(starBase, shiftPalace);
	const shen = rotateOuterMapByShift(shenBase, shiftPalace);

	const specials = resolveSpecials(tianPan);
	const menPo = resolveMenPo(men);
	const kongWang = getKongByMode(opts.kongMode, xunkong);
	const kongWangMeta = resolveKongWangPalaces(kongWang);
	const yiMaMeta = resolveYiMa(opts.yimaMode, ganzhi);
	const isDiurnal = context && context.isDiurnal !== undefined && context.isDiurnal !== null
		? !!context.isDiurnal
		: (nongli && nongli.isDiurnal !== undefined && nongli.isDiurnal !== null ? !!nongli.isDiurnal : null);

	const zhiFuPalace = rotateOuterPalaceNum(GUA_POS_MAP[zfzs.值符星宫[1]] || 5, shiftPalace);
	const zhiShiPalace = rotateOuterPalaceNum(GUA_POS_MAP[zfzs.值使门宫[1]] || 5, shiftPalace);
	let zhiFu = JIU_XING_NAME[(zfzs.值符星宫[0] || '').replace(/禽/g, '芮')] || `${(zfzs.值符星宫[0] || '').replace(/禽/g, '芮')}`;
	if((zfzs.值符星宫[0] || '') === '禽'){
		zhiFu = '天禽';
	}
	const zhiShi = BA_MEN_NAME[zfzs.值使门宫[0]] || `${zfzs.值使门宫[0]}门`;
	const yearGan = getGanzhiGan(ganzhi.year);
	const monthGan = getGanzhiGan(ganzhi.month);
	const dayGan = getGanzhiGan(ganzhi.day);
	const timeGan = getGanzhiGan(ganzhi.time);
	const isFiveBuYuShiFlag = isFiveBuYuShi(dayGan, timeGan);
	const isTianFuShiFlag = isTianFuShi(dayGan, ganzhi.time || '');

	const cells = buildCells(diPan, tianPan, men, shen, star, zhiFuPalace, zhiShiPalace, {
		jiXingPalaces: specials.jiXingPalaces,
		ruMuPalaces: specials.ruMuPalaces,
		menPoPalaces: menPo.palaces,
		kongWangPalaces: kongWangMeta.palaces,
		yimaPalace: yiMaMeta.palace,
		yearGan,
		monthGan,
		dayGan,
		timeGan,
		timeGanzhi: ganzhi.time || '',
		isFiveBuYuShi: isFiveBuYuShiFlag,
		isTianFuShi: isTianFuShiFlag,
	});
	const patternSummary = collectPatternSummary(cells);

	const qmjuMeta = parseQmju(qmju);

	return {
		dateStr: calcDateParts.dateStr,
		timeStr: calcDateParts.timeStr,
		directDateStr: dateParts.dateStr,
		directTimeStr: dateParts.timeStr,
		calcDateStr: calcDateParts.dateStr,
		calcTimeStr: calcDateParts.timeStr,
		timeAlg,
		realSunTime: nongli ? (nongli.birth || '') : '',
		lunarText: nongli ? `${nongli.year || ''}年${nongli.leap ? '闰' : ''}${nongli.month || ''}${nongli.day || ''}` : '',
		jiedelta: nongli ? (nongli.jiedelta || '') : '',
		ganzhi,
		fuTou: resolveFuTouByBacktrack(ganzhi.day),
		jieqiText: `${jieqi || '未知节气'}${paiPanMeta.sanYuan || qmjuMeta.yuan}`,
		yinYangDun: paiPanMeta.yinYangDun || (qmjuMeta.yy === '阴' ? '阴遁' : '阳遁'),
		sanYuan: paiPanMeta.sanYuan || qmjuMeta.yuan,
		juShu: juNumberToCn(paiPanMeta.juShu || (CNUMBER.indexOf(qmjuMeta.kook) + 1)),
		juText: qmju,
		xunShou: getXunHead(ganzhi.day),
		kongWang,
		zhiFu,
		zhiShi,
		zhiFuPalace,
		zhiShiPalace,
		shiftPalace,
		fengJu: !!opts.fengJu,
		diPan,
		tianPan,
		renPan: men,
		shenPan: shen,
		tianGan: tianPan,
		diPanList: mapListByPos(diPan),
		tianPanList: mapListByPos(tianPan),
		renPanList: mapListByPos(men),
		shenPanList: mapListByPos(shen),
		jiXingPalaces: specials.jiXingPalaces,
		ruMuPalaces: specials.ruMuPalaces,
		liuYiJiXing: specials.liuYi,
		qiYiRuMu: specials.ruMu,
		menPo,
		kongWangDesc: kongWangMeta.list,
		kongWangPalaces: kongWangMeta.palaces,
		yiMa: yiMaMeta,
		shenSha: buildQimenShenSha(ganzhi, isDiurnal),
		jiPatterns: patternSummary.ji,
		xiongPatterns: patternSummary.xiong,
		cells,
		xunkong,
		options: {
			sexLabel: getOptionLabel(SEX_OPTIONS, opts.sex),
			dateTypeLabel: getOptionLabel(DATE_TYPE_OPTIONS, opts.dateType),
			leapLabel: getOptionLabel(LEAP_MONTH_OPTIONS, opts.leapMonthType),
			xuShiLabel: getOptionLabel(XUSHI_OPTIONS, opts.xuShiSuiType),
			jieQiLabel: getOptionLabel(JIEQI_OPTIONS, opts.jieQiType),
			paiPanLabel: getOptionLabel(PAIPAN_OPTIONS, opts.paiPanType),
			zhiShiLabel: getOptionLabel(ZHISHI_OPTIONS, opts.zhiShiType),
			yueJiaLabel: getOptionLabel(YUEJIA_QIJU_OPTIONS, opts.yueJiaQiJuType),
			yearLabel: getOptionLabel(YEAR_GZ_OPTIONS, opts.yearGanZhiType),
			monthLabel: getOptionLabel(MONTH_GZ_OPTIONS, opts.monthGanZhiType),
			dayLabel: getOptionLabel(DAY_GZ_OPTIONS, opts.dayGanZhiType),
			qijuMethodLabel: getOptionLabel(QIJU_METHOD_OPTIONS, opts.qijuMethod),
			kongModeLabel: getOptionLabel(KONG_MODE_OPTIONS, opts.kongMode),
			yimaModeLabel: getOptionLabel(MA_MODE_OPTIONS, opts.yimaMode),
			shiftLabel: getOptionLabel(YIXING_OPTIONS, shiftPalace),
			fengJuLabel: opts.fengJu ? '已封局' : '未封局',
		},
	};
}

export function buildDunJiaSnapshotText(pan){
	if(!pan){
		return '';
	}
	const lines = [];
	const calcDate = pan.calcDateStr || pan.dateStr;
	const calcTime = pan.calcTimeStr || pan.timeStr;
	const directTime = pan.directTimeStr || pan.timeStr;
	lines.push('[起盘信息]');
	lines.push(`日期：${calcDate} ${calcTime}`);
	lines.push(`直接时间：${directTime}`);
	if(pan.realSunTime){
		lines.push(`真太阳时：${pan.realSunTime}`);
	}
	lines.push(`时间算法：${normalizeTimeAlg(pan.timeAlg) === 1 ? '直接时间' : '真太阳时'}`);
	if(pan.lunarText){
		lines.push(`农历：${pan.lunarText}`);
	}
	if(pan.jiedelta){
		lines.push(`${pan.jiedelta}`);
	}
	lines.push(`干支：年${pan.ganzhi.year || ''} 月${pan.ganzhi.month || ''} 日${pan.ganzhi.day || ''} 时${pan.ganzhi.time || ''}`);
	lines.push(`空亡：${pan.kongWang}`);
	lines.push(`旬首：${pan.xunShou}`);
	lines.push('');

	lines.push('[盘型]');
	lines.push(`奇门遁甲方盘（${pan.options.paiPanLabel}）`);
	lines.push(`命式：${pan.options.sexLabel}`);
	lines.push(`移星：${pan.options.shiftLabel || '原宫'}`);
	lines.push(`奇门封局：${pan.options.fengJuLabel || (pan.fengJu ? '已封局' : '未封局')}`);
	lines.push(`节气：${pan.jieqiText}`);
	lines.push(`局数：${pan.juText}`);
	lines.push(`起局法：${pan.options.qijuMethodLabel}`);
	lines.push(`空亡方式：${pan.options.kongModeLabel}`);
	lines.push(`驿马方式：${pan.options.yimaModeLabel}`);
	lines.push(`值符：${pan.zhiFu}`);
	lines.push(`值使：${pan.zhiShi}`);
	lines.push('');

	lines.push('[右侧栏目]');
	lines.push(`符头：${pan.fuTou}`);
	lines.push(`地盘：${pan.diPanList.join(' ')}`);
	lines.push(`天盘：${pan.tianPanList.join(' ')}`);
	lines.push(`人盘：${pan.renPanList.join(' ')}`);
	lines.push(`神盘：${pan.shenPanList.join(' ')}`);
	lines.push(normalizeQimenExportText(appendQimenExplanation(`六仪击刑：${joinList(pan.liuYiJiXing)}`)));
	lines.push(normalizeQimenExportText(appendQimenExplanation(`奇仪入墓：${joinList(pan.qiYiRuMu)}`)));
	lines.push(normalizeQimenExportText(appendQimenExplanation(`门迫：${joinList(pan.menPo && pan.menPo.list ? pan.menPo.list : [])}`)));
	lines.push(normalizeQimenExportText(appendQimenExplanation(`空亡宫：${joinList(pan.kongWangDesc)}`)));
	lines.push(normalizeQimenExportText(appendQimenExplanation(`${pan.yiMa ? pan.yiMa.text : '日马：无'}`)));
	lines.push(normalizeQimenExportText(`吉格：${joinList(pan.jiPatterns || [])}`));
	lines.push(normalizeQimenExportText(`凶格：${joinList(pan.xiongPatterns || [])}`));
	if(pan.shenSha && pan.shenSha.summary && pan.shenSha.summary.length){
		lines.push(normalizeQimenExportText(`神煞概览：${pan.shenSha.summary.map((item)=>`${item.name}-${item.value}`).join('  ')}`));
	}
	lines.push('');

	lines.push('[九宫方盘]');
	pan.cells.forEach((cell)=>{
		lines.push(`${cell.palaceName}${cell.palaceNum}宫：${cell.tianGan || '—'} ${cell.god || '—'} ${cell.door || '—'} ${cell.tianXing || '—'} ${cell.diGan || '—'}`);
	});

	return lines.join('\n');
}

