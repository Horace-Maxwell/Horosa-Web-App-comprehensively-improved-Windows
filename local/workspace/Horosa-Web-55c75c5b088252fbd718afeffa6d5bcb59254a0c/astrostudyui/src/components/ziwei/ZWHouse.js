import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as ZWCont from '../../constants/ZWConst';
import * as ZiWeiHelper from './ZiWeiHelper';
import * as GraphHelper from '../graph/GraphHelper';
import ZWCommHouse from './ZWCommHouse';
import { isLaiyinPalace } from './ziweiSchools';
import {randomStr,} from '../../utils/helper';
// 流派叠层角标/借宫/活盘重排 + 亮度显示层:实现全在基类 ZWCommHouse(四化盘/三合盘共用),本类只调用不再直接依赖开关/名表。

class ZWHouse extends ZWCommHouse {
	constructor(option){
		super(option);
	}

	bindClick(){
		if(this.svg === undefined || this.svg === null){
			return;
		}
		this.svg.on('click', ()=>{ this.clickHouse(); });
	}

	clickHouse(){
		if(this.zwchart && this.zwchart.clickHouse){
			this.zwchart.clickHouse(this.houseObj);
		}
	}

	draw(){
		if(this.flyGanzi && this.flyGanzi === this.houseObj.ganzi){
			this.houseBG = ZWCont.ZWColor.SelectedBG;
		}
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		container.append('rect')
				.attr('fill', this.houseBG)
				.attr('stroke', ZWCont.ZWColor.HouseLineStroke)
				.attr('x', this.x).attr('y', this.y)
				.attr('width', this.width).attr('height', this.height);
		this.svg = container;
		this.bindClick();

		if(this.luckMingIndex !== undefined && this.luckMingIndex !== null && this.luckMingIndex === this.houseIndex){
			container.append('rect')
				.attr('x', this.x + 1.5).attr('y', this.y + 1.5)
				.attr('width', this.width - 3).attr('height', this.height - 3)
				.attr('fill', 'none')
				.attr('stroke', 'var(--horosa-gold, #9a6a25)')
				.attr('stroke-width', 2)
				.attr('rx', 3)
				.attr('pointer-events', 'none');
		}

		if(ZWCont.ZWChart.chart === ZWCont.ZWChart_FeiXing){
			this.drawFeixing();
		}else if(ZWCont.ZWChart.chart === ZWCont.ZWChart_SangHe){
			this.drawSanghe();
		}else if(ZWCont.ZWChart.chart === ZWCont.ZWChart_SiHua){
			this.drawSihua();
		}

		this.drawLaiYing();
		// [D2] 宫底岁数条(默认双关):画在下 1/4 标题带上沿之上,靠左。
		this.drawAgeStrips(this.x + 3, this.y + this.height * 3 / 4 - 3, this.width - 6, 10);
		this.drawOverlayMarks();   // 流派叠层角标/借宫/活盘:实现已上提基类 ZWCommHouse(四化盘/三合盘共用)
	}

	drawSihuaTitle(){
		let h = this.height / 4;
		let w = this.width / 4;
		let x = this.x;
		let y = this.y + this.height * 3 / 4;

		let container = this.svg.append('g');
		container.append('rect')
				.attr('fill', this.houseBG)
				.attr('stroke', ZWCont.ZWColor.HouseLineStroke)
				.attr('x', x).attr('y', y)
				.attr('width', w).attr('height', h);
		this.drawKinastroCornerMark(container, x, y, w, h);
		let data = [];
		let gzsvg = container.append('g');
		let gztip = ZWCont.NaYin[this.houseObj.ganzi];
		if(gztip){
			let tipobj = {
				title: this.houseObj.ganzi,
				tips: '纳音五行：' + gztip,
			};
			this.genTooltip(gzsvg, tipobj, this.houseObj.name)
		}

		let dirX = x + w;
		let dirY = y;
		let dirW = this.width / 2;
		let dirH = h;
		container.append('rect')
				.attr('fill', this.houseBG)
				.attr('stroke', ZWCont.ZWColor.HouseLineStroke)
				.attr('x', dirX).attr('y', dirY)
				.attr('width', dirW).attr('height', dirH);
		if(this.dirname !== undefined && this.dirname !== null && this.dirname.length){
			let dirData = [];
			dirData[0] = '运';
			dirData[1] = this.dirname.substr(0, 1);
			if(dirData[1] == '交' ){
				dirData[1] = '友';
			}
			GraphHelper.drawTextH(container.append('g'), dirData, dirX, dirY, dirW, dirH / 2, this.margin, ZWCont.ZWColor.HouseBranchStroke, 240);
		}

		if(this.yearText){
			let parts = this.yearText.split('年');
			let ageparts = parts[1].split('岁');
			let ydata = [];
			ydata[0] = parts[0].substr(0, 2);
			ydata[1] = parts[0].substr(2, 2);
			ydata[2] = '年';
			ydata[3] = ageparts[0];
			ydata[4] = '岁';
			let yearH = 12;
			let yearW = yearH * ydata.length;
			let yearX = this.x + (this.width - yearW) / 2;
			GraphHelper.drawTextH(container.append('g'), ydata, yearX, dirY-yearH - 0.5*yearH, yearW, yearH, 1, ZWCont.ZWColor.HouseAgeStroke);
		}

		let dirSubX1 = dirX;
		let dirSubY1 = dirY + dirH / 2;
		let dirSubX2 = dirX + dirW;
		let dirSubY2 = dirSubY1;
		container.append('line')
				.attr('x1', dirSubX1)
				.attr('y1', dirSubY1)
				.attr('x2', dirSubX2)
				.attr('y2', dirSubY2)
				.attr('stroke', ZWCont.ZWColor.HouseLineStroke);

		let dirData = [];
		dirData[0] = this.houseObj.direction[0] + '';
		dirData[1] = '~';
		dirData[2] = this.houseObj.direction[1] + '';
		GraphHelper.drawTextH(container.append('g'), dirData, dirSubX1, dirSubY2, dirW, dirH / 2, this.margin, ZWCont.ZWColor.HouseAgeStroke, 140);

		let titleX = dirX + dirW;
		let titleY = y;
		let titleW = this.width - w - dirW;
		let titleH = h;
		container.append('rect')
				.attr('fill', this.houseBG)
				.attr('stroke', ZWCont.ZWColor.HouseLineStroke)
				.attr('x', titleX).attr('y', titleY)
				.attr('width', titleW).attr('height', titleH);
		let housesvg = this.drawHouseTitleText(container.append('g'), {
			x: titleX,
			y: titleY,
			w: titleW,
			h: titleH,
		});
		let tip = this.ZWRules.RuleHouses[this.houseObj.name];
		if(tip){
			let tipobj = {
				title: this.houseObj.name,
				tips: tip,
			};
			this.genTooltip(housesvg, tipobj, this.houseObj.name)
		}
		
	}

	drawKinastroCornerMark(group, x, y, w, h){
		if(!this.kinastroBorrowed || !this.houseObj || !this.houseObj.kinastroCornerMark){
			return;
		}
		const sz = Math.max(14, Math.min(w * 0.42, h * 0.58));
		group.append('text')
			.attr('class', 'horosa-ziwei-kinastro-corner-mark')
			.attr('x', x + w / 2)
			.attr('y', y + h / 2)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'middle')
			.attr('fill', 'var(--horosa-ziwei-house-title, var(--horosa-ziwei-house-name, #f3d18b))')
			.attr('stroke', 'none')
			.attr('font-size', `${sz}px`)
			.attr('font-weight', 800)
			.attr('font-family', AstroConst.NormalFont)
			.text(this.houseObj.kinastroCornerMark);
	}

	drawHouseTitleText(group, ord){
		const name = `${this.effectiveHouseName()}`.replace(/[宫宮]$/, '');
		const ganzi = this.houseObj.ganzi || '';
		const nameSize = Math.max(14, Math.min(ord.w * 0.46, ord.h * 0.54));
		const ganziSize = Math.max(9, Math.min(ord.w * 0.30, ord.h * 0.28));
		const cx = ord.x + ord.w / 2;
		const nameY = ord.y + ord.h * 0.36;
		const ganziY = ord.y + ord.h * 0.72;
		group.append('text')
			.attr('class', 'horosa-ziwei-house-name-hit')
			.attr('x', cx)
			.attr('y', nameY)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'middle')
			.attr('fill', 'var(--horosa-ziwei-house-title, var(--horosa-ziwei-house-name, #f3d18b))')
			.attr('stroke', 'none')
			.attr('font-size', `${nameSize}px`)
			.attr('font-weight', 800)
			.attr('font-family', AstroConst.NormalFont)
			.text(name);
		group.append('text')
			.attr('class', 'horosa-ziwei-house-ganzi-hit')
			.attr('x', cx)
			.attr('y', ganziY)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'middle')
			.attr('fill', ZWCont.ZWColor.HouseAgeStroke)
			.attr('stroke', 'none')
			.attr('font-size', `${ganziSize}px`)
			.attr('font-weight', 620)
			.attr('font-family', AstroConst.NormalFont)
			.text(ganzi);
		return group;
	}

	drawSihuaStars(){
		const showOthers = ZiWeiHelper.zwShowOthers();
		const main = this.houseObj.starsMain || [];
		const assist = this.houseObj.starsAssist || [];
		// [D1] 神煞三组显示过滤(纯显示层,列宽计算前;默认全开=原引用零变化)
		const evil = ZiWeiHelper.filterShenshaForDisplay(this.houseObj.starsEvil || []);
		const othersGood = showOthers ? ZiWeiHelper.filterShenshaForDisplay(this.houseObj.starsOthersGood || []) : [];
		const othersBad = showOthers ? ZiWeiHelper.filterShenshaForDisplay(this.houseObj.starsOthersBad || []) : [];
		const protectedCount = main.length + assist.length + evil.length;
		const othersCount = othersGood.length + othersBad.length;
		const total = protectedCount + othersCount;
		if(!total){
			return;
		}
		// 需求4：仅压缩杂曜(杂吉/杂凶)列宽，主辅煞(十四主星/辅星/煞曜)保舒适列宽。
		const baseStarSize = this.starFontSize || this.fontSize;
		const wpFull = baseStarSize + this.margin/2;
		let wProtected; let wOthers;
		if(total * wpFull <= this.width){
			wProtected = wpFull; wOthers = wpFull;
		}else{
			const remain = this.width - protectedCount * wpFull;
			const minOther = this.fontSize * 0.5 + this.margin/2;
			if(othersCount > 0 && remain >= othersCount * minOther){
				wProtected = wpFull; wOthers = remain / othersCount;
			}else{
				const avg = (this.width - this.margin*total) / total;
				wProtected = Math.min(wpFull, avg); wOthers = wProtected;
			}
		}
		const y = this.y;
		const h = this.kinastroBorrowed ? (wProtected*4 + this.margin*4) : (wProtected*2 + this.margin*2);
		// 二轮：四化按层固定槽位对齐——统一槽高+统一起点(h,星名格底),跨星同层同水平线。
		this.luckSlotH = baseStarSize + this.margin;
		let x = this.x;
		const drawGroup = (arr, gw, color, nameWeight, sizeScale)=>{
			for(let i=0; i<arr.length; i++){
				// [D1] color 允许传函数(按星名定色;六煞黑字档用),字符串=整组同色(原行为)。
				const c = typeof color === 'function' ? color(arr[i] && arr[i].name) : color;
				this.drawStar(arr[i], x, y, gw, h, c, nameWeight, sizeScale);
				x += gw;
			}
		};
		drawGroup(main, wProtected, ZWCont.ZWColor.StarMainStroke, 760, 1.16);
		drawGroup(assist, wProtected, ZWCont.ZWColor.StarAssistStroke, 560, 1);
		drawGroup(evil, wProtected, ZiWeiHelper.colorForEvilStar, 560, 1);
		drawGroup(othersGood, wOthers, ZWCont.ZWColor.StarOthersGoodStroke, 480, 1);
		drawGroup(othersBad, wOthers, ZWCont.ZWColor.StarOthersBadStroke, 480, 1);
	}

	// P0-1：十二神（长生/博士/将前/岁前，starsSmall）放本宫左下角"纳音格"内，小字单列，不挤主星行。
	// 角格坐标 = (this.x, this.y+height*3/4, width/4, height/4)，与 drawSihuaTitle 的纳音格一致。
	drawSihuaSmallStars(cx, cy, cw, ch){
		if(!ZiWeiHelper.zwShowSmall()){
			return;
		}
		// [D3] 流年神煞上盘:绘制期替换(将前/岁前→流年版),再过显示过滤;chart 数据零触碰。
		const smallsRaw = ZiWeiHelper.resolveSmallStarsForDisplay(this.houseObj.starsSmall || [], this.houseObj.ganzi ? this.houseObj.ganzi.charAt(1) : null, this.zwchart ? this.zwchart.flowZhi : null);
		const smalls = ZiWeiHelper.filterShenshaForDisplay(smallsRaw);
		if(!smalls.length){
			return;
		}
		// 照抄三合盘 ZWHouseSangHe.drawTitle 的十二神排法：每神一行(ch/3)、横排二字、
		// GraphHelper.drawTextH、StarSmallStroke、weight 400（与三合盘逐字同款，外观一致）。
		let data = [];
		// [D0] 行高溢出守卫:恒 3 条时 rowH=ch/3(现状零变化);未来条数>3(如流年神煞替换)自动压行防溢出角格。
		const rowH = ch / Math.max(3, smalls.length);
		for(let i=0; i<smalls.length; i++){
			let star = smalls[i];
			if(!star || !star.name){
				continue;
			}
			let sy = cy + i*rowH;
			data = star.name.split('');   // [D3] 流年版名 3 字(「流」前缀),split 全展;本命 2 字行为同前
			const smColor = star.flow ? ZWCont.ZWPeriodColor.liunian : ZWCont.ZWColor.StarSmallStroke;
			let g = GraphHelper.drawTextH(this.svg.append('g'), data, cx, sy, cw, rowH, 1.5, smColor, 400);
			if(star.flow && star.natal && g){
				this.genTooltip(g, { title: star.name, tips: [`流年神煞(随所选流年);本命此位为「${star.natal}」`] }, star.name);
			}
			let tip = this.ZWRules && this.ZWRules.RuleStars ? this.ZWRules.RuleStars[star.name] : null;
			if(g && tip){
				this.genTooltip(g, { title: star.name, tips: tip }, star.name);
			}
		}
	}

	drawSihua(){
		this.drawSihuaTitle();
		this.drawSihuaStars();
		// 十二神放左下角"纳音格"（与 drawSihuaTitle 首格同坐标），不挤主星行。
		this.drawSihuaSmallStars(this.x, this.y + this.height * 3 / 4, this.width / 4, this.height / 4);
		this.drawLuckLabels(this.x + this.width - 28, this.y + this.height * 3 / 4 - 2);
	}

	shouldShowStarLight(){
		// 演禽借宫盘恒显(跨技法不惊扰);常规盘沿旧「非四化盘才显」再叠用户开关(默认开=零回归)
		return this.kinastroBorrowed || (ZWCont.ZWChart.chart !== ZWCont.ZWChart_SiHua && ZiWeiHelper.zwShowStarLight());
	}



	drawSanghe(){

	}
	


	drawFeixing(){

	}

	drawStar(star, x, y, w, h, color, nameWeight = 100, sizeScale = 1){
		if(!star || !star.name){
			return;
		}
		const sl = this.effStarLight(star);   // 显示层庙旺(亮度源 quanshu 时叠《全书》delta)
		if(this.kinastroBorrowed){
			this.drawKinastroStar(star, x, y, w, h, color, nameWeight, sizeScale);
			return;
		}
		let txt = [];
		for(let i=0; i<star.name.length; i++){
			txt[i] = star.name.charAt(i) + '';
		}
		let textW = w * sizeScale;
		let textH = h * sizeScale;
		let textX = x + (w - textW) / 2;
		let textY = y + (h - textH) / 2;
		let flyhua = null;
		if(this.flyGanzi && !this.kinastroBorrowed){
			let gan = this.flyGanzi.charAt(0) + '';
			flyhua = ZiWeiHelper.getSiHua(star.name, gan);
		}
		let starsvg = null;
		if(flyhua){
			let coloropt = ZWCont.ZWColor[flyhua];
			starsvg = GraphHelper.drawTextV(this.svg.append('g'), txt, textX, textY, textW, textH, 2, 
				coloropt.color, nameWeight, coloropt.bg);
			starsvg.selectAll('text').attr('fill', coloropt.color).attr('stroke', 'none');
		}else{
			starsvg = GraphHelper.drawTextV(this.svg.append('g'), txt, textX, textY, textW, textH, 2, color, nameWeight);
			starsvg.selectAll('text').attr('fill', color).attr('stroke', 'none');
		}
		let tip = this.ZWRules.RuleStars[star.name];
		if(tip){
			let tipobj = {
				title: star.name,
				tips: tip,
			};
			this.genTooltip(starsvg, tipobj, star.name)
		}
		const metaText = [this.shouldShowStarLight() ? sl : '', star.flyTo ? `→${star.flyTo}` : ''].filter(Boolean).join(' ');
		if(metaText){
			this.svg.append('text')
				.attr('x', x + w / 2)
				.attr('y', y + h - 2)
				.attr('dominant-baseline', 'auto')
				.attr('text-anchor', 'middle')
				.attr('fill', star.flyTo ? '#cda24d' : 'var(--horosa-muted, #8a8f95)')
				.attr('stroke', 'none')
				.attr('font-size', `${Math.max(7, Math.min(9, Math.round(w * 0.42)))}px`)
				.attr('font-weight', 620)
				.attr('font-family', AstroConst.NormalFont)
				.text(metaText);
		}

		let dim = {
			x: x,
			y: y,
			w: w,
			h: h
		};
		// 运限四化叠层（需求5 + 二轮按层对齐）：baseOffset=h(星名格底,各星统一)、slotH=this.luckSlotH(统一槽高);clamp 不越上半矩形(需求4)。
		const luckMaxBottom = this.y + this.height * 3 / 4 - 2;
		dim.h = this.drawLuckSihuaForStar(star, x, y, w, h, this.luckSlotH || (w + this.margin), 2, luckMaxBottom);
		// [D2] 干系四化徽(命/日,默认关):运限槽之后的固定槽位,同越界保护。
		this.drawStemSihuaChips(star, x, y, w, h, this.luckSlotH || (w + this.margin), 2, luckMaxBottom);
		this.stars.set(star.name, dim);
	}

	drawKinastroStar(star, x, y, w, h, color, nameWeight = 760, sizeScale = 1){
		const sl = this.effStarLight(star);   // 显示层庙旺（借宫演禽路径也须本地取值，否则 sl 未定义）
		const txt = [];
		for(let i=0; i<star.name.length; i++){
			txt[i] = star.name.charAt(i) + '';
		}
		const group = this.svg.append('g').attr('class', 'horosa-ziwei-kinastro-star-stack');
		const fontSize = Math.max(16, Math.min(22, Math.round((w - 3) * sizeScale)));
		const nameW = Math.max(fontSize + 3, Math.min(w * sizeScale, w + 2));
		const nameH = Math.max(fontSize * txt.length + txt.length + 2, fontSize + 4);
		const nameX = x + (w - nameW) / 2;
		let cursorY = y + 1;
		let starsvg = GraphHelper.drawTextV(group, txt, nameX, cursorY, nameW, nameH, 1, color, nameWeight || 760);
		starsvg.selectAll('text')
			.attr('fill', color)
			.attr('stroke', 'none')
			.attr('font-weight', nameWeight || 760);
		cursorY += nameH + 1;

		if(this.shouldShowStarLight() && sl){
			group.append('text')
				.attr('class', 'horosa-ziwei-kinastro-star-light')
				.attr('x', x + w / 2)
				.attr('y', cursorY + 6)
				.attr('dominant-baseline', 'middle')
				.attr('text-anchor', 'middle')
				.attr('fill', 'var(--horosa-ziwei-house-age, #8794a8)')
				.attr('stroke', 'none')
				.attr('font-size', `${Math.max(10, Math.min(12, Math.round(w * 0.46)))}px`)
				.attr('font-weight', 680)
				.attr('font-family', AstroConst.NormalFont)
				.text(sl);
			cursorY += 14;
		}

		let hua = star.hua;
		if(hua === '祿'){
			hua = '禄';
		}
		if(hua){
			let coloropt = ZWCont.ZWColor[hua] || ZWCont.ZWColor.StarMainStroke;
			const badgeSize = Math.max(16, Math.min(21, w + 1));
			const badgeX = x + (w - badgeSize) / 2;
			let huasvg = GraphHelper.drawTextV(group, [hua], badgeX, cursorY, badgeSize, badgeSize, 1,
				coloropt.color || '#ffffff', 850, coloropt.bg || ZWCont.ZWColor.StarMainStroke);
			huasvg.selectAll('text')
				.attr('fill', coloropt.color || '#ffffff')
				.attr('stroke', 'rgba(0, 0, 0, 0.34)')
				.attr('stroke-width', 0.55)
				.attr('paint-order', 'stroke')
				.attr('font-weight', 850);
			cursorY += badgeSize + 2;
		}

		if(star.flyTo){
			const flyBranch = `${star.flyTo}`.replace(/[宫宮]$/, '').slice(-1);
			const flyW = Math.max(20, Math.min(25, w + 3));
			const flyH = Math.max(21, Math.min(26, flyW));
			const tipH = Math.max(4, Math.round(flyH * 0.22));
			const flyX = x + (w - flyW) / 2;
			const flyY = cursorY;
			const flyMidX = flyX + flyW / 2;
			const flyBottom = flyY + flyH;
			group.append('rect')
				.attr('class', 'horosa-ziwei-kinastro-fly-badge')
				.attr('x', flyX)
				.attr('y', flyY)
				.attr('width', flyW)
				.attr('height', flyH)
				.attr('rx', 3)
				.attr('ry', 3)
				.attr('fill', 'rgba(205, 162, 77, 0.14)')
				.attr('stroke', '#cda24d')
				.attr('stroke-width', 1.25);
			group.append('path')
				.attr('class', 'horosa-ziwei-kinastro-fly-tip')
				.attr('d', `M${flyMidX - tipH},${flyBottom - 1} L${flyMidX + tipH},${flyBottom - 1} L${flyMidX},${flyBottom + tipH} Z`)
				.attr('fill', 'rgba(205, 162, 77, 0.14)')
				.attr('stroke', '#cda24d')
				.attr('stroke-width', 1.25)
				.attr('stroke-linejoin', 'round');
			const flyFont = Math.max(14, Math.min(17, Math.round(flyW * 0.72)));
			group.append('text')
				.attr('class', 'horosa-ziwei-kinastro-fly-text')
				.attr('x', flyMidX)
				.attr('y', flyY + flyH / 2 + 0.5)
				.attr('dominant-baseline', 'middle')
				.attr('text-anchor', 'middle')
				.attr('fill', '#f3d18b')
				.attr('stroke', 'rgba(0, 0, 0, 0.32)')
				.attr('stroke-width', 0.45)
				.attr('paint-order', 'stroke')
				.attr('font-size', `${flyFont}px`)
				.attr('font-weight', 850)
				.attr('font-family', AstroConst.NormalFont)
				.text(flyBranch);
			cursorY += flyH + tipH + 3;
		}

		let tip = this.ZWRules && this.ZWRules.RuleStars ? this.ZWRules.RuleStars[star.name] : null;
		if(tip){
			this.genTooltip(group, {
				title: star.name,
				tips: tip,
			}, star.name);
		}
		this.stars.set(star.name, {
			x,
			y,
			w,
			h: Math.min(h, cursorY - y),
		});
	}

	drawLaiYing(){
		let hw = this.fontSize;
		let hh = hw * 2 + this.margin;
		let hx = this.x + this.width - 25;
		let hy = this.y + this.height - this.height/4 - hh - 10;
		let color = AstroConst.AstroColor.Stroke;
		// 来因判据走 isLaiyinPalace 单源(宫干==年干且非子丑借干宫;两盘/快照/报告四处同谓词)
		// [D1] 套显示开关(默认开=现状);标记块连排递移 hx(与三合盘同布局语法)。
		if(ZiWeiHelper.zwShowLaiyin() && isLaiyinPalace(this.houseObj.ganzi, this.chartObj.yearGan)){
			let txt = ['来', '因'];
			GraphHelper.drawTextV(this.svg.append('g'), txt, hx, hy, hw, hh, 2, 
				color, null, null, color);
			hx = hx - hw - this.margin;
		}
		// [D1] 四化盘补画身宫标记(两盘统一;此前仅三合盘有,四化盘身宫无任何盘面标识)。
		if(ZiWeiHelper.zwShowBodyPalace() && this.houseObj.isBody && !this.kinastroBorrowed){
			let txt = ['身', '宫'];
			GraphHelper.drawTextV(this.svg.append('g'), txt, hx, hy, hw, hh, 2, 
				color, null, null, color);
		}
	}
	
}

export default ZWHouse;
