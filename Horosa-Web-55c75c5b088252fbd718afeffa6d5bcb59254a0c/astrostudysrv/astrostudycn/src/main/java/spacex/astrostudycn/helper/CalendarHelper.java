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
		String[] parts = StringUtility.splitString(date, '-');
		if(ad < 0) {
			parts[0] = "-" + parts[0];
		}
		
		String firstdt = String.format("%s-%s-01 12:00:00", parts[0], parts[1]);
		double jdn = DateTimeUtility.getDateNum(firstdt, zone);
		List<NongLi> list = new ArrayList<NongLi>(38);
		for(int i=0; i<38; i++) {
			double tmpjdn = jdn + i;
			String dtstr = JdnHelper.getDateFromJdn(tmpjdn, zone);
			NongLi tm = NongliHelper.getNongLi(ad, dtstr, zone, lon, false);
			list.add(tm);
		}
		List<NongLi> prev7 = new ArrayList<NongLi>(7);
		for(int i=1; i<7; i++) {
			double tmpjdn = jdn - i;
			String dtstr = JdnHelper.getDateFromJdn(tmpjdn, zone);
			NongLi tm = NongliHelper.getNongLi(ad, dtstr, zone, lon, false);
			prev7.add(tm);
		}
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
