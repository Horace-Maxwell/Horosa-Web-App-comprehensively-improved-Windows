// 高德 GCJ-02 加偏坐标只许在地图组件里用(打点 / 显示);起盘用的经纬度文本、gpsLat / gpsLon 一律是真坐标(WGS84)。
// 此前选点把 GCJ 点交给各页写经纬度文本、几处手输经纬度又把文本当 GCJ 反算 gps —— 与 AI 地名解析差 1′。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../..');
const ALLOWED = new Set(['components/amap/GeoCoordModal.js', 'components/amap/GeoCoordSelector.js', 'components/amap/PointsCluster.js', 'utils/helper.js']);

function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){ if(!['node_modules', '.umi', '.umi-production', '__tests__'].includes(f)){ walk(p, out); } }
		else if(/\.jsx?$/.test(f)){ out.push(p); }
	});
	return out;
}

describe('GCJ-02 换算只在地图组件里', ()=>{
	it('地图组件以外没有 gcj02ToGps / gpsToGcj02', ()=>{
		const bad = walk(SRC, []).map((p)=>path.relative(SRC, p).split(path.sep).join('/'))
			.filter((rel)=>!ALLOWED.has(rel))
			.filter((rel)=>/\b(gcj02ToGps|gpsToGcj02)\b/.test(fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\/\/[^\n]*/g, '')));
		expect(bad).toEqual([]);
	});
	it('选点弹窗出口把 lat / lng 换成 gpsLat / gpsLng', ()=>{
		const src = fs.readFileSync(path.join(SRC, 'components/amap/GeoCoordModal.js'), 'utf8');
		expect(src).toMatch(/rec\.lat = gLat;/);
		expect(src).toMatch(/rec\.lng = gLng;/);
	});
});
