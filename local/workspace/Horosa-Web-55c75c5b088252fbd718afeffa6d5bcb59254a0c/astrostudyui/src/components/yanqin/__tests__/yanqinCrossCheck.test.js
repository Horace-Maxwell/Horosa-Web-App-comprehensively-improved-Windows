// 演禽双系统「简繁双表字序一致」交叉校验(WP-0b)。
// 前端简体 MANSIONS(yanqinConst) 与 后端繁体 QIN_NAMES(vendor/kinastro/astro/chinstar/chinstar.py)
// 是「有意分工」——前端展示简体、后端古籍繁体。此测试锁二者【字序】永不漂移(任一改序即红)。
// 合宿:系统A PAIRING_TABLE(12对) vs 系统B HESU_PAIRS(14对) 差异亦在此固化并注明待核。
import {
	MANSIONS, HESU_PAIRS, THIRTYSIX_QIN, normalizeMansion,
	YANQIN_12GONG_ZIWEI, ziweiByPos, HUANGDAO_12SHEN, JIANCHU_12,
} from '../yanqinConst';
import { huangHeiDao, jianChu } from '../yanqinEngine';
import {
	TUNDAN_JUE_12ZHI, THIRTYSIX_XIHAO, KEYING_MIAOJUE, KEYING_PENDING, FENLEI_ZHAN,
} from '../yanqinData';

// 后端繁体 28 宿(镜像 chinstar.py QIN_NAMES,idx 顺序);改后端字序须同步改此镜像→红灯提醒双改。
const BACKEND_QIN_NAMES = [
	'角木蛟', '亢金龍', '氐土貉', '房日兔', '心月狐', '尾火虎', '箕水豹',
	'斗木獬', '牛金牛', '女土蝠', '虛日鼠', '危月燕', '室火豬', '壁水貐',
	'奎木狼', '婁金狗', '胃土雉', '昴日雞', '畢月烏', '觜火猴', '參水猿',
	'井木犴', '鬼金羊', '柳土獐', '星日馬', '張月鹿', '翼火蛇', '軫水蚓',
];

// 宿名首字(宿名) 简→繁(仅列 6 个 简繁相异者;余同形)
const HEAD_S2T = { 虚: '虛', 娄: '婁', 毕: '畢', 参: '參', 张: '張', 轸: '軫' };
const headT = (s) => HEAD_S2T[s] || s;

describe('演禽 · 简繁双表字序一致(WP-0b 交叉校验)', () => {
	test('两表皆 28 宿、同长', () => {
		expect(MANSIONS.length).toBe(28);
		expect(BACKEND_QIN_NAMES.length).toBe(28);
	});

	test('逐宿字序对齐:曜字(第二字)简繁同形 → 必逐位相等', () => {
		// 曜字 木金土日月火水 简繁一致,是最稳的字序锚;任一表乱序即红。
		MANSIONS.forEach((m, i) => {
			expect(m.name[1]).toBe(BACKEND_QIN_NAMES[i][1]);
		});
	});

	test('逐宿字序对齐:宿名首字 简→繁 映射逐位相等', () => {
		MANSIONS.forEach((m, i) => {
			expect(headT(m.name[0])).toBe(BACKEND_QIN_NAMES[i][0]);
		});
	});

	test('七曜循环恒为「木金土日月火水」(两表共有铁律)', () => {
		const CYCLE = ['木', '金', '土', '日', '月', '火', '水'];
		MANSIONS.forEach((m, i) => { expect(m.yao).toBe(CYCLE[i % 7]); });
	});
});

describe('演禽 · 合宿 12/14 差异固化(WP-0b 待核)', () => {
	// 系统B HESU_PAIRS = 14 对(古籍·地支六合,28 宿全配)。
	// 系统A 后端 PAIRING_TABLE = 12 对,缺【参—张】【觜—翼】两对(万化仙禽刻本特征存疑)。
	// 联网核实《万化仙禽》原本是否本用 12 对之前,不改后端;此测试仅固化差异供追踪。
	const BACKEND_PAIRING_HEADS = [
		['角', '昴'], ['亢', '胃'], ['氐', '娄'], ['房', '奎'], ['心', '壁'], ['室', '尾'],
		['箕', '危'], ['斗', '虚'], ['牛', '女'], ['毕', '轸'], ['星', '井'], ['柳', '鬼'],
	]; // chinstar.py PAIRING_TABLE 的简体首字对(12 对)

	test('系统B 合宿 14 对(地支六合,全 28 宿配对)', () => {
		expect(HESU_PAIRS.length).toBe(14);
		const covered = new Set();
		HESU_PAIRS.forEach(([a, b]) => { covered.add(a); covered.add(b); });
		expect(covered.size).toBe(28); // 28 宿首字全覆盖
	});

	test('系统A 后端 12 对,较系统B 缺【参—张】【觜—翼】(待核,非本期改)', () => {
		expect(BACKEND_PAIRING_HEADS.length).toBe(12);
		const backendHeads = new Set();
		BACKEND_PAIRING_HEADS.forEach(([a, b]) => { backendHeads.add(a); backendHeads.add(b); });
		// 系统B 有而系统A 缺的 4 宿首字 = 参/张/觜/翼
		const front = new Set();
		HESU_PAIRS.forEach(([a, b]) => { front.add(a); front.add(b); });
		const missing = [...front].filter((h) => !backendHeads.has(h)).sort();
		expect(missing).toEqual(['参', '张', '翼', '觜'].sort());
	});
});

describe('演禽 · 三十六禽 golden(WP-2 古籍)', () => {
	test('12 支各 3 禽(旦/中/暮)', () => {
		const keys = Object.keys(THIRTYSIX_QIN);
		expect(keys.length).toBe(12);
		keys.forEach((k) => {
			const e = THIRTYSIX_QIN[k];
			expect(typeof e.dan).toBe('string');
			expect(typeof e.zhong).toBe('string');
			expect(typeof e.mu).toBe('string');
		});
	});
	test('生肖轮位:四正在仲、四季在旦、四孟在暮(古籍分布)', () => {
		const SX = { 子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇', 午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪' };
		const zheng = ['子', '午', '卯', '酉'];   // 四正→仲
		const ji = ['丑', '辰', '未', '戌'];       // 四季→旦
		const meng = ['寅', '巳', '申', '亥'];     // 四孟→暮
		zheng.forEach((z) => expect(THIRTYSIX_QIN[z].zhong).toBe(SX[z]));
		ji.forEach((z) => expect(THIRTYSIX_QIN[z].dan).toBe(SX[z]));
		meng.forEach((z) => expect(THIRTYSIX_QIN[z].mu).toBe(SX[z]));
	});
	test('锚点逐字:子=燕鼠伏翼、巳=鳝蚯蚓蛇、亥=豕貐猪', () => {
		expect(THIRTYSIX_QIN['子']).toEqual({ dan: '燕', zhong: '鼠', mu: '伏翼' });
		expect(THIRTYSIX_QIN['巳']).toEqual({ dan: '鳝', zhong: '蚯蚓', mu: '蛇' });
		expect(THIRTYSIX_QIN['亥']).toEqual({ dan: '豕', zhong: '貐', mu: '猪' });
	});
});

describe('演禽 · 讹字归一 golden(WP-3 古籍附录B)', () => {
	test('讹字全名 → 标准全名', () => {
		const CASES = [
			['氐土骆', '氐土貉'], ['氐土络', '氐土貉'], ['氏土狢', '氐土貉'],
			['牛金羊', '牛金牛'], ['昂日鸡', '昴日鸡'], ['毕月鸟', '毕月乌'],
			['枊土獐', '柳土獐'], ['栁土獐', '柳土獐'], ['嘴火猴', '觜火猴'],
			['井木豻', '井木犴'], ['井木干', '井木犴'], ['斗木蟹', '斗木獬'],
			['壁水㺄', '壁水貐'], ['壁水狳', '壁水貐'], ['房日兎', '房日兔'], ['翌火蛇', '翼火蛇'],
		];
		CASES.forEach(([raw, std]) => {
			const r = normalizeMansion(raw);
			expect(r && r.name).toBe(std);
		});
	});
	test('🔴 鬼金羊 是定名不可误归一(与"牛金羊"讹字区分)', () => {
		expect(normalizeMansion('鬼金羊').name).toBe('鬼金羊');
	});
	test('标准全名直通 / 单字首字 / 繁体首字桥', () => {
		expect(normalizeMansion('角木蛟').name).toBe('角木蛟');
		expect(normalizeMansion('虚').name).toBe('虚日鼠');   // 单字宿
		expect(normalizeMansion('虛').name).toBe('虚日鼠');   // 繁体首字→简
		expect(normalizeMansion('昂').name).toBe('昴日鸡');   // 讹字首字
		expect(normalizeMansion('无此宿')).toBeNull();
	});
});

describe('演禽 · 十二宫字位 golden(WP-6 古籍)', () => {
	test('12 字位「贵劫文伤印权孤福寿空暗刑」+ 六吉六凶', () => {
		expect(YANQIN_12GONG_ZIWEI.map((x) => x.zi).join('')).toBe('贵劫文伤印权孤福寿空暗刑');
		const ji = YANQIN_12GONG_ZIWEI.filter((x) => x.ji).map((x) => x.zi);
		const xiong = YANQIN_12GONG_ZIWEI.filter((x) => !x.ji).map((x) => x.zi);
		expect(ji.sort()).toEqual(['贵', '文', '印', '权', '福', '寿'].sort());
		expect(xiong.sort()).toEqual(['劫', '伤', '孤', '空', '暗', '刑'].sort());
		expect(ziweiByPos(0).zi).toBe('贵');
		expect(ziweiByPos(13).zi).toBe('劫'); // 环绕
	});
});

describe('演禽 · 黄黑道/建除 golden(WP-10 古籍·可算)', () => {
	test('建除:月建位起「建」顺数(正月寅→寅日建/卯除/丑闭)', () => {
		expect(jianChu(2, 2).shen).toBe('建');
		expect(jianChu(2, 3).shen).toBe('除');
		expect(jianChu(2, 1).shen).toBe('闭');
		expect(JIANCHU_12.join('')).toBe('建除满平定执破危成收开闭');
	});
	test('黄黑道:正月(寅)青龙在子=黄道吉;寅日=天刑黑道', () => {
		const c = huangHeiDao(2, 0);
		expect(c.shen).toBe('青龙');
		expect(c.huang).toBe(true);
		const x = huangHeiDao(2, 2);
		expect(x.shen).toBe('天刑');
		expect(x.huang).toBe(false);
		expect(HUANGDAO_12SHEN.length).toBe(12);
	});
});

describe('演禽 · 古籍语料 + 克应/分类占(WP-5/7/8 数据完整性)', () => {
	test('吞啖诀十二支位 12 支齐 + 三十六禽喜好 12 支各化境+3禽', () => {
		expect(Object.keys(TUNDAN_JUE_12ZHI).length).toBe(12);
		expect(Object.keys(THIRTYSIX_XIHAO).length).toBe(12);
		Object.values(THIRTYSIX_XIHAO).forEach((e) => {
			expect(typeof e.place).toBe('string');
			expect(e.qin.length).toBe(3);
		});
	});
	test('克应妙诀 18 宿坐实(至毕) + 后10宿待校清单', () => {
		expect(Object.keys(KEYING_MIAOJUE).length).toBe(18);
		expect(KEYING_MIAOJUE['角']).toContain('雷鸣');
		expect(KEYING_MIAOJUE['毕']).toContain('轻风');
		expect(KEYING_PENDING).toEqual(['昴', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸']);
		// 待校宿确实未在坐实表中
		KEYING_PENDING.forEach((h) => expect(KEYING_MIAOJUE[h]).toBeUndefined());
	});
	test('分类占补 地理/寇盗/远行/追逃 4 类(pending 待校标记)', () => {
		const keys = FENLEI_ZHAN.map((x) => x.key);
		['dili', 'koudao', 'yuanxing', 'zhuitao'].forEach((k) => expect(keys).toContain(k));
		FENLEI_ZHAN.filter((x) => ['dili', 'koudao', 'yuanxing', 'zhuitao'].includes(x.key))
			.forEach((x) => { expect(x.pending).toBe(true); expect(x.text).toContain('待校'); });
	});
});

describe('演禽 · 定局表生成器 golden(WP-11 古籍·零新算法)', () => {
	const E = require('../yanqinEngine');
	test('日禽 60×7:甲子行=虚奎毕鬼翼氐箕、乙丑一元=危月燕', () => {
		const ri = E.dingjuRiqin();
		expect(ri.length).toBe(60);
		expect(ri[0].ganzhi).toBe('甲子');
		expect(ri[0].cells).toEqual(['虚日鼠', '奎木狼', '毕月乌', '鬼金羊', '翼火蛇', '氐土貉', '箕水豹']);
		expect(ri[1].cells[0]).toBe('危月燕');
		expect(ri.find((r) => r.ganzhi === '己酉').cells[1]).toBe('房日兔'); // 己酉二元
	});
	test('月禽 7×12:水曜正月=牛金牛、日曜正月=角木蛟', () => {
		const yue = E.dingjuYueqin('A');
		expect(yue.length).toBe(7);
		expect(yue.find((r) => r.yao === '水').cells[0]).toBe('牛金牛');
		expect(yue.find((r) => r.yao === '日').cells[0]).toBe('角木蛟');
	});
	test('年禽三元 1864-2043:三元甲子锚 1864氐/1924箕/1984虚、2008箕', () => {
		const n = E.dingjuNianqin(1864, 2043);
		expect(n.length).toBe(180);
		const at = (y) => n.find((x) => x.year === y).name;
		expect(at(1864)).toBe('氐土貉');
		expect(at(1924)).toBe('箕水豹');
		expect(at(1984)).toBe('虚日鼠');
		expect(at(2008)).toBe('箕水豹');
	});
	test('四季旺 seasonOfMansionHead:角春/奎冬/房夏/尾秋', () => {
		expect(E.seasonOfMansionHead('角')).toBe('春');
		expect(E.seasonOfMansionHead('奎')).toBe('冬');
		expect(E.seasonOfMansionHead('房')).toBe('夏');
		expect(E.seasonOfMansionHead('尾')).toBe('秋');
	});
});

describe('演禽 · 汪绂五行重配 golden(WP-17)', () => {
	const E = require('../yanqinEngine');
	const C = require('../yanqinConst');
	test('qinWuxing=wangfu:亢火/牛木 override,余宿回退七政', () => {
		const kang = C.MANSIONS.find((m) => m.name[0] === '亢');
		const niu = C.MANSIONS.find((m) => m.name[0] === '牛');
		const jiao = C.MANSIONS.find((m) => m.name[0] === '角');
		expect(E.wuxingOfMansion(kang)).toBe('金');            // 默认七政:亢金
		expect(E.wuxingOfMansion(kang, 'wangfu')).toBe('火');   // 汪绂重配:亢火
		expect(E.wuxingOfMansion(niu, 'wangfu')).toBe('木');    // 牛木
		expect(E.wuxingOfMansion(jiao, 'wangfu')).toBe('木');   // 角未重配→回退七政木
	});
});

describe('演禽 · 拆字演禽 golden(WP-20 古籍例)', () => {
	const CZ = require('../chaiziEngine');
	test('报数8·木字(横竖撇捺)→遇星斗木獬/流星女奎娄/主星觜火猴', () => {
		const r = CZ.chaiziChart(8, ['土', '木', '金', '火']);
		expect(r.yuXing.name).toBe('斗木獬');
		expect(r.liuXing.map((x) => x.name)).toEqual(['女土蝠', '奎木狼', '娄金狗', '觜火猴']);
		expect(r.zhuXing.name).toBe('觜火猴');
	});
	test('笔画配政 + 八门(开休生吉/死惊伤凶)', () => {
		expect(CZ.STROKE_TO_YAO['撇']).toBe('金');
		expect(CZ.STROKE_TO_YAO['捺']).toBe('火');
		expect(CZ.BAMEN.length).toBe(8);
		expect(CZ.BAMEN.filter((b) => b.ji === '吉').map((b) => b.name).sort()).toEqual(['休', '开', '生'].sort());
	});
});

describe('演禽 · 宿曜道三九 golden(WP-21 古籍)', () => {
	const X = require('../xiuyaoEngine');
	test('27宿去牛·昴起', () => {
		expect(X.XIUYAO_27.length).toBe(27);
		expect(X.XIUYAO_27[0]).toBe('昴');
		expect(X.XIUYAO_27.includes('牛')).toBe(false);
	});
	test('三九:昴命→业翼胎斗(每9宿)', () => {
		const sj = X.sanjiu('昴');
		expect(sj.ming).toBe('昴');
		expect(sj.ye).toBe('翼');   // 昴+9
		expect(sj.tai).toBe('斗');  // 昴+18
		expect(X.xiangXing('昴', '昴').key).toBe('命');
		expect(X.xiangXing('昴', '翼').key).toBe('業');
		expect(X.xiangXing('昴', '斗').key).toBe('胎');
	});
});
