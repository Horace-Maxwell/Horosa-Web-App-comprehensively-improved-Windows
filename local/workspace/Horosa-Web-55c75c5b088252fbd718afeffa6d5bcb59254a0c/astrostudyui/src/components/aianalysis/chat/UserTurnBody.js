// 用户气泡里的命令轮(本轮请求带 command 时):显示「/流年 2027」芯片 + 本轮技法(与会话挂载不同时可「保留为挂载」)
// + 「发给模型的全文」可展开。没有 command 的消息不经这里(气泡照旧显示正文,逐字节不变)。
import React from 'react';
import { sameTechniqueSet } from '../../../utils/aiChat/turnRequest';

const CHIP = { display: 'inline-block', padding: '0 8px', borderRadius: 10, fontSize: 12, lineHeight: '20px', background: 'var(--horosa-accent-soft, rgba(24,144,255,0.12))', color: 'inherit', whiteSpace: 'nowrap' };
const SOFT = { fontSize: 12, color: 'var(--horosa-text-soft, #8a8f99)' };
const LINK = { fontSize: 12, marginLeft: 8, cursor: 'pointer', color: 'var(--horosa-link, #1677ff)', background: 'none', border: 'none', padding: 0 };

export default function UserTurnBody({ item, labelOf, sessionKeys, onKeep }){
	const [open, setOpen] = React.useState(false);
	const t = (item && item.turn) || {};
	const c = t.command || {};
	const keys = Array.isArray(t.techniqueKeys) ? t.techniqueKeys : [];
	const same = sameTechniqueSet(keys, sessionKeys);
	const name = (k)=>(typeof labelOf === 'function' ? labelOf(k) : k) || k;
	return (
		<span data-user-turn="1" style={{ whiteSpace: 'normal' }}>
			<span data-turn-command={c.name} style={CHIP}>/{c.name}{c.argsText ? ` ${c.argsText}` : ''}</span>
			{keys.length ? <span style={SOFT}> · 本轮按 {keys.map(name).join(' + ')}</span> : null}
			{keys.length && !same && typeof onKeep === 'function' ? (
				<button type="button" data-turn-keep="1" style={LINK} onClick={()=>onKeep(keys)} title="把这几门技法设为本会话的挂载(之后的提问都带上)">保留为挂载</button>
			) : null}
			<button type="button" data-turn-expand="1" style={LINK} title="展开 / 收起这一轮实际发给模型的全文" onClick={()=>setOpen((v)=>!v)}>{open ? '收起' : '发给模型的全文'}</button>
			{open ? <span data-turn-full="1" style={{ display: 'block', marginTop: 6, whiteSpace: 'pre-wrap' }}>{item.content}</span> : null}
		</span>
	);
}
