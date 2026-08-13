/**
 * 五兆渲染矩阵 —— 「中栏计算 ✅ + 右栏显示 ✅」逐档位实证。
 *
 * 用真实后端产出的盘(fixtures/wuzhaoPan.json,由 /wuzhao/pan 实跑抓取)喂给组件,
 * 逐个切换每个档位,断言中栏(兆图/卡片)与右栏(七页签)的渲染产物**确实随之改变**,
 * 而不是「勾了半天没反应」。渲染用 react-dom/server 静态取字符串——本仓无 DOM
 * 渲染器,而这里要验的是「产物随档位变」,静态串足以证伪死开关。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PAN from './fixtures/wuzhaoPan.json';
import WuZhaoBoard from '../WuZhaoBoard';

const GANZHI = PAN.ganzhi;
const ZHUSHU = PAN.zhushu;
const QIAN = PAN.qian;

function boardHtml(pan, beastView){
	return renderToStaticMarkup(
		<WuZhaoBoard positions={pan.positions} classic={pan.classic} beastView={beastView} />,
	);
}

function textOf(html){
	return html.replace(/<[^>]+>/g, '');
}

describe('五兆中栏渲染矩阵', () => {
	test('①兆图结构:12 支外环 + 6 乡盒 + 纳甲带', () => {
		const html = boardHtml(ZHUSHU, 'both');
		expect((html.match(/horosa-wuzhao-ring-cell/g) || []).length).toBe(12);
		expect((html.match(/horosa-wuzhao-cell(?![-a-z])/g) || []).length).toBe(6);
		expect(html).toContain('horosa-wuzhao-najia-band');
		// 十二支齐全
		'子丑寅卯辰巳午未申酉戌亥'.split('').forEach((b)=>{
			expect(textOf(html)).toContain(b);
		});
	});

	test('②乡侧与支侧各标各的纳甲干(文档:土乡书戊己而其支为火)', () => {
		const html = boardHtml(ZHUSHU, 'both');
		const tu = ZHUSHU.classic.positions[3];
		expect(tu.xiangElem).toBe('土');
		expect(tu.elem).toBe('火');
		expect(html).toContain('戊己');   // 乡侧
		expect(html).toContain('丙丁');   // 支侧
	});

	test('②b 纳甲带两路都标:乡纳甲不得因只标支而显得没用到', () => {
		const html = boardHtml(ZHUSHU, 'both');
		const band = html.split('horosa-wuzhao-najia-band')[1] || '';
		// 土乡的乡纳甲(戊午/己未 —— 甲寅旬)须带 is-used;乡侧标位名、支侧标「位名+支」
		expect(band).toMatch(/is-used[^]*?戊午/);
		expect(band).toMatch(/土乡(?!支)/);
		expect(band).toContain('木乡支');
		// 兆位只标一次,不出重复标签
		expect(band).not.toContain('兆·兆');
		expect(band).not.toContain('兆乡');
		// 空亡两支仍作虚框
		expect((band.match(/is-kongwang/g) || []).length).toBe(2);
	});

	test('③六神显示三档:游宫/行神/双显 渲染产物两两互异', () => {
		const y = boardHtml(ZHUSHU, 'yougong');
		const x = boardHtml(ZHUSHU, 'xingshen');
		const b = boardHtml(ZHUSHU, 'both');
		expect(y).not.toBe(x);
		expect(y).not.toBe(b);
		expect(x).not.toBe(b);
		// 游宫档:格内有六神名、格底无「行X」徽章
		expect(y).toMatch(/horosa-wuzhao-beast/);
		expect(y).not.toMatch(/is-xingshen/);
		// 行神档:反之
		expect(x).not.toMatch(/horosa-wuzhao-beast/);
		expect(x).toMatch(/is-xingshen/);
		// 双显:两者都有
		expect(b).toMatch(/horosa-wuzhao-beast/);
		expect(b).toMatch(/is-xingshen/);
	});

	test('④不同起兆法所得之盘,兆图产物必异(中栏真随算法变)', () => {
		const a = boardHtml(GANZHI, 'both');
		const c = boardHtml(ZHUSHU, 'both');
		const d = boardHtml(QIAN, 'both');
		expect(a).not.toBe(c);
		// 直输 [4,3,2,2,2,1] 与掷钱 [1,2,3,3,3,4] 皆得「金木火火火水」→ 六位相同,
		// 但行神月制不同(lunar vs jieqi)故徽章有别
		expect(ZHUSHU.positions.map((p)=>p.element)).toEqual(['金', '木', '火', '火', '火', '水']);
		expect(QIAN.positions.map((p)=>p.element)).toEqual(['金', '木', '火', '火', '火', '水']);
		expect(c).not.toBe(d);
	});

	test('⑤行神月制 lunar/jieqi 使行神所临之支改变(徽章随之变)', () => {
		expect(ZHUSHU.classic.monthMode).toBe('lunar');
		expect(QIAN.classic.monthMode).toBe('jieqi');
		const rowsA = ZHUSHU.classic.xingshen.rows.map((r)=>`${r.beast}${r.branch}`).join();
		const rowsB = QIAN.classic.xingshen.rows.map((r)=>`${r.beast}${r.branch}`).join();
		expect(rowsA).not.toBe(rowsB);
	});

	test('⑥年命支/性别决定行年年立出不出(留空则不臆断)', () => {
		const names = (pan)=>pan.classic.shensha.items.map((i)=>i.name);
		expect(names(ZHUSHU)).toEqual(expect.arrayContaining(['行年', '年立']));
		expect(names(GANZHI)).not.toEqual(expect.arrayContaining(['行年']));
	});

	test('⑦空盘兜底:positions 为空时出占位而非崩', () => {
		const html = renderToStaticMarkup(<WuZhaoBoard positions={[]} classic={null} beastView="both" />);
		expect(html).toContain('暂无五兆数据');
	});

	test('⑧classic 缺失(旧存案回灌)时兆图仍可渲染,不抛', () => {
		expect(()=>renderToStaticMarkup(
			<WuZhaoBoard positions={ZHUSHU.positions} classic={null} beastView="both" />,
		)).not.toThrow();
	});
});

describe('五兆右栏七页签渲染兜底', () => {
	// 直接实例化组件取 renderRightPanel 的产物：无 DOM 渲染器时这是验「七页签在
	// 空盘/旧存案下都不抛、都有兜底文案」的最直接办法。
	const WuZhaoMain = require('../WuZhaoMain').default;
	const TABS = ['overview', 'positions', 'duanci', 'junzi', 'najia', 'shensha', 'leizhan'];
	// 「古籍」页签(vendor 来源直录)已整块移除,归属声明只留 THIRD_PARTY_NOTICES.md

	function panelHtml(pan, tab){
		const inst = new WuZhaoMain({});
		inst.setState = function(patch){ this.state = { ...this.state, ...patch }; };
		inst.setState({ pan, rightPanelTab: tab });
		return renderToStaticMarkup(<div>{inst.renderRightPanel()}</div>);
	}

	test('⑰空盘(pan=null)下七页签全部可渲染且不抛', () => {
		TABS.forEach((tab)=>{
			expect(()=>panelHtml(null, tab)).not.toThrow();
			const html = panelHtml(null, tab);
			expect(html).not.toMatch(/\bundefined\b/);
			expect(html).not.toMatch(/\bNaN\b/);
		});
	});

	test('⑱旧存案(有 pan 无 classic)下七页签全部可渲染且不抛', () => {
		const legacy = { ...ZHUSHU };
		delete legacy.classic;
		delete legacy.shifaDetail;
		TABS.forEach((tab)=>{
			expect(()=>panelHtml(legacy, tab)).not.toThrow();
			const html = panelHtml(legacy, tab);
			expect(html).not.toMatch(/\bundefined\b/);
			expect(html).not.toMatch(/\bNaN\b/);
		});
		// 古法层三页须出兜底文案而非空白
		['duanci', 'junzi'].forEach((tab)=>{
			expect(panelHtml(legacy, tab)).toMatch(/暂无/);
		});
	});

	test('⑲完整盘下七页签各有实质内容(非空壳)', () => {
		TABS.forEach((tab)=>{
			const html = panelHtml(ZHUSHU, tab);
			expect(html.replace(/<[^>]+>/g, '').trim().length).toBeGreaterThan(20);
			expect(html).not.toMatch(/\bundefined\b/);
		});
	});

	test('⑳类占九门逐门切换,内容随之变(门类由左栏下拉驱动)', () => {
		const inst = new WuZhaoMain({});
		inst.setState = function(patch){ this.state = { ...this.state, ...patch }; };
		const seen = new Set();
		ZHUSHU.classic.leizhanOrder.forEach((men)=>{
			inst.setState({ pan: ZHUSHU, rightPanelTab: 'leizhan', leizhanTab: men });
			const html = renderToStaticMarkup(<div>{inst.renderRightPanel()}</div>);
			expect(html).toContain(`${men}·本盘命中`);
			expect(html).toContain('当前门类');       // 右栏只回显,不再放九个按钮
			seen.add(html);
		});
		expect(seen.size).toBe(9);   // 九门产物两两互异
	});

	test('㉑类占门类的选择器在左栏,右栏不再放九按钮组', () => {
		const src = require('fs').readFileSync(
			require('path').resolve(__dirname, '../WuZhaoMain.js'), 'utf8');
		// 左栏「断法与类占」节内须有类占门类下拉
		const section = src.split("title=\"断法与类占\"")[1].split('</XQSideSection>')[0];
		expect(section).toContain('类占门类');
		expect(section).toContain('LEIZHAN_MEN.map');
		// 右栏不得再有九门按钮组
		expect(src).not.toContain('horosa-wuzhao-men-switch');
		// 九门常量须与后端 MEN_ORDER 同序
		const men = [...src.split('const LEIZHAN_MEN = [')[1].split('];')[0]
			.matchAll(/'([^']+)'/g)].map((m)=>m[1]);
		expect(men).toEqual(['卜病', '卜官事', '卜财', '卜行人', '卜六亲',
			'卜宅田丘墓', '卜数射覆', '卜怪异', '杂卜']);
		expect(men).toEqual(ZHUSHU.classic.leizhanOrder);
	});

	test('㉒左栏「断法与类占」五项皆半宽(一行两个),长标签走短标签防截断', () => {
		const src = require('fs').readFileSync(
			require('path').resolve(__dirname, '../WuZhaoMain.js'), 'utf8');
		const section = src.split("title=\"断法与类占\"")[1].split('</XQSideSection>')[0];
		// 该节内不得再有 is-wide(否则不是一行两个)
		expect(section).not.toContain('is-wide');
		expect((section.match(/horosa-huangji-select-field/g) || []).length).toBe(5);
		// 长标签两项须用 optionLabelProp 显短标签
		expect((section.match(/optionLabelProp="label"/g) || []).length).toBe(2);
		['BEAST_VIEW_OPTIONS', 'XINGSHEN_MONTH_OPTIONS'].forEach((name)=>{
			const opts = src.split(`const ${name} = [`)[1].split('];')[0];
			expect(opts).toMatch(/short:/);
		});
	});
});

describe('五兆右栏数据源矩阵', () => {
	test('⑨十五段齐全且既有九段次第不变', () => {
		const titles = ZHUSHU.sections.map((s)=>s.title);
		expect(titles.slice(0, 9)).toEqual(
			['起盘', '揲筮', '兆', '木乡', '火乡', '土乡', '金乡', '水乡', '特殊标记']);
		expect(titles.slice(9)).toEqual(['断辞', '君子小人', '纳甲', '神煞', '行神', '类占']);
		// 逐段带 key（右栏按键分组的前提）
		ZHUSHU.sections.forEach((s)=>{ expect(typeof s.key).toBe('string'); expect(s.key).toBeTruthy(); });
	});

	test('⑩断辞页数据源:廿五式恰五条 + 兆支总断 + 候四时 + 乡支名词五格', () => {
		const c = ZHUSHU.classic;
		expect(c.duanci25).toHaveLength(5);
		c.duanci25.forEach((r)=>{ expect(r.text).toBeTruthy(); expect(r.xiang).toBeTruthy(); });
		expect(c.duanciZhaozhi.text).toBeTruthy();
		expect(c.duanciSishi.text || c.duanciSishi.missing).toBeTruthy();
		const named = c.positions.slice(1).map((p)=>(p.xiang13 || {}).name);
		expect(named.filter(Boolean)).toHaveLength(5);
	});

	test('⑪类占页:九门齐全,每门皆有通则,命中随盘而异', () => {
		const men = ZHUSHU.classic.leizhanOrder;
		expect(men).toHaveLength(9);
		men.forEach((m)=>{
			const b = ZHUSHU.classic.leizhan[m];
			expect(b).toBeTruthy();
			expect(b.texts.length).toBeGreaterThan(0);
		});
		// 不同盘的命中条目不同(否则类占是死的)
		const sig = (pan)=>JSON.stringify(Object.keys(pan.classic.leizhan).map(
			(m)=>pan.classic.leizhan[m].rules.map((r)=>r.title)));
		expect(sig(ZHUSHU)).not.toBe(sig(GANZHI));
	});

	test('⑫神煞行神页:神煞十七项级别 + 逐位所犯带来源标注', () => {
		const items = ZHUSHU.classic.shensha.items;
		expect(items.length).toBeGreaterThanOrEqual(15);
		['月大煞', '月小煞', '劫煞', '丧门', '煞阴', '驿马', '天医(左行)', '月厌', '关', '籥']
			.forEach((n)=>{ expect(items.map((i)=>i.name)).toContain(n); });
		ZHUSHU.classic.positions.forEach((p)=>{
			(p.shensha || []).forEach((h)=>{ expect(['乡', '支', '乡／支']).toContain(h.from); });
		});
	});

	test('⑬君子小人页:判据、剥落、身命、四时休王四块俱在', () => {
		const c = ZHUSHU.classic;
		expect(c.junzi.head).toBeTruthy();
		expect(c.junzi.reason).toBeTruthy();
		expect(c.junzi.boluo).toHaveProperty('hit');
		expect(c.shenming).toHaveProperty('verdict');
		expect(Object.keys(c.qi.map)).toHaveLength(5);
	});

	test('⑭纳甲页:旬/空亡/逐位乡支纳甲/细分六亲两法俱在', () => {
		const nj = ZHUSHU.classic.najia;
		expect(nj.xun).toMatch(/^甲.旬$/);
		expect(nj.kongwang.branches).toHaveLength(2);
		expect(nj.liuqinYinYang.me).toBeTruthy();
		expect(nj.liuqinGanHe.me).toBeTruthy();
		ZHUSHU.classic.positions.forEach((p)=>{
			expect(p.najia.length).toBe(2);
			expect(p.xiangNajia.length).toBe(2);
		});
	});

	test('⑮揲筮明细:掷钱盘带逐掷明细,干支盘无', () => {
		expect(QIAN.shifaDetail).toBeTruthy();
		expect(QIAN.shifaDetail.kind).toBe('qian');
		expect(QIAN.shifaDetail.rows).toHaveLength(6);
		QIAN.shifaDetail.rows.forEach((r)=>{
			expect(r).toHaveProperty('yinyang');
			expect(r).toHaveProperty('coinElement');
			expect(r).toHaveProperty('element');
		});
		expect(GANZHI.shifaDetail).toBeFalsy();
		expect(ZHUSHU.shifaDetail.kind).toBe('zhushu');
	});

	test('⑯快照含全部十五段(AI 导出与挂载的实际取数)', () => {
		const snap = ZHUSHU.snapshot;
		['起盘', '揲筮', '兆', '木乡', '火乡', '土乡', '金乡', '水乡', '特殊标记',
			'断辞', '君子小人', '纳甲', '神煞', '行神', '类占'].forEach((t)=>{
			expect(snap).toContain(`[${t}]`);
		});
		expect(snap).not.toMatch(/\bundefined\b/);
		expect(snap).not.toMatch(/\bNaN\b/);
	});
});
