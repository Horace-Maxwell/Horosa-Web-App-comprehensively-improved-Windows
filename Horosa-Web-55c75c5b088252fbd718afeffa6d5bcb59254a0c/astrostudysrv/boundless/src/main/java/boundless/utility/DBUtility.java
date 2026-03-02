package boundless.utility;

import java.util.Map;
import java.util.function.Function;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ICache;

public class DBUtility {
	private static String TotalPrefix = "Total_";
	
	public static Object execute(String cacheKeyPrefix, Map<String, Object> params, Function<Map<String, Object>, Object> fun, 
			ICache cache, boolean needCache, int expInSec){
		return CacheUtility.get(cacheKeyPrefix, params, fun, cache, needCache, expInSec);
	}
	
	public static Long getTotal(String cacheKeyPrefix, Map<String, Object> params, Function<Map<String, Object>, Object> fun, 
			ICache cache, boolean needCache, int expInSec){
		long st = System.currentTimeMillis();
		StringBuilder key = new StringBuilder();
		Object obj = null;
		if(cache != null && needCache && !StringUtility.isNullOrEmpty(cacheKeyPrefix)){
			try{
				key.append(TotalPrefix).append(cacheKeyPrefix);
				if(params != null && !params.isEmpty()){
					key.append(CacheUtility.toPartKey(params));
				}
				obj = cache.get(key.toString());
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		
		if(obj != null){
			long delta = System.currentTimeMillis() - st;
			QueueLog.trace(CacheUtility.log, "get total from cache in {} ms", delta);
			return ConvertUtility.getValueAsLong(obj);
		}
		
		obj = fun.apply(params);
		
		try{
			if(cache != null && key.length() > 0 && obj != null){
				final Object finobj = obj;
				CalculatePool.queueUserWorkItem(()->{
					long savest = System.currentTimeMillis();
					if(expInSec > 0){
						cache.put(key.toString(), finobj, expInSec);
					}else{
						cache.put(key.toString(), finobj);
					}
					long delta = System.currentTimeMillis() - savest;
					QueueLog.trace(CacheUtility.log, "save total to cache in {} ms", delta);
				});
			}
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		if(obj == null){
			return null;
		}
		
		long total = ConvertUtility.getValueAsLong(obj);
		QueueLog.trace(CacheUtility.log, "get total in {} ms", System.currentTimeMillis() - st);
		return total;
	}

}
