// 六爻:整卦 / 单爻随机翻动中改用别的方式定卦(时间 / 蓍草 / 手摇 / 自定义 / 数字 / 64 卦直选 / 载入事盘),翻动先停、按钮复位,
// 刚定好的卦不再被定时器冲掉;参数不全(数字为空、上下卦只选一边)不起卦时不停翻动(停了却不收尾 = 卦停在半途、卦辞错配);
// 开始整卦翻动时停掉单爻翻动(反之亦然),两个定时器不并跑。
// 流派下拉:不单列的流派(旧事盘的「卜筮正宗」)被选中时显示中文名,不露内部键名。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GuaZhanMain from '../GuaZhanMain';
import { setGlobalStore } from '../../../utils/storageutil';
import { applyPreset } from '../../gua/liuyaoSchools';

function makeInst(){
	const inst = new GuaZhanMain({ fields: null, dispatch: ()=>{} });
	inst.setState = (st, cb)=>{ inst.state = { ...inst.state, ...(typeof st === 'function' ? st(inst.state) : st) }; if(cb){ cb(); } };
	inst.requestNongli = (f, cb)=>{ if(cb){ cb(); } };
	inst.requestGuaDesc = ()=>{};
	inst.genFields = ()=>({});
	return inst;
}
function flipWhole(inst){
	inst.guaPeriodTask = setInterval(()=>{}, 100000);
	inst.state = { ...inst.state, btnGenGua: '停止随机' };
}
function flipYao(inst, idx){
	inst.periodTask = setInterval(()=>{}, 100000);
	const names = inst.state.btnName.slice();
	names[idx] = `停止${names[idx].substr(2)}`;
	inst.state = { ...inst.state, btnName: names, btnDisabled: names.map((n, i)=>i !== idx) };
}
function expectIdle(inst){
	expect(inst.guaPeriodTask).toBe(null);
	expect(inst.periodTask).toBe(null);
	expect(inst.state.btnGenGua).toBe('整卦随机');
	expect(inst.state.btnName).toEqual(['随机一爻', '随机二爻', '随机三爻', '随机四爻', '随机五爻', '随机六爻']);
	expect(inst.state.btnDisabled).toEqual([false, false, false, false, false, false]);
}

describe('六爻翻动中改用别的起卦方式', () => {
	afterEach(()=>{ jest.clearAllTimers(); });
	test('蓍草 / 手摇 / 自定义 / 数字 / 时间起卦:整卦翻动与单爻翻动都先停', () => {
		const casts = [
			(i)=>i.clickYarrowGua(),
			(i)=>i.onManualCast({ lines: [1, 0, 1, 0, 1, 0], moving: [] }),
			(i)=>{ i.state = { ...i.state, upGuaIdx: 0, downGuaIdx: 1 }; i.clickCustGua(); },
			(i)=>{ i.state = { ...i.state, number: 123 }; i.clickNumGua(); },
			(i)=>i.clickTimeGua({ date: { value: null } }),
			(i)=>i.changeGua(10),
			(i)=>i.changeGua(undefined),
			(i)=>{
				setGlobalStore({ user: { appliedCaseCid: 'case-ly-1', currentCase: { cid: { value: 'case-ly-1' }, updateTime: { value: 't1' }, sourceModule: { value: 'guazhan' },
					payload: { value: JSON.stringify({ gua: { yao: [{ value: 1 }, { value: 0 }, { value: 1 }, { value: 1 }, { value: 0 }, { value: 1 }], currentGua: 5, guaOrigin: 'cast' } }) } } } });
				i.restoreFromCurrentCase(true);
				expect(i.state.currentGua).toBe(5);
				setGlobalStore({});
			},
		];
		casts.forEach((cast)=>{
			const a = makeInst(); flipWhole(a); cast(a); expectIdle(a);
			const b = makeInst(); flipYao(b, 2); cast(b); expectIdle(b);
		});
	});
	test('参数不全不起卦时不停翻动(数字为空 / 上下卦只选一边 / 时间字段无效)', () => {
		const noCasts = [
			(i)=>{ i.state = { ...i.state, number: '' }; i.clickNumGua(); },
			(i)=>{ i.state = { ...i.state, upGuaIdx: 0, downGuaIdx: null }; i.clickCustGua(); },
			(i)=>{ i.genFields = ()=>null; i.clickTimeGua(); },
		];
		noCasts.forEach((cast)=>{
			const a = makeInst(); flipWhole(a); const t = a.guaPeriodTask; cast(a);
			expect(a.guaPeriodTask).toBe(t);
			expect(a.state.btnGenGua).toBe('停止随机');
			clearInterval(t);
		});
	});
	test('开始整卦翻动 → 单爻翻动停;开始单爻翻动 → 整卦翻动停', () => {
		const a = makeInst(); flipYao(a, 4);
		a.randomGua = ()=>{};
		a.genGua();
		expect(a.periodTask).toBe(null);
		expect(a.state.btnName[4]).toBe('随机五爻');
		expect(a.state.btnGenGua).toBe('停止随机');
		const b = makeInst(); flipWhole(b);
		b.randomYao = ()=>{};
		b.genYao(1);
		expect(b.guaPeriodTask).toBe(null);
		expect(b.state.btnGenGua).toBe('整卦随机');
		expect(b.state.btnName[1]).toBe('停止二爻');
	});
	test('没在翻动时起卦不动按钮状态', () => {
		const a = makeInst();
		const before = a.state.btnName;
		a.clickYarrowGua();
		expect(a.state.btnName).toBe(before);
	});
});

describe('六爻翻动中不定卦的操作', () => {
	afterEach(()=>{ jest.clearAllTimers(); });
	test('翻动中点保存 → 提示先停止、不保存;动爻勾选 / 快照刷新不生效', async () => {
		const a = makeInst(); flipWhole(a);
		const antd = require('antd');
		const spy = jest.spyOn(antd.message, 'warning').mockImplementation(()=>{});
		try{
			a.state = { ...a.state, currentGua: 3 };
			await a.clickSaveCase();
			expect(spy).toHaveBeenCalledWith(expect.stringContaining('请先停止翻动再保存'));
		}finally{ spy.mockRestore(); clearInterval(a.guaPeriodTask); }
		const b = makeInst(); flipWhole(b);
		const before = b.state.yao;
		let descAsked = 0; b.requestGuaDesc = ()=>{ descAsked += 1; };
		b.dongyaoChanged([1, 2]);
		expect(b.state.yao).toBe(before);
		expect(descAsked).toBe(0);
		const evt = { detail: { module: 'guazhan' } };
		b.handleSnapshotRefreshRequest(evt);
		expect(evt.detail.snapshotText).toBeUndefined();
		clearInterval(b.guaPeriodTask);
	});
	test('农历回调只认最新一次请求;卦辞只落到请求时的那一卦', async () => {
		const inst = new GuaZhanMain({ fields: null, dispatch: ()=>{} });
		inst.setState = (st, cb)=>{ inst.state = { ...inst.state, ...st }; if(cb){ cb(); } };
		inst.genParams = (f)=>f;
		const bridge = require('../../../utils/preciseCalcBridge');
		const order = [];
		let release1;
		const p1 = new Promise((r)=>{ release1 = r; });
		const spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementationOnce(()=>p1).mockImplementationOnce(()=>Promise.resolve({ n: 2 }));
		try{
			const r1 = inst.requestNongli({ a: 1 }, ()=>order.push('first'));
			const r2 = inst.requestNongli({ a: 2 }, ()=>order.push('second'));
			await r2;
			release1({ n: 1 });
			await r1;
			expect(order).toEqual(['second']);
			expect(inst.state.nongli).toEqual({ n: 2 });
		}finally{ spy.mockRestore(); }
		// 卦辞:请求时是 A 卦,回来时已换成 B 卦 → 丢弃
		let id = 'A';
		inst.getGuasId = ()=>({ guaOrg: id, guaRes: id, guaMiddle: id });
		inst.requestGuaDescReturn = async ()=>{ id = 'B'; return { guaOrg: 'A 卦辞' }; };
		inst.state = { ...inst.state, guaDesc: null };
		await inst.requestGuaDesc();
		expect(inst.state.guaDesc).toBe(null);
		id = 'C';
		inst.requestGuaDescReturn = async ()=>({ guaOrg: 'C 卦辞' });
		await inst.requestGuaDesc();
		expect(inst.state.guaDesc).toEqual({ guaOrg: 'C 卦辞' });
	});
	test('🔴 停止翻动的收尾在农历在途时被改时间 / 日界(只刷新干支)跟上:收尾照样落卦,干支取最新那次', async () => {
		const mk = ()=>{
			const inst = new GuaZhanMain({ fields: null, dispatch: ()=>{} });
			inst.setState = (st, cb)=>{ inst.state = { ...inst.state, ...st }; if(cb){ cb(); } };
			inst.genParams = (f)=>f;
			return inst;
		};
		const bridge = require('../../../utils/preciseCalcBridge');
		const gate = ()=>{ let release; const p = new Promise((r)=>{ release = r; }); return { p, release }; };
		// ① 起卦收尾慢、只刷新干支的快:收尾照样落卦;干支是后一次的
		{
			const inst = mk(); const order = []; const g = gate();
			const spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementationOnce(()=>g.p).mockImplementationOnce(()=>Promise.resolve({ n: 2 }));
			try{
				const r1 = inst.requestNongli({ a: 1 }, ()=>order.push('cast'));
				const r2 = inst.requestNongli({ a: 2 }, ()=>order.push('refresh'), { refreshOnly: true });
				await r2; g.release({ n: 1 }); await r1;
				expect(order).toEqual(['refresh', 'cast']);
				expect(inst.state.nongli).toEqual({ n: 2 });
			}finally{ spy.mockRestore(); }
		}
		// ② 起卦收尾在途时直选 / 载入事盘 / 开始翻动换了卦:收尾晚到不落
		{
			const inst = mk(); const order = []; const g = gate();
			const spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementationOnce(()=>g.p);
			try{
				const r1 = inst.requestNongli({ a: 1 }, ()=>order.push('cast'));
				inst.supersedePendingCast();
				g.release({ n: 1 }); await r1;
				expect(order).toEqual([]);
			}finally{ spy.mockRestore(); }
			const src = require('fs').readFileSync(require('path').join(__dirname, '../GuaZhanMain.js'), 'utf8');
			const body = (name)=>{ const i = src.indexOf(`\n\t${name}(`); return src.slice(i, src.indexOf('\n\t}\n', i)); };
			expect(body('changeGua')).toContain('this.supersedePendingCast();');
			expect(body('restoreFromCurrentCase')).toContain('this.supersedePendingCast({ dropNongli: true });');
		}
		// ③ 时间卦被只刷新干支的请求跟上:等最新那次干支落定再起(先回 / 后回两种次序各起一次时间卦,不落成卦辞刷新)
		for(const timeFirst of [true, false]){
			const inst = mk(); const g1 = gate(); const g2 = gate(); let tg = 0; let desc = 0;
			inst.genTimeGua = ()=>{ tg += 1; expect(inst.state.nongli).toEqual({ n: 2 }); };
			const spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementationOnce(()=>g1.p).mockImplementationOnce(()=>g2.p);
			try{
				const r1 = inst.requestNongli({ a: 1 });
				const r2 = inst.requestNongli({ a: 2 }, ()=>{ desc += 1; }, { refreshOnly: true });
				if(timeFirst){ g1.release({ n: 1 }); await r1; g2.release({ n: 2 }); await r2; }
				else{ g2.release({ n: 2 }); await r2; g1.release({ n: 1 }); await r1; }
				expect(tg).toBe(1);
				expect(desc).toBe(timeFirst ? 0 : 1);
			}finally{ spy.mockRestore(); }
		}
	});
	test('🔴 载入事盘时在途的农历晚到不盖存档干支;起卦收尾在途时改时间只刷新干支(不被时间卦顶掉);停止整卦翻动当场落卦;最新那次算不出时不拿旧干支起时间卦', async () => {
		const bridge = require('../../../utils/preciseCalcBridge');
		const { message } = require('antd');
		const warn = jest.spyOn(message, 'warning').mockImplementation(()=>{});
		const gate = ()=>{ let release; const p = new Promise((r)=>{ release = r; }); return { p, release }; };
		const mk = ()=>{
			const inst = new GuaZhanMain({ fields: null, dispatch: ()=>{} });
			inst.setState = (st, cb)=>{ inst.state = { ...inst.state, ...(typeof st === 'function' ? st(inst.state) : st) }; if(cb){ cb(); } };
			inst.genParams = (f)=>f;
			inst.genFields = ()=>({ t: 1 });
			inst.requestGuaDesc = ()=>{};
			return inst;
		};
		try{
			// ① 载入事盘
			{
				const inst = mk(); const g = gate();
				const spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementationOnce(()=>g.p);
				const r = inst.requestNongli({ a: 1 }, ()=>{}, { refreshOnly: true });
				setGlobalStore({ user: { appliedCaseCid: 'case-ly-9', currentCase: { cid: { value: 'case-ly-9' }, updateTime: { value: 't9' }, sourceModule: { value: 'guazhan' },
					payload: { value: JSON.stringify({ gua: { yao: [{ value: 1 }, { value: 0 }, { value: 1 }, { value: 1 }, { value: 0 }, { value: 1 }], currentGua: 5, guaOrigin: 'cast', nongli: { n: 'case' } } }) } } } });
				inst.restoreFromCurrentCase(true);
				g.release({ n: 'stale' }); await r;
				expect(inst.state.nongli).toEqual({ n: 'case' });
				expect(inst.state.currentGua).toBe(5);
				setGlobalStore({});
				spy.mockRestore();
			}
			// ② 盘上是时间卦时点蓍草起卦,农历在途中改时间:蓍草卦照样落定,来源是起卦
			{
				const inst = mk(); const g = gate();
				inst.state = { ...inst.state, guaOrigin: 'time' };
				let timeGua = 0; inst.genTimeGua = ()=>{ timeGua += 1; };
				const spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementationOnce(()=>g.p).mockImplementationOnce(()=>Promise.resolve({ n: 2 }));
				inst.clickYarrowGua();
				const p2 = inst.onTimeGeoChanged({ a: 2 });
				await p2;
				g.release({ n: 1 });
				await new Promise((r)=>setTimeout(r, 0));
				expect(timeGua).toBe(0);
				expect(inst.state.guaOrigin).toBe('cast');
				expect(inst.state.nongli).toEqual({ n: 2 });
				spy.mockRestore();
			}
			// ③ 停止整卦翻动:农历回来之前卦名已与爻一致
			{
				const inst = mk(); const g = gate();
				const spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementationOnce(()=>g.p);
				inst.guaPeriodTask = setInterval(()=>{}, 100000);
				inst.randomGua(true);
				expect(inst.guaPeriodTask).toBe(null);
				expect(inst.state.currentGua).toBe(inst.getCurrentGua(inst.state.yao));
				expect(inst.state.guaOrigin).toBe('cast');
				g.release({ n: 1 });
				await new Promise((r)=>setTimeout(r, 0));
				spy.mockRestore();
			}
			// ④ 时间卦被只刷新干支的请求跟上、最新那次算不出:两种次序都不拿旧干支起时间卦
			for(const latestFirst of [true, false]){
				const inst = mk(); const g1 = gate(); const g2 = gate(); let tg = 0;
				inst.state = { ...inst.state, nongli: { n: 'old' } };
				inst.genTimeGua = ()=>{ tg += 1; };
				const spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementationOnce(()=>g1.p).mockImplementationOnce(()=>g2.p);
				const r1 = inst.requestNongli({ a: 1 });
				const r2 = inst.requestNongli({ a: 2 }, ()=>{}, { refreshOnly: true });
				if(latestFirst){ g2.release(null); await r2; g1.release({ n: 1 }); await r1; }
				else{ g1.release({ n: 1 }); await r1; g2.release(null); await r2; }
				expect(tg).toBe(0);
				spy.mockRestore();
			}
		}finally{ warn.mockRestore(); }
	});
	test('🔴 这一时刻的农历算不出来:起出的卦照样落定(不停在半途);时间卦如实提示并让卦辞对齐盘面', async () => {
		const inst = new GuaZhanMain({ fields: null, dispatch: ()=>{} });
		inst.setState = (st, cb)=>{ inst.state = { ...inst.state, ...st }; if(cb){ cb(); } };
		inst.genParams = (f)=>f;
		const bridge = require('../../../utils/preciseCalcBridge');
		const { message } = require('antd');
		const warn = jest.spyOn(message, 'warning').mockImplementation(()=>{});
		const spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementation(()=>Promise.resolve(null));
		try{
			let landed = 0;
			await inst.requestNongli({ a: 1 }, ()=>{ landed += 1; });
			expect(landed).toBe(1);
			let desc = 0;
			inst.requestGuaDesc = ()=>{ desc += 1; };
			inst.genTimeGua = ()=>{ throw new Error('没有农历不该起时间卦'); };
			await inst.requestNongli({ a: 2 });
			expect(desc).toBe(1);
			expect(warn).toHaveBeenCalledTimes(2);
		}finally{ spy.mockRestore(); warn.mockRestore(); }
	});
});

describe('六爻时间卦用传进来的明确时刻', () => {
	test('genFields(给了时间)不被时间控件旧值覆盖;不给才读控件', () => {
		const inst = new GuaZhanMain({ fields: { date: { value: 'old' }, time: { value: 'old' } }, dispatch: ()=>{} });
		inst.getTimeFieldsFromSelector = ()=>({ date: { value: 'hook' }, time: { value: 'hook' } });
		expect(inst.genFields({ date: { value: 'new' }, time: { value: 'new' } }).time.value).toBe('new');
		expect(inst.genFields().time.value).toBe('hook');
	});
});

describe('六爻流派下拉', () => {
	test('旧事盘流派「卜筮正宗」(不单列)被选中:下拉显示中文名,不露内部键名', () => {
		global.React = React;   // 本页 JSX 走自动注入 React,单测里补上
		const inst = makeInst();
		inst.state = { ...inst.state, liuyaoSettings: applyPreset('bushi') };
		const html = renderToStaticMarkup(<div>{inst.renderLiuyaoSettings()}</div>);
		expect(html).toContain('卜筮正宗');
		expect(html).not.toMatch(/>bushi</);
	});
});

// 载入没存干支的旧事盘:补取按事盘自己的时刻 / 时区 / 经纬 / 时间算法(载入时左栏要到最后一步才换成事盘时刻,
// 此前补取读 props.fields → 日辰月建按载入前的时刻算,错了也不提示)。
describe('六爻载入无干支事盘的补取时刻', () => {
	test('补取用事盘时刻与事盘时间算法,不用载入前的左栏', () => {
		const DateTime = require('../../comp/DateTime').default;
		let tm = new DateTime(); tm.setZone('+08:00'); tm = tm.parse('2010-06-06 10:20:00', 'YYYY-MM-DD HH:mm:ss');
		let now = new DateTime(); now.setZone('+08:00'); now = now.parse('2026-10-17 21:00:00', 'YYYY-MM-DD HH:mm:ss');
		const leftPanel = { date: { value: now }, time: { value: now }, zone: { value: '+08:00' }, lon: { value: '116e23' }, lat: { value: '39n54' }, gpsLon: { value: 116.4 }, gpsLat: { value: 39.9 }, gender: { value: 1 }, timeAlg: { value: 0 } };
		const inst = new GuaZhanMain({ fields: leftPanel, dispatch: ()=>{} });
		inst.setState = (st, cb)=>{ inst.state = { ...inst.state, ...(typeof st === 'function' ? st(inst.state) : st) }; if(cb){ cb(); } };
		inst.requestGuaDesc = ()=>{};
		const got = [];
		inst.requestNongli = (f, cb, opts)=>{ got.push({ f, opts }); };
		setGlobalStore({ user: { appliedCaseCid: 'case-ly-old', currentCase: { cid: { value: 'case-ly-old' }, updateTime: { value: 't-old' }, sourceModule: { value: 'guazhan' },
			divTime: { value: tm }, zone: { value: '+08:00' }, lon: { value: '121e28' }, lat: { value: '31n14' }, gpsLon: { value: 121.47 }, gpsLat: { value: 31.23 }, gender: { value: 0 },
			payload: { value: JSON.stringify({ fieldSnapshot: { timeAlg: 1 }, gua: { yao: [{ value: 1 }, { value: 0 }, { value: 1 }, { value: 1 }, { value: 0 }, { value: 1 }], currentGua: 5, guaOrigin: 'cast' } }) } } } });
		try{
			inst.restoreFromCurrentCase(true);
			expect(got).toHaveLength(1);
			const p = inst.genParams(got[0].f);
			expect([p.date, p.time, p.lon, p.lat, p.gender, p.timeAlg]).toEqual(['2010-06-06', '10:20:00', '121e28', '31n14', 0, 1]);
			expect(got[0].opts).toEqual({ refreshOnly: true });
		}finally{
			setGlobalStore({});
		}
	});
});
