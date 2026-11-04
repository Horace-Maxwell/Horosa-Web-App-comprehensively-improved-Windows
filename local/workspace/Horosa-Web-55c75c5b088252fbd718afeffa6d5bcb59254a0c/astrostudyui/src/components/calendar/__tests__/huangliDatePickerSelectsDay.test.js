// 黄历页左上日期选择改了年 / 月 / 日 → 网格跳到该月并选中所选那天。
// 曾:只按新日期重取网格,选中日与日课卡仍停在原来那天 —— 同月改「日」纯死控件,跨月则落到今天 / 当月 1 日。
const gates = [];
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn((url, opt)=>new Promise((resolve)=>{ gates.push({ body: JSON.parse(opt.body), resolve }); })) }));
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(()=>null) }));

const HuangLiMain = require('../HuangLiMain').default;
const DateTime = require('../../comp/DateTime').default;

function monthDays(y, m){
	const n = new Date(y, m, 0).getDate();
	const out = [];
	for(let d = 1; d <= n; d += 1){ out.push({ birth: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} 12:00:00` }); }
	return out;
}
const flush = async ()=>{ for(let i = 0; i < 8; i += 1){ await Promise.resolve(); } };
function mk(){
	const inst = new HuangLiMain({});
	inst.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb.call(this); } };
	return inst;
}
const reply = (g)=>{ const [y, m] = g.body.date.split('-').map(Number); g.resolve({ Result: { days: monthDays(y, m), prevDays: [] } }); };
const dt = (s)=>new DateTime().parse(`${s} 12:00:00`, 'yyyy-MM-dd HH:mm:ss');

describe('黄历日期选择选中所选那天', ()=>{
	test('同月只改「日」:选中日跟着变', async ()=>{
		gates.length = 0;
		const inst = mk();
		inst.onTimeChanged({ value: dt('2026-03-02') });
		reply(gates[0]); await flush();
		expect(inst.state.selectedYmd).toEqual({ y: 2026, m: 3, d: 2 });
		inst.onTimeChanged({ value: dt('2026-03-04') });
		reply(gates[1]); await flush();
		expect(inst.state.selectedYmd).toEqual({ y: 2026, m: 3, d: 4 });
	});
	test('跨月:网格换月且选中所选那天(不落到当月 1 日)', async ()=>{
		gates.length = 0;
		const inst = mk();
		inst.onTimeChanged({ value: dt('2025-07-19') });
		reply(gates[0]); await flush();
		expect(inst.state.days[0].birth.slice(0, 7)).toBe('2025-07');
		expect(inst.state.selectedYmd).toEqual({ y: 2025, m: 7, d: 19 });
	});
	test('点网格选的日子不被下一次无关取月覆盖(负孪生:非日期选择触发的取月仍保留原选择)', async ()=>{
		gates.length = 0;
		const inst = mk();
		inst.onTimeChanged({ value: dt('2026-03-02') });
		reply(gates[0]); await flush();
		inst.selectByYmd(inst.parseBirth('2026-03-20 12:00:00'));
		inst.requestMonth();
		reply(gates[1]); await flush();
		expect(inst.state.selectedYmd).toEqual({ y: 2026, m: 3, d: 20 });
	});
});
