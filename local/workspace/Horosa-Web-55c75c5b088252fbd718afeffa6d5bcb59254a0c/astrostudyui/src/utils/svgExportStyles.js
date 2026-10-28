// svg 克隆体导出前的样式内联(与截图库 html-to-image 的 cloneCSSStyle 同口径:取原件的计算值写进克隆体)。
//
// 为什么必须做:svg 序列化成 data:image/svg+xml 再画进 canvas 时,图片脱离了页面——
// 页面上的 CSS 变量(var(--horosa-*))、样式表规则、继承来的主题色在图片里都不存在。
// 属性里写 stroke="var(--x)"(没有后备值)的曲线在导出图里等于没画,fill 同写法的变黑。
// 逐处补后备值也不对:后备值只有一种主题的色,另一主题导出就错色。
// 所以凡把 svg 序列化导出的路径,序列化前一律调本助手(静态守卫 svgExportInlineGuard 看守)。

// 绘制与文字相关、会被 var() / 样式表 / 继承影响的属性(svg 呈现属性 + 文字排版)。
export const SVG_EXPORT_STYLE_PROPS = [
	'fill', 'fill-opacity', 'fill-rule',
	'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset',
	'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
	'stop-color', 'stop-opacity', 'flood-color', 'flood-opacity', 'lighting-color',
	'color', 'opacity', 'visibility', 'display',
	'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
	'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'paint-order',
];

function getComputed(el){
	try{
		const view = (el.ownerDocument && el.ownerDocument.defaultView) || (typeof window !== 'undefined' ? window : null);
		return view && view.getComputedStyle ? view.getComputedStyle(el) : null;
	}catch(_){
		return null;
	}
}

// 原件 / 克隆体按同一结构并行遍历(cloneNode(true) 的结构与原件一一对应)。
// 克隆体上每个元素:inline style 写成原件的计算值;值里仍含 var( 的(未解析)不写,
// 并把属性里残留的 var() 写法移除,免得序列化串里留着无定义的引用。
export function inlineSvgComputedStyles(original, clone){
	if(!original || !clone){
		return clone;
	}
	const stack = [[original, clone]];
	while(stack.length){
		const [src, dst] = stack.pop();
		if(!src || !dst || src.nodeType !== 1 || dst.nodeType !== 1){
			continue;
		}
		const cs = getComputed(src);
		if(cs && dst.style){
			for(const prop of SVG_EXPORT_STYLE_PROPS){
				const v = cs.getPropertyValue(prop);
				if(v && String(v).indexOf('var(') < 0){
					dst.style.setProperty(prop, String(v).trim());
				}
			}
		}
		if(dst.attributes){
			for(const attr of Array.from(dst.attributes)){
				if(attr.name !== 'style' && String(attr.value).indexOf('var(') >= 0){
					dst.removeAttribute(attr.name);
				}
			}
			const inlineStyle = dst.getAttribute('style');
			if(inlineStyle && inlineStyle.indexOf('var(') >= 0){
				const kept = inlineStyle.split(';').filter((decl)=>decl.indexOf('var(') < 0).join(';');
				dst.setAttribute('style', kept);
			}
		}
		const sKids = src.children || [];
		const dKids = dst.children || [];
		const n = Math.min(sKids.length, dKids.length);
		for(let i = 0; i < n; i++){
			stack.push([sKids[i], dKids[i]]);
		}
	}
	return clone;
}

// 导出图的底色:当前主题的实底面板色。盘面墨色是按当前主题挑的(暗色主题下是浅色字),
// 写死白底 = 暗色主题导出的浅色字压白底看不清;取屏幕上同一种底,导出图与所见一致。
export function exportSurfaceColor(fallback = '#ffffff'){
	try{
		const v = getComputedStyle(document.documentElement).getPropertyValue('--horosa-surface-solid');
		if(v && v.trim()){ return v.trim(); }
	}catch(_){ /* 取不到计算样式时用缺省底 */ }
	return fallback;
}
