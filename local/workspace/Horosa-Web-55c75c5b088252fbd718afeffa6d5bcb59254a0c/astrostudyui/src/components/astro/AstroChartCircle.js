// 星盘圆盘(d3 画盘):类定义在这里;模块级助手与类方法按职责拆在 ./chartCircle/ 下,
// 方法拆片 setupLookup · bands · placement · drawing · overlays,类后 mixinMethods 挂回原型。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as AstroConst from '../../constants/AstroConst';
import { detectOS } from '../../utils/helper';
import { mixinMethods } from '../../utils/mixinMethods';
import { setupLookupMethods } from './chartCircle/setupLookup';
import { bandMethods } from './chartCircle/bands';
import { placementMethods } from './chartCircle/placement';
import { drawingMethods } from './chartCircle/drawing';
import { overlayMethods } from './chartCircle/overlays';
export { resolveChartCircleDisplayMode } from './chartCircle/displayStyle';

export default class AstroChartCircle {
	constructor(option){
		this.ChartMargin = 20;
		this.ChartMarginDelta = 55;
		this.ChartMoveUp = 10;
		this.TxtOffsetTop = 0;
		this.rThreshold = 100;
		this.osFlag = detectOS();
		if(this.osFlag === 'Mac'){
			this.TxtOffsetTop = 2;
		}

		this.divTooltip = option.divTooltip;
		this.onTipClick = option.onTipClick;
		this.showAstroMeaning = option.showAstroMeaning ? true : false;
		this.chartStyle = AstroConst.CHART_STYLE_CURRENT;

		this.setupToolTip();
	}
}
mixinMethods(AstroChartCircle, setupLookupMethods, bandMethods, placementMethods, drawingMethods, overlayMethods);   // 方法按职责拆在 ./chartCircle/ 下(见各文件头),挂回原型
