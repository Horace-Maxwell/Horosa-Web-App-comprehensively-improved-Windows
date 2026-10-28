// 六壬起课请求只认最后一次:在途的起课晚回,不得盖掉之后再起的课 / 之后载入的存档课(此前谁晚到谁上屏)
const gates = [];
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn((url, opt)=>new Promise((resolve)=>{ gates.push({ url, body: JSON.parse(opt.body), resolve }); })) }));
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(()=>null) }));
const LiuRengMain = require('../LiuRengMain').default;
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const flush = async ()=>{ for(let i = 0; i < 10; i += 1){ await Promise.resolve(); } };
function fake(){
	return {
		props: {}, unmounted: false,
		state: { wuxingUserSet: true, wuxing: '木', birth: null, liureng: null, runyear: null, guireng: 0, timeAlg: 0 },
		godsCache: new Map(), godsInflight: new Map(),
		genGodsParams: (f)=>({ tag: f.tag }),
		lessonChartFor: LiuRengMain.prototype.lessonChartFor,
		requestRunYear: ()=>{}, saveLiuRengAISnapshot: ()=>{},
		setState(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } },
	};
}
const reply = (g)=>g.resolve({ Result: { liureng: { tag: g.body.tag, nongli: { dayGanZi: '甲子' } } } });

test.each([[[0, 1]], [[1, 0]]])('连起两课、回包顺序 %j:上屏的是后起的那课', async (order)=>{
	gates.length = 0;
	const inst = fake();
	const a = LiuRengMain.prototype.requestGods.call(inst, { tag: `A${order[0]}` });
	const b = LiuRengMain.prototype.requestGods.call(inst, { tag: `B${order[0]}` });
	expect(gates.length).toBe(2);
	for(const i of order){ reply(gates[i]); await flush(); }
	await Promise.all([a, b]);
	expect(inst.state.liureng.tag).toBe(`B${order[0]}`);
});

test('载入存案复原课推进代次:在途的起课回来不再盖掉存档课', async ()=>{
	gates.length = 0;
	const inst = fake();
	const a = LiuRengMain.prototype.requestGods.call(inst, { tag: 'inflight' });
	inst._godsReqSeq += 1;   // 与 restoreFromCurrentCase 复原课时同一步
	inst.state.liureng = { tag: 'saved' };
	reply(gates[0]); await flush(); await a;
	expect(inst.state.liureng.tag).toBe('saved');
	const src = readSource(require('path').join(__dirname, '../LiuRengMain.js'));
	expect(src).toContain("this._godsReqSeq = (this._godsReqSeq || 0) + 1;   // 在途的起课作废:课由存档复原");
});
