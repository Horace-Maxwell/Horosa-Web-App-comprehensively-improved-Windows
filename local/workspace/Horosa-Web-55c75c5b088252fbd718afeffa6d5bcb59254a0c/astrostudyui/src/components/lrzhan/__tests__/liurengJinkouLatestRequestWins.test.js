// 六壬取行年、金口诀起课 / 取行年:只认最后一次请求 —— 先发的请求晚回,不得盖掉后发那次的结果(也不得盖掉之后载入的存档);
// 每个 await 之后都判。
import fs from 'fs';
import path from 'path';

const gates = [];
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn((url, opt)=>new Promise((resolve)=>{ gates.push({ url, body: JSON.parse(opt.body), resolve }); })) }));
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(()=>null) }));

const LiuRengMain = require('../LiuRengMain').default;
const JinKouMain = require('../../jinkou/JinKouMain').default;

const flush = async ()=>{ for(let i = 0; i < 12; i += 1){ await Promise.resolve(); } };
const mkBirth = (year, gender = 1)=>({ date: { value: { year, ad: 1 } }, gender: { value: gender } });
const mkGua = (year)=>({ date: { value: { year, ad: 1 } } });

let nonce = 0;
function fakeRunYearHost(Proto, tag){
	return {
		props: {}, unmounted: false,
		state: { liureng: { nongli: {} }, calcFields: mkGua(2026), calcBirth: mkBirth(1990), runyear: null, wuxing: '木', guireng: 0 },
		runYearServerCache: new Map(), runYearServerInflight: new Map(),
		genRunYearParams(){ return { tag: this._tag, nonce: this._nonce, guaYearGanZi: '丙午' }; },
		_nonce: `n${(nonce += 1)}`,   // 行年有本机缓存:每例用不同参数,免前一例的结果直接命中缓存
		_tag: tag,
		requestBirthYearGanZi: ()=>Promise.resolve('庚午'),
		saveLiuRengAISnapshot: ()=>{}, saveJinKouSnapshot: ()=>{},
		setState(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } },
		requestRunYear: Proto.requestRunYear,
	};
}
// 后端回包:age 用不上(本地干支法 / 年差法覆盖),用 tag 标记哪一次请求的结果落了屏
const replyRunYear = (g)=>g.resolve({ Result: { tagOf: g.body.tag } });

describe.each([['六壬', LiuRengMain], ['金口诀', JinKouMain]])('%s 取行年', (_label, Main)=>{
	test.each([[[0, 1]], [[1, 0]]])('连取两次、回包顺序 %j:落屏的是后发那次', async (order)=>{
		gates.length = 0;
		const inst = fakeRunYearHost(Main.prototype, 'A');
		const a = Main.prototype.requestRunYear.call(inst);
		inst._tag = 'B';
		const b = Main.prototype.requestRunYear.call(inst);
		expect(gates.length).toBe(2);
		for(const i of order){ replyRunYear(gates[i]); await flush(); }
		await Promise.all([a, b]);
		expect(inst.state.runyear.tagOf).toBe('B');
	});

	test('第二个 await(生年干支)期间来了新请求:旧的那次不落屏', async ()=>{
		gates.length = 0;
		const inst = fakeRunYearHost(Main.prototype, 'A');
		let releaseBirth;
		inst.requestBirthYearGanZi = ()=>new Promise((r)=>{ releaseBirth = r; });
		const a = Main.prototype.requestRunYear.call(inst);
		replyRunYear(gates[0]); await flush();
		inst.requestBirthYearGanZi = ()=>Promise.resolve('庚午');
		inst._tag = 'B';
		const b = Main.prototype.requestRunYear.call(inst);
		replyRunYear(gates[1]); await flush(); await b;
		expect(inst.state.runyear.tagOf).toBe('B');
		releaseBirth('庚午'); await flush(); await a;
		expect(inst.state.runyear.tagOf).toBe('B');
	});

	test('载入存案复原行年推进代次:在途的那次回来不盖掉存档行年', async ()=>{
		gates.length = 0;
		const inst = fakeRunYearHost(Main.prototype, 'inflight');
		const a = Main.prototype.requestRunYear.call(inst);
		inst._runYearReqSeq += 1;   // 与 restoreFromCurrentCase 复原行年同一步
		inst.state.runyear = { tagOf: 'saved' };
		replyRunYear(gates[0]); await flush(); await a;
		expect(inst.state.runyear.tagOf).toBe('saved');
	});
});

describe('金口诀起课', ()=>{
	function fakeGods(){
		return {
			props: {}, unmounted: false,
			state: { wuxingAuto: true, diFen: '子', diFenAuto: true, liureng: null, runyear: null, birth: null, yueJiang: '', zhanShi: '', timeBasis: 'clock', guireng: 0 },
			godsCache: new Map(), godsInflight: new Map(),
			genGodsParams: (f)=>({ tag: f.tag }),
			requestRunYear: ()=>{}, saveJinKouSnapshot: ()=>{},
			setState(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } },
		};
	}
	const replyGods = (g)=>g.resolve({ Result: { liureng: { tag: g.body.tag, nongli: { dayGanZi: '甲子', time: '甲子' } } } });

	test.each([[[0, 1]], [[1, 0]]])('连起两课、起课回包顺序 %j:上屏的是后起的那课', async (order)=>{
		gates.length = 0;
		const inst = fakeGods();
		const a = JinKouMain.prototype.requestGods.call(inst, { tag: 'A' });
		const b = JinKouMain.prototype.requestGods.call(inst, { tag: 'B' });
		expect(gates.length).toBe(2);
		for(const i of order){ replyGods(gates[i]); await flush(); }
		for(let k = 0; k < 4; k += 1){ gates.slice(2).forEach((g)=>g.resolve({ Result: {} })); await flush(); }
		await Promise.all([a, b]);
		expect(inst.state.liureng.tag).toBe('B');
	});

	test('载入存案复原课推进代次:在途的起课回来不再盖掉存档课', async ()=>{
		gates.length = 0;
		const inst = fakeGods();
		const a = JinKouMain.prototype.requestGods.call(inst, { tag: 'inflight' });
		inst._godsReqSeq += 1;   // 与 restoreFromCurrentCase 复原课时同一步
		inst.state.liureng = { tag: 'saved' };
		replyGods(gates[0]); await flush();
		for(let k = 0; k < 4; k += 1){ gates.slice(1).forEach((g)=>g.resolve({ Result: {} })); await flush(); }
		await a;
		expect(inst.state.liureng.tag).toBe('saved');
	});

	test('复原课 / 行年的位置确实推进两个代次', ()=>{
		const t = fs.readFileSync(path.join(__dirname, '../../jinkou/JinKouMain.js'), 'utf8');
		expect(t).toContain('this._godsReqSeq = (this._godsReqSeq || 0) + 1;   // 在途的起课作废:课由存档复原');
		expect(t).toContain('this._runYearReqSeq = (this._runYearReqSeq || 0) + 1;   // 在途的行年作废:行年由存档复原');
	});
});

// 静态守卫(逐个 await 段核、全部 async 函数、全部卜类目录)见 components/__tests__/asyncLatestResultGuard.test.js。
