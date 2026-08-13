// 天文地占 · 中栏九式盘面 + 判读九步 + 名表体系 渲染冒烟(SSR,捕获运行时 JSX 错)。
//
// 🔴 喂给组件的是 **真服务实跑响应**(fixtures/geomancyLiveResults.json,由 :8899 逐流派抓下来),
//    不是手搓的想象形状。此前同类测试栽过一次:自造 props 形状 → 21 例全绿而真机起不了盘。
//    盘面读的字段(figure.dots / tone / displayName / sikidy.columns / hakata.tablets / ifa.odu …)
//    层级深且散,靠回忆写必错;要换新样本就重抓,别手改这个 fixture。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GeomancyMain, { buildGeomancySnapshotText } from '../GeomancyMain';
import LIVE from './fixtures/geomancyLiveResults.json';

const PROPS = { hideQuickDock: true, height: 760 };

// 直接实例化并注入 state:起盘走网络,单测不联网,故以真响应替代之。
const renderWith = (result, centerView, extra) => {
	const inst = new GeomancyMain(PROPS);
	inst.props = PROPS;
	inst.state = { ...inst.state, result, centerView, centerViewTouched: true, loading: false, ...(extra || {}) };
	return renderToStaticMarkup(inst.render());
};

const CLASSIC = LIVE.european_classical;

describe('地占 · 中栏九式盘面冒烟', () => {
	// 六式通用盘(任何流派都出) + 三式流派专属盘(其数据块在才出按钮)
	const COMMON = [
		['square', '护盾方盘', 'horosa-geomancy-shield'],
		['pyramid', '金字塔盘', 'horosa-geomancy-pyramid'],
		['wheel', '十二宫盘', 'horosa-geomancy-wheel'],
		['squarehouse', '方形宫盘', 'horosa-geomancy-square'],
		['north', '北印度式', 'horosa-geomancy-poly'],
		['medieval', '中世纪盘', 'horosa-geomancy-poly'],
	];
	COMMON.forEach(([view, label, marker]) => {
		test(`${label}(${view}) 渲染不抛且有盘面节点`, () => {
			const h = renderWith(CLASSIC, view);
			expect(h).toContain(marker);
			expect(h).toContain('horosa-geomancy-switch-btn');
		});
	});

	const SPECIAL = [
		['sikidy', 'sikidy', '异或表盘'],
		['hakata', 'hakata', '四片盘'],
		['ifa', 'ifa', '结构对照盘'],
	];
	SPECIAL.forEach(([profileKey, view, label]) => {
		test(`${label}(${view}) 在其流派下渲染不抛且按钮现身`, () => {
			const h = renderWith(LIVE[profileKey], view);
			expect(h).toContain(label);              // 该式按钮只在数据块在时才渲染
			expect(h.length).toBeGreaterThan(2000);
		});
		test(`${label} 之数据块缺席时按钮不渲染(不留死按钮)`, () => {
			expect(renderWith(CLASSIC, 'square')).not.toContain(label);
		});
	});

	test('九式在同一盘上逐一切换都不抛', () => {
		const ALL = ['square', 'pyramid', 'wheel', 'squarehouse', 'north', 'medieval', 'sikidy', 'hakata', 'ifa'];
		ALL.forEach((v) => {
			// 通用盘喂古典盘;三式专属盘各喂其流派盘 —— 交叉喂(专属视图 + 无该数据块之盘)亦须不抛。
			expect(() => renderWith(LIVE[v] || CLASSIC, v)).not.toThrow();
			expect(() => renderWith(CLASSIC, v)).not.toThrow();      // 交叉:缺数据块时退回护盾盘
		});
	});
});

describe('地占 · 判读十二步流程面板', () => {
	test('十二步全渲染且步序完整(传本解卦六步全覆盖)', () => {
		const h = renderWith(CLASSIC, 'square');
		expect(h).toContain('horosa-geomancy-flow');
		// 逐条须在(缺一即为漏接)。文案逐字取自组件本体(renderFlowChecklist),不凭印象写。
		// 🔴 传本解卦六步为:①验一宫有效 ②法庭三角 ③精准相位 ④相位 ⑤参与卦 ⑥第十六卦宣判 ——
		//    此十二步须把这六步全部覆盖,故在原九步上补「验卦盘有效」「看法庭三角」「看宣判(补卦)」三步。
		const steps = ['验卦盘有效', '定主题之宫', '取两指示星', '看法庭三角', '查完美', '查阻碍',
			'相位与同伴', '吉凶动静(位置)', '自然共主', '点之路·点数', '看宣判(补卦)', '综合断'];
		const missing = steps.filter((s) => h.indexOf(s) < 0);
		expect(missing).toEqual([]);
		expect((h.match(/horosa-geomancy-flow-step/g) || []).length).toBe(12);
		// 标题随步数自动改写,不得写死「九步」
		expect(h).toContain('判读流程 · 12步');
	});
});

describe('地占 · 名表体系切换', () => {
	test('切名表后主名随之改变(拉丁/阿拉伯/希伯来三档互异)', () => {
		const nameOf = (res) => ((res.reading || {}).judge || {}).displayName
			|| ((res.reading || {}).judge || {}).nameEn;
		const latin = nameOf(LIVE.european_classical);
		const arabic = nameOf(LIVE.names_arabic);
		const hebrew = nameOf(LIVE.names_hebrew);
		[latin, arabic, hebrew].forEach((n) => expect(typeof n === 'string' && n.length > 0).toBe(true));
		expect(new Set([latin, arabic, hebrew]).size).toBe(3);
	});
	test('三档名表之名确实上屏(护盾方盘副名槽 + 方形宫盘主名)', () => {
		// 🔴 拉丁档下 displayName === nameEn,故此断言在默认路径上与改造前逐字相同(零回归);
		//    非拉丁档下必须看到易主之名 —— 否则名表体系就是个「切了没反应」的半死开关。
		[['european_classical', 'Populus'], ['names_arabic', 'Jamaa'], ['names_hebrew', 'ʿAm']].forEach(([k, nm]) => {
			expect(renderWith(LIVE[k], 'square')).toContain(nm);         // 护盾方盘
			expect(renderWith(LIVE[k], 'squarehouse')).toContain(nm);    // 方形宫盘
		});
	});
	test('拉丁档(缺省)之护盾方盘输出与只读 nameEn 时逐字相同 —— 零回归自证', () => {
		const h = renderWith(LIVE.european_classical, 'square');
		const rd = LIVE.european_classical.reading;
		(rd.figures16 || []).forEach((f) => {
			expect(f.displayName).toBe(f.nameEn);      // 拉丁档二者同值 → 副名槽换源不改字节
		});
		expect(h).toContain('Populus');
	});
	test('AI 快照在非拉丁档下带出所选名表之名', () => {
		const latin = buildGeomancySnapshotText(LIVE.european_classical);
		const arabic = buildGeomancySnapshotText(LIVE.names_arabic);
		expect(latin).toContain('Populus');
		expect(arabic).toContain('Jamaa');
		expect(arabic).not.toBe(latin);
	});
});

describe('地占 · R0/R1 显示层不变量', () => {
	test('十二宫星座自上升起顺铺(真响应实证,非重算)', () => {
		const rd = CLASSIC.reading;
		const ORDER = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
			'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
		const signs = rd.houses.map((h) => h.sign);
		expect(signs[0]).toBe(rd.ascendantSign);
		const i0 = ORDER.indexOf(rd.ascendantSign);
		expect(signs).toEqual(ORDER.map((_, k) => ORDER[(i0 + k) % 12]));
		// 自然星座留档未丢(次要判断仍可用)
		expect(rd.houses.map((h) => h.naturalSign)).toEqual(ORDER);
	});
	test('亲缘三元七组上屏且父⊕父=子的标签逐字来自内核', () => {
		// 技法卡已迁入「判断」tab(antd 惰性挂载,未激活的 pane 不进 SSR 输出),故直查该 tab
		const inst = new GeomancyMain(PROPS);
		inst.props = PROPS;
		inst.state = { ...inst.state, result: CLASSIC, loading: false };
		const h = renderToStaticMarkup(inst.renderJudgementTab());
		expect(h).toContain('亲缘三元');
		const tri = CLASSIC.reading.technique.shield_triads;
		expect(tri).toHaveLength(7);
		expect(h).toContain(tri[6].label);            // 右证左证→判官
	});
	test('点选某组后子节点选中、两父点亮、连线描金(三者同现)', () => {
		const h = renderWith(CLASSIC, 'pyramid', { pyrSel: 'jd' });
		expect(h).toContain('is-selected');
		expect(h).toContain('is-source');
		expect(h).toContain('is-triad');             // 🔴 连线不描金则「亲缘」这层关系恰恰看不出来
		expect((h.match(/is-triad/g) || []).length).toBe(2);
	});
});

describe('地占 · B0 落星法必在四式十二宫盘上产生可见差异', () => {
	// 🔴 曾经的死开关:三态指纹全同(引擎两处旁路),且落星层只画在圆轮盘一处 ——
	//    用户停在其余八式时切落星法零反馈,看上去就是「这开关坏了」。
	const HOUSE_VIEWS = ['wheel', 'squarehouse', 'north', 'medieval'];
	const NON_HOUSE_VIEWS = ['square', 'pyramid'];
	const countPlanets = (h) => (h.match(/horosa-geomancy-house-planets/g) || []).length
		+ (h.match(/horosa-geomancy-wheel-planet/g) || []).length;

	HOUSE_VIEWS.forEach((v) => {
		test(`${v}:不落星=0 星,甲/乙各有星且两者不等`, () => {
			const seq = countPlanets(renderWith(LIVE.proj_sequential, v));
			const a = countPlanets(renderWith(LIVE.proj_astro_from_chart, v));
			const b = countPlanets(renderWith(LIVE.proj_astro_bytwelves, v));
			expect(seq).toBe(0);
			expect(a).toBeGreaterThan(0);
			expect(b).toBeGreaterThan(0);
			expect(a).not.toBe(b);     // 甲可落多宫或缺席、乙每星恰一宫 → 两法计数本就不同
		});
	});

	NON_HOUSE_VIEWS.forEach((v) => {
		test(`${v}(非宫位盘):不画星但选了落星法须给提示,不静默`, () => {
			expect(countPlanets(renderWith(LIVE.proj_astro_from_chart, v))).toBe(0);
			expect(renderWith(LIVE.proj_astro_from_chart, v)).toContain('horosa-geomancy-planet-hint');
			expect(renderWith(LIVE.proj_astro_bytwelves, v)).toContain('horosa-geomancy-planet-hint');
			// 选「不落星」时不该弹提示 —— 用户本就不要星,提示反成噪音
			expect(renderWith(LIVE.proj_sequential, v)).not.toContain('horosa-geomancy-planet-hint');
		});
	});

	test('宫位盘上永不出现该提示(它本就能画星)', () => {
		HOUSE_VIEWS.forEach((v) => {
			['proj_sequential', 'proj_astro_from_chart', 'proj_astro_bytwelves'].forEach((k) => {
				expect(renderWith(LIVE[k], v)).not.toContain('horosa-geomancy-planet-hint');
			});
		});
	});
});

describe('地占 · B3/B6 技法卡:行数恒定 + 两组分列 + 未命中不消失', () => {
	// 🔴 此前未命中即整行消失(实测 200 盘渲染率 阻碍 54.5%、中介 30%、自然共主 24%),
	//    同一卡显 11~13 行不等 —— 用户无从分辨「查过但未成立」与「根本没实现」。
	const rowCount = (h) => (h.match(/horosa-geomancy-tech-row/g) || []).length;
	const renderAux = (res) => {
		const inst = new GeomancyMain(PROPS);
		inst.props = PROPS;
		inst.state = { ...inst.state, result: res, loading: false };
		return renderToStaticMarkup(inst.renderTechniqueCard(res.reading));
	};

	test('命中项多寡不同的两盘,技法行数完全一致', () => {
		const rich = renderAux(LIVE.tech_rich);
		const sparse = renderAux(LIVE.tech_sparse);
		expect(rowCount(rich)).toBe(rowCount(sparse));
		expect(rowCount(rich)).toBeGreaterThanOrEqual(12);
	});

	test('二十一项技法逐条恒在其位(缺一即为又退回条件渲染)', () => {
		const h = renderAux(LIVE.tech_sparse);
		['完美', '阻碍', '点数是否', '应期', '数量', '点之路', '自然共主',
			'位置', '移动', '中介', '同伴', '相位', '黄道宫三方',
			// 传本补齐八项:引擎无此键的旧样本亦须显「—」而非整行消失
			'有效性', '法庭三角', '成败判定', '得地', '寻源四线', '元素法', '福点灵点', '宣判'].forEach((k) => {
			expect(h).toContain(`<span>${k}</span>`);
		});
	});

	test('未命中之项以弱化态呈现,而不是消失', () => {
		const h = renderAux(LIVE.tech_sparse);
		expect(h).toContain('is-miss');
		// 未命中之文案须是明说「无/不适用/不涉」,不能留空
		expect(/无阻碍|不适用|不涉|无同伴|无重现/.test(h)).toBe(true);
	});

	test('每行都带一句释义', () => {
		const h = renderAux(LIVE.tech_rich);
		expect((h.match(/horosa-geomancy-tech-hint/g) || []).length).toBe(rowCount(h));
	});

	test('「随问类而定」独立成组并显式加注,与随卦而变者分列', () => {
		const h = renderAux(LIVE.tech_rich);
		expect(h).toContain('horosa-geomancy-topic-group');
		expect(h).toContain('随问类而定');
		expect(h).toContain('同一问类下恒同');
		// 相位与黄道宫三方须落在该组内(组之后出现)
		const gi = h.indexOf('horosa-geomancy-topic-group');
		expect(h.indexOf('<span>相位</span>')).toBeGreaterThan(gi);
		expect(h.indexOf('<span>黄道宫三方</span>')).toBeGreaterThan(gi);
		// 「黄道宫三方」须与「亲缘三元」明确区分,不得混为一谈
		expect(h).toContain('与「亲缘三元」非同一概念');
	});

	test('B4 退化:问者宫与所问宫重合时技法卡如实标注', () => {
		const h = renderAux(LIVE.quesited_h1);
		expect(h).toContain('horosa-geomancy-coincide-note');
		expect(h).toContain('不具判别力');
		// 非退化盘不得出现该提示
		expect(renderAux(LIVE.tech_rich)).not.toContain('horosa-geomancy-coincide-note');
	});

	test('B5 退化取样:十二宫取样须标「结构恒偶」', () => {
		expect(renderAux(LIVE.parity_houses12)).toContain('结构恒偶');
		expect(renderAux(LIVE.tech_rich)).not.toContain('结构恒偶');
	});
});

describe('地占 · U1 右栏五页签各司其职', () => {
	const inst = () => { const i = new GeomancyMain(PROPS); i.props = PROPS;
		i.state = { ...i.state, result: CLASSIC, loading: false }; return i; };
	test('「判断」只出解读技法,不夹带概要/十二宫', () => {
		const h = renderToStaticMarkup(inst().renderJudgementTab());
		expect(h).toContain('解读技法');
		expect(h).not.toContain('本占概要');
		expect(h).not.toContain('图形入宫');
	});
	test('「十二宫」只出十二宫断语,不夹带技法', () => {
		const h = renderToStaticMarkup(inst().renderHousesTab());
		expect(h).toContain('图形入宫');
		expect((h.match(/horosa-geomancy-house-row/g) || []).length).toBe(12);
		expect(h).not.toContain('解读技法');
	});
	test('「解读」留概要/判定/九步,技法与十二宫已迁出', () => {
		const h = renderToStaticMarkup(inst().renderReading());
		expect(h).toContain('本占概要');
		expect(h).toContain('判定图形');
		expect(h).toContain('判读流程');
		expect(h).not.toContain('解读技法');
		expect(h).not.toContain('图形入宫');
	});
	test('读取范围门控落在各 tab 内,不是让页签消失(消失=又一处静默隐藏)', () => {
		const mk = (scope) => { const i = new GeomancyMain(PROPS); i.props = PROPS;
			i.state = { ...i.state, result: CLASSIC, loading: false, readingScope: scope }; return i; };
		expect(renderToStaticMarkup(mk('L0').renderJudgementTab())).toContain('按档隐藏');
		expect(renderToStaticMarkup(mk('L1').renderHousesTab())).toContain('切至 L3/L4');
		expect(renderToStaticMarkup(mk('L3').renderHousesTab())).toContain('图形入宫');
	});
	test('未起盘时各 tab 给明确空态而非空白', () => {
		const i = new GeomancyMain(PROPS); i.props = PROPS; i.state = { ...i.state, result: null, loading: false };
		expect(renderToStaticMarkup(i.renderJudgementTab())).toContain('请先起盘');
		expect(renderToStaticMarkup(i.renderHousesTab())).toContain('请先起盘');
	});
	test('每条判据各占一整行(单列栅格),不再两列并排', () => {
		const h = renderToStaticMarkup(inst().renderJudgementTab());
		expect(h).toContain('horosa-geomancy-tech-list');
		// 13 项旧技法 + 8 项传本补齐(有效性/法庭三角/成败判定/得地/寻源四线/元素法/福点灵点/宣判)
		expect((h.match(/horosa-geomancy-tech-row/g) || []).length).toBe(21);
	});
});

describe('地占 · S1 名表体系须抵达右栏(此前只到中栏盘面)', () => {
	// 🔴 引擎在 technique / 亲缘三元 等处一律用**拉丁标识**指代图形,
	//    故此前右栏三 tab 无论怎么切名表都纹丝不动(实测拉丁 vs 阿拉伯逐字相同)。
	const mk = (res) => { const i = new GeomancyMain(PROPS); i.props = PROPS;
		i.state = { ...i.state, result: res, loading: false }; return i; };
	const KEYS = ['european_classical', 'names_arabic', 'names_hebrew'];

	test('判断 tab(技法+三元)三档名表互异', () => {
		const outs = KEYS.map((k) => renderToStaticMarkup(mk(LIVE[k]).renderJudgementTab()));
		expect(new Set(outs).size).toBe(3);
		expect(outs[1]).toContain('Jamaa');      // 阿拉伯
		expect(outs[2]).toContain('ʿAm');        // 希伯来
		expect(outs[0]).toContain('Populus');    // 拉丁
	});
	test('十二宫 tab 三档名表互异', () => {
		const outs = KEYS.map((k) => renderToStaticMarkup(mk(LIVE[k]).renderHousesTab()));
		expect(new Set(outs).size).toBe(3);
	});
	test('解读 tab(判定图形卡)三档名表互异', () => {
		const outs = KEYS.map((k) => renderToStaticMarkup(mk(LIVE[k]).renderReading()));
		expect(new Set(outs).size).toBe(3);
	});
	test('🔴 拉丁档下 displayName === nameEn,故此改动在默认路径上不改任何字 —— 零回归自证', () => {
		const rd = LIVE.european_classical.reading;
		(rd.figures16 || []).forEach((f) => expect(f.displayName).toBe(f.nameEn));
		// 映射表在拉丁档下是恒等映射
		const inst = mk(LIVE.european_classical);
		const m = inst.figNameMap(rd);
		Object.keys(m).forEach((k) => expect(m[k]).toBe(k));
	});
});

describe('地占 · S3 四本账:AI 快照须带全本轮新字段(否则 AI 看到的与界面两样)', () => {
	const heads = (s) => (s.match(/^\[[^\]]+\]$/gm) || []);

	test('段头全部落在 aiExport 预设登记内(加段不升迁移版本;条件段按流派出)', () => {
		// 预设登记的是**所有可能**的段;快照按盘出条件段。故判据是「实出段头 ⊆ 登记段头」,
		// 而不是「每盘都出齐九段」—— 后者会把条件段(边界声明/转宫派生/定局落星)误判成缺失。
		const REGISTERED = ['判定', '解读技法', '转宫派生', '定局落星·甲', '定局落星·乙',
			'十二宫·图形入宫', '十六图形', '图形释义', '边界声明'];
		['european_classical', 'ifa', 'sikidy', 'hakata', 'names_arabic',
			'proj_sequential', 'proj_astro_from_chart', 'quesited_h1'].forEach((k) => {
			heads(buildGeomancySnapshotText(LIVE[k])).forEach((h) => {
				expect(REGISTERED).toContain(h.slice(1, -1));
			});
		});
		// 无条件段:任何盘都必出
		['[判定]', '[解读技法]', '[十六图形]'].forEach((k) => {
			expect(heads(buildGeomancySnapshotText(LIVE.european_classical))).toContain(k);
		});
		// 条件段确实会在其流派出现(不是登记了却永不产出的死段)
		expect(heads(buildGeomancySnapshotText(LIVE.ifa))).toContain('[边界声明]');
	});
	test('所问宫(B4)进快照:主宫号随之而变,退化时如实标注', () => {
		const t1 = buildGeomancySnapshotText(LIVE.quesited_h1);
		const t7 = buildGeomancySnapshotText(LIVE.european_classical);
		expect(/主宫|所问/.test(t1)).toBe(true);
		expect(t1).not.toBe(t7);
	});
	test('点数取样(B5)进快照:取样范围与退化告警都要给 AI', () => {
		const deg = buildGeomancySnapshotText(LIVE.parity_houses12);
		const ok = buildGeomancySnapshotText(LIVE.european_classical);
		expect(deg).toContain('取样');
		expect(deg).toContain('结构恒偶');
		expect(ok).toContain('取样');
		expect(ok).not.toContain('结构恒偶');
	});
	test('落星法(B0)进快照:不落星时不得凭空多出定局落星段', () => {
		const seq = heads(buildGeomancySnapshotText(LIVE.proj_sequential));
		const a = heads(buildGeomancySnapshotText(LIVE.proj_astro_from_chart));
		const b = heads(buildGeomancySnapshotText(LIVE.proj_astro_bytwelves));
		expect(seq).not.toContain('[定局落星·甲]');
		expect(seq).not.toContain('[定局落星·乙]');
		expect(a).toContain('[定局落星·甲]');
		expect(b).toContain('[定局落星·乙]');
	});
	test('黄道宫三方(C2)与名表体系(S1)进快照', () => {
		expect(buildGeomancySnapshotText(LIVE.european_classical)).toContain('黄道宫三方');
		const la = buildGeomancySnapshotText(LIVE.european_classical);
		const ar = buildGeomancySnapshotText(LIVE.names_arabic);
		expect(la).not.toBe(ar);
		expect(ar).toContain('Jamaa');
	});
	test('Bhāva(B1)进印度派快照', () => {
		const t = buildGeomancySnapshotText(LIVE.european_classical);
		expect(t).not.toContain('支名');            // 非印度派不加此列
	});
});

describe('地占 · 十二宫行:图名/副名/角色须各自独立成项(防再合回一个 nowrap span)', () => {
	const html = () => { const i = new GeomancyMain(PROPS); i.props = PROPS;
		i.state = { ...i.state, result: CLASSIC, loading: false };
		return renderToStaticMarkup(i.renderHousesTab()); };

	test('三者是兄弟元素,不是嵌在图名 span 内', () => {
		const h = html();
		// 图名 span 必须自闭于图名本身:其内不得再含副名或角色
		const figs = h.match(/<span class="horosa-geomancy-house-figure"[^>]*>([\s\S]*?)<\/span>/g) || [];
		expect(figs.length).toBe(12);
		figs.forEach((seg) => {
			expect(seg).not.toContain('horosa-geomancy-house-figure-alt');
			expect(seg).not.toContain('horosa-geomancy-house-roles');
			expect(seg).not.toContain('·问者');
			expect(seg).not.toContain('·所问');
		});
	});
	test('角色标记独立成项且只在指示星宫出现', () => {
		const h = html();
		const roleSpans = (h.match(/horosa-geomancy-house-roles/g) || []).length;
		expect(roleSpans).toBeGreaterThan(0);
		expect(roleSpans).toBeLessThanOrEqual(12);
		expect(h).toContain('·问者');
	});
	test('副名独立成项,每宫一个', () => {
		expect((html().match(/horosa-geomancy-house-figure-alt/g) || []).length).toBe(12);
	});
});

// ══════════════════════════════════════════════════════════════════════
// 传本《基础》对齐:行星地占盘 / 得地角标与时间流 / 寻源四线 / 法庭三角 /
//   地占三角两派 / 盾位十六宫 / 目录新行 / 入宫三式 / 报数
// 四份新样本(book_pchart / book_angular / book_gd / book_numbers)同为 :8897 真跑实抓。
// ══════════════════════════════════════════════════════════════════════
describe('地占 · 传本对齐:行星地占盘', () => {
	test('开盘样本才出该视图钮,未开之样本不摆死按钮', () => {
		// ⚠️ 「行星地占盘」四字左栏节标题亦有,故须只截中栏切换钮那一条(否则测的是节标题)
		const bar = (h) => (h.match(/horosa-geomancy-board-switch">([\s\S]*?)<\/div>/) || ['', ''])[1];
		expect(bar(renderWith(LIVE.book_pchart, 'square'))).toContain('行星地占盘');
		expect(bar(renderWith(CLASSIC, 'square'))).not.toContain('行星地占盘');
		expect(bar(renderWith(CLASSIC, 'square'))).toContain('护盾方盘');   // 反证:截段本身取到了
	});
	test('视图渲染:三环 + 十二宫星座 + 七政字形 + 盘心上升', () => {
		const h = renderWith(LIVE.book_pchart, 'planetwheel');
		expect(h).toContain('horosa-geomancy-wheel-svg');
		expect((h.match(/horosa-geomancy-wheel-num/g) || []).length).toBe(12);
		// 七政 + 北交南交 + 月孛三王星 = 13 枚(南交无报数,取对宫)
		expect((h.match(/horosa-geomancy-wheel-planet/g) || []).length).toBe(13);
		expect(h).toContain('上升');
		expect(h).toContain('除十二取余');
	});
	test('未开该盘时切到该视图自动回落护盾方盘(不留空盘)', () => {
		const h = renderWith(CLASSIC, 'planetwheel');
		expect(h).toContain('horosa-geomancy-shield-grid');
	});
	test('右栏落宫表逐星出报数明细,南交标明取对宫', () => {
		const inst = new GeomancyMain(PROPS);
		inst.props = PROPS;
		inst.state = { ...inst.state, result: LIVE.book_pchart, loading: false };
		const h = renderToStaticMarkup(inst.renderJudgementTab());
		expect(h).toContain('horosa-geomancy-pchart-table');
		expect(h).toContain('报数');
		expect(h).toContain('取北交对宫');
	});
});

describe('地占 · 传本对齐:盾面得地角标与时间流', () => {
	const h = () => renderWith(LIVE.book_pchart, 'square');
	test('十六格各有得地角标(不取调和者之末位除外)', () => {
		const n = (h().match(/horosa-geomancy-shield-tenancy/g) || []).length;
		expect(n).toBeGreaterThanOrEqual(15);
		expect(n).toBeLessThanOrEqual(16);
	});
	test('四档记号只用 ◎○◇✕ 四者,且带元素释义 title', () => {
		const marks = h().match(/horosa-geomancy-shield-tenancy is-(full|assist|stall|weak)"/g) || [];
		expect(marks.length).toBeGreaterThanOrEqual(15);
		expect(h()).toMatch(/入[火风水土]位/);
	});
	test('时间流三标恰三枚,且逐枚贴对其位(右证过去/左证未来/判官现在)', () => {
		const html = h();
		const marks = (html.match(/horosa-geomancy-shield-time">([^<]+)</g) || [])
			.map((x) => x.replace(/.*">/, '').replace('<', ''));
		expect(marks.sort()).toEqual(['过去', '现在', '未来'].sort());
		// 🔴 逐枚贴位(而非只看三字都在):旧 AI 文案正是把「现在」贴给了左证
		expect(html).toContain('右见证<em class="horosa-geomancy-shield-time">过去</em>');
		expect(html).toContain('左见证<em class="horosa-geomancy-shield-time">未来</em>');
		expect(html).toContain('判官<em class="horosa-geomancy-shield-time">现在</em>');
	});
});

describe('地占 · 传本对齐:寻源四线', () => {
	test('金字塔盘出四线钮,阴爻之线弱化标出', () => {
		const h = renderWith(LIVE.book_pchart, 'pyramid');
		expect(h).toContain('horosa-geomancy-pyr-lines');
		['火', '风', '水', '土'].forEach((k) => expect(h).toContain(`>${k}</button>`));
	});
	test('切线即改所示之线(默认火线,切土线文案随之)', () => {
		const fire = renderWith(LIVE.book_pchart, 'pyramid', { pyrLine: 'fire' });
		const earth = renderWith(LIVE.book_pchart, 'pyramid', { pyrLine: 'earth' });
		expect(fire).not.toBe(earth);
		expect(`${fire}${earth}`).toMatch(/线贯通|线:法官此行阴爻/);
	});
	test('技法卡「寻源四线」一行四线俱列', () => {
		const inst = new GeomancyMain(PROPS);
		inst.props = PROPS;
		inst.state = { ...inst.state, result: LIVE.book_pchart, loading: false };
		const h = renderToStaticMarkup(inst.renderTechniqueCard(LIVE.book_pchart.reading));
		expect(h).toContain('<span>寻源四线</span>');
		expect(h).toMatch(/我方|对方|不可由此寻/);
	});
});

describe('地占 · 传本对齐:法庭三角 / 地占三角 / 盾位十六宫', () => {
	const aux = (res, extra) => {
		const inst = new GeomancyMain(PROPS);
		inst.props = PROPS;
		inst.state = { ...inst.state, result: res, loading: false, ...(extra || {}) };
		return renderToStaticMarkup(inst.renderTechniqueCard(res.reading));
	};
	test('法庭三角详卡:三格时间流 + 合断文案', () => {
		const h = aux(LIVE.book_pchart);
		expect(h).toContain('horosa-geomancy-court-row');
		expect((h.match(/horosa-geomancy-court-cell/g) || []).length).toBe(3);
		expect(h).toContain('法庭三角 · 时间流');
		expect(h).toContain('勿合用');
	});
	test('未载之组合如实标出,绝不臆造断语', () => {
		const h = aux(LIVE.book_pchart) + aux(CLASSIC) + aux(LIVE.tech_rich);
		// 传本表只列十行,余者一律标未载(本仓实测 23 种可达组合中多数未载)。
		// ⚠️ 逗号须与常量同为半角 —— 全角写法曾使此断言假红。
		expect(h).toMatch(/传本表未载此组合,当具体分析|自天佑之|终吉|无成有终|井渫不食|行道偏欹/);
		// 「吉吉吉」结构不可达(全 16⁴ 穷举实证),故任何真样本都不该出现自天佑之之断
		expect(h).not.toContain('吉,自天佑之');
	});
	test('地占三角四组 + 两派含义可切且真改文字', () => {
		const a = aux(LIVE.book_pchart, { triangleSchool: 'recent' });
		const b = aux(LIVE.book_pchart, { triangleSchool: 'renaissance' });
		expect((a.match(/horosa-geomancy-triangle-row/g) || []).length).toBe(4);
		expect(a).toContain('事件目前情况');
		expect(b).toContain('事主未来的自我状况');
		expect(a).not.toBe(b);
	});
	test('盾位十六宫:十六行 + 边界警示 + 加强某宫之注', () => {
		const h = aux(LIVE.book_pchart);
		expect((h.match(/horosa-geomancy-shield16-row/g) || []).length).toBe(16);
		expect(h).toContain('不要与法庭三角、地占三角合用');
		expect(h).toContain('加强一宫');
	});
});

describe('地占 · 传本对齐:入宫三式与报数', () => {
	test('四正入宫:果宫为合成卦,页首如实交代', () => {
		const inst = new GeomancyMain(PROPS);
		inst.props = PROPS;
		inst.state = { ...inst.state, result: LIVE.book_angular, loading: false, readingScope: 'L4' };
		const h = renderToStaticMarkup(inst.renderHousesTab());
		expect(h).toContain('四正入宫式');
		expect(h).toContain('合成卦');
	});
	test('近世置换入宫:页首另有其注', () => {
		const inst = new GeomancyMain(PROPS);
		inst.props = PROPS;
		inst.state = { ...inst.state, result: LIVE.book_gd, loading: false, readingScope: 'L4' };
		expect(renderToStaticMarkup(inst.renderHousesTab())).toContain('近世学派置换入宫');
	});
	test('三式宫图真分野(顺铺 / 四正 / 近世 两两互异)', () => {
		const seq = renderWith(CLASSIC, 'squarehouse');
		const ang = renderWith(LIVE.book_angular, 'squarehouse');
		const gd = renderWith(LIVE.book_gd, 'squarehouse');
		expect(new Set([seq, ang, gd]).size).toBe(3);
	});
	test('报数样本:起卦法与所报之数如实入快照', () => {
		const s = buildGeomancySnapshotText(LIVE.book_numbers);
		expect(s).toContain('起卦=报数');
		expect(s).toContain('黄道=行星归属·乙');
		expect(s).toContain('上升=取法官之图');
	});
});

describe('地占 · 传本对齐:AI 快照六新段与时间流纠错', () => {
	const S = () => buildGeomancySnapshotText(LIVE.book_pchart);
	test('六新段段头俱在', () => {
		['[法庭三角]', '[有效性判断]', '[盾面得地]', '[元素与寻源]', '[成败与福灵点]', '[行星地占盘]']
			.forEach((k) => expect(S()).toContain(k));
	});
	test('🔴 时间流按传本:右证过去 / 法官现在 / 左证未来(旧作左证=现在,与传本相左)', () => {
		const s = S();
		expect(s).toContain('右证(过去/问者/事主)');
		expect(s).toContain('左证(未来/所问/条件环境)');
		expect(s).toContain('判官(现在)');
		expect(s).not.toContain('左证(现在/所问)');
	});
	test('元素法与得地恒随「非吉凶之判」「四档」之注,不让 AI 当吉凶用', () => {
		const s = S();
		expect(s).toContain('皆非吉凶之判');
		expect(s).toContain('全同者最强');
	});
	test('成败段恒带「只判成否」告诫;福灵点给宫位与总数', () => {
		const s = S();
		expect(s).toContain('只判成否');
		expect(s).toMatch(/福点：第 \d+ 宫/);
		expect(s).toMatch(/灵点：第 \d+ 宫/);
	});
	test('段头全部落在 aiExport 之 geomancy 预设登记内(加段不升迁移版本)', () => {
		/* eslint-disable global-require */
		const { AI_EXPORT_PRESET_SECTIONS } = require('../../../utils/aiExport');
		const reg = (AI_EXPORT_PRESET_SECTIONS || {}).geomancy || [];
		const heads = (S().match(/^\[(.+?)\]$/gm) || []).map((x) => x.slice(1, -1));
		expect(heads.length).toBeGreaterThan(0);
		heads.forEach((k) => expect(reg).toContain(k));
	});
});

describe('地占 · 左栏闭合态短名(选项被遮挡之根治)', () => {
	const mk = (res) => { const i = new GeomancyMain(PROPS); i.props = PROPS;
		i.state = { ...i.state, result: res, loading: false }; return i; };

	test('🔴 流派下拉:后端回传覆盖时短名不得丢(丢了窄屏即被省略号截断)', () => {
		// 后端只回 {id,label} 无 short —— 若直接用,闭合态就退回长名(实测 1180px 下 63/57px 被截)
		const opts = mk(CLASSIC).traditionOptions();
		expect(opts.length).toBeGreaterThanOrEqual(7);
		opts.forEach((o) => {
			expect(typeof o.label === 'string' && o.label.length > 0).toBe(true);
			expect(typeof o.short === 'string' && o.short.length > 0).toBe(true);   // 九档全有短名
			expect(o.short.length).toBeLessThanOrEqual(4);                          // 一行两个之框只容四字
		});
	});

	test('起盘前用静态表(七档,少的两档是既有约定)、起盘后随后端(九档)', () => {
		const before = mk(null).traditionOptions();
		const after = mk(CLASSIC).traditionOptions();
		expect(before.length).toBe(7);
		expect(after.length).toBe(9);
		before.forEach((o) => expect(o.short.length).toBeLessThanOrEqual(4));
	});

	test('全部选项表之短名皆 ≤5 字(闭合态方不被截)', () => {
		/* eslint-disable global-require */
		const src = require('fs').readFileSync(require.resolve('../GeomancyMain'), 'utf8');
		const shorts = (src.match(/short: '([^']+)'/g) || []).map((x) => x.replace(/short: '|'/g, ''));
		expect(shorts.length).toBeGreaterThanOrEqual(70);
		const tooLong = shorts.filter((x) => x.length > 5);
		expect(tooLong).toEqual([]);
	});

	test('高级传本闭合态为「随·短值」形态(既短又明示跟随预设)', () => {
		/* eslint-disable global-require */
		const src = require('fs').readFileSync(require.resolve('../GeomancyMain'), 'utf8');
		expect(src).toContain('`随·${this.effShort(f)}`');
		expect(src).toContain('optionLabelProp="label"');
	});
});

// ── 真实星历盘(时地真正接入后端)· 右栏两处渲染 ──
// 判据取「文案与引擎回值同源」:上升度数/象限宫制/宫头度数皆须真见于渲染,
// 且未选此档者一字不多(默认路径逐字不变)。
describe('地占 · 真实星历盘之显示', () => {
	const instFor = (sample, extraState) => {
		const inst = new GeomancyMain(PROPS);
		inst.props = PROPS;
		inst.state = { ...inst.state, result: LIVE[sample], readingScope: 'L4',
			loading: false, ...(extraState || {}) };
		return inst;
	};
	const flat = (el) => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

	test('L4 卡:上升带度分、象限用列宫制、报中天,并自陈非传本之法', () => {
		const s = flat(instFor('book_real_ephem').renderReading());
		expect(s).toMatch(/上升 射手 7°12′/);
		expect(s).toContain('已按左栏所选时地起真实星历盘');
		expect(s).toContain('列宫制');
		expect(s).toContain('中天黄经 174.15');
		expect(s).toContain('十二宫按真实宫头度数分');
		expect(s).toContain('此式非传本之法');
		// 🔴 象限宫制此前恒退化,真实盘下绝不许再出那句退化说明
		expect(s).not.toContain('退化为整宫制');
	});

	test('🔴 回落态:如实出告诫,绝不声称已按时地起盘', () => {
		const s = flat(instFor('book_real_fallback').renderReading());
		expect(s).toContain('已如实回落图形取法');
		expect(s).toContain('时地不全');
		expect(s).not.toContain('已按左栏所选时地起真实星历盘');
		// 回落之后取法名须是真正生效的那个(不是用户所选的),否则显示层撒谎
		expect(s).toContain('取第一宫之图');
	});

	test('十二宫:真实盘逐宫带宫头度数;寻常盘一个度数都不许有', () => {
		const a = flat(instFor('book_real_ephem').renderHousesTab());
		expect(a).toMatch(/射手\s*7°12′/);
		expect(a).toMatch(/摩羯\s*5°56′/);
		const b = flat(instFor('european_classical').renderHousesTab());
		expect(b).not.toMatch(/\d+°\d\d′/);
	});

	test('默认路径零回归:寻常盘 L4 卡仍是「自上升顺铺」且无一处度数', () => {
		const s = flat(instFor('european_classical').renderReading());
		expect(s).toContain('十二宫自上升起按黄道顺铺');
		expect(s).not.toContain('真实星历盘');
		expect(s).not.toMatch(/\d+°\d\d′/);
	});
});
