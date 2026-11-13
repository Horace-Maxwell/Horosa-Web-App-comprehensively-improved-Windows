// 「AI导出」分派全覆盖:导出技法表里的每个键,在 extractContentByKey 里都要有自己的取正文分支
// (或 extractGenericContent 里有它的分支、或属星盘系),否则该页导出恒报「当前页面没有可导出文本」。
// 曾经的缺口:东亚 / 诸方两个新子技法与八个择日内嵌宿主都没有分支 —— 登记、段表、挂载都齐,唯独导出取不到正文。
import { AI_EXPORT_TECHNIQUES } from '../aiExport/presets';
import { isAstroLikeExportKey } from '../aiExport/presets';
import { AI_EXPORT_SIMPLE_MODULE_KEYS, AI_EXPORT_ZERI_SCOPE_KEYS } from '../aiExport/pipeline';
import { isJieQiSplitSettingKey } from '../aiExport/settingsModel';

const path = require('path');
const { readSource, fnBody } = require('./helpers/sourceSet');

const PIPE = readSource(path.join(__dirname, '../aiExport/pipeline.js'));
const EXT = readSource(path.join(__dirname, '../aiExport/extractors.js'));
const DISPATCH = fnBody(PIPE, 'async function extractContentByKey');
const GENERIC = fnBody(EXT, 'export async function extractGenericContent');

const keysIn = (src, re)=>new Set([...`${src || ''}`.matchAll(re)].map((m)=>m[1]));

describe('AI导出分派 × 导出技法表', ()=>{
	it('两个函数体都截得到', ()=>{
		expect(DISPATCH).toBeTruthy();
		expect(GENERIC).toBeTruthy();
		expect(DISPATCH).toMatch(/AI_EXPORT_SIMPLE_MODULE_KEYS\.indexOf\(exportKey\)/);
		expect(DISPATCH).toMatch(/AI_EXPORT_ZERI_SCOPE_KEYS\.indexOf\(exportKey\)/);
		expect(DISPATCH).toMatch(/isJieQiSplitSettingKey\(exportKey\)/);
	});
	it('每个导出键都有取正文的分支', ()=>{
		const routed = keysIn(DISPATCH, /exportKey === '([^']+)'/g);
		AI_EXPORT_SIMPLE_MODULE_KEYS.forEach((k)=>routed.add(k));
		AI_EXPORT_ZERI_SCOPE_KEYS.forEach((k)=>routed.add(k));
		const generic = keysIn(GENERIC, /context\.key === '([^']+)'/g);
		const missing = AI_EXPORT_TECHNIQUES.map((t)=>t.key)
			.filter((k)=>k !== 'astrochart' && k !== 'indiachart' && !isAstroLikeExportKey(k) && !isJieQiSplitSettingKey(k))   // 星盘系 / 节气分键各有总分支
			.filter((k)=>!routed.has(k) && !generic.has(k));
		expect(missing).toEqual([]);
	});
	it('择日宿主键都在导出技法表里(表外的键分派了也用不上)', ()=>{
		const all = new Set(AI_EXPORT_TECHNIQUES.map((t)=>t.key));
		expect(AI_EXPORT_ZERI_SCOPE_KEYS.filter((k)=>!all.has(k))).toEqual([]);
	});
});
