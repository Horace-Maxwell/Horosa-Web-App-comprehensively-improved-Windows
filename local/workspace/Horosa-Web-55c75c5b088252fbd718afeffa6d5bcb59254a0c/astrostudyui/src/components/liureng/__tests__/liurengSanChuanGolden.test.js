// 大六壬 WP-0 起盘 golden（法律级零回归基线）
// ── 双重锚定 ──
//  ① 八法 parity：贼克(重审/元首)、比用、昴星(虎视/掩目)、别责、伏吟、四课、贵人 —— 与参考校验脚本 daliuren_verify.py 字节一致。
//  ② 🔴 默认涉害法 byte-lock：涉害「仅下贼上方向数克·计起点不计本家」为本默认法，
//     getSeHaiCount 当前输出在此锁死；将来追加「标准深浅两向」选项时，默认路径输出须字节不变。
//     ⚠️ 勿据 daliuren_verify.py（标准两向法）「修正」本默认向——二者是流派分歧，非 bug。
//  ③ 课经锁（Windows #46 纠正）：八专(干支同位,止两课)有克照常以克贼比涉论；无克「不复取遥克」，
//     径入八专（阳日干上神顺数三/阴日第四课上神逆数三,中末皆干上神）。
//     🔴 曾把九法列举序号(遥克4/八专9)误读为判定优先级并按其锁过金标——列举序≠判定序，勿再翻案。
jest.mock('../../../utils/helper', () => ({ randomStr: () => 'mocked', creatTooltip: () => {} }));
import ChuangChart from '../ChuangChart';
import * as LRConst from '../LRConst';

const ZiList = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const JIGONG = { 甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑' };

// 与 lrzhan/LiuRengMain.buildLiuRengLayout / buildKeData 同构：地盘=子..亥固定;天盘 upZi[i]=ZiList[(i+月将-占时)%12];四课 ke[i]=[天将,上神,下]。
function makeLayout(yue, timezi){
	const downZi = ZiList.slice(0);
	const delta = ZiList.indexOf(yue) - ZiList.indexOf(timezi);
	const upZi = ZiList.map((_, i) => ZiList[((i + delta) % 12 + 12) % 12]);
	return { downZi, upZi, houseTianJiang: LRConst.TianJiang.slice(0) };
}
function shang(lay, z){ return lay.upZi[lay.downZi.indexOf(z)]; }
function makeKe(lay, gan, zhi){
	const c1 = shang(lay, JIGONG[gan]);
	const c2 = shang(lay, c1);
	const c3 = shang(lay, zhi);
	const c4 = shang(lay, c3);
	return [['', c1, gan], ['', c2, c1], ['', c3, zhi], ['', c4, c3]];
}
function makeChart(yue, timezi, gan, zhi, seHaiOpts){
	const lay = makeLayout(yue, timezi);
	const ke = makeKe(lay, gan, zhi);
	return new ChuangChart({ owner: null, chartObj: { nongli: { dayGanZi: gan + zhi } }, nongli: { dayGanZi: gan + zhi }, ke, seHaiOpts: seHaiOpts || null, liuRengChart: lay, x: 0, y: 0, width: 0, height: 0 });
}

describe('大六壬 WP-0 · 三传九法 golden（对 daliuren_verify.py 八法 parity）', () => {
	// [标签, 月将, 占时, 日干, 日支, 期望三传(初中末)]
	const PARITY = [
		['重审 甲辰日 午将卯时', '午', '卯', '甲', '辰', ['申', '亥', '寅']],
		['涉害·见机 癸未日 辰将子时', '辰', '子', '癸', '未', ['酉', '丑', '巳']],
		['昴星·虎视 戊寅日 辰将子时', '辰', '子', '戊', '寅', ['丑', '午', '酉']],
		['昴星·冬蛇掩目 丁亥日 巳将寅时', '巳', '寅', '丁', '亥', ['午', '戌', '寅']],
		['别责·刚日 丙辰日 午将巳时', '午', '巳', '丙', '辰', ['亥', '午', '午']],
		['别责·柔日 辛酉日 戌将亥时', '戌', '亥', '辛', '酉', ['丑', '酉', '酉']],
		['伏吟·自任 甲子日 子将子时', '子', '子', '甲', '子', ['寅', '巳', '申']],
		['伏吟·自信 辛未日 子将子时', '子', '子', '辛', '未', ['未', '丑', '戌']],
	];
	PARITY.forEach(([label, yue, tm, gan, zhi, exp]) => {
		test(`${label} → 三传 ${exp.join('')}`, () => {
			const r = makeChart(yue, tm, gan, zhi).getSangCuang();
			expect(r.cuang).toEqual(exp);
		});
	});
});

describe('大六壬 WP-0 · 四课起例 golden', () => {
	const FOUR = [
		['亥将子时 甲子日', '亥', '子', '甲', '子', ['丑/甲', '子/丑', '亥/子', '戌/亥']],
		['辰将未时 癸卯日', '辰', '未', '癸', '卯', ['戌/癸', '未/戌', '子/卯', '酉/子']],
	];
	FOUR.forEach(([label, yue, tm, gan, zhi, exp]) => {
		test(`${label} 四课(一→四) ${exp.join(' ')}`, () => {
			const ke = makeKe(makeLayout(yue, tm), gan, zhi);
			expect(ke.map((k) => `${k[1]}/${k[2]}`)).toEqual(exp);
		});
	});
});

describe('大六壬 WP-0 · 🔴 默认涉害法 byte-lock（勿据标准脚本改向）', () => {
	test('见机盘(辰将子时癸未日) getSeHaiCount 逐支字节锁 + 发用=酉', () => {
		const c = makeChart('辰', '子', '癸', '未');
		// 默认法（仅下贼上方向数克·计起点不计本家）当前输出——锁死，改动后须字节不变
		expect(c.getSeHaiCount('巳')).toBe(1);
		expect(c.getSeHaiCount('酉')).toBe(4);
		expect(c.getSeHaiCount('亥')).toBe(3);
		expect(c.getSeHaiCount('卯')).toBe(0);
		const r = c.getSangCuang();
		expect(r.name).toBe('涉害课'); // 经 isJinKe* → getSeHais
		expect(r.cuang[0]).toBe('酉');  // 克数最多者(4)发用
	});
});

describe('大六壬 · 课经锁：八专无克不复取遥克（Windows #46 纠正）', () => {
	// [标签, 月将, 占时, 日干, 日支, 期望课名, 期望三传]
	const BAZHUAN = [
		// #46 实报第一例(甲寅日 2026-04-10 丑时,月将戌):两课无近克,申金虽遥克日干甲,按课经径入八专。
		// 阳日:干上神亥顺数三(亥子丑)发用丑,中末皆干上神亥。旧误判:蒿矢。
		['#46 甲寅日 戌将丑时(阳日顺数三)', '戌', '丑', '甲', '寅', '八专课', ['丑', '亥', '亥']],
		// #46 实报第二例(同日午时):日干甲虽遥克戌土,仍八专。阳日:午顺数三(午未申)发用申。旧误判:弹射。
		['#46 甲寅日 戌将午时(阳日顺数三)', '戌', '午', '甲', '寅', '八专课', ['申', '午', '午']],
		// 古籍成例:己未日辰将午时,卦得八专,三传丑巳巳(阴日:第四课上神卯逆数三 卯寅丑 发用丑,
		// 中末皆干上神巳)。此例卯木亦遥克日干己土,旧序会误发蒿矢——正是判别锚。
		['古籍成例 己未日 辰将午时(阴日逆数三)', '辰', '午', '己', '未', '八专课', ['丑', '巳', '巳']],
	];
	BAZHUAN.forEach(([label, yue, tm, gan, zhi, name, exp]) => {
		test(`${label} → ${name} ${exp.join('')}`, () => {
			const r = makeChart(yue, tm, gan, zhi).getSangCuang();
			expect(r.name).toBe(name);
			expect(r.cuang).toEqual(exp);
		});
	});
	test('八专有克照常以克贼比涉论:甲寅日 巳将子时 → 比用课 子巳戌(不入八专)', () => {
		const r = makeChart('巳', '子', '甲', '寅').getSangCuang();
		expect(r.name).toBe('比用课');
		expect(r.cuang).toEqual(['子', '巳', '戌']);
	});
});

describe('大六壬 WP-0 · 六壬法贵人=正法A(甲戊庚牛羊) parity', () => {
	const cz = (gan) => ({ nongli: { dayGanZi: `${gan}子` } });
	test('昼贵(正法A) 甲=丑 戊=丑 庚=丑 辛=午 壬=巳 癸=巳 乙=子 丙=亥 丁=亥 己=子', () => {
		const day = { 甲: '丑', 乙: '子', 丙: '亥', 丁: '亥', 戊: '丑', 己: '子', 庚: '丑', 辛: '午', 壬: '巳', 癸: '巳' };
		Object.keys(day).forEach((g) => { expect(LRConst.getGuiZi(cz(g), 0, true)).toBe(day[g]); });
	});
	test('夜贵(正法A) 甲=未 乙=申 丙=酉 丁=酉 戊=未 己=申 庚=未 辛=寅 壬=卯 癸=卯', () => {
		const night = { 甲: '未', 乙: '申', 丙: '酉', 丁: '酉', 戊: '未', 己: '申', 庚: '未', 辛: '寅', 壬: '卯', 癸: '卯' };
		Object.keys(night).forEach((g) => { expect(LRConst.getGuiZi(cz(g), 0, false)).toBe(night[g]); });
	});
});

describe('大六壬 WP-A4 · 涉害取舍流派(默认锁 + 标准/孟仲季/始入/起讫)', () => {
	test('默认 app 见机 发用酉——已固定', () => {
		expect(makeChart('辰', '子', '癸', '未').getSangCuang().cuang[0]).toBe('酉');
	});
	test('标准深浅两向(+两端皆计)见机 发用酉、涉害课(对参考脚本深浅法)', () => {
		const r = makeChart('辰', '子', '癸', '未', { method: 'standard', boundary: 'both' }).getSangCuang();
		expect(r.cuang[0]).toBe('酉');
		expect(r.name).toBe('涉害课');
		expect(r.cuang).toEqual(['酉', '丑', '巳']);
	});
	test('直取孟仲季法 不抛、出涉害子格名、三传完整', () => {
		const r = makeChart('辰', '子', '癸', '未', { method: 'mengzhongji' }).getSangCuang();
		expect(['涉害课', '见机课', '察微课', '缀瑕课']).toContain(r.name);
		expect(r.cuang).toHaveLength(3);
	});
	test('始入课单列:单一下贼上 重审→始入,发用字节不变(仅课名)', () => {
		const def = makeChart('午', '卯', '甲', '辰').getSangCuang();
		expect(def.name).toBe('重审课');
		expect(def.cuang[0]).toBe('申');
		const shi = makeChart('午', '卯', '甲', '辰', { shiRuKe: true }).getSangCuang();
		expect(shi.name).toBe('始入课');
		expect(shi.cuang).toEqual(['申', '亥', '寅']); // 发用三传不变,仅课名单列
	});
	test('起讫两端皆计 ≥ 默认(计起点不计本家):见机逐支克数(含本家端点)', () => {
		const appC = makeChart('辰', '子', '癸', '未');
		const bothC = makeChart('辰', '子', '癸', '未', { boundary: 'both' });
		['巳', '酉', '亥', '卯'].forEach((z) => {
			expect(bothC.getSeHaiCount(z, '贼')).toBeGreaterThanOrEqual(appC.getSeHaiCount(z));
		});
	});
});

describe('大六壬 WP-A2 · 新增贵人流派(B派/C派)', () => {
	const cz = (gan) => ({ nongli: { dayGanZi: `${gan}子` } });
	test('B派(甲戊兼牛羊)=正法A,唯庚改与辛同用午/寅', () => {
		// 庚:A=丑/未 → B=午/寅(与辛同)
		expect(LRConst.getGuiZi(cz('庚'), 3, true)).toBe('午');
		expect(LRConst.getGuiZi(cz('庚'), 3, false)).toBe('寅');
		// 其余九干与正法A一致
		['甲', '乙', '丙', '丁', '戊', '己', '辛', '壬', '癸'].forEach((g) => {
			expect(LRConst.getGuiZi(cz(g), 3, true)).toBe(LRConst.getGuiZi(cz(g), 0, true));
			expect(LRConst.getGuiZi(cz(g), 3, false)).toBe(LRConst.getGuiZi(cz(g), 0, false));
		});
	});
	test('C派(干合阳阴贵)阳贵起子顺/阴贵起申逆 全表', () => {
		const yang = { 甲: '未', 乙: '申', 丙: '酉', 丁: '亥', 戊: '未', 己: '子', 庚: '丑', 辛: '寅', 壬: '卯', 癸: '巳' };
		const yin = { 甲: '丑', 乙: '子', 丙: '亥', 丁: '酉', 戊: '丑', 己: '申', 庚: '未', 辛: '午', 壬: '巳', 癸: '卯' };
		Object.keys(yang).forEach((g) => {
			expect(LRConst.getGuiZi(cz(g), 4, true)).toBe(yang[g]);
			expect(LRConst.getGuiZi(cz(g), 4, false)).toBe(yin[g]);
		});
	});
	test('默认体系(星占法=2)不受影响(零回归)', () => {
		expect(LRConst.getGuiZi(cz('甲'), 2, true)).toBe('未'); // DayGui 甲=未
		expect(LRConst.getGuiZi(cz('戊'), 2, true)).toBe('午'); // 星占法 戊=午(异于 C 的未)——证未被新增覆盖
	});
});

describe('大六壬 T5 · 昼夜阳阴归属(§6.3④ 旦暮系/星历阳阴系)', () => {
	const cz = (gan) => ({ nongli: { dayGanZi: `${gan}子` } });
	test('A正法 + 阳阴系:甲乙丙辛壬癸 昼夜支互换;戊庚丁己不变', () => {
		// 旦暮系(默认)甲昼=丑;阳阴系甲昼→未(=夜支,互换)
		expect(LRConst.getGuiZi(cz('甲'), 0, true, 'danmu')).toBe('丑');
		expect(LRConst.getGuiZi(cz('甲'), 0, true, 'yinyang')).toBe('未');
		expect(LRConst.getGuiZi(cz('甲'), 0, false, 'yinyang')).toBe('丑');
		// 乙丙辛壬癸 同互换
		expect(LRConst.getGuiZi(cz('乙'), 0, true, 'yinyang')).toBe('申');
		expect(LRConst.getGuiZi(cz('辛'), 0, true, 'yinyang')).toBe('寅');
		expect(LRConst.getGuiZi(cz('癸'), 0, true, 'yinyang')).toBe('卯');
		// 戊庚丁己 不在互换列 → 不变
		expect(LRConst.getGuiZi(cz('戊'), 0, true, 'yinyang')).toBe('丑');
		expect(LRConst.getGuiZi(cz('庚'), 0, true, 'yinyang')).toBe('丑');
		expect(LRConst.getGuiZi(cz('丁'), 0, true, 'yinyang')).toBe('亥');
	});
	test('阳阴系仅作用于 A正法(guirengType=0);其他体系无效', () => {
		expect(LRConst.getGuiZi(cz('甲'), 1, true, 'yinyang')).toBe(LRConst.getGuiZi(cz('甲'), 1, true));
		expect(LRConst.getGuiZi(cz('甲'), 2, true, 'yinyang')).toBe(LRConst.getGuiZi(cz('甲'), 2, true));
	});
});

// ── 2026-07-04 词汇增强 golden:伏吟四格名(课经)+ 别责两名 ──
// 三传内容零变更(全枚举 17,280 课复扫比对为证);仅课名细化:
//   伏吟:有克=不虞 / 刚日无克=自任 / 柔日无克=自信(新) / 初传自刑=杜传(刚柔皆然)
//   别责:刚日=不备(新) / 柔日=芜淫
describe('大六壬 · 伏吟四格/别责两名 词汇 golden', () => {
	const CASES = [
		// [标签, 月将, 占时, 日干, 日支, 期望三传, 期望课名]
		['伏吟·刚日无克=自任', '子', '子', '甲', '子', ['寅', '巳', '申'], '自任课'],
		['伏吟·柔日无克=自信(原杜传名细化)', '子', '子', '辛', '未', ['未', '丑', '戌'], '自信课'],
		['伏吟·刚日初传自刑=杜传(壬寄亥,亥自刑)', '子', '子', '壬', '辰', ['亥', '辰', '戌'], '杜传课'],
		['伏吟·柔日初传自刑=杜传(亥自刑)', '子', '子', '丁', '亥', ['亥', '未', '丑'], '杜传课'],
		['伏吟·有克=不虞(课经)', '子', '子', '乙', '丑', ['辰', '丑', '戌'], '不虞课'],
		['别责·刚日=不备', '午', '巳', '丙', '辰', ['亥', '午', '午'], '不备课'],
		['别责·柔日=芜淫', '戌', '亥', '辛', '酉', ['丑', '酉', '酉'], '芜淫课'],
	];
	CASES.forEach(([label, yue, shi, gan, zhi, three, name]) => {
		it(label, () => {
			const chart = makeChart(yue, shi, gan, zhi);
			const r = chart.getSangCuang();
			expect(r.cuang).toEqual(three);
			expect(r.name).toBe(name);
		});
	});
});
