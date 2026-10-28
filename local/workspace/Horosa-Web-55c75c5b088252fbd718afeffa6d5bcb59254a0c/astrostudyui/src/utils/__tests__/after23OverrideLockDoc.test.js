// 共享层日界旧锁 _after23BoundaryUserOverrode:仍有写入者(金口诀 / 六壬 / 卦占左栏改日界时派发),
// 置位后全局日界改动不再同步共享 fields;模型里的说明须与此一致(不得写成「已无写入者」)。
import fs from 'fs';
import path from 'path';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const R = (f)=>readSource(path.resolve(__dirname, '../../', f));

describe('日界旧锁的说明与事实一致', ()=>{
	test('仍有页面派发置位', ()=>{
		['components/jinkou/JinKouMain.js', 'components/lrzhan/LiuRengMain.js', 'components/guazhan/GuaZhanMain.js'].forEach((f)=>{
			expect([f, R(f).includes("type: 'astro/setAfter23BoundaryUserOverrode'")]).toEqual([f, true]);
		});
	});

	test('置位后全局日界不再同步共享 fields', ()=>{
		const astro = require('../../models/astro').default;
		const base = { fields: { after23NewDay: { name: ['after23NewDay'], value: 1 } } };
		const locked = astro.reducers.setAfter23BoundaryUserOverrode(base, { payload: { value: true } });
		expect(astro.reducers.syncAfter23NewDay(locked, { payload: { after23NewDay: 0 } }).fields.after23NewDay.value).toBe(1);
		expect(astro.reducers.syncAfter23NewDay(base, { payload: { after23NewDay: 0 } }).fields.after23NewDay.value).toBe(0);
	});

	test('模型说明不再称「已无写入者」,并点名写入方', ()=>{
		const src = R('models/astro.js');
		expect(src).not.toMatch(/_after23BoundaryUserOverrode 旧锁保留兼容\(全仓已无写入者\)/);
		expect(src).toMatch(/_after23BoundaryUserOverrode 旧锁仍有写入者/);
		expect(src).toMatch(/金口诀 \/ 六壬 \/ 卦占左栏改日界时置位/);
	});
});
