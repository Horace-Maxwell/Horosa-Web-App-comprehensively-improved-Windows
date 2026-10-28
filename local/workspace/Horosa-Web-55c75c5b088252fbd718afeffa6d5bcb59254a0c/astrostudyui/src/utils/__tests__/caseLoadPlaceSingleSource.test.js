// 事盘载入的地点 / 起课时间:四路载入(主盘 applyCase / 六爻补取 / 择日宿主覆盖层 / 卜卦类盘壳)与存案入口的新增表单
// 收成同一个地点出口 kentangCaseSave.casePlaceGroup;坏档(经纬串缺 / 空 / 只坏一项)整组沿用左栏、不把左栏清成空纬度;
// 时区不随地点回落(时区是记录时刻的一部分);没有起课时间:载入按此刻并提示,从文件导入时跳过并列出,全量恢复照旧带回。
const fs = require('fs');
const path = require('path');
const storageutil = require('../storageutil');
const KS = require('../kentangCaseSave');
const userModel = require('../../models/user').default;

const UI_SRC = path.join(__dirname, '..', '..');
const BASE_FIELDS = {
	date: { value: null, name: ['date'] }, time: { value: null, name: ['time'] }, ad: { value: 1, name: ['ad'] },
	zone: { value: '+09:00', name: ['zone'] }, lon: { value: '139e45', name: ['lon'] }, lat: { value: '35n40', name: ['lat'] },
	gpsLon: { value: 139.75, name: ['gpsLon'] }, gpsLat: { value: 35.67, name: ['gpsLat'] }, pos: { value: '东京', name: ['pos'] },
	gender: { value: 1, name: ['gender'] },
};
const GOOD = {
	cid: 'case-p', updateTime: 't1', caseType: 'guazhan', sourceModule: 'guazhan', divTime: '2020-03-04 05:06:07', zone: '+08:00',
	lon: '116e23', lat: '39n54', gpsLon: 116.38, gpsLat: 39.9, pos: '北京', gender: 0,
	payload: JSON.stringify({ module: 'guazhan' }),
};
const PLACE_KEYS = ['lon', 'lat', 'gpsLon', 'gpsLat', 'pos'];
const { lat: _dropLat, ...MISSING_LAT } = GOOD;
// 坏地点矩阵:空串 / null / 缺键 / 只坏一项(经度或纬度)
const BAD_PLACES = [
	['纬度空串', { ...GOOD, lat: '' }],
	['经度空串', { ...GOOD, lon: '', gpsLon: '' }],
	['纬度 null', { ...GOOD, lat: null }],
	['纬度缺键', MISSING_LAT],
	['经纬都空', { ...GOOD, lon: '', lat: '', gpsLon: '', gpsLat: '' }],
	['黄历旧档(只有经度)', { ...GOOD, lat: '', gpsLon: undefined, gpsLat: undefined, pos: undefined }],
];

function runEffect(name, payload, state){
	const puts = [];
	const fx = { put: (a)=>({ __put: a }), select: (fn)=>({ __select: fn }), call: (fn, ...args)=>({ __call: [fn, args] }) };
	const it = userModel.effects[name]({ payload }, fx);
	let res = it.next();
	let guard = 0;
	while(!res.done && guard++ < 50){
		const y = res.value;
		if(y && y.__put){ puts.push(y.__put); res = it.next(); }
		else if(y && y.__select){ res = it.next(y.__select(state)); }
		else { res = it.next(); }
	}
	return puts;
}
// 「载入」这一条:setCurrentCase 存下的 currentCase + 原样记录 + 显式载入标记
function loadIntoStore(rec, module){
	const sc = runEffect('setCurrentCase', rec, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
	storageutil.setGlobalStore({ user: { currentCase: sc.payload.currentCase, currentCaseRecord: rec, caseApplySeq: 1, appliedCaseCid: rec.cid }, astro: { fields: BASE_FIELDS } });
	return module;
}
const hasAnyPlace = (patch)=>PLACE_KEYS.filter((k)=>patch && Object.prototype.hasOwnProperty.call(patch, k));

afterEach(()=>{ storageutil.setGlobalStore({}); });

describe('四路载入 × 坏地点矩阵:左栏地点不变', ()=>{
	test.each(BAD_PLACES)('%s', (_name, rec)=>{
		// ① 主盘(applyCase 写左栏的那份映射)
		const main = KS.caseRecordFieldsPatch(rec, BASE_FIELDS);
		expect(hasAnyPlace(main)).toEqual([]);
		expect(main.zone.value).toBe('+08:00');   // 时区照记录(不随地点回落)
		const puts = runEffect('applyCase', rec, { user: { caseApplySeq: 0 }, astro: { fields: BASE_FIELDS } });
		const fetch = puts.find((a)=>a.type === 'astro/fetchByFields');
		PLACE_KEYS.forEach((k)=>{ expect([k, fetch.payload[k].value]).toEqual([k, BASE_FIELDS[k].value]); });
		// ② 六爻补取 ③ 择日宿主覆盖层
		loadIntoStore(rec, 'guazhan');
		expect(hasAnyPlace(KS.currentCaseFieldsPatch({ timeAlg: true }))).toEqual([]);
		expect(hasAnyPlace(KS.getKentangSavedCaseFieldsPatch('guazhan'))).toEqual([]);
		// 表单字段兜底路(没有原样记录)同判据
		const st = storageutil.getStore();
		storageutil.setGlobalStore({ ...st, user: { ...st.user, currentCaseRecord: null } });
		expect(hasAnyPlace(KS.currentCaseFieldsPatch())).toEqual([]);
		// ④ 卜卦类盘壳
		const Shell = require('../../components/divination/DivinationChartShell').default;
		const sh = Object.create(Shell.prototype);
		sh.props = { saveModule: 'horary' };
		sh.state = { fields: { ...BASE_FIELDS }, extra: {} };
		let patched = null;
		sh.patchFields = (p)=>{ patched = p; };
		sh.setExtra = ()=>{};
		loadIntoStore({ ...rec, caseType: 'horary', sourceModule: 'horary', payload: JSON.stringify({ module: 'horary' }) });
		expect(sh.applyRestoreIfAny()).toBe(true);
		expect(hasAnyPlace(patched)).toEqual([]);
		expect(patched.zone).toBe('+08:00');
	});
	test('好地点:四路都整组写记录的地点(数值经纬缺则由串换算)', ()=>{
		const { gpsLon, gpsLat, ...noGps } = GOOD;
		const main = KS.caseRecordFieldsPatch(noGps, BASE_FIELDS);
		expect(main.lon.value).toBe('116e23');
		expect(main.gpsLat.value).toBeCloseTo(39.9, 6);
		expect(main.pos.value).toBe('北京');
		loadIntoStore(noGps, 'guazhan');
		const p = KS.currentCaseFieldsPatch({ timeAlg: true });
		PLACE_KEYS.forEach((k)=>{ expect([k, p[k].value]).toEqual([k, main[k].value]); });
		// 地名缺:写空串,不留左栏的地名配记录的坐标
		const { pos, ...noPos } = GOOD;
		expect(KS.caseRecordFieldsPatch(noPos, BASE_FIELDS).pos.value).toBe('');
	});
});

describe('存案入口的新增表单:半组地点不盖表单缺省的左栏地点', ()=>{
	test('只带经度 / 空纬度 → 表单留左栏地点;完整一组 → 整组写', ()=>{
		const state = { astro: { fields: { ...BASE_FIELDS, date: { value: KS.parseCaseRecordDivTime(GOOD) }, time: { value: KS.parseCaseRecordDivTime(GOOD) } } } };
		const form = (rec)=>runEffect('newCurrentCase', rec, state).find((a)=>a.type === 'save').payload.currentCase;
		const half = form({ caseType: 'huanglizeri', lon: '120e00', lat: '' });
		expect([half.lon.value, half.lat.value, half.pos.value]).toEqual(['139e45', '35n40', '东京']);
		const full = form({ caseType: 'bazizeri', lon: '116e23', lat: '39n54', pos: '' });
		expect([full.lon.value, full.lat.value, full.pos.value]).toEqual(['116e23', '39n54', '']);
		expect(full.gpsLat.value).toBeCloseTo(39.9, 6);
	});
	test('黄历择日存案不再记「经度 + 空纬度」半组', ()=>{
		const src = fs.readFileSync(path.join(UI_SRC, 'components/zeri/HuangliZeriMain.js'), 'utf8');
		const body = src.slice(src.indexOf('\tsaveCase(){'), src.indexOf('\trenderExtraControls(){'));
		expect(body).not.toMatch(/lat:\s*\{\s*value:\s*''\s*\}/);
		expect(body).not.toMatch(/\blon:\s*\{/);
	});
});

describe('直接拿记录起盘(AI 挂载重算 / 无头重算)× 坏地点矩阵:整组换默认坐标,不拼半组', ()=>{
	const { buildFieldObject } = require('../aiAnalysisContext/recordFields');
	const { DefLat, DefLon, DefGpsLat, DefGpsLon } = require('../constants');
	const placeOf = (f)=>[f.lon.value, f.lat.value, f.gpsLon.value, f.gpsLat.value, f.pos.value];
	test.each(BAD_PLACES)('%s', (_name, rec)=>{
		expect(placeOf(buildFieldObject(rec))).toEqual([DefLon, DefLat, DefGpsLon, DefGpsLat, '']);
	});
	test('好档整组照用;数值经纬缺时由串换算(与载入同一出口)', ()=>{
		expect(placeOf(buildFieldObject(GOOD))).toEqual(['116e23', '39n54', 116.38, 39.9, '北京']);
		const f = buildFieldObject({ ...GOOD, gpsLon: undefined, gpsLat: '' });
		expect([f.lon.value, f.lat.value]).toEqual(['116e23', '39n54']);
		expect(f.gpsLon.value).toBeCloseTo(116 + 23 / 60, 9);
		expect(f.gpsLat.value).toBeCloseTo(39.9, 9);
	});
	test('静态:构造器里不再按键读记录的地点', ()=>{
		const src = fs.readFileSync(path.join(UI_SRC, 'utils/aiAnalysisContext/recordFields.js'), 'utf8');
		const body = src.slice(src.indexOf('export function buildFieldObject(record){'));
		expect(body).toContain('recordPlaceGroupOrDefault(record)');
		expect(body.slice(0, body.indexOf('\n}\n'))).not.toMatch(/record\.(lat|lon|gpsLat|gpsLon|pos)\b/);
	});
});

describe('静态:四路载入与新增表单不许绕开 casePlaceGroup 逐键写地点', ()=>{
	const PER_KEY = /\b(setF|patch|out|caze|flds)\s*(\(\s*'|\[\s*'|\.)(lon|lat|gpsLon|gpsLat)\b(?!\.value\s*===)/;
	const ARR = /\[\s*'lon'\s*,\s*'lat'/;
	const bodyOf = (src, startMark, endMark)=>{ const i = src.indexOf(startMark); return i < 0 ? '' : src.slice(i, endMark ? src.indexOf(endMark, i + startMark.length) : undefined); };
	const strip = (s)=>s.split('\n').map((l)=>l.replace(/\/\/.*$/, '')).join('\n');
	test('kentangCaseSave(casePlaceGroup 本体以外)/ user 模型载入与新增 / 盘壳载入', ()=>{
		const ks = fs.readFileSync(path.join(UI_SRC, 'utils/kentangCaseSave.js'), 'utf8');
		const user = fs.readFileSync(path.join(UI_SRC, 'models/user.js'), 'utf8');
		const shell = fs.readFileSync(path.join(UI_SRC, 'components/divination/DivinationChartShell.js'), 'utf8');
		const groupBody = bodyOf(ks, 'export function casePlaceGroup(', '\n}\n');
		expect(groupBody.length).toBeGreaterThan(50);
		const regions = [
			['kentangCaseSave(除 casePlaceGroup)', strip(ks.replace(groupBody, ''))],
			['user.applyCase', strip(bodyOf(user, '*applyCase(', '\n\t\t*'))],
			// 新增表单:左栏地点整组做缺省是合规的;存案入口带来的(values)不许逐键盖
			['user.newCurrentCase(入口带来的那部分)', strip(bodyOf(bodyOf(user, '*newCurrentCase(', '\n\t\t*'), '\t\t\tif(values){'))],
			['DivinationChartShell.applyRestoreIfAny', strip(bodyOf(shell, '\tapplyRestoreIfAny(){', '\n\t}\n'))],
		];
		const bad = [];
		regions.forEach(([name, code])=>{
			expect([name, code.length > 100]).toEqual([name, true]);
			code.split('\n').forEach((line)=>{ if(PER_KEY.test(line) || ARR.test(line)){ bad.push(`${name}: ${line.trim().slice(0, 100)}`); } });
		});
		expect(bad).toEqual([]);
		expect(shell).toContain('const place = casePlaceGroup(c);');
		expect(ks).toContain('const place = casePlaceGroup(v);');
		expect(user).toContain('const place = casePlaceGroup(values);');
	});
});

describe('没有起课时间:载入按此刻并提示;从文件导入跳过并列出;全量恢复照旧带回', ()=>{
	const DateTime = require('../../components/comp/DateTime').default;
	test('判据 + 载入提示', ()=>{
		['', undefined, null, 'abc', '2020-13'].forEach((d)=>{ expect([d, KS.caseDivTimeUsable({ divTime: d })]).toEqual([d, false]); });
		['2020-03-04 05:06:07', '0500-03-04 05:06:07', '-0100-01-02 03:04:05', '2020/3/4', '2020-03-04'].forEach((d)=>{ expect([d, KS.caseDivTimeUsable({ divTime: d })]).toEqual([d, true]); });
		expect(KS.caseLoadNotices(GOOD)).toEqual([]);
		expect(KS.caseLoadNotices({ ...GOOD, lat: '' })).toEqual(['这条事盘没有可用地点，沿用当前地点']);
		expect(KS.caseLoadNotices({ ...GOOD, divTime: '' })).toEqual(['这条事盘没有起课时间，按此刻起课']);
	});
	test('主盘 / 表单 / 盘壳都按此刻(不是解析空串得到的乱码时刻)', ()=>{
		const now = new DateTime().format('YYYY-MM-DD');
		const rec = { ...GOOD, divTime: '' };
		expect(KS.caseRecordFieldsPatch(rec, BASE_FIELDS).date.value.format('YYYY-MM-DD')).toBe(now);
		const sc = runEffect('setCurrentCase', rec, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		expect(sc.payload.currentCase.divTime.value.format('YYYY-MM-DD')).toBe(now);
		const Shell = require('../../components/divination/DivinationChartShell').default;
		const sh = Object.create(Shell.prototype);
		sh.props = { saveModule: 'horary' };
		sh.state = { fields: { ...BASE_FIELDS, date: { value: KS.parseCaseRecordDivTime({ divTime: '1999-01-01 00:00:00' }) } }, extra: {} };
		let patched = null;
		sh.patchFields = (p)=>{ patched = p; };
		sh.setExtra = ()=>{};
		loadIntoStore({ ...rec, caseType: 'horary', sourceModule: 'horary', payload: JSON.stringify({ module: 'horary' }) });
		sh.applyRestoreIfAny();
		expect(patched.date.format('YYYY-MM-DD')).toBe(now);
	});
	test('从文件导入:坏条目跳过并列出(预览与导入同口径);全量恢复不传 rejectInvalid → 照旧带回', ()=>{
		const lc = require('../localcases');
		const { recordImportConfirmText } = require('../../components/user/recordListText');
		const { toastRecordImport } = require('../recordStoreNotice');
		localStorage.clear();
		const env = { format: 'horosa-local-cases', version: 1, cases: [
			{ cid: 'imp-1', event: '好的一条', caseType: 'liuyao', divTime: '2020-03-04 05:06:07' },
			{ cid: 'imp-2', event: '空时间那条', caseType: 'liuyao', divTime: '' },
			{ cid: 'imp-3', event: '缺时间那条', caseType: 'liuyao' },
		] };
		const pv = lc.previewLocalCasesBackup(env, { rejectInvalid: true });
		expect([pv.adds, pv.invalid]).toEqual([1, 2]);
		expect(recordImportConfirmText(pv)).toContain('没有起课时间的 2 条跳过（空时间那条、缺时间那条）');
		const r = lc.importLocalCasesBackup(env, { rejectInvalid: true });
		expect([r.imported, r.invalid]).toEqual([1, 2]);
		expect(lc.getLocalCase('imp-2')).toBe(null);
		const msgs = [];
		toastRecordImport({ success: (t)=>msgs.push(t), warning: (t)=>msgs.push(t), error: (t)=>msgs.push(t) }, 'case', r);
		expect(msgs[0]).toContain('没有起课时间的 2 条跳过（空时间那条、缺时间那条）');
		// 全量恢复口径:不判坏条目,自己备份里的旧条目照旧带回
		localStorage.clear();
		const r2 = lc.importLocalCasesBackup(env, {});
		expect([r2.imported, r2.invalid]).toEqual([3, 0]);
		expect(lc.previewLocalCasesBackup(env, {}).invalid).toBe(0);
		// 列表导入接了这条判据
		const list = fs.readFileSync(path.join(UI_SRC, 'components/user/CaseList.js'), 'utf8');
		expect(list).toContain('const recordOpts = { respectLocalDeletions: true, rejectInvalid: true };');
	});
});

describe('🔴 起课时间:判据认得出的写法,解析一定正确(判据与解析同一次匹配)', ()=>{
	const { parseCaseDivTimeParts, isCaseDivTimeText } = require('../caseDivTime');
	const fmt = (t)=>(t ? t.format('YYYY-MM-DD HH:mm:ss') : null);
	// [写法, 应解析成]
	const OK = [
		['2020-03-04 05:06:07', '2020-03-04 05:06:07'],
		['2020-03-04T05:06:07', '2020-03-04 05:06:07'],
		[' 2020-03-04 05:06:07 ', '2020-03-04 05:06:07'],
		['2020-03-04   05:06:07', '2020-03-04 05:06:07'],
		['2020/3/4 5:6', '2020-03-04 05:06:00'],
		['2020-03-04', '2020-03-04 12:00:00'],
		['1500-02-29 01:02:03', '1500-02-29 01:02:03'],
	];
	const BAD = ['2020-13-04 05:06:07', '2020-02-30', '2020-03-04 25:00', '2020-03-04 05:60', '2020-03-04T', 'x2020-03-04', '2020-03-04 05:06:07Z'];
	test.each(OK)('%s → %s(判据为真 ⇒ 三路解析逐字段等于捕获组)', (text, want)=>{
		expect(isCaseDivTimeText(text)).toBe(true);
		expect(KS.caseDivTimeUsable({ divTime: text })).toBe(true);
		const p = parseCaseDivTimeParts(text);
		expect(p.canonical).toBe(want);
		expect(fmt(KS.parseCaseRecordDivTime({ divTime: text, zone: '+08:00' }))).toBe(want);
		expect(fmt(KS.caseRecordFieldsPatch({ ...GOOD, divTime: text }, BASE_FIELDS).date.value)).toBe(want);
		const sc = runEffect('setCurrentCase', { ...GOOD, divTime: text }, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		expect(fmt(sc.payload.currentCase.divTime.value)).toBe(want);
	});
	test.each(BAD)('%s 认不出 = 坏档(按此刻 + 提示)', (text)=>{
		expect(isCaseDivTimeText(text)).toBe(false);
		expect(KS.parseCaseRecordDivTime({ divTime: text })).toBe(null);
		expect(KS.caseLoadNotices({ ...GOOD, divTime: text })).toContain('这条事盘没有起课时间，按此刻起课');
	});
	test('负年保真;只有日期另给一条提示', ()=>{
		const t = KS.parseCaseRecordDivTime({ divTime: '-0100-01-02 03:04:05' });
		expect(t.ad).toBe(-1);
		expect(fmt(t)).toBe(fmt(KS.parseCaseRecordDivTime({ divTime: '-100-1-2T03:04:05' })));
		expect(KS.caseLoadNotices({ ...GOOD, divTime: '2020-03-04' })).toEqual(['这条事盘的起课时间只有日期，按当天 12:00 起课']);
	});
	test('盘壳还原与主盘同一种解析', ()=>{
		const Shell = require('../../components/divination/DivinationChartShell').default;
		const sh = Object.create(Shell.prototype);
		sh.props = { saveModule: 'horary' };
		sh.state = { fields: { ...BASE_FIELDS, date: { value: KS.parseCaseRecordDivTime({ divTime: '1999-01-01 00:00:00' }) } }, extra: {} };
		let patched = null;
		sh.patchFields = (p)=>{ patched = p; };
		sh.setExtra = ()=>{};
		loadIntoStore({ ...GOOD, divTime: '2020-03-04T05:06:07', caseType: 'horary', sourceModule: 'horary', payload: JSON.stringify({ module: 'horary' }) });
		sh.applyRestoreIfAny();
		expect(fmt(patched.date)).toBe('2020-03-04 05:06:07');
	});
	test('源码:起课时刻串只经 parseCaseDivTimeInto 交给 DateTime.parse(不再各自直接 parse 原串)', ()=>{
		const files = ['utils/kentangCaseSave.js', 'components/divination/DivinationChartShell.js'];
		files.forEach((f)=>{
			const code = fs.readFileSync(path.join(UI_SRC, f), 'utf8').split('\n').map((l)=>l.replace(/\/\/.*$/, '')).join('\n');
			expect([f, /\.parse\(\s*(?:v\.|c\.)?divTime\b/.test(code)]).toEqual([f, false]);
		});
	});
});
