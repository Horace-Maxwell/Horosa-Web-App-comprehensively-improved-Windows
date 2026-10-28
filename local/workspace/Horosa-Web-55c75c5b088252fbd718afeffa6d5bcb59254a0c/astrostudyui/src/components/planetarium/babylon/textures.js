// 天文馆 · 程序贴图:噪声、天空 / 地平雾 / 行星 / 月相 / 地面画布绘制。
// 只被 components/planetarium/PlanetariumBabylon.js 与同目录 babylon/ 下的兄弟模块引用。
import { degToRad, clamp } from './skyMath';

export function noise2(x, y, seed){
	const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
	return v - Math.floor(v);
}

function drawEllipse(ctx, x, y, rx, ry, color, alpha = 1){
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function colorArrayCss(color, alpha = 1){
	const c = color || [0, 0, 0];
	return `rgba(${Math.round(clamp(c[0], 0, 1) * 255)}, ${Math.round(clamp(c[1], 0, 1) * 255)}, ${Math.round(clamp(c[2], 0, 1) * 255)}, ${alpha})`;
}

function mixColorArray(a, b, t){
	const ratio = clamp(t, 0, 1);
	return [
		(a[0] || 0) * (1 - ratio) + (b[0] || 0) * ratio,
		(a[1] || 0) * (1 - ratio) + (b[1] || 0) * ratio,
		(a[2] || 0) * (1 - ratio) + (b[2] || 0) * ratio,
	];
}

export function paintSkySurface(ctx, width, height, palette){
	const p = palette || {};
	const zenith = p.zenith || [0.004, 0.007, 0.022];
	const mid = p.sky || [0.018, 0.04, 0.11];
	const horizon = p.horizon || p.clear || [0.04, 0.08, 0.18];
	ctx.clearRect(0, 0, width, height);

	const grad = ctx.createLinearGradient(0, 0, 0, height);
	grad.addColorStop(0, colorArrayCss(zenith, 1));
	grad.addColorStop(0.44, colorArrayCss(mid, 1));
	grad.addColorStop(0.72, colorArrayCss(horizon, 1));
	grad.addColorStop(1, colorArrayCss(mixColorArray(zenith, horizon, 0.34), 1));
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);

	const horizonGlow = ctx.createRadialGradient(width * 0.5, height * 0.7, width * 0.06, width * 0.5, height * 0.7, width * 0.72);
	horizonGlow.addColorStop(0, colorArrayCss(p.glow || horizon, p.skyGlowAlpha || 0.18));
	horizonGlow.addColorStop(0.55, colorArrayCss(p.glow || horizon, (p.skyGlowAlpha || 0.18) * 0.38));
	horizonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = horizonGlow;
	ctx.fillRect(0, 0, width, height);

	for(let i = 0; i < 1800; i += 1){
		const x = noise2(i, 11, 71) * width;
		const y = noise2(i, 13, 72) * height;
		const alpha = (noise2(i, 17, 73) - 0.5) * 0.025;
		if(Math.abs(alpha) < 0.003){
			continue;
		}
		ctx.fillStyle = alpha > 0 ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${-alpha})`;
		ctx.fillRect(x, y, 1, 1);
	}

	const vignette = ctx.createRadialGradient(width * 0.5, height * 0.52, width * 0.18, width * 0.5, height * 0.52, width * 0.78);
	vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
	vignette.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, width, height);
}

export function paintHorizonMistSurface(ctx, width, height, palette){
	const p = palette || {};
	const glow = p.glow || p.horizon || [0.2, 0.28, 0.5];
	const clear = p.clear || [0.006, 0.01, 0.02];
	ctx.clearRect(0, 0, width, height);

	const vertical = ctx.createLinearGradient(0, 0, 0, height);
	vertical.addColorStop(0, 'rgba(0, 0, 0, 0)');
	vertical.addColorStop(0.34, colorArrayCss(glow, (p.mistAlpha || 0.16) * 0.16));
	vertical.addColorStop(0.52, colorArrayCss(glow, p.mistAlpha || 0.16));
	vertical.addColorStop(0.72, colorArrayCss(mixColorArray(glow, clear, 0.55), (p.mistAlpha || 0.16) * 0.34));
	vertical.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = vertical;
	ctx.fillRect(0, 0, width, height);

	const centerGlow = ctx.createRadialGradient(width * 0.5, height * 0.56, width * 0.08, width * 0.5, height * 0.56, width * 0.58);
	centerGlow.addColorStop(0, colorArrayCss(glow, (p.mistAlpha || 0.16) * 0.55));
	centerGlow.addColorStop(0.55, colorArrayCss(glow, (p.mistAlpha || 0.16) * 0.2));
	centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = centerGlow;
	ctx.fillRect(0, 0, width, height);
}

export function planetTextureSize(id){
	return id === 'Moon' ? { width: 512, height: 512 } : { width: 512, height: 256 };
}

export function paintPlanetSurface(ctx, id, width, height){
	ctx.clearRect(0, 0, width, height);
	const grad = ctx.createLinearGradient(0, 0, 0, height);
	const base = {
		Sun: ['#ffdf73', '#ff9127', '#b94a16'],
		Mercury: ['#bfc0b9', '#777873', '#494b49'],
		Venus: ['#ffe1aa', '#d9965d', '#8b5c37'],
		Earth: ['#1e61a6', '#133d73', '#071d3d'],
		Moon: ['#d6d9d5', '#888e8e', '#3e4448'],
		Mars: ['#df7444', '#9b3b28', '#4d221c'],
		Jupiter: ['#f4d2a5', '#c48759', '#7f5135'],
		Saturn: ['#f2dda4', '#c8a86a', '#806946'],
		Uranus: ['#b5fbff', '#55c5d1', '#226f83'],
		Neptune: ['#6ca6ff', '#2556bd', '#102868'],
		Pluto: ['#d7c2a8', '#8d755f', '#4a403a'],
	}[id] || ['#e5e9ff', '#8b93b0', '#30364c'];
	grad.addColorStop(0, base[0]);
	grad.addColorStop(0.52, base[1]);
	grad.addColorStop(1, base[2]);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);

	if(id === 'Sun'){
		for(let i = 0; i < 28; i += 1){
			const y = (i / 28) * height;
			ctx.strokeStyle = i % 2 ? 'rgba(255,244,148,0.34)' : 'rgba(207,67,18,0.22)';
			ctx.lineWidth = 3 + noise2(i, 2, 5) * 8;
			ctx.beginPath();
			for(let x = 0; x <= width; x += 18){
				const wave = Math.sin(x * 0.018 + i * 0.8) * (4 + noise2(i, x, 2) * 6);
				if(x === 0){ ctx.moveTo(x, y + wave); }else{ ctx.lineTo(x, y + wave); }
			}
			ctx.stroke();
		}
		for(let i = 0; i < 42; i += 1){
			drawEllipse(ctx, noise2(i, 1, 7) * width, noise2(i, 2, 8) * height, 8 + noise2(i, 3, 9) * 28, 3 + noise2(i, 4, 10) * 11, '#fff1a6', 0.18);
		}
		return;
	}

	if(id === 'Earth'){
		const land = '#4e9a5f';
		const desert = '#c49d6a';
		[
			[0.18, 0.38, 0.12, 0.2, land],
			[0.34, 0.62, 0.18, 0.14, desert],
			[0.58, 0.42, 0.22, 0.18, land],
			[0.78, 0.66, 0.17, 0.12, desert],
			[0.88, 0.34, 0.16, 0.18, land],
		].forEach((item)=>{
			drawEllipse(ctx, item[0] * width, item[1] * height, item[2] * width, item[3] * height, item[4], 0.82);
		});
		for(let i = 0; i < 18; i += 1){
			ctx.strokeStyle = 'rgba(245,250,255,0.45)';
			ctx.lineWidth = 4 + noise2(i, 1, 4) * 7;
			ctx.beginPath();
			const y = noise2(i, 2, 5) * height;
			for(let x = 0; x <= width; x += 30){
				const wave = Math.sin(x * 0.022 + i) * 12;
				if(x === 0){ ctx.moveTo(x, y + wave); }else{ ctx.lineTo(x, y + wave); }
			}
			ctx.stroke();
		}
		return;
	}

	if(id === 'Jupiter' || id === 'Saturn'){
		const stripeColors = id === 'Jupiter'
			? ['rgba(92,47,29,0.32)', 'rgba(255,239,202,0.38)', 'rgba(177,89,44,0.36)']
			: ['rgba(132,99,54,0.24)', 'rgba(255,241,190,0.3)', 'rgba(88,68,50,0.18)'];
		for(let i = 0; i < 15; i += 1){
			const y = (i / 15) * height;
			ctx.fillStyle = stripeColors[i % stripeColors.length];
			ctx.fillRect(0, y, width, 8 + noise2(i, 0, 7) * 15);
		}
		if(id === 'Jupiter'){
			drawEllipse(ctx, width * 0.68, height * 0.58, width * 0.07, height * 0.095, '#b75a38', 0.82);
			drawEllipse(ctx, width * 0.68, height * 0.58, width * 0.043, height * 0.058, '#edb17b', 0.58);
		}
		return;
	}

	if(id === 'Uranus' || id === 'Neptune' || id === 'Venus'){
		for(let i = 0; i < 18; i += 1){
			ctx.strokeStyle = id === 'Venus' ? 'rgba(255,244,216,0.2)' : 'rgba(232,255,255,0.18)';
			ctx.lineWidth = 2 + noise2(i, 1, 12) * 5;
			ctx.beginPath();
			const y = (i / 18) * height;
			for(let x = 0; x <= width; x += 28){
				const wave = Math.sin(x * 0.014 + i * 0.9) * 8;
				if(x === 0){ ctx.moveTo(x, y + wave); }else{ ctx.lineTo(x, y + wave); }
			}
			ctx.stroke();
		}
		return;
	}

	for(let i = 0; i < 80; i += 1){
		const x = noise2(i, 3, 1) * width;
		const y = noise2(i, 5, 2) * height;
		const r = 1.5 + noise2(i, 9, 3) * (id === 'Moon' || id === 'Mercury' ? 12 : 7);
		const color = id === 'Mars' ? '#5b241d' : 'rgba(34,38,42,0.28)';
		drawEllipse(ctx, x, y, r, r * (0.55 + noise2(i, 8, 4) * 0.55), color, 0.32);
	}
}

export function paintMoonPhase(ctx, phase, size){
	const radius = size * 0.45;
	const cx = size / 2;
	const cy = size / 2;
	const angle = degToRad(Number(phase && phase.phaseAngle) || 0);
	const cosA = Math.cos(angle);
	const image = ctx.createImageData(size, size);
	for(let y = 0; y < size; y += 1){
		for(let x = 0; x < size; x += 1){
			const nx = (x - cx) / radius;
			const ny = (y - cy) / radius;
			const idx = (y * size + x) * 4;
			const d = nx * nx + ny * ny;
			if(d > 1){
				image.data[idx + 3] = 0;
				continue;
			}
			const limb = Math.sqrt(Math.max(0, 1 - ny * ny));
			const lit = angle <= Math.PI ? nx > cosA * limb : nx < -cosA * limb;
			const shade = clamp(1 - d * 0.22 + noise2(x, y, 13) * 0.05, 0, 1);
			const v = lit ? Math.round(170 + shade * 76) : Math.round(20 + shade * 26);
			image.data[idx] = v;
			image.data[idx + 1] = v + (lit ? 2 : 0);
			image.data[idx + 2] = v + (lit ? 8 : 4);
			image.data[idx + 3] = 255;
		}
	}
	ctx.putImageData(image, 0, 0);
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.clip();
	for(let i = 0; i < 42; i += 1){
		const x = cx + (noise2(i, 1, 21) * 2 - 1) * radius * 0.86;
		const y = cy + (noise2(i, 2, 22) * 2 - 1) * radius * 0.86;
		const dx = (x - cx) / radius;
		const dy = (y - cy) / radius;
		if(dx * dx + dy * dy > 0.92){ continue; }
		const r = 3 + noise2(i, 3, 23) * 16;
		ctx.strokeStyle = 'rgba(18,24,32,0.22)';
		ctx.lineWidth = 1 + noise2(i, 4, 24) * 2;
		ctx.beginPath();
		ctx.ellipse(x, y, r, r * (0.74 + noise2(i, 5, 25) * 0.38), 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.restore();
}


// 程序化「地表裙边」纹理(替代旧照片全景,天象馆质感)。
// UV 纵向:v=0 对应地平上方(topAlt),v=1 对应脚下(bottomAlt);horizonV 为地平线所在 v。
// 地平线以上透明(露出天空),地平线处一道极细柔光,以下为干净的灰阶渐变地面(向下渐深)+ 极淡程序化微肌理(无照片感)。
// RGB 走中性灰阶(实际色调由材质 diffuse/emissive 跟随昼夜 palette 相乘),alpha 决定地平上下的显隐。
function paintHorizonGroundSurface(ctx, width, height, horizonV){
	ctx.clearRect(0, 0, width, height);
	const hv = clamp(Number(horizonV) || 0.37, 0.02, 0.98);
	const yH = height * hv;
	// 连绵山脊路径:整数频率正弦叠加 → 横向 360° 无缝平铺;baseY 为该层基准高度。
	const ridgePath = (baseY, amp, freqs)=>{
		ctx.beginPath();
		ctx.moveTo(0, height);
		for(let x = 0; x <= width; x += 3){
			const t = x / width;
			let y = baseY;
			for(let k = 0; k < freqs.length; k += 1){
				y -= Math.sin(t * Math.PI * 2 * freqs[k][0] + freqs[k][1]) * amp * freqs[k][2];
			}
			ctx.lineTo(x, y);
		}
		ctx.lineTo(width, height);
		ctx.closePath();
	};
	// ① 远山轮廓 = 天与地的柔和起伏分界;裁到此形状内填纵向渐变(地平雾亮 → 脚下渐深)。
	ctx.save();
	ridgePath(yH + height * 0.018, height * 0.030, [[3, 0.4, 1], [7, 2.1, 0.4], [13, 4.3, 0.16], [23, 1.1, 0.07]]);
	ctx.clip();
	const ground = ctx.createLinearGradient(0, yH - height * 0.05, 0, height);
	ground.addColorStop(0, 'rgba(150, 150, 150, 1)');
	ground.addColorStop(0.22, 'rgba(112, 112, 112, 1)');
	ground.addColorStop(0.6, 'rgba(72, 72, 72, 1)');
	ground.addColorStop(1, 'rgba(42, 42, 42, 1)');
	ctx.fillStyle = ground;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
	// ② 中景 / 近景山影(实色渐深,层叠出空气透视纵深)。
	ridgePath(yH + height * 0.085, height * 0.050, [[2, 3.1, 1], [5, 1.2, 0.5], [11, 5.5, 0.22]]);
	ctx.fillStyle = 'rgba(70, 70, 70, 1)';
	ctx.fill();
	ridgePath(yH + height * 0.170, height * 0.064, [[2, 1.7, 1], [4, 4.8, 0.45], [9, 0.9, 0.22]]);
	ctx.fillStyle = 'rgba(47, 47, 47, 1)';
	ctx.fill();
	// ③ 近景地表微草(细密短线,疏密随机,偏下半)。
	for(let i = 0; i < 1600; i += 1){
		const x = noise2(i, 2, 71) * width;
		const fy = 0.42 + noise2(i, 4, 72) * 0.58;
		const y = yH + fy * (height - yH);
		const len = 2 + noise2(i, 6, 73) * 8;
		const lean = (noise2(i, 8, 74) - 0.5) * 3.2;
		const g = 54 + Math.round(noise2(i, 9, 75) * 44);
		ctx.strokeStyle = `rgba(${g}, ${g}, ${g}, 0.15)`;
		ctx.lineWidth = 0.85;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + lean, y - len);
		ctx.stroke();
	}
	// ④ 地平雾光(山影根部一道极淡亮带,大气辉光,仅地平以下)。
	const haze = ctx.createLinearGradient(0, yH, 0, yH + height * 0.07);
	haze.addColorStop(0, 'rgba(200, 200, 200, 0.26)');
	haze.addColorStop(1, 'rgba(200, 200, 200, 0)');
	ctx.fillStyle = haze;
	ctx.fillRect(0, yH, width, height * 0.07);
	// ⑤ 底部暗角收边,增强纵深。
	const vign = ctx.createLinearGradient(0, height * 0.58, 0, height);
	vign.addColorStop(0, 'rgba(0, 0, 0, 0)');
	vign.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
	ctx.fillStyle = vign;
	ctx.fillRect(0, height * 0.58, width, height * 0.42);
}
