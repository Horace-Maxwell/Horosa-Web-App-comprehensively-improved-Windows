package boundless.types.cache;

import net.sf.ehcache.Cache;
import net.sf.ehcache.Element;
import boundless.types.ICache;
import boundless.utility.StringUtility;

class LevelCache implements ICache {
	private String[] _remoteUrls;
	private Cache _cache;
	private String _remoteCacheName = null;
	
	private EhCacheFactory factory;
		
	public LevelCache(Cache cache, String[] remoteUrls, EhCacheFactory factory){
		this.factory = factory;
		this._cache = cache;
		this._remoteUrls = remoteUrls;
		if(remoteUrls == null){
			this._remoteUrls = new String[0];
		}
	}
	
	public LevelCache(Cache cache, String[] remoteUrls, String remoteCacheName, EhCacheFactory factory){
		this(cache, remoteUrls, factory);
		this._remoteCacheName = remoteCacheName;
	}
	
	
	private void localPut(String key, Object value){
		Element elem = new Element(key, value);
		this._cache.put(elem);
	}
	
	private void localPut(String key, Object value, int timeToIdleSeconds, int timeToLiveSeconds){
		Element elem = new Element(key, value, timeToIdleSeconds, timeToLiveSeconds);
		this._cache.put(elem);
	}
	
	
	@Override
	public void put(String key, Object value, int timeToIdleSeconds, int timeToLiveSeconds){
		localPut(key, value, timeToIdleSeconds, timeToLiveSeconds);
		for(String url : this._remoteUrls){
			try{
				factory.remotePut(url, this.getRemoteCacheName(), key, value, timeToIdleSeconds, timeToLiveSeconds);
				break;
			}catch(Exception e){
				e.printStackTrace();
				ICache.log.error("error during access cache server {}\ntry next cache server", url);
			}
		}		
	}
	
	@Override
	public void put(String key, Object value) {
		localPut(key, value);
		for(String url : this._remoteUrls){
			try{
				factory.remotePut(url, this.getRemoteCacheName(), key, value);
				break;
			}catch(Exception e){
				e.printStackTrace();
				ICache.log.error("error during access cache server {}\ntry next cache server", url);
			}
		}		
	}

	@Override
	public Object get(String key) {
		Element elem = this._cache.get(key);
		if(elem == null){
			Object value = null;
			for(String url : this._remoteUrls){
				try{
					value = factory.remoteGet(url, this.getRemoteCacheName(), key);
					break;
				}catch(Exception e){
					e.printStackTrace();
					ICache.log.error("error during access cache server {}\ntry next cache server", url);
				}
			}
			if(value != null){
				localPut(key, value);
				return value;
			}
			return null;
		}
		return elem.getObjectValue();
	}

	@Override
	public boolean containsKey(String key) {
		Element elem = this._cache.get(key);
		if(elem != null){
			return true;
		}
		Object value = null;
		for(String url : this._remoteUrls){
			try{
				value = factory.remoteGet(url, this.getRemoteCacheName(), key);
				break;
			}catch(Exception e){
				e.printStackTrace();
				ICache.log.error("error during access cache server {}\ntry next cache server", url);
			}
		}
		if(value != null){
			localPut(key, value);
			return true;
		}
		
		return false;
	}

	@Override
	public long remove(String key) {
		boolean res = this._cache.remove(key);
		if(res){
			for(String url : this._remoteUrls){
				try{
					factory.remoteRemove(url, this.getRemoteCacheName(), key);
					break;
				}catch(Exception e){
					e.printStackTrace();
					ICache.log.error("error during access cache server {}\ntry next cache server", url);
				}
			}
		}
		return  res ? 1 : 0;
	}


	@Override
	public String getRemoteCacheName() {
		if(StringUtility.isNullOrEmpty(this._remoteCacheName)){
			return this._cache.getName();
		}
		return this._remoteCacheName;
	}

	@Override
	public void clear() {
		_cache.removeAll();
	}
	

}
