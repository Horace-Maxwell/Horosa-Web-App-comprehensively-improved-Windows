import { Component, createRef } from 'react';
import { Row, Col, Slider, InputNumber, Empty, Collapse, Tooltip } from 'antd';
import { XQButton, XQToggle, XQSegmented, XQSelect, XQTabs } from '../xq-ui';
import FengShuiEngine, { MARKER_TYPES, BAGUA_MARKER_TYPES, DISK_SKINS } from './fengshuiEngine';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markInteractionStart, markPanelReady } from '../../utils/perfMark';
import LiqiWorkspace, { SCHOOL_CN } from './LiqiWorkspace';

const { TabPane } = XQTabs;

// horosa_panel_scu_v1:风水页【零消费】props.fields / chartObj(见 constructor 的 chartFree
// 契约注释:全页走本地 fengshuiEngine / LiqiWorkspace)。但父链每次 dva dispatch 都会把这个
// 600+ 行的组件连同画布工具栏、左栏面板、判定/卦象长列表整体重渲一遍。下面的 sCU 只放行
// 「自身 state 变了」或「除 fields 外的 props 变了」。
// 🔴 若日后本页开始在 render 里读 props.fields,必须把它从排除表里拿掉(否则改时间不更新)。
const FS_IGNORED_PROPS = { fields: 1, fieldsAry: 1 };
function fsShouldUpdate(prevProps, nextProps, prevState, nextState) {
	const pk = Object.keys(prevProps);
	const nk = Object.keys(nextProps);
	if (pk.length !== nk.length) { return true; }
	for (let i = 0; i < nk.length; i++) {
		const k = nk[i];
		if (FS_IGNORED_PROPS[k]) { continue; }
		if (prevProps[k] !== nextProps[k]) { return true; }
	}
	// state 逐键引用比较。vm 每次都是 engine.getViewModel() 新建的对象字面量(无就地变异),
	// controlTab/workspaceTab/school 是字符串 → 引用比较即可,不会漏更新。
	const ps = Object.keys(prevState || {});
	const ns = Object.keys(nextState || {});
	if (ps.length !== ns.length) { return true; }
	for (let i = 0; i < ns.length; i++) {
		const k = ns[i];
		if (!prevState || prevState[k] !== nextState[k]) { return true; }
	}
	return false;
}
const { Option } = XQSelect;
const { Panel } = Collapse;

const MODE_OPTIONS = [
	{ value: 'naqi', label: '纳气盘法' },
	{ value: 'bagua', label: '八卦阳宅法' },
];

// 理气/水法/大卦/形势/择日 —— 纯前端流派（不依赖户型图，走 LiqiWorkspace）。
const LIQI_SCHOOLS = ['bazhai', 'xuankong', 'sanhe', 'jinsuo', 'qiankun', 'zibai', 'fuxing', 'jingyin', 'dagua', 'xingshi', 'zeri'];
const LIQI_SET = new Set(LIQI_SCHOOLS);
const SCHOOL_GROUPS = [
	{ label: '户型图阳宅（标注）', items: [
		{ value: 'naqi', label: '纳气盘法' },
		{ value: 'bagua', label: '八卦阳宅法' },
	] },
	{ label: '理气起盘（罗盘）', items: [
		{ value: 'bazhai', label: '八宅 · 大游年' },
		{ value: 'xuankong', label: '玄空飞星' },
		{ value: 'sanhe', label: '三合 · 十二长生水法' },
		{ value: 'jinsuo', label: '金锁玉关' },
		{ value: 'qiankun', label: '乾坤国宝' },
		{ value: 'zibai', label: '紫白飞星' },
	] },
	{ label: '水法 · 翻卦', items: [
		{ value: 'fuxing', label: '辅星水法 · 翻卦九星' },
		{ value: 'jingyin', label: '净阴净阳 · 纳甲水法' },
	] },
	{ label: '易卦 · 形势 · 择日', items: [
		{ value: 'dagua', label: '玄空大卦 · 六十四卦' },
		{ value: 'xingshi', label: '形势 · 龙穴砂水向' },
		{ value: 'zeri', label: '择日 · 年神/造命' },
	] },
];

const FILTERS = [
	{ key: 'all', label: '全部' },
	{ key: 'ok', label: '位置合适' },
	{ key: 'wind-bad', label: '气位冲突' },
	{ key: 'water-bad', label: '水位冲突' },
	{ key: 'unknown', label: '未定位' },
];

const TIPS = [
	'楼门朝向以卫星地图为准，门内朝门外，记录真北角度。',
	'家门方向在户型图上画出，令两箭头平行后再判定。',
	'房屋主体以矩形为准，扩大范围导致空缺大于实体时不再扩大。',
	'盘心放在太极点，八方颜色与数字即可判断气位与水位。',
];

const BAGUA_TIPS = [
	'先框选房屋（盘心＝整层正中／太极点），再填一个「正北方向」度数即可起盘。',
	'点左栏角色或格局，再到户型图上点对应位置，自动判卦，无需填表。',
	'成員以「在家中的名分」为准：有子女＝父/母，未婚长子女＝长子/长女，依兄姐婚况顺延。',
	'卦象、应期、升降、四类象吉凶都会自动在右侧「卦象」面板生成。',
];

const MEMBER_RULE = '成員以在家中的「名分」定卦（传统八卦阳宅法）：① 有子女→父(乾)/母(坤)（含已婚之夫/妻、未婚生子、离婚有子）；② 未婚第一子/女→长子(震)/长女(巽)；③ 自己未婚、上有 1 个未婚兄/姐→次子(坎)/次女(离)；④ 上有 2 个未婚兄/姐→三子(艮)/三女(兑)；⑤ 兄姐婚嫁后排序顺延（如姐出嫁，次女升长女）；⑥ 子女多于三者「三个一组」循环对应 1·4 / 2·5 / 3·6（即第 4 子当长子、第 4 女当长女）。';

// 传统八卦阳宅·判定方法与特例。
const BAGUA_METHODS = [
	'取卦法：名在上（人在家名分之本命卦）× 位在下（卧房在整层正中·太极点所看的方位卦）→ 得一 64 卦，依此卦之卦象读断其人事吉凶。',
	'成員定義：有子女＝父(乾)/母(坤)；未婚第一子女＝长子(震)/长女(巽)；自己未婚、上有 1 未婚兄/姐＝次子(坎)/次女(离)，上有 2 个＝三子(艮)/三女(兑)；兄姐婚嫁后顺延。',
	'三个一组：子女多于三者按 1·4 / 2·5 / 3·6 循环对应——第 4 子当长子、第 4 女当长女，以此类推。',
	'四个儿子之源：夫命有二子、妻命有二子，合为四子，故子或貌似父、或貌似母（命理统计之经验）。',
	'成格逢三：3 天~3 月起效、3 月~3 年、最慢 6 年成格；凶宅多在第三年应灾（皆“三”字出头）。',
	'形神论：名＝位（同卦）主家和万事兴；居父母位者心态早熟（男居西北乾多晚婚）。',
	'排位升降：父1 母2 长子3 长女4 次子5 次女6 三子7 三女8——居较长位则升官发财/婚期提前，居较幼位则延后。',
	'四类象：厨房＝刀象（此卦家人易血光，宜调灶口避正向）；厕所＝浊气（此卦家人易气病/破财/口舌）；客厅＝客象（聚少离多）；卧房＝即宫位（在此排 64 卦）。',
	'缺角断法：缺角超过三分之一，则该卦位对应之家人待不住此宅（如西南缺→母待不住）；宜先补全为方正再从中心测向。',
	'一层一论断：只计睡人之层；一层有厨房、另层睡人无厨房，则只算睡人那层。',
	'方位特法：东南角(巽)宜嫁女、代表无婚之女将很快出嫁；西北角(乾)为夫妻一世之位，缺则难得丈夫助力；求子东往北主生男、东往南主生女；床位脚朝吉（延年）方利健康。',
	'三代同堂：长子娶媳后父母退位、住三子之位（天山遁/屯，退隐之象），以子女之耐心奉养父母即为孝。',
];

const CENTER_OPTIONS = [
	{ value: 'house', label: '房屋中心' },
	{ value: 'door', label: '入户门' },
	{ value: 'custom', label: '自定义点' },
	{ value: 'marker', label: '选中标记' },
];

const PERIOD_OPTIONS = [
	{ value: 'current', label: '1964-2044' },
	{ value: 'reversed', label: '2044-2124' },
];

const TAG_LABEL = { auspicious: '吉', mild: '小吉', neutral: '中性', caution: '宜慎' };

class FengShuiMain extends Component {
	constructor(props) {
		super(props);
		this.state = { vm: null, controlTab: 'base', workspaceTab: 'canvas', school: 'naqi' };
		this.canvasRef = createRef();
		this.fileInputRef = createRef();
		this.rootRef = createRef();   // horosa_panel_ready_v1:endSpan 的「本页当前可见吗」判据
		this.engine = null;
		this.resizeObserver = null;
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.handleKeyDown = this.handleKeyDown.bind(this);
		this.onVm = this.onVm.bind(this);
		this.beginSpan = this.beginSpan.bind(this);
		this.onRootPointerDown = this.onRootPointerDown.bind(this);
		this.onControlTab = this.onControlTab.bind(this);
		this.onWorkspaceTab = this.onWorkspaceTab.bind(this);
		// horosa_panel_ready_v1:本页的交互计时【只由本页自己开启、也只由本页自己收尾】。
		// 本组件是 keep-alive 常驻挂载的:用户切到别的技法后,ResizeObserver / 图片 onload
		// 仍会 emit vm。若无条件收尾,会把别的技法正在计时的那次交互记成风水的 —— 观测被污染。
		this._spanOpen = false;

		if(this.props.hook){
			// horosa_chart_free_declared_v1(PERF-R9 Ship 7 接线)—— 本行是本文件的 Windows overlay
			// 改动标记:下面这条 `hook.chartFree = true` 声明 + utils/techniqueChartFree.js 的同名
			// 登记,两者缺一即哨兵/契约测试红。Mac 同步冲掉它 = 风水页退回「等一次 /chart」。
			// 🔴 chartFree 契约(PERF-R9 Ship 7 接线):风水页【零】消费共享 chartObj —— 全页
			// 走本地 fengshuiEngine / LiqiWorkspace,只吃 fields。此前本页连 hook 都没接,
			// 于是「无从声明」;现在接上 hook 只为承载这条声明(不注册 .fun ——本页不需要
			// 命令式刷新,fields 从 props 直达)。声明后 fetchByFields 对本页走快车道:
			// fields 立即提交、不等 /chart 网络。
			// 若日后本页开始读 props.value/chartObj,必须删掉此行(有静态哨兵机械核)。
			this.props.hook.chartFree = true;
		}
	}

	componentDidMount() {
		const canvas = this.canvasRef.current;
		if (!canvas) return;
		this.engine = new FengShuiEngine(canvas, { onChange: this.onVm });
		const host = canvas.parentElement;
		if (host && 'ResizeObserver' in window) {
			this.resizeObserver = new ResizeObserver(() => this.engine && this.engine.resize());
			this.resizeObserver.observe(host);
		}
		setTimeout(() => this.engine && this.engine.resize(), 0);
		window.addEventListener('keydown', this.handleKeyDown);
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
	}

	componentDidUpdate(prevProps, prevState) {
		if (prevState.workspaceTab !== 'canvas' && this.state.workspaceTab === 'canvas') {
			setTimeout(() => this.engine && this.engine.resize(), 0);
		}
	}

	componentWillUnmount() {
		if (this.resizeObserver) this.resizeObserver.disconnect();
		window.removeEventListener('keydown', this.handleKeyDown);
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		if (this.engine) this.engine.destroy();
	}

	// horosa_panel_ready_v1:交互起点。挂在本页根节点的 pointerdown 捕获上 —— 本页几乎所有
	// 控件(快捷条/滑块/调色板/画布)都是「点一下 → 引擎 setXxx → emit(vm) → setState」这条同步链,
	// 所以「按下」就是 owner 口径里的那个「点击」。
	beginSpan() {
		this._spanOpen = true;
		markInteractionStart('fengshui');
	}

	// 根节点 pointerdown 捕获。理气派(LiqiWorkspace)自己维护 state、不经 onVm,
	// 本组件收不到它的「画完」信号 —— 在那些流派下不开计时,免得留一个永不收尾的悬空起点
	// 把后续某次 vm 记成超长样本。(换流派本身由 onSchoolChange 单独开计时,不受影响。)
	onRootPointerDown() {
		if (LIQI_SET.has(this.state.school)) { return; }
		this.beginSpan();
	}

	// horosa_panel_ready_v1:终点。只有本页自己开过计时才收尾(见 constructor 的 _spanOpen 注释)。
	// 🔴 _spanOpen 单独一个闸【不够】:pointerdown 打开的计时若那一下没产生 vm(点在空白处、
	// 点「上传户型图」后取消对话框…),这个起点就一直挂着;等用户切到别的技法、别处正在计时时,
	// 本页迟到的一次 emit(图片 onload 等)会把【别人】的 stepT0 消费掉 —— 既污染风水样本,
	// 又让那个技法自己的 markPanelReady 变成空操作(perfMark 里 stepT0 一次性消费)。
	// 故再加一道:本页 DOM 当前不可见(顶层页签切走 → 面板 display:none → 零 client rect)时,
	// 只关闸不记数。
	endSpan() {
		if (!this._spanOpen) { return; }
		this._spanOpen = false;
		const root = this.rootRef.current;
		if (root && typeof root.getClientRects === 'function' && root.getClientRects().length === 0) {
			return;   // 本页已被切走/隐藏,这次 emit 不是用户看得见的「画完」
		}
		markPanelReady('fengshui');
	}

	onControlTab(k) {
		this.beginSpan();
		this.setState({ controlTab: k }, ()=> this.endSpan());
	}

	onWorkspaceTab(k) {
		this.beginSpan();
		this.setState({ workspaceTab: k }, ()=> this.endSpan());
	}

	onVm(vm) {
		// vm 落定 = 快捷条 + 左栏面板 + 判定/卦象右栏的数据源全部就位（本页渲染纯派生自 vm）。
		this.setState({ vm }, ()=> this.endSpan());   // horosa_panel_ready_v1
		// 🔴 理气/新派激活时，画布引擎(display:none 仍挂载)因 ResizeObserver 等仍会 emit vm；
		// 不可让其画布快照覆盖 LiqiWorkspace 维护的当前流派快照(否则 AI 导出取到纳气盘而非当前理气派)。
		if (vm && vm.snapshotText && !LIQI_SET.has(this.state.school)) {
			saveModuleAISnapshot('fengshui', vm.snapshotText, { source: 'react', savedAt: Date.now() });
		}
	}

	handleKeyDown(e) { if (this.engine) this.engine.handleKey(e); }

	handleSnapshotRefreshRequest(evt) {
		if (!evt || !evt.detail || evt.detail.module !== 'fengshui') return;
		// 理气派：快照由 LiqiWorkspace 实时维护，勿用画布引擎覆盖；回填现有快照供同步刷新路径取用。
		if (LIQI_SET.has(this.state.school)) {
			const existing = loadModuleAISnapshot('fengshui');
			if (existing && existing.content && typeof evt.detail === 'object') evt.detail.snapshotText = existing.content;
			return;
		}
		if (!this.engine) return;
		const text = this.engine.buildAiSnapshotText();
		if (text) {
			saveModuleAISnapshot('fengshui', text, { source: 'react', savedAt: Date.now() });
			if (typeof evt.detail === 'object') evt.detail.snapshotText = text;
		}
	}

	onFile(e) {
		// horosa_panel_ready_v1:选图这条链是【异步且含用户时间】(点按钮 → 系统文件对话框 →
		// 选中 → 解码 → onload → emit)。按钮上的 pointerdown 早已开了计时,若让 onload 的
		// emit 去收尾,记下的是「对话框停留时长」这种几十秒的垃圾样本,会直接顶爆风水的 max/p95。
		// 这里先关闸:上传路径不参与「点击→画完」的测量(它本来也不是 owner 验收口径里的单次操作)。
		this._spanOpen = false;
		const file = e.target.files && e.target.files[0];
		if (file && this.engine) this.engine.loadImageFile(file);
		e.target.value = '';
	}

	// 流派切换：理气派走纯前端 LiqiWorkspace；户型图两法同步引擎 techMode 并重算画布尺寸。
	onSchoolChange(v) {
		this.beginSpan();   // horosa_panel_ready_v1 配对起点(换流派 = 改选项)
		this.setState({ school: v }, ()=> this.endSpan());
		if (v === 'naqi' || v === 'bagua') {
			if (this.engine) {
				this.engine.setTechMode(v);
				setTimeout(() => this.engine && this.engine.resize(), 0);
			}
		}
	}

	renderQuickbar(vm) {
		const e = this.engine;
		const dis = !vm.imgLoaded;
		const isNaqi = vm.techMode !== 'bagua';
		const isLiqi = LIQI_SET.has(this.state.school);
		return (
			<div className="horosa-fengshui-quickbar">
				{!isLiqi ? (
					<>
						<XQButton type="primary" size="small" onClick={() => this.fileInputRef.current && this.fileInputRef.current.click()}>上传户型图</XQButton>
						<XQButton size="small" disabled={dis} onClick={() => e.startDrawRect()}>框选房屋</XQButton>
						{isNaqi
							? <XQButton size="small" disabled={dis} onClick={() => e.startDrawDoor()}>画入户门</XQButton>
							: <XQButton size="small" disabled={dis} onClick={() => e.startBaguaNorth()}>画正北</XQButton>}
						<XQButton size="small" disabled={dis} onClick={() => e.startPlaceMarker()}>放置标记</XQButton>
						<XQButton size="small" variant="ghost" disabled={!vm.canUndo} onClick={() => e.undo()}>撤销</XQButton>
						<XQButton size="small" variant="ghost" disabled={!vm.canRedo} onClick={() => e.redo()}>重做</XQButton>
						<XQButton size="small" variant="ghost" disabled={dis} onClick={() => e.exportPng()}>导出 PNG</XQButton>
					</>
				) : (
					<span className="horosa-fengshui-liqi-quickhint">理气起盘 · {SCHOOL_CN[this.state.school] || ''} — 在左栏设定坐向/元运即时排盘（无需户型图）</span>
				)}
				<div className="horosa-fengshui-quickbar-center">
					<XQSelect size="small" value={this.state.school} onChange={(v) => this.onSchoolChange(v)} dropdownMatchSelectWidth={false} style={{ minWidth: 148 }}>
						{SCHOOL_GROUPS.map((g) => (
							<XQSelect.OptGroup key={g.label} label={g.label}>
								{g.items.map((it) => <Option key={it.value} value={it.value}>{it.label}</Option>)}
							</XQSelect.OptGroup>
						))}
					</XQSelect>
				</div>
				<span className="horosa-fengshui-status">{isLiqi ? '理气盘 · 纯坐向/元运起盘' : vm.status}</span>
			</div>
		);
	}

	renderSkinField(vm) {
		const e = this.engine;
		return (
			<div className="horosa-fengshui-field">
				<label>盘面样式</label>
				<XQSelect size="small" style={{ width: '100%' }} value={vm.diskSkin} onChange={(v) => e.setDiskSkin(v)}>
					{DISK_SKINS.map((s) => <Option key={s.key} value={s.key}>{s.label}</Option>)}
				</XQSelect>
			</div>
		);
	}

	renderExportSection(vm) {
		const e = this.engine;
		const dis = !vm.imgLoaded;
		return (
			<>
				<div className="horosa-fengshui-card-title" style={{ marginTop: 12 }}>导出</div>
				<div className="horosa-fengshui-btn-row">
					<XQButton size="small" disabled={dis} onClick={() => e.exportPng()}>视图 PNG</XQButton>
					<XQButton size="small" variant="ghost" disabled={dis} onClick={() => e.exportReportPng()}>报告 PNG</XQButton>
					<XQButton size="small" variant="ghost" disabled={dis} onClick={() => e.exportReportPdf()}>报告 PDF</XQButton>
				</div>
			</>
		);
	}

	// ── 纳气盘法 · 基础（图片/房屋/角度/门向/盘面/家具标注 + 导出）──
	renderNaqiBasePanel(vm) {
		const e = this.engine;
		const dis = !vm.imgLoaded;
		return (
			<div className="horosa-fengshui-card">
				<div className="horosa-fengshui-card-title">图片与房屋</div>
				<div className="horosa-fengshui-btn-row">
					<XQButton onClick={() => this.fileInputRef.current && this.fileInputRef.current.click()}>上传户型图</XQButton>
					<XQButton variant="ghost" disabled={dis} onClick={() => e.startDrawRect()}>框选房屋</XQButton>
					<XQButton variant="ghost" disabled={dis} onClick={() => e.resetRect()}>重置</XQButton>
				</div>
				<div className="horosa-fengshui-field">
					<label>矩形旋转角度</label>
					<div className="horosa-fengshui-dual">
						<Slider min={-45} max={45} step={0.5} value={vm.rectRotation} onChange={(v) => e.setRectRotation(v)} disabled={dis} style={{ flex: 1 }} />
						<InputNumber size="small" step={0.5} value={vm.rectRotation} onChange={(v) => e.setRectRotation(v)} disabled={dis} />
					</div>
				</div>
				<div className="horosa-fengshui-card-title" style={{ marginTop: 12 }}>角度与门向</div>
				<div className="horosa-fengshui-field">
					<label>单元门真北角度 (0-360°)</label>
					<InputNumber size="small" style={{ width: '100%' }} placeholder="例如 58.5" step={0.1} value={vm.unitAzimuth} onChange={(v) => e.setUnitAngle(v)} />
				</div>
				<div className="horosa-fengshui-field">
					<label>入户门方向 (0-360°)</label>
					<InputNumber size="small" style={{ width: '100%' }} step={1} value={vm.doorImageAngle} onChange={(v) => e.setDoorAngle(v)} />
					<XQButton variant="ghost" style={{ marginTop: 6 }} disabled={dis} onClick={() => e.startDrawDoor()}>在图上画入户门方向</XQButton>
				</div>
				<div className="horosa-fengshui-stats">
					<span>单元门 <strong>{vm.unitAngleText}</strong></span>
					<span>入户门 <strong>{vm.doorAngleText}</strong></span>
					<span>盘旋转 <strong>{vm.diskRotationText}</strong></span>
				</div>
				{this.renderSkinField(vm)}
				<div className="horosa-fengshui-card-title" style={{ marginTop: 12 }}>家具与设施标注</div>
				<div className="horosa-fengshui-field">
					<label>选择标记类型</label>
					<XQSelect size="small" style={{ width: '100%' }} value={vm.markerType} onChange={(v) => e.setMarkerType(v)}>
						{MARKER_TYPES.map((t) => {
							const tag = t.category === 'wind' ? '气' : t.category === 'water' ? '水' : '观';
							return <Option key={t.id} value={t.id}>{`${t.label}（${tag}）`}</Option>;
						})}
					</XQSelect>
				</div>
				<div className="horosa-fengshui-btn-row">
					<XQButton disabled={dis} onClick={() => e.startPlaceMarker()}>放置标记</XQButton>
					<XQButton variant="ghost" disabled={dis} onClick={() => e.clearMarkers()}>清空标记</XQButton>
				</div>
				<div className="horosa-fengshui-helper">点击画布放置，拖动可调整位置。</div>
				{this.renderExportSection(vm)}
			</div>
		);
	}

	renderDiskPanel(vm) {
		const e = this.engine;
		return (
			<div className="horosa-fengshui-card">
				<div className="horosa-fengshui-card-title">纳气盘</div>
				<div className="horosa-fengshui-field">
					<label>透明度 <span className="horosa-fengshui-inline-val">{Math.round(vm.globalAlpha * 100)}%</span></label>
					<Slider min={0.2} max={0.95} step={0.05} value={vm.globalAlpha} onChange={(v) => e.setOpacity(v)} />
				</div>
				<div className="horosa-fengshui-field">
					<label>盘大小 <span className="horosa-fengshui-inline-val">{Math.round(vm.diskScale * 100)}%</span></label>
					<Slider min={1} max={1.6} step={0.05} value={vm.diskScale} onChange={(v) => e.setDiskScale(v)} />
				</div>
				<div className="horosa-fengshui-field">
					<label>盘中心位置</label>
					<XQSegmented value={vm.diskCenterMode} options={CENTER_OPTIONS} onChange={(ev) => e.setDiskCenterMode(ev.target.value)} />
					<div className="horosa-fengshui-helper">自定义点：选「自定义」后按住 Shift 在画布点击设定。</div>
				</div>
				<div className="horosa-fengshui-field">
					<label>运期模式</label>
					<XQSegmented value={vm.periodMode} options={PERIOD_OPTIONS} onChange={(ev) => e.setPeriodMode(ev.target.value)} />
					<div className="horosa-fengshui-helper">2044 后风水位置反转：气位与水位互换。</div>
				</div>
			</div>
		);
	}

	// ── 八卦阳宅法 · 基础（极简：上传/朝向一度数/盘面/成員·格局调色板 + 导出）──
	renderBaguaBasePanel(vm) {
		const e = this.engine;
		const dis = !vm.imgLoaded;
		const members = BAGUA_MARKER_TYPES.filter((t) => t.kind === 'member');
		const features = BAGUA_MARKER_TYPES.filter((t) => t.kind === 'feature');
		const chip = (t) => (
			<button
				key={t.id}
				type="button"
				className={`horosa-fengshui-chip${vm.markerType === t.id ? ' active' : ''}`}
				style={{ '--chip': t.color }}
				disabled={dis}
				onClick={() => { e.setMarkerType(t.id); e.startPlaceMarker(); }}
			>{t.label}</button>
		);
		return (
			<div className="horosa-fengshui-card">
				<div className="horosa-fengshui-card-title">户型图</div>
				<div className="horosa-fengshui-btn-row">
					<XQButton onClick={() => this.fileInputRef.current && this.fileInputRef.current.click()}>上传户型图</XQButton>
					<XQButton variant="ghost" disabled={dis} onClick={() => e.startDrawRect()}>框选房屋</XQButton>
					<XQButton variant="ghost" disabled={dis} onClick={() => e.resetRect()}>重置</XQButton>
				</div>
				<div className="horosa-fengshui-field">
					<label>正北方向 (0-360°)</label>
					<div className="horosa-fengshui-dual">
						<InputNumber size="small" style={{ flex: 1 }} placeholder="例如 0 / 90" step={1} value={vm.baguaOrient} onChange={(v) => e.setBaguaOrient(v)} />
						<XQButton size="small" variant="ghost" disabled={dis} onClick={() => e.startBaguaNorth()}>图上画</XQButton>
					</div>
					<div className="horosa-fengshui-helper">盘旋转 <strong>{vm.diskRotationText}</strong>，盘心＝房屋正中（太极点）。盘面样式与透明度见「罗盘」页。</div>
				</div>
				<div className="horosa-fengshui-card-title" style={{ marginTop: 12 }}>
					成員
					<Tooltip title={MEMBER_RULE} overlayStyle={{ maxWidth: 320 }}>
						<span className="horosa-fengshui-help">?</span>
					</Tooltip>
				</div>
				<div className="horosa-fengshui-palette">{members.map(chip)}</div>
				<div className="horosa-fengshui-card-title" style={{ marginTop: 10 }}>四类象格局</div>
				<div className="horosa-fengshui-palette">{features.map(chip)}</div>
				<div className="horosa-fengshui-helper">点角色/格局，再到户型图上点对应位置即自动判卦。</div>
				<div className="horosa-fengshui-btn-row" style={{ marginTop: 6 }}>
					<XQButton variant="ghost" disabled={dis} onClick={() => e.clearMarkers()}>清空本盘标记</XQButton>
				</div>
				{this.renderExportSection(vm)}
			</div>
		);
	}

	// ── 八卦阳宅法 · 罗盘（盘面样式 + 透明度 + 大小）──
	renderBaguaDiskPanel(vm) {
		const e = this.engine;
		return (
			<div className="horosa-fengshui-card">
				<div className="horosa-fengshui-card-title">罗盘</div>
				{this.renderSkinField(vm)}
				<div className="horosa-fengshui-helper" style={{ marginTop: 0, marginBottom: 12 }}>绘制盘＝引擎绘制；纳气罗盘 / 二十四山阳宅图＝透明底图叠加，可作底盘对位。</div>
				<div className="horosa-fengshui-field">
					<label>透明度 <span className="horosa-fengshui-inline-val">{Math.round(vm.globalAlpha * 100)}%</span></label>
					<Slider min={0.2} max={0.95} step={0.05} value={vm.globalAlpha} onChange={(v) => e.setOpacity(v)} />
				</div>
				<div className="horosa-fengshui-field">
					<label>盘大小 <span className="horosa-fengshui-inline-val">{Math.round(vm.diskScale * 100)}%</span></label>
					<Slider min={1} max={1.6} step={0.05} value={vm.diskScale} onChange={(v) => e.setDiskScale(v)} />
				</div>
			</div>
		);
	}

	renderTips(tips, title) {
		return (
			<Collapse ghost size="small" className="horosa-fengshui-tips-collapse">
				<Panel header={title} key="tips">
					<ul className="horosa-fengshui-tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
				</Panel>
			</Collapse>
		);
	}

	renderScoreRing(score, grade) {
		const deg = Math.max(0, Math.min(360, Math.round(score * 3.6)));
		return (
			<div className={`horosa-fengshui-score-ring grade-${grade}`} style={{ background: `conic-gradient(var(--fs-ring) ${deg}deg, var(--fs-ring-track) 0deg)` }}>
				<div className="ring-inner"><span className="num">{score}</span><span className="lbl">{grade}</span></div>
			</div>
		);
	}

	// ── 纳气盘法 · 判定（评分环 + 龙虎 + 标记表 + 危害 + 移动盘 + 缓解 + 要点）──
	renderJudgePanel(vm) {
		const e = this.engine;
		const na = vm.naqi;
		if (!na) return <div className="horosa-fengshui-empty-hint">起盘后查看判定。</div>;
		const filtered = (na.markers || []).filter((m) => {
			if (vm.currentFilter === 'all') return true;
			if (vm.currentFilter === 'unknown') return !m.sector;
			if (vm.currentFilter === 'ok') return m.ok;
			if (vm.currentFilter === 'wind-bad') return m.category === 'wind' && m.sector && !m.ok;
			if (vm.currentFilter === 'water-bad') return m.category === 'water' && m.sector && !m.ok;
			return true;
		});
		return (
			<div className="horosa-fengshui-judge">
				<div className="horosa-fengshui-score-row">
					{this.renderScoreRing(na.score, na.grade)}
					{na.dragonTiger ? (
						<div className="horosa-fengshui-dragon-card"><div className="dt-head">龙虎灶台 · {na.dragonTiger.pattern}</div><div className="dt-text">{na.dragonTiger.text}</div></div>
					) : na.dragonTigerHint ? (
						<div className="horosa-fengshui-dragon-card hint"><div className="dt-head">龙虎灶台</div><div className="dt-text">{na.dragonTigerHint}</div></div>
					) : (
						<div className="horosa-fengshui-dragon-card hint"><div className="dt-head">综合判定</div><div className="dt-text">{vm.summary || '放置门窗灶水等标记后自动评分。'}</div></div>
					)}
				</div>
				<div className="horosa-fengshui-filterbar">
					{FILTERS.map((f) => (
						<XQToggle key={f.key} size="small" active={vm.currentFilter === f.key} onClick={() => e.setFilter(f.key)}>{f.label}</XQToggle>
					))}
				</div>
				<div className="horosa-fengshui-marker-list">
					{(na.markers || []).length === 0 ? (
						<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无标记，请先放置。" />
					) : filtered.length === 0 ? (
						<div className="horosa-fengshui-empty-hint">当前筛选无结果</div>
					) : filtered.map((m) => (
						<div key={m.id} className={`horosa-fengshui-marker-row${m.id === vm.selectedMarkerId ? ' active' : ''}`} onClick={() => e.selectMarker(m.id)}>
							<div className="horosa-fengshui-marker-main">
								<span className="horosa-fengshui-chip-dot" style={{ background: m.color }} />
								<span className="horosa-fengshui-marker-name">{m.label}{m.kitchen ? '（厨房·龙虎）' : ''}</span>
								<span className="horosa-fengshui-marker-meta">{m.sector ? `${m.sector.name} · ${m.actual === 'wind' ? '气位' : '水位'}` : '未定位'}</span>
								<span className={`horosa-fengshui-pill ${m.ok || m.kitchen || m.category === 'neutral' ? 'ok' : 'warn'}`}>{m.category === 'neutral' ? '观察' : m.kitchen ? '厨房' : m.ok ? '合适' : '冲突'}</span>
							</div>
							{m.harm ? <div className="horosa-fengshui-harm-line">危害：{m.harm.affect}</div> : null}
							<div className="horosa-fengshui-marker-actions">
								{m.type === 'stove' ? <XQButton size="small" variant="ghost" onClick={(ev) => { ev.stopPropagation(); e.startStoveFacing(m.id); }}>画灶口朝向{m.facingAngle != null ? ' ✓' : ''}</XQButton> : null}
								{['bed', 'desk', 'sofa'].includes(m.type) ? <XQButton size="small" variant="ghost" onClick={(ev) => { ev.stopPropagation(); e.setDiskCenterMode('marker'); e.selectMarker(m.id); }}>以此为盘心</XQButton> : null}
								<XQButton size="small" variant="ghost" danger onClick={(ev) => { ev.stopPropagation(); e.deleteMarker(m.id); }}>删除</XQButton>
							</div>
						</div>
					))}
				</div>
				{na.houseHarms && na.houseHarms.length ? (
					<div className="horosa-fengshui-summary">
						<div className="horosa-fengshui-card-title">破局危害</div>
						{na.houseHarms.map((h, i) => <div key={`hh${i}`} className="horosa-fengshui-harm-line">{h.label}：{h.affect}</div>)}
					</div>
				) : null}
				{na.probe ? (
					<div className="horosa-fengshui-probe-list">
						<div className="horosa-fengshui-card-title">移动盘 · {na.probe.centerLabel}为太极</div>
						{na.probe.items.map((it, i) => <div key={i} className="horosa-fengshui-probe-item">{it.label} 在 {it.sectorName}{it.windOrWater ? (it.windOrWater === 'wind' ? ' · 气位' : ' · 水位') : ''}</div>)}
					</div>
				) : null}
				{na.remedies && na.remedies.length ? (
					<Collapse ghost size="small" className="horosa-fengshui-tips-collapse">
						<Panel header="缓解建议" key="remedy">
							<ul className="horosa-fengshui-tips">{na.remedies.flatMap((r) => r.items).map((t, i) => <li key={i}>{t}</li>)}</ul>
						</Panel>
					</Collapse>
				) : null}
				{this.renderTips(TIPS, '使用要点')}
			</div>
		);
	}

	// ── 八卦阳宅法 · 卦象（成員卦象卡 + 四类象格局列表）──
	renderBaguaPanel(vm) {
		const e = this.engine;
		const bg = vm.bagua || { members: [], features: [] };
		const hasAny = (bg.members && bg.members.length) || (bg.features && bg.features.length);
		if (!hasAny) {
			return (
				<div className="horosa-fengshui-bagua-wrap">
					{this.renderTips(BAGUA_TIPS, '怎么用（傻瓜式三步）')}
					<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="上传户型图 → 设正北 → 点左栏角色/格局并在图上标注" />
				</div>
			);
		}
		return (
			<div className="horosa-fengshui-bagua-wrap">
				{this.renderTips(BAGUA_TIPS, '怎么用（傻瓜式三步）')}
				{bg.members && bg.members.length ? <div className="horosa-fengshui-section-title">成員卦象</div> : null}
				<div className="horosa-fengshui-bagua-list">
					{(bg.members || []).map((m) => {
						if (!m.roomGua || !m.hex) {
							return (
								<div className="horosa-fengshui-bagua-card cat-caution" key={m.id}>
									<div className="bg-head"><strong>{m.role}</strong>（{m.benmingGua}）<span className="bg-tag">待定位</span></div>
									<div className="bg-row">该标记未落在盘内，请拖动到房间位置。</div>
									<div className="bg-foot-row"><span className="bg-footer" />
										<XQButton size="small" variant="ghost" danger onClick={() => e.deleteMarker(m.id)}>删除</XQButton>
									</div>
								</div>
							);
						}
						const t = m.text || {};
						const tag = (m.meta && m.meta.tag) || 'neutral';
						return (
							<div className={`horosa-fengshui-bagua-card cat-${tag}`} key={m.id}>
								<div className="bg-head"><strong>{m.role}</strong> · 居{m.roomDir} · {m.hex.name} <span className="bg-tag">{TAG_LABEL[tag]}</span></div>
								<div className="horosa-fengshui-hex-stack">
									<div className="hx-line"><span className="hx-key">名（形）</span><span className="hx-gua">{m.benmingGua}</span><span className="hx-sub">{m.role}</span></div>
									<div className="hx-line"><span className="hx-key">位（神）</span><span className="hx-gua">{m.roomGua}</span><span className="hx-sub">{m.roomDir}</span></div>
								</div>
								<div className="bg-badges">
									{m.timing ? <span className="bg-badge time">应期 {m.timing.window}</span> : null}
									{m.rankShift && m.rankShift.dir !== '平' ? <span className={`bg-badge ${m.rankShift.dir === '提前' ? 'up' : 'down'}`}>{m.rankShift.dir} {m.rankShift.years} 年</span> : null}
									{m.shenxing && m.shenxing.same ? <span className="bg-badge same">名位相同·家和</span> : null}
								</div>
								{t.xiang ? <div className="bg-row"><b>象意</b>{t.xiang}</div> : null}
								{t.marriage ? <div className="bg-row"><b>婚姻</b>{t.marriage}</div> : null}
								{t.career ? <div className="bg-row"><b>事业</b>{t.career}</div> : null}
								{t.health ? <div className="bg-row"><b>健康</b>{t.health}</div> : null}
								{t.advice ? <div className="bg-row"><b>改运</b>{t.advice}</div> : null}
								<div className="bg-foot-row">
									<span className="bg-footer">{t.footer || '需合命盘综合参看。'}</span>
									<XQButton size="small" variant="ghost" danger onClick={() => e.deleteMarker(m.id)}>删除</XQButton>
								</div>
							</div>
						);
					})}
				</div>
				{bg.features && bg.features.length ? <div className="horosa-fengshui-section-title">四类象格局</div> : null}
				<div className="horosa-fengshui-feature-list">
					{(bg.features || []).map((f) => (
						<div key={f.id} className={`horosa-fengshui-feature-row${f.judge ? ` cat-${f.judge.tag}` : ' cat-neutral'}`}>
							<div className="ft-main">
								<span className="horosa-fengshui-chip-dot" style={{ background: f.color }} />
								<span className="ft-name">{f.label}</span>
								<span className="ft-meta">{f.gua ? `${f.roomDir}（${f.gua}）· ${f.family}` : '未定位'}</span>
								<XQButton size="small" variant="ghost" danger onClick={() => e.deleteMarker(f.id)}>删除</XQButton>
							</div>
							<div className="ft-text">{f.judge ? f.judge.text : '该标记未落在盘内，请拖动到对应位置。'}</div>
						</div>
					))}
				</div>
				<Collapse ghost size="small" className="horosa-fengshui-tips-collapse">
					<Panel header="判定方法与特例（传统八卦阳宅法）" key="methods">
						<ul className="horosa-fengshui-tips">{BAGUA_METHODS.map((t, i) => <li key={i}>{t}</li>)}</ul>
					</Panel>
				</Collapse>
			</div>
		);
	}

	// horosa_panel_scu_v1:见文件头 fsShouldUpdate 注释。
	shouldComponentUpdate(nextProps, nextState) {
		return fsShouldUpdate(this.props, nextProps, this.state, nextState);
	}

	render() {
		const vm = this.state.vm || {
			status: '请上传户型图开始。', imgLoaded: false, rectRotation: 0,
			unitAzimuth: null, doorImageAngle: null, unitAngleText: '--', doorAngleText: '--', diskRotationText: '--',
			globalAlpha: 0.3, diskScale: 1, diskCenterMode: 'house', periodMode: 'current',
			snapEnabled: true, panMode: false, zoomPct: 100, markerType: MARKER_TYPES[0].id,
			currentFilter: 'all', selectedMarkerId: null, markers: [], summary: '', canUndo: false, canRedo: false,
			techMode: 'naqi', diskSkin: 'draw', baguaOrient: null, naqi: null, bagua: null,
		};
		const e = this.engine;
		const isNaqi = vm.techMode !== 'bagua';
		const isLiqi = LIQI_SET.has(this.state.school);
		let height = this.props.height ? this.props.height : '100%';
		if (typeof height === 'number') height = `${height}px`;
		return (
			<div className="horosa-fengshui-app" style={{ height }} ref={this.rootRef} onPointerDownCapture={this.onRootPointerDown}>
				<input ref={this.fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(ev) => this.onFile(ev)} />
				{this.renderQuickbar(vm)}
				{isLiqi ? <LiqiWorkspace school={this.state.school} /> : null}
				<div className="horosa-fengshui-canvas-body" style={isLiqi ? { display: 'none' } : { display: 'contents' }}>
				<Row gutter={8} className="horosa-fengshui-layout">
					<Col span={6} className="horosa-fengshui-side">
						{/* horosa_freeze_subtabs_v1:左栏两个控制页签。非激活的那个不再跟着每次
						    vm 更新重渲(滑块/下拉/调色板整片);切回时拿本轮最新 vm 渲一帧,
						    DOM 与组件实例全程保留 —— 不重挂、不闪、不丢滚动位。 */}
						{isNaqi ? (
							<XQTabs size="small" activeKey={this.state.controlTab} onChange={this.onControlTab}>
								<TabPane tab="基础" key="base">
									<FreezeSubTab active={this.state.controlTab === 'base'}>{()=> this.renderNaqiBasePanel(vm)}</FreezeSubTab>
								</TabPane>
								<TabPane tab="纳气盘" key="disk">
									<FreezeSubTab active={this.state.controlTab === 'disk'}>{()=> this.renderDiskPanel(vm)}</FreezeSubTab>
								</TabPane>
							</XQTabs>
						) : (
							<XQTabs size="small" activeKey={this.state.controlTab} onChange={this.onControlTab}>
								<TabPane tab="基础" key="base">
									<FreezeSubTab active={this.state.controlTab === 'base'}>{()=> this.renderBaguaBasePanel(vm)}</FreezeSubTab>
								</TabPane>
								<TabPane tab="罗盘" key="disk">
									<FreezeSubTab active={this.state.controlTab === 'disk'}>{()=> this.renderBaguaDiskPanel(vm)}</FreezeSubTab>
								</TabPane>
							</XQTabs>
						)}
					</Col>
					<Col span={18} className="horosa-fengshui-workspace">
						<XQTabs size="small" className="horosa-fengshui-workspace-tabs" activeKey={this.state.workspaceTab} onChange={this.onWorkspaceTab}>
							{/* 画布页必须从一开始就挂载(canvasRef → componentDidMount 建引擎),故 eager:
							    只取冻结、不延迟首渲。 */}
							<TabPane tab="画布" key="canvas">
								<FreezeSubTab active={this.state.workspaceTab === 'canvas'} eager>{
								<div className="horosa-fengshui-canvas-wrap">
									<div className="horosa-fengshui-canvas-toolbar">
										<div className="horosa-fengshui-legend">
											{isNaqi ? <><span><i className="dot wind" />气位（红）</span><span><i className="dot water" />水位（蓝）</span></> : <span>八卦阳宅 · 8 卦方位盘（盘心＝太极点）</span>}
										</div>
										<div className="horosa-fengshui-canvas-actions">
											<XQToggle size="small" active={vm.panMode} disabled={!vm.imgLoaded} onClick={() => e.togglePan()}>拖拽</XQToggle>
											<XQToggle size="small" active={vm.snapEnabled} disabled={!vm.imgLoaded} onClick={() => e.toggleSnap()}>吸附</XQToggle>
											<XQButton size="small" variant="ghost" disabled={!vm.imgLoaded} onClick={() => e.zoomOut()}>−</XQButton>
											<span className="horosa-fengshui-zoom">{vm.zoomPct}%</span>
											<XQButton size="small" variant="ghost" disabled={!vm.imgLoaded} onClick={() => e.zoomIn()}>＋</XQButton>
											<XQButton size="small" variant="ghost" disabled={!vm.imgLoaded} onClick={() => e.resetView()}>重置</XQButton>
										</div>
									</div>
									<div className="horosa-fengshui-canvas-host">
										<canvas ref={this.canvasRef} className="horosa-fengshui-canvas" />
										{!vm.imgLoaded ? <div className="horosa-fengshui-canvas-hint">上传户型图后开始操作</div> : null}
									</div>
								</div>
								}</FreezeSubTab>
							</TabPane>
							<TabPane tab={isNaqi ? '判定' : '卦象'} key="analysis">
								<FreezeSubTab active={this.state.workspaceTab === 'analysis'}>{()=> (isNaqi ? this.renderJudgePanel(vm) : this.renderBaguaPanel(vm))}</FreezeSubTab>
							</TabPane>
						</XQTabs>
					</Col>
				</Row>
				</div>
			</div>
		);
	}
}

export default FengShuiMain;
