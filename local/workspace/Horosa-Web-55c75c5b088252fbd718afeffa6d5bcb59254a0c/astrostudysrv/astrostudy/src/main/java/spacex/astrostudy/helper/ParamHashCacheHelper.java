package spacex.astrostudy.helper;

import java.lang.reflect.Array;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Stream;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.MD5Utility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class ParamHashCacheHelper {

	private static final String Prefix = PropertyPlaceholder.getProperty("paramhash.cache.prefix", "paramhash");
	private static final boolean EnableCache = resolveBoolFlag("paramhash.cache.enable", true);
	private static final boolean EnableRedis = resolveBoolFlag("paramhash.cache.redis.enable", true);
	private static final boolean EnableLocal = resolveBoolFlag("paramhash.cache.local.enable", true);

	// 开关读取:先看 JVM 系统属性(-D,桌面启动脚本用它禁用 redis),再落属性文件。
	// PropertyPlaceholder 只合并属性文件,不读 -D——曾导致「桌面禁 redis」旗标形同虚设。
	private static boolean resolveBoolFlag(String key, boolean def) {
		String sys = System.getProperty(key);
		if(!StringUtility.isNullOrEmpty(sys)) {
			return ConvertUtility.getValueAsBool(sys, def);
		}
		return PropertyPlaceholder.getPropertyAsBool(key, def);
	}
	// horosa_paramhash_localdir_sysprop_v1:resolveBoolFlag 的字符串版,同样「先 -D 再属性文件」。
	private static String resolveFlag(String key, String def) {
		String sys = System.getProperty(key);
		if(!StringUtility.isNullOrEmpty(sys)) {
			return sys;
		}
		return PropertyPlaceholder.getProperty(key, def);
	}
	private static final int ExpireInSec = PropertyPlaceholder.getPropertyAsInt("paramhash.cache.expireinsecond", 86400);
	private static final int AnnualExpireInSec = PropertyPlaceholder.getPropertyAsInt("paramhash.cache.annual.expireinsecond", 86400 * 180);
	// horosa_paramhash_localdir_sysprop_v1(PERF-R9):必须与 resolveBoolFlag 同源地先读 -D。
	// 原实现只走 PropertyPlaceholder(**不读 -D**),于是启动器无法把缓存目录移出 payload 树 ——
	// 而 defaultLocalDir() 落在 user.dir 下,桌面壳把 cwd 设成 astrostudyboot-exploded,
	// 即 embedded-runtime/<payloadId>/ 之内:**每次应用更新换 payloadId,启动清扫会连缓存一起删掉,
	// 于是每发一版所有用户都回到全冷**。改用 resolveFlag 后,启动器传
	// -Dparamhash.cache.local.dir=<LOCALAPPDATA>\HorosaDesktop\cache\paramhash 即可跨更新存活。
	// ★ 这正是本轮「-D vs -- vs PropertyPlaceholder」判别铁律的第二例:加开关前先确认目标怎么读它。
	private static final String LocalDir = resolveFlag("paramhash.cache.local.dir", defaultLocalDir());
	private static final DateTimeFormatter LdtFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

	private static final ICache RedisCache = CacheHelper.getCache();
	private static final ConcurrentHashMap<String, Object> KeyLocks = new ConcurrentHashMap<String, Object>();

	// 本地缓存磁盘上限(字节)。旧实现只有「被再次读到时」的惰性过期删除——冷 key 永不回收,
	// 目录只增不减(每个参数组合一个文件,十项术数长期使用可撑爆用户磁盘)。
	private static final long LocalMaxBytes = PropertyPlaceholder.getPropertyAsInt("paramhash.cache.local.maxmb", 512) * 1024L * 1024L;
	private static final java.util.concurrent.ScheduledExecutorService LocalSweeper;
	static {
		java.util.concurrent.ScheduledExecutorService sweeper = null;
		if(EnableCache && EnableLocal) {
			sweeper = java.util.concurrent.Executors.newSingleThreadScheduledExecutor(r -> {
				Thread t = new Thread(r, "paramhash-local-sweeper");
				t.setDaemon(true);
				return t;
			});
			// 启动 60s 后首扫(避开冷启动忙时),此后每 6 小时一次。
			sweeper.scheduleWithFixedDelay(ParamHashCacheHelper::sweepLocal, 60, 6 * 3600, java.util.concurrent.TimeUnit.SECONDS);
		}
		LocalSweeper = sweeper;
	}

	/**
	 * 本地缓存目录清扫:① mtime 超过最长 TTL(AnnualExpireInSec)的绝对过期文件直接删
	 * (精确 TTL 的过期仍由读路径惰性删,这里兜底冷 key);② 总量超 LocalMaxBytes 时按
	 * mtime 升序(LRU 近似)删到 80% 上限。纯文件系统操作零 JSON 解析;全程吞错,绝不影响主流程。
	 */
	static void sweepLocal() {
		try {
			Path root = Paths.get(LocalDir);
			if(!Files.isDirectory(root)) {
				return;
			}
			long now = System.currentTimeMillis();
			long hardExpireMs = AnnualExpireInSec * 1000L;
			List<Path> files = new ArrayList<Path>();
			long total = 0;
			try (Stream<Path> walk = Files.walk(root)) {
				for(Path p : (Iterable<Path>) walk::iterator) {
					if(!Files.isRegularFile(p) || !p.toString().endsWith(".json")) {
						continue;
					}
					long mtime;
					long size;
					try {
						mtime = Files.getLastModifiedTime(p).toMillis();
						size = Files.size(p);
					}catch(Exception e) {
						continue;
					}
					if(now - mtime > hardExpireMs) {
						try { Files.deleteIfExists(p); }catch(Exception e) { /* 忙时跳过,下轮再删 */ }
						continue;
					}
					files.add(p);
					total += size;
				}
			}
			if(total <= LocalMaxBytes) {
				return;
			}
			files.sort((a, b) -> {
				try {
					return Files.getLastModifiedTime(a).compareTo(Files.getLastModifiedTime(b));
				}catch(Exception e) {
					return 0;
				}
			});
			long target = (long) (LocalMaxBytes * 0.8);
			for(Path p : files) {
				if(total <= target) {
					break;
				}
				try {
					long size = Files.size(p);
					if(Files.deleteIfExists(p)) {
						total -= size;
					}
				}catch(Exception e) {
					// 单文件失败不影响整轮
				}
			}
			QueueLog.info(AppLoggers.InfoLogger, "paramhash local cache sweep done, size now ~" + total + " bytes");
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}

	private static final class LocalPayload {
		Object value;
		boolean expired;
	}

	private ParamHashCacheHelper() {
	}

	private static String defaultLocalDir() {
		String workingDir = System.getProperty("user.dir", ".");
		return Paths.get(workingDir, ".horosa-cache", "paramhash").toString();
	}

	public static Object get(String scope, Map<String, Object> params, Function<Map<String, Object>, Object> fun) {
		return get(scope, params, fun, ExpireInSec);
	}

	public static Object getAnnual(String scope, Map<String, Object> params, Function<Map<String, Object>, Object> fun) {
		return get(scope, params, fun, AnnualExpireInSec);
	}

	public static Object get(String scope, Map<String, Object> params, Function<Map<String, Object>, Object> fun, int expInSec) {
		Map<String, Object> req = new HashMap<String, Object>();
		if(params != null) {
			req.putAll(params);
		}
		if(fun == null) {
			return null;
		}
		if(!EnableCache) {
			return fun.apply(new HashMap<String, Object>(req));
		}

		String cacheKey = buildCacheKey(scope, req);
		Object obj = getFromRedis(cacheKey);
		if(obj != null) {
			return obj;
		}

		String cleanScope = sanitizeScope(scope);
		String hash = hash(req);
		LocalPayload local = getFromLocal(cleanScope, hash, expInSec);
		if(local.expired) {
			removeRedis(cacheKey);
		}
		if(local.value != null) {
			saveToRedis(cacheKey, local.value, expInSec);
			return local.value;
		}

		Object keylock = KeyLocks.computeIfAbsent(cacheKey, (k)-> new Object());
		try {
			synchronized (keylock) {
				obj = getFromRedis(cacheKey);
				if(obj != null) {
					return obj;
				}

				local = getFromLocal(cleanScope, hash, expInSec);
				if(local.expired) {
					removeRedis(cacheKey);
				}
				if(local.value != null) {
					saveToRedis(cacheKey, local.value, expInSec);
					return local.value;
				}

				obj = fun.apply(new HashMap<String, Object>(req));
				if(isCacheable(obj)) {
					// v3.0.1 perf ROUND-3 R2 (PARAMHASH_PERSISTABLE_REV): promote what used to be
					// ChartController.toPlainMap into the central cache path. Prior behavior:
					// canPersistLocal() saw any Java Enum / POJO inside `obj` (e.g. JieQiController.getYearParams
					// puts TimeZiAlg + PhaseType Enum instances into the response), returned false, and
					// saveToLocal silently no-op'd — so /jieqi/year and other Enum-carrying endpoints never
					// wrote a single cache file on disk. Fix: JSON round-trip once here so BOTH the returned
					// value AND the cache are pure Maps/Numbers/Strings/Collections; every controller that
					// uses ParamHashCacheHelper.get/getAnnual is now Enum-safe by construction, no matter
					// what a future handler stuffs into its response. Cold vs warm now return the same
					// (plain) shape, eliminating type drift between paths. Idempotent for pure Maps.
					// Failure: fall back to the original raw obj so we're never worse than before.
					obj = persistable(obj);
					saveToRedis(cacheKey, obj, expInSec);
					saveToLocal(cleanScope, hash, obj, expInSec);
				}
				return obj;
			}
		} finally {
			Object current = KeyLocks.get(cacheKey);
			if(current == keylock) {
				KeyLocks.remove(cacheKey);
			}
		}
	}

	public static long clearByScope(String scopePrefix) {
		String scope = sanitizeScope(scopePrefix);
		long removed = 0;
		try {
			String prefix = CacheHelper.buildCacheKey(Prefix, scope);
			removed += CacheHelper.getCache().removeMany(prefix + "*");
		} catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}

		if(!EnableLocal) {
			return removed;
		}
		try {
			Path localRoot = Paths.get(LocalDir);
			if(!Files.exists(localRoot)) {
				return removed;
			}
			List<Path> targets = new ArrayList<Path>();
			try(Stream<Path> list = Files.list(localRoot)) {
				list.forEach((p)->{
					if(!Files.isDirectory(p)) {
						return;
					}
					String name = p.getFileName().toString();
					if(name.startsWith(scope)) {
						targets.add(p);
					}
				});
			}
			for(Path target : targets) {
				List<Path> paths = new ArrayList<Path>();
				try(Stream<Path> walk = Files.walk(target)) {
					walk.forEach((p)->{
						paths.add(p);
					});
				}
				paths.sort((a, b)-> b.getNameCount() - a.getNameCount());
				for(Path p : paths) {
					try {
						if(Files.isDirectory(p)) {
							Files.deleteIfExists(p);
						}else {
							if(Files.deleteIfExists(p)) {
								removed++;
							}
						}
					}catch(Exception e) {
						QueueLog.error(AppLoggers.ErrorLogger, e);
					}
				}
			}
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		return removed;
	}

	public static String buildCacheKey(String scope, Map<String, Object> params) {
		String hash = hash(params);
		String cleanScope = sanitizeScope(scope);
		return CacheHelper.buildCacheKey(Prefix, cleanScope, hash);
	}

	public static String hash(Map<String, Object> params) {
		Object normalized = normalize(params);
		String json = JsonUtility.encode(normalized);
		return MD5Utility.encryptAsString(json);
	}

	private static String sanitizeScope(String scope) {
		String value = StringUtility.isNullOrEmpty(scope) ? "default" : scope;
		return value.replaceAll("[^A-Za-z0-9._-]", "_");
	}

	private static Object normalize(Object obj) {
		if(obj == null) {
			return null;
		}
		if(obj instanceof Enum<?>) {
			return ((Enum<?>) obj).name();
		}
		if(obj instanceof Date) {
			return FormatUtility.formatDateTime((Date)obj, "yyyy-MM-dd HH:mm:ss");
		}
		if(obj instanceof LocalDateTime) {
			return ((LocalDateTime)obj).format(LdtFormatter);
		}
		if(obj instanceof ZonedDateTime) {
			return ((ZonedDateTime)obj).toOffsetDateTime().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
		}
		if(obj instanceof Map<?, ?>) {
			Map<?, ?> map = (Map<?, ?>) obj;
			TreeMap<String, Object> sorted = new TreeMap<String, Object>();
			for(Map.Entry<?, ?> entry : map.entrySet()) {
				String key = entry.getKey() == null ? "null" : entry.getKey().toString();
				sorted.put(key, normalize(entry.getValue()));
			}
			return sorted;
		}
		if(obj instanceof Collection<?>) {
			Collection<?> col = (Collection<?>) obj;
			List<Object> list = new ArrayList<Object>(col.size());
			for(Object item : col) {
				list.add(normalize(item));
			}
			return list;
		}
		Class<?> clz = obj.getClass();
		if(clz.isArray()) {
			int len = Array.getLength(obj);
			List<Object> list = new ArrayList<Object>(len);
			for(int i = 0; i < len; i++) {
				list.add(normalize(Array.get(obj, i)));
			}
			return list;
		}
		return obj;
	}

	private static Object getFromRedis(String key) {
		if(!EnableRedis || RedisCache == null || StringUtility.isNullOrEmpty(key)) {
			return null;
		}
		try {
			Object obj = RedisCache.get(key);
			if(obj == null) {
				return null;
			}
			if(obj instanceof String) {
				String str = (String)obj;
				if(StringUtility.isNullOrEmpty(str)) {
					return null;
				}
				try {
					return JsonUtility.decode(str, Object.class);
				}catch(Exception e) {
					// 缓存层绝不把「解不开的字符串」上抛(调用方一律按 Map/List 消费,
					// 上抛=ClassCastException 地雷)。视为 miss 并顺手清掉毒键自愈。
					QueueLog.info(AppLoggers.InfoLogger,
							"paramhash redis 值不可解,按 miss 处理并清键: {}", key);
					removeRedis(key);
					return null;
				}
			}
			return obj;
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return null;
		}
	}

	private static void saveToRedis(String key, Object value, int expInSec) {
		if(!EnableRedis || RedisCache == null || value == null || StringUtility.isNullOrEmpty(key)) {
			return;
		}
		try {
			// 非 String 值必须先 JSON 编码:底层缓存工厂对任意对象走 toString() 序列化,
			// Map 会被存成 `{k=v}` 垃圾(不可 decode)——读侧防线会按 miss 拦住,但写侧
			// 就该写入可回读的 JSON,缓存才真正生效。
			Object payload = (value instanceof String) ? value : JsonUtility.encode(value);
			if(expInSec > 0) {
				RedisCache.put(key, payload, expInSec);
			}else {
				RedisCache.put(key, payload);
			}
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}

	private static void removeRedis(String key) {
		if(!EnableRedis || RedisCache == null || StringUtility.isNullOrEmpty(key)) {
			return;
		}
		try {
			RedisCache.remove(key);
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}

	private static LocalPayload getFromLocal(String scope, String hash, int expInSec) {
		LocalPayload payload = new LocalPayload();
		payload.value = null;
		payload.expired = false;
		if(!EnableLocal) {
			return payload;
		}
		Path path = localPath(scope, hash);
		if(path == null || !Files.exists(path)) {
			return payload;
		}
		try {
			String text = Files.readString(path, StandardCharsets.UTF_8);
			if(StringUtility.isNullOrEmpty(text)) {
				return payload;
			}
			Object obj = JsonUtility.decode(text, Object.class);
			if(!(obj instanceof Map)) {
				return payload;
			}
			Map<String, Object> map = (Map<String, Object>) obj;
			long now = System.currentTimeMillis();
			long expAt = ConvertUtility.getValueAsLong(map.get("expAt"), 0);
			if(expAt <= 0 && expInSec > 0) {
				expAt = ConvertUtility.getValueAsLong(map.get("createdAt"), 0) + expInSec * 1000L;
			}
			if(expAt > 0 && expAt <= now) {
				payload.expired = true;
				try {
					Files.deleteIfExists(path);
				}catch(Exception e) {
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
				return payload;
			}
			Object cachedValue = map.get("value");
			// 只放行 JSON 容器(Map/List):调用方按结构化结果消费,标量/字符串一律按 miss
			// (与 redis 侧同一防线,杜绝 ClassCastException 类上抛)。
			if(!(cachedValue instanceof Map) && !(cachedValue instanceof List)) {
				return payload;
			}
			payload.value = cachedValue;
			return payload;
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return payload;
		}
	}

	private static void saveToLocal(String scope, String hash, Object value, int expInSec) {
		if(!EnableLocal || value == null) {
			return;
		}
		if(!canPersistLocal(value)) {
			return;
		}
		Path path = localPath(scope, hash);
		if(path == null) {
			return;
		}
		try {
			Files.createDirectories(path.getParent());
			long now = System.currentTimeMillis();
			Map<String, Object> wrap = new HashMap<String, Object>();
			wrap.put("createdAt", now);
			wrap.put("expAt", expInSec > 0 ? now + expInSec * 1000L : 0L);
			wrap.put("value", value);
			String json = JsonUtility.encode(wrap);
			Path tmp = Paths.get(path.toString() + ".tmp");
			Files.writeString(tmp, json, StandardCharsets.UTF_8);
			try {
				Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
			}catch(AtomicMoveNotSupportedException e) {
				Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING);
			}
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}

	private static Path localPath(String scope, String hash) {
		if(StringUtility.isNullOrEmpty(LocalDir) || StringUtility.isNullOrEmpty(hash)) {
			return null;
		}
		String prefix = hash.length() >= 2 ? hash.substring(0, 2) : "00";
		return Paths.get(LocalDir, scope, prefix, hash + ".json");
	}

	private static boolean isCacheable(Object obj) {
		if(obj == null) {
			return false;
		}
		if(obj instanceof Map) {
			return !((Map<?, ?>) obj).isEmpty();
		}
		if(obj instanceof Collection) {
			return !((Collection<?>) obj).isEmpty();
		}
		return true;
	}

	// v3.0.1 perf ROUND-3 R2 (PARAMHASH_PERSISTABLE_REV): JSON round-trip an arbitrary POJO/Map/Enum
	// tree into a pure Map/List/Number/String/Boolean tree that canPersistLocal() will accept.
	// Serializes via the same Jackson jsonMapper as the response JsonConverter (JsonUtility.encode);
	// deserializes back to Object.class → LinkedHashMap preserves key order. Idempotent on already-plain
	// trees. On any failure returns the raw value unchanged (fail-safe: caller path still functions,
	// just misses the disk-cache tier — never worse than before). This centralizes what used to be
	// ChartController.toPlainMap so every controller using ParamHashCacheHelper.get/getAnnual gets
	// Enum-safe caching automatically; a future controller cannot accidentally re-introduce the
	// silent-no-op bug that broke /jieqi/year for months.
	public static Object persistable(Object value) {
		if(value == null) {
			return null;
		}
		if(canPersistLocal(value)) {
			return value;
		}
		try {
			return JsonUtility.decode(JsonUtility.encode(value), Object.class);
		}catch(Exception e) {
			return value;
		}
	}

	private static boolean canPersistLocal(Object obj) {
		if(obj == null) {
			return true;
		}
		if(obj instanceof String || obj instanceof Number || obj instanceof Boolean) {
			return true;
		}
		if(obj instanceof Map<?, ?>) {
			Map<?, ?> map = (Map<?, ?>) obj;
			for(Object val : map.values()) {
				if(!canPersistLocal(val)) {
					return false;
				}
			}
			return true;
		}
		if(obj instanceof Collection<?>) {
			Collection<?> col = (Collection<?>) obj;
			for(Object item : col) {
				if(!canPersistLocal(item)) {
					return false;
				}
			}
			return true;
		}
		if(obj.getClass().isArray()) {
			int len = Array.getLength(obj);
			for(int i = 0; i < len; i++) {
				if(!canPersistLocal(Array.get(obj, i))) {
					return false;
				}
			}
			return true;
		}
		return false;
	}
}
