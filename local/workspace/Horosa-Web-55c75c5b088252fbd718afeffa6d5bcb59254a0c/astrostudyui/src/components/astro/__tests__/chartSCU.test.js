import AstroChart from '../AstroChart';
import IndiaSouthChart from '../IndiaSouthChart';
import IndiaNorthChart from '../IndiaNorthChart';
import IndiaEastChart from '../IndiaEastChart';
import MidpointMain from '../../germany/MidpointMain';

// 盘面重组件 shouldComponentUpdate(sCU,根因 E)行为自检。
// 「零功能降级」的硬证:任一「影响盘面输出的 prop」变化 → sCU 必返回 true(照渲);
// 仅「不影响输出的冗余 re-render」(父级无关 setState / 传新数组但内容同)→ sCU 返回 false(跳过)。
// 沿用仓内类实例测法(无 RTL/enzyme):实例化组件类,直接调 shouldComponentUpdate(nextProps[, nextState])。

describe('盘面 sCU:AstroChart', ()=>{
	afterEach(()=>{ window.localStorage.clear(); });

	const baseProps = ()=>({
		value: { chart: {} },
		chartDisplay: [1, 2],
		planetDisplay: ['Sun', 'Moon'],
		lotsDisplay: ['PartOfFortune'],
		keyPlanets: ['Sun'],
		chartStyle: 'classic',
		zrHighlightSign: '',
		showAstroMeaning: 0,
		width: 800,
		height: 600,
		style: undefined,
		id: 'natal',
	});

	const mk = (props)=>{
		const c = new AstroChart(props);
		// 构造器读 props.id 设 chartid;state 取实例化后的真实 state。
		return c;
	};

	it('完全相同输入(含传新数组字面量但内容同)→ false(跳过冗余渲染)', ()=>{
		const c = mk(baseProps());
		const next = {
			...c.props,
			chartDisplay: [1, 2],          // 新数组,内容同
			planetDisplay: ['Sun', 'Moon'],// 新数组,内容同
			lotsDisplay: ['PartOfFortune'],
			keyPlanets: ['Sun'],
		};
		expect(c.shouldComponentUpdate(next, c.state)).toBe(false);
	});

	it('value 引用变(后端新盘对象)→ true', ()=>{
		const c = mk(baseProps());
		expect(c.shouldComponentUpdate({ ...c.props, value: { chart: {} } }, c.state)).toBe(true);
	});

	// 每个影响输出的 prop:逐一改 → 必 true(零漏渲)。
	const PROP_MUTATIONS = {
		chartDisplay: [1, 2, 3],
		planetDisplay: ['Sun'],
		lotsDisplay: [],
		keyPlanets: ['Moon'],
		chartStyle: 'modern',
		zrHighlightSign: 'Aries',
		showAstroMeaning: 1,
		width: 900,
		height: 700,
		style: { width: '50%' },
		id: 'transit',
	};
	Object.keys(PROP_MUTATIONS).forEach((key)=>{
		it(`prop「${key}」变 → true(必渲)`, ()=>{
			const c = mk(baseProps());
			expect(c.shouldComponentUpdate({ ...c.props, [key]: PROP_MUTATIONS[key] }, c.state)).toBe(true);
		});
	});

	it('resize 派生 state(ox/oy/radius)变 → true(盘须跟着重排)', ()=>{
		const c = mk(baseProps());
		expect(c.shouldComponentUpdate(c.props, { ...c.state, ox: 450, oy: 350, radius: 300 })).toBe(true);
	});

	it('仅 tooltip state(tips)变、props 不变 → false(tips 从不被 render/draw 读 → 冗余渲染)', ()=>{
		const c = mk(baseProps());
		expect(c.shouldComponentUpdate(c.props, { ...c.state, tips: { id: 'Sun' } })).toBe(false);
	});

	it('kill-switch(horosa.perf.chartSCU=0)→ 恒 true(回到旧无条件渲染)', ()=>{
		window.localStorage.setItem('horosa.perf.chartSCU', '0');
		const c = mk(baseProps());
		expect(c.shouldComponentUpdate(c.props, c.state)).toBe(true);
	});
});

describe('盘面 sCU:印度盘(南/北/东)', ()=>{
	afterEach(()=>{ window.localStorage.clear(); });

	const baseProps = ()=>({
		value: { chart: {} },
		chartnum: 1,
		label: '命盘',
		height: 720,
		planetDisplay: ['Sun', 'Moon'],
		lotsDisplay: ['PartOfFortune'],
		degreeDisplayMode: 'short',
		aspectSourceId: null,
		onPlanetClick: ()=>{},
		planetGlyphMode: 'text',
		lagnaRef: 'asc',
		counterClockwise: true,
	});

	const CASES = [
		{ name: '南印', Klass: IndiaSouthChart, usesMirror: false },
		{ name: '北印', Klass: IndiaNorthChart, usesMirror: true },
		{ name: '东印', Klass: IndiaEastChart, usesMirror: true },
	];

	CASES.forEach((cse)=>{
		describe(cse.name, ()=>{
			it('相同输入(新数组同内容)→ false(跳过)', ()=>{
				const c = new cse.Klass(baseProps());
				const next = { ...c.props, planetDisplay: ['Sun', 'Moon'], lotsDisplay: ['PartOfFortune'] };
				expect(c.shouldComponentUpdate(next)).toBe(false);
			});

			it('value 引用变 → true', ()=>{
				const c = new cse.Klass(baseProps());
				expect(c.shouldComponentUpdate({ ...c.props, value: { chart: {} } })).toBe(true);
			});

			const MUT = {
				chartnum: 9,
				label: '9分盘',
				height: 600,
				planetDisplay: ['Sun'],
				lotsDisplay: [],
				degreeDisplayMode: 'full',
				aspectSourceId: 'Mars',
				planetGlyphMode: 'glyph',
				lagnaRef: 'house4',
				onPlanetClick: ()=>{},
			};
			Object.keys(MUT).forEach((key)=>{
				it(`prop「${key}」变 → true`, ()=>{
					const c = new cse.Klass(baseProps());
					expect(c.shouldComponentUpdate({ ...c.props, [key]: MUT[key] })).toBe(true);
				});
			});

			it(`counterClockwise 变 → ${cse.usesMirror ? 'true(图形盘镜像消费)' : 'false(南印不消费)'}`, ()=>{
				const c = new cse.Klass(baseProps());
				const res = c.shouldComponentUpdate({ ...c.props, counterClockwise: false });
				expect(res).toBe(cse.usesMirror);
			});

			it('未消费的 lockAquarius 变 → false(不影响输出,不纳入 keys)', ()=>{
				const c = new cse.Klass({ ...baseProps(), lockAquarius: false });
				expect(c.shouldComponentUpdate({ ...c.props, lockAquarius: true })).toBe(false);
			});

			it('kill-switch=0 → 恒 true', ()=>{
				window.localStorage.setItem('horosa.perf.chartSCU', '0');
				const c = new cse.Klass(baseProps());
				expect(c.shouldComponentUpdate({ ...c.props })).toBe(true);
			});
		});
	});
});

describe('盘面 sCU:量化中点盘 MidpointMain', ()=>{
	afterEach(()=>{ window.localStorage.clear(); });

	const sharedMid = { midpoints: { midpoints: [], aspects: {} } };
	const sharedChart = { chart: {}, params: { birth: '2020-01-01 12:00' } };
	const baseProps = ()=>({
		value: { midpoints: sharedMid.midpoints, chartObj: sharedChart },
		chartDisplay: [1],
		planetDisplay: ['Sun'],
		lotsDisplay: [],
		showAstroMeaning: 0,
		height: 760,
		onChange: ()=>{},
		fields: { zodiacal: { value: 0 } },
		hidezodiacal: false,
		hidehsys: false,
		hidedateselector: false,
		indiahsys: false,
	});

	// ⚠️ 本 describe 里所有 sCU 调用**必须传第二参 `c.state`**。
	// 缘由(PERF-R9 Ship 6 实测):MidpointMain 因接入 FreezeSubTab 而首次有了 state(sideTab),
	// sCU 随之加了 `if(nextState !== this.state) return true`(子页签受控后,state 变化不照渲
	// 会导致切子页签不动)。而旧测试用**单参数**调用 ⇒ `nextState === undefined` ⇒ 与 this.state
	// 必然不等 ⇒ **恒返回 true**。
	// 后果比"两条用例变红"严重得多:这个块里期望 true 的用例会**因为错误的原因而通过** ——
	// 它们不再检验 props 比较,变成一批空转的假绿。真实 React 调 sCU 时**永远**会传 nextState,
	// 所以传 `c.state`(props-only 变化时 React 传的正是当前 state)才是对现实的正确建模。
	// 不要改成"放宽组件的 state 守卫来迁就单参调用"——那是拿产品代码迁就测试写法。
	const scu = (c, nextProps)=> c.shouldComponentUpdate(nextProps, c.state);

	it('value 外层引用变但两内部引用(midpoints/chartObj)不变 → false(跳过父每帧重建字面量)', ()=>{
		const c = new MidpointMain(baseProps());
		const next = { ...c.props, value: { midpoints: sharedMid.midpoints, chartObj: sharedChart } };
		expect(scu(c, next)).toBe(false);
	});

	it('value.chartObj 引用变(西洋盘数据变)→ true', ()=>{
		const c = new MidpointMain(baseProps());
		const next = { ...c.props, value: { midpoints: sharedMid.midpoints, chartObj: { chart: {}, params: {} } } };
		expect(scu(c, next)).toBe(true);
	});

	it('value.midpoints 引用变(中点结果变)→ true', ()=>{
		const c = new MidpointMain(baseProps());
		const next = { ...c.props, value: { midpoints: { midpoints: [], aspects: {} }, chartObj: sharedChart } };
		expect(scu(c, next)).toBe(true);
	});

	it('fields 引用变(改黄道/宫制)→ true', ()=>{
		const c = new MidpointMain(baseProps());
		expect(scu(c, { ...c.props, fields: { zodiacal: { value: 1 } } })).toBe(true);
	});

	it('state 变(切右栏子页签)→ true(FreezeSubTab 受控化的前提)', ()=>{
		const c = new MidpointMain(baseProps());
		expect(c.shouldComponentUpdate({ ...c.props }, { ...c.state, sideTab: '2' })).toBe(true);
	});

	const MUT = {
		chartDisplay: [1, 2],
		planetDisplay: ['Sun', 'Moon'],
		lotsDisplay: ['PartOfFortune'],
		showAstroMeaning: 1,
		height: 600,
		onChange: ()=>{},
		hidezodiacal: true,
		hidehsys: true,
		hidedateselector: true,
		indiahsys: true,
	};
	Object.keys(MUT).forEach((key)=>{
		it(`prop「${key}」变 → true`, ()=>{
			const c = new MidpointMain(baseProps());
			expect(scu(c, { ...c.props, [key]: MUT[key] })).toBe(true);
		});
	});

	it('显示数组传新引用但内容同 → false(内容比)', ()=>{
		const c = new MidpointMain(baseProps());
		const next = { ...c.props, chartDisplay: [1], planetDisplay: ['Sun'], lotsDisplay: [] };
		expect(scu(c, next)).toBe(false);
	});

	it('kill-switch=0 → 恒 true', ()=>{
		window.localStorage.setItem('horosa.perf.chartSCU', '0');
		const c = new MidpointMain(baseProps());
		expect(scu(c, { ...c.props })).toBe(true);
	});
});
