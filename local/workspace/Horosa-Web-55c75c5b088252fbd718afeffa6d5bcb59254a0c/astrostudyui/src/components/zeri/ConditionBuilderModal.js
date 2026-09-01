import { useState, useEffect, useRef } from 'react';
import { Modal, Dropdown, Menu, message } from 'antd';
import { XQButton, XQSelect, XQCheckItem } from '../xq-ui';
import * as AstroConst from '../../constants/AstroConst';
import { getHousesOption } from '../comp/CompHelper';
import GeoCoordModal from '../amap/GeoCoordModal';
import ConditionParamsForm from './ConditionParamsForm';
import { CONDITION_TYPES, newLeaf, newGroup, JOINER_CN, auditTreeAgainstRegistry } from '../../divination/zeri/conditionTypes';
import { formatGpsDms } from '../../divination/zeri/tianxingSnapshot';
import { conditionSummary } from '../../divination/zeri/conditionGlyph';
import { fetchChart } from '../../services/astro';
import AstroChart from '../astro/AstroChart';
import {
	listSchemes, saveScheme, deleteScheme, listHistory,
	renameScheme, exportSchemes, importSchemes,
} from '../../divination/zeri/schemeStore';

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

// ── 树路径纯工具(path=[]=根;[i,j]=children 索引链) ──
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

// 天星择日·征象搜索工作台:大固定窗(1180×~680,不可缩放),四区制——
//   左上=征象构造(类型+参数+glyph 预览) | 左下=动作(添加/替换/子分组/清空/搜索)
//   右上=时间段+地点+盘面(黄道/宫制)   | 右下=已选征象树列表(选中/取反/删除/门)
// 点「开始搜索」切换到结果视图(进度/区间表/点击行跳盘),「返回条件」回工作台。
// ── R4 概览浮窗:可拖拽(标题栏)/可缩放(右下角)的迷你盘,fixed 于视口,不关结果表 ──
function MiniChartPopup({ params, title, onClose, display }){
	const [box, setBox] = useState({ x: 110, y: 56, w: 680, h: 740 });   // 默认足够展开完整盘(用户实测 520 挤)
	const [chartObj, setChartObj] = useState(null);
	const [err, setErr] = useState('');
	useEffect(() => {
		let dead = false;
		setChartObj(null);
		setErr('');
		fetchChart(params, { cache: true }).then((rsp) => {
			// fetchChart 返回整包 {Result: chartObj}(shell.refetch 同款取法)
			const chart = (rsp && rsp.Result) ? rsp.Result : rsp;
			if(!dead){ setChartObj(chart); }
		}).catch((e) => { if(!dead){ setErr(e.message || '排盘失败'); } });
		return () => { dead = true; };
	}, [JSON.stringify(params)]);
	const dragFrom = (e, mode) => {
		e.preventDefault();
		e.stopPropagation();
		const start = { mx: e.clientX, my: e.clientY, ...box };
		const move = (ev) => {
			const dx = ev.clientX - start.mx;
			const dy = ev.clientY - start.my;
			if(mode === 'drag'){
				setBox((b) => ({ ...b, x: Math.max(0, start.x + dx), y: Math.max(0, start.y + dy) }));
			}else{
				setBox((b) => ({ ...b, w: Math.max(320, start.w + dx), h: Math.max(360, start.h + dy) }));
			}
		};
		const up = () => {
			document.removeEventListener('mousemove', move);
			document.removeEventListener('mouseup', up);
		};
		document.addEventListener('mousemove', move);
		document.addEventListener('mouseup', up);
	};
	return (
		<div style={{
			position: 'fixed', left: box.x, top: box.y, width: box.w, height: box.h,
			zIndex: 2100, background: 'var(--horosa-astro-panel, #fff)', borderRadius: 10,
			border: '1px solid rgba(148,163,184,.45)', boxShadow: '0 12px 40px rgba(0,0,0,.28)',
			display: 'flex', flexDirection: 'column', overflow: 'hidden',
		}}>
			<div onMouseDown={(e) => dragFrom(e, 'drag')}
				style={{ cursor: 'move', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(148,163,184,.25)', userSelect: 'none' }}>
				<span style={{ fontWeight: 600, fontSize: 13 }}>概览 · {title}</span>
				<span style={{ flex: 1 }} />
				<span onMouseDown={(e) => e.stopPropagation()} onClick={onClose}
					style={{ cursor: 'pointer', fontSize: 16, lineHeight: 1, opacity: 0.65, padding: '0 4px' }}>×</span>
			</div>
			<div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
				{chartObj ? (
					<div style={{ position: 'absolute', inset: 0 }}>
						<AstroChart value={chartObj}
							wheelArt={(display || {}).wheelArt}	/* 🔴 函数组件禁用类式 props 访问(此处曾误写类式取 wheelArt——浮窗一开即崩 TypeError,用户实报;盘式经 previewDisplay 通道) */
							chartDisplay={(display || {}).chartDisplay}
							planetDisplay={(display || {}).planetDisplay}
							lotsDisplay={(display || {}).lotsDisplay}
							showAstroMeaning={(display || {}).showAstroMeaning} />
					</div>
				) : (
					<div style={{ padding: 20, opacity: 0.6, fontSize: 12 }}>{err || '排盘中…'}</div>
				)}
			</div>
			<div onMouseDown={(e) => dragFrom(e, 'resize')}
				style={{ position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, cursor: 'nwse-resize',
					background: 'linear-gradient(135deg, transparent 50%, rgba(148,163,184,.6) 50%)' }} />
		</div>
	);
}

// ── R4 详情展开:explain 树(编译形)递归渲染;设定文本=UI 树叶 DFS 序映射(compile 不增删叶,先序一致) ──
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
	const segs = ui ? conditionSummary(ui) : null;
	return (
		<div key={`l${counter.i}`} style={{ padding: '5px 0 5px 0', marginLeft: depth ? 14 : 0, borderBottom: '1px dashed rgba(148,163,184,.16)' }}>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
				<span style={{ opacity: 0.55 }}>设定</span>
				{segs ? segs.map((sg, i) => (
					<span key={i} style={sg.glyph ? { fontFamily: AstroConst.AstroFont, fontSize: 16 } : {}}>{sg.text}</span>
				)) : <span>{(CONDITION_TYPES[node.type] || {}).label || node.type}</span>}
				{ui && ui.negate ? <span style={{ color: '#e5484d' }}>(取反)</span> : null}
			</div>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginTop: 2 }}>
				<span style={{ opacity: 0.55 }}>实际</span>
				<span style={{ opacity: 0.9 }}>{node.actual}</span>
				{passTag(node.pass)}
			</div>
		</div>
	);
}

export default function ConditionBuilderModal({
	open, onClose, cfg, onCfgChange, tree, onTreeChange,
	onRun, onCancelScan, onPickInterval, onExplain, onPreviewParams, previewDisplay, scanEpoch, resultsStale,
	scanning, progress, results, truncated, scanErr,
}){
	const [draftType, setDraftType] = useState('aspect');
	const [draftParams, setDraftParams] = useState(() => newLeaf('aspect').params);
	const [draftNegate, setDraftNegate] = useState(false);
	const [selectedPath, setSelectedPath] = useState(null);
	const [view, setView] = useState('edit');
	const [expandKey, setExpandKey] = useState(null);      // 详情展开的行号
	const [explainMap, setExplainMap] = useState({});      // 行号 → explain 树/loading/err
	const [previewRow, setPreviewRow] = useState(null);    // 概览浮窗的行
	const [schemeName, setSchemeName] = useState('');
	const [schemeTick, setSchemeTick] = useState(0);
	const [renameId, setRenameId] = useState(null);
	const [renameText, setRenameText] = useState('');
	const [schemeMsg, setSchemeMsg] = useState('');

	useEffect(() => {
		if(scanning){ setView('result'); }
	}, [scanning]);

	// [R4-B7/C16 靶②] 「从未打开过」粘性短路:弹窗关着时宿主每次 render(步进/改条件/扫描进度)
	// 都要白跑本函数体的派生计算 + 白建 ~650 行元素树(antd Modal open=false 不挂 DOM 但构造照付)。
	// 打开过一次后永远走完整树(内部 12+ useState 草稿/视图态与关闭动画全保留,零功能降级);
	// 粘性标记在全部 hooks 之后短路,不违 hooks 规则。
	const everOpenRef = useRef(!!open);
	if(open && !everOpenRef.current){ everOpenRef.current = true; }
	if(!everOpenRef.current){ return null; }

	const selectedNode = selectedPath ? getAt(tree, selectedPath) : null;
	const selectedIsLeaf = !!(selectedNode && selectedNode.kind !== 'group' && !selectedNode.children);
	const selectedIsGroup = !!(selectedNode && (selectedNode.kind === 'group' || selectedNode.children));

	const resetDraft = (type) => {
		setDraftType(type);
		setDraftParams(newLeaf(type).params);
		setDraftNegate(false);
	};

	const loadLeafToDraft = (leaf) => {
		setDraftType(leaf.type);
		setDraftParams(JSON.parse(JSON.stringify(leaf.params)));
		setDraftNegate(!!leaf.negate);
	};

	const draftLeaf = { kind: 'leaf', type: draftType, negate: draftNegate, params: draftParams };
	const draftError = (CONDITION_TYPES[draftType] && CONDITION_TYPES[draftType].validate)
		? CONDITION_TYPES[draftType].validate(draftParams) : '';

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
		onTreeChange(mapAt(tree, appendTargetPath, (g) => ({ ...g, children: [...g.children, newGroup('any')] })));
	};
	const doRemove = (path) => {
		onTreeChange(removeAt(tree, path));
		setSelectedPath(null);
	};

	const applyScheme = (rec) => {
	// [F7 根修] 载入前审计值域:方案里的条件类/选项值可能已随版本演进被删——
	// 那类行会静默恒不命中(needValues 只拦空、compile 不查值域、evaluate includes 恒 false)。
	// 审计只提示不拦载入:用户看得见哪些行失效,自行改设;静默才是事故。
	const __schemeIssues = (rec && rec.tree) ? auditTreeAgainstRegistry(rec.tree, CONDITION_TYPES) : [];
	if(__schemeIssues.length){
		message.warning(`方案「${rec && rec.name ? rec.name : ''}」有 ${__schemeIssues.length} 处已失效设置:${__schemeIssues.slice(0, 2).join(';')}${__schemeIssues.length > 2 ? ';…' : ''}`, 8);
	}
		if(rec && rec.tree){ onTreeChange(rec.tree); }
		if(rec && rec.config){ onCfgChange({ ...cfg, ...rec.config }); }
		setSelectedPath(null);
	};

	const schemes = listSchemes();
	const history = listHistory();
	const schemeMenu = (
		<Menu>
			{schemes.length ? schemes.map((s) => (
				<Menu.Item key={s.id}>
					<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
						<a onClick={(e) => { e.preventDefault(); applyScheme(s); }}>{s.name}</a>
						<a style={{ color: '#e5484d', fontSize: 11 }}
							onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删</a>
					</span>
				</Menu.Item>
			)) : <Menu.Item key="none" disabled>暂无已存方案</Menu.Item>}
			{history.length ? (
				<Menu.SubMenu key="his" title="最近计算">
					{history.map((h, i) => (
						<Menu.Item key={`h${i}`}>
							<a onClick={(e) => { e.preventDefault(); applyScheme(h); }}>{(h.at || '').replace('T', ' ').slice(0, 16)}</a>
						</Menu.Item>
					))}
				</Menu.SubMenu>
			) : null}
		</Menu>
	);

	// ── 右下:已选征象链式列表 ──
	// 每行=一条征象(或子分组);第 2 行起行首只读徽标显示本行与上方结果的连接门(且/或/异或)。
	// 选中某行 → 行下展开同排四钮:且/或/异或(单选,首行无)+取反(开关)——用户规格,弃常驻分段器。
	const setNodeProp = (path, patch) => onTreeChange(mapAt(tree, path, (n) => ({ ...n, ...patch })));

	// 常驻四钮工具条(用户规格:放左列最下方空白区):先点选右侧列表某一行,再点这里直接改该行——
	// 且/或/异或=该行与上方结果的连接门(首行无门,前三禁用);取反=该行 NOT 开关。
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
						conditionSummary(node).map((s, i) => (
							<span key={i} title={s.title || undefined}
								style={s.glyph ? { fontFamily: AstroConst.AstroFont, fontSize: 16 } : { fontSize: 12 }}>
								{s.text}
							</span>
						))
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
				<div style={{ padding: '10px 4px', fontSize: 12, opacity: 0.55 }}>尚无征象——左侧构造后点「添加到列表」。</div>
			) : null}
		</div>
	);

	const zodiacValue = AstroConst.zodiacSelectValue(cfg.zodiacal || 0, cfg.siderealAyanamsa || '');

	const editView = (
		<div style={{ display: 'grid', gridTemplateColumns: '560px minmax(0, 1fr)', gap: 12, height: 'clamp(560px, calc(100vh - 220px), 900px)' }}>
			{/* 左列(用户规格:时间段·地点·盘面居左上角;动作排+开始搜索同一行) */}
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ padding: 10, borderBottom: '1px solid rgba(148,163,184,.2)' }}>
					<div style={{ fontWeight: 600, marginBottom: 8 }}>时间段·地点·盘面</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
						<input type="date" className="horosa-native-date" value={cfg.startDate}
							onChange={(e) => onCfgChange({ ...cfg, startDate: e.target.value })} />
						<input type="time" className="horosa-native-date" value={cfg.startTime}
							onChange={(e) => onCfgChange({ ...cfg, startTime: e.target.value })} />
						<span style={{ opacity: 0.6 }}>→</span>
						<input type="date" className="horosa-native-date" value={cfg.endDate}
							onChange={(e) => onCfgChange({ ...cfg, endDate: e.target.value })} />
						<input type="time" className="horosa-native-date" value={cfg.endTime}
							onChange={(e) => onCfgChange({ ...cfg, endTime: e.target.value })} />
					</div>
					<div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
						<GeoCoordModal lat={cfg.gpsLat} lng={cfg.gpsLon} onOk={(rec) => onCfgChange({
							...cfg,
							gpsLat: rec.gpsLat !== undefined ? rec.gpsLat : rec.lat,
							gpsLon: rec.gpsLng !== undefined ? rec.gpsLng : rec.lng,
							pos: rec.name || cfg.pos,
							zone: rec.zone || cfg.zone,
						})}>
							<XQButton size="small">
								{cfg.pos ? `📍 ${cfg.pos}` : (cfg.gpsLat !== undefined ? `📍 ${formatGpsDms(cfg.gpsLon, cfg.gpsLat)}` : '选择地点…')}
							</XQButton>
						</GeoCoordModal>
						<span style={{ fontSize: 11, opacity: 0.65 }}>黄道</span>
						<XQSelect size="small" style={{ minWidth: 118 }} value={zodiacValue} dropdownMatchSelectWidth={false}
							onChange={(v) => {
								const p = AstroConst.parseZodiacSelectValue(v);
								onCfgChange({ ...cfg, zodiacal: p.zodiacal, siderealAyanamsa: p.siderealAyanamsa });
							}}>
							{AstroConst.groupOptions(AstroConst.buildZodiacOptions()).map((grp) => (
								<OptGroup label={grp.group} key={grp.group}>
									{grp.items.map((item) => (<Option value={item.value} key={item.value}>{item.label}</Option>))}
								</OptGroup>
							))}
						</XQSelect>
						<span style={{ fontSize: 11, opacity: 0.65 }}>宫制</span>
						<XQSelect size="small" style={{ minWidth: 108 }} value={Number(cfg.hsys || 0)} dropdownMatchSelectWidth={false}
							onChange={(v) => onCfgChange({ ...cfg, hsys: Number(v) })}>
							{getHousesOption(true)}
						</XQSelect>
					</div>
				</div>
				<div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid rgba(148,163,184,.2)' }}>构造征象</div>
				<div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
						<span style={{ fontSize: 11, opacity: 0.65 }}>征象类型</span>
						<XQSelect size="small" style={{ minWidth: 140 }} value={draftType}
							onChange={(v) => resetDraft(v)} dropdownMatchSelectWidth={false}>
							{Object.entries(CONDITION_TYPES).map(([key, spec]) => (
								<Option key={key} value={key}>{spec.label}</Option>
							))}
						</XQSelect>
						<XQCheckItem compact checked={draftNegate} onClick={() => setDraftNegate(!draftNegate)}
							style={{ width: 'auto', display: 'inline-grid', minHeight: 26 }}>
							取反(NOT)
						</XQCheckItem>
					</div>
					<ConditionParamsForm type={draftType} params={draftParams} onChange={setDraftParams} />
					<div style={{
						marginTop: 12, padding: '8px 10px', borderRadius: 8,
						border: '1px dashed rgba(212,175,55,.5)', background: 'rgba(212,175,55,.05)',
						display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
					}}>
						{draftNegate ? <span style={{ color: '#e5484d', fontWeight: 700 }}>非</span> : null}
						{conditionSummary(draftLeaf).map((s, i) => (
							<span key={i} title={s.title || undefined}
								style={s.glyph ? { fontFamily: AstroConst.AstroFont, fontSize: 17 } : { fontSize: 12 }}>
								{s.text}
							</span>
						))}
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
						开始搜索
					</XQButton>
				</div>
			</div>
			{/* 右列(时间段·地点·盘面已移左上角,右列全留给已选列表+方案排) */}
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>
				<div style={{ flex: 1, minHeight: 0, border: '1px solid rgba(148,163,184,.25)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
					<div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid rgba(148,163,184,.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
						已选征象
						<span style={{ fontSize: 11, opacity: 0.55, fontWeight: 400 }}>点击行选中→左下「连接门·取反」直接改;行首徽标=与上方结果的连接门</span>
					</div>
					<div style={{ flex: 1, overflowY: 'auto', padding: 10 }} onClick={() => setSelectedPath(null)}>
						{renderNode(tree)}
					</div>
					<div style={{ padding: '6px 10px', borderTop: '1px solid rgba(148,163,184,.2)', display: 'flex', gap: 8, alignItems: 'center' }}>
						<input placeholder="方案名…" value={schemeName} style={{ width: 128 }}
							onChange={(e) => setSchemeName(e.target.value)} />
						<XQButton size="small" disabled={!schemeName.trim()} onClick={() => {
							const r = saveScheme(schemeName, cfg, tree);
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
		<div style={{ height: 'clamp(560px, calc(100vh - 220px), 900px)', display: 'flex', flexDirection: 'column' }}>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
				<XQButton size="small" onClick={() => setView('edit')} disabled={scanning}>← 返回条件</XQButton>
				<span style={{ fontWeight: 600 }}>搜索结果</span>
				{scanning && progress ? (
					<span style={{ fontSize: 12, opacity: 0.75 }}>扫描中 {progress.done}/{progress.total} 段 · 已命中 {progress.hits}</span>
				) : null}
				{scanning ? <XQButton size="small" onClick={onCancelScan}>取消</XQButton> : null}
				<span style={{ flex: 1 }} />
				{!scanning && results ? (
					<span style={{ fontSize: 12, opacity: 0.7 }}>
						共 {results.length} 个区间{truncated ? '(已达上限截断,请缩小时间段)' : ''};点击行以区间起始时刻起盘
					</span>
				) : null}
			</div>
			{!scanning && scanErr ? <div style={{ color: '#e5484d', fontSize: 12, marginBottom: 8 }}>{scanErr}</div> : null}
			{resultsStale ? (
				<div style={{ color: '#8a6d1a', background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.4)', borderRadius: 6, fontSize: 12, padding: '5px 10px', marginBottom: 8 }}>
					⚠ 征象条件已被修改:下方结果与详情对应「上一次搜索」的条件——请重新点「开始搜索」。
				</div>
			) : null}
			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ display: 'flex', fontSize: 12, opacity: 0.6, padding: '8px 12px', gap: 10, borderBottom: '1px solid rgba(148,163,184,.2)', position: 'sticky', top: 0, background: 'var(--horosa-astro-panel, #fff)', zIndex: 1 }}>
					<span style={{ width: 36 }}>#</span>
					<span style={{ flex: 1 }}>开始(点击=起始时刻起盘)</span>
					<span style={{ flex: 1 }}>结束(点击=结束时刻起盘)</span>
					<span style={{ width: 76, textAlign: 'right' }}>时长</span>
					<span style={{ width: 64, textAlign: 'center' }}>详情</span>
					<span style={{ width: 52 }}>盘</span>{/* 行内多「盘」列,表头必须等宽占位——缺列致两 flex 列压窄整行左移(用户实报错位) */}
					<span style={{ width: 52, textAlign: 'center' }}>概览</span>
				</div>
				{(!results || !results.length) && !scanning ? (
					<div style={{ padding: 24, opacity: 0.6 }}>{results ? '时间段内无满足全部条件的时刻。' : '尚未搜索。'}</div>
				) : null}
				{(results || []).map((row, i) => (
					<div key={i} style={{ borderBottom: '1px dashed rgba(148,163,184,.18)' }}>
						<div style={{ display: 'flex', gap: 10, padding: '9px 12px', alignItems: 'center' }}>
							<span style={{ width: 36, textAlign: 'right', opacity: 0.5, fontSize: 12 }}>{i + 1}</span>
							<span style={{ flex: 1, fontSize: 13, cursor: 'pointer' }} title="以区间起始时刻起盘"
								onClick={() => onPickInterval(row, 'start')}>{row.start}</span>
							<span style={{ flex: 1, fontSize: 13, cursor: 'pointer' }} title="以区间结束时刻起盘"
								onClick={() => onPickInterval(row, 'end')}>{row.end}</span>
							<span style={{ width: 76, textAlign: 'right', fontSize: 13 }}>
								{row.durationMin >= 90 ? `${(row.durationMin / 60).toFixed(1)}小时` : `${Math.round(row.durationMin)}分`}
							</span>
							<span style={{ width: 64, textAlign: 'center' }}>
								<XQButton size="small" onClick={() => {
									// 缓存键带搜索代际:重新搜索后旧判读绝不复用(真机实抓旧树判读串行)
									const ck = `${scanEpoch || 0}:${i}`;
									if(expandKey === ck){ setExpandKey(null); return; }
									setExpandKey(ck);
									if(!explainMap[ck] && typeof onExplain === 'function'){
										setExplainMap((mp) => ({ ...mp, [ck]: { loading: true } }));
										onExplain(row).then((rsp) => {
											setExplainMap((mp) => ({ ...mp, [ck]: { tree: rsp.tree } }));
										}).catch((e) => {
											setExplainMap((mp) => ({ ...mp, [ck]: { err: e.message || '判读失败' } }));
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
									以区间起始时刻逐条判读(设定 vs 实际;判定与扫描引擎同源)
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
			const r = importSchemes(reader.result);
			setSchemeMsg(r.ok ? `已导入 ${r.added} 个方案(同名覆盖)` : `导入失败:${r.msg}`);
			setSchemeTick(schemeTick + 1);
		};
		reader.readAsText(file);
	};

	const schemesView = (
		<div style={{ height: 'clamp(560px, calc(100vh - 220px), 900px)', display: 'flex', flexDirection: 'column' }}>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
				<XQButton size="small" onClick={() => { setView('edit'); setSchemeMsg(''); }}>← 返回条件</XQButton>
				<span style={{ fontWeight: 600 }}>方案管理</span>
				<span style={{ flex: 1 }} />
				<label style={{ display: 'inline-block' }}>
					<input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportFile} />
					<span className="ant-btn ant-btn-sm" style={{ cursor: 'pointer' }}>导入方案(JSON)</span>
				</label>
				<XQButton size="small" disabled={!schemes.length}
					onClick={() => downloadJson(exportSchemes(), `天星择日方案_${new Date().toISOString().slice(0, 10)}.json`)}>
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
									const r = renameScheme(s.id, renameText);
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
							<XQButton size="small" onClick={() => downloadJson(exportSchemes([s.id]), `天星择日方案_${s.name}.json`)}>导出</XQButton>
							<XQButton size="small" danger onClick={() => { deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删除</XQButton>
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
			title="天星择日·征象搜索"
			open={open}
			wrapClassName="horosa-zeri-workbench-modal"	/* X 近白(暗底 antd 默认近黑隐形——九工作台同修,天星曾漏) */
			getContainer={false}	/* 原地渲染:冻结页 body portal Modal 关不掉(九工作台同修) */
			onCancel={onClose}
			footer={null}
			width={1400}
			centered
			destroyOnClose={false}
		>
			{view === 'result' ? resultView : (view === 'schemes' ? schemesView : editView)}
			{previewRow && typeof onPreviewParams === 'function' ? (
				<MiniChartPopup
					params={onPreviewParams(previewRow, 'start')}
					title={previewRow.start}
					display={previewDisplay}
					onClose={() => setPreviewRow(null)} />
			) : null}
		</Modal>
	);
}
