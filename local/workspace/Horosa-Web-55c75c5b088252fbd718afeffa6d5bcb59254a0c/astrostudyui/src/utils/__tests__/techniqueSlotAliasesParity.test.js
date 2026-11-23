// 技法槽名别名表四路同一张:导出(aiExport.getModuleAliasList)与挂载 / 存案等读盘方(aiAnalysisContext.getTechniqueAliasList)
// 对全部技法键给出同一个别名集合;几门技法轮流覆盖的共用槽不许出现在任何别名展开里;导出刷新按整张别名表请页面重存。
import fs from 'fs';
import path from 'path';
import { getModuleAliasList, AI_EXPORT_PRESET_SECTIONS } from '../aiExport';
import { getTechniqueAliasList } from '../aiAnalysisContext';
import { getTechniqueSnapshotFromCache } from '../aiAnalysisContext/snapshotMatch';
import { saveModuleAISnapshot, clearModuleAISnapshot } from '../moduleAiSnapshot';
import { SHARED_SNAPSHOT_SLOTS, TECHNIQUE_SLOT_GROUPS, TECHNIQUE_SLOT_FAMILIES, KINASTRO_SERVICE_KEYS } from '../techniqueSlotAliases';

const allKeys = ()=>{
	const s = new Set(Object.keys(AI_EXPORT_PRESET_SECTIONS));
	TECHNIQUE_SLOT_GROUPS.forEach((g)=>g.forEach((k)=>s.add(k)));
	TECHNIQUE_SLOT_FAMILIES.forEach((f)=>{ s.add(f.parent); f.children.forEach((k)=>s.add(k)); });
	KINASTRO_SERVICE_KEYS.forEach((k)=>{ s.add(k); s.add(`kinastro-${k}`); });
	['shusuan', 'mingother', 'yanqin', 'jieqichart', 'indiachart_x', 'jieqi_x'].forEach((k)=>s.add(k));
	return Array.from(s);
};

describe('技法槽名别名表四路同源', ()=>{
	it('🔴 两侧对全部技法键给出同一个别名集合(同序)', ()=>{
		const diff = allKeys().filter((k)=>JSON.stringify(getModuleAliasList(k)) !== JSON.stringify(getTechniqueAliasList(k)));
		expect(diff).toEqual([]);
	});
	it('🔴 共用槽不出现在任何别名展开里(问它本身除外)', ()=>{
		const bad = [];
		allKeys().forEach((k)=>{ getTechniqueAliasList(k).forEach((a)=>{ if(a !== k && SHARED_SNAPSHOT_SLOTS.indexOf(a) >= 0){ bad.push(`${k}→${a}`); } }); });
		expect(bad).toEqual([]);
	});
	it('所问的名排第一;同组任一名展开成整组;母键展开到子槽、子槽不串兄弟', ()=>{
		expect(getTechniqueAliasList('guazhan')).toEqual(['guazhan', 'sixyao', 'liuyao']);
		expect(getTechniqueAliasList('sixyao')).toEqual(['sixyao', 'guazhan', 'liuyao']);
		expect(getTechniqueAliasList('primarydirect')).toEqual(['primarydirect', 'direction']);
		expect(getTechniqueAliasList('direction')).toEqual(['direction', 'primarydirect']);
		expect(getTechniqueAliasList('jieqi_current')).toEqual(['jieqi_current', 'jieqi']);
		expect(getTechniqueAliasList('jieqi_chunfen')).toEqual(['jieqi_chunfen', 'jieqi', 'jieqi_current']);
		expect(getTechniqueAliasList('calendar-huangli')).toEqual(['calendar-huangli']);
		expect(getTechniqueAliasList('calendar')).toEqual(['calendar', 'calendar-huangli', 'calendar-tongshu', 'calendar-rizi']);
		expect(getTechniqueAliasList('xianqin')).toEqual(['xianqin', 'kinastro-xianqin']);
		expect(getTechniqueAliasList('kinastro-shaozi')).toEqual(['kinastro-shaozi', 'shaozi']);
	});
	it('🔴 主限法(表格)与主限法盘不互为别名:只存了表格的槽时,问主限法盘拿不到表格的正文(反之亦然)', ()=>{
		expect(getTechniqueAliasList('primarydirchart')).toEqual(['primarydirchart']);
		expect(getTechniqueAliasList('primarydirect')).not.toContain('primarydirchart');
		const meta = { date: '1990-01-01', time: '12:00', zone: '+08:00', lon: '116e24', lat: '39n54' };
		const source = { sourceType: 'chart', record: { birth: '1990-01-01 12:00:00', zone: '+08:00', lon: '116e24', lat: '39n54' } };
		const wipe = ()=>['primarydirect', 'primarydirchart', 'direction'].forEach((k)=>clearModuleAISnapshot(k));
		wipe();
		saveModuleAISnapshot('primarydirect', '[主限法表格]\n| Arc | 迫星 | 应星 | 日期 |', meta);
		const table = getTechniqueSnapshotFromCache('primarydirect', source);
		expect(table && table.content).toMatch(/主限法表格/);                    // 表格自己读得到(签名认得出这位命主)
		expect(getTechniqueSnapshotFromCache('direction', source).content).toMatch(/主限法表格/);   // 旧槽名仍指表格
		expect(getTechniqueSnapshotFromCache('primarydirchart', source)).toBe(null);
		wipe();
		saveModuleAISnapshot('primarydirchart', '[主限法盘设置]\n当前Arc：0度0分', meta);
		expect(getTechniqueSnapshotFromCache('primarydirchart', source).content).toMatch(/主限法盘设置/);
		expect(getTechniqueSnapshotFromCache('primarydirect', source)).toBe(null);
		wipe();
	});
	it('🔴 导出刷新按整张别名表请页面重存(与挂载 refreshModuleSnapshotSlots 同一张表)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../aiExport/settingsModel.js'), 'utf8');
		const body = src.slice(src.indexOf('export async function requestModuleSnapshotRefresh('));
		expect(body.slice(0, 1200)).toMatch(/getTechniqueAliasList\(moduleName\)\.forEach/);
		// 导出那张别名表不许再自己写一份
		const lookup = fs.readFileSync(path.join(__dirname, '../aiExport/snapshotLookup.js'), 'utf8');
		expect(lookup).not.toMatch(/set\.add\('shusuan'\)|set\.add\('mingother'\)/);
		expect(lookup).toMatch(/return getTechniqueAliasList\(moduleName\);/);
	});
});
