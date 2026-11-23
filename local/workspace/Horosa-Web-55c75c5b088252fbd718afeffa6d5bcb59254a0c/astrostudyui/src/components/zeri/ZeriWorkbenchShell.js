// 择日工作台共用壳(九家:八字 / 紫微 / 六壬 / 奇门 / 太乙 / 三式合一 / 七政 / 印度 / 黄历)。
// 三视图(edit / result / schemes)。左列:①时间范围(·地点·参数)+ 用事人本命区 ②构造条件 ③连接门·取反 ④动作排;
// 右列:已选条件链 + 方案排。结果表:起止时刻(点击起盘)/ 时长 / 各家徽标列 / 逐条判读 / 概览浮窗。
// 各家只交一份「派」描述(school,见下方 SCHOOL 字段说明),同一套交互、同一套版式 —— 此前九份文件各抄一遍
// (5400 行、相互 76–91% 相同),修一处要改九处、漏改即各页行为分叉。
//
// school 字段:
//   name            标题前缀(「八字择日」)                   tech            概览浮窗 ZeriMiniPanPopup 的技法键
//   types / newLeaf / newGroup / leafSummary                  条件注册表与构造器
//   categorySeed    类别显式优先序(注册表里出现的新类别自动追加,新增条件类绝不静默消失)
//   defaultDraftType  首开的条件类型(必须是本注册表键)
//   store           方案库(导出文件名 = 「<name>方案_…json」)
//   disclaimerSubject  标题栏警示「结果为 X 的机械筛选」里的 X
//   vocab           措辞覆盖(见 DEFAULT_VOCAB;日粒度的黄历整套换掉)
//   dayGrain        true = 日粒度(无时刻 / 无地点·参数区,时长列按天)
//   rangeNote       日粒度时范围下方的一行说明
//   params          null | { layout: 'inline' | 'panel', fields: () => [字段描述], chipKeys?: [键](panel 收起时的胶囊), chipPrefix?: { 键: 前缀 },
//                            extra?: (props)=>节点(inline 末尾) }
//                   字段描述:{ key, label, options | optionsFor(o), dv?(缺省值), selectValue?(o), disabled?(o), when?(o), kind?: 'input' }
//   reloadFromBoard true = 地点行带「从主盘重载」(宿主给 onReloadFromBoard)
//   natal           null | { label, note?: (natal)=>节点 }   用事人本命区(解锁「本命」组条件)
//   badge           null | { header, width, text: (row)=>字符串 }   结果表徽标列
//   preview         (ctx)=>节点 | 缺省 ZeriMiniPanPopup;ctx = { row, props, onClose }
import { useState, useEffect, useRef } from 'react';
import { XQToggleCaret } from '../xq-icons';
import { emptyNumberFieldError } from '../../divination/zeri/conditionFieldCheck';   // 空数字框统一校验
import { Modal, Dropdown, Menu, message } from 'antd';
import { XQButton, XQSelect, XQCheckItem, XQInput } from '../xq-ui';
import ConditionParamsForm from './ConditionParamsForm';
import ZeriMiniPanPopup from './ZeriMiniPanPopup';
import ZeriRowBadge from './ZeriRowBadge';
import GeoCoordModal from '../amap/GeoCoordModal';
import { formatGpsDms } from '../../divination/zeri/tianxingSnapshot';
import { JOINER_CN, auditTreeAgainstRegistry } from '../../divination/zeri/conditionTypes';
import { downloadJson, JOINER_OPTIONS, getAt, mapAt, removeAt, collectUiLeaves, GATE_CN2, dateStrOf } from './zeriTreeOps';
import { withFullDefaults } from './zeriOptionDefaults';
import { schemeOptionsOf } from '../../divination/zeri/zeriPageCalibre';
import { normalizeSavedNatal, restoredNatalInput } from './zeriNatal';
import { formatZoneLabel } from '../../utils/zoneText';   // 时区一律 UTC±HH:MM
import { ZERI_WB_TOP_STYLE, ZERI_WB_COND_BODY_STYLE } from './zeriWorkbenchLayout';
import IsoDateTimeField from '../comp/IsoDateTimeField';   // 日期 / 时刻走全站时间组件(不用系统原生日期框)
import { pressable } from '../../utils/pressable';

const Option = XQSelect.Option;
const OptGroup = XQSelect.OptGroup;
// 下拉挂进弹窗正文(不挂 body):body 门户浮层垂出弹窗底边悬在遮罩上,近旁点击会命中遮罩整台关闭
const popupInModal = (t) => t.closest('.ant-modal-body') || t.parentElement;
// 视图高:常规窗口 = 布局视口 − 220(560 ~ 900);放大档 / 矮窗布局视口本身不到 780 时,下限跟着收(留 190 给弹窗标题栏、
// 正文内边距与结果条 —— 实测 1.8 档这几样合计 171),整台不比窗口高(此前下限钉死 560,1.8 档布局高只有 500,整台溢出窗口)
const VIEW_HEIGHT = 'clamp(min(560px, calc(100 * var(--horosa-lvh, 1vh) - 190px)), calc(100 * var(--horosa-lvh, 1vh) - 220px), 900px)';
// 右列(结果预览 / 概览):宽窗 440,窄窗按比例收、不低于 300(此前固定 440,放大档左列被挤成一条)
const RIGHT_COL = 'clamp(300px, 34%, 440px)';

// 时辰粒度的缺省措辞(八家共用);日粒度的黄历整套覆盖
export const DEFAULT_VOCAB = {
	action: '择时',
	rangeTitle: '时间范围·地点·参数',
	presets: [['今日', 1], ['3天', 3], ['7天', 7], ['30天', 30]],
	progressUnit: '样',
	countUnit: '个时段',
	pickHint: '点击行即起盘看盘',
	startHeader: '开始(点击=起始时刻起盘)',
	endHeader: '结束(点击=结束时刻起盘)',
	startTitle: '以时段起始时刻起盘',
	endTitle: '以时段结束时刻起盘',
	emptyResult: '时间范围内无满足条件的时辰。',
	explainCaption: '以时段起始时刻逐条判读(设定 vs 实际;判定与扫描引擎同源)',
	staleWhat: '条件/时间范围',
	previewHeader: '盘',
	previewButton: '盘',
};

// 参数字段的当前值 / 显示文字(各家同一判据;显示值换算的键叫 selectValue —— 叫 valueOf 会撞上对象原型的 valueOf,恒真)
export function workbenchParamValue(f, o){
	const opts = o || {};
	if(f.selectValue){ return f.selectValue(opts); }
	return opts[f.key] !== undefined ? opts[f.key] : f.dv;
}
export function workbenchParamLabel(f, o){
	const opts = o || {};
	const value = workbenchParamValue(f, opts);
	const list = f.optionsFor ? f.optionsFor(opts) : (f.options || []);
	const hit = list.find((x)=>`${x.value}` === `${value}`);
	return hit ? hit.label : `${value === undefined || value === null ? '—' : value}`;
}

// 类别序:显式优先序保持既有分组次序;注册表出现的新类别自动追加(曾为硬编码常量 = 下拉静默吞类)
export function categoryOrderOf(types, seed){
	const seen = (seed || []).slice();
	Object.keys(types).forEach((k)=>{
		const c = types[k].category;
		if(c && !seen.includes(c)){ seen.push(c); }
	});
	return seen;
}

function renderExplainNode(node, uiLeaves, counter, depth, school){
	const passTag = (ok) => (
		<span style={{ fontWeight: 700, color: ok ? 'var(--horosa-jx-ji)' : 'var(--horosa-danger)' }}>{ok ? '✓' : '✗'}</span>
	);
	if(node.kind === 'group'){
		return (
			<div key={`g${depth}_${counter.i}`} style={{ paddingLeft: depth ? 14 : 0, borderLeft: depth ? '2px solid rgba(var(--horosa-gold-rgb), .35)' : 'none', marginTop: depth ? 4 : 0 }}>
				<div style={{ fontSize: 'var(--horosa-fs-small)', opacity: 0.8 }}>{GATE_CN2[node.op] || node.op} {passTag(node.pass)}</div>
				{(node.children || []).map((c) => renderExplainNode(c, uiLeaves, counter, depth + 1, school))}
			</div>
		);
	}
	const ui = uiLeaves[counter.i];
	counter.i += 1;
	return (
		<div key={`l${counter.i}`} style={{ padding: '5px 0 5px 0', marginLeft: depth ? 14 : 0, borderBottom: '1px dashed var(--horosa-border)' }}>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--horosa-fs-small)' }}>
				<span style={{ color: 'var(--horosa-text-secondary)' }}>设定</span>
				<span>{ui ? school.leafSummary(ui) : ((school.types[node.type] || {}).label || node.type)}</span>
			</div>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'var(--horosa-fs-small)', marginTop: 2 }}>
				<span style={{ color: 'var(--horosa-text-secondary)' }}>实际</span>
				<span style={{ opacity: 0.9 }}>{node.actual}</span>
				{passTag(node.pass)}
			</div>
		</div>
	);
}

export default function ZeriWorkbenchShell(props){
	const {
		school,
		open, onClose, cfg, onCfgChange, geo, onGeoChange, options, onOptionsChange, optionDefaults, getSchemeOptions, onReloadFromBoard,
		natal, natalInput, onNatalInputChange, onResolveNatal, onClearNatal, onRestoreNatal,
		tree, frozenTree, onTreeChange, onRun, onCancelScan, onPickInterval, onExplain, scanEpoch, resultsStale, staleCalibreNote,
		scanning, progress, results, truncated, scanErr,
	} = props;
	const vocab = { ...DEFAULT_VOCAB, ...(school.vocab || {}) };
	const types = school.types;
	const [draftType, setDraftType] = useState(school.defaultDraftType);	// 🔴 初值必须是本注册表键(抄别家的键 = 首开未知条件)
	const [draftParams, setDraftParams] = useState(() => school.newLeaf(school.defaultDraftType).params);
	const [draftNegate, setDraftNegate] = useState(false);
	const [selectedPath, setSelectedPath] = useState(null);
	const [view, setView] = useState('edit');
	const [paramsOpen, setParamsOpen] = useState(false);	// 参数区(panel 形态)缺省收起,只露胶囊摘要,把高度让给「构造条件」
	const [expandKey, setExpandKey] = useState(null);
	const [previewRow, setPreviewRow] = useState(null);	// 概览浮窗行
	const [explainMap, setExplainMap] = useState({});
	const [schemeName, setSchemeName] = useState('');
	const [schemeTick, setSchemeTick] = useState(0);
	const [renameId, setRenameId] = useState(null);
	const [renameText, setRenameText] = useState('');
	const [schemeMsg, setSchemeMsg] = useState('');

	useEffect(() => {
		if(scanning){ setView('result'); }
	}, [scanning]);
	// 工作台收起(点结果行起盘 / 点 ×)时概览浮窗一并关:弹窗收起后内容只是隐藏、浮窗仍挂着,它登记的 Esc 层留在栈顶,
	//   之后全应用任何弹窗的第一下 Esc 都被这层看不见的浮窗吃掉
	useEffect(() => {
		if(!open){ setPreviewRow(null); }
	}, [open]);

	// 「从未打开过」粘性短路:弹窗关着时零渲染成本;打开过后永远走完整树(草稿 / 视图态 / 关闭动画全保留)
	const everOpenRef = useRef(!!open);
	const importInputRef = useRef(null);
	if(open && !everOpenRef.current){ everOpenRef.current = true; }
	if(!everOpenRef.current){ return null; }

	const opts = options || {};
	const store = school.store;
	const categoryOrder = categoryOrderOf(types, school.categorySeed);
	const selectedNode = selectedPath ? getAt(tree, selectedPath) : null;
	const selectedIsLeaf = !!(selectedNode && selectedNode.kind !== 'group' && !selectedNode.children);
	const selectedIsGroup = !!(selectedNode && (selectedNode.kind === 'group' || selectedNode.children));

	const resetDraft = (type) => {
		setDraftType(type);
		setDraftParams(school.newLeaf(type).params);
		setDraftNegate(false);
	};
	const loadLeafToDraft = (leaf) => {
		setDraftType(leaf.type);
		setDraftParams(JSON.parse(JSON.stringify(leaf.params)));
		setDraftNegate(!!leaf.negate);
	};

	const draftLeaf = { kind: 'leaf', type: draftType, negate: draftNegate, params: draftParams };
	const draftSpec = types[draftType] || {};
	// 空数字框先判(与表单红框同一判据),再走各类型自校验
	const draftError = emptyNumberFieldError(draftSpec, draftParams) || (draftSpec.validate ? draftSpec.validate(draftParams) : '');

	const appendTargetPath = selectedIsGroup ? selectedPath : [];
	const doAdd = () => {
		const leaf = JSON.parse(JSON.stringify(draftLeaf));
		onTreeChange(mapAt(tree, appendTargetPath, (g) => ({ ...g, children: [...g.children, leaf] })));
	};
	const doReplace = () => {
		if(!selectedIsLeaf){ return; }
		onTreeChange(mapAt(tree, selectedPath, () => JSON.parse(JSON.stringify(draftLeaf))));
	};
	const doAddGroup = () => {
		onTreeChange(mapAt(tree, appendTargetPath, (g) => ({ ...g, children: [...g.children, school.newGroup('any')] })));
	};
	const doRemove = (path) => {
		onTreeChange(removeAt(tree, path));
		setSelectedPath(null);
	};

	const applyScheme = (rec) => {
		// 载入前审计值域:方案里的条件类 / 选项值可能已随版本演进被删 —— 那类行会静默恒不命中。
		// 审计只提示不拦载入:用户看得见哪些行失效,自行改设;静默才是事故。
		const issues = (rec && rec.tree) ? auditTreeAgainstRegistry(rec.tree, types) : [];
		if(issues.length){
			message.warning(`方案「${rec && rec.name ? rec.name : ''}」有 ${issues.length} 处已失效设置:${issues.slice(0, 2).join(';')}${issues.length > 2 ? ';…' : ''}`, 8);
		}
		if(rec && rec.tree){ onTreeChange(rec.tree); }
		if(rec && rec.config){
			if(rec.config.cfg){ onCfgChange({ ...cfg, ...rec.config.cfg }); }
			if(rec.config.geo && typeof onGeoChange === 'function'){ onGeoChange({ ...(geo || {}), ...rec.config.geo }); }
			// 方案 / 历史里没写的参数回出厂值(宿主完整缺省打底),不取本会话现值:否则会话里改过、方案没写的键混进来,再扫得到的不是当时的结果
			if(rec.config.options && typeof onOptionsChange === 'function'){ onOptionsChange(withFullDefaults(optionDefaults, rec.config.options), { source: 'scheme' }); }
			// 本命与输入框同一校验(zeriNatal):方案里的本命坏形 = 没有;输入框叠在构造缺省上(不留会话里上一位的)
			if(school.natal && (rec.config.natalInput || Object.prototype.hasOwnProperty.call(rec.config, 'natal')) && typeof onNatalInputChange === 'function'){ onNatalInputChange(restoredNatalInput(rec.config.natalInput)); }
			if(school.natal && Object.prototype.hasOwnProperty.call(rec.config, 'natal') && typeof onRestoreNatal === 'function'){ onRestoreNatal(normalizeSavedNatal(rec.config.natal)); }
		}
		setSelectedPath(null);
	};
	// 方案随存:时刻粒度的家存地点与参数(内嵌页的页面口径键由宿主给出);带本命区的家连本命一起存
	const schemeConfig = () => {
		const conf = { cfg };
		if(!school.dayGrain){ conf.geo = geo; conf.options = schemeOptionsOf(getSchemeOptions, opts); }
		if(school.natal){ conf.natal = natal; conf.natalInput = natalInput; }
		return conf;
	};

	const schemes = store.listSchemes();
	const history = store.listHistory();
	const schemeMenu = (
		<Menu>
			{schemes.length ? schemes.map((s) => (
				// 整项点击 / 回车 = 套用方案(菜单自带键盘导航);「删」是项内独立按钮,点它不触发套用
				<Menu.Item key={s.id} onClick={() => applyScheme(s)}>
					<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
						<span>{s.name}</span>
						<button type="button" className="horosa-zeri-menu-del"
							onClick={(e) => { e.preventDefault(); e.stopPropagation(); store.deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删</button>
					</span>
				</Menu.Item>
			)) : <Menu.Item key="none" disabled>暂无已存方案</Menu.Item>}
			{history.length ? (
				<Menu.SubMenu key="his" title={`最近${vocab.action}`}>
					{history.map((h, i) => (
						<Menu.Item key={`h${i}`} onClick={() => applyScheme(h)}>{(h.at || '').replace('T', ' ').slice(0, 16)}</Menu.Item>
					))}
				</Menu.SubMenu>
			) : null}
		</Menu>
	);

	const setNodeProp = (path, patch) => onTreeChange(mapAt(tree, path, (n) => ({ ...n, ...patch })));
	const selIndex = selectedPath && selectedPath.length ? selectedPath[selectedPath.length - 1] : -1;
	const joinerToolbar = (
		<div style={{ padding: '8px 10px', borderTop: '1px solid var(--horosa-border)' }}>
			<div style={{ fontSize: 'var(--horosa-fs-caption)', color: 'var(--horosa-text-secondary)', marginBottom: 6 }}>
				连接门·取反{!selectedNode ? '(先点选右侧一行)' : (selIndex === 0 ? '(首行无连接门,可取反)' : '')}
			</div>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
				{JOINER_OPTIONS.map((o) => (
					<XQButton key={o.value} size="small"
						disabled={!selectedNode || selIndex <= 0}
						type={selectedNode && selIndex > 0 && (selectedNode.joiner || 'all') === o.value ? 'primary' : 'default'}
						onClick={() => selectedNode && selIndex > 0 && setNodeProp(selectedPath, { joiner: o.value })}>
						{o.label}
					</XQButton>
				))}
				<XQButton size="small" disabled={!selectedNode}
					type={selectedNode && selectedNode.negate ? 'primary' : 'default'}
					danger={!!(selectedNode && selectedNode.negate)}
					onClick={() => selectedNode && setNodeProp(selectedPath, { negate: !selectedNode.negate })}>
					取反 NOT
				</XQButton>
			</div>
		</div>
	);

	const renderRow = (node, path, index, depth) => {
		const isSel = selectedPath && selectedPath.join('.') === path.join('.');
		const isGroup = node.kind === 'group' || !!node.children;
		return (
			<div key={path.join('.')}
				style={{
					border: isSel ? '1px solid var(--horosa-accent)' : '1px solid var(--horosa-border)',
					borderRadius: 8, padding: '7px 10px', marginBottom: 6, cursor: 'pointer',
					background: node.negate ? 'rgba(var(--horosa-danger-rgb), .06)' : (isSel ? 'rgba(var(--horosa-gold-rgb), .06)' : 'transparent'),
				}}
				{...pressable((e) => {
					e.stopPropagation();
					setSelectedPath(path);
					if(!isGroup){ loadLeafToDraft(node); }
				})}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
					{index > 0 ? (
						<span style={{
							fontSize: 'var(--horosa-fs-caption)', fontWeight: 700, padding: '1px 8px', borderRadius: 10,
							background: 'rgba(var(--horosa-gold-rgb), .14)', border: '1px solid rgba(var(--horosa-gold-rgb), .4)',
							flexShrink: 0,
						}}>{JOINER_CN[node.joiner || 'all']}</span>
					) : null}
					{node.negate ? <span style={{ color: 'var(--horosa-danger)', fontWeight: 700, flexShrink: 0 }}>非</span> : null}
					{isGroup ? (
						<span style={{ fontSize: 'var(--horosa-fs-small)', fontWeight: 600 }}>分组({(node.children || []).length} 条)</span>
					) : (
						// 行首已有独立「非」标,摘要剥掉自带前缀防「非 非·」双显(快照 / 详情 / 预览无独立标,保留前缀)
						<span style={{ fontSize: 'var(--horosa-fs-small)' }}>{school.leafSummary({ ...node, negate: false })}</span>
					)}
					<span style={{ flex: 1 }} />
					<XQButton size="small" danger onClick={(e) => { e.stopPropagation(); doRemove(path); }}>删除</XQButton>
				</div>
				{isGroup ? (
					<div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid rgba(var(--horosa-gold-rgb), .35)' }}>
						{(node.children || []).map((c, i) => renderRow(c, [...path, i], i, depth + 1))}
						{!(node.children || []).length ? (
							<div style={{ padding: '6px 2px', fontSize: 'var(--horosa-fs-small)', color: 'var(--horosa-text-secondary)' }}>空分组:选中本组后左侧「添加到列表」即入组,或删除本组。</div>
						) : null}
					</div>
				) : null}
			</div>
		);
	};

	const renderNode = (rootNode) => (
		<div>
			{(rootNode.children || []).map((c, i) => renderRow(c, [i], i, 1))}
			{!(rootNode.children || []).length ? (
				<div style={{ padding: '10px 4px', fontSize: 'var(--horosa-fs-small)', color: 'var(--horosa-text-secondary)' }}>尚无条件——左侧构造后点「添加到列表」。</div>
			) : null}
		</div>
	);

	// 时间范围预设芯片(今日为锚,系统本地日历;仅便捷填充,扫描时区仍取地点 zone)
	const applyPreset = (days) => {
		const now = new Date();
		const start = dateStrOf(now);
		const endDate = new Date(now.getTime() + (days - 1) * 86400e3);
		onCfgChange(school.dayGrain
			? { ...cfg, startDate: start, endDate: dateStrOf(endDate) }
			: { ...cfg, startDate: start, startTime: '00:00', endDate: dateStrOf(endDate), endTime: '23:59' });
	};

	// ── 参数区 ──
	const params = school.params;
	const paramFields = params ? params.fields().filter((f) => !f.when || f.when(opts)) : [];
	const paramControl = (f, style) => (f.kind === 'input' ? (
		<XQInput size="small" value={opts[f.key] === undefined || opts[f.key] === null ? '' : opts[f.key]}
			placeholder="如 168" style={style}
			onChange={(e) => onOptionsChange({ ...opts, [f.key]: e.target.value })} />
	) : (
		<XQSelect size="small" style={style} value={workbenchParamValue(f, opts)} dropdownMatchSelectWidth={false} optionLabelProp="label"
			disabled={f.disabled ? f.disabled(opts) : false}
			getPopupContainer={popupInModal}
			onChange={(v) => onOptionsChange({ ...opts, [f.key]: v })}>
			{(f.optionsFor ? f.optionsFor(opts) : f.options).map((o) => (<Option key={`${o.value}`} value={o.value} label={o.short || o.label}>{o.label}</Option>))}
		</XQSelect>
	));
	// inline:与地点同一行的「标签 + 下拉」串;panel:收起时一排胶囊摘要,展开是按可用宽自动排列的网格
	const inlineParams = params && params.layout === 'inline' ? (
		<>
			{paramFields.map((f) => (
				<span key={f.key} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 'var(--horosa-fs-caption)' }}>
					<span style={{ color: 'var(--horosa-text-secondary)' }}>{f.label}</span>
					{paramControl(f)}
				</span>
			))}
			{params.extra ? params.extra(props) : null}
		</>
	) : null;
	const panelParams = params && params.layout === 'panel' ? (!paramsOpen ? (
		<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
			{paramFields.filter((f) => (params.chipKeys || []).indexOf(f.key) >= 0).map((f) => (
				<span key={f.key} title={f.label} style={{ fontSize: 'var(--horosa-fs-caption)', padding: '1px 8px', borderRadius: 10, background: 'var(--horosa-panel-soft)', border: '1px solid var(--horosa-border)' }}>{`${(params.chipPrefix || {})[f.key] || ''}${workbenchParamLabel(f, opts)}`}</span>
			))}
		</div>
	) : (
		// 每格 = 标签 + 下拉,按可用宽自动排列;太高时整块参数区自己滚(ZERI_WB_TOP_STYLE),不把「构造条件」挤出框
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(216px, 1fr))', gap: '6px 12px', alignItems: 'center', margin: '8px 0' }}>
			{paramFields.map((f) => (
				// 标签列定宽(长标签折两行),各格的下拉左缘对齐成一条线(此前标签按字数撑宽,下拉左缘参差)
				<span key={f.key} style={{ display: 'grid', gridTemplateColumns: '6.5em minmax(0, 1fr)', columnGap: 6, alignItems: 'center', fontSize: 'var(--horosa-fs-caption)', minWidth: 0 }}>
					<span style={{ color: 'var(--horosa-text-secondary)', lineHeight: 1.25, overflowWrap: 'break-word' }}>{f.label}</span>
					{paramControl(f, { width: '100%', minWidth: 0 })}
				</span>
			))}
		</div>
	)) : null;

	// 地点显示:地名优先,否则度分 + 方位字母(与天星 / 左栏同口径;裸经纬小数串太长且无方位)
	const geoLabel = geo && geo.pos
		? `📍 ${geo.pos}`
		: (geo && geo.gpsLat !== undefined && geo.gpsLat !== null ? `📍 ${formatGpsDms(geo.gpsLon, geo.gpsLat)}` : '选择地点…');

	const natalRow = school.natal ? (
		// 用事人本命(选填;解锁「本命」组条件,未设时该组判假并提示)
		<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '6px 8px', borderRadius: 8, background: 'rgba(var(--horosa-gold-rgb), .05)', border: '1px dashed rgba(var(--horosa-gold-rgb), .4)' }}>
			<span style={{ fontSize: 'var(--horosa-fs-caption)', opacity: 0.7 }}>{school.natal.label}</span>
			<IsoDateTimeField date={(natalInput || {}).date || ''} time={(natalInput || {}).time || '12:00'} placeholder="出生时间"
				onChange={(v) => onNatalInputChange({ ...(natalInput || {}), date: v.date, time: v.time })} />
			<XQSelect size="small" value={(natalInput || {}).gender} dropdownMatchSelectWidth={false}
				getPopupContainer={popupInModal}
				onChange={(v) => onNatalInputChange({ ...(natalInput || {}), gender: v })}>
				<Option value={1}>男</Option>
				<Option value={0}>女</Option>
			</XQSelect>
			<XQButton size="small" disabled={!(natalInput && natalInput.date)} onClick={() => { onResolveNatal(); }}>解析本命</XQButton>
			{natal ? (
				<span style={{ fontSize: 'var(--horosa-fs-caption)', padding: '1px 8px', borderRadius: 10, background: 'var(--horosa-success-soft)', border: '1px solid var(--horosa-border)' }}>
					{natal.label}
					<XQButton type="link" size="small" style={{ marginLeft: 2, padding: '0 4px', height: 'auto' }} onClick={onClearNatal}>清除</XQButton>
				</span>
			) : (
				<span style={{ fontSize: 'var(--horosa-fs-caption)', color: 'var(--horosa-text-secondary)' }}>未设(「本命」组条件不生效)</span>
			)}
			{natal && school.natal.note ? school.natal.note(natal) : null}
		</div>
	) : null;

	const editView = (
		<div style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${RIGHT_COL}`, gap: 12, height: VIEW_HEIGHT }}>
			{/* 左列(主操作区):时间范围·地点·参数 / 构造条件 / 连接门 / 动作排 */}
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid var(--horosa-border)', borderRadius: 8 }}>
				<div className="horosa-zeri-wb-top" style={ZERI_WB_TOP_STYLE}>
					<div style={{ fontWeight: 600, marginBottom: 8 }}>{vocab.rangeTitle}</div>
					<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: school.dayGrain ? 0 : 8 }}>
						{school.dayGrain ? (
							<IsoDateTimeField showTime={false} date={cfg.startDate} onChange={(v) => onCfgChange({ ...cfg, startDate: v.date })} />
						) : (
							<IsoDateTimeField date={cfg.startDate} time={cfg.startTime} onChange={(v) => onCfgChange({ ...cfg, startDate: v.date, startTime: v.time })} />
						)}
						<span style={{ color: 'var(--horosa-text-secondary)' }}>→</span>
						{school.dayGrain ? (
							<IsoDateTimeField showTime={false} date={cfg.endDate} onChange={(v) => onCfgChange({ ...cfg, endDate: v.date })} />
						) : (
							<IsoDateTimeField date={cfg.endDate} time={cfg.endTime} onChange={(v) => onCfgChange({ ...cfg, endDate: v.date, endTime: v.time })} />
						)}
						{/* 预设钮组:整组 nowrap + marginLeft:auto —— flex:1 占位与 wrap 互斥(占位吃掉行尾宽把单钮挤成孤行) */}
						<span style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
							{vocab.presets.map(([label, days]) => (
								<XQButton key={label} size="small" onClick={() => applyPreset(days)}>{label}</XQButton>
							))}
						</span>
					</div>
					{school.dayGrain ? (
						school.rangeNote ? <div style={{ fontSize: 'var(--horosa-fs-caption)', color: 'var(--horosa-text-secondary)', marginTop: 6 }}>{school.rangeNote}</div> : null
					) : (
						<>
							<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: params && params.layout === 'panel' ? 0 : 8 }}>
								<GeoCoordModal lat={geo && geo.gpsLat} lng={geo && geo.gpsLon} onOk={(rec) => onGeoChange(rec)}>
									<XQButton size="small">{geoLabel}</XQButton>
								</GeoCoordModal>
								<span style={{ fontSize: 'var(--horosa-fs-caption)', color: 'var(--horosa-text-secondary)' }}>时区 {geo && geo.zone !== undefined ? (formatZoneLabel(geo.zone) || geo.zone) : '—'}</span>
								{school.reloadFromBoard ? (
									<XQButton size="small" onClick={onReloadFromBoard} title="用左栏「起盘选项」当前值覆盖本面板的地点与参数">从主盘重载</XQButton>
								) : null}
								{inlineParams}
								{params && params.layout === 'panel' ? (
									<>
										<span style={{ flex: 1 }} />
										<XQButton size="small" onClick={() => setParamsOpen(!paramsOpen)}>{paramsOpen ? '收起参数' : '编辑参数'}<XQToggleCaret open={paramsOpen} /></XQButton>
									</>
								) : null}
							</div>
							{panelParams}
							{natalRow}
						</>
					)}
				</div>
				<div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid var(--horosa-border)' }}>构造条件</div>
				<div className="horosa-zeri-wb-cond" style={ZERI_WB_COND_BODY_STYLE}>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
						<span style={{ fontSize: 'var(--horosa-fs-caption)', color: 'var(--horosa-text-secondary)' }}>条件类型</span>
						<XQSelect size="small" style={{ minWidth: 150 }} value={draftType}
							onChange={(v) => resetDraft(v)} dropdownMatchSelectWidth={false}
							getPopupContainer={popupInModal}>
							{categoryOrder.map((cat) => (
								<OptGroup label={cat} key={cat}>
									{Object.entries(types).filter(([, spec]) => spec.category === cat).map(([key, spec]) => (
										<Option key={key} value={key}>{spec.label}</Option>
									))}
								</OptGroup>
							))}
						</XQSelect>
						<XQCheckItem compact checked={draftNegate} onClick={() => setDraftNegate(!draftNegate)}
							style={{ width: 'auto', display: 'inline-grid', minHeight: 26 }}>
							取反(NOT)
						</XQCheckItem>
					</div>
					<ConditionParamsForm types={types} type={draftType} params={draftParams} onChange={setDraftParams} />
					<div style={{
						marginTop: 12, padding: '8px 10px', borderRadius: 8,
						border: '1px dashed rgba(var(--horosa-gold-rgb), .5)', background: 'rgba(var(--horosa-gold-rgb), .05)',
						display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--horosa-fs-small)',
					}}>
						{school.leafSummary(draftLeaf)}
					</div>
					{draftError ? <div style={{ color: 'var(--horosa-danger)', fontSize: 'var(--horosa-fs-small)', marginTop: 6 }}>{draftError}</div> : null}
				</div>
				{joinerToolbar}
				<div style={{ padding: 10, borderTop: '1px solid var(--horosa-border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
					<XQButton size="small" onClick={doAdd} disabled={!!draftError}>
						添加到列表{selectedIsGroup ? '(选中组)' : ''}
					</XQButton>
					<XQButton size="small" onClick={doReplace} disabled={!selectedIsLeaf || !!draftError}>替换选中</XQButton>
					<XQButton size="small" onClick={doAddGroup}>添加子分组</XQButton>
					<span style={{ flex: 1 }} />
					<XQButton size="small" onClick={() => { onTreeChange({ ...tree, children: [] }); setSelectedPath(null); }}
						disabled={!tree.children.length}>清空全部</XQButton>
					<XQButton size="small" type="primary" onClick={() => { setView('result'); onRun(); }} disabled={scanning || !tree.children.length}>
						{vocab.action}
					</XQButton>
				</div>
			</div>
			{/* 右列:已选条件链 + 方案排 */}
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>
				<div style={{ flex: 1, minHeight: 0, border: '1px solid var(--horosa-border)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
					<div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid var(--horosa-border)', display: 'flex', alignItems: 'center', gap: 8 }}
						title="点击行选中后,用左下「连接门·取反」四钮直接改该行;行首徽标=本行与上方结果的连接门">
						已选条件
						<span style={{ fontSize: 'var(--horosa-fs-caption)', color: 'var(--horosa-text-secondary)', fontWeight: 400 }}>点行选中·左下改门/取反</span>
					</div>
					<div style={{ flex: 1, overflowY: 'auto', padding: 10 }} {...pressable(() => setSelectedPath(null))}>
						{renderNode(tree)}
					</div>
					{/* 窄右列(放大档)时整排折行,方案名框保底 7em,不被按钮挤成一条缝 */}
					<div style={{ padding: '6px 10px', borderTop: '1px solid var(--horosa-border)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
						<XQInput size="small" placeholder="方案名…" value={schemeName} style={{ flex: '1 1 7em', minWidth: '7em', maxWidth: 160 }}
							onChange={(e) => setSchemeName(e.target.value)} />
						<XQButton size="small" disabled={!schemeName.trim()} onClick={() => {
							const r = store.saveScheme(schemeName, schemeConfig(), tree);
							if(r.ok){ setSchemeName(''); setSchemeTick(schemeTick + 1); }
						}}>保存方案</XQButton>
						<Dropdown overlay={schemeMenu} trigger={['click']}>
							<XQButton size="small">载入方案▾</XQButton>
						</Dropdown>
						<XQButton size="small" onClick={() => setView('schemes')}>方案管理…</XQButton>
						{scanErr ? <span style={{ color: 'var(--horosa-danger)', fontSize: 'var(--horosa-fs-small)', marginLeft: 8 }}>{scanErr}</span> : null}
					</div>
				</div>
			</div>
		</div>
	);

	const badge = school.badge;
	const durationCell = (row) => (school.dayGrain
		? `${row.days}天`
		: (row.durationMin >= 90 ? `${(row.durationMin / 60).toFixed(1)}小时` : `${Math.round(row.durationMin)}分`));
	const resultView = (
		<div style={{ height: VIEW_HEIGHT, display: 'flex', flexDirection: 'column' }}>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
				<XQButton size="small" onClick={() => setView('edit')} disabled={scanning}>← 返回条件</XQButton>
				<span style={{ fontWeight: 600 }}>{vocab.action}结果</span>
				{scanning && progress ? (
					<span style={{ fontSize: 'var(--horosa-fs-small)', opacity: 0.75 }}>扫描中 {vocab.progressUnit === '段' ? `第${progress.done}/${progress.total}段` : `${progress.done}/${progress.total} ${vocab.progressUnit}`} · 已命中 {progress.hits}</span>
				) : null}
				{scanning ? <XQButton size="small" onClick={onCancelScan}>取消</XQButton> : null}
				<span style={{ flex: 1 }} />
				{!scanning && results ? (
					<span style={{ fontSize: 'var(--horosa-fs-small)', opacity: 0.7 }}>
						共 {results.length} {vocab.countUnit}{truncated ? '(已达上限截断,请缩小时间段)' : ''};{vocab.pickHint}
					</span>
				) : null}
			</div>
			{!scanning && scanErr ? <div style={{ color: 'var(--horosa-danger)', fontSize: 'var(--horosa-fs-small)', marginBottom: 8 }}>{scanErr}</div> : null}
			{resultsStale ? (
				<div style={{ color: 'var(--horosa-sev-medium)', background: 'rgba(var(--horosa-gold-rgb), .12)', border: '1px solid rgba(var(--horosa-gold-rgb), .4)', borderRadius: 6, fontSize: 'var(--horosa-fs-small)', padding: '5px 10px', marginBottom: 8 }}>
					⚠ {vocab.staleWhat}已被修改:下方结果对应「上一次{vocab.action}」——请重新点「{vocab.action}」。
					{staleCalibreNote ? <div className="horosa-zeri-stale-calibre" style={{ marginTop: 2 }}>{staleCalibreNote}</div> : null}
				</div>
			) : null}
			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--horosa-border)', borderRadius: 8 }}>
				<div style={{ display: 'flex', fontSize: 'var(--horosa-fs-small)', color: 'var(--horosa-text-secondary)', padding: '8px 12px', gap: 10, borderBottom: '1px solid var(--horosa-border)', position: 'sticky', top: 0, background: 'var(--horosa-astro-panel, #fff)', zIndex: 1 }}>
					<span style={{ width: 36, whiteSpace: 'nowrap' }}>#</span>
					<span style={{ flex: 1 }}>{vocab.startHeader}</span>
					<span style={{ flex: 1 }}>{vocab.endHeader}</span>
					<span style={{ width: 64, whiteSpace: 'nowrap', textAlign: 'right' }}>{school.dayGrain ? '天数' : '时长'}</span>
					{badge ? <span style={{ width: badge.width, whiteSpace: 'nowrap', textAlign: 'center' }}>{badge.header}</span> : null}
					<span style={{ width: 64, whiteSpace: 'nowrap', textAlign: 'center' }}>详情</span>
					<span style={{ width: 52, whiteSpace: 'nowrap', textAlign: 'center' }}>{vocab.previewHeader}</span>{/* 行内「盘」列,表头必须等宽占位 —— 缺列致两 flex 列压窄整行左移 */}
				</div>
				{(!results || !results.length) && !scanning ? (
					<div style={{ padding: 24, color: 'var(--horosa-text-secondary)' }}>{results ? vocab.emptyResult : `尚未${vocab.action}。`}</div>
				) : null}
				{(results || []).map((row, i) => {
					const ck = `${scanEpoch || 0}:${i}`;	// 缓存键带扫描代际:重新扫描后旧判读绝不复用
					const ex = explainMap[ck] || {};
					return (
						<div key={i} style={{ borderBottom: '1px dashed var(--horosa-border)' }}>
							<div style={{ display: 'flex', gap: 10, padding: '9px 12px', alignItems: 'center' }}>
								<span style={{ width: 36, whiteSpace: 'nowrap', textAlign: 'right', color: 'var(--horosa-text-secondary)', fontSize: 'var(--horosa-fs-small)' }}>{i + 1}</span>
								<span style={{ flex: 1, fontSize: 'var(--horosa-fs-body)', cursor: 'pointer' }} title={vocab.startTitle}
									{...pressable(() => onPickInterval(row, 'start'))}>{row.start}</span>
								<span style={{ flex: 1, fontSize: 'var(--horosa-fs-body)', cursor: 'pointer' }} title={vocab.endTitle}
									{...pressable(() => onPickInterval(row, 'end'))}>{row.end}</span>
								<span style={{ width: 64, whiteSpace: 'nowrap', textAlign: 'right', fontSize: 'var(--horosa-fs-body)' }}>{durationCell(row)}</span>
								{badge ? (
									<span style={{ width: badge.width, whiteSpace: 'nowrap', textAlign: 'center', fontSize: 'var(--horosa-fs-small)' }}>
										<ZeriRowBadge text={badge.text(row)} />
									</span>
								) : null}
								<span style={{ width: 64, whiteSpace: 'nowrap', textAlign: 'center' }}>
									<XQButton size="small" onClick={() => {
										if(expandKey === ck){ setExpandKey(null); return; }
										setExpandKey(ck);
										if(!explainMap[ck] && typeof onExplain === 'function'){
											setExplainMap((mp) => ({ ...mp, [ck]: { loading: true } }));
											Promise.resolve().then(() => onExplain(row)).then((rsp) => {
												setExplainMap((mp) => ({ ...mp, [ck]: { tree: rsp && rsp.tree } }));
											}).catch((e) => {
												setExplainMap((mp) => ({ ...mp, [ck]: { err: (e && e.message) || '判读失败' } }));
											});
										}
									}}>{expandKey === ck ? '收起' : '详情'}<XQToggleCaret open={expandKey === ck} /></XQButton>
								</span>
								<span style={{ width: 52, whiteSpace: 'nowrap', textAlign: 'center' }}>
									<XQButton size="small" onClick={() => setPreviewRow(row)}>{vocab.previewButton}</XQButton>
								</span>
							</div>
							{expandKey === ck ? (
								<div style={{ padding: '4px 12px 10px 58px', background: 'rgba(var(--horosa-gold-rgb), .04)' }}>
									<div style={{ fontSize: 'var(--horosa-fs-caption)', color: 'var(--horosa-text-secondary)', marginBottom: 4 }}>{vocab.explainCaption}</div>
									{ex.loading ? <div style={{ fontSize: 'var(--horosa-fs-small)', color: 'var(--horosa-text-secondary)' }}>判读中…</div> : null}
									{ex.err ? <div style={{ fontSize: 'var(--horosa-fs-small)', color: 'var(--horosa-danger)' }}>{ex.err}</div> : null}
									{ex.tree ? renderExplainNode(ex.tree, collectUiLeaves(frozenTree || tree, []), { i: 0 }, 0, school) : null}
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);

	const onImportFile = (e) => {
		const file = e.target.files && e.target.files[0];
		e.target.value = '';
		if(!file){ return; }
		const reader = new FileReader();
		reader.onload = () => {
			const r = store.importSchemes(reader.result);
			setSchemeMsg(r.ok ? `已导入 ${r.added} 个方案(同名覆盖)` : `导入失败:${r.msg}`);
			setSchemeTick(schemeTick + 1);
		};
		reader.readAsText(file);
	};

	const schemesView = (
		<div style={{ height: VIEW_HEIGHT, display: 'flex', flexDirection: 'column' }}>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
				<XQButton size="small" onClick={() => { setView('edit'); setSchemeMsg(''); }}>← 返回条件</XQButton>
				<span style={{ fontWeight: 600 }}>方案管理</span>
				<span style={{ flex: 1 }} />
				{/* 统一按钮件 + 隐藏的文件框(此前手写 span.ant-btn:字偏高、键盘够不到) */}
				<input ref={importInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportFile} />
				<XQButton size="small" onClick={() => { if(importInputRef.current){ importInputRef.current.value = ''; importInputRef.current.click(); } }}>导入方案(JSON)</XQButton>
				<XQButton size="small" disabled={!schemes.length}
					onClick={() => downloadJson(store.exportSchemes(), `${school.name}方案_${new Date().toISOString().slice(0, 10)}.json`)}>
					导出全部(JSON)
				</XQButton>
			</div>
			{schemeMsg ? <div style={{ fontSize: 'var(--horosa-fs-small)', marginBottom: 8, opacity: 0.8 }}>{schemeMsg}</div> : null}
			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--horosa-border)', borderRadius: 8 }}>
				<div style={{ display: 'flex', fontSize: 'var(--horosa-fs-small)', color: 'var(--horosa-text-secondary)', padding: '8px 12px', gap: 10, borderBottom: '1px solid var(--horosa-border)' }}>
					<span style={{ flex: 1 }}>方案名</span>
					<span style={{ width: 150, whiteSpace: 'nowrap' }}>保存时间</span>
					<span style={{ width: 70, whiteSpace: 'nowrap', textAlign: 'right' }}>条件数</span>
					<span style={{ width: 250, whiteSpace: 'nowrap', textAlign: 'right' }}>操作</span>
				</div>
				{!schemes.length ? <div style={{ padding: 24, color: 'var(--horosa-text-secondary)' }}>暂无已存方案——条件页底部「保存方案」。</div> : null}
				{schemes.map((s) => (
					<div key={s.id} style={{ display: 'flex', gap: 10, padding: '8px 12px', alignItems: 'center', borderBottom: '1px dashed var(--horosa-border)' }}>
						{renameId === s.id ? (
							<span style={{ flex: 1, display: 'inline-flex', gap: 6 }}>
								<XQInput size="small" value={renameText} style={{ flex: 1 }} onChange={(e) => setRenameText(e.target.value)} />
								<XQButton size="small" type="primary" onClick={() => {
									const r = store.renameScheme(s.id, renameText);
									setSchemeMsg(r.ok ? '已重命名' : r.msg);
									setRenameId(null);
									setSchemeTick(schemeTick + 1);
								}}>存</XQButton>
								<XQButton size="small" onClick={() => setRenameId(null)}>取消</XQButton>
							</span>
						) : (
							<span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
						)}
						<span style={{ width: 150, whiteSpace: 'nowrap', fontSize: 'var(--horosa-fs-small)', opacity: 0.7 }}>{(s.savedAt || '').replace('T', ' ').slice(0, 16)}</span>
						<span style={{ width: 70, whiteSpace: 'nowrap', textAlign: 'right', fontSize: 'var(--horosa-fs-small)' }}>{(s.tree && s.tree.children && s.tree.children.length) || 0}</span>
						<span style={{ width: 250, whiteSpace: 'nowrap', textAlign: 'right', display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
							<XQButton size="small" type="primary" onClick={() => { applyScheme(s); setView('edit'); }}>载入</XQButton>
							<XQButton size="small" onClick={() => { setRenameId(s.id); setRenameText(s.name); }}>改名</XQButton>
							<XQButton size="small" onClick={() => downloadJson(store.exportSchemes([s.id]), `${school.name}方案_${s.name}.json`)}>导出</XQButton>
							<XQButton size="small" danger onClick={() => { store.deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删除</XQButton>
						</span>
					</div>
				))}
			</div>
			<div style={{ fontSize: 'var(--horosa-fs-caption)', color: 'var(--horosa-text-secondary)', marginTop: 8 }}>
				导出为 JSON 可跨设备/跨用户分享;导入同名方案以文件内容覆盖本地。
			</div>
		</div>
	);

	const closePreview = () => setPreviewRow(null);
	const preview = open && previewRow ? (school.preview
		? school.preview({ row: previewRow, props, onClose: closePreview })
		: (
			<ZeriMiniPanPopup
				geo={props.previewGeo || geo}	/* 冻结地点优先:概览口径 = 扫描口径(活 geo 曾致扫后改地点概览错盘) */
				tech={school.tech}
				techOptions={props.previewOptions || options}	/* 冻结参数优先:概览口径 = 扫描口径 */
				row={previewRow}
				computePan={typeof props.onPreviewPan === 'function' ? props.onPreviewPan : null}
				onExplain={typeof props.onPreviewExplain === 'function' ? props.onPreviewExplain : null}
				onClose={closePreview} />
		)) : null;

	return (
		<Modal
			title={(
				// 警示驻标题栏(标题与 × 之间):字号缩小塞一行,窄屏自动折行
				<div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 34 }}>
					<span style={{ flexShrink: 0 }}>{school.name}·{vocab.action}工作台</span>
					<span style={{ flex: 1, minWidth: 0, fontSize: 'var(--horosa-fs-caption)', fontWeight: 400, color: 'var(--horosa-sev-medium)', lineHeight: 1.35, whiteSpace: 'normal' }}>
						⚠ 结果为{school.disclaimerSubject}的机械筛选,仅供术数研习参考;不构成任何现实决策依据,勿迷信滥用——据此行事,后果自负。
					</span>
				</div>
			)}
			open={open}
			wrapClassName="horosa-zeri-workbench-modal"
			getContainer={false}	/* 🔴 原地渲染(勿挂 body portal):工作台开着切走子页时,FreezeInactive 冻结组件树
				但 body portal 的 Modal 漏在外面 —— X 点击的 setState 发生在冻结树里不重渲染,Modal 永远关不掉;原地渲染随页冻结一起隐藏 */
			onCancel={onClose}
			footer={null}
			width={1400}
			centered
			destroyOnClose={false}
			maskClosable={false}
		>
			{view === 'result' ? resultView : (view === 'schemes' ? schemesView : editView)}
			{preview}
		</Modal>
	);
}
