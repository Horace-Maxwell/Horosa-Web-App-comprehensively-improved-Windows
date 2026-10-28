// 择日锁定项 × 「由存案复原」:控件只在「这一项确是载入存案复原来的」时解锁并写明;别的入口(流派预设、外部回写、hook)
// 改不出解锁与假提示。逐页核:未载入存案时穷举能改动锁定项的入口 → 控件仍置灰;载入了带非锁定值的存案 → 解锁 + 提示;
// 点结果行回写锁定值 → 标记清掉。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
jest.mock('../../../utils/request', () => jest.fn(() => new Promise(() => {})));
global.React = require('react');
const fs = require('fs');
const path = require('path');
const { setGlobalStore } = require('../../../utils/storageutil');
const { zeriLockProps, INDIA_ZERI_LOCKED, LIURENG_ZERI_LOCKED, TAIYI_ZERI_LOCKED, SANSHI_ZERI_LOCKED, QIZHENG_ZERI_LOCKED } = require('../zeriPageCalibre');

const SRC = path.join(__dirname, '..', '..', '..');
const flush = async ()=>{ for(let i = 0; i < 10; i += 1){ await Promise.resolve(); } };
const bindSetState = (o)=>{ o.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } }; return o; };

afterEach(()=>{ setGlobalStore({}); });

describe('印度择日:分宫制锁整宫', ()=>{
	const IndiaChartMain = require('../../../components/astro/IndiaChartMain').default;
	const AstroConst = require('../../../constants/AstroConst');
	const lockOf = (page)=>zeriLockProps(page.props.zeriLocked, 'indiaHsys', page.state.indiaHsysValue, page.props.zeriRestoredLocks);
	test.each(AstroConst.INDIA_SCHOOL_OPTIONS.map((o)=>o.value))('🔴 未载入存案,左栏切流派「%s」:宫制保持整宫、控件仍置灰,不挂「由存案复原」', (school)=>{
		const page = bindSetState(new IndiaChartMain({ hook: {}, techniqueScope: 'indiazeri', fields: null, zeriLocked: INDIA_ZERI_LOCKED, zeriRestoredLocks: null }));
		page.persistIndiaOption = jest.fn();
		page.requestDashaChart = jest.fn();
		page.changeIndiaSchool(school);
		expect(page.state.indiaHsysValue).toBe(0);
		expect(page.persistIndiaOption.mock.calls[0][0].indiaHsys).toBe(0);   // 交给宿主覆盖层的也是锁定值
		const lp = lockOf(page);
		expect(lp.disabled).toBe(true);
		expect(lp.restoredMismatch).toBeUndefined();
	});
	test('独立印度页(不锁)切流派照旧带走该派宫制', ()=>{
		const kp = AstroConst.INDIA_SCHOOL_OPTIONS.map((o)=>o.value).find((v)=>AstroConst.getIndiaSchoolDefaults(v).hsys !== 0);
		expect(kp).toBeTruthy();
		const page = bindSetState(new IndiaChartMain({ hook: {}, fields: null }));
		page.persistIndiaOption = jest.fn();
		page.requestDashaChart = jest.fn();
		page.changeIndiaSchool(kp);
		expect(page.state.indiaHsysValue).toBe(AstroConst.getIndiaSchoolDefaults(kp).hsys);
	});
	test('外部回写(点结果行 applyZeriCalibre)写回锁定值 → 置灰', async ()=>{
		const hook = {};
		const page = bindSetState(new IndiaChartMain({ hook, techniqueScope: 'indiazeri', fields: null, zeriLocked: INDIA_ZERI_LOCKED, zeriRestoredLocks: null }));
		page.state = { ...page.state, indiaHsysValue: 3 };
		expect(lockOf(page).disabled).toBe(true);   // 没有存案标记的非锁定值:照样锁定
		await hook.applyZeriCalibre({ indiaHsys: 0 });
		expect(lockOf(page).disabled).toBe(true);
	});
	test('宿主:载入带非整宫覆盖层的存案 → 标记分宫制(解锁 + 写明);点结果行 → 标记清掉', async ()=>{
		const IndiaZeriMain = require('../../../components/zeri/IndiaZeriMain').default;
		const { restoreZeriWorkbenchFromCase } = require('../../../components/zeri/zeriCaseRestore');
		const host = bindSetState(new IndiaZeriMain({ dispatch: jest.fn() }));
		host.replotAfterRestore = ()=>{};
		host.indiaHook = { applyZeriCalibre: ()=>Promise.resolve(), fun: jest.fn() };
		setGlobalStore({ user: { caseApplySeq: 1, appliedCaseCid: 'in-1', currentCase: {
			cid: { value: 'in-1' }, updateTime: { value: 't' }, caseType: { value: 'indiazeri' }, sourceModule: { value: 'indiazeri' },
			payload: { value: JSON.stringify({ module: 'indiazeri', zeri: { pickText: '2026-03-01 10:00:00', cfg: host.state.cfg, embedPatch: { indiaHsys: { v: 3 } } } }) } } } });
		expect(restoreZeriWorkbenchFromCase(host, 'indiazeri')).toBe(true);
		expect(host.state.zeriRestoredLocks).toEqual({ indiaHsys: true });
		const lp = zeriLockProps(INDIA_ZERI_LOCKED, 'indiaHsys', 3, host.state.zeriRestoredLocks);
		expect(lp.disabled).toBe(false);
		expect(lp.title).toContain('存案');
		host.onPickInterval({ start: '2026-03-01 10:00', pick: '2026-03-01 10:00' });
		await flush();
		expect(host.state.zeriRestoredLocks).toBeNull();
	});
	test('宿主:载入的存案覆盖层是整宫 / 没有覆盖层 → 没有标记', ()=>{
		const IndiaZeriMain = require('../../../components/zeri/IndiaZeriMain').default;
		const { restoreZeriWorkbenchFromCase } = require('../../../components/zeri/zeriCaseRestore');
		[{ indiaHsys: { v: 0 } }, undefined].forEach((embedPatch, i)=>{
			const host = bindSetState(new IndiaZeriMain({ dispatch: jest.fn() }));
			host.replotAfterRestore = ()=>{};
			setGlobalStore({ user: { caseApplySeq: 10 + i, appliedCaseCid: `in-${10 + i}`, currentCase: {
				cid: { value: `in-${10 + i}` }, updateTime: { value: 't' }, caseType: { value: 'indiazeri' }, sourceModule: { value: 'indiazeri' },
				payload: { value: JSON.stringify({ module: 'indiazeri', zeri: { pickText: '2026-03-01 10:00:00', cfg: host.state.cfg, ...(embedPatch ? { embedPatch } : {}) } }) } } } });
			expect(restoreZeriWorkbenchFromCase(host, 'indiazeri')).toBe(true);
			expect(host.state.zeriRestoredLocks).toBeNull();
		});
	});
});

describe('六壬 / 太乙 / 三式内嵌页:存案标记只由载入存案置、回写锁定值时清', ()=>{
	test('六壬:载入带非正时起课法的存案 → 解锁并写明;回写正时 → 锁定且标记清掉', async ()=>{
		jest.resetModules();
		jest.doMock('../../../utils/kentangCaseSave', ()=>({
			...jest.requireActual('../../../utils/kentangCaseSave'),
			getKentangSavedCasePayload: ()=>({ caseVersion: 'v1', payload: { castMethod: 'yanshu' } }),
			getKentangSavedCaseFieldsPatch: ()=>({}),
		}));
		const LiuRengMain = require('../../../components/lrzhan/LiuRengMain').default;
		const calibre = require('../zeriPageCalibre');
		const hook = {};
		const page = bindSetState(new LiuRengMain({ hook, techniqueScope: 'liurengzeri', fields: null, zeriLocked: calibre.LIURENG_ZERI_LOCKED }));
		const lp = ()=>calibre.zeriLockProps(page.props.zeriLocked, 'castMethod', page.state.castMethod, page._zeriRestoredLocks);
		expect(lp().disabled).toBe(true);
		expect(page.restoreFromCurrentCase(true)).toBe(true);
		expect(page.state.castMethod).toBe('yanshu');
		expect(lp().disabled).toBe(false);
		expect(lp().title).toContain('存案');
		await hook.applyCastFields({ castMethod: 'zheng' });
		expect(page._zeriRestoredLocks).toBeNull();
		expect(lp().disabled).toBe(true);
		jest.dontMock('../../../utils/kentangCaseSave');
	});
	test('太乙:载入带年计 / 真太阳时 / 博弈的存案 → 三项各自带标记;回写锁定三键 → 标记清掉', async ()=>{
		jest.resetModules();
		jest.doMock('../../../utils/kentangCaseSave', ()=>({
			...jest.requireActual('../../../utils/kentangCaseSave'),
			getKentangSavedCasePayload: ()=>({ caseVersion: 'v1', payload: { options: { style: 1, timeBasis: 'trueSolar', gameTheory: 1 }, pan: null, nongli: null } }),
			getKentangSavedCaseFieldsPatch: ()=>({}),
		}));
		const TaiYiMain = require('../../../components/taiyi/TaiYiMain').default;
		const calibre = require('../zeriPageCalibre');
		const hook = {};
		const page = bindSetState(new TaiYiMain({ hook, techniqueScope: 'taiyizeri', fields: null, zeriLocked: calibre.TAIYI_ZERI_LOCKED }));
		expect(page.restoreFromCurrentCase(true)).toBe(true);
		expect(page._zeriRestoredLocks).toEqual({ style: true, timeBasis: true, gameTheory: true });
		await hook.applyOptions(calibre.lockedValuesOf(calibre.TAIYI_ZERI_LOCKED));
		expect(page._zeriRestoredLocks).toBeNull();
		jest.dontMock('../../../utils/kentangCaseSave');
	});
	test('源码:三式页同一做法(载入存案置标记、回写清标记,三个锁定控件都带第四参)', ()=>{
		const t = fs.readFileSync(path.join(SRC, 'components', 'sanshi', 'SanShiUnitedMain.js'), 'utf8');
		expect(t).toMatch(/this\._zeriRestoredLocks = zeriRestoredLockMarks\(this\.props\.zeriLocked, normalizedOptions\)/);
		expect(t).toMatch(/this\._zeriRestoredLocks = clearZeriLockMarks\(this\._zeriRestoredLocks, partial\)/);
		// horosa_win_slice_form_v1(Windows 侧移植适配):合一页左栏在我方渲染切片里是子组件 SanShiInputPanel(见 SanShiUnitedMain 的
		// render-slice 注记),存案标记仍是宿主实例字段 `_zeriRestoredLocks`(上两条照旧钉宿主置 / 清),经
		// `zeriRestoredLocks={this._zeriRestoredLocks}` 下传,子组件里同一控件的第四参写作 `this.props.zeriRestoredLocks`。
		// 两形皆认,但同一文件只许一形(子组件里残留 `this._zeriRestoredLocks` = 读不到宿主字段);判据零放宽:三个锁定控件
		// 的 title + disabled 两处仍都带显式存案标记,且切片形必须真的从宿主字段下传。
		const sliceForm = t.includes('zeriRestoredLocks={this._zeriRestoredLocks}');
		const marksOf = (form)=>(form ? 'this\\.props\\.zeriRestoredLocks' : 'this\\._zeriRestoredLocks');
		const count = (k, marks)=>(t.match(new RegExp(`zeriLockProps\\(this\\.props\\.zeriLocked, '${k}', [^)]*, ${marks}\\)`, 'g')) || []).length;
		Object.keys(SANSHI_ZERI_LOCKED).forEach((k)=>{
			expect([k, count(k, marksOf(sliceForm))]).toEqual([k, 2]);
			expect([k, count(k, marksOf(!sliceForm))]).toEqual([k, 0]);
		});
	});
});

test('全仓 zeriLockProps 调用都带第四参(显式存案标记),不再按「值不等」推定来自存案', ()=>{
	const files = [];
	const walk = (d)=>fs.readdirSync(d, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(d, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== 'node_modules'){ walk(p); } return; }
		if(/\.js$/.test(e.name)){ files.push(p); }
	});
	walk(path.join(SRC, 'components'));
	const calls = [];
	files.forEach((f)=>{
		const t = fs.readFileSync(f, 'utf8');
		for(const m of t.matchAll(/zeriLockProps\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)){
			calls.push([path.relative(SRC, f), m[1].split(',').length]);
		}
	});
	expect(calls.length).toBeGreaterThanOrEqual(16);
	expect(calls.filter(([, n])=>n !== 4)).toEqual([]);
});

test('未载入存案:内嵌页构造出来的锁定项初值就是锁定值(控件一开就置灰,不靠存案标记)', ()=>{
	const mk = (mod, scope, zeriLocked)=>new (require(mod).default)({ hook: {}, techniqueScope: scope, fields: null, zeriLocked });
	const lr = mk('../../../components/lrzhan/LiuRengMain', 'liurengzeri', LIURENG_ZERI_LOCKED);
	expect(lr.state.castMethod).toBe(LIURENG_ZERI_LOCKED.castMethod.value);
	const ty = mk('../../../components/taiyi/TaiYiMain', 'taiyizeri', TAIYI_ZERI_LOCKED);
	Object.keys(TAIYI_ZERI_LOCKED).forEach((k)=>{ expect([k, ty.state.options[k]]).toEqual([k, TAIYI_ZERI_LOCKED[k].value]); });
	const ss = mk('../../../components/sanshi/SanShiUnitedMain', 'sanshizeri', SANSHI_ZERI_LOCKED);
	Object.keys(SANSHI_ZERI_LOCKED).forEach((k)=>{ expect([k, ss.state.options[k] === undefined ? (k === 'taiyiTimeBasis' ? 'direct' : ss.state.options[k]) : ss.state.options[k]]).toEqual([k, SANSHI_ZERI_LOCKED[k].value]); });
	const gl = mk('../../../components/guolao/GuoLaoChartMain', 'qizhengzeri', QIZHENG_ZERI_LOCKED);
	expect(gl.state.engineMode).toBe(QIZHENG_ZERI_LOCKED.engineMode.value);
	const AstroConst = require('../../../constants/AstroConst');
	expect(AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT).toBe(INDIA_ZERI_LOCKED.indiaHsys.value);
});
