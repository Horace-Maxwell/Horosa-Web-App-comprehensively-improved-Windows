package spacex.astrostudy.helper.predict;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import boundless.io.FileUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class PlanetSignPredictHelper {
	private static Map<String, Map<String, Object>> predictMap = new HashMap<String, Map<String, Object>>();
	
	static {
		String json = FileUtility.getStringFromClassPath("spacex/astropredict/planetsign.json");
		Map<String, Object> map = JsonUtility.toDictionary(json);
		for(Entry<String, Object> entry : map.entrySet()) {
			Map<String, Object> val = (Map<String, Object>)entry.getValue();
			predictMap.put(entry.getKey(), val);
		}
	}
	
	private static Map<String, Object> getPredictMap(Map<String, Object> chartMap){
		Map<String, Object> pred = (Map<String, Object>) chartMap.get("predict");
		if(pred == null) {
			pred = new HashMap<String, Object>();
			chartMap.put("predict", pred);
		}
		return pred;
	}
	
	public static void predictPlanetSign(Map<String, Object> chartMap) {
		Map<String, Object> chart = (Map<String, Object>) chartMap.get("chart");
		Map<String, Object> pred = getPredictMap(chartMap);
		Map<String, Object> planetsig = new HashMap<String, Object>();
		pred.put("PlanetSign", planetsig);
		List<Map<String, Object>> objects = (List<Map<String, Object>>)chart.get("objects");
		for(Map<String, Object> obj : objects) {
			String id = (String) obj.get("id");
			String sig = (String) obj.get("sign");
			Map<String, Object> map = predictMap.get(id);
			if(map != null) {
				String desc = (String) map.get(sig);
				String comm = (String) map.get("Common");
				if(!StringUtility.isNullOrEmpty(desc)) {
					List<String> list = new ArrayList<String>();
					list.add(desc);
					if(!StringUtility.isNullOrEmpty(comm)) {
						list.add(comm);
					}
					planetsig.put(id, list);
				}
			}
		}
		
	}
	
}
