// 命盘 / 事盘列表的接线合同(读源码):两列表同一口径
//  · 批量删除确认框用 batchRemoveConfirmTitle(超出回收站上限写明转入删除日志),打开时取回收站现有条数
//  · 单库 JSON 导入:确认后先落风险前自动备份再导入;确认文字写明同一 ID 谁胜
//  · 彻底删除 / 清空回收站没做成如实报错
//  · 全量恢复走单源流程(失败列中文名)
//  · 删除日志面板列出本库每一条;存储写满时删掉却没留底的如实提示;单库导入不带回本机之后删掉的;名人库补丁只合并补丁条目
import fs from 'fs';
import path from 'path';

const read = (f)=>fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'user', f), 'utf8');
const { jsxNodes } = require('./helpers/jsxProps');
const sliceFn = (src, name)=>{
	const i = src.indexOf(`\t${name}(`);
	expect(i).toBeGreaterThan(0);
	const j = src.indexOf('\n\t}\n', i);
	return src.slice(i, j);
};

describe.each([
	['ChartList.js', 'Charts', 'Chart'],
	['CaseList.js', 'Cases', 'Case'],
])('%s', (file, plural, single)=>{
	const src = read(file);

	test('批量删除确认框写明超出回收站上限的去向', ()=>{
		const want = `batchRemoveConfirmTitle(this.state.selectedKeys.length, this.state.batchRemoveTrashLive, LOCAL_${plural.toUpperCase()}_TRASH_CAP, this.state.batchRemoveLogCount, DELETED_LOG_CAP)`;
		const pops = jsxNodes(src, 'Popconfirm').filter((e)=>e.attrs.title === want);
		expect(pops.length).toBe(1);
		expect(pops[0].attrs.onOpenChange).toBeTruthy();   // 打开时取回收站现有条数
		expect(src).toContain(`countLocal${plural}LiveTrash()`);
		expect(src).toContain('countDeletedLogEntries()');
		expect(src).not.toContain('条移入回收站？（可恢复）`} onConfirm');
	});

	test('单库导入:先风险前自动备份再导入;确认文字用 recordImportConfirmText', ()=>{
		const fn = sliceFn(src, 'onImportLocalFileChange');
		const backup = fn.indexOf("runAutoBackupOnce({ trigger: 'pre-risk' })");
		const imp = fn.indexOf(`importLocal${plural}Backup(`);
		expect(backup).toBeGreaterThan(0);
		expect(imp).toBeGreaterThan(backup);
		expect(fn).toContain('recordImportConfirmText(');
		expect(fn).not.toContain('合并覆盖=同 ID 记录按字段合并');
	});

	test('彻底删除 / 清空回收站没做成如实报错', ()=>{
		expect(sliceFn(src, 'clickPurgeTrash')).toContain(`purgeLocal${single}TrashItem(rec.cid) === false`);
		expect(sliceFn(src, 'clickClearTrash')).toContain('if(n < 0)');
	});

	test('删除日志用面板列出本库每一条(不再只取最近 8 条);彻底删除 / 清空的确认不再写「只能找回最近的几条」', ()=>{
		expect(src).toContain(`<DeletedLogPanel\n\t\t\t\t\t\tstore='${single.toLowerCase()}'`);
		expect(src).toContain(`restoreLocal${single}FromDeletedLog(e)`);
		expect(src).not.toMatch(/e\.store === '(chart|case)' && e\.record\)\.slice\(0, 8\)/);
		expect(src).not.toContain('找回最近的几条');
	});

	test('批量删除:删掉却没留底的(存储写满)如实提示;单库导入:本机之后删掉的不带回', ()=>{
		const rm = sliceFn(src, 'clickBatchRemove');
		expect(rm).toContain('w.unkept');
		expect(rm).toContain('batchRemoveUnkeptNote(unkept)');
		const fn = sliceFn(src, 'onImportLocalFileChange');
		expect(fn).toContain('respectLocalDeletions: true');
		expect(fn).toContain(`previewLocal${plural}Backup(`);
		expect(fn).toMatch(new RegExp(`importLocal${plural}Backup\\([^)]*recordOpts\\)`));
	});
});

test('命盘列表导入名人库 JSON:只有补丁条目按字段合并(mergeCids),同一文件里的普通条目照旧较新者胜', ()=>{
	const fn = sliceFn(read('ChartList.js'), 'onImportLocalFileChange');
	expect(fn).toContain('importOpts.mergeCids = ');
	expect(fn).toContain('!original.has(c)');
	expect(fn).toContain('const recordOpts = importOpts || { respectLocalDeletions: true };');
});

test('全量恢复走单源流程', ()=>{
	const src = read('ChartList.js');
	expect(sliceFn(src, 'async runUnifiedRestore')).toContain('runUnifiedRestoreFlow(');
	expect(src).not.toContain("bad.map((r)=>r.key).join('、')");
});
