package spacex.astrostudy.helper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import boundless.exception.ErrorCodeException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.SecurityUtility;
import boundless.types.ICache;
import boundless.types.cache.CacheFactory;
import boundless.types.cache.FilterCond;
import boundless.types.cache.FilterOrCond;
import boundless.types.cache.SortCond;
import boundless.types.cache.FilterCond.CondOperator;
import boundless.types.cache.SortCond.SortType;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.constants.MemoType;
import spacex.astrostudy.model.AstroUser;

public class AstroCacheHelper {
	private static int DefaultLimit = 5000000;
	
	private static ICache translogCache = CacheFactory.getCache("translogmongo");
	private static ICache chartCache = CacheFactory.getCache("chart");
	private static ICache commCache = CacheFactory.getCache("comm");
	private static ICache userCache = CacheFactory.getCache("user");
	private static ICache predictiveCache = CacheFactory.getCache("predictive");
	private static ICache nongliCache = CacheFactory.getCache("nongli");
	private static ICache onlineUserCache = CacheFactory.getCache("onlineuser");
	private static ICache onlineClientCache = CacheFactory.getCache("onlineclient");
	private static ICache adminUserCache = CacheFactory.getCache("adminuser");
	
	static {
		try {
			if(translogCache != null) {
				translogCache.createIndex("tm", true);				
			}
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
	
	public static ICache getOnlineClientCache() {
		return onlineClientCache;
	}
	
	public static ICache getOnlineUserCache() {
		return onlineUserCache;
	}
	
	public static ICache getTransLogCache(){
		return translogCache;
	}
	
	public static ICache getChartCache(){
		return chartCache;
	}
	
	public static ICache getCommCache(){
		return commCache;
	}
	
	public static ICache getUserCache(){
		return userCache;
	}
	
	public static ICache getPredictiveCache(){
		return predictiveCache;
	}
	
	public static ICache getNongliCache(){
		return nongliCache;
	}
	
	public static Map<String, Object> getSuperAdmin(String uid){
		return adminUserCache.getMap(uid);
	}
	
	public static boolean isSuperAdmin(String uid) {
		Object v = adminUserCache.get(uid);
		boolean admin = ConvertUtility.getValueAsBool(v, false);			
		return admin;
	}
		
	
	public static List<Map<String, Object>> getChartsByCreator(String tag, String creator, int limit, long updtm){
		SortCond sort = new SortCond("updateTime", SortType.Asc);
		FilterCond tmCond = new FilterCond("updateTime", CondOperator.Gt, updtm);
		FilterCond userCond = new FilterCond("creator", CondOperator.Eq, creator);
		List<Map<String, Object>> list;
		if(!StringUtility.isNullOrEmpty(tag) && !tag.equalsIgnoreCase("null")) {
			Pattern tagpattern = Pattern.compile(tag, Pattern.CASE_INSENSITIVE);
			FilterCond tagCond = new FilterCond("tags", CondOperator.Like, tagpattern);
			list = chartCache.findValues(limit, sort, userCond, tagCond, tmCond);			
		}else {
			list = chartCache.findValues(limit, sort, userCond, tmCond);
		}
		return list;
	}
	
	public static List<Map<String, Object>> getCharts(String tag, String name, int limit, long updtm){
		Pattern pattern = Pattern.compile(name, Pattern.CASE_INSENSITIVE);
		FilterCond nameCond = new FilterCond("name", CondOperator.Like, pattern);
		FilterCond pubCond = new FilterCond("isPub", CondOperator.Eq, 1);
		FilterCond tmCond = new FilterCond("updateTime", CondOperator.Gt, updtm);
		SortCond sort = new SortCond("updateTime", SortType.Asc);
		List<Map<String, Object>> list = null;
		if(!StringUtility.isNullOrEmpty(tag) && !tag.equalsIgnoreCase("null")) {
			Pattern tagpattern = Pattern.compile(tag, Pattern.CASE_INSENSITIVE);
			FilterCond tagCond = new FilterCond("tags", CondOperator.Like, tagpattern);
			list = chartCache.findValues(limit, sort, nameCond, pubCond, tagCond, tmCond);			
		}else {
			list = chartCache.findValues(limit, sort, nameCond, pubCond, tmCond);
		}
		return list;
	}
	
	public static List<Map<String, Object>> getCharts(String tag, String name, String creator, int limit, long updtm){
		Pattern pattern = Pattern.compile(name, Pattern.CASE_INSENSITIVE);
		FilterCond nameCond = new FilterCond("name", CondOperator.Like, pattern);
		FilterCond userCond = new FilterCond("creator", CondOperator.Eq, creator);
		FilterCond pubCond = new FilterCond("isPub", CondOperator.Eq, 1);
		FilterCond tmCond = new FilterCond("updateTime", CondOperator.Gt, updtm);
		FilterOrCond orcond = new FilterOrCond(pubCond, userCond);		
		SortCond sort = new SortCond("updateTime", SortType.Asc);
		List<Map<String, Object>> list = null;
		if(!StringUtility.isNullOrEmpty(tag) && !tag.equalsIgnoreCase("null")) {
			Pattern tagpattern = Pattern.compile(tag, Pattern.CASE_INSENSITIVE);
			FilterCond tagCond = new FilterCond("tags", CondOperator.Like, tagpattern);
			list = chartCache.findValues(limit, sort, orcond, nameCond, tagCond, tmCond);				
		}else {
			list = chartCache.findValues(limit, sort, orcond, nameCond, tmCond);							
		}
		return list;
	}
	
	public static List<Map<String, Object>> getCharts(String tag, String name, String creator){
		if(StringUtility.isNullOrEmpty(creator)) {
			return getCharts(tag, name);
		}
		List<Map<String, Object>> res = new ArrayList<Map<String, Object>>(DefaultLimit);
		int sz = 0;
		long updtm = 0;
		do {
			List<Map<String, Object>> list = getCharts(tag, name, creator, DefaultLimit, updtm);
			res.addAll(list);
			sz = list.size();
			if(sz == DefaultLimit) {
				Map<String, Object> map = (Map<String, Object>) list.get(sz - 1);
				updtm = (long) map.get("updateTime");
			}
		}while(sz == DefaultLimit);
		
		sortCharts(res);
		return res;
	}
	
	public static void sortCharts(List<Map<String, Object>> res) {
		res.sort((e1, e2)->{
			String name1 = (String) e1.get("name");
			String name2 = (String) e2.get("name");
			if(StringUtility.isNullOrEmpty(name1)) {
				if(StringUtility.isNullOrEmpty(name2)) {
					return 0;
				}else {
					return -1;
				}
			}else {
				if(StringUtility.isNullOrEmpty(name2)) {
					return 1;
				}else {
					String py1 = StringUtility.toPinYin(name1);
					String py2 = StringUtility.toPinYin(name2);
					return py1.compareTo(py2);
				}
			}
		});		
	}
	
	public static Map<String, Object> getChart(String cid){
		FilterCond idCond = new FilterCond("cid", CondOperator.Eq, cid);
		List<Map<String, Object>> list = chartCache.findValues(idCond);
		return list.isEmpty() ? null : list.get(0);
	}
	
	public static List<Map<String, Object>> getChartsByCreator(String creator){
		List<Map<String, Object>> res = new ArrayList<Map<String, Object>>(DefaultLimit);
		int sz = 0;
		long updtm = 0;
		do {
			List<Map<String, Object>> list = getChartsByCreator(null, creator, DefaultLimit, updtm);
			res.addAll(list);
			sz = list.size();
			if(sz == DefaultLimit) {
				Map<String, Object> map = (Map<String, Object>) list.get(sz - 1);
				updtm = (long) map.get("updateTime");
			}
		}while(sz == DefaultLimit);
		
		sortCharts(res);
		return res;
	}
	
	public static List<Map<String, Object>> getChartsByCreator(String tag, String creator){
		List<Map<String, Object>> res = new ArrayList<Map<String, Object>>(DefaultLimit);
		int sz = 0;
		long updtm = 0;
		do {
			List<Map<String, Object>> list = getChartsByCreator(tag, creator, DefaultLimit, updtm);
			res.addAll(list);
			sz = list.size();
			if(sz == DefaultLimit) {
				Map<String, Object> map = (Map<String, Object>) list.get(sz - 1);
				updtm = (long) map.get("updateTime");
			}
		}while(sz == DefaultLimit);
		
		sortCharts(res);
		return res;
	}
	
	public static List<Map<String, Object>> getCharts(String tag, String name){
		List<Map<String, Object>> res = new ArrayList<Map<String, Object>>(DefaultLimit);
		int sz = 0;
		long updtm = 0;
		do {
			List<Map<String, Object>> list = getCharts(tag, name, DefaultLimit, updtm);
			res.addAll(list);
			sz = list.size();
			if(sz == DefaultLimit) {
				Map<String, Object> map = (Map<String, Object>) list.get(sz - 1);
				updtm = (long) map.get("updateTime");
			}
		}while(sz == DefaultLimit);
		
		sortCharts(res);
		return res;
	}
	
	public static AstroUser getUser(String loginId, String pwd) {
		FilterCond idCond = new FilterCond("uid", CondOperator.Eq, loginId);
		FilterCond pwdCond = new FilterCond("password", CondOperator.Eq, pwd);
		List<Map<String, Object>> list = userCache.findValues(idCond, pwdCond);
		if(list.isEmpty()) {
			return null;
		}
		Map<String, Object> map = list.get(0);
		return AstroUser.fromMap(map);
	}
	
	public static AstroUser getUser(String loginId) {
		FilterCond idCond = new FilterCond("uid", CondOperator.Eq, loginId);
		List<Map<String, Object>> list = userCache.findValues(idCond);
		if(list.isEmpty()) {
			return null;
		}
		Map<String, Object> map = list.get(0);
		return AstroUser.fromMap(map);
	}
	
	public static List<String> getUsers(String uid){
		List<Map<String, Object>> list = null;
		SortCond sort = new SortCond("uid", SortType.Asc);
		if(StringUtility.isNullOrEmpty(uid)) {
			list = userCache.findValues(sort);
		}else {
			FilterCond idCond = new FilterCond("uid", CondOperator.Like, uid);
			list = userCache.findValues(sort, idCond);			
		}
		List<String> res = new ArrayList<String>(list.size());
		for(Map<String, Object> map : list) {
			String user = (String) map.get("uid");
			res.add(user);
		}
		
		return res;
	}
	
	public static List<Map<String, Object>> getUsers(String uid, Boolean admin, Long privi){
		List<Map<String, Object>> list = null;
		SortCond sort = new SortCond("uid", SortType.Asc);
		List<FilterCond> conds = new ArrayList<FilterCond>();
		if(!StringUtility.isNullOrEmpty(uid)) {
			FilterCond idCond = new FilterCond("uid", CondOperator.Like, uid);
			conds.add(idCond);
		}
		if(admin != null) {
			FilterCond adCond = new FilterCond("admin", CondOperator.Eq, admin.booleanValue());
			if(admin) {
				conds.add(adCond);
			}else {
				FilterCond adnCond = new FilterCond("admin", CondOperator.Eq, null);
				FilterOrCond cond = new FilterOrCond(adCond, adnCond);				
				conds.add(cond);				
			}
		}
		FilterCond[] aryconds = new FilterCond[conds.size()];
		conds.toArray(aryconds);
		list = userCache.findValues(sort, aryconds);	
		List<Map<String, Object>> res = new ArrayList<Map<String, Object>>(list.size());
		if(privi != null) {
			for(Map<String, Object> map : list) {
				Map<String, Object> umap = new HashMap<String, Object>();
				umap.put("uid", map.get("uid"));
				umap.put("admin", map.get("admin"));
				boolean isadmin = ConvertUtility.getValueAsBool(map.get("admin"), false);
				Object pri = map.get("privilege");
				if(pri != null) {
					long priv = ConvertUtility.getValueAsLong(pri, 0);
					long chk = privi.longValue();
					if((priv & chk) == chk || isadmin) {
						umap.put("privilege", priv);
						res.add(umap);					
					}					
				}
			}						
		}else {
			for(Map<String, Object> map : list) {
				Map<String, Object> umap = new HashMap<String, Object>();
				umap.put("uid", map.get("uid"));
				umap.put("admin", map.get("admin"));
				umap.put("privilege", map.get("privilege"));
				res.add(umap);
			}			
		}
		
		return res;
	}
	
	public static Map<String, Object> getPredictive(String key){
		Object obj = predictiveCache.get(key);
		if(obj == null) {
			return null;
		}
		if(obj instanceof Map) {
			return (Map<String, Object>)obj;
		}
		Map<String, Object> res = new HashMap<String, Object>();
		res.put("result", obj);
		return res;
	}
	
	public static void setPredictive(String key, Map<String, Object> map) {
		predictiveCache.put(key, map);
	}
	
	public static void saveChart(Map<String, Object> chart) {
		String key = (String)chart.get("cid");
		Map<String, Object> oldchart = getChart(key);
		if(oldchart != null) {
			String creator = (String) chart.get("creator");
			String oldcreator = (String) oldchart.get("creator");
			if(!creator.equalsIgnoreCase(oldcreator)) {
				throw new ErrorCodeException(120000, "user.not.possess.chart");
			}
			oldchart.putAll(chart);
		}
		chartCache.setMap(key, chart);
	}
	
	public static void saveMemo(String cid, int type, String memo, String uid) {
		Map<String, Object> oldchart = getChart(cid);
		if(oldchart != null) {
			String oldcreator = (String) oldchart.get("creator");
			if(!uid.equalsIgnoreCase(oldcreator)) {
				throw new ErrorCodeException(124000, "user.not.possess.chart");
			}			
		}
		Map<String, Object> map = new HashMap<String, Object>();
		MemoType t = MemoType.fromCode(type);
		try {
			byte[] raw = SecurityUtility.fromBase64(memo);
			String txt = new String(raw, "UTF-8");
			map.put(t.toString(), txt);
			chartCache.setMap(cid, map);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static void saveNongli(Map<String, Object> nongli) {
		if(nongliCache == null) {
			return;
		}
		String date = (String) nongli.get("date");
		String zone = (String) nongli.get("zone");
		String key = String.format("%s %s", date, zone);
		nongli.put("key", key);
		nongliCache.setMap(key, nongli);
	}
	
	public static Map<String, Object> getNongli(String date, String zone){
		if(nongliCache == null) {
			return null;
		}
		String key = String.format("%s %s", date, zone);
		FilterCond idCond = new FilterCond("key", CondOperator.Eq, key);
		List<Map<String, Object>> list = nongliCache.findValues(idCond);
		return list.isEmpty() ? null : list.get(0);		
	}
	
	public static void saveJieqi(Map<String, Object> nongli) {
		if(nongliCache == null) {
			return;
		}
		String date = (String) nongli.get("date");
		String zone = (String) nongli.get("zone");
		String key = String.format("jieqi_%s %s", date, zone);
		nongli.put("key", key);
		nongliCache.setMap(key, nongli);
	}
	
	public static Map<String, Object> getJieqi(String date, String zone){
		if(nongliCache == null) {
			return null;
		}
		String key = String.format("jieqi_%s %s", date, zone);
		FilterCond idCond = new FilterCond("key", CondOperator.Eq, key);
		List<Map<String, Object>> list = nongliCache.findValues(idCond);
		return list.isEmpty() ? null : list.get(0);		
	}
	
	public static void removeChart(String cid, String creator) {
		Map<String, Object> oldchart = getChart(cid);
		if(oldchart != null) {
			String oldcreator = (String) oldchart.get("creator");
			if(!creator.equalsIgnoreCase(oldcreator)) {
				throw new ErrorCodeException(120000, "user.not.possess.chart");
			}			
			chartCache.remove("cid", cid);
		}
	}
		
	public static long removeAllCharts(String creator) {
		return chartCache.remove("cid", creator);
	}
	
	public static long deleteCacheKey() {
		return predictiveCache.removeAllByExpired(-1);
	}
	
	
	public static Map<String, Object> getFirstChart(){
		ICache cache = AstroCacheHelper.getChartCache();
		SortCond sort = new SortCond("updateTime", SortType.Asc);
		List<Map<String, Object>> list = cache.findValues(1, sort);
		if(list.isEmpty()) {
			return null;
		}
		return list.get(0);
	}
		
	public static List<Map<String, Object>> getChartsGps(long time, int days) {
		ICache cache = AstroCacheHelper.getChartCache();
		long tm = time;
		if(time <= 0) {
			Map<String, Object> map = getFirstChart();
			tm = ConvertUtility.getValueAsLong(map.get("updateTime"), 0);
			if(tm <= 0) {
				throw new RuntimeException("no.chart.in.db");
			}
		}
		long edtm = tm + days * 3600000 * 24;
		SortCond sort = new SortCond("updateTime", SortType.Asc);
		FilterCond tmcond = new FilterCond("updateTime", CondOperator.Gte, tm);
		FilterCond edtmcond = new FilterCond("updateTime", CondOperator.Lt, edtm);

		return cache.findValues(sort, tmcond, edtmcond);
	}
	
	public static Map<String, Object> getFirstChartByCid(){
		ICache cache = AstroCacheHelper.getChartCache();
		SortCond sort = new SortCond("cid", SortType.Asc);
		List<Map<String, Object>> list = cache.findValues(1, sort);
		if(list.isEmpty()) {
			return null;
		}
		return list.get(0);
	}
		
	public static List<Map<String, Object>> getChartsGps(String cid, int limit) {
		ICache cache = AstroCacheHelper.getChartCache();
		String id = cid;
		if(StringUtility.isNullOrEmpty(cid)) {
			Map<String, Object> map = getFirstChartByCid();
			id = (String)map.get("cid");
			if(StringUtility.isNullOrEmpty(id)) {
				throw new RuntimeException("no.chart.in.db");
			}
		}
		SortCond sort = new SortCond("cid", SortType.Asc);
		FilterCond cond = new FilterCond("cid", CondOperator.Gt, id);

		return cache.findValues(limit, sort, cond);
	}
	
	
}
