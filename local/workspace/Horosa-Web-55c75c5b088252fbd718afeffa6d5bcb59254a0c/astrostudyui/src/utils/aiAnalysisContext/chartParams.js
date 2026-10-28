// AI 分析挂载上下文 · 命盘起盘参数:八字 / 紫微参数与运限、神数各派(正传 / 参评 / 河洛 / 一掌经)快照、按记录取盘。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import { defaultLateZiHourUseNextDay } from '../dayBoundary';
import { mergeOptionsIntoRecord } from '../techniqueMountSettings';
import { fetchChart } from '../../services/astro';
import { ziweiRecordWithDefaults, recordHasZiweiSettingsGen } from '../ziweiRecordSettings';
// parseDateParts:老黄历日课(case 'huangli')那支按 date 串拆年月日用它;
// 此前只调用未导入 → 挂载黄历事盘时抛 ReferenceError(同型问题先例:
// 调用点在运行时闭包里,模块加载与渲染阶段都踩不到)。
import { parseYearFromDateStr } from '../dateStrSafe';
import { ganzhiYearBase } from '../ganzhiYearBase';
import { buildLocalBaziResult, BAZI_ADJUST_JIEQI_SENT } from '../baziLunarLocal';
import { calculate as canpingCalculate, buildSnapshotText as buildCanpingSnapshotText, liunianSeries as canpingLiunianSeries } from '../canpingLocal';
import {
	calculate as heluoCalc, daYun as heluoDaYun, judge as heluoJudge, buildSnapshotText as buildHeluoSnapshotText,
	heluoSolarTermOfDate,
} from '../heluoLocal';
import { buildYizhangjingModel, buildYizhangjingSnapshotText } from '../yizhangjingReport';
import { loadZhengChuanMods } from './catalog';
import { buildFieldObject, fieldParams, kinGenderOverride } from './recordFields';
import { baziOptFromRecord } from '../baziStoredOpt';

// 八字多运限（批A，对称 ziwei）：解析 record 的 liunianSel/liuyueSel/liuriSel/liushiSel 为 number[]。
// 任一非空 → 产出多选 period({liunian,liuyue,liuri,liushi})；buildBaziSnapshotText 据此追加多运限段。
// 全空(默认)→ null → 不挂任何运限段，与现状逐字一致（守「默认即现状」）。
function buildChartBaziPeriodFromRecord(record){
	if(!record || typeof record !== 'object'){
		return null;
	}
	const liunian = pickFiniteNumberArray(record.liunianSel);
	const liuyue = pickFiniteNumberArray(record.liuyueSel);
	const liuri = pickFiniteNumberArray(record.liuriSel);
	const liushi = pickFiniteNumberArray(record.liushiSel);
	if(!liunian.length && !liuyue.length && !liuri.length && !liushi.length){
		return null;
	}
	return { liunian, liuyue, liuri, liushi };
}

// 命盘技法的出生参数（形状对齐各组件 genParams：date 'YYYY-MM-DD' / time 'HH:mm:ss'）。
// 导出供命盘图捕获等模块复用,把 chart record 转成 bazi/ziwei 起盘 params。
export function buildChartBaziParams(record){
	const fields = buildFieldObject(record);
	const params = {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		gender: fields.gender.value,
		timeAlg: fields.timeAlg.value,
		phaseType: fields.phaseType.value,
		godKeyPos: fields.godKeyPos.value,
		// 盘法 4 项:挂载显式设置才改(命宫起法/月律分野/起运精度/藏干版本,与 BaZi.js:767-771 同口径);
		//   缺省取与 BaZi.js 一致的默认 → 默认即现状字节级一致。直接读 record(与 school 同范式,不入 buildFieldObject)。
		// 齿轮没设的项回落八字页保存值(页面起盘读的就是它),再回落缺省 —— 此前只认记录,页面改过盘法的用户 AI 恒按缺省
		minggongMethod: baziOptFromRecord(record, 'minggongMethod', 'tongxing'),
		fenyeVersion: baziOptFromRecord(record, 'fenyeVersion', 'common'),
		southMonth: baziOptFromRecord(record, 'southMonth', 'none'),
		dayunPrecision: baziOptFromRecord(record, 'dayunPrecision', 'precise'),
		cangVersion: baziOptFromRecord(record, 'cangVersion', 'common'),
		after23NewDay: fields.after23NewDay.value,
		lateZiHourUseNextDay: fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined ? fields.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
		adjustJieqi: BAZI_ADJUST_JIEQI_SENT,   // 与八字页同一来源:本地引擎不实现,恒 0(旧记录的 1 不下发)
	};
	// 断命流派:仅挂载侧显式设置时才挂(builder 据此切「当前主用流派」标注),缺省不挂 → 默认 传统综合 = 现状字节级一致。
	// 对称紫微 sihuaSchool;各派对照数据恒全算,此项只切主标注。后端 /bazi/birth 不读该字段,由 buildBaziSnapshotText 本地消费。
	// shenshaGroups(神煞分组显示过滤)有意不入挂载复算:面板快照(第一优先源)已按用户勾选过滤;
	// 复算兜底恒全量=只多不少,AI 无信息丢失。挂载设置=显式声明域,不从面板 localStorage 偏好偷渡。
	// 流派值只认八字的档(平铺键 school 与别的技法同名:别的技法的值不当八字流派);齿轮没设回落八字页保存的流派
	const baziSchool = baziOptFromRecord(record, 'school', undefined);
	if(baziSchool){
		params.school = baziSchool;
	}
	// 年龄口径 / 生肖归属:只作用于快照文字(与页面 snapshotParamsOf 同四项),齿轮没设 → 页面保存值;都没有不挂 = 页面缺省(虚岁 / 立春)
	const ageStyle = baziOptFromRecord(record, 'ageStyle', undefined);
	if(ageStyle){ params.ageStyle = ageStyle; }
	const zodiacBoundary = baziOptFromRecord(record, 'zodiacBoundary', undefined);
	if(zodiacBoundary){ params.zodiacBoundary = zodiacBoundary; }
	// 多运限仅挂载侧显式覆盖时才挂上（builder 据此追加段），缺省不挂 → 默认字节级一致。
	// 注：period 仅供前端本地消费，不发后端（buildBaziSnapshotForParams 起盘 params 不含它，按需单独消费）。
	const period = buildChartBaziPeriodFromRecord(record);
	if(period){
		params.period = period;
	}
	return params;
}

function pickFiniteNumber(value){
	// 空/空串 → null（不算选择）；可解析数字 → 取整；否则 null。空输入被 UI 强转 0 时由各 level 的
	// find-or-首项兜底吸收，绝不抛、绝不留 undefined。
	if(value === undefined || value === null || `${value}` === ''){
		return null;
	}
	const n = Number(value);
	return Number.isFinite(n) ? Math.round(n) : null;
}

// 把 record.* 的「数组 / 逗号分隔串 / 单值」统一解析为去重的有限整数数组（保序）。
// multiselect 草稿是数组；文本年份列表是逗号/空白分隔串；空/坏值 → []（不算选择，守「默认即现状」）。
function pickFiniteNumberArray(value){
	if(value === undefined || value === null){
		return [];
	}
	let raw = value;
	if(!Array.isArray(raw)){
		const s = `${raw}`.trim();
		if(s === ''){
			return [];
		}
		raw = s.split(/[,，\s]+/);
	}
	const out = [];
	const seen = {};
	raw.forEach((item)=>{
		const v = pickFiniteNumber(item);
		if(v === null){
			return;
		}
		if(!seen[v]){
			seen[v] = true;
			out.push(v);
		}
	});
	return out;
}

function buildChartZiweiPeriodFromRecord(record){
	// 多选运限(批A)：把 record 的 daxianSel/liunianSel/liuyueSel/liuriSel/liushiSel 各解析为 number[]。
	// 任一非空 → 产出多选 period({daxian,liunian,liuyue,liuri,liushi})；buildZiweiPeriodLines 据此多段循环。
	// 全空(默认)→ 返回 null → 走原路径(只含本命+大限)，与现状逐字一致(守「默认即现状」)。
	if(!record || typeof record !== 'object'){
		return null;
	}
	const daxian = pickFiniteNumberArray(record.daxianSel);
	const liunian = pickFiniteNumberArray(record.liunianSel);
	const liuyue = pickFiniteNumberArray(record.liuyueSel);
	const liuri = pickFiniteNumberArray(record.liuriSel);
	const liushi = pickFiniteNumberArray(record.liushiSel);
	if(!daxian.length && !liunian.length && !liuyue.length && !liuri.length && !liushi.length){
		return null;
	}
	return { daxian, liunian, liuyue, liuri, liushi };
}

// 盘面截图挂载等按一张记录排紫微时用(与挂载快照同一参数构造,含随盘紫微设置与缺键口径)
export function buildChartZiweiParamsForRecord(record){
	return buildChartZiweiParams(record || {});
}

export function buildChartZiweiParams(rawRecord){
	// 带紫微代次标记的盘:缺的紫微设置 = 存盘时是出厂默认 → 补成默认显式覆盖(否则回落当前全局设置,
	// 与载入该盘后的盘面不一致);无标记的旧盘照旧(缺键回落全局)。
	const ziweiMarked = recordHasZiweiSettingsGen(rawRecord);
	const record = ziweiRecordWithDefaults(rawRecord);
	const fields = buildFieldObject(record);
	const params = {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		gender: fields.gender.value,
		timeAlg: fields.timeAlg.value === 1 ? 1 : 0,
		after23NewDay: fields.after23NewDay.value,
		lateZiHourUseNextDay: fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined ? fields.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
	};
	// 四化流派 + 运限层:仅挂载侧显式覆盖时才挂上(builder 据此切流派/追加[运限]段),缺省不挂 → 默认字节级一致。
	// 注:这两键不是 /ziwei/birth 的后端参数(后端只读上面的起盘字段),由 buildZiweiSnapshotForParams 本地消费。
	if(record && record.sihuaSchool !== undefined && record.sihuaSchool !== null && `${record.sihuaSchool}` !== ''){
		params.sihuaSchool = `${record.sihuaSchool}`;
	}
	// 随盘自定义四化表(JSON 文本):builder 端归一校验后临时注入 ZWSihuaCustom(用毕清),不写本机 LS。
	if(record && record.sihuaCustomTable !== undefined && record.sihuaCustomTable !== null && `${record.sihuaCustomTable}`.trim() !== ''){
		params.sihuaCustomTable = record.sihuaCustomTable;
	}
	// 小限顺逆:record 键名沿用 ziweiXiaoxianYinyang(零孤儿),映射到单例键 xiaoxianMode 经 SWITCH_KEYS 覆盖。
	if(record && record.ziweiXiaoxianYinyang !== undefined && record.ziweiXiaoxianYinyang !== null && `${record.ziweiXiaoxianYinyang}` !== ''){
		params.xiaoxianMode = `${record.ziweiXiaoxianYinyang}`;
	}
	// 随盘自定义亮度表(JSON 文本):同 A4 机制(注入 ZWBrightnessCustom,用毕清)。
	if(record && record.brightnessCustomTable !== undefined && record.brightnessCustomTable !== null && `${record.brightnessCustomTable}`.trim() !== ''){
		params.brightnessCustomTable = record.brightnessCustomTable;
	}
	// 传本/排盘开关:仅挂载侧显式覆盖(非默认,record 里才有)时挂上 → buildZiweiSnapshotForParams 临时切 ZWEngineOptions;
	// 缺省不挂 → builder 回退全局单例 = 现状字节级一致。后端 /ziwei/birth 不读这些键(由本地引擎消费)。
	['daxianSpan', 'tianmaBasis', 'starSet', 'sanPan', 'shangShi', 'leapMonth', 'lateZi', 'yearBoundary', 'huoling', 'kongNaming',
		'brightnessSource', 'lifeMasterBy', 'liuYueBasis', 'liunianSihuaGan', 'changshengStart', 'changshengDirection', 'kuiYue', 'kongwangStyle', 'flowLuanXi', 'flowHuoLing', 'flowShenshaOnChart', 'childLimit', 'zhongxian', 'huoPan', 'qishuWei', 'borrowPalace', 'taiSuiRuGua'].forEach((k)=>{
		if(record && record[k] !== undefined && record[k] !== null && `${record[k]}` !== ''){
			params[k] = record[k];
		}
	});
	// 紫云关系人:record 存字符串(空格/逗号分隔)→ [{branch,role,sex}] 供 taiSuiRuGua 消费。
	// 文法扩展:每项支持 `支[:角色[:性别]]`(如「午:母:female 子」);裸支向后兼容(role/sex 空)。
	// 挂载覆盖路径:schema normalize 已把文本归一成 [{branch,role,sex}] 数组 → 此前 `${数组}` 串化成 [object Object]
	// 再解析=全部剪空 ⇒ 「太岁关系人」齿轮经挂载恒死(直接 record 文本路径正常)。数组形态原样收;字符串照旧解析。
	if(record && Array.isArray(record.taiSuiRelatives)){
		const arr = record.taiSuiRelatives.map((it)=>{
			if(it && typeof it === 'object'){ const b = `${it.branch || ''}`; return ('子丑寅卯辰巳午未申酉戌亥'.indexOf(b) >= 0 && b) ? { branch: b, role: it.role || '', sex: it.sex || '' } : null; }
			const seg = `${it}`.split(/[:：]/); const b = seg[0];
			return ('子丑寅卯辰巳午未申酉戌亥'.indexOf(b) >= 0 && b) ? { branch: b, role: seg[1] || '', sex: seg[2] || '' } : null;
		}).filter(Boolean);
		if(arr.length || ziweiMarked){ params.taiSuiRelatives = arr; }   // 带标记的盘关系人为空 = 显式空(不回落全局)
	}else if(record && record.taiSuiRelatives !== undefined && `${record.taiSuiRelatives}`.trim() !== ''){
		const arr = `${record.taiSuiRelatives}`.split(/[\s,，、]+/).map((tok)=>{
			const seg = `${tok}`.split(/[:：]/);
			const b = seg[0];
			if('子丑寅卯辰巳午未申酉戌亥'.indexOf(b) < 0 || !b){ return null; }
			return { branch: b, role: seg[1] || '', sex: seg[2] || '' };
		}).filter(Boolean);
		if(arr.length){ params.taiSuiRelatives = arr; }
	}
	const period = buildChartZiweiPeriodFromRecord(record);
	if(period){
		params.period = period;
	}
	return params;
}

// 数算（参评数 / 河洛理数）：纯前端。先用本盘出生数据排四柱（buildLocalBaziResult），再喂各自引擎。
// 镜像 HeLuoMain.getModel 的取数口径；缺四柱即返 null → 上层显示「缺失」（不挂空表头）。
function buildChartShusuanBazi(record){
	try{
		const params = buildChartBaziParams(record);
		const bazi = buildLocalBaziResult(params).bazi;
		const fc = (bazi && bazi.fourColumns) || {};
		const gz = (p)=>(p && (p.ganzi || p.ganZhi)) || '';
		const fourPillars = { year: gz(fc.year), month: gz(fc.month), day: gz(fc.day), hour: gz(fc.time) };
		if(!fourPillars.year || !fourPillars.month || !fourPillars.day || !fourPillars.hour){
			return null;
		}
		return {
			fourPillars,
			yearGz: fourPillars.year,
			monthZhi: fourPillars.month.charAt(1),
			dayZhi: fourPillars.day.charAt(1),
			hourZhi: fourPillars.hour.charAt(1),
			// 🔴 干支年基准(非出生公历年):立春前出生者两者差一年,直接用公历年会让
			// 河洛/参评的流年整体错一位。以年柱反推,与页面侧 HeLuoMain/CanPingMain 同源。
			birthYear: ganzhiYearBase(parseYearFromDateStr(`${params.date}`) || 0, fourPillars.year),
			gender: bazi.gender === 'Female' ? '女' : '男',
			// 年柱纳音(河洛 [起卦详情]「五命」行 + 纳音居本位);纯增字段。
			yearNayin: (fc.year && (fc.year.naying || fc.year.nayin)) || '',
			// 神数正传另需农历月/日（起月命数、时命数、人命数）。纯增字段，既有取用面不变。
			lunarMonth: Number((bazi.lunar || bazi.nongli || {}).monthNum || (bazi.lunar || bazi.nongli || {}).month) || 0,
			lunarDay: Number((bazi.lunar || bazi.nongli || {}).dayNum || (bazi.lunar || bazi.nongli || {}).day) || 0,
			isLeapMonth: !!((bazi.lunar || bazi.nongli || {}).isLeap || (bazi.lunar || bazi.nongli || {}).leap),
			// 八字大运真源(lunar-js 节气起运),参评「八字大运法」档注入用。纯增字段。
			direction: Array.isArray(bazi.direction) ? bazi.direction : null,
			// 大定「所推之年」派生虚岁/大运/小运/岁君要读推运表(与页面 deriveDadingYearPillars 同源)。纯增字段。
			mainDirection: Array.isArray(bazi.mainDirection) ? bazi.mainDirection : null,
			smallDirection: Array.isArray(bazi.smallDirection) ? bazi.smallDirection : null,
		};
	}catch(e){
		return null;
	}
}

// AI 挂载抽屉渲染用的只读上下文(以 __ 开头的键,不是 schema 字段:不计覆盖、不下发):齿轮里有些档位要随本盘算出的值才定得下。
// 正传「演算时天象」:演算时辰留空 = 本人时支,只列那一组天象(与神数页同),回显也按它 —— 取的是无头重算同一份四柱。
// draft(抽屉草稿):先按它合进记录再算(抽屉里改了时间算法,本人时支随之变,与应用后重算同口径)
export function mountDraftContextFor(key, record, draft){
	if(key !== 'zhengchuan' || !record || typeof record !== 'object'){ return null; }
	let rec = record;
	if(draft && typeof draft === 'object'){
		try{ rec = mergeOptionsIntoRecord(record, key, draft); }catch(e){ rec = record; }
	}
	const b = buildChartShusuanBazi(rec);
	return b && b.hourZhi ? { __zcOwnHourZhi: b.hourZhi } : null;
}

// 神数正传（数算）：纯前端，按本盘出生四柱起三支之一。
// 挂载齿轮可调 流派/求测时辰/父母年龄/元运/虚岁 → record.* → opts（未改时 undefined，builder 回默认 = 现状）。
// 条文正文库体积大，故 await 动态载入后再建快照（挂载链本就是 async，无首屏代价）。
const ZC_SCHOOLS = ['tieban', 'shaozi', 'dading', 'liuqin', 'xinyi'];
export async function buildZhengChuanSnapshotForRecord(record, opts){
	const o = opts || {};
	const school = ZC_SCHOOLS.indexOf(o.school) >= 0 ? o.school : 'tieban';
	const M = await loadZhengChuanMods();
	// 心易为查询层（古籍未出起数入口）→ 不依赖生辰，须先于下方「无农历即返空」之闸
	if(school === 'xinyi'){
		try{
			const m = M.calcXinyi({
				item: o.item, sound: o.sound, ke: o.ke, gong: o.gong, xqZhi: o.xqZhi, xqYushu: o.xqYushu,
				// 记录 gender 是 0/1(或 '女'/'Female'),此前只认 'Female' → 女命恒按男查表。
				gender: kinGenderOverride(record).gender === '0' ? 0 : 1,
			});
			return M.buildText(m, {}) || '';
		}catch(e){ return ''; }
	}
	const b = buildChartShusuanBazi(record);
	if(!b || !b.lunarMonth || !b.lunarDay){ return ''; }
	const pillars = [b.fourPillars.year, b.fourPillars.month, b.fourPillars.day, b.fourPillars.hour];
	try{
		let model = null;
		let verses = {};
		if(school === 'tieban'){
			model = M.calcTieban({
				yearGz: pillars[0], monthGz: pillars[1], dayGz: pillars[2], hourGz: pillars[3],
				gender: b.gender, lunarMonth: b.lunarMonth, lunarDay: b.lunarDay, isLeapMonth: b.isLeapMonth,
				askGz: o.askGz || pillars[3],
			});
			verses = await M.loadTiebanVerses().catch(()=>({}));
		}else if(school === 'shaozi'){
			model = M.calcShaozi({
				pillars, gender: b.gender, lunarMonth: b.lunarMonth, lunarDay: b.lunarDay, isLeapMonth: b.isLeapMonth,
				fatherAge: Number(o.fatherAge) || 27, motherAge: Number(o.motherAge) || 26, yuan: o.yuan || 'zhong',
			});
			verses = await M.loadShaoziVerses().catch(()=>({}));
		}else if(school === 'liuqin'){
			const hourZhi = pillars[3][1];
			const ask = o.askHourZhi || hourZhi;
			model = M.calcLiuqin({
				pillars, gender: b.gender === '女' ? 0 : 1, lunarMonth: b.lunarMonth, lunarDay: b.lunarDay,
				isLeapMonth: b.isLeapMonth, yearZhi: pillars[0][1], hourZhi,
				yangYear: '甲丙戊庚壬'.indexOf(pillars[0][0]) >= 0,
				askHourZhi: ask, env: o.env || ('卯辰巳午未申'.indexOf(ask) >= 0 ? '晴' : '明'),
			});
		}else{
			// 齿轮「所推之年」(zcDadingYear)此前只透传不消费:页面按所推之年自推运表派生
			// 虚岁/大运/小运/岁君,无头恒回落本命四柱 → 同一年份页面与 AI 大定入参分叉。现与页面同函数派生;
			// 手填者优先(古法特例),无年或年在表外则回落四柱(=此前现状)。
			const derived = (typeof M.deriveDadingYearPillars === 'function')
				? (M.deriveDadingYearPillars({ smallDirection: b.smallDirection, mainDirection: b.mainDirection }, o.dadingYear) || {})
				: {};
			const input = {
				pillars, dayun: o.dayun || derived.dayun || pillars[1], xiaoyun: o.xiaoyun || derived.xiaoyun || pillars[3],
				suijun: o.suijun || derived.suijun || pillars[0], age: Number(o.age) || derived.age || 40,
			};
			const year = M.dadingDeathYear(input);
			model = year ? { school: 'dading', input, year, month: M.dadingDeathMonth(pillars[1], pillars[0][0]), derived } : null;
		}
		return model ? (M.buildText(model, verses) || '') : '';
	}catch(e){
		return '';
	}
}

// opts.method（AI 挂载「每技法设置」）：'ming'(明法,默认) / 'gu'(古法,日支取宫)。
// 缺省/坏值回退 'ming' → 与现状逐字一致(守「默认即现状」)。dayPalace(canpingLocal) 据 method 改命宫取法。
export async function buildCanpingSnapshotForRecord(record, opts){
	const b = buildChartShusuanBazi(record);
	if(!b){ return ''; }
	const method = (opts && opts.method === 'gu') ? 'gu' : 'ming';
	// 挂载复算与页面同构(快照×异步三问自查):此前不传 dayunRule/农历 → 页面选
	// 任何大运档,挂载恒回落默认档+一岁起(「页面对、挂载错」再一例)。现:dayunRule 经挂载
	// 每技法设置透传;农历月日供《参评诀》起运;baziStyle 档注入八字真源 direction(节气起运,
	// 与八字盘/页面侧逐字节同源)。缺省全 undefined=默认档=现状零回归。
	const dayunRule = (opts && ['mingGongQiyun', 'mingGongOne', 'baziStyle'].indexOf(opts.dayunRule) >= 0) ? opts.dayunRule : 'mingGongQiyun';
	let baziYun = null;
	if(dayunRule === 'baziStyle' && Array.isArray(b.direction) && b.direction.length){
		try{
			baziYun = b.direction.map((d)=>{
				const gzd = (d.mainDirect && (d.mainDirect.ganzi || d.mainDirect.ganZhi)) || '';
				return { branch: gzd.charAt(1) || '', ganzi: gzd, ageStart: d.age, ageEnd: d.age + 9, startYear: d.startYear, endYear: d.endYear };
			}).filter((d)=>d.branch);
			if(!baziYun.length){ baziYun = null; }
		}catch(e){ baziYun = null; }
	}
	try{
		const result = canpingCalculate({
			yearGz: b.yearGz,
			monthBranch: b.monthZhi,
			dayBranch: b.dayZhi,
			hourBranch: b.hourZhi,
			gender: b.gender,
			method: method,
			qiyunAge: 1,
			lunarMonth: b.lunarMonth,
			lunarDay: b.lunarDay,
			dayunRule,
			baziYun,
		});
		// 补全生涯流年表:此前不传 liunianRows → result.liunian 恒 null、快照缺整层流年(用户反馈数算缺流年)。
		let liunianRows = null;
		try{
			const series = canpingLiunianSeries({
				yearGz: b.yearGz,
				monthBranch: b.monthZhi,
				dayBranch: b.dayZhi,
				hourBranch: b.hourZhi,
				gender: b.gender,
				method: method,
				qiyunAge: 1,
				birthYear: b.birthYear,
				startAge: 1,
				endAge: 120,
				lunarMonth: b.lunarMonth,
				lunarDay: b.lunarDay,
				dayunRule,
				baziYun,
			});
			liunianRows = (series && series.rows) || null;
		}catch(e){ liunianRows = null; }
		return buildCanpingSnapshotText(result, { liunianRows }) || '';
	}catch(e){
		return '';
	}
}

// 河洛真实节气化工:与河洛页同一份单源 heluoSolarTermOfDate(出生当日所处节气 + 土用 + 三候 → {hg,fh,...});
// 按出生地时区换算后再比节气(东八区不变)。无 lunar 数据 → null(judge 回退 MONTH_HG 月支近似)。
export function heluoSolarTermForDate(dateStr, quHuaGong, zone){
	return heluoSolarTermOfDate(dateStr, zone, quHuaGong);
}

// opts.quHuaGong（AI 挂载「每技法设置」）：'tuWangKunGen'(土王寄坤艮,默认) / 'siFangBoOnly'(直取四方伯)。
// 取化工法只影响真实节气化工（solarTermHuagong）；而本无头 builder 现状给 judge 传 st=null（走 MONTH_HG 月支近似），
// 与主页面 HeLuoMain（用真实节气 st）本就不同。为守「默认即现状」(快照逐字节不变)：
//   - 默认/未覆盖 → 仍传 st=null（MONTH_HG），与现状字节级一致；
//   - 仅当用户显式覆盖 quHuaGong 时 → 据出生公历日算真实节气化工并传入 judge（取化工法在此生效，改 [命运篇] 化工行）。
// 注：覆盖后改用真实节气化工，比 MONTH_HG 更准（与屏显一致），属有意为之；不覆盖则零回归。
export async function buildHeluoSnapshotForRecord(record, opts){
	const b = buildChartShusuanBazi(record);
	if(!b){ return ''; }
	const overrideQuHuaGong = opts && (opts.quHuaGong === 'tuWangKunGen' || opts.quHuaGong === 'siFangBoOnly') ? opts.quHuaGong : null;
	// 分歧法门(挂载 record 覆盖;缺省=引擎默认,与现状字节一致)
	const heluoOpts = {
		ziShuMode: record.ziShuMode || 'pair',
		jiGongMode: record.jiGongMode || 'manualSanYuan',
		zhiZunEnabled: !(record.zhiZunEnabled === 0 || record.zhiZunEnabled === false || record.zhiZunEnabled === '0'),
		pureGanKunVariant: record.pureGanKunVariant || 'current',
		liunianStep2: record.liunianStep2 || 'ying',
		liuYueMode: record.liuYueMode || 'ying',
		huangdiOffset: parseInt(record.huangdiOffset, 10) || 2697,
	};
	try{
		const chart = heluoCalc({
			fourPillars: b.fourPillars,
			gender: b.gender,
			hourZhi: b.hourZhi,
			birthYear: b.birthYear,
			monthZhi: b.monthZhi,
			opts: heluoOpts,
		});
		if(!chart || !chart.xian || !chart.xian.name || !chart.hou || !chart.hou.name){
			return '';
		}
		const dy = heluoDaYun(chart.xian, chart.hou, b.birthYear);
		// 化工/反化工/葉按真实节气(与河洛页 solarTermHuagong 同源;缺省法门 tuWangKunGen 与页面同):
		// 此前 st=null 走 MONTH_HG 月支近似(builder 自注「单测回退」),约七成生日两侧化工不同,且拨「取化工法」为
		// 默认档被 prune 剪空 → 永远拿近似值。节气算不出(日期非法)才回落近似。
		let st = null;
		{
			let dateStr = '';
			let zone = '';
			try{ const bp = buildChartBaziParams(record); dateStr = `${bp.date || ''}`; zone = bp.zone || ''; }catch(e){ dateStr = ''; }
			st = heluoSolarTermForDate(dateStr, overrideQuHuaGong || 'tuWangKunGen', zone);
		}
		const jg = heluoJudge(chart, b.fourPillars, b.monthZhi, st);
		// [起卦详情] 段:与页面 heluoSnapshotDetail(getModel) 同形(四柱/月支/节气三候/年纳音/干支年基准);extras 由 builder 内 chartExtras 同源算。
		const detail = { fourPillars: b.fourPillars, monthZhi: b.monthZhi, st, nayin: b.yearNayin || '', birthYear: b.birthYear };
		return buildHeluoSnapshotText(chart, jg, dy, { monthZhi: b.monthZhi, opts: heluoOpts, detail }) || '';
	}catch(e){
		return '';
	}
}

// 一掌经（其他/命）：纯前端，按本盘出生→农历(正月初一年支/月/日/时支)起四柱四宫+断语。
// 挂载齿轮可调 顺逆/命宫/大限运长等 → record.{shunniRule,...} → opts（未改时 undefined，引擎回秘传默认）。
export async function buildYizhangjingSnapshotForRecord(record, opts){
	try{
		const params = buildChartBaziParams(record);
		const bazi = buildLocalBaziResult(params).bazi;
		const model = buildYizhangjingModel(bazi, opts || {});
		return buildYizhangjingSnapshotText(model) || '';
	}catch(e){
		return '';
	}
}

// 取该盘的西洋星盘原始结果（含 predictive 衍生数据，如 firdaria；可选含主限法）。
export async function fetchChartResultForRecord(record, options = {}){
	const fields = buildFieldObject(record);
	const rsp = await fetchChart({
		...fieldParams(fields),
		includePrimaryDirection: !!options.includePrimaryDirection,
	}, {
		silent: true,
		timeoutMs: 20000,
	});
	return rsp && rsp.Result ? rsp.Result : null;
}
