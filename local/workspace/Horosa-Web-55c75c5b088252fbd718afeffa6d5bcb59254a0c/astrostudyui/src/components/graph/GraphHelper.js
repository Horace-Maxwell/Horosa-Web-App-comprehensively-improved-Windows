import * as d3 from 'd3';
import {randomStr,} from '../../utils/helper';

export function drawTextH(svgowner, data, x, y, w, h, margin, color, weight, bgcolor, borderColor, roundBorderValue, fontfamily){
	let svg = svgowner.append('g');
	let fsz = w / data.length - margin;
	fsz = fsz > (h - 2*margin) ? h - 2*margin : fsz;
	let firstmargin = (w - fsz * data.length - margin*(data.length - 1)) / 2 + fsz/2;
	let firstmarginY = (h - fsz) / 2 + fsz/2;

	let stroke = '#000000';
	if(color){
		stroke = color;
	}

	let fontweight = 100;
	if(weight){
		fontweight = weight;
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
		svg.selectAll('text').data(data).enter().append('text')
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "middle")
		.attr('rx', rv).attr('ry', rv)
		.attr('font-weight', fontweight)
		.attr('stroke', stroke)
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
		svg.selectAll('text').data(data).enter().append('text')
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "middle")
		.attr('rx', rv).attr('ry', rv)
		.attr('font-weight', fontweight)
		.attr('stroke', stroke)
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

export function drawTextV(svgowner, data, x, y, w, h, margin, color, weight, bgcolor, borderColor, roundBorderValue, fontfamily){
	let svg = svgowner.append('g');
	let realH = h-margin*2;
	let fsz = realH / data.length - margin;
	fsz = fsz > (w - 2*margin) ? w - 2*margin : fsz;
	let firstmargin = (h - (fsz + margin) * data.length) / 2 + fsz/2 + margin;
	let firstmarginX = (w - fsz) / 2 + fsz/2;

	let stroke = '#000000';
	if(color){
		stroke = color;
	}

	let fontweight = 100;
	if(weight){
		fontweight = weight;
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
		svg.selectAll('text').data(data).enter().append('text')
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "middle")
		.attr('rx', rv).attr('ry', rv)
		.attr('font-weight', fontweight)
		.attr('stroke', stroke)
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
		svg.selectAll('text').data(data).enter().append('text')
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "middle")
		.attr('rx', rv).attr('ry', rv)
		.attr('font-weight', fontweight)
		.attr('stroke', stroke)
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
