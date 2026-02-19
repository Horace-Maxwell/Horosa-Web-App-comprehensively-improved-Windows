package spacex.astrostudy.helper;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.io.FileUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;

public class ReqCheckRsaHelper {
	private static Map<String, Object> map;
	private static Set<String> apps = new HashSet<String>();
	
	static {
		String json = FileUtility.getStringFromClassPath("data/needrsa.json");
		map = JsonUtility.toDictionary(json);
		List<String> list = (List<String>) map.get("apps");
		apps.addAll(list);
	}

	private static Object getData(Map<String, Object> map, String key){
		Object obj = map.get(key);
		if(obj == null){
			obj = map.get(key.toLowerCase());
		}
		return obj;
	}

	public static boolean checkRSA(Map<String, Object> header) {
		String channel = ConvertUtility.getValueAsString(getData(header, "ClientChannel"));
		String app = ConvertUtility.getValueAsString(getData(header, "ClientApp"));
		String ver = ConvertUtility.getValueAsString(getData(header, "ClientVer"));
		
		if(apps.contains(app)) {
			return true;
		}

		return false;
	}

}
