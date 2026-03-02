package spacex.astrostudy.helper;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.security.RSAUtility;
import boundless.security.SecurityUtility;
import boundless.spring.help.interceptor.RsaParam;
import boundless.types.ICache;
import boundless.types.cache.CacheFactory;
import boundless.types.cache.FilterCond;
import boundless.types.cache.SortCond;
import boundless.types.cache.FilterCond.CondOperator;
import boundless.types.cache.SortCond.SortType;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import boundless.utility.StringUtility;

public class ClientAppHelper {
	private static ICache cache = CacheFactory.getCache("clientapps");


	public static void updateClientApp(String id, Map<String, Object> map) {
		Date dt = new Date();
		map.put("time", dt.getTime());
		map.put("timeStr", FormatUtility.formatDateTime(dt, "yyyy-MM-dd HH:mm:ss"));
		cache.setMap(id, map);
	}
	
	public static Map<String, Object> genClientApp(String id){
		RsaParam rsa = RSAUtility.genRsaParam();
		String sigkey = SecurityUtility.createSecureKey(6);
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("app", id);
		map.put("sigkey", sigkey);
		map.put("modulus", rsa.modulus);
		map.put("privexp", rsa.privexp);
		map.put("pubexp", rsa.pubexp);
		map.put("reqencrypt", rsa.reqencrypt);
		map.put("rspencrypt", rsa.rspencrypt);
		
		return map;
	}
	
	public static Map<String, Object> getApp(String id){
		FilterCond nameCond = new FilterCond("app", CondOperator.Eq, id);
		List<Map<String, Object>> res = cache.findValues(nameCond);
		if(res.isEmpty()) {
			return null;
		}
		return res.get(0);
	}

	public static List<Map<String, Object>> getClientApps(String id){
		List<FilterCond> conds = new ArrayList<FilterCond>();
		if(!StringUtility.isNullOrEmpty(id)) {
			FilterCond nameCond = new FilterCond("app", CondOperator.Like, id);
			conds.add(nameCond);
		}
		FilterCond[] condary = new FilterCond[conds.size()];
		conds.toArray(condary);
		SortCond sort = new SortCond("time", SortType.Desc);
		List<Map<String, Object>> res = cache.findValues(sort, condary);
		return res;
	}
	
	public static RsaParam getAppRsaParam(String id) {
		Map<String, Object> map = getApp(id);
		if(map == null) {
			return null;
		}
		
		RsaParam rsa = new RsaParam();
		rsa.modulus = (String) map.get("modulus");
		rsa.privexp = (String) map.get("privexp");
		rsa.pubexp = (String) map.get("pubexp");
		boolean encrypt = !StringUtility.isNullOrEmpty(rsa.modulus);
		rsa.reqencrypt = ConvertUtility.getValueAsBool(map.get("reqencrypt"), encrypt);
		rsa.rspencrypt = ConvertUtility.getValueAsBool(map.get("rspencrypt"), encrypt);
		
		return rsa;
	}
	
	public static String getAppSigKey(String id) {
		Map<String, Object> map = getApp(id);
		if(map == null) {
			return null;
		}

		return (String) map.get("sigkey");
	}
	
	public static void delete(String id) {
		cache.remove(id);
	}
	
	public static Map<String, Object> genSigKey(String id) {
		Map<String, Object> map = getApp(id);
		if(map == null) {
			return null;
		}
		
		String sigkey = SecurityUtility.createSecureKey(6);
		map.put("sigkey", sigkey);
		
		updateClientApp(id, map);
		
		map.remove("privexp");
		return map;
	}
	
	public static Map<String, Object> genRsaParam(String id) {
		Map<String, Object> map = getApp(id);
		if(map == null) {
			return null;
		}
		
		RsaParam rsa = RSAUtility.genRsaParam();
		map.put("modulus", rsa.modulus);
		map.put("privexp", rsa.privexp);
		map.put("pubexp", rsa.pubexp);
		map.put("reqencrypt", rsa.reqencrypt);
		map.put("rspencrypt", rsa.rspencrypt);
		
		updateClientApp(id, map);
		
		map.remove("privexp");
		return map;
	}
	
}
