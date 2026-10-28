// 无头模式的本机计算服务地址(单一来源):「探测哪个口」「起服务脚本起在哪个口」「运行时把请求发往哪个口」都只从这里取。
//   · HOROSA_SERVER_ROOT(Java 计算服务根,可带主机)> HOROSA_SERVER_PORT > 缺省 9999;
//   · HOROSA_CHART_PORT(Python 排盘 / 卜类 / 玄史服务)> 缺省 8899;它的根与 Java 根同主机;
//   · 两处同时给了 Java 端口而不一致、端口不是 1–65535 的整数、根不是 http(s) 地址 → 用法错(不悄悄拼出 NaN 或连到别的口);
//   · 根的主机不是本机回环 → remote = true:不自动起 / 不重启本机服务,只提示;
//   · localhost 规范成 127.0.0.1(不经名字解析);本机回环探测两个地址族都试(probeHosts)。
// 起服务脚本(start_horosa_local.sh)只认 HOROSA_SERVER_PORT / HOROSA_CHART_PORT:backendEnv 把解析结果显式写回这两个变量。
'use strict';

const DEFAULT_SERVER_PORT = 9999;
const DEFAULT_CHART_PORT = 8899;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

class PortConfigError extends Error{
	constructor(message){ super(message); this.name = 'PortConfigError'; this.code = 'E_PORT_CONFIG'; }
}

function parsePort(raw, name){
	const s = `${raw}`.trim();
	if(!/^\d{1,5}$/.test(s)){ throw new PortConfigError(`${name}=${JSON.stringify(`${raw}`)} 不是端口号(要 1–65535 的整数)`); }
	const n = Number(s);
	if(n < 1 || n > 65535){ throw new PortConfigError(`${name}=${s} 超出端口范围(1–65535)`); }
	return n;
}

function present(v){ return v !== undefined && v !== null && `${v}`.trim() !== ''; }

// opts(测试 / 调用方显式给的,优先于环境变量):{ serverRoot, serverPort, chartPort };env 缺省 process.env
function backendPorts(opts, env){
	const o = opts || {};
	const e = env || process.env;
	const rootRaw = present(o.serverRoot) ? o.serverRoot : (present(e.HOROSA_SERVER_ROOT) ? e.HOROSA_SERVER_ROOT : '');
	const portRaw = present(o.serverPort) ? o.serverPort : (present(e.HOROSA_SERVER_PORT) ? e.HOROSA_SERVER_PORT : '');
	const chartRaw = present(o.chartPort) ? o.chartPort : (present(e.HOROSA_CHART_PORT) ? e.HOROSA_CHART_PORT : '');
	const chart = chartRaw === '' ? DEFAULT_CHART_PORT : parsePort(chartRaw, 'HOROSA_CHART_PORT');
	let server = portRaw === '' ? DEFAULT_SERVER_PORT : parsePort(portRaw, 'HOROSA_SERVER_PORT');
	let protocol = 'http:';
	let host = '127.0.0.1';
	let serverRoot = '';
	if(rootRaw !== ''){
		const text = `${rootRaw}`.trim().replace(/\/+$/, '');
		let u;
		try{ u = new URL(text); }catch(err){ throw new PortConfigError(`HOROSA_SERVER_ROOT=${JSON.stringify(text)} 不是 http(s) 地址`); }
		if(u.protocol !== 'http:' && u.protocol !== 'https:'){ throw new PortConfigError(`HOROSA_SERVER_ROOT=${JSON.stringify(text)} 不是 http(s) 地址`); }
		const rootPort = u.port ? parsePort(u.port, 'HOROSA_SERVER_ROOT 的端口') : (u.protocol === 'https:' ? 443 : 80);
		if(portRaw !== '' && rootPort !== server){
			throw new PortConfigError(`HOROSA_SERVER_ROOT(端口 ${rootPort})与 HOROSA_SERVER_PORT=${server} 不一致:只留一个,或改成同一个端口`);
		}
		server = rootPort;
		protocol = u.protocol;
		host = u.hostname;
		serverRoot = text;
		// localhost 不经名字解析:本机计算服务只听 127.0.0.1;Node 18 缺省(autoSelectFamily 关)先连 ::1 被拒,
		// 会误判「两个都没开」,自动拉起再回收重启正在跑的服务。探测与发请求都直接用 127.0.0.1。
		if(host.toLowerCase() === 'localhost'){
			host = '127.0.0.1';
			serverRoot = `${protocol}//127.0.0.1:${server}${u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/+$/, '') : ''}`;
		}
	}
	const hostInUrl = host.indexOf(':') >= 0 && host[0] !== '[' ? `[${host}]` : host;
	if(!serverRoot){ serverRoot = `${protocol}//${hostInUrl}:${server}`; }
	const remote = !LOOPBACK.has(host.toLowerCase());
	// 探测「有没有进程在听」:本机回环两个地址族都试(任一连得上 = 在跑),免得只试一个族时把在跑的服务判成没开
	const bare = host.replace(/^\[|\]$/g, '');
	const probeHosts = remote ? [bare] : Array.from(new Set([bare, '127.0.0.1', '::1']));
	return { server, chart, host, remote, serverRoot, chartRoot: `${protocol}//${hostInUrl}:${chart}`, probeHosts };
}

// 起服务脚本的环境:解析结果显式写回脚本认的两个变量(只设了 HOROSA_SERVER_ROOT 时,脚本也起在同一个口)
function backendPortEnv(ports){
	return { HOROSA_SERVER_PORT: `${ports.server}`, HOROSA_CHART_PORT: `${ports.chart}` };
}

module.exports = { backendPorts, backendPortEnv, parsePort, PortConfigError, DEFAULT_SERVER_PORT, DEFAULT_CHART_PORT };
