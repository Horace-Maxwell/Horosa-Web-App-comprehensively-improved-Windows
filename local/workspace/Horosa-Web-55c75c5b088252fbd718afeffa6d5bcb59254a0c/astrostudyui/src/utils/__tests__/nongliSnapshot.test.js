// 黄历 AI 导出快照 builder(v43 新增)。四同步:段头必须与 aiExport preset('calendar') 逐字一致
// (aiExportRoundtrip 全树段头守卫另有机器闸)。字段全部后端真值直引,此处以构造 fixture 断言组织与防御。
import { buildNongliSnapshotText } from '../../components/calendar/NongLiMain';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';

const day = (over)=>({
	birth: '2026-07-01 00:00:00',
	dayOfWeek: 3,
	year: '丙午', month: '五月', day: '十七', dayInt: 17, leap: false,
	yearNaying: '天河水',
	yearJieqi: '丙午', monthGanZi: '甲午', dayGanZi: '戊申', time: '壬子',
	jiedelta: '芒种后26日', chef: '明厨',
	...over,
});

describe('黄历快照 builder（四同步+防御）', ()=>{
	it('空态/无数据 → 空串不抛', ()=>{
		expect(buildNongliSnapshotText(null)).toBe('');
		expect(buildNongliSnapshotText({})).toBe('');
		expect(buildNongliSnapshotText({ days: [] })).toBe('');
	});

	it('段头与 preset(calendar) 一致：选中日+月历齐时四段全出', ()=>{
		const st = {
			date: { format: (f)=>(f === 'YYYY-MM' ? '2026-07' : '2026-07-01'), zone: 8 },
			lon: '120e00',
			days: [day(), day({ birth: '2026-07-02 00:00:00', dayOfWeek: 4, day: '十八', dayInt: 18, dayGanZi: '己酉' })],
			dateSelected: day(),
			yearGua: { desc: '泽火革' },
		};
		const text = buildNongliSnapshotText(st);
		const heads = (text.match(/^\[[^\]]+\]$/gm) || []).map((h)=>h.slice(1, -1));
		expect(heads).toEqual(['起盘信息', '当月月历', '选中日详情', '方法说明']);
		// 段头集合 ⊆ preset 声明(逐字)
		const preset = AI_EXPORT_PRESET_SECTIONS.calendar;
		heads.forEach((h)=>expect(preset).toContain(h));
	});

	it('起盘信息:查询月份/时区/历算经度', ()=>{
		const text = buildNongliSnapshotText({
			date: { format: (f)=>(f === 'YYYY-MM' ? '2026-07' : ''), zone: 8 },
			lon: '120e00',
			days: [day()],
		});
		expect(text).toMatch(/查询月份：2026-07/);
		expect(text).toMatch(/时区：东8区/);
		expect(text).toMatch(/历算经度：120e00/);
	});

	it('当月月历 GFM 表:表头+分隔行+逐日行(星期/农历/日干支);跨月补位行剔除', ()=>{
		const st = { days: [
			day(),
			day({ birth: '2026-07-02 00:00:00', dayOfWeek: 4, day: '十八', dayInt: 18, dayGanZi: '己酉' }),
			day({ birth: '2026-08-01 00:00:00', dayOfWeek: 6, day: '二十', dayInt: 20, dayGanZi: '辛巳' }), // 下月补位,须剔
		] };
		const text = buildNongliSnapshotText(st);
		expect(text).toMatch(/\| 公历 \| 星期 \| 农历 \| 日干支 \| 节气\/朔望 \|/);
		expect(text).toMatch(/\| --- \| --- \| --- \| --- \| --- \|/);
		expect(text).toMatch(/\| 07-01 \| 周三 \| 十七 \| 戊申 \|/);
		expect(text).toMatch(/\| 07-02 \| 周四 \| 十八 \| 己酉 \|/);
		expect(text).not.toMatch(/08-01/);
	});

	it('初一显示月名(闰月带「闰」);节气/朔望入备注列', ()=>{
		const st = { days: [
			day({ dayInt: 1, day: '初一', month: '六月', leap: true, jieqi: '小暑', jieqiTime: '05:57', moonTime: '12:33' }),
		] };
		const text = buildNongliSnapshotText(st);
		expect(text).toMatch(/\| 闰六月初一 \|/);
		expect(text).toMatch(/小暑 05:57；朔 12:33/);
	});

	it('选中日详情:干支四柱/纳音/节候/节气jdn/望月jdn/奇门年卦+卦名', ()=>{
		const st = {
			days: [day()],
			dateSelected: day({
				dayInt: 15, jieqi: '小暑', jieqiTime: '05:57', jieqiJdn: 2461957.5,
				moonTime: '20:10', moonJdn: 2461958.3, date: '2026-07-01',
				qimengYearGua: '革',
			}),
			yearGua: { desc: '泽火革' },
		};
		const text = buildNongliSnapshotText(st);
		expect(text).toMatch(/公历：2026-07-01 周三/);
		expect(text).toMatch(/农历：丙午年五月十七/);
		expect(text).toMatch(/年纳音：天河水/);
		expect(text).toMatch(/干支：丙午年 甲午月 戊申日 壬子时/);
		expect(text).toMatch(/节候：芒种后26日，明厨/);
		expect(text).toMatch(/节气：小暑 05:57（jdn 2461957.5）/);
		expect(text).toMatch(/望月：2026-07-01 20:10（jdn 2461958.3）/);
		expect(text).toMatch(/奇门年卦：革（泽火革）/);
	});

	it('未选日 → 无选中日详情段;卦辞未取到 → 只列卦名不抛', ()=>{
		const noSel = buildNongliSnapshotText({ days: [day()] });
		expect(noSel).not.toMatch(/\[选中日详情\]/);
		const noDesc = buildNongliSnapshotText({ days: [day()], dateSelected: day({ qimengYearGua: '革' }), yearGua: null });
		expect(noDesc).toMatch(/奇门年卦：革$/m);
	});

	it('方法说明:月干支正午口径+年柱双口径恒在', ()=>{
		const text = buildNongliSnapshotText({ days: [day()] });
		expect(text).toMatch(/月干支：以当天正午12点是否已跨节气决定归属月/);
		expect(text).toMatch(/年柱口径：干支年以节气（立春）为界/);
	});
});
