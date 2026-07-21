// 3D 天球球面数学(零依赖纯函数 —— jest 可测,Astro3D 黄道系与 AstroPDSphere 赤道系共用)。
//
// 黄道系摆点公共式(WS-0 自 Astro3D 六处逐字重复抽取):
//   x = R·cosβ·cosλ, y = R·sinβ, z = −R·cosβ·sinλ  (λ=黄经°,β=黄纬°)
// 赤道系(主限天球)同构:传 (α 赤经, δ 赤纬) 即得(Y=天北极)。
export function sph(lonDeg, latDeg, R){
	const lon = lonDeg * Math.PI / 180;
	const lat = latDeg * Math.PI / 180;
	const tmpR = R * Math.cos(lat);
	return { x: tmpR * Math.cos(lon), y: R * Math.sin(lat), z: -tmpR * Math.sin(lon) };
}
