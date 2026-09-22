// [Q-060/AW-18/AW-23] 资料导入白名单与抽取上限的机械合同:
//  ① 前端白名单与桌面壳 `AI_ANALYSIS_IMPORT_EXTENSIONS` **逐字同集**(两条导入路径此前入库结果不同:
//     壳层按扩展名过滤,前端没有白名单 → 拖一张 PNG 进来就是一份类型 txt、摘要乱码的资料);
//  ② 30MB 抽取上限与后端 `MAX_DECODED_BYTES` 同值,且只对走后端抽取的 pdf/doc/docx 生效;
//  ③ extractMeta 的两种截断(PDF 页数封顶 / 正文字数封顶)都要能说成人话。
import fs from 'fs';
import path from 'path';
import {
	MATERIAL_IMPORT_EXTENSIONS,
	MATERIAL_ACCEPT_ATTR,
	MATERIAL_BACKEND_MAX_BYTES,
	isSupportedMaterialFile,
	needsBackendExtract,
	oversizeForBackend,
	describeExtractTruncation,
} from '../aiAnalysisMaterial';

const mk = (name, size)=>({ name, size: size || 1 });

it('🔴 白名单与桌面壳、后端上限三方同源', ()=>{
	// horosa_win_shell_const_v1(Windows 侧移植适配):Windows 壳是 Electron,同名白名单常量住在
	// desktop_installer_bundle/electron/desktop-bridge.js(`AI_ANALYSIS_IMPORT_EXTENSIONS = ["txt", …]`,与 Tauri main.rs 同一正则形);
	// Tauri main.rs 缺席时读它。判据零放宽:壳层白名单仍必须与前端白名单逐字同集。
	const mainRsPath = path.resolve(__dirname, '../../../../../Horosa_Desktop_Installer/src-tauri/src/main.rs');
	const electronBridgePath = path.resolve(__dirname, '../../../../../../../desktop_installer_bundle/electron/desktop-bridge.js');
	const mainRs = fs.readFileSync(fs.existsSync(mainRsPath) ? mainRsPath : electronBridgePath, 'utf8');
	const m = /AI_ANALYSIS_IMPORT_EXTENSIONS[^=]*=\s*\[([^\]]*)\]/.exec(mainRs);
	expect(m).toBeTruthy();
	const shell = m[1].split(',').map((s)=>s.trim().replace(/^"|"$/g, '')).filter(Boolean);
	expect(MATERIAL_IMPORT_EXTENSIONS.slice().sort()).toEqual(shell.slice().sort());

	const javaSrc = fs.readFileSync(path.resolve(__dirname, '../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/service/AIAnalysisMaterialService.java'), 'utf8');
	const mb = /MAX_DECODED_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/.exec(javaSrc);
	expect(mb).toBeTruthy();
	expect(MATERIAL_BACKEND_MAX_BYTES).toBe(Number(mb[1]) * 1024 * 1024);
});

it('🔴 只收白名单内的扩展名(无后缀 / 图片 / 系统文件一律拒)', ()=>{
	['a.txt', 'b.MD', 'c.markdown', 'd.doc', 'e.DOCX', 'f.pdf'].forEach((n)=>expect(isSupportedMaterialFile(mk(n))).toBe(true));
	['g.png', 'h.jpg', '.DS_Store', 'noext', 'i.txt.exe', 'j.zip'].forEach((n)=>expect(isSupportedMaterialFile(mk(n))).toBe(false));
	expect(MATERIAL_ACCEPT_ATTR).toBe('.txt,.md,.markdown,.doc,.docx,.pdf');
});

it('🔴 30MB 上限只拦走后端抽取的类型(txt/md 本地解析,不受它约束)', ()=>{
	const big = MATERIAL_BACKEND_MAX_BYTES + 1;
	expect(needsBackendExtract(mk('a.pdf'))).toBe(true);
	expect(needsBackendExtract(mk('a.txt'))).toBe(false);
	expect(oversizeForBackend(mk('a.pdf', big))).toBe(true);
	expect(oversizeForBackend(mk('a.docx', big))).toBe(true);
	expect(oversizeForBackend(mk('a.pdf', MATERIAL_BACKEND_MAX_BYTES))).toBe(false);   // 恰等于上限不拦
	expect(oversizeForBackend(mk('a.txt', big))).toBe(false);                          // 判别向量:本地解析类型不受此限
});

it('🔴 两种截断各自说清楚;没截断回空串', ()=>{
	expect(describeExtractTruncation(null)).toBe('');
	expect(describeExtractTruncation({ extractor: 'pdfbox', pageCount: 12 })).toBe('');
	expect(describeExtractTruncation({ pagesTruncated: true, pageCap: 500, pageCount: 1200 })).toBe('已截断:只抽了前 500 页(原文 1200 页)');
	expect(describeExtractTruncation({ truncated: true, textCap: 2000000 })).toBe('已截断:正文按 2,000,000 字封顶');
	expect(describeExtractTruncation({ pagesTruncated: true, pageCap: 500, pageCount: 1200, truncated: true, textCap: 2000000 }))
		.toBe('已截断:只抽了前 500 页(原文 1200 页) · 正文按 2,000,000 字封顶');
});
