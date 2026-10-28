// 择时工作台(太乙版派生;远端扫描形)。左列:①时间范围·地点+三口径参数
// (宿制两档[回归今宿/回归古制]/罗计交点[平/真]/月孛远地点[平/真]——判别力 pytest 金标证;
// 主页其余宿制七档为显示制,扫描 gap 帮助明示,死开关律不入面) ②构造条件(10 类远端判定)。
// 结果表分钟级区间(远端 /qizhengelectionscan 产;93 天限单请求)。
import { useState, useEffect, useRef } from 'react';
import { emptyNumberFieldError } from '../../divination/zeri/conditionFieldCheck';   // 空数字框统一校验
import { Modal, Dropdown, Menu, message } from 'antd';
import { XQButton, XQSelect, XQCheckItem } from '../xq-ui';
import ConditionParamsForm from './ConditionParamsForm';
import ZeriMiniPanPopup from './ZeriMiniPanPopup';
import GeoCoordModal from '../amap/GeoCoordModal';
import { formatGpsDms } from '../../divination/zeri/tianxingSnapshot';
import { JOINER_CN, auditTreeAgainstRegistry } from '../../divination/zeri/conditionTypes';
import {
	QIZHENG_CONDITION_TYPES, newQizhengLeaf, newQizhengGroup, qizhengLeafSummary,
} from '../../divination/zeri/qizhengZeriConditionTypes';
import { qizhengZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { downloadJson, JOINER_OPTIONS, getAt, mapAt, removeAt, collectUiLeaves, GATE_CN2, dateStrOf } from './zeriTreeOps';
import { withFullDefaults } from './zeriOptionDefaults';

// 工作台参数表。渲染与宿主完整缺省(zeriOptionDefaults)同读这一份。
export function qizhengWorkbenchParamFields(){
	return [
		{ key: 'su28Mode', label: '宿度制', dv: 2, options: [{ value: 2, label: '回归今宿' }, { value: 3, label: '回归古制开禧' }] },
		{ key: 'nodeType', label: '罗计取法', dv: 'mean', options: [{ value: 'mean', label: '平交点' }, { value: 'true', label: '真交点' }] },
		{ key: 'lilithType', label: '月孛取法', dv: 'mean', options: [{ value: 'mean', label: '平远地点' }, { value: 'true', label: '真远地点' }] },
	];
}

const Option = XQSelect.Option;
const OptGroup = XQSelect.OptGroup;

function renderExplainNode(node, uiLeaves, counter, depth){
	const passTag = (ok) => (
		<span style={{ fontWeight: 700, color: ok ? 'var(--horosa-jx-ji)' : 'var(--horosa-danger)' }}>{ok ? '✓' : '✗'}</span>
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
				<span style={{ color: 'var(--horosa-text-secondary)' }}>设定</span>
				<span>{ui ? qizhengLeafSummary(ui) : ((QIZHENG_CONDITION_TYPES[node.type] || {}).label || node.type)}</span>
			</div>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginTop: 2 }}>
				<span style={{ color: 'var(--horosa-text-secondary)' }}>实际</span>
				<span style={{ opacity: 0.9 }}>{node.actual}</span>
				{passTag(node.pass)}
			</div>
		</div>
	);
}

// 类别序:显式优先序保持既有分组次序;注册表出现的新类别自动追加——
// 新增条件类携新类别绝不静默消失(W0 基建;曾为硬编码常量=下拉静默吞类唯一落点)。
const CATEGORY_ORDER = (()=>{
	const seen = ['落宫', '落宿', '庙旺', '行度', '伏焦', '昼夜', '命宫', '会照', '化曜'];
	Object.keys(QIZHENG_CONDITION_TYPES).forEach((k)=>{
		const c = QIZHENG_CONDITION_TYPES[k].category;
		if(c && !seen.includes(c)){ seen.push(c); }
	});
	return seen;
})();

export default function QizhengZeriWorkbench({
	open, onClose, cfg, onCfgChange, geo, onGeoChange, options, onOptionsChange, optionDefaults,
	tree, frozenTree, onPreviewPan, onPreviewExplain, previewGeo, previewOptions, onTreeChange, onRun, onCancelScan, onPickInterval, onExplain, scanEpoch, resultsStale,
	scanning, progress, results, truncated, scanErr,
}){
	const [draftType, setDraftType] = useState('body_in_gong');	// 🔴 初值必须是本注册表键(曾抄太乙 geju_kind=首开未知条件,审查实抓)
	const [draftParams, setDraftParams] = useState(() => newQizhengLeaf('body_in_gong').params);
	const [draftNegate, setDraftNegate] = useState(false);
	const [selectedPath, setSelectedPath] = useState(null);
	const [view, setView] = useState('edit');
	const [expandKey, setExpandKey] = useState(null);
	const [previewRow, setPreviewRow] = useState(null);	// 概览浮窗行(对齐天星/奇门标准)
	const [explainMap, setExplainMap] = useState({});
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
		setDraftParams(newQizhengLeaf(type).params);
		setDraftNegate(false);
	};
	const loadLeafToDraft = (leaf) => {
		setDraftType(leaf.type);
		setDraftParams(JSON.parse(JSON.stringify(leaf.params)));
		setDraftNegate(!!leaf.negate);
	};

	const draftLeaf = { kind: 'leaf', type: draftType, negate: draftNegate, params: draftParams };
	const draftSpec = QIZHENG_CONDITION_TYPES[draftType] || {};
	// 空数字框先判(与表单红框同一判据),再走各类型自校验。
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
		onTreeChange(mapAt(tree, appendTargetPath, (g) => ({ ...g, children: [...g.children, newQizhengGroup('any')] })));
	};
	const doRemove = (path) => {
		onTreeChange(removeAt(tree, path));
		setSelectedPath(null);
	};

	const applyScheme = (rec) => {
	// 载入前审计值域:方案里的条件类/选项值可能已随版本演进被删——
	// 那类行会静默恒不命中(needValues 只拦空、compile 不查值域、evaluate includes 恒 false)。
	// 审计只提示不拦载入:用户看得见哪些行失效,自行改设;静默才是事故。
	const __schemeIssues = (rec && rec.tree) ? auditTreeAgainstRegistry(rec.tree, QIZHENG_CONDITION_TYPES) : [];
	if(__schemeIssues.length){
		message.warning(`方案「${rec && rec.name ? rec.name : ''}」有 ${__schemeIssues.length} 处已失效设置:${__schemeIssues.slice(0, 2).join(';')}${__schemeIssues.length > 2 ? ';…' : ''}`, 8);
	}
		if(rec && rec.tree){ onTreeChange(rec.tree); }
		if(rec && rec.config){
			if(rec.config.cfg){ onCfgChange({ ...cfg, ...rec.config.cfg }); }
			if(rec.config.geo && typeof onGeoChange === 'function'){ onGeoChange({ ...(geo || {}), ...rec.config.geo }); }
			// 方案 / 历史里没写的参数回出厂值(宿主完整缺省打底),不取本会话现值:否则会话里改过、方案没写的键混进来,再扫得到的不是当时的结果
			if(rec.config.options && typeof onOptionsChange === 'function'){ onOptionsChange(withFullDefaults(optionDefaults, rec.config.options), { source: 'scheme' }); }
		}
		setSelectedPath(null);
	};

	const schemes = qizhengZeriSchemeStore.listSchemes();
	const history = qizhengZeriSchemeStore.listHistory();
	const schemeMenu = (
		<Menu>
			{schemes.length ? schemes.map((s) => (
				<Menu.Item key={s.id}>
					<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
						<a onClick={(e) => { e.preventDefault(); applyScheme(s); }}>{s.name}</a>
						<a style={{ color: 'var(--horosa-danger)', fontSize: 11 }}
							onClick={(e) => { e.preventDefault(); e.stopPropagation(); qizhengZeriSchemeStore.deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删</a>
					</span>
				</Menu.Item>
			)) : <Menu.Item key="none" disabled>暂无已存方案</Menu.Item>}
			{history.length ? (
				<Menu.SubMenu key="his" title="最近择时">
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
			<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 6 }}>
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
					{node.negate ? <span style={{ color: 'var(--horosa-danger)', fontWeight: 700, flexShrink: 0 }}>非</span> : null}
					{isGroup ? (
						<span style={{ fontSize: 12, fontWeight: 600 }}>分组({(node.children || []).length} 条)</span>
					) : (
						<span style={{ fontSize: 12 }}>{qizhengLeafSummary({ ...node, negate: false })}</span>
					)}
					<span style={{ flex: 1 }} />
					<XQButton size="small" danger onClick={(e) => { e.stopPropagation(); doRemove(path); }}>删除</XQButton>
				</div>
				{isGroup ? (
					<div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid rgba(212,175,55,.35)' }}>
						{(node.children || []).map((c, i) => renderRow(c, [...path, i], i, depth + 1))}
						{!(node.children || []).length ? (
							<div style={{ padding: '6px 2px', fontSize: 12, color: 'var(--horosa-text-secondary)' }}>空分组:选中本组后左侧「添加到列表」即入组,或删除本组。</div>
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
				<div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--horosa-text-secondary)' }}>尚无条件——左侧构造后点「添加到列表」。</div>
			) : null}
		</div>
	);

	// 时间范围预设芯片(今日为锚)。
	const applyPreset = (days) => {
		const now = new Date();
		const start = dateStrOf(now);
		const endDate = new Date(now.getTime() + (days - 1) * 86400e3);
		onCfgChange({ ...cfg, startDate: start, startTime: '00:00', endDate: dateStrOf(endDate), endTime: '23:59' });
	};

	const editView = (
		<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 12, height: 'clamp(560px, calc(100 * var(--horosa-lvh, 1vh) - 220px), 900px)' }}>
			{/* 左列(主操作区):时间范围 / 构造条件 / 连接门 / 动作排 —— 黄历日课与经纬/时刻无关,无地点·参数区 */}
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ padding: 10, borderBottom: '1px solid rgba(148,163,184,.2)' }}>
					<div style={{ fontWeight: 600, marginBottom: 8 }}>时间范围·地点·参数</div>
					<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
						<input type="date" className="horosa-native-date" style={{ width: 118 }} value={cfg.startDate}
							onChange={(e) => onCfgChange({ ...cfg, startDate: e.target.value })} />
						<input type="time" className="horosa-native-date" style={{ width: 86 }} value={cfg.startTime}
							onChange={(e) => onCfgChange({ ...cfg, startTime: e.target.value })} />
						<span style={{ color: 'var(--horosa-text-secondary)' }}>→</span>
						<input type="date" className="horosa-native-date" style={{ width: 118 }} value={cfg.endDate}
							onChange={(e) => onCfgChange({ ...cfg, endDate: e.target.value })} />
						<input type="time" className="horosa-native-date" style={{ width: 86 }} value={cfg.endTime}
							onChange={(e) => onCfgChange({ ...cfg, endTime: e.target.value })} />
						{/* 预设钮组:整组 nowrap+marginLeft:auto——flex:1 占位与 wrap 互斥(占位吃掉行尾宽把单钮挤成孤行,用户圈报) */}
						<span style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
							{[['今日', 1], ['3天', 3], ['7天', 7], ['30天', 30]].map(([label, days]) => (
								<XQButton key={label} size="small" onClick={() => applyPreset(days)}>{label}</XQButton>
							))}
						</span>
					</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
						<GeoCoordModal lat={geo && geo.gpsLat} lng={geo && geo.gpsLon} onOk={(rec) => onGeoChange(rec)}>
							<XQButton size="small">{geo && geo.pos ? `📍 ${geo.pos}` : (geo && geo.gpsLat !== undefined ? `📍 ${formatGpsDms(geo.gpsLon, geo.gpsLat)}` : '选择地点…')}</XQButton>
						</GeoCoordModal>
						<span style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>时区 {geo && geo.zone !== undefined ? geo.zone : '—'}</span>
						{/* 三口径参数(判别力 pytest 金标证;主页宿制其余七档为显示制,扫描后续轮——帮助明示) */}
						{qizhengWorkbenchParamFields().map((f) => (
							<span key={f.key} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11 }}>
								<span style={{ color: 'var(--horosa-text-secondary)' }}>{f.label}</span>
								<XQSelect size="small" value={(options || {})[f.key] !== undefined ? (options || {})[f.key] : f.dv} dropdownMatchSelectWidth={false}
									getPopupContainer={(t) => t.closest('.ant-modal-body') || t.parentElement}
									onChange={(v) => onOptionsChange({ ...(options || {}), [f.key]: v })}>
									{f.options.map((o) => (<Option key={`${o.value}`} value={o.value}>{o.label}</Option>))}
								</XQSelect>
							</span>
						))}
					</div>
				</div>
				<div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid rgba(148,163,184,.2)' }}>构造条件</div>
				<div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
						<span style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>条件类型</span>
						<XQSelect size="small" style={{ minWidth: 150 }} value={draftType}
							onChange={(v) => resetDraft(v)} dropdownMatchSelectWidth={false}
							getPopupContainer={(t) => t.closest('.ant-modal-body') || t.parentElement}>
							{CATEGORY_ORDER.map((cat) => (
								<OptGroup label={cat} key={cat}>
									{Object.entries(QIZHENG_CONDITION_TYPES).filter(([, spec]) => spec.category === cat).map(([key, spec]) => (
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
					<ConditionParamsForm types={QIZHENG_CONDITION_TYPES} type={draftType} params={draftParams} onChange={setDraftParams} />
					<div style={{
						marginTop: 12, padding: '8px 10px', borderRadius: 8,
						border: '1px dashed rgba(212,175,55,.5)', background: 'rgba(212,175,55,.05)',
						display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12,
					}}>
						{qizhengLeafSummary(draftLeaf)}
					</div>
					{draftError ? <div style={{ color: 'var(--horosa-danger)', fontSize: 12, marginTop: 6 }}>{draftError}</div> : null}
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
						择时
					</XQButton>
				</div>
			</div>
			{/* 右列:已选条件链 + 方案排 */}
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>
				<div style={{ flex: 1, minHeight: 0, border: '1px solid rgba(148,163,184,.25)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
					<div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid rgba(148,163,184,.2)', display: 'flex', alignItems: 'center', gap: 8 }}
						title="点击行选中后,用左下「连接门·取反」四钮直接改该行;行首徽标=本行与上方结果的连接门">
						已选条件
						<span style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', fontWeight: 400 }}>点行选中·左下改门/取反</span>
					</div>
					<div style={{ flex: 1, overflowY: 'auto', padding: 10 }} onClick={() => setSelectedPath(null)}>
						{renderNode(tree)}
					</div>
					<div style={{ padding: '6px 10px', borderTop: '1px solid rgba(148,163,184,.2)', display: 'flex', gap: 8, alignItems: 'center' }}>
						<input placeholder="方案名…" value={schemeName} style={{ width: 128 }}
							onChange={(e) => setSchemeName(e.target.value)} />
						<XQButton size="small" disabled={!schemeName.trim()} onClick={() => {
							const r = qizhengZeriSchemeStore.saveScheme(schemeName, { cfg, geo, options }, tree);
							if(r.ok){ setSchemeName(''); setSchemeTick(schemeTick + 1); }
						}}>保存方案</XQButton>
						<Dropdown overlay={schemeMenu} trigger={['click']}>
							<XQButton size="small">载入方案▾</XQButton>
						</Dropdown>
						<XQButton size="small" onClick={() => setView('schemes')}>方案管理…</XQButton>
						{scanErr ? <span style={{ color: 'var(--horosa-danger)', fontSize: 12, marginLeft: 8 }}>{scanErr}</span> : null}
					</div>
				</div>
			</div>
		</div>
	);

	const resultView = (
		<div style={{ height: 'clamp(560px, calc(100 * var(--horosa-lvh, 1vh) - 220px), 900px)', display: 'flex', flexDirection: 'column' }}>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
				<XQButton size="small" onClick={() => setView('edit')} disabled={scanning}>← 返回条件</XQButton>
				<span style={{ fontWeight: 600 }}>择时结果</span>
				{scanning && progress ? (
					<span style={{ fontSize: 12, opacity: 0.75 }}>扫描中 第{progress.done}/{progress.total}段 · 已命中 {progress.hits}</span>
				) : null}
				{scanning ? <XQButton size="small" onClick={onCancelScan}>取消</XQButton> : null}
				<span style={{ flex: 1 }} />
				{!scanning && results ? (
					<span style={{ fontSize: 12, opacity: 0.7 }}>
						共 {results.length} 个时段{truncated ? '(已达上限截断,请缩小时间段)' : ''};点击行即起盘看盘
					</span>
				) : null}
			</div>
			{!scanning && scanErr ? <div style={{ color: 'var(--horosa-danger)', fontSize: 12, marginBottom: 8 }}>{scanErr}</div> : null}
			{resultsStale ? (
				<div style={{ color: 'var(--horosa-sev-medium)', background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.4)', borderRadius: 6, fontSize: 12, padding: '5px 10px', marginBottom: 8 }}>
					⚠ 条件/时间范围已被修改:下方结果对应「上一次择时」——请重新点「择时」。
				</div>
			) : null}
			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ display: 'flex', fontSize: 12, color: 'var(--horosa-text-secondary)', padding: '8px 12px', gap: 10, borderBottom: '1px solid rgba(148,163,184,.2)', position: 'sticky', top: 0, background: 'var(--horosa-astro-panel, #fff)', zIndex: 1 }}>
					<span style={{ width: 36 }}>#</span>
					<span style={{ flex: 1 }}>开始(点击=起始时刻起盘)</span>
					<span style={{ flex: 1 }}>结束(点击=结束时刻起盘)</span>
					<span style={{ width: 64, textAlign: 'right' }}>时长</span>
					<span style={{ width: 64, textAlign: 'center' }}>详情</span>
					<span style={{ width: 44 }}>盘</span>{/* 行内多「盘」列,表头必须等宽占位——缺列致两 flex 列压窄整行左移(用户实报错位) */}
				</div>
				{(!results || !results.length) && !scanning ? (
					<div style={{ padding: 24, color: 'var(--horosa-text-secondary)' }}>{results ? '时间范围内无满足条件的时辰。' : '尚未择时。'}</div>
				) : null}
				{(results || []).map((row, i) => (
					<div key={i} style={{ borderBottom: '1px dashed rgba(148,163,184,.18)' }}>
						<div style={{ display: 'flex', gap: 10, padding: '9px 12px', alignItems: 'center' }}>
							<span style={{ width: 36, textAlign: 'right', color: 'var(--horosa-text-secondary)', fontSize: 12 }}>{i + 1}</span>
							<span style={{ flex: 1, fontSize: 13, cursor: 'pointer' }} title="以时段起始时刻起盘"
								onClick={() => onPickInterval(row, 'start')}>{row.start}</span>
							<span style={{ flex: 1, fontSize: 13, cursor: 'pointer' }} title="以时段结束时刻起盘"
								onClick={() => onPickInterval(row, 'end')}>{row.end}</span>
							<span style={{ width: 64, textAlign: 'right', fontSize: 13 }}>
								{row.durationMin >= 90 ? `${(row.durationMin / 60).toFixed(1)}小时` : `${Math.round(row.durationMin)}分`}
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
							<span style={{ width: 44, textAlign: 'center' }}>
								<XQButton size="small" onClick={()=>setPreviewRow(row)}>盘</XQButton>
							</span>
							</div>
						{expandKey === `${scanEpoch || 0}:${i}` ? (
							<div style={{ padding: '4px 12px 10px 58px', background: 'rgba(212,175,55,.04)' }}>
								<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 4 }}>
									以时段起始时刻逐条判读(设定 vs 实际;判定与扫描引擎同源)
								</div>
								{(explainMap[`${scanEpoch || 0}:${i}`] || {}).loading ? <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>判读中…</div> : null}
								{(explainMap[`${scanEpoch || 0}:${i}`] || {}).err ? <div style={{ fontSize: 12, color: 'var(--horosa-danger)' }}>{explainMap[`${scanEpoch || 0}:${i}`].err}</div> : null}
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
			const r = qizhengZeriSchemeStore.importSchemes(reader.result);
			setSchemeMsg(r.ok ? `已导入 ${r.added} 个方案(同名覆盖)` : `导入失败:${r.msg}`);
			setSchemeTick(schemeTick + 1);
		};
		reader.readAsText(file);
	};

	const schemesView = (
		<div style={{ height: 'clamp(560px, calc(100 * var(--horosa-lvh, 1vh) - 220px), 900px)', display: 'flex', flexDirection: 'column' }}>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
				<XQButton size="small" onClick={() => { setView('edit'); setSchemeMsg(''); }}>← 返回条件</XQButton>
				<span style={{ fontWeight: 600 }}>方案管理</span>
				<span style={{ flex: 1 }} />
				<label style={{ display: 'inline-block' }}>
					<input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportFile} />
					<span className="ant-btn ant-btn-sm" style={{ cursor: 'pointer' }}>导入方案(JSON)</span>
				</label>
				<XQButton size="small" disabled={!schemes.length}
					onClick={() => downloadJson(qizhengZeriSchemeStore.exportSchemes(), `七政择日方案_${new Date().toISOString().slice(0, 10)}.json`)}>
					导出全部(JSON)
				</XQButton>
			</div>
			{schemeMsg ? <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.8 }}>{schemeMsg}</div> : null}
			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid rgba(148,163,184,.25)', borderRadius: 8 }}>
				<div style={{ display: 'flex', fontSize: 12, color: 'var(--horosa-text-secondary)', padding: '8px 12px', gap: 10, borderBottom: '1px solid rgba(148,163,184,.2)' }}>
					<span style={{ flex: 1 }}>方案名</span>
					<span style={{ width: 150 }}>保存时间</span>
					<span style={{ width: 70, textAlign: 'right' }}>条件数</span>
					<span style={{ width: 250, textAlign: 'right' }}>操作</span>
				</div>
				{!schemes.length ? <div style={{ padding: 24, color: 'var(--horosa-text-secondary)' }}>暂无已存方案——条件页底部「保存方案」。</div> : null}
				{schemes.map((s) => (
					<div key={s.id} style={{ display: 'flex', gap: 10, padding: '8px 12px', alignItems: 'center', borderBottom: '1px dashed rgba(148,163,184,.18)' }}>
						{renameId === s.id ? (
							<span style={{ flex: 1, display: 'inline-flex', gap: 6 }}>
								<input value={renameText} style={{ flex: 1 }} onChange={(e) => setRenameText(e.target.value)} />
								<XQButton size="small" type="primary" onClick={() => {
									const r = qizhengZeriSchemeStore.renameScheme(s.id, renameText);
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
							<XQButton size="small" onClick={() => downloadJson(qizhengZeriSchemeStore.exportSchemes([s.id]), `七政择日方案_${s.name}.json`)}>导出</XQButton>
							<XQButton size="small" danger onClick={() => { qizhengZeriSchemeStore.deleteScheme(s.id); setSchemeTick(schemeTick + 1); }}>删除</XQButton>
						</span>
					</div>
				))}
			</div>
			<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 8 }}>
				导出为 JSON 可跨设备/跨用户分享;导入同名方案以文件内容覆盖本地。
			</div>
		</div>
	);

	return (
		<Modal
			title={(
				<div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 34 }}>
					<span style={{ flexShrink: 0 }}>七政择日·择时工作台</span>
					<span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 400, color: 'var(--horosa-sev-medium)', lineHeight: 1.35, whiteSpace: 'normal' }}>
						⚠ 结果为七政盘面的机械筛选,仅供术数研习参考;不构成任何现实决策依据,勿迷信滥用——据此行事,后果自负。
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
				<ZeriMiniPanPopup
					geo={previewGeo || geo}	/* 冻结地点优先:概览口径=扫描口径(活 geo 曾致扫后改地点概览错盘) */
					tech="qizheng"
					techOptions={previewOptions || options}	/* 冻结参数优先:概览口径=扫描口径(活 options 曾致扫后改参数概览错盘) */
					row={previewRow}
					computePan={typeof onPreviewPan === 'function' ? onPreviewPan : null}
					onExplain={typeof onPreviewExplain === 'function' ? onPreviewExplain : null}
					onClose={()=>setPreviewRow(null)} />
			) : null}
		</Modal>
	);
}
