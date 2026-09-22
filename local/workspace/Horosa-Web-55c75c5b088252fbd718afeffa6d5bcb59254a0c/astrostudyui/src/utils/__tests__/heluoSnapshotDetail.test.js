// [Q-436/T-399] 河洛 AI 快照补齐:[起卦详情] 十项 + [命运篇] 反天元/反地元/反化工 + 顺逆/众宗。
//  · detail 缺 → 快照逐字同旧(除 [命运篇] 两行纯增);detail 给 → 多出 [起卦详情] 段;
//  · 页面路径(预算 extras)与无头路径(builder 内 chartExtras)同输入 → 逐字相同;
//  · 段头已登记 aiExport preset。
import { calculate, daYun, judge, chartExtras, buildSnapshotText, solarTermHuagong } from '../heluoLocal';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';

const FC = { fourPillars: { year: '甲子', month: '丙寅', day: '庚申', hour: '庚辰' }, birthYear: 1984 };
function model(gender, monthZhi) {
	const chart = calculate({ fourPillars: FC.fourPillars, gender, hourZhi: '辰', birthYear: FC.birthYear, monthZhi, opts: {} });
	const st = { ...solarTermHuagong('立春', false, { quHuaGong: 'tuWangKunGen' }), term: '立春', hou: 2, houLabel: '立春二候·立春後' };
	const jg = judge(chart, FC.fourPillars, monthZhi, st);
	const dy = daYun(chart.xian, chart.hou, FC.birthYear);
	return { chart, jg, dy, st };
}

describe('河洛快照 [起卦详情] / 反元反化工 / 顺逆众宗', () => {
	test('[命运篇] 新增反天元/反地元/反化工与顺逆众宗两行;无 detail 不出 [起卦详情]', () => {
		const m = model('男', '寅');
		const txt = buildSnapshotText(m.chart, m.jg, m.dy, { monthZhi: '寅', opts: {} });
		expect(txt).toMatch(/\n反天元 .+\(有|无\)　反地元 .+　反化工 /);
		expect(txt).toMatch(/\n顺逆：.+　众宗：/);
		expect(txt).not.toContain('[起卦详情]');
	});

	test('detail 给 → [起卦详情] 十行齐全,且页面(预算 extras)与无头(builder 内算)逐字相同', () => {
		const m = model('女', '午');
		const nayin = '海中金';
		const detailHeadless = { fourPillars: FC.fourPillars, monthZhi: '午', st: m.st, nayin, birthYear: FC.birthYear };
		const extras = chartExtras(m.chart, FC.fourPillars, '午', m.jg, { sanhou: m.st.houLabel, nayin: '金' });
		const detailPage = { ...detailHeadless, extras };
		const a = buildSnapshotText(m.chart, m.jg, m.dy, { monthZhi: '午', opts: {}, detail: detailHeadless });
		const b = buildSnapshotText(m.chart, m.jg, m.dy, { season: extras.season, opts: {}, detail: detailPage });
		expect(a).toBe(b);
		const sec = a.slice(a.indexOf('[起卦详情]'), a.indexOf('\n\n', a.indexOf('[起卦详情]')));
		const labels = sec.split('\n').slice(1).map((l) => l.split('：')[0]);
		expect(labels).toEqual(['簡斷', '數理', '數名', '氣運', '值月消息卦', '先後天八卦變化', '五命', '元堂爻位', '命格', '命局對體']);
		expect(sec).toContain('氣運：立春二候·立春後');
		expect(sec).toContain('五命：甲子生人・海中金');
		expect(sec).toMatch(/數理：天數 \d+·.+　地數 \d+·/);
		expect(sec).toMatch(/命格：吉\d+\/12 .+　凶\d+\/12 /);
	});

	test('段序:[起卦详情] 紧随 [命运篇] 之后、[大限·岁运] 之前;preset 已登记同序', () => {
		const m = model('男', '酉');
		const txt = buildSnapshotText(m.chart, m.jg, m.dy, { monthZhi: '酉', opts: {}, detail: { fourPillars: FC.fourPillars, monthZhi: '酉', st: m.st, nayin: '海中金', birthYear: 1984 } });
		const heads = txt.match(/^\[[^\]]+\]$/gm);
		expect(heads.indexOf('[起卦详情]')).toBe(heads.indexOf('[命运篇]') + 1);
		expect(heads.indexOf('[大限·岁运]')).toBe(heads.indexOf('[起卦详情]') + 1);
		const preset = AI_EXPORT_PRESET_SECTIONS.heluo;
		expect(preset.indexOf('起卦详情')).toBe(preset.indexOf('命运篇') + 1);
		heads.forEach((h) => { expect(preset).toContain(h.slice(1, -1)); });
	});
});
