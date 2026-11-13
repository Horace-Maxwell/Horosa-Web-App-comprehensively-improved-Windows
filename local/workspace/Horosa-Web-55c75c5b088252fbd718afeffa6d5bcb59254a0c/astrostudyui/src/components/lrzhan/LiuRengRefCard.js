import React from 'react';

// 六壬右栏参考条目(大格 / 小局 / 参考 / 概览 / 毕法)的统一排版。
// 文本仍由 buildReferenceDocumentText / buildOverviewReferenceText 产出(AI 快照与导出共用同一份),
// 这里只管把它分出层次:口诀、段标(荀注 / 增注 / 依据)、行首小标(局式 / 局义 / 局注…)、正文、依据行。
// 大六壬页与三式合一页共用,两页不得各写一套。

const SECTION_LABELS = ['荀注', '增注', '依据'];
const LABEL_LINE_RE = /^([^：，。、；！？\s“”「」（）]{1,6})：\s*(.*)$/;
const INLINE_RE = /(~~[^~]+~~|“[^”]{1,12}”)/g;

function renderInline(text, keyBase){
	const raw = `${text === undefined || text === null ? '' : text}`;
	if(!raw){
		return null;
	}
	return raw.split(INLINE_RE).filter((part)=>part !== '').map((part, idx)=>{
		const key = `${keyBase}_${idx}`;
		if(/^~~[^~]+~~$/.test(part)){
			return <del className="horosa-lr-ref-del" key={key}>{part.slice(2, -2)}</del>;
		}
		if(/^“[^”]{1,12}”$/.test(part)){
			return <span className="horosa-lr-ref-term" key={key}>{part}</span>;
		}
		return <React.Fragment key={key}>{part}</React.Fragment>;
	});
}

// 把整段文本切成带类型的行;导出给测试用。
export function parseLiuRengRefText(text){
	const raw = `${text === undefined || text === null ? '' : text}`.replace(/\r\n?/g, '\n').trim();
	if(!raw){
		return [];
	}
	const lines = raw.split('\n');
	const out = [];
	let inPoem = true;
	let seenContent = false;
	lines.forEach((line)=>{
		const t = line.trim();
		if(!t){
			if(seenContent){
				inPoem = false;
				if(out.length && out[out.length - 1].type !== 'gap'){
					out.push({ type: 'gap' });
				}
			}
			return;
		}
		const m = t.match(LABEL_LINE_RE);
		if(m && SECTION_LABELS.indexOf(m[1]) >= 0){
			inPoem = false;
			seenContent = true;
			out.push({ type: 'section', label: m[1] });
			if(m[2]){
				out.push({ type: 'text', text: m[2] });
			}
			return;
		}
		if(m){
			inPoem = false;
			seenContent = true;
			out.push({ type: 'kv', label: m[1], text: m[2] });
			return;
		}
		seenContent = true;
		out.push({ type: inPoem ? 'poem' : 'text', text: t });
	});
	while(out.length && out[out.length - 1].type === 'gap'){
		out.pop();
	}
	return out;
}

export function LiuRengRefDoc({ text }){
	const rows = parseLiuRengRefText(text);
	if(!rows.length){
		return null;
	}
	// 连续的口诀行并成一块(左侧一道细线),其余逐行。
	const blocks = [];
	rows.forEach((row)=>{
		const last = blocks[blocks.length - 1];
		if(row.type === 'poem' && last && last.type === 'poem'){
			last.lines.push(row.text);
			return;
		}
		blocks.push(row.type === 'poem' ? { type: 'poem', lines: [row.text] } : row);
	});
	return (
		<div className="horosa-lr-ref-doc">
			{blocks.map((row, idx)=>{
				const key = `r_${idx}`;
				if(row.type === 'gap'){
					return <div className="horosa-lr-ref-gap" key={key} />;
				}
				if(row.type === 'poem'){
					return (
						<div className="horosa-lr-ref-poem" key={key}>
							{row.lines.map((line, i)=>(<div key={`${key}_${i}`}>{renderInline(line, `${key}_${i}`)}</div>))}
						</div>
					);
				}
				if(row.type === 'section'){
					return <div className="horosa-lr-ref-section" key={key}>{row.label}</div>;
				}
				if(row.type === 'kv'){
					return (
						<div className="horosa-lr-ref-line" key={key}>
							<strong className="horosa-lr-ref-key">{row.label}</strong>
							{renderInline(row.text, key)}
						</div>
					);
				}
				return <div className="horosa-lr-ref-line" key={key}>{renderInline(row.text, key)}</div>;
			})}
		</div>
	);
}

// 「课式：X；三传：Y；日干支：Z」这类摘要 → 键弱值强的小条。
export function LiuRengRefFacts({ text, items, className }){
	const list = Array.isArray(items) ? items : `${text || ''}`.split('；');
	const facts = list.map((part)=>`${part === undefined || part === null ? '' : part}`.trim()).filter(Boolean);
	if(!facts.length){
		return null;
	}
	return (
		<div className={`horosa-lr-ref-facts${className ? ` ${className}` : ''}`}>
			{facts.map((part, idx)=>{
				const m = part.match(/^([^：]{1,8})：\s*(.*)$/);
				return (
					<span className="horosa-lr-ref-fact" key={`f_${idx}`}>
						{m ? (<><span>{m[1]}</span><strong>{m[2]}</strong></>) : (<strong>{part}</strong>)}
					</span>
				);
			})}
		</div>
	);
}

export function LiuRengRefTag({ children, tone }){
	if(children === undefined || children === null || children === ''){
		return null;
	}
	return <span className={`horosa-lr-ref-tag${tone ? ` is-${tone}` : ''}`}>{children}</span>;
}

export function LiuRengRefEvidence({ evidence }){
	const list = Array.isArray(evidence) ? evidence.filter(Boolean) : [];
	if(!list.length){
		return null;
	}
	return (
		<div className="horosa-lr-ref-evidence">
			<strong>依据</strong>
			<span>{list.join('；')}</span>
		</div>
	);
}

export function LiuRengRefCard({ name, tag, tone, text, evidence, children }){
	return (
		<div className="horosa-lr-ref-card">
			<div className="horosa-lr-ref-head">
				<span className="horosa-lr-ref-name">{name}</span>
				<LiuRengRefTag tone={tone}>{tag}</LiuRengRefTag>
			</div>
			{text ? <LiuRengRefDoc text={text} /> : null}
			{children || null}
			<LiuRengRefEvidence evidence={evidence} />
		</div>
	);
}

export function LiuRengRefEmpty({ children }){
	return <div className="horosa-lr-ref-card horosa-lr-ref-empty">{children}</div>;
}

export function LiuRengRefGroupTitle({ children, extra }){
	return (
		<div className="horosa-lr-ref-group">
			<span>{children}</span>
			{extra ? <em>{extra}</em> : null}
		</div>
	);
}

export default LiuRengRefCard;
