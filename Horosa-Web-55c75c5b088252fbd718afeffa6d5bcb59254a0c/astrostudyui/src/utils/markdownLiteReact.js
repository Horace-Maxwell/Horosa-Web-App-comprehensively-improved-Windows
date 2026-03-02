import React, { Fragment } from 'react';

function safeText(raw){
	return `${raw === undefined || raw === null ? '' : raw}`;
}

function renderInlineBold(raw, keyPrefix){
	const text = safeText(raw);
	if(!text){
		return '';
	}
	const parts = [];
	const reg = /\*\*([^*]+)\*\*/g;
	let lastIdx = 0;
	let match = reg.exec(text);
	let hitIdx = 0;
	while(match){
		if(match.index > lastIdx){
			parts.push(text.substring(lastIdx, match.index));
		}
		parts.push(
			<strong key={`${keyPrefix}_b_${hitIdx}`}>{match[1]}</strong>
		);
		hitIdx++;
		lastIdx = reg.lastIndex;
		match = reg.exec(text);
	}
	if(lastIdx < text.length){
		parts.push(text.substring(lastIdx));
	}
	return parts.length ? parts : text;
}

function parseHeading(raw){
	const line = safeText(raw);
	const match = line.match(/^\s*(#{1,6})\s*(.+?)\s*$/);
	if(!match){
		return null;
	}
	return {
		level: match[1].length,
		text: match[2],
	};
}

function isThematicBreak(raw){
	const line = safeText(raw);
	return /^\s*([-*_])\1{2,}\s*$/.test(line);
}

function getHeadingStyle(level){
	if(level <= 2){
		return { fontWeight: 700, fontSize: '1.02em' };
	}
	if(level === 3){
		return { fontWeight: 700, fontSize: '1em' };
	}
	return { fontWeight: 700 };
}

export function renderMarkdownLiteBlock(raw, keyPrefix){
	const text = safeText(raw).replace(/\r\n/g, '\n');
	const lines = text.split('\n');
	return lines.map((line, idx)=>(
		<Fragment key={`${keyPrefix || 'ml'}_line_${idx}`}>
			{(()=>{
				if(isThematicBreak(line)){
					return <span style={{ display: 'block', borderTop: '1px solid #d9d9d9', margin: '4px 0' }} />;
				}
				const heading = parseHeading(line);
				if(heading){
					return (
						<span style={getHeadingStyle(heading.level)}>
							{renderInlineBold(heading.text, `${keyPrefix || 'ml'}_${idx}_h`)}
						</span>
					);
				}
				return renderInlineBold(line, `${keyPrefix || 'ml'}_${idx}`);
			})()}
			{idx < lines.length - 1 ? <br /> : null}
		</Fragment>
	));
}
