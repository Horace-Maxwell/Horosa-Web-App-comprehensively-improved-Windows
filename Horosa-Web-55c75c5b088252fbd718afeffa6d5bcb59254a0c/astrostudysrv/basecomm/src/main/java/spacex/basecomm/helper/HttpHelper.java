package spacex.basecomm.helper;

import java.util.HashMap;
import java.util.Map;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.http.HttpClientUtility;
import boundless.security.SignatureUtility;
import boundless.security.SimpleWebSocketSecUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.utility.CalculatePool;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import spacex.basecomm.constants.ClientApp;
import spacex.basecomm.constants.ClientChannel;
import spacex.basecomm.model.AppInfo;

public class HttpHelper {
	
	private static boolean reqEncrypt = PropertyPlaceholder.getPropertyAsBool("reqencrypt", false);
	private static String webRsaModulus = PropertyPlaceholder.getProperty("webencrypt.rsa.modulus", "");
	private static String webRsaPubExp = PropertyPlaceholder.getProperty("webencrypt.rsa.publicexp", "");

	private static AppInfo appInfo = null;
	
	
		
	public static void setAppInfo(AppInfo info) {
		appInfo = info;
	}
	
	public static AppInfo getAppInfo(){
		return appInfo;
	}
	
	private static void checkRsa() {
		if(StringUtility.isNullOrEmpty(webRsaModulus)) {
			reqEncrypt = PropertyPlaceholder.getPropertyAsBool("reqencrypt", false);
			webRsaModulus = PropertyPlaceholder.getProperty("webencrypt.rsa.modulus", "");
			webRsaPubExp = PropertyPlaceholder.getProperty("webencrypt.rsa.publicexp", "");
		}
	}

	private static String decrypt(String body, Map<String, String> responseHeaders){
		checkRsa();
		try {
			if(StringUtility.isNullOrEmpty(body) ||
					StringUtility.isNullOrEmpty(webRsaModulus) || StringUtility.isNullOrEmpty(webRsaPubExp)) {
				return body;
			}
			String enc = responseHeaders.get("Encrypted");
			if(StringUtility.isNullOrEmpty(enc) || !enc.equals("1")) {
				return body;
			}				
			byte[] raw = SimpleWebSocketSecUtility.decrypt(body, webRsaModulus, webRsaPubExp);
			return new String(raw, "UTF-8");			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	private static String encrypt(String str) {
		checkRsa();
		try {
			if(!reqEncrypt || StringUtility.isNullOrEmpty(str) ||
					StringUtility.isNullOrEmpty(webRsaModulus) || StringUtility.isNullOrEmpty(webRsaPubExp)) {
				return str;
			}
			
			byte[] raw = str.getBytes("UTF-8");
			String encoded = SimpleWebSocketSecUtility.encrypt(raw, webRsaModulus, webRsaPubExp);
			return encoded;			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static String post(String url, String signkey, Map<String, Object> param){
		Map<String, String> headers = new HashMap<String, String>();
		headers.put("ClientChannel", appInfo == null ? "" : appInfo.channel);
		headers.put("ClientApp", appInfo == null ? "" : appInfo.app);
		headers.put("ClientVer", appInfo == null ? "" : appInfo.version);
		
		String hd = String.format("%s%s%s", 
				appInfo == null ? "" : appInfo.channel, appInfo == null ? "" : appInfo.app, appInfo == null ? "" : appInfo.version);
		
		String paramtxt = param == null ? "" : JsonUtility.encode(param);
		String txtdata = String.format("%s%s%s", signkey, hd, paramtxt);
		String signtxt = SignatureUtility.sha256Signature(txtdata);
		headers.put(KeyConstants.Signature, signtxt);
		
		if(CustConfHelper.logDebug("HttpPostLog")) {
			QueueLog.debug(AppLoggers.DebugLogger, "in spacex.basecomm.helper.HttpHelper.httpPost, post data:\n{}\nto {}", paramtxt, url);
		}
		Map<String, String> respheaders = new HashMap<String, String>();
		String str = encrypt(paramtxt);
		String json = HttpClientUtility.uploadString(url, headers, "application/json; charset=UTF-8", str, respheaders);
		json = decrypt(json, respheaders);

		return json;
	}
	
	public static Map<String, Object> httpPost(String url, String signkey, Map<String, Object> param){
		String json = post(url, signkey, param);
		return JsonUtility.toDictionary(json);
	}
	
	public static void transferToTest(String url, String signkey, Map<String, Object> param) {
		Map<String, String> headers = new HashMap<String, String>();
		headers.put("ClientChannel", ClientChannel.ProdSrv.getCode() + "");
		headers.put("ClientApp", ClientApp.BemCloudSrv.getCode() + "");
		headers.put("ClientVer", "1.0");
		
		String hd = String.format("%s%s%s", 
				appInfo == null ? "" : appInfo.channel, appInfo == null ? "" : appInfo.app, appInfo == null ? "" : appInfo.version);
		
		String paramtxt = param == null ? "" : JsonUtility.encode(param);
		String txtdata = String.format("%s%s%s", signkey, hd, paramtxt);
		String signtxt = SignatureUtility.sha256Signature(txtdata);
		headers.put(KeyConstants.Signature, signtxt);
		
		if(CustConfHelper.logDebug("HttpPostLog")) {
			QueueLog.debug(AppLoggers.DebugLogger, "in spacex.basecomm.helper.HttpHelper.httpPost, post data:\n{}\nto {}", paramtxt, url);
		}
		CalculatePool.queueUserWorkItem(()->{
			Map<String, String> respheaders = new HashMap<String, String>();
			String str = encrypt(paramtxt);
			HttpClientUtility.uploadString(url, headers, "application/json; charset=UTF-8", str, respheaders);			
		});
	}
	
}
