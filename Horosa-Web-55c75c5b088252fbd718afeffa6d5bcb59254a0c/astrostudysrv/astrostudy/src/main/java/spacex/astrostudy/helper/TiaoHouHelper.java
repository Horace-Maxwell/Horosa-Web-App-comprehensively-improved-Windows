package spacex.astrostudy.helper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.JsonUtility;

public class TiaoHouHelper {
	private static Map<String, Map<String, List<String>>> tiaohou = new HashMap<String, Map<String, List<String>>>();
	
	static {
		try {
			String json = FileUtility.getStringFromClassPath("spacex/astrostudy/helper/tiaohou.json");
			Map<String, Object> map = JsonUtility.toDictionary(json);
			for(Map.Entry<String, Object> entry : map.entrySet()) {
				String key = entry.getKey();
				Map<String, List<String>> val = (Map<String, List<String>>) entry.getValue();
				tiaohou.put(key, val);
			}
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
	
	public static List<String> getTiaoHou(String monthZi, String dayGan){
		Map<String, List<String>> map = tiaohou.get(dayGan);
		return map.get(monthZi);
	}
	
}
