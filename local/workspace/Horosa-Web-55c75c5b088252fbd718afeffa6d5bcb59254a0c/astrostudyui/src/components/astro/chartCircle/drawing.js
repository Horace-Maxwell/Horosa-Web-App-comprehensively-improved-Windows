// 星盘圆盘 · 整盘绘制:出生信息、四轴、单盘与按原点盘、盘心附加、角宫三分、外圈星座、内盘、遮罩
// 从 AstroChartCircle.js 按职责拆出的 AstroChartCircle 方法:this 仍是 AstroChartCircle 实例,门面里 mixinMethods(AstroChartCircle, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as d3 from 'd3';
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import { getObject } from '../AstroHelper';
import { getChartRendererClass } from '../../../renderers/xqChartTheme';
import { termsTableForVariant } from '../../../divination/data/hellenisticData';
import { KEY_HOUSE_FILL_OPACITY, NON_KEY_HOUSE_MASK_OPACITY, buildChartCircleDisplayModeText } from './displayStyle';

export const drawingMethods = {
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
			.attr('font-weight', 400)
			.attr('fill', AstroConst.AstroColor.Stroke).attr('stroke', 'none')   // 盘角信息字不描边(全站规矩)
			.attr('transform', function(d, idx){
				let x = margin;
				let y = margin + rowheight * idx;
				let trans = 'translate(' + x + ', ' + y + ')';
				return trans;
			})
			.text(function(d){return d});

		},

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
			.attr('font-weight', 400)
			.attr('fill', AstroConst.AstroColor.Stroke).attr('stroke', 'none')   // 盘角信息字不描边(全站规矩)
			.attr('transform', function(d, idx){
				y = fy + rowheight * idx;
				let trans = 'translate(' + x + ', ' + y + ')';
				return trans;
			})
			.text(function(d){return d});

		},

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
	},

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

	},

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
		// 盘心显示(行星时·日主星 / 赤经上升 RAMC)+角宫三元组徽:默认掩码不含=零渲染零回归。
		// 盘心字画在 svg 根(屏幕系):topgroup 带 translate+rotate(house1-90),进去会歪。三元组进 topgroup 与宫头线同几何。
		this.drawCenterExtras(svg, chartObj, orgx, orgy, flags);
		this.drawAngularTriads(topgroup, chartObj, radius, flags);
		this.solidifyText(svg);
		let resobj = {
			svg: svg,
			chart: chartres,
		}
		return resobj;
	},

	// 盘心两行小字:时主/日主(后端 timerStar/dayerStar 现成)+RAMC(MC 赤经现成)。
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
			// RAMC=天顶赤经:直读后端宫头赤经(每宫头随盘下发 ra)。旧实现两病:
			// ①判据 Number(params.zodiacal)===0 而回显是字符串 'Tropical'→Number=NaN 恒假
			// →两种黄道制都静默不显示;②前端三角换算多此一举。
			// 直读天顶点(MC)的赤经:后端 sweHouses 起它就是 ARMC,与宫制、黄道制都无关(
			// pytest test_angles_and_cusps_are_ecliptic_points 锁 MC.ra == ARMC)。第 10 宫头只在象限宫制下才等于天顶
			// (整宫、等宫、福点整宫都不是),只作缺 MC.ra 的老响应兜底。
			// 再缺就走下面的三角兜底,那条兜底拿的是黄经,恒星制差一个岁差,跳过。
			const _zs = `${(chartObj && chartObj.params && chartObj.params.zodiacal) != null ? chartObj.params.zodiacal : ''}`;
			const _sid = _zs === AstroConst.SIDEREAL || _zs === '1';
			const mcPoint = getObject(chartObj, AstroConst.MC);
			const h10 = this.getHouse(chartObj, AstroConst.HOUSE10);
			let ra = mcPoint && Number.isFinite(Number(mcPoint.ra)) ? Number(mcPoint.ra) : NaN;
			if(!Number.isFinite(ra) && h10 && Number.isFinite(Number(h10.ra))){ ra = Number(h10.ra); }
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
	},

	// 角宫三元组徽:1/4/7/10 四角宫外侧胶囊,内容=该宫头星座的**三分主星组**
	// (resolveTripletForSign 单源,吃三分制档+昼夜换序——与 label 语义对齐;旧版画的是
	// 庙主/定位星/界主硬编码表,名不副实且不吃 triplicity 设置)。
	drawAngularTriads(topgroup, chartObj, radius, flags){
		if((flags & AstroConst.CHART_ANGULAR_TRIAD) === 0){ return; }
		// 小画布(辅盘缩略/多盘格)胶囊出界且三符不可读——诚实跳过。
		if(!Number.isFinite(radius) || radius < 240){ return; }
		const chart = (chartObj && chartObj.chart) || {};
		const houses = Array.isArray(chart.houses) ? chart.houses : [];
		if(houses.length < 12){ return; }
		let resolveTripletForSign = null;
		try{
			resolveTripletForSign = require('../../../utils/triplicityRulers').resolveTripletForSign;
		}catch(e){ resolveTripletForSign = null; }
		if(!resolveTripletForSign){ return; }
		const tripSystem = (chartObj && chartObj.params && chartObj.params.triplicity) || 'Dorothean';
		const isDiurnal = !!(chartObj && chartObj.chart && chartObj.chart.isDiurnal);
		// 病根修:后端 houses 按黄经排过序(perchart.getChartObj houses.sort(key=takeLon)),
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
			// 朝向=切向排布(用户规格:胶囊长轴 ⊥ 圆心→徽记的半径):rotate 到 φ+90°(φ=半径方向角)。
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
	},

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
		const tripSystemForBand = (chartObj && chartObj.params && chartObj.params.triplicity) || 'Dorothean';   // 与角宫三元组徽同源
		if(profile.outerMode === 'zodiac'){
			this.signsBand(topgroup, radius, outerBandStep, flags, isDiurnal, house1ang, tripSystemForBand);
		}else if(chartObj && chartObj.chart && Array.isArray(chartObj.chart.houses)){
			this.houseCuspBand(topgroup, radius, outerBandStep, chartObj.chart.houses, flags, house1ang);
		}else{
			this.signsBand(topgroup, radius, outerBandStep, flags, isDiurnal, house1ang, tripSystemForBand);
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
	},

	drawInnerChartWithOrgXY(topgroup, chartObj, orgx, orgy, houseR, rStep, flags, planetDisplay, txtsu28, keyplanets){
		const profile = this.getChartStyleProfile();
		let housesObj = chartObj.chart.houses;
		let housesAry = chartObj.chart.houses;
		let starsR = houseR;
		let starStep = Math.max(132, Math.min(188, Math.round(houseR * 0.45)));
		let innerHouseStep = Math.max(24, Math.min(30, Math.round(rStep * 0.9)));
		let txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
		// 符号盘(隐度数):强制关掉行星旁度数文本,只留符号(掩码默认不含=零回归)。
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
				houseR, aspR, flags, outerBandStep, orgx, orgy,
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

	},

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

	},
};
