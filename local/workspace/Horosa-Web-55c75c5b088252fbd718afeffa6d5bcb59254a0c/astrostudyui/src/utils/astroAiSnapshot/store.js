// 快照签名、正文组装与存取(内存 / 全局 / 模块快照槽,延迟构建)
// 从 astroAiSnapshot.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroConst from '../../constants/AstroConst';
import { classicalBackendOverridesFromFields, classicalSnapshotNeverSig } from '../classicalChartGlobals';   // 签名末位+口径自陈共用请求体单源(无环:classicalChartGlobals 只依赖 safeStorage)
// 古典衍化四段(opt-in)行构建:零组件依赖单源(与 AstroDerivedHouses/AstroKlimata/AstroEminence/AstroThemaMundi 同引)。
import { buildDerivedHousesSnapshotLines, buildKlimataSnapshotLines, buildEminenceSnapshotLines, buildThemaMundiSnapshotLines } from '../astroClassicalDerived';
import { buildEgyptSectionLines } from '../../components/astro/AstroEgypt';   // [埃及历]段本盘派生(纯函数;已验证无环:AstroEgypt 不回 import 本文件)
import { egyptSchoolFromFields, currentEgyptSchool } from '../../divination/data/egyptianSchools';   // 埃及流派口径(record 随盘键优先,回落全局)
import { scheduleStorageWrite } from '../deferredStorage';
import { lazySnapshotBuildEnabled } from '../perfFlags';
import { pickFresherSnapshot } from '../snapshotSlotRead';
import { normalizeAiExportText, fieldValue, resolveOnlyRulerExaltReception, classicalGlobalValueSafe, ASTRO_SNAPSHOT_FORMAT_VERSION } from './format';
import { buildSectionText, buildAspectSection, buildPlanetSection, buildLotsSection, buildDodecaSection, buildDispositorSection, buildHouseSystemRulerSection, buildLifespanSection, buildPossibilitySection } from './chartSections';
import { buildBaseInfoLines, buildHouseCuspLines, buildStarAndLotPositionLines, buildInfoSection } from './infoSection';
import { buildClassicalSection } from './classical';

export const ASTRO_AI_SNAPSHOT_KEY = 'horosa.ai.snapshot.astro.v1';

let ASTRO_AI_SNAPSHOT_MEMORY = null;

const ASTRO_AI_SNAPSHOT_GLOBAL_KEY = '__horosa_astro_ai_snapshot';

function saveAstroSnapshotToGlobal(payload){
	try{
		if(typeof window !== 'undefined'){
			window[ASTRO_AI_SNAPSHOT_GLOBAL_KEY] = payload || null;
		}
	}catch(e){
		// ignore
	}
}

function loadAstroSnapshotFromGlobal(){
	try{
		if(typeof window === 'undefined'){
			return null;
		}
		const obj = window[ASTRO_AI_SNAPSHOT_GLOBAL_KEY];
		if(obj && obj.content){
			return {
				...obj,
				content: normalizeAiExportText(obj.content),
			};
		}
		return null;
	}catch(e){
		return null;
	}
}

export function createAstroSnapshotSignature(chartObj, fields, options = {}){
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const lon = fieldValue(fields, 'lon') || params.lon || '';
	const lat = fieldValue(fields, 'lat') || params.lat || '';
	const zone = params.zone !== undefined && params.zone !== null ? params.zone : fieldValue(fields, 'zone');
	const birth = params.birth || '';
	const zodiacal = chart.zodiacal || AstroConst.ZODIACAL[fieldValue(fields, 'zodiacal')] || '';
	const hsys = chart.hsys || AstroConst.HouseSys[fieldValue(fields, 'hsys')] || '';
	const chartId = chartObj && chartObj.chartId ? chartObj.chartId : '';
	const onlyRulerExaltReception = resolveOnlyRulerExaltReception(options);
	// 恒星黄道 ayanāṃśa（raw key，如 'raman'）：zodiacal 仅区分 回归/恒星，无法分辨 47 个 ayanāṃśa →
	// 必入签名，否则换 ayanāṃśa 后 hasMatchingSavedAstroSnapshot 误判旧快照可复用（Lahiri 快照套到 Raman 盘）。
	// 追加在末位：旧签名无 parts[9] → 解码为 '' → 匹配守卫跳过 → 旧快照行为逐字不变（向后兼容）。
	const siderealAyanamsa = params.siderealAyanamsa || fieldValue(fields, 'siderealAyanamsa') || '';
	// 宫制/黄道**数字位**追加(parts[10]/parts[11]):parts[5]/[6] 是后端 echo 文本
	// (如 'Alcabitius'),与 record 数字值无可靠映射(前端表还有 Alcabitus 拼写差)——不可比对。
	// 数字位来源=本次排盘的 fields 实值,与 record 同数轴 → hasMatchingSavedAstroSnapshot 精确
	// 失效判定「换宫制/换黄道必重算」。旧签名无此二位 → 解码 '' → 守卫跳过(siderealAyanamsa 同范式,向后兼容)。
	const hsysNum = fieldValue(fields, 'hsys');
	const zodiacalNum = fieldValue(fields, 'zodiacal');
	// parts[12]/[13]=择宫传统/界系数字位:两键改快照正文(界主/接纳/古典段)最重,
	// 此前不在比对键集 → 命盘页开 tradition=1 落的快照,挂载 tradition=0 的盘整份复用(与宫制
	// 实锤「根因 B」同构,换了齿轮而已)。同 hsysNum 范式:旧签名缺位=''=守卫跳过,向后兼容。
	const traditionNum = fieldValue(fields, 'tradition');
	const termsVariantNum = fieldValue(fields, 'termsVariant');
	// parts[14]=古典口径 overrides JSON 段:二/四批 10 键+三开关+三分/福点/交点/区分等此前
	// 全不在签名 → 改「燃烧上界/空亡口径」等设置不触发快照失效,AI 复用旧口径快照。复用请求体
	// 单源(仅非默认产键,键插入序=函数内固定序→stringify 稳定):默认态恒 '{}'。比对端
	// (hasMatchingSavedAstroSnapshot)照 hsysNum 逐位守卫范式:旧签名缺位=''=跳过,向后兼容。
	// 追加快照敏感 never 键段(fields 缺键回退全局仓——never 键不播种,消费即读仓)。
	const classicalOv = JSON.stringify({
		...classicalBackendOverridesFromFields(fields),
		...classicalSnapshotNeverSig((k) => {
			const fv = fieldValue(fields, k);
			return (fv === undefined || fv === null) ? classicalGlobalValueSafe(k) : fv;
		}),
	});
	return [chartId, birth, zone, lon, lat, zodiacal, hsys, chart.isDiurnal ? '1' : '0', onlyRulerExaltReception ? '1' : '0', siderealAyanamsa,
		(hsysNum !== undefined && hsysNum !== null) ? `${hsysNum}` : '',
		(zodiacalNum !== undefined && zodiacalNum !== null) ? `${zodiacalNum}` : '',
		(traditionNum !== undefined && traditionNum !== null) ? `${traditionNum}` : '',
		(termsVariantNum !== undefined && termsVariantNum !== null) ? `${termsVariantNum}` : '',
		classicalOv].join('|');
}

export function buildAstroSnapshotContent(chartObj, fields, options = {}){
	if(!chartObj || !chartObj.chart){
		return '';
	}
	const sections = [];
	sections.push(buildSectionText('起盘信息', buildBaseInfoLines(chartObj, fields, { withTimeBasis: true })));
	sections.push(buildSectionText('宫位宫头', buildHouseCuspLines(chartObj)));
	sections.push(buildSectionText('星与虚点', buildStarAndLotPositionLines(chartObj)));
	sections.push(buildSectionText('信息', buildInfoSection(chartObj, fields, options)));
	sections.push(buildSectionText('相位', buildAspectSection(chartObj)));
	sections.push(buildSectionText('行星', buildPlanetSection(chartObj)));
	sections.push(buildSectionText('希腊点', buildLotsSection(chartObj)));
	sections.push(buildSectionText('12分度', buildDodecaSection(chartObj)));
	sections.push(buildSectionText('主宰星链', buildDispositorSection(chartObj)));
	sections.push(buildSectionText('分宫制宫神星表', buildHouseSystemRulerSection(chartObj, fields))); // [Windows #79] 独立段(默认勾选;preset×9 + v57 union)
	sections.push(buildSectionText('古典', buildClassicalSection(chartObj)));
	// [衍化四段] 古典 tab 衍化组件(派生宫转宫/气候带/显赫计分/世界范式盘)快照镜像 —— 🔴 opt-in:
	// 仅本命 astro 快照保存路径(models/astro 四效果)与挂载 astrochart 分支传 classicalDerived;
	// germany/mundane/indiachart/jieqi/relative 等嵌套消费方缺省 falsy=零输出零字节(段头爆炸半径钉死,
	// per-key 负向锁看死)。计算层单源 utils/astroClassicalDerived(与四组件同引)。
	if(options.classicalDerived){
		sections.push(buildSectionText('古典·派生宫转宫', buildDerivedHousesSnapshotLines(chartObj)));
		sections.push(buildSectionText('古典·气候带', buildKlimataSnapshotLines(chartObj, fields)));
		// 主宰光体判定项(段内增行):有利宫集/动力学分区/庙界主派/界表档随全局仓与 fields。
		sections.push(buildSectionText('古典·显赫计分', buildEminenceSnapshotLines(chartObj, {
			busyPlaces: `${classicalGlobalValueSafe('busyPlaces')}`.split(',').map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n)),
			dynamicalDivisions: classicalGlobalValueSafe('dynamicalDivisions'),
			domicileMasterMethod: classicalGlobalValueSafe('domicileMasterMethod'),
			termsVariant: fieldValue(fields, 'termsVariant'),
			// 与 UI 侧(AstroEminence)同口径:双子校勘+自定义表体一并供水,否则界主派两侧结论可分叉
			geminiBoundEmended: fieldValue(fields, 'geminiBoundEmended'),
			customTermsDay: fieldValue(fields, 'customTermsDay') || (chartObj && chartObj.params ? chartObj.params.customTermsDay : undefined),
			customTermsNight: fieldValue(fields, 'customTermsNight') || (chartObj && chartObj.params ? chartObj.params.customTermsNight : undefined),
			rayWeighting: classicalGlobalValueSafe('rayWeighting'),   // 七射线行(off 零增行)
		})));
		sections.push(buildSectionText('古典·世界范式盘', buildThemaMundiSnapshotLines()));
	}
	// [埃及历]:各点落旬/上升旬详情/民用历(本盘派生);数据缺 → [] 不产段。在 builder 本体内,同步/惰性两路径自然一致。
	// 流派口径三级:record 随盘键(egypt_*,存盘时全局非默认才捕获) > 当前全局 > 默认档 ——
	// 保证同一命例重开,本段不随「后来改过的全局设置」静默漂移(与其余古典键随盘保真同口径)。
	const egyptLines = buildEgyptSectionLines(chartObj, egyptSchoolFromFields(fields) || currentEgyptSchool());
	if(egyptLines.length){ sections.push(buildSectionText('埃及历', egyptLines)); }
	sections.push(buildSectionText('寿命格局', buildLifespanSection(chartObj)));
	sections.push(buildSectionText('可能性', buildPossibilitySection(chartObj)));
	const joined = sections.filter(Boolean).join('\n\n').trim();
	// [MU parity] headerless:嵌入到父段(如合盘的[合成图盘]、节气的[春分3D盘])之下时,把本函数产的
	// 整行 [X] 子段头转 `· X` 标签——否则 splitContentSections 把这些子段当顶层段拆出、自定义过父技法段的
	// 用户按父段名过滤会把盘体删净只剩空壳头(relative/jieqi Type-B)。对齐整盘 jieqi 的 withHeaders=false 范式。
	// 默认(headerless 缺省)行为逐字不变,仅 relative/jieqi 嵌入调用点显式传 true。
	if(options.headerless){
		return joined.replace(/^\[(.+?)\]$/gm, '· $1');
	}
	return joined;
}

export function saveAstroAISnapshot(chartObj, fields, options = {}){
	try{
		// 同步 save 即最新真值:丢弃 pending,防旧 factory 物化盖过本次内容。
		ASTRO_PENDING = null;
		const content = buildAstroSnapshotContent(chartObj, fields, options);
		if(!content){
			return null;
		}
		const payload = {
			version: ASTRO_SNAPSHOT_FORMAT_VERSION,
			createdAt: new Date().toISOString(),
			signature: createAstroSnapshotSignature(chartObj, fields, options),
			chartId: chartObj && chartObj.chartId ? chartObj.chartId : null,
			content: normalizeAiExportText(content),
		};
		ASTRO_AI_SNAPSHOT_MEMORY = payload;
		saveAstroSnapshotToGlobal(payload);
		if(typeof window !== 'undefined' && window.localStorage){
			scheduleStorageWrite(ASTRO_AI_SNAPSHOT_KEY, ()=>JSON.stringify(payload)); // 流畅度:大快照延迟落盘
		}
		return payload;
	}catch(e){
		// localStorage 写入异常时，仍保留内存快照，避免导出链路整体失效。
		try{
			const content = buildAstroSnapshotContent(chartObj, fields, options);
			if(!content){
				return null;
			}
			ASTRO_AI_SNAPSHOT_MEMORY = {
				version: ASTRO_SNAPSHOT_FORMAT_VERSION,
				createdAt: new Date().toISOString(),
				signature: createAstroSnapshotSignature(chartObj, fields, options),
				chartId: chartObj && chartObj.chartId ? chartObj.chartId : null,
				content: normalizeAiExportText(content),
			};
			saveAstroSnapshotToGlobal(ASTRO_AI_SNAPSHOT_MEMORY);
			return ASTRO_AI_SNAPSHOT_MEMORY;
		}catch(inner){
			// ignore
		}
		return null;
	}
}

// 惰性构建槽(astro 快照是单例,单槽即可)。语义见 saveAstroAISnapshotLazy。
let ASTRO_PENDING = null;

// 惰性版 save:整盘多 section 文本拼装(相位/行星/希腊点/12分度/主宰星链/寿命格局/可能性)
// 挪出排盘完成的关键路径,到空闲时段或首次读取时执行;内容与同步版逐字节一致,只是构建变晚。
export function saveAstroAISnapshotLazy(chartObj, fields, options = {}){
	if(!lazySnapshotBuildEnabled()){
		// kill-switch:退化为同步构建,行为==现状。
		return saveAstroAISnapshot(chartObj, fields, options);
	}
	// dev 漂移哨兵:开发态注册时同步预构建一份,物化时比对——捕捉「chartObj 在登记后被
	// 某 hook 面板就地突变」导致的字节漂移(生产态零成本)。
	let devExpected = null;
	try{
		if(typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development'){
			devExpected = buildAstroSnapshotContent(chartObj, fields, options);
		}
	}catch(e){
		devExpected = null;
	}
	const token = {
		// createdAt/signature/chartId 注册时打点(signature 纯字符串拼接,廉价),
		// 元数据语义与同步版「save 时刻」一致。
		createdAt: new Date().toISOString(),
		signature: createAstroSnapshotSignature(chartObj, fields, options),
		chartId: chartObj && chartObj.chartId ? chartObj.chartId : null,
		done: false,
		payload: null,
		materialize(){
			if(token.done){
				return token.payload;
			}
			token.done = true;
			try{
				const content = buildAstroSnapshotContent(chartObj, fields, options);
				if(content){
					if(devExpected !== null && content !== devExpected){
						console.warn('[horosa.perf] astro 快照惰性构建内容漂移(chartObj 注册后被突变?),请排查 hook 面板对入参的就地写');
					}
					token.payload = {
						version: ASTRO_SNAPSHOT_FORMAT_VERSION,
						createdAt: token.createdAt,
						signature: token.signature,
						chartId: token.chartId,
						content: normalizeAiExportText(content),
					};
					ASTRO_AI_SNAPSHOT_MEMORY = token.payload;
					saveAstroSnapshotToGlobal(token.payload);
				}
				// 空内容与同步版语义一致:不覆盖旧快照、不落盘。
			}catch(e){
				// factory 异常:保留旧快照。
			}
			if(ASTRO_PENDING === token){
				ASTRO_PENDING = null;
			}
			return token.payload;
		},
	};
	ASTRO_PENDING = token; // 后写覆盖(latest-wins):连续重排只构建最后一次
	if(typeof window !== 'undefined' && window.localStorage){
		scheduleStorageWrite(ASTRO_AI_SNAPSHOT_KEY, ()=>{
			const payload = token.materialize();
			return payload ? JSON.stringify(payload) : undefined;
		});
	}
	return token;
}

export function loadAstroAISnapshot(){
	try{
		// read-time 强制物化(铁律):pending 即最新快照,必须先于 localStorage 直返——
		// localStorage 此刻还是上一次的旧值(延迟落盘窗口),走旧分支会读到过期内容。
		if(ASTRO_PENDING){
			const fresh = ASTRO_PENDING.materialize();
			if(fresh){
				return fresh;
			}
			// 物化为空(本次快照为空)→ 按同步版语义回落旧快照。
		}
		// 读序单一来源(snapshotSlotRead.pickFresherSnapshot,与模块快照同一个函数):本窗口内存那份不比存储旧就用内存;
		// 存储更新(别的窗口刚写过)以存储为准。此前先读存储:同步存 / 惰性存之后、空闲落盘之前(存储写满时一直不落盘)
		// 读回上一张盘,还拿它覆盖内存里的新盘。
		const memRaw = (ASTRO_AI_SNAPSHOT_MEMORY && ASTRO_AI_SNAPSHOT_MEMORY.content) ? ASTRO_AI_SNAPSHOT_MEMORY : loadAstroSnapshotFromGlobal();
		const raw = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem(ASTRO_AI_SNAPSHOT_KEY) : null;
		const picked = pickFresherSnapshot(memRaw, raw, {
			legacy: (txt)=>({ version: 1, createdAt: '', signature: '', chartId: null, content: txt }),
		});
		if(picked.payload){
			const out = { ...picked.payload, content: normalizeAiExportText(picked.payload.content) };
			if(picked.source !== 'memory'){
				ASTRO_AI_SNAPSHOT_MEMORY = out;   // 存储那份更新 / 纯文本旧存量 → 回写内存
				saveAstroSnapshotToGlobal(out);
			}else if(!ASTRO_AI_SNAPSHOT_MEMORY || !ASTRO_AI_SNAPSHOT_MEMORY.content){
				ASTRO_AI_SNAPSHOT_MEMORY = out;   // 内存空、取自全局那份
			}
			return out;
		}
		return null;
	}catch(e){
		const global = loadAstroSnapshotFromGlobal();
		if(global){
			ASTRO_AI_SNAPSHOT_MEMORY = global;
			return global;
		}
		if(ASTRO_AI_SNAPSHOT_MEMORY && ASTRO_AI_SNAPSHOT_MEMORY.content){
			return {
				...ASTRO_AI_SNAPSHOT_MEMORY,
				content: normalizeAiExportText(ASTRO_AI_SNAPSHOT_MEMORY.content),
			};
		}
		return null;
	}
}

export function getAstroAISnapshotForCurrent(chartObj, fields, options = {}){
	const snap = loadAstroAISnapshot();
	if(!snap){
		return null;
	}
	if(!chartObj){
		return snap;
	}
	const sig = createAstroSnapshotSignature(chartObj, fields, options);
	if(snap.signature !== sig){
		return null;
	}
	return snap;
}
