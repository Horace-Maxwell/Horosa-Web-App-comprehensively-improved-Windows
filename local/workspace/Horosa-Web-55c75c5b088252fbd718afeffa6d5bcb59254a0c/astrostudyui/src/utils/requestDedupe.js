// 计算类请求 去重 + 短 TTL 会话缓存(perfFlag: horosa.perf.requestDedupe,默认开)。
//
// 语义:只对「幂等只读计算端点白名单」生效——同 (url + 明文 body) 的
//   ① 进行中请求共享同一网络往返(in-flight 去重:多组件同时要同一盘只发一次);
//   ② 完成后的成功结果在 30s 内直接命中(TTL 缓存:快速连切开关免重复 RSA+网络)。
// 键用「加密前的明文 body」(加密含随机密钥,密文每次不同不可作键)。
// 返回值一律 structuredClone 深拷贝——调用方各拿独立副本,杜绝共享引用被就地修改的互染。
// 失败(reject)绝不缓存;白名单外 100% 直通零行为差异。后端本就有 paramhash 缓存,
// 本层省的是「网络+RSA+序列化」的往返,与后端缓存互补而非重复。
import { requestDedupeEnabled, techniqueCacheEnabled, netResultCacheEnabled } from './perfFlags';
import { idbGet, idbScheduleWrite } from './idbCacheStore';

// 幂等只读计算端点(前缀匹配,path 部分)。写操作/用户态/流式(aianalysis SSE)/随机
// (dice)/实时(heartbeat/planetarium/state)一律不入列。
const DEDUPE_PATH_PREFIXES = [
	'/chart',            // 主盘/chart13/chart12(前缀覆盖)
	'/predict/',         // 全推运(solararc/pd/zr/profection…;dice 例外见下)
	'/india/',
	'/modern/',
	'/germany/',
	'/jieqi/',
	'/location/acg',     // ACG 主图/落点/事件
	'/astroextra/',
	'/calc/',
	'/jdn/',
	// 极速化大修(WP-D/P1):两族幂等纯计算端点补入 —— 同参重放(来回拨时间/步进预取)即命中。
	'/ziwei/',           // 紫微 birth/rules(确定性排盘)
	'/liureng/',         // 六壬/金口诀共用 gods/runyear(确定性神将)
	// R4-B6:精确条目补入(预取白名单里走 request() 的端点须同时可缓存,否则「允许预取
	// 却无处落桶」=白取)。🔴 /bazi 族含写端点(pattern/update)——绝不整前缀,只收两个
	// 确定性读端点(后端 ParamHashCacheHelper 同缓存、无随机,可缓存性已定谳);
	// ReportPane 三处 /bazi/direct 因此自动获得三层缓存(零改动收益)。
	'/bazi/birth',
	'/bazi/direct',
	'/nongli/time',      // 真太阳时+四柱(确定性历法;bridge 外散点调用的落桶)
	// [Windows-only] horosa_dedupe_chart3d_v1:/chart3d/state,3D 星盘状态(确定性纯计算,
	// v3.5.0 起独立路由)。AstroChartMain3D 的步进预取声明此路径 —— 缺本行 =「允许预取却
	// 无处落桶」,预取白取。上游收编 L1-LRU 后本行是该补丁仅存的 Windows 残差,守卫即本 marker。
	'/chart3d',
];
const DEDUPE_PATH_EXCLUDES = [
	'/predict/dice',     // 随机骰子,绝不可缓存
	'/bazi/pattern',     // R4-B6 纵深防御:族内写端点,防未来有人把上面改成宽前缀
];

const TTL_MS = 30 * 1000;
// R4-B1:80 → 160。预取从「只有 /chart 一条」扩到十几个技法端点后,单次 settle
// 就可能写入 5+ 条,80 的窗口在连续步进下不到 20 步就整轮翻掉。配合 horosa_dedupe_l1_lru_v1
// (命中重插=真 LRU)一起,热条目才真的留得住。
const MAX_ENTRIES = 160;
// L2 技法结果缓存(perfFlag: horosa.perf.techniqueCache,默认开):
// 覆盖「来回拨参数」场景——用户在设置 A↔B 间反复切换,30s L1 已过期仍应≈0ms 命中。
// 键/白名单与 L1 完全一致(纯函数计算结果);10min 保守新鲜窗;48 条 LRU(访问提升)。
const L2_TTL_MS = 10 * 60 * 1000;
// R4-B1:48 → 192 —— L2 是 10min 窗的「来回拨」层,技法族全量接入预取后
// 48 条连一次完整的技法巡览都装不下,预取自己就会把上一个技法的结果挤掉。
const L2_MAX_ENTRIES = 192;

const inflight = new Map();   // key -> Promise<result>
// L1:key -> { at, value }。⚠️ 单靠「Map 插入序」只等于 **FIFO**,不是 LRU —— 必须在命中时
// 重插(见 dedupedRequest 的 horosa_dedupe_l1_lru_v1)才真正是 LRU。原注释写的是「插入序=简易
// LRU」,而 prune() 从头淘汰,于是热条目会被一串后台预取挤掉,预取自己却活着(R4-B1 修)。
const done = new Map();
const warm = new Map();       // L2:key -> { at, value }(访问提升式 LRU)

// [A1] L3 持久层(IndexedDB,perfFlag horosa.perf.netResultCache 默认开):
// 覆盖「跨会话/重启后同参再选」—— L1/L2 皆内存态重启即冷,而这些端点是纯函数计算
// (同参恒同果,白名单同上),Java 侧同键磁盘缓存已证明命中价值;本层把前端侧的
// 「网络+RSA+序列化」也一并归零。
// 🔴 键必须【去端口化】:后端口每次启动随机(url 含 127.0.0.1:<随机口>),用全 url 作键
// 跨会话永不命中 —— 以 path+body 为键。TTL 24h(与 Java paramhash 同窗)+ 信封 rev
// 版本闸(算法层变更时 bump 防陈果);undefined/null 载荷与失败一律不入,与 L1/L2 同律。
const L3_REV_BASE = 'net-v1';
const L3_TTL_MS = 24 * 60 * 60 * 1000;
// [T1] runtime 版本掺入信封 rev:壳在 URL 带 &rv=<runtimeVersion>(真在跑的 manifest 版本),
// runtime 更新后 rev 变 → 旧信封整体判 miss —— 封死「更新后 24h 内 L3 回放旧算法结果」的
// 陈果窗。dev 直跑无 rv 参 → rev 保持 net-v1(旧行为逐字节不变)。
let l3RevCache = null;
function l3Rev(){
	if(l3RevCache !== null){
		return l3RevCache;
	}
	let rev = L3_REV_BASE;
	try{
		if(typeof window !== 'undefined' && window.location){
			const rv = new URLSearchParams(window.location.search || '').get('rv');
			if(rv){
				rev = `${L3_REV_BASE}|${rv}`;
			}
		}
	}catch(e){ /* 无 window/坏参=基础 rev */ }
	l3RevCache = rev;
	return rev;
}
// 测试钩子:清 rev 缓存(变更 location.search 后重取)。
export function __resetL3RevForTest(){
	l3RevCache = null;
}
function l3Key(url, body){
	return `net.${pathOf(url)} ${body}`;
}
// idbCacheStore 值契约=字符串(rec.v):写侧 factory 返 JSON 串,读侧 parse 信封。
async function l3Get(url, body){
	if(!netResultCacheEnabled()){
		return undefined;
	}
	try{
		const raw = await idbGet(l3Key(url, body));
		if(typeof raw !== 'string' || !raw){
			return undefined;
		}
		const row = JSON.parse(raw);
		if(row && row.rev === l3Rev() && typeof row.at === 'number'
			&& (Date.now() - row.at) <= L3_TTL_MS
			&& row.value !== undefined && row.value !== null){
			return row.value;
		}
	}catch(e){ /* IDB 不可用/坏档即当 miss,零正确性影响 */ }
	return undefined;
}
function l3Put(url, body, value){
	if(!netResultCacheEnabled() || value === undefined || value === null){
		return;
	}
	try{
		const at = Date.now();
		idbScheduleWrite(l3Key(url, body), ()=>{
			try{
				return JSON.stringify({ rev: l3Rev(), at, value });
			}catch(e){
				return null;   // 不可序列化载荷不入 L3(L1/L2 内存态照常)
			}
		});
	}catch(e){ /* 写失败=下次重算,无害 */ }
}
// 测试钩子:键构造与信封逻辑可单测(去端口化/版本闸)。
export function __l3KeyForTest(url, body){
	return l3Key(url, body);
}

function pathOf(url){
	try{
		const u = `${url}`;
		const i = u.indexOf('://');
		if(i < 0){
			return u;
		}
		const rest = u.slice(i + 3);
		const s = rest.indexOf('/');
		return s < 0 ? '/' : rest.slice(s);
	}catch(e){
		return '';
	}
}

export function dedupeEligible(url, options){
	if(!requestDedupeEnabled()){
		return false;
	}
	if(!options || typeof options.body !== 'string' || !options.body){
		return false;   // 只处理明确的 JSON body 请求
	}
	if(options.method && `${options.method}`.toUpperCase() !== 'POST'){
		return false;
	}
	const p = pathOf(url);
	if(!p){
		return false;
	}
	if(DEDUPE_PATH_EXCLUDES.some((x) => p.startsWith(x))){
		return false;
	}
	return DEDUPE_PATH_PREFIXES.some((x) => p.startsWith(x));
}

function cloneValue(v){
	try{
		if(typeof structuredClone === 'function'){
			return structuredClone(v);
		}
	}catch(e){ /* 含不可克隆字段时退 JSON 兜底 */ }
	try{
		return JSON.parse(JSON.stringify(v));
	}catch(e){
		return v;   // 兜底:宁可共享引用也不破坏调用
	}
}

function prune(){
	const now = Date.now();
	for(const [k, ent] of done){
		if(now - ent.at > TTL_MS){
			done.delete(k);
		}
	}
	while(done.size > MAX_ENTRIES){
		const first = done.keys().next().value;
		done.delete(first);
	}
}

function pruneWarm(){
	const now = Date.now();
	for(const [k, ent] of warm){
		if(now - ent.at > L2_TTL_MS){
			warm.delete(k);
		}
	}
	while(warm.size > L2_MAX_ENTRIES){
		const first = warm.keys().next().value;
		warm.delete(first);
	}
}

// runner: () => Promise<result>(真正的网络执行体,由 request() 传入)
export function dedupedRequest(url, options, runner){
	const key = `${url}\x00${options.body}`;
	const hit = done.get(key);
	if(hit && (Date.now() - hit.at) <= TTL_MS){
		// horosa_dedupe_l1_lru_v1(R4-B1):命中必须重插。Map 的迭代序 == 插入序,而 prune()
		// 是从头部淘汰的 —— 不重插就意味着 **L1 是 FIFO 而不是 LRU**:一串后台预取会把
		// 用户正在反复访问的那条挤出去,预取自己反而活着。预取从 1 个端点扩到十几个技法之后,
		// 这个方向是反的,会主动伤害命中率。L2 的 warm 分支一直是对的,只有 L1 漏了。
		// ★ 刻意不刷新 hit.at:LRU 是「淘汰顺序」,TTL 是「新鲜度」,刷 at 会让热条目永不过期 =
		//   偷偷改变缓存语义。与 L2 的做法保持一致(它也原样重插,不动 at)。
		done.delete(key);
		done.set(key, hit);
		return Promise.resolve(cloneValue(hit.value));
	}
	if(hit){
		done.delete(key);
	}
	// L2:L1 未中再查(10min 窗);命中即访问提升 + 回填 L1(后续 30s 走 L1 快路径)
	if(techniqueCacheEnabled()){
		const warmHit = warm.get(key);
		if(warmHit && (Date.now() - warmHit.at) <= L2_TTL_MS){
			warm.delete(key);
			warm.set(key, warmHit);
			done.set(key, { at: Date.now(), value: warmHit.value });
			prune();
			return Promise.resolve(cloneValue(warmHit.value));
		}
		if(warmHit){
			warm.delete(key);
		}
	}
	const flying = inflight.get(key);
	if(flying){
		return flying.then((v) => cloneValue(v));
	}
	// [A1] inflight 包住「L3 读 → 网络」全程:并发同参请求共享同一次 L3 查询/网络往返。
	const p = (async () => {
		const persisted = await l3Get(url, options.body);
		if(persisted !== undefined){
			// 回填 L1/L2:后续 30s/10min 内走内存快路径,不再触 IDB。
			done.set(key, { at: Date.now(), value: persisted });
			prune();
			if(techniqueCacheEnabled()){
				warm.set(key, { at: Date.now(), value: persisted });
				pruneWarm();
			}
			return persisted;
		}
		const v = await runner();
		// 🔴 空载荷不入缓存:request() 网络层失败会「吞错 resolve undefined」(非 reject)。
		// 若把 undefined 存进 done(30s)/warm(10min L2),后端重启/温启动窗口内一次失败会把
		// 该参数组合投毒长达 10 分钟——期间同参请求全部秒回 undefined,表现为
		// 「点了没反应/过很久才恢复」。语义与下方「失败(reject)不缓存」同一条:
		// 吞错型失败同样不缓存,undefined 原样透传给调用方既有守卫。L3 同律。
		if(v === undefined || v === null){
			return v;
		}
		done.set(key, { at: Date.now(), value: v });
		prune();
		if(techniqueCacheEnabled()){
			warm.set(key, { at: Date.now(), value: v });
			pruneWarm();
		}
		l3Put(url, options.body, v);
		return v;
	})().then((v) => {
		inflight.delete(key);
		return v;
	}, (err) => {
		inflight.delete(key);   // 失败不缓存
		throw err;
	});
	inflight.set(key, p);
	return p.then((v) => cloneValue(v));
}

// 测试/调试用
export function __clearDedupe(){
	inflight.clear();
	done.clear();
	warm.clear();
}
export function __dedupeStats(){
	return { inflight: inflight.size, done: done.size, warm: warm.size };
}
// 测试注入:直接改 L2 条目时间戳(模拟 L1 过期/L2 存续窗)
export function __warmEntry(key){
	return warm.get(key) || null;
}
export function __ageEntries(ms){
	for(const ent of done.values()){ ent.at -= ms; }
	for(const ent of warm.values()){ ent.at -= ms; }
}
