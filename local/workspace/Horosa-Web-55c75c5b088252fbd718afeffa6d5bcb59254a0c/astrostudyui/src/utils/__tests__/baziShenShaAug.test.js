/**
 * 神煞补全 golden（八字大全 §5，仅收录原书给全对照表者）。
 * 金舆 §5.1 / 灾煞 §5.2 / 三奇 §5.6 / 阴差阳错 §5.8 / 十恶大败 §5.9。
 * 用构造 four（{stem:{cell},branch:{cell}}）直测 calcFourPillarShenSha。
 */
import { calcFourPillarShenSha, calcFlowShenSha } from '../baziShenShaLocal';

function P(gz){ return { stem: { cell: gz.charAt(0) }, branch: { cell: gz.charAt(1) } }; }
function four(y, m, d, t){ return { year: P(y), month: P(m), day: P(d), time: P(t) }; }

describe('八字 神煞补全（§5 完整对照表项）', () => {
	// 金舆按「日干」起 → 日主位基组。godKeyPos 默认已从「年日」改为「年」(对齐 Java GodsHelper)，
	// 日基神煞默认不出；故显式传 '年日'（=手机 APP 全集口径）测规则本身不回归，并补默认='年'锁定（日基被剔除）。
	test('金舆：甲日见辰（§5.1 甲→辰，日基→需含日主位）', () => {
		const r = calcFourPillarShenSha(four('丙子', '戊子', '甲子', '甲辰'), '年日');
		expect(r.time).toContain('金舆'); // 时支辰，日干甲
		// 新默认 '年'（年主位）→ 日干起的金舆不出。
		expect(calcFourPillarShenSha(four('丙子', '戊子', '甲子', '甲辰')).time).not.toContain('金舆');
	});

	test('金舆：丙戊同未（戊日见未，日基→需含日主位）', () => {
		const r = calcFourPillarShenSha(four('庚午', '癸未', '戊辰', '丁巳'), '年日');
		expect(r.month).toContain('金舆'); // 月支未，日干戊
	});

	test('灾煞：子年（申子辰局）见午（§5.2 → 午）', () => {
		const r = calcFourPillarShenSha(four('丙子', '甲午', '乙卯', '丁亥'));
		expect(r.month).toContain('灾煞'); // 月支午，年支子
	});

	test('灾煞：午年（寅午戌局）见子', () => {
		const r = calcFourPillarShenSha(four('丙午', '庚子', '乙卯', '丁亥'));
		expect(r.month).toContain('灾煞'); // 月支子，年支午
	});

	test('三奇（乙丙丁）：年月日干成组→标三柱、不标时柱', () => {
		const r = calcFourPillarShenSha(four('乙酉', '丙戌', '丁卯', '庚子'));
		expect(r.year).toContain('三奇');
		expect(r.month).toContain('三奇');
		expect(r.day).toContain('三奇');
		expect(r.time).not.toContain('三奇');
	});

	test('三奇（甲戊庚）：日月时干成组', () => {
		const r = calcFourPillarShenSha(four('丙子', '戊辰', '甲子', '庚午'));
		expect(r.day).toContain('三奇');
		expect(r.time).toContain('三奇');
	});

	test('阴差阳错：丙子日（§5.8）', () => {
		const r = calcFourPillarShenSha(four('甲子', '甲戌', '丙子', '戊子'));
		expect(r.day).toContain('阴差阳错');
	});

	test('十恶大败：甲辰日（§5.9）', () => {
		const r = calcFourPillarShenSha(four('甲子', '甲戌', '甲辰', '甲子'));
		expect(r.day).toContain('十恶大败');
	});

	test('不误报：庚午满盘无三奇/阴差/十恶', () => {
		const r = calcFourPillarShenSha(four('庚午', '庚辰', '庚午', '庚辰'));
		expect(r.day).not.toContain('三奇');
		expect(r.day).not.toContain('阴差阳错');
		expect(r.day).not.toContain('十恶大败');
	});

	test('既有神煞不回归：天乙等仍在', () => {
		// 甲日见丑/未为天乙贵人（既有表）
		const r = calcFourPillarShenSha(four('甲子', '丙丑', '甲子', '乙丑'));
		expect(r.month).toContain('天乙贵人');
	});

	test('天医（§5.3 月支退一位）：寅月见丑支 → 天医', () => {
		const r = calcFourPillarShenSha(four('辛丑', '庚寅', '甲子', '甲子'));
		expect(r.year).toContain('天医'); // 月寅→天医丑，年支丑
	});
	test('月德合（§5.3 衍生）：寅(午戌局)月见辛干 → 月德合', () => {
		const r = calcFourPillarShenSha(four('辛卯', '丙寅', '甲子', '己巳'));
		expect(r.year).toContain('月德合'); // 月寅→月德合辛，年干辛
	});
	test('天德合（§5.3 衍生）：寅月见壬干 → 天德合', () => {
		const r = calcFourPillarShenSha(four('壬子', '丙寅', '甲午', '己巳'));
		expect(r.year).toContain('天德合'); // 月寅→天德合壬，年干壬
	});
	test('八专（§5.10）：日柱甲寅 → 八专', () => {
		const r = calcFourPillarShenSha(four('丙子', '戊戌', '甲寅', '乙亥'));
		expect(r.day).toContain('八专');
	});
	test('九丑（§5.10）：日柱戊子 → 九丑', () => {
		const r = calcFourPillarShenSha(four('丙子', '己亥', '戊子', '壬子'));
		expect(r.day).toContain('九丑');
	});
	test('四废（§5.10）：春(寅)月庚申日 → 四废', () => {
		const r = calcFourPillarShenSha(four('丙子', '庚寅', '庚申', '丙子'));
		expect(r.day).toContain('四废');
	});

	test('流运神煞 calcFlowShenSha：日干丁见流运支酉 → 天乙/文昌', () => {
		const f = four('丙午', '甲午', '丁卯', '己酉');
		const gods = calcFlowShenSha(f, '甲', '酉'); // 流运柱 甲酉，日干丁见酉=天乙/太极/文昌
		expect(gods).toContain('天乙贵人');
		expect(gods).toContain('文昌贵人');
		// 流运查法不含 DAY_STEMS(禄神/词馆/羊刃)——不查日干禄词馆表
		expect(gods).not.toContain('禄神');
		expect(Array.isArray(gods)).toBe(true);
	});

	test('逐柱查法（丙午/甲午/丁卯/己酉，年日全集口径）', () => {
		// 逐柱组合 = 年+日全集口径 → 显式传 '年日'；时柱含灾煞(卯日→酉)。
		const r = calcFourPillarShenSha(four('丙午', '甲午', '丁卯', '己酉'), '年日');
		// §5.10 四味补全后：德秀（午月寅午戌组见丙/丁干，月令系恒查）→ 年柱(丙)/日柱(丁)各+1；
		// 天喜（午年→卯，年支系）→ 日柱(卯)+1。
		expect(r.year.slice().sort()).toEqual(['月厌', '月德贵人', '禄神', '词馆', '德秀贵人'].sort());
		expect(r.month.slice().sort()).toEqual(['太岁', '将星', '禄神', '词馆'].sort());
		expect(r.day.slice().sort()).toEqual(['太极贵人', '桃花', '德秀贵人', '天喜'].sort());
		expect(r.time.slice().sort()).toEqual(['天乙贵人', '太极贵人', '文昌贵人', '红鸾', '灾煞'].sort());
		// 关键：将星/太岁 在月柱而非年柱（原星阙统一查法会误标到年柱）
		expect(r.year).not.toContain('将星');
		expect(r.year).not.toContain('太岁');
	});

	// 新默认 godKeyPos='年'（年主位，对齐 Java GodsHelper/BaZiDirect）：日主位基组被剔除，月令系恒含。
	// 锁定与 '年日' 全集的差集 = 日干起（禄神/词馆=日干甲）、日支起（桃花=日支卯）等日基神煞不再出。
	test('新默认 godKeyPos=年（年主位）：日基神煞被剔除、月令系恒含（丙午/甲午/丁卯/己酉）', () => {
		const r = calcFourPillarShenSha(four('丙午', '甲午', '丁卯', '己酉')); // 默认 '年'
		// 月令系恒含：月厌(月支午→午)、月德贵人(月支午→丙=年干… 实为月令表) 仍在年柱。
		expect(r.year).toContain('月厌');
		expect(r.year).toContain('月德贵人');
		// 日基（日干甲起的禄神/词馆=DAY_STEMS）默认不出。
		expect(r.year).not.toContain('禄神');
		expect(r.year).not.toContain('词馆');
		// 桃花在该盘来自「年支午→卯」(YEAR_DAY_BRANCH 年支基)，属年主位 → 默认 '年' 仍保留于日柱。
		expect(r.day).toContain('桃花');
		// '年日' 全集仍含日基的禄神/词馆（证明是主位过滤、非规则丢失）。
		const full = calcFourPillarShenSha(four('丙午', '甲午', '丁卯', '己酉'), '年日');
		expect(full.year).toContain('禄神');
		expect(full.year).toContain('词馆');
		expect(full.day).toContain('桃花');
	});
});

describe('BAZI_DAY_STEMS 十干完整性硬闸(辛壬癸曾整体缺行)', ()=>{
	const { BAZI_DAY_STEMS, calcFourPillarShenSha } = require('../baziShenShaLocal');
	const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

	it('键首字覆盖十天干全集(缺任一干=该日元八类日干系神煞恒不出)', ()=>{
		const covered = new Set(Object.keys(BAZI_DAY_STEMS).map((k)=>k[0]));
		STEMS.forEach((g)=>expect(covered.has(g)).toBe(true));
	});

	it('十干皆有 学堂/词馆/禄神/羊刃(最常用四类逐干在位)', ()=>{
		const byStem = {};
		Object.keys(BAZI_DAY_STEMS).forEach((k)=>{
			const g = k[0];
			byStem[g] = (byStem[g] || []).concat(BAZI_DAY_STEMS[k]);
		});
		STEMS.forEach((g)=>{
			['学堂', '词馆', '禄神', '羊刃'].forEach((n)=>{
				expect(byStem[g]).toContain(n);
			});
		});
	});

	it('新三行抽验:壬日禄神亥/羊刃子;辛日暗禄辰(酉之六合);癸日流霞寅', ()=>{
		// '年日' 主位档:日基(禄神/羊刃等)不被默认主位过滤剔除(同上组既有范式);four() 用文件级 helper(P 包装形状)
		const r = calcFourPillarShenSha(four('壬子', '辛亥', '壬子', '辛丑'), '年日');
		expect(r.month).toContain('禄神');
		expect(r.day).toContain('羊刃');
		expect(BAZI_DAY_STEMS['辛辰']).toContain('暗禄');
		expect(BAZI_DAY_STEMS['癸寅']).toContain('流霞');
	});
});
