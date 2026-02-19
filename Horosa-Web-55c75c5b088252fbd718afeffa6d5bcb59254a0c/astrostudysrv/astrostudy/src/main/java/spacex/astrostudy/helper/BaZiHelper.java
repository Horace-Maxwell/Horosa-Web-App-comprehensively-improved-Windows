package spacex.astrostudy.helper;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

import boundless.utility.DateTimeUtility;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.model.GanZi;
import spacex.astrostudy.model.NongLi;

public class BaZiHelper {
	private static Calendar FirstDay = Calendar.getInstance();
	private static double JulianEndDay = 2299160.999988426;
	private static int StartJiaziIndex = 0;
	
	private static Map<Integer, Integer> MonthDays = new HashMap<Integer, Integer>();
	private static Map<Integer, String> TimeZi = new HashMap<Integer, String>();
	private static Map<String, String> TimeGanStart = new HashMap<String, String>();
	private static Map<String, String> TimeZiInv = new HashMap<String, String>();

	
	private static Map<Integer, String> YearGanRemainder = new HashMap<Integer, String>();
	private static Map<Integer, String>  YearZiRemainder = new HashMap<Integer, String>();
	private static Map<Integer, String>  BCYearGanRemainder = new HashMap<Integer, String>();
	private static Map<Integer, String>  BCYearZiRemainder = new HashMap<Integer, String>();
	
	private static Map<String, Integer> YearGanRemainderInv = new HashMap<String, Integer>();
	private static Map<String, Integer>  YearZiRemainderInv = new HashMap<String, Integer>();
	private static Map<String, Integer>  BCYearGanRemainderInv = new HashMap<String, Integer>();
	private static Map<String, Integer>  BCYearZiRemainderInv = new HashMap<String, Integer>();
	
	private static Map<String, String> MonthGanStart = new HashMap<String, String>();
	
	private static int[] ZiYueNum = new int[] {11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
	
	private static String[] MonthZi = new String[] { 
			StemBranch.BRANCH_YIN, StemBranch.BRANCH_MAO, StemBranch.BRANCH_CEN,
			StemBranch.BRANCH_SI, StemBranch.BRANCH_WU, StemBranch.BRANCH_WEI,
			StemBranch.BRANCH_SHEN, StemBranch.BRANCH_YOU, StemBranch.BRANCH_XU,
			StemBranch.BRANCH_HAI, StemBranch.BRANCH_ZI, StemBranch.BRANCH_CHOU
	};
	private static Map<String, Integer>  MonthZiIndex = new HashMap<String, Integer>();

	
	static {
		StartJiaziIndex = StemBranch.JiaZiIndex.get(StemBranch.STEM_DING + StemBranch.BRANCH_CHOU);
		for(int i=0; i<MonthZi.length; i++) {
			MonthZiIndex.put(MonthZi[i], i);
		}
		
		MonthDays.put(Calendar.JANUARY, 31);
		MonthDays.put(Calendar.FEBRUARY, 28);
		MonthDays.put(Calendar.MARCH, 31);
		MonthDays.put(Calendar.APRIL, 30);
		MonthDays.put(Calendar.MAY, 31);
		MonthDays.put(Calendar.JUNE, 30);
		MonthDays.put(Calendar.JULY, 31);
		MonthDays.put(Calendar.AUGUST, 31);
		MonthDays.put(Calendar.SEPTEMBER, 30);
		MonthDays.put(Calendar.OCTOBER, 31);
		MonthDays.put(Calendar.NOVEMBER, 30);
		MonthDays.put(Calendar.DECEMBER, 31);
		
		FirstDay.set(Calendar.YEAR, 1);
		FirstDay.set(Calendar.MONTH, Calendar.JANUARY);
		FirstDay.set(Calendar.DATE, 1);
		FirstDay.set(Calendar.HOUR_OF_DAY, 0);
		FirstDay.set(Calendar.MINUTE, 0);
		FirstDay.set(Calendar.SECOND, 0);
		FirstDay.set(Calendar.MILLISECOND, 0);
						
		YearGanRemainder.put(4, StemBranch.STEM_JIA);
		YearGanRemainder.put(5, StemBranch.STEM_YI);
		YearGanRemainder.put(6, StemBranch.STEM_BING);
		YearGanRemainder.put(7, StemBranch.STEM_DING);
		YearGanRemainder.put(8, StemBranch.STEM_WU);
		YearGanRemainder.put(9, StemBranch.STEM_JI);
		YearGanRemainder.put(0, StemBranch.STEM_GENG);
		YearGanRemainder.put(1, StemBranch.STEM_XIN);
		YearGanRemainder.put(2, StemBranch.STEM_RENG);
		YearGanRemainder.put(3, StemBranch.STEM_GUI);
		
		YearZiRemainder.put(4, StemBranch.BRANCH_ZI);
		YearZiRemainder.put(5, StemBranch.BRANCH_CHOU);
		YearZiRemainder.put(6, StemBranch.BRANCH_YIN);
		YearZiRemainder.put(7, StemBranch.BRANCH_MAO);
		YearZiRemainder.put(8, StemBranch.BRANCH_CEN);
		YearZiRemainder.put(9, StemBranch.BRANCH_SI);
		YearZiRemainder.put(10, StemBranch.BRANCH_WU);
		YearZiRemainder.put(11, StemBranch.BRANCH_WEI);
		YearZiRemainder.put(0, StemBranch.BRANCH_SHEN);
		YearZiRemainder.put(1, StemBranch.BRANCH_YOU);
		YearZiRemainder.put(2, StemBranch.BRANCH_XU);
		YearZiRemainder.put(3, StemBranch.BRANCH_HAI);
		
		YearGanRemainderInv.put(StemBranch.STEM_JIA, 4);
		YearGanRemainderInv.put(StemBranch.STEM_YI, 5);
		YearGanRemainderInv.put(StemBranch.STEM_BING, 6);
		YearGanRemainderInv.put(StemBranch.STEM_DING, 7);
		YearGanRemainderInv.put(StemBranch.STEM_WU, 8);
		YearGanRemainderInv.put(StemBranch.STEM_JI, 9);
		YearGanRemainderInv.put(StemBranch.STEM_GENG, 0);
		YearGanRemainderInv.put(StemBranch.STEM_XIN, 1);
		YearGanRemainderInv.put(StemBranch.STEM_RENG, 2);
		YearGanRemainderInv.put(StemBranch.STEM_GUI, 3);
		
		YearZiRemainderInv.put(StemBranch.BRANCH_ZI, 4);
		YearZiRemainderInv.put(StemBranch.BRANCH_CHOU, 5);
		YearZiRemainderInv.put(StemBranch.BRANCH_YIN, 6);
		YearZiRemainderInv.put(StemBranch.BRANCH_MAO, 7);
		YearZiRemainderInv.put(StemBranch.BRANCH_CEN, 8);
		YearZiRemainderInv.put(StemBranch.BRANCH_SI, 9);
		YearZiRemainderInv.put(StemBranch.BRANCH_WU, 10);
		YearZiRemainderInv.put(StemBranch.BRANCH_WEI, 11);
		YearZiRemainderInv.put(StemBranch.BRANCH_SHEN, 0);
		YearZiRemainderInv.put(StemBranch.BRANCH_YOU, 1);
		YearZiRemainderInv.put(StemBranch.BRANCH_XU, 2);
		YearZiRemainderInv.put(StemBranch.BRANCH_HAI, 3);
		
		
		BCYearGanRemainder.put(-7, StemBranch.STEM_JIA);
		BCYearGanRemainder.put(-6, StemBranch.STEM_YI);
		BCYearGanRemainder.put(-5, StemBranch.STEM_BING);
		BCYearGanRemainder.put(-4, StemBranch.STEM_DING);
		BCYearGanRemainder.put(-3, StemBranch.STEM_WU);
		BCYearGanRemainder.put(-2, StemBranch.STEM_JI);
		BCYearGanRemainder.put(-1, StemBranch.STEM_GENG);
		BCYearGanRemainder.put(0, StemBranch.STEM_XIN);
		BCYearGanRemainder.put(-9, StemBranch.STEM_RENG);
		BCYearGanRemainder.put(-8, StemBranch.STEM_GUI);
		
		BCYearZiRemainder.put(-9, StemBranch.BRANCH_ZI);
		BCYearZiRemainder.put(-8, StemBranch.BRANCH_CHOU);
		BCYearZiRemainder.put(-7, StemBranch.BRANCH_YIN);
		BCYearZiRemainder.put(-6, StemBranch.BRANCH_MAO);
		BCYearZiRemainder.put(-5, StemBranch.BRANCH_CEN);
		BCYearZiRemainder.put(-4, StemBranch.BRANCH_SI);
		BCYearZiRemainder.put(-3, StemBranch.BRANCH_WU);
		BCYearZiRemainder.put(-2, StemBranch.BRANCH_WEI);
		BCYearZiRemainder.put(-1, StemBranch.BRANCH_SHEN);
		BCYearZiRemainder.put(0, StemBranch.BRANCH_YOU);
		BCYearZiRemainder.put(-11, StemBranch.BRANCH_XU);
		BCYearZiRemainder.put(-10, StemBranch.BRANCH_HAI);
		
		BCYearGanRemainderInv.put(StemBranch.STEM_JIA, -7);
		BCYearGanRemainderInv.put(StemBranch.STEM_YI, -6);
		BCYearGanRemainderInv.put(StemBranch.STEM_BING, -5);
		BCYearGanRemainderInv.put(StemBranch.STEM_DING, -4);
		BCYearGanRemainderInv.put(StemBranch.STEM_WU, -3);
		BCYearGanRemainderInv.put(StemBranch.STEM_JI, -2);
		BCYearGanRemainderInv.put(StemBranch.STEM_GENG, -1);
		BCYearGanRemainderInv.put(StemBranch.STEM_XIN, 0);
		BCYearGanRemainderInv.put(StemBranch.STEM_RENG, -9);
		BCYearGanRemainderInv.put(StemBranch.STEM_GUI, -8);

		BCYearZiRemainderInv.put(StemBranch.BRANCH_ZI, -9);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_CHOU, -8);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_YIN, -7);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_MAO, -6);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_CEN, -5);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_SI, -4);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_WU, -3);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_WEI, -2);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_SHEN, -1);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_YOU, 0);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_XU, -11);
		BCYearZiRemainderInv.put(StemBranch.BRANCH_HAI, -10);

		
		MonthGanStart.put(StemBranch.STEM_JIA, StemBranch.STEM_BING);
		MonthGanStart.put(StemBranch.STEM_JI, StemBranch.STEM_BING);
		MonthGanStart.put(StemBranch.STEM_YI, StemBranch.STEM_WU);
		MonthGanStart.put(StemBranch.STEM_GENG, StemBranch.STEM_WU);
		MonthGanStart.put(StemBranch.STEM_BING, StemBranch.STEM_GENG);
		MonthGanStart.put(StemBranch.STEM_XIN, StemBranch.STEM_GENG);
		MonthGanStart.put(StemBranch.STEM_DING, StemBranch.STEM_RENG);
		MonthGanStart.put(StemBranch.STEM_RENG, StemBranch.STEM_RENG);
		MonthGanStart.put(StemBranch.STEM_WU, StemBranch.STEM_JIA);
		MonthGanStart.put(StemBranch.STEM_GUI, StemBranch.STEM_JIA);
		
		TimeGanStart.put(StemBranch.STEM_JIA, StemBranch.STEM_JIA);
		TimeGanStart.put(StemBranch.STEM_JI, StemBranch.STEM_JIA);
		TimeGanStart.put(StemBranch.STEM_YI, StemBranch.STEM_BING);
		TimeGanStart.put(StemBranch.STEM_GENG, StemBranch.STEM_BING);
		TimeGanStart.put(StemBranch.STEM_BING, StemBranch.STEM_WU);
		TimeGanStart.put(StemBranch.STEM_XIN, StemBranch.STEM_WU);
		TimeGanStart.put(StemBranch.STEM_DING, StemBranch.STEM_GENG);
		TimeGanStart.put(StemBranch.STEM_RENG, StemBranch.STEM_GENG);
		TimeGanStart.put(StemBranch.STEM_WU, StemBranch.STEM_RENG);
		TimeGanStart.put(StemBranch.STEM_GUI, StemBranch.STEM_RENG);
		
		TimeZi.put(0, StemBranch.BRANCH_ZI);
		TimeZi.put(1, StemBranch.BRANCH_CHOU);
		TimeZi.put(2, StemBranch.BRANCH_CHOU);
		TimeZi.put(3, StemBranch.BRANCH_YIN);
		TimeZi.put(4, StemBranch.BRANCH_YIN);
		TimeZi.put(5, StemBranch.BRANCH_MAO);
		TimeZi.put(6, StemBranch.BRANCH_MAO);
		TimeZi.put(7, StemBranch.BRANCH_CEN);
		TimeZi.put(8, StemBranch.BRANCH_CEN);
		TimeZi.put(9, StemBranch.BRANCH_SI);
		TimeZi.put(10, StemBranch.BRANCH_SI);
		TimeZi.put(11, StemBranch.BRANCH_WU);
		TimeZi.put(12, StemBranch.BRANCH_WU);
		TimeZi.put(13, StemBranch.BRANCH_WEI);
		TimeZi.put(14, StemBranch.BRANCH_WEI);
		TimeZi.put(15, StemBranch.BRANCH_SHEN);
		TimeZi.put(16, StemBranch.BRANCH_SHEN);
		TimeZi.put(17, StemBranch.BRANCH_YOU);
		TimeZi.put(18, StemBranch.BRANCH_YOU);
		TimeZi.put(19, StemBranch.BRANCH_XU);
		TimeZi.put(20, StemBranch.BRANCH_XU);
		TimeZi.put(21, StemBranch.BRANCH_HAI);
		TimeZi.put(22, StemBranch.BRANCH_HAI);
		TimeZi.put(23, StemBranch.BRANCH_ZI);
		
		TimeZiInv.put(StemBranch.BRANCH_ZI, "00:30");
		TimeZiInv.put(StemBranch.BRANCH_CHOU, "02:00");
		TimeZiInv.put(StemBranch.BRANCH_YIN, "04:00");
		TimeZiInv.put(StemBranch.BRANCH_MAO, "06:00");
		TimeZiInv.put(StemBranch.BRANCH_CEN, "08:00");
		TimeZiInv.put(StemBranch.BRANCH_SI, "10:00");
		TimeZiInv.put(StemBranch.BRANCH_WU, "12:00");
		TimeZiInv.put(StemBranch.BRANCH_WEI, "14:00");
		TimeZiInv.put(StemBranch.BRANCH_SHEN, "16:00");
		TimeZiInv.put(StemBranch.BRANCH_YOU, "18:00");
		TimeZiInv.put(StemBranch.BRANCH_XU, "20:00");
		TimeZiInv.put(StemBranch.BRANCH_HAI, "22:00");
	}
	
	public static int getTimeZiIndex(int hour) {
		String zi = TimeZi.get(hour);
		return StemBranch.BranchIndex.get(zi);
	}
	
	public static String getTimeZi(int hour) {
		return TimeZi.get(hour);
	}
	
	public static Map<String, Object> getJieQiInfo(int orgad, String birth, String zone, String lon, String lat, int useLocalMao, int byLon) {
		int ad = orgad;
		if(birth.startsWith("-")) {
			ad = -1;
		}
		
		Map<String, Object> params = new HashMap<String, Object>();
		String[] parts = StringUtility.splitString(birth, ' ');
		String tmstr = "00:00:00";
		if(parts.length > 1) {
			tmstr = parts[1];
		}
		String date = parts[0];
		if(ad < 0 && !date.startsWith("-")) {
			date = "-" + date;
		}
		String time = tmstr;
		params.put("date", date);
		params.put("time", time);
		params.put("lon", lon);
		params.put("lat", lat);
		params.put("zone", zone);
		params.put("useLocalMao", useLocalMao);
		params.put("byLon", byLon);
		
		Map<String, Object> res = AstroHelper.getJieQiBirth(params);
		return res;
	}
	
	public static Map<String, Object> getJieQiInfoNoCache(int ad, Calendar birth, String zone, String lon, String lat, int useLocalMao, int byLon) {
		Map<String, Object> params = new HashMap<String, Object>();
		String date = FormatUtility.formatDateTime(birth.getTime(), "yyyy-MM-dd");
		if(ad < 0) {
			date = "-" + date;
		}
		String time = FormatUtility.formatDateTime(birth.getTime(), "HH:mm");
		params.put("date", date);
		params.put("time", time);
		params.put("lon", lon);
		params.put("lat", lat);
		params.put("zone", zone);
		params.put("useLocalMao", useLocalMao);
		params.put("byLon", byLon);
		
		Map<String, Object> res = AstroHelper.requestNoCache(AstroHelper.JieQiBirth, params);
		return res;
	}
	
	public static String getYearGanzi(int year) {
		int y = year == 0 ? 1 : year;
		int ganremainder = y % 10;
		int ziremainder = y % 12;

		String gan = null;
		String zi = null;
		if(y > 0) {
			gan = YearGanRemainder.get(ganremainder);
			zi = YearZiRemainder.get(ziremainder);			
		}else{
			gan = BCYearGanRemainder.get(ganremainder);
			zi = BCYearZiRemainder.get(ziremainder);						
		}
		
		return gan + zi;
	}
	
	public static String getYearGanzi(int year, boolean prevflag) {
		String ganzi = getYearGanzi(year);
		if(prevflag) {
			int idx = StemBranch.JiaZiIndex.get(ganzi);
			idx = (idx + 59) % 60;
			ganzi = StemBranch.JiaZi[idx];
		}
		return ganzi;
	}
	
	public static GanZi getYearColumn(int ad, String birth, String zone, Map<String, Object>[] jieqi, PhaseType phaseType) {
		int[] tmparts = DateTimeUtility.getDateTimeParts(birth);
		int year = tmparts[0];
		int y = year == 0 ? 1 : year;
		if(y > 0) {
			y = y*ad;			
		}
		int ganremainder = y % 10;
		int ziremainder = y % 12;
		
		String gan = null;
		String zi = null;
		if(y > 0) {
			gan = YearGanRemainder.get(ganremainder);
			zi = YearZiRemainder.get(ziremainder);			
		}else{
			gan = BCYearGanRemainder.get(ganremainder);
			zi = BCYearZiRemainder.get(ziremainder);						
		}
		
		boolean prevflag = false;
		int m = tmparts[1] - 1;
		if(m == Calendar.JANUARY) {
			prevflag = true;
		}else if(m == Calendar.FEBRUARY) {
			Map<String, Object> map = jieqi[2];
			double jiejdn = (double) map.get("jdn");
			double jdn = DateTimeUtility.getDateNum(birth, zone);
			if(jdn < jiejdn) {
				prevflag = true;
			}
		}
		
		if(prevflag) {
			int idx = StemBranch.JiaZiIndex.get(gan + zi);
			idx = (idx + 59) % 60;
			String ganzi = StemBranch.JiaZi[idx];
			gan = ganzi.substring(0, 1);
			zi = ganzi.substring(1);
		}
		
		GanZi yearCol = new GanZi(gan, zi, phaseType);
		return yearCol;
	}
	
	public static GanZi getMonthColumn(GanZi yearCol, int nongliMonth, PhaseType phaseType) {
		String startgan = MonthGanStart.get(yearCol.stem.cell);
		int idx = StemBranch.StemIndex.get(startgan);
		idx = (idx + nongliMonth - 1) % 10;
		String gan = StemBranch.Stems[idx];
		String zi = MonthZi[nongliMonth - 1];
		GanZi monthCol = new GanZi(gan, zi, phaseType);
		return monthCol;
	}
	
	public static String getMonthGanZi(String yearGan, String monthZi) {
		Integer nongliMonth = StemBranch.ZiMonth.get(monthZi);
		if(nongliMonth == null) {
			throw new RuntimeException("month.zi.error");
		}
		
		String startgan = MonthGanStart.get(yearGan);
		int idx = StemBranch.StemIndex.get(startgan);
		idx = (idx + nongliMonth - 1) % 10;
		String gan = StemBranch.Stems[idx];
		String zi = MonthZi[nongliMonth - 1];
		return gan+zi;
	}
	
	public static GanZi getSouthEarthMonthColumn(GanZi yearCol, GanZi monthCol, PhaseType phaseType) {
		String mzi = monthCol.branch.cell;
		int zidx = StemBranch.BranchIndex.get(mzi);
		String zi = StemBranch.BranchesCong[zidx];
		int cidx = StemBranch.BranchIndex.get(zi);
		int nongliMonth = ZiYueNum[cidx];
		
		String startgan = MonthGanStart.get(yearCol.stem.cell);
		int idx = StemBranch.StemIndex.get(startgan);
		idx = (idx + nongliMonth - 1) % 10;
		String gan = StemBranch.Stems[idx];
		GanZi monthgz = new GanZi(gan, zi, phaseType);
		return monthgz;
	}
	
	public static String getMonthGanziStr(String yearGanZi, int nongliMonth) {
		String yearGan = yearGanZi.substring(0, 1);
		String startgan = MonthGanStart.get(yearGan);
		int idx = StemBranch.StemIndex.get(startgan);
		idx = (idx + nongliMonth - 1) % 10;
		String gan = StemBranch.Stems[idx];
		String zi = MonthZi[nongliMonth - 1];
		return gan + zi;
	}
	
	public static String getDayGanziStr(int ad, String cal, String zone, boolean afterhHour23, boolean after23NewDay) {
		long days = daysFromYuanYear(ad, cal, zone);
		int remainder = (int) days % 60;
		
		int idx = (StartJiaziIndex + remainder - 1 + 60) % 60;
		if(ad < 0) {
			idx = (StartJiaziIndex - remainder + 60) % 60;
		}
		if(afterhHour23 && after23NewDay) {
			idx = (idx + 1) % 60;
		}
		
		String ganzi = StemBranch.JiaZi[idx];
		return ganzi;
	}
	
	public static GanZi getTimeColumn(GanZi dayrCol, int timeziIdx, String birth, PhaseType phaseType, boolean after23NewDay) {
		int[] tmparts = DateTimeUtility.getDateTimeParts(birth);
		int hour = tmparts[3];
		String startgan = TimeGanStart.get(dayrCol.stem.cell);
		if(hour == 23 && !after23NewDay) {
			int dayidx = (StemBranch.StemIndex.get(dayrCol.stem.cell) + 1) % 10;
			String daygan = StemBranch.Stems[dayidx];
			startgan = TimeGanStart.get(daygan);
		}
		
		int idx = StemBranch.StemIndex.get(startgan);
		String zi = StemBranch.Branches[timeziIdx];
		int ganidx = (idx + timeziIdx) % 10;
		String gan = StemBranch.Stems[ganidx];
		GanZi tmCol = new GanZi(gan, zi, phaseType);
		return tmCol;
	}

	public static GanZi getTimeColumn(GanZi dayrCol, String birth, PhaseType phaseType, boolean after23NewDay) {
		int[] tmparts = DateTimeUtility.getDateTimeParts(birth);
		int hour = tmparts[3];
		String startgan = TimeGanStart.get(dayrCol.stem.cell);
		if(hour == 23 && !after23NewDay) {
			int dayidx = (StemBranch.StemIndex.get(dayrCol.stem.cell) + 1) % 10;
			String daygan = StemBranch.Stems[dayidx];
			startgan = TimeGanStart.get(daygan);
		}
		int idx = StemBranch.StemIndex.get(startgan);
		String zi = TimeZi.get(hour);
		int ziidx = StemBranch.BranchIndex.get(zi);
		int ganidx = (idx + ziidx) % 10;
		String gan = StemBranch.Stems[ganidx];
		GanZi tmCol = new GanZi(gan, zi, phaseType);
		return tmCol;
	}
	
	private static String getTimeStartGan(String dayGan, String timeZi, boolean after23NewDay) {
		String startgan = TimeGanStart.get(dayGan);
		if(!after23NewDay && timeZi.equals("子")) {
			int dayidx = (StemBranch.StemIndex.get(dayGan) + 1) % 10;
			String daygan = StemBranch.Stems[dayidx];
			startgan = TimeGanStart.get(daygan);
		}
		return startgan;
	}

	public static String getTimeGanZi(String dayGan, String timeZi, boolean after23NewDay) {
		String startgan = getTimeStartGan(dayGan, timeZi, after23NewDay);
		int idx = StemBranch.StemIndex.get(startgan);
		int ziidx = StemBranch.BranchIndex.get(timeZi);
		int ganidx = (idx + ziidx) % 10;
		String gan = StemBranch.Stems[ganidx];
		return gan + timeZi;
	}
		
	public static String getTimeGanziStr(String dayGanzi, String birth, boolean after23NewDay) {
		int[] dtparts = DateTimeUtility.getDateTimeParts(birth);
		int hour = dtparts[3];
		String dayGan = dayGanzi.substring(0, 1);
		String startgan = TimeGanStart.get(dayGan);
		if(hour == 23 && !after23NewDay) {
			int dayidx = (StemBranch.StemIndex.get(dayGan) + 1) % 10;
			dayGan = StemBranch.Stems[dayidx];
			startgan = TimeGanStart.get(dayGan);
		}
		int idx = StemBranch.StemIndex.get(startgan);
		String zi = TimeZi.get(hour);
		int ziidx = StemBranch.BranchIndex.get(zi);
		int ganidx = (idx + ziidx) % 10;
		String gan = StemBranch.Stems[ganidx];
		return gan + zi;
	}
		
	public static GanZi getDayColumn(int ad, String birth, String zone, boolean afterhHour23, PhaseType phaseType, boolean after23NewDay) {
		String ganzi = getDayGanziStr(ad, birth, zone, afterhHour23, after23NewDay);
		String gan = ganzi.substring(0, 1);
		String zi = ganzi.substring(1);
		GanZi dayCol = new GanZi(gan, zi, phaseType);
		return dayCol;
	}
	
	public static boolean isLeap(int ad, String cal, String zone) {
		String dt = cal;
		if(ad < 0 && !cal.startsWith("-")) {
			dt = "-" + dt;
		}
		double jdn = DateTimeUtility.getDateNum(dt, zone);
		int[] dtparts = DateTimeUtility.getDateTimeParts(dt);
		int y = Math.abs(dtparts[0]);
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
		
		if(jdn < JulianEndDay) {
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
	
	public static int leapYears(int ad, String cal, String zone){
		String dt = cal;
		if(ad < 0 && !cal.startsWith("-")) {
			dt = "-" + dt;
		}
		double jdn = DateTimeUtility.getDateNum(dt, zone);
		int[] dtparts = DateTimeUtility.getDateTimeParts(dt);
		int y = dtparts[0];
		if(ad < 0) {
			int ty = Math.abs(y);
			int cnt = (ty-1) / 4;
			if(ty > 3200) {
				int delta = (ty - 1) / 3200;
				cnt -= delta;
			}
			if(ty > 172800) {
				int delta = (ty - 1) / 172800;
				cnt += delta;
			}
			return cnt;
		}
		
		int cnt = (y-1) / 4;
		
		if(jdn >= JulianEndDay) {
			int by = 1582;
			cnt = by / 4; 
			int prevy = y - 1;
			int delta = prevy - 1580;
			if(prevy >= 1600) {
				delta = prevy - 1600;
				int remainder = delta % 400;
				if(delta > 0) {
					cnt = cnt + delta / 400 * 97;
				}				
				cnt = cnt + remainder / 100 * 24;
				remainder = remainder % 100;
				cnt = cnt + remainder / 4 + 5;
			}else {
				cnt = cnt + delta / 4;
			}
		}
		
		return cnt;
	}
	
	public static long daysFromYuanYear(int ad, String cal, String zone) {
		int leapyears = leapYears(ad, cal, zone);
		int[] dtparts = DateTimeUtility.getDateTimeParts(cal);
		
		int y = dtparts[0];
		int m = dtparts[1] - 1;
		int d = dtparts[2];
		
		boolean isleap = isLeap(ad, cal, zone);
		
		long cnt = 365 * (Math.abs(y) - 1) + leapyears;
		if(ad < 0) {
			for(int i=Calendar.DECEMBER; i>m; i--) {
				cnt += MonthDays.get(i);
			}
			if(isleap && m <= Calendar.FEBRUARY) {
				cnt++;
			}
		}else {
			for(int i=0; i<m; i++) {
				cnt += MonthDays.get(i);
			}			
			if(isleap && m > Calendar.FEBRUARY) {
				cnt++;
			}
		}
		int julianEndYear = 1582;
		if(y == julianEndYear) {
			if(m > Calendar.OCTOBER) {
				cnt -= 10;
			}else if(m == Calendar.OCTOBER) {
				if(d > 14) {
					return cnt + d - 10;
				}
			}
			return cnt + d;
		}else if(y > julianEndYear) {
			cnt -= 10;
		}
		
		if(ad < 0) {
			long res = cnt + MonthDays.get(m) - d + 1;
			return res;
			
		}

		return cnt + d;
	}
	
	public static int getYear(String ganzi, int fromyear, boolean desc) {
		String gan = ganzi.substring(0, 1);
		String zi = ganzi.substring(1);
		int ganremainder = YearGanRemainderInv.get(gan);
		int ziremainder = YearZiRemainderInv.get(zi);
		
		int year = fromyear;
		int ganrem = year % 10;
		int zirem = year % 12;
		while(ganrem != ganremainder || zirem != ziremainder) {
			if(desc) {
				year--;				
			}else {
				year++;
			}
			ganrem = year % 10;
			zirem = year % 12;
		}
		
		return year;
	}
	
	private static int getMonth(String ganzi) {
		String zi = ganzi.substring(1);
		int idx = MonthZiIndex.get(zi);
		return idx + 1;
	}
	
	private static String getTimeStr(String ganzi, String dayGan) {
		String zi = ganzi.substring(1);
		String gan = ganzi.substring(0, 1);
		String startgan = TimeGanStart.get(dayGan);
		if(zi.equals(StemBranch.BRANCH_ZI)) {
			if(startgan.equals(gan)) {
				return "00:30";
			}else {
				return "23:30";
			}
		}
		
		return TimeZiInv.get(zi);
	}
	
	private static String getBirth(boolean desc, int fromyear, String yearGanzi, String monthGanzi, String dayGanzi, String timeGanzi) {
		String zone = "+08:00";
		String lon = "120e00";
		int y = getYear(yearGanzi, fromyear, desc);
		int m = getMonth(monthGanzi);
		String fromdatestr = String.format("%d-%02d-01 12:00:00", y, m);
		String timestr = getTimeStr(timeGanzi, dayGanzi.substring(0, 1));
		
		double jdn = DateTimeUtility.getDateNum(fromdatestr, zone);
		double startjdn = jdn + 30;
		String startdate = JdnHelper.getDateFromJdn(startjdn, zone);
		String startbirth = String.format("%s %s", startdate, timestr);
		
		NongLi startnongli = NongliHelper.getNongLi(1, startbirth, zone, lon, false);
		String startDayganzi = startnongli.dayGanZi;
		int startidx = StemBranch.JiaZiIndex.get(startDayganzi);
		int idx = StemBranch.JiaZiIndex.get(dayGanzi);
		
		int delta = idx - startidx;
		double destjdn = startjdn + delta;
		String date = JdnHelper.getDateFromJdn(destjdn, zone);
		String[] parts = StringUtility.splitString(date, ' ');
		String birth = String.format("%s %s", parts[0], timestr);
		NongLi nongli = NongliHelper.getNongLi(1, birth, zone, lon, false);
		
		if(nongli.yearJieqi.equals(yearGanzi) && nongli.monthGanZi.equals(monthGanzi) && nongli.dayGanZi.equals(dayGanzi)) {
			String res = String.format("%s  农历：%s年%s%s", birth, nongli.year, nongli.month, nongli.day);
			return res;
		}
		
		if(delta < 0) {
			destjdn = startjdn + 60 - startidx + idx;
			date = JdnHelper.getDateFromJdn(destjdn, zone);
			parts = StringUtility.splitString(date, ' ');
			birth = String.format("%s %s", parts[0], timestr);
			nongli = NongliHelper.getNongLi(1, birth, zone, lon, false);
			if(nongli.yearJieqi.equals(yearGanzi) && nongli.monthGanZi.equals(monthGanzi) && nongli.dayGanZi.equals(dayGanzi)) {
				String res = String.format("%s  农历：%s年%s%s", birth, nongli.year, nongli.month, nongli.day);
				return res;
			}
		}
		
		return null;
	}
	
	public static void validate(String yearGanzi, String monthGanzi, String dayGanzi, String timeGanzi) {
		String yGan = yearGanzi.substring(0, 1);
		String mGan = monthGanzi.substring(0, 1);
		String mZi = monthGanzi.substring(1);
		String dGan = dayGanzi.substring(0, 1);
		String tGan = timeGanzi.substring(0, 1);
		String tZi = timeGanzi.substring(1);
		
		if(StemBranch.JiaZiIndex.get(yearGanzi) == null) {
			throw new RuntimeException("year.ganzi.error");
		}
		if(StemBranch.JiaZiIndex.get(monthGanzi) == null) {
			throw new RuntimeException("month.ganzi.error");
		}
		if(StemBranch.JiaZiIndex.get(dayGanzi) == null) {
			throw new RuntimeException("date.ganzi.error");
		}
		if(StemBranch.JiaZiIndex.get(timeGanzi) == null) {
			throw new RuntimeException("time.ganzi.error");
		}
		
		String startgan = MonthGanStart.get(yGan);
		int idx = StemBranch.StemIndex.get(startgan);
		int monthidx = MonthZiIndex.get(mZi);
		idx = (idx + monthidx) % 10;
		String gan = StemBranch.Stems[idx];
		if(!gan.equals(mGan)) {
			throw new RuntimeException("monthgan.error");
		}
		
		startgan = TimeGanStart.get(dGan);
		int ganidx = StemBranch.StemIndex.get(startgan);
		if(tZi.equals(StemBranch.BRANCH_ZI)) {
			if(tGan.equals(startgan)) {
				return;
			}
			ganidx = (ganidx + 2) % 10;
			startgan = StemBranch.Stems[ganidx];
			if(tGan.equals(startgan)) {
				return;
			}
		}
		int timeziIdx = StemBranch.BranchIndex.get(tZi);
		ganidx = (ganidx + timeziIdx) % 10;
		gan = StemBranch.Stems[ganidx];
		if(!gan.equals(tGan)) {
			throw new RuntimeException("timegan.error");
		}
		
	}
	
	public static String[] getBirthes(int fromYear, boolean desc, int sz, String yearGanzi, String monthGanzi, String dayGanzi, String timeGanzi) {
		validate(yearGanzi, monthGanzi, dayGanzi, timeGanzi);
		int count = sz > 0 ? sz : 1;
		if(count > 3) {
			count = 3;
		}
		String[] dates = new String[count];
		int cnt = 0;
		String date = null;
		int fromyear = fromYear == 0 ? -1 : fromYear;
		do {
			date = getBirth(desc, fromyear, yearGanzi, monthGanzi, dayGanzi, timeGanzi);
			if(date != null) {
				dates[cnt++] = date;
			}
			if(desc) {
				fromyear -= 60;
			}else {
				fromyear += 60;
			}			
		}while(cnt < count || date == null);
		
		return dates;
	}
	
	public static void main(String[] args) {
		Calendar now = Calendar.getInstance();
		int fromyear = now.get(Calendar.YEAR);
		String year = "丙申";
		String month = "丙申";
		String date = "丙寅";
		String time = "丙申";
		
		String mgz = getMonthGanZi("丙", "申");
		System.out.println(mgz);
		
		String tgz = getTimeGanZi("丙", "子", false);
		System.out.println(tgz);
		
		tgz = getTimeGanZi("丙", "子", true);
		System.out.println(tgz);
		
//		String[] dates = getBirthes(fromyear, true, 3, year, month, date, time);
//		System.out.println(JsonUtility.encodePretty(dates));
//		
//		dates = getBirthes(fromyear, false, 3, year, month, date, time);
//		System.out.println(JsonUtility.encodePretty(dates));
	}
}
