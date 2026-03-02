package spacex.astrostudy.helper;

import java.util.List;
import java.util.Map;

import boundless.types.ICache;
import boundless.types.cache.FilterCond;
import boundless.types.cache.SortCond;
import boundless.types.cache.FilterCond.CondOperator;
import boundless.types.cache.SortCond.SortType;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class StatisticHelper {

	public static long getOnlineUserCount() {
		ICache cache = AstroCacheHelper.getOnlineUserCache();
		long exp = System.currentTimeMillis() - 3600000*24;
		FilterCond tmCond = new FilterCond("time", CondOperator.Gte, exp);
		
		return cache.count(tmCond);
	}
	
	public static long getOnlineClientCount() {
		ICache cache = AstroCacheHelper.getOnlineClientCache();
		long exp = System.currentTimeMillis() - 3600000*24;
		FilterCond tmCond = new FilterCond("time", CondOperator.Gte, exp);
		
		return cache.count(tmCond);
	}
	
	public static long getUserCount() {
		ICache cache = AstroCacheHelper.getUserCache();
		
		return cache.countTotal();
	}
	
	public static long getChartsCount() {
		ICache cache = AstroCacheHelper.getChartCache();
		
		return cache.countTotal();
	}
	
		
	
	
}
