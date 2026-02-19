package spacex.astrostudy.helper;


import boundless.types.ICache;
import boundless.types.cache.FilterCond;
import boundless.types.cache.FilterCond.CondOperator;

public class MongoTransLogTask {
	private static final long delta = 3600000 * 24 * 30;
	private static final long clientStaticDelta = 3600000 * 24;
	
	public static void check() {
		ICache clientcache = AstroCacheHelper.getOnlineClientCache();
		ICache cache = AstroCacheHelper.getTransLogCache();
		long now = System.currentTimeMillis();
		long tm = now - delta;
		FilterCond tmCond = new FilterCond("tm", CondOperator.Lt, tm);
		cache.remove(tmCond);
		
		long clienttm = now - clientStaticDelta;
		tmCond = new FilterCond("time", CondOperator.Lt, clienttm);
		clientcache.remove(tmCond);
		
	}
	
}
