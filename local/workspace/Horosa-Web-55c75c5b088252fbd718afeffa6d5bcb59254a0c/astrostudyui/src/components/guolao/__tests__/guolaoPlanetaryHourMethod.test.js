// 七政「报时星」与全局「行星时制式」:非缺省制式(昼夜不等时 / 廿四时等分)时七政构参(页面与挂载同一函数)带 planetaryHourMethod、
// 进缓存键、快照注明制式;缺省(日出起算)时请求体不带这个键(零回归),左栏「报时星」置灰(三档结果相同)。
import fs from 'fs';
import path from 'path';
import astroModel from '../../../models/astro';
import { __guolaoFieldsToParamsForTest as fieldsToParams } from '../GuoLaoChartMain';
import { guolaoPlanetaryHourMethod } from '../main/params';
import { buildGuolaoKey } from '../main/chartCache';
import { setClassicalChartGlobal } from '../../../utils/classicalChartGlobals';

function baseFields(extra){
	const f = {}; Object.keys(astroModel.state.fields).forEach((k)=>{ f[k] = { ...astroModel.state.fields[k] }; });
	const moment = require('moment');
	const mk = ()=>Object.assign(moment('1990-05-18 10:00:00', 'YYYY-MM-DD HH:mm:ss'), { zone: '+08:00', ad: 1 });
	f.date = { ...f.date, value: mk() }; f.time = { ...f.time, value: mk() }; f.zone = { ...f.zone, value: '+08:00' };
	f.lon = { ...(f.lon || {}), value: '87e36' }; f.lat = { ...(f.lat || {}), value: '43n48' };
	Object.keys(extra || {}).forEach((k)=>{ f[k] = { ...(f[k] || { name: [k] }), value: extra[k] }; });
	return f;
}

afterEach(()=>{ setClassicalChartGlobal('planetaryHourMethod', 'sunrise'); });

describe('七政 · 行星时制式透传', ()=>{
	it('缺省制式:请求体不带 planetaryHourMethod(零回归)', ()=>{
		const p = fieldsToParams(baseFields());
		expect(p.planetaryHourMethod).toBeUndefined();
		expect(guolaoPlanetaryHourMethod(baseFields())).toBe('sunrise');
	});
	it('全局制式非缺省:请求体带它;随盘存过的以盘为准', ()=>{
		setClassicalChartGlobal('planetaryHourMethod', 'equal24');
		expect(fieldsToParams(baseFields()).planetaryHourMethod).toBe('equal24');
		expect(fieldsToParams(baseFields({ planetaryHourMethod: 'unequal' })).planetaryHourMethod).toBe('unequal');
		expect(fieldsToParams(baseFields({ planetaryHourMethod: 'sunrise' })).planetaryHourMethod).toBeUndefined();
	});
	it('缓存键区分制式(否则切制式命中旧报时星)', ()=>{
		const a = buildGuolaoKey(fieldsToParams(baseFields()));
		const b = buildGuolaoKey(fieldsToParams(baseFields({ planetaryHourMethod: 'equal24' })));
		expect(a).not.toBe(b);
		expect(buildGuolaoKey(fieldsToParams(baseFields({ planetaryHourMethod: 'sunrise' })))).toBe(a);
	});
	it('左栏「报时星」在缺省制式下置灰;快照写明制式', ()=>{
		const input = fs.readFileSync(path.resolve(__dirname, '../GuoLaoInput.js'), 'utf8');
		expect(input).toMatch(/disabled=\{guolaoPlanetaryHourMethod\(fields\) === 'sunrise'\}/);
		const snap = fs.readFileSync(path.resolve(__dirname, '../main/snapshot.js'), 'utf8');
		expect(snap).toMatch(/行星时制式:\$\{_gHm\}|行星时制式：\$\{_gHm\}/);
	});
});
