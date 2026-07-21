import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import {randomStr, formatDate, positionFloatingTooltip} from '../../utils/helper';
import { drawTextH, } from '../graph/GraphHelper';
import LRCircleChart from '../liureng/LRCircleChart';
import LRChart from '../liureng/LRChart';
import LRTextSquareChart from '../liureng/LRTextSquareChart';
import KeChart from '../liureng/KeChart';
import ChuangChart from '../liureng/ChuangChart';
import GodChart from '../liureng/GodChart';
import * as LRConst from '../liureng/LRConst';
import { getSignZi, LRChart_Circle, LRChart_Square, TaiSui} from '../liureng/LRConst';
import { ZSList, ZhangSheng, } from '../liureng/LRZhangSheng';
import { resolveLiuRengTwelvePanStyle } from '../liureng/LRPanStyle';
import { HourZi, } from '../gua/GuaConst';

function extractBranch(value){
	if(value === undefined || value === null){
		return '';
	}
	const txt = `${value}`;
	const match = txt.match(/[子丑寅卯辰巳午未申酉戌亥]/);
	return match ? match[0] : txt;
}

function isBranch(value){
	return LRConst.ZiList.indexOf(value) >= 0;
}

function getStemColor(value){
	const stem = `${value || ''}`.substr(0, 1);
	if(stem === '甲' || stem === '乙'){
		return 'var(--horosa-liureng-stem-wood, #73b36b)';
	}
	if(stem === '丙' || stem === '丁'){
		return 'var(--horosa-liureng-stem-fire, #c9483e)';
	}
	if(stem === '戊' || stem === '己'){
		return 'var(--horosa-liureng-stem-earth, #c19a57)';
	}
	if(stem === '庚' || stem === '辛'){
		return 'var(--horosa-liureng-stem-metal, #d8d2c7)';
	}
	if(stem === '壬' || stem === '癸'){
		return 'var(--horosa-liureng-stem-water, #8f9694)';
	}
	return 'var(--horosa-liureng-square-main, #f0eee7)';
}

function getBranchColor(value){
	const branch = `${value || ''}`.substr(0, 1);
	if(branch === '寅' || branch === '卯'){
		return 'var(--horosa-liureng-stem-wood, #73b36b)';
	}
	if(branch === '巳' || branch === '午'){
		return 'var(--horosa-liureng-stem-fire, #c9483e)';
	}
	if(branch === '辰' || branch === '戌' || branch === '丑' || branch === '未'){
		return 'var(--horosa-liureng-stem-earth, #c19a57)';
	}
	if(branch === '申' || branch === '酉'){
		return 'var(--horosa-liureng-stem-metal, #d8d2c7)';
	}
	if(branch === '亥' || branch === '子'){
		return 'var(--horosa-liureng-stem-water, #8f9694)';
	}
	return 'var(--horosa-liureng-square-main, #f0eee7)';
}

class RengChart {
	constructor(options){
		this.chartId = options.id;
		this.chartObj = options.chartObj;
		this.fields = options.fields;
		this.tooltipId = options.tooltipId;
		this.nongli = options.nongli;
		this.liureng = options.liureng;
		this.runyear = options.runyear;
		this.gender = options.gender;
		this.zhangshengElem = options.zhangshengElem;
		this.guireng = options.guireng;
		this.castOverride = options.castOverride || null;
		this.panStyleName = options.panStyleName || '';
		this.onMetaInfoClick = options.onMetaInfoClick;
		this.chartType = options.chartType !== undefined && options.chartType !== null ? options.chartType : LRChart_Square;
		this.compactPreview = !!options.compactPreview;

		this.margin = 20;
		this.svgTopgroup = null;
		this.svg = null;

		this.bgColor = 'var(--horosa-astro-panel, #090b0e)';
		this.color = 'var(--horosa-liureng-square-line, rgba(231, 189, 117, 0.18))';
		this.fontSize = 20;

		this.rengs = [];
		this.yue = null;
		if(this.chartObj){
			for(let i=0; i<this.chartObj.objects.length; i++){
				let obj = this.chartObj.objects[i];
				if(obj.id === AstroConst.SUN){
					this.yue = getSignZi(obj.sign);
					break;
				}
			}	
		}

		this.ke = null;

	}

	set chart(chartobj){
		this.chartObj = chartobj;
		for(let i=0; i<chartobj.objects.length; i++){
			let obj = chartobj.objects[i];
			if(obj.id === AstroConst.SUN){
				this.yue = getSignZi(obj.sign);
				break;
			}
		}
	}

	draw(){
		if(this.chartObj === undefined || this.chartObj === null){
			return null;
		}
		let svgdom = document.getElementById(this.chartId); 
		if(svgdom === undefined || svgdom === null){
			return null;
		}
		let width = svgdom.clientWidth;
		// 读外层 host 的可视高度(而非 svg 自身——svg 可能已被撑高用于滚动),得到真实可用视口高度;
		// 否则窗口缩小后会读到上次撑高的 svg 高度、无法回缩。
		const hostEl = svgdom.parentNode;
		let height = (hostEl && hostEl.clientHeight) ? hostEl.clientHeight : svgdom.clientHeight;
		if(width === 0 || height === 0){
			return null;
		}

		let realW = width;
		let realH = height;
		// 方盘按「中间栏最下端」钳住(用户实告:缩放窗口时方盘下端超过窗口最下端):host 自身可能比
		// 可视区高(grid 隐式行收敛失败时),用视口底再钳一次,svg 永不越过窗口最下端。
		// 仅方盘+非紧凑生效,圆盘(底部神煞大表依赖滚动看全)与紧凑预览路径零波及。
		if(!this.compactPreview && !this.isCircleChart() && typeof window !== 'undefined'
			&& hostEl && typeof hostEl.getBoundingClientRect === 'function'){
			const hostTop = hostEl.getBoundingClientRect().top;
			const viewportAvail = (window.innerHeight || height) - hostTop - 8;
			if(viewportAvail > 0 && viewportAvail < height){
				height = viewportAvail;
				realH = height;
			}
		}
		// ② 防裁切可下滑:圆盘含神煞大表(预留最小约 720)。方盘自适应收缩(下方 drawSimple* 已按 cord.h
		// 收纳),仅低于最小可读阈值 360 才回落「撑高 svg + host 滚动」;窗口短于阈值则按最小高度绘制,
		// 并把 svg 自身撑到该高度 → 外层 host(overflow-y:auto)即可纵向滚动看全(compactPreview 预览不强制)。
		const minChartH = this.compactPreview ? 0 : (this.isCircleChart() ? 720 : 360);
		if(minChartH > 0 && realH < minChartH){
			realH = minChartH;
		}

		this.hasDrawGua = false;
		let svgid = '#' + this.chartId;
		this.svg = d3.select(svgid);
		this.svg.html('');
		this.svg.attr('stroke', this.color).attr("stroke-width", 1).attr('width', realW).attr('height', realH);
		// 强制 svg 渲染高度=realH(flex 容器/百分比 min-height 会把它压到可用高度而裁切内容);用 inline !important 压过样式表。
		this.svg.node().style.setProperty('height', realH + 'px', 'important');
	
		this.svgTopgroup = this.svg.append('g');
		this.svgTopgroup.append('rect')
			.attr('fill', this.bgColor)
			.attr('stroke', this.color)
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', realW).attr('height', realH);

		if(!this.compactPreview && !this.liureng){
			return null;
		}

		const circleLayout = !this.compactPreview && this.isCircleChart();
		// ② 方盘:时间 header 原 178~220px 偏高,挤压下方盘面 → 小窗下端超出。收紧到 108~150px(时间整体上移),
		// 间距同步调小。圆盘分支(下方 if(circleLayout))单独设值、不受影响。
		let titleH = this.compactPreview ? 0 : Math.min(150, Math.max(108, realH * 0.105));
		let bodyGap = this.compactPreview ? 0 : Math.max(12, Math.min(24, realH * 0.016));
		if(circleLayout){
			titleH = Math.min(112, Math.max(86, realH * 0.092));
			bodyGap = Math.max(6, Math.min(12, realH * 0.008));
		}
		let h = Math.max(0, realH - titleH - bodyGap);
		let cords = [];
		cords[0] = {x: 0, y: titleH + bodyGap, w: realW, h: h};
		cords[1] = {x: 0, y: 0, w: realW, h: titleH};

		if(!this.compactPreview){
			this.drawLiuRengInfoHeader(cords[1]);
		}
		this.prepareLiuRengBase(cords[0]);
		if(this.compactPreview){
			this.drawSquareBoardBody(cords[0]);
		}else if(this.isCircleChart()){
			this.drawCircleBody(cords[0]);
		}else{
			this.drawSimpleBody(cords[0]);
		}
		}

	isCircleChart(){
		return parseInt(this.chartType, 10) === LRChart_Circle;
	}

	prepareLiuRengBase(cord){
		let w = cord.w;
		let h = cord.h;
		let x = cord.x;
		let y = cord.y;

		let opt = {
			chartObj: this.chartObj,
			fields: this.fields,
			x: x,
			y: y,
			width: w,
			height: h,
			owner: this.svgTopgroup,
			divTooltip: this.tooltipId ? d3.select(`#${this.tooltipId}`) : null,
			yue: this.yue,
			nongli: this.nongli,
			guireng: this.guireng,
			castOverride: this.castOverride,
			panStyleName: this.panStyleName || this.getPanStyleName(),
		};

		let chartsvg = new LRTextSquareChart(opt);
		this.rengs[0] = chartsvg;	
		this.rengs[0].genYueJiangIndex();
		this.rengs[0].genHouseTianJiang();
		const panStyleName = this.panStyleName || this.getPanStyleName();
		if(this.rengs[0] && panStyleName){
			this.rengs[0].panStyleName = panStyleName;
		}

		this.ke = this.rengs[0].getKe();

	}

	prepareChuang(cord){
		if(this.rengs.length === 0 || this.rengs[0] === undefined || this.rengs[0] === null){
			return null;
		}

		const opt = {
			chartObj: this.chartObj,
			x: cord.x,
			y: cord.y,
			width: cord.w,
			height: cord.h,
			owner: this.svgTopgroup,
			ke: this.ke,
			nongli: this.nongli,
			guireng: this.guireng,
			seHaiOpts: this.castOverride ? this.castOverride.seHaiOpts : null,
			liuRengChart: this.rengs[0],
			divTooltip: this.tooltipId ? d3.select(`#${this.tooltipId}`) : null,
		};
		const csvg = new ChuangChart(opt);
		try{
			csvg.genCuangs();
		}catch(e){
			if(typeof console !== 'undefined' && console.warn){
				console.warn('[RengChart] failed to generate san chuan', e);
			}
		}
		if(!csvg.cuangs){
			csvg.cuangs = {
				name: '',
				tianJiang: [],
				liuQin: [],
				cuang: [],
			};
		}
		this.rengs[2] = csvg;
		if(this.rengs[0]){
			this.rengs[0].cuangName = csvg.cuangs && csvg.cuangs.name ? csvg.cuangs.name : '';
		}
		return csvg;
	}

	drawSquareBoardBody(cord){
		if(!this.rengs[0]){
			return;
		}
		this.prepareChuang(cord);
		this.rengs[0].draw();
	}

	drawCircleBody(cord){
		if(!this.rengs[0]){
			return;
		}
		const outerGap = Math.max(4, Math.min(12, cord.w * 0.008));
		const innerGap = Math.max(8, Math.min(18, cord.w * 0.012));
        const reservedMetaH = this.liureng ? Math.max(320, Math.min(470, cord.h * 0.52)) : 0;
        const topAreaH = Math.max(240, cord.h - outerGap * 2 - (reservedMetaH ? reservedMetaH + innerGap : 0));
        const bodyY = cord.y + outerGap;
		const contentW = Math.max(0, cord.w - outerGap * 2);
		const circleColumnW = Math.max(280, Math.min(contentW * 0.41, contentW - 360));
		const rightX = cord.x + outerGap + circleColumnW + innerGap;
		const rightW = Math.max(220, cord.x + cord.w - rightX - outerGap);
        const size = Math.max(220, Math.min(circleColumnW * 0.92, topAreaH, 440) - 4);
		const x = cord.x + outerGap + (circleColumnW - size) / 2;
		const y = bodyY;
		const opt = {
			chartObj: this.chartObj,
			fields: this.fields,
			x,
			y,
			width: size,
			height: size,
			owner: this.svgTopgroup,
			divTooltip: this.tooltipId ? d3.select(`#${this.tooltipId}`) : null,
			yue: this.yue,
			nongli: this.nongli,
			guireng: this.guireng,
			castOverride: this.castOverride,
			panStyleName: this.panStyleName || this.getPanStyleName(),
		};
		const circle = new LRCircleChart(opt);
		circle.draw();
		this.rengs[1] = circle;

		const keChuanCord = {
            x: rightX,
            y: bodyY,
            w: rightW,
            h: Math.max(250, Math.min(topAreaH, 380)),
        };
		this.drawGua2(keChuanCord);
		if(this.rengs[2] && this.rengs[2].cuangs && this.rengs[2].cuangs.name){
			circle.cuangName = this.rengs[2].cuangs.name;
		}

		if(reservedMetaH > 0){
			const metaY = bodyY + Math.max(size, keChuanCord.h) + innerGap;
			const metaBottom = cord.y + cord.h - outerGap;
			this.drawCircleMetaTables({
				x: cord.x + outerGap,
				y: metaY,
				w: contentW,
				h: Math.max(220, metaBottom - metaY),
			});
		}
	}

	formatSolarTime(){
		const fields = this.fields || {};
		if(fields.date && fields.date.value && fields.time && fields.time.value){
			const dateText = `${fields.date.value.format ? fields.date.value.format('YYYY-MM-DD HH:mm:ss') : fields.date.value}`;
			const timeText = `${fields.time.value.format ? fields.time.value.format('YYYY-MM-DD HH:mm:ss') : fields.time.value}`;
			const dateMatch = dateText.match(/(-?\d{1,5})-(\d{1,2})-(\d{1,2})/);
			const timeMatch = timeText.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
			if(dateMatch){
				return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')} ${timeMatch ? timeMatch[1].padStart(2, '0') : '00'}:${timeMatch ? timeMatch[2].padStart(2, '0') : '00'}:${timeMatch && timeMatch[3] ? timeMatch[3].padStart(2, '0') : '00'}`;
			}
		}
		if(fields.params && fields.params.birth){
			const match = `${fields.params.birth}`.match(/(-?\d{1,5})-(\d{1,2})-(\d{1,2}).*?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
			if(match){
				return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')} ${match[4].padStart(2, '0')}:${match[5].padStart(2, '0')}:${match[6] ? match[6].padStart(2, '0') : '00'}`;
			}
			return `${fields.params.birth}`.substr(0, 16);
		}
		if(this.nongli && this.nongli.birth){
			const match = `${this.nongli.birth}`.match(/(-?\d{1,5})-(\d{1,2})-(\d{1,2}).*?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
			if(match){
				return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')} ${match[4].padStart(2, '0')}:${match[5].padStart(2, '0')}:${match[6] ? match[6].padStart(2, '0') : '00'}`;
			}
			return `${this.nongli.birth}`.substr(0, 16);
		}
		return '';
	}

	getFourPillars(){
		const cols = this.liureng && this.liureng.fourColumns ? this.liureng.fourColumns : {};
		const nongli = this.nongli || {};
		return [{
			label: '年',
			value: cols.year && cols.year.ganzi ? cols.year.ganzi : (nongli.yearGanZi || nongli.yearJieqi || nongli.year || ''),
		}, {
			label: '月',
			value: cols.month && cols.month.ganzi ? cols.month.ganzi : (nongli.monthGanZi || ''),
		}, {
			label: '日',
			value: cols.day && cols.day.ganzi ? cols.day.ganzi : (nongli.dayGanZi || ''),
		}, {
			label: '时',
			value: cols.time && cols.time.ganzi ? cols.time.ganzi : (nongli.time || ''),
		}];
	}

	drawInfoText(group, text, x, y, options = {}){
		return group.append('text')
			.attr('x', x)
			.attr('y', y)
			.attr('text-anchor', options.anchor || 'start')
			.attr('dominant-baseline', options.baseline || 'middle')
			.attr('fill', options.fill || 'var(--horosa-liureng-square-main, #f0eee7)')
			.attr('stroke', 'none')
			.attr('font-size', options.size || 18)
			.attr('font-weight', options.weight || 650)
			.attr('font-family', options.family || '"Songti SC", "STSong", "Noto Serif CJK SC", serif')
			.text(text || '');
	}

	drawInfoPair(group, label, value, x, y, options = {}){
		const text = group.append('text')
			.attr('x', x)
			.attr('y', y)
			.attr('text-anchor', options.anchor || 'end')
			.attr('dominant-baseline', 'middle')
			.attr('fill', options.fill || 'var(--horosa-liureng-square-main, #f0eee7)')
			.attr('stroke', 'none')
			.attr('font-size', options.size || 18)
			.attr('font-weight', options.weight || 760)
			.attr('font-family', options.family || '"Songti SC", "STSong", "Noto Serif CJK SC", serif');
		text.append('tspan')
			.attr('fill', options.labelFill || 'var(--horosa-liureng-square-main, #f0eee7)')
			.text(label || '');
		text.append('tspan')
			.attr('fill', options.valueFill || 'var(--horosa-liureng-square-muted, #8f9694)')
			.text(value || '—');
		return text;
	}

	drawFourPillar(group, pillar, x, y, fontSize){
		const value = `${pillar.value || ''}`;
		const gan = value.substr(0, 1);
		const zhi = value.substr(1, 1);
		const labelX = x + fontSize * 0.98;
		this.drawInfoText(group, gan, x, y, {
			fill: getStemColor(gan),
			size: fontSize,
			weight: 760,
			anchor: 'middle',
		});
		this.drawInfoText(group, zhi, x, y + fontSize * 1.12, {
			fill: getBranchColor(zhi),
			size: fontSize,
			weight: 760,
			anchor: 'middle',
		});
		this.drawInfoText(group, pillar.label, labelX, y + fontSize * 0.56, {
			fill: 'var(--horosa-liureng-square-muted, #8f9694)',
			size: Math.max(12, fontSize * 0.48),
			weight: 650,
			anchor: 'middle',
		});
	}

	formatTrueSolarTime(){
		// 真太阳时 = 后端按经度校正后的起课时刻(this.nongli.birth);六壬默认按真太阳时定时辰/三传。
		if(this.nongli && this.nongli.birth){
			const m = `${this.nongli.birth}`.match(/(-?\d{1,5})-(\d{1,2})-(\d{1,2}).*?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
			if(m){
				return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')} ${m[4].padStart(2, '0')}:${m[5].padStart(2, '0')}:${m[6] ? m[6].padStart(2, '0') : '00'}`;
			}
			return `${this.nongli.birth}`.substr(0, 19);
		}
		return '';
	}

	drawLiuRengInfoHeader(cord){
		if(!cord || cord.h <= 0 || !this.liureng){
			return;
		}
		const group = this.svgTopgroup.append('g').attr('class', 'liureng-info-header');
		const padX = Math.max(18, cord.w * 0.05);
		const topY = cord.y + Math.max(34, cord.h * 0.42);
		const dividerY = cord.y + cord.h - Math.max(8, cord.h * 0.055);
		const summarySize = Math.max(16, Math.min(24, cord.w * 0.028));
		const solarTime = this.formatSolarTime();
		const trueSolar = this.formatTrueSolarTime();
		const pillars = this.getFourPillars();
		const pillarText = pillars
			.map((pillar)=>`${pillar.value || '—'}${pillar.label}`)
			.join(' ');
		// 六壬默认真太阳时:有真太阳时则以它为准显示(决定时辰/三传),否则回退公历钟表时。
		const summaryText = trueSolar
			? `真太阳时：${trueSolar}；八字：${pillarText}`
			: `公历：${solarTime || '—'}；八字：${pillarText}`;

		this.drawInfoText(group, summaryText, cord.x + cord.w / 2, topY, {
			fill: 'var(--horosa-liureng-square-main, #f0eee7)',
			size: summarySize,
			weight: 760,
			anchor: 'middle',
			family: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
		});

		group.append('line')
			.attr('x1', cord.x + padX)
			.attr('x2', cord.x + cord.w - padX)
			.attr('y1', dividerY)
			.attr('y2', dividerY)
			.attr('stroke', 'var(--horosa-liureng-square-line, rgba(231, 189, 117, 0.18))')
			.attr('stroke-width', 1);
	}

	getShortJiang(name){
		const map = {
			'贵人': '贵',
			'螣蛇': '蛇',
			'朱雀': '雀',
			'六合': '合',
			'勾陈': '勾',
			'青龙': '龙',
			'天空': '空',
			'白虎': '虎',
			'太常': '常',
			'玄武': '玄',
			'太阴': '阴',
			'天后': '后',
		};
		return map[name] || `${name || ''}`.substr(0, 1);
	}

	getXunGanMap(){
		const dayGanZi = this.nongli && this.nongli.dayGanZi ? this.nongli.dayGanZi : '';
		const gan = dayGanZi.substr(0, 1);
		const zi = dayGanZi.substr(1);
		const xun = LRConst.getXun(gan, zi);
		const map = {};
		for(let i=0; i<xun.length && i<LRConst.GanList.length; i++){
			map[xun[i]] = LRConst.GanList[i];
		}
		return map;
	}

	drawSimpleText(group, text, x, y, options = {}){
		const anchor = options.anchor || 'middle';
		const node = group.append('text')
			.attr('x', x)
			.attr('y', y)
			.attr('text-anchor', anchor)
			.attr('dominant-baseline', 'middle')
			.attr('fill', options.fill || 'var(--horosa-liureng-square-main, #f0eee7)')
			.attr('font-size', options.size || 18)
			.attr('font-weight', options.weight || 520)
			.attr('font-family', options.family || '"Songti SC", "STSong", "Noto Serif CJK SC", serif')
			.text(text || '');
		if(anchor === 'middle' && options.visualAlign !== false){
			this.alignTextVisualCenter(node, x);
		}
		this.bindSimpleTip(node, options);
		return node;
	}

	alignTextVisualCenter(node, targetX){
		if(!node || !node.node){
			return;
		}
		const textNode = node.node();
		if(!textNode || !textNode.getBBox){
			return;
		}
		try{
			const bbox = textNode.getBBox();
			if(!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.width)){
				return;
			}
			const visualCenter = bbox.x + bbox.width / 2;
			const offset = targetX - visualCenter;
			if(Math.abs(offset) > 0.01){
				node.attr('x', targetX + offset);
			}
		}catch(e){
			// Some headless or hidden SVG states cannot measure text boxes; default SVG anchoring is the fallback.
		}
	}

	bindSimpleTip(target, options = {}){
		if(!target || !this.rengs[0]){
			return;
		}
		if(options.houseIndex !== undefined && options.houseIndex !== null){
			this.rengs[0].bindHouseTooltip(target, options.houseIndex);
			target.style('cursor', 'help');
			return;
		}
		if(options.branch){
			this.rengs[0].bindShenTooltip(target, options.branch);
			target.style('cursor', 'help');
		}
	}

	getHouseIndexByUpBranch(branch){
		const chart = this.rengs[0];
		if(!chart || !chart.upZi){
			return -1;
		}
		return chart.upZi.indexOf(extractBranch(branch));
	}

	drawSimpleBody(cord){
		if(!this.rengs[0]){
			return;
		}
		const chart = this.rengs[0];
		const csvg = this.prepareChuang(cord);

		const group = this.svgTopgroup.append('g').attr('class', 'liureng-simple-body');
		const padX = Math.max(34, cord.w * 0.055);
		const padTop = Math.max(28, cord.h * 0.045);    // ② Y 间距收紧(原 48/0.07)
		const padBottom = Math.max(20, cord.h * 0.028); // ② Y 间距收紧(原 32/0.035)
		const bodyY = cord.y + padTop;
		const bodyH = Math.max(0, cord.h - padTop - padBottom);
		// 统一几何(还原参考图):8 行等距、行距=ring、字号 main=ring/1.35(灰黑同号、行间隙≈半字高)。
		// 方盘 7ring 见方 + 间距 0.6ring + 四课三传 4 列(列距 ring),整体紧凑居中、尽量放大填满中栏。
		// 总内容宽 W ≈ 11.6ring;宽度预算取中栏 80%(两侧各留约 10% 余白)、高度取 8 行容量,二者最小者。
		const ring = Math.max(24, Math.min(bodyH / 7.1, (cord.w * 0.8) / 11.6));
		const W = 11.6 * ring;
		const blockX0 = cord.x + Math.max(padX * 0.5, (cord.w - W) / 2);
		const geo = {
			cy: bodyY + bodyH / 2,
			ring: ring,
			main: ring / 1.35,
			panCx: blockX0 + 3.5 * ring,                  // 方盘中心
			keX: blockX0 + 7 * ring + 0.6 * ring + 0.5 * ring, // 四课三传第 1 列中心(方盘右缘 + 0.6ring 间距)
		};
		const left = { x: blockX0, y: bodyY, w: 7 * ring, h: bodyH };
		const right = { x: geo.keX, y: bodyY, w: 4 * ring, h: bodyH };
		this.drawSimpleTextPan(group, left, chart, geo);
		this.drawSimpleKeChuan(group, right, csvg, geo);
		this.drawCirclePreviewButton(group, {
			x: cord.x + cord.w - 92,
			y: cord.y + Math.max(12, cord.h * 0.02),
			w: 70,
			h: 30,
		});
	}

	getSimpleHouse(chart, diBranch){
		const idx = chart && chart.downZi ? chart.downZi.indexOf(diBranch) : -1;
		if(idx < 0){
			return {
				di: diBranch,
				up: '',
				gan: '◎',
				jiang: '',
			};
		}
		const up = chart.upZi[idx] || '';
		const map = this.getXunGanMap();
		return {
			idx,
			di: diBranch,
			up,
			gan: map[up] || '◎',
			jiang: this.getShortJiang(chart.houseTianJiang[idx] || ''),
		};
	}

	drawSimpleTextPan(group, cord, chart, geo){
		const panGroup = group.append('g').attr('class', 'liureng-simple-pan');
		const gold = 'var(--horosa-liureng-square-jiang, #d8ad63)';
		const main = 'var(--horosa-liureng-square-main, #f0eee7)';
		const muted = 'var(--horosa-liureng-square-muted, #8f9694)';
		// 8 行等距网格(行 i 的 y = cy+(i-3.5)*ring):顶边巳午未申占行0-2、左右辰卯/酉戌占行3-4、底边寅丑子亥占行5-7。
		const ring = (geo && geo.ring) || Math.min(cord.w, cord.h) / 7.8;
		const F = (geo && geo.main) || ring / 1.35;
		const cx = (geo && geo.panCx) || (cord.x + cord.w / 2);
		const cy = (geo && geo.cy) || (cord.y + cord.h / 2);
		const rowY = (i)=> cy + (i - 3.5) * ring;
		const branches = LRConst.ZiList;
		const house = branches.reduce((acc, b)=>{ acc[b] = this.getSimpleHouse(chart, b); return acc; }, {});
		const T = (text, x, y, fill, tip)=> this.drawSimpleText(panGroup, text || '', x, y, { fill: fill, size: F, weight: (fill === muted ? 560 : 760), ...(tip || {}) });
		// 顶边:jiang(行0)/gan(行1)/up(行2),列 j=0..3
		['巳', '午', '未', '申'].forEach((b, j)=>{ const d = house[b] || {}; const x = cx + (j - 1.5) * ring;
			T(d.jiang, x, rowY(0), gold, { houseIndex: d.idx });
			T(d.gan, x, rowY(1), muted, {});
			T(d.up, x, rowY(2), main, { branch: d.up });
		});
		// 底边:up(行5)/gan(行6)/jiang(行7)
		['寅', '丑', '子', '亥'].forEach((b, j)=>{ const d = house[b] || {}; const x = cx + (j - 1.5) * ring;
			T(d.up, x, rowY(5), main, { branch: d.up });
			T(d.gan, x, rowY(6), muted, {});
			T(d.jiang, x, rowY(7), gold, { houseIndex: d.idx });
		});
		// 左边 辰(行3)卯(行4):jiang(cx-3.5ring)/gan(cx-2.5ring)/up(cx-1.5ring)
		[['辰', 3], ['卯', 4]].forEach((it)=>{ const d = house[it[0]] || {}; const y = rowY(it[1]);
			T(d.jiang, cx - 3.5 * ring, y, gold, { houseIndex: d.idx });
			T(d.gan, cx - 2.5 * ring, y, muted, {});
			T(d.up, cx - 1.5 * ring, y, main, { branch: d.up });
		});
		// 右边 酉(行3)戌(行4):up(cx+1.5ring)/gan(cx+2.5ring)/jiang(cx+3.5ring)
		[['酉', 3], ['戌', 4]].forEach((it)=>{ const d = house[it[0]] || {}; const y = rowY(it[1]);
			T(d.up, cx + 1.5 * ring, y, main, { branch: d.up });
			T(d.gan, cx + 2.5 * ring, y, muted, {});
			T(d.jiang, cx + 3.5 * ring, y, gold, { houseIndex: d.idx });
		});
	}

	formatChuanGanZi(gz){
		const txt = `${gz || ''}`;
		if(txt.indexOf('空') === 0 && txt.length > 1){
			return `${txt.substr(1)}空`;
		}
		return txt;
	}

	parseChuanGanZi(gz){
		const txt = `${gz || ''}`;
		const branch = extractBranch(txt);
		const isKong = txt.indexOf('空') >= 0;
		if(!branch){
			return {
				gan: '',
				branch: '',
				kong: isKong ? '空' : '',
			};
		}
		const gan = isKong ? '' : txt.replace(branch, '').replace(/空/g, '').substr(0, 1);
		return {
			gan,
			branch,
			kong: isKong ? '空' : '',
		};
	}

	drawSimpleKeChuan(group, cord, csvg, geo){
		const rightGroup = group.append('g').attr('class', 'liureng-simple-ke-chuan');
		const gold = 'var(--horosa-liureng-square-jiang, #d8ad63)';
		const main = 'var(--horosa-liureng-square-main, #f0eee7)';
		const muted = 'var(--horosa-liureng-square-muted, #8f9694)';
		// 四课对齐天盘上 3 行(行0/1/2)、三传对齐下 3 行(行5/6/7);4 列居中铺右区,字号灰黑同 main。
		const ring = (geo && geo.ring) || Math.min(cord.w, cord.h) / 7.8;
		const F = (geo && geo.main) || ring / 1.35;
		const cy = (geo && geo.cy) || (cord.y + cord.h / 2);
		const rowY = (i)=> cy + (i - 3.5) * ring;
		const tokenGap = ring; // 列距=方盘列距(紧凑还原参考图)
		const keX = (geo && geo.keX) || (cord.x + Math.max(4, (cord.w - tokenGap * 3) / 2));
		const keList = Array.isArray(this.ke) ? this.ke : [];
		const keOrder = [3, 2, 1, 0];
		const T = (text, x, y, fill, w, tip)=> this.drawSimpleText(rightGroup, text || '', x, y, { anchor: 'middle', fill: fill, size: F, weight: w || 620, ...(tip || {}) });
		// 四课:行0 天将 / 行1 上神 / 行2 下神
		[0, 1, 2].forEach((rowIdx)=>{ const y = rowY(rowIdx);
			keOrder.forEach((keIdx, tokenIdx)=>{ const ke = keList[keIdx] || []; const x = keX + tokenIdx * tokenGap;
				if(rowIdx === 0){ T(this.getShortJiang(ke[0]), x, y, gold, 760, { houseIndex: this.getHouseIndexByUpBranch(ke[1]) }); }
				else if(rowIdx === 1){ const t = ke[1] || ''; T(t, x, y, main, 700, { branch: extractBranch(t) }); }
				else { const t = ke[2] || ''; const b = extractBranch(t); T(t, x, y, muted, 620, (b && isBranch(b)) ? { branch: b } : {}); }
			});
		});
		// 三传:六亲/干/支/将 4 列,对齐天盘下 3 行
		const cuangs = csvg && csvg.cuangs ? csvg.cuangs : {};
		const liuQin = Array.isArray(cuangs.liuQin) ? cuangs.liuQin : [];
		const chuan = Array.isArray(cuangs.cuang) ? cuangs.cuang : [];
		const tianJiang = Array.isArray(cuangs.tianJiang) ? cuangs.tianJiang : [];
		for(let i = 0; i < 3; i++){ const y = rowY(5 + i);
			const lq = liuQin[i] ? `${liuQin[i]}`.substr(0, 1) : '';
			const ct = chuan[i] ? chuan[i] : '';
			const pc = this.parseChuanGanZi(ct);
			T(lq, keX + 0 * tokenGap, y, muted, 620, {});
			T(pc.gan, keX + 1 * tokenGap, y, muted, 620, {});
			T(pc.branch, keX + 2 * tokenGap, y, main, 760, { branch: pc.branch });
			T(this.getShortJiang(tianJiang[i] ? tianJiang[i] : ''), keX + 3 * tokenGap, y, gold, 760, { houseIndex: this.getHouseIndexByUpBranch(ct) });
		}
	}

	drawCirclePreviewButton(group, cord){
		if(!this.tooltipId){
			return;
		}
		const button = group.append('g')
			.attr('class', 'liureng-circle-preview-button')
			.style('cursor', 'help');
		button.append('rect')
			.attr('x', cord.x)
			.attr('y', cord.y)
			.attr('width', cord.w)
			.attr('height', cord.h)
			.attr('rx', 8)
			.attr('ry', 8)
			.attr('fill', 'rgba(231, 189, 117, 0.08)')
			.attr('stroke', 'rgba(231, 189, 117, 0.42)')
			.attr('stroke-width', 1);
		button.append('text')
			.attr('x', cord.x + cord.w / 2)
			.attr('y', cord.y + cord.h / 2)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'middle')
			.attr('fill', 'var(--horosa-astro-gold, #e7bd75)')
			.attr('stroke', 'none')
			.attr('font-size', 12)
			.attr('font-weight', 700)
			.text('圆形盘');
		button.on('mouseover', (evt)=>{
			this.showCirclePreviewTooltip(evt, button);
		}).on('mousemove', (evt)=>{
			const divTooltip = d3.select(`#${this.tooltipId}`);
			positionFloatingTooltip(divTooltip, evt, {
				anchorNode: button.node(),
				offsetX: 12,
				offsetY: 10,
				viewportPadding: 14,
			});
		}).on('mouseout', ()=>{
			d3.select(`#${this.tooltipId}`).transition().duration(250).style('opacity', 0);
		});
	}

	showCirclePreviewTooltip(evt, anchor){
		const divTooltip = d3.select(`#${this.tooltipId}`);
		if(!divTooltip || !divTooltip.node || !divTooltip.node()){
			return;
		}
		const svgId = 'liureng-circle-preview-' + randomStr(8);
		divTooltip
			.style('opacity', 1)
			.html(`<div class="liureng-circle-preview-tooltip"><div class="liureng-circle-preview-title">圆形盘</div><svg id="${svgId}" width="330" height="330"></svg></div>`);
		positionFloatingTooltip(divTooltip, evt, {
			anchorNode: anchor.node(),
			offsetX: 12,
			offsetY: 10,
			viewportPadding: 14,
		});
		const previewSvg = d3.select(`#${svgId}`);
		const opt = {
			chartObj: this.chartObj,
			fields: this.fields,
			x: 12,
			y: 12,
			width: 306,
			height: 306,
			owner: previewSvg,
			divTooltip: null,
			yue: this.yue,
			nongli: this.nongli,
			guireng: this.guireng,
			castOverride: this.castOverride,
			panStyleName: this.panStyleName || this.getPanStyleName(),
		};
		const circle = new LRCircleChart(opt);
		circle.draw();
		if(this.rengs[2] && this.rengs[2].cuangs && this.rengs[2].cuangs.name){
			circle.cuangName = this.rengs[2].cuangs.name;
		}
	}

	getPanStyleName(){
		const timeBranch = this.nongli && this.nongli.time ? extractBranch(this.nongli.time) : '';
		// 盘式以真实月将(castOverride.actualYue)为准;this.yue 是起课法天盘起支(仅上下盘对齐),非起课法下二者相等。
		const yueRef = (this.castOverride && this.castOverride.actualYue) || this.yue;
		const panStyle = resolveLiuRengTwelvePanStyle(yueRef, timeBranch);
		return panStyle && panStyle.name ? panStyle.name : '';
	}

	drawGua2(cord){
		let w = (cord.w - this.margin*2)*4/7;
		let h = cord.h - this.margin;
		let x = cord.x + this.margin/2;
		let y = cord.y + this.margin/2;

		if(this.rengs.length === 0 || this.rengs[0] === undefined || this.rengs[0] === null){
			return;
		}

		let opt = {
			chartObj: this.chartObj,
			x: x,
			y: y,
			width: w,
			height: h,
			owner: this.svgTopgroup,
			ke: this.ke,
			nongli: this.nongli,	
			guireng: this.guireng,
			seHaiOpts: this.castOverride ? this.castOverride.seHaiOpts : null,
			liuRengChart: this.rengs[0],
			divTooltip: this.tooltipId ? d3.select(`#${this.tooltipId}`) : null,
		};
		let kesvg = new KeChart(opt);
		this.rengs[1] = kesvg;
		this.rengs[1].draw();

		let w1 = (cord.w - this.margin*2)*3/7;
		let h1 = h;
		let x1 = cord.x + w + this.margin;
		let y1 = y;
		let opt1 = {
			chartObj: this.chartObj,
			x: x1,
			y: y1,
			width: w1,
			height: h1,
			owner: this.svgTopgroup,
			ke: this.ke,
			nongli: this.nongli,
			guireng: this.guireng,
			seHaiOpts: this.castOverride ? this.castOverride.seHaiOpts : null,
			liuRengChart: this.rengs[0],
			divTooltip: this.tooltipId ? d3.select(`#${this.tooltipId}`) : null,
		};
		let csvg = new ChuangChart(opt1);
		this.rengs[2] = csvg;
		this.rengs[2].draw();

	}

	drawCircleMetaTables(cord){
		if(this.liureng === undefined || this.liureng === null){
			return;
		}

		const sections = [
			['行年', this.getRunYear()],
			['旬日', this.getXun()],
			['旺衰', this.getData(this.liureng.season)],
			['支煞', this.getData(this.liureng.godsZi)],
			['年煞', this.getYearGods()],
			[`${this.zhangshengElem}十二长生`, this.getZhangSheng()],
			['基础神煞', this.getData(this.liureng.gods)],
			['干煞', this.getData(this.liureng.godsGan)],
			['月煞', this.getData(this.liureng.godsMonth)],
		].filter((item)=>Array.isArray(item[1]) && item[1].length > 0);

		if(sections.length === 0 || cord.w <= 0 || cord.h <= 0){
			return;
		}

		const gap = 8;
		const byTitle = sections.reduce((acc, section)=>{
			acc[section[0]] = section;
			return acc;
		}, {});
		const leftTop = ['行年', '旬日', '旺衰'].map((key)=>byTitle[key]).filter(Boolean);
		const leftBottom = ['基础神煞', '干煞', '月煞'].map((key)=>byTitle[key]).filter(Boolean);
		const rightTall = ['支煞', '年煞', `${this.zhangshengElem}十二长生`].map((key)=>byTitle[key]).filter(Boolean);

		if(leftTop.length + leftBottom.length + rightTall.length >= sections.length){
			const leftW = Math.max(320, Math.min(cord.w * 0.48, cord.w - 360));
			const rightW = cord.w - leftW - gap;
			const leftColW = (leftW - gap * 2) / 3;
			const rightColW = (rightW - gap * 2) / 3;
			const topRowH = Math.max(92, Math.min(142, cord.h * 0.31));
			const bottomRowH = Math.max(92, cord.h - topRowH - gap);
			const drawSection = (section, x, y, width, height, rowType)=>{
				const opt = {
					chartObj: this.chartObj,
					guireng: this.guireng,
					x,
					y,
					width,
					height,
					owner: this.svgTopgroup,
					title: section[0],
					gods: section[1],
				};
				const chart = new GodChart(opt);
				chart.titleFontSize = Math.max(14, Math.min(rowType === 'top' ? 23 : 20, opt.height * (rowType === 'top' ? 0.24 : 0.18)));
				chart.godFontSize = Math.max(rowType === 'tall' ? 11 : 13, Math.min(rowType === 'top' ? 18 : 16, opt.height * (rowType === 'tall' ? 0.055 : 0.15)));
				chart.draw();
			};
			leftTop.forEach((section, idx)=>{
				drawSection(section, cord.x + idx * (leftColW + gap), cord.y, leftColW, topRowH, 'top');
			});
			leftBottom.forEach((section, idx)=>{
				drawSection(section, cord.x + idx * (leftColW + gap), cord.y + topRowH + gap, leftColW, bottomRowH, 'bottom');
			});
			rightTall.forEach((section, idx)=>{
				drawSection(section, cord.x + leftW + gap + idx * (rightColW + gap), cord.y, rightColW, cord.h, 'tall');
			});
			return;
		}

		const cols = 3;
		const cellW = (cord.w - gap * (cols - 1)) / cols;
		const rowH = Math.max(92, (cord.h - gap * 2) / 3);
		sections.forEach((section, idx)=>{
			const col = idx % cols;
			const row = Math.floor(idx / cols);
			const opt = {
				chartObj: this.chartObj,
				guireng: this.guireng,
				x: cord.x + col * (cellW + gap),
				y: cord.y + row * (rowH + gap),
				width: cellW,
				height: rowH,
				owner: this.svgTopgroup,
				title: section[0],
				gods: section[1],
			};
			const chart = new GodChart(opt);
			chart.titleFontSize = Math.max(14, Math.min(row === 0 ? 23 : 20, opt.height * (row === 0 ? 0.24 : 0.20)));
			chart.godFontSize = Math.max(row === 1 ? 11 : 13, Math.min(row === 0 ? 18 : 16, opt.height * (row === 1 ? 0.085 : (row === 0 ? 0.16 : 0.14))));
			chart.draw();
		});
	}

	drawGua3(cord){
		if(this.liureng === undefined || this.liureng === null){
			return;
		}

		const items = [
			['行年', this.getRunYear()],
			['旬日', this.getXun()],
			['旺衰', this.getData(this.liureng.season)],
			['基础神煞', this.getData(this.liureng.gods)],
			['干煞', this.getData(this.liureng.godsGan)],
			['月煞', this.getData(this.liureng.godsMonth)],
			['支煞', this.getData(this.liureng.godsZi)],
			['年煞', this.getYearGods()],
			[`${this.zhangshengElem}十二长生`, this.getZhangSheng()],
		];
		const gap = 8;
		const padX = this.margin / 2;
		const x = cord.x + padX;
		const y = cord.y + 6;
		const h = Math.max(38, cord.h - 12);
		const w = (cord.w - padX * 2 - gap * (items.length - 1)) / items.length;
		items.forEach((item, idx)=>{
			this.drawMetaButton({
				x: x + idx * (w + gap),
				y,
				width: w,
				height: h,
			}, item[0], item[1], false, true);
		});
	}

	drawGua4(cord){
		let w = (cord.w - this.margin) / 3;
		let h = (cord.h - this.margin*2) / 2;
		let x = cord.x + this.margin/2;
		let y = cord.y + this.margin/2;

		if(this.liureng === undefined || this.liureng === null){
			return;
		}

		let y1 = y;
		let x1 = x + w;
		let y2 = y1;
		let x2 = x1 + w;
		this.drawMetaButton({ x, y, width: w - this.margin/2, height: h * 2 - this.margin }, '支煞', this.getData(this.liureng.godsZi), true);
		this.drawMetaButton({ x: x1, y: y1, width: w - this.margin/2, height: h * 2 - this.margin }, '年煞', this.getYearGods(), true);
		this.drawMetaButton({ x: x2, y: y2, width: w - this.margin/2, height: h * 2 - this.margin }, this.zhangshengElem + '十二长生', this.getZhangSheng(), true);
	}

	getMetaSummary(gods){
		if(!gods || gods.length === 0){
			return '点击查看';
		}
		return `${gods.length}项信息`;
	}

	drawMetaButton(cord, title, gods, tall, compact){
		if(!this.svgTopgroup){
			return;
		}
		const rows = gods || [];
		const buttonW = compact ? Math.max(72, cord.width) : Math.max(92, Math.min(cord.width - 12, tall ? 132 : 118));
		const buttonH = compact ? Math.max(36, Math.min(cord.height, 42)) : (tall ? 70 : 56);
		const x = cord.x + cord.width / 2 - buttonW / 2;
		const y = cord.y + cord.height / 2 - buttonH / 2;
		const group = this.svgTopgroup.append('g')
			.attr('class', 'liureng-meta-button')
			.style('cursor', 'pointer')
			.attr('tabindex', 0)
			.on('click', ()=>{
				if(this.onMetaInfoClick){
					this.onMetaInfoClick({
						title,
						gods: rows,
					});
				}
			});
		group.append('rect')
			.attr('x', x)
			.attr('y', y)
			.attr('width', buttonW)
			.attr('height', buttonH)
			.attr('rx', 8)
			.attr('ry', 8)
			.attr('fill', 'var(--horosa-surface-solid, #fffdfa)')
			.attr('stroke', 'var(--horosa-astro-gold, #b8893f)')
			.attr('stroke-width', 1.2);
		group.append('text')
			.attr('x', x + buttonW / 2)
			.attr('y', y + (compact ? 16 : 23))
			.attr('text-anchor', 'middle')
			.attr('fill', 'var(--horosa-astro-gold, #b8893f)')
			.attr('font-size', compact ? 12 : (tall ? 16 : 15))
			.attr('font-weight', 700)
			.text(title);
		group.append('text')
			.attr('x', x + buttonW / 2)
			.attr('y', y + (compact ? 32 : 45))
			.attr('text-anchor', 'middle')
			.attr('fill', 'var(--horosa-astro-muted, #7f7a70)')
			.attr('font-size', compact ? 9 : 11)
			.text(this.getMetaSummary(rows));
		group.append('title').text(`${title}：点击查看完整信息`);
	}

	getZhangSheng(){
		let res = ZSList.map((item, idx)=>{
			let k = this.zhangshengElem + '_' + item;
			return {
				key: item,
				value: ZhangSheng.wxphase[k],
			};
		});
		return res;
	}

	getRunYear(){
		const runyear = this.runyear || {};
		const genderText = this.gender === 0 || this.gender === '0' ? '女' : '男';
		let res = [{
			key: '行年',
			value: runyear.year ? runyear.year : '—',
		},{
			key: '年龄',
			value: runyear.age !== undefined && runyear.age !== null ? (runyear.age + '岁') : '—',
		},{
			key: '性别',
			value: genderText,
		}];
		return res;
	}

	getYearGods(){
		let res = [];
		let taisui1 = this.liureng && this.liureng.godsYear ? this.liureng.godsYear.taisui1 : null;
		for(let i=0; i<TaiSui.length; i++){
			let k = TaiSui[i];
			let god = {
				key: k,
				value: taisui1 && taisui1[k] ? taisui1[k] : '—',
			};
			res.push(god);
		}
		return res;
	}

	getXun(){
		const dunDing = this.liureng.xun['遁丁'] || extractBranch(this.liureng.xun['旬丁']);
		let xuns = [{
			key: '旬空',
			value: this.liureng.xun['旬空'],
		},{
			key: '旬首',
			value: this.liureng.xun['旬首'],
		},{
			key: '旬尾',
			value: this.liureng.xun['旬尾'],
		},{
			key: '遁丁',
			value: dunDing,
		}];

		return xuns;
	}

	getData(obj){
		let res = [];
		for(let k in obj){
			let data = {
				key: k,
				value: obj[k],
			}
			let pidx = k.indexOf('(');
			if(pidx >= 0){
				let name = k.substr(0, pidx);
				data.key = name;
			}
			if(data.value instanceof Array){
				data.value = data.value.join('');
			}
			res.push(data);
		}
		return res;
	}

	drawTitle(cord){
		let txt = '';
		if(this.liureng){
			if(this.nongli){
				txt = '真太阳时:' + this.nongli.birth;
			}
			let fourcol = this.liureng.fourColumns;
			txt = txt + '； 八字:' 
				+ fourcol.year.ganzi + '年 ' + fourcol.month.ganzi + '月 ' 
				+ fourcol.day.ganzi + '日 '+ fourcol.time.ganzi + '时';
			if(this.nongli){
				let leap = this.nongli.leap ? '闰' : '';
				txt = txt + '（' + leap + this.nongli.month + this.nongli.day + '）';
			}

		}else if(this.nongli){
			let leap = this.nongli.leap ? '闰' : '';
			txt = '真太阳时:' + this.nongli.birth + '； 农历:' 
				+ this.nongli.year + '年 ' + this.nongli.monthGanZi + '月 ' 
				+ this.nongli.dayGanZi + '日 '+ this.nongli.time + '时'
				+ '（' + leap + this.nongli.month + this.nongli.day + '）';
				
		}else{
			let dt = new Date();
			let h = dt.getHours();
			let zi = HourZi[h];
			txt = '起卦时间：' + formatDate(dt) + ' ' + zi + '时';
		}
		
		let marg = 2;
		let fontsz = 15
		let len = (txt.length-9) * fontsz;
		if(len > cord.w){
			len = cord.w;
			fontsz = cord.w / (txt.length-9);
		}
		let h = fontsz + marg*2;
		let x = cord.x + cord.w/2 - len/2;
		let y = cord.y + cord.h/2;
		let data = [txt];
		drawTextH(this.svgTopgroup, data, x, y, len, h, marg, this.color);
	}

}

export default RengChart;
