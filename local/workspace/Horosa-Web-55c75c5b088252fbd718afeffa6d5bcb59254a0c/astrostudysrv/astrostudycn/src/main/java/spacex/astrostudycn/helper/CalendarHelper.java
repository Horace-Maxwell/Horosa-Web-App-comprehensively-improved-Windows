package spacex.astrostudycn.helper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.utility.DateTimeUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.helper.JdnHelper;
import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudy.model.NongLi;

public class CalendarHelper {
	
	
	public static Map<String, Object> getMonthDays(String date, String zone, int ad, String lon, String lat) {
		date = date.replace('/', '-');
		// [Q-270/T-263] 公元前日期串自带负号('-2026-09-01'):按 '-' 切分首段为空 → 拼出 '--2026';先剥符号再按 ad 补回。
		boolean negative = date.startsWith("-");
		if(negative) {
			date = date.substring(1);
		}
		String[] parts = StringUtility.splitString(date, '-');
		if(ad < 0 || negative) {
			parts[0] = "-" + parts[0];
		}
		
		String firstdt = String.format("%s-%s-01 12:00:00", parts[0], parts[1]);
		double jdn = DateTimeUtility.getDateNum(firstdt, zone);
		List<String> births = new ArrayList<String>(38);
		for(int i=0; i<38; i++) {
			double tmpjdn = jdn + i;
			String dtstr = JdnHelper.getDateFromJdn(tmpjdn, zone);
			births.add(dtstr);
		}
		List<NongLi> list = NongliHelper.getNongLiSeries(ad, births, zone, lon, false, false);
		List<String> prevBirths = new ArrayList<String>(7);
		for(int i=1; i<7; i++) {
			double tmpjdn = jdn - i;
			String dtstr = JdnHelper.getDateFromJdn(tmpjdn, zone);
			prevBirths.add(dtstr);
		}
		List<NongLi> prev7 = NongliHelper.getNongLiSeries(ad, prevBirths, zone, lon, false, false);
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("days", list);
		map.put("prevDays", prev7);
		return map;
	}
	
	public static void main(String[] args) {
		String lon = "119e29";
		String lat = "0n0";
		String date = "2019-08-07 12:00:00";
		String zone = "+08:00";
		int ad = 1;
		date = "1500-02-01 12:00:00";
		date = "1900-02-01 12:00:00";
		if(date.indexOf('-') == 0) {
			ad = -1;
		}
		
		Map<String, Object> res = getMonthDays(date, zone, ad, lon, lat);
		String json = JsonUtility.encodePretty(res);
		System.out.println(json);
	}
	
}
