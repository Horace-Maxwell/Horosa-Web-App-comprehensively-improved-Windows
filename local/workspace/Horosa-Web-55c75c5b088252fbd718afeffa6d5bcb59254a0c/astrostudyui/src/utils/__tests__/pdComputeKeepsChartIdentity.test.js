// 主限法「计算」(推运页工具条 / 主限盘栏)写回主盘的 fields 不清命盘身份(cid):请求体照旧 cid:null,
// 写回全局的 fields 保留原 cid;主限盘栏回写的方向类型取本次请求实际用的值;
// 主限盘栏「计算」记新盘种子时与推运页工具条同维度(方法 / 时间钥匙 / 方向类型 / 投影 / 分宫 / 框架 / 平行)。
jest.mock('../astroAiSnapshot', ()=>({ ...jest.requireActual('../astroAiSnapshot'), saveAstroAISnapshot: jest.fn() }));
const seeds = require('../newChartSeeds');

const CHART = { chart: { objects: [] }, params: { birth: '1990-01-01 08:00:00', lat: '31n14', lon: '121e28', zone: '+08:00' } };

beforeEach(()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); });

describe('主限法计算回写主盘 fields 保留命盘身份', ()=>{
	test('推运页工具条 buildPrimaryDirectionFetchFields:cid 原样保留', ()=>{
		const { buildPrimaryDirectionFetchFields } = require('../../components/direction/AstroDirectMain');
		const base = { cid: { name: ['cid'], value: 'rec-123' } };
		const f = buildPrimaryDirectionFetchFields(base, CHART, 'core_alchabitius', 'Ptolemy', 100, {});
		expect(f.cid.value).toBe('rec-123');
		// 没有 cid 的盘(未载入记录)仍然没有
		expect(buildPrimaryDirectionFetchFields({}, CHART, 'core_alchabitius', 'Ptolemy', 100, {}).cid).toBeUndefined();
	});

	test('推运页请求体仍置 cid:null(不让后端按 cid 取档)', ()=>{
		const { AstroDirectMain } = require('../../components/direction/AstroDirectMain');
		const inst = Object.create(AstroDirectMain.prototype);
		inst.props = { fields: { cid: { name: ['cid'], value: 'rec-123' } }, chartObj: CHART };
		inst.state = { currentTab: 'primarydirect' };
		const req = inst.buildPrimaryDirectionRequest(CHART, {});
		expect(req).toBeTruthy();
		expect(req.cid).toBeNull();
	});

	test('主限盘栏 buildFieldsFromChartObj:cid 保留,pdtype 取本次请求值', ()=>{
		const { buildFieldsFromChartObj } = require('../../components/astro/AstroPrimaryDirectionChart');
		const base = { cid: { name: ['cid'], value: 'rec-9' } };
		const f = buildFieldsFromChartObj(base, CHART, 'core_alchabitius', 'Ptolemy', { pdtype: 1 });
		expect(f.cid.value).toBe('rec-9');
		expect(f.pdtype.value).toBe(1);
		// 缺省(未给 extra / In Zodiaco)仍是 0
		expect(buildFieldsFromChartObj(base, CHART, 'core_alchabitius', 'Ptolemy').pdtype.value).toBe(0);
		expect(buildFieldsFromChartObj(base, CHART, 'core_alchabitius', 'Ptolemy', { pdtype: 0 }).pdtype.value).toBe(0);
	});

	test('主限盘栏「计算」:请求体 cid:null、写回 fields 保留 cid、种子记全维度', async ()=>{
		const req = require('../request');
		const bodies = [];
		const spy = jest.spyOn(req, 'default').mockImplementation(async (url, opt)=>{ bodies.push(JSON.parse(opt.body)); return { Result: { pd: [] } }; });
		try{
			require('../../models/astro');
			const { fieldsSchemaBaseline } = require('../recordFieldsRestore');
			const Chart = require('../../components/astro/AstroPrimaryDirectionChart').default;
			const dispatched = [];
			const inst = Object.create(Chart.prototype);
			const fields = { ...fieldsSchemaBaseline(), cid: { name: ['cid'], value: 'rec-777' } };
			const value = { ...CHART, params: { ...CHART.params, pdtype: 1 } };
			inst.props = { dispatch: (a)=>dispatched.push(a), fields, value };
			inst.state = { pdProjectionValue: 'placidus', pdFrameValue: 'placidus' };
			inst.requestSeq = 0;
			inst.getSelectedPdMethod = ()=>'placidus';
			inst.getTablePdTimeKey = ()=>'Naibod';
			inst.getSelectedPdTimeKey = ()=>'Naibod';
			inst.getSelectedPdTimeKeyCustom = ()=>null;
			await inst.requestChartRefresh();
			expect(bodies.length).toBe(1);
			expect(bodies[0].cid).toBeNull();
			const save = dispatched.find((a)=>a.type === 'astro/save' && a.payload && a.payload.fields);
			expect(save).toBeTruthy();
			expect(save.payload.fields.cid.value).toBe('rec-777');
			expect(save.payload.fields.pdtype.value).toBe(1);
			expect(seeds.newChartSeedValue('pdMethod')).toBe('placidus');
			expect(seeds.newChartSeedValue('pdTimeKey')).toBe('Naibod');
			expect(seeds.newChartSeedValue('pdProjection')).toBe('placidus');
			expect(seeds.newChartSeedValue('pdFrame')).toBe('placidus');
			expect(seeds.newChartSeedValue('pdtype')).toBe(1);
		}finally{ spy.mockRestore(); }
	});
});

describe('主限盘栏「计算」写回当前盘的投影 / 分宫与本次请求同一对', ()=>{
	const { buildFieldsFromChartObj } = require('../../components/astro/AstroPrimaryDirectionChart');
	const mk = (v)=>({ name: ['x'], value: v });

	test('buildFieldsFromChartObj:extra 带投影 / 分宫 / 框架 / 平行就写回', ()=>{
		const base = { pdMethod: mk('core_alchabitius'), pdProjection: mk('ptolemy'), pdFrame: mk('alcabitius'), pdFramework: mk('aspect'), pdParallel: mk(1), cid: mk('C1') };
		const chartObj = { ...CHART, params: { ...CHART.params, pdProjection: 'placidus', pdFrame: 'placidus' } };
		const f = buildFieldsFromChartObj(base, chartObj, 'placidus', 'Ptolemy', { pdtype: 0, pdProjection: 'placidus', pdFrame: 'placidus', pdFramework: 'field', pdParallel: 0, pdRaptParallel: 1 });
		expect(f.pdMethod.value).toBe('placidus');
		expect(f.pdProjection.value).toBe('placidus');
		expect(f.pdFrame.value).toBe('placidus');
		expect(f.pdFramework.value).toBe('field');
		expect(f.pdParallel.value).toBe(0);
		expect(f.pdRaptParallel.value).toBe(1);
		expect(f.cid.value).toBe('C1');
		// 没给这些键:原样保留(零回归)
		const g = buildFieldsFromChartObj(base, chartObj, 'placidus', 'Ptolemy', { pdtype: 0 });
		expect(g.pdProjection.value).toBe('ptolemy');
		expect(g.pdParallel.value).toBe(1);
	});

	// 本页直接选弧算法 / 盘面宫制(与表格同一套两维),不再由旧单维方法推导
	async function compute(projection, frame, method = 'core_alchabitius'){
		const req = require('../request');
		const bodies = [];
		const spy = jest.spyOn(req, 'default').mockImplementation(async (url, opt)=>{ bodies.push(JSON.parse(opt.body)); return { Result: { pd: [] } }; });
		try{
			require('../../models/astro');
			const { fieldsSchemaBaseline } = require('../recordFieldsRestore');
			const Chart = require('../../components/astro/AstroPrimaryDirectionChart').default;
			const dispatched = [];
			const inst = Object.create(Chart.prototype);
			const fields = { ...fieldsSchemaBaseline(), pdProjection: { name: ['pdProjection'], value: 'ptolemy' }, pdFrame: { name: ['pdFrame'], value: 'alcabitius' } };
			inst.props = { dispatch: (a)=>dispatched.push(a), fields, value: CHART };
			inst.state = { pdProjectionValue: projection, pdFrameValue: frame };
			inst.requestSeq = 0;
			inst.getSelectedPdMethod = ()=>method;
			inst.getTablePdTimeKey = ()=>'Ptolemy';
			inst.getSelectedPdTimeKey = ()=>'Ptolemy';
			inst.getSelectedPdTimeKeyCustom = ()=>null;
			await inst.requestChartRefresh();
			const save = dispatched.find((a)=>a.type === 'astro/save' && a.payload && a.payload.fields);
			return { body: bodies[0], fields: save.payload.fields };
		}finally{ spy.mockRestore(); }
	}

	test('改成 Placidus 并计算:当前盘 fields 的投影 / 分宫跟请求一起换成 Placidus', async ()=>{
		const { body, fields } = await compute('placidus', 'koch');
		expect(body.pdProjection).toBe('placidus');
		expect(body.pdFrame).toBe('koch');
		expect(fields.pdProjection.value).toBe(body.pdProjection);
		expect(fields.pdFrame.value).toBe(body.pdFrame);
	});

	test('没改:投影 / 分宫照现值透传(默认路径不变)', async ()=>{
		const { body, fields } = await compute('ptolemy', 'alcabitius');
		expect(body.pdProjection).toBe('ptolemy');
		expect(fields.pdProjection.value).toBe('ptolemy');
		expect(fields.pdFrame.value).toBe('alcabitius');
		expect(fields.pdParallel.value).toBe(0);
	});
});

describe('主限法盘外圈宫头按所选盘面宫制(不再被旧单维方法打回 Alcabitius)', ()=>{
	test('方法停在缺省,宫制选 Koch → 外圈请求带 koch;几何口径随「计算」进表格请求', ()=>{
		const Chart = require('../../components/astro/AstroPrimaryDirectionChart').default;
		const inst = new Chart({ value: CHART, pdMethod: 'core_alchabitius', pdProjection: 'ptolemy', pdFrame: 'alcabitius' });
		inst.setState = (o)=>{ inst.state = { ...inst.state, ...(typeof o === 'function' ? o(inst.state) : o) }; };
		inst.handlePdFrameChange('koch');
		inst.handlePdProjectionChoiceChange('placidus|classic');
		const dial = inst.buildRequestParams();
		expect(dial.pdFrame).toBe('koch');
		expect(dial.pdProjection).toBe('placidus');
		const table = inst.buildChartRequestParams();
		expect(table.pdFrame).toBe('koch');
		expect(table.pdProjection).toBe('placidus');
		expect(table.pdGeometry).toBe('classic');
		expect(inst.needsPdRecompute()).toBe(true);
	});
});

describe('主限盘「选时刻 → 年 → 弧」随本盘的日期年长 / 逆向弧口径', ()=>{
	const mkInst = (params, pdExtra)=>{
		const DateTime = require('../../components/comp/DateTime').default;
		const Chart = require('../../components/astro/AstroPrimaryDirectionChart').default;
		const inst = Object.create(Chart.prototype);
		inst.props = { value: { ...CHART, params: { ...CHART.params, ...params } }, pdExtra };
		const dt = new DateTime();
		inst.state = { datetime: dt, pdDirectionValue: 'direct' };
		inst.getSelectedPdMethod = ()=>'core_alchabitius';
		inst.getSelectedPdProjection = ()=>'ptolemy';
		inst.getSelectedPdFrame = ()=>'alcabitius';
		inst.getSelectedPdTimeKey = ()=>'Ptolemy';
		inst.getSelectedPdTimeKeyCustom = ()=>null;
		return inst;
	};
	test('缺省不发;本盘选了「实际天数」/ 逆向弧用出生前太阳 → 请求带上,其余扩展项不带', ()=>{
		expect(mkInst({}).buildRequestParams().pdYearDays).toBeUndefined();
		const req = mkInst({ pdYearDays: 1, pdSolarArcRegressive: 1, pdTruePosition: 1 }).buildRequestParams();
		expect(req.pdYearDays).toBe(1);
		expect(req.pdSolarArcRegressive).toBe(1);
		expect(req.pdTruePosition).toBeUndefined();
		// 本盘参数没有时取页面传入的扩展设置
		expect(mkInst({}, { pdYearDays: 1 }).buildRequestParams().pdYearDays).toBe(1);
	});
});
