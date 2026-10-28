// 三式合一切「时间算法」:只写本页 localFields(不写共用字段),已起盘时立即按新口径重算重画。
import SanShiUnitedMain from '../SanShiUnitedMain';

function makeHost(hasPlotted){
	const h = Object.create(SanShiUnitedMain.prototype);
	h.props = { fields: { date: { value: null } } };
	h.state = { hasPlotted, options: { timeAlg: 0 }, localFields: { date: { value: null } } };
	h.setState = function(p, cb){
		const patch = typeof p === 'function' ? p(this.state) : p;
		if(patch){ this.state = { ...this.state, ...patch }; }
		if(cb){ cb(); }
	};
	h.panCache = new Map();
	h.taiyiCache = new Map();
	h.prefetchNongliForFields = jest.fn();
	h.prefetchJieqiSeedForFields = jest.fn();
	h.refreshAll = jest.fn();
	h.onFieldsChange = jest.fn();
	h.usesSavedSettings = () => false;
	return h;
}

describe('三式合一切换时间算法', () => {
	it('已起盘:按新口径 refreshAll(force) 一次,且不走共用字段通道', () => {
		const h = makeHost(true);
		h.onTimeAlgChange(1);
		expect(h.state.options.timeAlg).toBe(1);
		expect(h.refreshAll).toHaveBeenCalledTimes(1);
		const [fields, force] = h.refreshAll.mock.calls[0];
		expect(fields.timeAlg.value).toBe(1);
		expect(force).toBe(true);
		expect(h.onFieldsChange).not.toHaveBeenCalled();
		expect(h.lastKey).toBe('');
		expect(h.lastRecalcSignature).toBe('');
	});

	it('未起盘:只换口径与预取,不起算', () => {
		const h = makeHost(false);
		h.onTimeAlgChange(1);
		expect(h.state.options.timeAlg).toBe(1);
		expect(h.refreshAll).not.toHaveBeenCalled();
		expect(h.prefetchNongliForFields).toHaveBeenCalledTimes(1);
	});
});
