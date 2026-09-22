// [P0-S5] 记录库写放大根治:逐记录序列化缓存 / 装饰排序 / 缓存对象身份保持 —— 储存字节与旧路径恒等的机械证明。
//
// 判据总纲:
//   ① 序列化器与 JSON.stringify(list) 逐字节相等(随机记录属性测试,含元素级口径 undefined/函数/NaN/-0/1e21);
//   ② 任意公开 API 写序列之后,localStorage 原串 === JSON.stringify(内核当前列表)(经 exportBackup 读到的缓存对象;
//      缓存对象 ≡ 储存字节是 [S9] 契约,本套件把它推广到快路径),且开关开/关两态同序列逐步字节相同;
//   ③ 未触碰记录跨写保持对象同一;④ 平局顺序与朴素比较器一致;⑤ 预算;⑥ 开关关路径同过。
import { __serializeListForTests } from '../localRecordStore';
import {
	upsertLocalChart, listLocalCharts, removeLocalChart, pinLocalChart, moveLocalChart, flagLocalChart,
	touchLocalChart, importLocalChartsBackup, exportLocalChartsBackup,
} from '../localcharts';

const CHARTS_KEY = 'horosa.localCharts.v1';
const FLAG_KEY = 'horosa.perf.recordStoreFastWrite';
const TIMES = ['2026-08-01 10:00:00', '2026-08-01 10:00:00', '2026-07-15 08:00:00', '2025-01-01 00:00:00', '2026-08-02 09:30:00', ''];

// 可复现伪随机(mulberry32):同 seed 同序列,两态对拍的前提。
function mulberry32(seed){
	let a = seed >>> 0;
	return function(){
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const PIECES = ['甲', '乙', '张三', '李四·王五', '龍鳳呈祥', '😀', '🐉🌙', ' ', 'a"b\\c', '\n\t', '\x00', '𝌆', '<p>', 'é', ' ', '中文 空格', '\ud800'];

function randStr(rng){
	const n = 1 + Math.floor(rng() * 4);
	let s = '';
	for(let i = 0; i < n; i++){
		s += PIECES[Math.floor(rng() * PIECES.length)];
	}
	return s;
}

function randScalar(rng){
	switch(Math.floor(rng() * 12)){
		case 0: return undefined;
		case 1: return null;
		case 2: return 1e21;
		case 3: return -0;
		case 4: return NaN;
		case 5: return Infinity;
		case 6: return rng() < 0.5;
		case 7: return Math.floor(rng() * 1e6) - 5e5;
		case 8: return rng() * 1e-7;
		case 9: return randStr(rng);
		case 10: return JSON.stringify({ a: randStr(rng), b: [1, null] });   // 嵌套 payload 串
		default: return 12345678901234567890;   // 超精度整数
	}
}

function randValue(rng, depth){
	const k = rng();
	if(depth < 2 && k < 0.15){
		const arr = [];
		const n = Math.floor(rng() * 4);
		for(let i = 0; i < n; i++){
			arr.push(randValue(rng, depth + 1));
		}
		return arr;
	}
	if(depth < 2 && k < 0.3){
		const o = {};
		const n = Math.floor(rng() * 4);
		for(let i = 0; i < n; i++){
			o[randStr(rng)] = randValue(rng, depth + 1);
		}
		return o;
	}
	return randScalar(rng);
}

function randRecord(rng, i){
	const rec = { cid: `local-p-${i}`, name: randStr(rng), updateTime: TIMES[Math.floor(rng() * TIMES.length)] };
	const n = Math.floor(rng() * 7);
	for(let k = 0; k < n; k++){
		rec[`k${k}_${randStr(rng)}`] = randValue(rng, 0);
	}
	if(rng() < 0.5){
		rec.explicitUndefined = undefined;
	}
	rec.payload = rng() < 0.5 ? JSON.stringify({ snapshot: randStr(rng), nested: { arr: [1, null, randStr(rng)] } }) : null;
	return rec;
}

function storedText(){
	return window.localStorage.getItem(CHARTS_KEY);
}

// 恒等式:储存字节 === JSON.stringify(内核当前列表)。储存序恒为 updateTime 倒序稳定序(写者皆经排序或原位替换),
// 故 exportBackup 的再排序是恒等映射,读到的正是内核缓存对象序列。
function assertBytesIdentity(){
	const stored = storedText();
	if(stored === null){
		// 尚未发生任何落盘写(如首步是对未知 cid 的置顶/移动)→ 键不存在,内核列表必为空
		expect(exportLocalChartsBackup().charts).toEqual([]);
		return;
	}
	expect(stored).toBe(JSON.stringify(exportLocalChartsBackup().charts));
}

// 随机混合写序列(公开 API):新增/合并改/归档星标/置顶/上下移/足迹/删除/导入。每步校验恒等式,返回逐步字节。
function runSequence(seed, steps){
	const rng = mulberry32(seed);
	const bytes = [];
	const known = [];
	let counter = 0;
	const pickCid = ()=>(known.length ? known[Math.floor(rng() * known.length)] : null);
	const pickTime = ()=>TIMES[Math.floor(rng() * (TIMES.length - 1))];
	for(let s = 0; s < steps; s++){
		const op = Math.floor(rng() * 10);
		if(op <= 2){
			counter += 1;
			const cid = `local-seq-${counter}`;
			known.push(cid);
			const values = {
				cid, name: randStr(rng), birth: '1990-01-01 08:00:00', zone: '+08:00',
				payload: rng() < 0.5 ? { snapshot: randStr(rng), n: [1, 2] } : undefined,
				group: rng() < 0.5 ? ['标签', randStr(rng)] : undefined,
				doubingSu28: undefined,
				memo: rng() < 0.3 ? randStr(rng) : undefined,
				extraKey: rng() < 0.3 ? randValue(rng, 0) : undefined,
			};
			if(rng() < 0.7){
				values.updateTime = pickTime();
				values.preserveUpdateTime = true;
			}
			upsertLocalChart(values);
		}else if(op === 3){
			const cid = pickCid();
			if(cid){
				const patch = { cid, name: randStr(rng), memoAstro: randStr(rng) };
				if(rng() < 0.5){
					patch.updateTime = pickTime();
					patch.preserveUpdateTime = true;
				}
				upsertLocalChart(patch);
			}
		}else if(op === 4){
			const cid = pickCid();
			if(cid){
				flagLocalChart(cid, rng() < 0.5 ? 'archived' : 'starred', rng() < 0.6);
			}
		}else if(op === 5){
			const cid = pickCid();
			if(cid){
				pinLocalChart(cid, [1, -1, 0][Math.floor(rng() * 3)]);
			}
		}else if(op === 6){
			const cid = pickCid();
			if(cid){
				moveLocalChart(cid, rng() < 0.5 ? -1 : 1);
			}
		}else if(op === 7){
			const cid = pickCid();
			if(cid){
				touchLocalChart(cid);
			}
		}else if(op === 8){
			const cid = pickCid();
			if(cid && rng() < 0.5){
				removeLocalChart(cid);
			}
		}else{
			const charts = [];
			const k = 1 + Math.floor(rng() * 3);
			for(let j = 0; j < k; j++){
				if(rng() < 0.5 && known.length){
					charts.push({ cid: pickCid(), name: randStr(rng), birth: '1990-01-01 08:00:00', updateTime: pickTime(), hsys: 3 });
				}else{
					counter += 1;
					const cid = `local-imp-${counter}`;
					known.push(cid);
					charts.push({ cid, name: randStr(rng), birth: '1991-02-02 09:00:00', updateTime: pickTime(), group: '["导入"]', doubingSu28: undefined });
				}
			}
			importLocalChartsBackup({ format: 'horosa-local-charts', version: 1, charts });
		}
		assertBytesIdentity();
		bytes.push(storedText());
	}
	return bytes;
}

// 显式 undefined 键往返消失口径:内核列表对象的 own keys 与储存字节解析结果逐记录同序同集。
function assertUndefinedKeyParity(){
	const parsed = JSON.parse(storedText());
	const live = listLocalCharts({ includeArchived: true });
	expect(live.length).toBe(parsed.length);
	parsed.forEach((p)=>{
		const l = live.find((r)=>r.cid === p.cid);
		expect(Object.keys(l)).toEqual(Object.keys(p));
		expect('doubingSu28' in l).toBe(false);
	});
}

describe('[P0-S5] 记录库写放大根治', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	afterEach(()=>{
		jest.useRealTimers();
	});

	it('① 属性:300 条随机记录 serializeList ≡ JSON.stringify(逐字节;二次调用命中缓存仍恒等;元素级口径)', ()=>{
		const rng = mulberry32(20260903);
		const list = [];
		for(let i = 0; i < 300; i++){
			list.push(randRecord(rng, i));
		}
		expect(__serializeListForTests(list)).toBe(JSON.stringify(list));
		expect(__serializeListForTests(list)).toBe(JSON.stringify(list));
		// 局部改序/子集 → 仍恒等(缓存按对象身份,不按位置)
		const shuffled = list.slice().reverse().filter((_, i)=>i % 3 !== 0);
		expect(__serializeListForTests(shuffled)).toBe(JSON.stringify(shuffled));
		// 元素级口径:undefined/函数/symbol/NaN/-0/1e21/嵌套数组/null/Date(toJSON)/字符串/小数
		const odd = [undefined, ()=>1, Symbol('s'), NaN, -0, 1e21, [1, [2, { x: undefined, y: ()=>0 }]], null, new Date(0), 'x', 0.1, true, { toJSON(){ return undefined; } }];
		expect(__serializeListForTests(odd)).toBe(JSON.stringify(odd));
		expect(__serializeListForTests([])).toBe('[]');
		expect(__serializeListForTests([null])).toBe('[null]');
	});

	it('② 随机 200 步混合写序列后 储存字节 ≡ JSON.stringify(内核列表);显式 undefined 键往返口径一致;⑥ 开关关同序列逐步字节相同', ()=>{
		jest.useFakeTimers('modern');
		jest.setSystemTime(new Date(2026, 7, 3, 12, 0, 0));
		const onBytes = runSequence(424242, 200);
		expect(onBytes.length).toBe(200);
		expect(JSON.parse(onBytes[199]).length).toBeGreaterThan(20);
		assertUndefinedKeyParity();
		// 开关关(旧整库 stringify/parse 路径)跑同一序列 → 每步字节逐位相同(两实现互为 oracle)
		window.localStorage.clear();
		window.localStorage.setItem(FLAG_KEY, '0');
		const offBytes = runSequence(424242, 200);
		expect(offBytes).toEqual(onBytes);
		assertUndefinedKeyParity();
	});

	it('③ 未触碰记录跨写保持对象同一(===);被改/新建/置顶/足迹的目标记录换新对象;冻结共享引用后继续写不抛', ()=>{
		'use strict';
		['1', '2', '3'].forEach((k, i)=>{
			upsertLocalChart({ cid: `local-i-${k}`, name: `身份${k}`, birth: '1990-01-01 08:00:00', zone: '+08:00', doubingSu28: undefined, updateTime: `2026-08-0${i + 1} 10:00:00`, preserveUpdateTime: true });
		});
		const a = listLocalCharts({ includeArchived: true });
		expect(a.length).toBe(3);
		upsertLocalChart({ cid: 'local-i-4', name: '身份4', birth: '1990-01-01 08:00:00', updateTime: '2026-08-04 10:00:00', preserveUpdateTime: true });
		const b = listLocalCharts({ includeArchived: true });
		expect(b.length).toBe(4);
		a.forEach((r)=>expect(b.find((x)=>x.cid === r.cid)).toBe(r));
		// 新建条目=JSON 往返后的规范对象:显式 undefined 键不是 own key
		expect('doubingSu28' in b.find((x)=>x.cid === 'local-i-4')).toBe(false);
		// 合并改:只有目标换对象
		upsertLocalChart({ cid: 'local-i-2', name: '身份2改' });
		const c = listLocalCharts({ includeArchived: true });
		expect(c.find((x)=>x.cid === 'local-i-2')).not.toBe(b.find((x)=>x.cid === 'local-i-2'));
		expect(c.find((x)=>x.cid === 'local-i-2').name).toBe('身份2改');
		['local-i-1', 'local-i-3', 'local-i-4'].forEach((cid)=>expect(c.find((x)=>x.cid === cid)).toBe(b.find((x)=>x.cid === cid)));
		// 置顶/足迹/星标:内核直写路径同样只换目标
		pinLocalChart('local-i-1', 1);
		touchLocalChart('local-i-3');
		flagLocalChart('local-i-4', 'starred', true);
		const d = listLocalCharts({ includeArchived: true });
		expect(d.find((x)=>x.cid === 'local-i-1')).not.toBe(c.find((x)=>x.cid === 'local-i-1'));
		expect(d.find((x)=>x.cid === 'local-i-1').pinTier).toBe(1);
		expect(d.find((x)=>x.cid === 'local-i-3').openCount).toBe(1);
		expect(d.find((x)=>x.cid === 'local-i-4').starred).toBe(true);
		expect(d.find((x)=>x.cid === 'local-i-2')).toBe(c.find((x)=>x.cid === 'local-i-2'));
		// 冻结审计延伸到快路径:共享引用冻结后 新建/足迹/删除/导入 皆不抛,字节恒等仍成立
		d.forEach((r)=>Object.freeze(r));
		expect(()=>{
			upsertLocalChart({ cid: 'local-i-5', name: '身份5', birth: '1990-01-01 08:00:00' });
			touchLocalChart('local-i-3');
			removeLocalChart('local-i-4');
			importLocalChartsBackup({ format: 'horosa-local-charts', version: 1, charts: [{ cid: 'local-i-1', name: '身份1导', birth: '1990-01-01 08:00:00', updateTime: '2026-08-01 10:00:00' }] });
		}).not.toThrow();
		assertBytesIdentity();
		expect(listLocalCharts({ includeArchived: true }).map((r)=>r.cid).sort()).toEqual(['local-i-1', 'local-i-2', 'local-i-3', 'local-i-5']);
	});

	it('④ 同 updateTime 平局顺序与朴素比较器(稳定排序)逐位一致;list 的 updateTime 升序=倒序反转', ()=>{
		const naive = (a, b)=>{
			const ta = Date.parse(a.updateTime || '') || 0;
			const tb = Date.parse(b.updateTime || '') || 0;
			return tb - ta;
		};
		const rng = mulberry32(7);
		// 空 updateTime 记录只能由储存直写种入(upsert 对空值一律填当前时刻),模拟数组同步持有 '' → 覆盖 t=0 沉底保序
		const sim = [];
		const seeded = [];
		for(let k = 0; k < 3; k++){
			seeded.push({ cid: `local-tie-empty-${k}`, name: `e${k}`, birth: '1990-01-01 08:00:00', updateTime: '', schemaVersion: 2 });
			sim.push({ cid: `local-tie-empty-${k}`, updateTime: '' });
		}
		window.localStorage.setItem(CHARTS_KEY, JSON.stringify(seeded));
		const validTimes = TIMES.filter(Boolean);
		for(let i = 0; i < 120; i++){
			const reuse = sim.length && rng() < 0.4;
			const cid = reuse ? sim[Math.floor(rng() * sim.length)].cid : `local-tie-${i}`;
			const updateTime = validTimes[Math.floor(rng() * validTimes.length)];
			upsertLocalChart({ cid, name: `t${i}`, birth: '1990-01-01 08:00:00', updateTime, preserveUpdateTime: true });
			const idx = sim.findIndex((r)=>r.cid === cid);
			if(idx >= 0){
				sim[idx] = { cid, updateTime };
			}else{
				sim.push({ cid, updateTime });
			}
			sim.sort(naive);
			expect(exportLocalChartsBackup().charts.map((r)=>r.cid)).toEqual(sim.map((r)=>r.cid));
			expect(listLocalCharts({ orderBy: 'updateTime', orderDir: 'asc' }).map((r)=>r.cid)).toEqual(sim.map((r)=>r.cid).reverse());
		}
		// 空 updateTime 记录(Date.parse('')=NaN→0)恒沉底且相互保持插入序
		const tail = exportLocalChartsBackup().charts.filter((r)=>!r.updateTime).map((r)=>r.cid);
		expect(tail).toEqual(sim.filter((r)=>!r.updateTime).map((r)=>r.cid));
	});

	it('⑤ 预算:1200 库 50 次 upsert(新增+合并改各半)≤ 1.5s(jsdom),且字节恒等', ()=>{
		const seed = [];
		for(let i = 0; i < 1200; i++){
			seed.push({
				cid: `local-b-${i}`, name: `大库${i}`, birth: '1990-01-01 08:00:00', ad: 1, zone: '+08:00', lat: '39n54', lon: '116e28',
				gpsLat: 39.9, gpsLon: 116.47, pos: '北京', gender: i % 2, isPub: 0, group: '["大库"]', creator: 'local',
				updateTime: `2026-0${1 + (i % 8)}-${String(1 + (i % 28)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:00:00`,
				memoAstro: `备注${i}`.repeat(8), payload: JSON.stringify({ snapshot: `快照正文${i}`.repeat(30), k: i }), sourceModule: null, schemaVersion: 2,
			});
		}
		window.localStorage.setItem(CHARTS_KEY, JSON.stringify(seed));
		listLocalCharts({});   // 冷读入缓存(首写要为全部记录建串,一次性成本)
		const t0 = Date.now();
		for(let i = 0; i < 50; i++){
			if(i % 2 === 0){
				upsertLocalChart({ cid: `local-b-new-${i}`, name: `新增${i}`, birth: '1991-01-01 08:00:00', zone: '+08:00', payload: { snapshot: `新快照${i}` }, updateTime: `2026-08-${String(1 + (i % 28)).padStart(2, '0')} 10:00:00`, preserveUpdateTime: true });
			}else{
				upsertLocalChart({ cid: `local-b-${(i * 37) % 1200}`, name: `改名${i}`, memo: `改备注${i}` });
			}
		}
		const dt = Date.now() - t0;
		expect(dt).toBeLessThanOrEqual(1500);
		expect(listLocalCharts({ includeArchived: true }).length).toBe(1225);
		assertBytesIdentity();
	});

	it('⑥ 开关 \'0\':序列化器仍恒等;写路径回旧全量 stringify/parse,恒等式与身份契约(读缓存共享引用)照旧', ()=>{
		window.localStorage.setItem(FLAG_KEY, '0');
		const rng = mulberry32(99);
		const list = [];
		for(let i = 0; i < 300; i++){
			list.push(randRecord(rng, i));
		}
		expect(__serializeListForTests(list)).toBe(JSON.stringify(list));
		jest.useFakeTimers('modern');
		jest.setSystemTime(new Date(2026, 7, 3, 12, 0, 0));
		runSequence(31337, 120);
		assertUndefinedKeyParity();
		const a = listLocalCharts({ includeArchived: true });
		const b = listLocalCharts({ includeArchived: true });
		expect(a).not.toBe(b);
		a.forEach((r, i)=>expect(b[i]).toBe(r));
	});
});
