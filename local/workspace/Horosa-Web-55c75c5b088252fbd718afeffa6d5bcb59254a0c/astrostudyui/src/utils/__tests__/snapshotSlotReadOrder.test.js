// 合同:自带内存态 + 延迟落盘的快照槽,读序一律经 snapshotSlotRead.pickFresherSnapshot;清槽连同待落盘的写一起丢。
// 病形:写槽落盘是延迟的(空闲时段;存储写满时一直不落盘),读函数先读存储 → 读回上一份,还拿它覆盖内存里的新一份;
//   清槽只删存储不丢待写 → 空闲刷盘把清掉的旧快照写回去。
// 三层锁:① 行为(参数化跑全部快照槽);② 清槽不复活;③ 静态:凡调 scheduleStorageWrite 的文件,
//   读这把键的函数必须先比对本窗口态(pickFresherSnapshot / peekPendingStorageValue),删这把键必须走 removeStorageNow / dropPendingStorageWrite。
import fs from 'fs';
import path from 'path';
import * as M from '../moduleAiSnapshot';
import * as A from '../astroAiSnapshot';
import * as DS from '../deferredStorage';
import { pickFresherSnapshot } from '../snapshotSlotRead';

const mkChart = (tag, sunLon)=>({ chartId: `cid-${tag}`, chart: { zodiacal: '回归黄道', hsys: 'Alcabitius', isDiurnal: true,
	planets: [ { id: 'Sun', name: '太阳', lon: sunLon, lat: 0, house: 10, sign: '双鱼', speed: 1.0 }, { id: 'Moon', name: '月亮', lon: 102.3, lat: 2.1, house: 1, sign: '巨蟹', speed: 12.5 } ], houses: [], aspects: [] },
	params: { birth: '1991-03-12 10:30:00', zone: '+08:00', lon: '121e28', lat: '31n14' } });

// 每个快照槽:存储键 / 同步存 / 惰性存 / 读 / 取身份(用来判「读到的是哪一份」)
const SLOTS = [
	{
		name: '模块快照',
		key: 'horosa.ai.snapshot.module.v1.zz_slot',
		save: (tag)=>M.saveModuleAISnapshot('zz_slot', `正文-${tag}`, {}),
		saveLazy: (tag)=>M.saveModuleAISnapshotLazy('zz_slot', ()=>`正文-${tag}`, {}),
		load: ()=>M.loadModuleAISnapshot('zz_slot'),
		idOf: (p)=>(p ? p.content : null),
		want: (tag)=>`正文-${tag}`,
		diskPayload: (tag, at)=>({ module: 'zz_slot', version: 1, createdAt: at, meta: {}, content: `正文-${tag}` }),
	},
	{
		name: '星盘主快照',
		key: A.ASTRO_AI_SNAPSHOT_KEY,
		save: (tag)=>A.saveAstroAISnapshot(mkChart(tag, tag.length * 10.5), {}),
		saveLazy: (tag)=>A.saveAstroAISnapshotLazy(mkChart(tag, tag.length * 10.5), {}),
		load: ()=>A.loadAstroAISnapshot(),
		idOf: (p)=>(p ? p.chartId : null),
		want: (tag)=>`cid-${tag}`,
		diskPayload: (tag, at)=>({ version: 1, createdAt: at, signature: '', chartId: `cid-${tag}`, content: `[星盘]\n盘-${tag}` }),
	},
];

describe.each(SLOTS)('$name:落盘前读到本窗口刚写的一份', (slot)=>{
	beforeEach(()=>{ DS.flushStorageWrites(); window.localStorage.clear(); });

	test('旧盘已在存储,同步存新盘后、落盘前连读两次都是新盘', ()=>{
		window.localStorage.setItem(slot.key, JSON.stringify(slot.diskPayload('old', '2000-01-01T00:00:00.000Z')));
		slot.save('new');
		expect(DS.hasPendingStorageWrite(slot.key)).toBe(true);
		expect(slot.idOf(slot.load())).toBe(slot.want('new'));
		expect(slot.idOf(slot.load())).toBe(slot.want('new'));
	});

	test('惰性存:物化后第二次读也不回到存储里的旧盘', ()=>{
		window.localStorage.setItem(slot.key, JSON.stringify(slot.diskPayload('old', '2000-01-01T00:00:00.000Z')));
		slot.saveLazy('lazy');
		expect(slot.idOf(slot.load())).toBe(slot.want('lazy'));
		expect(slot.idOf(slot.load())).toBe(slot.want('lazy'));
	});

	test('存储里的一份更新(别的窗口刚写过)→ 以存储为准', ()=>{
		slot.save('mine');
		window.localStorage.setItem(slot.key, JSON.stringify(slot.diskPayload('other', '2999-01-01T00:00:00.000Z')));
		expect(slot.idOf(slot.load())).toBe(slot.want('other'));
	});

	test('存储写满(落盘失败只留内存)→ 一直读内存的新盘', ()=>{
		window.localStorage.setItem(slot.key, JSON.stringify(slot.diskPayload('old', '2000-01-01T00:00:00.000Z')));
		slot.save('new');
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(()=>{ throw new Error('quota'); });
		try{ DS.flushStorageWrites(); }finally{ spy.mockRestore(); }
		expect(slot.idOf(slot.load())).toBe(slot.want('new'));
	});
});

describe('pickFresherSnapshot 纯函数', ()=>{
	const mem = { createdAt: '2020-01-01T00:00:00.000Z', content: 'M' };
	test.each([
		['存储空', null, 'memory'],
		['存储坏档且内存有', '{bad', 'memory'],
		['存储同一刻', JSON.stringify({ createdAt: '2020-01-01T00:00:00.000Z', content: 'D' }), 'memory'],
		['存储更旧', JSON.stringify({ createdAt: '2019-01-01T00:00:00.000Z', content: 'D' }), 'memory'],
		['存储更新', JSON.stringify({ createdAt: '2021-01-01T00:00:00.000Z', content: 'D' }), 'disk'],
		['存储无正文', JSON.stringify({ createdAt: '2021-01-01T00:00:00.000Z' }), 'memory'],
	])('%s', (_n, raw, source)=>{
		expect(pickFresherSnapshot(mem, raw).source).toBe(source);
	});
	test('纯文本旧存量:内存空才包成旧存量', ()=>{
		expect(pickFresherSnapshot(null, '纯文本', { legacy: (t)=>({ content: t }) })).toEqual({ payload: { content: '纯文本' }, source: 'legacy' });
		expect(pickFresherSnapshot(mem, '纯文本', { legacy: (t)=>({ content: t }) }).source).toBe('memory');
	});
});

describe('清槽:队列里还没落盘的那份不复活', ()=>{
	const KEY = 'horosa.ai.snapshot.module.v1.jieqi_current';
	beforeEach(()=>{ DS.flushStorageWrites(); window.localStorage.clear(); });
	test('同步存 → 清 → 刷盘 → 读为空', ()=>{
		M.saveModuleAISnapshot('jieqi_current', '旧单盘正文', { currentTab: 'x' });
		expect(DS.hasPendingStorageWrite(KEY)).toBe(true);
		M.clearModuleAISnapshot('jieqi_current');
		expect(DS.hasPendingStorageWrite(KEY)).toBe(false);
		DS.flushStorageWrites();
		expect(window.localStorage.getItem(KEY)).toBe(null);
		expect(M.loadModuleAISnapshot('jieqi_current')).toBe(null);
	});
	test('惰性存 → 清 → 刷盘 → 读为空(内存也不被物化写回)', ()=>{
		const factory = jest.fn(()=>'旧惰性正文');
		const token = M.saveModuleAISnapshotLazy('jieqi_current', factory, {});
		M.clearModuleAISnapshot('jieqi_current');
		DS.flushStorageWrites();
		expect(token.materialize()).toBe(null);
		expect(factory).not.toHaveBeenCalled();
		expect(M.loadModuleAISnapshot('jieqi_current')).toBe(null);
	});
	test('removeStorageNow:丢待写 + 删键', ()=>{
		DS.scheduleStorageWrite('zz.k', ()=>'v');
		window.localStorage.setItem('zz.k', 'old');
		expect(DS.removeStorageNow('zz.k')).toBe(true);
		DS.flushStorageWrites();
		expect(window.localStorage.getItem('zz.k')).toBe(null);
	});
});

// 静态锁
const SRC = path.join(__dirname, '../..');
function walk(dir, out){
	fs.readdirSync(dir).forEach((n)=>{
		const p = path.join(dir, n);
		if(fs.statSync(p).isDirectory()){ if(n !== '__tests__' && n !== 'node_modules'){ walk(p, out); } }
		else if(/\.js$/.test(n)){ out.push(p); }
	});
	return out;
}
// 只在启动时读一次、本窗口此前不可能写过的键:读侧不必比对本窗口态(写理由)
const READ_EXEMPT = {
	'utils/bootChartRestore.js': '温启快照只在启动时读一次(models/app 启动效果),此前本窗口还没写过这把键',
};
// 自带另一套本窗口态机制的键(写理由):读这把键的取值函数先判自己的待落盘态
const OWN_WINDOW_STATE = {
};
// 函数体(粗切:按顶层 function / 箭头导出切段),判「同一函数里先比对本窗口态」
function functionChunks(src){
	const out = [];
	const re = /(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|(?:^|\n)export\s+const\s+([A-Za-z_$][\w$]*)\s*=/g;
	const marks = [];
	let m;
	while((m = re.exec(src))){ marks.push({ at: m.index, name: m[1] || m[2] }); }
	marks.forEach((mk, i)=>{ out.push({ name: mk.name, body: src.slice(mk.at, i + 1 < marks.length ? marks[i + 1].at : src.length) }); });
	return out;
}
describe('静态锁:延迟写的键,读先比对本窗口态、删连待写一起丢', ()=>{
	const files = walk(SRC, []).filter((f)=>!/deferredStorage\.js$/.test(f)).filter((f)=>/\bscheduleStorageWrite\s*\(/.test(fs.readFileSync(f, 'utf8')));
	// 探针自证:已知的延迟写文件一个不落都扫得到(逐个登记,不拿总数当门槛 —— 模块可选的文件各自在自己的标记块里登记)
	const KNOWN_DEFERRED = ['utils/bootChartRestore.js', 'utils/moduleAiSnapshot.js', 'utils/astroAiSnapshot.js'];
	test('已知的延迟写文件都扫得到(探针自证)', ()=>{
		const found = files.map((f)=>path.relative(SRC, f).split(path.sep).join('/'));
		expect(KNOWN_DEFERRED.filter((k)=>found.indexOf(k) < 0)).toEqual([]);
		expect(found.length).toBeGreaterThanOrEqual(KNOWN_DEFERRED.length);
	});
	test('读函数:读延迟写过的键,所在函数必须先比对本窗口态(pickFresherSnapshot / peekPendingStorageValue)', ()=>{
		const bad = [];
		let checked = 0;
		files.forEach((f)=>{
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			if(READ_EXEMPT[rel]){ return; }
			const src = fs.readFileSync(f, 'utf8');
			const written = new Set();
			src.replace(/scheduleStorageWrite\s*\(\s*([A-Za-z_$][\w$.]*)/g, (_m, t)=>{ written.add(t); return _m; });
			functionChunks(src).forEach(({ name, body })=>{
				const re = /localStorage\.getItem\s*\(\s*([A-Za-z_$][\w$.]*)/g;
				let m;
				while((m = re.exec(body))){
					if(!written.has(m[1]) || OWN_WINDOW_STATE[`${rel}#${m[1]}`]){ continue; }
					checked += 1;
					if(!/(pickFresherSnapshot|peekPendingStorageValue)\s*\(/.test(body)){ bad.push(`${rel}:${name}(${m[1]})`); }
				}
			});
		});
		expect(checked).toBeGreaterThanOrEqual(2);   // 至少模块快照 / 星盘主快照两处在锁内
		expect(bad).toEqual([]);
	});
	test('删键:凡 removeItem 必须同时丢待写(removeStorageNow / dropPendingStorageWrite)', ()=>{
		const bad = [];
		files.forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			if(/localStorage\.removeItem\s*\(/.test(src) && !/(removeStorageNow|dropPendingStorageWrite)\s*\(/.test(src)){
				bad.push(path.relative(SRC, f));
			}
		});
		expect(bad).toEqual([]);
	});
	test('两个快照槽的读函数都经 pickFresherSnapshot', ()=>{
		['utils/moduleAiSnapshot.js', 'utils/astroAiSnapshot.js'].forEach((rel)=>{
			const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
			expect(src).toMatch(/pickFresherSnapshot\s*\(/);
		});
	});
	// 延迟写的键 → 所属文件:取 scheduleStorageWrite 首参里(含它调到的同文件函数里)出现的字符串常量
	function deferredKeyOwners(){
		const owners = [];
		files.forEach((f)=>{
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			const src = fs.readFileSync(f, 'utf8');
			const consts = {};
			src.replace(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']+)'/g, (_m, n, v)=>{ consts[n] = v; return _m; });
			const chunks = {};
			functionChunks(src).forEach(({ name, body })=>{ chunks[name] = body; });
			const idents = new Set();
			src.replace(/scheduleStorageWrite\s*\(\s*([^,]+),/g, (_m, arg)=>{
				(arg.match(/[A-Za-z_$][\w$]*/g) || []).forEach((id)=>{
					idents.add(id);
					if(chunks[id]){ (chunks[id].match(/[A-Za-z_$][\w$]*/g) || []).forEach((x)=>idents.add(x)); }
				});
				return _m;
			});
			idents.forEach((id)=>{ if(consts[id]){ owners.push({ rel, name: id, value: consts[id] }); } });
		});
		return owners;
	}
	test('跨文件:别的文件不许绕开所属模块直读延迟写的键(按键常量名 / 字面值认),一律经它的读函数', ()=>{
		const owners = deferredKeyOwners();
		// 探针自证:模块快照前缀与星盘主快照键都认得出
		expect(owners.map((o)=>o.name)).toEqual(expect.arrayContaining(['MODULE_SNAPSHOT_PREFIX', 'ASTRO_AI_SNAPSHOT_KEY']));
		const bad = [];
		walk(SRC, []).forEach((f)=>{
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			const src = fs.readFileSync(f, 'utf8');
			if(!/localStorage\.getItem\s*\(/.test(src)){ return; }
			functionChunks(src).forEach(({ name, body })=>{
				if(!/localStorage\.getItem\s*\(/.test(body)){ return; }
				owners.forEach((o)=>{
					if(o.rel === rel){ return; }
					const byName = new RegExp(`\\b${o.name}\\b`).test(body) && new RegExp(`import[^;]*\\b${o.name}\\b[^;]*from`).test(src);
					const byValue = body.indexOf(`'${o.value}`) >= 0 || body.indexOf(`"${o.value}`) >= 0 || body.indexOf(`\`${o.value}`) >= 0;
					if(byName || byValue){ bad.push(`${rel}:${name} 直读 ${o.name}`); }
				});
			});
		});
		expect(bad).toEqual([]);
	});
	test('跨文件锁判别力:直读模块快照前缀的写法会被认出', ()=>{
		const owners = deferredKeyOwners();
		const mod = owners.find((o)=>o.name === 'MODULE_SNAPSHOT_PREFIX');
		expect(mod && mod.value).toBe(M.MODULE_SNAPSHOT_PREFIX);
		const body = `function scan(){ for(let i=0;i<9;i++){ const k = localStorage.key(i); if(k.indexOf(MODULE_SNAPSHOT_PREFIX) === 0){ return localStorage.getItem(k); } } }`;
		const src = `import { MODULE_SNAPSHOT_PREFIX } from '../moduleAiSnapshot';\n${body}`;
		expect(new RegExp(`\\b${mod.name}\\b`).test(body) && new RegExp(`import[^;]*\\b${mod.name}\\b[^;]*from`).test(src)).toBe(true);
	});
	test('模块快照前缀只有一份字面量(所属模块)', ()=>{
		const hits = walk(SRC, []).filter((f)=>fs.readFileSync(f, 'utf8').indexOf(`'${M.MODULE_SNAPSHOT_PREFIX}'`) >= 0)
			.map((f)=>path.relative(SRC, f).split(path.sep).join('/'));
		expect(hits).toEqual(['utils/moduleAiSnapshot.js']);
	});
	test('豁免表不过期:登记的文件仍存在且仍调 scheduleStorageWrite', ()=>{
		Object.keys(READ_EXEMPT).forEach((rel)=>{
			const p = path.join(SRC, rel);
			if(!fs.existsSync(p)){ return; }   // 检出里没有这页(共享检出)不算过期
			expect(fs.readFileSync(p, 'utf8')).toMatch(/scheduleStorageWrite\s*\(/);
		});
	});
});
