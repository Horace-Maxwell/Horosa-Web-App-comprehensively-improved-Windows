// 风水纳气盘引擎（从 public/fengshui/app.js 移植为框架无关模块）。
// 由 React 组件持有：构造时传入 canvas 与 onChange(viewModel) 回调；
// 所有画布绘制/几何/判定/历史/导出/快照逻辑在本类，React 只渲染 Antd 控件并调用本类方法。
// 类本体(构造 / 销毁)在此;常量与各组方法按职责拆在 ./engine/ 下(constants · state · geometry · draw · exportCards · tools · pointer),
// 类后 mixinMethods 挂回原型。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
// 注意：画布按工作区尺寸铺满、户型图居中绘制，纳气盘可延伸到图外空白区而不被裁切。

import { MARKER_TYPES } from './engine/constants';
import { mixinMethods } from '../../utils/mixinMethods';
import { stateMethods } from './engine/state';
import { geometryMethods } from './engine/geometry';
import { drawMethods } from './engine/draw';
import { exportCardMethods } from './engine/exportCards';
import { toolMethods } from './engine/tools';
import { pointerMethods } from './engine/pointer';
export { SECTORS, MARKER_TYPES, BAGUA_MARKER_TYPES, DISK_SKINS } from './engine/constants';

export default class FengShuiEngine {
	constructor(canvas, options = {}) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.onChange = options.onChange || (() => {});

		this.img = new Image();
		this.imgLoaded = false;
		this.scale = 1;
		this.viewScale = 1;
		this.viewOffset = { x: 0, y: 0 };

		this.rect = { x: 0, y: 0, w: 0, h: 0, rotation: 0, active: false };
		this.mode = 'none';
		this.isDragging = false;
		this.startPoint = { x: 0, y: 0 };
		this.activeHandle = null;
		this.initialRectState = null;
		this.dragMarkerId = null;
		this.panStart = null;
		this.panMode = false;
		this.snapEnabled = true;

		this.unitAzimuth = null;
		this.doorImageAngle = null;
		this.globalAlpha = 0.3;
		this.diskScale = 1;
		this.diskCenterMode = 'house';
		this.customCenter = null;
		this.periodMode = 'current';

		this.markers = [];
		this.selectedMarkerId = null;
		this.markerIdSeed = 1;
		this.currentFilter = 'all';
		this.markerType = MARKER_TYPES[0].id;

		// 模式 / 八卦朝向 / 罗盘皮肤（默认 naqi + draw = 现状零回归）
		this.techMode = 'naqi'; // 'naqi' | 'bagua'
		this.baguaOrient = null; // 八卦阳宅：单一「正北方向(度)」，驱动盘旋转
		this.diskSkin = 'draw';
		this.skinImages = {}; // src -> HTMLImageElement 缓存
		this.facingMarkerId = null; // 正在标灶口朝向的灶台标记

		this.status = '请上传户型图开始。';

		this.historyStack = [];
		this.redoStack = [];
		this.historyLocked = false;
		this.historyTimer = null;

		this._onMouseDown = this._onMouseDown.bind(this);
		this._onMouseMove = this._onMouseMove.bind(this);
		this._onMouseUp = this._onMouseUp.bind(this);

		canvas.addEventListener('mousedown', this._onMouseDown);
		canvas.addEventListener('mousemove', this._onMouseMove);
		window.addEventListener('mouseup', this._onMouseUp);

		this.initHistory();
		this.emit();
	}

	destroy() {
		this.canvas.removeEventListener('mousedown', this._onMouseDown);
		this.canvas.removeEventListener('mousemove', this._onMouseMove);
		window.removeEventListener('mouseup', this._onMouseUp);
		if (this.historyTimer) clearTimeout(this.historyTimer);
	}
}
mixinMethods(FengShuiEngine, stateMethods, geometryMethods, drawMethods, exportCardMethods, toolMethods, pointerMethods);   // 方法按职责拆在 ./engine/ 下(见各文件头),挂回原型
