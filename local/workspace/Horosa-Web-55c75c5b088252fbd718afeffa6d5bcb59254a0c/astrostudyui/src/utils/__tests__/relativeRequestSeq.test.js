// 合盘页 doChart 只认最后一次发出的请求,结果写回发请求时的子页签:
// 比较盘请求在途时切到组合盘,组合盘先回、比较盘后到 —— 比较盘结果不能写进组合盘页签、也不能上屏。
const req = require('../request');
const AstroRelative = require('../../components/astro/AstroRelative').default;

function deferred(){
	let resolve;
	const p = new Promise((r)=>{ resolve = r; });
	return { p, resolve };
}

function mkSelf(){
	const drawn = [];
	const self = {
		_mounted: true,
		props: {},
		state: {
			chartA: { record: {} }, chartB: { record: {} },
			currentTab: 'Comparison', currentRelative: 0,
			hook: {
				Comparison: { relative: 0, result: null, fun: (r)=>drawn.push(['Comparison', r.tag]) },
				Composite: { relative: 1, result: null, fun: (r)=>drawn.push(['Composite', r.tag]) },
			},
		},
		setState(patch, cb){ this.state = { ...this.state, ...(typeof patch === 'function' ? patch(this.state) : patch) }; if(cb){ cb(); } },
		genParams(){ return { relative: this.state.currentRelative }; },
		saveRelativeSnapshot(){},
	};
	return { self, drawn };
}

describe('合盘请求代次', ()=>{
	let spy;
	afterEach(()=>{ if(spy){ spy.mockRestore(); spy = null; } });

	test('切子页签:旧请求后到不盖新页签、不上屏', async ()=>{
		const pending = [];
		spy = jest.spyOn(req, 'default').mockImplementation(()=>{ const d = deferred(); pending.push(d); return d.p; });
		const { self, drawn } = mkSelf();
		const first = AstroRelative.prototype.doChart.call(self);      // 比较盘(relative=0)
		self.state.currentTab = 'Composite'; self.state.currentRelative = 1;
		const second = AstroRelative.prototype.doChart.call(self);     // 组合盘(relative=1)
		pending[1].resolve({ Result: { tag: 'composite' } });
		await second;
		pending[0].resolve({ Result: { tag: 'comparison-stale' } });
		await first;
		expect(self.state.hook.Composite.result.tag).toBe('composite');
		expect(self.state.hook.Comparison.result).toBeNull();
		expect(drawn).toEqual([['Composite', 'composite']]);
		expect(self.state.updating).toBe(false);
	});

	test('同页签连续换星盘 B:先发的后到被丢弃', async ()=>{
		const pending = [];
		spy = jest.spyOn(req, 'default').mockImplementation(()=>{ const d = deferred(); pending.push(d); return d.p; });
		const { self, drawn } = mkSelf();
		const first = AstroRelative.prototype.doChart.call(self);
		const second = AstroRelative.prototype.doChart.call(self);
		pending[1].resolve({ Result: { tag: 'B2' } });
		await second;
		pending[0].resolve({ Result: { tag: 'B1' } });
		await first;
		expect(self.state.hook.Comparison.result.tag).toBe('B2');
		expect(drawn).toEqual([['Comparison', 'B2']]);
	});

	test('在途时切页签但没发新请求(星盘未齐):回包写回发请求的页签,不画到新页签', async ()=>{
		const pending = [];
		spy = jest.spyOn(req, 'default').mockImplementation(()=>{ const d = deferred(); pending.push(d); return d.p; });
		const { self, drawn } = mkSelf();
		const first = AstroRelative.prototype.doChart.call(self);
		self.state.chartA = null;
		self.state.currentTab = 'Composite'; self.state.currentRelative = 1;
		pending[0].resolve({ Result: { tag: 'comparison' } });
		await first;
		expect(self.state.hook.Comparison.result.tag).toBe('comparison');
		expect(self.state.hook.Composite.result).toBeNull();
		expect(drawn).toEqual([]);
	});

	test('在途时清空星盘 A / 星盘 B:旧回包作废,不写页签结果、不上屏,更新角标收起', async ()=>{
		for(const which of ['selectChartA', 'selectChartB']){
			const pending = [];
			spy = jest.spyOn(req, 'default').mockImplementation(()=>{ const d = deferred(); pending.push(d); return d.p; });
			const { self, drawn } = mkSelf();
			const first = AstroRelative.prototype.doChart.call(self);
			expect(self.state.updating).toBe(true);
			AstroRelative.prototype[which].call(self, null);
			expect(self.state.updating).toBe(false);
			pending[0].resolve({ Result: { tag: 'gone' } });
			await first;
			expect(self.state.hook.Comparison.result).toBeNull();
			expect(drawn).toEqual([]);
			spy.mockRestore(); spy = null;
		}
	});

	test('单次请求照常写当前页签并上屏(零回归)', async ()=>{
		spy = jest.spyOn(req, 'default').mockImplementation(async ()=>({ Result: { tag: 'only' } }));
		const { self, drawn } = mkSelf();
		await AstroRelative.prototype.doChart.call(self);
		expect(self.state.hook.Comparison.result.tag).toBe('only');
		expect(drawn).toEqual([['Comparison', 'only']]);
	});
});
