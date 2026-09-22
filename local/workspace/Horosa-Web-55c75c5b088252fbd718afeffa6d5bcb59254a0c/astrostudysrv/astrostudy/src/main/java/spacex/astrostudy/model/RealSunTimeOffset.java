package spacex.astrostudy.model;

import boundless.utility.ConvertUtility;
import boundless.utility.DateTimeUtility;
import boundless.utility.PositionUtility;
import boundless.utility.StringUtility;

/**
 * 真太阳时偏移(秒) = 经度时差 + 均时差。
 *
 * [Q-195/T-121] 均时差改为 NOAA/Meeus 高精度级数(太阳平黄经 / 平近点角 / 偏心率 / 黄赤交角级数,误差 <15 s,1800–2200),
 * 与前端本地引擎 baziLunarLocal.equationOfTime 同式同值。旧「月-日 → 秒」366 行查表(日粒度 + 年际漂移,与 swiss /
 * 本地公式差可达约 1′46″)已整体废止:时辰界骑线生辰的紫微 / 四柱 / 择日在 Java 路径与本地引擎分叉即源于此。
 * 输入取完整出生日时(含时区),不再只看月-日。
 */
public class RealSunTimeOffset {

	/** 均时差(分钟,视−平,正=真太阳快);jd = UT 儒略日。 */
	public static double equationOfTimeMinutes(double jd) {
		double T = (jd - 2451545.0) / 36525.0;
		double rad = Math.PI / 180.0;
		double L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360.0;
		double M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
		double e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
		double eps0 = 23.43929111 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600.0;
		double y = Math.tan((eps0 / 2.0) * rad);
		double y2 = y * y;
		double sin2L0 = Math.sin(2.0 * L0 * rad);
		double sinM = Math.sin(M * rad);
		double cos2L0 = Math.cos(2.0 * L0 * rad);
		double sin4L0 = Math.sin(4.0 * L0 * rad);
		double sin2M = Math.sin(2.0 * M * rad);
		double eotRad = y2 * sin2L0 - 2.0 * e * sinM + 4.0 * e * y2 * sinM * cos2L0 - 0.5 * y2 * y2 * sin4L0 - 1.25 * e * e * sin2M;
		return (eotRad / rad) * 4.0;	// 度 → 分钟(1° = 4 min)
	}

	/** 时区 "±HH:MM" → 基准经度(度);分钟段一并折算(+05:30 → 82.5°,旧实现只取小时 → 印度真太阳时差半小时)。 */
	public static double getBaseLonByZone(String zone) {
		if(zone == null || zone.length() < 2) {
			return 0;
		}
		String sym = zone.substring(0, 1);
		String rest = zone.substring(1);
		String[] hm = StringUtility.splitString(rest, ':');
		int h = hm.length > 0 ? ConvertUtility.getValueAsInt(hm[0]) : 0;
		int m = hm.length > 1 ? ConvertUtility.getValueAsInt(hm[1]) : 0;
		double lon = (h + m / 60.0) * 15.0;
		if(sym.equals("-")) {
			return -lon;
		}
		return lon;
	}

	/** 经度时差(秒,仅经度,不含均时差)= 平太阳时偏移。 */
	public static int getMeanSolarOffset(String zone, String lon) {
		double baseLon = getBaseLonByZone(zone);
		double gpsLon = PositionUtility.convertLonStrToDegree(lon);
		return (int) Math.round((gpsLon - baseLon) * 240.0);
	}

	/** 真太阳时偏移(秒)= 经度时差 + 均时差;jdUt 为出生时刻的 UT 儒略日。 */
	public static int getOffset(double jdUt, double gpsLon, double baseLon) {
		double lonTmDelta = (gpsLon - baseLon) * 240.0;
		double eotSeconds = equationOfTimeMinutes(jdUt) * 60.0;
		return (int) Math.round(lonTmDelta + eotSeconds);
	}

	/** birth = "yyyy-MM-dd[ HH:mm[:ss]]"(负年份 "-0500-..." 允许),zone = "±HH:MM",lon = 经度串(119e19 / 120.5)。 */
	public static int getOffsetByDate(String birth, String zone, String lon) {
		double jdUt = DateTimeUtility.getDateNum(birth, zone);
		double baseLon = getBaseLonByZone(zone);
		double gpsLon = PositionUtility.convertLonStrToDegree(lon);
		return getOffset(jdUt, gpsLon, baseLon);
	}

}
