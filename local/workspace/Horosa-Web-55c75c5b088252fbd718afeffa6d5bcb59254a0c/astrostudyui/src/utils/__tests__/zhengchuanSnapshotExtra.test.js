// [Q-439/T-402] 神数正传快照:铁板「流年总纲」(天四声序列/后天命数/覆盖)与大定「死月扫描」全表进快照,
// 值与页面同一模型字段(r.liunian.seq/houTian、r.month.scan)逐项对应;段头已登记 preset。
import { calcTieban } from '../zhengchuanTiebanLocal';
import { dadingDeathYear, dadingDeathMonth } from '../zhengchuanDadingLocal';
import { buildZhengChuanSnapshotText } from '../zhengchuanSnapshot';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';

const P = ['庚辰', '壬午', '丙申', '甲午'];
const BASE = { pillars: P, gender: '男', lunarMonth: 5, lunarDay: 25, isLeapMonth: false };

describe('神数正传快照 · 流年总纲 / 死月扫描', () => {
	test('铁板:[流年总纲] 三行(天四声/后天命数/覆盖)紧接 [本命条文] 之后、[流年条文] 之前', () => {
		const m = calcTieban({ yearGz: P[0], monthGz: P[1], dayGz: P[2], hourGz: P[3], ...BASE, askGz: P[3] });
		expect(m.liunian && m.liunian.rows.length).toBeTruthy();
		const t = buildZhengChuanSnapshotText({ ...m, school: 'tieban' }, {});
		expect(t).toContain('[流年总纲]');
		expect(t).toContain(`| 天四声（12 年一循环） | ${m.liunian.seq.join(' ')} |`);
		expect(t).toContain(`| 后天命数 | ${m.liunian.houTian} |`);
		expect(t).toContain(`| 覆盖 | ${m.liunian.rows.length} 年（1~${m.liunian.rows.length}） |`);
		const heads = t.match(/^\[[^\]]+\]$/gm);
		expect(heads.indexOf('[流年总纲]')).toBe(heads.indexOf('[本命条文]') + 1);
		expect(heads.indexOf('[流年条文]')).toBe(heads.indexOf('[流年总纲]') + 1);
	});
	test('大定:[死月扫描] 全表行数 = r.month.scan 长度,末行标「尽」;段序在 [死月] 之后', () => {
		const year = dadingDeathYear({ pillars: P, dayun: P[1], xiaoyun: P[3], suijun: P[0], age: 40 });
		const month = dadingDeathMonth(P[1], P[0][0]);
		expect(month && month.hit && Array.isArray(month.scan) && month.scan.length).toBeTruthy();
		const t = buildZhengChuanSnapshotText({ school: 'dading', input: { pillars: P, dayun: P[1], xiaoyun: P[3], suijun: P[0], age: 40 }, year, month, derived: {} });
		expect(t).toContain('[死月扫描]');
		const sec = t.slice(t.indexOf('[死月扫描]'));
		const rows = sec.split('\n').slice(3).filter((l) => l.startsWith('|'));
		expect(rows.length).toBe(month.scan.length);
		const last = month.scan[month.scan.length - 1];
		expect(rows[rows.length - 1]).toBe(`| ${last.monthNo}月 | ${last.gz} | ${last.sum}×${last.mul}=${last.prod} | ${last.r45} | ${last.tripled} | ${last.r12} | ${last.exhausted ? '尽' : ''} |`);
		const heads = t.match(/^\[[^\]]+\]$/gm);
		expect(heads.indexOf('[死月扫描]')).toBe(heads.indexOf('[死月]') + 1);
	});
	test('preset 登记:流年总纲 在 本命条文 之后、死月扫描 在 死月 之后', () => {
		const preset = AI_EXPORT_PRESET_SECTIONS.zhengchuan;
		expect(preset.indexOf('流年总纲')).toBe(preset.indexOf('本命条文') + 1);
		expect(preset.indexOf('死月扫描')).toBe(preset.indexOf('死月') + 1);
	});
});
