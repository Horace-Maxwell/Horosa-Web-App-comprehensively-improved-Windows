// AI 导出 [图例](D47):此前是「全家桶死开关」——偏好归一/判定/拼装调用都在,注册表空、无勾选、缺省开。
// 现在:首批三技法填表;偏好缺省**关**(表空时缺省字节恒等,填表后缺省导出与模型载荷不变);设置面勾选后才拼装。
import fs from 'fs';
import path from 'path';
import { getAIExportLegendLines, buildAIExportLegendSection } from '../aiExportLegend';
import { __aiExportTesting__, isAIExportLegendEnabled } from '../aiExport';
const { normalizeAIExportPrefs } = __aiExportTesting__;

const SRC = path.resolve(__dirname, '..', '..');

describe('[D47] 图例注册表', ()=>{
	it('首批 ziwei/bazi/astrochart 各 1..15 行;每行含「=」或「：」;未填技法零行', ()=>{
		['ziwei', 'bazi', 'astrochart'].forEach((k)=>{
			const lines = getAIExportLegendLines(k);
			expect(lines.length).toBeGreaterThanOrEqual(5);
			expect(lines.length).toBeLessThanOrEqual(15);
			lines.forEach((l)=>{ expect(/[=：]/.test(l)).toBe(true); expect(l.length).toBeLessThan(80); });
			expect(buildAIExportLegendSection(k).indexOf('[图例]\n')).toBe(0);
			expect(buildAIExportLegendSection(k).split('\n').length).toBe(lines.length + 1);
		});
		['guolao', 'liureng', 'qimen', 'nope', '', undefined].forEach((k)=>{
			expect(getAIExportLegendLines(k)).toEqual([]);
			expect(buildAIExportLegendSection(k)).toBe('');
		});
	});
	it('图例文本零出处(通用术语)', ()=>{
		const text = ['ziwei', 'bazi', 'astrochart'].map((k)=>getAIExportLegendLines(k).join('\n')).join('\n');
		// 术语出处由发布前扫描看守,这里只锁「零出处标注」
		['§', '手册', '出处', '来源', '据', '引自'].forEach((t)=>{ expect(text.indexOf(t)).toBe(-1); });
	});
});

describe('[D47] 缺省关 + 勾选后才拼装', ()=>{
	it('偏好缺省 legend:false;显式 true 才开;isAIExportLegendEnabled 同口径', ()=>{
		expect(normalizeAIExportPrefs(null).legend).toBe(false);
		expect(normalizeAIExportPrefs({}).legend).toBe(false);
		expect(normalizeAIExportPrefs({ legend: 'yes' }).legend).toBe(false);
		expect(normalizeAIExportPrefs({ legend: true }).legend).toBe(true);
		expect(isAIExportLegendEnabled({ prefs: { legend: true } })).toBe(true);
		expect(isAIExportLegendEnabled({ prefs: { legend: false } })).toBe(false);
		expect(isAIExportLegendEnabled({ prefs: {} })).toBe(false);
		expect(isAIExportLegendEnabled(null)).toBe(false);
	});
	it('拼装点受 isAIExportLegendEnabled 门控;设置面有勾选(data-ai-export-legend)', ()=>{
		const exp = fs.readFileSync(path.join(SRC, 'utils', 'aiExport.js'), 'utf8').replace(/\/\/[^\n]*/g, '');
		const i = exp.indexOf('buildAIExportLegendSection(usedExportKey)');
		expect(i).toBeGreaterThan(0);
		expect(exp.slice(Math.max(0, i - 400), i)).toContain('isAIExportLegendEnabled()');
		const hdr = fs.readFileSync(path.join(SRC, 'components', 'homepage', 'PageHeader.js'), 'utf8');
		expect(hdr).toContain('data-ai-export-legend="1"');
		expect(hdr).toContain('prefs.legend === true');
	});
});
