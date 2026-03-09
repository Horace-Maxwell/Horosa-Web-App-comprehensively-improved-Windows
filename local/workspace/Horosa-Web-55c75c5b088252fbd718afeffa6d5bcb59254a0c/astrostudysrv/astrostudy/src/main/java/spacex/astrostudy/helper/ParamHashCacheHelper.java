package spacex.astrostudy.helper;

import java.util.Map;
import java.util.function.Function;

public class ParamHashCacheHelper {

	public static Object get(String key, Map<String, Object> params, Function<Map<String, Object>, Object> fun) {
		return CacheHelper.get(key, params, fun);
	}

	public static Object getAnnual(String key, Map<String, Object> params, Function<Map<String, Object>, Object> fun) {
		return CacheHelper.get(key, params, fun);
	}
}
