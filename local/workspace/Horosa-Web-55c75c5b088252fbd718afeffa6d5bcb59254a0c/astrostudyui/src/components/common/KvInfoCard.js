import React from 'react';

// 右栏「键 / 值」分区卡:一张卡 = 小标题 + 若干「键 弱 / 值 强」行。
// 独立太乙页、三式合一页、奇门遁甲页的右栏概览共用同一套类
// (horosa-taiyi-info-card / -info-heading / -info-row,样式单一来源在 layouts/app/08-india-sanshi.less)。
// rows 里的 null / false 项跳过;空值显示「—」。extra 放在行后面(小标签组、网格、说明文字)。
// sub = 标题后面的一小段弱字(如局数、月令)。
export function kvInfoCard(title, rows, extra, sub){
	const list = (rows || []).filter(Boolean);
	return (
		<div className="horosa-taiyi-info-card horosa-taiyi-section-card" key={title}>
			<div className="horosa-taiyi-info-heading">{title}{sub ? <em>{sub}</em> : null}</div>
			{list.map(([label, value])=>(
				<div className="horosa-taiyi-info-row" key={label}>
					<span>{label}</span>
					<strong>{value === undefined || value === null || value === '' ? '—' : value}</strong>
				</div>
			))}
			{extra || null}
		</div>
	);
}

// 「日马：午（离9宫）」这类自带前缀的整句拆成 [键, 值];没有冒号时整句当值。
export function splitLabelText(text, fallbackLabel = '驿马'){
	const raw = `${text === undefined || text === null ? '' : text}`;
	const m = raw.match(/^([^：:]{1,6})[：:]\s*(.*)$/);
	return m ? [m[1], m[2] || '—'] : [fallbackLabel, raw || '—'];
}

// 卡内说明文字(判则、黄黑道这类整段话):弱字、行距松一点。
export function KvInfoNote({ children, soft }){
	if(children === undefined || children === null || children === ''){
		return null;
	}
	return <div className={`horosa-kv-note${soft ? ' is-soft' : ''}`}>{children}</div>;
}

export default kvInfoCard;
