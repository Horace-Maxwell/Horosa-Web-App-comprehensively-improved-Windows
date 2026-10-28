// 非页面新建入口(AI 建档 / 名人库加入 / AI 页草稿存盘 / 外部导入 / AI 合成的本命源)一律按
// 「此刻点「新命盘」会用的设置」随盘记下:新盘种子 + 古典全局 + 你自己的紫微设置(不是刚载入那张盘的),并打代次标记。
// 另锁:名人建档两条路径同一构造;新增命盘不带上一张盘的批注;界面外改档案后按库重设当前那条。
require('../../models/astro');   // 注册字段工厂(= 「新命盘」用的那个)
const { recordNewChartSeeds, __resetNewChartSeedsForTest } = require('../newChartSeeds');
const { setClassicalChartGlobal, __resetClassicalGlobalsCacheForTest } = require('../classicalChartGlobals');
const { captureNewChartDefaults, withNewChartDefaults } = require('../newChartCapture');
const { ZIWEI_USER_SEED_KEY } = require('../ziweiRecordSettings');
const { RECORD_FIELDS_CAPTURE_MARK, RECORD_FIELDS_CAPTURE_GEN } = require('../recordFieldsRestore');
const { ZIWEI_SETTINGS_GEN_KEY, ZIWEI_SETTINGS_GEN } = require('../ziweiRecordSettings');

beforeEach(()=>{
	window.localStorage.clear();
	__resetNewChartSeedsForTest();
	__resetClassicalGlobalsCacheForTest();
});

describe('新盘缺省捕获', ()=>{
	test('🔴 种子 + 古典全局 + 你自己的紫微设置;不取刚载入那张盘留在本机偏好里的紫微设置', ()=>{
		recordNewChartSeeds({ hsys: 0, timeAlg: 1 });
		setClassicalChartGlobal('westNodeType', 'true');
		// 你自己的紫微设置(种子)= 中州;本机偏好此刻是刚载入那张盘的「自定义」流派
		window.localStorage.setItem(ZIWEI_USER_SEED_KEY, JSON.stringify({ sihuaSchool: 'zhongzhou' }));
		window.localStorage.setItem('ziweiSihuaSchool', 'custom');
		const cap = captureNewChartDefaults();
		expect(cap.hsys).toBe(0);
		expect(cap.timeAlg).toBe(1);
		expect(cap.westNodeType).toBe('true');
		expect(cap.sihuaSchool).toBe('zhongzhou');
		expect(cap[ZIWEI_SETTINGS_GEN_KEY]).toBe(ZIWEI_SETTINGS_GEN);
	});

	test('全是出厂值:只打两个代次标记;调用方给的键不覆盖;存库用的另带「按当前设置新建」', ()=>{
		const v = withNewChartDefaults({ name: '甲', hsys: 5 });
		expect(v.hsys).toBe(5);
		expect(v[RECORD_FIELDS_CAPTURE_MARK]).toBe(RECORD_FIELDS_CAPTURE_GEN);
		expect(v[ZIWEI_SETTINGS_GEN_KEY]).toBe(ZIWEI_SETTINGS_GEN);
		expect(v.captureCurrentGlobals).toBeUndefined();
		expect(withNewChartDefaults({ name: '甲' }, { forStore: true }).captureCurrentGlobals).toBe(true);
		// 宿占人事十二宫起宫恒落库(旧记录缺这个键按当时的偏好理解,新记录必须带上才分得清)
		const keys = Object.keys(withNewChartDefaults({ name: '甲' })).sort();
		expect(keys).toEqual(['fieldsCaptureGen', 'houseStartMode', 'name', 'ziweiSettingsGen'].sort());
	});

	test('没存过「你自己的紫微设置」(从没载入过记录):本机当前偏好就是你自己的', ()=>{
		window.localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
		expect(captureNewChartDefaults().sihuaSchool).toBe('zhongzhou');
	});
});

describe('各新建入口都走它', ()=>{
	test('🔴 AI 建档(create_chart_record):记录带上种子与紫微设置(此前只打标记 → 载入后全是出厂值)', async ()=>{
		recordNewChartSeeds({ hsys: 0 });
		window.localStorage.setItem(ZIWEI_USER_SEED_KEY, JSON.stringify({ sihuaSchool: 'zhongzhou' }));
		const tool = require('../aiTools/tools/createChartRecord').default;
		const r = await tool.run({ name: '乙', birth: '1990-05-18 10:00', gpsLat: 31.63, gpsLon: 118.45, gender: '男', selectAsAnalysisSource: false }, { actionId: 'a1' });
		expect(r.ok).toBe(true);
		expect(r.data.persisted).toBe(true);
		const rec = require('../localcharts').getLocalChart(r.data.cid);
		expect(rec.hsys).toBe(0);
		expect(rec.sihuaSchool).toBe('zhongzhou');
		expect(rec[RECORD_FIELDS_CAPTURE_MARK]).toBe(RECORD_FIELDS_CAPTURE_GEN);
	});

	test('🔴 名人建档两条路径同一构造:备注来源行 + 时辰未知行;不写死宿度制;新盘缺省 + 标记', ()=>{
		recordNewChartSeeds({ doubingSu28: 3 });
		const { buildCelebrityChartValues, celebrityMemo, CELEBRITY_NO_TIME_NOTE } = require('../astrodata/celebrityDedupe');
		const v = buildCelebrityChartValues({ cid: 'adb-1', name: 'X', birth: '1900-01-01 12:00:00', group: ['Astrodatabank', ''] }, { rodden: 'AA', sourceUrl: 'https://example.org/x', hasTime: false });
		expect(v.memo).toBe(`来自名人库(Astro-Databank,Rodden AA):https://example.org/x\n${CELEBRITY_NO_TIME_NOTE}`);
		expect(v.memo).toBe(celebrityMemo({ rodden: 'AA', sourceUrl: 'https://example.org/x', hasTime: false }));
		expect(v.group).toEqual(['Astrodatabank']);
		expect(v.doubingSu28).toBe(3);   // 来自你的新盘种子,不是写死的 0
		expect(v[RECORD_FIELDS_CAPTURE_MARK]).toBe(RECORD_FIELDS_CAPTURE_GEN);
		expect(v.captureCurrentGlobals).toBe(true);
	});

	test('名人库页的备注句式与宿主逐字一致;单独打开时复制出的 JSON 带名人库标志(导入时按新命盘设置补齐、已有的只刷新出生数据)', ()=>{
		const html = require('fs').readFileSync(require('path').resolve(__dirname, '../../../public/astrodata/index.html'), 'utf8');
		const m = /function celebrityMemo\(r\)\{[\s\S]*?\n\}/.exec(html);
		expect(m).toBeTruthy();
		// eslint-disable-next-line no-new-func
		const pageMemo = new Function(`${m[0]}; return celebrityMemo;`)();
		const { celebrityMemo } = require('../astrodata/celebrityDedupe');
		for(const r of [{ rodden: 'AA', adb_url: 'https://e/1', has_time: 1 }, { rodden: '', adb_url: '', has_time: 0 }, { rodden: 'C', adb_url: 'https://e/2', has_time: 0 }]){
			expect(pageMemo(r)).toBe(celebrityMemo({ rodden: r.rodden, sourceUrl: r.adb_url, hasTime: !!r.has_time }));
		}
		const { CELEBRITY_IMPORT_HINT_KEY } = require('../astrodata/celebrityDedupe');
		expect(html).toContain(`chart.${CELEBRITY_IMPORT_HINT_KEY}=1;`);
		expect(html).not.toContain('chart.fieldsCaptureGen=');
		expect(html).not.toContain('doubingSu28:0');
		expect(html).toContain("else if(d.status==='session'){toast(t.impSession);}");
		expect(html.split('impSession:').length - 1).toBe(2);   // 中英两份
	});

	test('AI 合成的本命源(cast_technique natal)按新命盘语义带设置', async ()=>{
		recordNewChartSeeds({ hsys: 0, timeAlg: 1 });
		const { buildSourceFromArgs } = require('../aiTools/tools/castTechnique');
		const r = await buildSourceFromArgs({ kind: 'natal', birth: '1990-05-18 10:00', gpsLat: 31.63, gpsLon: 118.45 });
		expect(r.source.record.hsys).toBe(0);
		expect(r.source.record.timeAlg).toBe(1);
		expect(r.source.record[RECORD_FIELDS_CAPTURE_MARK]).toBe(RECORD_FIELDS_CAPTURE_GEN);
	});
});

describe('models/user', ()=>{
	const userModel = require('../../models/user').default;
	const drive = (gen, feed)=>{ let st = gen.next(); const out = []; while(!st.done){ out.push(st.value); st = gen.next(feed ? feed(st.value) : undefined); } return { puts: out, ret: st.value }; };

	test('名人库静默加入:回 persisted;同 cid 的旧档不补代次标记', ()=>{
		const { upsertLocalChart, getLocalChart } = require('../localcharts');
		upsertLocalChart({ cid: 'adb-9', name: '旧档', birth: '1900-01-01 12:00:00' });
		const r1 = drive(userModel.effects.addLocalChartQuiet.call(userModel, { payload: { cid: 'adb-9', name: '旧档', birth: '1900-01-01 12:00:00' } }, { put: (a)=>a }));
		expect(r1.ret).toBe('persisted');
		expect(getLocalChart('adb-9')[RECORD_FIELDS_CAPTURE_MARK]).toBeUndefined();
		const r2 = drive(userModel.effects.addLocalChartQuiet.call(userModel, { payload: { cid: 'adb-10', name: '新', birth: '1900-01-01 12:00:00' } }, { put: (a)=>a }));
		expect(r2.ret).toBe('persisted');
		expect(getLocalChart('adb-10')[RECORD_FIELDS_CAPTURE_MARK]).toBe(RECORD_FIELDS_CAPTURE_GEN);
	});

	test('🔴 新增命盘不带上一张盘的八个批注;「存为命盘」(fromCurrent)带上', ()=>{
		const DateTime = require('../../components/comp/DateTime').default;
		const dt = new DateTime();
		const fld = { date: { value: dt }, zone: { value: '+08:00' }, lat: { value: '31n38' }, lon: { value: '118e27' }, group: { value: null }, memoAstro: { value: '甲的批注' }, memoBaZi: { value: '甲的八字批注' }, memo74: { value: null }, memoZiWei: { value: null }, memoGua: { value: null }, memoLiuReng: { value: null }, memoQiMeng: { value: null }, memoSuZhan: { value: null } };
		const run = (payload)=>{
			const gen = userModel.effects.newCurrentChart.call(userModel, { payload }, { put: (a)=>a, select: ()=>null, call: ()=>null });
			gen.next();   // select astro
			let st = gen.next({ fields: fld });
			while(!st.done && !(st.value && st.value.type === 'save')){ st = gen.next(); }
			return st.value.payload.currentChart;
		};
		const fresh = run({});
		expect(fresh.memoAstro.value == null).toBe(true);
		expect(fresh.memoBaZi.value == null).toBe(true);
		const saveAs = run({ fromCurrent: true });
		expect(saveAs.memoAstro.value).toBe('甲的批注');
		expect(saveAs.memoBaZi.value).toBe('甲的八字批注');
		expect(saveAs.fromCurrent.value).toBe(true);
		expect(fresh.fromCurrent.value).toBe(false);
	});

	test('🔴 页面新增的表单信封:日界 / 晚子时 / 时间算法 / 容许度 / 宿度制取新命盘缺省,不抄刚载入那张盘;「存为命盘」照抄', ()=>{
		const DateTime = require('../../components/comp/DateTime').default;
		const dt = new DateTime();
		const v = (x)=>({ value: x });
		const fld = { date: { value: dt }, zone: v('+08:00'), lat: v('31n38'), lon: v('118e27'), group: v(null), memo74: v(null), memoAstro: v(null), memoBaZi: v(null), memoZiWei: v(null), memoGua: v(null), memoLiuReng: v(null), memoQiMeng: v(null), memoSuZhan: v(null),
			after23NewDay: v(0), lateZiHourUseNextDay: v(0), timeAlg: v(2), orbs: v('{"x":1}'), orbScale: v(1.5), doubingSu28: v(3) };
		const run = (payload)=>{
			const gen = userModel.effects.newCurrentChart.call(userModel, { payload }, { put: (a)=>a, select: ()=>null, call: ()=>null });
			gen.next();
			let st = gen.next({ fields: fld });
			while(!st.done && !(st.value && st.value.type === 'save')){ st = gen.next(); }
			return st.value.payload.currentChart;
		};
		const cap = captureNewChartDefaults();
		const fresh = run({});
		['after23NewDay', 'lateZiHourUseNextDay', 'timeAlg', 'orbs', 'orbScale'].forEach((k)=>expect(fresh[k].value).toEqual(cap[k]));
		expect(fresh.doubingSu28.value).toBe(cap.doubingSu28 !== undefined ? cap.doubingSu28 : 0);
		const saveAs = run({ fromCurrent: true });
		expect(saveAs.after23NewDay.value).toBe(0);
		expect(saveAs.timeAlg.value).toBe(2);
		expect(saveAs.orbScale.value).toBe(1.5);
	});

	test('界面外改了档案(采纳提案):刷新列表;当前载入的正是这条 → 按库重设;只改名字不重排、只补显示字段', ()=>{
		const { upsertLocalChart } = require('../localcharts');
		upsertLocalChart({ cid: 'local-1-x', name: '改后', birth: '1990-01-01 08:00:00', zone: '+08:00' });
		const cur = { cid: { value: 'local-1-x' } };
		const gen = userModel.effects.syncRecordFromStore.call(userModel, { payload: { store: 'chart', cid: 'local-1-x', fields: ['name'] } }, { put: (a)=>a, select: ()=>cur });
		const r = drive(gen, (v)=>(v && v.type ? undefined : cur));
		const types = r.puts.filter((p)=>p && p.type).map((p)=>p.type);
		expect(types).toEqual(['fetchCharts', 'setCurrentChart', 'astro/patchRecordDisplayFields']);   // 只改名字:盘面标题 / 左栏显示字段跟着补
		const set = r.puts.find((p)=>p && p.type === 'setCurrentChart');
		expect(set.payload.name).toBe('改后');
		expect(set.payload.skipFetchByChartData).toBe(true);
		const gen2 = userModel.effects.syncRecordFromStore.call(userModel, { payload: { store: 'chart', cid: 'local-1-x', fields: ['birth'] } }, { put: (a)=>a, select: ()=>cur });
		const r2 = drive(gen2, (v)=>(v && v.type ? undefined : cur));
		expect(r2.puts.find((p)=>p && p.type === 'setCurrentChart').payload.skipFetchByChartData).toBe(false);
		expect(r2.puts.some((p)=>p && p.type === 'astro/patchRecordDisplayFields')).toBe(false);   // 改了起盘字段:整盘重排,不另补显示字段
	});

	test('提案采纳成功后广播档案改动', ()=>{
		const { upsertLocalChart } = require('../localcharts');
		const proposals = require('../aiAgent/proposals');
		const { RECORDS_CHANGED_EVENT } = require('../recordStoreNotice');
		upsertLocalChart({ cid: 'local-2-y', name: '原名', birth: '1990-01-01 08:00:00', zone: '+08:00' });
		const created = proposals.addProposal({ kind: 'record-edit', store: 'chart', recordId: 'local-2-y', title: '原名', before: { name: '原名' }, changes: { name: '新名' } });
		expect(created.ok).toBe(true);
		const got = [];
		const h = (e)=>got.push(e.detail);
		window.addEventListener(RECORDS_CHANGED_EVENT, h);
		const r = proposals.acceptProposal(created.proposal.id);
		expect(r.ok).toBe(true);
		expect(got).toEqual([{ store: 'chart', cid: 'local-2-y', fields: ['name'] }]);
		expect(proposals.revertProposal(created.proposal.id).ok).toBe(true);
		window.removeEventListener(RECORDS_CHANGED_EVENT, h);
		expect(got.length).toBe(2);
	});
});
