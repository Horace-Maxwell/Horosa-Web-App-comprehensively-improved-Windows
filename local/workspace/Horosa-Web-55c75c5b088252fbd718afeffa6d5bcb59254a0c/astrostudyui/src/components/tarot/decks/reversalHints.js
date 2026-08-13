// 逆位速查数据(TP1):①逆位关键词七族(原创同义词库,供指词/联想) ②牌组×数字·位阶 正/逆通则表(原创转录)
// ③静态等待牌清单 ④宫廷逆位通则。供牌义速查行/单卡详情/帮助手册消费。
import { isTrumpArcana } from '../engine/arcana.js'; // [QA-9] 王牌判据单一真值源
export const REVERSAL_WORD_FAMILIES = [
	{ family: '受阻', words: ['卡住', '受挫', '被否定', '被抗拒', '被压下', '悬而未决', '路径变窄'] },
	{ family: '内向', words: ['转入内在', '私下进行', '未曾示人', '潜藏', '深处酝酿', '只对自己发生'] },
	{ family: '延迟', words: ['时机未到', '进程放缓', '短暂搁置', '将熟未熟', '等待窗口'] },
	{ family: '过度或不足', words: ['过了头', '失了衡', '火候不够', '早熟或迟滞', '两极摇摆'] },
	{ family: '解放', words: ['挣脱', '松动', '翻篇', '走出', '卸下', '了结', '转向'] },
	{ family: '误用', words: ['用错方向', '选错对象', '力不对点', '目标漂移', '南辕北辙'] },
	{ family: '回撤', words: ['回顾', '重考', '收回', '重做', '退一步', '再来一次'] },
];

// 牌组层 正/逆通则(大牌+四花色)。
export const ARCANA_REVERSAL_HINTS = {
	major: { up: '原则、法则、人生课题;心灵深层的需求', rev: '课题被搁置或误用;向更高目的让位;看穿表相后的突破' },
	wands: { up: '成长、热忱、创造、行动力', rev: '劲道过猛或不济;自耗与倦怠;行动收向内在' },
	cups: { up: '情感、想象、关系、接纳', rev: '情绪过载或麻木;耽溺与逃避;情感转入私密' },
	swords: { up: '思辨、决断、沟通、交锋', rev: '苛责与内疚;僵持松动;言语收剑入鞘' },
	pentacles: { up: '身体、物质、成果、经营', rev: '损耗与失衡;过度囤积或散逸;价值重估' },
};

// 位阶层 正/逆通则(王牌/2..10/侍骑后王)。键:1..10 数字、page/knight/queen/king。
export const RANK_REVERSAL_HINTS = {
	1: { up: '种子、机会、起点、专注', rev: '机不成熟、握不住;转为内在渴望与预备' },
	2: { up: '二元、抉择、平衡、回应', rev: '失衡与犹疑;或内在重获平衡、僵局松动' },
	3: { up: '初成、协作、生长', rev: '不配合、劳而无功;或疗愈过往、内在支撑成形' },
	4: { up: '稳固、休整、秩序', rev: '困于安稳或急于求成;或限制解除、根基内化' },
	5: { up: '危机、试炼、适应', rev: '僵局与受困感;或重燃兴致、和解将至' },
	6: { up: '互惠、交流、扶持', rev: '自我中心、失和;或自我实现、不再攀比' },
	7: { up: '挑战、坚持、评估', rev: '虚饰与动摇;或抵住诱惑、笃定执行' },
	8: { up: '推进、调整、精进', rev: '毅力不继、进展受阻;或转入宽绰、悟性大开' },
	9: { up: '将成、积累、坚守', rev: '防线受损、倚赖;或内在智慧、无形收获' },
	10: { up: '完结、承载、传承', rev: '强弩之末、家事纷纭;或如释重负、得到宽解' },
	page: { up: '学习、消息、尝试、敞开', rev: '稚气与脆弱;坏消息;或内在小孩待被看见' },
	knight: { up: '出征、追寻、行动、扩张', rev: '鲁莽或失向;步调放缓;或转为内在求索' },
	queen: { up: '内在掌握、涵养、吸引', rev: '控制失当、摇摆不定;或内在女性面正在成形' },
	king: { up: '外在掌握、号令、担纲', rev: '权柄误用、强撑门面;或内在男性面正在成形' },
};

// 静态等待牌:这几张逆位常解「即将离开等待、开始行动」(时间点式逆位的专属清单)。
export const STATIC_WAIT_CARDS = ['cups_04', 'swords_04', 'pentacles_07', 'cups_07', 'swords_08'];
export const STATIC_WAIT_NOTE = '静态等待牌逆位:等待将尽、即将起身行动。';

// 宫廷逆位通则:多按「过度或不足」解——正位=特质得其中道,逆位=太过或不及而转负。
export const COURT_REVERSAL_RULE = '宫廷牌逆位通则:该人格特质「过度或不足」(勤恳→工作狂或懈怠;领导→专断或懦弱)。';

// 一张牌的速查行(逆位时用):牌组通则+位阶通则+静态等待特注。
export function reversalHintOf(card){
	if(!card){ return null; }
	const parts = [];
	const arc = isTrumpArcana(card.arcana) ? 'major' : card.suit;
	if(ARCANA_REVERSAL_HINTS[arc]){ parts.push(`${isTrumpArcana(card.arcana) ? '大牌' : '牌组'}通则:${ARCANA_REVERSAL_HINTS[arc].rev}`); }
	if(!isTrumpArcana(card.arcana)){
		const rankKey = card.court ? card.court : card.number;
		if(RANK_REVERSAL_HINTS[rankKey]){ parts.push(`位阶通则:${RANK_REVERSAL_HINTS[rankKey].rev}`); }
		if(card.court){ parts.push(COURT_REVERSAL_RULE); }
	}
	if(STATIC_WAIT_CARDS.includes(card.sid)){ parts.push(STATIC_WAIT_NOTE); }
	return parts.length ? parts.join('；') : null;
}
