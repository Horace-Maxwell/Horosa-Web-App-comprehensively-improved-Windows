// 用全局单例做临时覆盖的技法构造不可交错:同技法排队、不同技法照旧并行;紫微快照构造器自身排队(覆盖全部入口)。
// 病形:紫微构造器 await 后端期间临时改写全局四化流派,双盘挂载时本人与对方的预览同时构造 → 后者拿着前者的临时流派排盘。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn() }));
import request from '../request';
import { withSerialTechniqueBuild } from '../aiAnalysisContext';
import { buildZiweiSnapshotForParams } from '../../components/ziwei/ZiWeiMain';
import * as ZWConst from '../../constants/ZWConst';

const tick = (ms)=>new Promise((r)=>setTimeout(r, ms));

test('同技法排队、不同技法并行、非单例技法直通;前一个抛错不卡住后一个', async ()=>{
	const log = [];
	const job = (tag, ms, fail)=>async ()=>{ log.push(`${tag}:start`); await tick(ms); log.push(`${tag}:end`); if(fail){ throw new Error(tag); } return tag; };
	const p1 = withSerialTechniqueBuild('ziwei', job('z1', 20, true));
	const p2 = withSerialTechniqueBuild('ziwei', job('z2', 1));
	const p3 = withSerialTechniqueBuild('guolao', job('g1', 5));
	const p4 = withSerialTechniqueBuild('bazi', job('b1', 1));
	await expect(p1).rejects.toThrow('z1');
	await expect(p2).resolves.toBe('z2');
	await Promise.all([p3, p4]);
	expect(log.indexOf('z2:start')).toBeGreaterThan(log.indexOf('z1:end'));
	expect(log.indexOf('g1:start')).toBeLessThan(log.indexOf('z1:end'));
	expect(log.indexOf('b1:start')).toBeLessThan(log.indexOf('z1:end'));
});

test('紫微快照构造器排队:两次并发构造各自用自己的四化流派发请求,结束后全局流派复原', async ()=>{
	const seen = [];
	request.mockImplementation(async (url, opts)=>{ const body = JSON.parse(opts.body); seen.push({ school: ZWConst.ZWSchool.school, sihua: !!body.sihua }); await tick(10); return {}; });
	const before = ZWConst.ZWSchool.school;
	const base = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '121e28', lat: '31n14', gender: 1, timeAlg: 0 };
	await Promise.all([
		buildZiweiSnapshotForParams({ ...base, sihuaSchool: 'zhongzhou' }),
		buildZiweiSnapshotForParams({ ...base }),
	]);
	expect(seen.map((x)=>x.school)).toEqual(['zhongzhou', before]);
	expect(ZWConst.ZWSchool.school).toBe(before);
});
