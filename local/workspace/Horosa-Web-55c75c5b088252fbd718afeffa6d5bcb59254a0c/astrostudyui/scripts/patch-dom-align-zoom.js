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
// v2(2026-09-19)—— 翻转 / 夹紧半程的域混:getVisibleRectForElement 的祖先裁剪循环把 rect 域的 utils.offset(el) 与**布局域**的
// el.clientLeft/Top/Width/Height 直接相加。壳放大档(z>1)下滚动祖先的可视区被算矮(top·z + height,应为 top·z + height·z),
// 位于祖先下半部的触发器被 isOutOfVisibleRect 判成「不可见」⇒ doAlign 整段跳过翻转与夹紧 ⇒ 下拉明明上方放得下却伸出窗口底边
// (真 WebKit 1.8 档实测超出 53~192 视觉 px)。修:四个布局域读数各乘同一个实测有效缩放;__hz===1 时 x*1 逐位不变(零回归)。
// v1 的守卫把 overflow 全关、且 jsdom 视口读数为 0 使 visibleRect 恒 null —— 这一段此前从未被任何测试执行过。
//
// v3(2026-09-19)—— 「文档尺寸」这条读数漏了视口换域:body 是 overflow:hidden 时(本应用恒如此)库把 documentWidth/Height 换成
// win.innerWidth/innerHeight(物理域),再与 scrollY + viewportHeight 取 max 当可见区下沿。v1 的 P5 只换了 viewportWidth/Height,
// 这条没换 ⇒ 在 rect 不反映缩放的引擎(较旧的 macOS WebKit;rect 域 = 布局域,可见视口 = 物理 ÷ 缩放)上,max() 被物理值顶回去,
// 放大档靠下的下拉不翻转、伸出窗口底边(headless 双引擎闸 E2 语义实抓)。修:两条读数同乘视口系数;rect 反映缩放的引擎系数恒 1,逐位不变。
//
// 幂等:首行标记存在即 skip;已打旧版的产物原地升级(只补缺的锚,不重复已有的)。挂载点见 package.json 的 postinstall / build / build:file
// 三处(build_desktop_release.sh 的 npm install 在 Installer 目录而非本目录,前端 build
// 是手工步骤,只挂 postinstall 会漏)。完整性由 jest 哨兵 + release_preflight 双锁。

const fs = require('fs');
const path = require('path');

const MARK_V1 = '/* horosa:dom-align-zoom v1 */';
const MARK_V2 = '/* horosa:dom-align-zoom v2 */';
const MARK = '/* horosa:dom-align-zoom v3 */';

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
		// getViewportScale() = 「铺满视口的 fixed 元素 rect 宽 ÷ clientWidth」(直接量):rect 反映缩放的引擎恒 1(乘 1 = 一字不变);
		// rect 不反映缩放的引擎(较旧的 macOS WebKit)= 1/缩放 —— 否则放大档下对齐库高估可见视口,靠下的下拉不翻转、伸出窗口底边。
		id: 'P5-viewport',
		find: /(\n(\s*)var viewportWidth = utils\.viewportWidth\(win\);\n\s*var viewportHeight = utils\.viewportHeight\(win\);)/g,
		replace: '$1\n$2var __vs = __horosaViewportScale(win);\n$2if (__vs !== 1) { viewportWidth *= __vs; viewportHeight *= __vs; }',
		count: 2,
	},
];

// v2:祖先裁剪循环的四个布局域读数换到 rect 域(见文件头 v2 注)。
const EDITS_V2 = [
	{
		id: 'P6-visibleRect-scale',
		find: /(\n(\s*)var pos = utils\.offset\(el\);\n)/g,
		replace: '$1$2var __hzc = __horosaAlignScale(el);\n',
		count: 1,
	},
	{
		id: 'P6a-clientLeft',
		find: /pos\.left \+= el\.clientLeft;/g,
		replace: 'pos.left += el.clientLeft * __hzc;',
		count: 1,
	},
	{
		id: 'P6b-clientTop',
		find: /pos\.top \+= el\.clientTop;/g,
		replace: 'pos.top += el.clientTop * __hzc;',
		count: 1,
	},
	{
		id: 'P6c-clientWidth',
		find: /pos\.left \+ el\.clientWidth\);/g,
		replace: 'pos.left + el.clientWidth * __hzc);',
		count: 1,
	},
	{
		id: 'P6d-clientHeight',
		find: /pos\.top \+ el\.clientHeight\);/g,
		replace: 'pos.top + el.clientHeight * __hzc);',
		count: 1,
	},
];

// v3:body overflow:hidden 分支里的「文档尺寸」读数换到 rect 域(见文件头 v3 注)。__vs 由 P5 在同一函数里先行定义。
const EDITS_V3 = [
	{
		id: 'P7a-documentWidth',
		find: /documentWidth = win\.innerWidth;/g,
		replace: 'documentWidth = win.innerWidth * __vs;',
		count: 1,
	},
	{
		id: 'P7b-documentHeight',
		find: /documentHeight = win\.innerHeight;/g,
		replace: 'documentHeight = win.innerHeight * __vs;',
		count: 1,
	},
];

const TARGETS = ['node_modules/dom-align/dist-node/index.js', 'node_modules/dom-align/dist-web/index.js'];

function patchFile(rel){
	const full = path.resolve(__dirname, '..', rel);
	if(!fs.existsSync(full)){ return { file: rel, status: 'missing' }; }
	let src = fs.readFileSync(full, 'utf8');
	if(src.indexOf(MARK) >= 0){ return { file: rel, status: 'unchanged' }; }
	const hasV1 = src.indexOf(MARK_V1) >= 0;
	const hasV2 = src.indexOf(MARK_V2) >= 0;
	// 已打旧版 → 只补缺的锚并把标记升到当前版(前导函数已在);未打 → 全打。
	const edits = hasV2 ? EDITS_V3 : (hasV1 ? EDITS_V2.concat(EDITS_V3) : EDITS.concat(EDITS_V2, EDITS_V3));
	for(const e of edits){
		const hits = (src.match(e.find) || []).length;
		if(hits !== e.count){
			// 锚点漂移(多半是 dom-align 升级):拒绝半修,整份放弃并报错。
			return { file: rel, status: 'anchor-drift', detail: `${e.id} 期望 ${e.count} 处,实得 ${hits} 处` };
		}
		src = src.replace(e.find, e.replace);
	}
	if(hasV1 || hasV2){
		fs.writeFileSync(full, src.replace(hasV2 ? MARK_V2 : MARK_V1, MARK), 'utf8');
		return { file: rel, status: 'patched' };
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
