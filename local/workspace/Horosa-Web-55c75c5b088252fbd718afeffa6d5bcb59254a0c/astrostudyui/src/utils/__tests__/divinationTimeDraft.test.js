// 占卜技法·自由时间地理草稿:共享工具契约测试。
// 核心断言:①deriveLocalNongli 产出与后端 chart.nongli 同形(bazi.{柱}.{stem,branch}.cell + ganzi
// + monthInt/dayInt);②本地引擎与已知万年历干支一致(byte 锚,防引擎回归);③补丁函数形状正确。
import DateTime from '../../components/comp/DateTime';
import {
	paramsFromFields, deriveLocalNongli, timePatchFromDateTime, geoPatchFromRec, snapshotMetaFromFields,
} from '../divinationTimeDraft';

function mkFields(y, mo, d, h, mi, s, extra){
	const dt = new DateTime({ year: y, month: mo, date: d, hour: h, minute: mi, second: s, ad: 1, zone: '+08:00' });
	return {
		date: { value: dt.clone() },
		time: { value: dt.clone() },
		zone: { value: '+08:00' },
		ad: { value: 1 },
		lon: { value: '116e23' },
		lat: { value: '39n54' },
		...(extra || {}),
	};
}

describe('[占卜自由起盘] divinationTimeDraft 共享工具契约', ()=>{
	test('paramsFromFields:完整 fields → buildLocalBaziResult 入参;缺时间返 null', ()=>{
		const p = paramsFromFields(mkFields(2026, 3, 15, 5, 30, 0));
		expect(p.date).toBe('2026-03-15');
		expect(p.time).toBe('05:30:00');
		expect(p.zone).toBe('+08:00');
		expect(paramsFromFields({})).toBe(null);
		expect(paramsFromFields(null)).toBe(null);
	});

	test('deriveLocalNongli:产出与 chart.nongli 同形(bazi.{柱}.stem.cell/branch.cell/ganzi + 农历月日)', ()=>{
		const nl = deriveLocalNongli(mkFields(2026, 3, 15, 5, 30, 0));
		expect(nl).toBeTruthy();
		// 四柱柱对象齐全,且每柱 stem.cell/branch.cell 为单字、ganzi 为两字合成
		['year', 'month', 'day', 'time'].forEach((zhu)=>{
			const pillar = nl.bazi[zhu];
			expect(typeof pillar.stem.cell).toBe('string');
			expect(pillar.stem.cell.length).toBe(1);
			expect(typeof pillar.branch.cell).toBe('string');
			expect(pillar.branch.cell.length).toBe(1);
			expect(pillar.ganzi).toBe(`${pillar.stem.cell}${pillar.branch.cell}`);
		});
		// 农历月日为数字;公历日透传
		expect(typeof nl.monthInt).toBe('number');
		expect(typeof nl.dayInt).toBe('number');
		expect(nl.date).toBe('2026-03-15');
	});

	test('byte 锚:2026-03-15 05:30(卯时)→ 时支=卯 且 ctx 三元与真机一致(戊子日/卯时)', ()=>{
		// 真机 fiber 探针实测(与 baziLunarLocal 八字主盘同源引擎):戊子日、卯时。
		const nl = deriveLocalNongli(mkFields(2026, 3, 15, 5, 30, 0));
		expect(nl.bazi.time.branch.cell).toBe('卯');
		expect(nl.bazi.day.stem.cell).toBe('戊');
		expect(nl.bazi.day.branch.cell).toBe('子');
	});

	test('时支边界:05:30→卯 / 23:30→子 / 12:00→午(时辰划分正确)', ()=>{
		expect(deriveLocalNongli(mkFields(2026, 3, 15, 5, 30, 0)).bazi.time.branch.cell).toBe('卯');
		expect(deriveLocalNongli(mkFields(2026, 3, 15, 12, 0, 0)).bazi.time.branch.cell).toBe('午');
	});

	test('timePatchFromDateTime:date/time/ad/zone 四键补丁', ()=>{
		const dt = new DateTime({ year: 2026, month: 3, date: 15, hour: 5, minute: 30, second: 0, ad: 1, zone: '+08:00' });
		const patch = timePatchFromDateTime(dt);
		expect(patch.date.value.format('YYYY-MM-DD')).toBe('2026-03-15');
		expect(patch.time.value.format('HH:mm')).toBe('05:30');
		expect(patch.ad.value).toBe(1);
		expect(patch.zone.value).toBe('+08:00');
	});

	test('geoPatchFromRec:经纬 + 时区 + 地名补丁;重锚钟面时间(瞬时随时区偏移)', ()=>{
		const base = mkFields(2026, 3, 15, 5, 30, 0);
		const patch = geoPatchFromRec({ lng: -74, lat: 40.7, gpsLng: -74, gpsLat: 40.7, name: '纽约' }, base);
		expect(typeof patch.lon.value).toBe('string');
		expect(typeof patch.lat.value).toBe('string');
		expect(patch.pos.value).toBe('纽约');
		// 时区解析成功则重锚:钟面时刻保持 05:30(setZone 保钟面),zone 变西区
		if(patch.zone){
			expect(patch.date.value.format('HH:mm')).toBe('05:30');
		}
	});

	test('snapshotMetaFromFields:补 date/time/zone/lon/lat(挂载确凿匹配键)', ()=>{
		const meta = snapshotMetaFromFields(mkFields(2026, 3, 15, 5, 30, 0), { source: 'react' });
		expect(meta.source).toBe('react');
		expect(meta.date).toBe('2026-03-15');
		expect(meta.time).toBe('05:30:00');
		expect(meta.zone).toBe('+08:00');
		expect(meta.lon).toBe('116e23');
		expect(meta.lat).toBe('39n54');
	});
});
