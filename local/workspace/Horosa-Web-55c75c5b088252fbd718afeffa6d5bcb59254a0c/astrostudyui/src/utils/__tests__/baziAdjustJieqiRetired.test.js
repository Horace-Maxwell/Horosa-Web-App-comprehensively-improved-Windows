// 「节气按纬度调整」已停用:本地引擎不实现、控件已隐藏。锁四件事:
//   ① 发给取数端的值恒 0 —— 八字页 genParams / AI 无头重算 buildChartBaziParams / 八字择日内嵌页三处,哪怕 fields / 记录里带着旧的 1;
//   ② 旧记录载入时该键归 0(applyRecordToFields);
//   ③ 本地引擎盘的快照不写「节气按纬度调整」(此前照抄参数写,四柱却与不调整逐字相同);
//   ④ 本地引擎确实不读这一项(两档四柱逐字相同)—— 哪天真实现了,这条会红,届时再放开①–③。
import moment from 'moment';
import astroModel from '../../models/astro';
import BaZi, { buildBaziSnapshotForParams } from '../../components/cntradition/BaZi';
import BaziZeriMain from '../../components/zeri/BaziZeriMain';
import { buildChartBaziParams } from '../aiAnalysisContext/chartParams';
import { applyRecordToFields } from '../recordFieldsRestore';
import { buildLocalBaziResult, BAZI_ADJUST_JIEQI_SENT } from '../baziLunarLocal';

const P = { date: '1990-02-09', time: '10:00:00', zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9,
	gender: 1, timeAlg: 1, after23NewDay: 1, lateZiHourUseNextDay: 1, phaseType: 0, godKeyPos: '年' };

function fieldsWith(adjustJieqi){
	const f = {}; Object.keys(astroModel.state.fields).forEach((k)=>{ f[k] = { ...astroModel.state.fields[k] }; });
	const dt = moment(`${P.date} ${P.time}`, 'YYYY-MM-DD HH:mm:ss'); dt.zone = P.zone; dt.ad = 1;
	const mk = ()=>Object.assign(dt.clone(), { zone: P.zone, ad: 1 });
	f.date = { ...f.date, value: mk() }; f.time = { ...f.time, value: mk() }; f.zone = { ...f.zone, value: P.zone };
	f.lon = { ...f.lon, value: P.lon }; f.lat = { ...f.lat, value: P.lat }; f.gpsLon = { ...(f.gpsLon || {}), value: P.gpsLon }; f.gpsLat = { ...(f.gpsLat || {}), value: P.gpsLat };
	f.adjustJieqi = { ...(f.adjustJieqi || { name: ['adjustJieqi'] }), value: adjustJieqi };
	return f;
}

describe('节气按纬度调整:发出的参数恒为 0', ()=>{
	test('单一来源的值是 0', ()=>{
		expect(BAZI_ADJUST_JIEQI_SENT).toBe(0);
	});
	test('八字页 genParams:fields 里带 1 也发 0', ()=>{
		const fields = fieldsWith(1);
		const params = BaZi.prototype.genParams.call({ props: { fields }, state: { baziOpt: {} } }, fields);
		expect(params.adjustJieqi).toBe(0);
	});
	test('AI 无头重算:记录里带 1 也发 0', ()=>{
		const record = { birth: `${P.date} ${P.time}`, zone: P.zone, lon: P.lon, lat: P.lat, gpsLon: P.gpsLon, gpsLat: P.gpsLat, gender: 1, adjustJieqi: 1 };
		expect(buildChartBaziParams(record).adjustJieqi).toBe(0);
	});
	test('八字择日内嵌页的底板 fields 是 0', ()=>{
		const host = { state: { pickText: `${P.date} ${P.time}`, geo: { zone: P.zone, lon: P.lon, lat: P.lat, gpsLon: P.gpsLon, gpsLat: P.gpsLat }, options: {}, embedPatch: null } };
		const fields = BaziZeriMain.prototype.buildFields.call(host, false);
		expect(fields.adjustJieqi.value).toBe(0);
	});
	test('旧记录载入:存着 1 也还原成 0', ()=>{
		const out = applyRecordToFields({ adjustJieqi: { name: ['adjustJieqi'], value: 0 } }, { adjustJieqi: 1 });
		expect(out.adjustJieqi.value).toBe(0);
	});
});

describe('节气按纬度调整:本地引擎不实现 → 快照不写该行', ()=>{
	test('本地引擎两档四柱逐字相同', ()=>{
		const gz = (c)=>[c.year, c.month, c.day, c.time].map((x)=>x.ganzi).join(' ');
		const a = buildLocalBaziResult({ ...P, adjustJieqi: 0 }).bazi.fourColumns;
		const b = buildLocalBaziResult({ ...P, adjustJieqi: 1 }).bazi.fourColumns;
		expect(gz(b)).toBe(gz(a));
	});
	test('参数带 1 的本地盘,快照写「不调整节气」,不写「节气按纬度调整」', async ()=>{
		const s1 = await buildBaziSnapshotForParams({ ...P, adjustJieqi: 1 });
		const s0 = await buildBaziSnapshotForParams({ ...P, adjustJieqi: 0 });
		expect(s1).not.toMatch(/节气按纬度调整/);
		expect(s1).toMatch(/节气修正：不调整节气/);
		expect(s1).toBe(s0);
	});
	test('缺省 0 的快照这一行逐字不变', async ()=>{
		const s0 = await buildBaziSnapshotForParams({ ...P, adjustJieqi: 0 });
		expect(s0.split('\n').filter((l)=>l.indexOf('节气修正') >= 0)).toEqual(['节气修正：不调整节气']);
	});
});
