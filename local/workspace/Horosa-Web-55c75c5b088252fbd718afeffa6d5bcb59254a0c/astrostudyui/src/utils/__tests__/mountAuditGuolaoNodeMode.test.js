// [挂载自检 F-14·P0 / F-16] 七政无头快照:罗计换位与页面同源;宿度制白名单单源。
// 真栈实抓背景:页面存快照前 applyGuolaoNodeMode(北罗南计=深换 NORTH/SOUTH_NODE id),无头此前喂原始 /chart result →
// 快照 [起盘信息] 标「北罗南计」而各表罗/计仍在北计南罗位置。判别向量:把 buildGuolaoSnapshotForFields 里的
// display 改回 result 即红(第二例);把白名单改回 [0..7] 即红(第三例)。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: null })) }));
jest.mock('../../services/qizheng', () => ({
	fetchKinastroQizheng: jest.fn(), fetchQizhengElection: jest.fn(),
	fetchMoiraQizhengRules: jest.fn(async () => { throw new Error('offline'); }),
}));
import request from '../request';
import * as AstroConst from '../../constants/AstroConst';
import { applyGuolaoNodeMode, guolaoSu28ModeFromFields, buildGuolaoSnapshotForFields } from '../../components/guolao/GuoLaoChartMain';
import { GUOLAO_NODE_MODE_NORTH_RAHU, GUOLAO_NODE_MODE_NORTH_KETU } from '../../components/guolao/GuoLaoChartStyle';
import { GL_DIGNITY_RESULT } from '../../components/guolao/__tests__/fixtures/guolaoSnapshotInputs';

const fieldsOf = (extra)=>({
	date: { value: { format: ()=>'1990/05/18' } }, time: { value: { format: ()=>'10:00:00' } },
	zone: { value: '+08:00' }, lon: { value: '118e27' }, lat: { value: '31n38' }, gpsLon: { value: 118.45 }, gpsLat: { value: 31.63 },
	gender: { value: 1 }, ad: { value: 1 }, hsys: { value: 1 }, zodiacal: { value: 0 }, doubingSu28: { value: 2 },
	name: { value: 'QA' }, pos: { value: '' }, tradition: { value: 1 }, simpleAsp: { value: 0 }, strongRecption: { value: 0 }, virtualPointReceiveAsp: { value: 0 },
	...extra,
});

beforeEach(()=>{ window.localStorage.clear(); request.mockClear(); });

it('applyGuolaoNodeMode:北罗南计深换罗/计 id(含键名),北计南罗(默认)不动', ()=>{
	const src = { chart: { objects: [{ id: AstroConst.NORTH_NODE, lon: 195 }, { id: AstroConst.SOUTH_NODE, lon: 15 }], aspects: { [AstroConst.NORTH_NODE]: { x: 1 } } } };
	const swapped = applyGuolaoNodeMode(src, fieldsOf({ guolaoNodeMode: { value: GUOLAO_NODE_MODE_NORTH_RAHU } }));
	expect(swapped.chart.objects[0].id).toBe(AstroConst.SOUTH_NODE);
	expect(swapped.chart.objects[1].id).toBe(AstroConst.NORTH_NODE);
	expect(Object.keys(swapped.chart.aspects)).toEqual([AstroConst.SOUTH_NODE]);
	expect(src.chart.objects[0].id).toBe(AstroConst.NORTH_NODE);   // 不改原对象
	const same = applyGuolaoNodeMode(src, fieldsOf({ guolaoNodeMode: { value: GUOLAO_NODE_MODE_NORTH_KETU } }));
	expect(same.chart.objects[0].id).toBe(AstroConst.NORTH_NODE);
});

it('🔴 无头 buildGuolaoSnapshotForFields:北罗南计时快照里罗/计地支互换(与页面同源;rules 离线走本地兜底)', async ()=>{
	request.mockImplementation(async ()=>({ Result: JSON.parse(JSON.stringify(GL_DIGNITY_RESULT)) }));
	const rowOf = (txt, name)=>`${txt}`.split('\n').find((l)=>l.startsWith(`| ${name} |`)) || '';
	const a = await buildGuolaoSnapshotForFields(fieldsOf({ guolaoNodeMode: { value: GUOLAO_NODE_MODE_NORTH_KETU } }));
	const b = await buildGuolaoSnapshotForFields(fieldsOf({ guolaoNodeMode: { value: GUOLAO_NODE_MODE_NORTH_RAHU } }));
	expect(a).toContain('罗计：北计南罗');
	expect(b).toContain('罗计：北罗南计');
	const aLuo = rowOf(a, '罗'), aJi = rowOf(a, '计'), bLuo = rowOf(b, '罗'), bJi = rowOf(b, '计');
	expect(aLuo && aJi && bLuo && bJi).toBeTruthy();
	// 换位后:罗的地支 = 换位前计的地支,反之亦然(取第二列 地支)
	const zhi = (row)=>row.split('|').map((x)=>x.trim())[2];
	expect(zhi(bLuo)).toBe(zhi(aJi));
	expect(zhi(bJi)).toBe(zhi(aLuo));
	expect(zhi(aLuo)).not.toBe(zhi(aJi));
});

it('🔴 宿度制白名单单源:fields=8(赤道回归实时)按 8,不再回退全局;非法值回退全局', ()=>{
	expect(guolaoSu28ModeFromFields(fieldsOf({ doubingSu28: { value: 8 } }))).toBe(8);
	expect(guolaoSu28ModeFromFields(fieldsOf({ doubingSu28: { value: 0 } }))).toBe(0);
	window.localStorage.setItem('horosaGuolaoSu28Mode', '5');
	expect(guolaoSu28ModeFromFields(fieldsOf({ doubingSu28: { value: 99 } }))).toBe(5);
	expect(guolaoSu28ModeFromFields(fieldsOf({ doubingSu28: { value: null } }))).toBe(5);
});
