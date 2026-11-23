// 随机起的太玄 / 荆诀存进事盘的种子是一段真随机记录(不是数字)。AI 挂载按存档重算时必须把这条记录原样交给引擎回放:
// 当数字取会得 NaN → 落回「按起课时间派生」→ 挂载出来的是另一卦。手填整数种子与留空(按时间派生)照旧。
import { buildTaiXuanSnapshotForFields } from '../../components/taixuan/TaiXuanMain';
import { buildJingJueSnapshotForFields } from '../../components/jingjue/JingJueMain';

let sent = [];
beforeEach(()=>{
	sent = [];
	global.fetch = jest.fn(async (url, init)=>{
		let body = {};
		try{ body = init && init.body ? JSON.parse(init.body) : {}; }catch(e){ body = {}; }
		sent.push(body);
		return { text: async ()=>JSON.stringify({ Result: { snapshot: `种子=${body.seed}`, seed: body.seed } }) };
	});
});

const fields = { date: { value: { format: ()=>'2026-07-18' } }, time: { value: { format: ()=>'12:00:00' } }, zone: { value: '+08:00' } };
const RECORD = `tr1-${'9f3a12cd'.repeat(8)}`;

describe.each([
	['太玄', buildTaiXuanSnapshotForFields],
	['荆诀', buildJingJueSnapshotForFields],
])('%s 挂载重算的种子', (label, build)=>{
	test('存档里的真随机记录原样下发', async ()=>{
		await build(fields, { seed: RECORD });
		expect(sent).toHaveLength(1);
		expect(sent[0].seed).toBe(RECORD);
	});
	test('手填整数种子(含 0)照旧取整下发', async ()=>{
		await build(fields, { seed: 12345 });
		await build(fields, { seed: '0' });
		expect(sent.map((b)=>b.seed)).toEqual([12345, 0]);
	});
	test('留空 = 按起课时间派生(同一时间恒同一个数)', async ()=>{
		const a = await build(fields, { seed: '' });
		const b = await build(fields, {});
		expect(typeof sent[0].seed).toBe('number');
		expect(b).toBe(a);   // 同一请求体第二次可能直接取缓存,不一定再发;结果必须相同
		sent.forEach((body)=>expect(body.seed).toBe(sent[0].seed));
	});
});
