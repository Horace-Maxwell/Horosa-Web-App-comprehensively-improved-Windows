// 诸方杂术:玛雅历 / 十三月亮历的公认日期;快照段头 = 导出段表。
import { gregorianToJdn, mayanDate, dreamspell, localZhufangModel, zhufangSnapshotLines, ZHUFANG_SNAPSHOT_SECTIONS } from '../zhufangArts';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport/presets';

describe('玛雅历', ()=>{
	it('2012-12-21 = 13.0.0.0.0 4 Ajaw 3 K\'ank\'in,G9', ()=>{
		const m = mayanDate(gregorianToJdn(2012, 12, 21), 584283);
		expect(m.longCountText).toBe('13.0.0.0.0');
		expect(m.tzolkin.number).toBe(4);
		expect(m.tzolkin.name).toContain('Ajaw');
		expect(m.haab.day).toBe(3);
		expect(m.haab.name).toBe('K\'ank\'in');
		expect(m.lordOfNight).toBe(9);
	});
	it('长历日数 1,876,123 = 13.0.11.8.3', ()=>{
		expect(mayanDate(1876123 + 584283, 584283).longCountText).toBe('13.0.11.8.3');
	});
	it('关联常数改两日,卓尔金跟着退两日', ()=>{
		const a = mayanDate(gregorianToJdn(2000, 1, 1), 584283);
		const b = mayanDate(gregorianToJdn(2000, 1, 1), 584285);
		expect(a.days - b.days).toBe(2);
	});
	it('儒略历 / 格里历切换:1582-10-04 与 1582-10-15 相邻', ()=>{
		expect(gregorianToJdn(1582, 10, 15) - gregorianToJdn(1582, 10, 4)).toBe(1);
	});
});

describe('十三月亮历', ()=>{
	it('1987-07-26 是 Kin 34;2012-12-21 是 Kin 207 蓝手', ()=>{
		expect(dreamspell(1987, 7, 26).kin).toBe(34);
		const d = dreamspell(2012, 12, 21);
		expect(d.kin).toBe(207);
		expect(d.sealName).toBe('蓝手');
		expect(d.tone).toBe(12);
	});
	it('2 月 29 日不计数:与 2 月 28 日同 Kin,3 月 1 日接着走', ()=>{
		expect(dreamspell(2024, 2, 29).kin).toBe(dreamspell(2024, 2, 28).kin);
		expect(dreamspell(2024, 3, 1).kin).toBe(dreamspell(2024, 2, 28).kin % 260 + 1);
	});
	it('1987 年以前的 2 月 29 日同样与 2 月 28 日同 Kin', ()=>{
		expect(dreamspell(1984, 2, 29).kin).toBe(dreamspell(1984, 2, 28).kin);
		expect(dreamspell(1984, 3, 1).kin).toBe(dreamspell(1984, 2, 28).kin % 260 + 1);
	});
	it('1582 年以前按儒略历:1500 年有 2 月 29 日且不计数,3 月 1 日排第 8 月第 23 日', ()=>{
		expect(dreamspell(1500, 2, 29).kin).toBe(dreamspell(1500, 2, 28).kin);
		expect(dreamspell(1500, 3, 1).moonDate).toEqual({ moon: 8, day: 23 });
		expect(dreamspell(1500, 7, 24).moonDate.special).toBeUndefined();
		expect(dreamspell(1500, 7, 25).moonDate.special).toBe('无时间日');
	});
	it('7 月 25 日是无时间日,7 月 26 日是新年第 1 月第 1 日', ()=>{
		expect(dreamspell(2025, 7, 25).moonDate.special).toBe('无时间日');
		expect(dreamspell(2025, 7, 26).moonDate).toEqual({ moon: 1, day: 1 });
		expect(dreamspell(2025, 8, 23).moonDate).toEqual({ moon: 2, day: 1 });
	});
});

describe('快照', ()=>{
	it('段头与导出段表逐字一致,后端缺席时两段写未算出', ()=>{
		expect(AI_EXPORT_PRESET_SECTIONS.zhufang).toEqual(ZHUFANG_SNAPSHOT_SECTIONS);
		const local = localZhufangModel({ date: '1975/02/10', ad: 1 }, { mayanCorrelation: 584283 });
		const lines = zhufangSnapshotLines(local, null, {});
		expect(lines.filter((l)=>/^\[.+\]$/.test(l)).map((l)=>l.slice(1, -1))).toEqual(ZHUFANG_SNAPSHOT_SECTIONS);
		expect(lines.join('\n')).toContain('人类图未算出');
	});
	it('公元前不排两种历', ()=>{
		const local = localZhufangModel({ date: '0500/01/01', ad: -1 }, {});
		expect(local.mayan).toBeNull();
		expect(zhufangSnapshotLines(local, null, {}).join('\n')).toContain('公元前日期不排玛雅历');
	});
});
