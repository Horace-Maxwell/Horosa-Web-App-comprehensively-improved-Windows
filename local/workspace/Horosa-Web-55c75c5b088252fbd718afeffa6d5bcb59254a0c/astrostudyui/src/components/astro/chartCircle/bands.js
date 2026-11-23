// 星盘圆盘 · 环带:星座带、宫头带、界带与界高亮、二十七宿带、宿关系、宿六宫、度数刻线
// 从 AstroChartCircle.js 按职责拆出的 AstroChartCircle 方法:this 仍是 AstroChartCircle 实例,门面里 mixinMethods(AstroChartCircle, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as d3 from 'd3';
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import { splitDegree } from '../AstroHelper';
import { creatTooltip } from '../../../utils/helper';
import { appendPerCharText } from '../../graph/GraphHelper';
import { buildSignMeaningTip } from '../AstroMeaningData';
import { minuteInk, DARK_SIGN_FILL_OPACITY, getChartLayerFillOpacity } from './displayStyle';

export const bandMethods = {
	signsBand(svg, r, rStep, flags, isDiurnal, house1Ang, tripSystem){
		let txtforward = (flags & AstroConst.CHART_TXTPLANETFORWARD) === 0 ? false : true;
		// 三分主星环随「三分制」(与角宫三元组徽同一 resolveTripletForSign 单源);此前恒画多罗特三主。
		let resolveTriplet = null;
		try{ resolveTriplet = require('../../../utils/triplicityRulers').resolveTripletForSign; }catch(e){ resolveTriplet = null; }
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
				const tripIds = (resolveTriplet && tripSystem && tripSystem !== 'Dorothean')
					? (resolveTriplet(sig, tripSystem, isDiurnal) || [])
					: null;
				if(tripIds){
					tripIds.forEach((id)=>txts.push(id));   // 托勒密二主 / 水象变体:按制取主(已按昼夜排序)
				}else if(isDiurnal){
					txts.push(AstroConst.SignsProp[sig].Trip[0]);
					txts.push(AstroConst.SignsProp[sig].Trip[1]);
					txts.push(AstroConst.SignsProp[sig].Trip[2]);
				}else{
					txts.push(AstroConst.SignsProp[sig].Trip[1]);
					txts.push(AstroConst.SignsProp[sig].Trip[0]);
					txts.push(AstroConst.SignsProp[sig].Trip[2]);
				}
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
	},

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
						return minuteInk();
					}
					return AstroConst.AstroColor.Stroke;
				})
				.attr('fill', function(d, idx){
					return idx === 2 ? minuteInk() : null;
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
	},

	resolveTermHighlightColor(sig, termOwner, matchedHighlight){
		let owner = matchedHighlight && matchedHighlight.owner ? matchedHighlight.owner : termOwner;
		let ownerColor = AstroConst.AstroColor[owner];
		if(ownerColor && ownerColor !== AstroConst.AstroColor.Stroke){
			return ownerColor;
		}
		return AstroConst.AstroColor[sig] || ownerColor || AstroConst.AstroColor.Stroke;
	},

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
	},

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
	},

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
	},

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
	},

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
			let lbl = appendPerCharText(lblgroup, txts, termtxt)   // 逐字画字经单一入口(整词定字;后接的宫号节点不挂)
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

	},

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
	},

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
	},
};
