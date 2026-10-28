// 印占分盘请求只认最后一次发出的:挂载即按当时的 fields 取一次、紧接着按另一组 fields 再取(择日载入存案按冻结口径重排)时,
// 不论回包顺序,上屏的都是后一组(此前谁晚到谁上屏)
const gates = [];
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn((url, opt)=>new Promise((resolve)=>{ gates.push({ body: JSON.parse(opt.body), resolve }); })) }));
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(()=>null) }));
const IndiaChart = require('../IndiaChart').default;

const flush = async ()=>{ for(let i = 0; i < 10; i += 1){ await Promise.resolve(); } };
const P = (date)=>({ date, time: '10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', chartnum: 1 });
const result = (tag)=>({ Result: { tag, jyotish: { yogas: [] } } });

test.each([[[0, 1]], [[1, 0]]])('回包顺序 %j:上屏的是后发的那组', async (order)=>{
	gates.length = 0;
	const inst = { _mounted: true, props: {}, state: {}, setState(p){ this.state = { ...this.state, ...p }; } };
	// 每组用不同日期(模块级盘缓存按参数命中,同参第二次不发请求)
	const y = 2000 + order[0];
	const a = IndiaChart.prototype.requestChart.call(inst, P(`${y}-01-01`), {}).catch(()=>{});
	const b = IndiaChart.prototype.requestChart.call(inst, P(`${y}-06-06`), {}).catch(()=>{});
	expect(gates.length).toBe(2);
	for(const i of order){ gates[i].resolve(result(gates[i].body.date)); await flush(); }
	await Promise.all([a, b]);
	expect(inst.state.chartObj && inst.state.chartObj.tag).toBe(`${y}-06-06`);
});

test('记下所见那张盘实际所用的 fields:过时的回包不改它', async ()=>{
	gates.length = 0;
	const inst = { _mounted: true, props: {}, state: {}, setState(p){ this.state = { ...this.state, ...p }; } };
	const fa = { tag: 'A' }; const fb = { tag: 'B' };
	const a = IndiaChart.prototype.requestChart.call(inst, P('2010-01-01'), fa).catch(()=>{});
	const b = IndiaChart.prototype.requestChart.call(inst, P('2010-06-06'), fb).catch(()=>{});
	gates[1].resolve(result('2010-06-06')); await flush();
	gates[0].resolve(result('2010-01-01')); await flush();
	await Promise.all([a, b]);
	expect(inst._plottedFields).toBe(fb);
});
