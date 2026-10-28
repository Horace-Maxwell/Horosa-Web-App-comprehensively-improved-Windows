// 天文馆 · 观测时刻与请求参数:观测时间、请求参数(首开 / 播放同步 / 场景同步)、天象状态缓存。
// 只被 components/planetarium/PlanetariumBabylon.js 与同目录 babylon/ 下的兄弟模块引用。
import DateTime from '../../comp/DateTime';
import { STAR_MAG_LIMIT_MAX } from './constants';
import { observerFromFields, observerFromData } from './skyMath';

let planetariumStateCache = null;

export function buildObservationTime(fields){
	const dt = fields && fields.time && fields.time.value && fields.time.value.clone
		? fields.time.value.clone()
		: new DateTime();
	if(fields && fields.date && fields.date.value){
		const d = fields.date.value;
		dt.year = d.year;
		dt.month = d.month;
		dt.date = d.date;
		dt.ad = d.ad;
	}
	if(fields && fields.zone){
		dt.zone = fields.zone.value;
	}
	dt.calcJdn();
	return dt;
}

// extras(可选)= 升落/轨迹门控等附加字段。🔴零回归铁律:extras 默认 {} → 不传 include* 时请求体与原状字节级一致
// (后端 _truthy_flag 默认不开 → res 字节不变)。行星轨迹只在 React 侧开该层时注入 includeTrails;升落时刻每次请求都带(详情区始终显精确升落,见 planetariumExtras)。
// 按显示星等上限映射「应取星数」(BSC5 已按星等升序,starLimit=后端取最亮前 N)。默认 mag≤4(约520星)→取~800留余量,
// 使后端返回的星表 payload ~10x 变小 → 序列化 / RSA 加密 / 传输 / JSON.parse 全程提速 → 首次显星不再卡 4s
// (后端 _build_catalog_stars 仍全算后切片,故省的是大包的传输与加解密,这正是 4s 主因);
// 完整 8404 由 _starsWantFull 触发的后台补全请求拉齐(供按名搜索 + 拖星等滑块看暗星全程)。
export function starLimitForMag(magLimit){
	const m = Number(magLimit);
	if(!Number.isFinite(m) || m >= STAR_MAG_LIMIT_MAX){ return 9000; }
	if(m <= 4){ return 800; }
	if(m <= 4.5){ return 1300; }
	if(m <= 5){ return 2200; }
	if(m <= 5.5){ return 3800; }
	if(m <= 6){ return 6000; }
	return 9000;
}

export function buildRequestParams(fields, time, extras){
	return {
		date: time.format('YYYY/MM/DD'),
		time: time.format('HH:mm:ss'),
		ad: time.ad,
		zone: time.zone,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		name: fields.name ? fields.name.value : null,
		pos: fields.pos ? fields.pos.value : null,
		hsys: fields.hsys ? fields.hsys.value : 1,
		// 天文馆=纯天文,与星盘/七政四余绝对独立:黄道模式/岁差/宿度制 一律强制纯天文值,不继承图表设置
		// (否则选恒星黄道或七政宿度制时,二十八宿会落到黄道线上)。仅借 hsys(宫位)+ 观测地/时间。
		zodiacal: 0, siderealAyanamsa: '',
		doubingSu28: 0,
		southchart: 0,
		starLimit: 9000,
		...(extras || {}),
	};
}

export function buildInitialSceneParams(fields, time, extras){
	return {
		...buildRequestParams(fields, time, extras),
		starLimit: 0,
		includeOverlays: false,
		includeTraditions: false,
	};
}

export function buildPlaybackSyncParams(fields, time, extras){
	return {
		...buildRequestParams(fields, time, extras),
		starLimit: 0,
		includeOverlays: false,
		includeTraditions: false,
	};
}

export function buildSceneSyncParams(fields, time, extras){
	return {
		...buildRequestParams(fields, time, extras),
		starLimit: 0,
		includeOverlays: true,
		includeTraditions: true,
	};
}

function clonePlanetariumState(data){
	if(!data){
		return null;
	}
	try{
		return JSON.parse(JSON.stringify(data));
	}catch(err){
		return data;
	}
}

export function cachePlanetariumState(data){
	if(!data || data.err){
		return;
	}
	const rendered = data.meta && Number(data.meta.renderedCatalogCount || 0);
	if(rendered <= 0){
		return;
	}
	planetariumStateCache = clonePlanetariumState(data);
}

export function getCachedPlanetariumState(){
	return clonePlanetariumState(planetariumStateCache);
}

// 缓存是否仍对得上当前「时刻 + 观测点」(T-202):模块级缓存只带一份天象,重进页面 / 换命盘 / 玄学史联动后时刻地点已换,
// 星表可复用(J2000 静态)但日月行星 / 宫位 / 天空必须按当前时刻地点重取,否则标题是新时刻、星体还是缓存那一刻。
export function cachedStateMatches(cached, time, fields){
	if(!cached || !cached.observer){ return false; }
	const jdNow = time ? (time.jdn || (time.calcJdn && time.calcJdn())) : null;
	const jdCached = Number(cached.observer.jd);
	if(!Number.isFinite(jdNow) || !Number.isFinite(jdCached) || Math.abs(jdNow - jdCached) > (1 / 1440)){ return false; }
	const want = observerFromFields(fields, null);
	const have = observerFromData(cached.observer);
	return Math.abs((want.lat || 0) - (have.lat || 0)) < 0.01 && Math.abs((want.lon || 0) - (have.lon || 0)) < 0.01;
}
