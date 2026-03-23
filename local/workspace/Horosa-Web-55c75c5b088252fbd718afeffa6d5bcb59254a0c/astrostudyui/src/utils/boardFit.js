function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
}

export function calcViewportScale(options = {}){
	const hostWidth = Number(options.hostWidth) || 0;
	const hostHeight = Number(options.hostHeight) || 0;
	const baseWidth = Number(options.baseWidth) || 1;
	const baseHeight = Number(options.baseHeight) || 1;
	const horizontalGap = Number(options.horizontalGap) || 0;
	const verticalGap = Number(options.verticalGap) || 0;
	const minScale = Number.isFinite(Number(options.minScale)) ? Number(options.minScale) : 0;
	const maxScale = Number.isFinite(Number(options.maxScale)) ? Number(options.maxScale) : 1;
	const availWidth = hostWidth > 0 ? Math.max(0, hostWidth - horizontalGap) : baseWidth;
	const availHeight = hostHeight > 0 ? Math.max(0, hostHeight - verticalGap) : baseHeight;
	const widthScale = availWidth / baseWidth;
	const heightScale = availHeight / baseHeight;
	let nextScale = Math.min(widthScale, heightScale);
	if(!Number.isFinite(nextScale) || nextScale <= 0){
		nextScale = maxScale > 0 ? maxScale : 1;
	}
	return clamp(nextScale, minScale, maxScale);
}

export function calcViewportSquareSize(options = {}){
	const hostWidth = Number(options.hostWidth) || 0;
	const hostHeight = Number(options.hostHeight) || 0;
	const horizontalGap = Number(options.horizontalGap) || 0;
	const verticalGap = Number(options.verticalGap) || 0;
	const chromeHeight = Number(options.chromeHeight) || 0;
	const minSize = Number.isFinite(Number(options.minSize)) ? Number(options.minSize) : 0;
	const maxSize = Number.isFinite(Number(options.maxSize)) ? Number(options.maxSize) : Number.MAX_SAFE_INTEGER;
	const availWidth = hostWidth > 0 ? Math.max(0, hostWidth - horizontalGap) : maxSize;
	const availHeight = hostHeight > 0 ? Math.max(0, hostHeight - verticalGap - chromeHeight) : maxSize;
	let nextSize = Math.min(availWidth, availHeight, maxSize);
	if(!Number.isFinite(nextSize) || nextSize <= 0){
		nextSize = maxSize;
	}
	return clamp(Math.round(nextSize), minSize, maxSize);
}
