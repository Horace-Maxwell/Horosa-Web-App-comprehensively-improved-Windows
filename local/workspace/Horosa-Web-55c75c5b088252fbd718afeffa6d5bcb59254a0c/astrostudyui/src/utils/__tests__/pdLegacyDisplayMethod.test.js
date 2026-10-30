// 从工具条「弧算法」选 Horosa原方法(pdProjection)与旧单维键 pdMethod 选它是同一种算法(引擎两路逐行相同),
// 表格 / AI 快照 / 主限法盘的显示口径也必须相同:列头「赤经」、不按 core 白名单滤掉原方法独有的行。
import { pdDisplayMethod } from '../primaryDirectionSync';
import { buildPrimaryDirectSnapshotText } from '../../components/direction/AstroDirectMain';

const ROWS = [
	[0.73, 'S_Pluto_60', 'N_Neptune_0', 'Z', '2027-07-22 00:39:28'],
	[0.92, 'N_Purple Clouds_180', 'N_MC_0', 'Z', '2027-09-29 12:30:45'],
	[1.10, 'N_Dark Moon_0', 'N_Sun_0', 'Z', '2027-12-01 08:00:00'],
];
const chart = (params)=>({
	params: { birth: '2026-10-29 14:32:13', zone: '+08:00', lat: '26n04', lon: '119e19', pdTimeKey: 'Ptolemy', pdtype: 0, ...params },
	predictives: { primaryDirection: ROWS },
});

describe('Horosa原方法显示口径:两种选法一致', ()=>{
	test('pdDisplayMethod:弧算法选到 Horosa原方法即按原方法显示', ()=>{
		expect(pdDisplayMethod('core_alchabitius', 'horosa_legacy')).toBe('horosa_legacy');
		expect(pdDisplayMethod('horosa_legacy', 'ptolemy')).toBe('horosa_legacy');
		expect(pdDisplayMethod('core_alchabitius', 'placidus')).toBe('core_alchabitius');
		expect(pdDisplayMethod(undefined, undefined)).toBe('core_alchabitius');
	});
	test('AI 快照:弧算法选 Horosa原方法 = 旧键选它(列头赤经、原方法独有行不滤)', ()=>{
		const viaProjection = buildPrimaryDirectSnapshotText(chart({ pdMethod: 'core_alchabitius', pdProjection: 'horosa_legacy' }));
		const viaMethod = buildPrimaryDirectSnapshotText(chart({ pdMethod: 'horosa_legacy' }));
		const strip = (t)=>t.split('\n').filter((l)=>!/弧算法|方位法|方法/.test(l)).join('\n');
		expect(strip(viaProjection)).toBe(strip(viaMethod));
		expect(viaProjection).toContain('赤经');
		const core = buildPrimaryDirectSnapshotText(chart({ pdMethod: 'core_alchabitius', pdProjection: 'ptolemy' }));
		expect(core.split('\n').length).toBeLessThan(viaProjection.split('\n').length);   // core 口径滤掉紫气 / 暗月行
	});
});
