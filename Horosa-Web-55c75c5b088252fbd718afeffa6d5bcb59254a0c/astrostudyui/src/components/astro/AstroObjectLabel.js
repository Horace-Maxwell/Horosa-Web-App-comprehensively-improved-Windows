import React from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
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

function AstroObjectLabel(props){
	const id = props.id;
	const chartSources = props.chartSources;
	const display = props.display || readPlanetMetaDisplayFromStore();
	const withMeta = props.withMeta === false ? false : true;
	const suffix = withMeta ? buildPlanetMetaSuffix(chartSources, id, display) : '';

	return (
		<span className={props.className} style={props.wrapperStyle}>
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
}

export default AstroObjectLabel;
