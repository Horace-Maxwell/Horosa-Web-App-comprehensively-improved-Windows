// [V5-D15/D16/D17] 提醒/互换导入/双轨导出 闸。
import { parseCsvCharts, parseQckCharts, parseAafCharts, recordsToNdjson, recordsToMarkdown } from '../interchangeFormats';
import { upcomingBirthdays, remindersEnabled, setRemindersEnabled } from '../upcomingReminders';
import { upsertLocalChart, listLocalCharts, importLocalChartsBackup } from '../localcharts';

describe('[V5-D16] 互换导入解析(候选记录零写库;坏行如实上报)', ()=>{
	it('🔴 CSV 模板:带/不带表头都收;缺列坏行报错跳过不炸', ()=>{
		const { records, errors } = parseCsvCharts('姓名,性别,生辰,时区,纬度,经度,地点\n甲,男,1990-01-01 08:00,+08:00,39n54,116e23,北京\n乙,女,1991-02-02 09:30,,,,\n坏行没生辰,,,,,,\n丙,,1992-13-99,,,,');
		expect(records.length).toBe(2);
		expect(records[0]).toMatchObject({ name: '甲', gender: 1, birth: '1990-01-01 08:00:00', zone: '+08:00', pos: '北京' });
		expect(records[1]).toMatchObject({ name: '乙', gender: 0, zone: '+08:00' });
		expect(errors.length).toBe(2);
	});

	it('QCK 行式(分号/逗号方言)+日期宽容(DD.MM.YYYY / MM/DD/YYYY)', ()=>{
		const { records, errors } = parseQckCharts('John Doe;15.03.1985;14:30;GMT+1;Berlin;52n31;13e24\nJane,03/15/1985,06:00,-5,New York\n#comment\nbadline');
		expect(records.length).toBe(2);
		expect(records[0]).toMatchObject({ name: 'John Doe', birth: '1985-03-15 14:30:00', zone: '+01:00', pos: 'Berlin' });
		expect(records[1]).toMatchObject({ name: 'Jane', birth: '1985-03-15 06:00:00', zone: '-05:00' });
		expect(errors.length).toBe(1);
	});

	it('AAF 记录行(#A9x:)解析;非记录行静默跳过', ()=>{
		const { records } = parseAafCharts('#A00:header\n#A93:Mustermann,Max,15.03.1985,14:30,GMT+1,Berlin,52n31,13e24\nnoise');
		expect(records.length).toBe(1);
		expect(records[0]).toMatchObject({ name: 'Mustermann Max', birth: '1985-03-15 14:30:00', zone: '+01:00' });
	});

	it('🔴 候选记录经既有信封入库=三闸+去重四闸全复用', ()=>{
		window.localStorage.clear();
		const { records } = parseCsvCharts('丁,男,1993-01-01 08:00,+08:00,,,');
		const r = importLocalChartsBackup({ format: 'horosa-local-charts', version: 1, charts: records });
		expect(r.imported).toBe(1);
		expect(listLocalCharts()[0].name).toBe('丁');
	});
});

describe('[V5-D17] 双轨导出', ()=>{
	it('NDJSON 一行一条可回导;Markdown 含档案要素与不可回导标注', ()=>{
		window.localStorage.clear();
		upsertLocalChart({ cid: 'local-x-1', name: '戊', birth: '1994-01-01 08:00:00', zone: '+08:00', memo: '要点', rodden: 'AA', sourceNote: '出生证', journal: [{ at: '2026-08-14 10:00', text: '首断' }] });
		const list = listLocalCharts();
		const nd = recordsToNdjson(list);
		expect(nd.split('\n').length).toBe(1);
		expect(JSON.parse(nd).name).toBe('戊');
		const md = recordsToMarkdown(list, 'chart');
		expect(md).toContain('## 戊');
		expect(md).toContain('生辰可信度：AA（出处：出生证）');
		expect(md).toContain('断事日志');
		expect(md).toContain('不可回导');
	});
});

describe('[V5-D15] 生日/整寿提醒(默认关,可开关)', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 默认关;开关往返生效', ()=>{
		expect(remindersEnabled()).toBe(false);
		setRemindersEnabled(true);
		expect(remindersEnabled()).toBe(true);
		setRemindersEnabled(false);
		expect(remindersEnabled()).toBe(false);
	});

	it('窗口内生日按天数排序;逢十标整寿;跨年翻转;归档记录不提醒', ()=>{
		const now = new Date(2026, 7, 14);   // 2026-08-14
		const list = [
			{ cid: 'a', name: '三天后', birth: '1990-08-17 08:00:00' },
			{ cid: 'b', name: '今天整寿', birth: '1986-08-14 08:00:00' },
			{ cid: 'c', name: '窗外', birth: '1990-09-30 08:00:00' },
			{ cid: 'd', name: '已归档', birth: '1990-08-15 08:00:00', archived: true },
			{ cid: 'e', name: '跨年', birth: '1990-01-02 08:00:00' },
		];
		const ups = upcomingBirthdays(list, now, 7);
		expect(ups.map((u)=>u.name)).toEqual(['今天整寿', '三天后']);
		expect(ups[0]).toMatchObject({ inDays: 0, turnsAge: 40, decade: true });
		expect(ups[1]).toMatchObject({ inDays: 3, turnsAge: 36, decade: false });
		expect(upcomingBirthdays(list, new Date(2026, 11, 30), 7).map((u)=>u.name)).toEqual(['跨年']);
	});
});
