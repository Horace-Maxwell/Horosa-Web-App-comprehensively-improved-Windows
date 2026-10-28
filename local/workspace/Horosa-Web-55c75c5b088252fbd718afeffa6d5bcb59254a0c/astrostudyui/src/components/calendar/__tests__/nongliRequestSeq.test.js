// 农历页月历 / 年卦请求只认最后一次:连点月份步进 / 快速改日期时先发的晚回不把网格拉回上一个月、不清掉选中日;
// 快速连选两天时年卦释文不落成上一天的。卸载后回包不再写状态。(与黄历页同一口径)
const gates = [];
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn((url, opt)=>new Promise((resolve)=>{ gates.push({ url, body: JSON.parse(opt.body), resolve }); })) }));
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(()=>null) }));

const NongLiMain = require('../NongLiMain').default;
const DateTime = require('../../comp/DateTime').default;

const flush = async ()=>{ for(let i = 0; i < 8; i += 1){ await Promise.resolve(); } };
function mk(){
	const inst = new NongLiMain({ fields: { gpsLon: { value: 116.4 }, gpsLat: { value: 39.9 } } });
	inst.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb.call(this); } };
	return inst;
}
const dt = (s)=>{ let d = new DateTime(); d.setZone('+08:00'); d = d.parse(`${s} 12:00:00`, 'YYYY-MM-DD HH:mm:ss'); return d; };
const replyMonth = (g)=>{ g.resolve({ Result: { days: [{ month: g.body.date.slice(0, 7) }], prevDays: [] } }); };

describe('农历页月历请求代次', ()=>{
	beforeEach(()=>{ gates.length = 0; });
	test.each([[[0, 1]], [[1, 0]]])('🔴 回包顺序 %j:网格 = 最后一次要的那个月', async (order)=>{
		const inst = mk();
		inst.componentDidMount();
		inst.onTimeChanged({ value: dt('2020-03-15') });
		expect(gates.length).toBe(2);
		for(const i of order){ replyMonth(gates[i]); await flush(); }
		expect(inst.state.days[0].month).toBe('2020-03');
		inst.componentWillUnmount();
	});
	test('卸载后回包不再写状态', async ()=>{
		const inst = mk();
		inst.componentDidMount();
		inst.componentWillUnmount();
		const before = inst.state.days;
		replyMonth(gates[0]); await flush();
		expect(inst.state.days).toBe(before);
	});
});

describe('农历页年卦释文请求代次', ()=>{
	beforeEach(()=>{ gates.length = 0; });
	test('🔴 快速连选两天(年卦不同):先发的晚回不落成上一天的', async ()=>{
		const inst = mk();
		inst.state = { ...inst.state, dateSelected: { qimengYearGua: '乾' } };
		inst.requestYearGua();
		inst.state = { ...inst.state, dateSelected: { qimengYearGua: '坤' } };
		inst.requestYearGua();
		expect(gates.map((g)=>g.body.name[0])).toEqual(['乾', '坤']);
		gates[1].resolve({ Result: { 坤: { desc: 'k' } } }); await flush();
		gates[0].resolve({ Result: { 乾: { desc: 'q' } } }); await flush();
		expect(inst.state.yearGua.guaName).toBe('坤');
	});
	test('选了没有年卦的一天:之前在途的释文不再落下', async ()=>{
		const inst = mk();
		inst.state = { ...inst.state, dateSelected: { qimengYearGua: '乾' } };
		inst.requestYearGua();
		inst.state = { ...inst.state, dateSelected: { qimengYearGua: null } };
		inst.requestYearGua();
		gates[0].resolve({ Result: { 乾: { desc: 'q' } } }); await flush();
		expect(inst.state.yearGua).toBe(null);
	});
});
