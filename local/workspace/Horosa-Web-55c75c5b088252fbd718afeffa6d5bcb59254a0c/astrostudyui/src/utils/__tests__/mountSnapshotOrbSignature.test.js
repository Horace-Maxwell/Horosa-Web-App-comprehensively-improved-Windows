// AI 挂载复用页面快照前比容许度:页面快照按页面当时的容许度算相位;挂载口径 = 整体倍率随存盘记录、
// 逐星表只在齿轮打开「沿用本盘自定义容许度」时才用。对不上不复用(由调用方按挂载口径重算)。
import { saveModuleAISnapshot, clearModuleAISnapshot, loadModuleAISnapshot } from '../moduleAiSnapshot';
import { notePageChartFields, pageChartOrbSignature } from '../pageChartOrb';
import { getTechniqueSnapshotFromCache, mountOrbSignatureOf } from '../aiAnalysisContext/snapshotMatch';
import { saveGeneratedTechniqueSnapshot } from '../aiAnalysisContext/recordFields';
import { chartOrbSignature } from '../classicalChartGlobals';

const RECORD = { birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', name: '甲' };
const META = { date: '1990/05/18', time: '10:00', zone: '+08:00', lat: '39n54', lon: '116e23' };
const source = (extra)=>({ sourceType: 'chart', record: { ...RECORD, ...(extra || {}) } });
const fields = (orbs, orbScale)=>({ orbs: { value: orbs }, orbScale: { value: orbScale } });

afterEach(()=>{
	notePageChartFields(null);
	['astrochart', 'bazi'].forEach((m)=>clearModuleAISnapshot(m));
});

describe('页面容许度签名', ()=>{
	test('缺省态恒为 {};逐星表键序无关;同一份字段只算一次', ()=>{
		expect(pageChartOrbSignature()).toBe('{}');
		notePageChartFields(fields({ Sun: 9, Moon: 8 }, 1.5));
		const a = pageChartOrbSignature();
		expect(a).toBe(chartOrbSignature({ orbs: { Moon: 8, Sun: 9 }, orbScale: 1.5 }));
		notePageChartFields(fields(undefined, 1));
		expect(pageChartOrbSignature()).toBe('{}');
	});
});

describe('快照打签', ()=>{
	test('页面写槽:记页面当时那张盘的容许度', ()=>{
		notePageChartFields(fields({ Sun: 9 }, 2));
		saveModuleAISnapshot('astrochart', '[起盘信息]\n正文', META);
		expect(loadModuleAISnapshot('astrochart').orbSig).toBe(chartOrbSignature({ orbs: { Sun: 9 }, orbScale: 2 }));
	});
	test('挂载按记录重算后写槽:记挂载口径(不是页面此刻那张盘的)', ()=>{
		notePageChartFields(fields({ Sun: 9 }, 2));
		saveGeneratedTechniqueSnapshot('astrochart', '[起盘信息]\n正文', { ...RECORD, orbScale: 1.5 }, { generatedFromChart: true });
		expect(loadModuleAISnapshot('astrochart').orbSig).toBe(chartOrbSignature({ orbScale: 1.5 }));
	});
});

describe('复用判定', ()=>{
	test('挂载口径:整体倍率随记录;逐星表只在打开沿用时才算', ()=>{
		expect(mountOrbSignatureOf(RECORD)).toBe('{}');
		expect(mountOrbSignatureOf({ ...RECORD, orbScale: 1.5 })).toBe(chartOrbSignature({ orbScale: 1.5 }));
		expect(mountOrbSignatureOf({ ...RECORD, orbs: { Sun: 9 } })).toBe('{}');
		expect(mountOrbSignatureOf({ ...RECORD, orbs: { Sun: 9 }, useStoredOrbs: 1 })).toBe(chartOrbSignature({ orbs: { Sun: 9 } }));
	});
	test('页面与挂载同一套容许度 → 复用', ()=>{
		saveModuleAISnapshot('astrochart', '[起盘信息]\n默认容许度正文', META);
		expect(getTechniqueSnapshotFromCache('astrochart', source()).content).toContain('默认容许度正文');
		notePageChartFields(fields(undefined, 1.5));
		saveModuleAISnapshot('astrochart', '[起盘信息]\n一点五倍正文', META);
		expect(getTechniqueSnapshotFromCache('astrochart', source({ orbScale: 1.5 })).content).toContain('一点五倍正文');
	});
	test('页面改过逐星容许度、挂载没开沿用 → 不复用', ()=>{
		notePageChartFields(fields({ Sun: 12 }, 1));
		saveModuleAISnapshot('astrochart', '[起盘信息]\n自定义逐星正文', META);
		expect(getTechniqueSnapshotFromCache('astrochart', source())).toBe(null);
		// 打开沿用、且记录里存的是同一份逐星表 → 复用
		expect(getTechniqueSnapshotFromCache('astrochart', source({ orbs: { Sun: 12 }, useStoredOrbs: 1 })).content).toContain('自定义逐星正文');
	});
	test('页面倍率与记录倍率不同 → 不复用', ()=>{
		notePageChartFields(fields(undefined, 2));
		saveModuleAISnapshot('astrochart', '[起盘信息]\n两倍正文', META);
		expect(getTechniqueSnapshotFromCache('astrochart', source())).toBe(null);
		expect(getTechniqueSnapshotFromCache('astrochart', source({ orbScale: 2 })).content).toContain('两倍正文');
	});
	test('挂载设置里没有容许度项的技法不受影响(八字不看相位容许度)', ()=>{
		notePageChartFields(fields({ Sun: 12 }, 2));
		saveModuleAISnapshot('bazi', '[八字]\n正文', META);
		expect(getTechniqueSnapshotFromCache('bazi', source()).content).toContain('正文');
	});
	test('没打签的旧快照不拦', ()=>{
		saveModuleAISnapshot('astrochart', '[起盘信息]\n旧正文', META);
		const snap = loadModuleAISnapshot('astrochart');
		delete snap.orbSig;
		expect(getTechniqueSnapshotFromCache('astrochart', source({ orbScale: 2 })).content).toContain('旧正文');
	});
});
