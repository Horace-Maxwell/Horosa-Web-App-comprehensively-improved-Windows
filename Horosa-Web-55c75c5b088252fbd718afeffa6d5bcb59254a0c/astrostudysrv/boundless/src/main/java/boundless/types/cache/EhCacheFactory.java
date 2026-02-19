package boundless.types.cache;

import java.io.File;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Hashtable;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.thoughtworks.xstream.XStream;

import net.sf.ehcache.CacheManager;
import net.sf.ehcache.Cache;
import boundless.net.http.HttpClientUtility;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

class EhCacheFactory implements ICacheFactory {
	private static Logger log = LoggerFactory.getLogger(EhCacheFactory.class);

	private Hashtable<String, ICache> _cacheMap = new Hashtable<String, ICache>();
	
	private CacheManager _cacheManager = null;	
	

	public void build(String xmlfile){
		if(_cacheManager == null){
			try{
				_cacheManager = CacheManager.create();	
			}catch(Exception e){
				e.printStackTrace();
				log.error("will use DummyCache");
			}
		}
		
		XStream xstream = new XStream();
		xstream.alias("caches", Map.class);
		xstream.alias("cache", Map.class);
		xstream.alias("servers", Map.class);
		xstream.registerConverter(new CachesConverter(), XStream.PRIORITY_VERY_HIGH);
		xstream.registerConverter(new CacheServersConverter());
		xstream.registerConverter(new CacheMapEntryConverter());
		
		Map<String, Object> cachesmap = (Map<String, Object>) xstream.fromXML(new File(xmlfile));
		Map<String, Object> servers = (Map<String, Object>)cachesmap.get("servers");
		List<Map<String, Object>> caches = (List<Map<String, Object>>) cachesmap.get("caches");
		
		List<String> defurls = (List<String>) servers.get("urls");
		String[] serurls = new String[0];
		if(servers != null){
			serurls = new String[defurls.size()];
			serurls = defurls.toArray(serurls);
		}
		
		for(Map<String, Object> cache : caches){
			Map<String, Object> servs = (Map<String, Object>) cache.get("servers");
			boolean defvalue = ConvertUtility.getValueAsBool(servs.get("default"), false);
			String name = (String) cache.get("name");
			List<String> urls = (List<String>) servs.get("urls");
			if(_cacheManager != null){
				Cache ehcache = _cacheManager.getCache(name);
				
				String[] urlary = serurls;
				if(!defvalue){
					if(urls != null && urls.size() > 0){
						urlary = new String[urls.size()];
						urlary = urls.toArray(urlary);
					}else{
						urlary = new String[0];
					}
				}
				LevelCache cacheobj = new LevelCache(ehcache, urlary, (String)servs.get("cacheName"), this);
				_cacheMap.put(name, cacheobj);
				for(String url : urlary){
					try{
						remoteCreateCache(url, cacheobj.getRemoteCacheName());
					}catch(Exception e){
						e.printStackTrace();
					}
				}
			}else{
				_cacheMap.put(name, new DummyCache());
			}
		}
	}
	
	/**
	 * 获取缓存对象。
	 * @param cacheName 缓存的名称（对应EhCache中的缓存名称）
	 * @return
	 */
	public ICache getCache(String cacheName){
		String key = cacheName;
		return _cacheMap.get(key);
	}

	/**
	 * 关闭缓存管理器
	 */
	public void close() {
		if(_cacheManager != null){
			_cacheManager.shutdown();
			_cacheManager = null;
			log.info("ehcache shutdown.");
		}
	}
	
	
	
	/**
	 * 获取远程缓存服务器中的所有缓存
	 * @param serverUrl 远程缓存服务器url
	 * @return 缓存服务器中的所有缓存，以缓存名称作为map的key
	 */
	public static Map<String, Object> getAllRemoteCaches(String serverUrl){
		String xmlstr = HttpClientUtility.getString(serverUrl);
		XStream xstream = new XStream();
		xstream.alias("caches", ArrayList.class);
		xstream.alias("cache", HashMap.class);
		xstream.alias("cacheConfiguration", HashMap.class);
		xstream.alias("statistics", HashMap.class);
		xstream.registerConverter(new EhCacheMapEntryConverter());
		xstream.registerConverter(new EhCachesConverter());
		
		Map<String, Object> res = new HashMap<String, Object>();
		List list = (List) xstream.fromXML(xmlstr);
		if(list != null){
			for(int i=0; i<list.size(); i++){
				Map<String, Object> map = (Map<String, Object>) list.get(i);
				res.put(map.get("name").toString(), map);
			}
		}
		return res;
	}
	
	public boolean remoteExistsCache(String serverUrl, String cacheName){
		try {
			cacheName = URLEncoder.encode(cacheName, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			log.error(e.getMessage());
		}
		String url = serverUrl + cacheName;
		String xmlStr = HttpClientUtility.getString(url);
		if(StringUtility.isNullOrEmpty(xmlStr)){
			return false;
		}
		try{
			XStream xstream = new XStream();
			xstream.alias("cache", HashMap.class);
			xstream.alias("cacheConfiguration", HashMap.class);
			xstream.alias("statistics", HashMap.class);
			xstream.registerConverter(new EhCacheMapEntryConverter());
			
			Map map = (Map) xstream.fromXML(xmlStr);
			if(map.get("name").equals(cacheName)){
				return true;
			}
		}catch(Exception e){
			return false;
		}
		
		return true;
	}
	
	public static void remoteCreateCache(String serverUrl, String cacheName){
		try {
			cacheName = URLEncoder.encode(cacheName, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			log.error(e.getMessage());
		}
		String url = serverUrl + cacheName;
		HttpClientUtility.httpPut(url);
	}
	
	public Object remoteGet(String serverUrl, String cacheName, String key){
		try {
			key = URLEncoder.encode(key, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			log.error(e.getMessage());
		}
		String url = serverUrl + cacheName + "/" + key;
		Object obj = HttpClientUtility.getObject(url);
		return obj;
	}
	
	public int remotePut(String serverUrl, String cacheName, String key, Object value){
		try {
			key = URLEncoder.encode(key, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			log.error(e.getMessage());
		}
		String url = serverUrl + cacheName + "/" + key;
		int code = HttpClientUtility.httpPut(url, value);
		return code;
	}
	
	public int remotePut(String serverUrl, String cacheName, String key, Object value,int timeToIdleSeconds, int timeSecondToLive){
		try {
			key = URLEncoder.encode(key, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			log.error(e.getMessage());
		}
		String url = serverUrl + cacheName + "/" + key;
		Map<String, String> header = new HashMap<String, String>();
		header.put("ehcacheTimeToIdleSeconds", timeToIdleSeconds + "");
		header.put("ehcacheTimeToLiveSeconds", timeSecondToLive + "");
		int code = HttpClientUtility.httpPut(url, value, header);
		return code;
	}
	
	public void remoteRemove(String serverUrl, String cacheName, String key){
		try {
			key = URLEncoder.encode(key, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			log.error(e.getMessage());
		}
		String url = serverUrl + cacheName + "/" + key;
		HttpClientUtility.httpDelete(url);
	}

	@Override
	public ICache getCache() {
		// TODO Auto-generated method stub
		return null;
	}
	
	
	
}
