import { createLocalRecordStore, nowStr, normalizeGroup, normalizePayload, TRASH_CAP } from './localRecordStore';
import { emitAutomationEvent } from './aiAgent/automation/events';
import { isCaseDivTimeText } from './caseDivTime';

const LocalCasesKey = 'horosa.localCases.v1';

// 与 localcharts.js 同批:存储机械层收编进 localRecordStore 单一内核,
// 本文件只保留域层(事盘类型注册表/别名归一/记录构造)。公开 API 逐字节不变(金标看守)。
export const CASE_TYPE_OPTIONS = [
	{ value: 'liuyao', label: '六爻', subTab: null, tab: 'guazhan', module: 'guazhan' },
	{ value: 'liureng', label: '六壬', subTab: null, tab: 'liureng', module: 'liureng' },
	{ value: 'suzhan', label: '宿盘', subTab: 'suzhan', tab: 'cnyibu', module: 'suzhan' },
	{ value: 'jinkou', label: '金口诀', subTab: 'jinkou', tab: 'cnyibu', module: 'jinkou' },
	{ value: 'taiyi', label: '太乙', subTab: null, tab: 'taiyi', module: 'taiyi' },
	{ value: 'qimen', label: '奇门', subTab: null, tab: 'dunjia', module: 'qimen' },
	{ value: 'tongshefa', label: '统摄法', subTab: 'tongshefa', tab: 'cnyibu', module: 'tongshefa' },
	{ value: 'huangji', label: '皇极经世', subTab: 'huangji', tab: 'cnyibu', module: 'huangji' },
	{ value: 'wuzhao', label: '五兆', subTab: 'wuzhao', tab: 'cnyibu', module: 'wuzhao' },
	{ value: 'taixuan', label: '太玄', subTab: 'taixuan', tab: 'cnyibu', module: 'taixuan' },
	{ value: 'guice', label: '皇极轨策', subTab: 'guice', tab: 'cnyibu', module: 'guice' },
	{ value: 'xiaoliuren', label: '小六壬', subTab: 'xiaoliuren', tab: 'cnyibu', module: 'xiaoliuren' },
	{ value: 'xiaochengtu', label: '小成图', subTab: 'xiaochengtu', tab: 'cnyibu', module: 'xiaochengtu' },
	{ value: 'feigong', label: '飞宫小奇门', subTab: 'feigong', tab: 'cnyibu', module: 'feigong' },
	{ value: 'jingjue', label: '荆诀', subTab: 'jingjue', tab: 'cnyibu', module: 'jingjue' },
	{ value: 'shenyishu', label: '神易数', subTab: 'shenyishu', tab: 'cnyibu', module: 'shenyishu' },
	{ value: 'geomancy', label: '天文地占', subTab: 'geomancy', tab: 'cnyibu', module: 'geomancy' },
	{ value: 'tarot', label: '塔罗', subTab: 'tarot', tab: 'cnyibu', module: 'tarot' },
	{ value: 'lingqi', label: '灵棋经', subTab: 'lingqi', tab: 'cnyibu', module: 'lingqi' },
	{ value: 'sanshiunited', label: '三式合一', subTab: null, tab: 'sanshiunited', module: 'sanshiunited' },
	{ value: 'horary', label: '卜卦', subTab: 'horary', tab: 'auxchart', module: 'horary' },
	{ value: 'election', label: '择日', subTab: 'election', tab: 'auxchart', module: 'election' },
	{ value: 'mundane', label: '世俗盘', subTab: 'mundane', tab: 'auxchart', module: 'mundane' },
	{ value: 'tianxing', label: '天星择日', subTab: 'tianxing', tab: 'zeri', module: 'tianxing' },
	{ value: 'qimenzeri', label: '奇门择日', subTab: 'qimenzeri', tab: 'zeri', module: 'qimenzeri' },
	{ value: 'huanglizeri', label: '黄历择日', subTab: 'huanglizeri', tab: 'zeri', module: 'huanglizeri' },
	{ value: 'bazizeri', label: '八字择日', subTab: 'bazizeri', tab: 'zeri', module: 'bazizeri' },
	{ value: 'taiyizeri', label: '太乙择日', subTab: 'taiyizeri', tab: 'zeri', module: 'taiyizeri' },
	{ value: 'ziweizeri', label: '紫微择日', subTab: 'ziweizeri', tab: 'zeri', module: 'ziweizeri' },
	{ value: 'liurengzeri', label: '六壬择日', subTab: 'liurengzeri', tab: 'zeri', module: 'liurengzeri' },
	{ value: 'sanshizeri', label: '三式择日', subTab: 'sanshizeri', tab: 'zeri', module: 'sanshizeri' },
	{ value: 'qizhengzeri', label: '七政择日', subTab: 'qizhengzeri', tab: 'zeri', module: 'qizhengzeri' },
	{ value: 'indiazeri', label: '印度择日', subTab: 'indiazeri', tab: 'zeri', module: 'indiazeri' },
];

const CASE_TYPE_ALIASES = {
	// 精确键查表(非子串匹配);「奇门择日」必须先于裸「奇门」有独立键,免归并成 qimen。
	'奇门择日': 'qimenzeri',
	'奇門擇日': 'qimenzeri',
	'黄历择日': 'huanglizeri',
	'黃曆擇日': 'huanglizeri',
	'八字择日': 'bazizeri',
	'八字擇日': 'bazizeri',
	'太乙择日': 'taiyizeri',
	'太乙擇日': 'taiyizeri',
	'紫微择日': 'ziweizeri',
	'紫微擇日': 'ziweizeri',
	'六壬择日': 'liurengzeri',
	'六壬擇日': 'liurengzeri',
	'三式择日': 'sanshizeri',
	'三式擇日': 'sanshizeri',
	'七政择日': 'qizhengzeri',
	'七政擇日': 'qizhengzeri',
	'印度择日': 'indiazeri',
	'印度擇日': 'indiazeri',
	'六爻': 'liuyao',
	'六壬': 'liureng',
	'宿盘': 'suzhan',
	'宿盤': 'suzhan',
	'宿占': 'suzhan',
	'金口诀': 'jinkou',
	'太乙': 'taiyi',
	'奇门': 'qimen',
	'奇門': 'qimen',
	'遁甲': 'qimen',
	'三式合一': 'sanshiunited',
	'卜卦': 'horary',
	'卜卦盘': 'horary',
	'卜卦盤': 'horary',
	'择日': 'election',
	'择日盘': 'election',
	'擇日': 'election',
	'擇日盤': 'election',
	'统摄法': 'tongshefa',
	'統攝法': 'tongshefa',
	'皇极经世': 'huangji',
	'皇極經世': 'huangji',
	'皇极': 'huangji',
	'皇極': 'huangji',
	'五兆': 'wuzhao',
	'太玄': 'taixuan',
	'荆诀': 'jingjue',
	'荊訣': 'jingjue',
	'神易数': 'shenyishu',
	'神易數': 'shenyishu',
	'天文地占': 'geomancy',
	'地占': 'geomancy',
	'塔罗': 'tarot',
	'灵棋经': 'lingqi',
	'靈棋經': 'lingqi',
	'灵棋': 'lingqi',
	'靈棋': 'lingqi',
};

function normalizeCaseType(type){
	const val = `${type || ''}`.trim();
	if(!val){
		return 'liuyao';
	}
	if(CASE_TYPE_ALIASES[val]){
		return CASE_TYPE_ALIASES[val];
	}
	if(CASE_TYPE_OPTIONS.find((item)=>item.value === val)){
		return val;
	}
	return val;
}

export function getCaseTypeLabel(type){
	const one = CASE_TYPE_OPTIONS.find((item)=>item.value === normalizeCaseType(type));
	return one ? one.label : (type || '六爻');
}

export function getCaseTypeMeta(type){
	const normalized = normalizeCaseType(type);
	const one = CASE_TYPE_OPTIONS.find((item)=>item.value === normalized);
	if(one){
		return one;
	}
	return {
		value: normalized,
		label: normalized || '六爻',
		subTab: normalized || null,
		tab: 'cnyibu',
		module: normalized || 'guazhan',
	};
}

// 从文件导入时的坏条目:没有起课时间(空 / 写法认不出)—— 载入只能按「此刻」起课,导进来就是一条与原事对不上的盘。
// 跳过并在导入结果里列出(全量恢复不判,见 localRecordStore validateItem)
export function caseImportProblem(item){
	const d = item ? item.divTime : undefined;
	if(d && typeof d === 'object' && typeof d.format === 'function'){ return null; }
	return isCaseDivTimeText(d) ? null : '没有起课时间';
}

const store = createLocalRecordStore({
	storageKey: LocalCasesKey,
	searchField: 'event',
	envelopeFormat: 'horosa-local-cases',
	envelopeListField: 'cases',
	buildRecord: buildLocalCaseRecord,
	saveErrorCode: 'local.case.save.failed',
	deleteErrorCode: 'local.case.delete.failed',
	warnLabel: 'case',
	trashKey: 'horosa.localCases.trash.v1',
	validateItem: caseImportProblem,
});

export function listLocalCases(filter){
	return store.list(filter);
}

// 标签筛选下拉的选项源:本地事盘库全量聚合去重(与命盘侧 listLocalChartTags 同款)。
export function listLocalCaseTags(){
	return store.listTags();
}

export function getPagedLocalCases(params){
	return store.getPaged(params);
}

// 单条读取(内核 cid 索引 O(1);不过滤归档;共享只读引用,禁原地改)。
export function getLocalCase(cid){
	return store.getByCid(cid);
}

export function buildLocalCaseRecord(values){
	const cid = values && values.cid ? values.cid : `local-case-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
	let divTime = values.divTime;
	if(divTime && typeof divTime.format === 'function'){
		divTime = divTime.format('YYYY-MM-DD HH:mm:ss');
	}
	const caseType = normalizeCaseType(values.caseType || values.sourceModule);
	const caseMeta = getCaseTypeMeta(caseType);
	const record = {
		cid: cid,
		event: values.event ? values.event : '',
		caseType: caseType,
		divTime: divTime ? divTime : nowStr(),
		zone: values.zone !== undefined && values.zone !== null ? values.zone : '+08:00',
		lat: values.lat,
		lon: values.lon,
		gpsLat: values.gpsLat,
		gpsLon: values.gpsLon,
		pos: values.pos ? values.pos : '',
		// 性别随档(present 才落:旧档/未指定=undefined,JSON 序列化自动省键,体积语义零变)。
		// 🔴 存案入口(kentang/divination 共用件)一直送 caseGenderValue,此前落库层不枚举 →
		// applyCase 的还原读取(占类用神判读所需)永远落空 —— 全链断在这一段。0=女 合法值,禁真值判断。
		gender: values.gender !== undefined && values.gender !== null && values.gender !== '' ? parseInt(values.gender + '', 10) : undefined,
		isPub: values.isPub !== undefined && values.isPub !== null ? parseInt(values.isPub + '', 10) : 0,
		group: normalizeGroup(values.group),
		creator: values.creator ? values.creator : 'local',
		updateTime: values.preserveUpdateTime && values.updateTime ? values.updateTime : nowStr(),
		payload: normalizePayload(values.payload),
		sourceModule: values.sourceModule ? values.sourceModule : caseMeta.module,
		// 事盘备注(present 才落,旧档体积零变):命盘有 8 个 memo* 槽,事盘此前 0 个 ——
		// 断后复盘/应期回填只能改「事件」标题混写。经编辑表单填写。
		memo: values.memo !== undefined && values.memo !== null && values.memo !== '' ? `${values.memo}` : undefined,
	};
	return record;
}

export function upsertLocalCase(values){
	const __saved = store.upsert(values);
	// 自动化事件:存档后广播(引擎默认关;emit 永不抛错、不阻塞保存)
	try{ emitAutomationEvent('record.saved', { kind: 'case', cid: __saved && __saved.cid ? __saved.cid : (values && values.cid) }); }catch(e){ /* noop */ }
	return __saved;
}

export function removeLocalCase(cid){
	return store.remove(cid);
}

export function exportLocalCasesBackup(){
	return store.exportBackup();
}

// opts.sameCid:同一 ID 的口径(缺省 'newer' = 更新时间较新的那一版整条胜出、本机较新或一样新保留本机,替换时管理字段留本机的;
// 'backup' = 一律用备份里的那一版;'merge' = 按字段合并);opts.mergeCids = 只有这些按字段合并;
// opts.respectLocalDeletions = 本机之后删掉的(还在回收站 / 删除日志里)不带回
export function importLocalCasesBackup(payload, opts){
	return store.importBackup(payload, opts);
}

// 存储健康态(横幅/诊断用):mode 'persistent'|'memory' + 最近写失败原因。
export function getLocalCasesStoreHealth(){
	return store.getHealth();
}

// 导入三闸的纯函数面(校验/预览),UI 在确认后才调 importLocalCasesBackup 真写。
export function validateLocalCasesBackup(payload){
	return store.validateBackupEnvelope(payload);
}

export function previewLocalCasesBackup(payload, opts){
	return store.previewImportBackup(payload, opts);
}

// [V] 置顶/置底(与命盘侧同款)。
export function pinLocalCase(cid, tier){
	return store.setPin(cid, tier);
}

// [V] 上移/下移(与命盘侧同款)。
// 归档/星标/使用足迹(内核管理字段;全链保真由未知键保全承载)。
export function flagLocalCase(cid, field, on){
	return store.setFlag(cid, field, on);
}

// 整体改写标签列表(AI 加标签工具与其撤销;不刷新 updateTime)
export function setLocalCaseTags(cid, tags){
	return store.setTags(cid, tags);
}

export function touchLocalCase(cid){
	return store.touchRecord(cid);
}

export function moveLocalCase(cid, dir){
	return store.moveRecord(cid, dir);
}

// 回收站(与命盘侧同款)。
export function listLocalCasesTrash(){
	return store.listTrash();
}

// 回收站现有(没过期的)条数与上限:批量删除确认框写明超出上限的几条转入删除日志
export const LOCAL_CASES_TRASH_CAP = TRASH_CAP;
export function countLocalCasesLiveTrash(){
	return store.countLiveTrash();
}

export function restoreLocalCaseFromTrash(cid){
	return store.restoreFromTrash(cid);
}

// 删除日志找回并把这条从日志里摘掉(再点不会再多一条副本)
export function restoreLocalCaseFromDeletedLog(entry){
	return store.restoreFromDeletedLog(entry);
}

export function purgeLocalCaseTrashItem(cid){
	return store.purgeTrashItem(cid);
}

export function clearLocalCasesTrash(){
	return store.clearTrash();
}
