// 紫微排盘请求只认最后发出的那次:择日宿主载入存案时,挂载即请求的当前时刻盘与存案那张并发,
// 存案那张命中缓存先回、当前时刻那张后到 —— 此前后到的无条件 setState,把存案那张盘盖掉(左栏是存案时刻、盘是当前时刻)。
const gates = [];
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn(()=>new Promise((resolve)=>{ gates.push(resolve); })) }));
jest.mock('../../../services/rules', ()=>({ ziweirulesCached: jest.fn(async ()=>({ Result: { rules: 1 } })) }));
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(()=>null) }));

const ZiWeiMain = require('../ZiWeiMain').default;

function mk(){
	const inst = new ZiWeiMain({ fields: null, dispatch: ()=>{} });
	inst.setState = (st, cb)=>{ inst.state = { ...inst.state, ...(typeof st === 'function' ? st(inst.state) : st) }; if(cb){ try{ cb(); }catch(e){ /* 收尾副作用与本测无关 */ } } };
	inst.genParams = (f)=>({ tag: f.tag });
	return inst;
}
const flush = async ()=>{ for(let i = 0; i < 6; i += 1){ await Promise.resolve(); } };

test('先发的请求后回:丢弃,盘留在后发的那张', async ()=>{
	const inst = mk();
	const pNow = inst.requestZiWei({ tag: 'now' });
	const pCase = inst.requestZiWei({ tag: 'case' });
	gates[1]({ Result: { tag: 'case', houses: [] } });
	await flush();
	gates[0]({ Result: { tag: 'now', houses: [] } });
	await flush();
	await Promise.all([pNow, pCase]);
	expect(inst.state.result && inst.state.result.tag).toBe('case');
	expect(inst.state.updating).toBe(false);
});
