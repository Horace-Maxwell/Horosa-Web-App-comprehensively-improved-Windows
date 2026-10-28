// 本地后端身份握手 + 服务地址自愈再协商。
//
// 事故背景(2026-07-04 事故复盘):本地服务地址有三个来源(启动 URL ?srv= / localStorage 持久值 /
// 页面端口+1999 推导),历史实现对后两者从不验证「端口上到底是谁」。一旦端口被其它进程占用
// (陌生进程对任意路径回 200),前端把「毒 200」误判成「服务未就绪」,且「重试」死循环同一个
// 毒端口——排盘全断,报错自相矛盾(statusCode:200 却说不可达)。
//
// 铁律:本地服务地址永不盲信。换根前必须通过 GET /horosaIdentity 身份握手:
//   · app 标记必须是本应用后端(java='horosa-backend' / python='horosa-chart');
//   · 壳注入的启动 nonce(URL &sid= ↔ 后端环境 HOROSA_LAUNCH_NONCE)存在时必须一致,
//     同机多实例/陌生进程一律拒绝。
// 语义:verify-to-switch, never verify-to-block——握手只决定「要不要换、换到哪」,
// 绝不否决当前正在正常应答的根(旧版运行时无该端点=握手不过,但它只要能正常服务,
// 任何失败路径都不会触发到这里;真触发了也只是「原地不换」,零降级)。
//
// kill-switch:localStorage horosaBackendIdentityOff = '1' → 本模块全部旁路(退回旧行为)。

import {
	ServerRoot,
	LaunchSid,
	IsLocalHostEnv,
	applyLocalServerRoot,
	localServerRootCandidates,
} from './constants';
import { setKentangRootOverride } from '../integrations/kentang/serviceRoot';

const IDENTITY_PATH = '/horosaIdentity';
const IDENTITY_TIMEOUT_MS = 1200;
const RENEGOTIATE_THROTTLE_MS = 5000;
const KNOWN_APP_MARKS = ['horosa-backend', 'horosa-chart'];

export function identityCheckDisabled(){
	try{
		return typeof window !== 'undefined'
			&& window.localStorage
			&& window.localStorage.getItem('horosaBackendIdentityOff') === '1';
	}catch(e){
		return false;
	}
}

function fetchWithTimeout(url, ms){
	const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
	const timer = ctrl ? setTimeout(()=>{ ctrl.abort(); }, ms) : null;
	return fetch(url, {
		method: 'GET',
		cache: 'no-store',
		signal: ctrl ? ctrl.signal : undefined,
	}).finally(()=>{
		if(timer){ clearTimeout(timer); }
	});
}

// 对 root 做身份握手。返回 {ok, reason, app, nonce};网络失败/超时/非 JSON/标记不符/
// nonce 不符一律 ok:false(fail-closed:识别不了 = 不是我们的后端)。
export async function verifyBackendIdentity(root, opts){
	const options = opts || {};
	const expectSid = options.expectSid !== undefined ? `${options.expectSid || ''}` : `${LaunchSid || ''}`;
	const base = `${root || ''}`.replace(/\/$/, '');
	if(!/^https?:\/\/.+/i.test(base)){
		return { ok: false, reason: 'invalid-root' };
	}
	try{
		const resp = await fetchWithTimeout(`${base}${IDENTITY_PATH}`, options.timeoutMs || IDENTITY_TIMEOUT_MS);
		if(!resp || resp.status !== 200){
			return { ok: false, reason: `http-${resp ? resp.status : 'null'}` };
		}
		let data = null;
		try{
			data = JSON.parse(await resp.text());
		}catch(e){
			return { ok: false, reason: 'not-json' };
		}
		const app = data && data.app ? `${data.app}` : '';
		const nonce = data && data.nonce ? `${data.nonce}` : '';
		const expectApp = options.expectApp ? `${options.expectApp}` : '';
		if(expectApp ? app !== expectApp : KNOWN_APP_MARKS.indexOf(app) < 0){
			return { ok: false, reason: 'app-mark-mismatch', app };
		}
		if(expectSid && nonce !== expectSid){
			// 期望 nonce 在(壳启动注入)而对端给不出同值:陌生进程/别的星阙实例,拒绝。
			return { ok: false, reason: nonce ? 'nonce-mismatch' : 'nonce-missing', app, nonce };
		}
		return { ok: true, reason: 'ok', app, nonce };
	}catch(e){
		return { ok: false, reason: 'unreachable' };
	}
}

async function shellEndpoints(){
	try{
		if(typeof window === 'undefined'){
			return null;
		}
		const api = (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)
			? window.__TAURI__.core
			: ((window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) ? window.__TAURI_INTERNALS__ : null);
		if(!api){
			return null;
		}
		return await api.invoke('get_backend_endpoints');
	}catch(e){
		return null;
	}
}

let _inflight = null;
let _lastAt = 0;
let _lastOutcome = null;

// 再协商梯(单飞 + 5s 节流):
//   梯1 壳真值 get_backend_endpoints(桌面环境一步到位,顺带校 kentang/chart 根);
//   梯2 候选序(query > 存储 > 页面推导 > dev 9999)逐个身份握手,首个通过者当选。
// 全部不过 = 原地不换(changed:false),绝不把一个未验证的地址写进真值。
export async function renegotiateLocalServerRoot(trigger){
	if(!IsLocalHostEnv || identityCheckDisabled()){
		return null;
	}
	if(_inflight){
		return _inflight;
	}
	if(Date.now() - _lastAt < RENEGOTIATE_THROTTLE_MS){
		return _lastOutcome;
	}
	const run = (async()=>{
		const from = `${ServerRoot}`.replace(/\/$/, '');
		const finish = (outcome)=>{
			_lastOutcome = outcome;
			return outcome;
		};
		const shell = await shellEndpoints();
		if(shell && shell.srv){
			const v = await verifyBackendIdentity(shell.srv, {
				expectApp: 'horosa-backend',
				expectSid: shell.sid !== undefined ? shell.sid : undefined,
			});
			if(v.ok && applyLocalServerRoot(shell.srv, 'shell')){
				if(shell.kentangSrv){
					setKentangRootOverride(shell.kentangSrv);
				}
				const to = `${ServerRoot}`;
				return finish({ changed: to !== from, from, to, via: 'shell', trigger: trigger || '' });
			}
		}
		const candidates = localServerRootCandidates();
		for(let i = 0; i < candidates.length; i += 1){
			const cand = candidates[i];
			// eslint-disable-next-line no-await-in-loop
			const v = await verifyBackendIdentity(cand, { expectApp: 'horosa-backend' });
			if(v.ok && applyLocalServerRoot(cand, 'verified')){
				return finish({ changed: cand !== from, from, to: cand, via: 'probe', trigger: trigger || '' });
			}
		}
		return finish({ changed: false, from, to: from, via: 'none', trigger: trigger || '' });
	})();
	_inflight = run.finally(()=>{
		_inflight = null;
		_lastAt = Date.now();
	});
	return _inflight;
}

// 供测试复位模块内部状态。
export function __resetBackendIdentityForTests(){
	_inflight = null;
	_lastAt = 0;
	_lastOutcome = null;
}

// 启动静默自检:页面就绪后核一次当前根;不过则再协商(成功=后续请求全部落在正确地址,
// 用户完全无感)。verify-to-switch 语义下,旧运行时/慢启动都只是「原地不换」。
if(typeof window !== 'undefined' && IsLocalHostEnv){
	setTimeout(()=>{
		try{
			if(identityCheckDisabled()){
				return;
			}
			verifyBackendIdentity(ServerRoot, { expectApp: 'horosa-backend' }).then((v)=>{
				if(!v || !v.ok){
					const p = renegotiateLocalServerRoot('startup');
					if(p && p.catch){ p.catch(()=>{}); }
				}
			}).catch(()=>{});
		}catch(e){}
	}, 2500);
}
