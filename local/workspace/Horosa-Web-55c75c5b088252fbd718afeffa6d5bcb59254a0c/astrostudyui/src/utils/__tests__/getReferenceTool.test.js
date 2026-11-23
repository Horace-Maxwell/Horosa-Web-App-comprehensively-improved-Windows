// get_reference:辅助页三张参考表,与页面同一组接口;八卦类象的派生卦与页面 DoubleMeiyiGuaSym 同一组卦名。
jest.mock('../request', ()=>jest.fn());
import * as Constants from '../constants';
import getReference, { derivedGuaNames } from '../aiTools/tools/getReference';

const request = require('../request');
const ok = (result)=>Promise.resolve({ [Constants.ResultKey]: result });

describe('get_reference', ()=>{
	beforeEach(()=>request.mockReset());
	test('派生卦:泰(初爻在前 111000)', ()=>{
		const n = derivedGuaNames([1, 1, 1, 0, 0, 0]);
		expect(n.本卦).toBe('111000');
		expect(n.错卦).toBe('000111');
		expect(n.综卦).toBe('000111');
		expect(n.互卦).toBe('110100');   // 归妹:二三四爻为下、三四五爻为上
	});
	test('guasym 缺 yao → 参数错;给了按派生卦名取', async ()=>{
		expect((await getReference.run({ table: 'guasym' })).code).toBe('E_ARGS_INVALID');
		request.mockImplementation((url, init)=>{ const names = JSON.parse(init.body).name; const res = {}; names.forEach((k)=>{ res[k] = { name: k }; }); return ok(res); });
		const r = await getReference.run({ table: 'guasym', yao: '111000' });
		expect(r.ok).toBe(true);
		expect(request.mock.calls[0][0]).toMatch(/\/gua\/desc$/);
		expect(JSON.parse(r.data.content).本卦).toEqual({ name: '111000' });
	});
	test('cuangong12 带 char 加查该字;pithy 出口诀', async ()=>{
		request.mockImplementation((url)=>(/gong12gods$/.test(url) ? ok({ stars: [{ name: '太岁' }], starSu: {}, starTypeSu: {} }) : (/gong12$/.test(url) ? ok({ gong12: { 干: ['x'] } }) : ok({ pithy: { 三字诀: {} } }))));
		const c = await getReference.run({ table: 'cuangong12', char: '甲' });
		expect(JSON.parse(c.data.content)['查「甲」']).toEqual({ 干: ['x'] });
		const p = await getReference.run({ table: 'pithy' });
		expect(JSON.parse(p.data.content)).toEqual({ 口诀: { 三字诀: {} } });
	});
	test('后端没回 → 可重试失败', async ()=>{
		request.mockResolvedValue(undefined);
		const r = await getReference.run({ table: 'pithy' });
		expect(r.ok).toBe(false);
		expect(r.retryable).toBe(true);
	});
});
