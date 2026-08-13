// 地占 · 实时重排:改设置/改时地即重排判读(不必再点起盘),且**绝不悄悄换掉手上这一卦**。
// 两条须一并守住:
//  ① 时地与判读类设置一改即重排 —— 否则只能靠再点一次「起盘」,而那就是重新揲卦,手上那一卦即失。
//  ② 重排须原样带回**这副盘自己**回传的起卦源(起卦法与十六数):只钉种子不带数,
//     判读端会回落成普通手工种子并改由随机数重揲 —— 切一次流派母图就全变,等于换了一卦。
jest.mock('../../../utils/kentangCaseSave', () => ({
	openKentangCaseDrawer: jest.fn((arg) => { global.__savedCase = arg; }),
	getKentangSavedCasePayload: jest.fn(() => global.__mockCase || null),
}));
jest.mock('../../../utils/moduleAiSnapshot', () => ({
	saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(),
}));
// 拦后端:把每次真正发出的请求体记下来 —— 判据落在"送进请求体的值"上,而非组件内部状态。
jest.mock('../../../utils/kentangCache', () => ({
	cachedKentangFetch: jest.fn(async (url, init) => {
		global.__calls.push(JSON.parse(init.body));
		return { text: async () => JSON.stringify({ ResultCode: 0, Result: global.__nextResult }) };
	}),
}));

import DateTime from '../../comp/DateTime';
import GeomancyMain from '../GeomancyMain';
import { convertLonToStr, convertLatToStr } from '../../astro/AstroHelper';
import LIVE from './fixtures/geomancyLiveResults.json';

const PROPS = { hideQuickDock: true, height: 760, dispatch: () => {}, fields: {} };

// 用仓内真 DateTime(带 clone/setZone/ad),而非 moment —— 时地补丁链会调 setZone。
const mkFields = (y, mo, d, h, mi, lon, lat) => {
	const dt = new DateTime({ year: y, month: mo, date: d, hour: h, minute: mi, second: 0, ad: 1, zone: '+08:00' });
	return {
		date: { value: dt.clone() }, time: { value: dt.clone() },
		zone: { value: '+08:00' }, ad: { value: 1 },
		lon: { value: lon }, lat: { value: lat },
	};
};
const F1 = mkFields(2026, 8, 12, 10, 30, '119e19', '26n04');
const F2 = mkFields(2026, 8, 12, 10, 30, '121e28', '31n13');   // 只改地点
const F3 = mkFields(2026, 3, 1, 22, 5, '119e19', '26n04');     // 只改时间

// 造一个组件实例:接管 setState(同步),挂上一副已起好的盘。
const mk = (result, extra, props) => {
	const p = { ...PROPS, ...(props || {}) };
	const i = new GeomancyMain(p);
	i.props = p;
	i.state = { ...i.state, result: result || null, loading: false, ...(extra || {}) };
	i.setState = (patch, cb) => {
		i.state = { ...i.state, ...(typeof patch === 'function' ? patch(i.state) : patch) };
		if (cb) cb();
	};
	return i;
};
// 🔴 真机时序版实例:React 的 setState 是**异步**的,且提交顺序是
//    render → componentDidUpdate → setState 回调。上面 mk 的同步 setState 会把这个顺序抹平,
//    于是「载档清掉本地草稿 → 下一拍签名才变」这类跨拍缺陷永远测不出来。
const mkAsync = (result, extra, props) => {
	const p = { ...PROPS, ...(props || {}) };
	const i = new GeomancyMain(p);
	i.props = p;
	i.state = { ...i.state, result: result || null, loading: false, ...(extra || {}) };
	const queue = [];
	i.setState = (patch, cb) => { queue.push([patch, cb]); };
	i.commitReact = () => {
		let n = 0;
		while (queue.length && n < 50) {
			n += 1;
			const [patch, cb] = queue.shift();
			i.state = { ...i.state, ...(typeof patch === 'function' ? patch(i.state) : patch) };
			i.componentDidUpdate(i.props);      // React:先 didUpdate
			if (cb) cb();                       // 再 setState 回调
		}
	};
	return i;
};
// 冲干净微任务队列(clickCast 是 async;fetch 已被同步 mock,两拍足够)
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
// 走一遍 didUpdate 并推过防抖静默期
const bump = async (i, prevProps) => {
	i.componentDidUpdate(prevProps || i.props);
	jest.advanceTimersByTime(400);
	await flush();
};

beforeEach(() => {
	global.__calls = [];
	global.__mockCase = null;
	global.__nextResult = LIVE.european_classical;
	jest.useFakeTimers();
});
afterEach(() => { jest.useRealTimers(); });

describe('地占 · 钉盘重算须原样 replay 起卦源(八档起卦法)', () => {
	test('🔴 报数盘:重算必带回那十六个数,否则后端改由 RNG 重揲即换卦', async () => {
		const i = mk(LIVE.book_numbers);
		const nums = LIVE.book_numbers.reading.settings.cast_numbers;
		expect(Array.isArray(nums) && nums.length === 16).toBe(true);   // 夹具自证:确是报数盘
		i.recastPinned();
		await flush();
		expect(global.__calls).toHaveLength(1);
		const p = global.__calls[0];
		expect(p.castMethod).toBe('numbers');
		expect(p.castNumbers).toEqual(nums);
		expect(p.seed).toBe(LIVE.book_numbers.reading.seed);
	});

	test('🔴 十六数取自**这副盘自己**,而非左栏草稿 —— 改了报数框却没点起盘,不该反噬手上这一卦', async () => {
		const nums = LIVE.book_numbers.reading.settings.cast_numbers;
		// 左栏草稿故意改成另一组数(用户正准备起下一卦)
		const i = mk(LIVE.book_numbers, { seedMode: 'numbers', castNumbersText: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1' });
		i.recastPinned();
		await flush();
		expect(global.__calls[0].castNumbers).toEqual(nums);
		expect(global.__calls[0].castNumbers).not.toEqual(new Array(16).fill(1));
	});

	test('手工种子盘:照旧钉 seed,不平白多发 castMethod', async () => {
		const i = mk(LIVE.european_classical);
		i.recastPinned();
		await flush();
		const p = global.__calls[0];
		expect(p.seed).toBe(42);
		expect(p.castMethod).toBeUndefined();
		expect(p.castNumbers).toBeUndefined();
	});

	test('皮肤档(掷骰/抛硬币/沙痕/掷片)与 rng:回带起卦法 + 钉 seed(出处不丢)', async () => {
		for (const m of ['dice', 'coins', 'sand', 'tablets', 'rng']) {
			global.__calls = [];
			const r = JSON.parse(JSON.stringify(LIVE.european_classical));
			r.reading.settings.cast_method = m;
			const i = mk(r);
			i.recastPinned();
			await flush();                                     // eslint-disable-line no-await-in-loop
			expect(global.__calls[0].castMethod).toBe(m);
			expect(global.__calls[0].seed).toBe(42);
		}
	});

	test('🔴 时间档只认 timeSeed:钉成 seed 即退化真随机 → 必须走 timeSeed 且不发 seed', async () => {
		const r = JSON.parse(JSON.stringify(LIVE.european_classical));
		r.reading.settings.cast_method = 'time';
		const i = mk(r);
		i.recastPinned();
		await flush();
		const p = global.__calls[0];
		expect(p.castMethod).toBe('time');
		expect(p.timeSeed).toBe(42);
		expect(p.seed).toBeUndefined();
	});
});

describe('地占 · 改设置/改时地即实时重算', () => {
	test('改地点 → 重算一次,且请求体带的是新经纬', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.props = { ...i.props, fields: F2 };
		await bump(i, { ...PROPS, fields: F1 });
		expect(global.__calls).toHaveLength(1);
		expect(global.__calls[0].lon).toBe('121e28');
		expect(global.__calls[0].lat).toBe('31n13');
		expect(global.__calls[0].seed).toBe(42);            // 卦没变
	});

	test('改时间 → 重算一次,且请求体带的是新时刻', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.props = { ...i.props, fields: F3 };
		await bump(i, { ...PROPS, fields: F1 });
		expect(global.__calls).toHaveLength(1);
		expect(global.__calls[0].date).toBe('2026-03-01');
		expect(global.__calls[0].time).toBe('22:05:00');
	});

	test('改左栏本地时地草稿(不 dispatch)同样重算', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.changeGeo({ lng: 121.47, lat: 31.23, gpsLng: 121.47, gpsLat: 31.23 });   // 地名记录形状(lng 非 lon)
		await bump(i);
		expect(global.__calls).toHaveLength(1);
		expect(global.__calls[0].lon).toBe(convertLonToStr(121.47));
		expect(global.__calls[0].lat).toBe(convertLatToStr(31.23));
	});

	test('改完时地立刻点起盘:待触发的重排作废,只走那一次真起盘', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.props = { ...i.props, fields: F2 };
		i.componentDidUpdate({ ...PROPS, fields: F1 });   // 排下一拍重排
		await i.clickCast();                              // 用户抢先点了起盘
		jest.advanceTimersByTime(400);
		await flush();
		expect(global.__calls).toHaveLength(1);
	});

	test('连改多拍只打一次后端(防抖)', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.props = { ...i.props, fields: F2 };
		i.componentDidUpdate({ ...PROPS, fields: F1 });
		i.props = { ...i.props, fields: F3 };
		i.componentDidUpdate({ ...PROPS, fields: F2 });
		jest.advanceTimersByTime(400);
		await flush();
		expect(global.__calls).toHaveLength(1);
	});

	test('改问类 → 重算,且请求体带的是该问类的预设主宫', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.changeQuestionType('career');
		await flush();
		expect(global.__calls).toHaveLength(1);
		expect(global.__calls[0].questionType).toBe('career');
		expect(global.__calls[0].quesitedHouse).toBe(10);
	});

	test('改所问宫 → 重算(所问宫定的是判读主宫:法官/证人取谁、得地算哪一宫)', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.changeQuesitedHouse(7);
		await flush();
		expect(global.__calls).toHaveLength(1);
		expect(global.__calls[0].quesitedHouse).toBe(7);
		expect(global.__calls[0].questionType).toBe('custom');   // 手改即脱离预设
		expect(global.__calls[0].seed).toBe(42);                 // 卦没变
	});

	test('改转宫 → 重算(第四处钉种子逻辑已归一到同一入口)', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.setState({ turnTo: 4 }, () => i.recastPinned());
		await flush();
		expect(global.__calls).toHaveLength(1);
		expect(global.__calls[0].turnTo).toBe(4);
		expect(global.__calls[0].seed).toBe(42);
	});

	test('所问之事:失焦时与盘上那份不同才重排;相同则一次也不打后端', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		// 与盘上那份一致 → 不打
		i.setState({ question: LIVE.european_classical.reading.question || '' });
		i.commitQuestion();
		await flush();
		expect(global.__calls).toHaveLength(0);
		// 改了 → 打一次,且请求体带的是新问题
		i.setState({ question: '此事可成否' });
		i.commitQuestion();
		await flush();
		expect(global.__calls).toHaveLength(1);
		expect(global.__calls[0].question).toBe('此事可成否');
	});

	test('改流派/传本/行星盘 → 重算,且护盾盘钉住不动', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.changeGeomancyOpt('tradition', 'arabic_raml');
		await flush();
		i.changeGranular('markStyle', 'bindu');
		await flush();
		i.changePlanetaryOpt('planetaryChart', true);
		await flush();
		expect(global.__calls).toHaveLength(3);
		global.__calls.forEach((p) => expect(p.seed).toBe(42));
	});
});

describe('地占 · 一次起卦只占一条历史(重算不许把上限刷满)', () => {
	beforeEach(() => { window.localStorage.removeItem('horosaGeomancyHistory'); });

	test('钉盘重算多次 → 历史只留一条,且反映最新那份判读', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		i.pushHistory(LIVE.european_classical);                 // 真起盘那一条
		for (let k = 0; k < 5; k += 1) { i.pushHistory(LIVE.european_classical); }  // 五次重算
		expect(i.state.history).toHaveLength(1);
	});

	test('🔴 报数盘默认种子恒为 0:两组不同的十六数必须各占一条,不许被误当同一盘', async () => {
		const i = mk(LIVE.book_numbers, null, { fields: F1 });
		const a = JSON.parse(JSON.stringify(LIVE.book_numbers));
		a.reading.seed = 0; a.reading.settings.cast_numbers = new Array(16).fill(1);
		const b = JSON.parse(JSON.stringify(LIVE.book_numbers));
		b.reading.seed = 0; b.reading.settings.cast_numbers = new Array(16).fill(2);
		i.setState({ castNumbersText: '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1' });
		i.pushHistory(a);
		i.setState({ castNumbersText: '2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2' });
		i.pushHistory(b);
		expect(i.state.history).toHaveLength(2);
	});

	test('真换了一副卦(种子不同)则另起一条', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		const a = JSON.parse(JSON.stringify(LIVE.european_classical)); a.reading.seed = 111;
		const b = JSON.parse(JSON.stringify(LIVE.european_classical)); b.reading.seed = 222;
		i.pushHistory(a); i.pushHistory(b);
		expect(i.state.history).toHaveLength(2);
	});
});

describe('地占 · 不该重算的场合一次也不许打后端', () => {
	test('还没起盘时改任何设置都不打后端(左栏改动只是下一次起卦的草稿)', async () => {
		const i = mk(null, null, { fields: F1 });
		i.changeGeomancyOpt('tradition', 'arabic_raml');
		i.changeGranular('markStyle', 'bindu');
		i.props = { ...i.props, fields: F2 };
		await bump(i, { ...PROPS, fields: F1 });
		expect(global.__calls).toHaveLength(0);
	});

	test('🔴 时地无关的重渲染(打字/切页签/fields 换新引用但内容相同)不许重算', async () => {
		const i = mk(LIVE.european_classical, null, { fields: F1 });
		// 同内容、新引用 —— 全局 fields 会因无关 dispatch 换引用,按引用判即白打后端
		i.props = { ...i.props, fields: mkFields(2026, 8, 12, 10, 30, '119e19', '26n04') };
		await bump(i, { ...PROPS, fields: F1 });
		i.setState({ question: '打字中' });
		await bump(i);
		i.setState({ rightPanelTab: 'figures' });
		await bump(i);
		expect(global.__calls).toHaveLength(0);
	});

	test('🔴 载档那一拍不许重算 —— 存档盘须按原样立住,不得被重算覆盖', async () => {
		const i = mk(null, null, { fields: F1 });
		global.__mockCase = {
			caseVersion: 'geomancy|c1|t1|1',
			payload: { result: LIVE.book_numbers, options: { tradition: 'arabic_raml', quesitedHouse: 7 } },
		};
		i.props = { ...i.props, fields: F2 };                 // 载档也走 fields 变化这条通路
		await bump(i, { ...PROPS, fields: F1 });
		expect(global.__calls).toHaveLength(0);
		expect(i.state.result).toBe(LIVE.book_numbers);       // 存档盘原样立住
		// 且载档后签名已同步:下一拍不许被陈旧签名误触发
		await bump(i);
		expect(global.__calls).toHaveLength(0);
	});

	test('🔴 真机时序:载档会清掉本地时地草稿,那一拍签名必变 —— 仍不许重算覆盖存档盘', async () => {
		// 用户先在左栏改过时地(有草稿),再从事盘列表载入一条存档
		const i = mkAsync(null, { localFields: F3 }, { fields: F1 });
		global.__mockCase = {
			caseVersion: 'geomancy|c9|t9|1',
			payload: { result: LIVE.book_numbers, options: {} },
		};
		i.props = { ...i.props, fields: F2 };
		i.componentDidUpdate({ ...PROPS, fields: F1 });   // 载档:restore 排队清 localFields
		i.commitReact();                                  // 提交:清草稿生效 → 签名确实变了
		jest.advanceTimersByTime(400);
		await flush();
		expect(global.__calls).toHaveLength(0);           // 但一次也不许打后端
		expect(i.state.result).toBe(LIVE.book_numbers);   // 存档盘原样立住
		// 解禁之后,用户真去改时地仍要正常重排
		global.__mockCase = null;
		i.props = { ...i.props, fields: F3 };
		i.componentDidUpdate({ ...PROPS, fields: F2 });
		jest.advanceTimersByTime(400);
		await flush();
		expect(global.__calls).toHaveLength(1);
	});

	test('载档之后用户再改地点,仍按存档那副卦重排(卦不换,只换时地)', async () => {
		const i = mk(null, null, { fields: F1 });
		global.__mockCase = {
			caseVersion: 'geomancy|c1|t1|1',
			payload: { result: LIVE.book_numbers, options: {} },
		};
		i.props = { ...i.props, fields: F2 };
		await bump(i, { ...PROPS, fields: F1 });
		expect(global.__calls).toHaveLength(0);
		global.__mockCase = null;                             // 载档已完成
		i.props = { ...i.props, fields: F3 };
		await bump(i, { ...PROPS, fields: F2 });
		expect(global.__calls).toHaveLength(1);
		expect(global.__calls[0].castNumbers)
			.toEqual(LIVE.book_numbers.reading.settings.cast_numbers);   // 还是存档那副卦
	});
});
