export const MIN_SQUARE_CHART_HEIGHT = 220;

export function computeSquareChartHostHeight(containerWidth, containerHeight, options = {}){
	const minHeight = Number.isFinite(options.minHeight) ? options.minHeight : MIN_SQUARE_CHART_HEIGHT;
	const bottomGap = Number.isFinite(options.bottomGap) ? options.bottomGap : 0;
	const width = Number.isFinite(containerWidth) ? containerWidth : 0;
	const height = Number.isFinite(containerHeight) ? containerHeight : 0;
	const availableHeight = Math.max(0, Math.floor(height - bottomGap));

	if(width <= 0 && availableHeight <= 0){
		return minHeight;
	}
	if(width <= 0){
		return Math.max(minHeight, availableHeight);
	}
	if(availableHeight <= 0){
		return Math.max(minHeight, Math.floor(width));
	}
	return Math.max(minHeight, Math.min(Math.floor(width), availableHeight));
}
