// 3D 星盘 · 场景常量与小工具:补间共用 Y 轴、材质遍历、盘面选项存储键、相机距离倍数、光照两档缺省、取色值转数值色
// 从 Astro3D.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as THREE from 'three';

// WS-1b:补间共用 Y 轴(黄道北极方向);setFromAxisAngle 不修改轴向量,可安全共享
export const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function traverseMaterials(object, callback) {
	object.traverse((node) => {
		if (!node.isMesh) return;
		const materials = Array.isArray(node.material) ? node.material : [node.material];
		materials.forEach(callback);
	});
}

export const ChartOptKey = 'chart3dOpt';
// 相机与球心距离的「半径倍数」语义(见 chartOpt 默认值注释)
export const CAM_DIST_RATIO_DEFAULT = 3.5;
export const CAM_DIST_RATIO_MIN = 2;

// 光照两档的可见效果接在太阳晕透明度(太阳光强度)与星点透明度(环境光强度)上:缺省值 = 完全不透明(封顶),
// 映射锚必须等于缺省,滑杆上限也只到缺省(再往上无变化);建盘时同样按这两档应用(此前只运行时改才生效,刷新后回原样)。
export const SUN_INTENSITY_DEFAULT = 6.5;
export const AMBIENT_INTENSITY_DEFAULT = 0.3;
// 取色器值('#rrggbb' 字符串 / 数值)→ 数值色(与 changeOpt 内的 toHex 同逻辑,供建盘路径使用)
export function colorToHex(v){
	if(typeof v === 'string'){ return parseInt(v.replace('#', ''), 16); }
	return v;
}
