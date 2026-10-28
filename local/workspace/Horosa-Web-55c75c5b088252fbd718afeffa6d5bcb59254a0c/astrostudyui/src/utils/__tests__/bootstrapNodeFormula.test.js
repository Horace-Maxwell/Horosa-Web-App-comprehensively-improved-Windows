// 源码一键部署(scripts/mac/bootstrap_and_run.sh)装 Node 的公式选择:Homebrew 已停用的公式(node@18)brew info 照样成功、
// 装的时候才失败 —— 旧写法先试它,每台新机都要先失败一次再回落。合同:新的长期支持版优先、跳过已停用公式、不再点名 node@18。
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../../..');
const SH = path.join(ROOT, 'scripts/mac/bootstrap_and_run.sh');
const body = ()=>fs.readFileSync(SH, 'utf8').split('\n').filter((l)=>!/^\s*#/.test(l)).join('\n');
const ensureNode = (s)=>{ const i = s.indexOf('ensure_node() {'); return i < 0 ? '' : s.slice(i, s.indexOf('\n}\n', i)); };

// horosa_win_shell_layout_v1(Windows 侧移植适配):scripts/mac/bootstrap_and_run.sh 是 macOS 的 Homebrew 一键部署脚本,不随 Windows 仓发
// (Windows 的源码一键起停是 local/Horosa_Local_Windows.bat/.ps1,由发布自检「local launchers」门核)。只在脚本缺席时跳过前两条;判别条照跑。
const itMac = fs.existsSync(SH) ? it : it.skip;

describe('一键部署装 Node 的公式', ()=>{
	itMac('ensure_node 按 node@22 → node@20 → node 依次试,先查「已停用」再装', ()=>{
		const fn = ensureNode(body());
		expect(fn).not.toBe('');
		expect(fn).toMatch(/for f in node@22 node@20 node; do/);
		expect(fn).toMatch(/"disabled": \*true[^\n]*brew info --json=v2 --formula "\$\{f\}"|brew info --json=v2 --formula "\$\{f\}"[^\n]*"disabled": \*true/);	// 判据与 brew info 同一行(先后不限;判据写成 here-string,不接管道)
		expect(fn.indexOf('"disabled"')).toBeLessThan(fn.indexOf('ensure_formula "${f}"'));
	});
	itMac('代码行里不再点名已停用的 node@18(注释除外)', ()=>{
		expect(/node@18/.test(body())).toBe(false);
	});
	it('判别:旧写法(先试 node@18)必红', ()=>{
		const old = 'ensure_node() {\n  if have_cmd brew && brew info node@18 >/dev/null 2>&1; then\n    ensure_formula node@18\n  fi\n}\n';
		expect(/for f in node@22 node@20 node; do/.test(ensureNode(old))).toBe(false);
		expect(/node@18/.test(old)).toBe(true);
	});
});
