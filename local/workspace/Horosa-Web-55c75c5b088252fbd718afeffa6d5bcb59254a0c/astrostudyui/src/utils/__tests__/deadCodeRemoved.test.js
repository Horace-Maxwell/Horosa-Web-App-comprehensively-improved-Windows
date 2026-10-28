// 死代码清理的回归锁(共享件):全仓零引用的文件 / 导出 / 模块内局部已删,这里锁住不再长回来。
// 删的都是「没有任何调用方」的东西,功能面零变化;留下的同模块接口照常可用(末尾抽查)。
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const exportRe = (name) => new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+${name}\\b`);
const declRe = (name) => new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?(?:function|const|let|var)\\s+${name}\\b`);

describe('整文件死代码已删', () => {
	const gone = [
		'utils/bytes.js',          // 字节读写工具,零 import
		'utils/WebSock.js',        // 长连接客户端(开关恒关,从未建连)
		'utils/wshelper.js',       // 仅被上一项引用
		'constants/ZWColor.js',    // 0 字节空文件
		'msg/stat.js',             // 零 import
		'msg/msg.js',              // 唯一使用方(面包屑)已删
	];
	test.each(gone)('%s', (rel) => {
		expect(fs.existsSync(path.join(SRC, rel))).toBe(false);
	});
});

describe('零调用方的导出已删', () => {
	const table = [
		['constants/AstroConst.js', ['NO_PLANET', 'TERM_SU27', 'LIST_SU_SIXHOUSE', 'SU_YI', 'SU_SHI', 'SU_KE', 'SU_JU', 'SU_TONG', 'STAR_PLEIADES', 'INDIA_VARGA_VARIANT_LABELS', 'INDIA_DASHA_VARIANT_DEFAULTS']],
		['utils/constants.js', ['NeedWS', 'WebSockServer', 'RtmpPushServer', 'RtmpPlayServer', 'HasRtspPlayer', 'UserDataKey', 'AccessDenyCode', 'UploadFailCode', 'TimeInterval', 'HomePageKey']],
		['utils/helper.js', ['toBase64', 'fromBase64', 'getRegionName', 'getCountryName', 'fillBreadcrumbs', 'fillEditBreadcrumbs', 'fillAddBreadcrumbs', 'cloneMap', 'strCompare', 'formatDuration', 'printArea', 'selectText', 'startWith', 'endWith', 'buildScriptTag', 'getScriptPromise']],
		['utils/request.js', ['uploadFile', 'encodeUrl', 'downloadUrl']],
		['utils/balbillus.js', ['BALBILLUS_TOTAL']],
		['utils/canpingLocal.js', ['CANPING_DAYUN_RULE_LABELS']],
		['utils/chartDrawGuard.js', ['watchChartHostResize']],
		['utils/dayBoundary.js', ['globalDefaultAfter23NewDay', 'globalDefaultLateZiHourUseNextDay']],
		['utils/divinationTimeDraft.js', ['draftOrBaseFields']],
		['utils/heluoLocal.js', ['nodeFromYao', 'guaSanCaiSet', 'periodEnergies']],
		['utils/idbCacheStore.js', ['idbFlushForTest']],
		['utils/idleWarmQueue.js', ['__dataWarmRegistryKeys']],
		['utils/julianDayIndex.js', ['julianDayIndexOfDate']],
		['utils/localNongliAdapter.js', ['extractNongliFromChartWrap']],
		['utils/localcases.js', ['restoreLocalCaseRecord']],
		['utils/lunarDomainGuard.js', ['guardLunarYear']],
		['utils/mountAuditDebug.js', ['isMountAuditEnabled', 'MOUNT_AUDIT_FLAG_KEY']],
		['utils/optionPrefetch.js', ['__resetOptionPrefetchForTest']],
		['utils/pairChineseData.js', ['PAIR_CHINESE_TECHNIQUES']],
		['utils/planetHouseInfo.js', ['isPlanetHouseInfoEnabled']],
		['utils/recordExportLite.js', ['recordToTextSummary']],
		['utils/recordStoreNotice.js', ['localChartsNotPersistedNote', 'localCasesNotPersistedNote']],
		['utils/requestDedupe.js', ['__warmEntry']],
		['utils/stepPrefetchArm.js', ['notifyStepUnitSelected', '__resetStepPrefetchArm']],
		['utils/storageutil.js', ['generateMenuInfo']],
		['utils/tiebanFrameworkLocal.js', ['TIEBAN_SUBSYSTEMS', 'TIEBAN_PIDUAN']],
		['utils/timezone.js', ['friendlyZoneName']],
		['utils/uranianDial.js', ['DIAL_BASES']],
		['utils/xuanshiState.js', ['getXuanShiDefaults']],
		['utils/yizhangjingLocal.js', ['GRADE_MID']],
		['utils/zhengchuanLiuqinLocal.js', ['xinFaSeq']],
		['utils/zhengchuanShaoziLocal.js', ['SHAOZI_META']],
		['utils/zhengchuanXinyiLocal.js', ['xinFaTable']],
		['utils/zoomDomain.js', ['measureLayoutHeightOf', 'getZoomDiagnostics']],
	];
	test.each(table)('%s', (rel, names) => {
		const src = read(rel);
		const back = names.filter((n) => exportRe(n).test(src));
		expect(back).toEqual([]);
	});
});

describe('模块内没人用的局部与 import 已删', () => {
	const table = [
		['utils/request.js', ['safeRemoveLocalItem', 'encryptNoTimestamp']],
		['utils/rsahelper.js', ['hex2Bytes']],
		['utils/baziLunarLocal.js', ['dayOfYearUTC', 'ganziAt', 'mod']],
		['utils/backendBootGate.js', ['sleep']],
		['utils/perfMark.js', ['stepGen']],
		['utils/zhengchuanLiuqinLocal.js', ['XIANTIAN_GUA_NUM', 'XUN_SHOU']],
		['utils/storageutil.js', ['traverseMenus']],
		['utils/localNongliAdapter.js', ['normalizeNongli', 'cloneJson', 'parseChineseMonthInt', 'parseChineseDayInt', 'getTimeGanZhiFromDay', 'buildBirthFallback', 'MONTH_MAP', 'DAY_MAP', 'safe']],
	];
	test.each(table)('%s', (rel, names) => {
		const src = read(rel);
		expect(names.filter((n) => declRe(n).test(src))).toEqual([]);
	});
	test('只为注释示例而存在的 import 不再保留', () => {
		expect(read('utils/perfFlags.js')).not.toMatch(/import\s*\{\s*safeLocalStorageSet\s*\}/);
		expect(read('utils/legacyWebkitCompat.js')).not.toMatch(/^import /m);
		expect(read('utils/babylonAiSnapshot.js')).not.toMatch(/\bPLANET_ORDER\b/);
		expect(read('utils/yizhangjingReport.js')).not.toMatch(/\bxiaoxianStarAt\b|\bxiaoxianQuick\b/);
		expect(read('utils/baziLunarLocal.js')).not.toMatch(/\bSixtyJiaZi\b/);
		expect(read('utils/helper.js')).not.toMatch(/from 'node-forge'|from 'antd'|from 'umi'|msg\/msg|msg\/errmsg|from 'print-js'|utils\/constants'/);
	});
});

describe('留下的同模块接口照常可用', () => {
	test('农历桥:日干支(含 1582 前儒略段)', () => {
		const { getDayGanZhi } = require('../localNongliAdapter');
		expect(getDayGanZhi(2000, 1, 1)).toBe('戊午');
	});
	test('helper 在用的导出仍在', () => {
		const helper = require('../helper');
		['twoTextOneLine', 'uuid', 'randomStr', 'genHtml', 'creatTooltip', 'gcj02ToGps', 'getAzimuthStr'].forEach((n) => {
			expect(typeof helper[n]).toBe('function');
		});
	});
	test('全局 store 读写', () => {
		const { setGlobalStore, getStore } = require('../storageutil');
		const s = { a: 1 };
		setGlobalStore(s);
		expect(getStore()).toBe(s);
	});
});
