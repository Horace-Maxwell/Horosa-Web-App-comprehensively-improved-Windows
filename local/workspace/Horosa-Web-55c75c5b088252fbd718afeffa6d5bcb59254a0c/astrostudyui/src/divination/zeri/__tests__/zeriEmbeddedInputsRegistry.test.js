// 择日九个内嵌宿主 × 内嵌页上「能改、或会影响盘」的每一项:逐个表态它在择日里怎么办(所见 = 所判)。
// 可改的排盘口径(六壬 / 太乙 / 三式 / 奇门四页,pageSettingsRegistry 里的键)另见 zeriTechniqueParity 的 EMBED_CALIBRE;
// 这里管另外两类,键全集由合同机械列出(漏表态 = 红,表里多了不存在的键 = 红):
//   ① 逐盘输入与页面状态(构造出来的内嵌页初始 state 的全部键,扣掉 pageSettingsRegistry 已表态的);
//   ② 不在 pageSettingsRegistry 里的五个宿主的口径全集:八字 = 源码里读到的 baziOpt 键;紫微 = 紫微排盘设置单例的全部键;
//      七政 / 印度 = 宿主交给内嵌页的 fields 全键 ∪ 内嵌页初始 state;黄历 = 内嵌页初始 state。
// 类别:
//   page / workbench / locked —— 同 EMBED_CALIBRE(page 键登记在 zeriPageCalibre 的 *_PAGE_SCAN_KEYS);
//   natal    —— 有用事人本命时点结果行随本命回写(逐盘输入:卜卦人出生 / 性别);
//   base     —— 宿主按工作台时段 / 地点 / 点选时刻给的底板(左栏亲手改只进覆盖层,点结果行清空);
//   pinned   —— 宿主钉成扫描口径的固定档(扫描后端不收这一项;左栏亲手改只进覆盖层,点结果行回到钉值);
//   derived  —— 算出来的结果 / 中间态(不是输入);ui —— 页签 / 展开 / 尺寸 / 显示开关;container —— 装着别的键的容器(键另核);
//   note     —— 页面没有这一项的位置,只在工作台注明;
//   [exempt, 理由] —— 能改但不改变判定,写明理由。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
jest.mock('../../../utils/request', () => jest.fn(() => new Promise(() => {})));
global.React = require('react');
const fs = require('fs');
const path = require('path');
const { PAGE_SETTINGS_REGISTRY } = require('../../../utils/pageSettingsRegistry');
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');
const { ZIWEI_PAGE_SCAN_KEYS, BAZI_PAGE_SCAN_KEYS } = require('../zeriPageCalibre');

const SRC = path.join(__dirname, '..', '..', '..');
const ex = (why)=>['exempt', why];
const CATS = ['page', 'workbench', 'locked', 'natal', 'base', 'pinned', 'derived', 'ui', 'container', 'note', 'exempt'];
const catOf = (v)=>(Array.isArray(v) ? v[0] : v);
const each = (keys, cat)=>keys.reduce((acc, k)=>{ acc[k] = cat; return acc; }, {});
const BASE_FIELDS = ['date', 'time', 'ad', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'pos', 'gender', 'timeAlg'];

const REGISTRY = {
	liureng: {
		birth: 'natal', calcBirth: 'natal',
		liureng: 'derived', runyear: 'derived', calcFields: 'base', calcChart: 'derived',
		wuxingUserSet: ex('只记十二长生五行是否亲手选过(右栏长生表);择日条件不判长生'),
		rightPanelTab: 'ui', pinnedXiang: 'ui',
	},
	taiyi: {
		options: 'container', loading: 'ui', nongli: 'derived', nongliSig: 'derived', pan: 'derived', schoolOverrides: 'derived', rightPanelTab: 'ui', selectedPalace: 'ui',
	},
	sanshiunited: {
		options: 'container', localFields: 'base', plottedFields: 'base',
		...each(['loading', 'hasPlotted', 'rightPanelTab', 'liurengRefTab', 'bagongSubTab', 'taiyiSubTab', 'bagongPalace', 'leftBoardWidth', 'leftBoardHeight', 'viewportHeight', 'rightPanelHeight'], 'ui'),
		...each(['nongli', 'displaySolarTime', 'liureng', 'dunjia', 'taiyi', 'castChart', 'lessonSig', 'lrLayout', 'keData', 'sanChuan', 'liurengRefBundle', 'liurengSnapshotInput'], 'derived'),
		// 三式盘没有卜卦人出生:六壬家「年命」按起盘年支显示,本命组条件按工作台本命判 —— 工作台本命旁注明(SanshiZeriWorkbench)
		'@nianMing': 'note',
	},
	dunjia: {
		options: 'container', localFields: 'base',
		...each(['loading', 'hasPlotted', 'rightPanelTab', 'bagongPalace', 'showPatternInterpretation', 'leftBoardWidth', 'leftBoardHeight', 'viewportHeight'], 'ui'),
		...each(['nongli', 'displaySolarTime', 'pan', 'panSig'], 'derived'),
	},
	bazi: {
		baziOpt: 'container',
		...each(['result', 'currentBaziKey', 'directResult', 'directKey', 'directLoading', 'directError'], 'derived'),
		chartStyle: 'ui', flowSelection: 'ui',
		...each(BAZI_PAGE_SCAN_KEYS, 'page'),
		cangVersion: ex('只改五行力量打分(月令加权);择日条件不判五行力量,藏干条件按藏干名单判'),
		fenyeVersion: ex('同上:分野版本只进五行力量'),
		dayunPrecision: ex('只改大运起运精度;择日条件只判候选时刻四柱'),
		zodiacBoundary: ex('只改生肖显示的年界;择日条件不判生肖'),
		school: ex('流派只改右栏判读与盘式外观(纯重绘)'),
		shenshaGroups: ex('神煞显示分组;择日神煞条件按自己的神煞表判'),
		...each(['ageStyle', 'onlyZiGanShen', 'showRelations', 'showSchoolMarks', 'showShenSha', 'showXiaoyun', 'uiMode'], 'ui'),
	},
	ziwei: {
		...each(['result', 'rules', 'indicator', 'cnt', 'tips', 'tonglianHi'], 'derived'),
		...each(['centerInfoVisible', 'dualView', 'luckSel'], 'ui'),
		// horosa_freeze_subtabs_v1(Windows 侧移植适配):我方把紫微右栏四页签改成受控(FreezeSubTab 冻结非激活页签),
		// 当前页签记在 state.rightTab —— 只决定右栏显示哪一页,不进起盘 / 扫描请求。
		rightTab: 'ui',
		...each(ZIWEI_PAGE_SCAN_KEYS, 'page'),
		brightnessSource: ex('亮度条件按基表值判;亮度源只改显示层增减'),
		liunianSihuaGan: ex('流年四化取干是运限推演层;择日条件只判候选时刻的本命盘'),
		liuYueBasis: ex('同上:流月起法是运限推演层'),
		...each(['childLimit', 'zhongxian', 'huoPan', 'qishuWei', 'borrowPalace', 'taiSuiRuGua', 'flowShenshaOnChart', 'flowHuoLing', 'flowLuanXi'], ex('显示层叠加(不改安星)')),
		taiSuiRelatives: ex('紫云关系人只用于显示叠加'),
	},
	qizheng: {
		...each(BASE_FIELDS, 'base'),
		doubingSu28: 'workbench', guolaoNodeType: 'workbench', guolaoLilithType: 'workbench',   // 宿度制 / 罗计 / 月孛 = 工作台三参数(扫描后端只收这三项)
		...each(['guolaoAyanamsa', 'guolaoAyanamsaPageOnly', 'guolaoBodyMode', 'guolaoEqTropicalAnchor', 'guolaoGufaPrecess', 'guolaoLifeMasterMode', 'guolaoLifeMode',
			'guolaoMinorLimitType', 'guolaoNodeMode', 'guolaoTongxianBase', 'guolaoTrueSolarTime', 'guolaoTuibianMethod', 'houseStartMode', 'szshape', 'after23NewDay', 'lateZiHourUseNextDay'], 'pinned'),
		name: ex('盘名是显示'),
		...each(['tradition', 'strongRecption', 'simpleAsp', 'virtualPointReceiveAsp'], ex('西占相位 / 接纳规则只进内嵌页的相位显示;七政择日条件不判这些')),
		// ── 内嵌七政页自己的 state ──
		engineMode: 'locked', chartStyle: 'locked',   // 引擎锁星阙七政(QIZHENG_ZERI_LOCKED);盘式里「坚七政」= 另一套引擎,随之不可选,其余盘式同一张盘只换渲染
		kinastroOptions: ex('只给「坚七政」引擎用;引擎在择日里锁定星阙七政'),
		...each(['qizhengKinPan', 'qizhengKinLoading', 'qizhengKinError'], ex('「坚七政」引擎的结果;引擎在择日里锁定星阙七政')),
		qizhengKinActiveTab: 'ui',
		...each(['chartObj', 'moiraTransitChartObj', 'moiraRules', 'moiraPanelChartObj', 'moiraPanelTransitChartObj', 'moiraPanelTransitParams', 'electionData', 'electionDeclOutOfRange', 'tips'], 'derived'),
		...each(['moiraTransitLoading', 'moiraLoading', 'bundleLoading', 'electionLoading', 'moiraQuickDialog', 'moiraStyleLevel', 'showMoiraTransitGods', 'guolaoDisplay'], 'ui'),
		moiraTransitTime: ex('流年流曜时刻只进流年盘;择日条件判候选时刻的本盘'),
		electionOptions: ex('「天星择日」盘式的西占附图选项(分宫制 / 容许度等);七政择日条件按七政引擎判,不读这一份'),
		eleLifeMode: ex('「天星择日」盘式的立命时刻;七政择日条件的命宫按候选时刻上升'),
	},
	india: {
		...each(BASE_FIELDS, 'base'),
		indiaAyanamsa: 'workbench', indiaNodeType: 'workbench',   // 岁差制 / 交点 = 工作台参数(扫描后端只收这两项)
		name: ex('盘名是显示'),
		...each(['tradition', 'strongRecption', 'simpleAsp', 'virtualPointReceiveAsp'], ex('西占相位 / 接纳规则只进内嵌页的相位显示;印度择日条件不判这些')),
		// ── 内嵌印度页自己的 state ──
		indiaAyanamsaValue: 'workbench', indiaNodeTypeValue: 'workbench',   // 左栏亲手改的覆盖值:点结果行由 hook.applyZeriCalibre 按工作台值回写
		indiaHsysValue: 'locked',   // 分宫制锁整宫(INDIA_ZERI_LOCKED;扫描自 Lagna 按整宫数宫)
		indiaSchool: ex('流派预设只改可见页签与相位范式;它带来的岁差在点结果行时按工作台值回写,宫制在择日里切派时就保持锁定值'),
		indiaAspectParadigm: ex('相位范式只进页上相位显示;印度择日条件不判相位'),
		indiaAspectSource: ex('相位来源只进页上相位显示'),
		indiaNakshatraCount: ex('27 / 28 宿只改表上是否加 Abhijit(纯显示,不下发);择日 Nakshatra 条件按 27 宿'),
		indiaLagnaRef: ex('分盘的参照命宫只改显示旋转;择日 Lagna 条件按候选时刻上升'),
		...each(['dashaSystem', 'dashaSeed', 'indiaDashaYearLength', 'indiaDashaVariants', 'indiaSthiraStart'], ex('大运推演层;择日条件只判候选时刻的盘')),
		...each(['indiaVargaVariantMap', 'indiaKarakaScheme', 'indiaYuddhaCriterion', 'indiaAnnualChartType', 'indiaStageMode', 'indiaTripatakiOn', 'indiaTripatakiCenter', 'indiaTripatakiMonth', 'indiaSbcFocus', 'indiaShowRiskFactors', 'indiaOverlayBB', 'indiaTransitDateValue', 'indiaTajakaYearValue', 'tajakaYearInput'], ex('分盘 / 年运 / 专题面板的选项与输入;择日条件只判 Panchanga 五肢 / Lagna / 曜位 / 日段 / 本命月')),
		...each(['prasnaNumber', 'prashnaCast', 'prashnaNumberInput', 'prashnaMatterInput', 'prashnaSchoolsInput', 'prashnaCuspModeInput', 'prashnaPrimaryHouseInput'], ex('卜问(Prashna)是每一问的输入;择日条件不判')),
		...each(['rectifyDrawerOpen', 'rectifyRunning', 'rectifyResult', 'rectifyWindowMinutes', 'rectifyStepSeconds', 'rectifyRpSource'], ex('校时工具的输入 / 结果;择日不用')),
		...each(['currentTab', 'currentFractal', 'jyotishTab', 'visibleTabKeys', 'dashaPopoverItem', 'dashaPopoverStyle', 'dashaExpandedKey', 'dashaExpandedAntarKey', 'dashaDrillPath', 'kpFullTableOpen', 'kpFullTablePage', 'degreeDisplayMode', 'indiaPlanetDisplayMode', 'indiaCounterClockwise', 'vargaSetOpen', 'vargaSetFractals', 'dashaLoading', 'dashaUpdating'], 'ui'),
		...each(['dashaChartObj', 'lastChartObj', 'dashaFieldsKey', 'dashaChartKey', 'mainChartObj', 'mainChartKey', 'activeJyotishFields', 'activeJyotishKey', 'hook'], 'derived'),
	},
	huangli: {
		...each(['date', 'selectedYmd', 'selectedDay', 'focus', 'days', 'prevDays', 'yearPanelOpen', 'yearPanelSeen'], 'ui'),
		lon: ex('只改黄历页时辰表的地方时显示;黄历择日条件按工作台时段逐日判,流派是每条条件自己的参数'),
	},
};

function mkPage(mod, scope, extra){
	const C = require(mod).default;
	return new C({ hook: {}, techniqueScope: scope, fields: null, ...(extra || {}) });
}
function registryKeys(page){
	const e = PAGE_SETTINGS_REGISTRY.find((r)=>r.page === page);
	return e ? new Set([...e.fields, ...Object.keys(e.exempt || {})]) : new Set();
}
// 八字:源码里读到的 baziOpt 键(组件目录全集)
function baziOptKeys(){
	const dir = path.join(SRC, 'components', 'cntradition');
	const keys = new Set();
	fs.readdirSync(dir).filter((f)=>/\.js$/.test(f)).forEach((f)=>{
		const t = fs.readFileSync(path.join(dir, f), 'utf8');
		for(const m of t.matchAll(/baziOpt\)?\.(\w+)/g)){ keys.add(m[1]); }
	});
	return keys;
}
const UNIVERSE = {
	liureng: ()=>{ const reg = registryKeys('liureng'); return Object.keys(mkPage('../../../components/lrzhan/LiuRengMain', 'liurengzeri').state).filter((k)=>!reg.has(k)); },
	taiyi: ()=>{ const reg = registryKeys('taiyi'); return Object.keys(mkPage('../../../components/taiyi/TaiYiMain', 'taiyizeri').state).filter((k)=>!reg.has(k)); },
	sanshiunited: ()=>{ const reg = registryKeys('sanshiunited'); return [...Object.keys(mkPage('../../../components/sanshi/SanShiUnitedMain', 'sanshizeri').state).filter((k)=>!reg.has(k)), '@nianMing']; },
	dunjia: ()=>{ const reg = registryKeys('dunjia'); return Object.keys(mkPage('../../../components/dunjia/DunJiaMain', 'qimenzeri').state).filter((k)=>!reg.has(k)); },
	bazi: ()=>[...new Set([...Object.keys(mkPage('../../../components/cntradition/BaZi', 'bazizeri').state), ...baziOptKeys()])],
	ziwei: ()=>[...new Set([...Object.keys(mkPage('../../../components/ziwei/ZiWeiMain', 'ziweizeri').state), ...Object.keys(require('../../../components/ziwei/ziweiOptions').ZWEngineOptions)])],
	qizheng: ()=>[...new Set([...Object.keys(new (require('../../../components/zeri/QizhengZeriMain').default)({}).buildFields(false)), ...Object.keys(mkPage('../../../components/guolao/GuoLaoChartMain', 'qizhengzeri').state)])],
	india: ()=>[...new Set([...Object.keys(new (require('../../../components/zeri/IndiaZeriMain').default)({}).buildFields(false)), ...Object.keys(mkPage('../../../components/astro/IndiaChartMain', 'indiazeri').state)])],
	huangli: ()=>Object.keys(mkPage('../../../components/calendar/HuangLiMain', 'huanglizeri').state),
};

describe('择日九个内嵌宿主 × 内嵌页每一项都表了态', ()=>{
	test.each(Object.keys(UNIVERSE))('%s:未登记即红、登记表不过期、豁免必写理由', (page)=>{
		const keys = UNIVERSE[page]();
		expect(keys.length).toBeGreaterThan(3);   // 判据自证:机械列出的全集不是空的
		const table = REGISTRY[page];
		expect(keys.filter((k)=>!(k in table))).toEqual([]);
		expect(Object.keys(table).filter((k)=>keys.indexOf(k) < 0)).toEqual([]);
		Object.keys(table).forEach((k)=>{
			expect([k, CATS.indexOf(catOf(table[k])) >= 0]).toEqual([k, true]);
			if(catOf(table[k]) === 'exempt'){ expect(`${table[k][1] || ''}`.length).toBeGreaterThan(4); }
		});
	});
	test('九个宿主都在表内(新宿主必须表态)', ()=>{
		const dir = path.join(SRC, 'components', 'zeri');
		const hosts = fs.readdirSync(dir).filter((f)=>/.ZeriMain\.js$/.test(f));
		expect(hosts.length).toBe(Object.keys(UNIVERSE).length);
	});
	test('page 类与代码里的单源表一致', ()=>{
		const pick = (page)=>Object.keys(REGISTRY[page]).filter((k)=>catOf(REGISTRY[page][k]) === 'page').sort();
		expect(pick('bazi')).toEqual([...BAZI_PAGE_SCAN_KEYS].sort());
		expect(pick('ziwei')).toEqual([...ZIWEI_PAGE_SCAN_KEYS].sort());
	});
	test('natal 类:六壬宿主点结果行经 hook.applyBirth 回写(行为用例见 liurengZeriNatalWriteback)', ()=>{
		const t = fs.readFileSync(path.join(SRC, 'components', 'zeri', 'LiurengZeriMain.js'), 'utf8');
		expect(t).toContain("if(birth && h && typeof h.applyBirth === 'function'){ jobs.push(h.applyBirth(birth)); }");
		expect(readSource(path.join(SRC, 'components', 'lrzhan', 'LiuRengMain.js'))).toContain('this.props.hook.applyBirth = (birthFields)=>');   // 门面按全集读
	});
	test('印度:点结果行按工作台值回写岁差制 / 交点、分宫制回整宫;分宫制控件在择日里置灰', async ()=>{
		const host = new (require('../../../components/zeri/IndiaZeriMain').default)({});
		host.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } };
		let got = null;
		host.indiaHook = { applyZeriCalibre: (p)=>{ got = p; return Promise.resolve(); }, fun: jest.fn() };
		host._scanOptions = { ayanamsa: 'raman', nodeType: 'true' };
		await host.applyWorkbenchCalibre();
		expect(got).toEqual({ indiaAyanamsa: 'raman', indiaNodeType: 'true', indiaHsys: 0 });
		// 点结果行:先回写口径,再起盘
		const order = [];
		host.indiaHook = { applyZeriCalibre: ()=>{ order.push('calibre'); return Promise.resolve(); }, fun: ()=>{ order.push('plot'); } };
		host.onPickInterval({ start: '2026-03-01 10:00', pick: '2026-03-01 10:00' });
		await Promise.resolve(); await Promise.resolve();
		expect(order).toEqual(['calibre', 'plot']);
		const hook = {};
		const page = mkPage('../../../components/astro/IndiaChartMain', 'indiazeri', { hook });
		page.setState = function(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } };
		page.state = { ...page.state, indiaAyanamsaValue: 'kp', indiaHsysValue: 3 };
		await hook.applyZeriCalibre(got);
		expect([page.state.indiaAyanamsaValue, page.state.indiaNodeTypeValue, page.state.indiaHsysValue]).toEqual(['raman', 'true', 0]);
		const t = readSource(path.join(SRC, 'components', 'astro', 'IndiaChartMain.js'));
		expect(t).toContain("disabled={!!zeriLockProps(this.props.zeriLocked, 'indiaHsys', indiaHsys, this.props.zeriRestoredLocks).disabled}");
		expect(fs.readFileSync(path.join(SRC, 'components', 'zeri', 'IndiaZeriMain.js'), 'utf8')).toContain('zeriLocked={INDIA_ZERI_LOCKED}');
	});
	test('七政:择日内嵌页锁星阙七政引擎(本机记忆是坚七政也不进;切不过去)', ()=>{
		const { GUOLAO_CHART_STYLE_QIZHENG, GUOLAO_CHART_STYLE_KEY, getStoredGuolaoChartStyle } = require('../../../components/guolao/GuoLaoChartStyle');
		window.localStorage.setItem(GUOLAO_CHART_STYLE_KEY, GUOLAO_CHART_STYLE_QIZHENG);
		const { QIZHENG_ZERI_LOCKED } = require('../zeriPageCalibre');
		expect(getStoredGuolaoChartStyle()).toBe(GUOLAO_CHART_STYLE_QIZHENG);   // 判据自证:本机记忆确是坚七政
		const unlocked = mkPage('../../../components/guolao/GuoLaoChartMain', 'qizhengzeri');
		expect(unlocked.state.engineMode).toBe('kinastro');   // 不锁时会进另一套引擎
		const page = mkPage('../../../components/guolao/GuoLaoChartMain', 'qizhengzeri', { zeriLocked: QIZHENG_ZERI_LOCKED });
		expect(page.state.engineMode).toBe('horosa');
		expect(page.state.chartStyle).not.toBe(GUOLAO_CHART_STYLE_QIZHENG);
		page.setState = jest.fn();
		page.onChartStyleChange(GUOLAO_CHART_STYLE_QIZHENG);
		page.onEngineModeChange('kinastro');
		expect(page.setState).not.toHaveBeenCalled();
		window.localStorage.clear();
		expect(fs.readFileSync(path.join(SRC, 'components', 'zeri', 'QizhengZeriMain.js'), 'utf8')).toContain('zeriLocked={QIZHENG_ZERI_LOCKED}');
		expect(fs.readFileSync(path.join(SRC, 'components', 'guolao', 'GuoLaoInput.js'), 'utf8')).toContain("disabled={!!zeriLockProps(this.props.zeriLocked, 'engineMode', engineMode, null).disabled}");
	});
	test('note 类:三式工作台本命旁注明年命口径', ()=>{
		expect(fs.readFileSync(path.join(SRC, 'components', 'zeri', 'SanshiZeriWorkbench.js'), 'utf8')).toContain('点开的三式盘上「年命」是起盘年支');
	});
});
