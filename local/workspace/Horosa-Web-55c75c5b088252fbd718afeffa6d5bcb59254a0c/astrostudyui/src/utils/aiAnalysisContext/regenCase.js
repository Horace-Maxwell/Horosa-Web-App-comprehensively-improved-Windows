// AI 分析挂载上下文 · 事盘技法快照:按事盘生成 / 重算、农历补算、六爻齿轮合并与无头起卦。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';
import { fetchPreciseNongli } from '../preciseCalcBridge';
import { buildDunJiaSnapshotText } from '../../components/dunjia/DunJiaCalc';
import { buildTaiyiSnapshotText } from '../../components/taiyi/TaiYiCalc';
import {
	applyPreset as applyLiuyaoPreset, LIUYAO_PRESETS, normalizeLiuyaoSettings, loadPersistedLiuyaoSettings,
	setOption as setLiuyaoOption,
} from '../../components/gua/liuyaoSchools';
import { loadDoctrine as loadLiuyaoDoctrine } from '../../components/gua/data/liuyaoDoctrineCache';   // 无头六爻快照先载断语库 // 齿轮选流派须真套预设(与页面 changeLiuyaoPreset 同律)
import { buildTongSheFaModel, buildTongSheFaSnapshot } from '../../components/tongshefa/TongSheFaMain';
import { buildJinKouData } from '../../components/jinkou/JinKouCalc';
import { resolveJinKouDiFen } from '../../components/jinkou/JinKouState';
import { buildLiuRengSnapshotText } from '../../components/lrzhan/LiuRengMain';
import {
	buildJinKouSnapshotText, deriveBenMingFromRunYear as deriveJinkouBenMing,
	deriveXuSuiFromRunYear as deriveJinkouXuSui,
} from '../../components/jinkou/JinKouMain';
import { buildGuaSnapshotText, buildTimeGua, buildLinesGua } from '../../components/guazhan/GuaZhanMain';
import { buildHuangJiSnapshotForFields } from '../../components/huangji/HuangJiMain';
import { buildTaiXuanSnapshotForFields } from '../../components/taixuan/TaiXuanMain';
import { buildJingJueSnapshotForFields } from '../../components/jingjue/JingJueMain';
import { buildWuZhaoSnapshotForFields, WUZHAO_CALC_OPTION_KEYS } from '../../components/wuzhao/WuZhaoMain';
import { buildShenYiShuSnapshotForFields } from '../../components/shenyishu/ShenYiShuMain';
import { buildGeomancySnapshotForFields } from '../../components/geomancy/GeomancyMain';
import { buildTarotSnapshotForFields } from '../../components/tarot/TarotMain';
// parseDateParts:老黄历日课(case 'huangli')那支按 date 串拆年月日用它;
// 此前只调用未导入 → 挂载黄历事盘时抛 ReferenceError(同型问题先例:
// 调用点在运行时闭包里,模块加载与渲染阶段都踩不到)。
import { parseDateParts } from '../dateStrSafe';
import { resolveZhangshengElem } from './catalog';
import { buildFieldObject, buildCaseSnapshotFields, buildCaseSnapshotParams } from './recordFields';
import {
	buildSanshiUnifiedFallbackSnapshot, regenerateLiurengSnapshot, regenerateJinkouSnapshot,
	regenerateQimenSnapshot, regenerateTaiyiSnapshot, regenerateSanshiUnifiedSnapshot,
} from './regenDivination';
import { regenerateHorarySnapshot, regenerateElectionSnapshot } from './regenHoraryElection';
import { normalizeTechniqueKey } from './techniqueKey';

export function generateCaseTechniqueSnapshot(record, moduleName, payload){
	const key = normalizeTechniqueKey(moduleName || (payload && payload.module) || (record && record.sourceModule) || '');
	if(!record || !key){
		return '';
	}
	const params = buildCaseSnapshotParams(record);
	switch(key){
	case 'liureng':
		if(!payload || !payload.liureng){
			return '';
		}
		return buildLiuRengSnapshotText(
			params,
			payload.liureng,
			payload.runyear || null,
			null,
			payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 2,
			resolveZhangshengElem(payload.wuxing, payload.liureng),
			record.gender !== undefined && record.gender !== null ? record.gender : 1,
			{
				castMethod: payload.castMethod,
				xuanShiZhi: payload.xuanShiZhi,
				yanShuNum: payload.yanShuNum,
				yueJiangMethod: payload.yueJiangMethod,
				fenZhouYe: payload.fenZhouYe,
				// 2026-07-05 审计修:与 regenerateCaseTechniqueSnapshot 的 liurengOpts 对齐——
				// 涉害取舍/始入课/年神排序/昼夜阳阴/土旺衰 此前漏枚举 → 挂载快照丢设置回退默认。
				// 缺省 undefined → builder 兜底默认 = 未设置时字节级不变(零回归)。
				seHaiMethod: payload.seHaiMethod,
				seHaiBoundary: payload.seHaiBoundary,
				shiRuKe: payload.shiRuKe,
				yearShenShaSort: payload.yearShenShaSort,
				yinyangSystem: payload.yinyangSystem,
				tuWangShuai: payload.tuWangShuai,
				zhanCategory: payload.zhanCategory,
			}
		);
	case 'jinkou': {
		if(!payload || !payload.liureng){
			return '';
		}
		const timeText = payload.liureng && payload.liureng.nongli ? payload.liureng.nongli.time : '';
		const diFen = resolveJinKouDiFen(
			payload.diFen,
			false,
			timeText,
			!!payload.diFen
		);
		const jinkouData = buildJinKouData(payload.liureng, {
			diFen,
			// 金口诀贵神兜底 0（六壬法）=== 组件/schema 默认（原写死 2 对不上）。
			guirengType: payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 0,
			isDiurnal: null,
			// 已存事盘 payload 含月将/占时则透传（缺省=自动取=现状）。
			yueJiang: payload.yueJiang,
			zhanShi: payload.zhanShi,
			// 流派/盘式透传（缺省=默认派=现状,零回归）：保证挂载/还原的快照与保存时的流派盘一致。
			schoolYueJiang: payload.schoolYueJiang,
			schoolGuiTable: payload.schoolGuiTable,
			schoolGuiPan: payload.schoolGuiPan,
			panShi: payload.panShi,
			soilChangSheng: payload.soilChangSheng,
			wuxing: resolveZhangshengElem(payload.wuxing, payload.liureng),
			// 专题起式/行年旬法随档回放（缺省=不选=整段不产=现状,零回归）。
			topicKey: payload.topicKey,
			shiJianKind: payload.shiJianKind,
			// 合占扣题(所问类别/问事时段)随档/齿轮回放 —— 漏则 [合占扣题与内外] 段回落默认。
			askKey: payload.askKey,
			timeScope: payload.timeScope,
			// 属相/虚岁自随档的 runyear（其内 birthGanZi/age 来自问测人出生档），与页面派生同律。
			benMing: deriveJinkouBenMing(payload.runyear),
			birthGanZi: payload.runyear && payload.runyear.birthGanZi,
			gender: record.gender !== undefined && record.gender !== null ? record.gender : 1,
			age: deriveJinkouXuSui(payload.runyear),
		});
		return buildJinKouSnapshotText(
			params,
			payload.liureng,
			payload.runyear || null,
			jinkouData,
			// 五行缺省按本课日干(与金口诀页 / regenerateJinkouSnapshot 同);原 '' 会整段跳过十二长生。
			resolveZhangshengElem(payload.wuxing, payload.liureng),
			payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 0,
			record.gender !== undefined && record.gender !== null ? record.gender : 1
		);
	}
	case 'qimen': {
		const qpan = payload && (payload.pan || (payload.result && payload.result.dunjia) || payload.dunjia);
		if(!qpan){
			return '';
		}
		// 已存事盘 pan 多已带 faRelatedPeople(存盘时 stamp)；旧记录无则显式置空数组(避免误用全局当前选择)。
		if(!Array.isArray(qpan.faRelatedPeople)){
			qpan.faRelatedPeople = payload && Array.isArray(payload.faRelatedPeople) ? payload.faRelatedPeople : [];
		}
		return buildDunJiaSnapshotText(qpan);
	}
	case 'tongshefa': {
		const selection = payload && (payload.selection || (payload.tongshefa && payload.tongshefa.selection));
		if(!selection){
			return '';
		}
		return buildTongSheFaSnapshot(buildTongSheFaModel(selection));
	}
	case 'sixyao':
		if(!payload || !payload.gua){
			return '';
		}
		return buildGuaSnapshotText(buildCaseSnapshotFields(record), payload && payload.gua ? payload.gua : {});
	case 'mundane':
		// 世俗盘(入宫/新月/满月/日食/月食/地区盘/行星周期):astro 类事盘,存档时 DivinationChartShell 已写
		// 格式化 buildAiSnapshot 全文于 payload.aiSnapshot → 挂载直接复用(世俗盘类型多样,不按时间重算)。
		return (payload && payload.aiSnapshot && `${payload.aiSnapshot}`.trim()) ? `${payload.aiSnapshot}` : '';
	case 'tianxing':
		// 天星择日(征象搜索):同 mundane 范式——存档时 shell 写 buildTianxingSnapshot 全文于
		// payload.aiSnapshot(搜索配置/条件树/命中区间为一次性结果,事盘绝不按时间复算)。
		return (payload && payload.aiSnapshot && `${payload.aiSnapshot}`.trim()) ? `${payload.aiSnapshot}` : '';
	case 'qimenzeri': {
		// 奇门择日:clickSaveCase(scope=qimenzeri)已把「奇门全文+择日三段」拼合文本(经 composeAiSnapshot)
		// 存于 payload.snapshot 并 stamp payload.module —— 只认本模块存档(裸 payload.snapshot 属
		// 存档方模块语义,不甄别直读=把别家事盘内容串进来,挂载穷举测试即为此把门)。
		// 🔴 形状:loadModuleAISnapshot 返回整包对象({module,content,...}),clickSaveCase 原样入档——
		// 按字符串直读会挂出「[object Object]」(真机实抓);兼容对象包(.content)与纯字符串双形。
		// 兜底同档 payload.pan 重拼奇门正文(极端旧档缺 snapshot 时至少盘面完整)。
		if(!payload || payload.module !== 'qimenzeri'){
			return '';
		}
		const zeriSnapRaw = payload.snapshot && typeof payload.snapshot === 'object'
			? payload.snapshot.content
			: payload.snapshot;
		if(zeriSnapRaw && `${zeriSnapRaw}`.trim()){
			return `${zeriSnapRaw}`;
		}
		return payload.pan ? buildDunJiaSnapshotText(payload.pan) : '';
	}
	case 'taiyi':
		if(!payload || !(payload.pan || (payload.result && payload.result.taiyi) || payload.taiyi)){
			return '';
		}
		return buildTaiyiSnapshotText(payload.pan || (payload.result && payload.result.taiyi) || payload.taiyi);
	case 'sanshiunited':
		if(!payload || (!payload.moduleSnapshots && !payload.modules && !payload.snapshot && !payload.result)){
			return '';
		}
		return buildSanshiUnifiedFallbackSnapshot(record, payload || {});
	default:
		return '';
	}
}

// [卜挂载按时补算] record(divTime/birth+zone/经纬)→ 同形农历要件:小六壬三数/飞宫占时支/小成图时间卦
// 全走 deriveLocalNongli 单源(与各页「按占时」同一历法),时支序=1..12(子=1)。
const ZHI_LIST_FOR_CAST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
async function deriveNongliForRecord(record){
	try{
		const fieldObj = buildFieldObject(record);
		if(!fieldObj){ return null; }
		const { deriveLocalNongli } = await import('../divinationTimeDraft');
		const nl = deriveLocalNongli(fieldObj);
		if(!nl){ return null; }
		const tGZ = (nl.bazi && nl.bazi.time && nl.bazi.time.ganzi) || '';
		const dGZ = (nl.bazi && nl.bazi.day && nl.bazi.day.ganzi) || '';
		const yGZ = nl.yearGZByLunar || (nl.bazi && nl.bazi.year && nl.bazi.year.ganzi) || '';
		const hourZhi = tGZ.charAt(1) || '';
		const yearZhi = yGZ.charAt(1) || '';
		return {
			monthInt: nl.monthInt || null,
			dayInt: nl.dayInt || null,
			hourZhi,
			hourIdx: hourZhi ? ZHI_LIST_FOR_CAST.indexOf(hourZhi) + 1 : 0,
			yearZhiIdx: yearZhi ? ZHI_LIST_FOR_CAST.indexOf(yearZhi) + 1 : 0,
			dayGan: dGZ.charAt(0) || undefined,
			dayZhi: dGZ.charAt(1) || undefined,
		};
	}catch(e){ return null; }
}

// [制度化] export 供全技法段登记哨兵真跑(aiExportSectionsParityAll.test):生产消费不变。
export async function regenerateCaseTechniqueSnapshot(record, moduleName, payload){
	const key = normalizeTechniqueKey(moduleName || (payload && payload.module) || (record && record.sourceModule) || '');
	if(!record || !key){
		return '';
	}
	// 六壬起课法等配置由「每技法设置」merge 进 payload 顶层（mergeOptionsIntoPayload optionsPath:''）→ 透传给 regenerate。
	const p = payload && typeof payload === 'object' ? payload : {};
	const liurengOpts = {
		// 起课时间算法:存档 clickSaveCase 与齿轮(optionsPath:'')都落 payload 顶层;此白名单漏它
		// → 差分闸当场判 FAIL-DEAD(键进了 schema、无人消费)。透传后 requestLiurengGods 随参重取盘。
		timeAlg: p.timeAlg,
		castMethod: p.castMethod,
		xuanShiZhi: p.xuanShiZhi,
		yanShuNum: p.yanShuNum,
		yueJiangMethod: p.yueJiangMethod,
		fenZhouYe: p.fenZhouYe,
		guireng: p.guireng,
		wuxing: p.wuxing,
		// 涉害取舍 / 始入课 / 年神排序 / 昼夜阳阴归属 / 土旺衰:payload 顶层(clickSaveCase 已存 + 齿轮 mergeOptionsIntoPayload
		// optionsPath:'' 落顶层)→ 此处转交 regenerateLiurengSnapshot 的 castOpts(再喂 buildLiuRengSnapshotText)。漏枚举 →
		// 存档/齿轮选的这 5 类设置在挂载快照丢、回退默认。缺省 undefined → builder 兜底默认 = 现状字节级一致(零回归)。
		seHaiMethod: p.seHaiMethod,
		seHaiBoundary: p.seHaiBoundary,
		shiRuKe: p.shiRuKe,
		yearShenShaSort: p.yearShenShaSort,
		yinyangSystem: p.yinyangSystem,
		tuWangShuai: p.tuWangShuai,
		zhanCategory: p.zhanCategory,
		// 公历年/本命支/行年支:存档 clickSaveCase 写在 payload 顶层(liurengBenmingXingnian),liurengHeadlessCastOpts
		// 也支持透传;此处白名单此前漏掉三键 → 拨任一六壬齿轮后「九~十二客/本命加时/行年加时」六式静默退回正时正将而
		// 快照仍标所选起课法。缺席仍 undefined → helper 兜底(solarYear 按 divTime 年份、本命/行年不造键)= 缺省字节不变。
		solarYear: p.solarYear,
		benmingZhi: p.benmingZhi,
		xingnianZhi: p.xingnianZhi,
	};
	switch(key){
	case 'huangli': {
		// 老黄历日课:纯日期确定复算(动态 import 保 AI chunk 不吃 calendar 组件树)
		const prm = buildCaseSnapshotParams(record);
		const _hp = parseDateParts(`${prm.date}`) || {};
		const hy = _hp.year, hm = _hp.month, hd = _hp.day;
		const hh = Number(`${prm.time}`.split(':')[0]);
		if(!(hy > 0 && hm > 0 && hd > 0)){ return ''; }
		const mod = await import('../../components/calendar/huangliSnapshot');
		const fn = mod.buildHuangliSnapshotByDate || (mod.default && mod.default.buildHuangliSnapshotByDate);
		return fn ? `${fn(hy, hm, hd, Number.isFinite(hh) ? hh : 12) || ''}` : '';
	}
	case 'tongshu': {
		// 通书择日:按日期+默认设置(或 payload.tongshu 覆盖)起当日一派断语
		const prm = buildCaseSnapshotParams(record);
		if(!prm.date){ return ''; }
		const [modT, modS] = await Promise.all([
			import('../../components/calendar/tongshuSnapshot'),
			import('../../components/calendar/tongshuSchools'),
		]);
		const build = modT.buildTongshuSnapshotText;
		// 底 = 通书页保存的设置(与页面、齿轮现值缺省同源);取不到再回缺省表
		let defaults = modS.DEFAULT_TONGSHU_SETTINGS || {};
		try{ defaults = { ...defaults, ...(require('../../components/calendar/tongshuStore').loadTongshuSettings() || {}) }; }catch(e){ /* 回缺省表 */ }
		delete defaults.date;
		const settings = { ...defaults, ...(p.tongshu && typeof p.tongshu === 'object' ? p.tongshu : {}), date: prm.date };
		return build ? `${build(settings, prm.date) || ''}` : '';
	}
	case 'liureng':
		return regenerateLiurengSnapshot(record, liurengOpts, p.runyear);
	case 'jinkou':
		return regenerateJinkouSnapshot(record, payload);
	case 'qimen':
		return regenerateQimenSnapshot(record, payload);
	case 'taiyi':
		return regenerateTaiyiSnapshot(record, payload);
	case 'sanshiunited':
		return regenerateSanshiUnifiedSnapshot(record, payload);
	case 'horary':
		return regenerateHorarySnapshot(record, p);
	case 'election':
		return regenerateElectionSnapshot(record, p);
	case 'sixyao': {
		const lyGear = (p.liuyaoSettings && typeof p.liuyaoSettings === 'object') ? p.liuyaoSettings : null;
		// 🔴 已存卦(payload.gua)恒冻结:仅以合并后的 liuyaoSettings 重算判读层,绝不重起时间卦。
		if(p.gua && (p.gua.currentGua || Array.isArray(p.gua.yao))){
			const merged = mergeLiuyaoGearSettings(p.gua.liuyaoSettings || {}, lyGear || {});
			await ensureLiuyaoDoctrineLoaded();   // 无头路径先把《断易天机》断语库载入缓存(此前未开过六爻页即静默缺断语行)
			return buildGuaSnapshotText(buildCaseSnapshotFields(record), { ...p.gua, liuyaoSettings: merged });
		}
		return regenerateSixyaoSnapshot(record, lyGear);
	}
	case 'huangji': {
		// [挂载设置] 齿轮顶层铺平(optionsPath'')优先;🔴 存档在 payload.options.{historyYear,classicKey,
		// classicSectionIndex,xinyiOptions{method,…}}(路径+键名双错曾致存档设置永远读不到,
		// 心易段/所推之年/章节全部回默认)。嵌套档打底、齿轮覆盖。
		const ho = (p.options && typeof p.options === 'object') ? p.options : {};
		const hx = (ho.xinyiOptions && typeof ho.xinyiOptions === 'object') ? ho.xinyiOptions : {};
		// 顶层有这个键 = 齿轮拨过(页面存档只在 options 里):拨成空串也算数(所推之年留空 = 按盘面年),此前空串被当没拨、回落存档年份
		const hv = (k, saved)=>(Object.prototype.hasOwnProperty.call(p, k) && p[k] !== undefined && p[k] !== null ? p[k] : saved);
		return buildHuangJiSnapshotForFields(buildFieldObject(record), {
			classicKey: hv('classicKey', ho.classicKey),
			historyYear: hv('historyYear', ho.historyYear),
			classicSectionIndex: hv('classicSectionIndex', ho.classicSectionIndex),
			xinyiMethod: hv('xinyiMethod', hx.method),
			upperNum: hv('upperNum', hx.upperNum), lowerNum: hv('lowerNum', hx.lowerNum),
			upperStrokes: hv('upperStrokes', hx.upperStrokes), lowerStrokes: hv('lowerStrokes', hx.lowerStrokes),
			objectGua: hv('objectGua', hx.objectGua), direction: hv('direction', hx.direction),
		});
	}
	case 'taixuan': {
		// 齿轮 → payload 顶层(optionsPath'')优先;🔴 页面存档落 payload.options.*(路径不同构曾致
		// 存档 seed 永远读不到 —— 页面随机 seed vs 挂载时间派生 seed,一动齿轮挂载出另一卦)。
		// 齿轮种子留空 = 随存档(空串不是显式种子,否则构造器按起课时间另起一卦)
		const oo = (p.options && typeof p.options === 'object') ? p.options : {};
		return buildTaiXuanSnapshotForFields(buildFieldObject(record), { seed: p.seed !== undefined && p.seed !== null && p.seed !== '' ? p.seed : oo.seed });
	}
	case 'jingjue': {
		const oo = (p.options && typeof p.options === 'object') ? p.options : {};
		return buildJingJueSnapshotForFields(buildFieldObject(record), { seed: p.seed !== undefined && p.seed !== null && p.seed !== '' ? p.seed : oo.seed });
	}
	case 'wuzhao': {
		// 🔴 键集驱动,不手抄白名单:此处曾只透传 mode/number/manual/manualSplits 四键,
		// 而挂载 schema 与存案里另有筮法口径/掷钱/卜数/行神月制/年命支/性别六键——
		// 用户在挂载设置里设了却读不到,是彻头彻尾的死开关。键集单源自 WuZhaoMain。
		const oo = (p.options && typeof p.options === 'object') ? p.options : {};
		const opts = {};
		WUZHAO_CALC_OPTION_KEYS.forEach((key)=>{
			const value = p[key] !== undefined ? p[key] : oo[key];
			if(value !== undefined){ opts[key] = value; }
		});
		// 存档原盘随行:随机揲筮/掷钱类模式由 builder 按存档兆数忠实复现(拨判读齿轮不再兆变)。
		if(p.pan && typeof p.pan === 'object'){ opts.storedPan = p.pan; }
		return buildWuZhaoSnapshotForFields(buildFieldObject(record), opts);
	}
	case 'shenyishu': {
		const oo = (p.options && typeof p.options === 'object') ? p.options : {};
		const sv = (top, saved)=>(top !== undefined ? top : saved);
		return buildShenYiShuSnapshotForFields(buildFieldObject(record), {
			hourSource: sv(p.hourSource, oo.hourSource),
			manualHour: sv(p.manualHour, oo.manualHour),
			seasonSource: sv(p.seasonSource, oo.seasonSource),
			manualSeason: sv(p.manualSeason, oo.manualSeason),
		});
	}
	case 'guice': {
		// 皇极轨策为问占型(无生时);选项嵌于 payload.options。
		// 🔴 卦自 payload.gua 取、绝不按时重起(重起=伪造一个用户没见过的卦);故须整个 payload 一并递进去。
		const { buildGuiceSnapshotForCase } = await import(/* webpackChunkName: "guice-main" */ '../../components/guice/GuiceMain');
		return buildGuiceSnapshotForCase(p, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	case 'xiaoliuren': {
		// 小六壬:已存课(payload.nums)优先绝不覆盖;缺课(起课时间/事盘无存)→ 按占时正统起
		// (农历月/日/时支序三数,月上起日日上起时,与页面「按占时」同源 deriveLocalNongli)。
		const { buildXiaoLiuRenSnapshotForCase } = await import(/* webpackChunkName: "xiaoliuren-main" */ '../../components/xiaoliuren/XiaoLiuRenMain');
		let xp = p;
		if(!Array.isArray(p.nums) || p.nums.length !== 3){
			const nl = await deriveNongliForRecord(record);
			if(nl && nl.monthInt && nl.dayInt && nl.hourIdx){ xp = { ...p, nums: [nl.monthInt, nl.dayInt, nl.hourIdx] }; }
		}
		return buildXiaoLiuRenSnapshotForCase(xp, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	case 'xiaochengtu': {
		// 小成图:已存卦(payload.qi)优先绝不重起;缺卦 → 梅花时间卦(年支序+农历月+日 为上数,
		// 加时支序为下数,动爻由总数取)走既有两数式引擎——时间即输入,确定可复算。
		const { buildXiaoChengTuSnapshotForCase } = await import(/* webpackChunkName: "xiaochengtu-main" */ '../../components/xiaochengtu/XiaoChengTuMain');
		let cp = p;
		if(!p.qi || !p.qi.ben){
			const nl = await deriveNongliForRecord(record);
			if(nl && nl.monthInt && nl.dayInt && nl.hourIdx && nl.yearZhiIdx){
				const upNum = nl.yearZhiIdx + nl.monthInt + nl.dayInt;
				const loNum = upNum + nl.hourIdx;
				const { qiGuaByNumbers } = await import(/* webpackChunkName: "xiaochengtu-main" */ '../../components/xiaochengtu/core/xiaochengtuQiGua');
				const qi = qiGuaByNumbers({ upNum, loNum });
				// 保留现法,快照首行如实说明(页面五种起法无此法,不是梅花时间卦)
				if(qi){ cp = { ...p, qi, qiSource: 'timepoint' }; }
			}
		}
		return buildXiaoChengTuSnapshotForCase(cp, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	case 'feigong': {
		// 飞宫:已存局(payload.qiZhi)优先绝不覆盖;缺局 → 按占时支起局(页面「按占时」同源),
		// 日干支随占日(河魁天罡口径依赖日干支)。
		const { buildFeiGongSnapshotForCase } = await import(/* webpackChunkName: "feigong-main" */ '../../components/feigong/FeiGongMain');
		let fp = p;
		if(!fp.qiZhi){
			const nl = await deriveNongliForRecord(record);
			if(nl && nl.hourZhi){ fp = { ...p, qiZhi: nl.hourZhi, dayGan: nl.dayGan, dayZhi: nl.dayZhi }; }
		}
		return buildFeiGongSnapshotForCase(fp, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	case 'geomancy':
		// 地占为问占型(无生时);选项嵌于 payload.options,builder 缺则回退已存 case。
		// 无头只认记录自身 options,缺问句返空,不读页面当前事盘(见 GeomancyMain noPageFallback 注)。
		return buildGeomancySnapshotForFields(buildFieldObject(record), { ...((p.options && typeof p.options === 'object') ? p.options : p), noPageFallback: true });
	case 'tarot': {
		// 塔罗为问占型(无生时);牌面由 deckId/spreadType/seed 冻结,齿轮只动判读层。
		// 齿轮扁平键落 p.options 顶层,须提升进 settings 对象(engine buildReading 只读 settings.*);
		// 1/0 三态齿轮值归一为布尔。
		const to = (p.options && typeof p.options === 'object') ? p.options : p;
		// TP9 判读齿轮扩容(与 techniqueMountSettings.tarot.fields 一一对应;牌面键恒不入):
		const liftKeys = [
			'meaningSystem', 'reversalMode', 'variant', 'verdictMode', 'dignities', 'suitElementSwap',
			'quintMode', 'edVersion', 'ookTable', 'astroModern', 'timingMethod', 'timingUnit',
			'courtElementSystem', 'courtZodiacSystem', 'crossingUpright',
		];
		const boolKeys = ['dignities', 'suitElementSwap', 'astroModern', 'crossingUpright'];
		const lift = {};
		liftKeys.forEach((k)=>{
			const v = to[k];
			if(v === undefined || v === null || v === ''){ return; }
			lift[k] = boolKeys.includes(k) ? (v === 1 || v === '1' || v === true) : v;
		});
		const tOpts = Object.keys(lift).length
			? { ...to, settings: { ...((to.settings && typeof to.settings === 'object') ? to.settings : {}), ...lift } }
			: to;
		// 无头只认被挂载记录自身的牌面(seed);缺 seed 的旧档 → ''(missing),绝不回落页面当前事盘。
		return buildTarotSnapshotForFields(buildFieldObject(record), { ...tOpts, noPageFallback: true });
	}
	case 'lingqi': {
		// 灵棋经为问占型(无生时);卦=冻结棋数自 payload.counts 取、绝不按时重掷(「不可再擲」)。
		// 🔴 AI 核只 import 轻文件 lingqiSnapshot(纯函数+数据),不 import LingQiMain 组件(chunk 回灌案口径)。
		const { buildLingqiSnapshotForCase } = await import(/* webpackChunkName: "lingqi-snapshot" */ '../../components/lingqi/lingqiSnapshot');
		return buildLingqiSnapshotForCase(p, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	default:
		return '';
	}
}

// 六爻齿轮扁平键(payload.liuyaoSettings.<flat>)→ 嵌套 liuyaoSettings 合并:
// 存档 gua.liuyaoSettings 打底,齿轮覆盖;shensha 三键/shenshaEx 开关折回嵌套形。
// 只动登记键,未动键随档原样 —— 与页面 normalizeLiuyaoSettings 消费同构。
export function mergeLiuyaoGearSettings(saved, flat){
	const f = flat && typeof flat === 'object' ? flat : {};
	if(!Object.keys(f).some((k)=>f[k] !== undefined)){
		return saved && typeof saved === 'object' ? { ...saved } : {};
	}
	let base = normalizeLiuyaoSettings(saved && typeof saved === 'object' ? saved : null);
	// 齿轮「流派」与页面 changeLiuyaoPreset 同律:选中的预设与存档流派不同 → 以 applyPreset(该派) 为底,
	// 其余齿轮键再逐项叠上(顺序=页面「先选派、后调项」)。
	// 占测事项 / 用神手选 / 本命年支是这一卦的事实,换派也不改(页面上新派会把占测事项设成「自身」,
	//   挂载这里若照搬,抽屉里显示的仍是存档值、快照却按「自身」出,而且改回原值也不生效)。
	if(f.school !== undefined && f.school !== base.school){
		if(LIUYAO_PRESETS[f.school]){
			const caseInputs = {};
			['askType', 'yongOverride', 'benming'].forEach((k)=>{ if(base[k] !== undefined){ caseInputs[k] = base[k]; } });
			base = { ...applyLiuyaoPreset(f.school, base), ...caseInputs };
		}else{
			base = { ...base, school: f.school };
		}
	}
	// 白名单 schema 驱动(TECHNIQUE_SETTINGS_SCHEMA.sixyao):布尔型按 field.type 归一,神煞三键折进 shensha 嵌套对象。
	// 其余齿轮键逐项按页面 setOption 落 —— 偏离所选预设即标「自定义」(此前单改卦身仍自称「增删卜易」);
	// 神煞以合并后的值为底(此前取旧存档,换派后预设里的神煞丢了)
	const sixyaoSchema = getTechniqueSettingsSchema('sixyao');
	const structural = ['shenshaOn', 'shenshaBase', 'shenshaSet', 'shenshaExOn'];
	const schemaFields = (sixyaoSchema && Array.isArray(sixyaoSchema.fields)) ? sixyaoSchema.fields : [];
	schemaFields.forEach((field)=>{
		const k = field.name;
		if(k === 'school' || structural.indexOf(k) >= 0 || f[k] === undefined){
			return;
		}
		const v = (field.type === 'switch' || typeof field.default === 'boolean') ? (f[k] === true || f[k] === 1 || f[k] === '1') : f[k];
		base = setLiuyaoOption(base, k, v);
	});
	if(f.shenshaOn !== undefined || f.shenshaBase !== undefined || f.shenshaSet !== undefined){
		base = setLiuyaoOption(base, 'shensha', {
			...(f.shenshaOn !== undefined ? { on: (f.shenshaOn === true || f.shenshaOn === 1 || f.shenshaOn === '1') } : {}),
			...(f.shenshaBase !== undefined ? { base: f.shenshaBase } : {}),
			...(f.shenshaSet !== undefined && Array.isArray(f.shenshaSet) ? { set: f.shenshaSet.slice() } : {}),
		});
	}
	if(f.shenshaExOn !== undefined){
		base = setLiuyaoOption(base, 'shenshaEx', { on: (f.shenshaExOn === true || f.shenshaExOn === 1 || f.shenshaExOn === '1') });
	}
	return base;
}

// 六爻「时间起卦」——「起课时间」入口 + 已存事盘缺 payload.gua 时走（确定性时间式法、非伪造摇卦，用户拍板放开）。
// 已存 payload.gua 优先、不进此路（在上游 generateCaseTechniqueSnapshot 已处理）。失败(缺时间/历法不全)→优雅返 ''、不崩整个挂载。
// 六爻快照的断语摘要走同步缓存 getDoctrine():页面 mount 会预热,无头(AI 挂载 / 导出)路径此前从不加载 →
//   本会话没开过六爻页时断语行整段静默缺失(quiet missing)。无头路径进 builder 前先 await 一次共享 loader(已载即返)。
async function ensureLiuyaoDoctrineLoaded(){
	try{ await loadLiuyaoDoctrine(); }catch(e){ /* 断语库缺失不阻断快照 */ }
}

// 事盘字段(起课时刻 / 时区 / 经纬 / 日界口径)单源导出:AI 按用户起卦结果无头建事盘时,时间行与农历与挂载同一组字段。
export function buildCaseFieldsForRecord(record){
	return buildCaseSnapshotFields(record || {});
}

// 六爻「按爻起卦」无头成卦 + 快照(AI 按用户亲手摇出 / 报出的结果建事盘):与时间起卦同一合成
// (案例字段 / 农历 / 断语库 / 快照构造),爻源换成用户给的六爻;判读设置取六爻页保存的设置(与用户在页面上起卦同口径)。
// 农历取不到 / 爻不合法 → null(调用方报码,绝不造卦)。
export async function buildSixyaoCaseFromLines(record, lines, moving){
	await ensureLiuyaoDoctrineLoaded();
	const rec = record || {};
	let nongli = null;
	try{ nongli = await fetchPreciseNongli(buildCaseSnapshotParams(rec)); }catch(e){ nongli = null; }
	if(!nongli){ return null; }
	const base = buildLinesGua(lines, moving, nongli);
	if(!base){ return null; }
	const gua = { ...base, guaOrigin: 'cast', liuyaoSettings: normalizeLiuyaoSettings(loadPersistedLiuyaoSettings()) };
	const snapshot = buildGuaSnapshotText(buildCaseSnapshotFields(rec), gua);
	return snapshot ? { gua, snapshot } : null;
}

async function regenerateSixyaoSnapshot(record, gearFlat){
	await ensureLiuyaoDoctrineLoaded();
	try{
		const fields = buildCaseSnapshotFields(record);
		// 占时时间算法随事盘(页面随左栏 / 全局取农历,Q-390 A);此前不带 → 恒真太阳时
		const params = buildCaseSnapshotParams(record, null, { withTimeAlg: true });
		const nongli = await fetchPreciseNongli(params);
		if(!nongli){
			return '';
		}
		const gua = buildTimeGua(nongli);
		if(!gua){
			return '';
		}
		// 齿轮判读设置注入(buildTimeGua 不含 liuyaoSettings → 曾恒全默认且无处可设)。
		const st = (gearFlat && typeof gearFlat === 'object' && Object.keys(gearFlat).length)
			? { ...gua, liuyaoSettings: mergeLiuyaoGearSettings(gua.liuyaoSettings || {}, gearFlat) }
			: gua;
		return buildGuaSnapshotText(fields, st);
	}catch(e){
		return '';
	}
}
