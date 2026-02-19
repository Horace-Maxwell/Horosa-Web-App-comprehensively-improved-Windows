package boundless.types.cache;

import boundless.types.ICache;

public class DummyCache implements ICache {
	
	
	public DummyCache(){
		ICache.log.info("DummyCache object created");
	}

	@Override
	public void put(String key, Object value) {
		ICache.log.info("DummyCache.put");
	}

	@Override
	public void put(String key, Object value, int timeToIdleSeconds, int timeToLiveSeconds) {
		ICache.log.info("DummyCache.put");
	}

	@Override
	public Object get(String key) {
		ICache.log.info("DummyCache.get");
		return null;
	}

	@Override
	public boolean containsKey(String key) {
		ICache.log.info("DummyCache.containsKey");
		return false;
	}

	@Override
	public long remove(String key) {
		ICache.log.info("DummyCache.remove");
		return 0;
	}

	@Override
	public String getRemoteCacheName() {
		ICache.log.info("DummyCache.getRemoteCacheName");
		return "";
	}

	@Override
	public void clear() {
		ICache.log.info("DummyCache.clear");
	}

}
