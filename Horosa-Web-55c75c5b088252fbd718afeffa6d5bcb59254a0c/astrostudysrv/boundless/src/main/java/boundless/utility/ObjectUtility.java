package boundless.utility;

import java.util.Map;

public class ObjectUtility {
	
	public static Map<String, Object> toMap(Object obj){
		String json = JsonUtility.encode(obj);
		
		return JsonUtility.toDictionary(json);
	}
	
	public static Object copy(Object obj){
		Class clazz = obj.getClass();
		String json = JsonUtility.encode(obj);
		return JsonUtility.decode(json, clazz);
	}
	
}
