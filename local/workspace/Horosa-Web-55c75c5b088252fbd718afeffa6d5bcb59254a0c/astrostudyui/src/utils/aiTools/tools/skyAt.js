// AI 助手·天文馆取数(工具回包,不是技法快照:小标题用「■」,不用 [段头]):任一时刻、任一地点的日月行星(与可选恒星)地平坐标 / 赤经赤纬 / 升中落,外加天光与月相。
// 与天文馆同一个后端接口(/planetarium/state,纯天文口径:回归黄道、无岁差制),只读;不载 3D 运行时。
import { fetchPlanetariumState } from '../../../services/planetarium';
import { detailPointName } from '../../chartDetails';
import { starDisplayLabel } from '../../../components/planetarium/planetariumStarSearch';
import { resolveCaseTimePlace } from './createCaseRecord';
import { datePartOf, toSlashDate } from '../../dateStrSafe';
import { GUIDE } from './_shared';

export const SKY_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node'];
const SKY_MODE = { day: '白昼', civil: '民用晨昏', nautical: '航海晨昏', astronomical: '天文晨昏', night: '夜' };

const num = (v, d = 2)=>(v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—');
// 后端(与天文馆同一口径)方位自正南起;对外一律换成自正北顺时针(与「细节」页行星细节表同)
const azN = (v)=>(v !== null && v !== undefined && Number.isFinite(Number(v)) ? num((Number(v) + 180) % 360) : '—');
const uniqById = (list)=>{ const seen = new Set(); return (list || []).filter((x)=>{ const k = x && (x.id || x.name); if(!k || seen.has(k)){ return false; } seen.add(k); return true; }); };
const rsText = (rs)=>{
	if(!rs){ return '—'; }
	const t = (x, none)=>(x && x.time ? x.time : none);
	return `升 ${t(rs.rise, '不升')} / 中天 ${t(rs.transit, '—')} / 落 ${t(rs.set, '不落')}`;
};

export function skyStateText(d, opts){
	const o = opts || {};
	const L = [];
	const ob = d.observer || {};
	L.push('■ 观测', `时间:${ob.date || ''} ${ob.time || ''}(${ob.zone || ''})· 地点:${ob.lat || ''} ${ob.lon || ''}${ob.locationName && ob.locationName !== '未命名地点' ? ` ${ob.locationName}` : ''}`);
	const sky = d.sky || {};
	const mp = sky.moonPhase || {};
	L.push(`天光:${SKY_MODE[sky.mode] || sky.mode || '—'}(太阳高度 ${num(sky.sunAltitude)}°)· 月相:${mp.phaseName || '—'},照亮 ${num((mp.illumination || 0) * 100, 1)}%,月龄 ${num(mp.ageDays, 1)} 日`, '');
	const want = Array.isArray(o.bodies) && o.bodies.length ? o.bodies : SKY_BODIES;
	const bodies = (d.bodies || []).filter((b)=>want.indexOf(b.id) >= 0).sort((a, b)=>want.indexOf(a.id) - want.indexOf(b.id));
	L.push('■ 日月行星', '| 天体 | 方位(北起) | 视高度 | 真高度 | 赤经 | 赤纬 | 黄经 | 星等 | 地平 | 升 / 中天 / 落 |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
	bodies.forEach((b)=>{
		L.push(`| ${detailPointName(b.id)} | ${azN(b.azimuth)}° | ${num(b.altitudeAppa)}° | ${num(b.altitudeTrue)}° | ${num(b.ra)}° | ${num(b.decl)}° | ${b.zodiacSign || ''} ${num(b.zodiacDegree)}° | ${num(b.mag)} | ${b.aboveHorizon ? '地平上' : '地平下'} | ${rsText(b.riseSet)} |`);
	});
	const stars = d.stars || {};
	if(o.fixedStars){
		const fixed = uniqById(stars.fixed).filter((s)=>!o.visibleOnly || Number(s.altitudeAppa) > 0);
		L.push('', '■ 恒星(星盘用的那组)', '| 星 | 方位(北起) | 视高度 | 赤经 | 赤纬 | 星等 |', '| --- | --- | --- | --- | --- | --- |');
		fixed.forEach((s)=>{ L.push(`| ${s.name || s.id}(${s.id}) | ${azN(s.azimuth)}° | ${num(s.altitudeAppa)}° | ${num(s.ra)}° | ${num(s.decl)}° | ${Array.isArray(s.mag) ? num(s.mag[0]) : num(s.mag)} |`); });
	}
	const n = Number(o.brightestStars) || 0;
	if(n > 0){
		const cat = uniqById(stars.catalog).filter((s)=>!o.visibleOnly || Number(s.altitudeAppa) > 0).slice().sort((a, b)=>Number(a.mag) - Number(b.mag)).slice(0, n);
		L.push('', `■ 亮星前 ${cat.length} 颗${o.visibleOnly ? '(地平上)' : ''}`, '| 星 | 方位(北起) | 视高度 | 赤经(J2000) | 赤纬(J2000) | 星等 | 光谱 |', '| --- | --- | --- | --- | --- | --- | --- |');
		cat.forEach((s)=>{ L.push(`| ${starDisplayLabel(s) || [s.name, s.bayer, s.constellation].filter(Boolean).join(' ') || s.id} | ${azN(s.azimuth)}° | ${num(s.altitudeAppa)}° | ${num(s.ra)}° | ${num(s.decl)}° | ${num(s.mag)} | ${s.spectralClass || ''} |`); });
	}
	L.push('', '方位自正北顺时针;视高度含大气折射;升中落为当地当日。');
	return L.join('\n');
}

export const skyAtTool = {
	name: 'sky_at',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 30000,
	description: `天文馆取数:任一时刻、任一地点的日月行星方位 / 高度(视、真)/ 赤经赤纬 / 黄经 / 升中落,天光与月相;可加星盘用的恒星组与按星等的亮星。与天文馆同一份后端计算(纯天文口径)。${GUIDE}:用户问「某时某地某星在天上哪儿、几点升落、能不能看到」时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			divTime: { type: 'string', maxLength: 60, description: '时刻,缺省 = 现在(观测地时区)' },
			calendar: { type: 'string', enum: ['solar', 'lunar'] },
			place: { type: 'string', maxLength: 80 },
			gpsLat: { type: 'number', minimum: -90, maximum: 90 },
			gpsLon: { type: 'number', minimum: -180, maximum: 180 },
			zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$' },
			bodies: { type: 'array', items: { type: 'string', enum: SKY_BODIES }, maxItems: 12, description: '只要这几颗(缺省全部)' },
			fixedStars: { type: 'boolean', default: false, description: '加星盘用的那组恒星' },
			brightestStars: { type: 'integer', minimum: 0, maximum: 60, default: 0, description: '加星表里最亮的 N 颗' },
			visibleOnly: { type: 'boolean', default: false, description: '恒星只列地平上的' },
		},
	},
	outputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, divTime: { type: 'string' }, zone: { type: 'string' } } },
	async run(args){
		const assumptions = [];
		const tp = await resolveCaseTimePlace(args || {}, assumptions);
		if(!tp.ok){ return tp.error; }
		const date = datePartOf(tp.divTime);
		const time = `${tp.divTime}`.slice(date.length).trim();
		const n = Number(args.brightestStars) || 0;
		let data;
		try{
			const rsp = await fetchPlanetariumState({
				date: toSlashDate(date), time: time || '12:00:00', zone: tp.z.zone,
				lat: tp.geo.lat, lon: tp.geo.lon, gpsLat: tp.geo.gpsLat, gpsLon: tp.geo.gpsLon, pos: tp.pos || null,
				hsys: 1, zodiacal: 0, siderealAyanamsa: '', doubingSu28: 0, southchart: 0,
				starLimit: n > 0 ? 9000 : 0, includeRiseSet: true,
			});
			data = rsp && rsp.Result ? rsp.Result : rsp;
		}catch(e){ data = null; }
		if(!data || !Array.isArray(data.bodies)){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '天文馆数据没取到(需本机计算服务在线)', retryable: true }; }
		const content = skyStateText(data, args);
		return { ok: true, data: { content, divTime: tp.divTime, zone: tp.z.zone }, summary: `天象 ${tp.divTime}`, assumptions };
	},
};

export default skyAtTool;
