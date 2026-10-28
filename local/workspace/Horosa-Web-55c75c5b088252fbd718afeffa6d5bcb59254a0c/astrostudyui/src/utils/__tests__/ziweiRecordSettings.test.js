// 紫微排盘设置随盘:捕获(非默认 + 代次标记 + 自定义表)· 还原(有标记缺键复位 / 旧记录只套自带键 / 温启不套 / 不覆盖本机自定义表)·
// addChart 全链真落库 · 载入后 AI 挂载构造器按盘取值 · 紫微页已加载时同步写引擎单例与四化缓存。
import {
	captureZiweiRecordSettings, applyZiweiRecordSettings, currentZiweiSettings, registerZiweiEngineAdapter,
	ZIWEI_SETTINGS_GEN_KEY, ZIWEI_RECORD_SETTINGS_EVENT, ZIWEI_RECORD_SETTINGS, ZIWEI_USER_SEED_KEY,
	noteZiweiUserPrefWrite, restoreZiweiUserSeed, currentZiweiUserSeed, ziweiRecordWithDefaults,
	currentZiweiSessionTables, dropZiweiSessionTablesUnlessFor,
} from '../ziweiRecordSettings';
import { markFieldsCaptured } from '../recordFieldsRestore';
import userModel from '../../models/user';
import '../../models/astro';
import { listLocalCharts, getLocalChart } from '../localcharts';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

function runEffect(effectFn, action, stubState){
	const io = { select: (sel)=>({ __SELECT__: sel }), put: (a)=>({ __PUT__: a }), call: ()=>({ __CALL__: true }) };
	const gen = effectFn.call(userModel, action, io);
	let input;
	for(let guard = 0; guard < 200; guard += 1){
		const step = gen.next(input);
		if(step.done){ break; }
		input = undefined;
		if(step.value && step.value.__SELECT__){ input = step.value.__SELECT__(stubState); }
	}
}

beforeEach(()=>{ window.localStorage.clear(); registerZiweiEngineAdapter(null); });

describe('捕获', ()=>{
	it('全默认 = 只有代次标记;非默认键原样落(数字 / 局数 / 开关 / 关系人)', ()=>{
		expect(captureZiweiRecordSettings()).toEqual({ [ZIWEI_SETTINGS_GEN_KEY]: 1 });
		localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
		localStorage.setItem('ziweiDaxianSpan', 'ju');
		localStorage.setItem('ziweiChildLimit', '1');
		localStorage.setItem('ziweiXiaoxianYinyang', '1');
		localStorage.setItem('ziweiTaiSuiRelatives', JSON.stringify([{ branch: '午', role: '母', sex: 'female' }]));
		localStorage.setItem('ziweiStarSet', 'full');   // 与默认相同 → 不落
		const c = captureZiweiRecordSettings();
		expect(c).toEqual({
			sihuaSchool: 'zhongzhou', daxianSpan: 'ju', childLimit: true, ziweiXiaoxianYinyang: '1',
			taiSuiRelatives: [{ branch: '午', role: '母', sex: 'female' }], [ZIWEI_SETTINGS_GEN_KEY]: 1,
		});
	});
	it('晚子时旧默认 zi_chu 未迁移 = 跟随全局(不落);迁移后显式选的照落', ()=>{
		localStorage.setItem('ziweiLateZi', 'zi_chu');
		expect(captureZiweiRecordSettings().lateZi).toBeUndefined();
		localStorage.setItem('ziweiLateZiMigrated', '1');
		expect(captureZiweiRecordSettings().lateZi).toBe('zi_chu');
	});
	it('自定义四化 / 亮度表:只在选中「自定义」时随盘捕获表文', ()=>{
		localStorage.setItem('ziweiSihuaCustom', '{"甲":["廉贞","破军","武曲","太阳"]}');
		expect(captureZiweiRecordSettings().sihuaCustomTable).toBeUndefined();
		localStorage.setItem('ziweiSihuaSchool', 'custom');
		localStorage.setItem('ziweiBrightnessSource', 'custom');
		localStorage.setItem('ziweiBrightnessCustom', '{"紫微":{}}');
		const c = captureZiweiRecordSettings();
		expect(c.sihuaCustomTable).toBe('{"甲":["廉贞","破军","武曲","太阳"]}');
		expect(c.brightnessCustomTable).toBe('{"紫微":{}}');
	});
});

describe('还原', ()=>{
	it('🔴 有紫微代次标记:自带键写回、缺键复位默认(删偏好键);只广播一次', ()=>{
		localStorage.setItem('ziweiHuoling', 'nanpai');
		localStorage.setItem('ziweiZhongxian', '1');
		const events = [];
		const h = (e)=>events.push(e.detail);
		window.addEventListener(ZIWEI_RECORD_SETTINGS_EVENT, h);
		const r = applyZiweiRecordSettings({ cid: 'c1', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'zhongzhou', daxianSpan: 'ju', borrowPalace: true });
		window.removeEventListener(ZIWEI_RECORD_SETTINGS_EVENT, h);
		expect(localStorage.getItem('ziweiSihuaSchool')).toBe('zhongzhou');
		expect(localStorage.getItem('ziweiDaxianSpan')).toBe('ju');
		expect(localStorage.getItem('ziweiBorrowPalace')).toBe('1');
		expect(localStorage.getItem('ziweiHuoling')).toBe(null);     // 缺键 = 保存时默认 → 复位
		expect(localStorage.getItem('ziweiZhongxian')).toBe(null);
		expect(currentZiweiSettings().huoling).toBe('sanhe');
		expect(r.changed).toBe(5);
		expect(events.length).toBe(1);
		expect(events[0].cid).toBe('c1');
	});
	it('🔴 没有紫微代次标记的旧记录(含带通用 fieldsCaptureGen 的盘):只套自带键,其余保持现状', ()=>{
		localStorage.setItem('ziweiHuoling', 'nanpai');
		localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
		applyZiweiRecordSettings({ cid: 'old', fieldsCaptureGen: 1 });
		expect(localStorage.getItem('ziweiHuoling')).toBe('nanpai');
		expect(localStorage.getItem('ziweiSihuaSchool')).toBe('zhongzhou');
		applyZiweiRecordSettings({ cid: 'old2', fieldsCaptureGen: 1, starSet: 'north18' });
		expect(localStorage.getItem('ziweiStarSet')).toBe('north18');
		expect(localStorage.getItem('ziweiHuoling')).toBe('nanpai');
	});
	it('温启恢复不套用;没变化不广播', ()=>{
		localStorage.setItem('ziweiHuoling', 'nanpai');
		expect(applyZiweiRecordSettings({ cid: 'b', bootRestore: true, [ZIWEI_SETTINGS_GEN_KEY]: 1 }).changed).toBe(0);
		expect(localStorage.getItem('ziweiHuoling')).toBe('nanpai');
		const events = [];
		const h = ()=>events.push(1);
		window.addEventListener(ZIWEI_RECORD_SETTINGS_EVENT, h);
		applyZiweiRecordSettings({ cid: 's', huoling: 'nanpai' });
		window.removeEventListener(ZIWEI_RECORD_SETTINGS_EVENT, h);
		expect(events.length).toBe(0);
	});
	it('🔴 自定义表:记录随盘的表 = 本次会话的临时表(不写本机、不进 IDB;本机的表原样);可切到「自定义」;都没有时不切;「新命盘」撤掉', ()=>{
		const { currentZiweiSessionTables, restoreZiweiUserSeed } = require('../ziweiRecordSettings');
		localStorage.setItem('ziweiBrightnessCustom', '{"本机":1}');
		applyZiweiRecordSettings({ cid: 'x', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'custom', sihuaCustomTable: '{"甲":[]}', brightnessSource: 'custom', brightnessCustomTable: '{"记录":1}' });
		expect(localStorage.getItem('ziweiBrightnessCustom')).toBe('{"本机":1}');   // 本机的表不覆盖
		expect(localStorage.getItem('ziweiSihuaCustom')).toBe(null);               // 记录的表不写进本机
		expect(currentZiweiSessionTables()).toEqual({ sihua: '{"甲":[]}', brightness: '{"记录":1}' });
		expect(localStorage.getItem('ziweiSihuaSchool')).toBe('custom');
		expect(localStorage.getItem('ziweiBrightnessSource')).toBe('custom');
		// 存为命盘(当前所见)存的是正在用的临时表
		const { captureZiweiRecordSettings } = require('../ziweiRecordSettings');
		expect(captureZiweiRecordSettings().sihuaCustomTable).toBe('{"甲":[]}');
		// 载入一张不带表的盘 → 临时表撤掉
		applyZiweiRecordSettings({ cid: 'z', [ZIWEI_SETTINGS_GEN_KEY]: 1 });
		expect(currentZiweiSessionTables()).toEqual({ sihua: null, brightness: null });
		applyZiweiRecordSettings({ cid: 'x2', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaCustomTable: '{"乙":[]}' });
		restoreZiweiUserSeed();
		expect(currentZiweiSessionTables()).toEqual({ sihua: null, brightness: null });
		// 记录与本机都没有四化表 → 不切「自定义」,带标记的盘回到默认北派(不停在上一张盘的流派)
		localStorage.clear();
		localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
		applyZiweiRecordSettings({ cid: 'y', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'custom' });
		expect(localStorage.getItem('ziweiSihuaCustom')).toBe(null);
		expect(localStorage.getItem('ziweiSihuaSchool')).toBe('zhongzhou');   // 无表可用:保持原流派不动(不切到空表)
	});
	it('🔴 临时表重启后随温启恢复的同一张盘沿用(此前只在内存:重启后左栏仍「自定义」、盘面回落通用表);别的盘不沿用;编辑哪张自己的表只撤哪张', ()=>{
		const rec = { cid: 'keep-1', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'custom', sihuaCustomTable: '{"甲":["太阳"]}', brightnessSource: 'custom', brightnessCustomTable: '{"记录":2}' };
		applyZiweiRecordSettings(rec);
		expect(JSON.parse(localStorage.getItem('ziweiSessionTables'))).toEqual({ cid: 'keep-1', sihua: '{"甲":["太阳"]}', brightness: '{"记录":2}' });
		const persisted = localStorage.getItem('ziweiSessionTables');
		// 模拟重启:模块重新加载,从本机读回
		const restart = ()=>{ jest.resetModules(); return require('../ziweiRecordSettings'); };
		let fresh = restart();
		expect(fresh.currentZiweiSessionTables()).toEqual({ sihua: '{"甲":["太阳"]}', brightness: '{"记录":2}' });
		fresh.applyZiweiRecordSettings({ cid: 'keep-1', bootRestore: true });
		expect(fresh.currentZiweiSessionTables()).toEqual({ sihua: '{"甲":["太阳"]}', brightness: '{"记录":2}' });
		expect(fresh.captureZiweiRecordSettings().sihuaCustomTable).toBe('{"甲":["太阳"]}');
		fresh.applyZiweiRecordSettings({ cid: 'other', bootRestore: true });
		expect(fresh.currentZiweiSessionTables()).toEqual({ sihua: null, brightness: null });
		expect(localStorage.getItem('ziweiSessionTables')).toBe(null);
		localStorage.setItem('ziweiSessionTables', persisted);
		fresh = restart();
		fresh.clearZiweiSessionTables('sihua');
		expect(fresh.currentZiweiSessionTables()).toEqual({ sihua: null, brightness: '{"记录":2}' });
		fresh.clearZiweiSessionTables('brightness');
		expect(fresh.currentZiweiSessionTables()).toEqual({ sihua: null, brightness: null });
		expect(localStorage.getItem('ziweiSessionTables')).toBe(null);
		// 温启没落成(用户抢先动手 / 排盘失败回落「此刻」):当前看的不是那张盘就撤掉临时表
		localStorage.setItem('ziweiSessionTables', persisted);
		fresh = restart();
		fresh.dropZiweiSessionTablesUnlessFor('keep-1');
		expect(fresh.currentZiweiSessionTables().sihua).toBe('{"甲":["太阳"]}');
		fresh.dropZiweiSessionTablesUnlessFor('');
		expect(fresh.currentZiweiSessionTables()).toEqual({ sihua: null, brightness: null });
		const astroSrc = require('fs').readFileSync(require('path').join(__dirname, '../../models/astro.js'), 'utf8');
		expect((astroSrc.match(/keepSessionFor\(/g) || []).length).toBe(4);   // 两处放弃 + 两处失败
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../components/ziwei/ZiWeiInput.js'), 'utf8');
		expect(src).toContain("clearZiweiSessionTables('sihua');");
		expect(src).toContain("clearZiweiSessionTables('brightness');");
		restoreZiweiUserSeed();
	});
	it('没有 cid 的记录带来的临时表:归属记为空(不沿用上一张盘的 cid)、只放内存不落盘;温启放弃时不误撤正看着的这张', ()=>{
		const A = { cid: 'boot-A', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'custom', sihuaCustomTable: '{"甲":["太阳"]}' };
		applyZiweiRecordSettings(A);
		expect(JSON.parse(localStorage.getItem('ziweiSessionTables')).cid).toBe('boot-A');
		const X = { [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'custom', sihuaCustomTable: '{"乙":["天机"]}' };
		applyZiweiRecordSettings(X);
		expect(currentZiweiSessionTables().sihua).toBe('{"乙":["天机"]}');
		expect(localStorage.getItem('ziweiSessionTables')).toBe(null);   // 无归属不落盘
		// 温启 A 的响应回来判放弃:当前看的是 X(无 cid)→ X 的表留着(此前归属被记成 A,这里被撤)
		dropZiweiSessionTablesUnlessFor('');
		expect(currentZiweiSessionTables().sihua).toBe('{"乙":["天机"]}');
		restoreZiweiUserSeed();
	});
	it('晚子时「子初换日」随盘还原后同时落迁移标志,不会被一次性迁移改成「跟随全局」', ()=>{
		applyZiweiRecordSettings({ cid: 'lz', lateZi: 'zi_chu' });
		expect(localStorage.getItem('ziweiLateZi')).toBe('zi_chu');
		expect(localStorage.getItem('ziweiLateZiMigrated')).toBe('1');
		expect(currentZiweiSettings().lateZi).toBe('zi_chu');
	});
	it('紫微页已加载(登记了引擎写入器)→ 同步写单例;四化流派走专用分支', ()=>{
		const writes = [];
		registerZiweiEngineAdapter({ write: (spec, v)=>writes.push([spec.opt || spec.key, v]) });
		applyZiweiRecordSettings({ cid: 'a', sihuaSchool: 'zhongzhou', ziweiXiaoxianYinyang: '1', taiSuiRelatives: '[{"branch":"子"}]' });
		expect(writes).toEqual([['@school', 'zhongzhou'], ['xiaoxianMode', '1'], ['taiSuiRelatives', [{ branch: '子' }]]]);
	});
	it('记录键 = AI 挂载构造器直读的键(存一次、两处都认)', ()=>{
		const fs = require('fs');
		const path = require('path');
		const src = readSource(path.join(__dirname, '..', 'aiAnalysisContext.js'));
		const at = src.indexOf('function buildChartZiweiParams(');
		const body = src.slice(at, src.indexOf('\n}\n', at));
		ZIWEI_RECORD_SETTINGS.forEach((spec)=>{
			expect([spec.key, new RegExp(`['"]${spec.key}['"]|record\\.${spec.key}\\b`).test(body)]).toEqual([spec.key, true]);
		});
	});
});

describe('全链', ()=>{
	it('🔴 addChart 真落库:紫微非默认设置 + 代次标记随盘;载入还原后 AI 挂载按盘取值', ()=>{
		localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
		localStorage.setItem('ziweiKuiYue', 'geng_ma_hu');
		const DateTime = require('../../components/comp/DateTime').default;
		const tm = new DateTime();
		tm.setZone('+08:00');
		const birth = tm.parse('1990-05-05 10:00:00', 'YYYY-MM-DD HH:mm:ss');
		runEffect(userModel.effects.addChart, { payload: { cid: 'local-zw-1', name: '紫微随盘', birth, lat: '39n54', lon: '116e23', gender: 1, isPub: 0 } }, { astro: { fields: {} } });
		const rec = getLocalChart('local-zw-1') || listLocalCharts().find((r)=>r.cid === 'local-zw-1');
		expect(rec).toBeTruthy();
		expect(rec.sihuaSchool).toBe('zhongzhou');
		expect(rec.kuiYue).toBe('geng_ma_hu');
		expect(rec[ZIWEI_SETTINGS_GEN_KEY]).toBe(1);
		expect(rec.huoling).toBeUndefined();
		// 换成别的设置后载入该盘 → 还原成存盘时的样子
		localStorage.setItem('ziweiSihuaSchool', 'beipai');
		localStorage.setItem('ziweiHuoling', 'nanpai');
		applyZiweiRecordSettings(rec);
		expect(currentZiweiSettings().sihuaSchool).toBe('zhongzhou');
		expect(currentZiweiSettings().kuiYue).toBe('geng_ma_hu');
		expect(currentZiweiSettings().huoling).toBe('sanhe');
	});
	it('🔴 载入入口 astro/fetchByChartData:排盘成功后写回记录的紫微设置;排盘失败不改;温启恢复不写', ()=>{
		const astroModel = require('../../models/astro').default;
		const drive = (payload, rsp)=>{
			const io = { select: (sel)=>({ __SELECT__: sel }), put: (a)=>({ __PUT__: a }), call: ()=>({ __CALL__: true }) };
			const gen = astroModel.effects.fetchByChartData.call(astroModel, { payload }, io);
			let input; let sawCall = false;
			try{
				for(let guard = 0; guard < 50; guard += 1){
					const step = gen.next(input);
					if(step.done){ break; }
					input = undefined;
					if(step.value && step.value.__SELECT__){ input = step.value.__SELECT__({ astro: { ...astroModel.state, chartObj: null } }); }
					if(step.value && step.value.__CALL__){
						if(sawCall){ break; }
						sawCall = true; input = rsp;
					}else if(sawCall && step.value && step.value.__PUT__){ break; }
				}
			}catch(e){ /* 写回之后的盘面拼装依赖真响应,不在本测试范围 */ }
			return sawCall;
		};
		const rec = { cid: 'local-zw-2', name: '载入', birth: '1990-05-05 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'zhongzhou' };
		localStorage.setItem('ziweiHuoling', 'nanpai');
		drive({ ...rec, bootRestore: true }, { Result: { params: {} } });
		expect(localStorage.getItem('ziweiSihuaSchool')).toBe(null);
		expect(drive(rec, null)).toBe(true);                       // 排盘失败
		expect(localStorage.getItem('ziweiSihuaSchool')).toBe(null);
		expect(localStorage.getItem('ziweiHuoling')).toBe('nanpai');
		expect(drive(rec, { Result: { params: {} } })).toBe(true);  // 排盘成功
		expect(localStorage.getItem('ziweiSihuaSchool')).toBe('zhongzhou');
		expect(localStorage.getItem('ziweiHuoling')).toBe(null);
	});
});

describe('你自己的设置(新盘种子)与本盘生效值分开', ()=>{
	it('🔴 载入记录只改本盘生效值;载入前你自己的设置存一份,「新命盘」时用回', ()=>{
		localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');      // 你平时用中州派
		applyZiweiRecordSettings({ cid: 'a', [ZIWEI_SETTINGS_GEN_KEY]: 1 });   // 载入一张全默认存的盘
		expect(currentZiweiSettings().sihuaSchool).toBe('beipai');  // 本盘生效 = 北派
		expect(currentZiweiUserSeed().sihuaSchool).toBe('zhongzhou');
		applyZiweiRecordSettings({ cid: 'b', [ZIWEI_SETTINGS_GEN_KEY]: 1, huoling: 'nanpai' });   // 再载入别的盘:种子不变
		expect(currentZiweiUserSeed().sihuaSchool).toBe('zhongzhou');
		expect(currentZiweiUserSeed().huoling).toBe('sanhe');
		const r = restoreZiweiUserSeed();
		expect(r.changed).toBeGreaterThan(0);
		expect(currentZiweiSettings().sihuaSchool).toBe('zhongzhou');
		expect(currentZiweiSettings().huoling).toBe('sanhe');
	});
	it('在紫微左栏亲手改的项记进你自己的设置;没载入过记录时种子就是当前偏好', ()=>{
		localStorage.setItem('ziweiKuiYue', 'geng_ma_hu');
		noteZiweiUserPrefWrite('ziweiKuiYue');
		expect(currentZiweiUserSeed().kuiYue).toBe('geng_ma_hu');
		applyZiweiRecordSettings({ cid: 'c', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'quanshu' });
		localStorage.setItem('ziweiHuoling', 'nanpai');            // 看着别的盘时亲手改火铃
		noteZiweiUserPrefWrite('ziweiHuoling');
		noteZiweiUserPrefWrite('ziweiChartType');                   // 非随盘键:忽略
		restoreZiweiUserSeed();
		expect(currentZiweiSettings()).toEqual(expect.objectContaining({ sihuaSchool: 'beipai', kuiYue: 'geng_ma_hu', huoling: 'nanpai' }));
		expect(Object.keys(JSON.parse(localStorage.getItem(ZIWEI_USER_SEED_KEY))).sort()).toEqual(ZIWEI_RECORD_SETTINGS.map((it)=>it.key).sort());
	});
	it('从没存过种子时「新命盘」什么都不动', ()=>{
		localStorage.setItem('ziweiHuoling', 'nanpai');
		expect(restoreZiweiUserSeed().changed).toBe(0);
		expect(localStorage.getItem('ziweiHuoling')).toBe('nanpai');
	});
	it('🔴 「新命盘」入口 astro/nowChart(不带 fields)排盘成功后用回种子;排盘失败不动;带 fields 的(重算当前)不动、标了当新盘处理的用回', ()=>{
		const astroModel = require('../../models/astro').default;
		// 驱动到「排盘回包」那一步:select(astro state)→ call(fetchChart)→ 喂回包
		const drive = (payload, rsp)=>{
			const io = { select: (sel)=>({ __SELECT__: sel }), put: (a)=>({ __PUT__: a }), call: ()=>({ __CALL__: true }) };
			const gen = astroModel.effects.nowChart.call(astroModel, { payload }, io);
			try{
				gen.next();
				gen.next({});
				gen.next(rsp);
			}catch(e){ /* 只看用回种子那一步的副作用 */ }
		};
		localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
		applyZiweiRecordSettings({ cid: 'd', [ZIWEI_SETTINGS_GEN_KEY]: 1 });
		expect(currentZiweiSettings().sihuaSchool).toBe('beipai');
		drive({ fields: astroModel.state.fields }, { Result: {} });
		expect(currentZiweiSettings().sihuaSchool).toBe('beipai');
		drive({}, null);   // 排盘失败:盘没换,设置也不换
		expect(currentZiweiSettings().sihuaSchool).toBe('beipai');
		drive({}, { Result: {} });
		expect(currentZiweiSettings().sihuaSchool).toBe('zhongzhou');
		// 🔴 带字段但「当新盘处理」(启动的此刻盘 / 玄学史建盘):同样用回你自己的设置
		applyZiweiRecordSettings({ cid: 'e', [ZIWEI_SETTINGS_GEN_KEY]: 1 });
		expect(currentZiweiSettings().sihuaSchool).toBe('beipai');
		drive({ fields: astroModel.state.fields, asNewChart: true }, { Result: {} });
		expect(currentZiweiSettings().sihuaSchool).toBe('zhongzhou');
	});
	it('🔴 启动的「此刻」盘按新盘收尾(bootChartOrNow 无快照路径带 asNewChart)', ()=>{
		const { bootChartOrNow } = require('../../models/app');
		const gen = bootChartOrNow({ a: 1 }, (sel)=>({ __SELECT__: sel }), (a)=>a, ()=>null);
		gen.next();
		const st = gen.next({ bootChartRestore: null }).value;
		expect(st).toEqual({ type: 'astro/nowChart', payload: { fields: { a: 1 }, asNewChart: true } });
	});
	it('🔴 玄学史建盘:以新命盘字段为底(不带当前那张的 cid 与口径),排盘成功才落字段,按新盘收尾', ()=>{
		require('../../models/astro');
		const XuanShiMain = require('../../components/xuanshi/XuanShiMain').default;
		const { fieldsSchemaBaseline } = require('../recordFieldsRestore');
		const cur = { ...fieldsSchemaBaseline(), cid: { name: ['cid'], value: 'loaded-1' }, hsys: { name: ['hsys'], value: 7 } };
		const calls = [];
		const inst = new XuanShiMain({ fields: cur, dispatch: (a)=>calls.push(a), predictHook: {} });
		inst.chartLink({ modern_date: '1054-07-04', dynasty: '宋', title: '天关客星' }, 'astrochart');
		const save = calls.find((a)=>a.type === 'astro/save');
		const now = calls.find((a)=>a.type === 'astro/nowChart');
		expect(save && save.payload.fields).toBeUndefined();
		expect(now.payload.asNewChart).toBe(true);
		expect(now.payload.fields.cid.value == null).toBe(true);
		expect(now.payload.fields.hsys.value).toBe(fieldsSchemaBaseline().hsys.value);
		expect(now.payload.fields.name.value).toContain('玄学史');
	});
	it('紫微左栏改设置的写入都经同一包装(写完即记种子)', ()=>{
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../components/ziwei/ZiWeiInput.js'), 'utf8');
		expect(src).toContain("import { safeLocalStorageSet as rawLocalStorageSet } from '../../utils/safeStorage';");
		expect(src).toContain('if(ok){ try{ noteZiweiUserPrefWrite(key); }catch(e){');
		expect(src).not.toMatch(/localStorage\.setItem\('ziwei/);
	});
});

describe('挂载齿轮覆盖(内外两层同锚)', ()=>{
	it('🔴 带标记、没存四化流派的盘(存盘时 = 出厂北派),全局现为中州:齿轮选中州 → 合并后的记录真带中州(此前内层按全局现值剪掉)', ()=>{
		const { effectiveMountBaseline, pruneOptionsToNonDefault, mergeOptionsIntoRecord } = require('../techniqueMountSettings');
		const { buildChartZiweiParams } = require('../aiAnalysisContext');
		const ZWConst = require('../../constants/ZWConst');
		const prev = ZWConst.ZWSchool.school;
		try{
			localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
			ZWConst.ZWSchool.school = 'zhongzhou';
			const rec = { cid: 'zw-m', name: 'M', birth: '1990-05-05 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', gender: 1, [ZIWEI_SETTINGS_GEN_KEY]: 1 };
			const base = effectiveMountBaseline('ziwei', rec);
			expect(base.sihuaSchool).toBe('beipai');
			const opts = pruneOptionsToNonDefault('ziwei', { sihuaSchool: 'zhongzhou' }, base);
			expect(opts).toEqual({ sihuaSchool: 'zhongzhou' });
			const merged = mergeOptionsIntoRecord(rec, 'ziwei', opts);
			expect(merged.sihuaSchool).toBe('zhongzhou');
			expect(buildChartZiweiParams(merged).sihuaSchool).toBe('zhongzhou');
		}finally{
			ZWConst.ZWSchool.school = prev;
		}
	});
});

describe('其它入口', ()=>{
	it('🔴 新建记录的通用标记同时打紫微代次标记(名人库加入 / AI 建档 / AI 名人建档 / AI 分析快速存盘都经它)', ()=>{
		expect(markFieldsCaptured({ cid: 'n' })).toEqual(expect.objectContaining({ fieldsCaptureGen: 1, [ZIWEI_SETTINGS_GEN_KEY]: 1 }));
		expect(markFieldsCaptured({ cid: 'n', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'zhongzhou' }).sihuaSchool).toBe('zhongzhou');
	});
	it('🔴 编辑保存(updateChart)后重新载入用库里的完整记录:随盘的紫微设置整套还原,不出混合状态', ()=>{
		const { upsertLocalChart } = require('../localcharts');
		upsertLocalChart({ cid: 'local-ed', name: '旧名', birth: '1990-05-05 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', gender: 1,
			[ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'zhongzhou', kuiYue: 'geng_ma_hu' });
		const puts = [];
		const io = { select: (sel)=>({ __SELECT__: sel }), put: (a)=>{ puts.push(a); return { __PUT__: a }; }, call: ()=>({ __CALL__: true }) };
		const gen = userModel.effects.updateChart.call(userModel, { payload: { cid: 'local-ed', name: '新名', lat: '39n54', lon: '116e23', gender: 1 } }, io);
		for(let g = 0; g < 20; g += 1){ const st = gen.next(); if(st.done){ break; } }
		const fetch = puts.find((a)=>a.type === 'astro/fetchByChartData');
		expect(fetch.payload).toEqual(expect.objectContaining({ name: '新名', [ZIWEI_SETTINGS_GEN_KEY]: 1, sihuaSchool: 'zhongzhou', kuiYue: 'geng_ma_hu' }));
		const cur = puts.find((a)=>a.type === 'setCurrentChart');
		expect(cur.payload).toEqual(expect.objectContaining({ [ZIWEI_SETTINGS_GEN_KEY]: 1, kuiYue: 'geng_ma_hu' }));
	});
	it('🔴 AI 挂载按盘取值:带标记的盘缺键补出厂默认(不回落当前全局);旧盘照旧回落', ()=>{
		const { buildChartZiweiParams } = require('../aiAnalysisContext');
		const base = { cid: 'm', birth: '1990-05-05 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', gender: 1 };
		localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
		localStorage.setItem('ziweiHuoling', 'nanpai');
		const p = buildChartZiweiParams({ ...base, [ZIWEI_SETTINGS_GEN_KEY]: 1, kuiYue: 'geng_ma_hu' });
		expect(p).toEqual(expect.objectContaining({ sihuaSchool: 'beipai', huoling: 'sanhe', kuiYue: 'geng_ma_hu', childLimit: false, taiSuiRelatives: [] }));
		const old = buildChartZiweiParams({ ...base });
		expect(old.sihuaSchool).toBeUndefined();
		expect(old.huoling).toBeUndefined();
		expect(old.taiSuiRelatives).toBeUndefined();
		const { effectiveMountBaseline } = require('../techniqueMountSettings');
		const bl = effectiveMountBaseline('ziwei', { ...base, [ZIWEI_SETTINGS_GEN_KEY]: 1 });
		expect(bl.sihuaSchool).toBe('beipai');
		expect(bl.huoling).toBe('sanhe');
		const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
		const prevHl = ZWEngineOptions.huoling;
		ZWEngineOptions.huoling = 'nanpai';
		try{
			expect(effectiveMountBaseline('ziwei', { ...base }).huoling).toBe('nanpai');   // 旧盘:现状 = 当前全局
			expect(effectiveMountBaseline('ziwei', { ...base, [ZIWEI_SETTINGS_GEN_KEY]: 1 }).huoling).toBe('sanhe');
		}finally{ ZWEngineOptions.huoling = prevHl; }
		expect(ziweiRecordWithDefaults({ cid: 'z' })).toEqual({ cid: 'z' });
	});
});

describe('你自己的紫微设置(种子)缺键', ()=>{
	it('🔴 存种子之后才有的键:首次读到时按本机偏好补进种子并写回,「新命盘」不打回出厂值', ()=>{
		const rs = require('../ziweiRecordSettings');
		localStorage.clear();
		const partial = {};
		rs.ZIWEI_RECORD_SETTINGS.filter((s)=>s.key !== 'huoling').forEach((s)=>{ partial[s.key] = s.kind === 'list' ? [] : s.def; });
		localStorage.setItem(rs.ZIWEI_USER_SEED_KEY, JSON.stringify(partial));   // 旧版种子没有 huoling
		localStorage.setItem('ziweiHuoling', 'nanpai');                          // 你的本机偏好
		expect(rs.currentZiweiUserSeed().huoling).toBe('nanpai');
		expect(JSON.parse(localStorage.getItem(rs.ZIWEI_USER_SEED_KEY)).huoling).toBe('nanpai');   // 写回
		localStorage.setItem('ziweiHuoling', 'sanhe');                           // 之后载入记录改了偏好
		rs.restoreZiweiUserSeed();
		expect(rs.currentZiweiSettings().huoling).toBe('nanpai');
	});
});
