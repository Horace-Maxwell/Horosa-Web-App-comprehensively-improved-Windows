// 版本历史去抖:5 分钟内连续保存,留的是这一串修改开始之前的那一版(改错前的原版),不是中间版
import { upsertLocalChart } from '../localcharts';
import { listRecordRevisions, __resetRevisionsForTests } from '../recordRevisions';

beforeEach(()=>{
	window.localStorage.clear();
	__resetRevisionsForTests();
});

test('🔴 连改三次:历史里是「原版」,不是「误改」', async ()=>{
	upsertLocalChart({ cid: 'rv-burst', name: '原版', birth: '1990-01-01 08:00:00', memo: '原备注' });
	upsertLocalChart({ cid: 'rv-burst', name: '误改', birth: '1990-01-01 03:00:00' });
	upsertLocalChart({ cid: 'rv-burst', name: '再改名' });
	await new Promise((r)=>setTimeout(r, 20));
	const revs = await listRecordRevisions('chart', 'rv-burst');
	expect(revs.map((x)=>x.record.name)).toEqual(['原版']);
	expect(revs[0].record.birth).toBe('1990-01-01 08:00:00');
});
