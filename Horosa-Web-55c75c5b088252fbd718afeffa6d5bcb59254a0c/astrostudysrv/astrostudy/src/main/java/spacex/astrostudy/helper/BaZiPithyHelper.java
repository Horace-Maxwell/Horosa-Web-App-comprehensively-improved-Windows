package spacex.astrostudy.helper;

import java.util.Map;

import boundless.io.FileUtility;
import boundless.utility.JsonUtility;

public class BaZiPithyHelper {
	private static Map<String, Object> pithy = null;
	
	static {
		String jsonstr = FileUtility.getStringFromClassPath("spacex/astrostudy/helper/bazipithy.json");
		pithy = JsonUtility.toDictionary(jsonstr);

	}

	public static Map<String, Object> getPithy(){
		return pithy;
	}
	
}
