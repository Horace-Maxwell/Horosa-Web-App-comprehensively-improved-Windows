// [Z1·黄历择日] 择吉工作台:三视图(edit/result/schemes)逐字对齐奇门 QimenZeriWorkbench——
//   左列:①时间范围(日粒度,date-only+快捷档;黄历日课与经纬/时刻无关,无地点区无参数区)
//   ②构造条件 ③连接门·取反四钮 ④动作排+「择吉」。右列:已选条件链+方案排(黄历专属方案库)。
// 差异仅四点:注册表=HUANGLI_CONDITION_TYPES(日粒度本地求值);无地点/参数区(黄历零参数,
// 「从主盘重载」无意义故无);结果表「日课」列(建除·宿·黄黑道)替「局」;概览=HuangLiDayCard 浮窗。
import { useState, useEffect, useRef } from 'react';
import { Modal, Dropdown, Menu, message } from 'antd';
import { XQButton, XQSelect, XQCheckItem } from '../xq-ui';
import ConditionParamsForm from './ConditionParamsForm';
import ZeriRowBadge from './ZeriRowBadge';
import { JOINER_CN, auditTreeAgainstRegistry } from '../../divination/zeri/conditionTypes';
import {
	HUANGLI_CONDITION_TYPES, newHuangliLeaf, newHuangliGroup, huangliLeafSummary,
} from '../../divination/zeri/huangliZeriConditionTypes';
import { huangliZeriSchemeStore } from '../../divination/zeri/schemeStore';
import HuangliDayPopup from './HuangliDayPopup';

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

// ── 树路径纯工具(与天星/奇门工作台同构) ──
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
				<span>{ui ? huangliLeafSummary(ui) : ((HUANGLI_CONDITION_TYPES[node.type] || {}).label || node.type)}</span>
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

// 类别序:显式优先序保持既有分组次序;注册表出现的新类别自动追加——
// 新增条件类携新类别绝不静默消失(W0 基建;曾为硬编码常量=下拉静默吞类唯一落点)。
const CATEGORY_ORDER = (()=>{
	const seen = ['用事', '神煞', '历法', '时辰'];
	Object.keys(HUANGLI_CONDITION_TYPES).forEach((k)=>{
		const c = HUANGLI_CONDITION_TYPES[k].category;
		if(c && !seen.includes(c)){ seen.push(c); }
	});
	return seen;
})();

export default function HuangliZeriWorkbench({
	open, onClose, cfg, onCfgChange,
	tree, frozenTree, onTreeChange, onRun, onCancelScan, onPickInterval, onExplain, scanEpoch, resultsStale,
	scanning, progress, results, truncated, scanErr,
}){
	const [draftType, setDraftType] = useState('yi_has');
	const [draftParams, setDraftParams] = useState(() => newHuangliLeaf('yi_has').params);
	const [draftNegate, setDraftNegate] = useState(false);
	const [selectedPath, setSelectedPath] = useState(null);
	const [view, setView] = useState('edit');
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

	// 「从未打开过」粘性短路(天星/奇门同款,[190] 型):弹窗关着时零渲染成本。
	const everOpenRef = useRef(!!open);
	if(open && !everOpenRef.current){ everOpenRef.current = true; }
	if(!everOpenRef.current){ return null; }

	const selectedNode = selectedPath ? getAt(tree, selectedPath) : null;
	const selectedIsLeaf = !!(selectedNode && selectedNode.kind !== 'group' && !selectedNode.children);
	const selectedIsGroup = !!(selectedNode && (selectedNode.kind === 'group' || selectedNode.children));

	const resetDraft = (type) => {
		setDraftType(type);
		setDraftParams(newHuangliLeaf(type).params);
		setDraftNegate(false);
	};
	const loadLeafToDraft = (leaf) => {
		setDraftType(leaf.type);
		setDraftParams(JSON.parse(JSON.stringify(leaf.params)));
		setDraftNegate(!!leaf.negate);
	};

	const draftLeaf = { kind: 'leaf', type: draftType, negate: draftNegate, params: draftParams };
	const draftSpec = HUANGLI_CONDITION_TYPES[draftType] || {};
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
		onTreeChange(mapAt(tree, appendTargetPath, (g) => ({ ...g, children: [...g.children, newHuangliGroup('any')] })));
	};
	const doRemove = (path) => {
		onTreeChange(removeAt(tree, path));
		setSelectedPath(null);
	};

	const applyScheme = (rec) => {
	// [F7 根修] 载入前审计值域:方案里的条件类/选项值可能已随版本演进被删——
	// 那类行会静默恒不命中(needValues 只拦空、compile 不查值域、evaluate includes 恒 false)。
	// 审计只提示不拦载入:用户看得见哪些行失效,自行改设;静默才是事故。
	const __schemeIssues = (rec && rec.tree) ? auditTreeAgainstRegistry(rec.tree, HUANGLI_CONDITION_TYPES) : [];
	if(__schemeIssues.length){
		message.warning(`方案「${rec && rec.name ? rec.name : ''}」有 ${__schemeIssues.length} 处已失效设置:${__schemeIssues.slice(0, 2).join(';')}${__schemeIssues.length > 2 ? ';…' : ''}`, 8);
	}
		if(rec && rec.tree){ onTreeChange(rec.tree); }
		if(rec && rec.config && rec.config.cfg){ onCfgChange({ ...cfg, ...rec.config.cfg }); }
		setSelectedPath(null);
	};

	const schemes = huangliZeriSchemeStore.listSchemes();
	const history = huangliZeriSchemeStore.listHistory();
	const schemeMenu = (
		<Menu>
			{schemes.length ? schemes.map((s) => (
				<Menu.Item key={s.id}>
					<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
						<a onClick={(e) => { e.preventDefault(); applyScheme(s); }}>{s.name}</a>
						<a style={{ color: '#e5484d', fontSize: 11 }}
							onClick={(e) => { e.preventDefault(); e.stopPropagation(); huangliZeriSchemeStore.deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删</a>
					</span>
				</Menu.Item>
			)) : <Menu.Item key="none" disabled>暂无已存方案</Menu.Item>}
			{history.length ? (
				<Menu.SubMenu key="his" title="最近择吉">
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
						<span style={{ fontSize: 12 }}>{huangliLeafSummary({ ...node, negate: false })}</span>
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

	// 时间范围预设芯片(今日为锚;黄历日粒度,无 time 段)。
	const applyPreset = (days) => {
		const now = new Date();
		const start = dateStrOf(now);
		const endDate = new Date(now.getTime() + (days - 1) * 86400e3);
		onCfgChange({ ...cfg, startDate: start, endDate: dateStrOf(endDate) });
	};

	const editView = (
		<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 12, height: 'clamp(560px, calc(100vh - 220px), 900px)' }}>
			{/* 左列(主操作区):时间范围 / 构造条件 / 连接门 / 动作排 —— 黄历日课与经纬/时刻无关,无地点·参数区 */}
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ padding: 10, borderBottom: '1px solid rgba(148,163,184,.2)' }}>
					<div style={{ fontWeight: 600, marginBottom: 8 }}>时间范围(日粒度)</div>
					<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
						<input type="date" className="horosa-native-date" style={{ width: 130 }} value={cfg.startDate}
							onChange={(e) => onCfgChange({ ...cfg, startDate: e.target.value })} />
						<span style={{ opacity: 0.6 }}>→</span>
						<input type="date" className="horosa-native-date" style={{ width: 130 }} value={cfg.endDate}
							onChange={(e) => onCfgChange({ ...cfg, endDate: e.target.value })} />
						{/* 预设钮组:整组 nowrap+marginLeft:auto——flex:1 占位与 wrap 互斥(同九家) */}
						<span style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
							{[['本月', 30], ['三月', 91], ['半年', 183], ['一年', 365]].map(([label, days]) => (
								<XQButton key={label} size="small" onClick={() => applyPreset(days)}>{label}</XQButton>
							))}
						</span>
					</div>
					<div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>黄历日课与地点/时刻无关;逐日判定,连续吉日自动并为一段。</div>
				</div>
				<div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid rgba(148,163,184,.2)' }}>构造条件</div>
				<div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
						<span style={{ fontSize: 11, opacity: 0.65 }}>条件类型</span>
						<XQSelect size="small" style={{ minWidth: 150 }} value={draftType}
							onChange={(v) => resetDraft(v)} dropdownMatchSelectWidth={false}
							getPopupContainer={(t) => t.closest('.ant-modal-body') || t.parentElement}>
							{CATEGORY_ORDER.map((cat) => (
								<OptGroup label={cat} key={cat}>
									{Object.entries(HUANGLI_CONDITION_TYPES).filter(([, spec]) => spec.category === cat).map(([key, spec]) => (
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
					<ConditionParamsForm types={HUANGLI_CONDITION_TYPES} type={draftType} params={draftParams} onChange={setDraftParams} />
					<div style={{
						marginTop: 12, padding: '8px 10px', borderRadius: 8,
						border: '1px dashed rgba(212,175,55,.5)', background: 'rgba(212,175,55,.05)',
						display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12,
					}}>
						{huangliLeafSummary(draftLeaf)}
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
						择吉
					</XQButton>
				</div>
			</div>
			{/* 右列:已选条件链 + 方案排 */}
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
							const r = huangliZeriSchemeStore.saveScheme(schemeName, { cfg }, tree);
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
				<span style={{ fontWeight: 600 }}>择吉结果</span>
				{scanning && progress ? (
					<span style={{ fontSize: 12, opacity: 0.75 }}>扫描中 {progress.done}/{progress.total} 日 · 已命中 {progress.hits}</span>
				) : null}
				{scanning ? <XQButton size="small" onClick={onCancelScan}>取消</XQButton> : null}
				<span style={{ flex: 1 }} />
				{!scanning && results ? (
					<span style={{ fontSize: 12, opacity: 0.7 }}>
						共 {results.length} 个日段{truncated ? '(已达上限截断,请缩小时间段)' : ''};点击行即跳该日日课
					</span>
				) : null}
			</div>
			{!scanning && scanErr ? <div style={{ color: '#e5484d', fontSize: 12, marginBottom: 8 }}>{scanErr}</div> : null}
			{resultsStale ? (
				<div style={{ color: '#8a6d1a', background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.4)', borderRadius: 6, fontSize: 12, padding: '5px 10px', marginBottom: 8 }}>
					⚠ 条件/时间范围已被修改:下方结果对应「上一次择吉」——请重新点「择吉」。
				</div>
			) : null}
			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ display: 'flex', fontSize: 12, opacity: 0.6, padding: '8px 12px', gap: 10, borderBottom: '1px solid rgba(148,163,184,.2)', position: 'sticky', top: 0, background: 'var(--horosa-astro-panel, #fff)', zIndex: 1 }}>
					<span style={{ width: 36 }}>#</span>
					<span style={{ flex: 1 }}>起日(点击=跳该日)</span>
					<span style={{ flex: 1 }}>止日(点击=跳该日)</span>
					<span style={{ width: 52, textAlign: 'right' }}>天数</span>
					<span style={{ width: 150, textAlign: 'center' }}>日课(起日)</span>
					<span style={{ width: 64, textAlign: 'center' }}>详情</span>
					<span style={{ width: 52, textAlign: 'center' }}>日卡</span>
				</div>
				{(!results || !results.length) && !scanning ? (
					<div style={{ padding: 24, opacity: 0.6 }}>{results ? '时间范围内无满足条件的日子。' : '尚未择吉。'}</div>
				) : null}
				{(results || []).map((row, i) => (
					<div key={i} style={{ borderBottom: '1px dashed rgba(148,163,184,.18)' }}>
						<div style={{ display: 'flex', gap: 10, padding: '9px 12px', alignItems: 'center' }}>
							<span style={{ width: 36, textAlign: 'right', opacity: 0.5, fontSize: 12 }}>{i + 1}</span>
							<span style={{ flex: 1, fontSize: 13, cursor: 'pointer' }} title="跳到该日(黄历页选中)"
								onClick={() => onPickInterval(row, 'start')}>{row.start}</span>
							<span style={{ flex: 1, fontSize: 13, cursor: 'pointer' }} title="跳到该日(黄历页选中)"
								onClick={() => onPickInterval(row, 'end')}>{row.end}</span>
							<span style={{ width: 52, textAlign: 'right', fontSize: 13 }}>{row.days}天</span>
							<span style={{ width: 150, textAlign: 'center', fontSize: 12 }}>
								<ZeriRowBadge text={row.badge} />
							</span>
							<span style={{ width: 64, textAlign: 'center' }}>
								<XQButton size="small" onClick={() => {
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
								<XQButton size="small" onClick={() => setPreviewRow(row)}>卡</XQButton>
							</span>
						</div>
						{expandKey === `${scanEpoch || 0}:${i}` ? (
							<div style={{ padding: '4px 12px 10px 58px', background: 'rgba(212,175,55,.04)' }}>
								<div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>
									以起日逐条判读(设定 vs 实际;判定与扫描引擎同源)
								</div>
								{(explainMap[`${scanEpoch || 0}:${i}`] || {}).loading ? <div style={{ fontSize: 12, opacity: 0.6 }}>判读中…</div> : null}
								{(explainMap[`${scanEpoch || 0}:${i}`] || {}).err ? <div style={{ fontSize: 12, color: '#e5484d' }}>{explainMap[`${scanEpoch || 0}:${i}`].err}</div> : null}
								{(explainMap[`${scanEpoch || 0}:${i}`] || {}).tree
									? renderExplainNode(explainMap[`${scanEpoch || 0}:${i}`].tree, collectUiLeaves(frozenTree || tree, []), { i: 0 }, 0)
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
			const r = huangliZeriSchemeStore.importSchemes(reader.result);
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
					onClick={() => downloadJson(huangliZeriSchemeStore.exportSchemes(), `黄历择日方案_${new Date().toISOString().slice(0, 10)}.json`)}>
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
									const r = huangliZeriSchemeStore.renameScheme(s.id, renameText);
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
							<XQButton size="small" onClick={() => downloadJson(huangliZeriSchemeStore.exportSchemes([s.id]), `黄历择日方案_${s.name}.json`)}>导出</XQButton>
							<XQButton size="small" danger onClick={() => { huangliZeriSchemeStore.deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删除</XQButton>
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
				<div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 34 }}>
					<span style={{ flexShrink: 0 }}>黄历择日·择吉工作台</span>
					<span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 400, color: '#8a6d1a', lineHeight: 1.35, whiteSpace: 'normal' }}>
						⚠ 结果为通书条目的机械筛选,仅供术数研习参考;不构成任何现实决策依据,勿迷信滥用——据此行事,后果自负。
					</span>
				</div>
			)}
			open={open}
			wrapClassName="horosa-zeri-workbench-modal"
			getContainer={false}	/* 🔴 原地渲染(勿挂 body portal):工作台开着切走子页时,FreezeInactive 冻结组件树
				但 body portal 的 Modal 漏在外面——X 点击的 setState 发生在冻结树里不重渲染,Modal 永远
				关不掉(用户「无法返回」真相之二,真机三 Modal 叠加实抓);原地渲染随页冻结一起隐藏。 */
			onCancel={onClose}
			footer={null}
			width={1400}
			centered
			destroyOnClose={false}
			maskClosable={false}
		>
			{view === 'result' ? resultView : (view === 'schemes' ? schemesView : editView)}
			{previewRow ? (
				<HuangliDayPopup row={previewRow} onClose={() => setPreviewRow(null)} />
			) : null}
		</Modal>
	);
}
