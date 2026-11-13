// 时主轮转页的查看状态:换盘、改目标时刻、切方法时不留旧的展开行和月亮日的盘。
import { natalSourceKey } from '../../../utils/derivedChartSource';

global.React = require('react');

jest.mock('../../../services/astro', ()=>({ __esModule: true, fetchChart: jest.fn() }));
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn() }));
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ __esModule: true, saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn() }));

const { fetchChart } = require('../../../services/astro');
const { AstroTimeLords } = require('../AstroDirectedFigures');

function chartOf(birth, extra){
	return { params: { birth, date: birth.split(' ')[0], time: birth.split(' ')[1], zone: '+08:00', lat: '26n04', lon: '119e19', hsys: 1, zodiacal: 0, ...(extra || {}) }, chart: { objects: [], houses: [] } };
}
function page(props, state){
	const inst = Object.create(AstroTimeLords.prototype);
	inst.props = props;
	inst.state = { tlOpenRow: -1, tlMoonRow: -1, tlMoonChart: null, tlMoonSig: '', tlMethod: 'moondays', targetDate: '2026-01-01', targetTime: '12:00:00', ...(state || {}) };
	inst._mounted = true;
	inst.load = jest.fn();
	inst.setState = (u)=>{ inst.state = { ...inst.state, ...(typeof u === 'function' ? u(inst.state) : u) }; };
	return inst;
}
function update(inst, nextProps, nextState){
	const prevProps = inst.props;
	const prevState = inst.state;
	if(nextProps){ inst.props = nextProps; }
	if(nextState){ inst.state = { ...inst.state, ...nextState }; }
	inst.componentDidUpdate(prevProps, prevState);
}

describe('时主轮转页的查看状态', ()=>{
	const A = chartOf('2000-01-01 12:00:00');
	const B = chartOf('1990-06-01 08:00:00');
	beforeEach(()=>{ fetchChart.mockReset(); });

	test('换盘清掉展开行和月亮日的盘', ()=>{
		const inst = page({ value: A }, { tlOpenRow: 3, tlMoonRow: 1, tlMoonChart: { chart: {} } });
		update(inst, { value: B });
		expect(inst.state).toMatchObject({ tlOpenRow: -1, tlMoonRow: -1, tlMoonChart: null });
	});

	test('只改宫制也算换盘,盘要重取', ()=>{
		const inst = page({ value: A }, { tlMoonRow: 1, tlMoonChart: { chart: {} } });
		update(inst, { value: chartOf('2000-01-01 12:00:00', { hsys: 3 }) });
		expect(inst.state.tlMoonRow).toBe(-1);
		expect(inst.state.tlMoonChart).toBeNull();
	});

	test('改目标时刻回到当前段', ()=>{
		const inst = page({ value: A }, { tlOpenRow: 3 });
		update(inst, null, { targetDate: '2030-01-01' });
		expect(inst.state.tlOpenRow).toBe(-1);
	});

	test('同一张盘重渲不动查看状态', ()=>{
		const inst = page({ value: A }, { tlOpenRow: 3, tlMoonRow: 1 });
		const same = chartOf('2000-01-01 12:00:00');
		update(inst, { value: same });
		expect(inst.state).toMatchObject({ tlOpenRow: 3, tlMoonRow: 1 });
	});

	test('展开行超出新表时回落当前段', ()=>{
		const inst = page({ value: A }, { tlOpenRow: 22 });
		const rows = [{ lord: 'Sun', children: [{ lord: 'Sun' }] }, { lord: 'Moon', children: [{ lord: 'Moon' }] }];
		const cards = inst.renderPeriods({ rows, currentIndex: 1, method: 'quarters' });
		expect(cards).toHaveLength(2);
		expect(cards[1].props.extra).toContain('月');
	});

	test('月亮日点一行取该时刻的盘,再点一次回本命盘', async ()=>{
		const chart = { params: {}, chart: {} };
		fetchChart.mockResolvedValue({ Result: chart });
		const inst = page({ value: A });
		await inst.toggleMoonChart(1, { date: '2026-11-14 18:02:08' });
		expect(fetchChart.mock.calls[0][0]).toMatchObject({ date: '2026-11-14', time: '18:02:08', lat: '26n04', hsys: 1 });
		expect(inst.state.tlMoonRow).toBe(1);
		expect(inst.state.tlMoonChart).toBeTruthy();
		await inst.toggleMoonChart(1, { date: '2026-11-14 18:02:08' });
		expect(inst.state.tlMoonRow).toBe(-1);
		expect(fetchChart).toHaveBeenCalledTimes(1);
	});

	test('取盘途中换盘,晚到的盘不落地', async ()=>{
		let finish;
		fetchChart.mockReturnValue(new Promise((resolve)=>{ finish = resolve; }));
		const inst = page({ value: A });
		const pending = inst.toggleMoonChart(0, { date: '2026-11-09 18:10:00' });
		update(inst, { value: B });
		finish({ Result: { chart: {} } });
		await pending;
		expect(inst.state.tlMoonChart).toBeNull();
		expect(inst.state.tlMoonRow).toBe(-1);
	});

	test('取盘失败回到本命盘', async ()=>{
		fetchChart.mockRejectedValue(new Error('x'));
		const inst = page({ value: A });
		await inst.toggleMoonChart(0, { date: '2026-11-09 18:10:00' });
		expect(inst.state.tlMoonRow).toBe(-1);
	});

	test('别的方法下左边始终是本命盘', ()=>{
		const moon = { params: {}, chart: {} };
		const sig = natalSourceKey(A);
		const inst = page({ value: A }, { tlMethod: 'turn', tlMoonRow: 1, tlMoonChart: moon, tlMoonSig: sig });
		expect(inst.renderWheel(null, 0, 300).props.value).toBe(A);
		inst.state.tlMethod = 'moondays';
		expect(inst.renderWheel(null, 0, 300).props.value).toBe(moon);
	});

	test('月亮日不显示时间选择', ()=>{
		expect(page({ value: A }).hasTime()).toBe(false);
		expect(page({ value: A }, { tlMethod: 'turn' }).hasTime()).toBe(true);
	});
});
