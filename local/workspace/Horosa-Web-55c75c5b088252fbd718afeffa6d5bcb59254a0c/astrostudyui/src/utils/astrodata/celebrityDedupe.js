// 名人库建档单源:页面「加入命盘」与 AI 建档(create_celebrity_chart)同一去重判据、同一条记录构造。
// 去重:先按名人库编号(页面导入的记录 cid = adb-…;两条路径新建的记录都另记 celebrityId = 编号,
// 改了名字 / 生辰也认得出),再按同名同生辰(生辰取前 16 位,到分钟)。
// 此前页面按编号覆盖、AI 按同名同生辰,两条路径各建一条 → 同一人出两条档案。
import { listLocalCharts } from '../localcharts';
import { nowStr } from '../localRecordStore';
import { withNewChartDefaults } from '../newChartCapture';

export const CELEBRITY_NO_TIME_NOTE = '出生时辰未知,按正午 12:00 建档;上升 / 宫位不可用';
// 名人库同编号重复导入时只刷新这些出生数据键
export const CELEBRITY_REFRESH_KEYS = ['birth', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon', 'pos'];
// 名人库页单独打开(不在软件里)时复制出的命盘 JSON,每条带这个标志:在命盘列表「导入」时按软件内「导入为命盘」处理
export const CELEBRITY_IMPORT_HINT_KEY = 'importAsNewChart';

// 备注:第一行写来源与 Rodden 评级(有回源链接就带上),出生时辰未知另起一行说明
export function celebrityMemo({ rodden, sourceUrl, hasTime } = {}){
	const lines = [`来自名人库(Astro-Databank,Rodden ${rodden || '?'})${sourceUrl ? `:${sourceUrl}` : ''}`];
	if(hasTime === false){ lines.push(CELEBRITY_NO_TIME_NOTE); }
	return lines.join('\n');
}

// 名人建档的记录值(两条路径共用):补备注、整理分组;不写死宿度制等任何排盘设置 ——
// 按「此刻点新命盘会用的设置」随盘记下并打代次标记(与页面新建同一个人一致)。chart 里已有的键不覆盖。
export function buildCelebrityChartValues(chart, { rodden, sourceUrl, hasTime } = {}){
	const v = { ...(chart || {}) };
	const given = `${v.memo || ''}`.trim();
	const memo = celebrityMemo({ rodden, sourceUrl, hasTime: given ? undefined : hasTime });
	v.memo = given && given !== memo ? `${memo}\n${given}` : memo;
	if(Array.isArray(v.group)){ v.group = v.group.map((t)=>`${t}`.trim()).filter(Boolean); }
	return withNewChartDefaults(v, { forStore: true });
}

export function findCelebrityChart({ id, name, birth } = {}){
	const all = listLocalCharts({ includeArchived: true }) || [];
	if(id){
		const sid = `${id}`;
		// 名人库编号:cid 精确命中(本页导入的那条)优先 —— 同号的还可能有用户另存的副本、改过生辰的校正版;
		// 其次按 celebrityId(AI 建档 / 改过名的),同号多条时未归档的优先。
		const exact = all.find((r)=>r && r.cid === sid);
		if(exact){ return exact; }
		const linked = all.filter((r)=>r && r.celebrityId === sid);
		if(linked.length){ return pickStable(linked); }
	}
	const nm = `${name || ''}`.trim();
	const key = `${birth || ''}`.slice(0, 16);
	if(!nm || !key){ return null; }
	const same = all.filter((r)=>r && `${r.name || ''}`.trim() === nm && `${r.birth || ''}`.slice(0, 16) === key);
	return same.length ? pickStable(same) : null;
}

// 同一人多条时取法稳定、不随列表顺序(置顶 / 最近更新会改顺序)变:未归档优先,再取最早建的那条
// (本机新建 cid = local-<毫秒>-…;非本机形态的 cid,如名人库编号,视为最早)。
function createdAtOf(r){
	const m = /^local-(\d+)-/.exec(`${(r && r.cid) || ''}`);
	return m ? Number(m[1]) : 0;
}
function pickStable(list){
	const live = list.filter((r)=>r.archived !== true);
	const pool = live.length ? live : list;
	return pool.slice().sort((a, b)=>createdAtOf(a) - createdAtOf(b))[0] || null;
}

export default { findCelebrityChart, buildCelebrityChartValues };

// 命盘列表「导入」一份带名人库标志的 JSON(名人库页单独打开时复制出来的):与软件内「导入为命盘」同一套 ——
// 新人按「此刻点新命盘会用的设置」补齐并打代次标记;已有这位(名人库编号精确命中)只刷新出生时刻与地点,
// 名字、分组、性别、备注与随盘设置保持你的,也不给旧档补代次标记(此前整条按备份合并,旧档被补上标记,
// 载入时缺的设置从「保持当前值」变成「出厂默认」);在归档里的、或已按同名同生辰建过的(另一条)不动。
// 不带标志的条目(真备份)原样。返回新的信封与跳过条数。
export function prepareCelebrityChartsImport(payload){
	const list = payload && Array.isArray(payload.charts) ? payload.charts : null;
	if(!list || !list.some((c)=>c && typeof c === 'object' && c[CELEBRITY_IMPORT_HINT_KEY])){
		return { payload, skipped: 0 };
	}
	let skipped = 0;
	const charts = [];
	list.forEach((c)=>{
		if(!c || typeof c !== 'object' || !c[CELEBRITY_IMPORT_HINT_KEY]){ charts.push(c); return; }
		const rest = { ...c };
		delete rest[CELEBRITY_IMPORT_HINT_KEY];
		const existing = findCelebrityChart({ id: rest.celebrityId || rest.cid, name: rest.name, birth: rest.birth });
		if(existing && (existing.archived === true || existing.cid !== rest.cid)){ skipped += 1; return; }
		if(existing){
			// 与软件内刷新同:更新时间记成此刻(导入通道默认保留原更新时间,这条就不浮到列表前面)
			const patch = { cid: existing.cid, celebrityId: rest.celebrityId || rest.cid, updateTime: nowStr() };
			CELEBRITY_REFRESH_KEYS.forEach((k)=>{ if(rest[k] !== undefined){ patch[k] = rest[k]; } });
			charts.push(patch);
			return;
		}
		// 分组去掉空项(评级为空时页面给的是空串,软件内加入同样滤掉)
		if(Array.isArray(rest.group)){ rest.group = rest.group.map((t)=>`${t}`.trim()).filter(Boolean); }
		charts.push(withNewChartDefaults(rest, { forStore: true }));
	});
	return { payload: { ...payload, charts, total: charts.length }, skipped };
}
