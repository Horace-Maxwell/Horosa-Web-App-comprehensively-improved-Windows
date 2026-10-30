// horosa_shallow_scu_v1 × v3.13.0 新 prop pdExtra(Windows overlay 用例,gotcha #114):主限天球的 sCU 逐键按引用比,
// 而上游 v3.13.0 新增的 pdExtra 由宿主每次 render 经 pickPdExtraSettings 现建 —— 引用恒新 ⇒ sCU 永远放行
// (时间轴车道排布与工具条随宿主每次重渲,正是这层 sCU 要省掉的成本)。pdExtra 在天球里只按值读,
// 故按归一键比:值相同的新对象跳过、设置真变了重渲;其余键仍按引用(不可能漏更新)。
jest.mock('../PDSphereEngine', ()=>function PDSphereEngine(){});
jest.mock('../../../utils/request', ()=>jest.fn());

import AstroPDSphere from '../AstroPDSphere';
import { pickPdExtraSettings } from '../../../utils/primaryDirectionSync';

const STATE = { loading: false };
const scu = (props, nextProps)=>AstroPDSphere.prototype.shouldComponentUpdate.call({ props, state: STATE }, nextProps, STATE);

describe('主限天球 sCU × pdExtra', ()=>{
	test('宿主重渲时值相同的新 pdExtra 对象 → 跳过', ()=>{
		const base = { pdMethod: 'ptolemy', pdtype: 0, pdExtra: pickPdExtraSettings({}) };
		expect(scu(base, { ...base, pdExtra: pickPdExtraSettings({}) })).toBe(false);
	});

	test('设置登记表的值真变了 → 重渲', ()=>{
		const base = { pdMethod: 'ptolemy', pdtype: 0, pdExtra: pickPdExtraSettings({}) };
		expect(scu(base, { ...base, pdExtra: pickPdExtraSettings({ pdAspectSide: 1 }) })).toBe(true);
		expect(scu(base, { ...base, pdExtra: pickPdExtraSettings({ pdGeometry: 'classic' }) })).toBe(true);
	});

	test('其余键仍按引用比(新数组即重渲),键数不同即重渲', ()=>{
		const base = { pdMethod: 'ptolemy', rows: [], pdExtra: pickPdExtraSettings({}) };
		expect(scu(base, { ...base, rows: [] })).toBe(true);
		expect(scu(base, { ...base, extraKey: 1 })).toBe(true);
	});
});
