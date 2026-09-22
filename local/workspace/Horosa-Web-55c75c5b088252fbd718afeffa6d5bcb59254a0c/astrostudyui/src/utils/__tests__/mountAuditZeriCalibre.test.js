// [挂载自检 F-37·拍板落地] 择日五键工作台口径进 pick:太乙 tn / 六壬 贵人·月将·阴阳系 / 三式 十键 / 七政 宿制·交点·月孛 回写母组件;
// 紫微 14 引擎键=全局单例不回写,改在快照配置段明标「扫描口径 vs 显示盘口径」。
import fs from 'fs';
import path from 'path';
jest.mock('../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
const UI = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(UI, rel), 'utf8');

it('🔴 三母组件暴露回写 hook(applyOptions/applyCastFields)', ()=>{
	expect(read('components/taiyi/TaiYiMain.js')).toContain('this.props.hook.applyOptions = (partial) => new Promise((resolve) => {');
	expect(read('components/lrzhan/LiuRengMain.js')).toContain('this.props.hook.applyCastFields = (partial)=>new Promise((resolve)=>{');
	expect(read('components/sanshi/SanShiUnitedMain.js')).toContain('this.props.hook.applyOptions = (partial)=>new Promise((resolve)=>{');
});

it('🔴 七政宿主 buildFields:工作台 su28Mode/nodeType/lilithType → doubingSu28/guolaoNodeType/guolaoLilithType(冻结扫描口径优先)', ()=>{
	const { default: QizhengZeriMain } = require('../../components/zeri/QizhengZeriMain');
	const ctx = { state: { pickText: '2026-05-15 10:00:00', geo: { zone: '+08:00', lon: '120e00', lat: '30n00' }, options: { su28Mode: 2, nodeType: 'mean', lilithType: 'mean' } }, _scanGeo: null, _scanOptions: { su28Mode: 3, nodeType: 'true', lilithType: 'true' } };
	const frozen = QizhengZeriMain.prototype.buildFields.call(ctx, true);
	expect(frozen.doubingSu28.value).toBe(3);
	expect(frozen.guolaoNodeType.value).toBe('true');
	expect(frozen.guolaoLilithType.value).toBe('true');
	const live = QizhengZeriMain.prototype.buildFields.call(ctx, false);
	expect(live.doubingSu28.value).toBe(2);
	expect(live.guolaoNodeType.value).toBe('mean');
	// 无 options → 旧缺省
	const bare = QizhengZeriMain.prototype.buildFields.call({ state: { pickText: '2026-05-15 10:00:00', geo: {} } }, true);
	expect(bare.doubingSu28.value).toBe(2);
	expect(bare.guolaoLilithType.value).toBe('mean');
});

it('🔴 太乙/六壬/三式宿主 applyWorkbenchCalibre:把冻结扫描口径按母组件键名回写', async ()=>{
	const { default: TaiyiZeriMain } = require('../../components/zeri/TaiyiZeriMain');
	const { default: LiurengZeriMain } = require('../../components/zeri/LiurengZeriMain');
	const { default: SanshiZeriMain } = require('../../components/zeri/SanshiZeriMain');
	let got = null;
	await TaiyiZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: { tn: 2 }, state: {}, taiyiHook: { applyOptions: async (p)=>{ got = p; } } });
	expect(got).toEqual({ tn: 2 });
	got = null;
	await LiurengZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: null, state: { options: { guirengType: 1, yueMode: 'jieqi', yinyangSystem: 'zhouye' } }, liurengHook: { applyCastFields: async (p)=>{ got = p; } } });
	expect(got).toEqual({ guireng: 1, yueJiangMethod: 'jieqi', yinyangSystem: 'zhouye' });
	got = null;
	await SanshiZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: { guirengType: 0, yueMode: 'zhongqi', paiPanType: 1, qijuMethod: 'chaibu', school: '飞盘', taiyiAccum: 2, kongMode: 'hour' }, state: {}, sanshiHook: { applyOptions: async (p)=>{ got = p; } } });
	expect(got).toEqual({ guireng: 0, yueJiangMethod: 'zhongqi', paiPanType: 1, qijuMethod: 'chaibu', school: '飞盘', taiyiAccum: 2, kongMode: 'hour' });
	// 母组件未挂 hook → 静默 resolve(旧行为)
	await expect(TaiyiZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: { tn: 1 }, state: {}, taiyiHook: {} })).resolves.toBeUndefined();
	// pick 路径先回写再起盘(源码锚)
	expect(read('components/zeri/TaiyiZeriMain.js')).toContain('this.applyWorkbenchCalibre().then(()=>{');
	expect(read('components/zeri/LiurengZeriMain.js')).toContain('this.applyWorkbenchCalibre().then(()=>this.requestChartAndPlot(true));');
	expect(read('components/zeri/SanshiZeriMain.js')).toContain('this.applyWorkbenchCalibre().then(()=>this.requestChartAndPlot(true));');
});

it('🔴 紫微择日快照配置段明标扫描口径:显式设过且≠显示盘全局值的键逐一列出;未设/相同 → 「一致」', ()=>{
	const { ziweiZeriCalibreLine, buildZiweiZeriSnapshotExtra } = require('../../divination/zeri/ziweiZeriSnapshot');
	const g = { lateZi: 'global', kongNaming: 'modern', starSet: 'full' };
	expect(ziweiZeriCalibreLine({ lateZi: 'midnight_split', kongNaming: 'modern', gender: 1 }, g)).toBe('扫描口径:晚子时=midnight_split(工作台)≠global(显示盘) —— 命中时段按工作台口径判定,显示盘/紫微段按全局紫微设置排盘');
	expect(ziweiZeriCalibreLine({ kongNaming: 'modern' }, g)).toBe('扫描口径:与显示盘(全局紫微设置)一致');
	expect(ziweiZeriCalibreLine({}, g)).toBe('扫描口径:与显示盘(全局紫微设置)一致');
	const text = buildZiweiZeriSnapshotExtra({ cfg: { startDate: '2026-05-01' }, geo: { zone: '+08:00' }, natal: null, tree: null, results: [], truncated: false, options: { starSet: 'north18' } });
	const cfgBlock = text.split('\n\n')[0];
	expect(cfgBlock.indexOf('[择时搜索配置]')).toBe(0);
	expect(cfgBlock).toContain('扫描口径:星集=north18(工作台)≠');
	expect(read('components/zeri/ZiweiZeriMain.js')).toContain('options: this._scanOptions || this.state.options,');
});
