package spacex.astrostudycn.helper;

import java.util.HashMap;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.utility.JsonUtility;

public class ZWRulesHelper {

	private static Map<String, Object> rules = new HashMap<String, Object>();
	
	
	static {
		String zwrulesjson = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/zwrules.json");
		String zwrulesihuajson = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/zwrulesihua.json");
		Map<String, Object> zwrules = JsonUtility.toDictionary(zwrulesjson);
		Map<String, Object> zwrulesihua = JsonUtility.toDictionary(zwrulesihuajson);
		rules.put("ZWRules", zwrules);
		rules.put("ZWRuleSihua", zwrulesihua);
		
	}
	
	public static Map<String, Object> getRules(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.putAll(rules);
		return map;
	}
	
	public static void main(String[] args) {
		System.out.println(rules);
	}

}
