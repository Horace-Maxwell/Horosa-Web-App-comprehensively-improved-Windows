package spacex.astrostudy.helper;

import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;

import boundless.spring.help.PropertyPlaceholder;
import boundless.types.ICache;
import boundless.types.cache.CacheFactory;
import boundless.utility.CacheUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class CacheHelper {

	// horosa_cachehelper_needcache_sysprop_v1(PERF-R10 B3):与 ParamHashCacheHelper 同源的
	// 「先 -D 再属性文件」。PropertyPlaceholder 不读 -D ⇒ 桌面启动器此前无法关掉 comm 缓存;
	// 而桌面机器上没有 Redis,/ziwei/birth、/calendar/month、/nongli/time 每次 miss 都要付
	// 一次连接异常 + JedisPool 重建 + 两行错误日志(System.gc 已被 -XX:+DisableExplicitGC 中和,
	// 但异常/重连/并发 reconnect 竞态仍在)。桌面传 -Dcachehelper.needcache=false 后:
	// 语义 == 今日「无 Redis」的净效果(恒 miss、必算 fun),输出字节全等;
	// Web/Mac 不传 -D ⇒ 属性文件路径原样,零变化。
	private static boolean resolveBoolFlag(String key, boolean def) {
		String sys = System.getProperty(key);
		if(!StringUtility.isNullOrEmpty(sys)) {
			return ConvertUtility.getValueAsBool(sys, def);
		}
		return PropertyPlaceholder.getPropertyAsBool(key, def);
	}

	private static boolean NeedCache = resolveBoolFlag("cachehelper.needcache", true);
	private static int ExpInSec = PropertyPlaceholder.getPropertyAsInt("cachehelper.expireinsecond", 1800);
	private static final String Prefix = PropertyPlaceholder.getProperty("cachehelper.prjprefix", "astrostudy_");
	private static ICache cache = CacheFactory.getCache("comm");

	
	public static ICache getCache(){
		return cache;
	}
	
	public static String buildCacheKey(Object... params){
		String key = Prefix + CacheUtility.buildCacheKey(params);
		return key;
	}
	
	public static String toPartKey(Map params){
		return CacheUtility.toPartKey(params);
	}
	
	public static <T extends Object> T getDirect(String key, Class<T> tclass, Supplier<T> fun, boolean needCache, int expInSec){
		String relkey = buildCacheKey(key);
		return CacheUtility.getDirect(relkey, tclass, fun, cache, needCache, expInSec);
	}
	
	public static <T extends Object> T getDirect(String key, Class<T> tclass, Supplier<T> fun, boolean needCache){
		String relkey = buildCacheKey(key);
		return CacheUtility.getDirect(relkey, tclass, fun, cache, needCache, ExpInSec);
	}
	
	public static <T extends Object> T getDirect(String key, Class<T> tclass, Supplier<T> fun, int expInSec){
		String relkey = buildCacheKey(key);
		return CacheUtility.getDirect(relkey, tclass, fun, cache, NeedCache, expInSec);
	}
	
	public static <T extends Object> T getDirect(String key, Class<T> tclass, Supplier<T> fun){
		String relkey = buildCacheKey(key);
		return CacheUtility.getDirect(relkey, tclass, fun, cache, NeedCache, ExpInSec);
	}
	
	public static Object get(String key, Map<String, Object> params, Function<Map<String, Object>, Object> fun, int expInSec){
		String relkey = buildCacheKey(key);
		return CacheUtility.get(relkey, params, fun, cache, NeedCache, expInSec);
	}

	public static Object get(String key, Map<String, Object> params, Function<Map<String, Object>, Object> fun){
		String relkey = buildCacheKey(key);
		return CacheUtility.get(relkey, params, fun, cache, NeedCache, ExpInSec);
	}

	public static Object get(String key, Map<String, Object> params, Function<Map<String, Object>, Object> fun, boolean needCache, int expInSec){
		String relkey = buildCacheKey(key);
		return CacheUtility.get(relkey, params, fun, cache, needCache, expInSec);
	}
	
	public static Object get(String key, Map<String, Object> params, Function<Map<String, Object>, Object> fun, boolean needCache){
		String relkey = buildCacheKey(key);
		return CacheUtility.get(relkey, params, fun, cache, needCache, ExpInSec);
	}
	
	public static Object inc(String key){
		String relkey = buildCacheKey(key);
		return cache.inc(relkey,1);
	}
	
	public static Object dec(String key){
		String relkey = buildCacheKey(key);
		return cache.dec(relkey,1);
	}
	
	public static double zincrby(final String key, final double score, final String member){		
		String relkey = buildCacheKey(key);
		return cache.zincrby(relkey, score, member);
	}
	
	public static long expire(final String key, final int seconds){
		String relkey = buildCacheKey(key);
		return cache.expire(relkey, seconds).longValue();
	}

	public static long deleteCacheKey(final String keyprefix) {
		String key = String.format("%s%s*", Prefix, keyprefix);
		return cache.removeMany(key);
	}
	
}
