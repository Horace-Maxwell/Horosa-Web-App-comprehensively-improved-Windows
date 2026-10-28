// 择日载入存案 / 方案 / 历史:工作台参数以「出厂完整缺省」打底,存下的没写的键回出厂值,绝不取本会话现值。
// 矩阵 = 十个宿主 × 工作台参数表的每一个键:会话里设成非出厂值 → 载入一条缺这个键的存案 / 方案 → 断言载入后它是出厂值
// (存案还原另断言冻结口径 _scanOptions 同值)。另核:出厂完整缺省覆盖参数表每个键、与只给常驻键的旧缺省扫描结果逐盘相同;
// 旧方案(一个页面口径键都没带)载入时页面键回出厂值;源码里不许再出现「会话打底」写法。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
global.React = require('react');
const fs = require('fs');
const path = require('path');
const { setGlobalStore } = require('../../../utils/storageutil');
const { restoreZeriWorkbenchFromCase } = require('../zeriCaseRestore');
const { withFullDefaults } = require('../zeriOptionDefaults');

const read = (f)=>fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const HOSTS = [
	{ name: '八字择日', scope: 'bazizeri', mod: '../BaziZeriMain', full: 'baziZeriFullDefaultOptions', wb: 'BaziZeriWorkbench', fields: ()=>require('../BaziZeriWorkbench').baziWorkbenchParamFields(), caseRestore: true },
	{ name: '紫微择日', scope: 'ziweizeri', mod: '../ZiweiZeriMain', full: 'ziweiZeriFullDefaultOptions', wb: 'ZiweiZeriWorkbench', fields: ()=>require('../../ziwei/ziweiOptions').ZIWEI_ZERI_WORKBENCH_FIELDS, caseRestore: true },
	{ name: '印度择日', scope: 'indiazeri', mod: '../IndiaZeriMain', full: 'indiaZeriFullDefaultOptions', wb: 'IndiaZeriWorkbench', fields: ()=>require('../IndiaZeriWorkbench').indiaWorkbenchParamFields(), caseRestore: true },
	{ name: '七政择日', scope: 'qizhengzeri', mod: '../QizhengZeriMain', full: 'qizhengZeriFullDefaultOptions', wb: 'QizhengZeriWorkbench', fields: ()=>require('../QizhengZeriWorkbench').qizhengWorkbenchParamFields(), caseRestore: true },
	{ name: '六壬择日', scope: 'liurengzeri', mod: '../LiurengZeriMain', full: 'liurengZeriFullDefaultOptions', wb: 'LiurengZeriWorkbench', fields: ()=>require('../LiurengZeriWorkbench').liurengWorkbenchParamFields() },
	{ name: '三式择日', scope: 'sanshizeri', mod: '../SanshiZeriMain', full: 'sanshiZeriFullDefaultOptions', wb: 'SanshiZeriWorkbench', fields: ()=>require('../SanshiZeriWorkbench').sanshiWorkbenchParamFields() },
	{ name: '太乙择日', scope: 'taiyizeri', mod: '../TaiyiZeriMain', full: 'taiyiZeriFullDefaultOptions', wb: 'TaiyiZeriWorkbench', fields: ()=>require('../TaiyiZeriWorkbench').taiyiWorkbenchParamFields() },
	{ name: '奇门择日', scope: 'qimenzeri', mod: '../QimenZeriMain', fullFn: ()=>require('../../dunjia/DunJiaMain').dunjiaFactoryOptions, wb: 'QimenZeriWorkbench', fields: ()=>require('../QimenZeriWorkbench').QIMEN_WORKBENCH_PARAM_FIELDS, stateKey: 'draftOptions' },
];
// 没有工作台参数的两个宿主(参数住在 cfg 里 / 只有时段):登记在此,表态「无工作台参数」
const NO_OPTION_HOSTS = [
	{ name: '黄历择日', mod: '../HuangliZeriMain' },
	{ name: '天星择日', mod: '../TianxingElectionMain' },
];

const fullOf = (h)=>(h.fullFn ? h.fullFn() : require(h.mod)[h.full]);
function mkHost(Cls){
	const h = new Cls({ dispatch: jest.fn() });
	h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
	h.replotAfterRestore = ()=>{};
	return h;
}
const store = (scope, zeri)=>setGlobalStore({ user: { caseApplySeq: 1, appliedCaseCid: 'fd-1', currentCase: {
	cid: { value: 'fd-1' }, updateTime: { value: 't' }, caseType: { value: scope }, sourceModule: { value: scope },
	payload: { value: JSON.stringify({ module: scope, zeri }) } } } });
// 非出厂值:参数表给的候选里第一个与出厂值不同的;输入框随便给一个
function altValueOf(field, full){
	if(field.kind === 'input'){ return '7'; }
	const opts = (field.optionsFor ? field.optionsFor(full) : field.options) || [];
	const hit = opts.find((o)=>`${o.value}` !== `${full[field.key]}`);
	return hit ? hit.value : undefined;
}
const omit = (o, k)=>{ const c = { ...o }; delete c[k]; return c; };
// 宿主 render 出来的工作台元素(不挂载,直接取 props)
function findElement(node, type){
	if(!node || typeof node !== 'object'){ return null; }
	if(Array.isArray(node)){ for(const n of node){ const r = findElement(n, type); if(r){ return r; } } return null; }
	if(node.type === type){ return node; }
	return node.props ? findElement(node.props.children, type) : null;
}

afterEach(()=>{ setGlobalStore({}); });

describe.each(HOSTS)('$name', (H)=>{
	const fields = H.fields();
	const full = ()=>fullOf(H)();

	test('出厂完整缺省覆盖参数表每个键(参数表的出厂值与之一致;输入类出厂未设)', ()=>{
		const f = full();
		fields.forEach((fd)=>{
			if(fd.kind === 'input'){ expect([undefined, '']).toContain(f[fd.key]); return; }
			expect(f[fd.key]).not.toBeUndefined();
			if(fd.dv !== undefined){ expect(f[fd.key]).toEqual(fd.dv); }
		});
	});

	if(!H.stateKey){
		test('工作台初值就是完整口径(之后的存案 / 方案 / 历史随之存全键)', ()=>{
			expect(mkHost(require(H.mod).default).state.options).toEqual(full());
		});
	}

	if(H.caseRestore){
		test.each(fields.map((fd)=>[fd.key, fd]))('载入存案缺「%s」:回出厂值,冻结口径同值(会话现值不混进来)', (key, fd)=>{
			const host = mkHost(require(H.mod).default);
			const f = full();
			const alt = altValueOf(fd, f);
			expect(alt).not.toBeUndefined();
			host.state.options = { ...f, [key]: alt };
			store(H.scope, { pickText: '2026-03-01 10:00:00', cfg: { startDate: '2026-03-01', endDate: '2026-03-01' }, options: omit(f, key), results: [] });
			expect(restoreZeriWorkbenchFromCase(host, H.scope)).toBe(true);
			expect(host.state.options[key]).toEqual(f[key]);
			expect((host._scanOptions || {})[key]).toEqual(f[key]);
		});
		test('存案整段没记工作台参数:全部回出厂值', ()=>{
			const host = mkHost(require(H.mod).default);
			const f = full();
			host.state.options = fields.reduce((acc, fd)=>({ ...acc, [fd.key]: altValueOf(fd, f) }), { ...f });
			store(H.scope, { pickText: '2026-03-01 10:00:00' });
			restoreZeriWorkbenchFromCase(host, H.scope);
			expect(host.state.options).toEqual(f);
		});
	}

	test.each(fields.map((fd)=>[fd.key, fd]))('载入方案 / 历史缺「%s」:回出厂值', (key, fd)=>{
		const Cls = require(H.mod).default;
		const host = mkHost(Cls);
		const f = full();
		const stateKey = H.stateKey || 'options';
		host.state[stateKey] = { ...f, [key]: altValueOf(fd, f) };
		const Wb = require(`../${H.wb}`).default;
		const el = findElement(host.render(), Wb);
		expect(el).toBeTruthy();
		expect(el.props.optionDefaults).toBe(fullOf(H));   // 宿主把自己的出厂完整缺省交给工作台
		// 工作台 applyScheme 的同一调用(源码锚见下)
		el.props.onOptionsChange(withFullDefaults(el.props.optionDefaults, omit(f, key)), { source: 'scheme' });
		expect(host.state[stateKey][key]).toEqual(f[key]);
	});

	test('工作台载入方案经单源打底(源码锚)', ()=>{
		const src = read(`${H.wb}.js`);
		expect(src).toContain("onOptionsChange(withFullDefaults(optionDefaults, rec.config.options), { source: 'scheme' })");
		expect(src).toMatch(/options, onOptionsChange, optionDefaults,/);
	});
});

describe('无工作台参数的宿主', ()=>{
	test.each(NO_OPTION_HOSTS)('$name:状态里没有工作台参数', (H)=>{
		const host = mkHost(require(H.mod).default);
		expect(Object.prototype.hasOwnProperty.call(host.state, 'options')).toBe(false);
	});
	test('择日宿主全部在表内(新宿主必须表态)', ()=>{
		const dir = path.join(__dirname, '..');
		const hosts = fs.readdirSync(dir).filter((f)=>/.(ZeriMain|ElectionMain)\.js$/.test(f)).map((f)=>`../${f.replace(/\.js$/, '')}`).sort();
		expect([...HOSTS, ...NO_OPTION_HOSTS].map((h)=>h.mod).sort()).toEqual(hosts);
	});
});

describe('旧方案(一个页面口径键都没带):页面键回出厂值', ()=>{
	const CASES = [
		['六壬择日', '../LiurengZeriMain', 'liurengHook', 'applyCastFields', ()=>{ const { pickKeys, LIURENG_PAGE_SCAN_KEYS } = require('../../../divination/zeri/zeriPageCalibre'); return pickKeys(require('../../lrzhan/main/castLayout').LIURENG_PAGE_SETTINGS.defaults(), LIURENG_PAGE_SCAN_KEYS); }, { fenZhouYe: 'maoyou' }],
		['太乙择日', '../TaiyiZeriMain', 'taiyiHook', 'applyOptions', ()=>{ const { pickKeys, TAIYI_PAGE_SCAN_KEYS } = require('../../../divination/zeri/zeriPageCalibre'); return pickKeys(require('../../taiyi/TaiYiMain').TAIYI_PAGE_SETTINGS.defaults(), TAIYI_PAGE_SCAN_KEYS); }, { school: { a: 1 } }],
		['三式择日', '../SanshiZeriMain', 'sanshiHook', 'applyOptions', ()=>{ const { pickKeys, SANSHI_LR_PAGE_SCAN_KEYS, SANSHI_TY_PAGE_SCAN_KEYS } = require('../../../divination/zeri/zeriPageCalibre'); const { QM_SEED_KEYS } = require('../../../divination/zeri/sanshiOptionSplit'); return pickKeys(require('../../sanshi/SanShiUnitedMain').SANSHI_PAGE_SETTINGS.defaults(), [...QM_SEED_KEYS, ...SANSHI_LR_PAGE_SCAN_KEYS, ...SANSHI_TY_PAGE_SCAN_KEYS]); }, { fenZhouYe: 'maoyou' }],
	];
	test.each(CASES)('%s', (_n, mod, hookKey, fn, factory, savedPage)=>{
		const host = mkHost(require(mod).default);
		const calls = [];
		host[hookKey] = { [fn]: (p)=>{ calls.push(p); return Promise.resolve(); } };
		host.replotEmbedded = ()=>{};
		host.onWorkbenchOptionsChange({ guirengType: 2 }, { source: 'scheme' });
		expect(calls).toEqual([factory()]);
		expect(Object.keys(factory()).length).toBeGreaterThan(0);
		// 带页面键的新方案:照方案;工作台单改一个参数(不是载入方案):不碰页面键
		calls.length = 0;
		host.onWorkbenchOptionsChange({ guirengType: 2, ...savedPage }, { source: 'scheme' });
		expect(calls).toEqual([savedPage]);
		calls.length = 0;
		host.onWorkbenchOptionsChange({ guirengType: 1 });
		expect(calls).toEqual([]);
	});
});

describe('出厂完整缺省 ≡ 旧缺省(只给常驻键):扫描结果逐盘相同(不改缺省结果)', ()=>{
	const geo = { zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9, ad: 1 };
	// 盘里回显的入参(castOverride)不算判定结果:显式写出厂值与不写,回显不同、判定相同
	const judged = (pan)=>{ if(!pan){ return 'null'; } const { castOverride, ...rest } = pan; return JSON.stringify(rest); };
	const samples = [];
	for(let d = 1; d <= 28; d += 3){ for(let h = 1; h < 24; h += 4){ samples.push([`2026-02-${d < 10 ? `0${d}` : d}`, `${h < 10 ? `0${h}` : h}:30:00`]); } }
	test('紫微:紫微设置全缺省时扫描口径 = 旧缺省(Java 兼容三键)', ()=>{
		const { computeZiweiScanPan, ziweiPageScanOptions } = require('../../../divination/zeri/ziweiZeriScanEngine');
		const { ZWEngineOptions } = require('../../ziwei/ziweiOptions');
		const M = require('../ZiweiZeriMain');
		const eff = { ...M.ziweiZeriFullDefaultOptions(), ...ziweiPageScanOptions(ZWEngineOptions) };
		samples.forEach(([d, t])=>{
			expect(JSON.stringify(computeZiweiScanPan(geo, eff, d, t))).toBe(JSON.stringify(computeZiweiScanPan(geo, M.ziweiZeriDefaultOptions(), d, t)));
		});
	});
	test('六壬', ()=>{
		const { computeLiurengScanPan } = require('../../../divination/zeri/liurengZeriScanEngine');
		const M = require('../LiurengZeriMain');
		samples.forEach(([d, t])=>{
			expect(judged(computeLiurengScanPan(geo, M.liurengZeriFullDefaultOptions(), d, t))).toBe(judged(computeLiurengScanPan(geo, M.liurengZeriDefaultOptions(), d, t)));
		});
	});
	test('三式(六壬家 + 太乙家;奇门家同键)', ()=>{
		const { splitSanshiOptions } = require('../../../divination/zeri/sanshiOptionSplit');
		const { computeLiurengScanPan } = require('../../../divination/zeri/liurengZeriScanEngine');
		const M = require('../SanshiZeriMain');
		const a = splitSanshiOptions(M.sanshiZeriFullDefaultOptions());
		const b = splitSanshiOptions(M.sanshiZeriDefaultOptions());
		expect(a.qimen).toEqual(b.qimen);
		expect(a.taiyi).toEqual(b.taiyi);
		samples.forEach(([d, t])=>{
			expect(judged(computeLiurengScanPan(geo, a.liureng, d, t))).toBe(judged(computeLiurengScanPan(geo, b.liureng, d, t)));
		});
	});
	test.each([['八字', 'BaziZeriMain', 'bazi'], ['太乙', 'TaiyiZeriMain', 'taiyi'], ['印度', 'IndiaZeriMain', 'india'], ['七政', 'QizhengZeriMain', 'qizheng']])('%s:完整缺省与旧缺省对象逐键相同', (_n, file, pre)=>{
		const M = require(`../${file}`);
		expect(M[`${pre}ZeriFullDefaultOptions`]()).toEqual(M[`${pre}ZeriDefaultOptions`]());
	});
});

describe('静态:择日宿主 / 工作台不许以会话现值给存下的口径打底', ()=>{
	const dir = path.join(__dirname, '..');
	const files = fs.readdirSync(dir).filter((f)=>/\.js$/.test(f));
	// 「{ ...(会话 options), ...(存下的 options) }」形:展开会话的工作台参数,再叠存案 / 方案的
	const SESSION_BASE_RE = /\{\s*\.\.\.\(?\s*(?:st\.options|options|opts|this\.state\.options|state\.options)\s*(?:\|\|\s*\{\}\s*)?\)?\s*,\s*\.\.\.\(?\s*(?:zeri\.options|rec\.config\.options|saved\.options|payload\.options)\b/;
	test('零命中', ()=>{
		const hits = files.filter((f)=>SESSION_BASE_RE.test(fs.readFileSync(path.join(dir, f), 'utf8')));
		expect(hits).toEqual([]);
	});
	test('判据自证', ()=>{
		expect(SESSION_BASE_RE.test('next.options = { ...(st.options || {}), ...zeri.options };')).toBe(true);
		expect(SESSION_BASE_RE.test('onOptionsChange({ ...(options || {}), ...rec.config.options });')).toBe(true);
		expect(SESSION_BASE_RE.test('onOptionsChange({ ...opts, ...rec.config.options });')).toBe(true);
		expect(SESSION_BASE_RE.test('onOptionsChange(withFullDefaults(optionDefaults, rec.config.options));')).toBe(false);
	});
});
