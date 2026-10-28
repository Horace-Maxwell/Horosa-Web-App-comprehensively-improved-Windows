// 推运 / 返照 / 行运 / 起课类缺省「此刻 / 今日 / 今年」= 真实此刻按这张盘(或起课地)所用时区换算 —— 单源 DateTime.nowForChart / wallClockForChart。
// 此前:东八区钟面(new DateTime())或本机钟面(new Date())直接配本盘时区下发 → 不在东八区(或与本机不同时区)的盘错开时差那么多小时。
// 不变量(逐位对拍):盘时区 = 东八区时与旧口径 new DateTime() 逐位相同;盘时区 = 本机时区时与旧口径 new Date() 逐位相同。
// (jest 进程里改不了时区缓存:期望值按固定瞬时 + 时区算术给出;另以 TZ=Asia/Shanghai 起 jest 跑同一份,本机钟面类在东八区本机上也逐位不变。)
var mockBodies = [];
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async (url, opts) => { try{ mockBodies.push({ url: `${url}`.replace(/^https?:\/\/[^/]+/, ''), body: JSON.parse(opts.body) }); }catch(_e){} return { Result: {} }; }) }));
jest.mock('../../services/astro', () => ({ fetchChart: jest.fn(async (values) => ({ Result: { chart: { objects: [], stars: [] }, lots: [], params: { ...values, birth: `${values.date} ${values.time}`, zone: values.zone }, predictives: { primaryDirection: [] } } })) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), clearModuleAISnapshot: jest.fn() }));
import moment from 'moment';
import DateTime from '../../components/comp/DateTime';
import { today } from '../../components/astro/astroProgSnapshot';
import { defaultEphemerisWindow } from '../../components/astro/AstroEphemeris';
import { todayDateStr } from '../aiAnalysisContext/regenHoraryElection';
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';
import { makeDefaultMoiraTransitTime } from '../../components/guolao/main/params';
import { buildSourceFromArgs } from '../aiTools/tools/castTechnique';

const INSTANT = '2026-09-18T03:30:00Z';   // = 11:30 @ +08:00 = 前一天 23:30 @ -04:00 = 22:30 @ -05:00
const fieldsOf = (d)=>[d.ad, d.zone, d.year, d.month, d.date, d.hour, d.minute, d.second];
const p2 = (n)=>`${n}`.padStart(2, '0');
const sysOff = ()=>{ const o = moment().utcOffset(); const a = Math.abs(o); return `${o < 0 ? '-' : '+'}${p2(Math.floor(a / 60))}:${p2(a % 60)}`; };
const sysToday = ()=>{ const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const REC = (zone)=>({ cid: 'z', name: '时区', birth: '1990-05-18 10:00:00', zone, lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 });

beforeEach(()=>{ jest.useFakeTimers('modern'); jest.setSystemTime(new Date(INSTANT)); mockBodies = []; });
afterEach(()=>{ jest.useRealTimers(); });

describe('单源 DateTime.nowForChart / wallClockForChart', ()=>{
	test('🔴 东八区的盘:与旧口径 new DateTime() 逐位相同', ()=>{
		expect(fieldsOf(DateTime.nowForChart('+08:00'))).toEqual(fieldsOf(new DateTime()));
		expect(fieldsOf(DateTime.nowForChart('+08:00'))).toEqual([1, '+08:00', 2026, 9, 18, 11, 30, 0]);
	});
	test('🔴 非东八区的盘:真实此刻换算到盘时区(钟面与时区串配套)', ()=>{
		expect(fieldsOf(DateTime.nowForChart('-05:00'))).toEqual([1, '-05:00', 2026, 9, 17, 22, 30, 0]);
		expect(fieldsOf(DateTime.nowForChart('+05:30'))).toEqual([1, '+05:30', 2026, 9, 18, 9, 0, 0]);
		// 带秒的地方平时:按秒换算,时区串原样
		expect(fieldsOf(DateTime.nowForChart('+00:09:21'))).toEqual([1, '+00:09:21', 2026, 9, 18, 3, 39, 21]);
		expect(fieldsOf(DateTime.nowForChart('-02:48:07'))).toEqual([1, '-02:48:07', 2026, 9, 18, 0, 41, 53]);
	});
	test('没有 / 不合法的盘时区 = new DateTime()(原样)', ()=>{
		['', undefined, null, '+8', 'abc'].forEach((z)=>expect(fieldsOf(DateTime.nowForChart(z))).toEqual(fieldsOf(new DateTime())));
	});
	test('🔴 zoneWallShiftMs:跨本机夏令时补偏移差;目标钟面落在本机拨快跳过的那一小时(零点切换)时日期仍对', ()=>{
		const localFields = (t, off)=>new Date(t - off(t) * 60000).toISOString().slice(0, 16);   // 本机本地字段(按注入的偏移)
		// 圣地亚哥式:本地 9 月 7 日 00:00(UTC-4)拨到 01:00(UTC-3)
		const sw = Date.UTC(2025, 8, 7, 4, 0);
		const santiago = (ms)=>(ms < sw ? 240 : 180);
		const gap = DateTime.zoneWallShiftMs(Date.UTC(2025, 8, 6, 16, 0), 8 * 3600, santiago);   // 盘 +08:00 钟面 = 9 月 7 日 00:00
		expect(localFields(gap, santiago).slice(0, 10)).toBe('2025-09-07');
		expect(localFields(gap, santiago)).toBe('2025-09-07T01:00');   // 本机没有 00:00,晚一小时(日期不错)
		// 不在跳过的那一小时:补偏移差后本地字段 = 目标钟面,逐分钟
		for(const [nowMs, zs] of [[Date.UTC(2025, 8, 6, 17, 30), 8 * 3600], [Date.UTC(2025, 8, 6, 2, 0), 8 * 3600], [Date.UTC(2025, 8, 7, 12, 0), -5 * 3600], [Date.UTC(2025, 8, 6, 14, 45), 5.75 * 3600]]){
			expect(localFields(DateTime.zoneWallShiftMs(nowMs, zs, santiago), santiago)).toBe(new Date(nowMs + zs * 1000).toISOString().slice(0, 16));
		}
		// 回拨(纽约式 11 月):重复的那一小时也落在目标钟面
		const fb = Date.UTC(2025, 10, 2, 6, 0);
		const ny = (ms)=>(ms < fb ? 240 : 300);
		for(const nowMs of [Date.UTC(2025, 10, 2, 5, 30), Date.UTC(2025, 10, 2, 6, 30), Date.UTC(2025, 10, 1, 20, 0)]){
			expect(localFields(DateTime.zoneWallShiftMs(nowMs, 8 * 3600, ny), ny)).toBe(new Date(nowMs + 8 * 3600000).toISOString().slice(0, 16));
		}
		// 本机偏移恒定:就是平移
		expect(DateTime.zoneWallShiftMs(1e12, 3600, ()=>-480)).toBe(1e12 + 3600000 - 480 * 60000);
	});
	test('wallClockForChart:盘时区的钟面;没有盘时区 = 本机 new Date()(原样);盘时区 = 本机时区时与 new Date() 逐位相同', ()=>{
		const d = DateTime.wallClockForChart('-05:00');
		expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 17, 22, 30]);
		expect(DateTime.wallClockForChart('').getTime()).toBe(new Date().getTime());
		const same = DateTime.wallClockForChart(sysOff());
		expect(same.getTime()).toBe(new Date().getTime());
	});
});

describe('各处缺省「今日 / 此刻」', ()=>{
	test('🔴 推运目标日 today(zone):东八区盘 2026-09-18、-05:00 盘 2026-09-17;不给 / 盘时区 = 本机时区 → 与旧口径(本机今日)相同', ()=>{
		expect(today('+08:00')).toBe('2026-09-18');
		expect(today('-05:00')).toBe('2026-09-17');
		expect(today()).toBe(sysToday());
		expect(today(sysOff())).toBe(sysToday());
		expect(todayDateStr('-05:00')).toBe('2026-09-17');
		expect(todayDateStr()).toBe(sysToday());
		expect(defaultEphemerisWindow('-05:00').startDate).toBe('2026-09-17');
		expect(defaultEphemerisWindow('').startDate).toBe(sysToday());
	});
	test('🔴 七政四余行运缺省时刻:真实此刻在本盘时区(此前东八区钟面改贴本盘时区)', ()=>{
		expect(fieldsOf(makeDefaultMoiraTransitTime({ zone: { value: '-05:00' } }))).toEqual([1, '-05:00', 2026, 9, 17, 22, 30, 0]);
		expect(fieldsOf(makeDefaultMoiraTransitTime({ zone: { value: '+08:00' } }))).toEqual(fieldsOf(new DateTime()));
		expect(fieldsOf(makeDefaultMoiraTransitTime({}))).toEqual(fieldsOf(new DateTime()));
	});
	test('🔴 AI 挂载 / 无头:小限 / 太阳弧缺省目标 = 此刻按本盘时区;东八区盘与旧口径逐位相同', async ()=>{
		const send = async (key, zone)=>{ mockBodies = []; await regenerateChartTechniqueSnapshot(REC(zone), key); const r = mockBodies.find((b)=>b.url.indexOf('/predict/') >= 0); return r && r.body; };
		for(const key of ['profection', 'solararc']){
			const e8 = await send(key, '+08:00');
			expect(e8.datetime).toBe(new DateTime().format('YYYY-MM-DD HH:mm'));   // 旧口径
			expect(e8.datetime).toBe('2026-09-18 11:30');
			const w5 = await send(key, '-05:00');
			expect(w5.datetime).toBe('2026-09-17 22:30');
			expect(w5.dirZone).toBe('-05:00');
		}
	});
	test('🔴 无头 / AI 起课缺省「此刻」按起课地时区:北京 11:30;纽约(夏令时 -04:00)前一天 23:30;起课地 = 本机时区时与旧口径(本机钟面)相同', async ()=>{
		const bj = await buildSourceFromArgs({ kind: 'timepoint', gpsLat: 39.9, gpsLon: 116.4 });
		expect(bj.source.record.divTime).toBe('2026-09-18 11:30:00');
		expect(bj.source.record.zone).toBe('+08:00');
		expect(bj.assumptions).toContain('起课时间取当前 2026-09-18 11:30:00');
		const ny = await buildSourceFromArgs({ kind: 'timepoint', gpsLat: 40.71, gpsLon: -74.0 });
		expect(ny.source.record.zone).toBe('-04:00');
		expect(ny.source.record.divTime).toBe('2026-09-17 23:30:00');
		const z = sysOff();
		const same = await buildSourceFromArgs({ kind: 'timepoint', zone: z });
		const d = new Date();
		expect(same.source.record.divTime).toBe(`${sysToday()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`);
	});
});

// 页面构造期的缺省(要挂真组件才跑得到)按源码锁:各推运 / 返照 / 行运页的「此刻 / 今日 / 今年」都经单源,不再裸 new DateTime() / new Date() 配本盘时区
describe('页面与无头各处缺省都经单源(源码锁)', ()=>{
	const fs = require('fs');
	const path = require('path');
	const SRC = path.resolve(__dirname, '..', '..');
	const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
	const MUST = {
		'components/astro/AstroProfection.js': ['let now = DateTime.nowForChart(qryparam.zone);'],
		'components/astro/AstroSolarArc.js': ['datetime: DateTime.nowForChart(qryparam.zone),'],
		'components/astro/AstroPlanetaryArc.js': ['const dt = DateTime.nowForChart(np.zone);', "todayStr(chartObj.params ? chartObj.params.zone : '')"],
		'components/astro/AstroPersianDirected.js': ['const dt = DateTime.nowForChart(np.zone);'],
		'components/astro/AstroSolarReturn.js': ['returnPickerSeed(qryparam.birth, DateTime.nowForChart(qryparam.zone))', 'let datetime = DateTime.nowForChart(qryparam.zone);'],
		'components/astro/AstroLunarReturn.js': ['returnPickerSeed(qryparam.birth, DateTime.nowForChart(qryparam.zone))', 'let datetime = DateTime.nowForChart(qryparam.zone);'],
		'components/astro/AstroGivenYear.js': ['returnPickerSeed(qryparam.birth, DateTime.nowForChart(qryparam.zone))', 'let datetime = DateTime.nowForChart(qryparam.zone);'],
		'components/astro/AstroProgressions.js': ['targetDate: today(chartZone(props.value)),'],
		'components/astro/AstroVedicProgressions.js': ['targetDate: today(chartZone(props.value)),'],
		'components/astro/AstroJaynesProgressions.js': ['targetDate: today(chartZone(props.value)),', "trim() || today(chartZone(chartObj));"],
		'components/astro/astroProgSnapshot.js': ["trim() || today(chartZone(chartObj));"],
		'components/astro/AstroEphemeris.js': ["DateTime.wallClockForChart(props.value && props.value.params ? props.value.params.zone : '')", "defaultEphemerisWindow(chartObj.params ? chartObj.params.zone : '')"],
		'components/astro/AstroReturnTimeline.js': ["DateTime.wallClockForChart(props.value && props.value.params ? props.value.params.zone : '')", "startYear: DateTime.wallClockForChart(chartObj.params ? chartObj.params.zone : '').getFullYear()"],
		'components/astro/IndiaChart.js': ['localTodaySlash(params.zone)', 'DateTime.wallClockForChart(params.zone).getFullYear()'],
		'components/germany/UranianDialMain.js': ['DateTime.wallClockForChart(base.zone)'],
		'components/astro/AstroPrimaryDirectionChart.js': ["return DateTime.nowForChart(chartObj && chartObj.params ? chartObj.params.zone : '');"],
		'utils/aiAnalysisContext/primaryDirection.js': ['const dt = txt ? new DateTime() : DateTime.nowForChart(params.zone);'],
		'utils/aiAnalysisContext/regenPredictive.js': ["datetimeStr = DateTime.nowForChart(np.zone).format('YYYY-MM-DD HH:mm');", 'returnPickerSeed(np.birth, DateTime.nowForChart(np.zone))'],
		'utils/aiAnalysisContext/regenChart.js': ['DateTime.nowForChart(chartZoneOf(chartObj, record))', 'todayDateStr(chartZoneOf(chartObjP, record))'],
		'utils/aiTools/tools/castTechnique.js': ["divTime = DateTime.nowForChart(z.zone).format('YYYY-MM-DD HH:mm:ss');"],
		'utils/aiTools/tools/createCaseRecord.js': ["divTime = DateTime.nowForChart(z.zone).format('YYYY-MM-DD HH:mm:ss');"],
		'utils/astroAiSnapshot.js': ['const birthMs = birthInstantMsInZone(params.birth, params.zone);'],
	};
	test.each(Object.keys(MUST))('%s', (rel)=>{
		const src = read(rel);
		MUST[rel].forEach((a)=>expect(src).toContain(a));
	});
	test('旧形状不许回潮:推运页把东八区钟面当缺省目标 / 无头把东八区钟面配本盘时区', ()=>{
		expect(read('components/astro/AstroSolarArc.js')).not.toContain('datetime: new DateTime(),');
		expect(read('components/astro/AstroProfection.js')).not.toContain('let now = new DateTime();');
		expect(read('utils/aiAnalysisContext/regenPredictive.js')).not.toContain("datetimeStr = new DateTime().format(");
		expect(read('components/guolao/main/params.js')).not.toMatch(/const tm = new DateTime\(\);\s*if\(fields && fields\.zone && fields\.zone\.value\)\{\s*tm\.setZone/);
	});
});
