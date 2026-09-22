// 各技法「操作手册」帮助页 · 共享样式令牌(中性表述,纯展示零后端)。
// 所有 *HelpDoc 组件统一用本样式,保证帮助弹窗视觉一致、美观。绝不在内容里写章节号「§」或来源书名/软件名。
export const MUTED = 'var(--horosa-muted, #999)';
export const BORDER = 'var(--horosa-border, rgba(120,120,120,0.25))';
export const GOLD = 'var(--horosa-gold, #b8860b)';
export const h = { fontWeight: 700, fontSize: 13.5, margin: '10px 0 3px' };
export const p = { margin: '0 0 5px', lineHeight: 1.7 };
export const ul = { margin: '0 0 6px', paddingLeft: 18 };
export const li = { margin: '0 0 3px', lineHeight: 1.6 };
export const card = { border: '1px solid var(--horosa-border, rgba(120,120,120,0.25))', borderRadius: 6, padding: '7px 9px', margin: '0 0 7px' };
export const ct = { fontWeight: 700, marginBottom: 2 };
export const body = { maxHeight: 'calc(64 * var(--horosa-lvh, 1vh))', overflowY: 'auto', fontSize: 13, paddingRight: 4 };
export const title = { fontWeight: 800, fontSize: 14, marginBottom: 4 };
export const wrap = { marginTop: 6, borderTop: '1px solid var(--horosa-border, rgba(120,120,120,0.25))', paddingTop: 8 };
export const kv = (k, v) => ({ k, v });   // 占位:组件内自渲染键值行,避免 JSX 在 .js 里。
