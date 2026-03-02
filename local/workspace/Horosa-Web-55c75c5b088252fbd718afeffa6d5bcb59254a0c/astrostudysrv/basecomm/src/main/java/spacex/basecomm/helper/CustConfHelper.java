package spacex.basecomm.helper;

import java.util.Map;

import boundless.io.FileUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class CustConfHelper {
	private static Map<String, Object> custconfig = null;
	
	public static Map<String, Object> getCustConfig() {
		if(custconfig != null) {
			return custconfig;
		}
		String custpath = (String) PropertyPlaceholder.getProperty("configfile.path");
		if(StringUtility.isNullOrEmpty(custpath) || !FileUtility.exists(custpath)) {
			return null;
		}
		String json = FileUtility.getStringFromPath(custpath);
		custconfig = JsonUtility.toDictionary(json);
		return custconfig;
	}
	
	public static boolean logDebug(String key) {
		boolean logDebug = PropertyPlaceholder.getPropertyAsBool(key, false);
		Map<String, Object> map = getCustConfig();
		if(map == null) {
			return logDebug;
		}
		return ConvertUtility.getValueAsBool(map.get(key), false);
	}
	

}
