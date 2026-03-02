package spacex.astrostudy.helper;

import java.util.HashMap;
import java.util.Map;


import boundless.io.FileUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.spring.help.interceptor.RsaParam;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class RsaParamHelper {
	private static final boolean reqEncrypt = PropertyPlaceholder.getPropertyAsBool("reqencrypt", false);
	private static final boolean rspEncrypt = PropertyPlaceholder.getPropertyAsBool("rspencrypt", false);
	private static final boolean forceTimeout = PropertyPlaceholder.getPropertyAsBool("webencrypt.forcetimeout", false);
	private static final String webRsaModulus = PropertyPlaceholder.getProperty("webencrypt.rsa.modulus", "");
	private static final String webRsaPrivExp = PropertyPlaceholder.getProperty("webencrypt.rsa.privateexp", "");
	private static Map<String, Map<String, Object>> rsaKeys = new HashMap<String, Map<String, Object>>();

	static {
		String rsakeyjson = FileUtility.getStringFromClassPath("data/rsakey.json");
		Map<String, Object> keys = JsonUtility.toDictionary(rsakeyjson);
		rsaKeys = (Map<String, Map<String, Object>>) keys.get("app");
	}

	private static Object getData(Map<String, Object> map, String key){
		Object obj = map.get(key);
		if(obj == null){
			obj = map.get(key.toLowerCase());
		}
		return obj;
	}
	
	public static RsaParam getRsaParam(Map<String, Object> header) {
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		RsaParam rsaparam = new RsaParam();
		Map<String, Object> rsa =  rsaKeys.get(app);
		if(rsa != null) {
			rsaparam.modulus = (String)rsa.get("modulus");
			rsaparam.privexp = (String)rsa.get("privateexp");
			rsaparam.pubexp = (String)rsa.get("publicexp");
			rsaparam.reqencrypt = ConvertUtility.getValueAsBool(rsa.get("reqencrypt"), reqEncrypt);
			rsaparam.rspencrypt = ConvertUtility.getValueAsBool(rsa.get("rspencrypt"), rspEncrypt);
		}else {
			rsaparam = ClientAppHelper.getAppRsaParam(app);
			if(rsaparam == null) {
				rsaparam = new RsaParam();
			}
		}
		
		if(StringUtility.isNullOrEmpty(rsaparam.modulus)) {
			rsaparam.modulus = webRsaModulus;
		}
		if(StringUtility.isNullOrEmpty(rsaparam.privexp)) {
			rsaparam.privexp = webRsaPrivExp;
		}
		if(StringUtility.isNullOrEmpty(rsaparam.pubexp)) {
			rsaparam.pubexp = "10001";
		}
		if(rsaparam.reqencrypt == null) {
			rsaparam.reqencrypt = reqEncrypt;
		}
		if(rsaparam.rspencrypt == null) {
			rsaparam.rspencrypt = rspEncrypt;
		}
		
		header.put(KeyConstants.RsaParam, rsaparam);
		return rsaparam;
	}
	

}
