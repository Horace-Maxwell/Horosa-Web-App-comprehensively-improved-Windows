// 星盘圆盘 · 落点:行星避让、星体 / 相位 / 宫位排布、宫头度数标注
// 从 AstroChartCircle.js 按职责拆出的 AstroChartCircle 方法:this 仍是 AstroChartCircle 实例,门面里 mixinMethods(AstroChartCircle, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as d3 from 'd3';
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import { splitDegree } from '../AstroHelper';
import { creatTooltip } from '../../../utils/helper';
import { buildAspectMeaningTip } from '../AstroMeaningData';
import { minuteInk, stationInk, DARK_HOUSE_FILL_OPACITY, getChartLayerFillOpacity } from './displayStyle';

export const placementMethods = {
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
	},

	desposeStars(svg, chartObj, r, rStep, houses, objects, planetDisplay, flags, house1Ang, txtsu28){
		let samecolorwithsign = (flags & AstroConst.CHART_PLANETCOLORWITHSIGN) === 0 ? false : true;
		let txtforward = (flags & AstroConst.CHART_TXTPLANETFORWARD) === 0 ? false : true;
		let txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
		// 符号盘(隐度数):强制关掉行星旁度数文本,只留符号(掩码默认不含=零回归)。
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
			// 留驻 S/D 标:stationMarking 开启时后端产出 stationState('S' 留驻带内/'D' 顺行留后初段),
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
					// 留驻标复用逆行槽位与字号,色分两类(app.less :global 定义,S=amber/D=green)。
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
						// 留驻标分色:S=amber(留驻警示)/D=green(回顺);R 保持逆行色(三色都随主题取盘面调色板)。
						return stationInk(stationTextValue);
					}
					if(idx === minuteTextIndex){
						return minuteInk();
					}
					if(samecolorwithsign){
						return AstroConst.AstroColor[pnt.sign];
					}else{
						return AstroConst.AstroColor[pntstr];
					}
				})
				.attr('fill', function(d, idx){
					if(idx === retrogradeTextIndex){
						return stationInk(stationTextValue);
					}
					if(idx === minuteTextIndex){
						return minuteInk();
					}
					return null;
				})
				.attr('font-family', function(d,idx){
					// 🔴 S/D 是拉丁字母,绝不能走 AstroChartFont(glyph 字体把拉丁字符映射成占星符=乱码,
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

	},

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
	},

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

	},

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
	},
};
