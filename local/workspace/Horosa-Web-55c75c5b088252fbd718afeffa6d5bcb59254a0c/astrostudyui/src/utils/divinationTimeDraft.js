// 占卜技法·自由时间地理草稿(「卜·其他」页统一起盘入口)。
//
// 背景:飞宫/小六壬/皇极轨策等「卜·其他」技法原先只读主命盘 props.value.chart.nongli
// (被顶层盘绑死),用户无法在本技法左栏独立选时间地理起盘。本模块提供一套共享工具,
// 让各技法维护自己的 localFields 草稿(照奇门 DunJiaMain 范式),从草稿本地派生一份
// 与后端 chart.nongli 同形的农历,喂给各自既有的 ctx()/起盘引擎——不写回 redux、
// 不污染主命盘、技法之间互不串扰。
//
// 🔴 默认即现状:localFields=null 时各技法仍读 props.value.chart.nongli(后端盘),字节一致;
// 仅当用户在左栏 SpaceTimePanel 改了时间/经纬,才切到本地草稿派生的农历。
//
// 农历引擎=baziLunarLocal(八字主盘同源引擎,memory 已定谳「解读必本地」),吃真太阳时/
// 晚子时开关,与顶层盘同口径;纯前端零后端往返,离线可用。
import buildLocalBaziResult from './baziLunarLocal';
import { convertLatToStr, convertLonToStr } from '../components/astro/AstroHelper';
import { resolveGeoZone } from './timezone';
import { geoNameFieldPatch } from './geoName';

const nongliMemo = new Map();

function fieldVal(fields, key, fallback){
	if(!fields || !fields[key] || fields[key].value === undefined || fields[key].value === null){
		return fallback;
	}
	return fields[key].value;
}

/** 草稿 fields → buildLocalBaziResult 入参(与 DunJia.genParams 同口径:含真太阳时/晚子时开关)。 */
export function paramsFromFields(fields){
	if(!fields || !fields.date || !fields.time || !fields.date.value || !fields.time.value
		|| !fields.date.value.format || !fields.time.value.format){
		return null;
	}
	return {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		ad: fieldVal(fields, 'ad', 1),
		zone: fieldVal(fields, 'zone', 8),
		lon: fieldVal(fields, 'lon', ''),
		lat: fieldVal(fields, 'lat', ''),
		timeAlg: fieldVal(fields, 'timeAlg', undefined),
		after23NewDay: fieldVal(fields, 'after23NewDay', undefined),
		lateZiHourUseNextDay: fieldVal(fields, 'lateZiHourUseNextDay', undefined),
		gender: fieldVal(fields, 'gender', undefined),
	};
}

/** 四柱柱对象(fourColumns.year 等)→ 与后端 nongli.bazi.柱 同形({stem:{cell},branch:{cell},ganzi})。
 *  以 stem.cell/branch.cell 为准,ganzi 由两字派生(不依赖柱对象是否自带 ganzi 键,最稳)。 */
function pillar(fc){
	const stem = (fc && fc.stem && fc.stem.cell) || '';
	const branch = (fc && fc.branch && fc.branch.cell) || '';
	return { stem: { cell: stem }, branch: { cell: branch }, ganzi: `${stem}${branch}` };
}

/** 草稿 fields → 与 chart.nongli 同形的农历(占卜 ctx 所需字段:四柱柱对象 + 农历月日 + 公历日/年干支)。
 *  返回 null 表示 fields 不完整(缺日期/时间)。结果 memoize(入参 key),连续重排零重算。 */
export function deriveLocalNongli(fields){
	const params = paramsFromFields(fields);
	if(!params){
		return null;
	}
	const key = JSON.stringify(params);
	if(nongliMemo.has(key)){
		return nongliMemo.get(key);
	}
	let out = null;
	try{
		const r = buildLocalBaziResult(params);
		const fc = (r && r.bazi && r.bazi.fourColumns) || {};
		const nl = (r && r.bazi && r.bazi.nongli) || {};
		out = {
			date: params.date,
			// 农历数字月日(小六壬/皇极轨策吃 monthInt/dayInt;buildNongli 出 monthNum/dayNum)
			monthInt: nl.monthNum != null ? nl.monthNum : null,
			dayInt: nl.dayNum != null ? nl.dayNum : null,
			monthNum: nl.monthNum != null ? nl.monthNum : null,
			dayNum: nl.dayNum != null ? nl.dayNum : null,
			leap: !!nl.leap,
			year: nl.year || '',
			yearGZByLunar: nl.yearGZByLunar || '',
			bazi: {
				year: pillar(fc.year),
				month: pillar(fc.month),
				day: pillar(fc.day),
				time: pillar(fc.time),
			},
			__localDraft: true,
		};
	}catch(e){
		out = null;
	}
	if(out){
		nongliMemo.set(key, out);
		if(nongliMemo.size > 64){ nongliMemo.clear(); }
	}
	return out;
}

/** 时间选择 → 草稿 fields 补丁(照 DunJia.onTimeChanged:date/time/ad/zone)。dt=PlusMinusTime 回传的 DateTime。 */
export function timePatchFromDateTime(dt){
	return {
		date: { value: dt.clone() },
		time: { value: dt.clone() },
		ad: { value: dt.ad },
		// zone 兜底:部分态 DateTime(反序列化 POJO 等)缺 zone 时落 +08:00,防 undefined 经
		// onFieldsChange 流入全局 fields(下游请求缺 zone 键 → Java miss.zone)。
		zone: { value: dt.zone || '+08:00' },
	};
}

/** 经纬度选择 → 草稿 fields 补丁(照 DunJia.changeGeo:经纬 + 时区自动校正 + 重锚钟面时间 + 地名)。
 *  rec=GeoCoordModal 回传({lng,lat,gpsLng,gpsLat,name});baseFields 用于取当前 date/time 重锚。 */
export function geoPatchFromRec(rec, baseFields){
	const base = baseFields || {};
	const dDt = base.date && base.date.value;
	const tDt = base.time && base.time.value;
	const ds = (dDt && dDt.format) ? dDt.format('YYYY-MM-DD') : null;
	const z = resolveGeoZone(rec, ds);
	const patch = {
		lon: { value: convertLonToStr(rec.lng) },
		lat: { value: convertLatToStr(rec.lat) },
		gpsLon: { value: rec.gpsLng },
		gpsLat: { value: rec.gpsLat },
	};
	if(z){
		patch.zone = { value: z };
		if(dDt && dDt.clone){ const nd = dDt.clone(); nd.setZone(z); patch.date = { value: nd }; patch.ad = { value: nd.ad }; }
		if(tDt && tDt.clone){ const nt = tDt.clone(); nt.setZone(z); patch.time = { value: nt }; }
	}
	Object.assign(patch, geoNameFieldPatch(rec));
	return patch;
}

/** 草稿 fields → 合成 fields 形状对象喂 openKentangCaseDrawer(存事盘时用草稿时间地理,非主命盘)。
 *  kentangCaseSave 只经 getFieldValue 读 fields[key].value,合成对象天然兼容;缺项回退主 fields。 */
export function draftOrBaseFields(localFields, baseFields){
	return localFields || baseFields || {};
}

/** AI 快照 meta 的时间地理键(照 aiAnalysisContext.buildSnapshotMetaFromRecord:date/time/zone/lon/lat)。
 *  补齐后命盘缓存路径 isCacheSnapshotConfidentMatch 才能确凿匹配;事盘路径亦利于一致。 */
export function snapshotMetaFromFields(fields, extra){
	const m = { ...(extra || {}) };
	if(fields && fields.date && fields.date.value && fields.date.value.format){
		m.date = fields.date.value.format('YYYY-MM-DD');
	}
	if(fields && fields.time && fields.time.value && fields.time.value.format){
		m.time = fields.time.value.format('HH:mm:ss');
	}
	const zone = fieldVal(fields, 'zone', undefined);
	const lon = fieldVal(fields, 'lon', undefined);
	const lat = fieldVal(fields, 'lat', undefined);
	if(zone !== undefined){ m.zone = zone; }
	if(lon !== undefined){ m.lon = lon; }
	if(lat !== undefined){ m.lat = lat; }
	return m;
}

// ───────────────────────────────────────────────────────────────────────────
// 域外(本地历法可靠域 AD1~9999 之外)农历派生:走后端星历实算(/jieqi 系,
// 数据域 BC12998~AD16798)。朔表定农历月日、节表定月柱、纯公式定日/时干支。
// 口径:干支连续循环纪年(公元 4 年甲子,BC 按天文年连续回推);proleptic 现行规则。
// ───────────────────────────────────────────────────────────────────────────
import { getOnlyDateNum, getDayGanZhi } from './localNongliAdapter';
import { parseDateParts, parseYearFromDateStr } from './dateStrSafe';
import { buildKentangEndpoint } from '../integrations/kentang/serviceRoot';
import { cachedKentangFetch } from './kentangCache';
import { isLunarJsYearReliable } from './lunarDomainGuard';

const GAN_LIST = '甲乙丙丁戊己庚辛壬癸'.split('');
const ZHI_LIST = '子丑寅卯辰巳午未申酉戌亥'.split('');
// 节(jie=true)→月支:立春寅、惊蛰卯、清明辰、立夏巳、芒种午、小暑未、
// 立秋申、白露酉、寒露戌、立冬亥、大雪子、小寒丑
const JIE_TO_MONTHZHI = {
	立春: 2, 惊蛰: 3, 清明: 4, 立夏: 5, 芒种: 6, 小暑: 7,
	立秋: 8, 白露: 9, 寒露: 10, 立冬: 11, 大雪: 0, 小寒: 1,
};
const NONGLI_MONTH_INT = {
	正月: 1, 二月: 2, 三月: 3, 四月: 4, 五月: 5, 六月: 6,
	七月: 7, 八月: 8, 九月: 9, 十月: 10, 冬月: 11, 腊月: 12,
};

// 天文年(BC1=0):干支连续循环。
function astroYear(year, ad){
	const y = Math.abs(Number(year));
	return (Number(ad) < 0) ? (1 - y) : y;
}

export function yearGanzhiByAstroYear(ay){
	const idx = (((ay - 4) % 60) + 60) % 60;
	return `${GAN_LIST[idx % 10]}${ZHI_LIST[idx % 12]}`;
}

// 五虎遁:年干→寅月干起点;月干=起点+(月支序-寅序) 顺推。
function monthPillarFrom(yearGan, monthZhiIdx){
	const yg = GAN_LIST.indexOf(yearGan);
	if(yg < 0){ return ''; }
	const first = (yg % 5) * 2 + 2; // 甲己→丙(2) 乙庚→戊(4) 丙辛→庚(6) 丁壬→壬(8) 戊癸→甲(0)+10 取模
	const off = ((monthZhiIdx - 2) % 12 + 12) % 12;
	const mg = (first + off) % 10;
	return `${GAN_LIST[mg]}${ZHI_LIST[monthZhiIdx]}`;
}

// 五鼠遁:日干→子时干起点;时干=起点+时支序。
function hourPillarFrom(dayGan, hourZhiIdx){
	const dg = GAN_LIST.indexOf(dayGan);
	if(dg < 0){ return ''; }
	const first = (dg % 5) * 2;
	const hg = (first + hourZhiIdx) % 10;
	return `${GAN_LIST[hg]}${ZHI_LIST[hourZhiIdx]}`;
}

function pillarObj(gz){
	const stem = gz ? gz.charAt(0) : '';
	const branch = gz ? gz.charAt(1) : '';
	return { stem: { cell: stem }, branch: { cell: branch }, ganzi: `${stem}${branch}` };
}

// 朔表日期串('11999-11-13' / '-12025-02-26')→ jdn(取当地日界)。
// 🔴 口径:串中负年=后端月表的【天文年直写】(请求 year=ay 原样回显),直读不再变换;
// 旧式对负年又做 1-y(显示年→天文年)属双重变换,BC 全域错 1 年 → 目标日永落不进朔窗
// (assemble 恒 null,一掌经等 BC 空态)。无符号串 + adFlag<0 才是显示年,按 1-y 归天文年。
function jdnOfDateStr(ds, adFlag){
	const neg = ds.charAt(0) === '-';
	const body = neg ? ds.slice(1) : ds;
	const parts = body.split('-');
	let y = parseInt(parts[0], 10);
	// 🔴 后端 /jieqi 月表 date 用「无 0 年」显示年(BC N='-N',如 BC12026='-12026',与 Java ad×year、
	// extreme_pillars 同轴);getOnlyDateNum 用「有 0 年」天文年(BC N=1-N=-N+1)。二者对 BC 差 1 年,
	// 必在此把无 0 年显示年→有 0 年天文年(1-|y|),否则整表错约一农历年、目标日落错朔窗(真机:一掌经等
	// BC 生年支/农历日偏——申应未、日28应16)。tJdn 亦用 getOnlyDateNum(有 0 年 ay),两侧同轴才匹配。
	if(neg){ y = 1 - y; }
	else if(adFlag !== undefined && Number(adFlag) < 0){ y = 1 - y; }
	return getOnlyDateNum(y, parseInt(parts[1], 10), parseInt(parts[2], 10));
}

/** 纯拼装(可单测):目标{ay,month,day,hour} + 朔表 months + jieqi/birth 的 jieqi 列表 + birthJDN
 *  → 与 deriveLocalNongli 同形结构。找不到所属朔区间返回 null。 */
export function assembleNongliFromTables(target, months, jieqiList, birthJDN){
	const tJdn = getOnlyDateNum(target.ay, target.month, target.day);
	let cur = null;
	for(let i = 0; i < (months || []).length; i++){
		const m = months[i];
		const mj = jdnOfDateStr(m.date, m.ad);
		const next = months[i + 1];
		const nj = next ? jdnOfDateStr(next.date, next.ad) : Infinity;
		if(tJdn >= mj && tJdn < nj){
			cur = { m, dayInt: tJdn - mj + 1 };
			break;
		}
	}
	if(!cur){ return null; }
	const monthInt = NONGLI_MONTH_INT[cur.m.name] || null;
	// 月柱:最近一个 ≤生辰时刻 的节(jie=true)
	let jieZhi = null;
	let lichunJdn = null;
	for(const jq of (jieqiList || [])){
		if(jq.jieqi === '立春'){ lichunJdn = jq.jdn; }
		if(jq.jie && jq.jdn <= birthJDN && JIE_TO_MONTHZHI[jq.jieqi] !== undefined){
			if(jieZhi === null || jq.jdn > jieZhi.jdn){ jieZhi = jq; }
		}
	}
	// 八字年柱=立春界:生辰在该公历年立春前 → 上一天文年
	let baziAy = target.ay;
	if(lichunJdn !== null && birthJDN < lichunJdn){ baziAy = target.ay - 1; }
	const baziYearGZ = yearGanzhiByAstroYear(baziAy);
	const monthGZ = jieZhi ? monthPillarFrom(baziYearGZ.charAt(0), JIE_TO_MONTHZHI[jieZhi.jieqi]) : '';
	const dayGZ = getDayGanZhi(target.ay, target.month, target.day);
	const hourZhiIdx = Math.floor(((target.hour + 1) % 24) / 2);
	const hourGZ = hourPillarFrom(dayGZ.charAt(0), hourZhiIdx);
	return {
		monthInt, dayInt: cur.dayInt,
		monthNum: monthInt, dayNum: cur.dayInt,
		leap: !!cur.m.leap,
		year: cur.m.year || '',
		yearGZByLunar: cur.m.year || '',
		bazi: {
			year: pillarObj(baziYearGZ),
			month: pillarObj(monthGZ),
			day: pillarObj(dayGZ),
			time: pillarObj(hourGZ),
		},
		__remoteDraft: true,
	};
}

async function postJieqi(action, payload){
	const rsp = await cachedKentangFetch(buildKentangEndpoint('jieqi', action), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=UTF-8' },
		body: JSON.stringify(payload),
	}, { retries: 0 });
	const text = await rsp.text();
	const obj = text ? JSON.parse(text) : null;
	if(!obj || obj.err){ throw new Error((obj && obj.err) || 'jieqi.fetch.failed'); }
	return obj;
}

/** 域外农历派生:后端朔表+节表实算拼装。失败返回 null(调用方提示)。 */
export async function deriveNongliRemote(fields){
	const params = paramsFromFields(fields);
	if(!params){ return null; }
	try{
		// 安全解析:BC 的 date 串带前导负号('-7040-07-19'),裸 split('-') 会撕裂成
		// 年 NaN/月 100(全年份域审计 4A)——统一走 parseDateParts。
		const dp = parseDateParts(params.date);
		if(!dp){ return null; }
		const ad = (Number(params.ad) < 0 || dp.year < 0) ? -1 : 1;
		const ay = astroYear(Math.abs(dp.year), ad);
		// 🔴 /jieqi 后端月表用「无 0 年」显示年(ad×|年|:BC12026=-12026,与 Java/extreme_pillars 同轴),
		// 非 astroYear 的「有 0 年」天文年(-12025)。旧码误传 ay→拿到晚 1 年(丙申)月表→一掌经等 BC
		// civil 农历/生年支偏(申应未、日28应16;BC1 尤甚,ay=0 无效)。四柱仍用 ay(有 0 年,byte 零回归)。
		const jieqiYear = ad < 0 ? -Math.abs(dp.year) : Math.abs(dp.year);
		const zone = typeof params.zone === 'string' ? params.zone : '+08:00';
		const base = { zone, lat: params.lat || '0n00', lon: params.lon || '0e00' };
		const [nl, birth] = await Promise.all([
			postJieqi('nongli', { year: jieqiYear, ...base }),
			postJieqi('birth', { date: `${String(Math.abs(dp.year)).padStart(4, '0')}/${String(dp.month).padStart(2, '0')}/${String(dp.day).padStart(2, '0')}`, time: params.time, ad, ...base }),
		]);
		const hour = parseInt((params.time || '0').split(':')[0], 10) || 0;
		const out = assembleNongliFromTables(
			{ ay, month: dp.month, day: dp.day, hour },
			nl.months, birth.jieqi, birth.birthJDN
		);
		if(out){ out.date = params.date; }
		return out;
	}catch(e){
		return null;
	}
}

/** 统一入口:域内走本地(同步引擎,零回归);域外走后端实算。 */
export async function deriveLocalNongliAsync(fields){
	const local = deriveLocalNongli(fields);
	if(local){ return local; }
	const params = paramsFromFields(fields);
	if(!params){ return null; }
	const y = parseYearFromDateStr(params.date);
	if(Number(params.ad) < 0 || !isLunarJsYearReliable(y)){
		return deriveNongliRemote(fields);
	}
	return null;
}

// ── 同步消费桥:12 技法组件在 render 里同步调 deriveLocalNongli——域外结果异步到货后
// 写入 remoteNongliMemo 并通知订阅组件重绘,组件下一次同步取值即命中(组件改动≤2 行)。
const remoteNongliMemo = new Map();
const remoteNongliPending = new Set();
const remoteNongliSubs = new Set();

export function subscribeRemoteNongli(listener){
	remoteNongliSubs.add(listener);
	return () => remoteNongliSubs.delete(listener);
}

/** 域内=本地同步;域外=同步查远端缓存,未命中触发后台实算(到货通知订阅者)。
 *  返回 null 时消费方沿既有空态路径(「历法计算中/超域」提示由各页负责)。 */
export function deriveNongliUniversalSync(fields){
	const local = deriveLocalNongli(fields);
	if(local){ return local; }
	const params = paramsFromFields(fields);
	if(!params){ return null; }
	const key = JSON.stringify([params.date, params.time, params.ad, params.zone]);
	if(remoteNongliMemo.has(key)){ return remoteNongliMemo.get(key); }
	if(!remoteNongliPending.has(key)){
		remoteNongliPending.add(key);
		deriveNongliRemote(fields).then((out) => {
			remoteNongliPending.delete(key);
			if(out){
				remoteNongliMemo.set(key, out);
				if(remoteNongliMemo.size > 64){ remoteNongliMemo.clear(); remoteNongliMemo.set(key, out); }
				remoteNongliSubs.forEach((fn) => { try{ fn(); }catch(e){ /* 订阅者已卸载等 */ } });
			}
		}).catch(() => { remoteNongliPending.delete(key); });
	}
	return null;
}

/** 起卦时间行(AI 导出/挂载共用,卜类快照统一口径):公历(带符号年,BC 负号原样)+
 *  农历(数字月/日)+四柱干支。时间取自生效 fields(本地草稿或主盘);农历经
 *  deriveNongliUniversalSync(域外首次为 null,远程回包后由订阅方重存快照补全)。 */
export function buildQiKeTimeLines(fields){
	if(!fields || !fields.date || !fields.date.value || !fields.date.value.format){ return []; }
	const dateStr = fields.date.value.format('YYYY-MM-DD');
	const timeStr = (fields.time && fields.time.value && fields.time.value.format) ? fields.time.value.format('HH:mm:ss') : '';
	const zone = (fields.zone && fields.zone.value) || '';
	const lines = [`起卦时间:${dateStr}${timeStr ? ` ${timeStr}` : ''}${zone ? `(${zone})` : ''}`];
	const nl = deriveNongliUniversalSync(fields);
	if(nl){
		const b = nl.bazi || {};
		const gz = ['year', 'month', 'day', 'time'].map((k) => (b[k] && b[k].ganzi) || '').filter((sv) => sv && sv.length >= 2);
		if(nl.monthInt && nl.dayInt){
			lines.push(`农历:${nl.year ? `${nl.year}年` : ''}${nl.leap ? '闰' : ''}${nl.monthInt}月${nl.dayInt}日`);
		}
		if(gz.length === 4){
			lines.push(`四柱:${gz[0]}年 ${gz[1]}月 ${gz[2]}日 ${gz[3]}时`);
		}
	}
	return lines;
}
