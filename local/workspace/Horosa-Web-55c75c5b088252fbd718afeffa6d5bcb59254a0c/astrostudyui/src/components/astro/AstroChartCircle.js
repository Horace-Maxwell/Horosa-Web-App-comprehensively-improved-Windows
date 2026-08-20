import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import {splitDegree, whichTerm, convertLatToStr, convertLonToStr, getDignityText, getObjectsText, getObject} from './AstroHelper';
import {randomStr, detectOS, distanceInCircleAbs, creatTooltip, setupFloatingTooltip} from '../../utils/helper';
import {drawTextV, drawTextH} from '../graph/GraphHelper';
import { appendAstroMeaningTips, buildSignMeaningTip, buildAspectMeaningTip } from './AstroMeaningData';
import { getChartRendererClass } from '../../renderers/xqChartTheme';
import { termsTableForVariant } from '../../divination/data/hellenisticData';

const RETROGRADE_SYMBOL_COLOR = '#8f2d2d';
const PLANET_MINUTE_TEXT_COLOR = '#80786e';
const DARK_SIGN_FILL_OPACITY = 0.18;
const DARK_HOUSE_FILL_OPACITY = 0.36;
const KEY_HOUSE_FILL_OPACITY = 0.18;
const NON_KEY_HOUSE_MASK_OPACITY = 0.08;

const ZODIACAL_LABELS = {
	0: '回归黄道',
	1: '恒星黄道',
	'0': '回归黄道',
	'1': '恒星黄道',
	[AstroConst.TROPICAL]: '回归黄道',
	[AstroConst.SIDEREAL]: '恒星黄道',
};

function resolveChartCircleZodiacal(value, ayanKey){
	if(value === undefined || value === null || value === ''){
		return null;
	}
	// 恒星黄道:拼上具体 ayanāṃśa(恒星黄道·Raman),复用统一口径;无具体岁差则退「恒星黄道」。
	const isSid = value === AstroConst.SIDEREAL || `${value}` === '1' || value === '恒星黄道';
	if(isSid){
		return AstroConst.zodiacalDisplayText(AstroConst.SIDEREAL, ayanKey);
	}
	return ZODIACAL_LABELS[value] || AstroText.AstroMsg[value] || AstroText.AstroTxtMsg[value] || `${value}`;
}

function resolveChartCircleHouseSystem(value){
	if(value === undefined || value === null || value === ''){
		return null;
	}
	return AstroConst.HouseSys[`${value}`] || AstroText.AstroMsg[value] || `${value}`;
}

export function resolveChartCircleDisplayMode(params = {}){
	return {
		zodiacal: resolveChartCircleZodiacal(params.zodiacal, params.siderealAyanamsa),
		hsys: resolveChartCircleHouseSystem(params.hsys),
	};
}

function buildChartCircleDisplayModeText(params = {}){
	const display = resolveChartCircleDisplayMode(params);
	return [display.zodiacal, display.hsys].filter(Boolean).join('，');
}

function isTransparentFill(fill){
	return fill === undefined || fill === null || `${fill}`.toLowerCase() === 'transparent';
}

function getColorLuminance(fill){
	const color = d3.color(fill);
	if(!color){
		return 255;
	}
	return (0.2126 * color.r) + (0.7152 * color.g) + (0.0722 * color.b);
}

function isDarkChartTheme(){
	return getColorLuminance(AstroConst.AstroColor.ChartBackgroud) < 80;
}

function getChartLayerFillOpacity(fill, darkOpacity){
	if(isTransparentFill(fill)){
		return 1;
	}
	return isDarkChartTheme() ? darkOpacity : 1;
}

const ChartStyleProfiles = {
	[AstroConst.CHART_STYLE_CURRENT]: {
		outerMode: 'cusp',
		starScale: 1.04,
		innerHouseScale: 1,
		forceFlags: 0,
		clearFlags: 0,
	},
	[AstroConst.CHART_STYLE_ORIGINAL]: {
		outerMode: 'zodiac',
		starScale: 1.04,
		innerHouseScale: 1,
		forceFlags: 0,
		clearFlags: 0,
	},
};


export default class AstroChartCircle {
	constructor(option){
		this.ChartMargin = 20;
		this.ChartMarginDelta = 55;
		this.ChartMoveUp = 10;
		this.TxtOffsetTop = 0;
		this.rThreshold = 100;
		this.osFlag = detectOS();
		if(this.osFlag === 'Mac'){
			this.TxtOffsetTop = 2;
		}

		this.divTooltip = option.divTooltip;
		this.onTipClick = option.onTipClick;
		this.showAstroMeaning = option.showAstroMeaning ? true : false;
		this.chartStyle = AstroConst.CHART_STYLE_CURRENT;

		this.setupToolTip();
	}

	setChartStyle(style){
		this.chartStyle = AstroConst.normalizeChartStyle(style);
	}

	getChartStyleProfile(){
		return ChartStyleProfiles[this.chartStyle] || ChartStyleProfiles[AstroConst.CHART_STYLE_CURRENT];
	}

	applyChartStyleFlags(flags){
		const profile = this.getChartStyleProfile();
		const nextFlags = flags | (profile.forceFlags || 0);
		return nextFlags & ~(profile.clearFlags || 0);
	}

	// 卜卦判读叠层(二期):独立 SVG 层描述对象(components/horary/horaryOverlayData.js 构建)。
	// null(默认/占星页恒 null) → drawHoraryOverlay 整段短路,渲染路径与现状逐字节一致。
	setHoraryOverlay(overlay){
		this.horaryOverlay = overlay || null;
	}

	setShowAstroMeaning(flag){
		this.showAstroMeaning = flag ? true : false;
	}

	// 黄道星释点运高亮:主座 id(如 'Leo'),空则清除。座扇区绘制时据此叠主座(色A)+ 第4/7/10座(色B)。
	setZRHighlight(sign){
		this.zrHlSign = sign || null;
	}

	setupToolTip(){
		if(this.divTooltip){
			setupFloatingTooltip(this.divTooltip, {
				'max-width': 'min(560px, calc(100vw - 28px))',
				'max-height': 'min(460px, calc(100vh - 28px))',
				padding: '14px 16px',
				font: '14px/1.6 "PingFang SC", "Microsoft YaHei", sans-serif',
				'box-shadow': '0 8px 24px rgba(0,0,0,0.14)',
			});
		}
	}

	solidifyText(root){
		root.selectAll('text').each(function(){
			let text = d3.select(this);
			let fill = text.attr('fill');
			let stroke = text.attr('stroke');
			if(!fill || fill === 'none'){
				fill = stroke && stroke !== 'none' ? stroke : AstroConst.AstroColor.Stroke;
			}
			text.attr('fill', fill)
				.attr('stroke', 'none')
				.attr('stroke-width', 0)
				.attr('paint-order', 'fill')
				.style('-webkit-text-stroke', '0px transparent');
		});
	}
	
	genTooltipObj(infoObj, name){
		if(this.divTooltip === undefined || this.divTooltip === null){
			return {};
		}

		let lbl = name;
		if(lbl === undefined || lbl === null){
			if(infoObj.name){
				lbl = infoObj.name;
				if(infoObj.wuxing){
					lbl = lbl + infoObj.wuxing
				}
				if(infoObj.animal){
					lbl = lbl + ', ' + infoObj.name + infoObj.animal;
				}
			}else{
				lbl = AstroText.AstroMsgCN[infoObj.id] ? AstroText.AstroMsgCN[infoObj.id] : infoObj.id;
				if(lbl === undefined || lbl === null){
					lbl = '';
				}
			}
		}

		if(infoObj.type && (infoObj.type === 'Planet' || infoObj.type === 'Generic' || infoObj.type === 'GenericCN')){
			let sigdeg = infoObj.lon / 30;
			let sigidx = Math.floor(sigdeg);
			let sigdegs = splitDegree(infoObj.lon - sigidx*30);
			let sig = AstroConst.LIST_SIGNS[sigidx];
			let zi = AstroText.AstroMsgCN[sig];
			let degstr = zi + sigdegs[0] + 'º' + sigdegs[1] + "'";
			lbl = lbl + '：' + degstr;
		}

		let degs = splitDegree(infoObj.lon);
		let tipobj = {
			title: lbl,
			tips: ['黄经：' +  degs[0] + 'º' + degs[1] + "'； " + Math.round(infoObj.lon*10000)/10000+ 'º'],
		};
		if(this.showAstroMeaning){
			if(infoObj && infoObj.type && (infoObj.type === 'Planet' || infoObj.type === 'Generic' || infoObj.type === 'GenericCN')){
				tipobj = appendAstroMeaningTips(tipobj, 'planet', infoObj.id);
			}else if(infoObj && infoObj.id && infoObj.id.indexOf('House') === 0){
				tipobj = appendAstroMeaningTips(tipobj, 'house', infoObj.id);
			}
		}

		return tipobj;
	}

	genTooltip(titleSvg, infoObj){
		let tipobj = this.genTooltipObj(infoObj, null);		
		creatTooltip(this.divTooltip, titleSvg, tipobj, this.onTipClick, true);
	}

	genSignMeaningTooltip(titleSvg, signKey){
		if(!this.showAstroMeaning || !titleSvg || !signKey){
			return;
		}
		const signTip = buildSignMeaningTip(signKey);
		if(!signTip){
			return;
		}
		creatTooltip(this.divTooltip, titleSvg, signTip, this.onTipClick, true, true, {
			stopPropagation: true,
			useMouseEnterLeave: true,
		});
	}


	getHouse(chartObj, houseid){
		if(chartObj === undefined || chartObj === null || chartObj.err){
			return null;
		}
		if(chartObj.houseMap){
			return chartObj.houseMap[houseid];
		}
		chartObj.houseMap = {};
		for(let i=0; i<chartObj.chart.houses.length; i++ ){
			let house = chartObj.chart.houses[i];
			chartObj.houseMap[house.id] = house;
		}
		return chartObj.houseMap[houseid];
	}
	
	getStars(chartObj, objid){
		if(chartObj === undefined || chartObj === null || chartObj.err){
			return null;
		}
		if(chartObj.starMap){
			return chartObj.starMap[objid];
		}
		chartObj.starMap = {};
		for(let i = 0; i<chartObj.chart.stars.length; i++){
			let star = chartObj.chart.stars[i];
			chartObj.starMap[star.id] = star.stars
		}
		return chartObj.starMap[objid];
	}
	
	getObject(chartObj, objid){
		if(chartObj === undefined || chartObj === null || chartObj.err){
			return null;
		}
		if(chartObj.objectMap){
			return chartObj.objectMap[objid];
		}
		chartObj.objectMap = {};
		for(let i=0; i<chartObj.chart.objects.length; i++ ){
			let obj = chartObj.chart.objects[i];
			chartObj.objectMap[obj.id] = obj;
		}
		if(chartObj.lots){
			for(let i=0; i<chartObj.lots.length; i++ ){
				let obj = chartObj.lots[i];
				chartObj.objectMap[obj.id] = obj;
			}	
		}
		return chartObj.objectMap[objid];
	}
	
	getSu28(chartObj, suname){
		if(chartObj === undefined || chartObj === null || chartObj.err){
			return null;
		}
		if(chartObj.su28Map){
			return chartObj.su28Map[suname];
		}
		chartObj.su28Map = {};
		for(let i=0; i<chartObj.chart.fixedStarSu28.length; i++ ){
			let obj = chartObj.chart.fixedStarSu28[i];
			chartObj.su28Map[obj.name] = obj;
		}
		return chartObj.su28Map[suname];
	}
	
	getSu28Text(chartObj, planet){
		if(chartObj === undefined || chartObj === null || chartObj.err){
			return null;
		}
		let suname = planet.su28;
		let su = this.getSu28(chartObj, suname);
		if(su === undefined || su === null){
			return [];
		}
		let radeg = (planet.ra - su.ra + 360) % 360;
		let degs = splitDegree(radeg);
		let startxt = [];
		startxt[0] = '';
		startxt[1] = degs[0] + 'º';
		startxt[2] = planet.su28;
		startxt[3] = degs[1] + "'";	
		return startxt;
	}
	
	getSuHouse(chartObj, suid){
		if(chartObj === undefined || chartObj === null || chartObj.err){
			return null;
		}
		if(chartObj.suHouseMap){
			return chartObj.suHouseMap[suid];
		}
		chartObj.suHouseMap = {};
		for(let i=0; i<chartObj.guoStarSect.houses.length; i++ ){
			let house = chartObj.guoStarSect.houses[i];
			chartObj.suHouseMap[house.id] = house;
		}
		return chartObj.suHouseMap[suid];
	
	}
	
	
	signsBand(svg, r, rStep, flags, isDiurnal, house1Ang){
		let txtforward = (flags & AstroConst.CHART_TXTPLANETFORWARD) === 0 ? false : true;
		let samecolorwithsign = (flags & AstroConst.CHART_PLANETCOLORWITHSIGN) === 0 ? false : true;
		let needTrip = (flags & AstroConst.CHART_TRIP) === 0 ? false : true;
		let needRuler = (flags & AstroConst.CHART_SIGNRULER) === 0 ? false : true;
		let innerR = r - rStep;
		let txtPosR = r - rStep / 2 - this.TxtOffsetTop;
	
		let signs = svg.append('g');
		const signStep = 30 * Math.PI / 180;
		for(let i=0; i<12; i++){
			let ang = 30 * i;
			let a = signStep * i;
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -a,
				endAngle: -(a + signStep),
			});
			let sig = AstroConst.LIST_SIGNS[i];
			let siggroup = signs.append('g');
			const signFill = AstroConst.AstroColor.SignFill[sig];
			siggroup.append('path')
				.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
				.attr('fill', signFill)
				.attr('fill-opacity', getChartLayerFillOpacity(signFill, DARK_SIGN_FILL_OPACITY));

			// 黄道星释「点运高亮」:主座(本运)色A、以其为基准的第4/7/10座色B,叠在座扇区上(additive,不改原绘制)。
			if(this.zrHlSign){
				const pIdx = AstroConst.LIST_SIGNS.indexOf(this.zrHlSign);
				if(pIdx >= 0){
					const isP = i === pIdx;
					const isS = !isP && (i === (pIdx + 3) % 12 || i === (pIdx + 6) % 12 || i === (pIdx + 9) % 12);
					if(isP || isS){
						siggroup.append('path')
							.attr('d', arcd)
							.attr('fill', isP ? 'var(--horosa-accent, #d7ad69)' : 'var(--horosa-direction-level-2, #c72d22)')
							.attr('fill-opacity', isP ? 0.26 : 0.13)
							.attr('stroke', isP ? 'var(--horosa-accent, #d7ad69)' : 'var(--horosa-direction-level-2, #c72d22)')
							.attr('stroke-width', isP ? 2.4 : 1.6)
							.attr('pointer-events', 'none');
					}
				}
			}
	
			let lblgroup = siggroup.append('g').attr("text-anchor", "middle");
			let txts = [
				AstroConst.SignsProp[sig].Ruler,
				sig
			];
			if(AstroConst.SignsProp[sig].Exalt){
				txts.push(AstroConst.SignsProp[sig].Exalt);
			}
			if(needRuler === false){
				txts = [sig];
			}
			if(needTrip){
				txts.push('三');
				if(isDiurnal){
					txts.push(AstroConst.SignsProp[sig].Trip[0]);
					txts.push(AstroConst.SignsProp[sig].Trip[1]);
				}else{
					txts.push(AstroConst.SignsProp[sig].Trip[1]);
					txts.push(AstroConst.SignsProp[sig].Trip[0]);
				}
				txts.push(AstroConst.SignsProp[sig].Trip[2]);
			}
			lblgroup.selectAll('text').data(txts).enter().append('text')
				.attr("dominant-baseline","central")
				.attr("text-anchor", "middle")
				.attr('font-family', AstroConst.AstroChartFont)
				.attr('font-size', function(d, idx){
					if(d === sig){
						return 24;
					}
					return 12;
				})
				.attr('stroke', function(d, idx){
					if(samecolorwithsign){
						return AstroConst.AstroColor[sig]
					}else{
						return AstroConst.AstroColor[d]
					}
				})
				.attr('transform', function(d, idx){
					let posx = 0;
					let posy = 0;
					let tripidx = txts.indexOf('三');
					let angle = ang + 15;
					if(tripidx > 0){
						angle = angle + 5
					}
					let rad = angle * Math.PI / 180;
					let sigidx = txts.indexOf(sig);
					if(idx === sigidx){
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}else{
						let deltaIdx = sigidx - idx;
						if(tripidx > 0 && idx >= tripidx){
							angle = angle - 2 + deltaIdx*3;
						}else{
							angle = angle + deltaIdx*4;
						}
						rad = angle * Math.PI / 180;
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}
					let rotang = -angle;
					if(house1Ang !== undefined && house1Ang !== null && txtforward){
						rotang = 90 - house1Ang;
					}
					let trans = 'translate(' + posx + ', ' + posy + ') rotate(' + rotang + ')';
					return trans;	
				})
				.text(function(d){return AstroText.AstroMsg[d]});

			if(this.showAstroMeaning){
				const signTip = buildSignMeaningTip(sig);
				if(signTip){
					creatTooltip(this.divTooltip, siggroup, signTip, this.onTipClick, true);
				}
			}
		}
		
		return signs;
	}

	houseCuspBand(svg, r, rStep, houses, flags, house1Ang){
		let showCuspText = (flags & AstroConst.CHART_HOUSEDEGREE) === AstroConst.CHART_HOUSEDEGREE;
		let innerR = r - rStep;
		let txtPosR = r - rStep / 2 - this.TxtOffsetTop;
		const textAngle = house1Ang !== undefined && house1Ang !== null ? 90 - house1Ang : 0;
		let band = svg.append('g');

		band.append('circle')
			.attr('r', r)
			.attr('fill', 'none')
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('stroke-width', 1.35);
		band.append('circle')
			.attr('r', innerR)
			.attr('fill', 'none')
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('stroke-width', 1.1);

		for(let i=0; i<houses.length; i++){
			let house = houses[i];
			let lonrad = house.lon * Math.PI / 180;
			const appendCuspLine = (outerRadius, innerRadius) => {
				if(outerRadius <= innerRadius){
					return;
				}
				let x1 = -outerRadius * Math.sin(lonrad);
				let y1 = -outerRadius * Math.cos(lonrad);
				let x2 = -innerRadius * Math.sin(lonrad);
				let y2 = -innerRadius * Math.cos(lonrad);
				band.append('line')
					.attr('x1', x1)
					.attr('y1', y1)
					.attr('x2', x2)
					.attr('y2', y2)
					.attr('stroke', AstroConst.AstroColor.Stroke)
					.attr('stroke-width', 1);
			};
			if(!showCuspText){
				appendCuspLine(r, innerR);
			}

			if(!showCuspText){
				continue;
			}

			let sig = house.sign;
			let angleparts = splitDegree(house.signlon);
			let txts = [angleparts[0] + 'º', AstroText.AstroMsg[sig], angleparts[1] + "'"];
			let lblgroup = band.append('g').attr("text-anchor", "middle");
			const cuspTexts = lblgroup.selectAll('text').data(txts).enter().append('text')
				.attr("dominant-baseline","central")
				.attr("text-anchor", "middle")
				.attr('font-size', function(d, idx){
					if(idx === 1){
						return 24;
					}
					if(idx === 2){
						return 11;
					}
					return 15;
				})
				.attr('stroke', function(d, idx){
					if(idx === 1){
						return AstroConst.AstroColor[sig];
					}
					if(idx === 2){
						return PLANET_MINUTE_TEXT_COLOR;
					}
					return AstroConst.AstroColor.Stroke;
				})
				.attr('fill', function(d, idx){
					return idx === 2 ? PLANET_MINUTE_TEXT_COLOR : null;
				})
				.attr('font-family', function(d,idx){
					if(idx === 1){
						return AstroConst.AstroChartFont;
					}
					return AstroConst.NormalFont;
				})
				.attr('font-weight', function(d, idx){
					if(idx === 1){
						return 400;
					}
					if(idx === 2){
						return 340;
					}
					return 600;
				})
				.attr('transform', function(d, idx){
					let centeridx = 1;
					let ang = house.lon;
					if(idx !== centeridx){
						let deltaIdx = centeridx - idx;
						ang = ang + deltaIdx * 3.6;
					}
					let rad = ang * Math.PI / 180;
					let x = -txtPosR * Math.sin(rad);
					let y = -txtPosR * Math.cos(rad);
					return 'translate(' + x + ', ' + y + ') rotate(' + textAngle + ')';
				})
				.text(function(d){return d});
			this.genSignMeaningTooltip(cuspTexts.filter((d, idx)=>idx === 1), sig);
		}

		return band;
	}

	resolveTermHighlightColor(sig, termOwner, matchedHighlight){
		let owner = matchedHighlight && matchedHighlight.owner ? matchedHighlight.owner : termOwner;
		let ownerColor = AstroConst.AstroColor[owner];
		if(ownerColor && ownerColor !== AstroConst.AstroColor.Stroke){
			return ownerColor;
		}
		return AstroConst.AstroColor[sig] || ownerColor || AstroConst.AstroColor.Stroke;
	}

	appendTermHighlightMarker(termgroup, sigstart, degree, innerR, outerR, accentColor){
		let normalizedDegree = Number(degree);
		if(!Number.isFinite(normalizedDegree)){
			return;
		}
		let angle = (sigstart + normalizedDegree) * Math.PI / 180;
		let markerStartR = innerR + 1.5;
		let markerEndR = outerR - 1.5;
		let startX = -markerStartR * Math.sin(angle);
		let startY = -markerStartR * Math.cos(angle);
		let endX = -markerEndR * Math.sin(angle);
		let endY = -markerEndR * Math.cos(angle);
		let markerDotR = outerR - 4.5;
		let dotX = -markerDotR * Math.sin(angle);
		let dotY = -markerDotR * Math.cos(angle);
		let markerStroke = accentColor || AstroConst.AstroColor.Stroke;
		let markerFill = d3.color(markerStroke);
		if(markerFill){
			markerFill.opacity = 0.92;
		}
		termgroup.append('line')
			.attr('x1', startX)
			.attr('y1', startY)
			.attr('x2', endX)
			.attr('y2', endY)
			.attr('stroke', markerStroke)
			.attr('stroke-width', 2.5)
			.attr('stroke-linecap', 'round')
			.attr('opacity', 0.96);
		termgroup.append('circle')
			.attr('cx', dotX)
			.attr('cy', dotY)
			.attr('r', 4.5)
			.attr('stroke', 'var(--horosa-surface-solid, #ffffff)')
			.attr('stroke-width', 1.4)
			.attr('fill', markerFill ? `${markerFill}` : markerStroke);
	}
	
	termBand(svg, r, rStep, flags, termHighlight, termsTable){
		let samecolorwithsign = (flags & AstroConst.CHART_PLANETCOLORWITHSIGN) === 0 ? false : true;
		let innerR = r - rStep;
		let txtPosR = r - rStep / 2 - this.TxtOffsetTop;
		let highlights = [];
		if(Array.isArray(termHighlight)){
			highlights = termHighlight.filter(Boolean);
		}else if(termHighlight){
			highlights = [termHighlight];
		}
	
		let terms = svg.append('g');
		const signStep = 30;
		for(let i=0; i<12; i++){
			let sig = AstroConst.LIST_SIGNS[i];
			let sigterm = (termsTable || AstroConst.EGYPTIAN_TERMS)[sig];
			let sigstart = signStep * i;
			for(let j=0; j<sigterm.length; j++){
				let term = sigterm[j];	
				let delta = term[2] - term[1];
				let stangle = (sigstart + term[1]) * Math.PI / 180;
				let edangle = delta * Math.PI / 180;		
				let arc = d3.arc()	
							.innerRadius(innerR).outerRadius(r)
							.startAngle(-stangle).endAngle(-(stangle + edangle));
				let arcd = arc();
				let matchedHighlight = null;
				for(let k=0; k<highlights.length; k++){
					let item = highlights[k];
					if(!item || item.sign !== sig){
						continue;
					}
					let sameRange = Number.isFinite(Number(item.start)) && Number.isFinite(Number(item.end))
						? Math.abs(Number(item.start) - term[1]) < 1e-9 && Math.abs(Number(item.end) - term[2]) < 1e-9
						: false;
					if(sameRange){
						matchedHighlight = item;
						break;
					}
					let degree = Number(item.degree);
					if(Number.isFinite(degree) && term[1] <= degree && degree < term[2]){
						matchedHighlight = item;
						break;
					}
				}
				let strokeColor = AstroConst.AstroColor.Stroke;
				let fillColor = AstroConst.AstroColor['NoColor'];
				let labelColor = samecolorwithsign ? AstroConst.AstroColor[sig] : AstroConst.AstroColor[term[0]];
				let fontWeight = 400;
				let fontSize = 13;
				let accentColor = null;
				if(matchedHighlight){
					accentColor = this.resolveTermHighlightColor(sig, term[0], matchedHighlight);
					let fill = d3.color(accentColor);
					if(fill){
						fill.opacity = 0.26;
						fillColor = `${fill}`;
					}
					strokeColor = accentColor;
					labelColor = accentColor;
					fontWeight = 700;
					fontSize = 15;
				}
				let termgroup = terms.append('g')
					.attr('class', matchedHighlight ? 'astro-term astro-term-highlight' : 'astro-term')
					.attr('data-term-sign', sig)
					.attr('data-term-owner', term[0]);
				if(matchedHighlight){
					termgroup
						.attr('data-highlight-marker', matchedHighlight.markerId || matchedHighlight.markerLabel || 'term')
						.attr('data-highlight-owner', matchedHighlight.owner || term[0]);
				}
				termgroup.append('path')
					.attr('d', arcd)
					.attr('stroke', strokeColor)
					.attr('stroke-width', matchedHighlight ? 2.25 : 1)
					.attr('fill', fillColor);
				if(matchedHighlight){
					let overlayFill = d3.color(accentColor);
					if(overlayFill){
						overlayFill.opacity = 0.12;
					}
					let overlayArc = d3.arc()
						.innerRadius(innerR + 1.5)
						.outerRadius(r - 1.5)
						.startAngle(-stangle)
						.endAngle(-(stangle + edangle));
					termgroup.append('path')
						.attr('d', overlayArc())
						.attr('fill', overlayFill ? `${overlayFill}` : AstroConst.AstroColor['NoColor'])
						.attr('stroke', accentColor)
						.attr('stroke-width', 3.5)
						.attr('stroke-linejoin', 'round')
						.attr('fill-opacity', 1);
					this.appendTermHighlightMarker(termgroup, sigstart, matchedHighlight.degree, innerR, r, accentColor);
				}
	
				let demiStep = (delta / 2) * Math.PI / 180;
				let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
				let posx = -txtPosR * Math.sin(stangle + demiStep);
				let posy = -txtPosR * Math.cos(stangle + demiStep);
				let transtr = 'translate(' + posx + ',' + posy +  ')';
				lblgroup.attr('transform', transtr);
				let termtxt = AstroText.AstroMsg[term[0]];
				let lbl = lblgroup.append('text')
						.attr("dominant-baseline","central")
						.attr("text-anchor", "middle")
						.attr('font-family', AstroConst.AstroChartFont)
						.attr('font-size', fontSize).attr('font-weight', fontWeight).attr('stroke', labelColor)
						.text(termtxt);
				// 旋转角对齐界段「中点」(平移就在 stangle+demiStep):原 term[1]+delta 是段尾,
				// 每个界字按半段宽歪斜(埃及界最宽 12° → 歪 6°);邻band(su27/houses)都用中点口径。
				let txtang = -(term[1] + delta/2) - 30*i;
				let txtrot = 'rotate(' + txtang + ')';
				lbl.attr('transform', txtrot);
			}
	
		}
	
		return terms;
	}
	
	su27Band(svg, r, rStep){
		let innerR = r - rStep;
		let txtPosR = r - rStep / 2;
	
		let terms = svg.append('g');
		for(let i=0; i<AstroConst.LIST_SU.length; i++){
			let sig = AstroConst.LIST_SU[i];
			let term = AstroConst.SU27[sig];
			let delta = term['size'];
			let stangle = term['lon'] * Math.PI / 180;
			let edangle = delta * Math.PI / 180;		
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -stangle,
				endAngle: -(stangle + edangle)
			});
			let termgroup = terms.append('g');
			termgroup.append('path')
				.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
				.attr('fill', AstroConst.AstroColor['NoColor']);
	
			let demiStep = (delta / 2) * Math.PI / 180;
			let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
			let posx = -txtPosR * Math.sin(stangle + demiStep);
			let posy = -txtPosR * Math.cos(stangle + demiStep);
			let transtr = 'translate(' + posx + ',' + posy +  ')';
			lblgroup.attr('transform', transtr);
			let termtxt = sig;
			let lbl = lblgroup.append('text')
					.attr("dominant-baseline","central")
					.attr('stroke', AstroConst.AstroColor.Stroke)
					.attr("text-anchor", "middle")
					.attr('font-size', 16).attr('font-weight', 100)
					.text(termtxt);
			let txtang = -(term['lon'] + delta/2);
			let txtrot = 'rotate(' + txtang + ')';
			lbl.attr('transform', txtrot);		
	
		}
	
		return terms;
	}
	
	suRelationBand(svg, r, lifeSu, rStep){
		let startIdx = AstroConst.LIST_SU.indexOf(lifeSu);
		if(startIdx < 0){
			return null;
		}
		
		let innerR = r - rStep;
		let txtPosR = r - rStep / 2;
	
		let terms = svg.append('g');
		for(let i=0; i<AstroConst.LIST_SU_RELATION.length; i++){
			let idx = (startIdx + i) % AstroConst.LIST_SU.length;
			let surelation = AstroConst.LIST_SU_RELATION[i];
			let sig = AstroConst.LIST_SU[idx];
			let term = AstroConst.SU27[sig];
			let delta = term['size'];
			let stangle = term['lon'] * Math.PI / 180;
			let edangle = delta * Math.PI / 180;		
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -stangle,
				endAngle: -(stangle + edangle)
			});
			let fillColor = AstroConst.AstroColor['NoColor'];
			if(i % 9 === 0){
				fillColor = AstroConst.AstroColor[surelation];
			}
			let termgroup = terms.append('g');
			termgroup.append('path')
				.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
				.attr('fill', fillColor);
	
			let demiStep = (delta / 2) * Math.PI / 180;
			let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
			let posx = -txtPosR * Math.sin(stangle + demiStep);
			let posy = -txtPosR * Math.cos(stangle + demiStep);
			let transtr = 'translate(' + posx + ',' + posy +  ')';
			lblgroup.attr('transform', transtr);
			let termtxt = surelation;
			let lbl = lblgroup.append('text')
					.attr("dominant-baseline","central")
					.attr('stroke', AstroConst.AstroColor.Stroke)
					.attr("text-anchor", "middle")
					.attr('font-size', 16).attr('font-weight', 100)
					.text(termtxt);
			let txtang = -(term['lon'] + delta/2);
			let txtrot = 'rotate(' + txtang + ')';
			lbl.attr('transform', txtrot);		
	
		}
	
		return terms;
	}
	
	suSixhouses(svg, r, rStep, chartObj){
		let innerR = r - rStep;
		let txtPosR = r - 10;
	
		let angstep = 360.0 / AstroConst.LIST_SU.length;
		let terms = svg.append('g');
		for(let i=0; i<AstroConst.LIST_SU.length; i++){
			let ang = angstep * i;
			let sig = AstroConst.LIST_SU[i];
			let suObj = this.getSuHouse(chartObj, sig);
			let term = AstroConst.SU27[sig];
			let delta = term['size'];
			let stangle = term['lon'] * Math.PI / 180;
			let edangle = delta * Math.PI / 180;		
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -stangle,
				endAngle: -(stangle + edangle)
			});
			let termgroup = terms.append('g');
			let path = termgroup.append('path').attr('d', arcd);
			if(suObj.sixhouse){
				let fillcolor = AstroConst.AstroColor[suObj.sixhouse];
				if(fillcolor === undefined || fillcolor === null){
					fillcolor = AstroConst.AstroColor['SixHouses'];
				}
				path.attr('stroke', AstroConst.AstroColor.Stroke).attr('fill', fillcolor);
			}else{
				path.attr('stroke', AstroConst.AstroColor.Stroke).attr('fill', AstroConst.AstroColor['NoColor'])
			}
	
			let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
			let termtxt = suObj.category;
			let txts = termtxt.split('');
			if(suObj.sixhouse){
				txts.push('(' + suObj.sixhouse + ')');
			}
			let lbl = lblgroup.selectAll('text').data(txts).enter().append('text')
					.attr("dominant-baseline","central")
					.attr('stroke', AstroConst.AstroColor.Stroke)
					.attr("text-anchor", "middle")
					.attr('font-size', 11).attr('font-weight', 100)
					.attr('transform', function(d, idx){
						let posx = 0;
						let posy = 0;
						let angle = ang + angstep / 2.0 - 2;
						let rad = angle * Math.PI / 180;
						let centeridx = txts.length / 2;
						if(idx === centeridx){
							posx = -txtPosR * Math.sin(rad);
							posy = -txtPosR * Math.cos(rad);
						}else{
							let deltaIdx = centeridx - idx;
							angle = angle + deltaIdx*4;
							rad = angle * Math.PI / 180;
							posx = -txtPosR * Math.sin(rad);
							posy = -txtPosR * Math.cos(rad);
						}
						let rotang = -angle;
						let trans = 'translate(' + posx + ', ' + posy + ') rotate(' + rotang + ')';
						return trans;	
					})
					.text(function(d){return d});
	
		}
	
		return terms;
	
	}
	
	degreeOuterLines(svg, r){
		let long = r + 9;
		let medium = r + 6;
		let short = r + 3;
		let lines = svg.append('g');
		for(let i=0; i<360; i++){
			let x1 = r * Math.sin(-i * Math.PI / 180);
			let y1 = r * Math.cos(-i * Math.PI / 180);
			let x2 = 0;
			let y2 = 0;
			if(i % 10 === 0){
				x2 = long * Math.sin(-i * Math.PI / 180);
				y2 = long * Math.cos(-i * Math.PI / 180);
			}else if(i % 5 === 0){
				x2 = medium * Math.sin(-i * Math.PI / 180);
				y2 = medium * Math.cos(-i * Math.PI / 180);
			}else{
				x2 = short * Math.sin(-i * Math.PI / 180);
				y2 = short * Math.cos(-i * Math.PI / 180);
			}
			let line = lines.append('line').attr('stroke', AstroConst.AstroColor.Stroke);
			line.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
		}
		return lines;
	}
	
	degreeInnerLines(svg, r){
		let long = r - 9;
		let medium = r - 6;
		let short = r - 3;
		let lines = svg.append('g');
		for(let i=0; i<360; i++){
			let x1 = r * Math.sin(-i * Math.PI / 180);
			let y1 = r * Math.cos(-i * Math.PI / 180);
			let x2 = 0;
			let y2 = 0;
			if(i % 10 === 0){
				x2 = long * Math.sin(-i * Math.PI / 180);
				y2 = long * Math.cos(-i * Math.PI / 180);
			}else if(i % 5 === 0){
				x2 = medium * Math.sin(-i * Math.PI / 180);
				y2 = medium * Math.cos(-i * Math.PI / 180);
			}else{
				x2 = short * Math.sin(-i * Math.PI / 180);
				y2 = short * Math.cos(-i * Math.PI / 180);
			}
			let line = lines.append('line').attr('stroke', AstroConst.AstroColor.Stroke);
			line.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
		}
		return lines;
	}
	
	
	
	// 行星 glyph 防重叠铺开(成熟方案):从最大圆周空隙处「断环」展开 → unwrap 成单调序列 → 前向顺延 ≥ angoffset。
	// 设 obj.poslon(显示位,可 >360,glyph 与相位线共用)。解决「极少数盘把行星挤成一团」:旧逻辑按 lon 升序硬推,
	// 跨 0°/360° 的密集团会被推过 360° 绕回与开头互挤。objects 须已按 lon 升序(调用处 1589/1795 已 sort)。
	declusterPlanetPositions(objects, planetDisplay, angoffset){
		const vis = [];
		for(let i=0; i<objects.length; i++){
			const o = objects[i];
			if(o && planetDisplay && planetDisplay.has(o.id)){ vis.push(o); }
		}
		if(vis.length === 0){ return; }
		if(vis.length === 1){ vis[0].poslon = vis[0].lon; return; }
		// 找最大「前向圆周空隙」,从其后那颗开始展开(把接缝放到最空处,避免跨 0° 互挤)
		let startIdx = 0; let maxGap = -1;
		for(let k=0; k<vis.length; k++){
			const cur = vis[k].lon;
			const next = vis[(k + 1) % vis.length].lon;
			const gap = (((next - cur) % 360) + 360) % 360;
			if(gap > maxGap){ maxGap = gap; startIdx = (k + 1) % vis.length; }
		}
		// unwrap 成单调递增 → 前向顺延 ≥ angoffset
		let prev = null;
		let base = vis[startIdx].lon;
		for(let k=0; k<vis.length; k++){
			const p = vis[(startIdx + k) % vis.length];
			let lon = p.lon;
			while(lon < base - 1e-6){ lon += 360; }
			base = lon;
			if(prev !== null && lon < prev + angoffset){ lon = prev + angoffset; }
			prev = lon;
			p.poslon = lon;
		}
	}

	desposeStars(svg, chartObj, r, rStep, houses, objects, planetDisplay, flags, house1Ang, txtsu28){
		let samecolorwithsign = (flags & AstroConst.CHART_PLANETCOLORWITHSIGN) === 0 ? false : true;
		let txtforward = (flags & AstroConst.CHART_TXTPLANETFORWARD) === 0 ? false : true;
		let txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
		// [WP-9] 符号盘(隐度数):强制关掉行星旁度数文本,只留符号(掩码默认不含=零回归)。
		if((flags & AstroConst.CHART_GLYPH_ONLY) !== 0){ txtplanet = false; }
		let degSet = [];
		const isWideChart = r >= this.rThreshold;
		const planetSymbolFont = txtplanet ? (isWideChart ? 30 : 25) : (isWideChart ? 43 : 36);
		const signSymbolFont = isWideChart ? 18 : 15;
		const planetTextFont = isWideChart ? 12 : 10;
		const planetDegreeFont = isWideChart ? 14 : 12;
		const planetMinuteFont = isWideChart ? 9 : 8;
		const retrogradeSymbolFont = isWideChart ? 15 : 13;
		const planetLayerInset = Math.max(isWideChart ? 32 : 24, Math.round(rStep * (isWideChart ? 0.22 : 0.28)));
		const planetTextOffsets = isWideChart
			? { planet: 0, degree: 35, sign: 58, minute: 80, retrograde: 96, extraStart: 112, extraStep: 16 }
			: { planet: 0, degree: 28, sign: 47, minute: 66, retrograde: 82, extraStart: 96, extraStep: 14 };
	
		let innerR = r - rStep;
		let txtPosR = r - planetLayerInset - this.TxtOffsetTop;
		const getPlanetTextOffset = (idx, hasRetrograde) => {
			if(!txtplanet){
				return idx === 0 ? planetTextOffsets.planet : planetTextOffsets.degree + idx * planetTextOffsets.extraStep;
			}
			if(idx <= 1){
				return planetTextOffsets.planet;
			}
			if(idx <= 3){
				return planetTextOffsets.degree;
			}
			if(idx <= 5){
				return planetTextOffsets.sign;
			}
			if(idx === 6){
				return planetTextOffsets.minute;
			}
			if(hasRetrograde && idx === 7){
				return planetTextOffsets.retrograde;
			}
			let extraBase = hasRetrograde ? 8 : 7;
			return planetTextOffsets.extraStart + Math.max(0, idx - extraBase) * planetTextOffsets.extraStep;
		};
	
		let stars = svg.append('g');
		for(let i=0; i<houses.length; i++){
			let house = houses[i];
			let delta = house['size'];
			let stangle = house['lon'] * Math.PI / 180;
			let edangle = delta * Math.PI / 180;		
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -stangle,
				endAngle: -(stangle + edangle)
			});
			let termgroup = stars.append('g');
			termgroup.append('path')
				.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
				.attr('fill', AstroConst.AstroColor.PlanetZoneFill[house.id]);
		}
	
		const angoffset = r >= this.rThreshold ? 7.5 : 11;
		this.declusterPlanetPositions(objects, planetDisplay, angoffset);
		for(let i=0; i<objects.length; i++){
			let pnt = objects[i];
			let pntstr = pnt.id;
			if(!planetDisplay.has(pntstr)){
				continue;
			}
			let tmplon = (pnt.poslon !== undefined && pnt.poslon !== null) ? pnt.poslon : pnt.lon;
			let lon = tmplon * Math.PI / 180;
			let lblgroup = stars.append('g').attr("text-anchor", "middle");
			this.genTooltip(lblgroup, pnt);
	
			let degs = splitDegree(pnt.signlon);
			let startxt = [];
			startxt[0] = AstroText.AstroMsg[pntstr];
			startxt[1] = '';
			if(txtplanet){
				startxt[2] = degs[0] + 'º';
				startxt[3] = '';
				startxt[4] = AstroText.AstroMsg[pnt.sign];
				startxt[5] = '';
				startxt[6] = degs[1] + "'";	
			}
			// [WP-2] 留驻 S/D 标:stationMarking 开启时后端产出 stationState('S' 留驻带内/'D' 顺行留后初段),
			// 优先于 R 标同槽位显示(留驻中速度可能仍微负,双标并存会误读);默认 off=null 走原 R 逻辑零回归。
			const stationState = pnt.stationState === 'S' || pnt.stationState === 'D' ? pnt.stationState : null;
			const hasRetrograde = pnt.lonspeed < 0 && !stationState;
			if(stationState){
				startxt.push(stationState);
			}else if(hasRetrograde){
				startxt.push(AstroText.AstroMsg['Retrograde']);
			}
			const retrogradeTextIndex = (stationState || hasRetrograde) ? (txtplanet ? 7 : 2) : -1;
			const stationTextValue = stationState;
			const degreeTextIndex = txtplanet ? 2 : -1;
			const signTextIndex = txtplanet ? 4 : -1;
			const minuteTextIndex = txtplanet ? 6 : -1;
			if(txtsu28){
				let sudegs = this.getSu28Text(chartObj, pnt);
				sudegs.map((itm, idx)=>{
					if(pnt.lonspeed < 0 && idx === 0){
						return null;
					}
					startxt.push(itm);
				});
			}
	
			const planetTexts = lblgroup.selectAll('text').data(startxt).enter().append('text')
				.attr("dominant-baseline","central")
				.attr("text-anchor", "middle")
				.attr('class', function(d, idx){
					if(idx !== retrogradeTextIndex){ return null; }
					// [WP-2] 留驻标复用逆行槽位与字号,色分两类(app.less :global 定义,S=amber/D=green)。
					if(stationTextValue === 'S'){ return 'horosa-astro-station-s'; }
					if(stationTextValue === 'D'){ return 'horosa-astro-station-d'; }
					return 'horosa-astro-retrograde-symbol';
				})
				.attr('font-size', function(d, idx){
					if(idx === retrogradeTextIndex){
						return retrogradeSymbolFont;
					}
					if(idx === degreeTextIndex){
						return planetDegreeFont;
					}
					if(idx === 0 || (startxt.length === 3 && idx === 2)){ // 行星符号
						return planetSymbolFont;
					}else if(idx === 1 || idx === 3 || idx === 5){ // 空格
						return 1;
					}else if(idx === signTextIndex){ // 星座符号
						return signSymbolFont;
					}else if(idx === minuteTextIndex){
						return planetMinuteFont;
					}else{
						return planetTextFont;
					}
				})
				.attr('stroke', function(d, idx){
					if(idx === retrogradeTextIndex){
						// [WP-2] 留驻标分色:S=amber(留驻警示)/D=green(回顺);R 保持原逆行色。
						// 字面量色(盘面 d3 惯例;标叠盘面底,双主题同值可读——photo-space 同论证)。
						if(stationTextValue === 'S'){ return '#c9973a'; }
						if(stationTextValue === 'D'){ return '#3f9a5f'; }
						return RETROGRADE_SYMBOL_COLOR;
					}
					if(idx === minuteTextIndex){
						return PLANET_MINUTE_TEXT_COLOR;
					}
					if(samecolorwithsign){
						return AstroConst.AstroColor[pnt.sign];
					}else{
						return AstroConst.AstroColor[pntstr];
					}				
				})
				.attr('fill', function(d, idx){
					if(idx === retrogradeTextIndex){
						if(stationTextValue === 'S'){ return '#c9973a'; }
						if(stationTextValue === 'D'){ return '#3f9a5f'; }
						return RETROGRADE_SYMBOL_COLOR;
					}
					if(idx === minuteTextIndex){
						return PLANET_MINUTE_TEXT_COLOR;
					}
					return null;
				})
				.attr('font-family', function(d,idx){
					// [WP-2] 🔴 S/D 是拉丁字母,绝不能走 AstroChartFont(glyph 字体把拉丁字符映射成占星符=乱码,
					// 「Ibclxc°」教训同类);仅真 R 逆行符保留 glyph 字体。
					if(idx === retrogradeTextIndex && stationTextValue){
						return AstroConst.NormalFont;
					}
					if(idx === 0 || idx === 4 || idx === retrogradeTextIndex || (startxt.length === 3 && idx === 2)){
						return AstroConst.AstroChartFont;
					}else{
						return AstroConst.NormalFont;
					}
				}).attr('font-weight', function(d, idx){
					if(idx === degreeTextIndex || idx === signTextIndex){
						return 520;
					}
					if(idx === minuteTextIndex){
						return 340;
					}
					return 400;
				})
				.attr('transform', function(d, idx){
					let offset = getPlanetTextOffset(idx, hasRetrograde);
					let x = -(txtPosR - offset) * Math.sin(lon);
					let y = -(txtPosR - offset) * Math.cos(lon);
					// 旋转角要用防重叠后的显示经度 tmplon(与上面定位同源):
					// 用原始 pnt.lon 时,星群被推开的字列会按原射线旋转 → 越推越歪。
					let angle = -tmplon;
					if(house1Ang !== undefined && house1Ang !== null && txtforward){
						angle = 90 - house1Ang;
					}
					let trans = 'translate(' + x + ', ' + y + ') rotate(' + angle + ')';
					return trans;
				})
				.text(function(d){return d});	
			this.genSignMeaningTooltip(planetTexts.filter((d, idx)=>idx === signTextIndex), pnt.sign);
		}
	
		return stars;
	
	}
	
	desposeAspects(svg, r, chartObj, planetDisplay, needThreePlanetAspLines){
		let aspects = chartObj.aspects.normalAsp;
		let asps = localStorage.getItem(AstroConst.AspKey);
		if(asps === undefined || asps === null){
			asps = AstroConst.DEFAULT_ASPECTS;
		}else{
			// 写入端(AspSelector)已 try/catch,读取端同样兜底:相位配置损坏回默认,别让画盘崩
			try{ asps = JSON.parse(asps); }catch(e){ asps = AstroConst.DEFAULT_ASPECTS; }
		}
		if(!Array.isArray(asps)){ asps = AstroConst.DEFAULT_ASPECTS; }
		let aspset = new Set();
		for(let i=0; i<asps.length; i++){
			aspset.add(asps[i]);
		}
	
	
		let apsgroup = svg.append('g');
		for(let key in aspects){
			if(!planetDisplay.has(key)){
				continue;
			}
			let objA = this.getObject(chartObj, key);
			if(objA === undefined || objA === null || objA.poslon === undefined || objA.poslon === null){
				continue;
			}
			let x1 = -r * Math.sin(objA.poslon * Math.PI / 180);
			let y1 = -r * Math.cos(objA.poslon * Math.PI / 180);
			let asp = aspects[key];
			let appl = asp.Applicative;
			let sep = asp.Separative;
			let aspary = asp.Exact.map((elm)=>{
				return elm;
			});
			for(let idx=0; idx<sep.length; idx++){
				aspary.push(sep[idx]);
			}
			for(let idx=0; idx<appl.length; idx++){
				aspary.push(appl[idx]);
			}
	
			for(let i=0; i<aspary.length; i++){
				let item = aspary[i];
				if(!planetDisplay.has(item.id)){
					continue;
				}	
				let objB = this.getObject(chartObj, item.id);
				if(objB === undefined || objB === null || objB.poslon === undefined || objB.poslon === null
					|| (needThreePlanetAspLines === false && AstroConst.THREE_PLANETS.has(objA.id)
						&& AstroConst.THREE_PLANETS.has(objB.id))){
					continue;
				}
				let aspkey = 'Asp' + item.asp;
				if(!aspset.has(aspkey)){
					continue;
				}
	
				let x2 = -r * Math.sin(objB.poslon * Math.PI / 180);
				let y2 = -r * Math.cos(objB.poslon * Math.PI / 180);
				let color = AstroConst.AstroColor['Asp' + item.asp];
				let LineGen = d3.line();
				let linedata = [[x1,y1], [x2, y2]];
				let pathStr = LineGen(linedata);
				let aspitemgrp = apsgroup.append('g');
				let path = aspitemgrp.append('path')
					.attr('stroke', color)
					.attr('stroke-width', 1)
					.attr('fill', 'none');
				path.attr('d', pathStr);	
				let txt = AstroText.AstroMsg['Asp' + item.asp];
				aspitemgrp.append('text')
				.attr("dominant-baseline","central")
				.attr("text-anchor", "middle").attr('stroke', color)
				.attr('font-size', 10).attr('font-family', AstroConst.AstroChartFont)
				.text(txt).attr('transform', 'translate(' + (x1+x2)/2 + ',' + (y1+y2)/2 + ')');	;
				if(this.showAstroMeaning){
					let asptip = buildAspectMeaningTip(item.asp, objA, objB);
					if(asptip){
						creatTooltip(this.divTooltip, aspitemgrp, asptip, this.onTipClick, true);
					}
				}

			}
		}
	
		return apsgroup;
	}
	
	desposeHouses(svg, r, rStep, houses, house1Ang){
		let innerR = r - rStep;
		let txtPosR = r - rStep / 2;
		const textAngle = house1Ang !== undefined && house1Ang !== null ? 90 - house1Ang : 0;
	
		let terms = svg.append('g');
		for(let i=0; i<houses.length; i++){
			let term = houses[i];
			let sig = term.id;
			let delta = term['size'];
			let stangle = term['lon'] * Math.PI / 180;
			let edangle = delta * Math.PI / 180;		
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -stangle,
				endAngle: -(stangle + edangle)
			});
			let termgroup = terms.append('g');
			this.genTooltip(termgroup, term);

			const houseFill = AstroConst.AstroColor.HouseFill[term.id];
			termgroup.append('path')
				.attr('d', arcd).attr('stroke', AstroConst.AstroColor[term.id])
				.attr('fill', houseFill)
				.attr('fill-opacity', getChartLayerFillOpacity(houseFill, DARK_HOUSE_FILL_OPACITY));
	
			let demiStep = (delta / 2) * Math.PI / 180;
			let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
			let posx = -txtPosR * Math.sin(stangle + demiStep);
			let posy = -txtPosR * Math.cos(stangle + demiStep);
			let transtr = 'translate(' + posx + ',' + posy +  ')';
			lblgroup.attr('transform', transtr);
			let termtxt = sig.substr(5);
			let lbl = lblgroup.append('text')
					.attr('stroke', AstroConst.AstroColor.Stroke)
					.attr("dominant-baseline","central")
					.attr("text-anchor", "middle")
					.attr('font-size', 17)
					.text(termtxt);
			let txtrot = 'rotate(' + textAngle + ')';
			lbl.attr('transform', txtrot);		
	
		}
	
		return terms;
	
	}
	
	labelHousesDeg(svg, r, len, houses, flags){
		let txtPosR = r;
		let labelHDgrp = svg.append('g');
		for(let i=0; i<houses.length; i++){
			let house = houses[i];
			let lonrad = house.lon * Math.PI / 180;
			let x1 = -r * Math.sin(lonrad);
			let y1 = -r * Math.cos(lonrad);
			let x2 = -(r - len) * Math.sin(lonrad);
			let y2 = -(r - len) * Math.cos(lonrad);
			let path = labelHDgrp.append('line')
				.attr('stroke-dasharray', '3,3')
				.attr('stroke', AstroConst.AstroColor['Stroke']);
			path.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);	
	
	
			let sig = house.sign;
			let angleparts = splitDegree(house['signlon']);
			let txts = [angleparts[0] + 'º', AstroText.AstroMsg[sig], angleparts[1]+"'"];
			let lblgroup = labelHDgrp.append('g').attr("text-anchor", "middle");
			lblgroup.selectAll('text').data(txts).enter().append('text')
				.attr("dominant-baseline","central")
				.attr("text-anchor", "middle")
				.attr('font-size', 12)
				.attr('stroke', AstroConst.AstroColor[sig])
				.attr('font-family', function(d,idx){
					if(idx === 1){
						return AstroConst.AstroChartFont;
					}else{
						return AstroConst.NormalFont;
					}
				}).attr('font-weight', function(d, idx){
					if(idx === 1){
						return 400;
					}
					return 600;
				})
				.attr('transform', function(d, idx){
					let x = 0;
					let y = 0;
					let centeridx = 1;
					let ang = house['lon'];
					let rad = ang * Math.PI / 180;
					if(idx === centeridx){
						x = -txtPosR * Math.sin(rad);
						y = -txtPosR * Math.cos(rad);
					}else{
						let deltaIdx = centeridx - idx;
						ang = ang + deltaIdx*3;
						rad = ang * Math.PI / 180;
						x = -txtPosR * Math.sin(rad);
						y = -txtPosR * Math.cos(rad);
					}
					let rotang = -ang;
					let trans = 'translate(' + x + ', ' + y + ') rotate(' + rotang + ')';
					return trans;
				})
				.text(function(d){return d});			
	
		}
	
		return labelHDgrp;
	}
	
	drawBirthInfo(svg, margin, chartObj, chartid, inverse){
		let params = chartObj.params;
		let chartType = chartObj.chart.isDiurnal ? '，日生盘' : '，夜生盘';
		let commtxts = [
			'经度：' + params.lon + '， ' + '纬度：' + params.lat,
			params.birth,
			'时区：' + params.zone + ' ' + chartType,
		];
		let displayModeText = buildChartCircleDisplayModeText(params);
		if(displayModeText){
			commtxts.push(displayModeText);
		}
	
		let txts = [];
		if(params.name){
			txts.push(params.name);
		}
		if(params.pos){
			txts.push(params.pos);
		}
		for(let i=0; i<commtxts.length; i++){
			txts.push(commtxts[i]);
		}
		if(inverse){
			txts.push('外盘');
		}
	
		let rowheight = 20;
		let txtg = svg.append('g');
		txtg.selectAll('text').data(txts).enter().append('text')
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('transform', function(d, idx){
				let x = margin;
				let y = margin + rowheight * idx;
				let trans = 'translate(' + x + ', ' + y + ')';
				return trans;
			})
			.text(function(d){return d});			
	
		}
	
	drawBirthInfoInCircle(svg, r, firstX, firstY, chartObj, chartid){
		let params = chartObj.params;
		let chartType = chartObj.chart.isDiurnal ? '，日生盘' : '，夜生盘';
		let commtxts = [
			params.lon + '，' + params.lat,
			params.birth,
			'时区：' + params.zone + ' ' + chartType,
		];
		let displayModeText = buildChartCircleDisplayModeText(params);
		if(displayModeText){
			commtxts.push(displayModeText);
		}
	
		let txts = [];
		if(params.name){
			txts.push(params.name);
		}
		if(params.pos){
			txts.push(params.pos);
		}
		for(let i=0; i<commtxts.length; i++){
			txts.push(commtxts[i]);
		}

		let maxft = 0;
		for(let i=0; i<txts.length; i++){
			let txt = txts[i];
			if(txt.length > maxft){
				maxft = txt.length;
			}
		}
	
		let rowheight = 20;
		let totalH = txts.length * rowheight;
		let totalW = maxft * rowheight;
		let deltaH = (2*r - totalH) / 2;
		let deltaW = (2*r - totalW) / 2 - 30;
		deltaW = deltaW < 0 ? -deltaW : deltaW;
		let fy = firstY + deltaH;
		let x = firstX - deltaW;
		let y = fy;

		let txtg = svg.append('g');
		txtg.selectAll('text').data(txts).enter().append('text')
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('transform', function(d, idx){
				y = fy + rowheight * idx;
				let trans = 'translate(' + x + ', ' + y + ')';
				return trans;
			})
			.text(function(d){return d});	
			
		}
	
	drawAngles(svg, r, len, chartObj, flags){
		let asc = this.getObject(chartObj, AstroConst.ASC);
		let desc = this.getObject(chartObj, AstroConst.DESC);
		let mc = this.getObject(chartObj, AstroConst.MC);
		let ic = this.getObject(chartObj, AstroConst.IC);
		let ary = [asc, desc, mc, ic];
	
		let angglegroup = svg.append('g');
		for(let i=0; i<ary.length; i++){
			let angobj = ary[i];
			let lonrad = angobj.lon * Math.PI / 180;
			let x1 = -r * Math.sin(lonrad);
			let y1 = -r * Math.cos(lonrad);
			let x2 = -(r - len) * Math.sin(lonrad);
			let y2 = -(r - len) * Math.cos(lonrad);
			let path = angglegroup.append('line')
				.attr('stroke-width', 2)
				.attr('stroke', AstroConst.AstroColor['Stroke']);
			path.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);	
		}
	
		return angglegroup;
	}
	
	drawChart(chartid, chartObj, rStep, chartDisplay, planetDisplay, keyplanets, chartStyle){
		if(chartObj === undefined || chartObj === null || chartObj.err){
			return null;
		}
		this.setChartStyle(chartStyle);
		let svgdom = document.getElementById(chartid); 
		if(svgdom === undefined || svgdom === null){
			return null;
		}
		let width = svgdom.clientWidth;
		let height = svgdom.clientHeight;
		if(width === 0 || height === 0){
			return null;
		}
	
		let disp = chartDisplay ? chartDisplay : [];
		let flags = 0;
		for(let i=0; i<disp.length; i++){
			flags = flags + disp[i];
		}
		flags = this.applyChartStyleFlags(flags);
	
		let orgx = width / 2;
		let orgy = height / 2 - this.ChartMoveUp;
		let delta = this.ChartMarginDelta - this.ChartMoveUp ;
		let signsR = Math.min(width, height) / 2 - delta;
	
		let ressvg = this.drawChartWithOrgXY(chartid, chartObj, orgx, orgy, signsR, rStep, flags, planetDisplay, keyplanets);
		let svg = ressvg.svg;
		this.solidifyText(svg);
	
	}
	
	drawChartWithOrgXY(chartid, chartObj, orgx, orgy, radius, rStep, flags, planetDisplay, keyplanets){
		if(chartObj === undefined || chartObj === null || chartObj.err){
			return null;
		}
		let svgdom = document.getElementById(chartid); 
		if(svgdom === undefined || svgdom === null){
			return null;
		}
		let width = svgdom.clientWidth;
		let height = svgdom.clientHeight;
		if(width === 0 || height === 0){
			return null;
		}
	
		let svgid = '#' + chartid;
		let svg = d3.select(svgid);
		svg.html('');
		svg.attr('class', getChartRendererClass('astro'))
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr("stroke-width", 1);
	
		let topgroup = svg.append('g');
	
		let houseR = this.drawOuterSigns(chartObj, topgroup, radius, rStep, flags, chartObj.chart.isDiurnal);
	
		let txtsu28 = (flags & AstroConst.CHART_SU28_TEXT) === 0 ? false : true;
		let chartres = this.drawInnerChartWithOrgXY(topgroup, chartObj, orgx, orgy, houseR, rStep, flags, planetDisplay, txtsu28, keyplanets);
		// [WP-9] 盘心显示(行星时·日主星 / 赤经上升 RAMC)+角宫三元组徽:默认掩码不含=零渲染零回归。
		// 盘心字画在 svg 根(屏幕系):topgroup 带 translate+rotate(house1-90),进去会歪。三元组进 topgroup 与宫头线同几何。
		this.drawCenterExtras(svg, chartObj, orgx, orgy, flags);
		this.drawAngularTriads(topgroup, chartObj, radius, flags);
		this.solidifyText(svg);
		let resobj = {
			svg: svg,
			chart: chartres,
		}
		return resobj;
	}

	// [WP-9] 盘心两行小字:时主/日主(后端 timerStar/dayerStar 现成)+RAMC(MC 赤经现成)。
	drawCenterExtras(svgRoot, chartObj, orgx, orgy, flags){
		const wantHours = (flags & AstroConst.CHART_CENTER_HOURS) !== 0;
		const wantRamc = (flags & AstroConst.CHART_CENTER_RAMC) !== 0;
		if(!wantHours && !wantRamc){ return; }
		const chart = (chartObj && chartObj.chart) || {};
		const lines = [];
		if(wantHours && (chart.timerStar || chart.dayerStar)){
			const cn = (id)=> (AstroText.AstroMsgCN && AstroText.AstroMsgCN[id]) || id || '—';
			lines.push(`时主 ${cn(chart.timerStar)} · 日主 ${cn(chart.dayerStar)}`);
		}
		if(wantRamc){
			// [SURF-4] RAMC=天顶赤经:直读后端宫头赤经(每宫头随盘下发 ra)。旧实现两病:
			// ①判据 Number(params.zodiacal)===0 而回显是字符串 'Tropical'→Number=NaN 恒假
			// →两种黄道制都静默不显示;②前端三角换算多此一举。
			// [SURF-R1b] 恒星制回落不显:后端 sweHouses 对恒星制宫头把「恒星黄经」当回归黄经做
			// 黄→赤旋转,下发的 ra 是差≈ayanamsa 赤道投影(~24°)的伪赤经——错值比缺行更糟,
			// 直读只在回归制成立(pytest test_house_ra_sidereal_vs_tropical_divergence 锁两制分岔;
			// 后端治本需全量排查 su28/_houseByRa 等 ra 消费面,另案)。
			const _zs = `${(chartObj && chartObj.params && chartObj.params.zodiacal) != null ? chartObj.params.zodiacal : ''}`;
			const _sid = _zs === AstroConst.SIDEREAL || _zs === '1';
			const h10 = _sid ? null : this.getHouse(chartObj, AstroConst.HOUSE10);
			let ra = h10 && Number.isFinite(Number(h10.ra)) ? Number(h10.ra) : NaN;
			if(!Number.isFinite(ra)){
				// 老响应无 ra 字段的兜底:回归黄经三角换算(tanα=tanλ·cosε);恒星黄经差 ayanamsa,诚实跳过。
				const mc = !_sid ? getObject(chartObj, AstroConst.MC) : null;
				const mlon = mc ? Number(mc.lon) : NaN;
				if(Number.isFinite(mlon)){
					const rad = Math.PI / 180;
					const eps = 23.4367 * rad;
					ra = Math.atan2(Math.sin(mlon * rad) * Math.cos(eps), Math.cos(mlon * rad)) / rad;
				}
			}
			if(Number.isFinite(ra)){
				ra = ((ra % 360) + 360) % 360;
				let d = Math.floor(ra);
				let m = Math.round((ra - d) * 60);
				if(m === 60){ d = (d + 1) % 360; m = 0; }
				lines.push(`RAMC ${d}˚${m < 10 ? '0' : ''}${m}′`);
			}
		}
		if(!lines.length){ return; }
		const g = svgRoot.append('g');
		lines.forEach((t, i)=>{
			g.append('text')
				.attr('x', orgx).attr('y', orgy - 7 + i * 15)
				.attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
				.attr('font-family', AstroConst.NormalFont).attr('font-size', 11)
				.attr('fill', AstroConst.AstroColor.Stroke).attr('stroke', 'none')
				.attr('opacity', 0.85)
				.text(t);
		});
	}

	// [WP-9][SURF-4] 角宫三元组徽:1/4/7/10 四角宫外侧胶囊,内容=该宫头星座的**三分主星组**
	// (resolveTripletForSign 单源,吃三分制档+昼夜换序——与 label 语义对齐;旧版画的是
	// 庙主/定位星/界主硬编码表,名不副实且不吃 triplicity 设置)。
	drawAngularTriads(topgroup, chartObj, radius, flags){
		if((flags & AstroConst.CHART_ANGULAR_TRIAD) === 0){ return; }
		// [R2-16] 小画布(辅盘缩略/多盘格)胶囊出界且三符不可读——诚实跳过。
		if(!Number.isFinite(radius) || radius < 240){ return; }
		const chart = (chartObj && chartObj.chart) || {};
		const houses = Array.isArray(chart.houses) ? chart.houses : [];
		if(houses.length < 12){ return; }
		let resolveTripletForSign = null;
		try{
			resolveTripletForSign = require('../../utils/triplicityRulers').resolveTripletForSign;
		}catch(e){ resolveTripletForSign = null; }
		if(!resolveTripletForSign){ return; }
		const tripSystem = (chartObj && chartObj.params && chartObj.params.triplicity) || 'Dorothean';
		const isDiurnal = !!(chartObj && chartObj.chart && chartObj.chart.isDiurnal);
		// [SURF-4] 病根修:后端 houses 按黄经排过序(perchart.getChartObj houses.sort(key=takeLon)),
		// 位置下标 [0]/[9]/[6]/[3] 只有 ~1/3 盘碰巧是角宫——必须按 id 查表(同类 :1736/:1804 先例)。
		const angleHouses = [AstroConst.HOUSE1, AstroConst.HOUSE10, AstroConst.HOUSE7, AstroConst.HOUSE4]
			.map((id)=> this.getHouse(chartObj, id)).filter(Boolean);
		const house1 = this.getHouse(chartObj, AstroConst.HOUSE1);
		const globalRot = house1 && Number.isFinite(Number(house1.lon)) ? Number(house1.lon) - 90 : 0;
		const g = topgroup.append('g');
		angleHouses.forEach((h)=>{
			const lon = Number(h.lon);
			if(!Number.isFinite(lon)){ return; }
			const glyphs = (resolveTripletForSign(h.sign, tripSystem, isDiurnal) || [])
				.map((id)=> (AstroText.AstroMsg && AstroText.AstroMsg[id]) || '')
				.filter((s)=> s);   // 空字形串过滤放 map 后(旧版序反=可能画空胶囊)
			if(!glyphs.length){ return; }
			// 与宫头线同几何(x=-R·sin(lon)/y=-R·cos(lon),黄经系;topgroup translate+rotate(house1-90) 转屏幕位)。
			const lonrad = lon * Math.PI / 180;
			const bR = radius + 27;
			const bx = -bR * Math.sin(lonrad);
			const by = -bR * Math.cos(lonrad);
			// [SURF-4] 朝向=切向排布(用户规格:胶囊长轴 ⊥ 圆心→徽记的半径):rotate 到 φ+90°(φ=半径方向角)。
			// 旋转不变性保证 topgroup 全局旋转后仍切向;屏幕终角落在下半圈再 +180° 防文字倒置(不破坏垂直性)。
			let rot = Math.atan2(by, bx) * 180 / Math.PI + 90;
			const screenAng = (((rot + globalRot) % 360) + 360) % 360;
			if(screenAng > 90 && screenAng < 270){ rot += 180; }
			// 切向排布的径向占用=胶囊半高 9(而非半宽 24.5),bR+9 ≤ 画布余量,四轴处不再裁切。
			const capW = glyphs.length * 13 + 10;
			g.append('rect')
				.attr('x', bx - capW / 2).attr('y', by - 9)
				.attr('width', capW).attr('height', 18)
				.attr('rx', 9).attr('ry', 9)
				.attr('fill', 'rgba(199,163,98,.10)')
				.attr('stroke', AstroConst.AstroColor.Stroke).attr('stroke-width', 0.6).attr('opacity', 0.9)
				.attr('transform', `rotate(${rot}, ${bx}, ${by})`);
			glyphs.forEach((gl, i)=>{
				const tx = bx + (i - (glyphs.length - 1) / 2) * 13;
				g.append('text')
					.attr('x', tx).attr('y', by)
					.attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
					.attr('font-family', AstroConst.AstroChartFont).attr('font-size', 11)
					.attr('fill', AstroConst.AstroColor.Stroke).attr('stroke', 'none')
					.attr('opacity', 0.95)
					.attr('transform', `rotate(${rot}, ${bx}, ${by})`)
					.text(gl);
			});
		});
	}

	drawOuterSigns(chartObj, topgroup, radius, rStep, flags, isDiurnal, termHighlight){
		const profile = this.getChartStyleProfile();
		const outerBandStep = ['cusp', 'zodiac'].indexOf(profile.outerMode) >= 0 ? rStep + 8 : rStep;
		let needOutDeg = (flags & AstroConst.CHART_OUTERDEG) === AstroConst.CHART_OUTERDEG ? true : false;
		if(needOutDeg){
			let outerDegLines = this.degreeOuterLines(topgroup, radius);
		}
		let house1 = null;
		if(chartObj){
			house1 = this.getHouse(chartObj, AstroConst.HOUSE1);
		}
		let house1ang = house1 ? house1['lon'] : null;
		if(profile.outerMode === 'zodiac'){
			this.signsBand(topgroup, radius, outerBandStep, flags, isDiurnal, house1ang);
		}else if(chartObj && chartObj.chart && Array.isArray(chartObj.chart.houses)){
			this.houseCuspBand(topgroup, radius, outerBandStep, chartObj.chart.houses, flags, house1ang);
		}else{
			this.signsBand(topgroup, radius, outerBandStep, flags, isDiurnal, house1ang);
		}
	
		let needTerm = (flags & AstroConst.CHART_TERM) === AstroConst.CHART_TERM ? true : false;
	
		if(needTerm){
			let termR = radius - outerBandStep;
			let termStep = 20;
			// 界限环按所选界系(termsVariant 0埃及/1托勒密/2莉莉/3迦勒底)取对应界主表,度数随界变;
			// 迦勒底界按昼夜(isDiurnal)取昼/夜表(土水互换),异于其它三套;含狮子/双子界内变体;默认埃及=现状。
			let _tv = (chartObj && chartObj.params && chartObj.params.termsVariant) || 0;
			let _termsTable = termsTableForVariant(_tv, isDiurnal, AstroConst.TERMS_TABLES_BY_VARIANT, AstroConst.EGYPTIAN_TERMS, chartObj && chartObj.params);
			let terms = this.termBand(topgroup, termR, termStep, flags, termHighlight, _termsTable);
		
			let houseR = termR - termStep;
			return houseR;	
		}
	
		return radius - outerBandStep;
	}
	
	drawInnerChartWithOrgXY(topgroup, chartObj, orgx, orgy, houseR, rStep, flags, planetDisplay, txtsu28, keyplanets){
		const profile = this.getChartStyleProfile();
		let housesObj = chartObj.chart.houses;
		let housesAry = chartObj.chart.houses;
		let starsR = houseR;
		let starStep = Math.max(132, Math.min(188, Math.round(houseR * 0.45)));
		let innerHouseStep = Math.max(24, Math.min(30, Math.round(rStep * 0.9)));
		let txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
		// [WP-9] 符号盘(隐度数):强制关掉行星旁度数文本,只留符号(掩码默认不含=零回归)。
		if((flags & AstroConst.CHART_GLYPH_ONLY) !== 0){ txtplanet = false; }
		if(txtplanet){
			if(starsR < this.rThreshold){
				starStep = 86
			}
			if(txtsu28){
				starStep = starStep + 60;
			}
		}
		starStep = Math.max(50, Math.round(starStep * (profile.starScale || 1)));
		innerHouseStep = Math.max(22, Math.min(34, Math.round(innerHouseStep * (profile.innerHouseScale || 1))));

		let houseBandR = starsR - starStep;
		if(houseBandR < rStep * 3){
			houseBandR = rStep * 3;
			starStep = Math.max(50, starsR - houseBandR);
		}
		let houses = null;
		let needInnerDeg = (flags & AstroConst.CHART_INNERDEG) === AstroConst.CHART_INNERDEG ? true : false;
		let objectsAry = [];
		for(let i=0; i<chartObj.chart.objects.length; i++){
			objectsAry.push(chartObj.chart.objects[i]);
		}
		if(chartObj.lots){
			for(let i=0; i<chartObj.lots.length; i++){
				objectsAry.push(chartObj.lots[i]);
			}	
		}
		objectsAry.sort((a,b)=>{ return a.lon - b.lon});
	
		let house1 = this.getHouse(chartObj, AstroConst.HOUSE1);
	
		let needPlanets = (flags & AstroConst.CHART_PLANETS) === AstroConst.CHART_PLANETS ? true : false;
		if(needPlanets){
			let stars = this.desposeStars(topgroup, chartObj, starsR, starStep, housesAry, objectsAry, planetDisplay, flags, house1['lon'], txtsu28);
			houses = this.desposeHouses(topgroup, houseBandR, innerHouseStep, housesObj, house1['lon']);
			if(needInnerDeg){
				this.degreeInnerLines(topgroup, houseBandR);
			}
			if((flags & AstroConst.CHART_ANGLELINE) === AstroConst.CHART_ANGLELINE){
				let angleR = starsR;
				let len = starsR - (houseBandR - innerHouseStep);
				if(starsR < this.rThreshold){
					angleR = starsR;
					len = starsR - (houseBandR - innerHouseStep);
				}
				this.drawAngles(topgroup, angleR, len, chartObj, flags);	
			}
		
		}else{
			starStep = 0;
			houses = this.desposeHouses(topgroup, houseR, innerHouseStep, housesObj, house1['lon']);
		}
	
		let aspR = needPlanets ? houseBandR - innerHouseStep : houseR - innerHouseStep;
		let needSu = (flags & AstroConst.CHART_SU27) === AstroConst.CHART_SU27 ? true : false;
		if(needSu){
			const houseOuterR = needPlanets ? houseBandR : houseR;
			const houseInnerR = houseOuterR - innerHouseStep;
			let suSixHouseR = houseInnerR;
			let suSH = this.suSixhouses(topgroup, suSixHouseR, rStep, chartObj);
		
			let suR = suSixHouseR - rStep;
			let needOutDeg = (flags & AstroConst.CHART_OUTERDEG) === AstroConst.CHART_OUTERDEG ? true : false;
			if(needOutDeg){
				let outerSuDegLines = this.degreeOuterLines(topgroup, suR);
			}
			let suTerms = this.su27Band(topgroup, suR, rStep);
		
			let guohouses = chartObj.guoStarSect.houses;
			let lifeSu = guohouses[0].id;
			let suRelationR = suR - rStep;
			let suRelations = this.suRelationBand(topgroup, suRelationR, lifeSu, rStep);
		
			aspR = suRelationR - rStep;		
		}
	
		let needAspLines = (flags & AstroConst.CHART_ASP_LINES) === AstroConst.CHART_ASP_LINES ? true : false;	
		if(needAspLines){
			let needThreePlanetAspLines = (flags & AstroConst.CHART_THREEPLANETASP) === AstroConst.CHART_THREEPLANETASP ? true : false;
			let asp = this.desposeAspects(topgroup, aspR, chartObj, planetDisplay, needThreePlanetAspLines);
		}
	
		if(keyplanets){
			let maskStep = innerHouseStep + starStep;
			this.drawMask(topgroup, chartObj, houseR, maskStep, keyplanets);
		}

		// 卜卦判读叠层(二期):最后追加的独立 <g>(z 序最高、pointer-events:none),
		// 未设置(占星页/开关全关)即整段跳过 —— 既有元素零触碰。
		if(this.horaryOverlay){
			const profile2 = this.getChartStyleProfile();
			const outerBandStep = ['cusp', 'zodiac'].indexOf(profile2.outerMode) >= 0 ? rStep + 8 : rStep;
			this.drawHoraryOverlay(topgroup, chartObj, {
				houseR, aspR, flags, outerBandStep,
			});
		}

		let translate = 'translate(' + orgx + ',' + orgy + ') ';
		let rotate = 'rotate(' + (house1.lon-90) + ')';
		let trans = translate + rotate;
		topgroup.attr("transform", trans);
	
		let resobj = {
			topgroup: topgroup,
			radius: aspR,
		}
		return resobj;
	
	}
	
	drawMask(svg, chartObj, r, rStep, keyplanets){
		let innerR = r - rStep;
		let houses = chartObj.chart.houses;
		let masks = svg.append('g');
		for(let i=0; i<houses.length; i++){
			let house = houses[i];
			let hasKey = false;
			for(let i = 0; i<keyplanets.length; i++){
				let obj = this.getObject(chartObj, keyplanets[i]);
				// 落宫单源化(2026-07):优先用后端 obj.house(含 5° 宫头前移律,随 houseCuspAdvance
				// 全局参数与当前分宫制)——聚光宫与右栏/判读的落宫恒一致;缺 house 字段的点才
				// 回退宫首相对弧几何(跨 0° 白羊点用相对弧,线性比较永不命中)。
				if(obj.house){
					if(obj.house === house.id){
						hasKey = true;
						break;
					}
					continue;
				}
				let lon = obj.lon;
				const rel = ((lon - house.lon) % 360 + 360) % 360;
				if(rel <= house.size){
					hasKey = true;
					break;
				}
			}
			let delta = house['size'];
			let stangle = house['lon'] * Math.PI / 180;
			let edangle = delta * Math.PI / 180;		
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -stangle,
				endAngle: -(stangle + edangle)
			});
			let maksgrp = masks.append('g');
			if(hasKey){
				maksgrp.append('path')
					.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
					.attr('fill', AstroConst.AstroColor.HouseFill[house.id])
					.attr('fill-opacity', KEY_HOUSE_FILL_OPACITY);
			}else{
				maksgrp.append('path')
					.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
					.attr('fill', AstroConst.AstroColor.HouseMask)
					.attr('fill-opacity', NON_KEY_HOUSE_MASK_OPACITY);
			}
		}

	}

	// ── 卜卦判读叠层(二期,WP5.1 余项) ─────────────────────────────────────────
	// 输入 = setHoraryOverlay 的纯几何描述对象(horaryOverlayData.js);独立 <g> 追加于全部
	// 既有图元之后(z 序最高)、pointer-events:none(不截获既有 tooltip);本方法只 append,
	// 绝不触碰既有节点 —— overlay 为 null 时调用点整段跳过,渲染字节与现状一致。
	// 坐标系:topgroup 局部(随后统一 rotate(house1-90)),λ° → (-r·sinλ, -r·cosλ),与全部同层图元同式。
	drawHoraryOverlay(svg, chartObj, geom){
		const ov = this.horaryOverlay;
		if(!ov){ return; }
		const OV_GREEN = '#3f9d4f';
		const OV_AMBER = '#d9a441';
		const OV_RED = '#c0392b';
		const OV_GOLD = '#d4af37';
		const rad = (deg) => deg * Math.PI / 180;
		const xy = (lonDeg, r) => [-r * Math.sin(rad(lonDeg)), -r * Math.cos(rad(lonDeg))];
		const g = svg.append('g')
			.attr('class', 'horary-overlay')
			.attr('pointer-events', 'none')
			.attr('fill', 'none');

		const needTerm = (geom.flags & AstroConst.CHART_TERM) === AstroConst.CHART_TERM;

		// ① 界限环着色:界带内缘 6px 色条按界主本体色分段(termsTableForVariant 与 drawOuterSigns
		// 同一单源,termR/termStep 按其几何反推 houseR+20);不盖界主字符(字符居带中,条在内缘)。
		if(ov.terms && needTerm){
			const termR = geom.houseR + 20;
			const tv = (chartObj && chartObj.params && chartObj.params.termsVariant) || 0;
			const table = termsTableForVariant(tv, chartObj.chart.isDiurnal, AstroConst.TERMS_TABLES_BY_VARIANT, AstroConst.EGYPTIAN_TERMS, chartObj && chartObj.params);
			const strip = g.append('g');
			for(let i = 0; i < 12; i++){
				const sig = AstroConst.LIST_SIGNS[i];
				const rows = (table || AstroConst.EGYPTIAN_TERMS)[sig] || [];
				for(let k = 0; k < rows.length; k++){
					const term = rows[k];
					const st = rad(30 * i + term[1]);
					const ed = rad(term[2] - term[1]);
					const arcd = d3.arc()({ innerRadius: termR - 20, outerRadius: termR - 14, startAngle: -st, endAngle: -(st + ed) });
					strip.append('path')
						.attr('d', arcd)
						.attr('stroke', 'none')
						// 🔴 必经取色守卫:单色主题(古老/煜熠/咖啡/银河/伽蓝)把五界主星全设成同一个
						// Stroke 灰,直接取本体色会让 12 座×5 界铺成一整圈同色 → 看着像给盘加了圈阴影
						// (用户实测)。守卫在本体色不可分辨时退星座色(单色主题下星座色仍有区分)。
						.attr('fill', this.resolveTermHighlightColor(sig, term[0], null))
						.attr('fill-opacity', 0.55);
				}
			}
		}

		// 星体真黄经(叠层锚点用 lon 本值,非展示防撞位)。
		const lonOf = (id) => {
			const o = id ? this.getObject(chartObj, id) : null;
			return (o && o.lon !== undefined && o.lon !== null) ? o.lon : null;
		};

		// ② 完成法连线:direct=绿实线 / relay(传递·汇集)=琥珀虚线经中间星(空心圈标注) /
		// antiscion=绿点线 / broken=红虚线+中点红叉;interferer 红色圆环。半径取相位圈(aspR)同层。
		if(ov.perfection){
			const rLine = geom.aspR - 2;
			const lg = g.append('g').attr('stroke-linecap', 'round');
			(ov.perfection.lines || []).forEach((line) => {
				const a = lonOf(line.from);
				const b = lonOf(line.to);
				if(a === null || b === null){ return; }
				const v = line.via ? lonOf(line.via) : null;
				const pts = [xy(a, rLine)];
				if(v !== null && v !== undefined){ pts.push(xy(v, rLine)); }
				pts.push(xy(b, rLine));
				const dstr = 'M' + pts.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' L');
				let stroke = OV_GREEN; let dash = null; let width = 2; let opacity = 0.95;
				if(line.kind === 'relay'){ stroke = OV_AMBER; dash = '6,4'; width = 1.8; }
				else if(line.kind === 'antiscion'){ dash = '2,4'; width = 1.8; }
				else if(line.kind === 'broken'){ stroke = OV_RED; dash = '4,3'; width = 1.6; opacity = 0.9; }
				lg.append('path').attr('d', dstr)
					.attr('stroke', stroke).attr('stroke-width', width)
					.attr('stroke-opacity', opacity)
					.attr('stroke-dasharray', dash);
				if(v !== null && v !== undefined){
					const pv = xy(v, rLine);
					lg.append('circle').attr('cx', pv[0]).attr('cy', pv[1]).attr('r', 5)
						.attr('stroke', OV_AMBER).attr('stroke-width', 1.6);
				}
				if(line.kind === 'broken'){
					// 红叉画在 from→to 弦中点(破坏点):两段 45° 交叉短线。
					const pa = xy(a, rLine); const pb = xy(b, rLine);
					const mx = (pa[0] + pb[0]) / 2; const my = (pa[1] + pb[1]) / 2;
					const s = 5.5;
					lg.append('path')
						.attr('d', `M${mx - s},${my - s} L${mx + s},${my + s} M${mx - s},${my + s} L${mx + s},${my - s}`)
						.attr('stroke', OV_RED).attr('stroke-width', 2.2).attr('stroke-opacity', 0.95);
				}
			});
			(ov.perfection.marks || []).forEach((mk) => {
				const ml = lonOf(mk.id);
				if(ml === null){ return; }
				const pm = xy(ml, rLine);
				lg.append('circle').attr('cx', pm[0]).attr('cy', pm[1]).attr('r', 6.5)
					.attr('stroke', OV_RED).attr('stroke-width', 1.8).attr('stroke-opacity', 0.9);
			});
		}

		// ③ 映点小三角:相位圈上、尖端朝外(rotate(-λ) 使局部 -y 轴对准径向外),星体本体色;
		// 落宫头(≤1°)者放大加描边。
		if(ov.antiscia && ov.antiscia.length){
			const rTri = geom.aspR;
			const tg = g.append('g');
			ov.antiscia.forEach((m) => {
				if(!m || m.alon === undefined || m.alon === null){ return; }
				const p = xy(m.alon, rTri);
				const w = m.onCusp ? 5.5 : 3.5;
				const h = m.onCusp ? 9 : 6;
				const tri = tg.append('path')
					.attr('d', `M0,${-h} L${w},${h / 2} L${-w},${h / 2} Z`)
					.attr('transform', `translate(${p[0]},${p[1]}) rotate(${-m.alon})`)
					.attr('fill', AstroConst.AstroColor[m.id] || AstroConst.AstroColor.Stroke)
					.attr('fill-opacity', 0.9)
					.attr('stroke', 'none');
				if(m.onCusp){
					tri.attr('stroke', AstroConst.AstroColor.Stroke).attr('stroke-width', 0.8);
				}
			});
		}

		// ④ 恒星命中:轮缘(星座带外沿)打点+星名;王者星金色、凶性红色、余随主题描边色;
		// 星名整体反转回水平(抵销 topgroup 的 rotate(house1-90)),按落点半边取锚向。
		if(ov.stars && ov.stars.length){
			const rimR = geom.houseR + (needTerm ? 20 : 0) + geom.outerBandStep;
			const house1 = this.getHouse(chartObj, AstroConst.HOUSE1);
			const groupRot = ((house1 ? house1.lon : 0) - 90);
			const sg = g.append('g');
			ov.stars.forEach((st) => {
				if(!st || st.lon === undefined || st.lon === null){ return; }
				const color = st.royal ? OV_GOLD : (st.caution ? OV_RED : AstroConst.AstroColor.Stroke);
				const pd = xy(st.lon, rimR + 4);
				sg.append('circle').attr('cx', pd[0]).attr('cy', pd[1]).attr('r', st.royal ? 3 : 2.4)
					.attr('fill', color).attr('fill-opacity', 0.95).attr('stroke', 'none');
				const pt = xy(st.lon, rimR + 9);
				// 屏幕侧向 = 局部坐标经群旋转后的 x 分量符号 → 决定文字锚在点的左/右。
				const gr = rad(groupRot);
				const sx = pt[0] * Math.cos(gr) - pt[1] * Math.sin(gr);
				sg.append('text')
					.attr('transform', `translate(${pt[0]},${pt[1]}) rotate(${-groupRot})`)
					.attr('text-anchor', sx >= 0 ? 'start' : 'end')
					.attr('dominant-baseline', 'central')
					.attr('font-size', 10)
					.attr('stroke', 'none')
					.attr('fill', color)
					.text(st.name || '');
			});
		}
	}

	drawOutterChartInfo(svg, margin, width, datetime, lat, lon, inverse){
		if(datetime === undefined || datetime === null){
			return;
		}
		
		let txts = [];
		if(lat !== undefined && lat !== null){
			let latstr = convertLatToStr(lat);
			let lonstr = convertLonToStr(lon);
			txts.push('行运经度：' + lonstr + '， ' + '纬度：' + latstr);
		}
		txts.push('行运时间：' + datetime);
		if(inverse){
			txts.push('内盘');
		}
	
		let rowheight = 20;
		let txtg = svg.append('g');
		txtg.selectAll('text').data(txts).enter().append('text')
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('transform', function(d, idx){
				let x = width - 200 - margin;
				let y = margin + rowheight * idx;
				let trans = 'translate(' + x + ', ' + y + ')';
				return trans;
			})
			.text(function(d){return d});			
	
	}
	
	drawDoubleChart(chartid, chartObj, rStep, chartDisplay, planetDisplay, termHighlight){
		if(chartObj === undefined || chartObj === null || chartObj.err ||
			chartObj.natualChart === undefined || chartObj.natualChart === null ||
			chartObj.dirChart === undefined || chartObj.dirChart === null){
			return null;
		}
		let svgdom = document.getElementById(chartid); 
		if(svgdom === undefined || svgdom === null){
			return null;
		}
		let width = svgdom.clientWidth;
		let height = svgdom.clientHeight;
		if(width === 0 || height === 0){
			return null;
		}
	
		let innerChart = chartObj.natualChart;
		let outerChart = chartObj.dirChart;
		if(chartObj.inverse && chartObj.dirChart.dirChart){
			innerChart = chartObj.dirChart.dirChart;
			outerChart = chartObj.natualChart;
		}
	
		let disp = chartDisplay ? chartDisplay : [];
		let flags = 0;
		for(let i=0; i<disp.length; i++){
			flags = flags + disp[i];
		}
		if((flags & AstroConst.CHART_SU27) === AstroConst.CHART_SU27){
			flags = flags - AstroConst.CHART_SU27;
		}
	
		let orgx = width / 2;
		let orgy = height / 2 - this.ChartMoveUp;
		let delta = this.ChartMarginDelta - this.ChartMoveUp;
		let signsR = Math.min(width, height) / 2 - delta;
	
	let svgid = '#' + chartid;
	let svg = d3.select(svgid);
	svg.html('');
	svg.attr('class', getChartRendererClass('astro'))
		.attr('stroke', AstroConst.AstroColor.Stroke)
		.attr("stroke-width", 1);
	
		let topgroup = svg.append('g');
	
		if((flags & AstroConst.CHART_HOUSEDEGREE) === AstroConst.CHART_HOUSEDEGREE){
			let lblHousedegR = signsR + 20;
			this.labelHousesDeg(topgroup, lblHousedegR, 70, innerChart.chart.houses, flags);	
		}
		let restR = this.drawOuterSigns(null, topgroup, signsR, rStep, flags, innerChart.chart.isDiurnal, termHighlight);
		let housesAry = innerChart.chart.houses;
		let objectsAry = [];
		for(let i=0; i<outerChart.chart.objects.length; i++){
			objectsAry.push(outerChart.chart.objects[i]);
		}
		if(outerChart.lots){
			for(let i=0; i<outerChart.lots.length; i++){
				objectsAry.push(outerChart.lots[i]);
			}	
		}
		objectsAry.sort((a,b)=>{ return a.lon - b.lon});
		let starStep = 100;
		let txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
		// [WP-9] 符号盘(隐度数):强制关掉行星旁度数文本,只留符号(掩码默认不含=零回归)。
		if((flags & AstroConst.CHART_GLYPH_ONLY) !== 0){ txtplanet = false; }
	
		let natalchart = chartObj.dirChart.natalChart ? chartObj.dirChart.natalChart : chartObj.natualChart;
		if(chartObj.dirChart.dirChart && chartObj.inverse){
			natalchart = chartObj.dirChart.dirChart;
		}
		let house1 = this.getHouse(natalchart, AstroConst.HOUSE1);	
		let stars = this.desposeStars(topgroup, chartObj, restR, starStep, housesAry, objectsAry, planetDisplay, flags, house1['lon'], false);
	
		let houseR = restR - starStep;
		this.drawInnerChartWithOrgXY(topgroup, natalchart, orgx, orgy, houseR, rStep, flags, planetDisplay, false);
	
		this.drawBirthInfo(svg, this.ChartMargin, chartObj.natualChart, chartid, chartObj.inverse);
		let lat = chartObj.dirChart.pos ? chartObj.dirChart.pos.lat : null;
		let lon = chartObj.dirChart.pos ? chartObj.dirChart.pos.lon : null;
		this.drawOutterChartInfo(svg, this.ChartMargin, width, chartObj.dirChart.date, lat, lon, chartObj.inverse);
		this.solidifyText(svg);
	
		return svg;
	}
		
}
