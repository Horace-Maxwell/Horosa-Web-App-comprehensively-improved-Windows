package spacex.astrostudy.helper;

import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;

import boundless.spring.help.PropertyPlaceholder;
import boundless.types.ICache;
import boundless.types.cache.CacheFactory;
import boundless.utility.CacheUtility;

public class CacheHelper {
	
	private static boolean NeedCache = PropertyPlaceholder.getPropertyAsBool("cachehelper.needcache", true);
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
