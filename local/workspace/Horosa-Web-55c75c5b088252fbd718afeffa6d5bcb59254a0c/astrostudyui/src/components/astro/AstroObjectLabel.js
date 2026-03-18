import React from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { getPlanetAnnotation } from '../../constants/AstroInterpretation';
import { getStore } from '../../utils/storageutil';
import {
	buildPlanetMetaSuffix,
	readPlanetMetaDisplayFromStore,
} from '../../utils/planetMetaDisplay';
import { buildMeaningTipByCategory } from './AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning } from './AstroMeaningPopover';

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

function resolveMeaningCategory(id, explicitCategory){
	const raw = safeText(id);
	const forced = safeText(explicitCategory).toLowerCase();
	if(forced){
		return forced;
	}
	if(AstroConst.LIST_SIGNS.indexOf(raw) >= 0){
		return 'sign';
	}
	if(AstroConst.LIST_HOUSES.indexOf(raw) >= 0){
		return 'house';
	}
	if(AstroConst.LOTS.indexOf(raw) >= 0){
		return 'lot';
	}
	if(AstroConst.LIST_ASP.indexOf(raw) >= 0 || /^Asp\d+$/.test(raw)){
		return 'aspect';
	}
	return 'planet';
}

function buildMeaningTip(id, explicitCategory){
	return buildMeaningTipByCategory(resolveMeaningCategory(id, explicitCategory), id);
}

function AstroObjectLabel(props){
	const id = props.id;
	const chartSources = props.chartSources;
	const display = props.display || readPlanetMetaDisplayFromStore();
	const withMeta = props.withMeta === false ? false : true;
	const suffix = withMeta ? buildPlanetMetaSuffix(chartSources, id, display) : '';
	const disableTooltip = props.disableTooltip === true || props.tooltip === false;
	const tip = buildLabelTooltipText(id);
	const meaningTip = disableTooltip ? null : buildMeaningTip(id, props.meaningCategory || props.category);
	const useMeaningPopup = !disableTooltip && !!meaningTip && isMeaningEnabled(props.meaningEnabled);
	const nativeTitleEnabled = props.nativeTitle === undefined ? !disableTooltip : props.nativeTitle === true;
	const nativeTitle = !useMeaningPopup && nativeTitleEnabled && tip ? tip : undefined;
	const labelNode = (
		<span
			className={props.className}
			style={{
				cursor: disableTooltip || !tip ? undefined : 'help',
				...(props.wrapperStyle || {}),
			}}
			title={nativeTitle}
		>
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
	return wrapWithMeaning(labelNode, useMeaningPopup, meaningTip);
}

export default AstroObjectLabel;
