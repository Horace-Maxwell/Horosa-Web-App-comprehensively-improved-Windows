/**
 * 
 */
package boundless.types;

import java.util.Date;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 局部缓存。线程安全的。局部缓存是个可被多次实例化的类，数据是一个局部缓存对象内共享的。
 * @author zjf
 *	
 */
public class Cache {

	private ConcurrentHashMap<String, CacheItem> _datas = new ConcurrentHashMap<String, CacheItem>();
	
	public Cache(){}
	
	/**
	 * 存入数据
	 * @param key
	 * @param value
	 */
	public void put(String key, Object value) {
		CacheItem item = new CacheItem(value);
		_datas.put(key, item);
	}
	
	/**
	 * 获取数据
	 * @param key
	 * @return
	 */
	public Object get(String key){
		if(!_datas.containsKey(key)){
			return null;
		}
		return _datas.get(key).cacheData;
	}
	
	/**
	 * 获取数据并移除
	 * @param key
	 * @return
	 */
	public Object getAndRemove(String key){
		if(!_datas.containsKey(key)){
			return null;
		}
		CacheItem item = _datas.remove(key);
		if(item == null){
			return null;
		}
		return item.cacheData;
	}
	
	
	private class CacheItem
	{
		CacheItem(){}
		CacheItem(Object data){
			cacheTime = new Date();
			cacheData = data;
		}
		
		public Date cacheTime;
		public Object cacheData;
	}

}
