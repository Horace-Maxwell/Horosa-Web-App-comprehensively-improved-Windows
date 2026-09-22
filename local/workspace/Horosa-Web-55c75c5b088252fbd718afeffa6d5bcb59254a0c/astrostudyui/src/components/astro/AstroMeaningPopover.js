import { cloneElement, isValidElement, useCallback, useMemo, } from 'react';
import { Popover } from 'antd';

function normalizeTip(tip){
	if(!tip){
		return null;
	}
	if(typeof tip === 'string'){
		return {
			title: '',
			tips: `${tip}`.split(/\r?\n/),
		};
	}
	if(Array.isArray(tip)){
		return {
			title: '',
			tips: tip.map((item)=>`${item}`),
		};
	}
	if(typeof tip === 'object'){
		const title = tip.title ? `${tip.title}` : '';
		const tips = Array.isArray(tip.tips)
			? tip.tips.map((item)=>`${item}`)
			: (tip.tips !== undefined && tip.tips !== null && tip.tips !== ''
				? [`${tip.tips}`]
				: []);
		return {
			...tip,
			title,
			tips,
		};
	}
	return null;
}

export function isMeaningEnabled(flag){
	return flag === 1 || flag === true;
}

function stripHeadingText(line){
	return `${line || ''}`
		.replace(/^#+\s*/, '')
		.replace(/^\*\*(.*)\*\*$/, '$1')
		.trim();
}

function isHeadingLine(line){
	return /^#+\s+/.test(`${line || ''}`.trim());
}

function renderInlineBold(text, keyPrefix = 'txt'){
	const str = `${text || ''}`;
	const parts = str.split(/(\*\*[^*]+\*\*)/g);
	return parts.filter((item)=>item !== '').map((part, idx)=>{
		if(/^\*\*[^*]+\*\*$/.test(part)){
			return (
				<strong key={`${keyPrefix}_b_${idx}`}>
					{part.substring(2, part.length - 2)}
				</strong>
			);
		}
		return <span key={`${keyPrefix}_t_${idx}`}>{part}</span>;
	});
}

export function renderMeaningContent(tip){
	const normalizedTip = normalizeTip(tip);
	if(!normalizedTip){
		return null;
	}
	const lines = [];
	if(normalizedTip.title){
		lines.push((
			<div key="title" style={{fontSize: 17, lineHeight: '24px', fontWeight: 700, color: 'var(--horosa-text, #1f1f1f)'}}>
				{normalizedTip.title}
			</div>
		));
		lines.push((
			<div key="title_sep" style={{borderTop: '1px solid var(--horosa-border, #d9d9d9)', margin: '6px 0 8px'}} />
		));
	}
	const tipLines = normalizedTip.tips;
	tipLines.forEach((line, idx)=>{
		const oneLine = `${line || ''}`;
		const trimmed = oneLine.trim();
		if(trimmed === '=='){
			lines.push((
				<div key={`sep_${idx}`} style={{borderTop: '1px solid var(--horosa-border, #e8e8e8)', margin: '6px 0'}} />
			));
			return;
		}
		if(trimmed === ''){
			lines.push(<div key={`blank_${idx}`} style={{height: 4}} />);
			return;
		}
		if(isHeadingLine(trimmed)){
			lines.push((
				<div key={`heading_wrap_${idx}`} style={{marginTop: 4, marginBottom: 6}}>
					<div style={{fontSize: 14, lineHeight: '20px', fontWeight: 700, color: 'var(--horosa-text, #262626)'}}>
						{renderInlineBold(stripHeadingText(trimmed), `heading_${idx}`)}
					</div>
					<div style={{borderTop: '1px solid var(--horosa-border, #efefef)', marginTop: 4}} />
				</div>
			));
			return;
		}
		lines.push((
			<div
				key={`line_${idx}`}
				style={{marginBottom: 3, fontSize: 13, lineHeight: '21px', color: 'var(--horosa-text, #262626)', whiteSpace: 'pre-wrap'}}
			>
				{renderInlineBold(oneLine, `line_${idx}`)}
			</div>
		));
	});
	if(lines.length === 0){
		return null;
	}
	return (
		<div
			style={{
				width: 560,
				maxWidth: 'min(560px, calc(100 * var(--horosa-lvw, 1vw) - 28px))',
				maxHeight: 'min(460px, calc(100 * var(--horosa-lvh, 1vh) - 28px))',
				overflowY: 'auto',
				overflowX: 'hidden',
				whiteSpace: 'normal',
				paddingRight: 4,
			}}
		>
			{lines}
		</div>
	);
}

function MeaningPopoverTrigger({ node, content, }){
	const getPopupContainer = useCallback(()=>{
		if(typeof document !== 'undefined' && document.body){
			return document.body;
		}
		return undefined;
	}, []);
	const customPlacement = useMemo(()=>{
		if(isValidElement(node) && node.props && node.props['data-meaning-placement']){
			return node.props['data-meaning-placement'];
		}
		return '';
	}, [node]);
	const triggerNode = useMemo(()=>{
		if(isValidElement(node)){
			return cloneElement(node, {
				style: {
					...(node.props && node.props.style ? node.props.style : {}),
					cursor: 'help',
				},
			});
		}
		return (
			<span
				style={{cursor: 'help'}}
			>
				{node}
			</span>
		);
	}, [node]);

	return (
		<Popover
			trigger="hover"
			placement={customPlacement || 'bottomLeft'}
			arrowPointAtCenter={!!customPlacement}
			mouseEnterDelay={0.08}
			mouseLeaveDelay={0.08}
			autoAdjustOverflow
			overlayStyle={{ maxWidth: 600 }}
			getPopupContainer={getPopupContainer}
			content={content}
		>
			{triggerNode}
		</Popover>
	);
}

export function wrapWithMeaning(node, enabled, tip){
	if(!enabled || !tip){
		return node;
	}
	const content = renderMeaningContent(tip);
	if(!content){
		return node;
	}
	return <MeaningPopoverTrigger node={node} content={content} />;
}
