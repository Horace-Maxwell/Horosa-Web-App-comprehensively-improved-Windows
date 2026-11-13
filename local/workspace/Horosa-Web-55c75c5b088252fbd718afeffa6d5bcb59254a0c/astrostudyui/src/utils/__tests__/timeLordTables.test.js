import fs from 'fs';
import path from 'path';
import {
	TIMELORD_DEFAULTS, TIMELORD_METHODS, TIMELORD_METHOD_FIELDS, TIMELORD_OPTIONS, TIMELORD_FIELD_LABELS,
	TIMELORD_POLAR_NOTE, normalizeTimeLordOpts, timeLordRequestFields, timeLordFields, timeLordFieldShown, buildTimeLordText, timeLordPointName, timeLordRowLord, timeLordAspectText,
} from '../timeLordTables';

describe('时主轮转设置', ()=>{
	test('十二法都有字段表,字段都有标签和选项', ()=>{
		expect(TIMELORD_METHODS).toHaveLength(12);
		TIMELORD_METHODS.forEach(({ value })=>{
			const spec = TIMELORD_METHOD_FIELDS[value];
			expect(spec).toBeTruthy();
			spec.fields.forEach((key)=>{
				expect(TIMELORD_FIELD_LABELS[key]).toBeTruthy();
				expect(Array.isArray(TIMELORD_OPTIONS[key])).toBe(true);
				expect(TIMELORD_OPTIONS[key].some((item)=>item.value === TIMELORD_DEFAULTS[key])).toBe(true);
			});
		});
	});

	test('选项外的值回落缺省,旧存档不会发出后端不认的参数', ()=>{
		const out = normalizeTimeLordOpts({ method: 'nope', turnOrder: 'x', yearType: 'y', nineReverse: 'banana' });
		expect(out.method).toBe('turn');
		expect(out.turnOrder).toBe(TIMELORD_DEFAULTS.turnOrder);
		expect(out.yearType).toBe(TIMELORD_DEFAULTS.yearType);
		expect(out.nineReverse).toBe(false);
		expect(normalizeTimeLordOpts(null)).toEqual(TIMELORD_DEFAULTS);
	});

	test('反转开关四种存法都认', ()=>{
		[true, 1, '1', 'true'].forEach((value)=>{
			expect(normalizeTimeLordOpts({ nineReverse: value }).nineReverse).toBe(true);
		});
	});

	test('请求只带这一法用到的参数', ()=>{
		expect(timeLordRequestFields({ method: 'orb', orbMode: 'cycle', turnOrder: 'chaldean' }))
			.toEqual({ method: 'orb', yearType: TIMELORD_DEFAULTS.yearType, orbMode: 'cycle' });
		expect(timeLordRequestFields({ method: 'lifetime', yearType: 'sidereal' })).toEqual({ method: 'lifetime' });
		expect(timeLordRequestFields({ method: 'annual' })).toEqual({ method: 'annual', annualDays: 'tableA', annualOrder: 'natal' });
	});

	test('匀速点读自己的年长,缺省恒星年', ()=>{
		expect(timeLordRequestFields({ method: 'moving' }).yearType).toBe('sidereal');
		expect(timeLordRequestFields({ method: 'moving', yearType: 'solar', movingYear: 'hellenistic' }).yearType).toBe('hellenistic');
	});

	test('发展年龄按星座分段时不显示也不发算法档', ()=>{
		expect(timeLordFields({ method: 'devages', devBasis: 'sign' })).toEqual(['devBasis']);
		expect(timeLordFields({ method: 'devages', devBasis: 'house' })).toEqual(['devBasis', 'variant']);
		expect(timeLordRequestFields({ method: 'devages', variant: 'classic' }).variant).toBeUndefined();
		expect(timeLordRequestFields({ method: 'devages', devBasis: 'house', variant: 'classic' }).variant).toBe('classic');
		expect(timeLordFields({ method: 'diurnal' })).toContain('variant');
	});

	test('挂载齿轮只显示起作用的项', ()=>{
		expect(timeLordFieldShown('tlNope', { method: 'turn' })).toBe(false);
		expect(timeLordFieldShown('method', { method: 'annual' })).toBe(true);
		expect(timeLordFieldShown('turnOrder', { method: 'turn' })).toBe(true);
		expect(timeLordFieldShown('turnOrder', { method: 'orb' })).toBe(false);
		expect(timeLordFieldShown('yearType', { method: 'turn' })).toBe(true);
		expect(timeLordFieldShown('movingYear', { method: 'turn' })).toBe(false);
		expect(timeLordFieldShown('movingYear', { method: 'moving' })).toBe(true);
		expect(timeLordFieldShown('yearType', { method: 'lifetime' })).toBe(false);
		expect(timeLordFieldShown('variant', { method: 'devages', devBasis: 'sign' })).toBe(false);
		expect(timeLordFieldShown('variant', { method: 'devages', devBasis: 'house' })).toBe(true);
	});

	test('释放星和匀速点起点可选点', ()=>{
		expect(normalizeTimeLordOpts({ releaser: 'Syzygy' }).releaser).toBe('Syzygy');
		expect(normalizeTimeLordOpts({ releaser: 'Pars Fortuna' }).releaser).toBe('Pars Fortuna');
		expect(normalizeTimeLordOpts({ movingStart: 'Syzygy' }).movingStart).toBe('Syzygy');
	});

	test('九分主反转发成数字', ()=>{
		expect(timeLordRequestFields({ method: 'nineparts', nineReverse: true }).nineReverse).toBe(1);
		expect(timeLordRequestFields({ method: 'nineparts' }).nineReverse).toBe(0);
	});
});

describe('时主轮转跨层', ()=>{
	test('Java 白名单放行每一法发出的全部参数', ()=>{
		const java = fs.readFileSync(path.resolve(__dirname, '../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java'), 'utf8');
		const block = java.match(/OPTIONAL_KEYS = new String\[\] \{([\s\S]*?)\};/);
		const listed = new Set((block[1].match(/"([^"]+)"/g) || []).map((item)=>item.slice(1, -1)));
		const sent = new Set();
		TIMELORD_METHODS.forEach(({ value })=>{
			Object.keys(timeLordRequestFields({ method: value, devBasis: 'house' })).forEach((key)=>sent.add(key));
		});
		expect(Array.from(sent).filter((key)=>!listed.has(key))).toEqual([]);
		expect(sent.size).toBeGreaterThan(14);
	});
});

describe('时主轮转文本', ()=>{
	test('点名', ()=>{
		expect(timeLordPointName('Asc')).toBe('上升');
		expect(timeLordPointName('House7')).toBe('第 7 宫头');
		expect(timeLordPointName('sign:0')).toMatch(/头$/);
		expect(timeLordPointName('')).toBe('-');
	});

	test('行主与相位', ()=>{
		expect(timeLordRowLord({ lord: 'Asc', sub: 'MC' })).toBe('上升 / 天顶');
		expect(timeLordRowLord({ lord: 'Asc', sign: 0 })).toMatch(/\(上升\)$/);
		expect(timeLordAspectText({ aspect: 60, side: 'S' })).toBe('六合(左)');
		expect(timeLordAspectText({ aspect: 180 })).toBe('冲');
		expect(timeLordAspectText({})).toBe('');
	});

	test('空结果和报错不出快照', ()=>{
		[null, {}, { err: 'x', rows: [{}] }, { rows: [] }].forEach((r)=>{ expect(buildTimeLordText(r)).toBe(''); });
	});

	const periods = {
		kind: 'periods', method: 'quarters', target: '2030-01-01', startLord: 'Moon', hourLord: 'Mars', currentIndex: 1,
		rows: [
			{ lord: 'Asc', startAge: 0, endAge: 1, start: '2000-01-01 12:00:00', end: '2001-01-01' },
			{ lord: 'MC', startAge: 1, endAge: 2, start: '2001-01-01', end: '2002-01-01', children: [{ lord: 'Asc', start: '2001-01-01 00:00:00' }] },
			{ lord: 'Asc', startAge: 2, endAge: 3, start: '2002-01-01', end: '2003-01-01' },
		],
	};

	test('期表:当前段带子段,后续接下一段', ()=>{
		const text = buildTimeLordText(periods);
		['[时主轮转]', '[当前时段]', '[后续]'].forEach((head)=>{ expect(text).toContain(head); });
		expect(text).toContain('起始星：月');
		expect(text).toContain('天顶,1.00 至 2.00 岁,2001-01-01 至 2002-01-01');
		expect(text).toContain('子段：上升 2001-01-01 起');
		expect(text).toContain('上升:2002-01-01 起,2.00 岁');
	});

	test('快照写明这张表的口径', ()=>{
		const text = buildTimeLordText({ ...periods, method: 'quarters', yearType: 'sidereal', releaser: 'Moon' });
		expect(text).toMatch(/年长：恒星年/);
		expect(text).toContain('释放星：月');
		const nine = buildTimeLordText({ ...periods, method: 'nineparts', yearType: 'solar', time: 'ascension', reverse: true, variant: 'classic' });
		expect(nine).toContain('时间：上升时');
		expect(nine).toContain('子主：首段子主反转');
		expect(nine).toContain('算法：经典');
		expect(buildTimeLordText({ ...events, method: 'lifetime', yearType: 'solar' })).not.toContain('年长');
	});

	test('期表:目标在表尾之后没有后续,在出生之前从头列', ()=>{
		const after = buildTimeLordText({ ...periods, currentIndex: -1, pastEnd: true });
		expect(after).toContain('目标时刻不在列表范围内');
		expect(after.split('[后续]')[1].trim()).toBe('');
		const before = buildTimeLordText({ ...periods, currentIndex: -1, pastEnd: false });
		expect(before.split('[后续]')[1]).toContain('上升:2000-01-01 起');
	});

	const events = {
		kind: 'events', method: 'moving', target: '2030-01-01', currentIndex: 1,
		rows: [
			{ point: 'Asc', aspect: 0, age: 0, date: '2000-01-01' },
			{ point: 'MC', aspect: 60, side: 'D', age: 3, date: '2003-01-01' },
		],
	};

	test('事件表:最近一件在目标时刻之前,后续从下一件起', ()=>{
		const text = buildTimeLordText(events);
		expect(text).toContain('最近一件：上升 合 0.00 岁,2000-01-01');
		expect(text).toContain('天顶 六合(右):3.00 岁,2003-01-01');
	});

	test('事件表:目标时刻在全部事件之后,取最后一件且没有后续', ()=>{
		const text = buildTimeLordText({ ...events, currentIndex: -1 });
		expect(text).toContain('最近一件：天顶 六合(右)');
		expect(text.split('[后续]')[1].trim()).toBe('');
	});

	test('月亮日没有目标点,用第几日称呼', ()=>{
		const days = { kind: 'events', method: 'moondays', currentIndex: 1, rows: [
			{ day: 3, arc: 30, age: 0.01, date: '2000-01-03 00:00:00' },
			{ day: 7, arc: 90, age: 0.02, date: '2000-01-08 00:00:00' },
		] };
		const text = buildTimeLordText(days);
		// 月亮日只看出生后这几个时刻:逐行列出,不写目标时刻
		expect(text).toContain('第 3 日:月亮到本命月加 30°');
		expect(text).toContain('2000-01-03');
		expect(text).toContain('第 7 日:月亮到本命月加 90°');
		expect(text).not.toContain('目标时刻');
		expect(buildTimeLordText({ ...days, variant: 'classic' })).toMatch(/算法/);
		expect(text).not.toContain('-  0.01');
	});

	test('极圈内九分主写明改按度数', ()=>{
		expect(buildTimeLordText({ ...periods, method: 'nineparts', polar: true })).toContain(TIMELORD_POLAR_NOTE);
		expect(buildTimeLordText({ ...periods, method: 'nineparts', polar: false })).not.toContain(TIMELORD_POLAR_NOTE);
	});

	test('按星座分段的发展年龄不写算法档', ()=>{
		const row = { ...events, method: 'devages', yearType: 'solar', variant: 'improved' };
		expect(buildTimeLordText({ ...row, basis: 'sign' })).not.toContain('算法：');
		expect(buildTimeLordText({ ...row, basis: 'house' })).toContain('算法：改进');
	});

	test('事件表:目标时刻在全部事件之前', ()=>{
		expect(buildTimeLordText({ ...events, currentIndex: 0 })).toContain('目标时刻之前没有事件');
	});
});
