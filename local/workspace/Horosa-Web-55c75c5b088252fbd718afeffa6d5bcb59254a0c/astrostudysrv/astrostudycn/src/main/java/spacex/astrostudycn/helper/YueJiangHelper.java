package spacex.astrostudycn.helper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.types.Tuple;
import boundless.utility.JsonUtility;
import spacex.astrostudycn.constants.YueJiangType;

public class YueJiangHelper {
	private static final Map<String, Tuple<String, String>> jieYuejiang = new HashMap<String, Tuple<String, String>>();
	private static final Map<String, Tuple<String, String>> qiYuejiang = new HashMap<String, Tuple<String, String>>();

	static {
		String jsonstr = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/yuejiang.json");
		Map<String, Object> json = JsonUtility.toDictionary(jsonstr);
		Map<String, Object> jie = (Map<String, Object>) json.get("jie");
		Map<String, Object> qi = (Map<String, Object>) json.get("qi");
		
		for(Map.Entry<String, Object> entry : jie.entrySet()) {
			List<String> jiang = (List<String>)entry.getValue();
			Tuple<String, String> tuple = new Tuple<String, String>(jiang.get(0), jiang.get(1));
			jieYuejiang.put(entry.getKey(), tuple);
		}
		
		for(Map.Entry<String, Object> entry : qi.entrySet()) {
			List<String> jiang = (List<String>)entry.getValue();
			Tuple<String, String> tuple = new Tuple<String, String>(jiang.get(0), jiang.get(1));
			qiYuejiang.put(entry.getKey(), tuple);
		}
		
	}
	
	public static Tuple<String, String> getQiYueJiang(String jieqi){
		return qiYuejiang.get(jieqi);
	}
	
	public static Tuple<String, String> getJieYueJiang(String jieqi){
		return jieYuejiang.get(jieqi);
	}
	
	public static Tuple<String, String> getYueJiang(YueJiangType type, String jieqi){
		if(type == YueJiangType.Qi) {
			return qiYuejiang.get(jieqi);
		}
		return jieYuejiang.get(jieqi);
	}
	
}
