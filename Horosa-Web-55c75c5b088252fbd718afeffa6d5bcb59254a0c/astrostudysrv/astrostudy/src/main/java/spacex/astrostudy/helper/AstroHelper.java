package spacex.astrostudy.helper;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

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

	public static final String AstroSrvUrl = PropertyPlaceholder.getProperty("astrosrv", "http://127.0.0.1:8899");
	public static final String SolarReturn = PropertyPlaceholder.getProperty("solarreturn", "/predict/solarreturn");
	public static final String LunarReturn = PropertyPlaceholder.getProperty("lunarreturn", "/predict/lunarreturn");
	public static final String GivenYear = PropertyPlaceholder.getProperty("givenyear", "/predict/givenyear");
	public static final String SolarArc = PropertyPlaceholder.getProperty("solararc", "/predict/solararc");
	public static final String Profection = PropertyPlaceholder.getProperty("profection", "/predict/profection");
	public static final String PrimaryDirection = PropertyPlaceholder.getProperty("pd", "/predict/pd");
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
	
	private static String getPredictiveKey(String path, Map<String, Object> params) {
		StringBuilder sb = new StringBuilder(path);
		sb.append("_");
		for(Object obj : params.values()) {
			if(obj instanceof Collection) {
				String str = StringUtility.joinWithSeperator(",", obj);
				sb.append(str);
			}if(obj instanceof Map) {
				String str = JsonUtility.encode(obj);
				sb.append(str);
			}else {
				if(obj == null) {
					sb.append("null");
				}else {
					sb.append(obj.toString());					
				}
			}
		}
		String txt = sb.toString();
		return MD5Utility.encryptAsString(txt);
	}
	
	private static Map<String, Object> request(String path, Map<String, Object> params){
		if(Debug) {
			return requestNoCache(path, params);
		}
		String key = getPredictiveKey(path, params);
		Map<String, Object> res = AstroCacheHelper.getPredictive(key);
		if(res != null) {
			return res;
		}
		
		String url = String.format("%s%s", AstroSrvUrl, path);
		String jsonData = JsonUtility.encode(params);
		Map<String, String> headers = new HashMap<String, String>();
		Map<String, String> respHeadMap = new HashMap<String, String>();
		String str = HttpClientUtility.uploadString(url, headers, "application/json; charset=UTF-8", jsonData, respHeadMap);
		Map<String, Object> jsonres = JsonUtility.toDictionary(str);
		if(jsonres.containsKey("err")) {
			throw new ErrorCodeException(200001, jsonres.get("err").toString());
		}
		
		CalculatePool.queueUserWorkItem(()->{
			AstroCacheHelper.setPredictive(key, jsonres);
		});
		
		return jsonres;		
	}
	
	public static Map<String, Object> requestNoCache(String path, Map<String, Object> params){
		String url = String.format("%s%s", AstroSrvUrl, path);
		String jsonData = JsonUtility.encode(params);
		Map<String, String> headers = new HashMap<String, String>();
		Map<String, String> respHeadMap = new HashMap<String, String>();
		String str = HttpClientUtility.uploadString(url, headers, "application/json; charset=UTF-8", jsonData, respHeadMap);
		Map<String, Object> jsonres = JsonUtility.toDictionary(str);
		if(jsonres.containsKey("err")) {
			throw new ErrorCodeException(200001, jsonres.get("err").toString());
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
