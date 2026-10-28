// horosa_win_shell_copy_v1 金标(v3.12.0,Windows-only):外部连接面板的终端说法按宿主切换。
//   · Windows 桌面版(UA 含 Windows NT):REST 示例用 curl.exe(Windows PowerShell 5.1 里 curl 是 Invoke-WebRequest 别名,
//     原样复制 `curl -s -H …` 会报参数错);终端命令确认文案说 PATH / horosa.cmd,不提 ~/.local/bin。
//   · 其它宿主(macOS / jsdom 缺省 UA):逐字节同上游 —— 上游 aiToolsRestPanel / aiToolsCliPanel 的断言原样成立。
import { restCurlExample, restOpenApiCurl, cliShimConfirmCopy } from '../ExternalAgentPanel';

const ST = { token: 'T', restUrl: 'http://127.0.0.1:1/api/v1' };
const realUA = window.navigator.userAgent;
const setUA = (ua) => Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });

afterEach(() => setUA(realUA));

test('Windows 宿主:REST 示例用 curl.exe(两条都换)', () => {
	setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Horosa Electron/42.6.0 Safari/537.36');
	expect(restCurlExample(ST)).toBe('curl.exe -s -H "Authorization: Bearer T" http://127.0.0.1:1/api/v1/context');
	expect(restOpenApiCurl(ST)).toBe('curl.exe -s -H "Authorization: Bearer T" http://127.0.0.1:1/api/v1/openapi.json');
});

test('Windows 宿主:终端命令确认文案说 PATH / horosa.cmd,不提 ~/.local/bin', () => {
	setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/42.6.0');
	const s = cliShimConfirmCopy({ path: 'C:\\Program Files\\星阙\\resources\\bin\\horosa.cmd' });
	expect(s).toContain('C:\\Program Files\\星阙\\resources\\bin\\horosa.cmd');
	expect(s).toContain('PATH');
	expect(s).toContain('新开一个终端窗口');
	expect(s).not.toContain('~/.local/bin');
	// 状态里还没有路径时的兜底说法(不写成裸 'horosa.cmd' 字面量:存储键注册表扫描器按「引号 + horosa.」认键)
	const fallback = cliShimConfirmCopy({});
	expect(fallback).toContain('星阙安装目录里的 horosa.cmd 所在目录');
	expect(fallback).not.toContain('~/.local/bin');
});

test('非 Windows 宿主:逐字节同上游(负锚:Windows 说法不外溢)', () => {
	setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15');
	expect(restCurlExample(ST)).toBe('curl -s -H "Authorization: Bearer T" http://127.0.0.1:1/api/v1/context');
	const s = cliShimConfirmCopy({ path: '/Users/x/.local/bin/horosa' });
	expect(s).toContain('/Users/x/.local/bin/horosa');
	expect(s).toContain('~/.local/bin');
	expect(s).not.toContain('horosa.cmd');
});
