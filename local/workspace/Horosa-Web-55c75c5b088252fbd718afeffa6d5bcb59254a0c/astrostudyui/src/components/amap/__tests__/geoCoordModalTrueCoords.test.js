// 选点交给页面的 lat / lng 必须是真坐标(WGS84),与 gpsLat / gpsLng、与 AI 助手地名解析写的经纬度文本一致。
// 此前交出去的是高德 GCJ-02 加偏点,各页 changeGeo 拿它写经纬度文本 → 约一半城市差 1′(上游报告:广州选点 113e15、AI 解析 113e16)。
import GeoCoordModal from '../GeoCoordModal';
import { gpsToGcj02 } from '../../../utils/helper';
import { convertLatToStr, convertLonToStr } from '../../astro/AstroHelper';
import { geoPairToRecordFields } from '../../../utils/aiTools/normalize/geoCompass';

function pick(record){
	const got = [];
	const modal = new GeoCoordModal({ onOk: (rec)=>got.push(rec) });
	modal.setState = (patch)=>{ Object.assign(modal.state, typeof patch === 'function' ? patch(modal.state) : patch); };
	modal.state.record = record;
	modal.clickOk();
	return got[0];
}

describe('选点弹窗交出真坐标', ()=>{
	const CITIES = [['广州', 23.1291, 113.2644], ['北京', 39.9042, 116.4074], ['上海', 31.2304, 121.4737], ['成都', 30.5728, 104.0668], ['乌鲁木齐', 43.8256, 87.6168]];
	it.each(CITIES)('%s:城市库(WGS84)选点 → 页面拿到的 lat / lng = gpsLat / gpsLng,经纬度文本与 AI 解析逐字相同', (name, lat, lng)=>{
		const gcj = gpsToGcj02(lat, lng);
		const rec = pick({ lat: gcj.lat, lng: gcj.lon, gpsLat: lat, gpsLng: lng, name });
		expect(rec.lat).toBe(lat);
		expect(rec.lng).toBe(lng);
		const ai = geoPairToRecordFields(lat, lng);
		expect(convertLatToStr(rec.lat)).toBe(ai.lat);
		expect(convertLonToStr(rec.lng)).toBe(ai.lon);
		expect(rec.name).toBe(name);
	});
	it('地图点选(只有 GCJ 点、没带 gps)→ 先反算 gps,交出去的仍是反算后的真坐标', ()=>{
		const gcj = gpsToGcj02(23.1291, 113.2644);
		const rec = pick({ lat: gcj.lat, lng: gcj.lon, name: '' });
		expect(rec.lat).toBe(rec.gpsLat);
		expect(rec.lng).toBe(rec.gpsLng);
		expect(Math.abs(rec.gpsLat - 23.1291)).toBeLessThan(1e-4);
		expect(Math.abs(rec.gpsLng - 113.2644)).toBeLessThan(1e-4);
	});
	it('判别力:GCJ 点与真坐标在这些城市里确有角分级差异(否则本测试测不出回归)', ()=>{
		const diff = CITIES.filter(([, lat, lng])=>{ const g = gpsToGcj02(lat, lng); return convertLonToStr(g.lon) !== convertLonToStr(lng) || convertLatToStr(g.lat) !== convertLatToStr(lat); });
		expect(diff.length).toBeGreaterThan(0);
	});
});
