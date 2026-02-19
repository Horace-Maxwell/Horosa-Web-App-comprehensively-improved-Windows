package spacex.astrostudycn.helper;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.types.ICache;
import boundless.types.cache.CacheFactory;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.helper.BaZiHelper;
import spacex.astrostudy.model.FourColumns;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.BaziPattern;
import spacex.astrostudycn.model.BaZi;
import spacex.astrostudycn.model.BaZiDirect;

public class BaZiPredictHelper {
	private static ICache bzCache = CacheFactory.getCache("bazi");
	
	private static List<Map> attrs = null;
	
	static {
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/bazipred.json");
		attrs = JsonUtility.decodeList(json, Map.class);
	}
	
	private static String getKey(BaZiGender gender, String year, String month, String date, String time) {
		BaZiHelper.validate(year, month, date, time);

		String genderstr = gender.toSimpleString();
		String key = String.format("%s%s%s%s%s", genderstr, year, month, date, time);
		return key;
	}
	
	public static List<Map> getAttributes(){
		List<Map> list = new ArrayList<Map>(attrs.size());
		list.addAll(attrs);
		return list;
	}
	
	public static Map<String, Object> get(BaZiGender gender, String year, String month, String date, String time) {
		String genderstr = gender.toSimpleString();
		String key = getKey(gender, year, month, date, time);
		
		Map<String, Object> map = null;
		if(bzCache != null) {
			map = bzCache.getMap(key);
		}
		if(map == null) {
			map = new HashMap<String, Object>();
			map.put("year", year);
			map.put("month", month);
			map.put("date", date);
			map.put("time", time);
			map.put("性别", genderstr);
			map.put("描述", null);  // 基本描述
			map.put("格局", null); // 格局简要说明
			map.put("格局码", BaziPattern.Unknown.getCode());
			map.put("格局成立", -1);
			map.put("格局级别", -1);
			
			for(Map entry : attrs) {
				String attr = (String)entry.get("key");
				map.put(attr, -1);
			}

			Date now = new Date();
			String tmstr = FormatUtility.formatDateTime(now, "yyyy-MM-dd HH:mm:ss");
			map.put("tm", now.getTime());
			map.put("tmStr", tmstr);

			if(bzCache != null) {
				bzCache.setMap(key, map);					
			}
		}
		
		return map;
	}
	
	public static void save(BaZi bazi, BaZiGender gender) {
		FourColumns cols = bazi.getFourColums();
		String year = cols.year.ganzi;
		String month = cols.month.ganzi;
		String day = cols.day.toString();
		String time = cols.time.toString();
		
		get(gender, year, month, day, time);
	}
	
	public static void save(BaZiDirect bazi) {
		save(bazi, bazi.getGender());
	}
	
	public static Map<String, Object> save(BaZiGender gender, String year, String month, String date, String time, String pattern, BaziPattern bzpattern, int patternSucess, int level) {
		String key = getKey(gender, year, month, date, time);
		Map<String, Object> map = get(gender, year, month, date, time);

		map.put("格局", pattern);
		map.put("格局码", bzpattern.getCode());
		map.put("格局成立", patternSucess);
		map.put("格局级别", level);
		
		Date now = new Date();
		String tmstr = FormatUtility.formatDateTime(now, "yyyy-MM-dd HH:mm:ss");
		map.put("tm", now.getTime());
		map.put("tmStr", tmstr);
		
		bzCache.setMap(key, map);	
		
		return map;
	}
	
	public static Map<String, Object>[] save(String year, String month, String date, String time, String pattern, BaziPattern bzpattern, int patternSucess, int level){
		Map<String, Object> malemap = save(BaZiGender.Male, year, month, date, time, pattern, bzpattern, patternSucess, level);
		Map<String, Object> femalemap = save(BaZiGender.Female, year, month, date, time, pattern, bzpattern, patternSucess, level);
		Map<String, Object>[] res = new Map[] {femalemap, malemap};
		return res;
	}
	
	public static void save(BaZiGender gender, String year, String month, String date, String time, Map<String, Object> data){
		Map<String, Object> map = get(gender, year, month, date, time);
		Map<String, Object> tmpmap = new HashMap<String, Object>();
		for(Map.Entry<String, Object> entry : map.entrySet()) {
			String key = entry.getKey();
			Object val = entry.getValue();
			if(!StringUtility.isNullOrEmpty(val)) {
				if(val instanceof String) {
					tmpmap.put(key, val);
				}else {
					int n = ConvertUtility.getValueAsInt(val, -1);
					if(n != -1) {
						tmpmap.put(key, val);
					}					
				}
			}
		}
		map.putAll(tmpmap);
		
		Date now = new Date();
		String tmstr = FormatUtility.formatDateTime(now, "yyyy-MM-dd HH:mm:ss");
		map.put("tm", now.getTime());
		map.put("tmStr", tmstr);

		String key = getKey(gender, year, month, date, time);
		bzCache.setMap(key, map);
	}
	
	public static void save(String year, String month, String date, String time, Map<String, Object> data) {
		save(BaZiGender.Male, year, month, date, time, data);
		save(BaZiGender.Female, year, month, date, time, data);
	}
	
	public static void save(Map<String, Object> data) {
		String year = (String) data.get("year");
		String month = (String) data.get("month");
		String date = (String) data.get("date");
		String time = (String) data.get("time");
		if(data.containsKey("性别")) {
			int code = ConvertUtility.getValueAsInt(data.get("性别"), 1);
			BaZiGender gender = BaZiGender.fromCode(code);
			save(gender, year, month, date, time, data);
		}else {
			save(year, month, date, time, data);
		}
	}
	
	public static Map<String, Object>[] getPattern(String year, String month, String date, String time){
		Map<String, Object> malemap = get(BaZiGender.Male, year, month, date, time);
		Map<String, Object> femalemap = get(BaZiGender.Female, year, month, date, time);
		Map<String, Object>[] res = new Map[] {femalemap, malemap};
		return res;
	}
	
}
