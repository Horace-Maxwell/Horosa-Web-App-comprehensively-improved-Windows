package boundless.utility;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * 日期实用类，以静态方法提供日期常用的功能
 * @author zjf
 *
 */
public class DateTimeUtility {
	private static Calendar FirstDay = Calendar.getInstance();
	private static Calendar JulianEndDay = Calendar.getInstance();
	private static Calendar GregorianStartDay = Calendar.getInstance();
	private static Map<Integer, String> CNWeekdayMap = new HashMap<Integer, String>();
	
	private static SimpleDateFormat df=new SimpleDateFormat("yyyy-MM-dd");
	static {
		FirstDay.set(Calendar.YEAR, 1);
		FirstDay.set(Calendar.MONTH, Calendar.JANUARY);
		FirstDay.set(Calendar.DATE, 1);
		FirstDay.set(Calendar.HOUR_OF_DAY, 0);
		FirstDay.set(Calendar.MINUTE, 0);
		FirstDay.set(Calendar.SECOND, 0);
		FirstDay.set(Calendar.MILLISECOND, 0);

		JulianEndDay.set(Calendar.YEAR, 1582);
		JulianEndDay.set(Calendar.MONTH, Calendar.OCTOBER);
		JulianEndDay.set(Calendar.DATE, 4);
		JulianEndDay.set(Calendar.HOUR_OF_DAY, 23);
		JulianEndDay.set(Calendar.MINUTE, 59);
		JulianEndDay.set(Calendar.SECOND, 59);
		JulianEndDay.set(Calendar.MILLISECOND, 999);
		
		GregorianStartDay.set(Calendar.YEAR, 1582);
		GregorianStartDay.set(Calendar.MONTH, Calendar.OCTOBER);
		GregorianStartDay.set(Calendar.DATE, 15);
		GregorianStartDay.set(Calendar.HOUR_OF_DAY, 0);
		GregorianStartDay.set(Calendar.MINUTE, 0);
		GregorianStartDay.set(Calendar.SECOND, 0);
		GregorianStartDay.set(Calendar.MILLISECOND, 0);
		
		CNWeekdayMap.put(Calendar.MONDAY, "一");
		CNWeekdayMap.put(Calendar.TUESDAY, "二");
		CNWeekdayMap.put(Calendar.WEDNESDAY, "三");
		CNWeekdayMap.put(Calendar.THURSDAY, "四");
		CNWeekdayMap.put(Calendar.FRIDAY, "五");
		CNWeekdayMap.put(Calendar.SATURDAY, "六");
		CNWeekdayMap.put(Calendar.SUNDAY, "日");
	}
	
	/**
	 * 每秒对应的TICKS
	 */
    public static double TICKS_PER_SECOND = 10000000f;

    /**
     * 获得当前时间相对1970-01-01 00:00:00的间隔时间，单位ticks
     * @return
     */
    public static long longNowTicks()
    {
        return longTimeTicks(new Date());
    }
 
    /**
     * 获得指定时间相对1970-01-01 00:00:00的间隔时间，单位ticks
     * @param dt
     * @return
     */
    public static long longTimeTicks(Date dt)
    {
        if (dt == null) return 0;
                
        return (long)(dt.getTime() / 1000 * TICKS_PER_SECOND);
    }
    
    /**
     * 获取指定时间相对1970-01-01 00:00:00的间隔时间，单位秒
     * @param dt
     * @return
     */
    public static long longTimeSeconds(Date dt)
    {
        return (long)(longTimeTicks(dt) / TICKS_PER_SECOND);
    }

    /**
     * 获取指定时间相对1970-01-01 00:00:00的间隔时间，单位小时
     * @param dt
     * @return
     */
    public static long longTimeHours(Date dt)
    {
        return (long)(longTimeSeconds(dt) / (60*60));
    }

    /**
     * 获取指定时间相对1970-01-01 00:00:00的间隔时间，单位毫秒
     * @param dt
     * @return
     */
    public static long longTimeMilliseconds(Date dt)
    {
        return (long)(longTimeTicks(dt) * 1000 / TICKS_PER_SECOND);
    }
    
    /**
     * 获取指定时间相对1970-01-01 00:00:00的间隔时间，单位分钟
     * @param dt
     * @return
     */
    public static long longTimeMinutes(Date dt)
    {
        return (long)(longTimeSeconds(dt) / 60);
    }
  
    /**
     * 指定时间相对1970-01-01 00:00:00是否是最小值
     * @param dt
     * @return
     */
    public static boolean isMinValue(Date dt)
    {        
        return dt.getTime() <= 0;
    }
    
    /**
     * 获得相对1970-01-01 00:00:00的间隔ticks的日期
     * @param ticks
     * @return
     */
    public static Date getDateTimeByTicks(long ticks)
    {
        long ms = (long) (ticks / TICKS_PER_SECOND * 1000);
    	Date res = new Date();
    	res.setTime(ms);
        return res;
    }
 
    /**
     * 获得相对1970-01-01 00:00:00的间隔seconds的日期
     * @param seconds
     * @return
     */
    public static Date getDateTimeBySeconds(long seconds)
    {
    	long ticks = (long) (seconds * TICKS_PER_SECOND);
        return getDateTimeByTicks(ticks);
    }
    
    /**
     * 获得相对1970-01-01 00:00:00的间隔hours的日期
     * @param hours
     * @return
     */
    public static Date getDateTimeByHours(long hours)
    {
        return getDateTimeByTicks((long)(hours*60*60* TICKS_PER_SECOND));
    }
    
    /**
     * 得相对1970-01-01 00:00:00的间隔minutes的日期
     * @param minutes
     * @return
     */
    public static Date getDateTimeByMinutes(long minutes)
    {
        return getDateTimeByTicks((long)(minutes * 60 * TICKS_PER_SECOND));
    }

    /**
     * 获得指定时间与当前时间的间隔秒
     * @param lastTime
     * @return
     */
    public static double getGapSecond(Date lastTime)
    {
        return getGapSecond(lastTime, new Date());
    }

    
    /**
     * 获得指定2个时间的间隔秒
     * @param lastTime
     * @param nowTime
     * @return
     */
    public static double getGapSecond(Date lastTime, Date nowTime)
    {
        return ((nowTime.getTime() - lastTime.getTime()) / 1000);
    }

    /**
     * 判断是否同一天
     * @param t1
     * @param t2
     * @return
     */
    public static boolean identicalDay(Date t1,Date t2)
    {
    	Calendar cal1 = Calendar.getInstance();
    	cal1.setTime(t1);
    	Calendar cal2 = Calendar.getInstance();
    	cal2.setTime(t2);
    	
        return cal1.get(Calendar.YEAR) == cal2.get(Calendar.YEAR) &&
				cal1.get(Calendar.MONTH) == cal2.get(Calendar.MONTH) &&
				cal1.get(Calendar.DAY_OF_MONTH) == cal2.get(Calendar.DAY_OF_MONTH) ;
    }
    
    public static int getOneDateMS(Date date){
    	Calendar cal = Calendar.getInstance();
    	cal.setTime(date);
    	cal.set(Calendar.HOUR_OF_DAY, 0);
    	cal.set(Calendar.MINUTE, 0);
    	cal.set(Calendar.SECOND, 0);
    	cal.set(Calendar.MILLISECOND, 0);
    	
    	long ms = date.getTime() - cal.getTime().getTime();
    	return ConvertUtility.getValueAsInt(ms);
    }
    
    public static boolean isLeap(int ad, Calendar cal){
		int y = Math.abs(cal.get(Calendar.YEAR));
		if(ad < 0) {
			if(y > 172800 && y % 172800 == 0) {
				return true;
			}
			if(y > 3200 && y % 3200 == 1) {
				return false;
			}
			if(y % 4 == 1) {
				return true;
			}
			return false;
		}
		
		if(cal.before(JulianEndDay)) {
			if(y % 4 == 0) {
				return true;
			}else {
				return false;
			}
		}else {
			if(y % 4 == 0) {
				if(y % 400 == 0) {
					return true;
				}
				if(y % 100 == 0) {
					return false;
				}
				return true;
			}
			return false;
		}
    }

    public static int getLastDayOfMonth(int ad, Calendar cal){
    	int m = cal.get(Calendar.MONTH);
    	if(m == 0 || m == 2 || m == 4 || m == 6 || m == 7 || m == 9 || m == 11){
    		return 31;
    	}
    	
    	if(m == 1){
    		if(isLeap(ad, cal)){
    			return 29;
    		}
    		return 28;
    	}
    	
    	return 30;
    }
    
    public static int getLastDayOfMonth(Calendar cal) {
    	return getLastDayOfMonth(1, cal);
    }
    
    public static List<String> getDates(String startDate, String endDate){
		Date st = FormatUtility.parseDateTime(startDate, "yyyy-MM-dd");
		Date ed = FormatUtility.parseDateTime(endDate, "yyyy-MM-dd");
		int delta = DateTimeUtility.getDifference(ed, st);
    	List<String> list = new ArrayList<String>(delta+1);
		for(int i=0; i<=delta; i++) {
			Date dt = DateTimeUtility.AddDays(st, i);
			String date = FormatUtility.formatDateTime(dt, "yyyy-MM-dd");
			list.add(date);
		}
		return list;
    }
    
    public static int getDifference(Date date1, Date date2){
    	long delta = date1.getTime() - date2.getTime();
    	delta /= (3600000*24);
    	return ConvertUtility.getValueAsInt(delta);
    }
    
    public static double getDifferenceByHour(Date date1, Date date2) {
    	long delta = date1.getTime() - date2.getTime();
    	double res = delta  / 3600000.0;
    	return res;
    }
    
    public static String getDifferenceOfDayHourMin(Date date1, Date date2){
    	long nd = 1000 * 24 * 60 * 60;
        long nh = 1000 * 60 * 60;
        long nm = 1000 * 60;
        // long ns = 1000;
    	long diff  = date1.getTime() - date2.getTime();
    	
    	 // 计算差多少天
        long day = diff / nd;
        // 计算差多少小时
        long hour = diff % nd / nh;
        // 计算差多少分钟
        long min = diff % nd % nh / nm;
        // 计算差多少秒//输出结果
        // long sec = diff % nd % nh % nm / ns;
        return day + "天" + hour + "小时" + min + "分钟";
    }
    
    public static String getDifferenceOfDayHourMinByMilliseconds(long milliseconds){
    	long nd = 1000 * 24 * 60 * 60;
        long nh = 1000 * 60 * 60;
        long nm = 1000 * 60;
        long ns = 1000;
    	long diff  = milliseconds;
    	
    	 // 计算差多少天
        long day = diff / nd;
        // 计算差多少小时
        long hour = diff % nd / nh;
        // 计算差多少分钟
        long min = diff % nd % nh / nm;
        // 计算差多少秒//输出结果
         long sec = diff % nd % nh % nm / ns;
        return day + "天" + hour + "小时" + min + "分钟"+sec+"秒";
    }
    
    /**
     * 获取前多少天的日期
     * @Description:TODO
     * @param d
     * @param day
     * @return
     * Date
     * @exception:
     * @author: guandesong
     * @time:2016年9月29日 下午3:08:18
     */
    public static Date getDateBefore(Date d, int day) {  
        Calendar now = Calendar.getInstance();  
        now.setTime(d);  
        now.set(Calendar.DAY_OF_YEAR, now.get(Calendar.DAY_OF_YEAR) - day);  
        return now.getTime(); 
    }
    
    /**
     * 获取前多少天的日期数组
     * @Description:TODO
     * @param d
     * @param day
     * @return
     * Date
     * @exception:
     * @author: guandesong
     * @time:2016年9月29日 下午3:08:18
     */
    public static List<String> getDateBeforeList(Date d, int day) {  
    	List<String> dateList=new ArrayList<String>();
    	d=DateTimeUtility.AddDays(d, -(day-1));
        for(int i=0;i<day;i++) {
            dateList.add(FormatUtility.formatDateTime(DateTimeUtility.AddDays(d, i), "yyyy-MM-dd"));
        }
        return dateList;  
    }
    
    
    
    
    /** 
     * 获取后多少天的日期
     * @Description:TODO
     * @param d
     * @param day
     * @return
     * Date
     * @exception:
     * @author: guandesong
     * @time:2016年9月29日 下午3:08:53
     */
    public static Date getDateAfter(Date d, int day) {  
        Calendar now = Calendar.getInstance();  
        now.setTime(d);  
        now.set(Calendar.DAY_OF_YEAR, now.get(Calendar.DAY_OF_YEAR) + day);  
        return now.getTime();  
    }
    
    public static Date getDateAfterYear(Date d, int year){
        Calendar now = Calendar.getInstance();  
        now.setTime(d);  
        now.set(Calendar.YEAR, now.get(Calendar.YEAR) + year);  
        return now.getTime();  
    }
    
    public static Date getDateBeforeYear(Date d, int year){
        Calendar now = Calendar.getInstance();  
        now.setTime(d);  
        now.set(Calendar.YEAR, now.get(Calendar.YEAR) - year);  
        return now.getTime();  
    }
    
    public static Date getDateFrom(Date d, int timeUnit, int delta){
        Calendar now = Calendar.getInstance();  
        now.setTime(d);  
        now.set(timeUnit, now.get(timeUnit) + delta);  
        return now.getTime();  
    }
    
    public static Date getToday() {
    	Calendar now = Calendar.getInstance();  
    	now.set(Calendar.HOUR_OF_DAY, 0);
    	now.set(Calendar.MINUTE, 0);
    	now.set(Calendar.SECOND, 0);
    	now.set(Calendar.MILLISECOND, 0);
    	
    	return now.getTime();
    }
    
    /**
     * 返回星期几
     * @param date
     * @return 1--周天
     */
    public static int getDayOfWeekJavaVer(Date date){
    	Calendar cal = Calendar.getInstance();
    	cal.setTime(date);
    	int d = cal.get(Calendar.DAY_OF_WEEK);
    	return d;
    }
    
    public static Date clearTime(Date date){
    	Calendar cal = Calendar.getInstance();
    	cal.setTime(date);
    	cal.set(Calendar.HOUR_OF_DAY, 0);
    	cal.set(Calendar.MINUTE, 0);
    	cal.set(Calendar.SECOND, 0);
    	cal.set(Calendar.MILLISECOND, 0);
    	
    	return cal.getTime();
    }
    
    public static Date getMinDate(){
    	Calendar cal = Calendar.getInstance();
    	cal.set(Calendar.YEAR, 1970);
    	cal.set(Calendar.MONTH, 0);
    	cal.set(Calendar.DAY_OF_MONTH, 1);
    	cal.set(Calendar.HOUR_OF_DAY, 0);
    	cal.set(Calendar.MINUTE, 0);
    	cal.set(Calendar.SECOND, 0);
    	cal.set(Calendar.MILLISECOND, 0);
    	
    	return cal.getTime();
    }

    
    public static Date AddDays(Date date,int days){
    	Calendar cal = Calendar.getInstance();
    	cal.setTime(date);
    	cal.add(Calendar.DATE, days);  
    	return cal.getTime();
    }
    
    public static Date AddMonth(Date date,int days){
    	Calendar cal = Calendar.getInstance();
    	cal.setTime(date);
    	cal.add(Calendar.MONTH, days);  
    	return cal.getTime();
    }
    
    public static long currentTimeMillis(){
    	long ms = System.currentTimeMillis();
    	TimeZone.getDefault().getRawOffset();
    	
    	return ms;
    }
    
	/**
     * 获取指定时间所在季度的第一天（一天中最小时间）和最后一天（一天中最大时间）
     * @param date
     */
    public static Map<String,Object> getFristAndLashOfDuarterDay(Date date){
    	Map<String,Object> map=new HashMap<String, Object>();
    	Calendar cal = Calendar.getInstance();
        cal.setTime(date);
        int month = cal.get(cal.MONTH) + 1;
        int quarter = 0;
        //判断季度
        if (month >= 1 && month <= 3) {
            quarter = 1;
        } else if (month >= 4 && month <= 6) {
            quarter = 2;
        } else if (month >= 7 && month <= 9) {
            quarter = 3;
        } else {
            quarter = 4;
        }
        //获取指定时间所在季度第一天和最后一天
        Date firstDay = null;
        Date lastDay = null;
        String str = cal.get(cal.YEAR)+"";
        String startDay = "";
        String endDay = "";
        switch (quarter){
            case 1://第一季度
                startDay = str + "-01-01 00:00:00";
                endDay = str + "-03-31 23:59:59";
                break;
            case 2://第二季度
                startDay = str + "-04-01 00:00:00";
                endDay = str + "-06-30 23:59:59";
                break;
            case 3://第三季度
                startDay = str + "-07-01 00:00:00";
                endDay = str + "-09-30 23:59:59";
                break;
            case 4://第四季度
                startDay = str + "-10-01 00:00:00";
                endDay = str + "-12-31 23:59:59";
                break;
        }
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
        try {
            firstDay = sdf.parse(startDay);
            //用日期获取数据时会由1秒误差，若要求比较严格，建议不减1，获取下一天的开始时间
            cal.setTime(sdf.parse(endDay));
            cal.setTimeInMillis(cal.getTimeInMillis()+24*60*60*1000-1);
            lastDay = cal.getTime();
        } catch (ParseException e) {
            e.printStackTrace();
        }
        map.put("FirstDay",FormatUtility.formatDateTime(firstDay, "yyyy-MM-dd HH:mm:ss"));
        map.put("LastDay",FormatUtility.formatDateTime(lastDay, "yyyy-MM-dd HH:mm:ss"));
        return map;
    }
    
    public static boolean isAfter23Hour(String tm) {
    	String[] parts = StringUtility.splitString(tm, ' ');
    	String tmstr = parts[0];
    	if(parts.length > 1) {
    		tmstr = parts[1];
    	}
    	
    	parts = StringUtility.splitString(tmstr, ':');
    	int h = ConvertUtility.getValueAsInt(parts[0]);
    	return h >= 23;
    }
    
    public static int[] getDateTimeParts(String dtstr) {
    	String[] parts = StringUtility.splitString(dtstr, ' ');
    	String datestr = parts[0];
    	String[] dtparts = StringUtility.splitString(datestr, '-');
    	int sym = 1;
    	if(dtstr.startsWith("-")) {
    		sym = -1;
    	}
    	int[] dtres = new int[] {
    			ConvertUtility.getValueAsInt(dtparts[0])*sym,
    			ConvertUtility.getValueAsInt(dtparts[1]),
    			ConvertUtility.getValueAsInt(dtparts[2]),
    	};
    	if(parts.length == 1) {
    		return new int[] { dtres[0], dtres[1], dtres[2], 0, 0, 0 };
    	}
    	
    	String tmstr = parts[1];
    	String[] tmparts = StringUtility.splitString(tmstr, ':');
    	int sec = 0;
    	if(tmparts.length > 2) {
    		sec = ConvertUtility.getValueAsInt(tmparts[2]);
    	}
    	int[] tmres = new int[]{
    			ConvertUtility.getValueAsInt(tmparts[0]),
    			ConvertUtility.getValueAsInt(tmparts[1]),
    			sec
    	};
    	return new int[] { dtres[0], dtres[1], dtres[2], tmres[0], tmres[1], tmres[2] };
    }
    
	/**
	 * calculate Julian Day Number
	 * @param datestr
	 * @return
	 */
	public static long getOnlyDateNum(String datestr) {
		String[] parts = StringUtility.splitString(datestr, ' ');
		String dtstr = parts[0];
		String[] dateparts = StringUtility.splitString(dtstr, '-');
		int year, month, day;
		if(dateparts.length == 4) {
			year =  -Integer.parseInt(dateparts[1]);
			month = Integer.parseInt(dateparts[2]);
			day = Integer.parseInt(dateparts[3]);
		}else {
			year =  Integer.parseInt(dateparts[0]);
			month = Integer.parseInt(dateparts[1]);
			day = Integer.parseInt(dateparts[2]);			
		}
		if(datestr.startsWith("-") && year > 0) {
			year = -year;
		}
		
		long a = (14 - month) / 12;
		long y = year + 4800 - a;
		if(year < 0) {
			y = y + 1;
		}
		long m = month + 12*a - 3;
		boolean isGrego = true;
		if(year < 1582 || (year == 1582 && month < 10) || (year == 1582 && month == 10 && day < 15)){
			isGrego = false;
		}
		
		if(isGrego) {
			return day + (153*m + 2)/5 + 365*y + y/4 - y/100 + y/400 - 32045;
		}else {
			return day + (153*m + 2)/5 + 365*y + y/4 - 32083;
		}
		
	}
	
	public static double getDateNum(String datestr, String zone) {
		String[] parts = StringUtility.splitString(datestr, ' ');
		String dtstr = parts[0];
		long date = getOnlyDateNum(dtstr);
		double zonejdn = getZoneJdn(zone);
		double tmjdn = -zonejdn;
		if(parts.length > 1) {
			String tmstr = parts[1];
			tmjdn = getTimeNum(tmstr) - zonejdn;			
		}
		
		return date + tmjdn - 0.5;
	}
	
	private static double getZoneJdn(String zone) {
		String[] parts = StringUtility.splitString(zone, ':');
		String h = parts[0];
		int sym = 1;
		if(h.startsWith("+")) {
			h = h.substring(1);
		}else if(h.startsWith("-")) {
			h = h.substring(1);
			sym = -1;
		}
		int hour = ConvertUtility.getValueAsInt(h);
		int minute = ConvertUtility.getValueAsInt(parts[1]);
		return sym*(hour + minute/60.0)/24.0;
	}
	
	private static double getTimeNum(String time) {
		String[] tms = StringUtility.splitString(time, ':');
		double n = ConvertUtility.getValueAsDouble(tms[0]) +  ConvertUtility.getValueAsDouble(tms[1])/60.0;
		if(tms.length == 3) {
			n += ConvertUtility.getValueAsDouble(tms[2])/3600.0;
		}
		
		return n/24;
	}
	
	public static int[] getTimePartsFromJdnTime(double jdn) {
		int day = ConvertUtility.getValueAsInt(Math.floor(Math.abs(jdn)));
		int sym = 1;
		if(jdn < 0) {
			sym = -1;
		}
		double jdntm = Math.abs(jdn) - day;
		Double n = jdntm * 24;
		int h = n.intValue();
		n = n - h;
		
		n = n * 60;
		int m = n.intValue();
		n = n - m;
		
		n = n * 60;
		int s = n.intValue();
		n = n - s;
		if(n >= 0.5) {
			s +=1;
		}
				
		return new int[] { sym*day, h, m, s };
	}
	
	public static long getTotalSecondsFromJdnTime(double jdn) {
		int[] parts = getTimePartsFromJdnTime(jdn);
		long sec = Math.abs(parts[0])*3600*24 + parts[1]*3600 + parts[2]*60 + parts[3];
		return parts[0] < 0 ? -sec : sec;
	}
	
		
	public static String getTimeFromJdnTime(double jdntm) {
		int[] parts = getTimePartsFromJdnTime(jdntm);
						
		return String.format("%02d:%02d:%02d", parts[1], parts[2], parts[3]);
	}
	
	private static long[] calDateFromJdn(double jdn) {
		long a = ConvertUtility.getValueAsLong(jdn + 32044);
		long b = (4*a + 3) / 146097;
		long c = a - (146097*b) / 4;
		long d = (4*c + 3) / 1461;
		long e = c - (1461*d) / 4;
		long m = (5*e + 2) / 153;
	    long day = ConvertUtility.getValueAsLong(e + 1 - (153*m + 2) / 5);
	    long month = ConvertUtility.getValueAsLong(m + 3 - 12*(m/10));
	    long year = ConvertUtility.getValueAsLong(100*b + d - 4800 + m/10);

	    return new long[] {year, month, day};
	}
	
	public static String getDateFromJdn(double jdn, String zone, BiFunction<Double, String, String> fun) {
		if(jdn < 2299160.1666666665) {
			if(fun == null) {
				return null;
			}
			return fun.apply(jdn, zone);
		}
		
		double zonejdn = getZoneJdn(zone);
		Double locjdn = jdn + zonejdn + 0.5;
		double tm = Math.abs(locjdn) - Math.floor(Math.abs(locjdn));
		
		long[] dt = calDateFromJdn(locjdn);
					    
		long year = dt[0];
		long month = dt[1];
		long day = dt[2];
	    if(year <= 0) {
	    	year -= 1;
	    }
	    
		String t = getTimeFromJdnTime(tm);
		
		String str = String.format("%d-%02d-%02d %s", year, month, day, t);
		
		double n = getDateNum(str, zone);
		double delta = jdn - n;
		
		if(Math.abs(delta) > 0.00000001) {
			dt = calDateFromJdn(locjdn + delta);
			year = dt[0];
			month = dt[1];
			day = dt[2];
		    if(year <= 0) {
		    	year -= 1;
		    }
		    str = String.format("%d-%02d-%02d %s", year, month, day, t);			
		}
		
		return str;
	}
	
	public static String dateStrToEnStr(String datestr) {
		String[] parts = StringUtility.splitString(datestr, '-');
		if(datestr.startsWith("-")) {
			return String.format("-%s/%s/%s", parts[0], parts[1], parts[2]);
		}else {
			return String.format("%s/%s/%s", parts[0], parts[1], parts[2]);
		}
	}
	
	/**
	 * 返回星期几 
	 * @param jdn
	 * @return 0--周天
	 */
	public static int getDayOfWeek(double jdn) {
		double n = jdn + 2;
		long days = ConvertUtility.getValueAsLong(n) % 7;
		return (int)days;
	}
	
	
	public static String getCNJavaWeekDay(int day) {
		return CNWeekdayMap.get(day);
	}
    
    /**
	 * 返回星期几 
	 * @param jdn
	 * @return 1--周日  7  周六
	 */
	public static String getCnWeekDay(int index) {
		String day="";
		if(index == 1) {
			day="周日";
		}
		if(index == 2) {
			day="周一";
		}
		if(index == 3) {
			day="周二";
		}
		if(index == 4) {
			day="周三";
		}
		if(index == 5) {
			day="周四";
		}
		if(index == 6) {
			day="周五";
		}
		if(index == 7) {
			day="周六";
		}
		return day;
	}
	public static List<String> dateToWeek(Date mdate) throws ParseException {
        int b = mdate.getDay();//得到星期,0-->星期天，1->星期一，6->星期六(外国人眼中一周的第一天为星期天，中国为星期一)
        Date fdate;//接受1-7的日期变量
        List<String> list = new ArrayList<String>();//list数组增加fdate
        long fTime;
        if(b==0){
            fTime = mdate.getTime() - (b+6) * 24 * 3600000;//得到该周星期一的ms数，也就是中国周的第一天
        }
        else{
            fTime = mdate.getTime() - (b-1) * 24 * 3600000;//得到该周星期一的ms数，也就是中国周的第一天
        }
        for (int a = 0; a <7; a++) {
            fdate = new Date();
            fdate.setTime(fTime + (a * 24 * 3600000));
            list.add(df.format(fdate));
        }
        return list;
    }
	
	/**
	 * java获取 当月所有的日期集合
	 * @return
	 */
	public static List<String> getDayListOfMonth(Date date) {
	    List<String> list = new ArrayList<String>();
	    Calendar aCalendar = Calendar.getInstance(Locale.CHINA);
	    aCalendar.setTime(date);
	    int year = aCalendar.get(Calendar.YEAR);//年份
	    int month = aCalendar.get(Calendar.MONTH) + 1;//月份
	    int day = aCalendar.getActualMaximum(Calendar.DATE);
	    String monthStr="0";
	    if(month<10){
	        monthStr="0"+month;
	    }else{
	        monthStr=String.valueOf(month);
	    }
	    for (int i = 1; i <= day; i++) {
	        String days="0";
	        if(i<10){
	            days="0"+i;
	        }else {
	            days=String.valueOf(i);
	        }
	        String aDate = String.valueOf(year)+"-"+monthStr+"-"+days;
	        SimpleDateFormat sp=new SimpleDateFormat("yyyy-MM-dd");
	        try {
	            Date mdate = sp.parse(aDate);
	            list.add(df.format(mdate));
	        } catch (ParseException e) {
	            e.printStackTrace();
	        }

	    }
	    return list;
	}
	/**
	 * 
	 * 1 第一季度 2 第二季度 3 第三季度 4 第四季度
	 * 
	 * @param date
	 * @return
	 */
	public static int getSeason(Date date) {
 
		int season = 0;
 
		Calendar c = Calendar.getInstance();
		c.setTime(date);
		int month = c.get(Calendar.MONTH);
		switch (month) {
		case Calendar.JANUARY:
		case Calendar.FEBRUARY:
		case Calendar.MARCH:
			season = 1;
			break;
		case Calendar.APRIL:
		case Calendar.MAY:
		case Calendar.JUNE:
			season = 2;
			break;
		case Calendar.JULY:
		case Calendar.AUGUST:
		case Calendar.SEPTEMBER:
			season = 3;
			break;
		case Calendar.OCTOBER:
		case Calendar.NOVEMBER:
		case Calendar.DECEMBER:
			season = 4;
			break;
		default:
			break;
		}
		return season;
	}
	
	/**
	 * 取得季度月
	 * 
	 * @param date
	 * @return
	 */
	public static Date[] getSeasonDate(Date date) {
		Date[] season = new Date[3];
 
		Calendar c = Calendar.getInstance();
		c.setTime(date);
 
		int nSeason = getSeason(date);
		if (nSeason == 1) {// 第一季度
			c.set(Calendar.MONTH, Calendar.JANUARY);
			season[0] = c.getTime();
			c.set(Calendar.MONTH, Calendar.FEBRUARY);
			season[1] = c.getTime();
			c.set(Calendar.MONTH, Calendar.MARCH);
			season[2] = c.getTime();
		} else if (nSeason == 2) {// 第二季度
			c.set(Calendar.MONTH, Calendar.APRIL);
			season[0] = c.getTime();
			c.set(Calendar.MONTH, Calendar.MAY);
			season[1] = c.getTime();
			c.set(Calendar.MONTH, Calendar.JUNE);
			season[2] = c.getTime();
		} else if (nSeason == 3) {// 第三季度
			c.set(Calendar.MONTH, Calendar.JULY);
			season[0] = c.getTime();
			c.set(Calendar.MONTH, Calendar.AUGUST);
			season[1] = c.getTime();
			c.set(Calendar.MONTH, Calendar.SEPTEMBER);
			season[2] = c.getTime();
		} else if (nSeason == 4) {// 第四季度
			c.set(Calendar.MONTH, Calendar.OCTOBER);
			season[0] = c.getTime();
			c.set(Calendar.MONTH, Calendar.NOVEMBER);
			season[1] = c.getTime();
			c.set(Calendar.MONTH, Calendar.DECEMBER);
			season[2] = c.getTime();
		}
		return season;
	}
	
	/**
	 * java获取 当季度所有的日期集合
	 * @return
	 * @throws ParseException 
	 */
	public static List<String> getDayListOfQuarter(Date date) throws ParseException {
	    List<String> list = new ArrayList<String>();
	    Date[] dates=getSeasonDate(date);
	    System.out.println();
	    for(Date d:dates) {
	    	List<String> monthDate= getDayListOfMonth(d);
	    	for(String md:monthDate) {
	    		list.add(md);
	    	}
		}
	    return list;
	}
	
	public static long compareTime(Date date1, Date date2) {
		Calendar cal1 = Calendar.getInstance();
		Calendar cal2 = Calendar.getInstance();
		cal1.setTime(date1);
		cal2.setTime(date2);
		
		cal1.set(Calendar.YEAR, 2000);
		cal1.set(Calendar.MONTH, Calendar.JANUARY);
		cal1.set(Calendar.DAY_OF_MONTH, 1);

		cal2.set(Calendar.YEAR, 2000);
		cal2.set(Calendar.MONTH, Calendar.JANUARY);
		cal2.set(Calendar.DAY_OF_MONTH, 1);

		return cal1.getTimeInMillis() - cal2.getTimeInMillis();
	}
	
	public static long compareDay(Date date1, Date date2) {
		Calendar cal1 = Calendar.getInstance();
		Calendar cal2 = Calendar.getInstance();
		cal1.setTime(date1);
		cal2.setTime(date2);
		
		cal1.set(Calendar.HOUR_OF_DAY, 0);
		cal1.set(Calendar.MINUTE, 0);
		cal1.set(Calendar.SECOND, 0);
		cal1.set(Calendar.MILLISECOND, 0);
		
		cal2.set(Calendar.HOUR_OF_DAY, 0);
		cal2.set(Calendar.MINUTE, 0);
		cal2.set(Calendar.SECOND, 0);
		cal2.set(Calendar.MILLISECOND, 0);

		return cal1.getTimeInMillis() - cal2.getTimeInMillis();
	}
	
	public static int compareMonth(Date date1, Date date2) {
		Calendar cal1 = Calendar.getInstance();
		Calendar cal2 = Calendar.getInstance();
		cal1.setTime(date1);
		cal2.setTime(date2);

		int y1 = cal1.get(Calendar.YEAR);
		int y2 = cal2.get(Calendar.YEAR);
		int m1 = cal1.get(Calendar.MONTH);
		int m2 = cal2.get(Calendar.MONTH);
		
		if(y1 < y2) {
			return -1;
		}
		if(y1 > y2) {
			return 1;
		}
		
		if(m1 < m2) {
			return -1;
		}
		if(m1 > m2) {
			return 1;
		}
		
		return 0;
	}
	
	public static long sameDate(long tm1, long tm2) {
		long oneday = 86400000;
		long d1 = tm1 / oneday;
		long d2 = tm2 /oneday;
		return d1 - d2;
	}
	
	public static void main(String[] args){
    	Date date1 = new Date();
    	Date date2 = new Date();
    	
    	System.out.println(identicalDay(date1, date2));
    	
    	Date date3 = getDateTimeByHours(48);
    	Date date4 = getDateTimeByHours(48);
    	Date date5 = getDateTimeByHours(36);
    	Date date6 = getDateTimeBySeconds(1411494087);
    	Calendar cal = Calendar.getInstance();
    	cal.set(2014, 8, 23, 17, 41, 27);
    	cal.set(Calendar.MILLISECOND, 0);
    	Date date7 = cal.getTime();
    	long s = longTimeSeconds(date7);
    	Date date8 = getDateTimeBySeconds(s);
    	getFristAndLashOfDuarterDay(date1);
    	System.out.println(identicalDay(date3, date4));
    	System.out.println(identicalDay(date5, date4));
    	
    	System.out.println(FormatUtility.formatDateTime(date3, "yyyy-MM-dd"));
    	
    	System.out.println(date6);
    	System.out.println(s);
    	System.out.println(date8);
    	System.out.println(cal.getTimeInMillis());
    	System.out.println(date7.getTime());
    	
    	System.out.println(getDayOfWeekJavaVer(new Date()));
    	String zone = "+08:00";
    	System.out.println(getDateNum("0010-01-09 00:12:45", zone));
    	System.out.println(getDateNum("-2-01-09 00:12:45", zone));
    	System.out.println(getDateNum("1582-10-15 00:00:00", "+00:00"));
    	
    	System.out.println(getDateFromJdn(0, zone, null));
    	
    	String dtstr = "1582-10-15 01:12:50";
    	dtstr = "-4700-10-15 01:12:50";
    	double jdn = getDateNum(dtstr, zone);
    	System.out.println(jdn);
    	String jdnstr = getDateFromJdn(jdn, zone, null);
    	System.out.println(jdnstr);
    	
    	Date d = new Date();
    	String dstr = FormatUtility.formatDateTime(d, "yyyy-MM-dd HH:mm:ss");
    	double djdn = getDateNum(dstr, zone);
    	
    	int w1 = getDayOfWeekJavaVer(d);
    	int w2 = getDayOfWeek(djdn);
    	int tn = Calendar.TUESDAY;
    	System.out.println(String.format("%d, %d", w1, w2));
    	
    	List<String> dates = getDates("2021-10-01", "2021-10-07");
    	System.out.println(StringUtility.joinWithSeperator(", ", dates));
    }
}
