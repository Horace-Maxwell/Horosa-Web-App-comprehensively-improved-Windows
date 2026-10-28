// 六壬择日存案带日界:全局日界设成「24 点算第二天」(after23NewDay = 0)时,在六壬择日里存案 →
// payload.fieldSnapshot.after23NewDay === 0;之后全局改回 23 点,载入这条 → 内嵌页覆盖层、底盘请求与起课字段的日界都是 0(同值)。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
const path = require('path');
const { setGlobalStore } = require('../../../utils/storageutil');
const { caseFieldSnapshot, getKentangSavedCaseFieldsPatch } = require('../../../utils/kentangCaseSave');
const astroService = require('../../../services/astro');
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读

const setBoundary = (b)=>localStorage.setItem('globalSetup', JSON.stringify({ dayBoundary: b }));
function mkHost(){
	const LiurengZeriMain = require('../LiurengZeriMain').default;
	const h = new LiurengZeriMain({ dispatch: jest.fn() });
	h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
	return h;
}

afterEach(()=>{ localStorage.removeItem('globalSetup'); setGlobalStore({}); jest.clearAllMocks(); });

test('全局日界 0 时存案 → 快照日界 0;全局改回后载入 → 覆盖层 / 底盘请求 / 起课字段日界同为 0', ()=>{
	setBoundary('after24');
	const h = mkHost();
	const flds = h.buildFields(false);
	expect(flds.after23NewDay.value).toBe(0);
	const snap = caseFieldSnapshot(flds);
	expect(snap.after23NewDay).toBe(0);
	// 内嵌六壬页存案就用这份(源码锚:存案 fieldSnapshot 出自起课所用 fields)
	const lr = readSource(path.join(__dirname, '../../lrzhan/LiuRengMain.js'));
	expect(lr).toContain('payload: { ...payload, fieldSnapshot: caseFieldSnapshot(flds) },');
	// 之后全局改回 23 点,显式载入这条
	setBoundary('after23');
	setGlobalStore({ user: { caseApplySeq: 1, appliedCaseCid: 'lrz-1', currentCase: {
		cid: { value: 'lrz-1' }, updateTime: { value: 't' }, caseType: { value: 'liurengzeri' }, sourceModule: { value: 'liurengzeri' },
		divTime: { value: flds.date.value }, zone: { value: '+08:00' }, lon: { value: '116e28' }, lat: { value: '39n54' }, gpsLon: { value: 116.46 }, gpsLat: { value: 39.9 }, pos: { value: '北京' },
		payload: { value: JSON.stringify({ module: 'liurengzeri', fieldSnapshot: snap }) } } } });
	const patch = getKentangSavedCaseFieldsPatch('liurengzeri');
	expect(patch.after23NewDay.value).toBe(0);
	const h2 = mkHost();
	expect(h2.buildFields(false).after23NewDay.value).toBe(1);   // 全局现值
	h2.state.embedPatch = patch;                                  // 内嵌页载入存案:覆盖层换成存案那一刻
	expect(h2.buildFields(false).after23NewDay.value).toBe(0);   // 起课字段
	h2.requestChartAndPlot(false, { chartOnly: true });
	const param = astroService.fetchChart.mock.calls[astroService.fetchChart.mock.calls.length - 1][0];
	expect(param.after23NewDay).toBe(0);                          // 底盘请求
});
