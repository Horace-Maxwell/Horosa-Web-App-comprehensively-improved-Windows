// 各技法「操作手册」帮助页 · 共享样式与小部件(中性表述,纯展示零后端)。
// 所有 *HelpDoc 一律从这里取样式与部件,保证帮助弹窗视觉一致;改观感只改这一处。
// 绝不在内容里写章节号「§」或来源书名 / 软件名。
// 颜色全走 :root 上的主题变量(帮助弹窗挂在 portal 里,作用域在工作区壳内的变量解析不到)。
import React from 'react';

export const MUTED = 'var(--horosa-text-soft, var(--horosa-muted, #888))';
export const BORDER = 'var(--horosa-border, rgba(120,120,120,0.25))';
export const GOLD = 'var(--horosa-accent, #b8860b)';
const ACCENT_STRONG = 'var(--horosa-accent-strong, var(--horosa-accent, #b8860b))';
const ACCENT_SOFT = 'var(--horosa-accent-soft, rgba(184, 134, 11, 0.12))';
const PANEL = 'var(--horosa-panel-soft, rgba(127, 127, 127, 0.06))';
const TEXT = 'var(--horosa-text, inherit)';

// 小节标题:左侧一道主题金竖条
export const h = { fontWeight: 700, fontSize: 14.5, lineHeight: 1.4, color: TEXT, margin: '20px 0 9px', padding: '1px 0 1px 10px', borderLeft: `3px solid ${GOLD}` };
export const p = { margin: '0 0 10px', lineHeight: 1.85, fontSize: 13.5, color: TEXT };
export const ul = { margin: '0 0 12px', paddingLeft: 20 };
export const li = { margin: '0 0 7px', lineHeight: 1.8, fontSize: 13.5, color: TEXT };
// 卡片:淡底圆角,用于一个对象 / 一个选项 / 一种方法的成组说明
export const card = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px 10px', margin: '0 0 10px' };
export const ct = { fontWeight: 700, fontSize: 13.5, color: ACCENT_STRONG, margin: '0 0 7px', letterSpacing: '0.02em' };
// 正文容器:不再自带滚动(手册外壳的内容栏负责滚动,避免两层滚动条)
export const body = { fontSize: 13.5, lineHeight: 1.8 };
export const title = { fontWeight: 800, fontSize: 16, margin: '0 0 6px', color: TEXT };
export const wrap = { marginTop: 6 };

// 键值行:左列键名(淡色、定宽可伸),右列说明;行间一道虚线
// 键名列定宽(每行同宽,说明列左缘对齐);键名长了在列内折行
const KV_ROW = { display: 'grid', gridTemplateColumns: '10.5em 1fr', columnGap: 14, padding: '5px 0', borderBottom: `1px dashed ${BORDER}`, lineHeight: 1.75, fontSize: 13.5 };
const KV_KEY = { color: MUTED, fontWeight: 600, wordBreak: 'break-word' };
export function kv(k, v, key){
	return (
		<div key={key} className="horosa-help-kv" style={KV_ROW}>
			<span style={KV_KEY}>{k}</span>
			<span style={{ color: TEXT, minWidth: 0 }}>{v}</span>
		</div>
	);
}

// 导语:一章开头一句话说清这是什么、拿来做什么
export function Lead({ children }){
	return <p className="horosa-help-lead" style={{ margin: '2px 0 14px', fontSize: 14.5, lineHeight: 1.85, color: TEXT }}>{children}</p>;
}

// 小节:标题 + 内容
export function Section({ title: sectionTitle, children }){
	return (
		<section style={{ margin: '0 0 6px' }}>
			<div style={h}>{sectionTitle}</div>
			{children}
		</section>
	);
}

// 提示框:tip = 金色(用法窍门)/ note = 中性(口径说明)/ warn = 注意事项
const TONES = {
	tip: { border: GOLD, bg: ACCENT_SOFT, label: '提示' },
	note: { border: BORDER, bg: PANEL, label: '说明' },
	warn: { border: 'var(--horosa-danger, #c0533a)', bg: 'rgba(192, 83, 58, 0.08)', label: '注意' },
};
export function Tip({ tone = 'tip', label, children }){
	const t = TONES[tone] || TONES.tip;
	return (
		<div className="horosa-help-tip" style={{ borderLeft: `3px solid ${t.border}`, background: t.bg, borderRadius: '0 8px 8px 0', padding: '9px 12px', margin: '4px 0 12px', fontSize: 13.5, lineHeight: 1.8, color: TEXT }}>
			<span style={{ fontWeight: 700, marginRight: 8, color: tone === 'warn' ? t.border : ACCENT_STRONG }}>{label || t.label}</span>{children}
		</div>
	);
}

// 步骤:有先后的操作写成编号步骤
export function Steps({ items }){
	return (
		<ol style={{ margin: '0 0 12px', paddingLeft: 0, listStyle: 'none', counterReset: 'horosa-help-step' }}>
			{(items || []).map((item, i)=>(
				<li key={i} style={{ display: 'flex', gap: 10, margin: '0 0 8px', lineHeight: 1.8, fontSize: 13.5, color: TEXT }}>
					<span className="horosa-help-step-no" style={{ flex: '0 0 22px', height: 22, borderRadius: 11, background: ACCENT_SOFT, color: ACCENT_STRONG, fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{i + 1}</span>
					<span style={{ minWidth: 0 }}>{item}</span>
				</li>
			))}
		</ol>
	);
}

// 选项表:一页的设置逐项列「选项 · 取值 · 缺省 · 作用」
const TH = { textAlign: 'left', fontWeight: 600, fontSize: 12.5, color: MUTED, padding: '7px 10px', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap', background: PANEL };
const TD = { padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top', fontSize: 13, lineHeight: 1.7, color: TEXT };
export function OptionTable({ rows, columns }){
	const cols = columns || [{ key: 'name', title: '选项' }, { key: 'values', title: '取值' }, { key: 'def', title: '缺省' }, { key: 'effect', title: '作用' }];
	return (
		<div style={{ overflowX: 'auto', margin: '2px 0 14px', border: `1px solid ${BORDER}`, borderRadius: 10 }}>
			<table style={{ width: '100%', borderCollapse: 'collapse' }}>
				<thead><tr>{cols.map((c)=><th key={c.key} style={TH}>{c.title}</th>)}</tr></thead>
				<tbody>
					{(rows || []).map((row, i)=>(
						<tr key={i}>
							{cols.map((c, j)=><td key={c.key} style={{ ...TD, ...(j === 0 ? { fontWeight: 600, whiteSpace: 'nowrap' } : null), ...(i === rows.length - 1 ? { borderBottom: 'none' } : null) }}>{row[c.key]}</td>)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// 纯展示小部件(无 hooks、无副作用):标记后,给 AI 的纯文本与帮助护栏可以直接调用展开它们的文字
// (选项表、步骤的文字在 props 里而不在 children 里,不展开就漏掉)
[Lead, Section, Tip, Steps, OptionTable].forEach((fn)=>{ fn.__helpPure = true; });
