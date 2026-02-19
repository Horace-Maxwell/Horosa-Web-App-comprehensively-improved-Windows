package spacex.astrostudy.helper;

import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.Tuple;
import boundless.utility.ConvertUtility;
import boundless.utility.DateTimeUtility;
import boundless.utility.JsonUtility;
import boundless.utility.PositionUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.constants.FiveElement;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.model.NongLi;
import spacex.astrostudy.model.RealSunTimeOffset;
import spacex.astrostudy.helper.BaZiHelper;
import spacex.astrostudy.helper.JdnHelper.RealDate;

public class NongliHelper {
	private static Map<String, String> lonMap = new HashMap<String, String>();
	private static Map<Integer, String> monthMap = new HashMap<Integer, String>();
	private static Map<Integer, String> dayMap = new HashMap<Integer, String>();
	private static Map<String, Integer> NongliMonth = new HashMap<String, Integer>();
	private static Map<String, Tuple<String, Integer>[]> jieqiChefMap = new HashMap<String, Tuple<String, Integer>[]>();
	

	static {
		lonMap.put("+00:00", "0e00");
		lonMap.put("+01:00", "15e00");
		lonMap.put("+02:00", "30e00");
		lonMap.put("+03:00", "45e00");
		lonMap.put("+04:00", "60e00");
		lonMap.put("+04:30", "67e30");
		lonMap.put("+05:00", "75e00");
		lonMap.put("+05:30", "82e30");
		lonMap.put("+06:00", "90e00");
		lonMap.put("+07:00", "105e00");
		lonMap.put("+08:00", "120e00");
		lonMap.put("+09:00", "135e00");
		lonMap.put("+10:00", "150e00");
		lonMap.put("+11:00", "165e00");
		lonMap.put("+12:00", "180e00");
		lonMap.put("-01:00", "15w00");
		lonMap.put("-02:00", "30w00");
		lonMap.put("-03:00", "45w00");
		lonMap.put("-04:00", "60w00");
		lonMap.put("-05:00", "75w00");
		lonMap.put("-05:30", "75w00");
		lonMap.put("-06:00", "90w00");
		lonMap.put("-07:00", "105w00");
		lonMap.put("-07:30", "112w30");
		lonMap.put("-08:00", "120w00");
		lonMap.put("-09:00", "135w00");
		lonMap.put("-10:00", "150w00");
		lonMap.put("-11:00", "165w00");
		
		monthMap.put(Calendar.JANUARY, "正月");
		monthMap.put(Calendar.FEBRUARY, "二月");
		monthMap.put(Calendar.MARCH, "三月");
		monthMap.put(Calendar.APRIL, "四月");
		monthMap.put(Calendar.MAY, "五月");
		monthMap.put(Calendar.JUNE, "六月");
		monthMap.put(Calendar.JULY, "七月");
		monthMap.put(Calendar.AUGUST, "八月");
		monthMap.put(Calendar.SEPTEMBER, "九月");
		monthMap.put(Calendar.OCTOBER, "十月");
		monthMap.put(Calendar.NOVEMBER, "冬月");
		monthMap.put(Calendar.DECEMBER, "腊月");

		NongliMonth.put("正月", 1);
		NongliMonth.put("二月", 2);
		NongliMonth.put("三月", 3);
		NongliMonth.put("四月", 4);
		NongliMonth.put("五月", 5);
		NongliMonth.put("六月", 6);
		NongliMonth.put("七月", 7);
		NongliMonth.put("八月", 8);
		NongliMonth.put("九月", 9);
		NongliMonth.put("十月", 10);
		NongliMonth.put("冬月", 11);
		NongliMonth.put("腊月", 12);
		
		
		dayMap.put(1, "初一");
		dayMap.put(2, "初二");
		dayMap.put(3, "初三");
		dayMap.put(4, "初四");
		dayMap.put(5, "初五");
		dayMap.put(6, "初六");
		dayMap.put(7, "初七");
		dayMap.put(8, "初八");
		dayMap.put(9, "初九");
		dayMap.put(10, "初十");
		dayMap.put(11, "十一");
		dayMap.put(12, "十二");
		dayMap.put(13, "十三");
		dayMap.put(14, "十四");
		dayMap.put(15, "十五");
		dayMap.put(16, "十六");
		dayMap.put(17, "十七");
		dayMap.put(18, "十八");
		dayMap.put(19, "十九");
		dayMap.put(20, "二十");
		dayMap.put(21, "廿一");
		dayMap.put(22, "廿二");
		dayMap.put(23, "廿三");
		dayMap.put(24, "廿四");
		dayMap.put(25, "廿五");
		dayMap.put(26, "廿六");
		dayMap.put(27, "廿七");
		dayMap.put(28, "廿八");
		dayMap.put(29, "廿九");
		dayMap.put(30, "三十");
		dayMap.put(-29, "初一");
		dayMap.put(-28, "初二");
		dayMap.put(-27, "初三");
		dayMap.put(-26, "初四");
		dayMap.put(-25, "初五");
		dayMap.put(-24, "初六");
		dayMap.put(-23, "初七");
		dayMap.put(-22, "初八");
		dayMap.put(-21, "初九");
		dayMap.put(-20, "初十");
		dayMap.put(-19, "十一");
		dayMap.put(-18, "十二");
		dayMap.put(-17, "十三");
		dayMap.put(-16, "十四");
		dayMap.put(-15, "十五");
		dayMap.put(-14, "十六");
		dayMap.put(-13, "十七");
		dayMap.put(-12, "十八");
		dayMap.put(-11, "十九");
		dayMap.put(-10, "二十");
		dayMap.put(-9, "廿一");
		dayMap.put(-8, "廿二");
		dayMap.put(-7, "廿三");
		dayMap.put(-6, "廿四");
		dayMap.put(-5, "廿五");
		dayMap.put(-4, "廿六");
		dayMap.put(-3, "廿七");
		dayMap.put(-2, "廿八");
		dayMap.put(-1, "廿九");
		dayMap.put(-30, "三十");
		
		try {
			String json = FileUtility.getStringFromClassPath("spacex/astrostudy/helper/JieqiChef.json");
			Map<String, Object> chefs = JsonUtility.toDictionary(json);
			for(Map.Entry<String, Object> entry : chefs.entrySet()) {
				List<Map<String, Object>> list = (List<Map<String, Object>>) entry.getValue();
				String key = entry.getKey();
				Tuple<String, Integer>[] tuples = new Tuple[list.size()];
				int i = 0;
				for(Map<String, Object> map : list) {
					for(String gan : map.keySet()) {
						int days = (int) map.get(gan);
						tuples[i] = new Tuple<String, Integer>(gan, days);
						break;
					}
					i++;
				}
				jieqiChefMap.put(key, tuples);
			}
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
	
	private static Map<String, Map<String, Object>> getJieqi24(String year, String zone, int ad, String lon, double birthjdn){
		Map<String, Object> params = new HashMap<String, Object>();
		if(ad < 0 && year.indexOf('-') != 0) {
			params.put("year", "-"+year);
		}else {
			params.put("year", year);
		}
		params.put("zone", zone);
		params.put("lat", "0n00");
		params.put("lon", lon);
		Map<String, Object> map = AstroHelper.getJieQiYear(params);
		Map<String, Map<String, Object>> res = new HashMap<String, Map<String, Object>>();
		Map<String, Object> jie = null;
		List<Map<String, Object>> list = (List<Map<String, Object>>) map.get("jieqi24");
		for(Map<String, Object> jieqi : list) {
			String time = (String) jieqi.get("time");
			String[] parts = StringUtility.splitString(time, ' ');
			res.put(parts[0], jieqi);
			
			boolean jieflag = (boolean) jieqi.get("jie");
			double jdn = (double) jieqi.get("jdn");
			if(jieflag && jdn < birthjdn) {
				jie = jieqi;
			}
		}
		
		if(jie == null) {
			int y = ConvertUtility.getValueAsInt(params.get("year")) - 1;
			if(y == 0) {
				y = -1;
			}
			params.put("year", y);
			map = AstroHelper.getJieQiYear(params);
			list = (List<Map<String, Object>>) map.get("jieqi24");
			for(Map<String, Object> jieqi : list) {
				String time = (String) jieqi.get("time");
				String[] parts = StringUtility.splitString(time, ' ');
				res.put(parts[0], jieqi);
				
				boolean jieflag = (boolean) jieqi.get("jie");
				double jdn = (double) jieqi.get("jdn");
				if(jieflag && jdn < birthjdn) {
					jie = jieqi;
				}
			}
		}
		
		res.put("monthJie", jie);
		return res;
	}
	
	private static String convertZoneToLon(String zone) {
		String[] parts = StringUtility.splitString(zone, ':');
		int degint =  ConvertUtility.getValueAsInt(parts[0]) * 15;
		double deg = 15 * (ConvertUtility.getValueAsInt(parts[1]) / 60.0);
		if(degint < 0) {
			deg = degint - deg;
		}else {
			deg = deg + degint;
		}
		String lon = PositionUtility.convertLonToStr(deg);
		return lon;
	}
		
	private static String getLonFromZone(String zone) {
		String lon = (String) lonMap.get(zone);
		if(lon == null) {
			lon = convertZoneToLon(zone);
		}
		return lon;
	}
	
	private static Map<String, Object>[] getNongliMonths(String year, String zone){
		Map<String, Object> params = new HashMap<String, Object>();
		String lon = getLonFromZone(zone);
		params.put("year", year);
		params.put("zone", zone);
		params.put("lon", lon);
		params.put("lat", "0n00");
		Map<String, Object> yearmonth = AstroCacheHelper.getNongli(year, zone);
		if(yearmonth == null) {
			yearmonth = AstroHelper.getNongliMonth(params);
			yearmonth.put("date", year);
			yearmonth.put("zone", zone);
			AstroCacheHelper.saveNongli(yearmonth);			
		}else {
			Object monthslist = yearmonth.get("months");
			if(monthslist instanceof String) {
				List<Map> list = JsonUtility.decodeList((String)monthslist, Map.class);
				yearmonth.put("months", list);				
			}
		}

		Object monobj = yearmonth.get("months");
		List<Map> list = null;
		if(monobj instanceof String) {
			list = JsonUtility.decodeList((String)monobj, Map.class);
		}else {
			list = (List<Map>) monobj;
		}
		
		Map<String, Object>[] months = new Map[list.size()];
		list.toArray(months);

		return months;
	}

	private static Map<String, Object> getNongli(int orgad, String birth, String zone, String lon){
		int ad = orgad;
		if(birth.startsWith("-")) {
			ad = -1;
		}
		
		String date = birth;
		String[] parts = StringUtility.splitString(date, ' ');
		date = String.format("%s 12:00:00", parts[0]);
		Map<String, Object> map = AstroCacheHelper.getNongli(date, zone);
		if(map != null) {
			return map;
		}
		
		parts = StringUtility.splitString(date, '-');
		String year = parts[0];
		if(ad < 0 && !year.startsWith("-")) {
			year = "-" + year;
		}
		int nexty = ConvertUtility.getValueAsInt(year) + 1;
		int nextad = ad;
		if(nexty == 0) {
			nexty = 1;
			nextad = 1;
		}
		Map<String, Object>[] months = getNongliMonths(year, zone);
		Map<String, Object>[] nextmonths = getNongliMonths(nexty + "", zone);
		return getNongli(ad, birth, zone, months, nextmonths, nextad, lon);
	}
	
	public static NongLi getNongLi(int orgad, String birth, String zone, String lon, boolean after23NewDay){
		int ad = orgad;
		if(birth.startsWith("-")) {
			ad = -1;
		}
		
		int timeOffset = RealSunTimeOffset.getOffsetByDate(birth, zone, lon);
		double offsetjdn = timeOffset/3600.0/24.0;
		RealDate realdate = JdnHelper.addOffset(birth, zone, offsetjdn);
		String realBirth = realdate.realDate;
		
		Map<String, Object> nonglimap = NongliHelper.getNongli(ad, realBirth, zone, lon);
		NongLi nongli = new NongLi(nonglimap);
		nongli.birth = realBirth;
		nongli.jdn = DateTimeUtility.getDateNum(realBirth, zone);
		nongli.monthInt = NongliMonth.get(nongli.month);
		int m = NongliMonth.get(nongli.month);
		int jiem = nongli.jieord / 2 + 1;
		if(jiem != nongli.monthInt) {
			if(m == 12 && jiem == 1) {
				m = 1;
				int org = StemBranch.JiaZiIndex.get(nongli.year);
				int idx = (org + 1) % 60;
				nongli.yearJieqi = StemBranch.JiaZi[idx];
			}else if(jiem < nongli.monthInt) {
				m -= 1;				
			}
			if(jiem == 12) {
				if(m != 11) {
					m = 12;
					int org = StemBranch.JiaZiIndex.get(nongli.year);
					int idx = (org - 1 + 60) % 60;
					nongli.yearJieqi = StemBranch.JiaZi[idx];					
				}
			}else if(jiem > nongli.monthInt) {
				m = jiem;
			}
		}
		
		nongli.monthGanZi = BaZiHelper.getMonthGanziStr(nongli.yearJieqi, m);
		boolean after23H = DateTimeUtility.isAfter23Hour(realBirth);
		nongli.dayGanZi = BaZiHelper.getDayGanziStr(ad, realBirth, zone, after23H, after23NewDay);
		nongli.time = BaZiHelper.getTimeGanziStr(nongli.dayGanZi, realBirth, after23NewDay);
		
		nongli.yearNaying = StemBranch.getNaYing(nongli.year);
		FiveElement fv = StemBranch.getNaYingElement(nongli.year);
		nongli.yearNayingElement = fv.toString();			

		nongli.jieqiYearNaying = StemBranch.getNaYing(nongli.yearJieqi);
		FiveElement fvjieqi = StemBranch.getNaYingElement(nongli.yearJieqi);
		nongli.jieqiYearNayingElement = fvjieqi.toString();			

		String[] parts = StringUtility.splitString(nongli.date, '-');
		String year = parts[0];
		String monthstr = parts[1];
		if(nongli.date.startsWith("-")) {
			year = "-" + year;
		}
		int y = ConvertUtility.getValueAsInt(year);
		int mon = ConvertUtility.getValueAsInt(monthstr);
		nongli.qimengYearGua = QiMengHelper.getGua(y);
		
		if(mon <= 2) {
			if(nongli.monthInt != 1) {
				if(nongli.year.equals(nongli.yearJieqi)) {
					y -= 1;
					if(y == 0) {
						y = -1;
					}
					nongli.qimengYearGua = QiMengHelper.getGua(y);					
				}
			}			
		}
		
		if(nongli.dayInt == 30) {
			RealDate nextRealdate = JdnHelper.addOffset(birth, zone, 1);
			NongLi nextnongli = getNongLi(orgad, nextRealdate.realDate, zone, lon, after23NewDay);
			if(nextnongli.dayInt == 2) {
				nextnongli.dayInt = 1;
				nextnongli.day = "初一";
				nextnongli.dayGanZi = nongli.dayGanZi;
				nextnongli.birth = nongli.birth;
				nextnongli.time = nongli.time;
				nextnongli.date = nongli.date;
				nextnongli.jiedelta = nongli.jiedelta;
				
				return nextnongli;
			}
		}
		
		return nongli;
	}
	
	
		
	private static Map<String, Object> getNongli(int thisad, String birth, String zone, Map<String, Object>[] thisMonths, Map<String, Object>[] nextYearMonths, int nextad, String lon){
		Map<String, Object> res = new HashMap<String, Object>();
		int ad = thisad;
		if(birth.startsWith("-")) {
			ad = -1;
		}
		
		res.put("zone", zone);
		res.put("ad", ad);
		double birthjdn = DateTimeUtility.getDateNum(birth, zone);
		res.put("jdn", birthjdn);
		res.put("dayOfWeek", DateTimeUtility.getDayOfWeek(birthjdn));
		
		String[] birthparts = StringUtility.splitString(birth, ' ');
		String date = birthparts[0];
		if(ad < 0 && !date.startsWith("-")) {
			date = '-' + date;
		}
		res.put("date", date);
		String[] dtparts = StringUtility.splitString(date, '-');
		String yearStr = dtparts[0];
		if(date.startsWith("-")) {
			yearStr = "-" + yearStr;
		}
		double dateNum = DateTimeUtility.getDateNum(date+" 00:00:00", zone);

		Map<String, Object>[] months = thisMonths;
		double delta = 0;
		int idx = 0;
		while(true) {
			for(int i=0; i<months.length; i++) {
				Map<String, Object> map = months[i];
				int dtAd = ConvertUtility.getValueAsInt(map.get("ad"), 1);
				String dt = (String) map.get("date");
				if(dtAd < 0 && !dt.startsWith("-")) {
					dt = "-" + dt;
				}
				double dtNum = DateTimeUtility.getDateNum(dt+" 00:00:00", zone);
				delta = dateNum - dtNum;
				idx = i;				
				if(delta < 30) {
					if(delta >= 28 && i < months.length - 1) {
						int k = i + 1;
						map = months[k];
						dt = (String) map.get("date");
						dtAd = ConvertUtility.getValueAsInt(map.get("ad"), 1);
						if(dtAd < 0 && !dt.startsWith("-")) {
							dt = "-" + dt;
						}
						dtNum = ConvertUtility.getValueAsDouble(map.get("jdn"));
						delta = dateNum - dtNum;
						if(Math.abs(delta) < 1) {
							idx = k;
						}
					}
					break;
				}
			}
			if(idx < months.length && delta < 30) {
				break;
			}
			
			ad = nextad;
			months = nextYearMonths;
			idx = 0;
		}

		Map<String, Object> map = months[idx];

		res.put("year", map.get("year"));	
		res.put("month", map.get("name"));
		res.put("leap", map.get("leap"));
		
		String firstDt = (String)map.get("date");
		if(delta < 0) {
			ad = ConvertUtility.getValueAsInt(map.get("ad"), 1);
			if(ad < 0 && !firstDt.startsWith("-")) {
				firstDt = '-' + firstDt;
			}
			double firstJdn = DateTimeUtility.getDateNum(firstDt+" 00:00:00", zone);
			delta = dateNum - firstJdn;
		}
		delta = delta + 0.5;
		int dayInt = ConvertUtility.getValueAsInt(delta);
		if(dayInt < 30 && dayInt >=0) {
			dayInt += 1;
		}else if(dayInt < 0) {
			int n = NongliMonth.get(map.get("name"));
			n = (n + 10) % 12;
			String nstr = monthMap.get(n);
			res.put("month", nstr);
		}
		String nongliday = dayMap.get(dayInt);
		res.put("day", nongliday);
		res.put("dayInt", dayInt);

		if(firstDt.equals(date)) {
			res.put("moonTime", map.get("time"));
			res.put("moonJdn", map.get("jdn"));
		}
		
		Map<String, Map<String, Object>> jieqi24 = getJieqi24(yearStr, zone, ad, lon, birthjdn);
		Map<String, Object> jieqi = (Map<String, Object>) jieqi24.get(date);
		if(jieqi != null) {
			res.put("jieqi", jieqi.get("jieqi"));
			res.put("jieqiTime", jieqi.get("time"));
			res.put("jieqiJdn", jieqi.get("jdn"));
		}
		
		Map<String, Object> monthjie = jieqi24.get("monthJie");
		double jiejdn = (double) monthjie.get("jdn");
		String jiestr = (String) monthjie.get("jieqi");
		int jieord = (int) monthjie.get("ord");
		int deltadays = ConvertUtility.getValueAsInt(birthjdn - jiejdn);
		Tuple<String, Integer>[] tuples = jieqiChefMap.get(jiestr);
		int cnt = 0;
		Tuple<String, Integer> lasttuple = null;
		if(tuples != null && tuples.length > 0) {
			lasttuple = tuples[tuples.length - 1];
			for(Tuple<String, Integer> tuple : tuples) {
				lasttuple = tuple;
				int days = tuple.item2();
				cnt += days;
				if(deltadays <= cnt) {
					lasttuple = tuple;
					break;
				}
			}
		}else {
			QueueLog.warn(AppLoggers.ErrorLogger, "no jieqi chef config for jieqi:{}, birth:{}, zone:{}", jiestr, birth, zone);
			lasttuple = new Tuple<String, Integer>("甲", 30);
		}
		String gan = lasttuple.item1();
		FiveElement elem = StemBranch.StemFiveElemMap.get(gan);
		String jieDelta = String.format("%s后第%d天", jiestr, deltadays+1);
		String chefstr = String.format("%s%s用事", gan, elem.toString());
		res.put("chef", chefstr);
		res.put("jiedelta", jieDelta);
		res.put("jieord", jieord);
				
		AstroCacheHelper.saveNongli(res);	
		
		return res;
	}
	
	public static void fillNongli(Map<String, Object> res, Map<String, Object> params, int ad) {
		String lon = (String) params.get("lon");
		String zone = (String) params.get("zone");
		String date = (String) params.get("date");
		String time = (String) params.get("time");
		if(time.length() < 19) {
			time = time + ":00";
		}
		String birth = String.format("%s %s", date.replace('/', '-'), time) ;

		NongLi nl = NongLi.emptyNongLi();
		try {
			nl = NongliHelper.getNongLi(ad, birth, zone, lon, false);			
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		if(res.containsKey("chart")) {
			Map<String, Object> chart = (Map<String, Object>) res.get("chart");
			chart.put("nongli", nl.toMap());
		}else {
			res.put("nongli", nl.toMap());					
		}
	}
	
	
	public static void main(String[] args) {
		String date = "2012-06-18";
		date = "1985-02-13 22:38:00";
//		date = "0001-01-01";
//		date = "1500-02-29";
//		date = "1976-07-06";
//		date = "1995-09-26";
//		date = "1974-12-20";
		date = "1975-09-05 04:34:21";
		date = "1985-03-20 04:34:21";
		date = "1500-02-20 12:34:21";
		date = "1984-11-25 06:34:21";
		date = "2020-11-07 12:00:00";
		date = "2022-12-23 12:00:00";
		date = "-5079-12-23 12:00:00";
		date = "2023-06-02 13:02:03";

		String zone = "+08:00";
		String lon = "118e32";
		String lat = "36n37";
		lon = "119e18";
		lat = "26n05";
		
		int ad = 1;
		if(date.startsWith("-")) {
			ad = -1;
		}
		
		NongLi res = getNongLi(ad, date, zone, lon, false);
		String json = JsonUtility.encodePretty(res);
		System.out.println(json);
		
//		String lonstr = convertZoneToLon("-04:30");
//		System.out.println(lonstr);
	}
	
}
