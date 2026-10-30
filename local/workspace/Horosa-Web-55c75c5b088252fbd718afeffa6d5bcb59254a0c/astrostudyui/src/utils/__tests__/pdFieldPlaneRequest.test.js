// 推运页主限法表「方向」选 Field Plane(4)点计算:请求体必须带 pdtype 4(此前按 0/1 开关归一,恒被压成 0 → 选了等于没选)。
jest.mock('../astroAiSnapshot', ()=>({ ...jest.requireActual('../astroAiSnapshot'), saveAstroAISnapshot: jest.fn() }));

const CHART = { chart: { objects: [] }, params: { birth: '1990-01-01 08:00:00', lat: '31n14', lon: '121e28', zone: '+08:00' } };

function inst(params){
	const { AstroDirectMain } = require('../../components/direction/AstroDirectMain');
	const o = Object.create(AstroDirectMain.prototype);
	o.props = { fields: {}, chartObj: { ...CHART, params: { ...CHART.params, ...(params || {}) } } };
	o.state = { currentTab: 'primarydirect' };
	return o;
}

describe('主限法方向三值透传', ()=>{
	test.each([[0, 0], [1, 1], [4, 4], ['4', 4], [2, 0], [undefined, 0]])('override pdtype %p → 请求体 %p', (v, want)=>{
		const o = inst();
		expect(o.getDesiredPdConfig(o.props.chartObj, { pdtype: v }).pdtype).toBe(want);
	});
	test('已落库的 Field Plane 盘重算时仍是 4', ()=>{
		const o = inst({ pdtype: 4 });
		const req = o.buildPrimaryDirectionRequest(o.props.chartObj, {});
		expect(req.pdtype).toBe(4);
	});
});
