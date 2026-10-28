// 注册表 format:'json' 由源码读写方式推导核对:凡随备份走的设置 / 用户数据键,源码里按 JSON 读写的(safeJsonParseFromStorage /
// safeJsonStringifyToStorage / JSON.parse(读这把键) / 写这把键时 JSON.stringify),注册表必须标 format:'json'。
// 全量恢复据此在写前校验形状:没标的键,手改 / 第三方生成 / 没有校验和的老包里值是坏串时照写,之后读端把它当坏档清空,
// 本机原来有效的塔罗日志 / 书签 / 设置就被整值换掉了。漏标即红。
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import fs from 'fs';
import path from 'path';
import { STORAGE_KEY_REGISTRY } from '../storageKeyRegistry';
import { rawValueShapeOk } from '../unifiedBackup';

const SRC = path.resolve(__dirname, '../..');
const SKIP_FILES = new Set(['utils/storageKeyRegistry.js', 'utils/__tests__/techniqueOnboardingContract.js']);

function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){
			if(f === '__tests__' || f === 'node_modules' || f === '.umi' || f === '.umi-production'){ return; }
			walk(p, out);
		}else if(/\.(js|jsx|ts|tsx)$/.test(f) && !/\.test\./.test(f)){
			out.push(p);
		}
	});
	return out;
}
const esc = (s)=>s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 源码文本集合 → { key: [命中文件] }(只看 keys 里的键)。标识符按文件解析:本文件声明的常量优先,
// 否则认 import 进来的导出常量(不同文件同名常量互不串)
export function deriveJsonKeys(texts, keys){
	const declRe = /(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([^'"\n]+)['"]/g;
	const exported = {};
	const localOf = {};
	texts.forEach(([rel, t])=>{
		const loc = {};
		let m;
		declRe.lastIndex = 0;
		while((m = declRe.exec(t))){
			if(!keys.has(m[3])){ continue; }
			loc[m[2]] = m[3];
			if(m[1]){ (exported[m[2]] = exported[m[2]] || new Set()).add(m[3]); }
		}
		localOf[rel] = loc;
	});
	const out = {};
	texts.forEach(([rel, t])=>{
		const names = { ...localOf[rel] };
		const impRe = /import\s*\{([^}]*)\}\s*from/g;
		let im;
		while((im = impRe.exec(t))){
			im[1].split(',').forEach((part)=>{
				const mm = /^\s*([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(part);
				if(!mm){ return; }
				const local = mm[2] || mm[1];
				if(names[local] === undefined && exported[mm[1]] && exported[mm[1]].size === 1){ names[local] = [...exported[mm[1]]][0]; }
			});
		}
		const refs = [];
		keys.forEach((k)=>{ if(t.indexOf(`'${k}'`) >= 0 || t.indexOf(`"${k}"`) >= 0){ refs.push([`['"]${esc(k)}['"]`, k]); } });
		Object.keys(names).forEach((n)=>refs.push([`\\b${esc(n)}\\b`, names[n]]));
		refs.forEach(([pat, k])=>{
			const pats = [
				`safeJsonParseFromStorage\\(\\s*${pat}`,
				`safeJsonStringifyToStorage\\(\\s*${pat}`,
				`JSON\\.parse\\([^;\\n]{0,80}?(?:getItem|safeLocalStorageGet)\\(\\s*${pat}\\s*\\)`,
				`(?:setItem|safeLocalStorageSet|scheduleStorageWrite)\\(\\s*${pat}\\s*,\\s*JSON\\.stringify`,
				// 注入存储的写入单源:safeStorageSetOn(storage, KEY, JSON.stringify(…))
				`safeStorageSetOn\\(\\s*[\\w.]+\\s*,\\s*${pat}\\s*,\\s*JSON\\.stringify`,
				// 延迟写工厂:scheduleStorageWrite(KEY, ()=>{ … JSON.stringify … })
				`scheduleStorageWrite\\(\\s*${pat}\\s*,\\s*(?:\\([^)]*\\)|\\w+)\\s*=>[\\s\\S]{0,240}?JSON\\.stringify`,
			];
			let hit = pats.some((pp)=>new RegExp(pp).test(t));
			if(!hit){
				// 两步读:const raw = …getItem(KEY) / safeLocalStorageGet(KEY);之后 600 字内 JSON.parse(raw)
				const vre = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*[^;\\n]{0,80}?(?:getItem|safeLocalStorageGet)\\(\\s*${pat}\\s*\\)`, 'g');
				let vm;
				while(!hit && (vm = vre.exec(t))){
					const tail = t.slice(vm.index, vm.index + 600);
					if(new RegExp(`JSON\\.parse\\(\\s*(?:[^)]{0,20}\\?\\s*)?${esc(vm[1])}\\b`).test(tail)){ hit = true; }
				}
			}
			if(!hit){
				// 读函数:function f(){ … getItem(KEY) … } 之后 JSON.parse(f(…))
				const fre = new RegExp(`function\\s+([A-Za-z_$][\\w$]*)\\s*\\([^)]*\\)\\s*\\{[^}]{0,160}?(?:getItem|safeLocalStorageGet)\\(\\s*${pat}\\s*\\)`, 'g');
				let fm;
				while(!hit && (fm = fre.exec(t))){
					if(new RegExp(`JSON\\.parse\\(\\s*${esc(fm[1])}\\s*\\(`).test(t)){ hit = true; }
				}
			}
			if(hit && (out[k] || []).indexOf(rel) < 0){ (out[k] = out[k] || []).push(rel); }
		});
	});
	return out;
}

function sourceTexts(){
	return walk(SRC, []).map((p)=>[path.relative(SRC, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8')])
		.filter(([rel])=>!SKIP_FILES.has(rel));
}

function backupKeys(registry){
	return new Set(registry.filter((e)=>!e.prefix && e.backup !== false && (e.kind === 'settings' || e.kind === 'user-data')).map((e)=>e.key));
}

// 随备份走的 settings / user-data 条目(含前缀族)必须显式声明 format —— 缺省反转:不再靠推导补漏,漏声明即红
export function undeclaredFormats(registry){
	return registry
		.filter((e)=>e.backup === true && (e.kind === 'settings' || e.kind === 'user-data'))
		.filter((e)=>e.format !== 'json' && e.format !== 'text')
		.map((e)=>e.key || `${e.prefix}*`);
}

describe('🔴 format 显式声明(json | text)', ()=>{
	const texts = sourceTexts();
	it('随备份走的设置 / 用户数据键(含前缀族)每把都声明了 format', ()=>{
		expect(undeclaredFormats(STORAGE_KEY_REGISTRY)).toEqual([]);
	});
	it('判别力:去掉一把的声明立即红', ()=>{
		const reg = STORAGE_KEY_REGISTRY.map((e)=>(e.key === 'horosa.egypt.school.v1' ? { ...e, format: undefined } : e));
		expect(undeclaredFormats(reg)).toEqual(['horosa.egypt.school.v1']);
	});
	it('声明为 text 的键:源码里没有按 JSON 读写它的地方(声明错了即红)', ()=>{
		const textKeys = new Set(STORAGE_KEY_REGISTRY.filter((e)=>e.key && e.format === 'text').map((e)=>e.key));
		const derived = deriveJsonKeys(texts, textKeys);
		expect(Object.keys(derived).sort().map((k)=>`${k}  ← ${derived[k].join(',')}`)).toEqual([]);
		const reg = STORAGE_KEY_REGISTRY.map((e)=>(e.key === 'horosa.egypt.school.v1' ? { ...e, format: 'text' } : e));
		const wrongKeys = new Set(reg.filter((e)=>e.key && e.format === 'text').map((e)=>e.key));
		expect(Object.keys(deriveJsonKeys(texts, wrongKeys))).toEqual(['horosa.egypt.school.v1']);
	});
	it('声明为 text 的前缀族:族里没有单独登记、却按 JSON 读写的键', ()=>{
		const exact = new Set(STORAGE_KEY_REGISTRY.filter((e)=>e.key).map((e)=>e.key));
		const fams = STORAGE_KEY_REGISTRY.filter((e)=>e.prefix && e.format === 'text' && e.backup === true);
		const members = new Set();
		texts.forEach(([, t])=>{
			const re = /['"]([A-Za-z][\w.:-]{2,80})['"]/g;
			let m;
			while((m = re.exec(t))){
				const k = m[1];
				if(exact.has(k)){ continue; }
				const fam = fams.filter((f)=>k.indexOf(f.prefix) === 0).sort((a, b)=>b.prefix.length - a.prefix.length)[0];
				// 最长前缀匹配到的必须正是这一族(不是更长的另一族)
				const all = STORAGE_KEY_REGISTRY.filter((e)=>e.prefix && k.indexOf(e.prefix) === 0).sort((a, b)=>b.prefix.length - a.prefix.length)[0];
				if(fam && all === fam){ members.add(k); }
			}
		});
		const derived = deriveJsonKeys(texts, members);
		expect(Object.keys(derived).sort().map((k)=>`${k}  ← ${derived[k].join(',')}`)).toEqual([]);
	});
});

describe('format:json 由源码推导', ()=>{
	const texts = sourceTexts();
	it('🔴 源码按 JSON 读写的随备份设置 / 用户数据键都标了 format:json', ()=>{
		const derived = deriveJsonKeys(texts, backupKeys(STORAGE_KEY_REGISTRY));
		const byKey = new Map(STORAGE_KEY_REGISTRY.map((e)=>[e.key, e]));
		const missing = Object.keys(derived).filter((k)=>byKey.get(k).format !== 'json').sort().map((k)=>`${k}  ← ${derived[k].join(',')}`);
		expect(missing).toEqual([]);
	});
	it('判别力:把一把已标的键的 format 去掉,推导立即抓到', ()=>{
		const reg = STORAGE_KEY_REGISTRY.map((e)=>(e.key === 'horosa.tarot.dailyLog' ? { ...e, format: undefined } : e));
		const derived = deriveJsonKeys(texts, backupKeys(reg));
		expect(derived['horosa.tarot.dailyLog']).toBeTruthy();
		expect(reg.find((e)=>e.key === 'horosa.tarot.dailyLog').format).toBeUndefined();
	});
	it('运行时兜底:声明为 text / 没登记的键,本机现值是 JSON 结构而备份值解析不出 → 跳过;本机是普通文本照常写', ()=>{
		window.localStorage.clear();
		window.localStorage.setItem('horosa.guolao.engineMode', '{"a":1}');
		expect(rawValueShapeOk('horosa.guolao.engineMode', 'broken{')).toBe(false);
		expect(rawValueShapeOk('horosa.guolao.engineMode', '{"a":2}')).toBe(true);
		window.localStorage.setItem('horosa.guolao.engineMode', 'classic');
		expect(rawValueShapeOk('horosa.guolao.engineMode', 'modern')).toBe(true);
		window.localStorage.setItem('some.unregistered.key', '[1,2]');
		expect(rawValueShapeOk('some.unregistered.key', 'x')).toBe(false);
		window.localStorage.clear();
		expect(rawValueShapeOk('some.unregistered.key', 'x')).toBe(true);
	});
	it('全量恢复据此跳过坏串:塔罗日志 / 玄史书签的非 JSON 值不写进本机', ()=>{
		expect(rawValueShapeOk('horosa.tarot.dailyLog', 'not json')).toBe(false);
		expect(rawValueShapeOk('horosa.xuanshi.bookmarks.v1', '[1,')).toBe(false);
		expect(rawValueShapeOk('horosa.tarot.dailyLog', '[]')).toBe(true);
		// 此前推导漏掉的四把(两步读 / 注入存储写 / 读函数 + 延迟写工厂)
		['baziInverse', 'baziPattern', 'horosa.egypt.school.v1', 'baziPattern_local::1990_1_1_1::g1'].forEach((k)=>{ expect([k, rawValueShapeOk(k, 'not json')]).toEqual([k, false]); });
	});
	it('推导规则:四种写法都认;只读不解析的不算', ()=>{
		const keys = new Set(['a.k', 'b.k', 'c.k', 'd.k', 'e.k']);
		const d = deriveJsonKeys([
			['x.js', "const KA = 'a.k';\nconst v = safeJsonParseFromStorage(KA, []);"],
			['y.js', "safeJsonStringifyToStorage('b.k', obj);"],
			['z.js', "const o = JSON.parse(window.localStorage.getItem('c.k') || '{}');"],
			['w.js', "safeLocalStorageSet('d.k', JSON.stringify(x));"],
			['v.js', "const s = safeLocalStorageGet('e.k'); safeLocalStorageSet('e.k', s + '1');"],
		], keys);
		expect(Object.keys(d).sort()).toEqual(['a.k', 'b.k', 'c.k', 'd.k']);
		// 另三种写法:注入存储的写入单源 / 两步读 / 读函数 / 延迟写工厂
		const keys2 = new Set(['f.k', 'g.k', 'h.k', 'i.k', 'j.k']);
		const d2 = deriveJsonKeys([
			['a.js', "const KF = 'f.k';\nsafeStorageSetOn(storage, KF, JSON.stringify(x));"],
			['b.js', "let json = safeLocalStorageGet('g.k');\nif(json){ st = JSON.parse(json); }"],
			['c.js', "function _raw(){ try{ return window.localStorage.getItem('h.k'); }catch(e){ return null; } }\nconst v = JSON.parse(_raw() || '{}');"],
			['d.js', "scheduleStorageWrite('i.k', ()=>{ const s = JSON.stringify(next); return s; });"],
			['e.js', "const raw = storage.getItem('j.k'); return normalize(raw ? JSON.parse(raw) : null);"],
		], keys2);
		expect(Object.keys(d2).sort()).toEqual(['f.k', 'g.k', 'h.k', 'i.k', 'j.k']);
	});
});
