// 「载入工作区」写前预览如实:命盘才提紫微(载入命盘时紫微左栏改按该盘记下的设置,你自己的设置另存,「新命盘」用回);
// 事盘不提紫微(事盘载入不还原紫微设置);不再说「再载入别的档即换回」(没记过紫微设置的旧盘载入后不换回)。
import { upsertLocalChart } from '../localcharts';
import { upsertLocalCase } from '../localcases';

describe('载入工作区预览', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });
	test('命盘提紫微、事盘不提;都不承诺「再载入别的档即换回」', ()=>{
		const mod = require('../aiTools/tools/loadRecordIntoWorkspace');
		const tool = Object.values(mod).find((v)=>v && typeof v === 'object' && v.name === 'load_record_into_workspace');
		expect(tool).toBeTruthy();
		upsertLocalChart({ cid: 'local-1-c', name: '甲', birth: '1990-01-01 12:00:00' });
		upsertLocalCase({ cid: 'local-2-k', event: '问事', divTime: '2026-01-01 12:00:00' });
		const pc = tool.preview({ cid: 'local-1-c' });
		const pk = tool.preview({ cid: 'local-2-k' });
		expect(pc.before).toContain('紫微左栏改按这张盘记下的排盘设置');
		expect(pk.before).not.toContain('紫微');
		[pc, pk].forEach((p)=>expect(p.before).not.toContain('即换回'));
	});
});
