package boundless.utility;

import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import boundless.console.ApplicationUtility;

public class ProgArgsHelper {
	private static Map<String, String> argsMap = new HashMap<String, String>();
	
	public static void init(String[] args) {
		for(String arg : args) {
			String[] parts = StringUtility.splitString(arg, '=');
			if(parts.length == 2) {
				String key = parts[0];
				if(key.startsWith("--")) {
					key = key.substring(2);
				}else if(key.startsWith("-")) {
					key = key.substring(1);
				}
				argsMap.put(key, parts[1]);
			}
		}
	}
	
	public static String get(String arg) {
		return argsMap.get(arg);
	}
	
	public static boolean containsArg(String arg) {
		return argsMap.containsKey(arg);
	}
	
	private static String replaceLocalIp(String originalValue) {
		if(StringUtility.isNullOrEmpty(originalValue)){
			return "";
		}
		String orgv = originalValue.trim();
		if(StringUtility.isNullOrEmpty(orgv)){
			return "";
		}
		String[] ips = IPUtility.getLocalIps();
		if(ips == null || ips.length == 0){
			return orgv.replace("$APP_PATH", ApplicationUtility.getAppPath());
		}
		String localip = ips[0];
		String resstr = orgv.replace("$127.0.0.1", localip).replace("$LOCALHOST", localip)
				.replace("$APP_PATH", ApplicationUtility.getAppPath());
		return resstr;
	}
	
	public static void convertProperties(Properties p, String prefix) {
		Map<String, String> env = System.getenv();
		Enumeration<?> propertyNames = p.propertyNames();
		while (propertyNames.hasMoreElements()){
			String key = (String) propertyNames.nextElement();
			Object obj = p.get(key);
			String val = "";
			if(obj instanceof String) {
				val = (String)obj;
			}else {
				continue;
			}

			String k = key;
			if(prefix != null) {
				k = prefix + key;
			}
			if(ProgArgsHelper.containsArg(k)) {
				val = ProgArgsHelper.get(k);
			}else if(env.containsKey(k)) {
				val = env.get(k);
			}
			while(val != null && val.contains("${")) {
				int idx = val.indexOf("${");
				int idx2 = val.indexOf('}', idx);
				String repkey = val.substring(idx + 2, idx2);
				String repval = p.getProperty(repkey);
				if(ProgArgsHelper.containsArg(repkey)) {
					repval = ProgArgsHelper.get(repkey);
				}
				String first = "";
				if(idx > 0) {
					first = val.substring(0, idx);
				}
				
				String end = "";
				if(idx2 < val.length()-1) {
					end = val.substring(idx2 + 1);
				}
				val = first + repval + end;
			}
			val = replaceLocalIp(val);
			p.put(key, val);
		}		
	}
	
	public static void convertProperties(Properties p){
		convertProperties(p, null);
	}
}
