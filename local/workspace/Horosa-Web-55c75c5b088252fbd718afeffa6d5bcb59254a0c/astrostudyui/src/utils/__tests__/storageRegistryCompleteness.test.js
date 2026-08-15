// 🔴 [V4 制度化] 存储键注册表机械穷举哨兵 —— 「新增持久化键不登记即红」的永久锁。
//
// 由来(用户明令「所有信息跨会话滴水不漏」):全量备份面由 storageKeyRegistry 推导,注册表
// 漏键=该键被排除在备份外(用户资产迁机即丢)。历史现实:全站 ~50 个键不带 horosa 前缀
// (ziwei*/liureng*/suzhan*/CalculatorFormula…),前缀 grep 必漏 —— 唯一可靠的完整性判据是
// **机械扫源码字面量并与注册表 diff**。
//
// 扫描口径(两轮并集,排除测试文件):
//   ① 全部 'horosa.…' 字符串字面量(键常量定义处必是字面量,动态拼接键由其前缀兜住);
//   ② safeLocalStorageSet/Get、localStorage.setItem/getItem 的字面量首参(吸非规范前缀键)。
// 判据:每个抽到的键 classifyStorageKey() 必须命中注册表条目 —— 未登记键列红名单报错,
// 登记时必须三思 kind(标错 'cache' = 用户数据被排除在备份外;详见注册表头注释)。
import fs from 'fs';
import path from 'path';
import { classifyStorageKey, collectBackupKeys, STORAGE_KEY_REGISTRY } from '../storageKeyRegistry';

const SRC_ROOT = path.join(__dirname, '..', '..');

function listSourceFiles(dir, out){
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	entries.forEach((ent)=>{
		const full = path.join(dir, ent.name);
		if(ent.isDirectory()){
			if(ent.name === '__tests__' || ent.name === 'node_modules' || ent.name === 'test'){
				return;
			}
			listSourceFiles(full, out);
			return;
		}
		if(ent.isFile() && ent.name.endsWith('.js') && !ent.name.endsWith('.test.js')){
			out.push(full);
		}
	});
	return out;
}

function extractKeys(){
	const files = listSourceFiles(SRC_ROOT, []);
	expect(files.length).toBeGreaterThan(300);   // 扫描面塌缩守卫(路径错/过滤过宽即红)
	const found = new Map();   // key → 首个来源文件(报错定位用)
	const reHorosa = /['"](horosa\.[A-Za-z0-9._:-]+)['"]/g;
	const reCall = /(?:safeLocalStorageSet|safeLocalStorageGet|localStorage\.setItem|localStorage\.getItem)\(\s*['"]([^'"]+)['"]/g;
	files.forEach((f)=>{
		const text = fs.readFileSync(f, 'utf8');
		let m = null;
		while((m = reHorosa.exec(text)) !== null){
			if(!found.has(m[1])){
				found.set(m[1], path.relative(SRC_ROOT, f));
			}
		}
		while((m = reCall.exec(text)) !== null){
			if(!found.has(m[1])){
				found.set(m[1], path.relative(SRC_ROOT, f));
			}
		}
	});
	return found;
}

describe('[V4] 存储键注册表机械穷举哨兵', ()=>{
	it('🔴 源码里出现的每个存储键字面量都必须能被注册表分类(新键不登记即红)', ()=>{
		const found = extractKeys();
		expect(found.size).toBeGreaterThan(100);   // 抽取面塌缩守卫(正则失效即红)
		const missing = [];
		found.forEach((src, k)=>{
			if(!classifyStorageKey(k)){
				missing.push(`${k}  ←${src}`);
			}
		});
		expect(missing.length ? `未登记键(去 storageKeyRegistry.js 分类登记,标 kind 前先读头注释):\n${missing.join('\n')}` : 'ok').toBe('ok');
	});

	it('注册表自洽:条目必有 kind/label;backup 与 kind 语义一致;精确键不重复', ()=>{
		const seen = new Set();
		STORAGE_KEY_REGISTRY.forEach((e)=>{
			expect(!!(e.key || e.prefix)).toBe(true);
			expect(['user-data', 'settings', 'cache', 'device-local']).toContain(e.kind);
			expect(typeof e.label).toBe('string');
			expect(e.label.length).toBeGreaterThan(1);
			if(e.kind === 'cache' || e.kind === 'device-local'){
				expect(e.backup).toBe(false);
			}else{
				expect(e.backup === true || e.backup === 'dedicated').toBe(true);
			}
			if(e.key){
				expect(seen.has(e.key)).toBe(false);
				seen.add(e.key);
			}
		});
	});

	it('classify:精确键优先于前缀;最长前缀胜出;未知键返回 null', ()=>{
		expect(classifyStorageKey('ziweiLateZiMigrated').kind).toBe('device-local');   // 精确 > prefix 'ziwei'
		expect(classifyStorageKey('ziweiPreset').kind).toBe('settings');
		expect(classifyStorageKey('ziweiBrightnessCustom').kind).toBe('user-data');
		expect(classifyStorageKey('horosa.perf.chartSCU').kind).toBe('device-local');
		expect(classifyStorageKey('horosa.ai.snapshot.module.v1.bazi').kind).toBe('cache');
		expect(classifyStorageKey('totally.unknown.key')).toBe(null);
	});

	it('🔴 运行时防呆:未登记键被 collectBackupKeys 归入 unknownKeys(宁多带不漏)', ()=>{
		window.localStorage.clear();
		window.localStorage.setItem('horosa.liuyao.settings.v1', '{}');          // settings → raw
		window.localStorage.setItem('horosa.perf.chartSCU', '1');               // device-local → 排除
		window.localStorage.setItem('future.unregistered.key', 'x');            // 未登记 → unknown 带走
		const { rawKeys, unknownKeys } = collectBackupKeys();
		expect(rawKeys).toContain('horosa.liuyao.settings.v1');
		expect(rawKeys).not.toContain('horosa.perf.chartSCU');
		expect(unknownKeys).toEqual(['future.unregistered.key']);
		window.localStorage.clear();
	});

	// [V5-C2] jest 版 lint:裸 localStorage.setItem 直调点 ratchet —— 新代码必须走 safeStorage/
	// 内核封装层(写入前置闸 C3 才拦得住未登记键);存量直调点冻结成白名单只减不增,新增即红。
	it('🔴 裸 localStorage.setItem 直调点 ratchet(只减不增;新代码必须走封装层)', ()=>{
		const files = listSourceFiles(SRC_ROOT, []);
		const WRAPPER_FILES = ['utils/safeStorage.js', 'utils/localRecordStore.js'];   // 封装层本体豁免
		const offenders = new Set();
		files.forEach((f)=>{
			const rel = path.relative(SRC_ROOT, f).split(path.sep).join('/');
			if(WRAPPER_FILES.indexOf(rel) >= 0){
				return;
			}
			const text = fs.readFileSync(f, 'utf8');
			if(/(?<!\.)\blocalStorage\.setItem\(/.test(text) || /window\.localStorage\.setItem\(/.test(text)){
				offenders.add(rel);
			}
		});
		// 存量白名单(2026-08-14 冻结):历史直调点,逐步清偿;⚠ 只准从这份名单删除,绝不准往里加。
		const LEGACY_ALLOWED = new Set(require('../storageSetItemLegacyAllowlist.json'));
		const newOffenders = [...offenders].filter((f)=>!LEGACY_ALLOWED.has(f)).sort();
		const cured = [...LEGACY_ALLOWED].filter((f)=>!offenders.has(f)).sort();
		expect(newOffenders.length ? `新增裸 localStorage.setItem 直调(必须走 safeLocalStorageSet/内核,未登记键才拦得住):\n${newOffenders.join('\n')}` : 'ok').toBe('ok');
		expect(cured.length ? `已清偿文件仍在白名单(从 storageSetItemLegacyAllowlist.json 删掉,ratchet 只减不增):\n${cured.join('\n')}` : 'ok').toBe('ok');
	});

	// [V5-C6/C7] 注册表形状快照留痕闸:键集+kind 分布 committed 快照 —— 任何变更必须显式
	// `jest -u` 留痕,挡意外改动。⚠ kind 从 user-data/settings 改为 cache/device-local 是
	// **危险方向**(=把键踢出备份面,该键数据从此迁机即丢),更新快照前必须在 commit message
	// 写明理由;反方向(cache→settings)无害。
	it('🔴 注册表形状快照(变更必须 jest -u 显式留痕;降级 kind 必须说明理由)', ()=>{
		const shape = STORAGE_KEY_REGISTRY.map((e)=>`${e.key || e.prefix + '*'} :: ${e.kind} :: backup=${e.backup}`).sort();
		expect(shape).toMatchSnapshot();
	});
});

// [V5-C5] 迁移链 hash 锁(Flyway checksum 模型):RECORD_MIGRATIONS 每步函数体 hash 进
// committed 快照 —— 已应用过的迁移步骤如 git 历史不可变,改历史步骤即红,只准追加新步骤。
// (「段表加新段绝不升 MIGRATION_VERSION/改历史迁移」口头铁律的机械化。)
describe('[V5-C5] 记录迁移链 hash 锁', ()=>{
	it('🔴 历史迁移步骤逐字节冻结(改历史=红;新增步骤=快照追加留痕)', ()=>{
		// eslint-disable-next-line global-require
		const crypto = require('crypto');
		// eslint-disable-next-line global-require
		const src = fs.readFileSync(path.join(SRC_ROOT, 'utils', 'localRecordStore.js'), 'utf8');
		// 兼容空链单行 `= [];` 与未来多行步骤(非贪婪到最近的 `];`)。
		const block = src.match(/const RECORD_MIGRATIONS = \[([\s\S]*?)\];/);
		expect(block).toBeTruthy();
		const hash = crypto.createHash('sha256').update(block[1]).digest('hex');
		expect(`${block[1].split('\n').length}行:${hash}`).toMatchSnapshot();
	});
});
