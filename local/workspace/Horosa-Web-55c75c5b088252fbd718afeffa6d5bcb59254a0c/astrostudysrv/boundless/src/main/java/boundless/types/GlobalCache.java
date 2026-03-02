package boundless.types;

public class GlobalCache {
	
	private static Cache _cache = new Cache();

	public GlobalCache() {
	}

	
	/**
	 * 存入数据
	 * @param key
	 * @param value
	 */
	public static void put(String key, Object value){
		_cache.put(key, value);
	}
	
	/**
	 * 获取数据
	 * @param key
	 * @return
	 */
	public static Object get(String key){
		return _cache.get(key);
	}
	
	/**
	 * 获取数据并移除
	 * @param key
	 * @return
	 */
	public static Object getAndRemove(String key){
		return _cache.getAndRemove(key);
	}
	
}
