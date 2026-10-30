// 迫星扩展勾「恒星」:引擎出 FS_(合 / 冲)、FSD_(右相位)、FSS_(左相位)三种前缀;表格与 AI 快照都要放行三种
// (此前两处手写正则只认 FS_ → 恒星相位行全被当成 core 不支持行滤掉,界面上:引擎 1759 行表格只显 997 行)。
import fs from 'fs';
import path from 'path';
import { isPdExtensionPromissorId, PD_EXTENSION_PROMISSOR_HEADS, PD_STAR_ID_HEADS } from '../primaryDirectionSync';
import { buildPrimaryDirectSnapshotText } from '../../components/direction/AstroDirectMain';

describe('恒星迫星相位行放行', ()=>{
	test('放行表含恒星三种前缀与其余扩展前缀;行星前缀不放行', ()=>{
		Object.keys(PD_STAR_ID_HEADS).forEach((h)=>expect(PD_EXTENSION_PROMISSOR_HEADS).toContain(h));
		['FS_Regulus_0', 'FSD_Spica_60', 'FSS_Algol_90', 'HC_Cusp2_0', 'LT_Pars Spirit_0', 'PD_Mars_0'].forEach((id)=>expect(isPdExtensionPromissorId(id)).toBe(true));
		['N_Mars_0', 'D_Venus_60', 'S_Moon_120', 'T_Mars_Leo', 'C_Sun', ''].forEach((id)=>expect(isPdExtensionPromissorId(id)).toBe(false));
	});
	test('引擎产出的恒星迫星前缀都在放行表里(与 perpredict._PD_STAR_PROM_PREFIX 对拍)', ()=>{
		const py = fs.readFileSync(path.join(__dirname, '../../../../astropy/astrostudy/perpredict.py'), 'utf8');
		const m = /_PD_STAR_PROM_PREFIX = \{([^}]+)\}/.exec(py);
		expect(m).toBeTruthy();
		const heads = [...m[1].matchAll(/:\s*'([A-Z]+)'/g)].map((x)=>x[1]);
		expect(heads.length).toBeGreaterThanOrEqual(3);
		heads.forEach((h)=>expect(PD_EXTENSION_PROMISSOR_HEADS).toContain(h));
	});
	test('AI 快照:恒星右 / 左相位行与合相行一样写进表', ()=>{
		const chart = {
			params: { birth: '1990-05-18 12:00:00', zone: '+08:00', lat: '31N14', lon: '121E28', pdMethod: 'core_alchabitius', pdTimeKey: 'Ptolemy', pdtype: 0, pdPromissorTypes: ['stars'] },
			predictives: { primaryDirection: [
				[0.31, 'FSD_Spica_60', 'N_Jupiter_0', 'Z', '1990-09-10 00:00:00'],
				[0.52, 'FSS_Capella_120', 'N_Venus_0', 'Z', '1990-11-20 00:00:00'],
				[0.70, 'FS_Regulus_0', 'N_Sun_0', 'Z', '1991-02-01 00:00:00'],
			] },
		};
		const rows = buildPrimaryDirectSnapshotText(chart).split('\n').filter((l)=>/^\| \S+度/.test(l));
		expect(rows.filter((l)=>l.indexOf('| 恒星') >= 0).length).toBe(3);   // 右相位 / 左相位 / 合相三行都在
		expect(rows.some((l)=>/恒星 \S+的60度右相位处/.test(l))).toBe(true);
		expect(rows.some((l)=>/恒星 \S+的120度左相位处/.test(l))).toBe(true);
	});
});
