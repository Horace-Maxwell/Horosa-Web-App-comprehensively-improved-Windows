package spacex.astrostudy.helper;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

import boundless.exception.ErrorCodeException;
import boundless.net.http.HttpClientUtility;
import boundless.security.MD5Utility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.CalculatePool;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class AstroHelper {
	private static final boolean Debug = PropertyPlaceholder.getPropertyAsBool("devmode", true);
	private static final ConcurrentHashMap<String, Map<String, Object>> localPredictiveCache = new ConcurrentHashMap<String, Map<String, Object>>();
	private static final ConcurrentHashMap<String, CompletableFuture<Map<String, Object>>> inflightPredictiveCache = new ConcurrentHashMap<String, CompletableFuture<Map<String, Object>>>();
	private static final Set<String> ForceExactCachePaths = new HashSet<String>();

	public static final String AstroSrvUrl = PropertyPlaceholder.getProperty("astrosrv", "http://127.0.0.1:8899");
	public static final String SolarReturn = PropertyPlaceholder.getProperty("solarreturn", "/predict/solarreturn");
	public static final String LunarReturn = PropertyPlaceholder.getProperty("lunarreturn", "/predict/lunarreturn");
	public static final String GivenYear = PropertyPlaceholder.getProperty("givenyear", "/predict/givenyear");
	public static final String SolarArc = PropertyPlaceholder.getProperty("solararc", "/predict/solararc");
	public static final String Profection = PropertyPlaceholder.getProperty("profection", "/predict/profection");
	public static final String PrimaryDirection = PropertyPlaceholder.getProperty("pd", "/predict/pd");
	public static final String PrimaryDirectionChart = PropertyPlaceholder.getProperty("pdchart", "/predict/pdchart");
	public static final String ZodiacalRelease = PropertyPlaceholder.getProperty("zr", "/predict/zr");
	public static final String Dice = PropertyPlaceholder.getProperty("dice", "/predict/dice");
	public static final String Chart13 = PropertyPlaceholder.getProperty("chart13", "/chart13");
	public static final String IndiaChart = PropertyPlaceholder.getProperty("indiachart", "/india/chart");
	public static final String RelativeChart = PropertyPlaceholder.getProperty("relativechart", "/modern/relative");
	public static final String MidPoint = PropertyPlaceholder.getProperty("midpoint", "/germany/midpoint");
	public static final String JieQiYear = PropertyPlaceholder.getProperty("jieqiyear", "/jieqi/year");
	public static final String JieQiBirth = PropertyPlaceholder.getProperty("jieqibirth", "/jieqi/birth");
	public static final String Nongli = PropertyPlaceholder.getProperty("nongli", "/jieqi/nongli");
	public static final String JdnDate = PropertyPlaceholder.getProperty("jdndate", "/jdn/date");
	public static final String Acg = PropertyPlaceholder.getProperty("acg", "/location/acg");
	public static final String Azimuth = PropertyPlaceholder.getProperty("azimuth", "/calc/azimuth");
	public static final String Cotrans = PropertyPlaceholder.getProperty("cotrans", "/calc/cotrans");

	static {
		ForceExactCachePaths.add(RelativeChart);
		ForceExactCachePaths.add(JieQiYear);
		ForceExactCachePaths.add(JieQiBirth);
		ForceExactCachePaths.add(Nongli);
		ForceExactCachePaths.add(Acg);
	}

	private static Object normalizeCacheValue(Object obj) {
		if(obj instanceof Map) {
			TreeMap<String, Object> normalized = new TreeMap<String, Object>();
			Map<?, ?> map = (Map<?, ?>) obj;
			for(Map.Entry<?, ?> entry : map.entrySet()) {
				String key = entry.getKey() == null ? "null" : entry.getKey().toString();
				normalized.put(key, normalizeCacheValue(entry.getValue()));
			}
			return normalized;
		}
		if(obj instanceof Collection) {
			List<Object> list = new ArrayList<Object>();
			for(Object item : (Collection<?>) obj) {
				list.add(normalizeCacheValue(item));
			}
			return list;
		}
		if(obj != null && obj.getClass().isArray()) {
			int len = java.lang.reflect.Array.getLength(obj);
			List<Object> list = new ArrayList<Object>(len);
			for(int i=0; i<len; i++) {
				list.add(normalizeCacheValue(java.lang.reflect.Array.get(obj, i)));
			}
			return list;
		}
		return obj;
	}
	
	private static String getPredictiveKey(String path, Map<String, Object> params) {
		StringBuilder sb = new StringBuilder(path);
		sb.append("_");
		Object normalized = normalizeCacheValue(params);
		sb.append(JsonUtility.encode(normalized));
		String txt = sb.toString();
		return MD5Utility.encryptAsString(txt);
	}

	private static String getRemoteErrMessage(Map<String, Object> jsonres) {
		String err = ConvertUtility.getValueAsString(jsonres.get("err"));
		if (StringUtility.isNullOrEmpty(err)) {
			err = "param error";
		}

		if (jsonres.containsKey("detail")) {
			String detail = ConvertUtility.getValueAsString(jsonres.get("detail"));
			if (!StringUtility.isNullOrEmpty(detail)) {
				if (detail.length() > 500) {
					detail = detail.substring(0, 500) + "...";
				}
				if (err.indexOf(detail) < 0) {
					err = String.format("%s (%s)", err, detail);
				}
			}
		}
		return err;
	}
	
	private static Map<String, Object> request(String path, Map<String, Object> params){
		boolean forceExactCache = ForceExactCachePaths.contains(path);
		if(Debug && !forceExactCache) {
			return requestNoCache(path, params);
		}
		String key = getPredictiveKey(path, params);
		Map<String, Object> localRes = localPredictiveCache.get(key);
		if(localRes != null) {
			return localRes;
		}
		Map<String, Object> res = AstroCacheHelper.getPredictive(key);
		if(res != null) {
			localPredictiveCache.putIfAbsent(key, res);
			return res;
		}

		CompletableFuture<Map<String, Object>> ownerFuture = new CompletableFuture<Map<String, Object>>();
		CompletableFuture<Map<String, Object>> existingFuture = inflightPredictiveCache.putIfAbsent(key, ownerFuture);
		if(existingFuture != null) {
			return existingFuture.join();
		}

		try {
			Map<String, Object> cachedAfterClaim = localPredictiveCache.get(key);
			if(cachedAfterClaim != null) {
				ownerFuture.complete(cachedAfterClaim);
				return cachedAfterClaim;
			}

			Map<String, Object> remoteCachedAfterClaim = AstroCacheHelper.getPredictive(key);
			if(remoteCachedAfterClaim != null) {
				localPredictiveCache.putIfAbsent(key, remoteCachedAfterClaim);
				ownerFuture.complete(remoteCachedAfterClaim);
				return remoteCachedAfterClaim;
			}

			String url = String.format("%s%s", AstroSrvUrl, path);
			String jsonData = JsonUtility.encode(params);
			Map<String, String> headers = new HashMap<String, String>();
			Map<String, String> respHeadMap = new HashMap<String, String>();
			String str = HttpClientUtility.uploadString(url, headers, "application/json; charset=UTF-8", jsonData, respHeadMap);
			Map<String, Object> jsonres = JsonUtility.toDictionary(str);
			if(jsonres.containsKey("err")) {
				throw new ErrorCodeException(200001, getRemoteErrMessage(jsonres));
			}
			localPredictiveCache.put(key, jsonres);
			ownerFuture.complete(jsonres);
			
			CalculatePool.queueUserWorkItem(()->{
				AstroCacheHelper.setPredictive(key, jsonres);
			});
			
			return jsonres;
		}catch(Throwable ex) {
			ownerFuture.completeExceptionally(ex);
			if(ex instanceof RuntimeException) {
				throw (RuntimeException)ex;
			}
			if(ex instanceof Error) {
				throw (Error)ex;
			}
			throw new RuntimeException(ex);
		} finally {
			inflightPredictiveCache.remove(key, ownerFuture);
		}
	}
	
	public static Map<String, Object> requestNoCache(String path, Map<String, Object> params){
		String url = String.format("%s%s", AstroSrvUrl, path);
		String jsonData = JsonUtility.encode(params);
		Map<String, String> headers = new HashMap<String, String>();
		Map<String, String> respHeadMap = new HashMap<String, String>();
		String str = HttpClientUtility.uploadString(url, headers, "application/json; charset=UTF-8", jsonData, respHeadMap);
		Map<String, Object> jsonres = JsonUtility.toDictionary(str);
		if(jsonres.containsKey("err")) {
			throw new ErrorCodeException(200001, getRemoteErrMessage(jsonres));
		}
		
		return jsonres;		
	}
	
	
	public static Map<String, Object> getChart(Map<String, Object> params) {
		return request("/", params);
	}
	
	public static Map<String, Object> getSolarReturn(Map<String, Object> params){
		return request(SolarReturn, params);
	}
	
	public static Map<String, Object> getLunarReturn(Map<String, Object> params){
		return request(LunarReturn, params);
	}
	
	public static Map<String, Object> getGivenYear(Map<String, Object> params){
		return request(GivenYear, params);
	}
	
	public static Map<String, Object> getSolarArc(Map<String, Object> params){
		return request(SolarArc, params);
	}
	
	public static Map<String, Object> getProfection(Map<String, Object> params){
		return request(Profection, params);
	}
	
	public static Map<String, Object> getPrimaryDirection(Map<String, Object> params){
		return request(PrimaryDirection, params);
	}

	public static Map<String, Object> getPrimaryDirectionChart(Map<String, Object> params){
		return request(PrimaryDirectionChart, params);
	}
	
	public static Map<String, Object> getZodiacalRelease(Map<String, Object> params){
		return request(ZodiacalRelease, params);
	}
	
	public static Map<String, Object> getChart13(Map<String, Object> params){
		return request(Chart13, params);
	}
	
	public static Map<String, Object> getIndiaChart(Map<String, Object> params){
		return request(IndiaChart, params);
	}
	
	public static Map<String, Object> getRelativeChart(Map<String, Object> params){
		return request(RelativeChart, params);
	}
	
	public static Map<String, Object> getGermanyTech(Map<String, Object> params){
		return request(MidPoint, params);
	}
	
	public static Map<String, Object> getJieQiYear(Map<String, Object> params){
		return request(JieQiYear, params);
	}
	
	public static Map<String, Object> getJieQiBirth(Map<String, Object> params){
		return request(JieQiBirth, params);
	}
	
	public static Map<String, Object> getNongliMonth(Map<String, Object> params){
		return request(Nongli, params);
	}
	
	public static String getJdnDate(Map<String, Object> params){
		Map<String, Object> res = requestNoCache(JdnDate, params);
		return (String) res.get("date");
	}
	
	public static Map<String, Object> getAcg(Map<String, Object> params){
		return request(Acg, params);
	}
	
	public static Map<String, Object> getDice(Map<String, Object> params){
		return requestNoCache(Dice, params);
	}
	
	public static Map<String, Object> getAzimuth(Map<String, Object> params){
		return requestNoCache(Azimuth, params);
	}
	
	public static Map<String, Object> getCotrans(Map<String, Object> params){
		return requestNoCache(Cotrans, params);
	}
	
}
