// export const ServerRoot = 'http://zyqspace.7766.org:9999';
// export const MobileServer = 'http://zyqspace.7766.org:8099';
// export const Chart3DServer = 'http://zyqspace.7766.org:8888';
// export const WebSockServer = 'ws://zyqspace.7766.org:26900/ws';
// export const RtmpPushServer = 'rtmp://zyqspace.7766.org:1935';
// export const RtmpPlayServer = 'http://zyqspace.7766.org:18888';
// export const HasRtspPlayer = true;


const isLocalHost =
	typeof window !== 'undefined' &&
	(
		window.location.protocol === 'file:' ||
		window.location.hostname === 'localhost' ||
		window.location.hostname === '127.0.0.1'
	);

function resolveLocalServerRoot(){
	if(typeof window === 'undefined'){
		return 'http://127.0.0.1:9999';
	}
	const storageKey = 'horosaLocalServerRoot';
	const deriveFromPagePort = () => {
		try{
			const portTxt = `${window.location.port || ''}`.trim();
			if(!/^\d+$/.test(portTxt)){
				return null;
			}
			const webPort = parseInt(portTxt, 10);
			if(!(webPort > 0)){
				return null;
			}
			const backendPort = webPort + 1999;
			if(!(backendPort > 0)){
				return null;
			}
			return `http://127.0.0.1:${backendPort}`;
		}catch(e){
			return null;
		}
	};
	let serverRoot = null;
	try{
		const params = new URLSearchParams(window.location.search || '');
		const fromQuery = params.get('srv');
		if(fromQuery && /^https?:\/\/.+/i.test(fromQuery)){
			serverRoot = fromQuery;
			window.localStorage && window.localStorage.setItem(storageKey, serverRoot);
		}
	}catch(e){}
	if(!serverRoot){
		const fromPage = deriveFromPagePort();
		if(fromPage){
			serverRoot = fromPage;
			try{
				window.localStorage && window.localStorage.setItem(storageKey, serverRoot);
			}catch(e){}
		}
	}
	if(!serverRoot){
		try{
			const fromStorage = window.localStorage && window.localStorage.getItem(storageKey);
			if(fromStorage && /^https?:\/\/.+/i.test(fromStorage)){
				serverRoot = fromStorage;
			}
		}catch(e){}
	}
	return serverRoot || 'http://127.0.0.1:9999';
}

function resolveLocalChartServerRoot(){
	if(typeof window === 'undefined'){
		return 'http://127.0.0.1:8899';
	}
	const storageKey = 'horosaLocalChartServerRoot';
	const deriveFromPagePort = () => {
		try{
			const portTxt = `${window.location.port || ''}`.trim();
			if(!/^\d+$/.test(portTxt)){
				return null;
			}
			const webPort = parseInt(portTxt, 10);
			if(!(webPort > 0)){
				return null;
			}
			const chartPort = webPort + 899;
			if(!(chartPort > 0)){
				return null;
			}
			return `http://127.0.0.1:${chartPort}`;
		}catch(e){
			return null;
		}
	};
	const deriveFromServerRoot = () => {
		try{
			const srvRoot = resolveLocalServerRoot();
			const url = new URL(srvRoot);
			const backendPort = parseInt(url.port || '0', 10);
			if(!(backendPort > 0)){
				return null;
			}
			const chartPort = backendPort - 1100;
			if(!(chartPort > 0)){
				return null;
			}
			return `${url.protocol}//${url.hostname}:${chartPort}`;
		}catch(e){
			return null;
		}
	};
	let chartRoot = null;
	try{
		const params = new URLSearchParams(window.location.search || '');
		const fromQuery = params.get('chart');
		if(fromQuery && /^https?:\/\/.+/i.test(fromQuery)){
			chartRoot = fromQuery;
			window.localStorage && window.localStorage.setItem(storageKey, chartRoot);
		}
	}catch(e){}
	if(!chartRoot){
		chartRoot = deriveFromPagePort() || deriveFromServerRoot();
		if(chartRoot){
			try{
				window.localStorage && window.localStorage.setItem(storageKey, chartRoot);
			}catch(e){}
		}
	}
	if(!chartRoot){
		try{
			const fromStorage = window.localStorage && window.localStorage.getItem(storageKey);
			if(fromStorage && /^https?:\/\/.+/i.test(fromStorage)){
				chartRoot = fromStorage;
			}
		}catch(e){}
	}
	return chartRoot || 'http://127.0.0.1:8899';
}

export const ServerRoot = isLocalHost ? resolveLocalServerRoot() : 'https://srv.horosa.com';
export const ChartServerRoot = isLocalHost ? resolveLocalChartServerRoot() : ServerRoot;
export const MobileServer = 'https://mobileweb.horosa.com';
export const Chart3DServer = 'https://chart3d.horosa.com';
export const WebSockServer = 'ws://www.horosa.com:26900/ws';
export const RtmpPushServer = 'https://rtmpush.horosa.com';
export const RtmpPlayServer = 'https://rtmp.horosa.com';
export const HasRtspPlayer = false;

// export const ServerRoot = 'http://localhost:9999';

export const NeedEncrypt = true;

export const NeedWS = false;

export const ResultCodeKey = 'ResultCode';
export const ResultKey = 'Result';
export const ResultMessageKey = 'Result';
export const TokenKey = 'Token';
export const UserDataKey = 'UserData';
export const LoginIdKey = 'LoginId';
export const NeedLoginKey = 'NeedLogin';

export const SignatureKey = 'FE45AB6E29EF';

export const ClientChannel = '1';
export const ClientApp = '1';
export const ClientVer = '1.0';

export const AMapKey = '6a8a4bc072c3c948bf85167b66b09bfd';
export const AMapVer = '2.0';
export const AMapUIVer = '1.1';

export const DefLat = '26n04';
export const DefLon = '119e19';
export const DefGpsLat = 26.076417371316914;
export const DefGpsLon = 119.31516153077507;

export const AccessDenyCode = 900;
export const UploadFailCode = 800;

export const TableOddRowBgColor = '#dffff6';

export const TimeInterval = 15000;

export const EmailRegex = new RegExp("(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])");
export const GlobalSetupKey = 'globalSetup';

export const HomePageKey = 'pchomepage';
