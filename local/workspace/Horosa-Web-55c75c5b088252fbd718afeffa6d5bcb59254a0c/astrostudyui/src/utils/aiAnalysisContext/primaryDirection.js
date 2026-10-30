// AI 分析挂载上下文 · 主限法盘快照(无头):度数文本、出生时刻、年龄弧换算、盘设置段 —— 与主限法页面抄本逐字保持一致,整段原样搬迁。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import DateTime from '../../components/comp/DateTime';
import request from '../request';
import * as Constants from '../constants';
import { buildStarAndLotPositionLines, buildHouseCuspLines } from '../astroAiSnapshot';
import * as AstroConst from '../../constants/AstroConst';   // 主限法盘无头快照的黄道/宫制标签(纯常量,零组件依赖)
import { defaultPdChartDateTime } from '../../components/astro/AstroPrimaryDirectionChart';
// P5 主限法盘快照：弧算法 / 盘面宫制 / 度数换算的中文标签 + 默认（纯 util，无组件依赖、不回环 aiAnalysisContext）。
import {
	getPdTimeKeyLabel, DEFAULT_PD_METHOD, DEFAULT_PD_TIME_KEY, DEFAULT_PD_TYPE, DEFAULT_PD_PROJECTION, DEFAULT_PD_FRAME,
	PD_FRAME_LABELS, pickPdExtraSettings, pdProjectionLabelWithGeometry,
	PD_EXTRA_SETTING_SPECS, pdExtraSettingValueLabel, pdChartDateRequestParams,
} from '../primaryDirectionSync';

const PD_YEAR_DAYS_SPEC = PD_EXTRA_SETTING_SPECS.find((s)=>s.key === 'pdYearDays');

// P5 主限法盘快照（无头）：取含主限法的西洋盘 → 把「所选时刻」换算成主限年龄弧 → 出 [主限法盘设置] 段。
// 搬自 AstroPrimaryDirectionChart.js 的盘快照逻辑（buildSnapshotText + getPdArcFromDate）——纯文本快照，
// 不真正套盘渲染；datetime 缺省（空）→ 取此刻（=组件默认 buildDefaultDateTime≈本命+当前年龄，这里用此刻近似，
// 与表格 fallthrough 旧行为相比是「真盘设置段」而非「表格行」，修正了盘喂表格的 Bug）。
function pdSplitDegreeText(value){
	const num = Number(value);
	if(!Number.isFinite(num)){
		return `${value || ''}`;
	}
	const neg = num < 0 ? '-' : '';
	const abs = Math.abs(num);
	const deg = Math.floor(abs + 1e-12);
	let minute = Math.round((abs - deg) * 60);
	if(minute >= 60){
		return `${neg}${deg + 1}度0分`;
	}
	return `${neg}${deg}度${minute}分`;
}
function pdBirthDateTime(chartObj){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const birth = `${params.birth || ''}`.trim();
	const parts = birth.split(' ');
	if(parts.length < 2){
		return null;
	}
	let text = `${parts[0]} ${parts[1]}`;
	if(parts[1].split(':').length === 2){
		text = `${text}:00`;
	}
	try{
		const dt = new DateTime().parse(text, 'YYYY-MM-DD HH:mm:ss');
		if(params.zone){
			dt.zone = params.zone;
			dt.calcJdn();
		}
		return dt;
	}catch(e){
		return null;
	}
}
function pdJdnFromArc(birthDt, arc){
	if(!birthDt){
		return 0;
	}
	const magnitude = Math.abs(Number(arc));
	if(!Number.isFinite(magnitude)){
		return birthDt.jdn;
	}
	const years = Math.floor(magnitude + 1e-12);
	const fraction = magnitude - years;
	const whole = birthDt.clone();
	whole.addYear(years);
	const next = birthDt.clone();
	next.addYear(years + 1);
	const wholeDays = whole.jdn - birthDt.jdn;
	const spanDays = next.jdn - whole.jdn;
	return birthDt.jdn + wholeDays + fraction * spanDays;
}
function pdArcFromDate(birthDt, currentDt){
	if(!birthDt || !currentDt){
		return 0;
	}
	const target = Number(currentDt.jdn);
	if(!Number.isFinite(target) || target <= birthDt.jdn){
		return 0;
	}
	let low = 0;
	let high = Math.max(1, Math.ceil((target - birthDt.jdn) / 365) + 2);
	for(let i=0; i<16; i++){
		if(pdJdnFromArc(birthDt, high) >= target){
			break;
		}
		high *= 2;
	}
	for(let i=0; i<64; i++){
		const mid = (low + high) / 2;
		const midJd = pdJdnFromArc(birthDt, mid);
		if(midJd < target){
			low = mid;
		}else{
			high = mid;
		}
	}
	return (low + high) / 2;
}
// 把所选时刻字符串解析为 DateTime（套本命时区）；空 → 此刻。
function pdCurrentDateTime(chartObj, datetimeStr){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const txt = `${datetimeStr || ''}`.trim();
	// 空 + 没有页面缺省 → 「此刻」按本命时区换算(DateTime.nowForChart);此前东八区钟面再改贴本命时区,非东八区盘错开时差
	const dt = txt ? new DateTime() : DateTime.nowForChart(params.zone);
	try{
		if(txt){
			dt.parse(txt.split(':').length === 2 ? `${txt}:00` : txt, 'YYYY-MM-DD HH:mm:ss');
		}else{
			// 缺省时刻与页面「时间选择」同律:首条主限到达日期,无则出生次日(此前无头=此刻 → 同盘两路 Arc 不同)。
			const pageDefault = defaultPdChartDateTime(chartObj);
			if(pageDefault){ return pageDefault; }
		}
		if(params.zone){
			dt.zone = params.zone;
			dt.calcJdn();
		}
		return dt;
	}catch(e){
		return dt;
	}
}
// 生成单一时刻的主限法盘快照段（chartObj 须含 params.birth）。opts: { datetime, pdMethod, pdTimeKey, direction }。
// 无头快照曾是独立阉割实现:缺 [本命盘配置]/[主限法盘配置]/黄道/宫制 —— AI 挂载拿到的
// 主限法盘没有任何星曜/宫位数据。现与页面 buildSnapshotText(AstroPrimaryDirectionChart)同段构成:
// 本命段复用 astroAiSnapshot 同两条 line-builder;外圈盘镜像页面 buildRequestParams POST /predict/pdchart
// (fail → '无（推导盘获取失败）' best-effort,不阻断其余段)。组件实产 6 段=preset 6 段,零登记变更。
export async function buildPrimaryDirChartSnapshotText(chartObj, opts){
	if(!chartObj){
		return '';
	}
	const o = opts && typeof opts === 'object' ? opts : {};
	const params = chartObj.params || {};
	const chart = chartObj.chart || {};
	if(!params.birth){
		return '';
	}
	const pdMethod = `${o.pdMethod || params.pdMethod || DEFAULT_PD_METHOD}`;
	// 两维取显式值(与主限法表、主限法盘页同口径);外圈宫头只看盘面宫制,弧算法只作自陈
	const pdProjection = `${o.pdProjection || params.pdProjection || DEFAULT_PD_PROJECTION}`;
	const pdFrame = `${o.pdFrame || params.pdFrame || DEFAULT_PD_FRAME}`;
	const pdGeometry = pickPdExtraSettings({ pdGeometry: o.pdGeometry !== undefined ? o.pdGeometry : params.pdGeometry }).pdGeometry;
	const pdTimeKey = `${o.pdTimeKey || params.pdTimeKey || DEFAULT_PD_TIME_KEY}`;
	// User 档自定义钥匙率:齿轮 > 存档;缺=不带(后端回落 1.0)
	const pdTimeKeyCustomRaw = (o.pdTimeKeyCustom !== undefined && o.pdTimeKeyCustom !== null && `${o.pdTimeKeyCustom}` !== '') ? o.pdTimeKeyCustom : params.pdTimeKeyCustom;
	const pdTimeKeyCustom = (pdTimeKey === 'User' && Number(pdTimeKeyCustomRaw) > 0) ? Number(pdTimeKeyCustomRaw) : null;
	const direction = `${o.direction || params.direction || 'direct'}`;
	const currentDt = pdCurrentDateTime(chartObj, o.datetime);
	const birthDt = pdBirthDateTime(chartObj);
	const currentArc = pdArcFromDate(birthDt, currentDt);
	const lines = [];
	lines.push('[出生时间]');
	lines.push(`出生时间：${params.birth || '无'}`);
	lines.push('');
	lines.push('[星盘信息]');
	lines.push(`经纬度：${`${params.lon || ''} ${params.lat || ''}`.trim() || '无'}`);
	lines.push(`时区：${params.zone || '无'}`);
	// 黄道/宫制(与页面 buildSnapshotText 同表达式;缺省不产行)
	const zodiacalRaw = chart.zodiacal || AstroConst.ZODIACAL[`${params.zodiacal}`];
	if(zodiacalRaw){
		const ayanKey = params.siderealAyanamsa || chart.siderealAyanamsa || '';
		lines.push(`黄道：${AstroConst.zodiacalDisplayText(zodiacalRaw, ayanKey)}`);
	}
	const hsysLabel = AstroConst.HouseSys[`${params.hsys}`] || chart.hsys;
	if(hsysLabel){
		lines.push(`宫制：${hsysLabel}`);
	}
	lines.push('');
	lines.push('[主限法盘设置]');
	lines.push(`时间选择：${currentDt ? currentDt.format('YYYY-MM-DD HH:mm:ss') : '无'}`);
	lines.push(`弧算法（主限法表用）：${pdProjectionLabelWithGeometry({ ...params, pdProjection, pdFrame }, pdGeometry) || 'Ptolemy（半弧）'}`);
	lines.push(`盘面宫制（外圈宫头）：${PD_FRAME_LABELS[pdFrame] || pdFrame}`);
	lines.push(`度数换算：${getPdTimeKeyLabel(pdTimeKey)}`);
	lines.push(`向运方向：${direction === 'converse' ? '逆向 Converse' : '顺向 Direct'}`);
	// 日期年长(与页面同一行;外圈请求同带)
	const dateSettings = pdChartDateRequestParams(o, params);
	lines.push(`${PD_YEAR_DAYS_SPEC.label}：${pdExtraSettingValueLabel(PD_YEAR_DAYS_SPEC, pickPdExtraSettings(dateSettings).pdYearDays)}`);
	// 「当前Arc」页面优先取推导盘回的 arc(经度数换算 pdTimeKey),无则按日期反解。
	// 无头旧实现只会反解 → 非 Ptolemy 钥匙时快照 Arc 与页面对不上。先占位,取回推导盘后改写本行。
	const currentArcLineIdx = lines.length;
	lines.push(`当前Arc：${pdSplitDegreeText(currentArc)}`);
	lines.push('');
	// 本命盘配置(内圈):行星落座 + 宫位宫头(与页面同两条 line-builder)。
	// typeof 守卫=仓内范式:测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),缺函数回 []。
	const safeLines = (fn, co)=>(typeof fn === 'function' ? (fn(co) || []) : []);
	lines.push('[本命盘配置]');
	const natalStars = safeLines(buildStarAndLotPositionLines, chartObj);
	const natalHouses = safeLines(buildHouseCuspLines, chartObj);
	if(natalStars.length){ lines.push('星与虚点'); lines.push(...natalStars); }
	if(natalHouses.length){ lines.push('宫位宫头'); lines.push(...natalHouses); }
	if(!natalStars.length && !natalHouses.length){ lines.push('无'); }
	lines.push('');
	// 主限法盘配置(外圈):镜像页面 buildRequestParams 取推导盘;失败降级为一行说明。
	lines.push('[主限法盘配置]');
	let dirChart = null;
	try{
		const birthParts = `${params.birth}`.split(' ');
		const reqBody = {
			date: birthParts[0],
			time: birthParts[1] || '00:00:00',
			ad: params.ad ? params.ad : 1,
			zone: params.zone,
			// dirZone 取所选时刻自身的时区(与页面 buildRequestParams 同律):
			// 缺省时刻来自主限法表的「日期」列=UTC 墙钟(PD_DISPLAY_ZONE '+00:00'),
			// 旧写法一律按本命时区送 → 同一盘的无头外圈比页面差一个时区偏移。
			dirZone: (currentDt && currentDt.zone) || params.zone,
			lon: params.lon,
			lat: params.lat,
			gpsLat: params.gpsLat,
			gpsLon: params.gpsLon,
			hsys: params.hsys,
			zodiacal: params.zodiacal, siderealAyanamsa: params.siderealAyanamsa,
			tradition: params.tradition,
			pdtype: DEFAULT_PD_TYPE,
			pdMethod,
			// 两维显式发送(曾经经旧单维方法推导:方法停在缺省时宫制一律被打回 Alcabitius)
			pdProjection,
			pdFrame,
			pdTimeKey,
			...(pdTimeKeyCustom ? { pdTimeKeyCustom } : {}),
			showPdBounds: params.showPdBounds,
			...dateSettings,
			datetime: currentDt ? currentDt.format('YYYY-MM-DD HH:mm:ss') : '',
			direction,
		};
		if(reqBody.date && reqBody.datetime){
			const data = await request(`${Constants.ServerRoot}/predict/pdchart`, {
				body: JSON.stringify(reqBody),
				silent: true,
				timeoutMs: 20000,
			});
			const unwrapped = data && data.Result ? data.Result : data;
			dirChart = unwrapped && !unwrapped.err && unwrapped.chart ? unwrapped : null;
			if(dirChart && Number.isFinite(Number(dirChart.arc))){
				lines[currentArcLineIdx] = `当前Arc：${pdSplitDegreeText(Number(dirChart.arc))}`;   // 与页面同源
			}
		}
	}catch(e){
		dirChart = null;
	}
	const dirStars = dirChart ? safeLines(buildStarAndLotPositionLines, dirChart) : [];
	const dirHouses = dirChart ? safeLines(buildHouseCuspLines, dirChart) : [];
	if(dirStars.length){ lines.push('星与虚点'); lines.push(...dirStars); }
	if(dirHouses.length){ lines.push('宫位宫头'); lines.push(...dirHouses); }
	if(!dirStars.length && !dirHouses.length){ lines.push('无（推导盘获取失败或后端不可用）'); }
	lines.push('');
	lines.push('[主限法盘说明]');
	lines.push('左侧双盘内圈为本命盘，外圈为按当前主限法设置和所选时间推导出的主限法盘位置。');
	lines.push('当前页面会先将所选时间换算为主限年龄弧，再按后台主限法算法推进各星曜与虚点，最后统一投影回黄道后与本命盘套盘显示。');
	return lines.join('\n');
}
