// 存储写入单源:全仓 `.setItem(` 只许出现在存储单源文件里;各处本地包装一律经 safeStorage(登记闸 + 配额两档阶梯)。
// 此前七政 / 埃及流派 / 3D / 后端地址 / 账号记号五处本地 try{ setItem }catch{}:可再生缓存占满配额时不清缓存、静默写不进,
// 重开设置就丢;还绕过了「未登记键即抛」的前置闸。
import fs from 'fs';
import path from 'path';
import { safeLocalStorageSet, safeStorageSetOn } from '../safeStorage';

const SRC = path.resolve(__dirname, '../..');

// 白名单:文件 → 理由。超出即红;新增必须写理由
const ALLOWED = {
	'utils/safeStorage.js': '存储单源本身(登记闸 + 配额阶梯)',
	'utils/deferredStorage.js': '延迟落盘队列:撞配额走同一阶梯 retryWriteAfterQuotaPurge',
	'utils/localRecordStore.js': '记录库内核:自带告急清理与诚实写回报',
};
// 逐行豁免:只认显式 sessionStorage 的窗口身份(会话内随机号,写不进退回进程内随机,不进备份)
const LINE_ALLOWED = [
	{ file: 'utils/aiAgent/tasks/taskRegistry.js', re: /window\.sessionStorage\.setItem\(WINDOW_ID_KEY/ },
];

function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		const st = fs.statSync(p);
		if(st.isDirectory()){
			if(f === '__tests__' || f === 'node_modules' || f === '.umi' || f === '.umi-production'){ return; }
			walk(p, out);
		}else if(/\.(js|jsx|ts|tsx)$/.test(f) && !/\.test\.(js|jsx|ts|tsx)$/.test(f)){
			out.push(p);
		}
	});
	return out;
}

function scanText(rel, text){
	const bad = [];
	if(ALLOWED[rel]){ return bad; }
	text.split('\n').forEach((line, i)=>{
		if(line.indexOf('.setItem(') < 0){ return; }
		const t = line.trim();
		if(t.startsWith('//') || t.startsWith('*')){ return; }
		if(LINE_ALLOWED.some((a)=>a.file === rel && a.re.test(line))){ return; }
		bad.push(`${rel}:${i + 1}: ${t}`);
	});
	return bad;
}

function offenders(){
	const bad = [];
	walk(SRC, []).forEach((p)=>{
		const rel = path.relative(SRC, p).split(path.sep).join('/');
		bad.push(...scanText(rel, fs.readFileSync(p, 'utf8')));
	});
	return bad;
}

function fillWithCache(){
	const chunk = 'x'.repeat(200000);
	let i = 0;
	try{ for(;;){ window.localStorage.setItem(`horosa.guadesc.cache.v2.${i}`, chunk); i += 1; } }catch(e){ /* full */ }
	let tail = 'y'.repeat(50000); let j = 0;
	while(tail.length > 10){ try{ window.localStorage.setItem(`horosa.guadesc.cache.v2.t${j}`, tail); j += 1; }catch(e){ tail = tail.slice(0, Math.floor(tail.length / 2)); } }
	let k = 0; try{ for(;;){ window.localStorage.setItem(`horosa.guadesc.cache.v2.${k}z`, ''); k += 1; } }catch(e){ /* exactly full */ }
}

beforeEach(()=>{ window.localStorage.clear(); });

describe('源码合同', ()=>{
	it('🔴 `.setItem(` 只出现在存储单源文件里(本地包装一律经 safeStorageSetOn / safeLocalStorageSet)', ()=>{
		expect(offenders()).toEqual([]);
	});
	it('判别力:白名单之外的文件写一行 setItem 就被抓到;白名单文件、注释、窗口身份那一行不算', ()=>{
		expect(scanText('components/x/Foo.js', 'function w(s){\n\ttry{ s.setItem("k", "v"); }catch(e){}\n}')).toEqual(['components/x/Foo.js:2: try{ s.setItem("k", "v"); }catch(e){}']);
		expect(scanText('utils/safeStorage.js', 'window.localStorage.setItem(k, v);')).toEqual([]);
		expect(scanText('components/x/Foo.js', '// storage.setItem(k, v) 旧写法')).toEqual([]);
		expect(scanText('utils/aiAgent/tasks/taskRegistry.js', 'window.sessionStorage.setItem(WINDOW_ID_KEY, id);')).toEqual([]);
		expect(scanText('utils/aiAgent/tasks/taskRegistry.js', 'window.localStorage.setItem("x", id);').length).toBe(1);
	});
});

describe('缓存占满配额时各写入口仍写得进', ()=>{
	it('🔴 七政设置', ()=>{
		const gl = require('../../components/guolao/GuoLaoChartStyle');
		fillWithCache();
		expect(()=>window.localStorage.setItem('horosaGuolaoSu28Mode', '3')).toThrow();
		gl.setStoredGuolaoSu28Mode(3);
		expect(window.localStorage.getItem('horosaGuolaoSu28Mode')).not.toBe(null);
	});
	it('🔴 埃及流派(注入本机 localStorage)', ()=>{
		const eg = require('../../divination/data/egyptianSchools');
		fillWithCache();
		eg.writeEgyptSchool(window.localStorage, eg.normalizeEgyptSchool(null));
		expect(window.localStorage.getItem(eg.EGYPT_SCHOOL_STORAGE_KEY)).not.toBe(null);
	});
	it('safeStorageSetOn:本机 localStorage 走阶梯;别的存储只 try/catch;没有存储回 false', ()=>{
		fillWithCache();
		expect(safeStorageSetOn(window.localStorage, 'horosaLocalServerRootMode', 'manual')).toBe(true);
		const throwing = { setItem(){ throw new Error('x'); } };
		expect(safeStorageSetOn(throwing, 'k', 'v')).toBe(false);
		const mem = {}; const fake = { setItem(k, v){ mem[k] = v; } };
		expect(safeStorageSetOn(fake, 'any.key', 'v')).toBe(true);
		expect(mem['any.key']).toBe('v');
		expect(safeStorageSetOn(null, 'k', 'v')).toBe(false);
		expect(safeLocalStorageSet('horosaGuolaoLifeMode', 'x')).toBe(true);
	});
	it('本机 localStorage 经 safeStorageSetOn 同样过登记闸(未登记键在测试环境即抛)', ()=>{
		expect(()=>safeStorageSetOn(window.localStorage, 'not.registered.key.zz', 'v')).toThrow(/未登记/);
	});
});
