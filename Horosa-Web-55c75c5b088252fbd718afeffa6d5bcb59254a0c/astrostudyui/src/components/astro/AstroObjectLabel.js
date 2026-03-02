import React from 'react';
import { Tooltip, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { getPlanetAnnotation } from '../../constants/AstroInterpretation';
import { getStore } from '../../utils/storageutil';
import {
	buildPlanetMetaSuffix,
	readPlanetMetaDisplayFromStore,
} from '../../utils/planetMetaDisplay';

function symbolOf(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroMsg[id] !== undefined && AstroText.AstroMsg[id] !== null){
		return `${AstroText.AstroMsg[id]}`;
	}
	return `${id}`;
}

function safeText(v){
	return `${v === undefined || v === null ? '' : v}`.trim();
}

function getAstroObjName(id){
	return safeText(AstroText.AstroMsgCN[id] || AstroText.AstroTxtMsg[id] || AstroText.AstroMsg[id] || id);
}

function isAnnotationEnabled(){
	try{
		const store = getStore();
		if(!store){
			return false;
		}
		let app = store.app;
		if(!app && typeof store.get === 'function'){
			app = store.get('app');
		}
		return !!(app && app.showAstroAnnotation === 1);
	}catch(e){
		return false;
	}
}

function normalizeAnnotation(txt){
	return safeText(txt)
		.replace(/\r\n/g, '\n')
		.replace(/^#+\s*/gm, '')
		.replace(/\*\*/g, '')
		.split('\n')
		.map((line)=>line.trim())
		.filter((line)=>!!line)
		.slice(0, 8)
		.join('\n');
}

function buildLabelTooltipText(id){
	const name = getAstroObjName(id);
	if(!name){
		return '';
	}
	if(!isAnnotationEnabled()){
		return name;
	}
	const annotation = normalizeAnnotation(getPlanetAnnotation(id));
	if(!annotation){
		return name;
	}
	return `${name}\n\n${annotation}`;
}

function AstroObjectLabel(props){
	const id = props.id;
	const chartSources = props.chartSources;
	const display = props.display || readPlanetMetaDisplayFromStore();
	const withMeta = props.withMeta === false ? false : true;
	const suffix = withMeta ? buildPlanetMetaSuffix(chartSources, id, display) : '';
	const disableTooltip = props.disableTooltip === true || props.tooltip === false;
	const tip = buildLabelTooltipText(id);
	const nativeTitleEnabled = props.nativeTitle === undefined ? !disableTooltip : props.nativeTitle === true;
	const nativeTitle = nativeTitleEnabled && tip ? tip : undefined;
	const label = (
		<span className={props.className} style={props.wrapperStyle} title={nativeTitle}>
			<span style={{
				fontFamily: AstroConst.AstroFont,
				...(props.symbolStyle || {}),
			}}>
				{symbolOf(id)}
			</span>
			{
				suffix ? (
					<span style={{
						fontFamily: AstroConst.NormalFont,
						...(props.metaStyle || {}),
					}}>
						{suffix}
					</span>
				) : null
			}
		</span>
	);

	if(disableTooltip || !tip){
		return label;
	}
	return (
		<Tooltip
			title={<div style={{ whiteSpace: 'pre-wrap' }}>{tip}</div>}
			placement="top"
			overlayStyle={{ maxWidth: 520 }}
			overlayInnerStyle={{
				background: '#ffffff',
				color: '#111827',
				border: '1px solid #dbe5f1',
				borderRadius: 8,
				boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)',
				padding: '8px 10px',
			}}
			getPopupContainer={()=>(document.body)}
		>
			<span style={{ cursor: 'help' }}>{label}</span>
		</Tooltip>
	);
}

export default AstroObjectLabel;
