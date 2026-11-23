// 报数起卦(cast_divination_case 的挂载键类型):报出的键要配上级项才生效时 ——
// 只有一档能让它生效(奇门报数 ⇐ 起局 = 数字起局)就一并按这一档起并注明;多档(六壬演数 / 报数两种起法)让调用方选;
// 格式目录写明「须配」哪一档;给的全是「按时间 / 自动」档时直说没报出结果,不说成「一个都没给」。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
import { CAST_SPECS, buildCastCase } from '../aiTools/divinationCast';
import { castKeyEnablers } from '../aiTools/mountVisibility';

const record = { divTime: '2027-02-04 03:15:00', zone: '+08:00', lat: '22n19', lon: '114e10', gpsLat: 22.3193, gpsLon: 114.1694 };
beforeEach(()=>{ window.localStorage.clear(); });

describe('上级项哪一档让起卦输入键生效', ()=>{
	it('六壬演数 / 报数 = 起课法两档;奇门报数 = 起局一档;已生效的键 = 空', ()=>{
		expect(castKeyEnablers('liureng', 'yanShuNum', {}, null).map((e)=>`${e.key}=${e.value}`)).toEqual(['castMethod=yanshu', 'castMethod=baoshu']);
		expect(castKeyEnablers('qimen', 'shuziReportNumber', {}, null).map((e)=>`${e.key}=${e.value}`)).toEqual(['qijuMethod=shuzi']);
		expect(castKeyEnablers('liureng', 'yanShuNum', { castMethod: 'yanshu' }, null)).toEqual([]);
		expect(castKeyEnablers('liureng', 'noSuchKey', {}, null)).toEqual([]);
	});
	it('格式目录写明须配哪一档', ()=>{
		expect(CAST_SPECS.liureng.inputs).toContain('须配 castMethod=yanshu 或 castMethod=baoshu');
		expect(CAST_SPECS.qimen.inputs).toContain('须配 qijuMethod=shuzi');
		expect(CAST_SPECS.huangji.inputs).toContain('upperNum(上卦数,须配 xinyiMethod=number)');
	});
});

describe('报数起卦校验话术', ()=>{
	it('🔴 六壬只给演数:两种起法结果不同 → 拒并列出两档,不替用户选', async ()=>{
		const r = await buildCastCase('liureng', { yanShuNum: 27 }, record);
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_ARGS_INVALID');
		expect(r.message).toContain('castMethod="yanshu"');
		expect(r.message).toContain('castMethod="baoshu"');
	});
	it('五兆只给「按时间」档:说清没报出结果并给示例', async ()=>{
		const r = await buildCastCase('wuzhao', { mode: 'ganzhi' }, record);
		expect(r.code).toBe('E_ARGS_INVALID');
		expect(r.message).toContain('mode="ganzhi"');
		expect(r.message).toContain('按起课时间');
		expect(r.message).toContain('zhushu');
	});
	it('一个起卦输入键都没给:照旧列出可给的键', async ()=>{
		const r = await buildCastCase('shenyishu', { foo: 1 }, record);
		expect(r.code).toBe('E_ARGS_INVALID');
	});
	it('🔴 奇门只给报数:按数字起局一并起,并注明', async ()=>{
		const r = await buildCastCase('qimen', { shuziReportNumber: '128' }, record);
		expect(r.ok).toBe(true);
		expect(r.body.options.qijuMethod).toBe('shuzi');
		expect(r.notes.join('')).toContain('qijuMethod="shuzi"');
		expect(r.snapshot.length).toBeGreaterThan(50);
	});
	it('🔴 数字项给了非数字 / 超范围:拒,不让后端悄悄换成按时间派生或随机的种子', async ()=>{
		const r = await buildCastCase('taixuan', { seed: 'abc' }, record);
		expect(r.code).toBe('E_ARGS_INVALID');
		expect(r.message).toContain('要数字');
		const neg = await buildCastCase('jingjue', { seed: -5 }, record);
		expect(neg.code).toBe('E_ARGS_INVALID');
		expect(neg.message).toContain('超出这一项的范围');
	});
	it('调用方自己给了上级项(哪怕给错档)不替它改:照报不生效', async ()=>{
		const r = await buildCastCase('qimen', { qijuMethod: 'zhirun', shuziReportNumber: '128' }, record);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('shuziReportNumber');
	});
});

describe('报数起卦格式目录只同步取轻量件', ()=>{
	it('🔴 divinationCast / mountVisibility 不同步 require 工具实现(tools/*);mountVisibility 不 import tools/ 与 aiAnalysisContext —— 同步引入重算链曾把它拖进别的 chunk,构建后自检报模块回灌', ()=>{
		const fs = require('fs'); const path = require('path');
		const dc = fs.readFileSync(path.join(__dirname, '../aiTools/divinationCast.js'), 'utf8');
		expect(dc).not.toMatch(/require\(\s*['"]\.\/tools\//);
		const mv = fs.readFileSync(path.join(__dirname, '../aiTools/mountVisibility.js'), 'utf8');
		expect(mv).not.toMatch(/from\s+['"][^'"]*(?:\/tools\/|aiAnalysisContext)/);
		expect(mv).not.toMatch(/require\(/);
	});
});
