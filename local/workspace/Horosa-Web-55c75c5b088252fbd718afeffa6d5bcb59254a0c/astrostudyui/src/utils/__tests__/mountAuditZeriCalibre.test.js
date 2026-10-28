// 择日五键工作台口径进 pick:太乙 tn / 六壬 贵人·月将·阴阳系 / 三式 十键 / 七政 宿制·交点·月孛 回写母组件;
// 紫微排盘口径扫描取紫微设置(与显示盘同读一份,不回写全局);快照配置段「扫描口径」行比冻结扫描口径与显示盘口径。
// 宿主行为一律按行为判(调真方法、记顺序 / 回写内容),不锚某一行源码写法。
jest.mock('../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));

it.each([
	['太乙', '../../components/taiyi/TaiYiMain', 'taiyizeri', 'applyOptions', { tn: 2 }, (st)=>st.options.tn],
	['六壬', '../../components/lrzhan/LiuRengMain', 'liurengzeri', 'applyCastFields', { guireng: 1 }, (st)=>st.guireng],
	['三式', '../../components/sanshi/SanShiUnitedMain', 'sanshizeri', 'applyOptions', { guireng: 1 }, (st)=>st.options.guireng],
])('🔴 %s内嵌页暴露回写 hook:回写后本页口径即为回写值', async (_n, mod, scope, fn, partial, pickVal)=>{
	const hook = {};
	const Page = require(mod).default;
	const page = new Page({ hook, techniqueScope: scope, fields: null });
	page.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state, this.props) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
	expect(typeof hook[fn]).toBe('function');
	await Promise.race([hook[fn](partial), new Promise((r)=>setTimeout(r, 200))]);
	expect(pickVal(page.state)).toBe(Object.values(partial)[0]);
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
	// 锁定三键(盘式时计 / 钟表时 / 不用博弈)每次都回写;页面流派键按冻结值回写
	const TY_LOCK = { style: 3, timeBasis: 'direct', gameTheory: 0 };
	await TaiyiZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: { tn: 2 }, state: {}, taiyiHook: { applyOptions: async (p)=>{ got = p; } } });
	expect(got).toEqual({ tn: 2, ...TY_LOCK });
	await TaiyiZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: { tn: 0, school: { a: 1 }, tenching: 2 }, state: {}, taiyiHook: { applyOptions: async (p)=>{ got = p; } } });
	expect(got).toEqual({ tn: 0, school: { a: 1 }, ...TY_LOCK });   // 已剔除的死键(十精)不再回写
	got = null;
	await LiurengZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: null, state: { options: { guirengType: 1, yueMode: 'jieqi', yinyangSystem: 'zhouye' } }, liurengHook: { applyCastFields: async (p)=>{ got = p; } } });
	expect(got).toEqual({ guireng: 1, yueJiangMethod: 'jieqi', yinyangSystem: 'zhouye', castMethod: 'zheng' });   // 起课法回写锁定值(正时正将)
	await LiurengZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: { guirengType: 2, fenZhouYe: 'maoyou', seHaiMethod: 'standard', seHaiBoundary: 'both', shiRuKe: true }, state: {}, liurengHook: { applyCastFields: async (p)=>{ got = p; } } });
	expect(got).toEqual({ guireng: 2, fenZhouYe: 'maoyou', seHaiMethod: 'standard', seHaiBoundary: 'both', shiRuKe: true, castMethod: 'zheng' });
	got = null;
	await SanshiZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: { guirengType: 0, yueMode: 'zhongqi', paiPanType: 1, qijuMethod: 'chaibu', school: '飞盘', taiyiAccum: 2, kongMode: 'hour' }, state: {}, sanshiHook: { applyOptions: async (p)=>{ got = p; } } });
	expect(got).toEqual({ guireng: 0, yueJiangMethod: 'zhongqi', paiPanType: 1, qijuMethod: 'chaibu', school: '飞盘', taiyiAccum: 2, kongMode: 'hour', taiyiStyle: 3, taiyiTimeBasis: 'direct', gameTheory: 0 });
	// 母组件未挂 hook → 静默 resolve(旧行为)
	await expect(TaiyiZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: { tn: 1 }, state: {}, taiyiHook: {} })).resolves.toBeUndefined();
});

// 点结果行:先把扫描口径回写内嵌页,回写落定之后才起盘(三宿主真 onPickInterval,记调用顺序)
describe('点结果行先回写扫描口径、再起盘', ()=>{
	const flush = async ()=>{ for(let i = 0; i < 8; i += 1){ await Promise.resolve(); } };
	function mkHost(mod, hookKey, applyFn){
		const H = require(mod).default;
		const h = new H({ dispatch: jest.fn() });
		h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
		const order = [];
		let release;
		h[hookKey] = { [applyFn]: ()=>{ order.push('calibre'); return new Promise((r)=>{ release = ()=>{ order.push('calibre-done'); r(); }; }); }, fun: ()=>order.push('plot') };
		h.requestChartAndPlot = ()=>order.push('plot');
		return { h, order, release: ()=>release() };
	}
	test.each([
		['太乙', '../../components/zeri/TaiyiZeriMain', 'taiyiHook', 'applyOptions'],
		['六壬', '../../components/zeri/LiurengZeriMain', 'liurengHook', 'applyCastFields'],
		['三式', '../../components/zeri/SanshiZeriMain', 'sanshiHook', 'applyOptions'],
	])('%s', async (_n, mod, hookKey, applyFn)=>{
		const { h, order, release } = mkHost(mod, hookKey, applyFn);
		h.onPickInterval({ start: '2026-03-01 10:00', pick: '2026-03-01 10:00' });
		await flush();
		expect(order).toEqual(['calibre']);   // 回写没落定之前不起盘
		release();
		await flush();
		expect(order).toEqual(['calibre', 'calibre-done', 'plot']);
	});
});

it('🔴 紫微择日快照配置段明标扫描口径:显式设过且≠显示盘全局值的键逐一列出;未设/相同 → 「一致」', ()=>{
	const { ziweiZeriCalibreLine, buildZiweiZeriSnapshotExtra } = require('../../divination/zeri/ziweiZeriSnapshot');
	const g = { lateZi: 'global', kongNaming: 'modern', starSet: 'full' };
	expect(ziweiZeriCalibreLine({ lateZi: 'midnight_split', kongNaming: 'modern', gender: 1 }, g)).toBe('扫描口径:晚子时=夜子时折中(工作台)≠跟随全局设置(默认)(显示盘) —— 命中时段按工作台口径判定,显示盘/紫微段按全局紫微设置排盘');
	expect(ziweiZeriCalibreLine({ kongNaming: 'modern' }, g)).toBe('扫描口径:与显示盘(全局紫微设置)一致');
	expect(ziweiZeriCalibreLine({}, g)).toBe('扫描口径:与显示盘(全局紫微设置)一致');
	// 显示盘没有的键(安星农历)按默认比:工作台显式选「日历日」(= 默认)不误报;选「随日柱进位」才报
	expect(ziweiZeriCalibreLine({ ziweiLunarBasis: 'calendar' }, g)).toBe('扫描口径:与显示盘(全局紫微设置)一致');
	expect(ziweiZeriCalibreLine({ ziweiLunarBasis: 'ziwei' }, g)).toContain('安星农历=随日柱进位(工作台)≠日历日(显示盘)');
	const text = buildZiweiZeriSnapshotExtra({ cfg: { startDate: '2026-05-01' }, geo: { zone: '+08:00' }, natal: null, tree: null, results: [], truncated: false, options: { starSet: 'north18' } });
	const cfgBlock = text.split('\n\n')[0];
	expect(cfgBlock.indexOf('[择时搜索配置]')).toBe(0);
	expect(cfgBlock).toContain('扫描口径:星集=精简18星(河洛)(工作台)≠全星系(默认)(显示盘)');
});

// 宿主快照(composeAiSnapshot)的「扫描口径」行:按冻结扫描口径写(扫描之后改了紫微设置 → 照实列出差异);
// 没扫过时按当前扫描口径(= 紫微设置)→ 与显示盘一致
describe('紫微择日宿主快照按冻结扫描口径写', ()=>{
	const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
	const base = { ...ZWEngineOptions };
	afterEach(()=>{ Object.assign(ZWEngineOptions, base); });
	function mkHost(){
		const { default: ZiweiZeriMain } = require('../../components/zeri/ZiweiZeriMain');
		return new ZiweiZeriMain({ dispatch: jest.fn() });
	}
	const lineOf = (text)=>(`${text}`.split('\n').find((l)=>l.indexOf('扫描口径') === 0) || '');
	test('冻结口径与现紫微设置不同:列出差异(冻结值标工作台侧)', ()=>{
		const h = mkHost();
		h._scanOptions = { ...h.effectiveScanOptions(), starSet: 'north18' };   // 扫描那一刻的口径
		expect(lineOf(h.composeAiSnapshot(''))).toContain('星集=精简18星(河洛)(工作台)≠全星系(默认)(显示盘)');
	});
	test('没扫过:按当前扫描口径(取紫微设置)写,与显示盘一致 —— 不是按工作台里残留的旧引擎键', ()=>{
		const h = mkHost();
		h.state.options = { ...h.state.options, starSet: 'north18' };   // 旧方案 / 旧存案带来的引擎键
		ZWEngineOptions.huoling = 'nanpai';
		expect(lineOf(h.composeAiSnapshot(''))).toBe('扫描口径:与显示盘(全局紫微设置)一致');
	});
});

describe('紫微择日快照「扫描口径」行:安星农历按显示盘实际规则比;显示盘为双盘时露档名', ()=>{
	const { ziweiZeriCalibreLine } = require('../../divination/zeri/ziweiZeriSnapshot');
	test('显示盘晚子时 = 子初(非跟随全局)→ 实际按日柱进位:工作台选「日历日」要报差异,选「随日柱进位」不报', ()=>{
		expect(ziweiZeriCalibreLine({ ziweiLunarBasis: 'calendar' }, { lateZi: 'zi_chu' })).toContain('安星农历=日历日(工作台)≠随日柱进位(显示盘)');
		expect(ziweiZeriCalibreLine({ ziweiLunarBasis: 'ziwei' }, { lateZi: 'zi_chu' })).toBe('扫描口径:与显示盘(全局紫微设置)一致');
		// 显示盘跟随全局:实际是日历日
		expect(ziweiZeriCalibreLine({ ziweiLunarBasis: 'calendar' }, { lateZi: 'global' })).toBe('扫描口径:与显示盘(全局紫微设置)一致');
		expect(ziweiZeriCalibreLine({ ziweiLunarBasis: 'ziwei' }, {})).toContain('安星农历=随日柱进位(工作台)≠日历日(显示盘)');
	});
	test('显示盘晚子时为双盘:档名照写,不露 dual', ()=>{
		const line = ziweiZeriCalibreLine({ lateZi: 'zi_chu' }, { lateZi: 'dual' });
		expect(line).not.toContain('dual');
		expect(line).toContain('(显示盘)');
	});
});
