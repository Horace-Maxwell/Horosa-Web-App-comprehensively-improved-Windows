// AI 分析挂载上下文 · 卜类无头重算(一):三式回落快照、六壬天将与无头起课、金口诀、奇门、太乙、三式合一。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import request from '../request';
import * as Constants from '../constants';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../dayBoundary';
import { fetchPreciseNongli } from '../preciseCalcBridge';
import { buildLocalJieqiYearSeed } from '../localNongliAdapter';
import { calcDunJia, buildDunJiaSnapshotText, migrateLegacyQimenSchool } from '../../components/dunjia/DunJiaCalc';
import {
	parseSnapshotSections as parseSanshiSnapshotSections, SANSHI_TAIYI_SECTION_TITLES, SANSHI_QIMEN_EXTRA_SECTIONS,
	SANSHI_LIURENG_DUANGUA_SECTIONS,
} from '../../components/sanshi/sanshiSnapshotSections';
import { fetchTaiyiPan, buildTaiyiSnapshotText } from '../../components/taiyi/TaiYiCalc';
import { applyTaiyiSchool, isDefaultSchool, DEFAULT_TAIYI_SCHOOL } from '../../components/taiyi/core/taiyiSchool';
import { buildJinKouData } from '../../components/jinkou/JinKouCalc';
import { resolveJinKouDiFen } from '../../components/jinkou/JinKouState';
import { buildLiuRengSnapshotText } from '../../components/lrzhan/LiuRengMain';
import {
	buildJinKouSnapshotText, deriveBenMingFromRunYear as deriveJinkouBenMing,
	deriveXuSuiFromRunYear as deriveJinkouXuSui,
} from '../../components/jinkou/JinKouMain';
import { resolveZhangshengElem, DEFAULT_QIMEN_OPTIONS, DEFAULT_TAIYI_OPTIONS } from './catalog';
import { buildCaseSnapshotFields, buildCaseSnapshotParams, getCaseGenderLabel } from './recordFields';
import { toSlashDate } from '../dateStrSafe';

export function buildSanshiUnifiedFallbackSnapshot(record, payload){
	const result = payload && payload.result ? payload.result : {};
	const sections = [];
	if(result.liureng){
		const liurengText = buildLiuRengSnapshotText(
			buildCaseSnapshotParams(record),
			result.liureng,
			null,
			null,
			2,
			'土',
			record && record.gender !== undefined && record.gender !== null ? record.gender : 1
		);
		if(liurengText){
			sections.push(`[大六壬]\n${liurengText}`);
		}
	}
	if(result.dunjia){
		const qimenText = buildDunJiaSnapshotText(result.dunjia);
		if(qimenText){
			sections.push(`[奇门遁甲]\n${qimenText}`);
		}
	}
	if(result.taiyi){
		const taiyiText = buildTaiyiSnapshotText(result.taiyi);
		if(taiyiText){
			sections.push(`[太乙]\n${taiyiText}`);
		}
	}
	if(result.keData || result.sanChuan){
		sections.push('[三式合一结构化数据]\n' + JSON.stringify({
			options: payload && payload.options ? payload.options : {},
			result: payload && payload.result ? payload.result : {},
		}, null, 2));
	}
	return sections.join('\n\n').trim();
}

async function requestLiurengGods(record, options){
	const fields = buildCaseSnapshotFields(record);
	// 起课时间算法随齿轮/存档透传(缺省 0=真太阳时=后端历来口径,字节零回归);
	// 不带则无头重算恒按真太阳时,与页面选了「直接时间」的盘分叉。
	const _tAlg = (options && (options.timeAlg === 1 || options.timeAlg === '1')) ? 1 : 0;
	const params = {
		ad: fields.ad.value,
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm'),
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		after23NewDay: fields.after23NewDay.value,
		lateZiHourUseNextDay: fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined ? fields.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
		timeAlg: _tAlg,
	};
	const data = await request(`${Constants.ServerRoot}/liureng/gods`, {
		body: JSON.stringify(params),
		silent: true,
		timeoutMs: 45000,
	});
	const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
	if(!result || !result.liureng){
		return null;
	}
	return {
		params,
		liureng: result.liureng,
	};
}

// 无头重算的 castOpts 单源(导出供合同测试锁):除齿轮/存档 12 项外,补 solarYear(换将岁差、
// 公历年)与 benmingZhi/xingnianZhi(起课法「九-十二客/行年加时/本命加时」六法所需;存档自 clickSaveCase 带,
// 缺席按 record.divTime 年份兜底 solarYear、本命/行年支留空=builder 回退正时正将并在快照自陈)。
export function liurengHeadlessCastOpts(options, record){
	const o = options && typeof options === 'object' ? options : {};
		let solarYear = Number(o.solarYear);
	if(!Number.isFinite(solarYear) || !solarYear){
		const m = `${(record && (record.divTime || record.birth)) || ''}`.match(/^(-?\d+)-/);
		solarYear = m ? Number(m[1]) : undefined;
	}
	return {
		castMethod: o.castMethod,
		xuanShiZhi: o.xuanShiZhi,
		yanShuNum: o.yanShuNum,
		yueJiangMethod: o.yueJiangMethod,
		fenZhouYe: o.fenZhouYe,
		seHaiMethod: o.seHaiMethod,
		seHaiBoundary: o.seHaiBoundary,
		shiRuKe: o.shiRuKe,
		yearShenShaSort: o.yearShenShaSort,
		yinyangSystem: o.yinyangSystem,
		tuWangShuai: o.tuWangShuai,
		zhanCategory: o.zhanCategory,
		...(solarYear ? { solarYear } : {}),
		...(o.benmingZhi ? { benmingZhi: o.benmingZhi } : {}),
		...(o.xingnianZhi ? { xingnianZhi: o.xingnianZhi } : {}),
	};
}

// 六壬/金口诀无头共用:/liureng/gods 回包缺 objects(月将=太阳座)/isDiurnal(昼夜)时补一份 /chart;取不到退回原包。
export async function ensureLiurengChartObjects(result){
	const base = result && result.liureng ? result.liureng : null;
	if(!base){ return null; }
	if(Array.isArray(base.objects) && base.objects.length && base.isDiurnal !== undefined && base.isDiurnal !== null){
		return base;
	}
	try{
		const p = result.params || {};
		const chartParams = { ...p, date: toSlashDate('' + (p.date || '')), hsys: 0, zodiacal: 0, cid: null };
		const co = await request(`${Constants.ServerRoot}/chart`, { body: JSON.stringify(chartParams), silent: true });
		const r = co && co[Constants.ResultKey] ? co[Constants.ResultKey] : null;
		const inner = r && r.chart ? r.chart : r;
		if(inner && Array.isArray(inner.objects)){
			return { ...base, objects: (Array.isArray(base.objects) && base.objects.length) ? base.objects : inner.objects,
				isDiurnal: (base.isDiurnal !== undefined && base.isDiurnal !== null) ? base.isDiurnal : inner.isDiurnal };
		}
	}catch(e){ /* 取不到则退回原包 */ }
	return base;
}

export async function regenerateLiurengSnapshot(record, options, runyear){
	// 起课时间算法进无头重算(金口诀那路按自己的「时间基准」取,见 regenerateJinkouSnapshot)。
	const result = await requestLiurengGods(record, options);
	if(!result || !result.liureng){
		return '';
	}
	// AI 挂载「每技法设置」:起课法/换将/分昼夜/贵人/五行经 options 透传（缺省=现状）。
	const o = options && typeof options === 'object' ? options : {};
	const castOpts = liurengHeadlessCastOpts(o, record);
	const guirengType = (o.guireng !== undefined && o.guireng !== null) ? o.guireng : 2;
	const zhangshengElem = resolveZhangshengElem(o.wuxing, result.liureng);
	// buildLiuRengSnapshotText 内部用 chartObj 经 buildLiuRengLayout 算「天地盘/四课/三传」——
	// 需 chartObj.nongli.time + nongli.dayGanZi + objects(月将=太阳座) + isDiurnal。
	// 旧实现第 4 参传 null → 布局为空 → 起课时间/三式合一的大六壬不出。修法：以 result.liureng 为底，
	// 若缺 objects 则补一份 /chart（含太阳座与昼夜）。
	const chartObj = await ensureLiurengChartObjects(result);
	return buildLiuRengSnapshotText(
		result.params,
		result.liureng,
		runyear || null,
		chartObj,
		guirengType,
		zhangshengElem,
		record && record.gender !== undefined && record.gender !== null ? record.gender : 1,
		castOpts
	);
}

export async function regenerateJinkouSnapshot(record, payload){
	// 取四柱 / 占时的时间算法随「时间基准」(齿轮覆盖 > 存档;缺省直接时间),与页面同一口径
	const _jkBasis = payload && payload.timeBasis ? `${payload.timeBasis}` : 'direct';
	const result = await requestLiurengGods(record, { timeAlg: _jkBasis === 'trueSolar' ? 0 : 1 });
	if(!result || !result.liureng){
		return '';
	}
	const timeText = result.liureng && result.liureng.nongli ? result.liureng.nongli.time : '';
	// 贵神昼夜:页面按真实地平(castIsDiurnal:与起课同一时刻的参照盘的昼夜),无头此前恒 null → 按时支粗判。
	// 与六壬分支同款:/liureng/gods 回包缺 isDiurnal 时补一份 /chart 取 isDiurnal(取不到才留 null=旧兜底)。
	const lrChart = await ensureLiurengChartObjects(result);
	const jkIsDiurnal = (lrChart && lrChart.isDiurnal !== undefined && lrChart.isDiurnal !== null) ? !!lrChart.isDiurnal : null;
	const diFen = resolveJinKouDiFen(
		payload && payload.diFen,
		false,
		timeText,
		!!(payload && payload.diFen)
	);
	// 十二长生五行:页面缺省随日干五行(state.wuxingAuto),此前无头兜底写死「土」→
	// 日干非土时「起课时间」挂载与页面两张表。'auto'/缺省 → 按本课日干现算(与页面 requestGods 同源口径);
	// 存档事盘恒带页面当时已解析的具体五行,不走此分支。
	const _jkWuxing = resolveZhangshengElem(payload && payload.wuxing, result.liureng);
	const jinkouData = buildJinKouData(result.liureng, {
		diFen,
		// 金口诀贵神兜底 = 0（六壬法）=== JinKouMain state + schema 默认；原写死 2（星占法）会与齿轮显示的「六壬法(默认)」对不上。
		guirengType: payload && payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 0,
		isDiurnal: jkIsDiurnal,
		// AI 挂载「每技法设置」:月将/占时经 payload 透传（缺省=自动取，buildJinKouData 内部按节气/时支兜底=现状）。
		yueJiang: payload && payload.yueJiang,
		zhanShi: payload && payload.zhanShi,
		// 流派/盘式透传（缺省=默认派=现状,零回归）。
		schoolYueJiang: payload && payload.schoolYueJiang,
		schoolGuiTable: payload && payload.schoolGuiTable,
		schoolGuiPan: payload && payload.schoolGuiPan,
		panShi: payload && payload.panShi,
		soilChangSheng: payload && payload.soilChangSheng,
		wuxing: _jkWuxing,
		// 专题起式/行年旬法透传（缺省=不选=整段不产=现状,零回归）。
		topicKey: payload && payload.topicKey,
		shiJianKind: payload && payload.shiJianKind,
		// 合占扣题(所问类别/问事时段):builder 据此产 [合占扣题与内外] 段 —— 🔴 曾漏枚举,
		// 改任一齿轮项即令该段回落「未限定/常规」。缺省 undefined = builder 兜底(现状)。
		askKey: payload && payload.askKey,
		timeScope: payload && payload.timeScope,
		// 本命属相/行年虚岁:有存档 runyear(问测人出生档派生)则随档回放,与 case 分支同律;
		// 无档(起课时间纯时点)才留空 —— 专题引擎照实提示「需填属相」,不臆造。
		benMing: deriveJinkouBenMing(payload && payload.runyear),
		birthGanZi: (payload && payload.runyear && payload.runyear.birthGanZi) || '',
		gender: record && record.gender !== undefined && record.gender !== null ? record.gender : 1,
		age: deriveJinkouXuSui(payload && payload.runyear),
	});
	return buildJinKouSnapshotText(
		result.params,
		result.liureng,
		null,
		jinkouData,
		_jkWuxing,
		payload && payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 0,
		record && record.gender !== undefined && record.gender !== null ? record.gender : 1
	);
}

// AI 快照重算奇门的节气种子上下文(本地全24节气,确定性、无需后端):
// 日家(节气三元60日块)/茅山(精确交节)/置闰·无闰(超神接气)/飞盘·混合(短路本地)皆依赖此种子;
// 此前传空 {} 致这些族/法在 AI 挂载快照里 局算错(退拆补/退夏至)。引擎对本地↔后端两种冬至约定不敏感(dayJiaHalfYear 按实际年取),故本地种子可靠。
function buildQimenSeedContext(fields){
	try {
		const dv = fields && fields.date && fields.date.value;
		const zone = (fields && fields.zone && fields.zone.value) || '+08:00';
		const year = dv ? Number(dv.format('YYYY')) : NaN;
		if(!year || Number.isNaN(year)){
			return {};
		}
		const jieqiYearSeeds = {};
		[year - 1, year, year + 1].forEach((y)=>{
			const seed = buildLocalJieqiYearSeed(y, zone);
			if(seed){
				jieqiYearSeeds[y] = seed;
			}
		});
		return { jieqiYearSeeds };
	} catch(e){
		return {};
	}
}

export async function regenerateQimenSnapshot(record, payload){
	// 兼容事盘(payload.options/faRelatedPeople)与命盘(payload.qimen.{options,faRelatedPeople})两种结构。
	const qs = payload && payload.qimen && typeof payload.qimen === 'object' ? payload.qimen : payload;
	const chartShape = qs !== payload;
	// 命盘结构(奇门页存成命盘)没有起课时刻:按出生时刻起局(此前退到 updateTime = 记录最后修改的时刻)
	const rec = chartShape && record && !record.divTime && record.birth ? { ...record, divTime: record.birth } : record;
	const fields = buildCaseSnapshotFields(rec);
	// 日界/晚子时齿轮(merged payload.options)同源进四柱农历——局与日柱不再分叉。
	// 命盘结构下存档设置在 payload.qimen.options、齿轮覆盖在 payload.options:取农历也叠齿轮(与下方排局同一份)
	const qsBase = qs && qs.options && typeof qs.options === 'object' ? qs.options : qs;
	const gearOpt = chartShape && payload && payload.options && typeof payload.options === 'object' ? payload.options : null;
	// 起课时间算法随齿轮 / 存档(此前不带 → 恒按真太阳时取农历,快照写「直接时间」、四柱与局却按真太阳时)
	const params = buildCaseSnapshotParams(rec, gearOpt ? { ...(qsBase || {}), ...gearOpt } : qsBase, { withTimeAlg: true });
	const nongli = await fetchPreciseNongli(params);
	if(!nongli){
		return '';
	}
	// 直接时间档下农历的 birth 是钟表时 → 像页面一样另取一次真太阳时只作显示(DunJiaMain.resolveDisplaySolarTime 同口径)
	let displaySolarTime = nongli.birth;
	if(Number(params.timeAlg || 0) !== 0){
		try{
			const solar = await fetchPreciseNongli({ ...params, timeAlg: 0 });
			if(solar && solar.birth){ displaySolarTime = solar.birth; }
		}catch(e){ /* 显示用真太阳时取不到:沿用主请求 */ }
	}
	const options = {
		...DEFAULT_QIMEN_OPTIONS,
		// 日界两键**现取**全局:DEFAULT_QIMEN_OPTIONS 是模块顶层常量(import 时求值一次),
		//   而同一份快照的 nongli 参数是实时取「齿轮 → 记录 → 当前全局」—— 会话内改过全局日界后,
		//   23 时段的置闰局查表键进位与时柱进位口径会与同快照里的日柱分叉。存档/齿轮显式带值时仍优先。
		after23NewDay: defaultAfter23NewDay(),
		lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		// 局与农历同一时间算法:存档选项没写时随记录 / fieldSnapshot(与取农历的 params 同一来源)
		timeAlg: params.timeAlg !== undefined ? params.timeAlg : DEFAULT_QIMEN_OPTIONS.timeAlg,
		...(qs && qs.options ? qs.options : {}),
		// 存成命盘的盘类恒为命局(页面载入即命局;早先存的没记这一项),齿轮可再改
		...(chartShape && !(qs && qs.options && qs.options.chartCategory) ? { chartCategory: 'ming' } : {}),
		// 命盘结构(设置在 payload.qimen.options)下,齿轮覆盖合并在 payload.options:叠在存档设置之上(此前被忽略)
		...(gearOpt || {}),
	};
	// 旧存「阴盘」盘式 → 转盘 + 阴盘起局(与奇门页 / 三式合一页载档同一迁移,单源 migrateLegacyQimenSchool)
	Object.assign(options, migrateLegacyQimenSchool(options));
	// 🔴 sex 曾不在 DEFAULT 也不在起课时间源 → SEX_OPTIONS 查无 undefined,快照输出「命式：undefined」。
	// 兜底随记录性别(1 男/0 女,与 DunJiaCalc.SEX_OPTIONS 同域);存档带 sex 则原样优先。
	if(options.sex === undefined || options.sex === null || options.sex === ''){
		const g = record && record.gender;
		options.sex = (g === 0 || g === '0' || g === '女') ? 0 : 1;
	}
	const pan = calcDunJia(fields, nongli, options, { ...buildQimenSeedContext(fields), displaySolarTime });
	// 显式还原相关人员(空[]也算显式、覆盖全局兜底)，使八门化气大阵生年干随已存记录一致(AI 挂载/储存四同步)。
	pan.faRelatedPeople = qs && Array.isArray(qs.faRelatedPeople) ? qs.faRelatedPeople : [];
	return buildDunJiaSnapshotText(pan);
}

export async function regenerateTaiyiSnapshot(record, payload){
	const fields = buildCaseSnapshotFields(record);
	// 同 qimen:日界齿轮同源进四柱。
	const tyOpt = payload && typeof payload === 'object' ? (payload.options && typeof payload.options === 'object' ? payload.options : payload) : null;
	const params = buildCaseSnapshotParams(record, tyOpt);
	const nongli = await fetchPreciseNongli(params);
	if(!nongli){
		return '';
	}
	const options = {
		...DEFAULT_TAIYI_OPTIONS,
		// 同 qimen:日界两键现取全局缺省(存档/齿轮显式带值时仍优先)。
		after23NewDay: defaultAfter23NewDay(),
		lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		...(payload && payload.options ? payload.options : {}),
	};
	const po = payload && payload.options && typeof payload.options === 'object' ? payload.options : {};
	// 🔴 三式合一存档用 taiyiStyle/taiyiAccum/taiyiSchool(且 options.school 被奇门盘式字符串占用)——
	// 曾直读 style/tn/school → 存过的三式合一事盘太乙盘式/古法公式/流派挂载重算全落默认。
	if(po.style === undefined && po.taiyiStyle !== undefined){ options.style = po.taiyiStyle; }
	if(po.tn === undefined && po.taiyiAccum !== undefined){ options.tn = po.taiyiAccum; }
	if(po.timeBasis === undefined && po.taiyiTimeBasis !== undefined){ options.timeBasis = po.taiyiTimeBasis; }   // 三式太乙区时间基准
	// 流派六轴组装:对象源(独立太乙 school / 三式 taiyiSchool) + 齿轮扁平键(school_* / taiyiSchool_*)覆盖。
	{
		let school = null;
		if(po.taiyiSchool && typeof po.taiyiSchool === 'object'){ school = { ...po.taiyiSchool }; }
		else if(po.school && typeof po.school === 'object'){ school = { ...po.school }; }
		const axes = ['jishen', 'wenchang', 'keJianChen', 'sanji', 'youshen', 'shijiCoord'];
		const flat = {};
		axes.forEach((k)=>{
			const v = po['school_' + k] !== undefined ? po['school_' + k] : po['taiyiSchool_' + k];
			if(v !== undefined && v !== null && v !== ''){ flat[k] = v; }
		});
		if(Object.keys(flat).length){ school = { ...(school || {}), ...flat }; }
		if(school){ options.school = school; }
		else if(typeof options.school === 'string'){ options.school = { ...DEFAULT_TAIYI_SCHOOL }; } // 撞键防御:奇门'转盘'串进来时回默认对象
	}
	// sex 域归一:三式合一存 1/0(与奇门共键),独立太乙/后端吃 '男'/'女'。
	if(options.sex === 1 || options.sex === '1'){ options.sex = '男'; }
	else if(options.sex === 0 || options.sex === '0'){ options.sex = '女'; }
	if(!options.sex){
		options.sex = getCaseGenderLabel(record);
	}
	let pan = await fetchTaiyiPan(fields, nongli, options);
	// 🔴 与 live TaiYiMain.recalc 同口径:非默认流派须在起盘后覆盖(几何重算主客算/神煞),
	//    否则存过的非默认事盘 AI 重生成静默丢覆盖层(实测坑修复)。默认=空操作字节不变。
	if(pan && options.school && !isDefaultSchool(options.school)){
		try{ pan = applyTaiyiSchool(pan, options.school).pan; }catch(e){ /* 覆盖失败回退原盘 */ }
	}
	return buildTaiyiSnapshotText(pan);
}

export async function regenerateSanshiUnifiedSnapshot(record, payload){
	// 六壬子组:挂载齿轮的合并选项落在 payload.options(optionsPath:'options');regenerateLiurengSnapshot 读 options.*
	// (castMethod/guireng/wuxing/换将/分昼夜/选时/演数)。原先此处没传 → 三式合一的大六壬永远默认盘(C-❌2 缺口)。
	// 三式合一的六壬层锁「正时正将」(页面不出起课法 / 选时 / 演数):重算同锁,不按存档 / 齿轮里别的起课法出页面出不了的盘
	// 占事类型 / 十二长生页面同样不设:占事类型不带(= 页面),十二长生维持此前的「土」(三式合一挂载内容不因六壬缺省改随日干而变)
	const sanshiLrOpts = { ...((payload && payload.options) || {}), castMethod: 'zheng', xuanShiZhi: undefined, yanShuNum: undefined, zhanCategory: undefined, wuxing: '土' };
	const [liurengText, qimenText, taiyiText] = await Promise.all([
		regenerateLiurengSnapshot(record, sanshiLrOpts, payload && payload.runyear),
		regenerateQimenSnapshot(record, payload),
		regenerateTaiyiSnapshot(record, payload),
	]);
	// [制度化] 🔴 与 live 页 buildSanShiUnitedSnapshotText 同源的挑段/前缀规则(sanshiSnapshotSections 单源):
	// 此前三大全文按 [大六壬][奇门遁甲][太乙] 整篇嵌套 → 内嵌段头(盘型/全局速览…)被解析成独立段,
	// 与 AI_EXPORT_PRESET_SECTIONS.sanshiunited 段名全失配 —— 自定义过三式段勾选的用户,
	// 挂载重算内容被段过滤错杀/漏杀(全技法段登记哨兵抓获)。现:挑段按单源段单以前缀重发,
	// 其余段的段头降格为「■段名」文本行并入各自顶段(风水包段先例;信息零丢失、段名恒 ⊆ preset)。
	const flattenInto = (topTitle, fullText, pickTitles, prefix)=>{
		const txt = `${fullText || ''}`.trim();
		if(!txt){ return []; }
		const map = parseSanshiSnapshotSections(txt);
		const picked = new Set(pickTitles || []);
		const bodyLines = [];
		const lead = txt.split('\n');
		// 无 [] 段结构的整文(如奇门金函形态)兜底:整文进顶段
		if(!Object.keys(map).length){
			return [`[${topTitle}]`, ...lead, ''];
		}
		// 段外前导行(首个段头前)先入顶段
		for(let i = 0; i < lead.length; i++){
			if(/^\[.+\]$/.test(lead[i].trim())){ break; }
			bodyLines.push(lead[i]);
		}
		Object.keys(map).forEach((title)=>{
			if(picked.has(title)){ return; }
			bodyLines.push(`■ ${title}`);
			bodyLines.push(...map[title]);
		});
		while(bodyLines.length && bodyLines[0] === ''){ bodyLines.shift(); }
		const out = [`[${topTitle}]`, ...bodyLines, ''];
		(pickTitles || []).forEach((title)=>{
			const body = map[title];
			if(!body || !body.length){ return; }
			out.push(`[${prefix || ''}${title}]`, ...body, '');
		});
		return out;
	};
	const lines = [
		...flattenInto('大六壬', liurengText, SANSHI_LIURENG_DUANGUA_SECTIONS, ''),
		...flattenInto('奇门遁甲', qimenText, SANSHI_QIMEN_EXTRA_SECTIONS, '奇门'),
		...flattenInto('太乙', taiyiText, SANSHI_TAIYI_SECTION_TITLES, '太乙'),
	];
	if(lines.length){
		return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
	}
	return buildSanshiUnifiedFallbackSnapshot(record, payload || {});
}
