// 七政四余页 · 起盘参数:首开补空的全局仓值、本命盘空闲预热、字段转排盘参数、流年时间与带流年的参数。
// 只被 components/guolao/GuoLaoChartMain.js 与同目录 main/ 下的兄弟模块引用。
import { fieldsSchemaBaseline } from '../../../utils/recordFieldsRestore';   // 首开只补空的判默认基准
import { chartDayBoundary } from '../../../utils/dayBoundaryResolve';
import DateTime from '../../comp/DateTime';
import {
	GUOLAO_CHART_STYLE_QIZHENG, getStoredGuolaoChartStyle, getStoredGuolaoLifeMode, getStoredGuolaoNodeMode,
	resolveGuolaoAyanamsa, getStoredGuolaoTrueSolarTime, getStoredGuolaoNodeType, getStoredGuolaoLilithType,
	getStoredGuolaoBodyMode, getStoredGuolaoTuibianMethod, getStoredGuolaoGufaPrecess,
	getStoredGuolaoEqTropicalAnchor, GUOLAO_DIZHI,
} from '../GuoLaoChartStyle';
import { guolaoNodeModeFromFields } from './aspectsNodeMode';
import {
	GUOLAO_SU28_CACHE_REV, GUOLAO_SU28_MODE_ZHENG_SIDEREAL, GUOLAO_SU28_MODE_GUFA_LICHENG,
	GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL, GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL_LIVE, fetchGuolaoChartCached,
} from './chartCache';
import { guolaoLifeModeFromFields, guolaoSu28ModeFromFields } from './fieldModes';
import { classicalGlobalValue } from '../../../utils/classicalChartGlobals';

// 行星时制式(星盘设置里的全局「行星时制式」;随盘存过的以盘为准):'sunrise' 日出起算 · 等长时(缺省)/ 'unequal' 昼夜不等时 /
// 'equal24' 廿四时等分。日出起算下出生与日出同加太阳时偏移、差值不变 → 「报时星」三档(真 / 平 / 钟表)恒同;
// 另两种制式下太阳时校正改变所落的时 → 三档才分得开。页面、挂载、缓存键、快照、左栏置灰都读这一个函数。
export function guolaoPlanetaryHourMethod(fields){
	const fv = fields && fields.planetaryHourMethod ? fields.planetaryHourMethod.value : undefined;
	const v = (fv !== undefined && fv !== null && `${fv}` !== '') ? `${fv}` : `${classicalGlobalValue('planetaryHourMethod') || 'sunrise'}`;
	return (v === 'unequal' || v === 'equal24') ? v : 'sunrise';
}

// 七政首开「补空」的纯计算:给定 fields,返回要播进去的全局仓值({} = 不用播)。页面首开(ensureGuolaoDefaults)与
// 空闲预热(warmGuolaoNatal)同用这一份 —— 预热要构出与首点逐字节相同的键,口径存过非出厂值的用户若按出厂值预热就是白跑一趟。
export function computeGuolaoSeedPatch(fields, opts){
	if(!fields){ return {}; }
	const embedded = !!(opts && opts.embedded);
	// 择日宿主里内嵌的那份**整个不播**(此前只对后加的七键关掉,既有三键仍会播):宿主按「主页出厂档 + 工作台扫描口径」
	// 自造 fields,补值走的却是全局 fields 派发 —— 全局仓存过非 asc 的命度法时,首开七政择日会拿择日时刻去改主应用当前的盘,
	// 内嵌实例又因 ensure 返回 true 而不起盘、等不到 fields 变化 → 内嵌盘不出。判别向量在 pageSettingsCaseAndHostSemantics 合同测试。
	if(embedded){ return {}; }
	// 载入了记录(cid 有值)一律以记录为准,既有三键与后加七键同律(记录还原把「存档时为默认」复位成 schema 初值,单看取值分不清
	// 「记录说是默认」与「还没人表态」;把一张按默认存下的旧盘按当前偏好重排 = 盘变了、另存写回记录、与 AI 无头复算对不上)
	const recordLoaded = !!(fields.cid && fields.cid.value);
	const lifeMode = getStoredGuolaoLifeMode();
	const nodeMode = getStoredGuolaoNodeMode();
	const currentLifeMode = guolaoLifeModeFromFields(fields);
	const currentNodeMode = guolaoNodeModeFromFields(fields);
	// 首开只「补空」,不覆盖已有值。
	// 旧实现凡与全局仓不同就写回 fields:先载一张存了 doubingSu28=6 的命盘、再首开七政页 → 盘按全局出、
	// 另存还会把全局值写进档(AI 无头复算按记录值,两边不一)。
	// 判据用「随盘保真」同一套口径:fields 值仍等于 schema 初值 = 用户/记录没表态 → 可播全局;
	// 已经不是初值(记录还原或本会话手改)= 有主,绝不动。
	const baseline = fieldsSchemaBaseline() || {};
	const atSchemaDefault = (key, cur)=>{
		const def = baseline[key] ? baseline[key].value : undefined;
		if(def === undefined){ return false; }
		return `${cur}` === `${def}`;
	};
	const patch = {};
	// 宿度制不在这里播:它是「新盘种子」键(宿盘 / 七政两页亲手改都记种子,新命盘直接按种子起),七政仓只是镜像;
	// 旧版只存在七政仓里的值已由新盘种子一次性并入(newChartSeeds 旧仓并入)。此前这里按七政仓补空,
	// 与宿盘的种子互相冲(宿盘先选、七政后选,重开后七政的选择丢)。
	// 自定命宫(命度法值为某个地支)不播:与自定身宫同理,是给某一位命主手工指定的命宫,播出去等于强加给后面每一张新盘
	const lifeIsCustomZhi = GUOLAO_DIZHI.indexOf(lifeMode) >= 0;
	if(!recordLoaded && !lifeIsCustomZhi && currentLifeMode !== lifeMode && atSchemaDefault('guolaoLifeMode', currentLifeMode)){
		patch.guolaoLifeMode = {
			value: lifeMode,
		};
	}
	if(!recordLoaded && currentNodeMode !== nodeMode && atSchemaDefault('guolaoNodeMode', currentNodeMode)){
		patch.guolaoNodeMode = {
			value: nodeMode,
		};
	}
	// 其余「类 A」起盘口径(报时星 / 罗计取法 / 月孛取法 / 身宫法 / 推变法 / 古宿岁差 / 回归等分锚点):
	// 左栏改动时历来都写了全局仓(setStoredGuolao*),但首开从不读回 —— schema 初值恒非空,左栏那句
	// 「fields 值 || 存储值」的回退永远走不到 → 改了的口径重开软件即回出厂值(用户实报同类:排盘设置重开要重设)。
	// 「只补空」之外再加两条:
	//   · **载入了记录就不播**。记录还原会把「存档时为默认」的键复位成 schema 初值,单看取值分不清「记录说是默认」
	//     与「还没人表态」;这几键多数直接改盘,把一张按默认存下的旧盘按你现在的偏好重排 = 盘变了、另存还会写回记录、
	//     与 AI 无头复算(按记录值)也对不上。有记录(cid 有值)一律以记录为准。
	//   · **自定身宫(某个地支)不播**。那是给某一位命主手工指定的身宫,不是口径;播出去等于把这位的身宫强加给后面每一张盘。
	//   · **择日宿主里内嵌的那份不播**。宿主自己按「主页出厂档 + 工作台扫描口径」造 fields(显示盘须与命中判定同口径),
	//     内嵌实例若把全局仓值补进去,一是与扫描口径相左,二是补值走的是全局 fields 派发 —— 会拿宿主的择日时刻去改主应用当前的盘。
	if(!recordLoaded){
		[
			['guolaoTrueSolarTime', getStoredGuolaoTrueSolarTime],
			['guolaoNodeType', getStoredGuolaoNodeType],
			['guolaoLilithType', getStoredGuolaoLilithType],
			['guolaoBodyMode', getStoredGuolaoBodyMode],
			['guolaoTuibianMethod', getStoredGuolaoTuibianMethod],
			['guolaoGufaPrecess', getStoredGuolaoGufaPrecess],
			['guolaoEqTropicalAnchor', getStoredGuolaoEqTropicalAnchor],
		].forEach(([key, getter])=>{
			const f = fields[key];
			const cur = f ? f.value : undefined;
			const stored = getter();
			if(cur === undefined || stored === undefined || stored === null){ return; }
			if(key === 'guolaoBodyMode' && stored !== 'taiyin' && stored !== 'youjin'){ return; }
			if(`${cur}` !== `${stored}` && atSchemaDefault(key, cur)){
				patch[key] = { value: stored };
			}
		});
	}
	return patch;
}

// R4-B3(数据层空闲预热):按当前命盘 fields 预热七政「本命盘」进 guolao 缓存 —— 与用户
// 首点走完全相同的 fieldsToParams + fetchGuolaoChartCached 入口(key 同、body 同、结果逐字节同,
// 只是提前付)。仅暖本命:流年/Moira 规则依赖「此刻」的流年时间=取现时,按预热白名单纪律禁入
// (步进预取的三段链式版在组件登记里,那里能读到用户显式设置的 transitTime)。
// 存储样式为七政 kinastro 引擎时跳过(不同引擎路径,预热本命盘对其无效)。失败静默。
export async function warmGuolaoNatal(fields){
	try{
		if(!fields || !fields.date || !fields.date.value || !fields.date.value.format){ return null; }
		if(!(fields.lon && fields.lon.value) || !(fields.lat && fields.lat.value)){ return null; }
		if(getStoredGuolaoChartStyle() === GUOLAO_CHART_STYLE_QIZHENG){ return null; }
		// 页面首开会先把全局仓里的口径补进 fields 再起盘:预热按同一份补过的 fields 构参,键才对得上
		const params = fieldsToParams({ ...fields, ...computeGuolaoSeedPatch(fields) });
		return await fetchGuolaoChartCached(params, { silent: true });
	}catch(e){
		return null; // 预热失败静默:首点回到冷即付的现状
	}
}

export function fieldsToParams(fields){
	const su28Mode = guolaoSu28ModeFromFields(fields);
	const params = {
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		ad: (fields.ad && fields.ad.value !== undefined) ? fields.ad.value : (fields.date.value.ad || 1),
		zone: fields.zone.value,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: 0,
		zodiacal: su28Mode === GUOLAO_SU28_MODE_ZHENG_SIDEREAL ? 1 : 0,
		tradition: fields.tradition.value,
		doubingSu28: su28Mode,
		guolaoZhengSidereal: su28Mode === GUOLAO_SU28_MODE_ZHENG_SIDEREAL ? 1 : 0,
		guolaoLifeMode: guolaoLifeModeFromFields(fields),
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: 0,
		name: fields.name.value,
		pos: fields.pos.value,
		...chartDayBoundary(fields),   // 日界 / 晚子时单源(本盘优先、缺读全局;与正传 / kinastro 系 / 无头同一函数)
		_su28Rev: GUOLAO_SU28_CACHE_REV,
	};

	// G2 恒星制岁差:仅恒星宿度制 + 用户选了 ayanāṃśa 才透传(复用既有 siderealAyanamsa 键;ChartController 已转发、perchart 已用;缺=郑氏默认零回归)。
	const guolaoAyan = guolaoAyanamsaFromFields(fields);
	if(su28Mode === GUOLAO_SU28_MODE_ZHENG_SIDEREAL && guolaoAyan){
		params.siderealAyanamsa = guolaoAyan;
	}

	// G6 报时星太阳时:仅非默认(真)才透传,默认 true → perchart 缺键即 true → 零回归。
	const trueSolar = guolaoFieldValue(fields, 'guolaoTrueSolarTime', getStoredGuolaoTrueSolarTime);
	if(trueSolar === 'mean' || trueSolar === 'off'){
		params.trueSolarTime = trueSolar;
	}
	// 行星时制式:非缺省(不等时 / 廿四时)才透传 → 报时星按该制式取、太阳时三档在这两种制式下真正生效;缺省不发 = 零回归。
	const hourMethod = guolaoPlanetaryHourMethod(fields);
	if(hourMethod !== 'sunrise'){
		params.planetaryHourMethod = hourMethod;
	}
	// G10-13 四余取法:仅非默认才透传(罗计/月孛默认平 mean),默认=零回归。
	// 紫炁取法只有「今法真算」一档生效('tablet' 假档已隐藏),故永不透传 guolaoZiqiMode → 后端始终走真算。
	if(guolaoFieldValue(fields, 'guolaoNodeType', getStoredGuolaoNodeType) === 'true'){
		params.guolaoNodeType = 'true';
	}
	if(guolaoFieldValue(fields, 'guolaoLilithType', getStoredGuolaoLilithType) === 'true'){
		params.guolaoLilithType = 'true';
	}
	// WP-D 授时历古法(用制 6):推变黄道术法(纪元闭式默认/进退/会圆)+ 古宿随岁差。仅 mode6 且非默认才透传 → 缺=纪元·不随岁差零回归。
	if(su28Mode === GUOLAO_SU28_MODE_GUFA_LICHENG){
		const _tuibian = guolaoFieldValue(fields, 'guolaoTuibianMethod', getStoredGuolaoTuibianMethod);
		if(_tuibian === 'jintui' || _tuibian === 'huiyuan'){ params.guolaoTuibianMethod = _tuibian; }
		// 🔴 T-16:guolaoFieldValue 串化后 '0' 也为真 → 「钉死元时」(0)与缺省都被当「随岁差」发 1;按 '1'/'true' 判真(与缓存键 / models/astro.js 构参同口径)
		const _gufaPrecess = guolaoFieldValue(fields, 'guolaoGufaPrecess', getStoredGuolaoGufaPrecess);
		if(_gufaPrecess === '1' || _gufaPrecess === 'true'){ params.guolaoGufaPrecess = 1; }
	}
	// 赤道回归制锚点(mode7 元明 / mode8 实时 同款):仅两制且非默认(牛前冬至)才透传 → 缺=牛前冬至零回归。
	if(su28Mode === GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL || su28Mode === GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL_LIVE){
		const _anchor = guolaoFieldValue(fields, 'guolaoEqTropicalAnchor', getStoredGuolaoEqTropicalAnchor);
		if(_anchor === 'chunfen'){ params.guolaoEqTropicalAnchor = 'chunfen'; }
	}
	// G20/R3 身宫法:琴堂(youjin)或自定身宫(地支子~亥)透传(进 moira params);默认果老(taiyin)不发=零回归。
	const bodyMode = guolaoFieldValue(fields, 'guolaoBodyMode', getStoredGuolaoBodyMode);
	if(bodyMode && bodyMode !== 'taiyin'){
		params.guolaoBodyMode = bodyMode;
	}
	// R2 自定命宫:命度法值=地支(子~亥)即自定命宫,已随 guolaoLifeMode 透传(BaZi 按地支当 custom 算),无需额外键。

	return params;
}

export function guolaoFieldValue(fields, key, fallbackGetter){
	if(fields && fields[key] && fields[key].value !== undefined && fields[key].value !== null && `${fields[key].value}` !== ''){
		return `${fields[key].value}`;
	}
	return fallbackGetter ? fallbackGetter() : '';
}

// 与左栏「恒星岁差」下拉同一判据(resolveGuolaoAyanamsa):择日内嵌的七政盘空档即郑式,不回落七政页记住的岁差
function guolaoAyanamsaFromFields(fields){
	return resolveGuolaoAyanamsa(fields);
}

export function makeDefaultMoiraTransitTime(fields){
	// 「此刻」按本盘时区换算(DateTime.nowForChart):此前东八区钟面直接改贴本盘时区,非东八区盘的行运时刻错开时差
	return DateTime.nowForChart(fields && fields.zone && fields.zone.value ? `${fields.zone.value}` : '');
}

export function paramsWithMoiraTransit(fields, transitTime){
	const params = fieldsToParams(fields);
	const tm = transitTime || makeDefaultMoiraTransitTime(fields);
	if(tm){
		params.date = tm.format('YYYY/MM/DD');
		params.time = tm.format('HH:mm:ss');
		params.ad = tm.ad;
		params.zone = tm.zone || params.zone;
		params.predictive = 1;
	}
	return params;
}
