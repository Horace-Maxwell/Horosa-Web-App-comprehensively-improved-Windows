import * as d3 from 'd3';
import {randomStr,} from '../../utils/helper';
import * as ZWCont from '../../constants/ZWConst';
import * as ZWText from '../../constants/ZWText';
import * as AstroConst from '../../constants/AstroConst';
import * as ZiWeiHelper from './ZiWeiHelper';
import ZWCommHouse from './ZWCommHouse';
import D3Arrow from '../graph/D3Arrow';
import { drawTextV, drawDashLine, } from '../graph/GraphHelper';
import { formatLonDms, formatLatDms } from '../astro/AstroHelper';   // 中宫经纬度按度分秒显示
import { ZWEngineOptions } from './ziweiOptions';   // 手册补齐:河洛一六共宗连线

// 中宫文本按可用宽自适应。
// 🔴 为什么必须有:中宫的「命主/身主/子斗/斗君」是四项均分一行,每项只有中宫宽的 1/4;
// 值由各技法自行填(借用中宫的策天把「时辰(13-15)·流年YYYY」塞进斗君那格),一长就冲出中宫
// 压在相邻宫的星名上——用户实报「中间栏严重失真」。治在渲染层而非叫调用方自己数字数:
// 中宫是共用件,凡往里填字符串的技法都可能超,逐个约束调用方必漏。
// 两档降级:①先按比例缩字号(下限 0.72 倍,再小读不清);②仍超宽则尾部截断加省略号。
// SVG 测量在无布局环境(jsdom/SSR)下不可用,此时静默保持原样 —— 与本函数引入前逐字节同行为。
export function fitTextToWidth(sel, maxWidth, size){
	const el = sel && typeof sel.node === 'function' ? sel.node() : null;
	if(!el || typeof el.getComputedTextLength !== 'function' || !(maxWidth > 0)){ return; }
	const measure = ()=>{ try{ return el.getComputedTextLength(); }catch(e){ return 0; } };
	let w = measure();
	if(!w || w <= maxWidth){ return; }
	sel.attr('font-size', `${Math.max(size * 0.72, size * (maxWidth / w))}px`);
	w = measure();
	if(!w || w <= maxWidth){ return; }
	const full = `${sel.text()}`;
	for(let n = full.length - 1; n > 0; n -= 1){
		sel.text(`${full.slice(0, n)}…`);
		w = measure();
		if(!w || w <= maxWidth){ return; }
	}
}

class ZWCenterHouse extends ZWCommHouse {
	// 「命盘信息」按钮几何:内容避让与按钮落位共用同一组数,改一处两处同步(分别写死必然错位)。
	static INFO_BTN_H = 34;
	static INFO_BTN_GAP = 10;

	constructor(option){
		super(option);

		this.fields = option.fields;
		this.yearDoujun = option.yearDoujun;
		this.onCenterInfoClick = option.onCenterInfoClick;

		this.id = 'house' + randomStr(8);
		this.svg = null;
		this.margin = 20;
		this.fontSize = 12;
		this.rowgap = 8;

		this.shiTongZHMap = new Map();
	}


	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		container.append('rect')
				.attr('fill', 'var(--horosa-ziwei-chart-bg, #f6f1e7)')
				.attr('x', this.x).attr('y', this.y)
				.attr('width', this.width).attr('height', this.height);
		this.svg = container;

		// [D4] 中宫内容先画(底层),飞化/三合线后画叠上层;clean 档=零绘制(现状)。
		this.drawCenterContent();
		this.drawShiTongZiHua();
		this.drawSanFanSiZeng();

		this.drawSangheLine();
		this.drawYiLiuGongZong();
		this.drawInfoButton();
	}

	// [D4] 中宫内容分派器:clean=现状空;bazi=四柱要素;full=全量信息。
	// 自适应版式:内容撑满中宫可用宽,字号/行距/列距全部按中宫尺寸推导,窗口缩放即联动;
	// 整块垂直居中(底部让位信息按钮)。取数 best-effort:缺块跳过不阻断盘面。
	// 中宫档位真值:借用中宫的技法(策天/演禽)各有各的档位,由 chartObj.centerContentMode 带进来;
	// 缺省(紫微自身)才读全局 ziweiCenterContent。
	// 🔴 不共用一个键:三者共用会「在策天调档,紫微跟着变」——同一个渲染器不等于同一份用户偏好。
	resolveCenterMode(){
		const m = this.chartObj && this.chartObj.centerContentMode;
		if(m === 'clean' || m === 'bazi' || m === 'full'){ return m; }
		return ZiWeiHelper.zwCenterContent();
	}

	drawCenterContent(){
		const mode = this.resolveCenterMode();
		if(mode === 'clean'){
			return;
		}
		// 内容统一画进一个组:画完后与「命盘信息」按钮做碰撞收敛(见 fitContentAboveButton)。
		this.contentG = this.svg.append('g').attr('class', 'horosa-ziwei-center-content');
		try{ this.drawCenterInfoPanel(mode); }catch(e){ /* 内容块缺数据=部分绘制,不阻断盘面 */ }
		try{ this.fitContentAboveButton(); }catch(e){ /* 无布局环境(SSR/jsdom)测不了 bbox=保持原样 */ }
	}

	// 🔴 借用中宫的技法(策天/演禽)不画「命盘信息」按钮:那颗按钮是不透明的,钉在中宫里就会压住
	// 四柱与命星行(用户实报两处被挡,并定案「不如直接把这个按钮去掉」)。它在那两法里本也是多余的
	// —— 起盘时地、命/身/胎、三元、运限右栏各有一整块在显示。紫微自身不受影响(那里它是唯一入口)。
	centerButtonHidden(){
		return !!(this.chartObj && this.chartObj.kinastroBorrowed);
	}

	// 内容可用到的下边界。按钮在时给它让位;按钮不画时内容一直用到中宫底(只留一点呼吸位)。
	// 两处唯一真值:本方法 + drawInfoButton 的 y 都由它推。
	centerButtonTop(){
		const bottom = this.y + this.height - ZWCenterHouse.INFO_BTN_GAP;
		return this.centerButtonHidden() ? bottom : bottom - ZWCenterHouse.INFO_BTN_H;
	}

	// 🔴 内容与按钮的重叠必须靠**布局约束**收敛,不能靠调间距数值碰运气:
	// 中宫内容行数随档位(bazi/full)、随技法(借用中宫的策天/演禽自带命主行)、随姓名与经纬度长度
	// 变化,而按钮恒定钉在底部——任何一次内容变长都会重新压上去(用户实报「信息被命盘信息按钮挡住」)。
	// 故画完内容后实测整块 bbox:一旦越过按钮顶边就整体等比缩到按钮之上(下限 0.62 倍,再小读不清;
	// 触到下限仍越界时至少保证不再继续变糟)。clean 档无内容、按钮居中,本方法不参与。
	fitContentAboveButton(){
		const g = this.contentG;
		const node = g && typeof g.node === 'function' ? g.node() : null;
		if(!node || typeof node.getBBox !== 'function'){ return; }
		let bb = null;
		try{ bb = node.getBBox(); }catch(e){ return; }
		if(!bb || !(bb.height > 0)){ return; }
		const limit = this.centerButtonTop() - ZWCenterHouse.INFO_BTN_GAP;
		if(bb.y + bb.height <= limit){ return; }
		const scale = Math.max(0.62, (limit - bb.y) / bb.height);
		if(!(scale > 0) || scale >= 1){ return; }
		const cx = this.x + this.width / 2;
		g.attr('transform', `translate(${cx},${bb.y}) scale(${scale}) translate(${-cx},${-bb.y})`);
	}

	drawCenterInfoPanel(mode){
		const chart = this.chartObj;
		if(!chart){ return; }
		const pad = Math.max(16, this.width * 0.055);
		const bx = this.x + pad;
		const bw = this.width - pad * 2;
		const btnH = 56;   // 底部信息按钮让位
		const availH = this.height - pad - btnH;
		const u = Math.max(11, Math.min(20, bw / 24));   // 基础字号:随中宫宽缩放
		const ink = AstroConst.AstroColor.Stroke;
		const muted = ZWCont.ZWColor.HouseMetaStroke;
		const gold = ZWCont.ZWColor.HouseBranchStroke;
		const txt = (str, x, y, { size = u, color = ink, weight = 500, anchor = 'start', maxWidth = 0 } = {})=>{
			const sel = (this.contentG || this.svg).append('g').append('text')
				.attr('dominant-baseline', 'middle').attr('text-anchor', anchor)
				.attr('fill', color).attr('stroke', 'none')
				.attr('font-weight', weight).attr('font-size', `${size}px`)
				.attr('font-family', AstroConst.NormalFont)
				.attr('x', x).attr('y', y)
				.text(str);
			if(maxWidth > 0){ fitTextToWidth(sel, maxWidth, size); }
			return sel;
		};
		const bz = chart.bazi && chart.bazi.bazi;
		const direct = (chart.bazi && chart.bazi.direct && chart.bazi.direct.direction) || [];
		// —— 预算总高(先量后画,整块垂直居中) ——
		const headH = mode === 'full' ? u * 1.9 : 0;
		const nongli = chart.nongli || {};
		const metaLines = [];
		if(mode === 'full'){
			const timeAlg = chart.timeAlg !== undefined && chart.timeAlg !== null ? chart.timeAlg : 0;
			if(nongli.birth){ metaLines.push((timeAlg === 1 ? '直接时间：' : '真太阳时：') + nongli.birth); }
			if(nongli.year){ metaLines.push('农历：' + nongli.year + '年 ' + (nongli.leap ? '闰' : '') + (nongli.month || '') + (nongli.day || '') + ' ' + (nongli.time ? nongli.time.charAt(1) + '时' : '')); }
			// 经纬度按专业记法(116°24′27″E),不铺十进制长串 —— 借用中宫的技法把后端 double 原样
			// 塞进 chart.lon/lat,直接拼出来就是 119.31666666666666 这种(用户实报「不要变成一长串」)。
			// 非数值(已格式化过的串/缺值)原样保留,不二次加工。
			const geoNum = (v)=>(v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)));
			metaLines.push('时区：' + chart.zone
				+ '；经度：' + (geoNum(chart.lon) ? formatLonDms(chart.lon) : chart.lon)
				+ '；纬度：' + (geoNum(chart.lat) ? formatLatDms(chart.lat) : chart.lat));
			const ygl = nongli.yearGZByLunar;
			if(ygl && bz && bz.year && ygl !== bz.year.ganzi){ metaLines.push('初一口径年柱：' + ygl); }
			if(this.yearDoujun){ metaLines.push(this.yearDoujun); }
		}
		const metaLineH = u * 1.5;
		const metaH = metaLines.length * metaLineH;
		// 四柱块:标签行 + 干支两字竖排
		const pillarU = Math.max(u * 1.25, Math.min(u * 1.9, bw / 14));
		const pillarsH = bz ? (u * 1.35 + pillarU * 2.5) : 0;
		// 大限行:起运岁数字 + 干支两字竖排(十列)
		const dirU = Math.max(u * 0.72, Math.min(u * 1.05, bw / (Math.max(direct.length, 8) * 2.6)));
		const dirH = direct.length ? (dirU * 1.5 + dirU * 2.6) : 0;
		const masterH = u * 1.6;
		const gap = Math.max(u * 0.9, Math.min(u * 2.1, (availH - headH - metaH - pillarsH - dirH - masterH) / 5));
		const contentH = headH + metaH + pillarsH + dirH + masterH + gap * ((mode === 'full' ? 2 : 0) + (direct.length ? 2 : 1));
		let by = this.y + Math.max(pad, (availH - contentH) / 2 + pad * 0.4);
		// —— full:姓名行 + 出生数据 ——
		if(mode === 'full'){
			let name = '姓名：' + ((this.fields && this.fields.name && this.fields.name.value) || '匿名');
			const ju = ZWText.ZWMsg[chart.yearPolar] + ZWText.ZWMsg[chart.gender] + ' ' + chart.wuxingJuText;
			// 姓名与右侧局名同行:各占约一半,长姓名不得压到局名上
			txt(name, bx, by, { size: u * 1.2, weight: 750, maxWidth: bw * 0.56 });
			txt(ju, bx + bw, by, { size: u * 1.1, weight: 650, color: gold, anchor: 'end', maxWidth: bw * 0.42 });
			by += headH;
			metaLines.forEach((mline)=>{ txt(mline, bx, by, { size: u * 0.92, color: muted, maxWidth: bw }); by += metaLineH; });
			by += gap;
		}
		// —— 四柱块(四列均分撑满宽) ——
		if(bz){
			const cols = [ ['年', bz.year], ['月', bz.month], ['日', bz.day], ['时', bz.time] ];
			const colW = bw / 4;
			cols.forEach((c, i)=>{
				const cx2 = bx + colW * i + colW / 2;
				txt(c[0], cx2, by + u * 0.5, { size: u * 0.85, color: muted, anchor: 'middle' });
				const gz = c[1] && c[1].ganzi ? c[1].ganzi : '';
				if(gz){
					txt(gz.charAt(0), cx2, by + u * 1.35 + pillarU * 0.62, { size: pillarU, weight: 700, color: gold, anchor: 'middle' });
					txt(gz.charAt(1), cx2, by + u * 1.35 + pillarU * 1.72, { size: pillarU, weight: 700, color: gold, anchor: 'middle' });
				}
			});
			by += pillarsH + gap;
		}
		// —— 大限起运行(十列撑满宽;保留起始年/流年 tooltip) ——
		if(direct.length){
			const dcolW = bw / direct.length;
			direct.forEach((item, i)=>{
				const cx2 = bx + dcolW * i + dcolW / 2;
				const age = item.age + 1;
				const sage = age < 10 ? '0' + age : '' + age;
				const agesvg = (this.contentG || this.svg).append('g');
				agesvg.append('text')
					.attr('dominant-baseline', 'middle').attr('text-anchor', 'middle')
					.attr('fill', muted).attr('stroke', 'none')
					.attr('font-weight', 600).attr('font-size', `${dirU * 0.95}px`)
					.attr('font-family', AstroConst.NormalFont)
					.attr('x', cx2).attr('y', by + dirU * 0.7)
					.text(sage);
				this.genTooltip(agesvg, { title: '开始年份', tips: item.startYear });
				const gz = item.mainDirect && item.mainDirect.ganzi ? item.mainDirect.ganzi : '';
				const gzsvg = (this.contentG || this.svg).append('g');
				if(gz){
					gzsvg.append('text')
						.attr('dominant-baseline', 'middle').attr('text-anchor', 'middle')
						.attr('fill', ink).attr('stroke', 'none')
						.attr('font-weight', 550).attr('font-size', `${dirU * 1.05}px`)
						.attr('font-family', AstroConst.NormalFont)
						.attr('x', cx2).attr('y', by + dirU * 1.5 + dirU * 0.62)
						.text(gz.charAt(0));
					gzsvg.append('text')
						.attr('dominant-baseline', 'middle').attr('text-anchor', 'middle')
						.attr('fill', ink).attr('stroke', 'none')
						.attr('font-weight', 550).attr('font-size', `${dirU * 1.05}px`)
						.attr('font-family', AstroConst.NormalFont)
						.attr('x', cx2).attr('y', by + dirU * 1.5 + dirU * 1.75)
						.text(gz.charAt(1));
					const subyears = (item.subDirect || []).map((subdir, k)=>`${age + k}虚岁 -- ${item.startYear + k}年 -- ${subdir.ganzi}`);
					this.genTooltip(gzsvg, { title: `${gz}大运 -- 流年`, tips: subyears });
				}
			});
			by += dirH + gap;
		}
		// —— 命主/身主/子斗/斗君(四项均分一行) ——
		// 四项标签默认取紫微本名;借用中宫的技法(策天/演禽)可用 centerMasterLabels 覆盖 ——
		// 🔴 否则标签与值语义对不上:演禽把「胎星」画成「子斗」、「三元」画成「斗君」,
		// 策天把「命宫」画成「命主」,读者按紫微义去理解就全错(用户实报「中间栏严重失真」)。
		// 覆盖只认长度 4 的数组,逐项空则回落本名(部分覆盖也安全)。
		const lb = Array.isArray(chart.centerMasterLabels) && chart.centerMasterLabels.length === 4
			? chart.centerMasterLabels : [];
		const masters = [
			[lb[0] || '命主', chart.lifeMaster],
			[lb[1] || '身主', chart.bodyMaster],
			[lb[2] || '子斗', chart.zidou],
			[lb[3] || '斗君', chart.doujun],
		];
		const mcolW = bw / 4;
		masters.forEach((m, i)=>{
			if(m[1] === undefined || m[1] === null || m[1] === ''){ return; }
			// maxWidth 留 4% 列间距:四项贴着排,不留缝时相邻两项会视觉粘连
			txt(`${m[0]}：${m[1]}`, bx + mcolW * i + mcolW / 2, by + u * 0.6,
				{ size: u * 0.95, weight: 600, anchor: 'middle', maxWidth: mcolW * 0.96 });
		});
	}

	// 河洛一六共宗(WP-4):命(1)↔疾厄(6)中心连线(异色于三合虚线);仅 qishuWei 开时绘。
	drawYiLiuGongZong(){
		if(!ZWEngineOptions.qishuWei || !this.chartObj || !this.zwchart){ return; }
		const life = this.chartObj.lifeHouseIndex;
		if(life == null || life < 0){ return; }
		const ming = this.zwchart.houses[life];
		const ji = this.zwchart.houses[((life - 5) % 12 + 12) % 12];
		if(!ming || !ji){ return; }
		const cx = (h)=>h.x + h.width / 2;
		const cy = (h)=>h.y + h.height / 2;
		drawDashLine(this.svg.append('g'), cx(ming), cy(ming), cx(ji), cy(ji), 'var(--horosa-ziwei-period-day, #e64980)');
	}

	drawInfoButton(){
		if(this.centerButtonHidden()){ return; }
		let bw = Math.min(132, this.width * 0.42);
		let bh = ZWCenterHouse.INFO_BTN_H;
		let x = this.x + this.width / 2 - bw / 2;
		// [D4] 中宫有内容(bazi/full)时按钮让位到底部;clean=居中(现状)。
		// 判据必须与 drawCenterContent 同源(resolveCenterMode),否则借用中宫的技法会出现
		// 「内容画了、按钮还停在正中间」= 按钮压在内容上。
		let y = this.resolveCenterMode() === 'clean'
			? this.y + this.height / 2 - bh / 2
			: this.centerButtonTop();
		let btn = this.svg.append('g').attr('class', 'horosa-ziwei-center-info-button');
		btn.append('rect')
			.attr('x', x).attr('y', y)
			.attr('width', bw).attr('height', bh)
			.attr('rx', 8).attr('ry', 8)
			.attr('fill', 'var(--horosa-surface-raised, rgba(10, 12, 14, 0.92))')
			.attr('stroke', 'var(--horosa-gold, #dab16f)')
			.attr('stroke-width', 1.2);
		btn.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "middle")
			.attr('font-weight', 600)
			.attr('stroke', 'transparent')
			.attr('fill', 'var(--horosa-gold, #dab16f)')
			.attr('font-size', '14px')
			.attr('x', x + bw / 2).attr('y', y + bh / 2)
			.text('命盘信息');
		btn.attr('style', 'cursor:pointer');
		btn.on('click', (evt)=>{
			if(evt && evt.stopPropagation){
				evt.stopPropagation();
			}
			if(this.onCenterInfoClick){
				this.onCenterInfoClick();
			}
		});
	}

	// [D4美化] 旧版固定字号的中宫四方法(drawName/drawDate/drawBaZi/drawDouJun)已删——
	// 自适应版式由 drawCenterInfoPanel 全量承接(信息集覆盖旧四方法),避免「写好零调用」死代码回潮。


	drawShiTongZiHua(){
		this.shiTongZHMap.clear();
		for(let i=0; i<12; i++){
			let pairIdx = (i + 6) % 12;
			let gan = this.chartObj.houses[i].ganzi.charAt(0) + '';
			let pairHouse = this.chartObj.houses[pairIdx];
			let hua = this.checkPairHouse(pairHouse, gan);
			if(hua.length > 0){
				let n = this.shiTongZHMap.get(i + '_' + pairIdx);
				if(n === undefined || n === null){
					n = this.shiTongZHMap.get(pairIdx + '_' + i);
				}
				if(n === undefined || n === null){
					n = 0;
				}else{
					n = n + 1;
				}
				let offset = n * 15;
				offset = this.drawSihuaArrow(i, pairIdx, hua, offset);
				this.shiTongZHMap.set(i + '_' + pairIdx, n);
				this.shiTongZHMap.set(pairIdx + '_' + i, n);
			}
		}
	}

	drawSanFanSiZeng(){
		// [D0] 守卫修正:ZWChart 是 {chart} 对象,旧写法「对象!==数字」恒真=方法恒空跑。
		if(ZWCont.ZWChart.chart !== ZWCont.ZWChart_SangHe){
			return;
		}
		// [D4] 对宫指示线:点宫(flyHouse)后画「被点宫↔对宫」中心虚线(三合盘;开关默认开;
		// 静态盘 flyHouse 空=零绘制)。中心点法仿 drawYiLiuGongZong。
		if(!ZiWeiHelper.zwShowSfszLine() || !this.zwchart || !this.zwchart.flyHouse){
			return;
		}
		const fly = this.zwchart.flyHouse;
		const idx = fly && fly.houseChart ? fly.houseChart.houseIndex : null;
		if(idx == null || idx < 0 || !Array.isArray(this.zwchart.houses)){
			return;
		}
		const src2 = this.zwchart.houses[idx];
		const opp = this.zwchart.houses[(idx + 6) % 12];
		if(!src2 || !opp){
			return;
		}
		const cx = (h)=>h.x + h.width / 2;
		const cy = (h)=>h.y + h.height / 2;
		drawDashLine(this.svg.append('g'), cx(src2), cy(src2), cx(opp), cy(opp), 'var(--horosa-ziwei-duigong-line, rgba(90, 120, 190, 0.55))');
	}

	checkPairHouse(house, gan){
		let res = [];
		for(let i=0; i<house.starsMain.length; i++){
			let star = house.starsMain[i];
			let hua = ZiWeiHelper.getSiHua(star.name, gan);
			if(hua){
				res.push(hua);
			}
		}
		for(let i=0; i<house.starsAssist.length; i++){
			let star = house.starsAssist[i];
			let hua = ZiWeiHelper.getSiHua(star.name, gan);
			if(hua){
				res.push(hua);
			}
		}
		return res;
	}

	drawSihuaArrow(fromIdx, toIdx, huas, staroffset){
		let hFrom = this.zwchart.houses[fromIdx];
		let hTo = this.zwchart.houses[toIdx];
		let offset = staroffset;
		for(let i=0; i<huas.length; i++){
			offset = staroffset + i*15;
			let hua = huas[i];
			let coloropt = ZWCont.ZWColor[hua];
			let opt = {};
			if(fromIdx === 0){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width / 3 * 2 - offset,
					y1: hFrom.y,
					x2: hTo.x + hTo.width / 3,
					y2: hTo.y + hTo.height,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 1){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width / 3 + offset,
					y1: hFrom.y,
					x2: hTo.x + hTo.width / 3 * 2,
					y2: hTo.y + hTo.height,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 2){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width - offset,
					y1: hFrom.y,
					x2: hTo.x,
					y2: hTo.y + hTo.height,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 3){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width,
					y1: hFrom.y + hTo.height / 3 * 2 - offset,
					x2: hTo.x,
					y2: hTo.y + hTo.height / 3,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 4){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width,
					y1: hFrom.y + hTo.height / 3 + offset,
					x2: hTo.x,
					y2: hTo.y + hTo.height / 3 * 2,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 5){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width - offset,
					y1: hFrom.y + hTo.height,
					x2: hTo.x,
					y2: hTo.y,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 6){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width / 3 + offset,
					y1: hFrom.y + hTo.height,
					x2: hTo.x + hFrom.width / 3 * 2,
					y2: hTo.y,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 7){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width / 3 * 2 - offset,
					y1: hFrom.y + hTo.height,
					x2: hTo.x + hFrom.width / 3,
					y2: hTo.y,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 8){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + offset,
					y1: hFrom.y + hTo.height,
					x2: hTo.x + hFrom.width,
					y2: hTo.y,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 9){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x,
					y1: hFrom.y + hTo.height / 3 + offset,
					x2: hTo.x + hFrom.width,
					y2: hTo.y + hTo.height / 3 * 2,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 10){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x,
					y1: hFrom.y + hTo.height / 3 * 2 - offset,
					x2: hTo.x + hFrom.width,
					y2: hTo.y + hTo.height / 3,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 11){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + offset,
					y1: hFrom.y,
					x2: hTo.x + hFrom.width,
					y2: hTo.y + hTo.height,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}	
		}
		return offset;
	}

	drawSangheLine(){
		let starthouse = this.zwchart.flyHouse;
		if(starthouse === undefined || starthouse === null){
			return;
		}
		let zi = starthouse.ganzi.substr(1,1);
		let fromIdx = ZiWeiHelper.getHouseZiIndex(zi);
		let caiIdx = (fromIdx - 4 + 12) % 12;
		let guanIdx = (fromIdx + 4) % 12;
		let mingHouse = this.zwchart.houses[fromIdx];
		let caiHouse = this.zwchart.houses[caiIdx];
		let guanHouse = this.zwchart.houses[guanIdx];

		let color = AstroConst.AstroColor.Stroke;
		let grp = this.svg.append('g');
		if(fromIdx === 0){
			let x1 = mingHouse.x + mingHouse.width/2;
			let y1 = mingHouse.y;
			let x2 = caiHouse.x;
			let y2 = caiHouse.y + caiHouse.height;
			let x3 = guanHouse.x + guanHouse.width;
			let y3 = guanHouse.y + guanHouse.height/2;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 1){
			let x1 = mingHouse.x + mingHouse.width/2;
			let y1 = mingHouse.y;
			let x2 = caiHouse.x;
			let y2 = caiHouse.y + caiHouse.height/2;
			let x3 = guanHouse.x + guanHouse.width;
			let y3 = guanHouse.y + guanHouse.height;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 2){
			let x1 = mingHouse.x + mingHouse.width;
			let y1 = mingHouse.y;
			let x2 = caiHouse.x;
			let y2 = caiHouse.y + caiHouse.height/2;
			let x3 = guanHouse.x + guanHouse.width/2;
			let y3 = guanHouse.y + guanHouse.height;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 3){
			let x1 = mingHouse.x + mingHouse.width;
			let y1 = mingHouse.y + mingHouse.height / 2;
			let x2 = caiHouse.x;
			let y2 = caiHouse.y;
			let x3 = guanHouse.x + guanHouse.width/2;
			let y3 = guanHouse.y + guanHouse.height;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 4){
			let x1 = mingHouse.x + mingHouse.width;
			let y1 = mingHouse.y + mingHouse.height / 2;
			let x2 = caiHouse.x + caiHouse.width / 2;
			let y2 = caiHouse.y;
			let x3 = guanHouse.x;
			let y3 = guanHouse.y + guanHouse.height;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 5){
			let x1 = mingHouse.x + mingHouse.width;
			let y1 = mingHouse.y + mingHouse.height;
			let x2 = caiHouse.x + caiHouse.width / 2;
			let y2 = caiHouse.y;
			let x3 = guanHouse.x;
			let y3 = guanHouse.y + guanHouse.height / 2;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 6){
			let x1 = mingHouse.x + mingHouse.width / 2;
			let y1 = mingHouse.y + mingHouse.height;
			let x2 = caiHouse.x + caiHouse.width;
			let y2 = caiHouse.y;
			let x3 = guanHouse.x;
			let y3 = guanHouse.y + guanHouse.height / 2;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 7){
			let x1 = mingHouse.x + mingHouse.width / 2;
			let y1 = mingHouse.y + mingHouse.height;
			let x2 = caiHouse.x + caiHouse.width;
			let y2 = caiHouse.y + caiHouse.height/2;
			let x3 = guanHouse.x;
			let y3 = guanHouse.y;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 8){
			let x1 = mingHouse.x;
			let y1 = mingHouse.y + mingHouse.height;
			let x2 = caiHouse.x + caiHouse.width;
			let y2 = caiHouse.y + caiHouse.height/2;
			let x3 = guanHouse.x + guanHouse.width/2;
			let y3 = guanHouse.y;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 9){
			let x1 = mingHouse.x;
			let y1 = mingHouse.y + mingHouse.height/2;
			let x2 = caiHouse.x + caiHouse.width;
			let y2 = caiHouse.y + caiHouse.height;
			let x3 = guanHouse.x + guanHouse.width/2;
			let y3 = guanHouse.y;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 10){
			let x1 = mingHouse.x;
			let y1 = mingHouse.y + mingHouse.height/2;
			let x2 = caiHouse.x + caiHouse.width/2;
			let y2 = caiHouse.y + caiHouse.height;
			let x3 = guanHouse.x + guanHouse.width;
			let y3 = guanHouse.y;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 11){
			let x1 = mingHouse.x;
			let y1 = mingHouse.y;
			let x2 = caiHouse.x + caiHouse.width/2;
			let y2 = caiHouse.y + caiHouse.height;
			let x3 = guanHouse.x + guanHouse.width;
			let y3 = guanHouse.y + guanHouse.height/2;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}
	}

}

export default ZWCenterHouse;
