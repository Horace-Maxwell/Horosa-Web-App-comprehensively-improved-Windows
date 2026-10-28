// 读档还原只由「显式载入」触发 —— 合同(全部用读档去重守卫的技法)。
//
// 当前事盘(user.currentCase)除了在列表里点载入(user/applyCase)之外,还会被三条路径换掉:
//   ① 点「编辑」:astro/openDrawer caseedit → user/setCurrentCase(被编辑的那条);
//   ② 「存为事盘」:user/addCase → setCurrentCase(刚存的那条);
//   ③ 「保存编辑」:user/updateCase → setCurrentCase(同一条、更新时间换了)。
// 这三条都不是载入。读档去重键若跟着当前事盘的 cid / 更新时间走,各技法页就把列表里那条的卦盖到屏幕上、
// 自己还原自己、在途扫描被取消。键只认 applyCase 写下的「载入的 cid + 载入代次」(kentangCaseSave.caseRestoreKey)。
//
// 本文件用真的 user 模型 effect 驱动状态(不手写 store 形状),再对三种读档入口逐一断言:
//   kentang 系共用件 getKentangSavedCasePayload(19 技法)、西占系共用件 getDivinationSavedCasePayload(盘壳四技法)、
//   择日宿主共享件 restoreZeriWorkbenchFromCase(八字 / 紫微 / 黄历 / 印度 / 七政 / 六壬 / 三式);
// 并静态枚举全部带读档守卫的组件,断言它们的键只出自这三处或 caseRestoreKey。
//
// 界面之外换了库里的当前事盘(采纳 / 撤销采纳 AI 提案、别的窗口、单库导入整条替换、影子并回)要重显时,只由 user 模型的
// reloadCurrentCaseFromStore 推进载入代次(当前事盘 = 显式载入那条、且改动影响起课)。下面的行为矩阵覆盖
// {来源} × {已载入 / 只是被编辑} × {三类读档入口};登记表把每个设当前事盘的位点分成载入类 / 非载入类,未登记即红。
const fs = require('fs');
const path = require('path');
const storageutil = require('../storageutil');
const { getKentangSavedCasePayload, caseRestoreKey } = require('../kentangCaseSave');
const { getDivinationSavedCasePayload } = require('../divinationCaseSave');
const userModel = require('../../models/user').default;
const { RECORD_NON_CAST_FIELDS, RECORD_MANAGEMENT_KEYS, RECORD_COPY_STRIP_KEYS, recordChangeAffectsCast } = require('../localRecordStore');
const { bindRecordStoreCrossWindowSync } = require('../recordStoreCrossWindow');
const { RECORDS_CHANGED_EVENT } = require('../recordStoreNotice');

jest.mock('../localcases', ()=>{
	const db = {};
	let n = 0;
	return {
		__db: db,
		getPagedLocalCases: ()=>({ List: Object.values(db), Total: Object.keys(db).length, PageIndex: 1, PageSize: 30 }),
		upsertLocalCase: (v)=>{ const cid = v.cid || `new-${++n}`; db[cid] = { ...(db[cid] || {}), ...v, cid, updateTime: `ut-${++n}` }; return { cid }; },
		getLocalCase: (cid)=>(db[cid] ? { ...db[cid] } : null),
		removeLocalCase: (cid)=>{ delete db[cid]; return { persisted: true }; },
		getCaseTypeMeta: jest.requireActual('../localcases').getCaseTypeMeta,
	};
});

const UI_SRC = path.join(__dirname, '..', '..');
const DateTime = require('../../components/comp/DateTime').default;
// 编辑 / 新增表单交来的起课时刻是 DateTime(addCase / updateCase 据此格式化)
const formDiv = ()=>{ const t = new DateTime(); t.setZone('+08:00'); return t.parse('2020-03-04 05:06:07', 'YYYY-MM-DD HH:mm:ss'); };

// 手驱 dva:effect 里 put 'save' 走 reducer、put 本模型的 effect 递归跑、select 按当前 state 求值;其余动作记下
function makeDva(){
	const state = { user: { caseApplySeq: 0, appliedCaseCid: null, currentCase: null, currentCaseRecord: null }, astro: { fields: {} } };
	const others = [];
	function run(name, payload){
		const fx = { put: (a)=>({ __put: a }), select: (fn)=>({ __select: fn }), call: (fn, ...args)=>({ __call: [fn, args] }) };
		const it = userModel.effects[name]({ payload }, fx);
		let res = it.next();
		let guard = 0;
		while(!res.done && guard++ < 80){
			const y = res.value;
			if(y && y.__put){
				const a = y.__put;
				if(a.type === 'save'){ state.user = userModel.reducers.save(state.user, a); }
				else if(userModel.effects[a.type]){ run(a.type, a.payload); }
				else { others.push(a); }
				res = it.next();
			}else if(y && y.__select){ res = it.next(y.__select(state)); }
			else if(y && y.__call){ res = it.next(y.__call[0](...y.__call[1])); }
			else { res = it.next(); }
		}
		storageutil.setGlobalStore(state);
	}
	return { state, run, others };
}

const rec = (cid, module, extra)=>({
	cid, caseType: module, sourceModule: module, event: cid, divTime: '2020-03-04 05:06:07', zone: '+08:00',
	lon: '116e23', lat: '39n54', gpsLon: 116.38, gpsLat: 39.9, pos: '北京', updateTime: `t-${cid}`,
	payload: JSON.stringify({ module, marker: cid, zeri: { pickText: `2020-03-04 0${cid.length % 9}:00:00` } }),
	...(extra || {}),
});

// 读档入口 → 当前「会还原哪条」(null = 不还原);键随之给出
const ENTRIES = {
	kentang: (module)=>{ const s = getKentangSavedCasePayload(module); return s ? { marker: s.payload.marker, key: s.caseVersion } : null; },
	divination: (module)=>{ const s = getDivinationSavedCasePayload(module); return s ? { marker: s.payload.marker, key: s.caseVersion } : null; },
};

// horosa_win_pathsep_posix_v1(Windows 侧移植适配;建议上游化):
// `path.join` / `path.relative` 在 Windows 返回反斜杠分隔 ⇒ 下方 `/components\/zeri\//` 过滤恒不中(择日宿主清单塌成空集,
// 整组择日入口用例连带红)、WHOLE_RECORD_EMITS / SET_CURRENT_CASE_SITES 两张 POSIX 键登记表恒查不中(macOS 恒绿)。
// 归一到 POSIX 再过滤 / 比对;判据语义零放宽(仍是「全仓每个点都登记、登记表不过期」)。
const toPosix = (p)=>p.split(path.sep).join('/');
const relPosix = (from, to)=>toPosix(path.relative(from, to));

// 机械求出:各共用件的调用方以字面量模块名调用的那些(新技法接了共用件即自动进矩阵)
function walk(dir, acc){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__'){ walk(p, acc); } }
		else if(e.name.endsWith('.js')){ acc.push(p); }
	});
	return acc;
}
const COMPONENT_FILES = walk(path.join(UI_SRC, 'components'), []);
const literalModules = (fnName)=>{
	const set = new Set();
	COMPONENT_FILES.forEach((f)=>{
		const src = fs.readFileSync(f, 'utf8');
		const re = new RegExp(`${fnName}\\(\\s*(?:this\\.props\\.techniqueScope\\s*\\|\\|\\s*)?'([a-z0-9]+)'`, 'g');
		let m;
		while((m = re.exec(src))){ set.add(m[1]); }
	});
	return Array.from(set).sort();
};
const KENTANG_MODULES = literalModules('getKentangSavedCasePayload');
const ZERI_SCOPES = (()=>{
	const set = new Set();
	COMPONENT_FILES.filter((f)=>/components\/zeri\//.test(toPosix(f))).forEach((f)=>{
		const src = fs.readFileSync(f, 'utf8');
		const re = /restoreZeriWorkbenchFromCase\(\s*this\s*,\s*([A-Z_]+|'[a-z]+')\s*\)/g;
		let m;
		while((m = re.exec(src))){
			if(m[1].startsWith("'")){ set.add(m[1].slice(1, -1)); continue; }
			const c = src.match(new RegExp(`const ${m[1]}\\s*=\\s*'([a-z]+)'`));
			if(c){ set.add(c[1]); }
		}
	});
	return Array.from(set).sort();
})();

afterEach(()=>{ storageutil.setGlobalStore({}); const db = require('../localcases').__db; Object.keys(db).forEach((k)=>{ delete db[k]; }); });

describe('读档还原只由显式载入触发 · 清单自检', ()=>{
	test('机械求出的技法清单量级合理(判据塌成空集即红)', ()=>{
		expect(KENTANG_MODULES.length).toBeGreaterThanOrEqual(15);
		expect(ZERI_SCOPES.length).toBeGreaterThanOrEqual(5);
	});
});

describe.each([
	...KENTANG_MODULES.map((m)=>['kentang', m]),
	...['horary', 'zeri', 'mundane', 'election'].map((m)=>['divination', m]),
])('%s · %s', (entry, module)=>{
	const read = ()=>ENTRIES[entry](module);
	test('① 载入 A → 点 B 的「编辑」→ 仍是 A(不还原 B);② 保存编辑 → 键不变;③ 存为事盘 → 不还原;④ 同一条载入两次 → 两次都换键', ()=>{
		const dva = makeDva();
		const localcases = require('../localcases');
		const A = rec('case-a', module); const B = rec('case-b', module);
		localcases.__db[A.cid] = A; localcases.__db[B.cid] = B;
		dva.run('applyCase', A);
		const first = read();
		expect(first && first.marker).toBe('case-a');
		// ① 编辑 B:当前事盘 = B,但不是载入 → 页面不还原(读档入口返回 null,各页 restore 直接返回)
		dva.run('setCurrentCase', { ...B, drawerVisible: {} });
		expect(dva.state.user.currentCase.cid.value).toBe('case-b');
		expect(read()).toBe(null);
		// ② 保存编辑 A(更新时间换了):载入的还是 A,键不变 → 守卫照旧拦住
		dva.run('applyCase', A);
		const k2 = read().key;
		dva.run('updateCase', { ...A, divTime: formDiv(), event: '改名' });
		expect(dva.state.user.currentCase.updateTime.value).not.toBe(A.updateTime);
		expect(read().key).toBe(k2);
		// ③ 存为事盘:当前事盘换成刚存的那条 → 不还原
		dva.run('addCase', { ...rec('', module), divTime: formDiv(), cid: undefined });
		expect(dva.state.user.currentCase.cid.value).toMatch(/^new-/);
		expect(read()).toBe(null);
		// ④ 同一条在列表里点载入两次:两次都换键(去重守卫放行)
		dva.run('applyCase', A);
		const k4a = read().key;
		dva.run('applyCase', A);
		const k4b = read().key;
		expect(k4a).not.toBe(k4b);
		expect(k4a).not.toBe(k2);
	});
});

describe.each(ZERI_SCOPES)('择日宿主 · %s', (scope)=>{
	const { restoreZeriWorkbenchFromCase } = require('../../components/zeri/zeriCaseRestore');
	const host = ()=>{
		const h = { state: { pickText: 'session', results: null, embedPatch: {}, embedRev: 0 } };
		h.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } };
		return h;
	};
	test('编辑 / 存为事盘 / 保存编辑不还原工作台;同一条载入两次两次都还原', ()=>{
		const dva = makeDva();
		const localcases = require('../localcases');
		const A = rec('case-za', scope); const B = rec('case-zb', scope);
		localcases.__db[A.cid] = A; localcases.__db[B.cid] = B;
		const h = host();
		dva.run('applyCase', A);
		expect(restoreZeriWorkbenchFromCase(h, scope)).toBe(true);
		h.state.pickText = 'mine';
		dva.run('setCurrentCase', B);
		expect(restoreZeriWorkbenchFromCase(h, scope)).toBe(false);
		dva.run('applyCase', A);
		expect(restoreZeriWorkbenchFromCase(h, scope)).toBe(true);
		h.state.pickText = 'mine';
		dva.run('updateCase', { ...A, divTime: formDiv(), event: '改名' });
		expect(restoreZeriWorkbenchFromCase(h, scope)).toBe(false);
		dva.run('addCase', { ...rec('', scope), divTime: formDiv(), cid: undefined });
		expect(restoreZeriWorkbenchFromCase(h, scope)).toBe(false);
		expect(h.state.pickText).toBe('mine');
		dva.run('applyCase', A);
		expect(restoreZeriWorkbenchFromCase(h, scope)).toBe(true);
	});
});

describe('界面之外改了已载入的那条(采纳 AI 提案):显式推进载入代次重显;改的不是载入的那条不推进', ()=>{
	test('syncRecordFromStore', ()=>{
		const dva = makeDva();
		const localcases = require('../localcases');
		const A = rec('case-s1', 'lingqi'); const B = rec('case-s2', 'lingqi');
		localcases.__db[A.cid] = A; localcases.__db[B.cid] = B;
		dva.run('applyCase', A);
		const k = caseRestoreKey('lingqi');
		dva.run('syncRecordFromStore', { store: 'case', cid: 'case-s1', fields: ['payload'] });
		expect(caseRestoreKey('lingqi')).not.toBe(k);
		const seq = dva.state.user.caseApplySeq;
		dva.run('setCurrentCase', B);   // 编辑 B
		dva.run('syncRecordFromStore', { store: 'case', cid: 'case-s2', fields: ['payload'] });
		expect(dva.state.user.caseApplySeq).toBe(seq);
		expect(caseRestoreKey('lingqi')).toBe(null);
	});
});

// ── 界面之外换了当前事盘:来源 × 当前事盘状态 × 读档入口
const replaced = (r)=>({ ...r, updateTime: `replaced-${r.cid}`, payload: JSON.stringify({ module: JSON.parse(r.payload).module, marker: 'replaced', zeri: { pickText: '2021-05-06 07:00:00' } }) });
// 别的窗口写了事盘库:走真的 storage 事件接线,取它广播出去的那份 detail(逐条带改了哪些键)
function crossWindowDetail(store, before, after){
	const key = store === 'chart' ? 'horosa.localCharts.v1' : 'horosa.localCases.v1';
	const got = [];
	const h = (e)=>got.push(e.detail);
	window.addEventListener(RECORDS_CHANGED_EVENT, h);
	const off = bindRecordStoreCrossWindowSync(()=>{});
	window.dispatchEvent(new window.StorageEvent('storage', { key, oldValue: JSON.stringify([before]), newValue: JSON.stringify([after]) }));
	off();
	window.removeEventListener(RECORDS_CHANGED_EVENT, h);
	return got[0];
}
const EXTERNAL_SOURCES = [
	['别的窗口(改了卦盘内容)', (cid, before, after)=>crossWindowDetail('case', before, after)],
	['单条(采纳提案,改起课时间)', (cid)=>({ store: 'case', cid, fields: ['divTime'] })],
	['单库导入(cids)', (cid)=>({ store: 'case', cids: [cid], source: 'import' })],
	['影子并回(cids,不分库)', (cid)=>({ source: 'shadow-merge', cids: [cid] })],
	['影子并回(无名单,按更新时间)', ()=>({ source: 'shadow-merge' })],
];
const zeriHost = ()=>{
	const h = { state: { pickText: 'session', results: null, embedPatch: {}, embedRev: 0 } };
	h.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } };
	return h;
};
// 每类入口给出「页面此刻会不会按库里那条重显、重显成哪条」:带去重守卫地模拟一个常驻页面
const PAGE_KINDS = {
	kentang: (module)=>{
		let last = null;
		return ()=>{ const s = getKentangSavedCasePayload(module); if(!s || s.caseVersion === last){ return null; } last = s.caseVersion; return s.payload.marker; };
	},
	divination: (module)=>{
		let last = null;
		return ()=>{ const s = getDivinationSavedCasePayload(module); if(!s || s.caseVersion === last){ return null; } last = s.caseVersion; return s.payload.marker; };
	},
	zeri: (scope)=>{
		const { restoreZeriWorkbenchFromCase } = require('../../components/zeri/zeriCaseRestore');
		const h = zeriHost();
		return ()=>(restoreZeriWorkbenchFromCase(h, scope) ? h.state.pickText : null);
	},
};
const PAGE_MODULE = { kentang: KENTANG_MODULES.indexOf('liureng') >= 0 ? 'liureng' : KENTANG_MODULES[0], divination: 'horary', zeri: ZERI_SCOPES[0] };
const NEW_SHOWN = { kentang: 'replaced', divination: 'replaced', zeri: '2021-05-06 07:00:00' };

describe.each(Object.keys(PAGE_KINDS))('界面之外换了当前事盘 · %s 入口', (kind)=>{
	const module = PAGE_MODULE[kind];
	test.each(EXTERNAL_SOURCES)('%s:当前 = 显式载入那条 → 推进载入代次、页面按新版重显', (label, payloadOf)=>{
		const dva = makeDva();
		const localcases = require('../localcases');
		const A = rec('case-xa', module);
		localcases.__db[A.cid] = A;
		const page = PAGE_KINDS[kind](module);
		dva.run('applyCase', A);
		expect(page()).not.toBe(null);   // 载入 → 还原一次
		expect(page()).toBe(null);       // 守卫:无关重渲染不再还原
		const seq = dva.state.user.caseApplySeq;
		localcases.__db[A.cid] = replaced(A);
		dva.run('syncRecordFromStore', payloadOf(A.cid, A, replaced(A)));
		expect(dva.state.user.caseApplySeq).toBe(seq + 1);
		expect(JSON.parse(dva.state.user.currentCaseRecord.payload).marker).toBe('replaced');
		expect(page()).toBe(NEW_SHOWN[kind]);
	});
	test.each(EXTERNAL_SOURCES)('%s:当前只是被编辑的那条(不是载入)→ 只重设、不推进、页面不还原', (label, payloadOf)=>{
		const dva = makeDva();
		const localcases = require('../localcases');
		const A = rec('case-ya', module); const B = rec('case-yb', module);
		localcases.__db[A.cid] = A; localcases.__db[B.cid] = B;
		const page = PAGE_KINDS[kind](module);
		dva.run('applyCase', B);
		page();
		dva.run('setCurrentCase', A);    // 点 A 的「编辑」
		const seq = dva.state.user.caseApplySeq;
		localcases.__db[A.cid] = replaced(A);
		dva.run('syncRecordFromStore', payloadOf(A.cid, A, replaced(A)));
		expect(dva.state.user.caseApplySeq).toBe(seq);
		expect(JSON.parse(dva.state.user.currentCaseRecord.payload).marker).toBe('replaced');   // 编辑表单是新版
		expect(page()).toBe(null);
	});
});

describe('界面之外只改了展示字段(标题 / 备注 / 归档)→ 只刷新当前事盘,不推进载入代次', ()=>{
	test.each([
		[['memo'], false], [['event', 'memo'], false], [['archived'], false], [['name', 'pos'], false],
		[['divTime'], true], [['memo', 'gender'], true], [['payload'], true], [undefined, true],
	])('fields=%j → 推进 %s', (fields, advance)=>{
		const dva = makeDva();
		const localcases = require('../localcases');
		const A = rec('case-ma', 'liureng');
		localcases.__db[A.cid] = A;
		dva.run('applyCase', A);
		const k = caseRestoreKey('liureng');
		localcases.__db[A.cid] = { ...A, memo: '新备注', updateTime: 'ut-memo' };
		dva.run('syncRecordFromStore', { store: 'case', cid: A.cid, fields });
		expect(dva.state.user.currentCaseRecord.memo).toBe('新备注');
		if(advance){ expect(caseRestoreKey('liureng')).not.toBe(k); }else{ expect(caseRestoreKey('liureng')).toBe(k); }
	});
	test('AI 提案可改的每个字段都已分类(展示字段 / 影响起盘);判据对两类给出正确结果', ()=>{
		const { PROPOSAL_FIELD_LABELS } = require('../aiAgent/proposals');
		const CAST = ['birth', 'divTime', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon', 'gender'];
		const unclassified = Object.keys(PROPOSAL_FIELD_LABELS).filter((k)=>CAST.indexOf(k) < 0 && RECORD_NON_CAST_FIELDS.indexOf(k) < 0);
		expect(unclassified).toEqual([]);
		expect(CAST.filter((k)=>RECORD_NON_CAST_FIELDS.indexOf(k) >= 0)).toEqual([]);
		Object.keys(PROPOSAL_FIELD_LABELS).forEach((k)=>{ expect([k, recordChangeAffectsCast([k])]).toEqual([k, CAST.indexOf(k) >= 0]); });
		expect(recordChangeAffectsCast(undefined)).toBe(true);
		expect(recordChangeAffectsCast(['someNewField'])).toBe(true);   // 不认识的新字段按影响起盘(宁可重显)
	});
});

// 别的窗口只改了「不影响起课」的键(置顶 / 星标 / 排序 / 备注 / 标签 / 日志 / 关联…):本窗口只刷新当前事盘,不推进载入代次
// (技法页不整页重还原:页上未存的改动、在途择日扫描、左栏亲手改的日界都留着);改了起课时间 / 时区 / 经纬 / 卦盘 / 不认识的新键 → 推进
describe('别的窗口改了当前事盘 · 逐键判「影响起课」', ()=>{
	const MUTATIONS = [
		['星标', (A)=>({ ...A, starred: true }), false],
		['置顶', (A)=>({ ...A, pinTier: 1, pinAt: '2026-10-24 09:00:00' }), false],
		['上移下移', (A)=>({ ...A, orderKey: -5 }), false],
		['归档', (A)=>({ ...A, archived: true }), false],
		['使用足迹', (A)=>({ ...A, lastOpenedAt: '2026-10-24 09:00:00', openCount: 3 }), false],
		['改备注(连带更新时间)', (A)=>({ ...A, memo: '新备注', updateTime: 'ut-memo' }), false],
		['加标签', (A)=>({ ...A, group: JSON.stringify(['新标签']) }), false],
		['断事日志', (A)=>({ ...A, journal: [{ at: '2026-10-24', text: '应了' }], updateTime: 'ut-j' }), false],
		['关联', (A)=>({ ...A, relations: [{ cid: 'other', kind: 'same-person' }] }), false],
		['改起课时间', (A)=>({ ...A, divTime: '2021-01-01 01:01:01', updateTime: 'ut-d' }), true],
		['改时区', (A)=>({ ...A, zone: '+09:00' }), true],
		['改经纬', (A)=>({ ...A, lat: '40n00' }), true],
		['改卦盘', (A)=>replaced(A), true],
		['不认识的新键', (A)=>({ ...A, someFutureKey: 1 }), true],
	];
	describe.each(Object.keys(PAGE_KINDS))('%s 入口', (kind)=>{
		const module = PAGE_MODULE[kind];
		test.each(MUTATIONS)('%s → 推进 %s', (label, mut, advance)=>{
			const dva = makeDva();
			const localcases = require('../localcases');
			const A = rec('case-cw', module);
			localcases.__db[A.cid] = A;
			const page = PAGE_KINDS[kind](module);
			dva.run('applyCase', A);
			expect(page()).not.toBe(null);
			const seq = dva.state.user.caseApplySeq;
			const B = mut(A);
			localcases.__db[A.cid] = B;
			const detail = crossWindowDetail('case', A, B);
			expect(detail.source).toBe('cross-window');
			dva.run('syncRecordFromStore', detail);
			expect(dva.state.user.caseApplySeq).toBe(advance ? seq + 1 : seq);
			expect(dva.state.user.currentCaseRecord).toEqual(B);   // 当前事盘一律换成库里的新版(编辑表单 / AI 挂载看到的是新版)
			if(advance){ expect(page()).not.toBe(null); }else{ expect(page()).toBe(null); }
		});
	});
	test('判别力:广播不带逐条改了哪些键 → 按整条替换推进(证明不推进来自 fieldsByCid)', ()=>{
		const dva = makeDva();
		const localcases = require('../localcases');
		const A = rec('case-cw2', 'liureng');
		localcases.__db[A.cid] = A;
		dva.run('applyCase', A);
		const seq = dva.state.user.caseApplySeq;
		const B = { ...A, starred: true };
		localcases.__db[A.cid] = B;
		const detail = crossWindowDetail('case', A, B);
		expect(detail.fieldsByCid).toEqual({ 'case-cw2': ['starred'] });
		dva.run('syncRecordFromStore', { ...detail, fieldsByCid: undefined });
		expect(dva.state.user.caseApplySeq).toBe(seq + 1);
	});
});

// 记录上的每个已知键都必须归入「影响起盘」或「不影响起盘」之一:新键不分类即红(以后加管理 / 展示键自动受管)
describe('记录键分类合同', ()=>{
	const { buildLocalChartRecord } = require('../localcharts');
	const { buildLocalCaseRecord } = jest.requireActual('../localcases');
	const { RECORD_FIELDS_RESTORE_MANIFEST, RECORD_FIELDS_CAPTURE_MARK } = require('../recordFieldsRestore');
	const { ZIWEI_RECORD_SETTINGS, ZIWEI_CUSTOM_TABLES, ZIWEI_SETTINGS_GEN_KEY } = require('../ziweiRecordSettings');
	const { PROPOSAL_FIELD_LABELS } = require('../aiAgent/proposals');
	// 影响起盘的随盘设置:载入时还原进左栏的选项清单 + 紫微随盘设置 —— 由清单推导,新增随盘设置自动归这一类
	const CAST_DERIVED = new Set([
		...RECORD_FIELDS_RESTORE_MANIFEST.map((e)=>e.key),
		...ZIWEI_RECORD_SETTINGS.map((e)=>e.key), ...ZIWEI_CUSTOM_TABLES.map((e)=>e.key),
	]);
	// 显式登记:影响起盘的核心键(身份 / 时间 / 地点 / 性别 / 类型 / 卦盘内容 / 代次标记 / 进左栏的分技法批注)
	const CAST_CORE = [
		'cid', 'birth', 'ad', 'divTime', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon', 'gender', 'isPub', 'creator',
		'caseType', 'sourceModule', 'chartType', 'payload', 'doubingSu28', 'houseStartMode',
		RECORD_FIELDS_CAPTURE_MARK, ZIWEI_SETTINGS_GEN_KEY,
		// 不在还原清单里、由起盘 / 挂载直接读记录的随盘设置
		'pdDirect', 'pdConverse', 'pdAntiscia', 'pdTerms', 'school', 'coordSystem', 'windowMonths', 'marketPreset',
		// 分技法批注八槽随盘写进左栏字段,只有重排才刷新左栏 → 按影响起盘处理(宁可重显)
		'memoAstro', 'memoBaZi', 'memoZiWei', 'memo74', 'memoGua', 'memoLiuReng', 'memoQiMeng', 'memoSuZhan',
	];
	// 随盘还原清单里、却登记为「不影响起盘」的例外(理由逐条写):
	const DERIVED_BUT_NON_CAST = { group: '分组标签:还原进左栏只为显示,算盘不用' };
	const KNOWN = Array.from(new Set([
		...Object.keys(buildLocalChartRecord({})), ...Object.keys(buildLocalCaseRecord({})),
		...RECORD_COPY_STRIP_KEYS.filter((k)=>k !== 'preserveUpdateTime'),
		...RECORD_MANAGEMENT_KEYS, ...Object.keys(PROPOSAL_FIELD_LABELS),
		'rodden', 'relation', 'sourceNote', 'journal', 'relations',
		...CAST_DERIVED,
	])).sort();
	test('每个已知键恰好归一类', ()=>{
		expect(KNOWN.length).toBeGreaterThan(150);   // 清单塌成空集即红
		const nonCast = new Set(RECORD_NON_CAST_FIELDS);
		const unclassified = KNOWN.filter((k)=>!nonCast.has(k) && CAST_CORE.indexOf(k) < 0 && !CAST_DERIVED.has(k));
		expect(unclassified).toEqual([]);
		expect(CAST_CORE.filter((k)=>nonCast.has(k))).toEqual([]);
		expect(Array.from(CAST_DERIVED).filter((k)=>nonCast.has(k)).sort()).toEqual(Object.keys(DERIVED_BUT_NON_CAST).sort());
		KNOWN.forEach((k)=>{ expect([k, recordChangeAffectsCast([k])]).toEqual([k, !nonCast.has(k)]); });
	});
	test('管理字段一律不影响起盘(以后新增管理字段自动受管)', ()=>{
		RECORD_MANAGEMENT_KEYS.forEach((k)=>{ expect([k, recordChangeAffectsCast([k])]).toEqual([k, false]); });
		expect(recordChangeAffectsCast(['updateTime', 'memo'])).toBe(false);
		expect(recordChangeAffectsCast([])).toBe(false);
		expect(recordChangeAffectsCast(undefined)).toBe(true);
	});
	test('判据单一出处:user 模型不另写一份键表', ()=>{
		const src = fs.readFileSync(path.join(UI_SRC, 'models/user.js'), 'utf8');
		const { importsName, definesLocal } = require('./helpers/importSpecs');
		expect(importsName(src, { name: 'recordChangeAffectsCast', from: '../utils/localRecordStore' })).toBe(true);
		expect(definesLocal(src, 'recordChangeAffectsCast')).toBe(false);
		expect(src).not.toMatch(/RECORD_DISPLAY_ONLY_FIELDS/);
		// 批量分支与单条分支都经判据(批量分支按条取 fieldsByCid)
		const body = src.slice(src.indexOf('*syncRecordFromStore('), src.indexOf('*addLocalChartQuiet('));
		expect((body.match(/recordChangeAffectsCast\(/g) || []).length).toBeGreaterThanOrEqual(3);
		expect(body).toMatch(/fieldsByCid/);
		expect(body).not.toMatch(/reloadCurrentCaseFromStore\(rec, true/);
	});
});

// records-changed 的每个广播点:要么带改了哪些键(fields / fieldsByCid),要么登记为「整条替换」(拿不到逐键差异,按影响起盘处理)
const WHOLE_RECORD_EMITS = {
	'components/user/CaseList.js::import': '单库导入:较新者整条替换',
	'components/user/ChartList.js::import': '单库导入:较新者整条替换',
	'components/user/unifiedRestoreFlow.js::restore': '全量恢复:整条替换',
	'components/common/StorageHealthModal.js::shadow-merge': '影子并回:整条替换',
	'components/common/LocalStoreHealthBanner.js::shadow-merge': '影子并回:整条替换',
};
describe('records-changed 广播点登记', ()=>{
	test('每个广播点带逐键差异或已登记整条替换;登记了却没有这个点即红', ()=>{
		const files = walk(UI_SRC, []).filter((f)=>!/__tests__|\.umi/.test(f));
		const bad = [];
		const seen = new Set();
		let total = 0;
		files.forEach((f)=>{
			const lines = fs.readFileSync(f, 'utf8').split('\n');
			lines.forEach((l)=>{
				const code = l.replace(/^\s*\/\/.*$/, '');
				const i = code.indexOf('emitRecordsChanged(');
				if(i < 0 || /export function emitRecordsChanged|import \{/.test(code)){ return; }
				total += 1;
				const call = code.slice(i);
				const end = call.indexOf('})');
				const args = end >= 0 ? call.slice(0, end + 2) : call;
				if(/\bfields(ByCid)?\s*:/.test(args)){ return; }
				const m = args.match(/source:\s*'([a-z-]+)'/);
				const site = `${relPosix(UI_SRC, f)}::${m ? m[1] : '?'}`;
				seen.add(site);
				if(!WHOLE_RECORD_EMITS[site]){ bad.push(`${site}: 不带 fields / fieldsByCid 也没登记整条替换`); }
			});
		});
		expect(total).toBeGreaterThanOrEqual(8);
		Object.keys(WHOLE_RECORD_EMITS).forEach((k)=>{ if(!seen.has(k)){ bad.push(`${k}: 登记了但已没有这个广播点(删登记)`); } });
		expect(bad).toEqual([]);
	});
});

describe('删掉显式载入的那条 → 载入标记同一次清', ()=>{
	test('删 A → 从回收站恢复 → 点「编辑」A:新挂载的页面不按旧代次还原', ()=>{
		const dva = makeDva();
		const localcases = require('../localcases');
		const A = rec('case-da', 'liureng');
		localcases.__db[A.cid] = A;
		dva.run('applyCase', A);
		expect(dva.state.user.appliedCaseCid).toBe('case-da');
		dva.run('deleteCase', { cid: A.cid });
		expect(dva.state.user.currentCase).toBe(null);
		expect(dva.state.user.appliedCaseCid).toBe(null);
		localcases.__db[A.cid] = A;      // 从回收站恢复
		dva.run('setCurrentCase', A);    // 点「编辑」
		expect(getKentangSavedCasePayload('liureng')).toBe(null);
	});
	test('当前事盘是被编辑的 B、删掉的是载入过的 A → 也清载入标记(当前事盘不动)', ()=>{
		const dva = makeDva();
		const localcases = require('../localcases');
		const A = rec('case-db', 'liureng'); const B = rec('case-dc', 'liureng');
		localcases.__db[A.cid] = A; localcases.__db[B.cid] = B;
		dva.run('applyCase', A);
		dva.run('setCurrentCase', B);
		dva.run('clearCurrentCaseIfRemoved', { cids: [A.cid] });
		expect(dva.state.user.appliedCaseCid).toBe(null);
		expect(dva.state.user.currentCase.cid.value).toBe('case-dc');
	});
});

// 设当前事盘的每个位点 → 载入类(必推进载入代次)/ 非载入类。读档去重键只认载入,新位点不登记就不知道它该不该触发重显
const SET_CURRENT_CASE_SITES = {
	'models/user.js::applyCase': 'load',                       // 列表里点载入
	'models/user.js::reloadCurrentCaseFromStore': 'load',      // 采纳 / 撤销采纳 / 单库导入 / 影子并回(已载入那条才推进)
	'models/user.js::addCase': 'non-load',                     // 存为事盘
	'models/user.js::updateCase': 'non-load',                  // 保存编辑
	'models/astro.js::openDrawer': 'non-load',                 // 点「编辑」(caseedit)
};
function setCurrentCaseSites(){
	const files = walk(UI_SRC, []).filter((f)=>!/__tests__|\.umi/.test(f));
	const out = [];
	files.forEach((f)=>{
		const lines = fs.readFileSync(f, 'utf8').split('\n');
		lines.forEach((l, i)=>{
			const code = l.replace(/\/\/.*$/, '');
			if(!/type:\s*'(user\/)?setCurrentCase'/.test(code)){ return; }
			let fn = '?';
			for(let j = i; j >= 0; j--){
				const m = lines[j].match(/^\s*(?:function\s*\*\s*|\*)([A-Za-z0-9_]+)\s*\(/);
				if(m){ fn = m[1]; break; }
			}
			out.push({ site: `${relPosix(UI_SRC, f)}::${fn}`, file: f, fn });
		});
	});
	return out;
}
describe('设当前事盘的位点登记表', ()=>{
	test('每个位点都已登记;载入类的函数体推进载入代次;syncRecordFromStore 不直接设当前事盘', ()=>{
		const sites = setCurrentCaseSites();
		expect(sites.length).toBeGreaterThanOrEqual(Object.keys(SET_CURRENT_CASE_SITES).length);
		const bad = [];
		sites.forEach(({ site, file, fn })=>{
			const kind = SET_CURRENT_CASE_SITES[site];
			if(!kind){ bad.push(`${site}: 未登记(载入类 / 非载入类)`); return; }
			if(kind === 'load'){
				const src = fs.readFileSync(file, 'utf8');
				const start = src.search(new RegExp(`(?:function\\s*\\*\\s*|\\*)${fn}\\s*\\(`));
				const body = src.slice(start, src.indexOf("'setCurrentCase'", start));
				if(!/caseApplySeq/.test(body)){ bad.push(`${site}: 载入类没在设当前事盘之前推进 caseApplySeq`); }
			}
		});
		const seen = new Set(sites.map((x)=>x.site));
		Object.keys(SET_CURRENT_CASE_SITES).forEach((k)=>{ if(!seen.has(k)){ bad.push(`${k}: 登记了但已没有这个位点(删登记)`); } });
		expect(bad).toEqual([]);
	});
});

describe('静态:全部读档守卫的键只出自共用件', ()=>{
	// 读档守卫 = 记「上次还原到哪条」的实例字段;每个这样的组件,键必须来自三种读档入口之一或 caseRestoreKey
	const GUARD = /lastRestoredCaseId|_appliedCaseVersion|_lastRestoredZeriCase|_lastCaseKey/;
	const SOURCES = /getKentangSavedCasePayload\(|getDivinationSavedCasePayload\(|restoreZeriWorkbenchFromCase\(|caseRestoreKey\(/;
	test('每个带守卫的组件都接了共用件;没有一个自己读当前事盘的更新时间 / 载入代次', ()=>{
		const guarded = COMPONENT_FILES.filter((f)=>GUARD.test(fs.readFileSync(f, 'utf8')));
		expect(guarded.length).toBeGreaterThanOrEqual(20);
		const bad = [];
		guarded.forEach((f)=>{
			const code = fs.readFileSync(f, 'utf8').split('\n').map((l)=>l.replace(/\/\/.*$/, '')).join('\n');
			if(!SOURCES.test(code)){ bad.push(`${path.relative(UI_SRC, f)}: 守卫没接共用件`); }
			if(/currentCase\.updateTime|caseApplySeq|appliedCaseCid/.test(code)){ bad.push(`${path.relative(UI_SRC, f)}: 自己读更新时间 / 载入代次`); }
		});
		expect(bad).toEqual([]);
	});
	test('caseedit 没带记录:什么都不做(不开抽屉、不关别的抽屉、不换当前事盘)', ()=>{
		const astroModel = require('../../models/astro').default;
		const it = astroModel.effects.openDrawer({ payload: { key: 'caseedit' } }, { put: (a)=>({ __put: a }), select: (fn)=>({ __select: fn }), call: ()=>({}) });
		const puts = [];
		let res = it.next();
		let guard = 0;
		while(!res.done && guard++ < 20){ if(res.value && res.value.__put){ puts.push(res.value.__put.type); } res = it.next(); }
		expect(puts).toEqual([]);
	});
	test('caseedit 没带记录时不从表单字段反拼记录再设回(丢性别 / 备注 / 研究字段)', ()=>{
		const src = fs.readFileSync(path.join(UI_SRC, 'models/astro.js'), 'utf8');
		const i = src.indexOf("values.key === 'caseedit'");
		const body = src.slice(i, src.indexOf("values.key === 'chartdeeplearn'", i));
		expect(body).not.toMatch(/caze\.cid\.value/);
		expect((body.match(/user\/setCurrentCase/g) || []).length).toBe(1);
	});
});
