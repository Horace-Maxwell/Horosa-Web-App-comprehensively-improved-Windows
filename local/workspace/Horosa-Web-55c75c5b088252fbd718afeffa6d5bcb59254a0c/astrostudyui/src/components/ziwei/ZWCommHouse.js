import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as ZWCont from '../../constants/ZWConst';
import * as ZiWeiHelper from './ZiWeiHelper';
import * as GraphHelper from '../graph/GraphHelper';
import D3Arrow from '../graph/D3Arrow';
import {randomStr, creatTooltip, genHtml, positionFloatingTooltip} from '../../utils/helper';
import { ZWEngineOptions } from './ziweiOptions';           // 亮度源(显示层庙旺覆盖)
import { starLightOf, HOUSES as HOUSE_NAMES } from './data/ziweiTables';    // 亮度单一取值口 + 活盘重排名表
import { borrowedStars } from './ziweiOverlays';           // 中州借宫(空宫借对宫十四正曜)

export default class ZWCommHouse {
	constructor(option){
		this.owner = option.owner;
		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;
		this.houseObj = option.houseObj;
		this.dirname = option.dirname;
		this.yearText = option.yearText;
		this.chartObj = option.chartObj;
		this.flyGanzi = option.flyGanzi;
		this.zwchart = option.zwchart;
		this.dirIndex = option.dirIndex;
		this.houseIndex = option.houseIndex;
		this.luckMingIndex = option.luckMingIndex;
		// 运限渲染数据（需求3/5）：四化滑窗层(末3层)、自化开关、长生左侧标签层；由 ZWChart 经 opt 注入。
		this.luckSihuaLayers = option.luckSihuaLayers || null;
		this.luckShowZihua = option.luckShowZihua !== false;
		this.luckLabelLayers = option.luckLabelLayers || null;
		if(this.houseObj){
			this.houseObj.houseChart = this;
		}
		this.onTipClick = option.onTipClick;

		this.margin = 3;
		this.svg = null;
		this.id = 'house' + randomStr(8);

		this.stars = new Map();
		this.fontSize = 18;
		this.starFontSize = 23;
		this.kinastroBorrowed = !!option.kinastroBorrowed;
		if(option.kinastroBorrowed){
			this.fontSize = 17;
			this.starFontSize = 25;
		}
		// 盘底随主题(明暗)：原 ChartBackgroud=0x000000 是恒黑、不跟主题(切明暗不变·很丑)，改themed令牌。
		this.houseBG = 'var(--horosa-ziwei-chart-bg, #f6f1e7)';

		this.divTooltip = option.divTooltip;
		this.divTooltipId = option.divTooltipId;

		this.ZWRules = option.rules ? option.rules.ZWRules : null;
		this.ZWRuleSihua = option.rules ? option.rules.ZWRuleSihua : null;
	}

	// 显示层庙旺:非默认亮度源时经 starLightOf 单一取值口做覆盖(源表命中用其值、缺格回落基表)。
	// 纯显示、不改安星/命主(切亮度不重排盘、缓存盘不受污染)。默认 zi_jian 先短路 —— 控制流
	// 与旧实现逐字等价;等价性由 wiring 金标「渲染器取值===starLightOf」全格机械证明。
	effStarLight(star){
		let sl = star ? star.starlight : '';
		const src = ZWEngineOptions.brightnessSource;
		if(src && src !== 'zi_jian' && star && star.name){
			const base = star.name.charAt(0) === '副' ? star.name.slice(1) : star.name;
			const zhi = (this.houseObj && this.houseObj.ganzi ? this.houseObj.ganzi.charAt(1) : '');
			const v = starLightOf(base, zhi, src);
			if(v != null){ sl = v; }
		}
		return sl;
	}

	// ===== 策天(移语本)流年星徽行:四化盘/三合盘共用;仅 kinastroBorrowed 且宫有数据时画 =====
	drawKinastroLiunianRow(){
		if(!this.kinastroBorrowed || !this.houseObj || !this.houseObj.kinastroLiunianRow
			|| !this.houseObj.kinastroLiunianRow.length || this.svg == null){
			return;
		}
		const items = this.houseObj.kinastroLiunianRow;
		const rowH = 15;
		const rowY = this.y + this.height * 3 / 4 - rowH - 4;
		const rowX = this.x + 4;
		const maxW = this.width - 8;
		const group = this.svg.append('g').attr('class', 'horosa-ziwei-kinastro-liunian-row');
		const fontSize = 11;
		let text = items.join(' ');
		// 护栏:超宽截断(约每字 fontSize px),尾附「…」——盘面绝不横向溢出。
		const maxChars = Math.max(3, Math.floor((maxW - 18) / (fontSize * 1.05)));
		const plain = text.replace(/ /g, '');
		if(plain.length > maxChars){
			const kept = [];
			let count = 0;
			for(let i = 0; i < items.length; i += 1){
				if(count + items[i].length > maxChars - 1){ break; }
				kept.push(items[i]);
				count += items[i].length;
			}
			text = `${kept.join(' ')}…`;
		}
		group.append('rect')
			.attr('x', rowX)
			.attr('y', rowY)
			.attr('width', 14)
			.attr('height', rowH - 1)
			.attr('rx', 2.5)
			.attr('fill', 'rgba(120, 156, 214, 0.16)')
			.attr('stroke', 'var(--horosa-ziwei-kinastro-liunian, #7f9cd0)')
			.attr('stroke-width', 0.9);
		group.append('text')
			.attr('x', rowX + 7)
			.attr('y', rowY + rowH / 2 - 0.5)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'middle')
			.attr('fill', 'var(--horosa-ziwei-kinastro-liunian, #7f9cd0)')
			.attr('stroke', 'none')
			.attr('font-size', '9px')
			.attr('font-weight', 760)
			.attr('font-family', AstroConst.NormalFont)
			.text('流');
		group.append('text')
			.attr('class', 'horosa-ziwei-kinastro-liunian-text')
			.attr('x', rowX + 18)
			.attr('y', rowY + rowH / 2)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'start')
			.attr('fill', 'var(--horosa-ziwei-kinastro-liunian, #8aa7dc)')
			.attr('stroke', 'none')
			.attr('font-size', `${fontSize}px`)
			.attr('font-weight', 700)
			.attr('font-family', AstroConst.NormalFont)
			.text(text);
	}

	// ===== 流派叠层角标 + 活盘重排(四化盘/三合盘共用;基类统一实现防两盘漂移) =====
	// 手册补齐·流派叠层角标(开关开时,自算不改基础安星):气数位/太岁入卦角标 + 中州借宫半透明星。
	drawOverlayMarks(){
		const chart = this.chartObj;
		if(!chart || !chart.houses || this.svg == null){ return; }
		const life = chart.lifeHouseIndex;
		// 河洛气数位(官禄宫=命逆数第9=(life-8)%12)角标
		if(ZWEngineOptions.qishuWei && life != null && life >= 0 && this.houseIndex === ((life - 8) % 12 + 12) % 12){
			this.drawCornerTag(['气', '数'], 'var(--horosa-ziwei-period-day, #e64980)', 0);
		}
		// 紫云太岁入卦(本宫地支命中关系人生肖)角标
		if(ZWEngineOptions.taiSuiRuGua && Array.isArray(ZWEngineOptions.taiSuiRelatives) && ZWEngineOptions.taiSuiRelatives.length){
			const zhi = ((this.houseObj && this.houseObj.ganzi) || '').charAt(1);
			if(ZWEngineOptions.taiSuiRelatives.some((r)=>r && r.branch === zhi)){
				this.drawCornerTag(['太', '岁'], 'var(--horosa-ziwei-period-hour, #e8590c)', 1);
			}
		}
		// [D4] 活盘太极点角标:huoPan 开且本宫为当前太极点时显「太极」(slot 2,与气数/太岁错列)。
		if(ZWEngineOptions.huoPan && this.zwchart && this.zwchart.taijiIdx != null && this.zwchart.taijiIdx === this.houseIndex){
			this.drawCornerTag(['太', '极'], 'var(--horosa-ziwei-period-xiaoxian, #9775fa)', 2);
		}
		// 中州借宫(空宫借对宫十四正曜,半透明)
		if(ZWEngineOptions.borrowPalace){
			try{ const bor = borrowedStars(chart, this.houseIndex); if(bor && bor.length){ this.drawBorrowedStars(bor); } }catch(e){ /* 借宫渲染异常不影响主盘 */ }
		}
	}

	// 竖排 2 字小角标(仿 drawLaiYing);置于「上半矩形(星区)左下角」——贴宫名行之上、避让顶部主星。
	// slot 0=最左、1=右移一列(气数/太岁并存时不叠)。
	drawCornerTag(txt, color, slot){
		const hw = this.fontSize;
		const hh = hw * 2 + this.margin;
		const hx = this.x + 3 + slot * (hw + 4);
		const hy = this.y + this.height * 3 / 4 - hh - 2;   // 上半矩形底边(宫名行顶)之上
		GraphHelper.drawTextV(this.svg.append('g'), txt, hx, hy, hw, hh, 2, color, null, null, color);
	}

	// 借入正曜(半透明)：在空宫中部横排「借:星名…」,视觉区别本宫星;庙旺随借入宫已由 borrowedStars 算好(tooltip 备)。
	drawBorrowedStars(bor){
		const names = bor.map((s)=>(s.name || '').replace(/^副/, '')).join(' ');
		const g = this.svg.append('g').attr('opacity', 0.45);
		g.append('text')
			.attr('x', this.x + this.width / 2)
			.attr('y', this.y + this.height / 2 - 6)
			.attr('text-anchor', 'middle')
			.attr('font-size', this.fontSize * 0.9)
			.attr('fill', ZWCont.ZWColor.StarMainStroke)
			.text('借：' + names);
	}

	// 活盘(WP-3):huoPan 且已设太极点时,人事宫名按太极点重排(星曜地支不动);否则本命名。四化盘/三合盘共用。
	effectiveHouseName(){
		const base = `${(this.houseObj && this.houseObj.name) || ''}`;
		if(ZWEngineOptions.huoPan && this.zwchart && this.zwchart.taijiIdx != null && this.houseIndex != null){
			const k = ((this.zwchart.taijiIdx - this.houseIndex) % 12 + 12) % 12;
			return HOUSE_NAMES[k] || base;
		}
		return base;
	}

	genTooltip(titleSvg, tipobj, name){
		if(this.divTooltip === undefined || this.divTooltip === null){
			return;
		}

		let lbl = genHtml(tipobj);
		titleSvg.on('mouseover', (evt)=>{
			const pointerY = evt.clientY !== undefined ? evt.clientY : evt.pageY;
			let y = pointerY - 48;
			let ydelta = document.documentElement.clientHeight - y;
			if(tipobj.tips instanceof Array && tipobj.tips.length > 3){
				if(ydelta < 350){
					y = y - 350;
					if(tipobj.tips.length < 8){
						y = y + 250;
					}
				}	
			}

			let str = lbl;
			let tips = localStorage.getItem('ziweiTips');
			let flag = true;
			if(tips !== undefined && tips !== null){
				if(tips+'' === '1'){
					flag = true;
				}else{
					flag = false;
				}
			}
			if(flag){
				this.divTooltip.transition()		
					.duration(200)		
					.style("opacity", .9);
				this.divTooltip.html(str);
				positionFloatingTooltip(this.divTooltip, evt, {
					offsetX: 16,
					offsetY: y - pointerY,
					fallbackOffsetY: 18,
				});
			}else{
				this.divTooltip.transition()		
					.duration(500)		
					.style("opacity", 0);
			}
		}).on('mouseout', (evt)=>{
			this.divTooltip.transition().duration(500).style("opacity", 0);
		}).on('click', (evt)=>{
			if(this.onTipClick){
				this.onTipClick(tipobj);
			}
			return false;
		});

	}

	// ===== 运限四化叠层（需求5 + 二轮按层对齐；三合盘/四化盘共用）=====
	// 关键：每个运限层占**固定槽位** slot=层在窗口中的序号 → 同一层四化跨所有星曜落在同一水平线；
	// 某星缺某层四化则该槽**留空**（不上移），使「大限一行、流年下一行…」对齐(用户二轮要求)。
	// 本命/大限按 hua 本色(periodColor=null)；流年小限/月/日/时按各层期色；仅无运限时(luckShowZihua)在窗口层之后加一槽自化(带箭头)。
	// baseOffset=星名区底(各星统一,跨星对齐起点)；slotH=每层槽高(统一)；maxBottom=上半矩形底线(越界不画)。返回末槽底(供指示线)。
	drawLuckSihuaForStar(star, x, y, w, baseOffset, slotH, mgn, maxBottom){
		if(!star || !star.name || this.kinastroBorrowed){
			return baseOffset;
		}
		const m = mgn || 1;
		const huaw = w - m*2;
		const huah = Math.max(8, Math.min(w, slotH - m));
		const drawBadge = (hua, bg, color, withArrow, slotIdx)=>{
			if(!hua){
				return;
			}
			const huax = x + m;
			const huay = y + baseOffset + slotIdx * slotH;
			if(maxBottom !== undefined && maxBottom !== null && (huay + huah) > maxBottom){
				return; // 越界保护：不画会超出宫格上半矩形的徽标（需求4）
			}
			const fill = color || '#ffffff';
			const huasvg = GraphHelper.drawTextV(this.svg.append('g'), [hua], huax, huay, huaw, huah, m,
				fill, 850, bg);
			huasvg.selectAll('text')
				.attr('fill', fill)
				.attr('stroke', 'none')
				.attr('font-weight', 850);
			if(withArrow){
				const opt = {
					owner: this.svg.append('g'),
					x2: huax + huaw/2, y2: huay + huah,
					x1: huax + huaw/2, y1: huay,
					color: bg,
				};
				new D3Arrow(opt).draw();
			}
			// 四化释义 tooltip（与原本命四化同源）。
			const ruleSihuaArr = this.ZWRules && this.ZWRules.RuleSihua ? this.ZWRules.RuleSihua[hua] : null;
			if(ruleSihuaArr){
				const huatip = ruleSihuaArr.slice(0);
				const huahouse = this.ZWRuleSihua && this.ZWRuleSihua.HuaInHouse ? this.ZWRuleSihua.HuaInHouse[hua] : null;
				const huahousetip = huahouse && huahouse[this.houseObj.name] ? huahouse[this.houseObj.name].slice(0) : [];
				if(!huatip.some((v)=> v === '==')){
					huatip.push('==');
					huatip.push(`${hua}在${this.houseObj.name}`);
					huatip.push(huahousetip);
				}
				this.genTooltip(huasvg, { title: hua, tips: huatip }, hua);
			}
		};
		const layers = this.luckSihuaLayers || [];
		layers.forEach((layer, slotIdx)=>{
			let hua = ZiWeiHelper.getSiHua(star.name, layer.sihuaGan || layer.gan);   // [B10] 流年取干档随层
			if(hua === '祿'){
				hua = '禄';
			}
			if(!hua){
				return; // 该层此星无四化 → 槽位留空（不上移），保证跨星同层对齐
			}
			let bg; let color;
			if(layer.periodColor){
				bg = layer.periodColor;
				color = '#ffffff';
			}else{
				const opt = ZWCont.ZWColor[hua] || ZWCont.ZWColor.StarMainStroke;
				bg = opt.bg || ZWCont.ZWColor.StarMainStroke;
				color = opt.color || '#ffffff';
			}
			drawBadge(hua, bg, color, false, slotIdx);
		});
		// 自化：仅无运限选中时（腾位给运限层），落窗口层之后的下一槽。
		if(this.luckShowZihua){
			const housegan = this.houseObj.ganzi.charAt(0);
			let ganhua = ZiWeiHelper.getSiHua(star.name, housegan);
			if(ganhua === '祿'){
				ganhua = '禄';
			}
			if(ganhua){
				const opt = ZWCont.ZWColor[ganhua] || ZWCont.ZWColor.StarMainStroke;
				drawBadge(ganhua, opt.bg || ZWCont.ZWColor.StarMainStroke, opt.color || '#ffffff', true, layers.length);
			}
		}
		const totalSlots = layers.length + (this.luckShowZihua ? 1 : 0);
		return baseOffset + totalSlots * slotH;
	}

	// [D2] 干系四化徽(命宫干/日干,双字横排「命禄」「日权」hua 色底):追加在运限四化槽之后的
	// 固定槽位(不进滑窗不用角标);maxBottom 越界跳过;kinastro 借宫星柱不画。默认双关=零绘制。
	drawStemSihuaChips(star, x, y, w, baseOffset, slotH, mgn, maxBottom){
		if(!star || !star.name || this.kinastroBorrowed){
			return;
		}
		const chips = [];
		if(ZiWeiHelper.zwShowMingSihua()){
			const g = ZiWeiHelper.mingGanOf(this.chartObj);
			let h = g ? ZiWeiHelper.getSiHua(star.name, g) : null;
			if(h === '祿'){ h = '禄'; }
			if(h){ chips.push('命' + h); }
		}
		if(ZiWeiHelper.zwShowDaySihua()){
			const g = ZiWeiHelper.dayGanOf(this.chartObj);
			let h = g ? ZiWeiHelper.getSiHua(star.name, g) : null;
			if(h === '祿'){ h = '禄'; }
			if(h){ chips.push('日' + h); }
		}
		if(!chips.length){
			return;
		}
		const m = mgn || 1;
		const layerCount = (this.luckSihuaLayers || []).length;
		const huaw = w - m*2;
		const huah = Math.max(8, Math.min(w, slotH - m));
		chips.forEach((label, i)=>{
			const slotIdx = layerCount + i;
			const cy2 = y + baseOffset + slotIdx * slotH;
			if(maxBottom !== undefined && maxBottom !== null && (cy2 + huah) > maxBottom){
				return;   // 越界保护:与运限徽同律,不挤破上半矩形
			}
			const hua = label.charAt(1);
			const co = ZWCont.ZWColor[hua] || { bg: '#888888', color: '#ffffff' };
			const g2 = this.svg.append('g');
			g2.append('rect')
				.attr('x', x + m).attr('y', cy2)
				.attr('width', huaw).attr('height', huah)
				.attr('rx', 2).attr('fill', co.bg).attr('stroke', 'none');
			g2.append('text')
				.attr('x', x + w/2).attr('y', cy2 + huah/2 + 0.5)
				.attr('dominant-baseline', 'middle').attr('text-anchor', 'middle')
				.attr('fill', co.color).attr('stroke', 'none')
				.attr('font-size', `${Math.max(7, Math.min(9, Math.round(huaw * 0.5)))}px`)
				.attr('font-weight', 850)
				.attr('font-family', AstroConst.NormalFont)
				.text(label);
		});
	}

	// [D2] 宫底岁数条(流年岁列/小限岁列,靠左小字;两开关默认关=零绘制):
	// 画在「宫名标题带上方」(by 由各盘传入),两行开则向上堆叠;选中大限区间内的流年岁金色高亮。
	drawAgeStrips(bx, by, bw, rowH){
		const showYear = ZiWeiHelper.zwShowYearAges();
		const showXx = ZiWeiHelper.zwShowXiaoxianAges();
		if(!showYear && !showXx){
			return;
		}
		const chart = this.chartObj;
		const fontPx = Math.max(7, Math.min(9, Math.round(rowH * 0.8)));
		const rows = [];
		if(showYear && chart && chart.yearZi && this.houseObj && this.houseObj.ganzi){
			const ages = ZiWeiHelper.yearAgesOf(this.houseObj.ganzi.charAt(1), chart.yearZi);
			if(ages.length){ rows.push({ prefix: '', ages }); }
		}
		if(showXx && this.houseObj && this.houseObj.ganzi){
			// [B15b] 小限岁列渲染期现算(单源=ZiWeiHelper.xiaoxianAgesOf,随「小限顺逆」档即时跟随;
			// 广播 rev 触发整绘即得新值)。排盘期 smallDirection 恒默认口径,仅作现算条件不足时的回退。
			const xxAges = ZiWeiHelper.xiaoxianAgesOf(chart, this.houseObj.ganzi.charAt(1));
			const xxList = xxAges || (Array.isArray(this.houseObj.smallDirection) ? this.houseObj.smallDirection : []);
			if(xxList.length){ rows.push({ prefix: '限', ages: xxList }); }
		}
		if(!rows.length){
			return;
		}
		const dir = (this.houseObj && this.houseObj.direction) || [];
		const inDaxian = (a)=>Array.isArray(dir) && dir.length === 2 && a >= dir[0] && a <= dir[1];
		rows.forEach((row, ri)=>{
			const ry = by - ri * rowH;   // 两行向上堆叠(越界即停:低于星区顶则不画)
			if(ry < this.y + 2){
				return;
			}
			const g2 = this.svg.append('g');
			let tx = bx;
			const items = row.prefix ? [row.prefix, ...row.ages] : row.ages;
			for(let k = 0; k < items.length; k++){
				const it = items[k];
				const isAge = typeof it === 'number';
				const hl = isAge && !row.prefix && inDaxian(it);   // 流年行:命中当前大限区间→金色
				const t = g2.append('text')
					.attr('x', tx).attr('y', ry)
					.attr('dominant-baseline', 'auto').attr('text-anchor', 'start')
					.attr('fill', hl ? 'var(--horosa-ziwei-house-name, #d8ad63)' : ZWCont.ZWColor.HouseAgeStroke)
					.attr('stroke', 'none')
					.attr('font-size', `${fontPx}px`)
					.attr('font-weight', hl ? 800 : 500)
					.attr('font-family', AstroConst.NormalFont)
					.text(`${it}`);
				const est = `${it}`.length * fontPx * 0.62 + fontPx * 0.45;
				tx += est;
				if(tx > bx + bw - fontPx){   // 越宽截断加省略号
					if(k < items.length - 1){
						g2.append('text')
							.attr('x', tx).attr('y', ry)
							.attr('fill', ZWCont.ZWColor.HouseAgeStroke).attr('stroke', 'none')
							.attr('font-size', `${fontPx}px`).attr('font-family', AstroConst.NormalFont)
							.text('…');
					}
					break;
				}
			}
		});
	}

	// ===== 长生左侧运限标签（需求3；三合盘/四化盘共用）=====
	// 在十二长生左侧画 年X/月X/日X/时X：每层横排2字(GraphHelper.drawTextH)、各层期色、多层从下往上堆叠。
	// rightX=标签列右界(长生左侧)、bottomY=最底一行的底线(宫格底之上)。大限「运X」已在宫顶、本命不画。
	drawLuckLabels(rightX, bottomY){
		const labels = this.luckLabelLayers || [];
		if(!labels.length){
			return;
		}
		const fs = Math.max(9, Math.min(11, this.fontSize - 7));
		const labelH = fs + 3;
		const gap = 2;
		const labelW = fs * 2 + 4; // 横排 2 字
		const lx = rightX - labelW;
		let row = 0;
		for(let i=0; i<labels.length; i++){
			const layer = labels[i];
			const role = ZiWeiHelper.luckRoleChar(layer.mingIndex, this.houseIndex);
			if(!role){
				continue;
			}
			const ly = bottomY - (row + 1) * labelH - row * gap;
			if(ly < this.y){
				break; // 越界保护：不画超出宫格上沿的标签
			}
			const g = GraphHelper.drawTextH(this.svg.append('g'), [layer.prefix, role], lx, ly, labelW, labelH, 1,
				layer.color, 700);
			g.selectAll('text').attr('fill', layer.color).attr('stroke', 'none');
			row++;
		}
	}

}
