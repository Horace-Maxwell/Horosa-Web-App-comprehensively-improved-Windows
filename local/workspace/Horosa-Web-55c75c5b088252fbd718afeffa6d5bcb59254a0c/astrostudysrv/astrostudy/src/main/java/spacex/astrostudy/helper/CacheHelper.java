package spacex.astrostudy.helper;

import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

import boundless.spring.help.PropertyPlaceholder;
import boundless.types.ICache;
import boundless.types.cache.CacheFactory;
import boundless.utility.CacheUtility;

public class CacheHelper {
	
	private static boolean NeedCache = PropertyPlaceholder.getPropertyAsBool("cachehelper.needcache", true);
	private static int ExpInSec = PropertyPlaceholder.getPropertyAsInt("cachehelper.expireinsecond", 1800);
	private static final String Prefix = PropertyPlaceholder.getProperty("cachehelper.prjprefix", "astrostudy_");
	private static ICache cache = CacheFactory.getCache("comm");
	private static final ConcurrentHashMap<String, LocalCacheEntry> localCache = new ConcurrentHashMap<String, LocalCacheEntry>();
	private static final ConcurrentHashMap<String, CompletableFuture<Object>> inflightCache = new ConcurrentHashMap<String, CompletableFuture<Object>>();

	private static class LocalCacheEntry {
		private final Object value;
		private final long expireAtMs;

		private LocalCacheEntry(Object value, int expInSec) {
			this.value = value;
			this.expireAtMs = expInSec > 0 ? System.currentTimeMillis() + expInSec * 1000L : Long.MAX_VALUE;
		}

		private boolean isExpired() {
			return System.currentTimeMillis() > expireAtMs;
		}
	}

	
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

	private static String buildLocalEntryKey(String relkey, Map<String, Object> params) {
		if(params == null || params.isEmpty()) {
			return relkey;
		}
		return relkey + CacheUtility.toPartKey(params);
	}

	private static Object getLocal(String localKey, boolean needCache) {
		if(!needCache || localKey == null) {
			return null;
		}
		LocalCacheEntry entry = localCache.get(localKey);
		if(entry == null) {
			return null;
		}
		if(entry.isExpired()) {
			localCache.remove(localKey, entry);
			return null;
		}
		return entry.value;
	}

	private static void putLocal(String localKey, Object value, boolean needCache, int expInSec) {
		if(!needCache || localKey == null || value == null) {
			return;
		}
		if(value instanceof java.util.Collection) {
			java.util.Collection<?> col = (java.util.Collection<?>) value;
			if(col.isEmpty()) {
				return;
			}
		}else if(value instanceof Map) {
			Map<?, ?> map = (Map<?, ?>) value;
			if(map.isEmpty()) {
				return;
			}
		}
		localCache.put(localKey, new LocalCacheEntry(value, expInSec));
	}
	
	public static <T extends Object> T getDirect(String key, Class<T> tclass, Supplier<T> fun, boolean needCache, int expInSec){
		String relkey = buildCacheKey(key);
		Object cached = getLocal(relkey, needCache);
		if(tclass.isInstance(cached)) {
			return tclass.cast(cached);
		}
		T value = CacheUtility.getDirect(relkey, tclass, fun, cache, needCache, expInSec);
		putLocal(relkey, value, needCache, expInSec);
		return value;
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
		String localKey = buildLocalEntryKey(relkey, params);
		Object cached = getLocal(localKey, NeedCache);
		if(cached != null) {
			return cached;
		}
		if(!NeedCache || localKey == null) {
			return CacheUtility.get(relkey, params, fun, cache, NeedCache, expInSec);
		}
		CompletableFuture<Object> ownerFuture = new CompletableFuture<Object>();
		CompletableFuture<Object> existingFuture = inflightCache.putIfAbsent(localKey, ownerFuture);
		if(existingFuture != null) {
			return existingFuture.join();
		}
		try {
			Object cachedAfterClaim = getLocal(localKey, NeedCache);
			if(cachedAfterClaim != null) {
				ownerFuture.complete(cachedAfterClaim);
				return cachedAfterClaim;
			}
			Object value = CacheUtility.get(relkey, params, fun, cache, NeedCache, expInSec);
			putLocal(localKey, value, NeedCache, expInSec);
			ownerFuture.complete(value);
			return value;
		}catch(Throwable ex) {
			ownerFuture.completeExceptionally(ex);
			if(ex instanceof RuntimeException) {
				throw (RuntimeException)ex;
			}
			if(ex instanceof Error) {
				throw (Error)ex;
			}
			throw new RuntimeException(ex);
		} finally {
			inflightCache.remove(localKey, ownerFuture);
		}
	}

	public static Object get(String key, Map<String, Object> params, Function<Map<String, Object>, Object> fun){
		String relkey = buildCacheKey(key);
		String localKey = buildLocalEntryKey(relkey, params);
		Object cached = getLocal(localKey, NeedCache);
		if(cached != null) {
			return cached;
		}
		if(!NeedCache || localKey == null) {
			return CacheUtility.get(relkey, params, fun, cache, NeedCache, ExpInSec);
		}
		CompletableFuture<Object> ownerFuture = new CompletableFuture<Object>();
		CompletableFuture<Object> existingFuture = inflightCache.putIfAbsent(localKey, ownerFuture);
		if(existingFuture != null) {
			return existingFuture.join();
		}
		try {
			Object cachedAfterClaim = getLocal(localKey, NeedCache);
			if(cachedAfterClaim != null) {
				ownerFuture.complete(cachedAfterClaim);
				return cachedAfterClaim;
			}
			Object value = CacheUtility.get(relkey, params, fun, cache, NeedCache, ExpInSec);
			putLocal(localKey, value, NeedCache, ExpInSec);
			ownerFuture.complete(value);
			return value;
		}catch(Throwable ex) {
			ownerFuture.completeExceptionally(ex);
			if(ex instanceof RuntimeException) {
				throw (RuntimeException)ex;
			}
			if(ex instanceof Error) {
				throw (Error)ex;
			}
			throw new RuntimeException(ex);
		} finally {
			inflightCache.remove(localKey, ownerFuture);
		}
	}

	public static Object get(String key, Map<String, Object> params, Function<Map<String, Object>, Object> fun, boolean needCache, int expInSec){
		String relkey = buildCacheKey(key);
		String localKey = buildLocalEntryKey(relkey, params);
		Object cached = getLocal(localKey, needCache);
		if(cached != null) {
			return cached;
		}
		if(!needCache || localKey == null) {
			return CacheUtility.get(relkey, params, fun, cache, needCache, expInSec);
		}
		CompletableFuture<Object> ownerFuture = new CompletableFuture<Object>();
		CompletableFuture<Object> existingFuture = inflightCache.putIfAbsent(localKey, ownerFuture);
		if(existingFuture != null) {
			return existingFuture.join();
		}
		try {
			Object cachedAfterClaim = getLocal(localKey, needCache);
			if(cachedAfterClaim != null) {
				ownerFuture.complete(cachedAfterClaim);
				return cachedAfterClaim;
			}
			Object value = CacheUtility.get(relkey, params, fun, cache, needCache, expInSec);
			putLocal(localKey, value, needCache, expInSec);
			ownerFuture.complete(value);
			return value;
		}catch(Throwable ex) {
			ownerFuture.completeExceptionally(ex);
			if(ex instanceof RuntimeException) {
				throw (RuntimeException)ex;
			}
			if(ex instanceof Error) {
				throw (Error)ex;
			}
			throw new RuntimeException(ex);
		} finally {
			inflightCache.remove(localKey, ownerFuture);
		}
	}
	
	public static Object get(String key, Map<String, Object> params, Function<Map<String, Object>, Object> fun, boolean needCache){
		String relkey = buildCacheKey(key);
		String localKey = buildLocalEntryKey(relkey, params);
		Object cached = getLocal(localKey, needCache);
		if(cached != null) {
			return cached;
		}
		if(!needCache || localKey == null) {
			return CacheUtility.get(relkey, params, fun, cache, needCache, ExpInSec);
		}
		CompletableFuture<Object> ownerFuture = new CompletableFuture<Object>();
		CompletableFuture<Object> existingFuture = inflightCache.putIfAbsent(localKey, ownerFuture);
		if(existingFuture != null) {
			return existingFuture.join();
		}
		try {
			Object cachedAfterClaim = getLocal(localKey, needCache);
			if(cachedAfterClaim != null) {
				ownerFuture.complete(cachedAfterClaim);
				return cachedAfterClaim;
			}
			Object value = CacheUtility.get(relkey, params, fun, cache, needCache, ExpInSec);
			putLocal(localKey, value, needCache, ExpInSec);
			ownerFuture.complete(value);
			return value;
		}catch(Throwable ex) {
			ownerFuture.completeExceptionally(ex);
			if(ex instanceof RuntimeException) {
				throw (RuntimeException)ex;
			}
			if(ex instanceof Error) {
				throw (Error)ex;
			}
			throw new RuntimeException(ex);
		} finally {
			inflightCache.remove(localKey, ownerFuture);
		}
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
		for(String localKey : localCache.keySet()) {
			if(localKey.startsWith(String.format("%s%s", Prefix, keyprefix))) {
				localCache.remove(localKey);
			}
		}
		return cache.removeMany(key);
	}
	
}
