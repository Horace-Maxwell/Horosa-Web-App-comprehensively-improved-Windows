// 星盘圆盘 · 盘式与叠加开关、悬停提示、宫位 / 星体 / 宿的取数与文案
// 从 AstroChartCircle.js 按职责拆出的 AstroChartCircle 方法:this 仍是 AstroChartCircle 实例,门面里 mixinMethods(AstroChartCircle, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as d3 from 'd3';
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import { splitDegree } from '../AstroHelper';
import { creatTooltip, setupFloatingTooltip } from '../../../utils/helper';
import { appendAstroMeaningTips, buildSignMeaningTip } from '../AstroMeaningData';
import { ChartStyleProfiles } from './displayStyle';

export const setupLookupMethods = {
	setChartStyle(style){
		this.chartStyle = AstroConst.normalizeChartStyle(style);
	},

	getChartStyleProfile(){
		return ChartStyleProfiles[this.chartStyle] || ChartStyleProfiles[AstroConst.CHART_STYLE_CURRENT];
	},

	applyChartStyleFlags(flags){
		const profile = this.getChartStyleProfile();
		const nextFlags = flags | (profile.forceFlags || 0);
		return nextFlags & ~(profile.clearFlags || 0);
	},

	// 卜卦判读叠层(二期):独立 SVG 层描述对象(components/horary/horaryOverlayData.js 构建)。
	// null(默认/占星页恒 null) → drawHoraryOverlay 整段短路,渲染路径与现状逐字节一致。
	setHoraryOverlay(overlay){
		this.horaryOverlay = overlay || null;
	},

	setShowAstroMeaning(flag){
		this.showAstroMeaning = flag ? true : false;
	},

	// 黄道星释点运高亮:主座 id(如 'Leo'),空则清除。座扇区绘制时据此叠主座(色A)+ 第4/7/10座(色B)。
	setZRHighlight(sign){
		this.zrHlSign = sign || null;
	},

	setupToolTip(){
		if(this.divTooltip){
			setupFloatingTooltip(this.divTooltip, {
				'max-width': 'min(560px, calc(100 * var(--horosa-lvw, 1vw) - 28px))',
				'max-height': 'min(460px, calc(100 * var(--horosa-lvh, 1vh) - 28px))',
				padding: '14px 16px',
				font: '14px/1.6 "PingFang SC", "Microsoft YaHei", sans-serif',
				'box-shadow': '0 8px 24px rgba(0,0,0,0.14)',
			});
		}
	},

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
	},

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
	},

	genTooltip(titleSvg, infoObj){
		let tipobj = this.genTooltipObj(infoObj, null);
		creatTooltip(this.divTooltip, titleSvg, tipobj, this.onTipClick, true);
	},

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
	},

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
	},

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
	},

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
	},

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
	},

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
	},

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

	},
};
