// 事盘记录 → 左栏字段:载入事盘(models/user applyCase 写主盘)与六爻补取 / 择日宿主覆盖层(currentCaseFieldsPatch)共用一份映射。
// 此前各写一份:currentCase 是表单字段形态,丢了记录顶层的时间算法,补取用的时间算法与之后左栏所示不一致;
// 空时区 / 空经纬两边处理也不同。现在补取按 setCurrentCase 存下的原样记录走同一个函数,逐键与载入后的左栏相同
import DateTime from '../../components/comp/DateTime';
import { setGlobalStore } from '../storageutil';
import { caseRecordFieldsPatch, currentCaseFieldsPatch, getKentangSavedCaseFieldsPatch, parseCaseRecordDivTime } from '../kentangCaseSave';
import userModel from '../../models/user';

const BASE_FIELDS = {
	date: { value: null, name: ['date'] }, time: { value: null, name: ['time'] }, ad: { value: 1, name: ['ad'] },
	zone: { value: '+09:00', name: ['zone'] }, lon: { value: '139e45', name: ['lon'] }, lat: { value: '35n40', name: ['lat'] },
	gpsLon: { value: 139.75, name: ['gpsLon'] }, gpsLat: { value: 35.67, name: ['gpsLat'] }, gender: { value: 1, name: ['gender'] },
	timeAlg: { value: 0, name: ['timeAlg'] }, after23NewDay: { value: 1, name: ['after23NewDay'] },
};
const RECORD = {
	cid: 'case-x', updateTime: 't1', caseType: 'guazhan', sourceModule: 'guazhan', divTime: '2020-03-04 05:06:07', zone: '+08:00',
	lon: '116e23', lat: '39n54', gpsLon: 116.38, gpsLat: 39.9, pos: '北京', gender: 0, timeAlg: 2,
	payload: JSON.stringify({ module: 'guazhan', fieldSnapshot: { timeAlg: 1, after23NewDay: 0, lateZiHourUseNextDay: 1 } }),
};

// 手驱 dva 的 effect 生成器:select 按给定 state 求值,put 记下动作
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

describe('caseRecordFieldsPatch(纯映射)', ()=>{
	test('时间算法 / 日界:记录顶层优先、回落快照;空时区回落左栏;空经纬 = 坏地点整组不写;性别空串 = 未指定', ()=>{
		const p = caseRecordFieldsPatch(RECORD, BASE_FIELDS);
		expect(p.timeAlg.value).toBe(2);
		expect(p.after23NewDay.value).toBe(0);
		expect(p.lateZiHourUseNextDay.value).toBe(1);
		expect(p.gender.value).toBe(0);
		expect(p.date.value.format('YYYY-MM-DD HH:mm:ss')).toBe('2020-03-04 05:06:07');
		const q = caseRecordFieldsPatch({ ...RECORD, zone: '', lon: '', gender: '', timeAlg: undefined }, BASE_FIELDS);
		expect(q.zone.value).toBe('+09:00');
		expect(Object.prototype.hasOwnProperty.call(q, 'lon')).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(q, 'lat')).toBe(false);
		expect(q.gender).toBeUndefined();
		expect(q.timeAlg.value).toBe(1);
	});
	test('条目照左栏条目的形状写新值,不就地改左栏', ()=>{
		const before = JSON.stringify(BASE_FIELDS);
		const p = caseRecordFieldsPatch(RECORD, BASE_FIELDS);
		expect(p.lon).toEqual({ value: '116e23', name: ['lon'] });
		expect(JSON.stringify(BASE_FIELDS)).toBe(before);
	});
});

describe('载入事盘与补取逐键相同', ()=>{
	test('applyCase 写主盘的就是这份映射;setCurrentCase 存下原样记录;补取与之逐键相同(含顶层时间算法)', ()=>{
		const puts = runEffect('applyCase', RECORD, { user: { caseApplySeq: 0 }, astro: { fields: BASE_FIELDS } });
		const fetch = puts.find((a)=>a.type === 'astro/fetchByFields');
		expect(fetch).toBeTruthy();
		const want = caseRecordFieldsPatch(RECORD, BASE_FIELDS);
		Object.keys(want).forEach((k)=>{
			const a = fetch.payload[k].value;
			const b = want[k].value;
			expect([k, a instanceof DateTime ? a.format('YYYY-MM-DD HH:mm:ss') : a]).toEqual([k, b instanceof DateTime ? b.format('YYYY-MM-DD HH:mm:ss') : b]);
		});
		// setCurrentCase:currentCase 表单形态 + 原样记录
		const sc = runEffect('setCurrentCase', RECORD, {});
		const saved = sc.find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		expect(saved.payload.currentCaseRecord).toBe(RECORD);
		setGlobalStore({ user: { currentCase: saved.payload.currentCase, currentCaseRecord: RECORD, caseApplySeq: 1, appliedCaseCid: 'case-x' }, astro: { fields: BASE_FIELDS } });
		const patch = currentCaseFieldsPatch({ timeAlg: true });
		expect(patch.timeAlg.value).toBe(2);   // 此前表单形态的 currentCase 没有顶层时间算法,恒取快照的 1
		['date', 'zone', 'lon', 'lat', 'gpsLon', 'gpsLat', 'pos', 'gender', 'after23NewDay', 'lateZiHourUseNextDay', 'timeAlg'].forEach((k)=>{
			const a = patch[k].value;
			const b = fetch.payload[k].value;
			expect([k, a instanceof DateTime ? a.format('YYYY-MM-DD HH:mm:ss') : a]).toEqual([k, b instanceof DateTime ? b.format('YYYY-MM-DD HH:mm:ss') : b]);
		});
		// 宿主覆盖层那一路不带时间算法(各页只作用本页),键集照旧
		expect(Object.keys(getKentangSavedCaseFieldsPatch('guazhan')).sort()).toEqual(['ad', 'after23NewDay', 'date', 'gender', 'gpsLat', 'gpsLon', 'lat', 'lateZiHourUseNextDay', 'lon', 'pos', 'time', 'zone']);
	});
	test('空时区的坏档:补取与载入同样回落左栏时区', ()=>{
		const rec = { ...RECORD, zone: '' };
		const fetch = runEffect('applyCase', rec, { user: { caseApplySeq: 0 }, astro: { fields: BASE_FIELDS } }).find((a)=>a.type === 'astro/fetchByFields');
		const sc = runEffect('setCurrentCase', rec, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		setGlobalStore({ user: { currentCase: sc.payload.currentCase, currentCaseRecord: rec }, astro: { fields: BASE_FIELDS } });
		const patch = currentCaseFieldsPatch();
		expect(fetch.payload.zone.value).toBe('+09:00');
		expect(patch).toBeTruthy();
		expect(patch.zone.value).toBe('+09:00');   // 此前按表单字段落成 '+08:00'(与载入后左栏的 +09:00 不同)
	});
	test('原样记录对不上(换了别的事盘 / 表单改过时刻 / 没存)→ 退回表单字段兜底', ()=>{
		const sc = runEffect('setCurrentCase', RECORD, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		const cur = sc.payload.currentCase;
		setGlobalStore({ user: { currentCase: cur, currentCaseRecord: { ...RECORD, cid: 'other' } }, astro: { fields: BASE_FIELDS } });
		expect(currentCaseFieldsPatch({ timeAlg: true }).timeAlg.value).toBe(1);
		setGlobalStore({ user: { currentCase: cur, currentCaseRecord: { ...RECORD, divTime: '2021-01-01 00:00:00' } }, astro: { fields: BASE_FIELDS } });
		expect(currentCaseFieldsPatch({ timeAlg: true }).timeAlg.value).toBe(1);
		setGlobalStore({ user: { currentCase: cur, currentCaseRecord: null }, astro: { fields: BASE_FIELDS } });
		expect(currentCaseFieldsPatch({ timeAlg: true }).timeAlg.value).toBe(1);
	});
	test('表单直接写 currentCase 时清掉原样记录;新建事盘也清', ()=>{
		const fs = require('fs'); const path = require('path');
		['CaseEditFormComp.js', 'CaseAddFormComp.js'].forEach((f)=>{
			expect(fs.readFileSync(path.join(__dirname, '../../components/user', f), 'utf8')).toContain('currentCaseRecord: null,');
		});
		const puts = runEffect('newCurrentCase', {}, { astro: { fields: {} } });
		expect(puts.some((a)=>a.type === 'save' && a.payload && a.payload.currentCaseRecord === null)).toBe(true);
	});
});

describe('补取的边角:非规范时刻写法 / 空地名 / 空经纬 / 删档', ()=>{
	test('古代年份补零等非规范写法:按 setCurrentCase 同法解析后比时刻,照样走原样记录(顶层时间算法)', ()=>{
		const rec = { ...RECORD, divTime: '0500-03-04 05:06:07' };
		const sc = runEffect('setCurrentCase', rec, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		setGlobalStore({ user: { currentCase: sc.payload.currentCase, currentCaseRecord: rec }, astro: { fields: BASE_FIELDS } });
		expect(currentCaseFieldsPatch({ timeAlg: true }).timeAlg.value).toBe(2);
	});
	test('空地名照写(地名与经纬对得上);经纬有一项空的坏档:地点整组(经纬 + 地名)不写进宿主补丁,不拼出混搭', ()=>{
		const setRec = (rec)=>{
			const sc = runEffect('setCurrentCase', rec, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
			setGlobalStore({ user: { currentCase: sc.payload.currentCase, currentCaseRecord: rec, caseApplySeq: 1, appliedCaseCid: 'case-x' }, astro: { fields: BASE_FIELDS } });
		};
		setRec({ ...RECORD, pos: '' });
		let p = getKentangSavedCaseFieldsPatch('guazhan');
		expect(p.pos.value).toBe('');
		expect(p.lon.value).toBe('116e23');
		expect(p.lat.value).toBe('39n54');
		// 只缺经度一项:此前只丢空的两键、留下记录的纬度与地名 → 宿主请求成了「宿主的经度 + 记录的纬度」
		setRec({ ...RECORD, lon: '', gpsLon: '' });
		p = getKentangSavedCaseFieldsPatch('guazhan');
		['lon', 'lat', 'gpsLon', 'gpsLat', 'pos'].forEach((k)=>{ expect([k, Object.prototype.hasOwnProperty.call(p, k)]).toEqual([k, false]); });
		expect(p.zone.value).toBe('+08:00');   // 地点以外照写
		expect(p.date.value.format('YYYY-MM-DD HH:mm:ss')).toBe('2020-03-04 05:06:07');
		setRec({ ...RECORD, lat: null });   // 纬度串缺:同样整组不写
		p = getKentangSavedCaseFieldsPatch('guazhan');
		expect(Object.prototype.hasOwnProperty.call(p, 'lon')).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(p, 'pos')).toBe(false);
		// 只有数值经纬写了空串:不算坏(后端算盘只用经纬串),记录的地点照写、数值经纬由串换算
		setRec({ ...RECORD, gpsLat: '' });
		p = getKentangSavedCaseFieldsPatch('guazhan');
		expect(p.lat.value).toBe('39n54');
		expect(p.gpsLat.value).toBeCloseTo(39.9, 6);
		expect(p.pos.value).toBe('北京');
		// 旧档整个没有数值经纬:同样照写记录的地点,数值经纬按串换算(此前是「记录的串 + 宿主的数值经纬」)
		const { gpsLon, gpsLat, ...noGps } = RECORD;
		setRec(noGps);
		p = getKentangSavedCaseFieldsPatch('guazhan');
		expect(p.lon.value).toBe('116e23');
		expect(p.pos.value).toBe('北京');
		expect(p.gpsLon.value).toBeCloseTo(116 + 23 / 60, 6);
		expect(p.gpsLat.value).toBeCloseTo(39 + 54 / 60, 6);
		// 串换算不出(非规范写法):只跳过数值经纬这一对,宿主自己的留着
		setRec({ ...noGps, lon: '116.38' });
		p = getKentangSavedCaseFieldsPatch('guazhan');
		expect(p.lon.value).toBe('116.38');
		expect(Object.prototype.hasOwnProperty.call(p, 'gpsLon')).toBe(false);
		setRec({ ...RECORD, lon: '116.38', gpsLon: '' });   // 记录的数值经度是空串、串又换算不出:同样只跳过这一项
		p = getKentangSavedCaseFieldsPatch('guazhan');
		expect(p.lon.value).toBe('116.38');
		expect(Object.prototype.hasOwnProperty.call(p, 'gpsLon')).toBe(false);
		expect(p.gpsLat.value).toBe(39.9);
	});
	test('六爻补取:与之后左栏实际落下的逐键相同 —— 坏档的地点两边都整组不写(左栏留着载入前的)', ()=>{
		const rec = { ...RECORD, lon: '', gpsLon: '' };
		const sc = runEffect('setCurrentCase', rec, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		setGlobalStore({ user: { currentCase: sc.payload.currentCase, currentCaseRecord: rec, caseApplySeq: 1, appliedCaseCid: 'case-x' }, astro: { fields: BASE_FIELDS } });
		const p = currentCaseFieldsPatch({ timeAlg: true });
		const fetch = runEffect('applyCase', rec, { user: { caseApplySeq: 0 }, astro: { fields: BASE_FIELDS } }).find((a)=>a.type === 'astro/fetchByFields');
		['lon', 'lat', 'gpsLon', 'gpsLat', 'pos'].forEach((k)=>{ expect([k, Object.prototype.hasOwnProperty.call(p, k)]).toEqual([k, false]); });
		['lon', 'lat', 'gpsLon', 'gpsLat'].forEach((k)=>{ expect([k, fetch.payload[k].value]).toEqual([k, BASE_FIELDS[k].value]); });
		expect(p.timeAlg.value).toBe(fetch.payload.timeAlg.value);
		const fs = require('fs'); const path = require('path');
		expect(fs.readFileSync(path.join(__dirname, '../../components/guazhan/GuaZhanMain.js'), 'utf8')).toContain('currentCaseFieldsPatch({ timeAlg: true })');
	});
	test('起课时刻解析(parseCaseRecordDivTime):建 currentCase 与补取比对同一种;时区缺 = +08:00;空 / 坏值 = null', ()=>{
		expect(parseCaseRecordDivTime({ divTime: '2020-03-04 05:06:07', zone: '+09:00' }).format('YYYY-MM-DD HH:mm:ss')).toBe('2020-03-04 05:06:07');
		expect(parseCaseRecordDivTime({ divTime: '2020-03-04 05:06:07', zone: '+09:00' }).zone).toBe('+09:00');
		expect(parseCaseRecordDivTime({ divTime: '2020-03-04 05:06:07' }).zone).toBe('+08:00');
		expect(parseCaseRecordDivTime({ divTime: '' })).toBe(null);
		expect(parseCaseRecordDivTime({})).toBe(null);
		expect(parseCaseRecordDivTime(null)).toBe(null);
		const dt = parseCaseRecordDivTime({ divTime: '2020-03-04 05:06:07' });
		expect(parseCaseRecordDivTime({ divTime: dt })).toBe(dt);
		// setCurrentCase 存下的 currentCase 时刻与这份解析逐字相同
		const sc = runEffect('setCurrentCase', { ...RECORD, divTime: '0500-03-04 05:06:07' }, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		expect(sc.payload.currentCase.divTime.value.format('YYYY-MM-DD HH:mm:ss')).toBe(parseCaseRecordDivTime({ ...RECORD, divTime: '0500-03-04 05:06:07' }).format('YYYY-MM-DD HH:mm:ss'));
	});
	test('删掉当前事盘(单条删除 / 批量删除 / 账本撤销删档):同一入口,currentCase 与原样记录一起清;别的事盘不动', ()=>{
		const st = { user: { currentCase: { cid: { value: 'case-x' } } } };
		let puts = runEffect('clearCurrentCaseIfRemoved', { cids: ['other', 'case-x'] }, st);
		expect(puts).toEqual([{ type: 'save', payload: { currentCase: null, currentCaseRecord: null } }]);
		puts = runEffect('clearCurrentCaseIfRemoved', { cids: ['other'] }, st);
		expect(puts).toEqual([]);
		puts = runEffect('clearCurrentCaseIfRemoved', { cids: [] }, st);
		expect(puts).toEqual([]);
		const fs = require('fs'); const path = require('path');
		const user = fs.readFileSync(path.join(__dirname, '../../models/user.js'), 'utf8');
		const ledger = fs.readFileSync(path.join(__dirname, '../aiTools/ledger.js'), 'utf8');
		const list = fs.readFileSync(path.join(__dirname, '../../components/user/CaseList.js'), 'utf8');
		expect(user).toContain('if(removed){ yield* clearCurrentCaseIn([values.cid], { put, select }); }');
		expect(ledger).toContain("dispatch({ type: 'user/clearCurrentCaseIfRemoved', payload: { cids: [cid] } });");
		expect(list).toContain("this.props.dispatch({ type: 'user/clearCurrentCaseIfRemoved', payload: { cids: removed } });");
		expect(user).not.toMatch(/payload: \{ currentCase: null \}/);
		expect(ledger).not.toMatch(/payload: \{ currentCase: null \}/);
		// 真实单条删除:删的是当前事盘 → 同一次清
		const { upsertLocalCase } = require('../localcases');
		upsertLocalCase({ cid: 'case-x', event: 'x', caseType: 'guazhan', divTime: '2020-03-04 05:06:07', zone: '+08:00' });
		const dputs = runEffect('deleteCase', { cid: 'case-x' }, st);
		expect(dputs.filter((a)=>a.type === 'save')).toEqual([{ type: 'save', payload: { currentCase: null, currentCaseRecord: null } }]);
	});
	test('新建事盘:原样记录与 currentCase 在同一次写里清', ()=>{
		const puts = runEffect('newCurrentCase', {}, { astro: { fields: {} } });
		const saves = puts.filter((a)=>a.type === 'save' && a.payload && Object.prototype.hasOwnProperty.call(a.payload, 'currentCaseRecord'));
		expect(saves.length).toBe(1);
		expect(saves[0].payload.currentCase).toBeTruthy();
	});
});


describe('地点一组:换算 / 主盘载入补数值经纬 / 兜底路径 / 卜卦类盘壳', ()=>{
	const KS = require('../kentangCaseSave');
	test('经纬串 → 十进制度:只认规范写法,与 AstroHelper 同一公式', ()=>{
		const AH = require('../../components/astro/AstroHelper');
		['116e23', '0w07', '121E28'].forEach((x)=>{ expect(KS.geoStrToDegree(x, 'lon')).toBeCloseTo(AH.convertLonStrToDegree(x), 9); });
		['39n54', '33s52', '51N30'].forEach((x)=>{ expect(KS.geoStrToDegree(x, 'lat')).toBeCloseTo(AH.convertLatStrToDegree(x), 9); });
		['', '116.38', 'abc', '39n54'].forEach((x)=>{ expect(KS.geoStrToDegree(x, 'lon')).toBe(null); });
		expect(KS.geoStrToDegree(null, 'lat')).toBe(null);
		expect(KS.geoStrToDegree('116e23', 'lat')).toBe(null);
	});
	test('casePlaceGroup:串缺 / 空 = null;串有效时数值经纬缺则换算,地名空串照写', ()=>{
		expect(KS.casePlaceGroup({ lon: '', lat: '39n54', pos: '北京' })).toBe(null);
		expect(KS.casePlaceGroup({ lon: '116e23', pos: '北京' })).toBe(null);
		const g = KS.casePlaceGroup({ lon: '116e23', lat: '39n54', gpsLon: 116.38, gpsLat: '', pos: '' });
		expect(g.gpsLon).toBe(116.38);
		expect(g.gpsLat).toBeCloseTo(39.9, 6);
		expect(g.pos).toBe('');
		expect(KS.casePlaceGroup({ lon: '116e23', lat: '39n54' }).pos).toBe('');
	});
	test('主盘载入(applyCase 那份映射):记录没有数值经纬时按串换算,不留载入前左栏的', ()=>{
		const { gpsLon, gpsLat, ...noGps } = RECORD;
		const p = caseRecordFieldsPatch(noGps, BASE_FIELDS);
		expect(p.gpsLon.value).toBeCloseTo(116 + 23 / 60, 6);
		expect(p.gpsLat.value).toBeCloseTo(39.9, 6);
		const q = caseRecordFieldsPatch({ ...RECORD, gpsLon: 116.4 }, BASE_FIELDS);
		expect(q.gpsLon.value).toBe(116.4);   // 记录带值照用
	});
	test('兜底路径(没有原样记录):地点同样当一组,地名空串照写', ()=>{
		const sc = runEffect('setCurrentCase', { ...RECORD, pos: '' }, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		setGlobalStore({ user: { currentCase: sc.payload.currentCase, currentCaseRecord: null, caseApplySeq: 1 }, astro: { fields: BASE_FIELDS } });
		let p = currentCaseFieldsPatch();
		expect(p.pos.value).toBe('');
		expect(p.lon.value).toBe('116e23');
		const sc2 = runEffect('setCurrentCase', { ...RECORD, lon: '' }, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
		setGlobalStore({ user: { currentCase: sc2.payload.currentCase, currentCaseRecord: null, caseApplySeq: 1 }, astro: { fields: BASE_FIELDS } });
		p = currentCaseFieldsPatch();
		['lon', 'lat', 'gpsLon', 'gpsLat', 'pos'].forEach((k)=>{ expect([k, Object.prototype.hasOwnProperty.call(p, k)]).toEqual([k, false]); });
	});
	test('原样记录那一路:地点没判坏、记录却没有地名(缺键 / null)→ 宿主补丁写空串,不留宿主的地名(与兜底路 / 盘壳同口径)', ()=>{
		const setRec = (rec)=>{
			const sc = runEffect('setCurrentCase', rec, {}).find((a)=>a.type === 'save' && a.payload && a.payload.currentCase);
			setGlobalStore({ user: { currentCase: sc.payload.currentCase, currentCaseRecord: rec, caseApplySeq: 1, appliedCaseCid: 'case-x' }, astro: { fields: { ...BASE_FIELDS, pos: { value: '上海', name: ['pos'] } } } });
		};
		const { pos, ...noPos } = RECORD;
		setRec(noPos);
		expect(getKentangSavedCaseFieldsPatch('guazhan').pos.value).toBe('');
		setRec({ ...RECORD, pos: null });
		expect(getKentangSavedCaseFieldsPatch('guazhan').pos.value).toBe('');
		// 六爻补取与宿主覆盖层同一份(主盘载入也写空串地名)
		setRec(noPos);
		expect(currentCaseFieldsPatch({ timeAlg: true }).pos.value).toBe('');
	});
	test('卜卦类盘壳载入事盘的地点走同一组判据(源码锚)', ()=>{
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../components/divination/DivinationChartShell.js'), 'utf8');
		expect(src).toContain('const place = casePlaceGroup(c);');
		expect(src).not.toContain("if(c.pos){ patch.pos = c.pos; }");
	});
});
