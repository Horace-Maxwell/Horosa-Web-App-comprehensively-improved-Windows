// 「进阶」页:AI 助手高级能力总控。
// 只做编排与总览:把 AIAnalysisMain 传进来的设置卡(chatAssist.settingsPanels,按 key 识别)与行动能力面板(无 key 的那一个)
// 摆进固定版位;顶部 hero 汇总各能力的实时状态(策略预设 / 模型路由 / 个人口径 / 记忆条数 / 行动能力),胶囊可点=跳到该分区。
// [批四] 版式:hero → [左侧分区导轨 | 卡片网格];导轨只在宽档显示;宽度档由 ResizeObserver 量根节点写到 data-adv-w(narrow/medium/wide,
//        8px 滞回;没量到=空串交 @media 兜底)。纪律:打开本页不写任何键——所有读数只订阅,不改动;导轨/折叠状态也不持久化。
import React from 'react';
import XQIcon from '../../xq-icons';
import styles from './advanced.less';
import { readContextPolicy, subscribeContextPolicy, contextPolicyPresetName } from '../../../utils/aiChatHistory';
import { readModelRoutes, subscribeModelRoutes, hasAnyRoute, readRouteOptions, subscribeRouteOptions, hasAnyRouteOption, readRouteProfiles, subscribeRouteProfiles } from '../../../utils/aiModelRouting';
import { readPersona, subscribePersona } from '../../../utils/aiChat/persona';
import { listMemories, subscribeMemory } from '../../../utils/aiChat/memory';
import { isAgentEnabled, subscribeAgentPrefs } from '../../../utils/aiAgent/prefs';
import { ADV_SECTION_IDS } from './AdvCard';
import AdvSectionNav, { jumpToSection } from './AdvSectionNav';
import useElementWidth from './useElementWidth';
import { skillsOf, BUILTIN_SKILLS } from '../../../utils/aiChat/skills';

const PRESET_LABEL = { legacy: '不裁', window: '窗口', economy: '经济', custom: '自定义' };
// 版位:按 key 落格;顺序即页面顺序(策略 | 对比 → 路由(整宽)→ 口径 | 技能 → 行动能力(整宽,末尾))。未列入的 key 追加到末尾,无 key 的元素落到 agent 槽。
const SLOTS = ['context-policy', 'best-of', 'model-routes', 'persona-memory', 'skill-packs'];
// 宽度档阈值(根节点 CSS px;缩放档下自然折算):<narrow 单列;≥wide 才出导轨。8px 滞回防抖。
export const ADV_WIDTH_BANDS = { narrow: 860, wide: 1080, hysteresis: 8 };
export const ADV_SECTIONS = [
	{ id: ADV_SECTION_IDS.context, label: '上下文策略', icon: 'history' },
	{ id: ADV_SECTION_IDS.bestof, label: '多模型对比', icon: 'composite' },
	{ id: ADV_SECTION_IDS.routes, label: '按任务用模型', icon: 'ai' },
	{ id: ADV_SECTION_IDS.persona, label: '口径与记忆', icon: 'user' },
	{ id: ADV_SECTION_IDS.skills, label: '技能包', icon: 'tools' },
	{ id: ADV_SECTION_IDS.agent, label: '行动能力', icon: 'quickAi', danger: true },
];
const AGENT_SUBSECTIONS = [
	{ id: ADV_SECTION_IDS.agentMcp, label: '本机 MCP 服务' },
	{ id: ADV_SECTION_IDS.agentServers, label: '外部服务器' },
	{ id: ADV_SECTION_IDS.agentWeb, label: '联网检索' },
	{ id: ADV_SECTION_IDS.agentRules, label: '自动规则' },
	{ id: ADV_SECTION_IDS.agentLedger, label: '动作账本' },
];

export function widthBand(width, prev){
	if(width === null || width === undefined){ return ''; }
	const { narrow, wide, hysteresis } = ADV_WIDTH_BANDS;
	if(prev === 'narrow' && width < narrow + hysteresis){ return 'narrow'; }
	if(prev === 'medium' && width >= narrow - hysteresis && width < wide + hysteresis){ return 'medium'; }
	if(prev === 'wide' && width >= wide - hysteresis){ return 'wide'; }
	return width < narrow ? 'narrow' : (width < wide ? 'medium' : 'wide');
}

// React.Children.toArray 会给元素重编 key:带 key 的成 ".0:$context-policy" 这类,没 key 的成 ".1"/".0:0"(纯下标)。
// 取最后一个 "$" 之后的原始 key;没有 "$" 就是没 key(→ 行动能力槽)。
function keyOf(el){
	const k = el && el.key != null ? `${el.key}` : '';
	const i = k.lastIndexOf('$');
	return i >= 0 ? k.slice(i + 1) : '';
}

function Pill({ on, target, onJump, pillKey, children }){
	const go = ()=>{ if(target && typeof onJump === 'function'){ onJump(target); } };
	return (
		<span className={[styles.pill, on ? styles.pillOn : ''].filter(Boolean).join(' ')} role="button" tabIndex={0} data-adv-jump={target || undefined} data-adv-pill={pillKey || undefined}
			onClick={go} onKeyDown={(e)=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } }}>
			<span className={styles.pillDot} />{children}
		</span>
	);
}

// [Q-294/M-109·AR-19] personaInjecting:由 useChatAssist 按当前挂载源合成四层后给出(全局空、分层有字也算注入中);未传时回落只看全局文本
export default function AdvancedPane({ children, personaInjecting }){
	const [preset, setPreset] = React.useState(()=>contextPolicyPresetName(readContextPolicy()));
	// [D4] 与卡内芯片同口径:模型路由 / 槽参数 / 具名方案 三者任一设置即「已设置」(此前只看模型键,设了槽参数仍显示「跟随当前」)
	const routedNow = ()=>hasAnyRoute(readModelRoutes()) || hasAnyRouteOption(readRouteOptions()) || !!(readRouteProfiles() || {}).active;
	const [routed, setRouted] = React.useState(routedNow);
	const [persona, setPersona] = React.useState(()=>readPersona());
	const personaOn = typeof personaInjecting === 'boolean' ? personaInjecting : !!(persona.enabled && persona.text);
	const [memoryCount, setMemoryCount] = React.useState(0);
	const [agentOn, setAgentOn] = React.useState(()=>isAgentEnabled());
	React.useEffect(()=>subscribeContextPolicy((p)=>setPreset(contextPolicyPresetName(p))), []);
	React.useEffect(()=>subscribeModelRoutes(()=>setRouted(routedNow())), []);
	React.useEffect(()=>subscribeRouteOptions(()=>setRouted(routedNow())), []);
	React.useEffect(()=>subscribeRouteProfiles(()=>setRouted(routedNow())), []);
	React.useEffect(()=>subscribePersona((p)=>setPersona(p)), []);
	React.useEffect(()=>{
		let alive = true;
		const reload = ()=>{ listMemories().then((list)=>{ if(alive){ setMemoryCount((list || []).filter((m)=>m.status === 'confirmed').length); } }).catch(()=>{}); };
		reload();
		const off = subscribeMemory(reload);
		return ()=>{ alive = false; if(typeof off === 'function'){ off(); } };
	}, []);
	React.useEffect(()=>subscribeAgentPrefs((d)=>setAgentOn(!!(d && d.enabled))), []);

	const rootRef = React.useRef(null);
	const width = useElementWidth(rootRef);
	const bandRef = React.useRef('');
	const band = widthBand(width, bandRef.current);
	bandRef.current = band;
	const sections = React.useMemo(()=>ADV_SECTIONS.map((s)=>(s.id === ADV_SECTION_IDS.agent ? { ...s, badge: agentOn ? '开' : '', children: agentOn ? AGENT_SUBSECTIONS : [] } : s)), [agentOn]);
	const jump = React.useCallback((id)=>jumpToSection(rootRef.current, id), []);

	const byKey = {};
	const extras = [];
	const agent = [];   // 无 key 的元素全部渲染(按传入顺序落到行动能力槽),一个都不吞
	React.Children.toArray(children).forEach((el)=>{
		if(!React.isValidElement(el)){ return; }
		const k = keyOf(el);
		if(SLOTS.indexOf(k) >= 0){ byKey[k] = el; }
		else if(k){ extras.push(el); }
		else{ agent.push(el); }
	});
	const ordered = SLOTS.map((k)=>byKey[k]).filter(Boolean).concat(extras);
	// [2026-09-11] 技能包胶囊:真值取技能包卡自己收到的 bundles(与卡内计数同源);此前六分区只有五枚胶囊,窄窗(无导轨)技能包卡零快速入口
	const skillCount = (()=>{ try{ const el = byKey['skill-packs']; return el && el.props ? skillsOf(el.props.bundles).length : 0; }catch(e){ return 0; } })();

	return (
		<div className={styles.pane} data-advanced-pane="1" data-adv-w={band} ref={rootRef}>
			<div className={styles.hero}>
				<div className={styles.heroText}>
					<div className={styles.heroTitle}><span className={styles.heroMark}><XQIcon name="sliders" /></span>进阶</div>
					<div className={styles.heroSub}>AI 助手的高级能力总控:每轮发多少上下文、哪一步用哪个模型、你的口径与记忆、可复用的技能包,以及让它替你动手的行动能力。所有旋钮缺省即现状,改了随时可恢复;点右侧胶囊直达该分区。</div>
				</div>
				<div className={styles.pills} data-advanced-pills="1">
					<Pill on={preset !== 'legacy'} target={ADV_SECTION_IDS.context} onJump={jump} pillKey="context">上下文 · {PRESET_LABEL[preset] || preset}</Pill>
					<Pill on={routed} target={ADV_SECTION_IDS.routes} onJump={jump} pillKey="routes">模型路由 · {routed ? '已设置' : '跟随当前'}</Pill>
					<Pill on={personaOn} target={ADV_SECTION_IDS.persona} onJump={jump} pillKey="persona">口径 · {personaOn ? '注入中' : '未注入'}</Pill>
					<Pill on={memoryCount > 0} target={ADV_SECTION_IDS.persona} onJump={jump} pillKey="memory">记忆 · {memoryCount} 条</Pill>
					<Pill on={skillCount > 0} target={ADV_SECTION_IDS.skills} onJump={jump} pillKey="skills">技能包 · {skillCount > 0 ? `${skillCount} 个` : `内置 ${BUILTIN_SKILLS.length}`}</Pill>
					<Pill on={agentOn} target={ADV_SECTION_IDS.agent} onJump={jump} pillKey="agent">行动能力 · {agentOn ? '开' : '关'}</Pill>
				</div>
			</div>
			<div className={styles.layout}>
				<AdvSectionNav sections={sections} rootRef={rootRef} />
				<div className={styles.content}>
					<div className={styles.grid} data-advanced-grid="1">
						{ordered}
						{agent}
					</div>
				</div>
			</div>
		</div>
	);
}
