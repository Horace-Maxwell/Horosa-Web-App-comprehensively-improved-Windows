package spacex.astrostudycn.helper;

import java.util.HashMap;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.FiveElement;

public class SeasonHelper {
	private static final Map<String, String> season = new HashMap<String, String>();
	
	static {
		String jsonstr = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/season.json");
		Map<String, Object> json = JsonUtility.toDictionary(jsonstr);
		for(Map.Entry<String, Object> entry : json.entrySet()) {
			season.put(entry.getKey(), entry.getValue().toString());
		}
	}
	
	public static String getState(FiveElement fvelem, String zi) {
		String key = String.format("%s_%s", fvelem.toString(), zi);
		return season.get(key);
	}
	
	public static Map<String, Object> getState(String zi){
		Map<String, Object> map = new HashMap<String, Object>();
		for(FiveElement fv : FiveElement.values()) {
			String key = fv.toString();
			String val = getState(fv, zi);
			map.put(key, val);
		}
		return map;
	}
	
}
