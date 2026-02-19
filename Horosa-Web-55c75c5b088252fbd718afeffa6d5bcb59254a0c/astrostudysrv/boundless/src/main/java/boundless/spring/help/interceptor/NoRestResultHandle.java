package boundless.spring.help.interceptor;

import java.util.HashMap;
import java.util.Map;

public class NoRestResultHandle {

	public static Map<String, Object> getResultMap(Object result) {
		Map<String, Object> map = new HashMap<String, Object>();
		
		map.put("code", 0);
		map.put("msg", "ok");
		map.put("info", null);
		map.put("err", null);
		map.put("result", result);
		
		return map;
	}
}
