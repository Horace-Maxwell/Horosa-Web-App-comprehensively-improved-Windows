// 起运精度「整数·取整岁」:按三日折一岁折出的年月日就近取整。不足半年(就近取整得 0)写「出生后不足1年起运」,
// 不写「约0年」(命理通行不这么说),也不硬记「约1年」(此前 Math.max(1, …),与帮助「就近取整」不符)。
import fs from 'fs';
import path from 'path';
import { buildLocalBaziResult } from '../baziLunarLocal';

const P = { time: '12:00:00', zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9,
	timeAlg: 1, after23NewDay: 1, lateZiHourUseNextDay: 1, phaseType: 0, godKeyPos: '年', adjustJieqi: 0 };
const info = (date, gender, precision)=>buildLocalBaziResult({ ...P, date, gender, ...(precision ? { dayunPrecision: precision } : {}) }).bazi.directInfo;
const spanYears = (text)=>{
	const m = /出生后(\d+)年(\d+)个月(\d+)天/.exec(text);
	return m ? Number(m[1]) + Number(m[2]) / 12 + Number(m[3]) / 365 : NaN;
};

describe('起运整数档 = 精确档就近取整', ()=>{
	const samples = [];
	['1990-02-04', '1990-02-05', '1990-02-08', '1990-02-12', '1990-02-20', '1990-03-01', '1990-03-07', '1990-04-06', '1990-05-18', '1990-07-05'].forEach((d)=>{
		[0, 1].forEach((g)=>samples.push([d, g]));
	});
	test.each(samples)('%s 性别 %s', (date, gender)=>{
		const precise = info(date, gender);
		const integer = info(date, gender, 'integer');
		const n = Math.round(spanYears(precise));
		expect(Number.isFinite(n)).toBe(true);
		expect(integer).toBe(n < 1 ? '出生后不足1年起运' : `出生后约${n}年起运`);
	});
	test('样本里确有不足半年的盘(覆盖边界)', ()=>{
		expect(samples.some(([d, g])=>info(d, g, 'integer') === '出生后不足1年起运')).toBe(true);
		expect(samples.some(([d, g])=>/约\d+年/.test(info(d, g, 'integer')))).toBe(true);
	});
	test('帮助文案写明不足半年的写法', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../components/help/BaziHelpDoc.js'), 'utf8');
		expect(src).toMatch(/就近取整；不足半年时写「出生后不足 1 年起运」/);
	});
});
