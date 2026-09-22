// [挂载自检 F-08·P0] 七政无头快照的宿度制回退口径 = 七政页口径(record 缺席 → 全局现值,缺省 2 回归今宿)。
// 真栈实抓(2026-09-10 预览):同一张无 doubingSu28 的命盘,七政页快照「宿度制:回归今宿」、AI 挂载无头快照
// 「宿度制:荀爽距星(19年测)」——buildFieldObject 把缺席当 0(0 是真实档位)。判别向量:改回 `?? 0` 本文件即红。
import { resolveGuolaoFields } from '../aiAnalysisContext';
import { GUOLAO_DEFAULT_SU28_MODE } from '../../components/guolao/GuoLaoChartStyle';

const REC = { cid: 'c1', name: '审计', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };

beforeEach(()=>{ window.localStorage.clear(); });

it('🔴 record 缺 doubingSu28 + 全局未设 → 全局缺省(2 回归今宿),不是 0(荀爽距星)', ()=>{
	const f = resolveGuolaoFields({ ...REC });
	expect(f.doubingSu28.value).toBe(GUOLAO_DEFAULT_SU28_MODE);
	expect(GUOLAO_DEFAULT_SU28_MODE).toBe(2);
});

it('🔴 record 缺 doubingSu28 + 全局已选 5 → 跟全局现值(与七政页 guolaoSu28ModeFromFields 回退同口径)', ()=>{
	window.localStorage.setItem('horosaGuolaoSu28Mode', '5');
	expect(resolveGuolaoFields({ ...REC }).doubingSu28.value).toBe(5);
});

it('record 显式存 0(荀爽距星)→ 仍按 0;存 3 → 3(存档优先于全局)', ()=>{
	window.localStorage.setItem('horosaGuolaoSu28Mode', '5');
	expect(resolveGuolaoFields({ ...REC, doubingSu28: 0 }).doubingSu28.value).toBe(0);
	expect(resolveGuolaoFields({ ...REC, doubingSu28: 3 }).doubingSu28.value).toBe(3);
	expect(resolveGuolaoFields({ ...REC, doubingSu28: '' }).doubingSu28.value).toBe(5);
});
