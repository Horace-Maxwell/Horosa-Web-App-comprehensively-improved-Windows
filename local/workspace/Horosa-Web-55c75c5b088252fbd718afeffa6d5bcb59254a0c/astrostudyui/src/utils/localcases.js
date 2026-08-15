import { createLocalRecordStore, nowStr, normalizeGroup, normalizePayload } from './localRecordStore';

const LocalCasesKey = 'horosa.localCases.v1';

// [S1 内核收编] 与 localcharts.js 同批:存储机械层收编进 localRecordStore 单一内核,
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
];

const CASE_TYPE_ALIASES = {
	// 精确键查表(非子串匹配);「奇门择日」必须先于裸「奇门」有独立键,免归并成 qimen。
	'奇门择日': 'qimenzeri',
	'奇門擇日': 'qimenzeri',
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
		// [R4] 事盘备注(present 才落,旧档体积零变):命盘有 8 个 memo* 槽,事盘此前 0 个 ——
		// 断后复盘/应期回填只能改「事件」标题混写。经编辑表单填写。
		memo: values.memo !== undefined && values.memo !== null && values.memo !== '' ? `${values.memo}` : undefined,
	};
	return record;
}

export function upsertLocalCase(values){
	return store.upsert(values);
}

export function removeLocalCase(cid){
	return store.remove(cid);
}

export function exportLocalCasesBackup(){
	return store.exportBackup();
}

export function importLocalCasesBackup(payload){
	return store.importBackup(payload);
}

// [S4] 存储健康态(横幅/诊断用):mode 'persistent'|'memory' + 最近写失败原因。
export function getLocalCasesStoreHealth(){
	return store.getHealth();
}

// [S8] 导入三闸的纯函数面(校验/预览),UI 在确认后才调 importLocalCasesBackup 真写。
export function validateLocalCasesBackup(payload){
	return store.validateBackupEnvelope(payload);
}

export function previewLocalCasesBackup(payload){
	return store.previewImportBackup(payload);
}

// [V] 置顶/置底(与命盘侧同款)。
export function pinLocalCase(cid, tier){
	return store.setPin(cid, tier);
}

// [V] 上移/下移(与命盘侧同款)。
// [V5-D1/D2/D3] 归档/星标/使用足迹(内核管理字段;全链保真由未知键保全承载)。
export function flagLocalCase(cid, field, on){
	return store.setFlag(cid, field, on);
}

export function touchLocalCase(cid){
	return store.touchRecord(cid);
}

export function moveLocalCase(cid, dir){
	return store.moveRecord(cid, dir);
}

// [R3] 回收站(与命盘侧同款)。
export function listLocalCasesTrash(){
	return store.listTrash();
}

export function restoreLocalCaseFromTrash(cid){
	return store.restoreFromTrash(cid);
}

export function purgeLocalCaseTrashItem(cid){
	return store.purgeTrashItem(cid);
}

export function clearLocalCasesTrash(){
	return store.clearTrash();
}
