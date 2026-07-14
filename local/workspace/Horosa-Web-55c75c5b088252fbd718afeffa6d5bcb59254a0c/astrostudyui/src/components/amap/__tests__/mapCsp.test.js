// 高德地图 CSP 白名单完整性守卫（制度化·FL 装机专发类 2026-07-13 首治 / 2026-07-14 二次根治）。
// ★真表面 = main.rs 的 tiny_http 响应头 CSP（主界面走 http://127.0.0.1，不走 tauri:// → tauri.conf
// 的 csp 管不到地图）；只校验 tauri.conf = 假绿。故本测首先校验 main.rs，tauri.conf 为次。
// 病根：打包 CSP ①未放行 AMap 域(*.amap.com/*.autonavi.com) ②script-src 缺 'unsafe-eval'（AMap 2.0
// 运行时用 eval+WebAssembly）→ macOS WKWebView 严格执行 → 地图白屏；preview 无 CSP、Windows WebView2
// 宽松故 dev/Win 假绿，唯 Mac 装机版暴露。此测与 release_preflight.sh [128] 双护（jest=早警，preflight=硬闸）。
import fs from 'fs';
import path from 'path';
import { AMapKey } from '../../../utils/constants';

// 向上搜某个安装器内相对文件（对仓库布局稳健；缺失则跳过，不误伤 public 单仓 jest）。
function findInstallerFile(start, ...rel) {
	let dir = start;
	for (let i = 0; i < 8; i++) {
		const p = path.join(dir, 'Horosa_Desktop_Installer', 'src-tauri', ...rel);
		if (fs.existsSync(p)) { return p; }
		const up = path.dirname(dir);
		if (up === dir) { break; }
		dir = up;
	}
	return null;
}
function findTauriConf(start) { return findInstallerFile(start, 'tauri.conf.json'); }
// ★真表面 = main.rs 的 tiny_http 响应头 CSP（主界面走 http://127.0.0.1，tauri.conf 的 csp 管不到这里）。
function findMainRs(start) { return findInstallerFile(start, 'src', 'main.rs'); }
function extractMainRsCsp(src) {
	// CSP 以 Rust 字节串 &b"default-src ... frame-src 'self'"[..] 形式内嵌；CSP 内无双引号故 [^"]* 稳。
	const m = `${src || ''}`.match(/&b"(default-src[^"]*)"/);
	return m ? m[1] : null;
}

function parseCsp(csp) {
	const dirs = {};
	`${csp || ''}`.split(';').map((s)=> s.trim()).filter(Boolean).forEach((seg)=>{
		const p = seg.split(/\s+/);
		dirs[p[0]] = p.slice(1);
	});
	return dirs;
}
function eff(dirs, d) { return dirs[d] || dirs['default-src'] || []; }
function allows(sources, host) {
	return (sources || []).some((s)=>{
		if (s === `https://${host}`) { return true; }
		if (s.startsWith('https://*.')) { const suf = s.slice('https://*'.length); return host.endsWith(suf) && host !== suf.slice(1); }
		return false;
	});
}

const confPath = findTauriConf(__dirname);
const mainRsPath = findMainRs(__dirname);

// 对一份 CSP dirs 断言 AMap 所需放行齐全（复用于 main.rs 真表面 + tauri.conf launcher）。
function assertAmapCsp(dirs) {
	['webapi.amap.com', 'restapi.amap.com', 'jsapi.amap.com'].forEach((h)=>{
		['script-src', 'connect-src', 'img-src'].forEach((d)=>{
			expect({ host: h, dir: d, allowed: allows(eff(dirs, d), h) }).toEqual({ host: h, dir: d, allowed: true });
		});
	});
	// AMap 2.0 WebGL 瓦片解码走 blob worker，WKWebView 严格 gate worker-src。
	expect(eff(dirs, 'worker-src')).toContain('blob:');
	// AMap 2.0 运行时用 eval()+WebAssembly.compile；'unsafe-eval' 同时放行 eval 与 wasm。
	expect(eff(dirs, 'script-src')).toContain("'unsafe-eval'");
}

describe('高德地图 CSP 白名单完整性（Mac WKWebView 严格执行 → 缺则装机白屏）', () => {
	test('前端确实用 AMap（AMapKey 非空）—— 故 CSP 必须放行', () => {
		expect(typeof AMapKey === 'string' && AMapKey.length > 0).toBe(true);
	});

	// ★最关键：main.rs 的 tiny_http 响应头才是地图真正生效的 CSP 表面（主界面走 http://127.0.0.1，
	// 不走 tauri:// 协议）。tauri.conf 的 csp 管不到主界面 → 只校验它=假绿。故此项必须存在且通过。
	(mainRsPath ? test : test.skip)('★main.rs tiny_http CSP（地图真表面）放行全部 AMap 域 + worker blob + unsafe-eval', () => {
		const csp = extractMainRsCsp(fs.readFileSync(mainRsPath, 'utf8'));
		expect(csp).toBeTruthy();               // 抽不到=main.rs 结构变了，须人工核
		assertAmapCsp(parseCsp(csp));
	});

	// 次表面：tauri.conf.json launcher（无地图，但保持与 main.rs 一致=纵深防御）。
	// 域(webapi=脚本/UI, restapi=地名/逆地理, jsapi/o4=瓦片) + worker blob + unsafe-eval 全查。
	(confPath ? test : test.skip)('tauri.conf launcher CSP 与 main.rs 一致：全 AMap 域 + worker blob + unsafe-eval', () => {
		const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
		assertAmapCsp(parseCsp(conf.app.security.csp));
	});

	(confPath ? test : test.skip)('放行外部域后仍受一次性同意 gate（隐私锚不失守）', () => {
		const mapV2 = fs.readFileSync(path.join(__dirname, '..', 'MapV2.js'), 'utf8');
		expect(mapV2).toMatch(/hasMapConsent/);
	});
});
