// 逐字重复的小工具收成一份(共享件):原处改成 import,行为与收编前逐字一致。
// 锁两件事:① 原处不再自带一份(长回来=红);② 单源的行为与原实现相同。
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>false),
	invokeDesktopCommand: jest.fn(()=>Promise.resolve()),
}));
import fs from 'fs';
import path from 'path';
import { isDesktopBridgeAvailable } from '../aiAnalysisDesktop';

const { importsName, definesLocal } = require('./helpers/importSpecs');   // 按 AST 读 import:同一条里多导几个名字 / 换行排版都照认

const SRC = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('localStorage 句柄:safeStorage 一份', () => {
	test('请求层与记录库内核不再各带一份', () => {
		const req = read('utils/request.js');
		expect(definesLocal(req, 'getLocalStorageSafe')).toBe(false);
		expect(importsName(req, { name: 'getLocalStorageSafe', from: './safeStorage' })).toBe(true);
		const store = read('utils/localRecordStore.js');
		expect(definesLocal(store, 'getLocalStorage')).toBe(false);
		expect(definesLocal(store, 'getLocalStorageSafe')).toBe(false);
		expect(importsName(store, { name: 'getLocalStorageSafe', from: './safeStorage', as: 'getLocalStorage' })).toBe(true);
	});
	test('判别力:单独一条 / 与别的名字合一条 import 都认;本文件另定义一份 / 从别处导入 / 只写在注释里都不认', () => {
		const ok1 = "import { getLocalStorageSafe } from './safeStorage';\n";
		const ok2 = "import {\n\tsafeStorageSetOn,\n\tgetLocalStorageSafe,\n} from './safeStorage';\n";
		const want = { name: 'getLocalStorageSafe', from: './safeStorage' };
		expect(importsName(ok1, want)).toBe(true);
		expect(importsName(ok2, want)).toBe(true);
		expect(definesLocal(ok2, 'getLocalStorageSafe')).toBe(false);
		const dup = "import { safeStorageSetOn } from './safeStorage';\nfunction getLocalStorageSafe(){ return null; }\n";
		expect(importsName(dup, want)).toBe(false);
		expect(definesLocal(dup, 'getLocalStorageSafe')).toBe(true);
		expect(definesLocal("const getLocalStorageSafe = () => null;", 'getLocalStorageSafe')).toBe(true);
		expect(importsName("import { getLocalStorageSafe } from './otherStorage';", want)).toBe(false);
		expect(importsName("// import { getLocalStorageSafe } from './safeStorage';\nexport const x = 1;", want)).toBe(false);
		expect(importsName("import { getLocalStorageSafe as g } from './safeStorage';", want)).toBe(false);
		expect(importsName("import { getLocalStorageSafe as g } from './safeStorage';", { ...want, as: 'g' })).toBe(true);
	});
	test('行为:有存储给句柄;访问即抛时给 null', () => {
		const { getLocalStorageSafe } = require('../safeStorage');
		expect(getLocalStorageSafe()).toBe(window.localStorage);
		const spy = jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('SecurityError'); });
		try{
			expect(getLocalStorageSafe()).toBe(null);
		}finally{
			spy.mockRestore();
		}
	});
});

describe('主实例判定:影子副本与自动备份同一份', () => {
	test('自动备份不再自带判据', () => {
		const src = read('utils/autoBackup.js');
		expect(src).not.toMatch(/currentWindowIsIndependent/);
		expect(importsName(src, { name: 'shadowMirrorEligible', from: './shadowMirror' })).toBe(true);
	});
	test('行为:桌面桥在 / 不在两态下与影子副本判定一致', () => {
		const { getAutoBackupStatus } = require('../autoBackup');
		const { shadowMirrorEligible } = require('../shadowMirror');
		isDesktopBridgeAvailable.mockReturnValue(false);
		expect(getAutoBackupStatus().enabled).toBe(false);
		expect(shadowMirrorEligible()).toBe(false);
		isDesktopBridgeAvailable.mockReturnValue(true);
		expect(getAutoBackupStatus().enabled).toBe(shadowMirrorEligible());
	});
});

describe('L3 信封版本:请求层一份,kentang 缓存复用', () => {
	test('两处不再各带一份读 rv 的实现', () => {
		expect(read('utils/requestDedupe.js')).not.toMatch(/let l3RevCache/);
		expect(read('utils/kentangCache.js')).not.toMatch(/let l3RevCache|URLSearchParams/);
		expect(importsName(read('utils/kentangCache.js'), { name: 'makeL3Rev', from: './requestDedupe' })).toBe(true);
	});
	test('行为:无 rv = 基础 rev;有 rv = 基础|rv;只读一次,reset 后重读', () => {
		const { makeL3Rev } = require('../requestDedupe');
		const prev = window.location.href;
		const rev = makeL3Rev('kt-v1');
		expect(rev()).toBe('kt-v1');
		window.history.replaceState({}, '', '/?rv=3.12.0');
		expect(rev()).toBe('kt-v1');          // 已缓存
		rev.reset();
		expect(rev()).toBe('kt-v1|3.12.0');
		expect(makeL3Rev('net-v1')()).toBe('net-v1|3.12.0');
		window.history.replaceState({}, '', prev);
	});
});

describe('缩放域:同一换算只留一份实现', () => {
	test('clientToLayoutPx 就是 clientToFixedPx', () => {
		const zd = require('../zoomDomain');
		expect(zd.clientToLayoutPx).toBe(zd.clientToFixedPx);
		expect(zd.clientToLayoutPx(80, 0.8)).toBe(100);
		expect(zd.clientToLayoutPx(123.4, 1)).toBe(123.4);
		expect(zd.clientToLayoutPx('abc', 0.5)).toBe('abc');
		expect(zd.clientToLayoutPx(50, 0)).toBe(50);
	});
});

describe('读源码的导入锁一律按 AST 认 import', () => {
	// 整行正则写死一条 import 原文(含同条里的全部名字与排版)= 同一条里多导一个名字就误红;改用 helpers/importSpecs
	const FRAGILE = new RegExp(['toMatch\\(\\/import', '\\\\\\{ '].join(' '));
	const walk = (dir, out) => {
		fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
			const p = path.join(dir, d.name);
			if(d.isDirectory()){ if(d.name !== 'node_modules' && !d.name.startsWith('.umi')){ walk(p, out); } }
			else if(/\.test\.jsx?$/.test(d.name)){ out.push(p); }
		});
		return out;
	};
	test('判别力:写死 import 原文的正则锁能被认出', () => {
		expect(FRAGILE.test("expect(src).toMatch(/import \\{ a \\} from '\\.\\/x'/);")).toBe(true);
		expect(FRAGILE.test("expect(importsName(src, { name: 'a', from: './x' })).toBe(true);")).toBe(false);
	});
	test('测试里不再有写死 import 原文的正则锁', () => {
		const hits = walk(SRC, []).filter((f) => FRAGILE.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
		expect(hits).toEqual([]);
	});
	// 发布前自检的 pf_imports(preflight/import_specs.js)用同一份助手:排版 / 先后 / 同条多名都认,少一个名字、只写在注释里都红
	// horosa_win_shell_layout_v1(Windows 侧移植适配):核的是 macOS 发布预检的 pf_imports(Horosa_Desktop_Installer/scripts/preflight/import_specs.js),
	// Windows 仓不带这份预检脚本(找不到 = node 退出码 1 ⇒ 首条断言假红)。只在脚本缺席时跳过;在场(macOS)照跑。
	const PF_IMPORT_SPECS = path.resolve(SRC, '..', '..', '..', 'Horosa_Desktop_Installer', 'scripts', 'preflight', 'import_specs.js');
	(fs.existsSync(PF_IMPORT_SPECS) ? test : test.skip)('预检的导入判据与本助手同口径', () => {
		const os = require('os');
		const { execFileSync } = require('child_process');
		const cli = PF_IMPORT_SPECS;
		const ui = path.resolve(SRC, '..');
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-imports-'));
		const run = (code, stmt) => {
			const f = path.join(dir, 'm.js');
			fs.writeFileSync(f, code);
			try{ execFileSync('node', [cli, ui, f, stmt], { stdio: 'pipe' }); return 0; }catch(e){ return e.status; }
		};
		const stmt = "import { a, b } from './x';";
		try{
			expect(run("import { a, b } from './x';\n", stmt)).toBe(0);
			expect(run("import {\n\tb,\n\tc,\n\ta,\n} from './x';\n", stmt)).toBe(0);
			expect(run("import { a } from './x';\n// import { a, b } from './x';\n", stmt)).toBe(1);
			expect(run("import { a, b } from './y';\n", stmt)).toBe(1);
			expect(run("import { a as b2, b } from './x';\n", stmt)).toBe(1);
			expect(run('', 'not an import')).toBe(2);
		}finally{
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
	// JSX 结构同理:正则写死「<A 属性 属性>子节点」「<A[\s\S]{0,200}<B」「<A[^>]*属性」= 插一个无关属性、换个先后、换行就误红,
	// 「不许出现」那种还会假绿。一律改用 helpers/jsxProps(jsxElements / jsxNodes / jsxNodesInFile)按 AST 认元素、属性、子节点、外层。
	const FRAGILE_JSX = new RegExp(['(?:toMatch|match|test)\\(\\/<[A-Z]', '|new RegExp\\(\\s*[`\'"]<[A-Z]'].join(''));
	test('判别力:按排版写死 JSX 结构的正则能被认出', () => {
		expect(FRAGILE_JSX.test(['expect(src).not.toMatch(/', '<Spin spinning=\\{x\\}>/);'].join(''))).toBe(true);
		expect(FRAGILE_JSX.test(['(host.match(/', '<GuiceMain[\\s\\S]*?\\/>/) || [])'].join(''))).toBe(true);
		expect(FRAGILE_JSX.test(['new RegExp(`', '<Option value="${k}">`)'].join(''))).toBe(true);
		expect(FRAGILE_JSX.test("expect(jsxNodes(src, 'Spin').filter((e) => e.attrs.spinning === 'x')).toEqual([]);")).toBe(false);
		expect(FRAGILE_JSX.test("expect(src).toMatch(/<\\/div>/);")).toBe(false);
	});
	test('测试里不再有按排版写死 JSX 结构的正则锁', () => {
		const hits = walk(SRC, []).filter((f) => FRAGILE_JSX.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
		expect(hits).toEqual([]);
	});
});
