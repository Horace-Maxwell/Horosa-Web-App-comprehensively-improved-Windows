package boundless.utility;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.function.Function;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ICache;

public class CacheUtility {
	public static final Logger log = LoggerFactory.getLogger(CacheUtility.class);
	
	public static String toPartKey(Map params){
		StringBuilder sb = new StringBuilder();
		int i = 0;
		for(Object entryobj : params.entrySet()){
			Map.Entry entry = (Map.Entry) entryobj;
			Object obj = entry.getValue();
			if(i == 0){
				sb.append(entry.getKey()).append("_");
			}else{
				sb.append("_").append(entry.getKey()).append("_");
			}
			if(obj == null){
				sb.append("null");
			}else if(obj instanceof Date){
				sb.append(FormatUtility.formatDateTime((Date)obj, "yyyyMMddHHmmss"));
			}else if(obj instanceof LocalDateTime){
				sb.append(FormatUtility.formatDateTime((LocalDateTime)obj, "yyyyMMddHHmmss"));
			}else{
				sb.append(obj);
			}
			i++;
		}
		return sb.toString();
	}
	
	public static String  buildCacheKey(Object... params){
		 StringBuilder sbKey = new StringBuilder();
		 
		if(params != null && params.length>0){
			 for (int i = 0; i < params.length; i++){
                 if (params[i] != null){
                	 if(params[i] instanceof Map){
                		 Map param = (Map)params[i];
                		 if(i == 0){
                             sbKey.append(toPartKey(param));
                		 }else{
                             sbKey.append(".").append(toPartKey(param));
                		 }
                	 }else{
                		 if(i== 0){
                             sbKey.append(params[i]);
                		 }else{
                             sbKey.append(".").append(params[i]);
                		 }
                	 }
                 }else{
                	 if(i == 0){
                         sbKey.append("Nil");
                	 }else{
                         sbKey.append(".Nil");
                	 }
                 }
             }
		}
		return sbKey.toString();
	}
	
	public static <T extends Object> T getDirect(String key, Class<T> tclass, Supplier<T> fun, ICache cache, boolean needCache, int expInSec){
		return getDirect(key,tclass,fun,cache,needCache,expInSec,true);
	}
	public static <T extends Object> T getDirect(String key, Class<T> tclass, Supplier<T> fun, 
			ICache cache, boolean needCache, int expInSec, boolean cacheEmpty){
		String str = null;
		T obj = null;
		if(cache != null && needCache){
			try{
				str = (String)cache.get(key);
				if(!StringUtility.isNullOrEmpty(str)){
					try{
						obj = JsonUtility.decode(str, tclass);
					}catch(Exception err){
						QueueLog.error(AppLoggers.ErrorLogger, err);
						obj = null;
					}
				}
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		
		if(obj != null){
			return obj;
		}
		
		obj = fun.get();
		
		if(cache != null && needCache && obj != null){
			if(!cacheEmpty){
				if(obj instanceof Collection){
					Collection col = (Collection) obj;
					if(col.isEmpty()){
						return obj;
					}
				}else if(obj instanceof Map){
					Map map = (Map)obj;
					if(map.isEmpty()){
						return obj;
					}
				}
			}
			try{
				
				str = JsonUtility.encode(obj);
				
				if(expInSec > 0){
					cache.put(key, str, expInSec);
				}else{
					cache.put(key, str);
				}
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		return obj;
	}
	
	public static Object get(String cacheKeyPrefix, Map<String, Object> params, Function<Map<String, Object>, Object> fun, 
			ICache cache, boolean needCache, int expInSec){
		long st = System.currentTimeMillis();
		StringBuilder key = new StringBuilder();
		String str = null;
		Object obj = null;
		if(cache != null && needCache && !StringUtility.isNullOrEmpty(cacheKeyPrefix)){
			try{
				key.append(cacheKeyPrefix);
				if(params != null && !params.isEmpty()){
					key.append(toPartKey(params));
				}
				str = (String)cache.get(key.toString());
				if(!StringUtility.isNullOrEmpty(str)){
					try{
						if(str.startsWith("[")){
							obj = JsonUtility.decode(str, List.class);
						}else{
							obj = JsonUtility.decode(str, Map.class);
						}
					}catch(Exception err){
						obj = str;
					}
				}
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		
		if(obj != null){
			long delta = System.currentTimeMillis() - st;
			QueueLog.trace(log, "from data cache in {} ms", delta);
			return obj;
		}
		
		obj = fun.apply(params);
		
		if(cache != null && key.length() > 0 && obj != null){
			if(obj instanceof Collection){
				Collection col = (Collection) obj;
				if(col.isEmpty()){
					return obj;
				}
			}else if(obj instanceof Map){
				Map map = (Map)obj;
				if(map.isEmpty()){
					return obj;
				}
			}
			
			final String finStr = str;
			final Object finObj = obj;
			CalculatePool.queueUserWorkItem(()->{
				long savest = System.currentTimeMillis();
				String tmpStr = finStr;
				try{
					tmpStr = JsonUtility.encode(finObj);
				}catch(Exception e){
					tmpStr = finObj.toString();
				}
				try{
					if(expInSec > 0){
						cache.put(key.toString(), tmpStr, expInSec);
					}else{
						cache.put(key.toString(), tmpStr);
					}
				}catch(Exception e){
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}
				long delta = System.currentTimeMillis() - savest;
				QueueLog.trace(log, "save data to cache in {} ms", delta);
			});
		}
		
		QueueLog.trace(log, "get data in {} ms", System.currentTimeMillis() - st);
		return obj;
	}
	

}
