// 按像素绘制的 svg 盘面在「盘变小」时的统一出路:设计尺寸下限 + viewBox 等比缩放。
//
// 背景:这类盘面(六爻主盘等)用 svg 的布局尺寸(clientWidth / clientHeight)直接当绘制坐标,列宽、字号却是写死的 px;
// 放大档(布局视口 = 物理 / z)或窄中栏里盘只剩三百来 px 时,「格宽 − 固定列宽」变成负数 → 爻线不画、字互叠、表头两端被裁。
// 修法:布局尺寸不低于设计下限时照旧(不写 viewBox,逐像素不变);低于下限时把绘制坐标系放大到下限(k = max(下限宽 / 宽, 下限高 / 高)),
// 再写 viewBox 让浏览器整体等比缩回 —— 字、线、留白同比缩小,永远不出现负宽,也不需要知道缩放档是多少(直接量容器)。
//
// 用法:const { width, height } = fitSvgDesignBox(svgdom, 720, 640); 之后全部按返回的 width / height 绘制。

const MARK = 'data-horosa-design-box';
// 设计下限本身也写在 svg 上:盘面最小字视觉下限(utils/chartTextFloor)据此按「设计尺寸 × 9 / (最小字号 × 档位)」反推最小渲染尺寸
const MIN_MARK = 'data-horosa-design-min';

export function fitSvgDesignBox(svgdom, minWidth, minHeight){
	if(!svgdom){
		return { width: 0, height: 0, scale: 1 };
	}
	const width = svgdom.clientWidth;
	const height = svgdom.clientHeight;
	if(!(width > 0 && height > 0)){
		return { width, height, scale: 1 };
	}
	const k = Math.max(1, (Number(minWidth) || 0) / width, (Number(minHeight) || 0) / height);
	if(k <= 1){
		// 放得下:撤掉本函数之前写过的 viewBox(只撤自己写的),回到按像素绘制
		if(svgdom.getAttribute(MARK) === '1'){
			svgdom.removeAttribute('viewBox');
			svgdom.removeAttribute('preserveAspectRatio');
			svgdom.removeAttribute(MARK);
			svgdom.removeAttribute(MIN_MARK);
		}
		return { width, height, scale: 1 };
	}
	const vw = Math.round(width * k * 100) / 100;
	const vh = Math.round(height * k * 100) / 100;
	svgdom.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
	svgdom.setAttribute('preserveAspectRatio', 'xMidYMid meet');
	svgdom.setAttribute(MARK, '1');
	svgdom.setAttribute(MIN_MARK, `${Number(minWidth) || 0},${Number(minHeight) || 0}`);
	return { width: vw, height: vh, scale: k };
}

// svg 单行文字放不下给定宽度时按实测长度缩字号(再不够就压字距),放得下时不动(逐像素不变)。
// jsdom 等没有 getComputedTextLength 的环境直接跳过。
export function fitSvgTextWidth(textNode, maxWidth, minFontSize = 8){
	if(!textNode || typeof textNode.getComputedTextLength !== 'function' || !(maxWidth > 0)){
		return false;
	}
	let len = 0;
	try{
		len = textNode.getComputedTextLength();
	}catch(e){
		return false;
	}
	if(!(len > maxWidth)){
		return false;
	}
	const size = parseFloat(textNode.getAttribute('font-size')) || 16;
	const next = Math.max(minFontSize, Math.floor(size * maxWidth / len * 100) / 100);
	textNode.setAttribute('font-size', next);
	let len2 = len * next / size;
	try{
		len2 = textNode.getComputedTextLength();
	}catch(e){ /* 用估算值 */ }
	if(len2 > maxWidth){
		textNode.setAttribute('textLength', maxWidth);
		textNode.setAttribute('lengthAdjust', 'spacingAndGlyphs');
	}
	return true;
}
