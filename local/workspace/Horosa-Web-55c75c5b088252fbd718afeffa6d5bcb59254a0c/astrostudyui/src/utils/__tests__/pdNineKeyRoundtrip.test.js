// B4 存↔载 round-trip:九键成对(含空数组=显式全清语义)
import { buildLocalChartRecord } from '../localcharts';
import { applyRecordToFields } from '../recordFieldsRestore';

describe('B4 主限法九键 存↔载 round-trip', ()=>{
	const NINE = {
		pdProjection: 'regiomontanus', pdFrame: 'wholesign', pdFramework: 'aspect',
		pdParallel: 1, pdRaptParallel: 1, pdTimeKeyCustom: 2.25,
		pdSignificators: ['Desc', 'Syzygy', 'Cusps'], pdPromissorTypes: ['cusps', 'stars'],
		termsVariant: 2,
	};
	it('非默认九键存盘后逐键可载回', ()=>{
		const rec = buildLocalChartRecord({ name: 'b4', date: '1990/03/15', time: '12:30:00',
			zone: '+08:00', lat: '39N54', lon: '116E28', ...NINE });
		Object.keys(NINE).forEach((k)=>{
			expect([k, rec[k]]).toEqual([k, NINE[k]]);
		});
		const fields = applyRecordToFields({}, rec);
		Object.keys(NINE).forEach((k)=>{
			if(fields[k] !== undefined){
				expect([k, fields[k].value !== undefined ? fields[k].value : fields[k]]).toEqual([k, NINE[k]]);
			}
		});
	});
	it('空数组=显式全清:存盘不写、载回不残留旧勾选', ()=>{
		const rec = buildLocalChartRecord({ name: 'b4b', date: '1990/03/15', time: '12:30:00',
			zone: '+08:00', lat: '39N54', lon: '116E28',
			pdSignificators: [], pdPromissorTypes: [] });
		expect(rec.pdSignificators).toBeUndefined();
		expect(rec.pdPromissorTypes).toBeUndefined();
	});
});
