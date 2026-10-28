// 紫微排盘设置随盘(单一真值源):从界面「存为命盘」时把紫微左栏的排盘设置随该盘记下,载入该盘时还原到紫微页。
//
// 背景:紫微的排盘设置住在本机偏好(localStorage ziwei*)与引擎单例(ZWEngineOptions / ZWConst.ZWSchool),
// 不在 astro.fields,所以通用的「技法设置随盘」(recordFieldsRestore 清单 + 非默认捕获)覆盖不到它 —— 此前
// 从紫微页存的盘一个紫微键都不带,AI 挂载与重开都回退到当时全局的设置。
// 记录键名 = AI 挂载构造器 buildChartZiweiParams 直读的那组(aiAnalysisContext),存一次、两处都认。
//
// 语义:
// - 捕获:以本机偏好为准(紫微左栏每次改设置都写偏好,与引擎单例一致),只落「≠ 出厂默认」的键(全默认零落键),
//   另打紫微代次标记 ziweiSettingsGen(= 本盘的紫微设置已被捕获)。
// - 还原:记录里有的键 → 写回本机偏好(紫微页已加载时同步写引擎单例并刷新四化缓存);**有紫微代次标记**的记录缺某键 =
//   保存时是默认 → 复位到出厂默认;**没有紫微代次标记**的旧记录(含此前带通用 fieldsCaptureGen 的盘,它们从没捕获过紫微键)
//   只套它自带的键,其余保持现状。
// - 自定义四化表 / 亮度表:存盘时随盘捕获(AI 挂载按盘用这张表);载入时装成本次会话的临时表,**不覆盖**本机那份
//   (那是用户自己维护的表,覆盖 = 丢数据)。临时表连同它所属的记录号另记一份(ZIWEI_SESSION_TABLES_KEY),
//   重启后温启恢复同一张盘时照旧用它(此前只在内存,重启后左栏仍是「自定义」、盘面却回落通用表)。
// - 温启恢复(bootRestore)不套用排盘设置:启动时重放的是上次载入的记录,之后在页面上改过的设置不能被它冲掉。
// - 你自己的设置(新盘种子)与「本盘生效值」分开:载入记录只改本盘生效的本机偏好;载入前先把你亲手设的值存一份
//   (ZIWEI_USER_SEED_KEY,之后在紫微左栏亲手改任一项随之更新),「新命盘」时用回它 —— 与其它技法
//   「载入记录不改新盘种子」同一规矩(此前载入一张盘就永久改写你的偏好,新建盘也跟着变)。
// 本件不静态引用紫微模块(模型层在首屏包里,不把紫微整套拖进首屏):紫微页模块加载时经 registerZiweiEngineAdapter 登记写单例的函数;
// 还原后广播 ZIWEI_RECORD_SETTINGS_EVENT,紫微左栏据此刷新显示;盘面由载入流程随后按新字段重排(引擎读的就是刚写好的单例)。
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safeStorage';

export const ZIWEI_SETTINGS_GEN_KEY = 'ziweiSettingsGen';
export const ZIWEI_SETTINGS_GEN = 1;
export const ZIWEI_RECORD_SETTINGS_EVENT = 'horosa:ziwei-record-settings-applied';
// 你亲手设的紫微排盘设置(新盘种子):{ 记录键: 值 } 全量快照
export const ZIWEI_USER_SEED_KEY = 'ziweiUserSeed';
// 载入盘带来的临时自定义表:{ cid, sihua, brightness }(两张都没有即删键)
export const ZIWEI_SESSION_TABLES_KEY = 'ziweiSessionTables';
const LATE_ZI_MIGRATED_KEY = 'ziweiLateZiMigrated';

// key = 记录键;opt = 引擎单例键(缺省同 key;四化流派走 ZWSchool);ls = 本机偏好键;def = 出厂默认;kind 决定读写形态
export const ZIWEI_RECORD_SETTINGS = [
	{ key: 'sihuaSchool', opt: '@school', ls: 'ziweiSihuaSchool', def: 'beipai', kind: 'str' },
	{ key: 'ziweiXiaoxianYinyang', opt: 'xiaoxianMode', ls: 'ziweiXiaoxianYinyang', def: '0', kind: 'str' },
	{ key: 'daxianSpan', ls: 'ziweiDaxianSpan', def: 10, kind: 'span' },
	{ key: 'tianmaBasis', ls: 'ziweiTianmaBasis', def: 'month', kind: 'str' },
	{ key: 'starSet', ls: 'ziweiStarSet', def: 'full', kind: 'str' },
	{ key: 'sanPan', ls: 'ziweiSanPan', def: 'tian', kind: 'str' },
	{ key: 'shangShi', ls: 'ziweiShangShi', def: 'fixed', kind: 'str' },
	{ key: 'leapMonth', ls: 'ziweiLeapMonth', def: 'mid_split', kind: 'str' },
	{ key: 'lateZi', ls: 'ziweiLateZi', def: 'global', kind: 'str' },
	{ key: 'yearBoundary', ls: 'ziweiYearBoundary', def: 'lunar_1_1', kind: 'str' },
	{ key: 'huoling', ls: 'ziweiHuoling', def: 'sanhe', kind: 'str' },
	{ key: 'kongNaming', ls: 'ziweiKongNaming', def: 'modern', kind: 'str' },
	{ key: 'brightnessSource', ls: 'ziweiBrightnessSource', def: 'zi_jian', kind: 'str' },
	{ key: 'lifeMasterBy', ls: 'ziweiLifeMasterBy', def: 'year_branch', kind: 'str' },
	{ key: 'liuYueBasis', ls: 'ziweiLiuYueBasis', def: 'doujun', kind: 'str' },
	{ key: 'liunianSihuaGan', ls: 'ziweiLiunianSihuaGan', def: 'year_gan', kind: 'str' },
	{ key: 'changshengStart', ls: 'ziweiChangshengStart', def: 'shui_tu', kind: 'str' },
	{ key: 'changshengDirection', ls: 'ziweiChangshengDirection', def: 'yinyang', kind: 'str' },
	{ key: 'kuiYue', ls: 'ziweiKuiYue', def: 'jia_wu_geng', kind: 'str' },
	{ key: 'kongwangStyle', ls: 'ziweiKongwangStyle', def: 'double', kind: 'str' },
	{ key: 'childLimit', ls: 'ziweiChildLimit', def: false, kind: 'bool' },
	{ key: 'zhongxian', ls: 'ziweiZhongxian', def: false, kind: 'bool' },
	{ key: 'huoPan', ls: 'ziweiHuoPan', def: false, kind: 'bool' },
	{ key: 'qishuWei', ls: 'ziweiQishuWei', def: false, kind: 'bool' },
	{ key: 'borrowPalace', ls: 'ziweiBorrowPalace', def: false, kind: 'bool' },
	{ key: 'taiSuiRuGua', ls: 'ziweiTaiSuiRuGua', def: false, kind: 'bool' },
	{ key: 'flowLuanXi', ls: 'ziweiFlowLuanXi', def: false, kind: 'bool' },
	{ key: 'flowHuoLing', ls: 'ziweiFlowHuoLing', def: false, kind: 'bool' },
	{ key: 'flowShenshaOnChart', ls: 'ziweiFlowShenshaOnChart', def: false, kind: 'bool' },
	{ key: 'taiSuiRelatives', ls: 'ziweiTaiSuiRelatives', def: [], kind: 'list' },
];
// 随盘捕获、载入不覆盖本机的两张自定义表:记录键 → 本机偏好键(仅在对应设置选中「自定义」时捕获)
export const ZIWEI_CUSTOM_TABLES = [
	{ key: 'sihuaCustomTable', ls: 'ziweiSihuaCustom', when: (cur)=>cur.sihuaSchool === 'custom' },
	{ key: 'brightnessCustomTable', ls: 'ziweiBrightnessCustom', when: (cur)=>cur.brightnessSource === 'custom' },
];

// 紫微页模块登记的引擎写入器:write(spec, value) 写单例(四化流派另刷新四化缓存);setSessionTable(kind, text) 注入 / 撤掉
// 临时表。未登记 = 紫微页还没加载过,只写偏好(页面构造时从偏好读)
let engineAdapter = null;
// 载入记录随盘带的自定义四化 / 亮度表 = 本次会话的临时表(不写进你的表、不进 IDB):紫微页没加载时先记在这里,
// 页面模块登记引擎写入器时补上。载入别的盘(带 / 不带表)换掉或清掉,点「新命盘」清掉,亲手编辑你自己的哪张表就撤掉哪张。
// 此前装进本机与 IDB,之后被当成「你的表」;本机已有表时页面用本机表、AI 用记录表,两边不一致。
function readPersistedSessionTables(){
	const raw = safeLocalStorageGet(ZIWEI_SESSION_TABLES_KEY);
	if(typeof raw !== 'string' || raw === ''){ return { cid: '', sihua: null, brightness: null }; }
	try{
		const o = JSON.parse(raw);
		const txt = (v)=>(typeof v === 'string' && v.trim() !== '' ? v : null);
		return o && typeof o === 'object' ? { cid: o.cid ? `${o.cid}` : '', sihua: txt(o.sihua), brightness: txt(o.brightness) } : { cid: '', sihua: null, brightness: null };
	}catch(e){
		return { cid: '', sihua: null, brightness: null };
	}
}
let sessionTables = readPersistedSessionTables();
export function currentZiweiSessionTables(){ return { sihua: sessionTables.sihua, brightness: sessionTables.brightness }; }
function setSessionTables(next, cid){
	sessionTables = { cid: cid !== undefined ? (cid ? `${cid}` : '') : sessionTables.cid, sihua: next.sihua || null, brightness: next.brightness || null };
	// 只落有归属(cid)的临时表:没有 cid 的记录带来的表只在本次运行有效(重启后没有一张盘认领它,不该留给「此刻」盘)
	if((sessionTables.sihua || sessionTables.brightness) && sessionTables.cid){
		safeLocalStorageSet(ZIWEI_SESSION_TABLES_KEY, JSON.stringify(sessionTables));
	}else{
		safeLocalStorageRemove(ZIWEI_SESSION_TABLES_KEY);
	}
	if(engineAdapter && typeof engineAdapter.setSessionTable === 'function'){
		try{
			engineAdapter.setSessionTable('sihua', sessionTables.sihua);
			engineAdapter.setSessionTable('brightness', sessionTables.brightness);
		}catch(e){ /* 引擎下次登记时补上 */ }
	}
}
// kind:'sihua' / 'brightness' 只撤那一张(亲手编辑了你自己的那张表);不给 = 两张都撤(新命盘)
export function clearZiweiSessionTables(kind){
	if(kind === 'sihua' || kind === 'brightness'){
		setSessionTables({ ...sessionTables, [kind]: null });
		return;
	}
	setSessionTables({}, '');
}
// 温启恢复没落成(用户抢先动手 / 排盘失败回落「此刻」):临时表只在当前看的仍是那张盘时留着,否则撤掉
export function dropZiweiSessionTablesUnlessFor(cid){
	if(sessionTables.cid && `${cid || ''}` !== sessionTables.cid){ clearZiweiSessionTables(); }
}
export function registerZiweiEngineAdapter(adapter){
	engineAdapter = adapter && typeof adapter.write === 'function' ? adapter : null;
	if(engineAdapter && (sessionTables.sihua || sessionTables.brightness)){ setSessionTables(sessionTables); }
}

// 偏好值 / 记录值 → 规范值(与 ZiWeiInput 构造期读偏好的口径一致)
function normalize(spec, raw){
	if(raw === undefined || raw === null){ return undefined; }
	switch(spec.kind){
	case 'bool':
		if(typeof raw === 'boolean'){ return raw; }
		return `${raw}` === '1' || `${raw}` === 'true';
	case 'span': {
		if(`${raw}` === 'ju'){ return 'ju'; }
		const n = Number(raw);
		return Number.isFinite(n) && n > 0 ? n : undefined;
	}
	case 'list': {
		let arr = raw;
		if(typeof raw === 'string'){ try{ arr = JSON.parse(raw); }catch(e){ arr = undefined; } }
		return Array.isArray(arr) ? arr.filter((it)=>it && typeof it === 'object' && it.branch) : undefined;
	}
	default: {
		const s = `${raw}`;
		return s === '' ? undefined : s;
	}
	}
}

function sameValue(spec, a, b){
	if(spec.kind === 'list'){ return JSON.stringify(a || []) === JSON.stringify(b || []); }
	if(spec.kind === 'span'){ return `${a}` === `${b}`; }
	return a === b;
}

function readPref(spec){
	const raw = safeLocalStorageGet(spec.ls);
	// 晚子时:旧默认 'zi_chu' 未经迁移(从没人显式选过)= 跟随全局,与 ZiWeiInput 的一次性迁移同口径
	if(spec.key === 'lateZi' && raw === 'zi_chu' && !safeLocalStorageGet(LATE_ZI_MIGRATED_KEY)){ return spec.def; }
	const v = normalize(spec, raw);
	return v === undefined ? (spec.kind === 'list' ? [] : spec.def) : v;
}

// 当前紫微排盘设置(全部键,以本机偏好为准)
export function currentZiweiSettings(){
	const out = {};
	ZIWEI_RECORD_SETTINGS.forEach((spec)=>{ out[spec.key] = readPref(spec); });
	return out;
}

// 存盘捕获:非默认键 + 代次标记(+ 选中「自定义」时的那张表)。页面「存为命盘」用:记当前所见
// (当前看的是载入盘带来的临时表时,存的是那张表)。
export function captureZiweiRecordSettings(){
	return captureZiweiSettingsFrom(currentZiweiSettings(), { preferSession: true });
}

// 「新命盘」会用的紫微设置:存过「你自己的设置」→ 用它(缺的键按出厂);没存过(从没载入过记录)→ 本机当前偏好就是你自己的。
export function newChartZiweiSettings(){
	const seed = readSeed();
	if(!seed){ return currentZiweiSettings(); }
	const out = {};
	ZIWEI_RECORD_SETTINGS.forEach((spec)=>{
		const v = normalize(spec, seed[spec.key]);
		out[spec.key] = v === undefined ? (spec.kind === 'list' ? [] : spec.def) : v;
	});
	return out;
}

// 非页面的新建入口(AI 建档 / 名人库加入 / AI 页存盘 / 外部导入):按「新命盘」会用的紫微设置捕获,
// 不按刚载入那张盘的设置
export function captureNewChartZiweiSettings(){
	return captureZiweiSettingsFrom(newChartZiweiSettings());
}

function captureZiweiSettingsFrom(cur, { preferSession = false } = {}){
	const out = {};
	ZIWEI_RECORD_SETTINGS.forEach((spec)=>{
		const v = cur[spec.key];
		if(!sameValue(spec, v, spec.def)){
			out[spec.key] = spec.kind === 'list' ? v.map((it)=>({ ...it })) : v;
		}
	});
	ZIWEI_CUSTOM_TABLES.forEach((t)=>{
		if(!t.when(cur)){ return; }
		const session = preferSession ? sessionTables[t.key === 'sihuaCustomTable' ? 'sihua' : 'brightness'] : null;
		const text = session || safeLocalStorageGet(t.ls);
		if(typeof text === 'string' && text.trim() !== ''){ out[t.key] = text; }
	});
	out[ZIWEI_SETTINGS_GEN_KEY] = ZIWEI_SETTINGS_GEN;
	return out;
}

export function recordHasZiweiSettingsGen(record){
	return !!(record && typeof record === 'object' && Number(record[ZIWEI_SETTINGS_GEN_KEY]) >= 1);
}

// 带紫微代次标记的记录:缺的键 = 存盘时是出厂默认 → 补成出厂默认(AI 挂载等不经载入流程的读取方按盘取值用;
// 不补的话缺键会回落当前全局设置,与载入该盘后的盘面不一致)。无标记的旧记录原样返回。
export function ziweiRecordWithDefaults(record){
	if(!recordHasZiweiSettingsGen(record)){ return record; }
	const out = { ...record };
	ZIWEI_RECORD_SETTINGS.forEach((spec)=>{
		if(normalize(spec, out[spec.key]) === undefined){
			out[spec.key] = spec.kind === 'list' ? [] : spec.def;
		}
	});
	return out;
}

function readSeed(){
	const raw = safeLocalStorageGet(ZIWEI_USER_SEED_KEY);
	if(typeof raw !== 'string' || raw === ''){ return null; }
	let obj = null;
	try{
		const parsed = JSON.parse(raw);
		obj = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
	}catch(e){
		return null;
	}
	if(!obj){ return null; }
	// 存下「你自己的设置」之后新增的紫微设置键:补成第一次读到时本机偏好的值并写回(此后载入记录改偏好也不影响它),
	// 不在「新命盘」时直接打回出厂值(那会把你本来的设置冲掉)
	const missing = ZIWEI_RECORD_SETTINGS.filter((spec)=>!Object.prototype.hasOwnProperty.call(obj, spec.key));
	if(missing.length){
		missing.forEach((spec)=>{ obj[spec.key] = readPref(spec); });
		writeSeed(obj);
	}
	return obj;
}
function writeSeed(seed){
	safeLocalStorageSet(ZIWEI_USER_SEED_KEY, JSON.stringify(seed));
}
// 还没存过「你自己的设置」时,以当前本机偏好为准存一份(首次载入记录前调用 = 存下载入前你自己的值)
export function ensureZiweiUserSeed(){
	const seed = readSeed();
	if(seed){ return seed; }
	const fresh = currentZiweiSettings();
	writeSeed(fresh);
	return fresh;
}
// 紫微左栏亲手改了某个偏好键(本机偏好键名)后调用:把这一项记进「你自己的设置」
export function noteZiweiUserPrefWrite(lsKey){
	const spec = ZIWEI_RECORD_SETTINGS.find((it)=>it.ls === lsKey);
	if(!spec){ return; }
	const seed = ensureZiweiUserSeed();
	seed[spec.key] = readPref(spec);
	writeSeed(seed);
}
export function currentZiweiUserSeed(){
	return readSeed();
}

function writeOne(spec, value){
	if(sameValue(spec, value, spec.def)){
		safeLocalStorageRemove(spec.ls);   // 回到默认:删偏好键(读侧缺键即默认),与「从没改过」同形
	}else if(spec.kind === 'bool'){
		safeLocalStorageSet(spec.ls, value ? 1 : 0);
	}else if(spec.kind === 'list'){
		safeLocalStorageSet(spec.ls, JSON.stringify(value));
	}else{
		safeLocalStorageSet(spec.ls, `${value}`);
	}
	// 晚子时显式值:同时落迁移标志,否则「子初换日(强制)」会被一次性迁移当成旧默认改成「跟随全局」
	if(spec.key === 'lateZi'){ safeLocalStorageSet(LATE_ZI_MIGRATED_KEY, '1'); }
	if(engineAdapter){
		try{ engineAdapter.write(spec, spec.kind === 'list' ? value.map((it)=>({ ...it })) : value); }catch(e){ /* 单例写失败:页面下次构造时从偏好读 */ }
	}
}

function installRecordCustomTables(record){
	// 记录随盘带的表 → 本次会话的临时表(不写本机、不进 IDB);记录没带 → 清掉上一张盘的临时表,用你自己的表
	const next = { sihua: null, brightness: null };
	ZIWEI_CUSTOM_TABLES.forEach((t)=>{
		const text = record[t.key];
		if(typeof text !== 'string' || text.trim() === ''){ return; }
		next[t.key === 'sihuaCustomTable' ? 'sihua' : 'brightness'] = text;
	});
	const before = sessionTables;
	// 没有 cid 的记录:归属显式记为空(此前传 undefined = 沿用上一张盘的 cid,温启被丢弃时会误撤正看着的这张盘的表)
	setSessionTables(next, record.cid ? `${record.cid}` : '');
	return (before.sihua !== next.sihua ? 1 : 0) + (before.brightness !== next.brightness ? 1 : 0);
}

function writeAll(values, cid){
	const res = { applied: {}, changed: 0 };
	ZIWEI_RECORD_SETTINGS.forEach((spec)=>{
		const next = values[spec.key];
		if(next === undefined){ return; }
		// 自定义四化:本机没有那张表、记录也没带(会话临时表为空)时不切到「自定义」(否则页面停在空表态)
		if(spec.key === 'sihuaSchool' && next === 'custom' && !safeLocalStorageGet('ziweiSihuaCustom') && !sessionTables.sihua){ return; }
		res.applied[spec.key] = next;
		if(!sameValue(spec, readPref(spec), next)){
			writeOne(spec, next);
			res.changed += 1;
		}
	});
	if(res.changed > 0 && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
		try{
			window.dispatchEvent(new CustomEvent(ZIWEI_RECORD_SETTINGS_EVENT, { detail: { cid: cid || '', applied: res.applied } }));
		}catch(e){ /* 老内核无 CustomEvent:左栏下次挂载时从偏好读,行为同改动前 */ }
	}
	return res;
}

// 载入还原:返回 { applied: {记录键: 新值}, changed: 实际改了几项 };不该套用时 applied 为空
export function applyZiweiRecordSettings(record, opts){
	const o = opts || {};
	if(!record || typeof record !== 'object'){ return { applied: {}, changed: 0 }; }
	// 温启改用库里那条(快照之后库里这条被恢复 / 导入 / 界面外改过):按正常载入套用 —— 库里这一版就是权威
	if((o.bootRestore || record.bootRestore) && !record.bootFromLibrary){
		// 温启恢复:排盘设置不套用;记下的临时表只认同一张盘的(上次退出前别的盘留下的不沿用)
		if(sessionTables.cid && `${record.cid || ''}` !== sessionTables.cid){ clearZiweiSessionTables(); }
		return { applied: {}, changed: 0 };
	}
	ensureZiweiUserSeed();   // 先存下你自己的设置(已存过则不动),「新命盘」时用回
	const marked = recordHasZiweiSettingsGen(record);
	const installed = installRecordCustomTables(record);
	const values = {};
	ZIWEI_RECORD_SETTINGS.forEach((spec)=>{
		let next = normalize(spec, record[spec.key]);
		if(next === undefined){
			if(!marked){ return; }
			next = spec.kind === 'list' ? [] : spec.def;
		}
		values[spec.key] = next;
	});
	const res = writeAll(values, record.cid);
	res.changed += installed;
	return res;
}

// 「新命盘」:用回你自己的紫微设置(没存过 = 从没载入过记录,本机偏好就是你自己的,什么都不做)
export function restoreZiweiUserSeed(){
	clearZiweiSessionTables();   // 上一张盘带来的临时自定义表一并撤掉(用回你自己的表)
	const seed = readSeed();
	if(!seed){ return { applied: {}, changed: 0 }; }
	const values = {};
	ZIWEI_RECORD_SETTINGS.forEach((spec)=>{
		const v = normalize(spec, seed[spec.key]);
		values[spec.key] = v === undefined ? (spec.kind === 'list' ? [] : spec.def) : v;
	});
	return writeAll(values, '');
}
