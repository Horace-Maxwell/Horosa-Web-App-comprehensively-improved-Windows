// 星盘圆盘 · 卜卦叠加层、外盘信息、双盘
// 从 AstroChartCircle.js 按职责拆出的 AstroChartCircle 方法:this 仍是 AstroChartCircle 实例,门面里 mixinMethods(AstroChartCircle, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as d3 from 'd3';
import * as AstroConst from '../../../constants/AstroConst';
import { convertLatToStr, convertLonToStr } from '../AstroHelper';
import { getChartRendererClass } from '../../../renderers/xqChartTheme';
import { termsTableForVariant } from '../../../divination/data/hellenisticData';
import { fitSvgTextWidth } from '../../../utils/svgDesignBox';

export const overlayMethods = {
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
		const OV_GOLD = AstroConst.AstroColor.RoyalStar;   // 王星金:亮盘压深、暗盘保亮(盘面调色板成对),画的那一刻读
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
				// parallel=并列路径(月亮独立成事径,主径未成时):细虚线弱化,不与主实线争眼。
				else if(line.kind === 'parallel'){ stroke = OV_GREEN; dash = '3,5'; width = 1.3; opacity = 0.6; }
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
			const svgRoot = g.node() ? g.node().ownerSVGElement : null;
			const svgW = svgRoot ? svgRoot.clientWidth : 0;
			// 舞台把整张 svg 以中心等比放大一点(盘面贴满舞台),放大出去的那一圈落在舞台内衬上甚至被舞台裁掉:
			// 星名的余量按放大前的盒算(折回 svg 自己的坐标),不放大时为 0。
			let stageGrow = 0;
			try{
				const tf = (svgRoot && typeof window !== 'undefined' && window.getComputedStyle) ? window.getComputedStyle(svgRoot).transform : '';
				const mk = /^matrix\(\s*([-\d.e]+)/.exec(tf || '');
				const k = mk ? parseFloat(mk[1]) : 1;
				if(k > 1 && svgW > 0){ stageGrow = svgW * (k - 1) / (2 * k); }
			}catch(e){ stageGrow = 0; }
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
				const label = sg.append('text')
					.attr('transform', `translate(${pt[0]},${pt[1]}) rotate(${-groupRot})`)
					.attr('text-anchor', sx >= 0 ? 'start' : 'end')
					.attr('dominant-baseline', 'central')
					.attr('font-size', 10)
					.attr('stroke', 'none')
					.attr('fill', color)
					.text(st.name || '');
				// 星名从轮缘向外写,落在盘的左右两侧时会越出 svg 盒(舞台窄、盘贴边时被裁一截):按到 svg 左右边的余量收字号(放得下不动)
				if(svgW > 0 && geom.orgx !== undefined){
					const room = sx >= 0 ? (svgW - (geom.orgx + sx)) : (geom.orgx + sx);
					fitSvgTextWidth(label.node(), Math.max(1, room - 2 - stageGrow), 6);
				}
			});
		}
	},

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
			.attr('font-weight', 400)
			.attr('fill', AstroConst.AstroColor.Stroke).attr('stroke', 'none')   // 盘角信息字不描边(全站规矩)
			.attr('transform', function(d, idx){
				let x = width - 200 - margin;
				let y = margin + rowheight * idx;
				let trans = 'translate(' + x + ', ' + y + ')';
				return trans;
			})
			.text(function(d){return d});
		// 原先按「每行 ≤ 200px」放在右上角,经纬度那一行比它宽 → 越出 svg 右边。画完量最宽一行,
		// 整块左移到恰好放得下(仍左对齐;放得下时不动)。量不到(无布局环境)按原位
		let maxW = 0;
		txtg.selectAll('text').each(function(){
			try{ maxW = Math.max(maxW, this.getComputedTextLength ? this.getComputedTextLength() : 0); }catch(e){ /* 无布局 */ }
		});
		const shift = maxW > 0 ? Math.min(0, (width - margin) - (width - 200 - margin) - maxW) : 0;
		if(shift < 0){ txtg.attr('transform', `translate(${shift},0)`); }
	},

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
		// 符号盘(隐度数):强制关掉行星旁度数文本,只留符号(掩码默认不含=零回归)。
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
	},
};
