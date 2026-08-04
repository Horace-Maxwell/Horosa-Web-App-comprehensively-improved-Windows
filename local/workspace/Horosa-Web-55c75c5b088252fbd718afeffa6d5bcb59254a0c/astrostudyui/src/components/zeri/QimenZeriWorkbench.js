// [奇门择日] 找局工作台:四区布局/三视图(edit/result/schemes)逐字对齐天星 ConditionBuilderModal——
//   左列(560px):①时间范围·地点·参数(可编辑,播种自主盘) ②构造条件 ③连接门·取反四钮 ④动作排+「找局」
//   右列:已选条件链(行首 joiner 徽标/嵌套分组)+方案排(奇门专属方案库)。
// 差异仅三点:条件注册表=QIMEN_CONDITION_TYPES(本地求值);参数区=奇门 22 参数子集(死开关裁剪:
// 仅收板面生效项);结果表多「局」列,概览浮窗=DunJiaBoard 迷你盘。
import { useState, useEffect, useRef } from 'react';
import { Modal, Dropdown, Menu } from 'antd';
import { XQButton, XQSelect, XQCheckItem } from '../xq-ui';
import GeoCoordModal from '../amap/GeoCoordModal';
import ConditionParamsForm from './ConditionParamsForm';
import { formatGpsDms } from '../../divination/zeri/tianxingSnapshot';
import { JOINER_CN } from '../../divination/zeri/conditionTypes';
import {
	QIMEN_CONDITION_TYPES, newQimenLeaf, newQimenGroup, qimenLeafSummary,
} from '../../divination/zeri/qimenConditionTypes';
import { qimenZeriSchemeStore } from '../../divination/zeri/schemeStore';
import QimenMiniBoardPopup from './QimenMiniBoardPopup';
import {
	PAIPAN_OPTIONS, QIJU_METHOD_OPTIONS, SCHOOL_OPTIONS, ZHISHI_OPTIONS, YUEJIA_QIJU_OPTIONS,
	KONG_MODE_OPTIONS, MA_MODE_OPTIONS, YIXING_OPTIONS, TIME_ALG_OPTIONS, DAY_SWITCH_OPTIONS, ZHIRUN_LEAP_OPTIONS,
} from '../dunjia/DunJiaCalc';

function downloadJson(text, filename){
	try{
		const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 800);
	}catch(e){ /* 下载失败静默(受限 webview 环境) */ }
}

const Option = XQSelect.Option;
const OptGroup = XQSelect.OptGroup;

const JOINER_OPTIONS = [
	{ value: 'all', label: '且 AND' },
	{ value: 'any', label: '或 OR' },
	{ value: 'xor', label: '异或 XOR' },
];

// 晚子时时干开关(v2.2.1 语义,与 DunJiaMain 左栏同款两档)。
const LATE_ZI_OPTIONS = [
	{ value: 1, label: '晚子时·次日干起(默认)' },
	{ value: 0, label: '晚子时·当日干起' },
];

// 参数区描述表(值/标签全取 DunJiaCalc 官方常量,置灰联动复刻 DunJiaMain 左栏三条)。
// 死开关裁剪:性别/盘类/封局/相关人员与扫描判定无关,不入本区。
const PARAM_FIELDS = [
	{ key: 'paiPanType', label: '奇门类型', options: PAIPAN_OPTIONS },
	{ key: 'qijuMethod', label: '取局法', options: QIJU_METHOD_OPTIONS },
	{ key: 'zhirunLeapDays', label: '置闰阈值', options: ZHIRUN_LEAP_OPTIONS, when: (o)=>o.qijuMethod === 'zhirun' },
	{ key: 'shuziReportNumber', label: '报数', kind: 'input', when: (o)=>o.qijuMethod === 'shuzi' },
	{ key: 'school', label: '盘面起法', options: SCHOOL_OPTIONS },
	{ key: 'zhiShiType', label: '值使取法', options: ZHISHI_OPTIONS, disabled: (o)=>o.school !== '转盘' },
	{ key: 'yueJiaQiJuType', label: '月家起局', options: YUEJIA_QIJU_OPTIONS, disabled: (o)=>Number(o.paiPanType) !== 1 },
	{ key: 'kongMode', label: '空亡方式', options: KONG_MODE_OPTIONS },
	{ key: 'yimaMode', label: '驿马方式', options: MA_MODE_OPTIONS },
	{ key: 'shiftPalace', label: '移星', options: YIXING_OPTIONS },
	{ key: 'timeAlg', label: '时间算法', options: TIME_ALG_OPTIONS },
	{ key: 'after23NewDay', label: '换日', options: DAY_SWITCH_OPTIONS },
	{ key: 'lateZiHourUseNextDay', label: '晚子时时干', options: LATE_ZI_OPTIONS },
];

function optionLabel(list, value){
	const hit = (list || []).find((o)=>`${o.value}` === `${value}`);
	return hit ? hit.label : `${value === undefined || value === null ? '—' : value}`;
}

// ── 树路径纯工具(path=[]=根;[i,j]=children 索引链;与天星工作台同构) ──
function getAt(tree, path){
	let node = tree;
	for(const i of path){
		if(!node || !node.children){ return null; }
		node = node.children[i];
	}
	return node || null;
}
function mapAt(tree, path, fn){
	if(!path.length){ return fn(tree); }
	const [head, ...rest] = path;
	return { ...tree, children: tree.children.map((c, i) => (i === head ? mapAt(c, rest, fn) : c)) };
}
function removeAt(tree, path){
	if(!path.length){ return tree; }
	const parent = path.slice(0, -1);
	const idx = path[path.length - 1];
	return mapAt(tree, parent, (g) => ({ ...g, children: g.children.filter((_, i) => i !== idx) }));
}

// ── 详情展开:explain 树递归渲染(设定=UI 树叶 DFS 序,compile 不增删叶,先序一致) ──
function collectUiLeaves(node, out){
	if(!node){ return out; }
	if(node.kind === 'leaf'){ out.push(node); return out; }
	(node.children || []).forEach((c) => collectUiLeaves(c, out));
	return out;
}

const GATE_CN2 = { all: '且(全部满足)', any: '或(任一满足)', xor: '异或(奇数满足)', not: '非(取反)' };

function renderExplainNode(node, uiLeaves, counter, depth){
	const passTag = (ok) => (
		<span style={{ fontWeight: 700, color: ok ? '#2f9e63' : '#e5484d' }}>{ok ? '✓' : '✗'}</span>
	);
	if(node.kind === 'group'){
		return (
			<div key={`g${depth}_${counter.i}`} style={{ paddingLeft: depth ? 14 : 0, borderLeft: depth ? '2px solid rgba(212,175,55,.35)' : 'none', marginTop: depth ? 4 : 0 }}>
				<div style={{ fontSize: 12, opacity: 0.8 }}>{GATE_CN2[node.op] || node.op} {passTag(node.pass)}</div>
				{(node.children || []).map((c) => renderExplainNode(c, uiLeaves, counter, depth + 1))}
			</div>
		);
	}
	const ui = uiLeaves[counter.i];
	counter.i += 1;
	return (
		<div key={`l${counter.i}`} style={{ padding: '5px 0 5px 0', marginLeft: depth ? 14 : 0, borderBottom: '1px dashed rgba(148,163,184,.16)' }}>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
				<span style={{ opacity: 0.55 }}>设定</span>
				<span>{ui ? qimenLeafSummary(ui) : ((QIMEN_CONDITION_TYPES[node.type] || {}).label || node.type)}</span>
			</div>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginTop: 2 }}>
				<span style={{ opacity: 0.55 }}>实际</span>
				<span style={{ opacity: 0.9 }}>{node.actual}</span>
				{passTag(node.pass)}
			</div>
		</div>
	);
}

function pad2(n){ return n < 10 ? `0${n}` : `${n}`; }
function dateStrOf(d){ return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

export default function QimenZeriWorkbench({
	open, onClose, cfg, onCfgChange, geo, onGeoChange, options, onOptionsChange, onReloadFromBoard,
	tree, onTreeChange, onRun, onCancelScan, onPickInterval, onExplain, previewCtx, scanEpoch, resultsStale,
	scanning, progress, results, truncated, scanErr,
}){
	const [draftType, setDraftType] = useState('pattern_ji');
	const [draftParams, setDraftParams] = useState(() => newQimenLeaf('pattern_ji').params);
	const [draftNegate, setDraftNegate] = useState(false);
	const [selectedPath, setSelectedPath] = useState(null);
	const [view, setView] = useState('edit');
	const [paramsOpen, setParamsOpen] = useState(false);
	const [expandKey, setExpandKey] = useState(null);
	const [explainMap, setExplainMap] = useState({});
	const [previewRow, setPreviewRow] = useState(null);
	const [schemeName, setSchemeName] = useState('');
	const [schemeTick, setSchemeTick] = useState(0);
	const [renameId, setRenameId] = useState(null);
	const [renameText, setRenameText] = useState('');
	const [schemeMsg, setSchemeMsg] = useState('');

	useEffect(() => {
		if(scanning){ setView('result'); }
	}, [scanning]);

	// [R4-B7/C16 靶②] 「从未打开过」粘性短路(与天星 ConditionBuilderModal 同款):弹窗关着时
	// 宿主每次 render 白建 ~650 行元素树;打开过后永远走完整树(草稿/视图态/关闭动画全保留)。
	const everOpenRef = useRef(!!open);
	if(open && !everOpenRef.current){ everOpenRef.current = true; }
	if(!everOpenRef.current){ return null; }

	const opts = options || {};
	const selectedNode = selectedPath ? getAt(tree, selectedPath) : null;
	const selectedIsLeaf = !!(selectedNode && selectedNode.kind !== 'group' && !selectedNode.children);
	const selectedIsGroup = !!(selectedNode && (selectedNode.kind === 'group' || selectedNode.children));

	const resetDraft = (type) => {
		setDraftType(type);
		setDraftParams(newQimenLeaf(type).params);
		setDraftNegate(false);
	};
	const loadLeafToDraft = (leaf) => {
		setDraftType(leaf.type);
		setDraftParams(JSON.parse(JSON.stringify(leaf.params)));
		setDraftNegate(!!leaf.negate);
	};

	const draftLeaf = { kind: 'leaf', type: draftType, negate: draftNegate, params: draftParams };
	const draftSpec = QIMEN_CONDITION_TYPES[draftType] || {};
	const draftError = draftSpec.validate ? draftSpec.validate(draftParams) : '';

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
		onTreeChange(mapAt(tree, appendTargetPath, (g) => ({ ...g, children: [...g.children, newQimenGroup('any')] })));
	};
	const doRemove = (path) => {
		onTreeChange(removeAt(tree, path));
		setSelectedPath(null);
	};

	const applyScheme = (rec) => {
		if(rec && rec.tree){ onTreeChange(rec.tree); }
		if(rec && rec.config){
			if(rec.config.cfg){ onCfgChange({ ...cfg, ...rec.config.cfg }); }
			if(rec.config.geo && typeof onGeoChange === 'function'){ onGeoChange({ ...(geo || {}), ...rec.config.geo }); }
			if(rec.config.options && typeof onOptionsChange === 'function'){ onOptionsChange({ ...opts, ...rec.config.options }); }
		}
		setSelectedPath(null);
	};

	const schemes = qimenZeriSchemeStore.listSchemes();
	const history = qimenZeriSchemeStore.listHistory();
	const schemeMenu = (
		<Menu>
			{schemes.length ? schemes.map((s) => (
				<Menu.Item key={s.id}>
					<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
						<a onClick={(e) => { e.preventDefault(); applyScheme(s); }}>{s.name}</a>
						<a style={{ color: '#e5484d', fontSize: 11 }}
							onClick={(e) => { e.preventDefault(); e.stopPropagation(); qimenZeriSchemeStore.deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删</a>
					</span>
				</Menu.Item>
			)) : <Menu.Item key="none" disabled>暂无已存方案</Menu.Item>}
			{history.length ? (
				<Menu.SubMenu key="his" title="最近找局">
					{history.map((h, i) => (
						<Menu.Item key={`h${i}`}>
							<a onClick={(e) => { e.preventDefault(); applyScheme(h); }}>{(h.at || '').replace('T', ' ').slice(0, 16)}</a>
						</Menu.Item>
					))}
				</Menu.SubMenu>
			) : null}
		</Menu>
	);

	const setNodeProp = (path, patch) => onTreeChange(mapAt(tree, path, (n) => ({ ...n, ...patch })));
	const selIndex = selectedPath && selectedPath.length ? selectedPath[selectedPath.length - 1] : -1;
	const joinerToolbar = (
		<div style={{ padding: '8px 10px', borderTop: '1px solid rgba(148,163,184,.2)' }}>
			<div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>
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
					border: isSel ? '1px solid rgba(212,175,55,.85)' : '1px solid rgba(148,163,184,.25)',
					borderRadius: 8, padding: '7px 10px', marginBottom: 6, cursor: 'pointer',
					background: node.negate ? 'rgba(229,72,77,.06)' : (isSel ? 'rgba(212,175,55,.06)' : 'transparent'),
				}}
				onClick={(e) => {
					e.stopPropagation();
					setSelectedPath(path);
					if(!isGroup){ loadLeafToDraft(node); }
				}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
					{index > 0 ? (
						<span style={{
							fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
							background: 'rgba(212,175,55,.14)', border: '1px solid rgba(212,175,55,.4)',
							flexShrink: 0,
						}}>{JOINER_CN[node.joiner || 'all']}</span>
					) : null}
					{node.negate ? <span style={{ color: '#e5484d', fontWeight: 700, flexShrink: 0 }}>非</span> : null}
					{isGroup ? (
						<span style={{ fontSize: 12, fontWeight: 600 }}>分组({(node.children || []).length} 条)</span>
					) : (
						// 行首已有独立「非」标,摘要剥掉自带前缀防「非 非·」双显(快照/详情/预览无独立标,保留前缀)
						<span style={{ fontSize: 12 }}>{qimenLeafSummary({ ...node, negate: false })}</span>
					)}
					<span style={{ flex: 1 }} />
					<XQButton size="small" danger onClick={(e) => { e.stopPropagation(); doRemove(path); }}>删除</XQButton>
				</div>
				{isGroup ? (
					<div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid rgba(212,175,55,.35)' }}>
						{(node.children || []).map((c, i) => renderRow(c, [...path, i], i, depth + 1))}
						{!(node.children || []).length ? (
							<div style={{ padding: '6px 2px', fontSize: 12, opacity: 0.5 }}>空分组:选中本组后左侧「添加到列表」即入组,或删除本组。</div>
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
				<div style={{ padding: '10px 4px', fontSize: 12, opacity: 0.55 }}>尚无条件——左侧构造后点「添加到列表」。</div>
			) : null}
		</div>
	);

	// 时间范围预设芯片(今日为锚,系统本地日历;仅便捷填充,扫描时区仍取地点 zone)。
	const applyPreset = (days) => {
		const now = new Date();
		const start = dateStrOf(now);
		const endDate = new Date(now.getTime() + (days - 1) * 86400e3);
		onCfgChange({ ...cfg, startDate: start, startTime: '00:00', endDate: dateStrOf(endDate), endTime: '23:59' });
	};

	const paramChips = [
		optionLabel(PAIPAN_OPTIONS, opts.paiPanType),
		optionLabel(QIJU_METHOD_OPTIONS, opts.qijuMethod),
		optionLabel(SCHOOL_OPTIONS, opts.school),
		`空亡${optionLabel(KONG_MODE_OPTIONS, opts.kongMode)}`,
		`驿马${optionLabel(MA_MODE_OPTIONS, opts.yimaMode)}`,
		optionLabel(TIME_ALG_OPTIONS, opts.timeAlg),
		optionLabel(DAY_SWITCH_OPTIONS, opts.after23NewDay),
	];

	const paramGrid = (
		<div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 64px minmax(0,1fr)', gap: '8px 8px', alignItems: 'center', marginTop: 8 }}>
			{PARAM_FIELDS.filter((f) => !f.when || f.when(opts)).map((f) => {
				const disabled = f.disabled ? f.disabled(opts) : false;
				return [
					<span key={`${f.key}_l`} style={{ fontSize: 12, opacity: 0.7, textAlign: 'right', whiteSpace: 'nowrap' }}>{f.label}</span>,
					f.kind === 'input' ? (
						<input key={`${f.key}_c`} value={opts[f.key] === undefined || opts[f.key] === null ? '' : opts[f.key]}
							placeholder="如 168"
							style={{ width: '100%', boxSizing: 'border-box' }}
							onChange={(e) => onOptionsChange({ ...opts, [f.key]: e.target.value })} />
					) : (
						<XQSelect key={`${f.key}_c`} size="small" style={{ width: '100%' }} value={opts[f.key]}
							disabled={disabled} dropdownMatchSelectWidth={false}
							getPopupContainer={(t) => t.closest('.ant-modal-body') || t.parentElement}
							onChange={(v) => onOptionsChange({ ...opts, [f.key]: v })}>
							{f.options.map((o) => (<Option key={`${o.value}`} value={o.value}>{o.label}</Option>))}
						</XQSelect>
					),
				];
			})}
		</div>
	);

	// 地点显示:地名优先,否则度分+方位字母(与天星/左栏同口径;裸经纬小数串太长且无方位,用户圈报)。
	const geoLabel = geo && geo.pos
		? `📍 ${geo.pos}`
		: (geo && geo.gpsLat !== undefined && geo.gpsLat !== null ? `📍 ${formatGpsDms(geo.gpsLon, geo.gpsLat)}` : '选择地点…');

	const editView = (
		<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 12, height: 620 }}>
			{/* 左列(主操作区,加宽):时间范围·地点·参数 / 构造条件 / 连接门 / 动作排 */}
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ padding: 10, borderBottom: '1px solid rgba(148,163,184,.2)' }}>
					<div style={{ fontWeight: 600, marginBottom: 8 }}>时间范围·地点·参数</div>
					{/* 行1:起止时间 + 今日/3天/7天/30天 快捷档(同一行,用户规格;输入框定宽防快捷档被挤折行) */}
					<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
						<input type="date" className="horosa-native-date" style={{ width: 118 }} value={cfg.startDate}
							onChange={(e) => onCfgChange({ ...cfg, startDate: e.target.value })} />
						<input type="time" className="horosa-native-date" style={{ width: 86 }} value={cfg.startTime}
							onChange={(e) => onCfgChange({ ...cfg, startTime: e.target.value })} />
						<span style={{ opacity: 0.6 }}>→</span>
						<input type="date" className="horosa-native-date" style={{ width: 118 }} value={cfg.endDate}
							onChange={(e) => onCfgChange({ ...cfg, endDate: e.target.value })} />
						<input type="time" className="horosa-native-date" style={{ width: 86 }} value={cfg.endTime}
							onChange={(e) => onCfgChange({ ...cfg, endTime: e.target.value })} />
						{/* 快捷档整簇右贴边:与下行「编辑参数」右缘对齐(用户圈报右侧参差) */}
						<span style={{ flex: 1 }} />
						{[['今日', 1], ['3天', 3], ['7天', 7], ['30天', 30]].map(([label, days]) => (
							<XQButton key={label} size="small" onClick={() => applyPreset(days)}>{label}</XQButton>
						))}
					</div>
					{/* 行2:地点(度分+方位) + 时区 + 从主盘重载 | 编辑参数 */}
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
						<GeoCoordModal lat={geo && geo.gpsLat} lng={geo && geo.gpsLon} onOk={(rec) => onGeoChange(rec)}>
							<XQButton size="small">{geoLabel}</XQButton>
						</GeoCoordModal>
						<span style={{ fontSize: 11, opacity: 0.6 }}>时区 {geo && geo.zone !== undefined ? geo.zone : '—'}</span>
						<XQButton size="small" onClick={onReloadFromBoard} title="用左栏「起盘选项」当前值覆盖本面板的地点与参数">从主盘重载</XQButton>
						<span style={{ flex: 1 }} />
						<XQButton size="small" onClick={() => setParamsOpen(!paramsOpen)}>{paramsOpen ? '收起参数 ▲' : '编辑参数 ▼'}</XQButton>
					</div>
					{!paramsOpen ? (
						<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
							{paramChips.map((c, i) => (
								<span key={i} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: 'rgba(148,163,184,.12)', border: '1px solid rgba(148,163,184,.3)' }}>{c}</span>
							))}
						</div>
					) : paramGrid}
				</div>
				<div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid rgba(148,163,184,.2)' }}>构造条件</div>
				<div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
						<span style={{ fontSize: 11, opacity: 0.65 }}>条件类型</span>
						{/* 下拉挂进 Modal 内(getPopupContainer):body 门户浮层垂出 Modal 底边悬在遮罩上,
						    近旁点击会命中遮罩整台关闭(真机实抓;幽灵浮层同族病根治法) */}
						<XQSelect size="small" style={{ minWidth: 150 }} value={draftType}
							onChange={(v) => resetDraft(v)} dropdownMatchSelectWidth={false}
							getPopupContainer={(t) => t.closest('.ant-modal-body') || t.parentElement}>
							{['格局', '盘面', '纲要', '四柱'].map((cat) => (
								<OptGroup label={cat} key={cat}>
									{Object.entries(QIMEN_CONDITION_TYPES).filter(([, spec]) => spec.category === cat).map(([key, spec]) => (
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
					<ConditionParamsForm types={QIMEN_CONDITION_TYPES} type={draftType} params={draftParams} onChange={setDraftParams} />
					<div style={{
						marginTop: 12, padding: '8px 10px', borderRadius: 8,
						border: '1px dashed rgba(212,175,55,.5)', background: 'rgba(212,175,55,.05)',
						display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12,
					}}>
						{qimenLeafSummary(draftLeaf)}
					</div>
					{draftError ? <div style={{ color: '#e5484d', fontSize: 12, marginTop: 6 }}>{draftError}</div> : null}
				</div>
				{joinerToolbar}
				<div style={{ padding: 10, borderTop: '1px solid rgba(148,163,184,.2)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
					<XQButton size="small" onClick={doAdd} disabled={!!draftError}>
						添加到列表{selectedIsGroup ? '(选中组)' : ''}
					</XQButton>
					<XQButton size="small" onClick={doReplace} disabled={!selectedIsLeaf || !!draftError}>替换选中</XQButton>
					<XQButton size="small" onClick={doAddGroup}>添加子分组</XQButton>
					<span style={{ flex: 1 }} />
					<XQButton size="small" onClick={() => { onTreeChange({ ...tree, children: [] }); setSelectedPath(null); }}
						disabled={!tree.children.length}>清空全部</XQButton>
					<XQButton size="small" type="primary" onClick={() => { setView('result'); onRun(); }} disabled={scanning || !tree.children.length}>
						找局
					</XQButton>
				</div>
			</div>
			{/* 右列(收窄):已选条件链 + 方案排 */}
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>
				<div style={{ flex: 1, minHeight: 0, border: '1px solid rgba(148,163,184,.25)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
					<div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid rgba(148,163,184,.2)', display: 'flex', alignItems: 'center', gap: 8 }}
						title="点击行选中后,用左下「连接门·取反」四钮直接改该行;行首徽标=本行与上方结果的连接门">
						已选条件
						<span style={{ fontSize: 11, opacity: 0.55, fontWeight: 400 }}>点行选中·左下改门/取反</span>
					</div>
					<div style={{ flex: 1, overflowY: 'auto', padding: 10 }} onClick={() => setSelectedPath(null)}>
						{renderNode(tree)}
					</div>
					<div style={{ padding: '6px 10px', borderTop: '1px solid rgba(148,163,184,.2)', display: 'flex', gap: 8, alignItems: 'center' }}>
						<input placeholder="方案名…" value={schemeName} style={{ width: 128 }}
							onChange={(e) => setSchemeName(e.target.value)} />
						<XQButton size="small" disabled={!schemeName.trim()} onClick={() => {
							const r = qimenZeriSchemeStore.saveScheme(schemeName, { cfg, geo, options: opts }, tree);
							if(r.ok){ setSchemeName(''); setSchemeTick(schemeTick + 1); }
						}}>保存方案</XQButton>
						<Dropdown overlay={schemeMenu} trigger={['click']}>
							<XQButton size="small">载入方案▾</XQButton>
						</Dropdown>
						<XQButton size="small" onClick={() => setView('schemes')}>方案管理…</XQButton>
						{scanErr ? <span style={{ color: '#e5484d', fontSize: 12, marginLeft: 8 }}>{scanErr}</span> : null}
					</div>
				</div>
			</div>
		</div>
	);

	const resultView = (
		<div style={{ height: 620, display: 'flex', flexDirection: 'column' }}>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
				<XQButton size="small" onClick={() => setView('edit')} disabled={scanning}>← 返回条件</XQButton>
				<span style={{ fontWeight: 600 }}>找局结果</span>
				{scanning && progress ? (
					<span style={{ fontSize: 12, opacity: 0.75 }}>扫描中 {progress.done}/{progress.total} 样 · 已命中 {progress.hits}</span>
				) : null}
				{scanning ? <XQButton size="small" onClick={onCancelScan}>取消</XQButton> : null}
				<span style={{ flex: 1 }} />
				{!scanning && results ? (
					<span style={{ fontSize: 12, opacity: 0.7 }}>
						共 {results.length} 个时段{truncated ? '(已达上限截断,请缩小时间段)' : ''};点击行即起盘看盘
					</span>
				) : null}
			</div>
			{!scanning && scanErr ? <div style={{ color: '#e5484d', fontSize: 12, marginBottom: 8 }}>{scanErr}</div> : null}
			{resultsStale ? (
				<div style={{ color: '#8a6d1a', background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.4)', borderRadius: 6, fontSize: 12, padding: '5px 10px', marginBottom: 8 }}>
					⚠ 条件/参数/时间范围已被修改:下方结果对应「上一次找局」——请重新点「找局」。
				</div>
			) : null}
			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ display: 'flex', fontSize: 12, opacity: 0.6, padding: '8px 12px', gap: 10, borderBottom: '1px solid rgba(148,163,184,.2)', position: 'sticky', top: 0, background: 'var(--horosa-astro-panel, #fff)', zIndex: 1 }}>
					<span style={{ width: 36 }}>#</span>
					<span style={{ flex: 1 }}>开始(点击=起始时刻起盘)</span>
					<span style={{ flex: 1 }}>结束(点击=结束时刻起盘)</span>
					<span style={{ width: 64, textAlign: 'right' }}>时长</span>
					<span style={{ width: 118, textAlign: 'center' }}>局</span>
					<span style={{ width: 64, textAlign: 'center' }}>详情</span>
					<span style={{ width: 52, textAlign: 'center' }}>概览</span>
				</div>
				{(!results || !results.length) && !scanning ? (
					<div style={{ padding: 24, opacity: 0.6 }}>{results ? '时间范围内无满足条件的时辰。' : '尚未找局。'}</div>
				) : null}
				{(results || []).map((row, i) => (
					<div key={i} style={{ borderBottom: '1px dashed rgba(148,163,184,.18)' }}>
						<div style={{ display: 'flex', gap: 10, padding: '9px 12px', alignItems: 'center' }}>
							<span style={{ width: 36, textAlign: 'right', opacity: 0.5, fontSize: 12 }}>{i + 1}</span>
							<span style={{ flex: 1, fontSize: 13, cursor: 'pointer' }} title="以时段起始时刻起盘"
								onClick={() => onPickInterval(row, 'start')}>{row.start}</span>
							<span style={{ flex: 1, fontSize: 13, cursor: 'pointer' }} title="以时段结束时刻起盘"
								onClick={() => onPickInterval(row, 'end')}>{row.end}</span>
							<span style={{ width: 64, textAlign: 'right', fontSize: 13 }}>
								{row.durationMin >= 90 ? `${(row.durationMin / 60).toFixed(1)}小时` : `${Math.round(row.durationMin)}分`}
							</span>
							<span style={{ width: 118, textAlign: 'center', fontSize: 12 }}>
								<span style={{ padding: '1px 8px', borderRadius: 10, background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.35)' }}>{row.juText || '—'}</span>
							</span>
							<span style={{ width: 64, textAlign: 'center' }}>
								<XQButton size="small" onClick={() => {
									// 缓存键带找局代际:重新找局后旧判读绝不复用(天星真机实抓旧树判读串行同款防御)
									const ck = `${scanEpoch || 0}:${i}`;
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
								}}>{expandKey === `${scanEpoch || 0}:${i}` ? '收起 ▲' : '详情 ▼'}</XQButton>
							</span>
							<span style={{ width: 52, textAlign: 'center' }}>
								<XQButton size="small" onClick={() => setPreviewRow(row)}>盘</XQButton>
							</span>
						</div>
						{expandKey === `${scanEpoch || 0}:${i}` ? (
							<div style={{ padding: '4px 12px 10px 58px', background: 'rgba(212,175,55,.04)' }}>
								<div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>
									以时段起始时刻逐条判读(设定 vs 实际;判定与扫描引擎同源)
								</div>
								{(explainMap[`${scanEpoch || 0}:${i}`] || {}).loading ? <div style={{ fontSize: 12, opacity: 0.6 }}>判读中…</div> : null}
								{(explainMap[`${scanEpoch || 0}:${i}`] || {}).err ? <div style={{ fontSize: 12, color: '#e5484d' }}>{explainMap[`${scanEpoch || 0}:${i}`].err}</div> : null}
								{(explainMap[`${scanEpoch || 0}:${i}`] || {}).tree
									? renderExplainNode(explainMap[`${scanEpoch || 0}:${i}`].tree, collectUiLeaves(tree, []), { i: 0 }, 0)
									: null}
							</div>
						) : null}
					</div>
				))}
			</div>
		</div>
	);

	const onImportFile = (e) => {
		const file = e.target.files && e.target.files[0];
		e.target.value = '';
		if(!file){ return; }
		const reader = new FileReader();
		reader.onload = () => {
			const r = qimenZeriSchemeStore.importSchemes(reader.result);
			setSchemeMsg(r.ok ? `已导入 ${r.added} 个方案(同名覆盖)` : `导入失败:${r.msg}`);
			setSchemeTick(schemeTick + 1);
		};
		reader.readAsText(file);
	};

	const schemesView = (
		<div style={{ height: 620, display: 'flex', flexDirection: 'column' }}>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
				<XQButton size="small" onClick={() => { setView('edit'); setSchemeMsg(''); }}>← 返回条件</XQButton>
				<span style={{ fontWeight: 600 }}>方案管理</span>
				<span style={{ flex: 1 }} />
				<label style={{ display: 'inline-block' }}>
					<input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportFile} />
					<span className="ant-btn ant-btn-sm" style={{ cursor: 'pointer' }}>导入方案(JSON)</span>
				</label>
				<XQButton size="small" disabled={!schemes.length}
					onClick={() => downloadJson(qimenZeriSchemeStore.exportSchemes(), `奇门择日方案_${new Date().toISOString().slice(0, 10)}.json`)}>
					导出全部(JSON)
				</XQButton>
			</div>
			{schemeMsg ? <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.8 }}>{schemeMsg}</div> : null}
			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ display: 'flex', fontSize: 12, opacity: 0.6, padding: '8px 12px', gap: 10, borderBottom: '1px solid rgba(148,163,184,.2)' }}>
					<span style={{ flex: 1 }}>方案名</span>
					<span style={{ width: 150 }}>保存时间</span>
					<span style={{ width: 70, textAlign: 'right' }}>条件数</span>
					<span style={{ width: 250, textAlign: 'right' }}>操作</span>
				</div>
				{!schemes.length ? <div style={{ padding: 24, opacity: 0.6 }}>暂无已存方案——条件页底部「保存方案」。</div> : null}
				{schemes.map((s) => (
					<div key={s.id} style={{ display: 'flex', gap: 10, padding: '8px 12px', alignItems: 'center', borderBottom: '1px dashed rgba(148,163,184,.18)' }}>
						{renameId === s.id ? (
							<span style={{ flex: 1, display: 'inline-flex', gap: 6 }}>
								<input value={renameText} style={{ flex: 1 }} onChange={(e) => setRenameText(e.target.value)} />
								<XQButton size="small" type="primary" onClick={() => {
									const r = qimenZeriSchemeStore.renameScheme(s.id, renameText);
									setSchemeMsg(r.ok ? '已重命名' : r.msg);
									setRenameId(null);
									setSchemeTick(schemeTick + 1);
								}}>存</XQButton>
								<XQButton size="small" onClick={() => setRenameId(null)}>取消</XQButton>
							</span>
						) : (
							<span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
						)}
						<span style={{ width: 150, fontSize: 12, opacity: 0.7 }}>{(s.savedAt || '').replace('T', ' ').slice(0, 16)}</span>
						<span style={{ width: 70, textAlign: 'right', fontSize: 12 }}>{(s.tree && s.tree.children && s.tree.children.length) || 0}</span>
						<span style={{ width: 250, textAlign: 'right', display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
							<XQButton size="small" type="primary" onClick={() => { applyScheme(s); setView('edit'); }}>载入</XQButton>
							<XQButton size="small" onClick={() => { setRenameId(s.id); setRenameText(s.name); }}>改名</XQButton>
							<XQButton size="small" onClick={() => downloadJson(qimenZeriSchemeStore.exportSchemes([s.id]), `奇门择日方案_${s.name}.json`)}>导出</XQButton>
							<XQButton size="small" danger onClick={() => { qimenZeriSchemeStore.deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删除</XQButton>
						</span>
					</div>
				))}
			</div>
			<div style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>
				导出为 JSON 可跨设备/跨用户分享;导入同名方案以文件内容覆盖本地。
			</div>
		</div>
	);

	return (
		<Modal
			title={(
				// 警示驻标题栏(标题与 × 之间,用户规格):字号缩小塞一行,窄屏自动折行。
				<div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 34 }}>
					<span style={{ flexShrink: 0 }}>奇门择日·找局工作台</span>
					<span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 400, color: '#8a6d1a', lineHeight: 1.35, whiteSpace: 'normal' }}>
						⚠ 结果为盘面条件的机械筛选,仅供术数研习参考;不构成任何现实决策依据,勿迷信滥用——据此行事,后果自负。
					</span>
				</div>
			)}
			open={open}
			onCancel={onClose}
			footer={null}
			width={1180}
			centered
			destroyOnClose={false}
			maskClosable={false}
		>
			{view === 'result' ? resultView : (view === 'schemes' ? schemesView : editView)}
			{previewRow && previewCtx ? (
				<QimenMiniBoardPopup
					row={previewRow}
					geoParams={previewCtx.geoParams}
					options={previewCtx.options}
					seeds={previewCtx.seeds}
					onClose={() => setPreviewRow(null)} />
			) : null}
		</Modal>
	);
}
