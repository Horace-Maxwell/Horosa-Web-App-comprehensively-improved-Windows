import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as ZWCont from '../../constants/ZWConst';
import * as ZiWeiHelper from './ZiWeiHelper';
import * as GraphHelper from '../graph/GraphHelper';
import ZWCommHouse from './ZWCommHouse';
import { isLaiyinPalace } from './ziweiSchools';
import {randomStr,} from '../../utils/helper';
// 注:getYearJiang/getTaisui 原用于「点宫后把本命将前/岁前十二神改写成流年神煞」,
// 该逻辑已按 BUG-H 移除(本命神煞应恒定),故不再 import。

class ZWHouseSangHe extends ZWCommHouse {
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
		if(this.flyGanzi){
			if(this.flyGanzi === this.houseObj.ganzi){
				this.houseBG = ZWCont.ZWColor.SelectedBG;
			}else{
				let starthouse = this.zwchart.flyHouse;
				if(starthouse){
					let zi = starthouse.ganzi.substr(1,1);
					let fromIdx = ZiWeiHelper.getHouseZiIndex(zi);
					let caiIdx = (fromIdx - 4 + 12) % 12;
					let guanIdx = (fromIdx + 4) % 12;
					let qianIdx = (fromIdx + 6) % 12;
					let houseidx = ZiWeiHelper.getHouseZiIndex(this.houseObj.ganzi.substr(1,1));
					if(caiIdx === houseidx || guanIdx === houseidx){
						this.houseBG = ZWCont.ZWColor.SangHeBG;
					}else if(qianIdx === houseidx){
						this.houseBG = ZWCont.ZWColor.DuiGongBG;
					}
				}		
			}
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

		this.drawHouse();

		this.drawLaiYing();
		// [D2] 宫底岁数条(默认双关):画在下 1/4 标题带上沿之上,靠左。
		this.drawAgeStrips(this.x + 3, this.y + this.height * 3 / 4 - 3, this.width - 6, 10);
		this.drawKinastroLiunianRow();   // 策天(移语本)流年星徽行:基类实现,与四化盘同源
		this.drawOverlayMarks();   // 流派叠层角标/借宫/活盘:基类 ZWCommHouse 统一实现(与四化盘同源,三合盘同样生效)
	}

	drawTitle(){
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
		// 「显示十二神」全局开关:与四化盘 ZWHouse.drawSihuaSmallStars 同口径——关则不绘长生/博士/将前/岁前十二神。
		// [D3] 流年神煞上盘:绘制期替换(将前/岁前→流年版),再过显示过滤;chart 数据零触碰。
		const smallsRaw = ZiWeiHelper.resolveSmallStarsForDisplay(this.houseObj.starsSmall || [], this.houseObj.ganzi ? this.houseObj.ganzi.charAt(1) : null, this.zwchart ? this.zwchart.flowZhi : null);
		const smalls = ZiWeiHelper.zwShowSmall() ? ZiWeiHelper.filterShenshaForDisplay(smallsRaw) : [];
		for(let i=0; i<smalls.length; i++){
			let star = smalls[i];
			let sy = y + i*h/3;
			data = star.name.split('');   // [D3] 流年版名 3 字(「流」前缀),split 全展;本命 2 字行为同前
			// BUG-H 修复:此前在点过任意宫位(flyHouse 非空)后,会把本命「将前十二神(i===1)/
			// 岁前十二神(i===2)」改写成以被点宫地支为流年支重新起算的流年将星/流年太岁,
			// 导致本命神煞随点击变化。本命神煞应恒定不变,故移除该改写;flyHouse 仍只驱动三方四正高亮。
			// [D3] 正确语义的流年替换由「选中流年」驱动(resolveSmallStarsForDisplay,star.flow 标记),期紫显色。
			const smColor = star.flow ? ZWCont.ZWPeriodColor.liunian : ZWCont.ZWColor.StarSmallStroke;
			const smG = GraphHelper.drawTextH(container.append('g'), data, x, sy, w, h/3, 1.5, smColor, 400);
			if(star.flow && star.natal && smG){
				this.genTooltip(smG, { title: star.name, tips: [`流年神煞(随所选流年);本命此位为「${star.natal}」`] }, star.name);
			}
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
		if(this.kinastroBorrowed && this.houseObj && this.houseObj.kinastroXianName){
			// 策天(移语本):限名真值(禄限/紫限…)——直接 fill 文本无描边(与四化盘同口径,用户点名去描边)。
			const xn = `${this.houseObj.kinastroXianName}`.slice(0, 2);
			const xnSize = Math.max(12, Math.min(15, Math.round(dirH * 0.5)));
			container.append('text')
				.attr('class', 'horosa-ziwei-kinastro-xian-name')
				.attr('x', dirX + dirW / 2)
				.attr('y', dirY + dirH / 4 + 0.5)
				.attr('dominant-baseline', 'middle')
				.attr('text-anchor', 'middle')
				.attr('fill', ZWCont.ZWColor.HouseBranchStroke)
				.attr('stroke', 'none')
				.attr('font-size', `${xnSize}px`)
				.attr('font-weight', 650)
				.attr('letter-spacing', '1.5px')
				.attr('font-family', AstroConst.NormalFont)
				.text(xn);
		}else if(this.dirname !== undefined && this.dirname !== null && this.dirname.length){
			let dirData = [];
			dirData[0] = '运';
			dirData[1] = this.dirname.substr(0, 1);
			if(dirData[1] === '交'){ dirData[1] = '友'; } // 交友宫简写「友」(与四化盘 drawSihuaTitle 同口径)
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

		let titleGroup = this.drawHouseTitleText(container.append('g'), {
			x: titleX,
			y: titleY,
			w: titleW,
			h: titleH,
		});
		let gzsvg = titleGroup.select('.horosa-ziwei-house-ganzi-hit');
		let gztip = ZWCont.NaYin[this.houseObj.ganzi];
		if(gztip){
			let tipobj = {
				title: this.houseObj.ganzi,
				tips: '纳音五行：' + gztip,
			};
			this.genTooltip(gzsvg, tipobj, this.houseObj.name)
		}

		let housesvg = titleGroup.select('.horosa-ziwei-house-name-hit');
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
		const name = `${this.effectiveHouseName()}`.replace(/[宫宮]$/, '');   // 活盘:太极点重排后的人事宫名(基类共用)
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

	drawStars(){
		const main = this.houseObj.starsMain || [];
		const assist = this.houseObj.starsAssist || [];
		// [D1] 神煞三组显示过滤(纯显示层,列宽计算前;默认全开=原引用零变化)
		const evil = ZiWeiHelper.filterShenshaForDisplay(this.houseObj.starsEvil || []);
		// 「显示杂曜」全局开关:与四化盘 ZWHouse.drawSihuaStars 同口径——关则不绘杂吉/杂凶(纯显示,不动排盘数据)。
		const showOthers = ZiWeiHelper.zwShowOthers();
		const othersGood = showOthers ? ZiWeiHelper.filterShenshaForDisplay(this.houseObj.starsOthersGood || []) : [];
		const othersBad = showOthers ? ZiWeiHelper.filterShenshaForDisplay(this.houseObj.starsOthersBad || []) : [];
		const protectedCount = main.length + assist.length + evil.length;
		const othersCount = othersGood.length + othersBad.length;
		const total = protectedCount + othersCount;
		if(!total){
			return;
		}
		// 需求4：主辅煞(十四主星/辅星/煞曜)保舒适列宽；仅当整行宽溢出时只压缩杂曜(杂吉/杂凶)列宽，主辅煞不缩。
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
		// 需求4：上半星区竖向给到标题带顶；四化叠层在 drawStar 内 clamp 不越界。
		const y = this.y;
		const h = this.kinastroBorrowed ? (wProtected*4 + this.margin*4) : (wProtected*3 + this.margin*2);
		// 二轮：四化按层固定槽位对齐——统一槽高(基于未缩主星宽)+统一起点(h,星名区底),跨星同层同水平线。
		this.luckSlotH = baseStarSize + this.margin;
		let x = this.x;
		const drawGroup = (arr, gw, color, scale, weight)=>{
			for(let i=0; i<arr.length; i++){
				// [D1] color 允许传函数(按星名定色;六煞黑字档用),字符串=整组同色(原行为)。
				const c = typeof color === 'function' ? color(arr[i] && arr[i].name) : color;
				this.drawStar(arr[i], x, y, gw, h, c, scale, weight);
				x += gw;
			}
		};
		drawGroup(main, wProtected, ZWCont.ZWColor.StarMainStroke, 1, 700);
		drawGroup(assist, wProtected, ZWCont.ZWColor.StarAssistStroke, 0.9, 520);
		drawGroup(evil, wProtected, ZiWeiHelper.colorForEvilStar, 0.9, 520);
		drawGroup(othersGood, wOthers, ZWCont.ZWColor.StarOthersGoodStroke, 0.9, 520);
		drawGroup(othersBad, wOthers, ZWCont.ZWColor.StarOthersBadStroke, 0.9, 520);
	}

	drawHouse(){
		this.drawTitle();
		this.drawStars();
	}


	drawStar(star, x, y, w, h, color, scale = 1, nameWeight = 100){
		if(!star || !star.name){
			return;
		}
		if(this.kinastroBorrowed){
			this.drawKinastroStar(star, x, y, w, h, color, scale, nameWeight);
			return;
		}
		// 显示层庙旺(非默认亮度源时叠 delta);受「庙旺标注」显示开关控制(默认开=零回归)
		const sl = ZiWeiHelper.zwShowStarLight() ? this.effStarLight(star) : '';
		let txt = [];
		for(let i=0; i<star.name.length; i++){
			txt[i] = star.name.charAt(i) + '';
		}

		let mgn = 1;
		let nameFontSize = Math.max(12, Math.round((w - 2 * mgn) * scale));
		let nameW = nameFontSize + mgn * 2;
		let nameX = x + (w - nameW) / 2;
		let nameH = txt.length * (nameFontSize + mgn) + mgn * 2;
		let lightTxt = [];
		const metaText = [sl, star.flyTo ? `→${star.flyTo}` : ''].filter(Boolean).join('');
		if(metaText){
			for(let i=0; i<metaText.length; i++){
				lightTxt[i] = metaText.charAt(i) + '';
			}
		}
		let lightFontSize = Math.max(9, Math.round(nameFontSize * 0.58));
		let lightGap = lightTxt.length ? 2 : 0;
		let lightH = lightTxt.length ? lightTxt.length * (lightFontSize + 1) + mgn * 2 : 0;
		let starGroup = this.svg.append('g');

		let flyhua = null;
		if(this.flyGanzi && !this.kinastroBorrowed){
			let gan = this.flyGanzi.charAt(0) + '';
			flyhua = ZiWeiHelper.getSiHua(star.name, gan);
		}
		let starsvg = null;
		if(flyhua){
			let coloropt = ZWCont.ZWColor[flyhua];
			starsvg = GraphHelper.drawTextV(starGroup, txt, nameX, y, nameW, nameH, mgn, 
				coloropt.color, nameWeight, coloropt.bg);
			starsvg.selectAll('text').attr('fill', coloropt.color).attr('stroke', 'none');
		}else{
			starsvg = GraphHelper.drawTextV(starGroup, txt, nameX, y, nameW, nameH, mgn, color, nameWeight);
			starsvg.selectAll('text').attr('fill', color).attr('stroke', 'none');
		}
		if(lightTxt.length){
			let lightW = Math.max(12, Math.min(w, lightFontSize + mgn * 2));
			let lightX = x + (w - lightW) / 2;
			GraphHelper.drawTextV(starGroup, lightTxt, lightX, y + nameH + lightGap, lightW, lightH, mgn, star.flyTo ? '#cda24d' : 'var(--horosa-muted, #8a8f95)');
		}

		let tip = this.ZWRules.RuleStars[star.name];
		if(tip){
			let tipobj = {
				title: star.name,
				tips: tip,
			};
			this.genTooltip(starGroup, tipobj, star.name)
		}

		let dim = {
			x: x,
			y: y,
			w: w,
			h: h
		};
		// 运限四化叠层（需求5 + 二轮按层对齐）：统一滑窗(末3层；无运限=本命四化+自化)，替代原「本命+自化+大限」三段。
		// baseOffset=h(星名区底,各星统一→跨星对齐)、slotH=this.luckSlotH(统一槽高)；clamp 不越宫格上半矩形(需求4)。
		const luckMaxBottom = this.y + this.height * 3 / 4 - 2;
		dim.h = this.drawLuckSihuaForStar(star, x, y, w, h, this.luckSlotH || (w + this.margin), mgn, luckMaxBottom);
		// [D2] 干系四化徽(命/日,默认关):运限槽之后的固定槽位,同越界保护。
		this.drawStemSihuaChips(star, x, y, w, h, this.luckSlotH || (w + this.margin), mgn, luckMaxBottom);
		this.stars.set(star.name, dim);
	}

	drawKinastroStar(star, x, y, w, h, color, scale = 1, nameWeight = 760){
		const sl = this.effStarLight(star);   // 显示层庙旺（借宫演禽路径也须本地取值，否则 sl 未定义）
		const txt = [];
		for(let i=0; i<star.name.length; i++){
			txt[i] = star.name.charAt(i) + '';
		}
		const group = this.svg.append('g').attr('class', 'horosa-ziwei-kinastro-star-stack');
		const fontSize = Math.max(16, Math.min(22, Math.round((w - 3) * scale)));
		const nameW = Math.max(fontSize + 3, Math.min(w * scale, w + 2));
		const nameH = Math.max(fontSize * txt.length + txt.length + 2, fontSize + 4);
		const nameX = x + (w - nameW) / 2;
		let cursorY = y + 1;
		let starsvg = GraphHelper.drawTextV(group, txt, nameX, cursorY, nameW, nameH, 1, color, nameWeight || 760);
		starsvg.selectAll('text')
			.attr('fill', color)
			.attr('stroke', 'none')
			.attr('font-weight', nameWeight || 760);
		cursorY += nameH + 1;

		if(sl){
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
	
		// 来因判据走 isLaiyinPalace 单源(宫干==年干且非子丑借干宫)——旧实现不排子丑,
		// 辛年丑宫/壬年子宫会画假来因,与四化盘/快照/报告口径分叉(复查实锤已统一)
		if(ZiWeiHelper.zwShowLaiyin() && isLaiyinPalace(this.houseObj.ganzi, this.chartObj.yearGan)){
			let txt = ['来', '因'];
			GraphHelper.drawTextV(this.svg.append('g'), txt, hx, hy, hw, hh, 2, 
				color, null, null, color);		

			hx = hx - hw - this.margin;
		}
		
		if(ZiWeiHelper.zwShowBodyPalace() && this.houseObj.isBody && !this.kinastroBorrowed){
			let txt = ['身', '宫'];
			GraphHelper.drawTextV(this.svg.append('g'), txt, hx, hy, hw, hh, 2, 
				color, null, null, color);		
			hx = hx - hw - this.margin;
		}

		let txt = [this.houseObj.phase.substr(0, 1)];
		if(this.houseObj.phase.length > 1){
			txt.push(this.houseObj.phase.substr(1, 1))
		}
		hw = 16;
		hh = hw*txt.length;
		hy = this.y + this.height*3/4 - hh;
		hx = hx + this.margin;
		GraphHelper.drawTextV(this.svg.append('g'), txt, hx, hy, hw, hh, 2, color);
		this.drawLuckLabels(hx - 3, this.y + this.height * 3 / 4 - 2);		
	}

	
}

export default ZWHouseSangHe;
