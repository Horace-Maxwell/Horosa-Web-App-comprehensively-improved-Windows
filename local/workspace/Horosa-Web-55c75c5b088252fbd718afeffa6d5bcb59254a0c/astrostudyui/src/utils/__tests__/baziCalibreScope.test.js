// [Q-314 裁决 A 2026-09-18] 八字左栏口径分域:纯工具 + astro model reducer + 源码哨兵。
import { splitBaziCalibrePatch, applyBaziCalibreOverride, normalizeBaziCalibreOverride, recordPinsDayBoundary, BAZI_CALIBRE_KEYS } from '../baziCalibreScope';
import astroModel from '../../models/astro';

const F = { after23NewDay: { name: ['after23NewDay'], value: 1 }, lateZiHourUseNextDay: { name: ['lateZiHourUseNextDay'], value: 1 }, timeAlg: { name: ['timeAlg'], value: 0 }, date: { name: ['date'], value: 'x' } };

describe('baziCalibreScope 纯工具', ()=>{
	it('splitBaziCalibrePatch:三键拆到 calibre(裸整数),其余原形;字符串 / 布尔归一', ()=>{
		const r = splitBaziCalibrePatch({ after23NewDay: { value: '0' }, lateZiHourUseNextDay: { value: true }, timeAlg: { value: 2 }, date: { value: 'd' } });
		expect(r.calibre).toEqual({ after23NewDay: 0, lateZiHourUseNextDay: 1, timeAlg: 2 });
		expect(r.rest).toEqual({ date: { value: 'd' } });
		expect(splitBaziCalibrePatch({ date: { value: 'd' } }).calibre).toEqual({});
	});
	it('applyBaziCalibreOverride:无覆盖 / 同值 → 原对象;有差 → 新 entry 且共享 entry 不动', ()=>{
		expect(applyBaziCalibreOverride(F, {})).toBe(F);
		expect(applyBaziCalibreOverride(F, { after23NewDay: 1 })).toBe(F);
		const out = applyBaziCalibreOverride(F, { after23NewDay: 0, timeAlg: 1 });
		expect(out).not.toBe(F);
		expect(out.after23NewDay.value).toBe(0); expect(out.timeAlg.value).toBe(1); expect(out.lateZiHourUseNextDay).toBe(F.lateZiHourUseNextDay);
		expect(F.after23NewDay.value).toBe(1);
		expect(normalizeBaziCalibreOverride({ after23NewDay: 'x', timeAlg: '3', foo: 1 })).toEqual({ timeAlg: 3 });
	});
	it('recordPinsDayBoundary:任一键有值即钉住;空 / 缺 → 否', ()=>{
		expect(recordPinsDayBoundary({ after23NewDay: 0 })).toBe(true);
		expect(recordPinsDayBoundary({ timeAlg: '1' })).toBe(true);
		expect(recordPinsDayBoundary({ after23NewDay: '', lateZiHourUseNextDay: null })).toBe(false);
		expect(recordPinsDayBoundary(null)).toBe(false);
		expect(BAZI_CALIBRE_KEYS).toEqual(['after23NewDay', 'lateZiHourUseNextDay', 'timeAlg']);
	});
});

describe('astro model:覆盖层 reducer 与全局同步钉住', ()=>{
	const R = astroModel.reducers;
	it('setBaziCalibreOverride merge+归一;clear 清空(空时返回同对象)', ()=>{
		let st = { baziCalibreOverride: {} };
		st = R.setBaziCalibreOverride(st, { payload: { override: { after23NewDay: '0' } } });
		expect(st.baziCalibreOverride).toEqual({ after23NewDay: 0 });
		st = R.setBaziCalibreOverride(st, { payload: { override: { timeAlg: 2 } } });
		expect(st.baziCalibreOverride).toEqual({ after23NewDay: 0, timeAlg: 2 });
		const cleared = R.clearBaziCalibreOverride(st);
		expect(cleared.baziCalibreOverride).toEqual({});
		expect(R.clearBaziCalibreOverride(cleared)).toBe(cleared);
	});
	it('syncAfter23NewDay / syncLateZiHourMode:未钉住 → 共享层跟随全局;钉住(载入命盘自带口径)→ 不动', ()=>{
		const base = { fields: { after23NewDay: { value: 1 }, lateZiHourUseNextDay: { value: 1 } }, _dayBoundaryRecordPinned: false };
		expect(R.syncAfter23NewDay(base, { payload: { after23NewDay: 0 } }).fields.after23NewDay.value).toBe(0);
		expect(R.syncLateZiHourMode(base, { payload: { lateZiHourUseNextDay: 0 } }).fields.lateZiHourUseNextDay.value).toBe(0);
		const pinned = R.setDayBoundaryRecordPinned(base, { payload: { value: true } });
		expect(R.syncAfter23NewDay(pinned, { payload: { after23NewDay: 0 } })).toBe(pinned);
		expect(R.syncLateZiHourMode(pinned, { payload: { lateZiHourUseNextDay: 0 } })).toBe(pinned);
	});
	it('源码哨兵:八字页不再写旧全局锁;index 透传覆盖层;载入 / 新命盘复位 + 钉住', ()=>{
		const fs = require('fs'); const path = require('path');
		const bazi = fs.readFileSync(path.join(__dirname, '../../components/cntradition/BaZi.js'), 'utf8');
		expect(bazi).not.toMatch(/astro\/setAfter23BoundaryUserOverrode/);
		expect(bazi).toMatch(/astro\/setBaziCalibreOverride/);
		expect(bazi).toMatch(/fields=\{this\.effFields\(\)\}/);
		const index = fs.readFileSync(path.join(__dirname, '../../pages/index.js'), 'utf8');
		expect(index).toMatch(/baziCalibreOverride=\{baziCalibreOverride\}/);
		const model = fs.readFileSync(path.join(__dirname, '../../models/astro.js'), 'utf8');
		expect(model).toMatch(/_dayBoundaryRecordPinned: recordPinsDayBoundary\(values\)/);
		expect((model.match(/baziCalibreOverride: \{\},/g) || []).length).toBeGreaterThanOrEqual(3);
	});
});
