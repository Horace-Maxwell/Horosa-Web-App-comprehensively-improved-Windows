// 输入框命令面板(A3):输入框第一个字符打 `/` 弹出命令菜单;↑↓ 选、Enter/Tab 用、Esc 关;中文输入法组合期间(isComposing)不拦任何键。
// 实现:挂在 composer 气泡内,从 wrapper.parentElement 找到 textarea,以 **capture** 阶段原生 keydown 拦截(先于 antd 的 onPressEnter);
// 菜单关着时:输入本身是完整命令且按 Enter → 交给 onRun(不发送);其它一律不拦(页面行为与缺席本组件时相同)。
// [2026-09-11 补完] 两个菜单都按组渲染分组小标题(命令:盘面与分析/会话/模型与协作/技能;@:命盘/事盘/资料/组合/模板/技法/技法段),
// 尾部脚注给出条数与键位提示;不可用项(缺前提/开关未开/技法不适用当前案例)灰显并写明原因;键盘导航仍走扁平 list(首项不变)。
import React from 'react';
import { parseSlashInput, groupCommandItems } from '../../../utils/aiChat/commands';
import { findMentionQuery, insertMentionAtCaret, candidateToken } from '../../../utils/aiChat/mentions';

// 菜单宿主:AI 页全局规则给页内所有 inline `overflow-y: auto` 的滚动区加 `padding-bottom: var(--horosa-scroll-safe-bottom)`(底栏滚动安全区 82px),
// 弹出菜单不是页面滚动区 → 在宿主上把该变量压到 4px(与既有右栏/3D 侧栏同一手法:变量作用域覆盖,不与 :is 组打特异度战),否则两个菜单底部各挂 82px 死白
const HOST_STYLE = { position: 'relative', '--horosa-scroll-safe-bottom': '4px' };
const LIST_STYLE = { position: 'absolute', left: 0, right: 0, bottom: 4, zIndex: 20, maxHeight: 'min(320px, calc(100 * var(--horosa-lvh, 1vh) - 240px))', overflowY: 'auto', background: 'var(--horosa-surface-raised, var(--horosa-panel-bg, #fff))', border: '1px solid var(--horosa-border, #e5e7eb)', borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', padding: 4, fontSize: 12 };
const GROUP_STYLE = { position: 'sticky', top: -4, zIndex: 1, padding: '4px 8px 2px', fontSize: 11, letterSpacing: '0.04em', color: 'var(--horosa-text-soft, #8a8f99)', background: 'var(--horosa-surface-raised, var(--horosa-panel-bg, #fff))' };
const FOOT_STYLE = { padding: '4px 8px 2px', fontSize: 11, color: 'var(--horosa-text-soft, #8a8f99)', borderTop: '1px solid var(--horosa-border, #e5e7eb)', marginTop: 2 };

// 按 group 字段分组:组序按 groupRank(命盘 0 / 事盘 1 / 资料 2 / 组合 3 / 模板 4 / 技法·各术数域 10+ / 技法段 90;同 rank 按首次出现),组内保持传入顺序
function groupBy(list, keyOf){
	const by = new Map();
	(list || []).forEach((it, i)=>{ const g = keyOf(it) || '其他'; if(!by.has(g)){ by.set(g, { rows: [], rank: Number.isFinite(it.groupRank) ? it.groupRank : 50, first: i }); } const e = by.get(g); e.rows.push({ it, i }); if(Number.isFinite(it.groupRank) && it.groupRank < e.rank){ e.rank = it.groupRank; } });
	return Array.from(by.entries()).sort((a, b)=>(a[1].rank - b[1].rank) || (a[1].first - b[1].first)).map(([group, e])=>({ group, rows: e.rows }));
}

export default function ComposerAssist({ prompt, setPrompt, items, onRun, mentionItems, enabled = true, canSteer = false, onSteer }){
	const wrapRef = React.useRef(null);
	const [active, setActive] = React.useState(0);
	// [A4] @引用:跟踪光标,光标处是 @查询 → 弹候选(与 / 菜单互斥:/ 菜单优先)
	const [caret, setCaret] = React.useState(0);
	const pendingCaretRef = React.useRef(null);
	const text = `${prompt || ''}`;
	const parsed = enabled ? parseSlashInput(text) : null;
	// 菜单:首字符 / 且非 //,且命令名还没写完(尚无空白)→ 列出匹配项(单独一个 / 列全部)
	const menuOpen = !!(enabled && text[0] === '/' && text[1] !== '/' && !/\s/.test(text.slice(1)) && items && items.length);
	const mq = enabled && !menuOpen ? findMentionQuery(text, caret) : null;
	// mentionItems 可返回数组,或 { items, hiddenCount, total }(脚注用)
	const mentionRaw = mq && typeof mentionItems === 'function' ? (mentionItems(mq.query) || []) : [];
	const mentionList = Array.isArray(mentionRaw) ? mentionRaw : (Array.isArray(mentionRaw.items) ? mentionRaw.items : []);
	const mentionMeta = Array.isArray(mentionRaw) ? { hiddenCount: 0, total: mentionRaw.length, bestIndex: 0 } : { hiddenCount: mentionRaw.hiddenCount || 0, total: mentionRaw.total || mentionList.length, bestIndex: Number.isFinite(mentionRaw.bestIndex) ? mentionRaw.bestIndex : 0 };
	const mentionOpen = !!(mq && mentionList.length);
	const list = menuOpen ? items : (mentionOpen ? mentionList : []);
	const stateRef = React.useRef({});
	stateRef.current = { menuOpen, mentionOpen, mq, list, active, parsed, prompt, setPrompt, onRun };

	// 默认高亮:@ 菜单带关键字时落在最佳命中(mentions.bestIndex;组序只管视觉分组),/ 菜单与空关键字落首项
	const initialActive = mentionOpen && mentionMeta.bestIndex > 0 && mentionMeta.bestIndex < list.length ? mentionMeta.bestIndex : 0;
	React.useEffect(()=>{ setActive(initialActive); }, [menuOpen, mentionOpen, list.length, mq && mq.query, initialActive]);
	// 高亮项随键盘滚入视野(分组列表可能超出 maxHeight;行上 scrollMarginTop 留出粘性组头的高度,↑ 到组首行不被组头盖住)
	React.useEffect(()=>{
		const wrap = wrapRef.current; if(!wrap){ return; }
		const el = wrap.querySelector('[role="option"][aria-selected="true"]');
		if(el && typeof el.scrollIntoView === 'function'){ try{ el.scrollIntoView({ block: 'nearest' }); }catch(e){ /* noop */ } }
	}, [active, menuOpen, mentionOpen]);
	// 选中候选后把光标放到标记之后(受控 TextArea 重渲后)
	React.useEffect(()=>{
		if(pendingCaretRef.current == null){ return; }
		const wrap = wrapRef.current; const host = wrap && wrap.parentElement; const ta = host ? host.querySelector('textarea') : null;
		if(ta && typeof ta.setSelectionRange === 'function'){ try{ ta.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current); }catch(e){ /* noop */ } setCaret(pendingCaretRef.current); }
		pendingCaretRef.current = null;
	});

	React.useEffect(()=>{
		const wrap = wrapRef.current;
		const host = wrap && wrap.parentElement;
		const ta = host ? host.querySelector('textarea') : null;
		if(!ta){ return undefined; }
		const syncCaret = ()=>{ try{ setCaret(ta.selectionStart == null ? `${ta.value || ''}`.length : ta.selectionStart); }catch(e){ /* noop */ } };
		ta.addEventListener('keyup', syncCaret); ta.addEventListener('click', syncCaret); ta.addEventListener('input', syncCaret);
		const pickMention = (st, it)=>{
			const r = insertMentionAtCaret(st.prompt, st.mq.start, ta.selectionStart == null ? st.prompt.length : ta.selectionStart, candidateToken(it));
			pendingCaretRef.current = r.caret;
			st.setPrompt(r.text);
		};
		const onKey = (e)=>{
			const st = stateRef.current;
			if(e.isComposing || e.keyCode === 229){ return; }
			if(st.mentionOpen){
				if(e.key === 'ArrowDown'){ e.preventDefault(); e.stopPropagation(); setActive((a)=>(a + 1) % st.list.length); return; }
				if(e.key === 'ArrowUp'){ e.preventDefault(); e.stopPropagation(); setActive((a)=>(a - 1 + st.list.length) % st.list.length); return; }
				if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); setCaret(-1); return; }
				if((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey){ e.preventDefault(); e.stopPropagation(); const it = st.list[st.active] || st.list[0]; if(it){ pickMention(st, it); } return; }
				return;
			}
			if(st.menuOpen){
				if(e.key === 'ArrowDown'){ e.preventDefault(); e.stopPropagation(); setActive((a)=>(a + 1) % st.list.length); return; }
				if(e.key === 'ArrowUp'){ e.preventDefault(); e.stopPropagation(); setActive((a)=>(a - 1 + st.list.length) % st.list.length); return; }
				if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); st.setPrompt(''); return; }
				if(e.key === 'Enter' || e.key === 'Tab'){
					if(e.shiftKey){ return; }
					e.preventDefault(); e.stopPropagation();
					const it = st.list[st.active] || st.list[0];
					if(!it){ return; }
					if(it.argsHint){ st.setPrompt(`/${it.name} `); }
					else if(typeof st.onRun === 'function'){ st.onRun(`/${it.name}`); }
					return;
				}
				return;
			}
			if(st.parsed && e.key === 'Enter' && !e.shiftKey){
				e.preventDefault(); e.stopPropagation();
				if(typeof st.onRun === 'function'){ st.onRun(st.prompt); }
			}
		};
		ta.addEventListener('keydown', onKey, true);
		return ()=>{ ta.removeEventListener('keydown', onKey, true); ta.removeEventListener('keyup', syncCaret); ta.removeEventListener('click', syncCaret); ta.removeEventListener('input', syncCaret); };
	}, []);

	// [批二⑤] 插话芯片:生成中(行动能力开)且输入框有字 → 显示「插话 ↵」;点击=排队到下一轮工具回合(回车同效)
	const steerChip = canSteer ? (
		<div data-composer-steer-wrap="1" style={{ position: 'absolute', right: 8, bottom: 4, zIndex: 21 }}>
			<button type="button" data-composer-steer="1" onMouseDown={(e)=>{ e.preventDefault(); }} onClick={()=>{ if(typeof onSteer === 'function'){ onSteer(); } }}
				style={{ fontSize: 12, lineHeight: '20px', padding: '0 8px', borderRadius: 10, border: '1px solid var(--horosa-border, #e5e7eb)', background: 'var(--horosa-primary-soft, rgba(24,144,255,0.12))', color: 'inherit', cursor: 'pointer' }}
				title="生成中:把这句话排到 AI 下一轮工具回合(回车同效)">插话 ↵</button>
		</div>
	) : null;
	if(mentionOpen){
		const groups = groupBy(list, (it)=>it.group);
		const unavailable = list.filter((it)=>it.available === false).length;
		return (
			<div ref={wrapRef} data-composer-assist="mention" style={HOST_STYLE}>
				<div role="listbox" data-mention-count={list.length} data-mention-hidden={mentionMeta.hiddenCount} style={LIST_STYLE}>
					{groups.map((g)=>(
						<React.Fragment key={`g:${g.group}`}>
							<div data-mention-group={g.group} style={GROUP_STYLE}>{g.group}</div>
							{g.rows.map(({ it, i })=>(
								<div key={`${it.kind}:${it.id}`} role="option" aria-selected={i === active} data-mention-item={it.id} data-mention-kind={it.kind} data-available={it.available === false ? '0' : '1'}
									title={it.available === false && it.why ? it.why : undefined}
									onMouseDown={(e)=>{ e.preventDefault(); const st = stateRef.current; const r = insertMentionAtCaret(st.prompt, st.mq.start, caret, candidateToken(it)); pendingCaretRef.current = r.caret; setPrompt(r.text); }}
									style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', scrollMarginTop: 26, background: i === active ? 'var(--horosa-primary-soft, rgba(24,144,255,0.12))' : 'transparent', opacity: it.available === false ? 0.55 : 1 }}>
									<span style={{ flex: '1 1 auto' }}>{it.label}</span>
									{it.available === false && it.why ? <span style={{ fontSize: 11, color: 'var(--horosa-text-soft, #8a8f99)' }}>{it.why}</span> : null}
									{it.key && it.kind === 'technique' ? <span style={{ fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--horosa-text-soft, #8a8f99)' }}>{it.key}</span> : null}
								</div>
							))}
						</React.Fragment>
					))}
					<div data-mention-foot="1" style={FOOT_STYLE}>
						{`共 ${mentionMeta.total || list.length} 项`}{mentionMeta.hiddenCount ? (mq && mq.query ? `,还有 ${mentionMeta.hiddenCount} 条未显示,再多打几个字筛选` : `,命盘 / 资料等还有 ${mentionMeta.hiddenCount} 条未显示,输入名字筛选`) : ''}{list.some((it)=>it.kind === 'technique') ? (mq && mq.query ? ' · 技法可搜中文 / 英文键 / 拼音首字母;`@技法名/` 列它的内容段' : ' · 技法已全部列出(中文 / 英文键 / 拼音首字母都可搜;`@技法名/` 列它的内容段)') : ''}{unavailable ? ' · 灰色 = 当前案例不适用' : ''}{' · ↑↓ 选 · Enter 插入 · Esc 关'}
					</div>
				</div>
			</div>
		);
	}
	if(!menuOpen){ return <div ref={wrapRef} data-composer-assist="idle" style={steerChip ? { position: 'relative' } : { display: 'none' }}>{steerChip}</div>; }
	// 单独一个 `/` 按组渲染(列表已按组序);带前缀时列表按命中质量排、不分组渲染,保证视觉序 = 扁平序(↑↓/Enter 落在看到的那一行)
	const hasPrefix = text.length > 1;
	const cmdGroups = hasPrefix ? [{ group: '', rows: list.map((it, i)=>({ it, i })) }] : groupCommandItems(list).map((g)=>({ group: g.group, rows: g.items.map((it)=>({ it, i: list.indexOf(it) })) }));
	const grey = list.filter((it)=>!it.available).length;
	return (
		<div ref={wrapRef} data-composer-assist="menu" style={HOST_STYLE}>
			{steerChip}
			<div role="listbox" data-command-count={list.length} style={LIST_STYLE}>
				{cmdGroups.map((g)=>(
					<React.Fragment key={`g:${g.group}`}>
						{g.group ? <div data-command-group={g.group} style={GROUP_STYLE}>{g.group}</div> : null}
						{g.rows.map(({ it, i })=>(
							<div key={`${it.kind}:${it.name}`} role="option" aria-selected={i === active} data-command-item={it.name} data-available={it.available ? '1' : '0'}
								onMouseDown={(e)=>{ e.preventDefault(); setActive(i); if(it.argsHint){ setPrompt(`/${it.name} `); } else if(typeof onRun === 'function'){ onRun(`/${it.name}`); } }}
								style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', scrollMarginTop: 26, background: i === active ? 'var(--horosa-primary-soft, rgba(24,144,255,0.12))' : 'transparent', opacity: it.available ? 1 : 0.55 }}>
								<span style={{ fontFamily: 'ui-monospace, Menlo, monospace', minWidth: 96 }}>/{it.name}{it.argsHint ? ` ${it.argsHint}` : ''}</span>
								<span style={{ flex: '1 1 auto', color: 'var(--horosa-text-soft, #8a8f99)' }}>{it.help}{it.available ? '' : ` · ${it.why}`}</span>
								{it.kind === 'skill' ? <span style={{ fontSize: 11, color: 'var(--horosa-text-soft, #8a8f99)' }}>技能</span> : null}
							</div>
						))}
					</React.Fragment>
				))}
				<div data-command-foot="1" style={FOOT_STYLE}>{`共 ${list.length} 条`}{grey ? ` · 灰色 ${grey} 条当前不可用(原因见右)` : ''}{' · ↑↓ 选 · Enter 用 · Esc 关'}</div>
			</div>
		</div>
	);
}
