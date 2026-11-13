import fs from 'fs';
import path from 'path';
import {
	MUNDANE_CYCLE_DEFAULTS, MUNDANE_CYCLE_OPTIONS, MUNDANE_CYCLE_TABLES, buildMundaneCycleText, mundaneCycleFieldLabel, mundaneCycleFields, mundaneCycleRequestFields, mundaneCycleTable,
	mundaneLon, mundanePointName, mundaneSignName, THOUSANDS_COLUMN_NOTES, WORLD_YEAR_COLUMN_NOTES, WEATHER_VARIANT_NOTES,
} from '../mundaneCycles';

describe('世俗周期表设置', ()=>{
	test('十四张表,键与后端一致', ()=>{
		expect(MUNDANE_CYCLE_TABLES).toHaveLength(14);
		const py = fs.readFileSync(path.resolve(__dirname, '../../../../astropy/astrostudy/mundane_cycles.py'), 'utf8');
		const line = /TABLES = \(([^)]*)\)/.exec(py)[1];
		MUNDANE_CYCLE_TABLES.forEach((item)=>{ expect(line).toContain(`'${item.value}'`); });
	});

	test('每张表的选项都有标签和取值,缺省值在选项里', ()=>{
		MUNDANE_CYCLE_TABLES.forEach((item)=>{
			(item.fields || []).forEach((key)=>{
				expect(mundaneCycleFieldLabel(key)).not.toBe(key);
				expect(MUNDANE_CYCLE_OPTIONS[key].some((o)=>o.value === MUNDANE_CYCLE_DEFAULTS[key])).toBe(true);
			});
		});
	});

	test('世运法达的算法档只在小档显示', ()=>{
		expect(mundaneCycleFields({ cycleTable: 'firdaria', firdariaLevel: 'big' })).toEqual(['firdariaLevel', 'firdariaYears', 'cycleYear']);
		expect(mundaneCycleFields({ cycleTable: 'firdaria', firdariaLevel: 'lesser' })).toContain('cycleVariant');
	});

	test('算法档只留有差别的组合', ()=>{
		expect(mundaneCycleFields({ cycleTable: 'conjunctions', conjKind: 'great' })).toContain('cycleVariant');
		expect(mundaneCycleFields({ cycleTable: 'conjunctions', conjKind: 'middle' })).not.toContain('cycleVariant');
		expect(mundaneCycleFields({ cycleTable: 'profections', profBase: 'greatSign' })).toContain('cycleVariant');
		expect(mundaneCycleFields({ cycleTable: 'profections', profBase: 'greatMc' })).not.toContain('cycleVariant');
		expect(mundaneCycleFields({ cycleTable: 'profections', profBase: 'changeMc' })).not.toContain('cycleVariant');
	});

	test('请求只带这张表用到的选项', ()=>{
		expect(mundaneCycleRequestFields({ cycleTable: 'turns', flood: 'b', cycleYear: 'solar', conjKind: 'lesser' })).toEqual({ table: 'turns', flood: 'b', cycleYear: 'solar' });
		expect(mundaneCycleRequestFields({ cycleTable: 'conjunctions', conjKind: 'great', cycleVariant: 'classic' }, { startYear: 1900, endYear: 2000 }))
			.toEqual({ table: 'conjunctions', conjKind: 'great', variant: 'classic', startYear: 1900, endYear: 2000 });
		expect(mundaneCycleRequestFields({ cycleTable: 'parts' }, { startYear: 1900 })).toEqual({ table: 'parts' });
		expect(mundaneCycleRequestFields({ cycleTable: 'dawr', dawrStart: 'a' }, { startYear: 1900, endYear: 2000 })).toEqual({ table: 'dawr', dawrStart: 'a', startYear: 1900 });
	});

	test('未知的表回落第一张', ()=>{
		expect(mundaneCycleTable('nope').value).toBe('conjunctions');
	});

	test('Java 白名单放行每一张表的参数', ()=>{
		const java = fs.readFileSync(path.resolve(__dirname, '../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java'), 'utf8');
		const block = java.match(/OPTIONAL_KEYS = new String\[\] \{([\s\S]*?)\};/)[1];
		const keys = new Set(['startYear', 'endYear', 'targetDate', 'targetTime', 'table', 'firdariaYears']);
		MUNDANE_CYCLE_TABLES.forEach((item)=>{ (item.fields || []).forEach((key)=>keys.add(key === 'cycleVariant' ? 'variant' : key)); });
		Array.from(keys).forEach((key)=>{ expect(block).toContain(`"${key}"`); });
	});
});

describe('世俗周期表文本', ()=>{
	test('名字与位置', ()=>{
		expect(mundanePointName('North Node')).toBe('北交');
		expect(mundanePointName('Saturn')).toBe('土');
		expect(mundaneSignName(3)).toBe('巨蟹');
		expect(mundaneSignName(99)).toBe('-');
		expect(mundaneLon(95.5)).toBe('巨蟹 5.50°');
		expect(mundaneLon('x')).toBe('-');
	});

	test('空结果和报错不出快照', ()=>{
		[null, {}, { err: 'x', rows: [{}] }, { table: 'turns', rows: [] }].forEach((r)=>{ expect(buildMundaneCycleText(r)).toBe(''); });
	});

	test('大合', ()=>{
		const text = buildMundaneCycleText({ table: 'conjunctions', rows: [{ date: '2020-12-21 18:20:00', lon: 300.5, shift: true, repeat: false }] });
		expect(text.startsWith('[世运周期表]\n表：大中小合')).toBe(true);
		expect(text).toContain('2020-12-21 水瓶 0.50° 换三分性');
	});

	test('世俗小限写锚点', ()=>{
		const text = buildMundaneCycleText({ table: 'profections', anchor: '2020-12-21 18:20:00', anchorLon: 300.5, rows: [{ date: '2021-01-01', sign: 1 }] });
		expect(text).toContain('锚点：2020-12-21 水瓶 0.50°');
		expect(text).toContain('2021-01-01 金牛');
	});

	test('年度回归写时刻和状态', ()=>{
		const text = buildMundaneCycleText({ table: 'revolution', date: '2020-03-20 03:49:00', rows: [{ planet: 'Mars', lon: 290.0, north: false, relation: 'morning' }] });
		// 年度回归的时刻是世界时(后端按 +00:00 出),标明
		expect(text).toContain('回归时刻(世界时)：2020-03-20 03:49:00');
		expect(text).toContain('火 摩羯 20.00° 南纬 晨星');
	});

	test('世运法达按座和按星都能写', ()=>{
		expect(buildMundaneCycleText({ table: 'firdaria', rows: [{ date: '2026-01-01', sign: 0, years: 11 }] })).toContain('2026-01-01 白羊 11 年');
		expect(buildMundaneCycleText({ table: 'firdaria', rows: [{ date: '2026-01-01', lord: 'Sun', years: 75 }] })).toContain('2026-01-01 日 75 年');
	});

	test('行数过多时取目标年前后', ()=>{
		const rows = Array.from({ length: 200 }, (x, i)=>({ date: `${1900 + i}-01-01 00:00:00`, lon: 10 }));
		const text = buildMundaneCycleText({ table: 'conjunctions', kind: 'middle', targetYear: 2026, rows });
		expect(text).toContain('其余 176 行略');
		expect(text).toContain('2026-01-01');
		expect(text).not.toContain('1900-01-01');
		const yearly = Array.from({ length: 30 }, (x, i)=>({ year: 2000 + i, sign: 0, lord: 'Sun', quarterLord: 'Mars' }));
		expect(buildMundaneCycleText({ table: 'dawr', targetYear: 2026, rows: yearly })).toContain('2029');
	});

	test('快照写明这张表的口径', ()=>{
		const conj = buildMundaneCycleText({ table: 'conjunctions', kind: 'lesser', rows: [{ date: '2000-01-01', lon: 1 }] });
		expect(conj).toContain('合：小合(火木)');
		const prof = buildMundaneCycleText({ table: 'profections', rate: 'great', base: 'greatSign', variant: 'classic', rows: [{ date: '2000-01-01', sign: 0 }] });
		expect(prof).toContain('速率：每座 80 年');
		expect(prof).toContain('起点：大合所在座');
		expect(prof).toContain('算法：经典');
		expect(buildMundaneCycleText({ table: 'era', eraKind: 'change', rows: [{ year: 2000, asc: 0, turn: 0, conj: 0 }] })).toContain('纪元：1980 年换组合');
		expect(buildMundaneCycleText({ table: 'firdaria', level: 'middle', rows: [{ date: '2000-01-01', lord: 'Sun', years: 75 }] })).toContain('档：中(75 年)');
	});

	test('世俗希腊点写式子,世界年表写全要项', ()=>{
		expect(buildMundaneCycleText({ table: 'parts', rows: [{ formula: '日 + 月 − 金', lon: 10 }] })).toContain('日 + 月 − 金 白羊 10.00°');
		const row = { year: 2000, worldYear: 185101, governor: 'Sun', dirYear: 61, profYear: 30, firdariaLord: 'Moon', firdariaMiddle: 'Sun', firdariaLesser: 'Moon', quarterLord: 'Mars', trepidation: 1 };
		const text = buildMundaneCycleText({ table: 'worldYears', rows: [row] });
		expect(text).toContain('世主 日');
		expect(text).toContain('颤动 1.00°');
	});

	test('年度回归写逆行', ()=>{
		expect(buildMundaneCycleText({ table: 'revolution', date: '2020-03-20', rows: [{ planet: 'Mars', lon: 290, north: true, retrograde: true, relation: 'station' }] })).toContain('火 摩羯 20.00° 北纬 逆行 留');
	});
});

describe('世俗周期表续表', ()=>{
	test('气象占、默冬月相族、世俗主限的快照行', ()=>{
		const weather = buildMundaneCycleText({ table: 'weather', targetYear: 2036, weatherMonths: 3, rows: [{
			date: '2036-03-12 09:09:00', kind: 'full', luminary: 'Moon', lon: 172.37, angle: 'MC', angleRuler: 'Venus',
			stars: [{ star: 'Denebola', natures: ['Saturn', 'Venus'] }], season: { point: 0, date: '2036-03-20 01:02:00' },
			lord: { planet: 'Mars', sign: 1, phaseName: '西方强', conditions: ['SIGN', 'LAT_N', 'EVENING'] } }] });
		expect(weather).toContain('月数：列 3 个月');
		expect(weather).toContain('主星 火 金牛 西方强 黄纬北、昏星');
		expect(weather).toContain('后随角 天顶(座主 金)');
		expect(weather).toContain('季节朔望(入白羊 2036-03-20)');
		const lunation = buildMundaneCycleText({ table: 'lunations', targetYear: 2026, rows: [{ relative: 0, new: '2025-12-20 01:43:21', firstQuarter: '2025-12-27 19:09:52', full: '2026-01-03 10:02:55', lastQuarter: '2026-01-10 15:48:24' }] });
		expect(lunation).toContain('0 轮 朔 2025-12-20 01:43:21 上弦 2025-12-27 望 2026-01-03 下弦 2026-01-10');
		const dirs = buildMundaneCycleText({ table: 'directions', targetYear: 2025, mpdKey: 'Naibod', rows: [
			{ date: '2025-03-24 17:29:55', promissor: 'Moon', aspect: 120, significator: 'Mercury', arc: 4.35, converse: false },
			{ date: '2025-04-02 10:00:00', promissor: 'Mars', aspect: 90, side: 'S', significator: 'Sun', arc: 13.2, converse: true },
		] });
		expect(dirs).toContain('时间键：Naibod');
		expect(dirs).toContain('2025-04-02 火 90°左 → 日(弧 13.20°,逆向)');
		expect(dirs).not.toContain('→ 水');
		expect(dirs).not.toContain('行略');
		const many = buildMundaneCycleText({ table: 'directions', targetYear: 2025, mpdKey: 'Ptolemy', rows: Array.from({ length: 40 }, (_, i)=>({
			date: `2025-${String(1 + Math.floor(i / 4)).padStart(2, '0')}-0${1 + (i % 4)} 00:00:00`, promissor: 'Mars', aspect: 90, side: 'S', significator: 'Sun', arc: i, converse: false })) });
		expect((many.match(/→ 日/g) || []).length).toBe(20);
		expect(many).toContain('其余 20 行略');
	});

	test('续表参数进 Java 白名单', ()=>{
		const java = fs.readFileSync(path.resolve(__dirname, '../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java'), 'utf8');
		const block = java.match(/OPTIONAL_KEYS = new String\[\] \{([\s\S]*?)\};/)[1];
		['mpdKey', 'weatherMonths'].forEach((key)=>{ expect(block).toContain(`"${key}"`); });
		const barbault = java.slice(java.indexOf('getBarbaultParams(){'), java.indexOf('getRelativeParams(){'));
		expect(barbault).toContain('params.put("harm", TransData.get("harm"))');
	});
});

describe('世俗周期表口径补全', ()=>{
	test('起点带盘面时刻:请求同时发 targetDate 与 targetTime', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../../components/mundane/MundaneCycleTables.js'), 'utf8');
		expect(src).toMatch(/targetDate: base\.date, targetTime: base\.time/);
	});

	test('气象占有改进 / 经典两档,请求带 variant', ()=>{
		expect(mundaneCycleFields({ cycleTable: 'weather' })).toEqual(['weatherMonths', 'cycleVariant']);
		expect(mundaneCycleRequestFields({ cycleTable: 'weather', weatherMonths: 6, cycleVariant: 'classic' })).toEqual({ table: 'weather', weatherMonths: 6, variant: 'classic' });
		const row = { date: '2036-03-12 09:09:00', kind: 'new', lon: 1, angle: 'MC', angleRuler: 'Venus', lord: { planet: 'Mercury', sign: 0, conditions: ['ELONG'] } };
		expect(buildMundaneCycleText({ table: 'weather', variant: 'improved', rows: [row] })).toContain(`算法：${WEATHER_VARIANT_NOTES.improved}`);
		expect(buildMundaneCycleText({ table: 'weather', variant: 'classic', rows: [row] })).toContain('算法：经典:近最大距角按常数(水星 27.8°、金星 47.8°)');
	});

	test('接口没回带的年长、周期年表起点,按这次请求写进快照', ()=>{
		const turns = buildMundaneCycleText({ table: 'turns', flood: 'a', rows: [{ date: '2000-01-01', sign: 3, lord: 'Saturn' }] }, { table: 'turns', flood: 'a', cycleYear: 'solar' });
		expect(turns).toContain('年长：回归年');
		const fird = buildMundaneCycleText({ table: 'firdaria', level: 'big', rows: [{ date: '2000-01-01', sign: 0, years: 11 }] }, { cycleYear: 'world' });
		expect(fird).toContain('年长：世界年(365.2583 日)');
		const dawr = buildMundaneCycleText({ table: 'dawr', rows: [{ year: 2000, sign: 0, lord: 'Sun', quarterLord: 'Mars' }] }, { dawrStart: 'b' });
		expect(dawr).toContain('起点：1660 年起');
		// 不传请求时照旧(不凭空补口径)
		expect(buildMundaneCycleText({ table: 'dawr', rows: [{ year: 2000, sign: 0, lord: 'Sun', quarterLord: 'Mars' }] })).not.toContain('起点');
	});

	test('千年表、世界年表每一列都有说明', ()=>{
		['year', 'thousandLord', 'turnLord', 'quarterLord', 'quarterYear', 'division', 'turn'].forEach((k)=>expect(THOUSANDS_COLUMN_NOTES[k]).toBeTruthy());
		['year', 'worldYear', 'governor', 'governorNine', 'dirMillennium', 'dirCentury', 'dirDecade', 'dirYear', 'profMillennium', 'profCentury', 'profDecade', 'profYear',
			'firdariaLord', 'firdariaLon', 'firdariaBig', 'firdariaMiddle', 'firdariaLesser', 'quarterLord', 'greatYear', 'trepidation'].forEach((k)=>expect(WORLD_YEAR_COLUMN_NOTES[k]).toBeTruthy());
		expect(Object.keys(WORLD_YEAR_COLUMN_NOTES)).toHaveLength(20);
	});

	test('同表改选项:加载中标出「重算中」,不再只在无表时转圈', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../../components/mundane/MundaneCycleTables.js'), 'utf8');
		expect(src).not.toContain('spinning={this.state.loading && !shown}');
		expect(src).toContain('按新选项重算中');
	});
});
