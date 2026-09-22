// [挂载自检 F-15·P1] 紫微页 /ziwei/birth 构参:日界/晚子时读记录 fields(与八字页/AI 挂载同口径),缺席回退全局。
// 判别向量:构参改回恒读全局即第 1 例红。
import { buildZiweiBirthParams } from '../../components/ziwei/ZiWeiMain';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../dayBoundary';

const base = ()=>({
	date: { value: { format: (f)=>(f === 'YYYY-MM-DD' ? '1990-05-18' : '10:00:00'), ad: 1 } },
	time: { value: { format: ()=>'23:30:00' } },
	ad: { value: 1 }, zone: { value: '+08:00' }, lon: { value: '118e27' }, lat: { value: '31n38' },
	gpsLat: { value: 31.63 }, gpsLon: { value: 118.45 }, gender: { value: 1 }, timeAlg: { value: 0 },
});

it('🔴 记录带非默认日界键 → 请求体按记录(不再恒读全局)', ()=>{
	const p = buildZiweiBirthParams({ ...base(), after23NewDay: { value: 0 }, lateZiHourUseNextDay: { value: 0 } });
	expect(p.after23NewDay).toBe(0);
	expect(p.lateZiHourUseNextDay).toBe(0);
});

it('记录缺键/空串 → 回退全局默认(=现状零回归)', ()=>{
	const p = buildZiweiBirthParams(base());
	expect(p.after23NewDay).toBe(defaultAfter23NewDay());
	expect(p.lateZiHourUseNextDay).toBe(defaultLateZiHourUseNextDay());
	const q = buildZiweiBirthParams({ ...base(), after23NewDay: { value: '' }, lateZiHourUseNextDay: { value: null } });
	expect(q.after23NewDay).toBe(defaultAfter23NewDay());
	expect(q.lateZiHourUseNextDay).toBe(defaultLateZiHourUseNextDay());
});
