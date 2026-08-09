// [八字死开关审计 L1 金标 · 2026-08-08] 起盘键逐档定向锚(探索轮 120 固定种子样本已全谱定谳,
// 此处收敛为每档已证差异样本的轻量锚——探索轮结论:gender/timeAlg/godKeyPos/minggong/fenye/cang/
// dayunPrecision 全档 ~120/120;phaseType=1 23/120(土日主面);晚子时定向 23:30 40/40;
// phaseType=0↔2 修前 0/120=死档对(修后 63/120),细粒度锚在 baziSelfZuo.test.js)。
// 🔴 gender=-1 契约:未知恒=男(大运顺逆需性别择一,通行默认男;UI 已标「未知(按男排)」+title)。
import { buildLocalBaziResult } from '../../../utils/baziLunarLocal';

const BASE = {
	date: '1988-06-15', time: '12:30:00', ad: 1, zone: '+08:00', lon: '119e19', lat: '26n04',
	gpsLon: 119.3, gpsLat: 26.08, gender: 1, timeAlg: 0, phaseType: 0, godKeyPos: '年',
	after23NewDay: 0, lateZiHourUseNextDay: 1, adjustJieqi: 0,
	minggongMethod: 'tongxing', fenyeVersion: 'common', cangVersion: 'common', dayunPrecision: 'precise',
};
const S = (o)=>JSON.stringify(o);
const build = (over)=>S(buildLocalBaziResult({ ...BASE, ...over }));

describe('[L1] 八字起盘键逐档定向锚', ()=>{
	const base = build({});
	test('🔴 性别/时间算法/神煞查法/命宫/分野/藏干/起运精度:逐档必变', ()=>{
		expect(build({ gender: 0 })).not.toBe(base);
		expect(build({ timeAlg: 3 })).not.toBe(base);
		expect(build({ timeAlg: 1 })).not.toBe(base);
		expect(build({ timeAlg: 2 })).not.toBe(base);
		expect(build({ godKeyPos: '日' })).not.toBe(base);
		expect(build({ godKeyPos: '年日' })).not.toBe(base);
		expect(build({ minggongMethod: 'shufa' })).not.toBe(base);
		expect(build({ fenyeVersion: 'fajue' })).not.toBe(base);
		expect(build({ cangVersion: 'fenye' })).not.toBe(base);
		expect(build({ dayunPrecision: 'integer' })).not.toBe(base);
	});
	test('🔴 gender=-1 契约:未知恒=男(结构性同值=设计语义,非死开关;UI 已说明)', ()=>{
		expect(build({ gender: -1 })).toBe(base);
	});
	test('🔴 长生 phaseType:土日主盘(2000-01-01 戊午日)档1 必变;阴干日主盘(乙丑日)档0↔档2 必变(修前死档对)', ()=>{
		const earth = { date: '2000-01-01', time: '12:00:00' };
		expect(build({ ...earth, phaseType: 1 })).not.toBe(build({ ...earth, phaseType: 0 }));
		const yin = { date: '2024-01-02', time: '12:00:00' };
		expect(build({ ...yin, phaseType: 0 })).not.toBe(build({ ...yin, phaseType: 2 }));
	});
	test('🔴 晚子时三态:23:30 定向盘三态两两必变;正午盘三态恒等(数据依赖,非死)', ()=>{
		const late = { time: '23:30:00' };
		const yezi = build({ ...late });                                          // 0/1 夜子时
		const zichu = build({ ...late, after23NewDay: 1, lateZiHourUseNextDay: 1 });
		const zizheng = build({ ...late, after23NewDay: 0, lateZiHourUseNextDay: 0 });
		expect(zichu).not.toBe(yezi);
		expect(zizheng).not.toBe(yezi);
		expect(zichu).not.toBe(zizheng);
		expect(build({ after23NewDay: 1 })).toBe(base);                           // 正午:三态无载荷
	});
});
