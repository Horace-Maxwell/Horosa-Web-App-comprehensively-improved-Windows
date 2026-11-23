// 主限天球 · 场景常量:主题色、四级明度、2π 与大圆参数曲线(TubeGeometry 路径)
// 从 PDSphereEngine.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as THREE from 'three';

// 主题色(黑底天球,与 Astro3D ChartBackgroud 同底色系)
// export=纯加法:语义色键契约由 smoke 测试看守(ecliptic 键缺失曾致刻度线静默白色)。
export const PD_COLOR = {
	background: 0x000000,
	grid: 0x24405e,            // 赤经时圈/赤纬圈细线
	equator: 0x3f6f9e,         // 天赤道(稍亮)
	horizon: 0x59a86c,         // 地平圈
	meridian: 0xa06bc4,        // 子午圈
	primeVertical: 0x3e9d94,   // 卯酉圈
	frameLabel: 0xd7e3f4,      // 天顶/东点/北点标注
	virtualPoint: 0x8a8a8a,    // 虚点(映点/界/相位点)小号灰点
	direct: 0xffd700,          // 顺向 direct = 金色
	converse: 0x00e0e0,        // 逆向 converse = 青色
	ecliptic: 0xd8ab52,        // 黄道带 12 星座刻度线(与星座符号 #d8ab52 同族金;补前为 undefined→刻度线渲染白色+material 警告)
	truePos: 0xdbe7f5,         // 复合运动真位标识色(银白):真位层 glyph+环形晕圈统一此色,与方向金/青及行星本色都拉开
};

// 四级明度体系常量表(集中可调;层级:辅助网格→主结构圈→标准点位→选中链最亮):
// 赤道网格退为极淡辅助线,地平三圈/黄道为主结构,本命点标准亮度,选中链(selectRow 高亮)最亮。
export const PD_LEVELS = {
	grid: 0.16,          // 赤道网格(时圈/纬圈):极淡辅助(原 0.55 与主结构圈抢层级)
	virtualShown: 0.22,  // 虚点 toggle 全显模式透明度(原 0.9 满球灰点噪音;选中行涉及点显影高亮不受此限)
	starfieldMax: 0.5,   // 程序化星空背景单点最大透明度(装饰层,永不与数据层抢焦点)
};

export const TWO_PI = Math.PI * 2;

/** 大圆参数曲线:P(t)=R·(u·cos2πt + w·sin2πt) —— TubeGeometry 的路径输入 */
export class GreatCircleCurve extends THREE.Curve{
	constructor(u, w, R){
		super();
		this.u = u;
		this.w = w;
		this.R = R;
	}

	getPoint(t, optionalTarget){
		const a = t * TWO_PI;
		const c = Math.cos(a);
		const s = Math.sin(a);
		const v = optionalTarget || new THREE.Vector3();
		return v.set(
			(this.u.x * c + this.w.x * s) * this.R,
			(this.u.y * c + this.w.y * s) * this.R,
			(this.u.z * c + this.w.z * s) * this.R
		);
	}
}
