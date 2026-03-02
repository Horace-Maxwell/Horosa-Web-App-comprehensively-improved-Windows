package spacex.astrostudy.helper;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import boundless.exception.SignatureException;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.SignatureUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class ReqSignHelper {
	private static final String NoSigCheck = "nosigchk";
	
	private static final String DefSignatureKey = PropertyPlaceholder.getProperty("signature.sha256key", "6928FB6E2928");
	
	private static Map<String, Object> SignatureKeyMap = null;
	
	private static Set<String> excludeCheckSig = null;
	
	
	private static Object getData(Map<String, Object> map, String key){
		Object obj = map.get(key);
		if(obj == null){
			obj = map.get(key.toLowerCase());
		}
		return obj;
	}
		
	public static boolean checkSignature(Map<String, Object> header, String body) {
		if(excludeCheckSig == null) {
			try {
				String json = FileUtility.getStringFromClassPath("data/excludechksig.json");
				excludeCheckSig = JsonUtility.decodeSet(json, String.class);
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}			
		}
		if(SignatureKeyMap == null) {
			try {
				String json = FileUtility.getStringFromClassPath("data/sigkey.json");
				SignatureKeyMap = JsonUtility.toDictionary(json);
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		if(excludeCheckSig != null) {
			String trans = (String) header.get("_TransCode_");
			if(trans != null && excludeCheckSig.contains(trans)) {
				return true;
			}
		}
		
		String channel = ConvertUtility.getValueAsString(getData(header, "ClientChannel"));
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		String ver = ConvertUtility.getValueAsString(getData(header, "ClientVer"));
		String hd = String.format("%s%s%s", channel, app, ver);
		
		String SignatureKey = null;
		if(SignatureKeyMap != null) {
			Map<String, Object> appKeyMap = (Map<String, Object>) SignatureKeyMap.get("app");
			SignatureKey = (String) appKeyMap.get(app);
			if(StringUtility.isNullOrEmpty(SignatureKey)) {
				SignatureKey = ClientAppHelper.getAppSigKey(app);
			}else if(SignatureKey.equalsIgnoreCase(NoSigCheck)) {
				return true;
			}
		}
		if(StringUtility.isNullOrEmpty(SignatureKey)) {
			SignatureKey = DefSignatureKey;
		}
		
		String token = (String)getData(header, KeyConstants.Token);
		String signText = (String)getData(header, KeyConstants.Signature);
		if(StringUtility.isNullOrEmpty(signText) || signText.equalsIgnoreCase("null")){
			throw new SignatureException("signature.error");
		}
		
		String txt = body == null ? "" : body;
		String tk = token;
		if(tk == null || tk.equalsIgnoreCase("null")){
			tk = "";
		}
		String str = String.format("%s%s%s%s", tk, SignatureKey, hd, txt);
		
		return SignatureUtility.checkSha256Signature(str, signText);
	}

}
