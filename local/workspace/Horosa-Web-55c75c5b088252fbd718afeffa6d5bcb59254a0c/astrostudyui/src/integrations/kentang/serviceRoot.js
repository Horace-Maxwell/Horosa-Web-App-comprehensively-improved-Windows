import { ServerRoot } from '../../utils/constants';

export const KENTANG_SERVICE_CONFIG = {
	taiyi: {
		engine: 'kintaiyi',
		path: 'taiyi',
		queryKeys: ['taiyiSrv', 'kintaiyiSrv'],
		defaultLocalPort: 8898,
	},
	jinkou: {
		engine: 'kinjinkou',
		path: 'jinkou',
		queryKeys: ['jinkouSrv', 'kinjinkouSrv'],
		defaultLocalPort: 8898,
	},
	qimen: {
		engine: 'kinqimen',
		path: 'qimen',
		queryKeys: ['qimenSrv', 'kinqimenSrv'],
		defaultLocalPort: 8898,
	},
	wangji: {
		engine: 'kinwangji',
		path: 'wangji',
		queryKeys: ['wangjiSrv', 'huangjiSrv', 'kinwangjiSrv'],
		defaultLocalPort: 8898,
	},
	wuzhao: {
		engine: 'kinwuzhao',
		path: 'wuzhao',
		queryKeys: ['wuzhaoSrv', 'kinwuzhaoSrv'],
		defaultLocalPort: 8898,
	},
	taixuan: {
		engine: 'taixuanshifa',
		path: 'taixuan',
		queryKeys: ['taixuanSrv', 'taixuanshifaSrv'],
		defaultLocalPort: 8895,
	},
	jingjue: {
		engine: 'jingjue',
		path: 'jingjue',
		queryKeys: ['jingjueSrv'],
		defaultLocalPort: 8894,
	},
	shenyishu: {
		engine: 'shenyishu',
		path: 'shenyishu',
		queryKeys: ['shenyishuSrv'],
		defaultLocalPort: 8893,
	},
	geomancy: {
		engine: 'astronomical_geomancy',
		path: 'geomancy',
		queryKeys: ['geomancySrv'],
		defaultLocalPort: 8899,
	},
	xuanshi: {
		engine: 'xuanshi_history',
		path: 'xuanshi',
		queryKeys: ['xuanshiSrv'],
		defaultLocalPort: 8899,
	},
	shaozi: {
		engine: 'kinastro-shaozi',
		path: 'shaozi',
		queryKeys: ['shaoziSrv', 'shusuanSrv', 'kinastroSrv'],
		defaultLocalPort: 8892,
	},
	tieban: {
		engine: 'kinastro-tieban',
		path: 'tieban',
		queryKeys: ['tiebanSrv', 'shusuanSrv', 'kinastroSrv'],
		defaultLocalPort: 8892,
	},
	fendjing: {
		engine: 'kinastro-fendjing',
		path: 'fendjing',
		queryKeys: ['fendjingSrv', 'guiguSrv', 'shusuanSrv', 'kinastroSrv'],
		defaultLocalPort: 8892,
	},
	beiji: {
		engine: 'kinastro-beiji',
		path: 'beiji',
		queryKeys: ['beijiSrv', 'shusuanSrv', 'kinastroSrv'],
		defaultLocalPort: 8892,
	},
	nanji: {
		engine: 'kinastro-nanji',
		path: 'nanji',
		queryKeys: ['nanjiSrv', 'shusuanSrv', 'kinastroSrv'],
		defaultLocalPort: 8892,
	},
	chunzi: {
		engine: 'kinastro-chunzi',
		path: 'chunzi',
		queryKeys: ['chunziSrv', 'shusuanSrv', 'kinastroSrv'],
		defaultLocalPort: 8892,
	},
	xianqin: {
		engine: 'kinastro-xianqin',
		path: 'xianqin',
		queryKeys: ['xianqinSrv', 'yanqinSrv', 'kinastroSrv'],
		defaultLocalPort: 8892,
	},
	cetian: {
		engine: 'kinastro-cetian',
		path: 'cetian',
		queryKeys: ['cetianSrv', 'mingOtherSrv', 'kinastroSrv'],
		defaultLocalPort: 8892,
	},
	qizhengkin: {
		engine: 'kinastro-qizheng',
		path: 'qizhengkin',
		queryKeys: ['qizhengKinSrv', 'qizhengSrv', 'kinastroSrv'],
		defaultLocalPort: 8892,
	},
	// 天星择日双轮数据(webqizhengelectionsrv,挂在主 chart 服务 :8899,非 kentang vendor)
	qizhengelection: {
		engine: 'horosa-election',
		path: 'qizhengelection',
		queryKeys: ['qizhengElectionSrv'],
		defaultLocalPort: 8899,
	},
	// 天星择日·征象搜索(webelectionscansrv,挂在主 chart 服务 :8899,非 kentang vendor)
	electionscan: {
		engine: 'horosa-electionscan',
		path: 'electionscan',
		queryKeys: ['electionScanSrv'],
		defaultLocalPort: 8899,
	},
};

const COMMON_QUERY_KEYS = ['kentangSrv', 'chartSrv', 'kinSrv'];

// All kentang/kin engines (qimen/taiyi/jinkou/wangji/wuzhao/taixuan/jingjue/shenyishu/kinastro-*) are mounted
// on the single chart service (CHART_PORT, default 8899) — see astropy/websrv/webchartsrv.py
// `mount_kentang_services` and the release verifier `verify_kentang_runtime_endpoints.py --root CHART_PORT`.
// The per-engine `defaultLocalPort` values below are legacy (from when engines were separate microservices);
// for a local Java backend (:9999) every engine must resolve to the chart service port instead.
const LOCAL_KENTANG_CHART_PORT = 8899;

export function isValidHttpUrl(value){
	return !!(value && /^https?:\/\/.+/i.test(`${value}`));
}

export function replacePort(url, port){
	try{
		const u = new URL(url);
		u.port = `${port}`;
		return u.toString().replace(/\/$/, '');
	}catch(e){
		return url;
	}
}

function queryValue(keys){
	if(typeof window === 'undefined'){
		return '';
	}
	try{
		const params = new URLSearchParams(window.location.search || '');
		for(let i=0; i<keys.length; i++){
			const val = params.get(keys[i]);
			if(isValidHttpUrl(val)){
				return val.replace(/\/$/, '');
			}
		}
	}catch(e){}
	return '';
}

// 服务地址自愈(backendIdentity)拿到壳真值后写入的覆盖根:优先级在 query 之后、
// ServerRoot 派生之前——修「ServerRoot 被毒化时 kentang 全线跟着塌」的传导链。
let kentangRootOverride = '';

export function setKentangRootOverride(root){
	if(isValidHttpUrl(root)){
		kentangRootOverride = `${root}`.replace(/\/$/, '');
	}
}

export function getKentangRootOverride(){
	return kentangRootOverride;
}

export function resolveKentangServiceRoot(moduleKey){
	const config = KENTANG_SERVICE_CONFIG[moduleKey] || {};
	const explicit = queryValue([...(config.queryKeys || []), ...COMMON_QUERY_KEYS]);
	if(explicit){
		return explicit;
	}
	if(kentangRootOverride){
		return kentangRootOverride;
	}
	if(/:9999(?:\/)?$/i.test(ServerRoot)){
		return replacePort(ServerRoot, LOCAL_KENTANG_CHART_PORT);
	}
	return ServerRoot;
}

export function buildKentangEndpoint(moduleKey, action){
	const config = KENTANG_SERVICE_CONFIG[moduleKey] || {};
	const path = config.path || moduleKey;
	const route = action || 'pan';
	return `${resolveKentangServiceRoot(moduleKey)}/${path}/${route}`;
}
