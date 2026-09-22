// 设置卡「按任务用模型」(C4):六槽 × (模型 / 思考档 / 推理档 / 温度 / 输出上限)表格,留空=跟随当前模型 / 全局档。
// 纪律:打开进阶页不写键;只在用户改动时经 writeModelRoutes / writeRouteOptions 写;「全部清空」即删键(与从未设置同形)。
// [批四] 整宽表格:表头行 + display:contents 行,卡身 <880px(ResizeObserver 量)退化为逐槽堆叠;已显式设置的格带金线(跟随 ≠ 覆盖);
//        行末「恢复跟随」一键清这一槽五项;具名方案(另存 / 切换 / 删除)迁到头部工具条。
import React from 'react';
import { Select, Button, InputNumber, Input, message } from 'antd';
import XQIcon from '../../xq-icons';
import { ROUTE_SLOTS, ROUTE_SLOT_META, readModelRoutes, writeModelRoutes, clearModelRoutes, subscribeModelRoutes, hasAnyRoute, readRouteOptions, writeRouteOptions, clearRouteOptions, subscribeRouteOptions, hasAnyRouteOption, ROUTE_EFFORTS, ROUTE_TEMPERATURE_MAX, ROUTE_MAX_TOKENS_MAX, readRouteProfiles, subscribeRouteProfiles, saveRouteProfile, applyRouteProfile, removeRouteProfile, clearActiveRouteProfile, isRouteProfileDirty, ROUTE_PROFILE_NAME_MAX } from '../../../utils/aiModelRouting';
import { encodeModelSelection, THINKING_LEVELS } from '../../../utils/aiAnalysisProviders';
import { AdvCard, AdvStatus, ADV_SECTION_IDS, advStyles as styles } from './AdvCard';
import useElementWidth from './useElementWidth';

// 表格最小宽 868(=120+220+128+112+88+120+32 + 6×8):再窄就逐槽堆叠
export const ROUTE_GRID_STACK_BELOW = 880;
const ROUTE_HEADERS = ['任务槽', '模型', '思考档', '推理档', '温度', '输出上限'];
const has = (v)=>v !== undefined && v !== null && v !== '';

function chatModelsOf(profile){
	const out = [];
	const push = (m)=>{ const t = `${m == null ? '' : m}`.trim(); if(t && out.indexOf(t) < 0){ out.push(t); } };
	(profile.chatModelIds || []).forEach(push);
	(profile.manualModels || []).forEach(push);
	(profile.models || []).forEach(push);
	return out;
}

export function buildRouteOptions(providerProfiles){
	const result = [];
	(providerProfiles || []).forEach((profile)=>{
		if(!profile || profile.enabled === false){ return; }
		chatModelsOf(profile).forEach((model)=>{ result.push({ value: encodeModelSelection(profile.id, model), label: `${profile.name || '未命名配置'} / ${model}` }); });
	});
	return result;
}

export default function ChatModelRoutesPanel({ providerProfiles }){
	const [routes, setRoutes] = React.useState(()=>readModelRoutes());
	React.useEffect(()=>subscribeModelRoutes((r)=>setRoutes(r)), []);
	const [routeOptions, setRouteOptions] = React.useState(()=>readRouteOptions());   // [批二⑩] 按槽思考档
	React.useEffect(()=>subscribeRouteOptions(setRouteOptions), []);
	const options = React.useMemo(()=>buildRouteOptions(providerProfiles), [providerProfiles]);
	const thinkingOptions = React.useMemo(()=>THINKING_LEVELS.map((t)=>({ value: t.value, label: `思考·${t.label}` })), []);
	// [批三②] 具名方案:另存为 / 切换 / 删除;active 空=现状
	const [profiles, setProfiles] = React.useState(()=>readRouteProfiles());
	React.useEffect(()=>subscribeRouteProfiles(setProfiles), []);
	const [newName, setNewName] = React.useState('');
	const profileNames = Object.keys(profiles.profiles);
	const dirty = profiles.active ? isRouteProfileDirty(profiles.active) : false;
	const effortOptions = React.useMemo(()=>ROUTE_EFFORTS.map((e)=>({ value: e, label: `推理·${e}` })), []);
	const active = hasAnyRoute(routes) || hasAnyRouteOption(routeOptions) || !!profiles.active;
	const gridRef = React.useRef(null);
	const gridW = useElementWidth(gridRef);
	const stacked = gridW !== null && gridW < ROUTE_GRID_STACK_BELOW;
	const toolbar = (
		<div className={styles.toolbarRow} data-route-profiles="1">
			<span>方案</span>
			<Select size="small" allowClear placeholder="未选方案" value={profiles.active || undefined} options={profileNames.map((n)=>({ value: n, label: n }))} style={{ width: 160 }} data-route-profile-select="1"
				onChange={(v)=>{ if(v){ if(!applyRouteProfile(v)){ message.warning('方案不存在'); } }else{ clearActiveRouteProfile(); } }} />
			{profiles.active && dirty ? <AdvStatus tone="warn" data-route-profile-dirty="1">已改动(另存或重选方案)</AdvStatus> : null}
			<span className={styles.spacer} />
			<Input size="small" placeholder="方案名" maxLength={ROUTE_PROFILE_NAME_MAX} value={newName} onChange={(e)=>setNewName(e.target.value)} style={{ width: 120 }} data-route-profile-name="1" />
			<Button size="small" data-route-profile-save="1" disabled={!newName.trim()} onClick={()=>{ const r = saveRouteProfile(newName); if(!r){ message.warning('方案名为空或已达上限'); return; } setNewName(''); message.success('已保存为方案'); }}>另存为</Button>
			{profiles.active ? <Button size="small" danger data-route-profile-remove="1" onClick={()=>{ removeRouteProfile(profiles.active); message.success('已删除方案(当前设置不变)'); }}>删除方案</Button> : null}
		</div>
	);
	return (
		<AdvCard span2 id={ADV_SECTION_IDS.routes} icon="ai" title="按任务用模型" status={active ? <AdvStatus on>已设置</AdvStatus> : <AdvStatus>跟随当前模型</AdvStatus>}
			desc="工具调用轮用便宜模型、终稿用强模型(本轮无调用而终稿模型不同时自动多收口一轮);每槽可单独定思考档 / 推理档 / 温度 / 输出上限,留空=跟随(带金线的格=已覆盖);只作用于对话页——目标任务 / 定时 / 自动规则简报 / 无头出口按任务钉住的模型运行,不走这张表;整套可另存为具名方案,/profile 名字 一键切换;全部留空=与现状完全一致。"
			actions={active ? <Button size="small" data-model-routes-clear="1" onClick={()=>{ clearModelRoutes(); clearRouteOptions(); clearActiveRouteProfile(); }}>全部清空</Button> : null}
			toolbar={toolbar}
			data-model-routes-panel="1" data-active={active ? '1' : '0'} data-route-profile-active={profiles.active || ''}>
			<div ref={gridRef} className={styles.routeGrid} data-route-grid="1" data-layout={stacked ? 'stack' : 'grid'}>
				<div className={styles.routeHead} data-route-grid-head="1" aria-hidden="true">
					{ROUTE_HEADERS.map((h)=>(<span key={h}>{h}</span>))}
					<span />
				</div>
				{ROUTE_SLOTS.map((slot)=>{
					const ro = routeOptions[slot] || {};
					const rowSet = has(routes[slot]) || has(ro.thinking) || has(ro.reasoningEffort) || has(ro.temperature) || has(ro.maxTokens);
					return (
						<div key={slot} className={styles.routeRow} data-route-row={slot}>
							<div className={styles.routeLabel} title={ROUTE_SLOT_META[slot].help}>
								<div>{ROUTE_SLOT_META[slot].label}</div>
								<div className={styles.routeLabelHelp}>{ROUTE_SLOT_META[slot].help}</div>
							</div>
							<div className={styles.routeCell} data-route-cell={has(routes[slot]) ? 'set' : 'inherit'} data-route-col="model">
								<Select size="small" allowClear showSearch optionFilterProp="label" placeholder="跟随当前模型" value={routes[slot] || undefined} options={options} data-model-route={slot}
									onChange={(v)=>writeModelRoutes({ [slot]: v || '' })} />
							</div>
							<div className={styles.routeCell} data-route-cell={has(ro.thinking) ? 'set' : 'inherit'} data-route-col="thinking">
								<Select size="small" allowClear placeholder="跟随全局" value={has(ro.thinking) ? ro.thinking : undefined} options={thinkingOptions} data-route-thinking={slot} title="这一槽的思考档;留空=跟随全局思考档"
									onChange={(v)=>writeRouteOptions({ [slot]: { thinking: v || '' } })} />
							</div>
							<div className={styles.routeCell} data-route-cell={has(ro.reasoningEffort) ? 'set' : 'inherit'} data-route-col="effort">
								<Select size="small" allowClear placeholder="跟随" value={has(ro.reasoningEffort) ? ro.reasoningEffort : undefined} options={effortOptions} data-route-effort={slot} title="OpenAI 系推理模型的 reasoning_effort;其它家族忽略"
									onChange={(v)=>writeRouteOptions({ [slot]: { reasoningEffort: v || '' } })} />
							</div>
							<div className={styles.routeCell} data-route-cell={has(ro.temperature) ? 'set' : 'inherit'} data-route-col="temperature">
								<InputNumber size="small" min={0} max={ROUTE_TEMPERATURE_MAX} step={0.1} placeholder="跟随" value={has(ro.temperature) ? ro.temperature : undefined} data-route-temperature={slot} title="这一槽的 temperature(推理模型不发);留空=跟随"
									onChange={(v)=>writeRouteOptions({ [slot]: { temperature: Number.isFinite(v) ? v : '' } })} />
							</div>
							<div className={styles.routeCell} data-route-cell={has(ro.maxTokens) ? 'set' : 'inherit'} data-route-col="maxTokens">
								<InputNumber size="small" min={1} max={ROUTE_MAX_TOKENS_MAX} step={256} placeholder="跟随" value={has(ro.maxTokens) ? ro.maxTokens : undefined} data-route-max-tokens={slot} title="这一槽的输出上限 max_tokens;留空=跟随"
									onChange={(v)=>writeRouteOptions({ [slot]: { maxTokens: Number.isFinite(v) ? v : '' } })} />
							</div>
							<div className={styles.routeCell} data-route-col="reset">
								<Button type="text" size="small" className={styles.routeReset} data-route-row-reset={slot} disabled={!rowSet} title="这一槽全部恢复跟随"
									onClick={()=>{ writeModelRoutes({ [slot]: '' }); writeRouteOptions({ [slot]: { thinking: '', reasoningEffort: '', temperature: '', maxTokens: '' } }); }}>
									<XQIcon name="refresh" />
								</Button>
							</div>
						</div>
					);
				})}
			</div>
		</AdvCard>
	);
}
