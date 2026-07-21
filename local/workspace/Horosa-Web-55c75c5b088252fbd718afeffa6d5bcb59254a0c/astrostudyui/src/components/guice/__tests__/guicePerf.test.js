// 皇极轨策 · 性能层金标：签名 memo + shouldComponentUpdate + 组件级 lazy。
//
// 🔴 sCU 是把双刃:少比一个键 = 「改了不重渲」(与「勾了没变」同一类用户可见病),
//    多比无害。故此处不手抄键名 —— 解析源码取 render 树真读到的 state 键,与 sCU
//    所比的键机械求差。源码一改、哨兵即知。
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', 'GuiceMain.js');
const src = fs.readFileSync(SRC, 'utf8');
const scuBody = (src.match(/shouldComponentUpdate\(nextProps, nextState\) \{[\s\S]*?\n\t\}/) || [''])[0];

describe('轨策·性能 · shouldComponentUpdate 覆盖完备(漏一键=改了不重渲)', () => {
	test('sCU 存在', () => {
		expect(scuBody).toContain('nextState');
	});

	test('🔴 组件读到的每个 state 键,sCU 都比对(机械求差,非手抄)', () => {
		// 组件全部 state 键 = 构造器里 this.state = {...} 的顶层键
		const init = (src.match(/this\.state = \{([\s\S]*?)\n\t\t\};/) || ['', ''])[1];
		// 一行可写多键(`inputs: {}, shiyingInputs: {},`)→ 须全局扫,逐行取首键会漏。
		// 只认行首或逗号后的键,免把值里的 `a: b` 也算进来。
		const stateKeys = (init.match(/(?:^|,)\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/gm) || [])
			.map((m) => m.replace(/[,:\s]/g, ''));
		expect(stateKeys.sort()).toEqual(['auxTab', 'error', 'frozenCtx', 'gua', 'inputs', 'localFields', 'settings', 'shiyingInputs']);
		const missed = stateKeys.filter((k) => !scuBody.includes(`nextState.${k}`));
		expect(missed).toEqual([]);
	});

	test('🔴 组件读到的每个 props 键,sCU 都比对(机械求差;sCU 多比无害、少比即漏)', () => {
		const propKeys = Array.from(new Set(
			(src.match(/this\.props\.([a-zA-Z][a-zA-Z0-9]*)/g) || []).map((m) => m.split('.')[2]),
		));
		expect(propKeys.length).toBeGreaterThan(0);
		expect(propKeys).toContain('value');   // ctx 之真源,必读必比
		const missed = propKeys.filter((k) => !scuBody.includes(`nextProps.${k}`));
		expect(missed).toEqual([]);
	});

	test('sCU 逐字段比对而非浅比对整个 state(setState 恒换对象,浅比对恒真=形同虚设)', () => {
		expect(scuBody).not.toMatch(/nextState !== this\.state/);
		expect(scuBody).toContain('nextState.settings !== s.settings');
	});
});

describe('轨策·性能 · 盘之签名 memo', () => {
	const body = (src.match(/getPan\(\) \{[\s\S]*?\n\t\}/) || [''])[0];
	test('getPan 以签名缓存', () => {
		expect(body).toContain('this._panKey === sig');
	});
	test('🔴 签名盖住 buildGuicePan 吃的全部四样(漏一样即改了不重算)', () => {
		// buildGuicePan({ gua, ctx, settings, shiyingInputs }) —— 四样逐一验其入签名
		expect(body).toContain('JSON.stringify(gua)');
		expect(body).toContain('JSON.stringify(ctx)');            // ctx 由排盘出:换生辰须重算
		expect(body).toContain('getGuiceOptionsKey(settings)');   // 十开关
		expect(body).toContain('JSON.stringify(shiyingInputs)');
	});
	test('🔴 签的就是用的 —— ctx 只算一次,不得签名与实参各算一遍(两次之间会漂)', () => {
		expect(body).toMatch(/const ctx = this\.ctx\(\);/);
		expect(body).toContain('buildGuicePan({ gua, ctx,');
		expect(body).not.toMatch(/ctx: this\.ctx\(\)/);
	});
});

// 🔴 ctx 的真源是 props.value.chart.nongli(排盘所出),不是 props.fields(表单字段,其上无 nongli)。
// 曾照想当然写作 props.fields.nongli.value 且八个字段名无一为真 → ctx 恒空 → 连「年月日时起例」
// 这种只需时刻的法子都报「所需之输入未足」(live 实跑抓出;jest 因喂的是自造的 fields 而全绿放过)。
// 下列键名皆经浏览器实测真对象核过,三处反直觉尤须钉死。
describe('轨策 · ctx 取数源与键名(照想当然写=起卦恒失败)', () => {
	// [X1 审计后重构] 派生逻辑移居 ctxLive();ctx() 只做「事盘冻结 ctx 优先,否则 ctxLive」分派。
	// 取形守卫改瞄 ctxLive(取数源断言不变),另钉 ctx() 的分派形状。
	const body = (src.match(/\n\tctxLive\(\) \{[\s\S]*?\n\t\}/) || [''])[0];
	const dispatchBody = (src.match(/\n\tctx\(\) \{[\s\S]*?\n\t\}/) || [''])[0];

	test('🔴 ctx() 分派:frozenCtx 优先(事盘还原不随今日盘漂移),否则 ctxLive 活派生', () => {
		expect(dispatchBody).toContain('this.state.frozenCtx');
		expect(dispatchBody).toContain('this.ctxLive()');
	});

	test('🔴 取自 props.value.chart.nongli,不得取 props.fields.nongli(fields 上压根没有 nongli)', () => {
		expect(body).toContain('this.props.value && this.props.value.chart');
		expect(body).toContain('chart.nongli');
		expect(body).not.toMatch(/props\.fields[\s\S]*nongli/);
	});

	test('🔴 时柱在 bazi.time,不在 bazi.hour(后者恒 undefined)', () => {
		expect(body).toContain("cell('time', 'branch')");
		expect(body).not.toMatch(/\bbazi\.hour\b|b\['hour'\]|b\.hour/);
		expect(body).toMatch(/\['year', 'month', 'day', 'time'\]/);
	});

	test('🔴 nongli.year 是干支(如「丙午」)非公历年 —— 公历年只能自 nongli.date 取', () => {
		expect(body).toContain('nl.date');
		expect(body).toMatch(/parseInt\(`\$\{nl\.date \|\| ''\}`\.slice\(0, 4\), 10\)/);
		expect(body).not.toMatch(/year:\s*nl\.year/);       // 拿它当公历年 = 错
		expect(body).not.toMatch(/nl\.solarYear/);          // 无此键
	});

	test('🔴 干支之字在 stem.cell / branch.cell(ganzi 是两字合文)', () => {
		expect(body).toMatch(/\[which\]\.cell/);
		expect(body).toContain("cell('year', 'branch')");
		expect(body).toContain("cell('month', 'branch')");
		expect(body).toContain("cell('day', 'stem')");
	});

	test('农历月日取 monthInt / dayInt', () => {
		expect(body).toContain('nl.monthInt');
		expect(body).toContain('nl.dayInt');
	});

	test('sCU 比 props.value(ctx 之真源;漏比则换盘不重渲)', () => {
		expect(scuBody).toContain('nextProps.value !== p.value');
	});
});

describe('轨策·性能 · 组件级 lazy(不点本页签则零成本)', () => {
	const host = fs.readFileSync(path.join(__dirname, '..', '..', 'cnyibu', 'CnYiBuMain.js'), 'utf8');
	test('GuiceMain 走 React.lazy + 具名 chunk', () => {
		expect(host).toMatch(/const GuiceMain = React\.lazy\(/);
		expect(host).toContain('webpackChunkName: "guice-main"');
		expect(host).not.toMatch(/^import GuiceMain from/m);   // 静态 import 即前功尽弃
	});
	test('lazy 处必有 Suspense 边界(否则整页白)', () => {
		expect(host).toContain('<Suspense fallback');
		expect(host).toMatch(/<Suspense fallback[\s\S]{0,200}<GuiceMain/);
	});
	// 🔴 lazy 之 ref 是【异步】挂上的 —— 容器 componentDidMount 补的那一拍跑在 chunk 解析前,
	//    彼时 ref.current 尚 null,dock 遂拿着空 config 定格:起卦/保存全不见,只剩「AI助手」
	//    (真机点开才现形;本组旧判据只验了 ref 写在 JSX 上,故当时全绿放过)。
	//    修法是 callback ref(attachChildRef):真挂上那一刻补一拍。
	test('ref 经 attachChildRef 挂(dock 靠 childRefs.guice 取 getQuickDockConfig)', () => {
		expect(host).toMatch(/<GuiceMain[\s\S]{0,80}ref=\{this\.attachChildRef\('guice'\)\}/);
	});

	test("🔴 attachChildRef 在 null→实例那一刻补拍(不补 = lazy 子页的 dock 永远是空的)", () => {
		const fn = (host.match(/attachChildRef\(key\)\{[\s\S]*?\n\t\}/) || [''])[0];
		expect(fn).toContain('const had = box.current;');
		expect(fn).toContain('if(!had && el && !this.unmounted)');
		expect(fn).toContain('this.forceUpdate()');
	});

	test('🔴 卦一变即告容器(自左栏起的卦，容器无从知晓 → dock 的「保存」恒禁用)', () => {
		expect(host).toContain('onResultChange={this.refreshDock}');
		const cdu = (src.match(/componentDidUpdate\(prevProps, prevState\) \{[\s\S]*?\n\t\}/) || [''])[0];
		expect(cdu).toContain('prevState.gua !== this.state.gua');
		expect(cdu).toContain('this.props.onResultChange()');
	});
});

// 🔴 两套宿主范式不可混:
//   · 命盘那边(KinAstroMain):宿主渲染同一组件【三次】,分别喂 slot='controls'/'center'/'aux',
//     三栏归宿主所有 → 组件按 slot 分支只出一栏。
//   · 本页签(CnYiBuMain):宿主每个 tab 只渲染其组件【一次】,不喂 slot → 组件须自出三栏。
// 照错范式 = slot 恒 undefined = 左右两栏整个不渲染,页上只剩中间(live 实跑抓出,jest 曾
// 因显式喂 slot 而全绿放过 —— 测了宿主根本不用的契约)。此哨兵机械守之。
describe('轨策 · 宿主范式相符(照错=左右两栏消失)', () => {
	const host = fs.readFileSync(path.join(__dirname, '..', '..', 'cnyibu', 'CnYiBuMain.js'), 'utf8');
	const guiceTag = (host.match(/<GuiceMain[\s\S]*?\/>/) || [''])[0];

	test('🔴 宿主确实不喂 slot(前提:喂了则本组的判据须随之改)', () => {
		expect(guiceTag).not.toMatch(/\bslot=/);
	});

	test('🔴 故组件在无 slot 时须自出三栏 —— 左(input-panel)/中(chart-stage)/右(inspector-panel)', () => {
		const render = (src.match(/\n\trender\(\) \{[\s\S]*?\n\t\}\n\}/) || [''])[0];
		expect(render).toContain('horosa-astro-input-panel');
		expect(render).toContain('horosa-chart-stage');
		expect(render).toContain('horosa-inspector-panel');
	});

	test('🔴 无 slot 之路须同时唤起控件与右栏(只唤中栏=旧病复发)', () => {
		const render = (src.match(/\n\trender\(\) \{[\s\S]*?\n\t\}\n\}/) || [''])[0];
		const tail = render.slice(render.indexOf('// 无 slot'));
		expect(tail).toContain('this.renderControls()');
		expect(tail).toContain('this.renderCenter(p)');
		expect(tail).toContain('this.renderAux(p)');
	});

	test('未起卦时三栏俱在(左栏可选法,中示空,右栏子tab常驻示占位 —— 非整页一句空话)', () => {
		const render = (src.match(/\n\trender\(\) \{[\s\S]*?\n\t\}\n\}/) || [''])[0];
		const tail = render.slice(render.indexOf('// 无 slot'));
		// 空态:左栏(控件)恒在 → 用户永远能择法起卦;中栏示空占位
		expect(tail).toMatch(/renderControls\(\)[\s\S]*p \? this\.renderCenter\(p\) : empty/);
		// 🔴 右栏改为恒渲染 renderAux —— 六目子tab常驻,未起卦各目出占位(内部 !p 守),不塌成空白(用户指示)
		expect(tail).toMatch(/\{this\.renderAux\(p\)\}/);
		expect(src).toMatch(/renderAux\(p\) \{[\s\S]*?!p \?/);
	});
});

// 🔴 右栏子tab 与「勾了没反应」之防 —— 与 zhengchuan 同则(那边先修，此处曾漏)。
//    病有二，皆 live 实跑才抓出(jest 当时全绿)：
//     ① antd Tabs 默认只渲染当前那一页 → 改了不属眼前这目的选项，右栏纹丝不动;
//     ② 「直断」是右栏默认所停之目，若某层不摄于此，开了它眼前照样不动。
describe('轨策 · 右栏六目：改任一开关，眼前之目必有动静', () => {
	const render = (src.match(/renderAux\(p\) \{[\s\S]*?\n\t\}/) || [''])[0];

	test('🔴 六目一概 forceRender（漏之即「改了不属眼前这目的选项，右栏不动」）', () => {
		const panes = src.match(/<TabPane tab="[^"]+" key="\w+"[^>]*>/g) || [];
		expect(panes.length).toBe(6);
		const noForce = panes.filter((p) => !p.includes('forceRender'));
		expect(noForce).toEqual([]);
	});

	test('🔴 直断目摄诸端之要 —— 含时方（其为默认所停之目；不摄则开了时方眼前不动）', () => {
		const ov = (src.match(/<TabPane tab="直断"[\s\S]*?<\/TabPane>/) || [''])[0];
		expect(ov).toContain("'时方'");
		expect(ov).toContain('p.shiFang');
		// 并摄演数/体用/十应之要（此前已修，一并守住）
		["'体用'", "'四位之卦'", "'十应'", "'主客'"].forEach((k) => expect(ov).toContain(k));
	});
});
