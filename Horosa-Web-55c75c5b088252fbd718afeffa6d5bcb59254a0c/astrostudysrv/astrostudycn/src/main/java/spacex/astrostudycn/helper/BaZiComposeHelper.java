package spacex.astrostudycn.helper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.utility.JsonUtility;

public class BaZiComposeHelper {
	private static Map<String, String[]> monthMap = new HashMap<String, String[]>();
	private static Map<String, String[]> timeMap = new HashMap<String, String[]>();
	private static String[] sixty = new String[60];
	
	static {
		String jsonstr = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/bazicompose.json");
		Map<String, Object> compose = JsonUtility.toDictionary(jsonstr);
		List<String> sixtylist = (List<String>) compose.get("sixty");
		sixtylist.toArray(sixty);
		
		Map<String, Object> month = (Map<String, Object>) compose.get("month");
		Map<String, Object> time = (Map<String, Object>) compose.get("time");
		
		for(Map.Entry<String, Object> entry : month.entrySet()) {
			List<String> list = (List<String>) entry.getValue();
			String[] val = new String[12];
			list.toArray(val);
			monthMap.put(entry.getKey(), val);
		}
		
		for(Map.Entry<String, Object> entry : time.entrySet()) {
			List<String> list = (List<String>) entry.getValue();
			String[] val = new String[13];
			list.toArray(val);
			timeMap.put(entry.getKey(), val);
		}
		
	}
	
	public static String getMonth(String year, int monthIdx) {
		if(monthIdx < 0 || monthIdx > 11) {
			throw new RuntimeException("monthidx.must.in.[0, 11]");
		}
		String ygan = year.substring(0, 1);
		String[] mlist = monthMap.get(ygan);
		return mlist[monthIdx];
	}
	
	public static String getTime(String day, int timeIdx) {
		if(timeIdx < 0 || timeIdx > 12) {
			throw new RuntimeException("timeidx.must.in.[0, 12]");
		}
		String dgan = day.substring(0, 1);
		String[] tlist = timeMap.get(dgan);
		return tlist[timeIdx];
	}
	
	public static void genAllBaZi() {
		int cnt = 0;
		for(String year : sixty) {
			String ygan = year.substring(0, 1);
			String[] mlist = monthMap.get(ygan);
			for(String month : mlist) {
				for(String day : sixty) {
					String dgan = day.substring(0, 1);
					String[] tlist = timeMap.get(dgan);
					for(String time : tlist) {
						cnt++;
						String bz = String.format("%s %s %s %s", year, month, day, time);
						System.out.println(bz);
					}
				}
			}
		}
		System.out.println(String.format("total count: %d", cnt));
	}
	
	public static void main(String[] args) {
		long ms0 = System.currentTimeMillis();
		genAllBaZi();
		long ms1 = System.currentTimeMillis();
		System.out.println(String.format("finish in %d ms", ms1 - ms0));
	}
	
}
