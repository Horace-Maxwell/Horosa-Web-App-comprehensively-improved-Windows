package boundless.types.cache;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.function.Consumer;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.netflix.hystrix.HystrixCommand;
import com.netflix.hystrix.HystrixCommandGroupKey;

import boundless.io.CompressUtility;
import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.utility.CalculatePool;
import boundless.utility.ConvertUtility;
import boundless.utility.PeriodTask;
import boundless.utility.StringUtility;

public class RemoteCache implements ICache {
	private static Logger log = LoggerFactory.getLogger(RemoteCache.class);
	
	private static Map<String, Object> memCache = new ConcurrentHashMap<String, Object>();
	private static Map<String, Integer> expireMap = new ConcurrentHashMap<String, Integer>();
	private static Map<String, Long> saveTimeMap = new ConcurrentHashMap<String, Long>();
	
	private ICacheFactory cachefactory;
	private boolean needMemCache;
	private boolean needCompress = false;
	private boolean needHystrix = false;
	
	private ScheduledFuture clearLocalTask;

	
	public static void clearLocalMemCache(){
		memCache.clear();
	}
	
	private static void removeManyMemCache(String partKey){
		for(String key : memCache.keySet()){
			if(key.contains(partKey)){
				memCache.remove(key);
				expireMap.remove(key);
				saveTimeMap.remove(key);
			}
		}
	}
	
	private static long countManyKey(String partKey){
		long cnt = 0;
		for(String key : memCache.keySet()){
			if(key.contains(partKey)){
				cnt++;
			}
		}
		return cnt;
	}
	
	private Map<String, Object> getLocalMany(String partKey, ICache cache){
		Map<String, Object> map = new HashMap<String, Object>();
		for(Map.Entry<String, Object> entry : memCache.entrySet()){
			String key = entry.getKey();
			if(key.contains(partKey)){
				Integer tm = expireMap.get(key);
				if(tm != null && tm > 0){
					Long st = saveTimeMap.get(key);
					if(st == null){
						st = 0l;
					}
					Long delta = (System.currentTimeMillis() - st) / 1000;
					if(delta < tm){
						map.put(key, entry.getValue());
					}
				}else{
					map.put(key, entry.getValue());
				}
			}
		}
		syncManyLocalCacheFromRemote(partKey, cache);
		return map;
	}
	
	RemoteCache(ICacheFactory cacheFactory, boolean needMemCache){
		this(cacheFactory, needMemCache, false, false);
	}

	RemoteCache(ICacheFactory cacheFactory, boolean needMemCache, boolean needCompress, boolean needHystrix){
		this.cachefactory = cacheFactory;
		this.needMemCache = needMemCache;
		this.needCompress = needCompress;
		this.needHystrix = needHystrix;
		
		this.clearLocalTask = PeriodTask.submit(()->{
			clearLocalMemCache();
		}, 3600000, 3600*24*1000);

	}

	private void syncLocalCacheFromRemote(String key, ICache cache){
		CalculatePool.queueUserWorkItem(()->{
			Object obj = cache.get(key);
			obj = decompress(obj);
			memCache.put(key, obj);
		});
	}
	private void syncManyLocalCacheFromRemote(String key, ICache cache){
		CalculatePool.queueUserWorkItem(()->{
			Map<String, Object> obj = cache.getMany(key);
			if(obj != null && !obj.isEmpty()){
				for(Map.Entry<String, Object> entry : obj.entrySet()){
					Object val = entry.getValue();
					val = decompress(val);
					memCache.put(key, val);
				}
			}
		});
	}
	
	@Override
	public void put(String key, Object value) {
		if(this.needMemCache){
			memCache.put(key, value);
		}
		ICache cache = null;
		try{
			cache = this.cachefactory.getCache();
			value = compress(value);
			cache.put(key, value);
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	private Object getLocal(String key, ICache cache){
		Integer tm = expireMap.get(key);
		Object res = memCache.get(key);
		if(res != null){
			if(tm != null && tm > 0){
				Long st = saveTimeMap.get(key);
				if(st == null){
					st = 0l;
				}
				long delta = (System.currentTimeMillis() - st) / 1000;
				if(delta < tm){
					syncLocalCacheFromRemote(key, cache);
					return res;
				}else{
					res = cache.get(key);
					if(res == null){
						memCache.remove(key);
						expireMap.remove(key);
						saveTimeMap.remove(key);
						return null;
					}else{
						saveTimeMap.put(key, System.currentTimeMillis());
						res = decompress(res);
						memCache.put(key, res);
					}
				}
			}
			return res;
		}
		
		res = cache.get(key);
		if(res != null){
			res = decompress(res);
			memCache.put(key, res);
		}
		return res;
	}
	
	private Object decompress(Object obj){
		if(!this.needCompress){
			return obj;
		}
		
		if(StringUtility.isNullOrEmpty(obj)){
			return null;
		}
		try{
			if(obj instanceof String){
				try{
					return CompressUtility.decompressFromString((String)obj);
				}catch(Exception e){
					return obj;
				}
			}
			return obj;
		}catch(Exception e){
			QueueLog.error(log, e);
			throw new RuntimeException(e);
		}
	}
	
	private Object compress(Object obj){
		if(!this.needCompress){
			return obj;
		}
		
		if(StringUtility.isNullOrEmpty(obj)){
			return null;
		}
		try{
			if(obj instanceof String){
				return CompressUtility.compressToString((String)obj);
			}
			return obj;
		}catch(Exception e){
			QueueLog.error(log, e);
			throw new RuntimeException(e);
		}
	}

	@Override
	public Object get(String key) {
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Object> cmd = new RemoteCacheHystrixCmd<Object>(factoryname, "get", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						if(this.needMemCache){
							return getLocal(key, tmpcache);
						}else{
							Object obj = tmpcache.get(key);
							return decompress(obj);
						}
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				return cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				if(this.needMemCache){
					return getLocal(key, cache);
				}else{
					Object obj = cache.get(key);
					return decompress(obj);
				}
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public boolean containsKey(String key) {
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Boolean> cmd = new RemoteCacheHystrixCmd<Boolean>(factoryname, "containsKey", ()->{
					ICache tmpcache = this.cachefactory.getCache();
					try{
						if(this.needMemCache){
							boolean res = memCache.containsKey(key);
							if(res == false){
								res = tmpcache.containsKey(key);
								if(res){
									Object obj = tmpcache.get(key);
									memCache.put(key, obj);
								}
							}
							return res;
						}
						return tmpcache.containsKey(key);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
					
				});
				Boolean v = cmd.execute();
				if(v == null){
					return false;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				if(this.needMemCache){
					boolean res = memCache.containsKey(key);
					if(res == false){
						res = cache.containsKey(key);
						if(res){
							Object obj = cache.get(key);
							memCache.put(key, obj);
						}
					}
					return res;
				}
				
				return cache.containsKey(key);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return false;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public long remove(String key) {
		ICache cache = null;
		try{
			if(this.needMemCache){
				memCache.remove(key);
				expireMap.remove(key);
				saveTimeMap.remove(key);
			}
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "remove", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						return tmpcache.remove(key);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				long res = cache.remove(key);
				return res;
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public long remove(String field, Object value) {
		ICache cache = null;
		try{
			cache = this.cachefactory.getCache();
			long res = cache.remove(field, value);
			return res;
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public long remove(FilterCond cond) {
		ICache cache = null;
		try{
			cache = this.cachefactory.getCache();
			long res = cache.remove(cond);
			return res;
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
		
	}

	@Override
	public long removeMany(String partKey) {
		ICache cache = null;
		try{
			if(this.needMemCache){
				removeManyMemCache(partKey);
			}
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "removeMany", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						return tmpcache.removeMany(partKey);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				long res = cache.removeMany(partKey);
				return res;
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	public long remove(FilterCond... conds) {
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.remove(conds);
		}finally{
			cache.close();
		}								
	}
	
	public long remove(String fld, String value) {
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.remove(fld, value);
		}finally{
			cache.close();
		}								
	}
	
	public long remove(String fld, long value) {
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.remove(fld, value);
		}finally{
			cache.close();
		}								
	}
	
	public long removeMany(String fld, int value) {
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.remove(fld, value);
		}finally{
			cache.close();
		}								
	}
	
	public long removeAllByExpired(int n) {
		ICache cache = null;
		try {
			cache = this.cachefactory.getCache();
			long res = cache.removeAllByExpired(n);
			return res;
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	public long countKey(String partKey){
		ICache cache = null;
		try{
			if(this.needMemCache){
				return countManyKey(partKey);
			}
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "countKey", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						return tmpcache.countKey(partKey);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.countKey(partKey);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	public Map<String, Object> getMany(String partKey){
		ICache cache = null;
		try{
			Map<String, Object> map = null;
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Map<String, Object>> cmd = new RemoteCacheHystrixCmd<Map<String, Object>>(factoryname, "getMany", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						if(this.needMemCache){
							return getLocalMany(partKey, tmpcache);
						}
						return tmpcache.getMany(partKey);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				map = cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				if(this.needMemCache){
					return getLocalMany(partKey, cache);
				}
				map = cache.getMany(partKey);
			}
			if(map == null){
				return new HashMap<String, Object>();
			}
			for(Map.Entry<String, Object> entry : map.entrySet()){
				String key = entry.getKey();
				Object obj = entry.getValue();
				obj = decompress(obj);
				entry.setValue(obj);
			}
			return map;
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public void clear() {
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "clear", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						tmpcache.clear();
						return 0l;
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				cache.clear();
			}
			if(this.needMemCache){
				memCache.clear();
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public void put(String key, Object value, int timeToIdleSeconds, int timeToLiveSeconds) {
		if(this.needMemCache){
			if(timeToLiveSeconds > 0){
				saveTimeMap.put(key, System.currentTimeMillis());
				expireMap.put(key, timeToLiveSeconds);
			}
			memCache.put(key, value);
		}
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				Object tmp = value;
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "put", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						Object val = compress(tmp);
						tmpcache.put(key, val, timeToIdleSeconds, timeToLiveSeconds);
						return 0l;
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				value = compress(value);
				cache.put(key, value, timeToIdleSeconds, timeToLiveSeconds);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public long lpush(String key, String... strings) {
		ICache cache = null;
		try{
			String[] tmp = new String[strings.length];
			for(int i=0; i<tmp.length; i++){
				tmp[i] = (String)compress(strings[i]);
			}
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "lpush", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						return tmpcache.lpush(key, tmp);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.lpush(key, tmp);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public String lpop(String key) {
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<String> cmd = new RemoteCacheHystrixCmd<String>(factoryname, "lpop", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						Object obj = tmpcache.lpop(key);
						return (String)decompress(obj);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				return cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				Object obj = cache.lpop(key);
				return (String)decompress(obj);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public long rpush(String key, String... strings) {
		ICache cache = null;
		try{
			String[] tmp = new String[strings.length];
			for(int i=0; i<tmp.length; i++){
				tmp[i] = (String)compress(strings[i]);
			}
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "rpush", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						return tmpcache.rpush(key, tmp);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.rpush(key, tmp);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public String rpop(String key) {
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<String> cmd = new RemoteCacheHystrixCmd<String>(factoryname, "rpop", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						Object obj = tmpcache.rpop(key);
						return (String)decompress(obj);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				return cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				Object obj = cache.rpop(key);
				return (String)decompress(obj);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public List<String> lrang(final String key, final long start, final long end){
		ICache cache = null;
		try{
			List<String> list = null;
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<List<String>> cmd = new RemoteCacheHystrixCmd<List<String>>(factoryname, "lrang", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						List<String> tmplist = tmpcache.lrang(key, start, end);
						return tmplist;
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				list = cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				list = cache.lrang(key, start, end);
			}
			if(list == null || list.isEmpty()){
				return list;
			}
			List<String> res = new LinkedList<String>();
			for(String str : list){
				String obj = (String) decompress(str);
				res.add(obj);
			}
			return res;
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public Long llen(final String key){
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "llen", ()->{
					ICache tmpcache = this.cachefactory.getCache();
					try{
						return tmpcache.llen(key);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.llen(key);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0l;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public Long expire(final String key, final int seconds){
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "expire", ()->{
					ICache tmpcache = this.cachefactory.getCache();
					try{
						return tmpcache.expire(key, seconds);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.expire(key, seconds);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0l;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public Long expireAt(final String key, final long unixTime) {
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "expireAt", ()->{
					ICache tmpcache = this.cachefactory.getCache();
					try{
						return tmpcache.expireAt(key, unixTime);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.expireAt(key, unixTime);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0l;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public Long publish(final String channel, final String message){
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "publish", ()->{
					ICache tmpcache = this.cachefactory.getCache();
					try{
						return tmpcache.publish(channel, message);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.publish(channel, message);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0l;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public Object get(String key, String field){ 
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Object> cmd = new RemoteCacheHystrixCmd<Object>(factoryname, "get", ()->{
					ICache tmpcache = this.cachefactory.getCache();
					try{
						Object obj = tmpcache.get(key, field);
						return decompress(obj);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				return cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				Object obj = cache.get(key, field);
				return decompress(obj);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public void putFieldValue(String key, String field, Object value){ 
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				Object tmpval = value;
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "putFieldValue", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						Object val = compress(tmpval);
						tmpcache.putFieldValue(key, field, val);
						return 0l;
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				value = compress(value);
				cache.putFieldValue(key, field, value);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public long inc(String key, long value){
		if(this.needMemCache){
			long v = ConvertUtility.getValueAsLong(memCache.get(key));
			v += value;
			put(key, v);
			return v;
		}
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "inc", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						return tmpcache.inc(key, value);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.inc(key, value);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public long dec(String key, long value){
		if(this.needMemCache){
			Object obj = memCache.get(key);
			if(obj == null){
				return 0;
			}
			long v = ConvertUtility.getValueAsLong(obj);
			v -= value;
			put(key, v);
			return v;
		}
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "dec", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						return tmpcache.dec(key, value);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.dec(key, value);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public Object getHash(String map, String key) {
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Object> cmd = new RemoteCacheHystrixCmd<Object>(factoryname, "getHash", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						Object obj = tmpcache.getHash(map, key);
						return decompress(obj);
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				return cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				Object obj = cache.getHash(map, key);
				return decompress(obj);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public void putHash(String map, String key, Object value){
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				Object tmval = value;
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "putHash", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						Object val = compress(tmval);
						tmpcache.putHash(map, key, val);
						return 0l;
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				value = compress(value);
				cache.putHash(map, key, value);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public long size(){
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "size", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						return tmpcache.size();
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				return cache.size();
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return 0;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public void forAll(Consumer<Map<String, Object>> consumer, String... fields){
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "forAll", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						tmpcache.forAll(consumer, fields);
						return 0l;
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				cache.forAll(consumer, fields);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public Set<String> zrangeByScore(final String key, final double min, final double max, final int offset, final int count){
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Set<String>> cmd = new RemoteCacheHystrixCmd<Set<String>>(factoryname, "zrangeByScore", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						Set<String> res = tmpcache.zrangeByScore(key, min, max, offset, count);
						return res;
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				return cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				Set<String> res = cache.zrangeByScore(key, min, max, offset, count);
				return res;
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public Set<byte[]> zrangeByScore(final byte[] key, final double min, final double max, final int offset, final int count){
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Set<byte[]>> cmd = new RemoteCacheHystrixCmd<Set<byte[]>>(factoryname, "zrangeByScore", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						Set<byte[]> res = tmpcache.zrangeByScore(key, min, max, offset, count);
						return res;
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				return cmd.execute();
			}else{
				cache = this.cachefactory.getCache();
				Set<byte[]> res = cache.zrangeByScore(key, min, max, offset, count);
				return res;
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}
	
	@Override
	public Long zadd(final String key, final double score, final String member){
		ICache cache = null;
		try{
			String factoryname = this.cachefactory.factoryName();
			if(this.needHystrix){
				RemoteCacheHystrixCmd<Long> cmd = new RemoteCacheHystrixCmd<Long>(factoryname, "zadd", ()->{
					ICache tmpcache = cachefactory.getCache();
					try{
						Long res = tmpcache.zadd(key, score, member);
						return res;
					}finally{
						if(tmpcache != null){
							tmpcache.close();
						}
					}
				});
				Long v = cmd.execute();
				if(v == null){
					return 0l;
				}
				return v;
			}else{
				cache = this.cachefactory.getCache();
				Long res = cache.zadd(key, score, member);
				return res;
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
			this.cachefactory.reconnect();
			return null;
		}finally{
			if(cache != null){
				cache.close();
			}
		}
	}

	@Override
	public double zincrby(String key, double score, String member) {
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.zincrby(key, score, member);
		}finally{
			cache.close();
		}
	}	
	
	@Override
	public long count(String key, String partValue){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.count(key, partValue);
		}finally{
			cache.close();
		}
	}

	@Override
	public long count(String key, long value){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.count(key, value);
		}finally{
			cache.close();
		}
	}
	
	public boolean containsKey(Object key){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.containsKey(key);
		}finally{
			cache.close();
		}
	}

	public Map<String, Object> getFieldsValue(String key, String... fields){ 
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.getFieldsValue(key, fields);
		}finally{
			cache.close();
		}
	}

	public Map<String, Object> getFieldsValue(Object key, String... fields){ 
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.getFieldsValue(key, fields);
		}finally{
			cache.close();
		}
	}

	public long remove(Object key){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.remove(key);
		}finally{
			cache.close();
		}
	}
	
	public Object get(Object key){ 
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.get(key);
		}finally{
			cache.close();
		}
	}
	
	public void put(Object key, Object value){ 
		ICache cache = this.cachefactory.getCache();
		try{
			cache.put(key, value);
		}finally{
			cache.close();
		}
	}
	
	public void putFieldValue(Object key, String field, Object value){ 
		ICache cache = this.cachefactory.getCache();
		try{
			cache.putFieldValue(key, field, value);
		}finally{
			cache.close();
		}
	}
	
	public ICache spawnCache(String dataSetName){
		ICacheFactory factory = this.cachefactory.spawnFactory(dataSetName);
		RemoteCache cache = new RemoteCache(factory, this.needMemCache, this.needCompress, this.needHystrix);
		return cache;
	}
	
	public void dropDataSet(){
		ICache cache = this.cachefactory.getCache();
		try{
			cache.dropDataSet();
		}finally{
			cache.close();
		}
	}
	
	public long countValues(FilterCond... conds){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.countValues(conds);
		}finally{
			cache.close();
		}
	}

	public List<Map<String, Object>> findValues(int limit, SortCond sort, FilterCond... conds){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.findValues(limit, sort, conds);
		}finally{
			cache.close();
		}
	}
	
	public List<Map<String, Object>> findValues(int limit, FilterCond... conds){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.findValues(limit, conds);
		}finally{
			cache.close();
		}
	}
	
	public List<Map<String, Object>> findValues(SortCond sort, FilterCond... conds){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.findValues(sort, conds);
		}finally{
			cache.close();
		}
	}
	
	public List<Map<String, Object>> findValues(FilterCond... conds){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.findValues(conds);
		}finally{
			cache.close();
		}
	}
	
	public void add(Map<String, Object> map){
		ICache cache = this.cachefactory.getCache();
		try{
			cache.add(map);
		}finally{
			cache.close();
		}
	}
	
	public void add(Map<String, Object> map, int timeoutInSec){
		ICache cache = this.cachefactory.getCache();
		try{
			cache.add(map, timeoutInSec);
		}finally{
			cache.close();
		}		
	}
	
	@Override
	public void setMap(Object key, Map<String, Object> map) {
		ICache cache = this.cachefactory.getCache();
		try{
			cache.setMap(key, map);
		}finally{
			cache.close();
		}
	}

	@Override
	public void setMap(Object key, Map<String, Object> map, int timeoutInSec) {
		ICache cache = this.cachefactory.getCache();
		try{
			cache.setMap(key, map, timeoutInSec);
		}finally{
			cache.close();
		}
	}
	
	public Map<String, Object> getMap(Object key){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.getMap(key);
		}finally{
			cache.close();
		}
	}
	
	public List<Map<String, Object>> getList(String field, Object fldKey){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.getList(field, fldKey);
		}finally{
			cache.close();
		}		
	}
	
	public String getRemoteCacheName(){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.getRemoteCacheName();
		}finally{
			cache.close();
		}				
	}
	
	public Map<String, Object> getDistinct(String key){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.getDistinct(key);
		}finally{
			cache.close();
		}						
	}
	
	public List<Map<String, Object>> aggregate(List<String> groupKeys, List<String> aggreKeys, Map<String, Object> matches){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.aggregate(groupKeys, aggreKeys, matches);
		}finally{
			cache.close();
		}						
	}

	public List<Map<String, Object>> aggregate(List<String> groupKeys, List<String> aggreKeys, FilterCond... matches){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.aggregate(groupKeys, aggreKeys, matches);
		}finally{
			cache.close();
		}						
	}

	public long count(FilterCond... matches){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.count(matches);
		}finally{
			cache.close();
		}						
	}
	
	public long countTotal() {
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.countTotal();
		}finally{
			cache.close();
		}								
	}

	public void createIndex(String fld, boolean desc) {
		ICache cache = this.cachefactory.getCache();
		try{
			cache.createIndex(fld, desc);
		}finally{
			cache.close();
		}								
	}

	public List<Map<String, Object>> leftJoin(LookupCond[] lookups, int limit, SortCond sort){
		ICache cache = this.cachefactory.getCache();
		try{
			return cache.leftJoin(lookups, limit, sort);
		}finally{
			cache.close();
		}						
	}


	public static class RemoteCacheHystrixCmd<T> extends HystrixCommand<T>{
		private Supplier<T> handler;
		public RemoteCacheHystrixCmd(String groupname, String opname, Supplier<T> handler){
			super(HystrixCommandGroupKey.Factory.asKey(String.format("%s_%s", groupname, opname)));
			this.handler = handler;
		}
		
		@Override
		protected T run() throws Exception {
			return this.handler.get();
		}
		
		@Override  
	    protected T getFallback() { 
	        return null;  
	    }  
	}
}
