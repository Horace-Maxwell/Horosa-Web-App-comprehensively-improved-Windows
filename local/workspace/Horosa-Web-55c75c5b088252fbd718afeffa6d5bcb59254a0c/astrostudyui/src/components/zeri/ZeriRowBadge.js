// [择日结果表] 行内课/局徽章统一渲染(七家共用单源:六壬/三式/紫微/八字/太乙/奇门/黄历)。
// 病根:150px 窄列 + 长文案(「元首课·壬午→己卯→丙子」13 字)在胶囊内自然折行会劈字
// (「丙/子」拆两行,用户两截图实报「割裂」)。修法=内容按「·」与空白拆语义段:
// 段内绝不断字(nowrap),段间整段换行居中——单段短文案观感与旧版逐像素一致,长文案
// 变整齐多行。勿再各自手抄胶囊样式(样式漂移即回潮)。
import React from 'react';

export default function ZeriRowBadge({ text }){
	const t = `${text === undefined || text === null ? '' : text}`.trim();
	if(!t){ return <span style={{ opacity: 0.5 }}>—</span>; }
	const parts = t.split(/[·\s]+/).map((p) => p.trim()).filter(Boolean);
	return (
		<span style={{
			display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center',
			columnGap: 6, rowGap: 1, padding: '2px 8px', borderRadius: 10, lineHeight: 1.5, maxWidth: '100%',
			background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.35)',
		}}>
			{parts.map((p, i) => <span key={i} style={{ whiteSpace: 'nowrap' }}>{p}</span>)}
		</span>
	);
}
