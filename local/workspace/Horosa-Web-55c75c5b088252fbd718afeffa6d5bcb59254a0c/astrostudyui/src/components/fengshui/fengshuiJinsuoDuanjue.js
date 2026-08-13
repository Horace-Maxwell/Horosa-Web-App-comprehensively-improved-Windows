// 金锁玉关（过路阴阳）· 断诀全库 —— 24 山 ×{水断,砂断}＝48 条基础断语
//   + 砂水形态联动、对宫映照、本宫全砂/全水、跨宫组合、房份归属。
// 口径：一二三四（坎坤震巽）要见山，六七八九（乾兑艮离）要见水；
//       该见山者见山吉、见水凶；该见水者见水吉、见山凶。中五宫不列。
// 🔴 本库只作断语查检：得位/失位的**判定**仍由 jinsuo.js 原有洛书口径给出，本库不改判据。
// 🔴 逐字保全传本行文（含形态条件与对宫条件），不改写、不归纳、不补齐传本未载者。

// 砂水形态枚举（断诀中显式点到的形，供左栏选择；未选＝不带形态条件）。
export const JINSUO_XING = [
	{ key: 'zhiqu', label: '直去（不回头）', side: 'shui' },
	{ key: 'hulu', label: '形如葫芦', side: 'shui' },
	{ key: 'midai', label: '形如小米袋', side: 'shui' },
	{ key: 'yacha', label: '形如丫杈', side: 'shui' },
	{ key: 'qiang', label: '形如枪', side: 'both' },
	{ key: 'sanjiao', label: '形如三角（塘/样）', side: 'both' },
	{ key: 'xiefei', label: '水形斜飞', side: 'shui' },
	{ key: 'kuanda', label: '水形宽大', side: 'shui' },
	{ key: 'damengmeng', label: '大而猛（势大力猛）', side: 'shui' },
	{ key: 'yuanyuan', label: '源源而来／一片汪洋', side: 'shui' },
	{ key: 'zhengqi', label: '水形整齐', side: 'shui' },
	{ key: 'shixiao', label: '水势小', side: 'shui' },
	{ key: 'shida', label: '水势大', side: 'shui' },
	{ key: 'qququgou', label: '曲曲沟', side: 'shui' },
	{ key: 'bujixing', label: '水形不吉／不美', side: 'shui' },
	{ key: 'pojun', label: '砂形如破军形', side: 'sha' },
	{ key: 'jizhua', label: '砂形如鸡爪', side: 'sha' },
	{ key: 'zhihu', label: '执笏山形', side: 'sha' },
	{ key: 'tanlang', label: '贪狼样', side: 'sha' },
	{ key: 'fangong', label: '砂形反弓冲射', side: 'sha' },
	{ key: 'zhishe', label: '砂形直射', side: 'sha' },
	{ key: 'gaobi', label: '砂高逼', side: 'sha' },
	{ key: 'gaosong', label: '砂高耸', side: 'sha' },
	{ key: 'gaoda', label: '砂形高大', side: 'sha' },
	{ key: 'posui', label: '砂形破碎尖锐', side: 'sha' },
	{ key: 'zhengqixiu', label: '砂形整齐、高大秀美', side: 'sha' },
];

// 24 山逐山断诀。
//   shui / sha：{ base, fang, when[] }；when 内每条 { cond, kind:'xing'|'zhao'|'liu', text }
//   kind：xing＝形态条件；zhao＝对宫（或他宫）砂水映照条件；liu＝水流入某宫。
export const JINSUO_SHAN_DUAN = {
	// ── 一白坎宫（要见山：见水凶、见砂吉）──
	壬: {
		gua: '坎',
		shui: { base: '壬水乏嗣，二房先绝', fang: '二房', when: [
			{ cond: '直去', kind: 'xing', text: '小口损伤' },
			{ cond: '形如葫芦', kind: 'xing', text: '主腰腿损伤' },
		] },
		sha: { base: '壬砂发武贵', fang: '', when: [
			{ cond: '有丙水映照', kind: 'zhao', req: [{ shan: '丙', side: 'water' }], any: true, text: '文武全才' },
		] },
	},
	子: {
		gua: '坎',
		shui: { base: '子水直去不回头，主外逃凶死', fang: '', when: [
			{ cond: '形如小米袋', kind: 'xing', text: '伤妇女' },
		] },
		sha: { base: '子砂二房发富', fang: '二房', when: [
			{ cond: '砂形如破军形', kind: 'xing', text: '寡妇兴家' },
			{ cond: '午水映照', kind: 'zhao', req: [{ shan: '午', side: 'water' }], any: true, text: '贪淫破家' },
		] },
	},
	癸: {
		gua: '坎',
		shui: { base: '癸水主妇女不育', fang: '', when: [
			{ cond: '流入乾宫', kind: 'liu', text: '老父乖巧' },
			{ cond: '流入艮宫', kind: 'liu', text: '儿郎俊俏但身体差' },
			{ cond: '流入巽宫', kind: 'liu', text: '长二房凶' },
			{ cond: '流入巽宫且形如丫杈', kind: 'xing', text: '败财' },
		] },
		sha: { base: '癸砂妇女兴业，男子平庸', fang: '', when: [
			{ cond: '有丁水照', kind: 'zhao', req: [{ shan: '丁', side: 'water' }], any: true, text: '财富佳而阴盛阳衰，女强男弱' },
		] },
	},
	// ── 二黑坤宫（要见山）──
	未: {
		gua: '坤',
		shui: { base: '未水出盗贼犯事', fang: '', when: [] },
		sha: { base: '未砂发财但行为不正', fang: '', when: [
			{ cond: '得丑水照', kind: 'zhao', req: [{ shan: '丑', side: 'water' }], any: true, text: '主田园之富' },
		] },
	},
	坤: {
		gua: '坤',
		shui: { base: '坤水伤妻', fang: '', when: [] },
		sha: { base: '坤砂妇女持家', fang: '', when: [
			{ cond: '艮水水形不美', kind: 'zhao', req: [{ shan: '艮', side: 'water' }], any: true, text: '长二房发血财' },
		] },
	},
	申: {
		gua: '坤',
		shui: { base: '申水伤小女', fang: '', when: [] },
		sha: { base: '申砂生美女', fang: '', when: [
			{ cond: '有寅水相照', kind: 'zhao', req: [{ shan: '寅', side: 'water' }], any: true, text: '出才艺双全之人' },
		] },
	},
	// ── 三碧震宫（要见山）──
	甲: {
		gua: '震',
		shui: { base: '甲水长房绝后，患肿瘤、结石，主手术刀伤', fang: '长房', when: [] },
		sha: { base: '甲砂高大，长二房速发富', fang: '长二房', when: [
			{ cond: '得庚酉水相照', kind: 'zhao', req: [{ shan: '庚', side: 'water' }, { shan: '酉', side: 'water' }], any: true, text: '财官双旺' },
		] },
	},
	卯: {
		gua: '震',
		shui: { base: '卯水先女后子', fang: '', when: [
			{ cond: '水势小', kind: 'xing', text: '先女后子' },
			{ cond: '水势大', kind: 'xing', text: '贫贱有子，富贵与丁不能两全' },
		] },
		sha: { base: '卯砂能发财，但长二房易血光之灾', fang: '长二房', when: [
			{ cond: '形如鸡爪', kind: 'xing', text: '出匪类' },
			{ cond: '得酉水照', kind: 'zhao', req: [{ shan: '酉', side: 'water' }], any: true, text: '女多男少' },
		] },
	},
	乙: {
		gua: '震',
		shui: { base: '乙水曲曲沟，叔嫂暗相偷', fang: '', when: [
			{ cond: '水形不吉', kind: 'xing', text: '还主肝疯病' },
		] },
		sha: { base: '乙砂出文人', fang: '', when: [
			{ cond: '有执笏山形', kind: 'xing', text: '出大贵' },
			{ cond: '有执笏山形再有辛水照', kind: 'zhao', req: [{ shan: '辛', side: 'water' }], any: true, text: '锦上添花' },
		] },
	},
	// ── 四绿巽宫（要见山）──
	辰: {
		gua: '巽',
		shui: { base: '辰水主遭贼，三房出蛮横之人', fang: '三房', when: [
			{ cond: '水形如枪', kind: 'xing', text: '三房人丁凶死' },
			{ cond: '形如三角塘', kind: 'xing', text: '涉黑如匪徒一样猖狂' },
		] },
		sha: { base: '辰砂主发富但行为不端', fang: '', when: [] },
	},
	巽: {
		gua: '巽',
		shui: { base: '巽水长女与母亲淫乱是非', fang: '', when: [
			{ cond: '水形斜飞', kind: 'xing', text: '女儿私奔' },
		] },
		sha: { base: '巽砂女兴家', fang: '', when: [
			{ cond: '有贪狼样', kind: 'xing', text: '男女有声名' },
		] },
	},
	巳: {
		gua: '巽',
		shui: { base: '巳水主出烟花之女，并有与和尚私通之事发生', fang: '', when: [] },
		sha: { base: '巳砂中子发科甲，出官贵', fang: '中子', when: [] },
	},
	// ── 六白乾宫（要见水：见水吉、见砂凶）──
	戌: {
		gua: '乾',
		shui: { base: '戌水出土豪，暗通匪类，性情残冷', fang: '', when: [] },
		sha: { base: '戌砂主官司、血光、亦主意外之灾，多有思想反复之人', fang: '', when: [
			{ cond: '砂形反弓冲射', kind: 'xing', text: '长二房人丁有凶死之应' },
			{ cond: '有辰水对照', kind: 'zhao', req: [{ shan: '辰', side: 'water' }], any: true, text: '易出匪类子孙' },
		] },
	},
	乾: {
		gua: '乾',
		shui: { base: '乾水主富贵，水势愈大愈吉', fang: '', when: [] },
		sha: { base: '乾砂若高逼，主父亲不长寿，三房人丁孤苦', fang: '三房', when: [
			{ cond: '砂形直射巽方或巽水相照', kind: 'zhao', req: [{ shan: '巽', side: 'water' }], any: true, text: '淫乱不堪' },
		] },
	},
	亥: {
		gua: '乾',
		shui: { base: '亥水主小儿夜啼，亦有文昌', fang: '', when: [
			{ cond: '势大力猛', kind: 'xing', text: '易损成才之子' },
		] },
		sha: { base: '亥砂高耸，长二房出浪荡之人，钱财消耗', fang: '长二房', when: [
			{ cond: '巳水对照', kind: 'zhao', req: [{ shan: '巳', side: 'water' }], any: true, text: '风声丑闻' },
		] },
	},
	// ── 七赤兑宫（要见水）──
	庚: {
		gua: '兑',
		shui: { base: '庚水主出武贵，八字年柱带庚者最易成才', fang: '', when: [] },
		sha: { base: '庚砂惹祸端，官司伤灾', fang: '', when: [
			{ cond: '甲水对照', kind: 'zhao', req: [{ shan: '甲', side: 'water' }], any: true, text: '长子无后' },
			{ cond: '砂形破碎尖锐', kind: 'xing', text: '主是非，口舌难免' },
		] },
	},
	酉: {
		gua: '兑',
		shui: { base: '酉水桃花', fang: '', when: [
			{ cond: '有午砂', kind: 'zhao', req: [{ shan: '午', side: 'sand' }], any: true, text: '长房夫妻不合' },
		] },
		sha: { base: '酉砂直射，主妇女婚外情或淫乱无度，长房女儿多凶灾', fang: '长房', when: [
			{ cond: '再遇卯水对照', kind: 'zhao', req: [{ shan: '卯', side: 'water' }], any: true, text: '伤身破财严重' },
		] },
	},
	辛: {
		gua: '兑',
		shui: { base: '辛水出才貌双全之女，长二房富贵', fang: '长二房', when: [] },
		sha: { base: '辛砂主肺病', fang: '', when: [
			{ cond: '砂形高大且有乙水对照', kind: 'zhao', req: [{ shan: '乙', side: 'water' }], any: true, text: '主肺癌，长房小口损伤' },
		] },
	},
	// ── 八白艮宫（要见水）──
	丑: {
		gua: '艮',
		shui: { base: '丑水发田庄，但行为不正，做事霸道', fang: '', when: [
			{ cond: '水形宽大', kind: 'xing', text: '财源滚滚，但易与黑社会勾结' },
		] },
		sha: { base: '丑砂长二房出贼盗，三房无丁', fang: '长二房/三房', when: [] },
	},
	艮: {
		gua: '艮',
		shui: { base: '艮水旺人丁', fang: '', when: [
			{ cond: '大而猛', kind: 'xing', text: '人丁兴旺子孙发达' },
		] },
		sha: { base: '艮砂三房绝后', fang: '三房', when: [
			{ cond: '遇坤水照', kind: 'zhao', req: [{ shan: '坤', side: 'water' }], any: true, text: '长三房妇女大灾大难' },
		] },
	},
	寅: {
		gua: '艮',
		shui: { base: '寅水心灵手巧，易出名医', fang: '', when: [] },
		sha: { base: '寅砂出僧道、医师、或礼佛之人，否则人口不安，灾患无穷', fang: '', when: [] },
	},
	// ── 九紫离宫（要见水）──
	丙: {
		gua: '离',
		shui: { base: '丙水得位，长二房发富贵', fang: '长二房', when: [] },
		sha: { base: '丙砂高起，长二房目疾吐血', fang: '长二房', when: [
			{ cond: '有壬水对照', kind: 'zhao', req: [{ shan: '壬', side: 'water' }], any: true, text: '二房绝后' },
		] },
	},
	午: {
		gua: '离',
		shui: { base: '午水主发财，但心性不正，贪花恋酒', fang: '', when: [] },
		sha: { base: '午砂贫困，亦多伤亡', fang: '', when: [
			{ cond: '形如三角样', kind: 'xing', text: '主心脏病' },
			{ cond: '更兼子水对照', kind: 'zhao', req: [{ shan: '子', side: 'water' }], any: true, text: '长二房有血光之灾' },
		] },
	},
	丁: {
		gua: '离',
		shui: { base: '丁水不仅发财，亦多出人才，福禄绵绵', fang: '', when: [] },
		sha: { base: '丁砂主病灾', fang: '', when: [
			{ cond: '砂形如枪', kind: 'xing', text: '主凶死或犯罪受刑' },
			{ cond: '癸水对照', kind: 'zhao', req: [{ shan: '癸', side: 'water' }], any: true, text: '易出寡妇' },
		] },
	},
};

// 本宫全砂 / 全水（八宫，传本载者逐条；未载者不补）。
export const JINSUO_GONG_QUAN = [
	{ gua: '坤', side: 'shui', text: '若坤宫都是水，二三房寿夭', fang: '二三房' },
	{ gua: '坤', side: 'sha', text: '二黑之砂完全，主世代积富；砂形整齐、高大秀美，主为官清正，妻贤子孝', fang: '' },
	{ gua: '震', side: 'sha', text: '三碧之方全是砂，文武全才', fang: '' },
	{ gua: '巽', side: 'shui', text: '四绿方见大水，三房出匪徒', fang: '三房' },
	{ gua: '乾', side: 'shui', text: '六白乾宫全是水，主房房出人才；水形整齐则为官清正有声名', fang: '房房' },
	{ gua: '兑', side: 'shui', text: '七赤方水源源而来，主长二房大发', fang: '长二房' },
	{ gua: '兑', side: 'sha', text: '若七赤方全是砂，贫困有子，富贵无儿，或父子不能两全', fang: '',
		extra: { cond: '再遇辰巽巳水', req: [{ shan: '辰', side: 'water' }, { shan: '巽', side: 'water' }, { shan: '巳', side: 'water' }], any: true, text: '人品不良，奸诈异常' } },
	{ gua: '艮', side: 'shui', text: '若八白方之水一片汪洋，发家致富，妻贤子孝名声好', fang: '' },
	{ gua: '艮', side: 'sha', text: '若八白方全是砂，长房贫困三房绝丁', fang: '长房/三房',
		extra: { cond: '再遇坤申水照', req: [{ shan: '坤', side: 'water' }, { shan: '申', side: 'water' }], any: true, text: '婚姻亦多不幸' } },
	{ gua: '离', side: 'shui', text: '若九紫方全是水，三阳得气，长二房富贵不凡', fang: '长二房' },
	{ gua: '离', side: 'sha', text: '若九紫全是砂，房房皆败，长二房无丁', fang: '房房/长二房',
		extra: { cond: '坎水映照', req: [{ shan: '壬', side: 'water' }, { shan: '子', side: 'water' }, { shan: '癸', side: 'water' }], any: true, text: '有绝后之忧' } },
];

// 跨宫组合（两宫或三宫同砂/同水）。
export const JINSUO_KUA_GONG = [
	{ guas: ['坤', '兑'], side: 'shui', text: '坤兑二宫皆见水，婆媳有灾', fang: '' },
	{ guas: ['坤', '坎'], side: 'shui', text: '坤坎二宫都是水，长二房妇女忧患', fang: '长二房' },
	{ guas: ['坤', '巽'], side: 'shui', text: '坤巽之水齐聚，妻贤而短命，独生女或夭折或难以成才', fang: '' },
	{ guas: ['乾', '坤'], side: 'shui', text: '乾坤两宫都是水，父旺子衰', fang: '' },
	{ guas: ['乾', '震'], side: 'shui', text: '乾震两宫都是水，房份不均，必有一房忧患', fang: '' },
	{ guas: ['离', '兑'], side: 'shui', text: '离兑全是水，易兴易废', fang: '' },
	{ guas: ['乾', '兑'], side: 'shui', text: '乾兑两宫都是水，房房齐发，代代人才鼎盛', fang: '房房' },
	{ guas: ['艮', '离'], side: 'shui', text: '若艮离全是水，房房富贵', fang: '房房' },
	{ guas: ['艮', '震'], side: 'shui', text: '艮震都是水，兄弟不和', fang: '' },
	{ guas: ['离', '乾'], side: 'shui', text: '若离乾二宫皆是水，诗书传家', fang: '' },
	{ guas: ['离', '坎'], side: 'shui', text: '离坎全是水，长二房有受伤害之患', fang: '长二房' },
	{ guas: ['乾', '艮'], side: 'sha', text: '乾艮都是砂，二房贫困三房无丁', fang: '二房/三房' },
	{ guas: ['乾', '兑'], side: 'sha', text: '乾兑都是砂，长房富贵无后', fang: '长房' },
	{ guas: ['离', '坤', '巽'], side: 'sha', text: '若离坤巽全是砂，长三房出人才，二房不贵，或父子不能两全', fang: '长三房/二房' },
];

// 对宫映照对（断诀中「某砂遇某水对照」之成对关系；对宫＝洛书相冲之宫）。
export const JINSUO_DUIGONG = [
	{ a: '壬', b: '丙' }, { a: '子', b: '午' }, { a: '癸', b: '丁' },
	{ a: '未', b: '丑' }, { a: '坤', b: '艮' }, { a: '申', b: '寅' },
	{ a: '甲', b: '庚' }, { a: '卯', b: '酉' }, { a: '乙', b: '辛' },
	{ a: '辰', b: '戌' }, { a: '巽', b: '乾' }, { a: '巳', b: '亥' },
];

export const JINSUO_DUANJUE_NOTE = '断诀依过路阴阳传本逐字保全；本库只作断语查检，得位／失位之判定仍按洛书「一二三四要山、六七八九要水」本法。';

export default JINSUO_SHAN_DUAN;
