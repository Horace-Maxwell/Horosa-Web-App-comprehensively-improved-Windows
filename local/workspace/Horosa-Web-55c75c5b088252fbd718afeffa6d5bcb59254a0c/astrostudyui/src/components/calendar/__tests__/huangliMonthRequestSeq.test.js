// 黄历页网格请求只认最后一次发出的那个月:挂载即发的「本月」与随后跳到另一月(择日载入存案跳回存案那天 / 吉日榜回填)并发时,
// 不论两个回包谁先到,最终都是跳去的那个月、选中跳去的那一天(此前先发的晚回把网格拉回本月并改选今天,或落到那月 1 日)
const gates = [];
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn((url, opt)=>new Promise((resolve)=>{ gates.push({ body: JSON.parse(opt.body), resolve }); })) }));
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(()=>null) }));

const HuangLiMain = require('../HuangLiMain').default;

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

async function run(order, target){
	gates.length = 0;
	const inst = mk();
	inst.componentDidMount();          // 挂载即按今天所在月取网格
	inst.pickAuspiciousDay(target);    // 跳去另一月的那一天
	expect(gates.length).toBe(2);
	for(const i of order){ reply(gates[i]); await flush(); }
	return inst;
}

describe('黄历网格请求代次', ()=>{
	const now = new Date();
	// 取一个与今天不同月的日子
	const other = `${now.getFullYear() - 1}-03-15`;
	test.each([[[0, 1]], [[1, 0]]])('回包顺序 %j:网格 = 跳去的月,选中跳去的那天', async (order)=>{
		const inst = await run(order, other);
		expect(inst.state.selectedYmd).toEqual({ y: now.getFullYear() - 1, m: 3, d: 15 });
		expect(inst.state.days[0].birth.slice(0, 7)).toBe(other.slice(0, 7));
	});
	test('卸载后回包不再写状态', async ()=>{
		gates.length = 0;
		const inst = mk();
		inst.componentDidMount();
		inst.componentWillUnmount();
		const before = inst.state.days;
		reply(gates[0]); await flush();
		expect(inst.state.days).toBe(before);
	});
});
