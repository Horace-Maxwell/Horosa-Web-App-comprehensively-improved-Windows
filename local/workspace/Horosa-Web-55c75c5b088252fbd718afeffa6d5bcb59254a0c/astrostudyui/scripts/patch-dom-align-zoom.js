// dom-align CSS-zoom 域劈叉补丁(2026-08-24 macOS Tahoe 全站浮层错位根治)。
//
// 病理:dom-align@1.12.4 的 setLeftTop() 把 rect 域(getBoundingClientRect,已被 CSS zoom
// 缩放)算出的位移量,直接写进 CSS 域(style.left/top,未被缩放)。桌面壳的缩放正是
// documentElement.style.zoom,于是 z≠1 时全站 antd 浮层(Select/Tooltip/Popover/
// Popconfirm/Dropdown/DatePicker… 900+ 使用点)系统性错位。闭式解:
//   Δ = (z−1)·(D−C) + z·(preset − floor(preset·z)),  preset = −999
// 比例项随距离放大 + 来自库内 -999px 探针的常数项(floor 来自 getClientPosition 的
// `x = Math.floor(box.left)`)。z=0.8、目标 480px 处 ⇒ −255.2px,与真机截图吻合;
// 单测按此闭式解逐位复现(6 位小数)。
//
// 修法:两处写回各除以「运行时实测的有效缩放」__hz(由 src/utils/zoomDomain.js 经
// window.__HOROSA_ALIGN_SCALE__ 提供)。验算:
//   originalStyle = -999 + (L0·z − floor(-999·z))/z ≈ L0     (还原原位)
//   ret = originalStyle + (D − C − L0·z)/z                   (最终 rect ≈ D)
// 残差仅来自库自身的 floor 取整,恒 < 1 CSS px(亚像素,肉眼不可见)。__hz===1
//(默认档/浏览器/钩子缺席)时**原表达式一字未执行改动**,只多一次数值比较
// ⇒ 零回归可数学证明。
//
// 为何是补丁而不是 webpack alias:setLeftTop 是模块私有函数,包装器够不着;而 vendored
// 全量副本会让 jest(走 package.main=dist-node)与 webpack(走 module=dist-web)测到
// 不同的代码。本脚本**同时 patch 两份产物**,保证「测的就是跑的」。
//
// 幂等:首行标记存在即 skip。挂载点见 package.json 的 postinstall / build / build:file
// 三处(build_desktop_release.sh 的 npm install 在 Installer 目录而非本目录,前端 build
// 是手工步骤,只挂 postinstall 会漏)。完整性由 jest 哨兵 + release_preflight 双锁。

const fs = require('fs');
const path = require('path');

const MARK = '/* horosa:dom-align-zoom v1 */';

const PREAMBLE = MARK + `
function __horosaAlignScale(elem){
  try{
    var f = (typeof window !== 'undefined') && window.__HOROSA_ALIGN_SCALE__;
    if(typeof f === 'function'){ var z = Number(f(elem)); if(z > 0 && isFinite(z)){ return z; } }
  }catch(e){}
  return 1;
}
function __horosaViewportScale(win){
  try{
    var f = (typeof window !== 'undefined') && window.__HOROSA_ALIGN_VIEWPORT_SCALE__;
    if(typeof f === 'function'){ var s = Number(f(win)); if(s > 0 && isFinite(s)){ return s; } }
  }catch(e){}
  return 1;
}
`;

// 每条:{ id, find(正则), replace, count(期望命中数) }
const EDITS = [
	{
		id: 'P1-setLeftTop-scale',
		find: /function setLeftTop\(elem, offset, option\) \{\n/g,
		replace: 'function setLeftTop(elem, offset, option) {\n  var __hz = __horosaAlignScale(elem);\n',
		count: 1,
	},
	{
		id: 'P2-off',
		find: /(\n(\s*)var off = originalOffset\[key\] - old\[key\];)/g,
		replace: '$1\n$2if (__hz !== 1) { off = off / __hz; }',
		count: 1,
	},
	{
		id: 'P3-_off',
		find: /(\n(\s*)var _off = offset\[_key\] - originalOffset\[_key\];)/g,
		replace: '$1\n$2if (__hz !== 1) { _off = _off / __hz; }',
		count: 1,
	},
	{
		// 防御性:antd/rc-align 当前恒走 setLeftTop(不设 useCssTransform),此路未用;
		// 若未来版本切到 transform 路径,补偿同样在位。配套 jest 哨兵断言 antd 不含该开关。
		id: 'P4-setTransform',
		find: /function setTransform\$1\(elem, offset\) \{\n(\s*)var originalOffset = getOffset\(elem\);/g,
		replace: 'function setTransform$$1(elem, offset) {\n$1var __hz = __horosaAlignScale(elem);\n$1var originalOffset = getOffset(elem);',
		count: 1,
	},
	{
		id: 'P4b-transform-x',
		find: /resultXY\.x = originalXY\.x \+ offset\.left - originalOffset\.left;/g,
		replace: 'resultXY.x = originalXY.x + (offset.left - originalOffset.left) / __hz;',
		count: 1,
	},
	{
		id: 'P4c-transform-y',
		find: /resultXY\.y = originalXY\.y \+ offset\.top - originalOffset\.top;/g,
		replace: 'resultXY.y = originalXY.y + (offset.top - originalOffset.top) / __hz;',
		count: 1,
	},
	{
		// P5/P6:getVisibleRectForElement 与 alignPoint 两处 viewport 读数。
		// getViewportScale() 在本仓恒返回 1(clientWidth 与 rect 同域),此处仅为引擎语义
		// 变化时的自动兜底——乘 1 = 一字不变。
		id: 'P5-viewport',
		find: /(\n(\s*)var viewportWidth = utils\.viewportWidth\(win\);\n\s*var viewportHeight = utils\.viewportHeight\(win\);)/g,
		replace: '$1\n$2var __vs = __horosaViewportScale(win);\n$2if (__vs !== 1) { viewportWidth *= __vs; viewportHeight *= __vs; }',
		count: 2,
	},
];

const TARGETS = ['node_modules/dom-align/dist-node/index.js', 'node_modules/dom-align/dist-web/index.js'];

function patchFile(rel){
	const full = path.resolve(__dirname, '..', rel);
	if(!fs.existsSync(full)){ return { file: rel, status: 'missing' }; }
	let src = fs.readFileSync(full, 'utf8');
	if(src.indexOf(MARK) >= 0){ return { file: rel, status: 'unchanged' }; }
	for(const e of EDITS){
		const hits = (src.match(e.find) || []).length;
		if(hits !== e.count){
			// 锚点漂移(多半是 dom-align 升级):拒绝半修,整份放弃并报错。
			return { file: rel, status: 'anchor-drift', detail: `${e.id} 期望 ${e.count} 处,实得 ${hits} 处` };
		}
		src = src.replace(e.find, e.replace);
	}
	fs.writeFileSync(full, PREAMBLE + src, 'utf8');
	return { file: rel, status: 'patched' };
}

const results = TARGETS.map(patchFile);
const patched = results.filter((r) => r.status === 'patched').length;
const unchanged = results.filter((r) => r.status === 'unchanged').length;
const missing = results.filter((r) => r.status === 'missing').length;
const drift = results.filter((r) => r.status === 'anchor-drift');

console.log(`[patch-dom-align-zoom] patched=${patched} unchanged=${unchanged} missing=${missing} drift=${drift.length}`);
if(drift.length){
	drift.forEach((r) => console.error(`  ❌ ${r.file}: ${r.detail}`));
	console.error('  → dom-align 结构已变(疑似升级),补丁锚点须重新核对后再发布。');
	process.exit(1);
}
