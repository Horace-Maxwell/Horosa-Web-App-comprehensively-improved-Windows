import * as d3 from 'd3';
import {randomStr,} from '../../utils/helper';
import { SCRIPT_WORD_ATTR, SCRIPT_IDX_ATTR, perCharTextProps } from '../../utils/scriptMode';

// 文字色 = 填色:只写了 stroke、没写 fill 的 svg 文字,缺省填色是黑 —— 暗盘上就是黑字压暗底(宿盘中宫、金口诀圆盘等)。
// d3 文字链尾 .call(fillTextFromStroke):没有 fill 属性的字把 stroke 色补成 fill(样式表另给了 fill 的,样式表仍优先)。
export function fillTextFromStroke(sel){
	sel.each(function(){
		const s = this.getAttribute('stroke');
		if(s && s !== 'none' && !this.getAttribute('fill')){ this.setAttribute('fill', s); }
	});
}

// 逐字出图(一个字一个 <text>):整串由一个个单字组成时返回整词,否则 null。
// 每个字节点带上整词与位次,界面简繁按整词定字(「天后」逐字画仍是「天后」,不成「天後」;见 utils/scriptMode.js)。
export function perCharScriptWord(data){
	const arr = typeof data === 'string' ? data.split('') : data;
	if(!Array.isArray(arr) || arr.length < 2){ return null; }
	for(let i = 0; i < arr.length; i += 1){
		const c = arr[i];
		if(typeof c !== 'string' || c.length !== 1){ return null; }
	}
	return arr.join('');
}

// 逐字出图的唯一入口:sel 下按字各建一个 <text>,并给与整词逐位相符的节点挂整词定字属性
// (界面简繁按整词转换再取该位:天将环「天后」逐字画仍是「天后」,不成「天後」)。
//   chars:要画的字(数组,或字符串按字拆);word:整词,缺省 = 这些字拼成的词(chars 只是整词的前几位、
//   或后面另拼了别的节点时显式传完整原词)。返回 d3 enter 后的 text 选择集,调用方照常往后接 .attr(...)。
// 静态守卫 perCharTextHelper.test.js:凡把 split('') 出来的字直接交给 .data(...) 画字的,必须改走本函数。
export function appendPerCharText(sel, chars, word){
	const arr = Array.isArray(chars) ? chars : Array.from(`${chars === undefined || chars === null ? '' : chars}`);
	const whole = (word !== undefined && word !== null) ? `${word}` : perCharScriptWord(arr);
	const at = (d, idx)=>perCharTextProps(whole, idx, d);
	return sel.selectAll('text').data(arr).enter().append('text')
		.attr(SCRIPT_WORD_ATTR, function(d, idx){ const p = at(d, idx); return p[SCRIPT_WORD_ATTR] === undefined ? null : p[SCRIPT_WORD_ATTR]; })
		.attr(SCRIPT_IDX_ATTR, function(d, idx){ const p = at(d, idx); return p[SCRIPT_IDX_ATTR] === undefined ? null : p[SCRIPT_IDX_ATTR]; });
}

// word:整词(只画整词的前几位时显式传,缺省 = 这些字拼成的词)
export function drawTextH(svgowner, data, x, y, w, h, margin, color, weight, bgcolor, borderColor, roundBorderValue, fontfamily, word){
	let svg = svgowner.append('g');
	const scriptWord = word !== undefined && word !== null ? `${word}` : perCharScriptWord(data);
	let fsz = w / data.length - margin;
	fsz = fsz > (h - 2*margin) ? h - 2*margin : fsz;
	let firstmargin = (w - fsz * data.length - margin*(data.length - 1)) / 2 + fsz/2;
	let firstmarginY = (h - fsz) / 2 + fsz/2;

	// [去描边] color 参数=文字填色(fill)。历史上被写进 text 的 stroke(描边)且不设 fill
	// → 黑填充+彩描边叠印,小字号笔画粘连发糊(用户实报十二神看不清)——文字一律填色渲染。
	let stroke = 'var(--horosa-text, #000000)';
	if(color){
		stroke = color;
	}

	// [去描边] 旧渲染的描边≈人工加粗一档,低字重(100/240)的视觉差全被描边淹没;
	// 改填色后设 500 下限折算回字重,>500 的显式强调保留层级。
	let fontweight = 500;
	if(weight){
		fontweight = Math.max(weight, 500);
	}

	let rv = 3;
	if(roundBorderValue){
		rv = roundBorderValue;
	}

	if(bgcolor){
		if(borderColor){
			svg.append('rect')
				.attr('fill', bgcolor)
				.attr('stroke', borderColor)
				.attr('rx', rv).attr('ry', rv)
				.attr('x', x).attr('y', y)
				.attr('width', w).attr('height', h);
		}else{
			svg.append('rect')
				.attr('fill', bgcolor)
				.attr('x', x).attr('y', y)
				.attr('rx', rv).attr('ry', rv)
				.attr('width', w).attr('height', h);
		}
	}else{
		if(borderColor){
			svg.append('rect')
				.attr('fill', 'transparent')
				.attr('stroke', borderColor)
				.attr('rx', rv).attr('ry', rv)
				.attr('x', x).attr('y', y)
				.attr('width', w).attr('height', h);
		}		
	}

	if(fontfamily && fontfamily.length){
		appendPerCharText(svg, data, scriptWord)
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "middle")
		.attr('rx', rv).attr('ry', rv)
		.attr('font-weight', fontweight)
		.attr('fill', stroke)
		.attr('stroke', 'none')
		.attr('font-size', function(d, idx){
			return fsz + 'px';
		})
		.attr('font-family', function(d,idx){
			return fontfamily[idx];
		})
		.attr('transform', function(d, idx){
			let posx = firstmargin + x + idx * (fsz + margin) ;
			let posy = firstmarginY + y;
			let trans = 'translate(' + posx + ', ' + posy + ')';
			return trans;
		})
		.text(function(d){return d});

	}else{
		appendPerCharText(svg, data, scriptWord)
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "middle")
		.attr('rx', rv).attr('ry', rv)
		.attr('font-weight', fontweight)
		.attr('fill', stroke)
		.attr('stroke', 'none')
		.attr('font-size', function(d, idx){
			return fsz + 'px';
		})
		.attr('transform', function(d, idx){
			let posx = firstmargin + x + idx * (fsz + margin) ;
			let posy = firstmarginY + y;
			let trans = 'translate(' + posx + ', ' + posy + ')';
			return trans;
		})
		.text(function(d){return d});

	}
	return svg;
}

// word:同 drawTextH
export function drawTextV(svgowner, data, x, y, w, h, margin, color, weight, bgcolor, borderColor, roundBorderValue, fontfamily, word){
	let svg = svgowner.append('g');
	const scriptWord = word !== undefined && word !== null ? `${word}` : perCharScriptWord(data);
	let realH = h-margin*2;
	let fsz = realH / data.length - margin;
	fsz = fsz > (w - 2*margin) ? w - 2*margin : fsz;
	let firstmargin = (h - (fsz + margin) * data.length) / 2 + fsz/2 + margin;
	let firstmarginX = (w - fsz) / 2 + fsz/2;

	// [去描边] color 参数=文字填色(fill)。历史上被写进 text 的 stroke(描边)且不设 fill
	// → 黑填充+彩描边叠印,小字号笔画粘连发糊(用户实报十二神看不清)——文字一律填色渲染。
	let stroke = 'var(--horosa-text, #000000)';
	if(color){
		stroke = color;
	}

	// [去描边] 旧渲染的描边≈人工加粗一档,低字重(100/240)的视觉差全被描边淹没;
	// 改填色后设 500 下限折算回字重,>500 的显式强调保留层级。
	let fontweight = 500;
	if(weight){
		fontweight = Math.max(weight, 500);
	}

	let rv = 3;
	if(roundBorderValue){
		rv = roundBorderValue;
	}

	if(bgcolor){
		if(borderColor){
			svg.append('rect')
				.attr('fill', bgcolor)
				.attr('stroke', borderColor)
				.attr('rx', rv).attr('ry', rv)
				.attr('x', x).attr('y', y)
				.attr('width', w).attr('height', h);
		}else{
			svg.append('rect')
				.attr('fill', bgcolor)
				.attr('rx', rv).attr('ry', rv)
				.attr('x', x).attr('y', y)
				.attr('width', w).attr('height', h);
		}
	}else{
		if(borderColor){
			svg.append('rect')
				.attr('fill', 'transparent')
				.attr('stroke', borderColor)
				.attr('rx', rv).attr('ry', rv)
				.attr('x', x).attr('y', y)
				.attr('width', w).attr('height', h);
		}		
	}

	if(fontfamily && fontfamily.length){
		appendPerCharText(svg, data, scriptWord)
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "middle")
		.attr('rx', rv).attr('ry', rv)
		.attr('font-weight', fontweight)
		.attr('fill', stroke)
		.attr('stroke', 'none')
		.attr('font-size', function(d, idx){
			return fsz + 'px';
		})
		.attr('font-family', function(d,idx){
			return fontfamily[idx];
		})
		.attr('transform', function(d, idx){
			let posx = firstmarginX + x;
			let posy = firstmargin + y + idx * (fsz + margin) ;
			let trans = 'translate(' + posx + ', ' + posy + ')';
			return trans;
		})
		.text(function(d){return d});

	}else{
		appendPerCharText(svg, data, scriptWord)
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "middle")
		.attr('rx', rv).attr('ry', rv)
		.attr('font-weight', fontweight)
		.attr('fill', stroke)
		.attr('stroke', 'none')
		.attr('font-size', function(d, idx){
			return fsz + 'px';
		})
		.attr('transform', function(d, idx){
			let posx = firstmarginX + x;
			let posy = firstmargin + y + idx * (fsz + margin) ;
			let trans = 'translate(' + posx + ', ' + posy + ')';
			return trans;
		})
		.text(function(d){return d});

	}
	return svg;
}

export function drawDashLine(svg, x1, y1, x2, y2, color){
	svg.append('line')
		.attr('x1', x1).attr('y1', y1)
		.attr('x2', x2).attr('y2', y2)
		.attr('stroke', color).style('stroke-dasharray', ('3,3'));

}

export function drawLine(svg, x1, y1, x2, y2, color){
	svg.append('line')
		.attr('x1', x1).attr('y1', y1)
		.attr('x2', x2).attr('y2', y2)
		.attr('stroke', color);
}

export function drawPath(svg, points, color, fillColor){
	if(points === undefined || points === null || points.length <= 1){
		return;
	}
/*
	for(let i=0; i<points.length; i++){
		if(i === points.length - 1){
			break;
		}
		let pnt1 = points[i];
		let pnt2 = points[i + 1];
		drawLine(svg, pnt1[0], pnt1[1], pnt2[0], pnt2[1], color);
	}
	let pnt1 = points[0];
	let pnt2 = points[points.length - 1];
	drawLine(svg, pnt1[0], pnt1[1], pnt2[0], pnt2[1], color);
*/
	let linGen = d3.line();
	let datapnts = [];
	for(let i=0; i<points.length; i++){
		datapnts[i] = points[i];
	}
	datapnts.push(points[0]);
	let pathStr = linGen(datapnts);
	let bgColor = fillColor ? fillColor : 'none';
	let res = svg.append('path')
		.attr('d', pathStr)
		.attr('stroke', color)
		.attr('fill', bgColor);

	return res;
}


function isZero(n){
	const DELTA = 0.00001;
	if(n > -DELTA && n < DELTA){
		return true;
	}
	return false;
} 

export function cross(x1, y1, z1, x2, y2, z2, vec){
	vec.x = y1*z2 - z1*y2;
	vec.y = z1*x2 - x1*z2;
	vec.z = x1*y2 - y1*x2;
}

export function dot(x1, y1, z1, x2, y2, z2){
	return x1*x2 + y1*y2 + z1*z2;
}

export function normalize(x, y, z, vec){
	let len = Math.sqrt(x*x + y*y + z*z);
	if(isZero(len)){
		return false;
	}

	vec.x = x / len;
	vec.y = y / len;
	vec.z = z / len;
	return true;
}

export function calcNormalVector(x1, y1, z1, x2, y2, z2, x3, y3, z3, vec){
	let pt1pt2 = [x2-x1, y2-y1, z2-z1];
	let pt2pt3 = [x3-x2, y3-y2, z3-z2];
	let pt1pt3 = [x3-x1, y3-y1, z3-z1];
	let nvec = {
		x: 0.0,
		y: 0.0,
		x: 0.0
	}
	cross(pt1pt2[0], pt1pt2[1], pt1pt2[2], pt2pt3[0], pt2pt3[1], pt2pt3[2], nvec);
	if(isZero(nvec.x) && isZero(nvec.y) && isZero(nvec.z)){
		return false;
	}

	let flag = normalize(nvec.x, nvec.y, nvec.z, vec);
	if(!flag){
		return false;
	}

	let dot1n1=dot(vec.x, vec.y, vec.z, pt1pt2[0], pt1pt2[1], pt1pt2[2]);
	let dot2n1=dot(vec.x, vec.y, vec.z, pt2pt3[0], pt2pt3[1], pt2pt3[2]);
	let dot3n1=dot(vec.x, vec.y, vec.z, pt1pt3[0], pt1pt3[1], pt1pt3[2]);

	if(!(isZero(dot1n1) && isZero(dot2n1) && isZero(dot3n1))){
		return false;
	}

	return true;
}
