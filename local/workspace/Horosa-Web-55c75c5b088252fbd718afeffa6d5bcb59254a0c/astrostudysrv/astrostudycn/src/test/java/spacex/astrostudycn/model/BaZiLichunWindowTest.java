package spacex.astrostudycn.model;

import org.junit.Assert;
import org.junit.Test;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.model.FourColumns;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.TimeZiAlg;

/**
 * 年柱按立春本身判定 + 换算后跨出节气窗时重取窗口:
 * ① 二月立春前出生算上一年(节气窗会在生辰前补项以包住生辰,立春不在固定下标);
 * ② 儒略历年份(约 800–1582 年)立春落在一月下旬,一月立春后出生算当年;
 * ③ 真太阳时 / 平太阳时换算跨过立春:年柱只按换算后时刻与立春比较,不再另进一年;
 * ④ 换算后跨回交节前、落出按钟表时刻取的节气窗:重取窗口,不再报错,月柱按换算后时刻。
 * 需本地 Python 计算服务(127.0.0.1:8899)在线。
 */
public class BaZiLichunWindowTest {

	private static final String ZONE = "+08:00";

	private static BaZiDirect direct(String birth, String zone, String lon, String lat, TimeZiAlg alg) {
		BaZiDirect bz = new BaZiDirect(birth.startsWith("-") ? -1 : 1, birth, zone, lon, lat, alg, false, "年日", true, true, false, true);
		bz.calculate(PhaseType.HuoTu);
		return bz;
	}

	private static String yearMonth(BaZi bz) {
		FourColumns fc = bz.getFourColums();
		return fc.year.ganzi + fc.month.ganzi;
	}

	@Test
	public void februaryBeforeLichunIsPreviousYear() {
		// 2026 年立春 02-04 04:02(+08:00):逐日逐时按钟表时刻与立春比较
		String[] hours = {"00:30:00", "06:00:00", "12:00:00", "18:00:00", "23:30:00"};
		for (int d = 1; d <= 5; d++) {
			for (String h : hours) {
				String b = String.format("2026-02-%02d %s", d, h);
				boolean before = d < 4 || (d == 4 && h.compareTo("04:02:19") < 0);
				Assert.assertEquals(b, before ? "乙巳己丑" : "丙午庚寅", yearMonth(direct(b, ZONE, "118e27", "31n38", TimeZiAlg.DirectTime)));
			}
		}
		Assert.assertEquals("乙巳己丑", yearMonth(direct("2026-02-04 03:55:00", ZONE, "118e27", "31n38", TimeZiAlg.DirectTime)));
		Assert.assertEquals("丙午庚寅", yearMonth(direct("2026-02-04 04:10:00", ZONE, "118e27", "31n38", TimeZiAlg.DirectTime)));
		Assert.assertEquals("癸亥乙丑", yearMonth(direct("1984-02-01 12:00:00", ZONE, "118e27", "31n38", TimeZiAlg.RealSun)));
		// 南半球:年柱同样以立春为界(月柱另按南半球换算,此处不断言)
		Assert.assertEquals("乙巳", direct("2026-02-02 12:00:00", "+10:00", "151e12", "33s52", TimeZiAlg.DirectTime).getFourColums().year.ganzi);
	}

	@Test
	public void julianEraLichunInLateJanuary() {
		// 1000 年立春 01-30 03:24(+08:00,儒略历)
		Assert.assertEquals("己亥丁丑", yearMonth(direct("1000-01-29 12:00:00", ZONE, "118e27", "31n38", TimeZiAlg.DirectTime)));
		Assert.assertEquals("庚子戊寅", yearMonth(direct("1000-01-30 12:00:00", ZONE, "118e27", "31n38", TimeZiAlg.DirectTime)));
		Assert.assertEquals("庚子戊寅", yearMonth(direct("1000-01-31 12:00:00", ZONE, "118e27", "31n38", TimeZiAlg.RealSun)));
		Assert.assertEquals("庚子戊寅", yearMonth(direct("1000-02-01 12:00:00", ZONE, "118e27", "31n38", TimeZiAlg.DirectTime)));
		// 现代一月照旧算上一年
		Assert.assertEquals("乙巳己丑", yearMonth(direct("2026-01-31 12:00:00", ZONE, "118e27", "31n38", TimeZiAlg.RealSun)));
	}

	@Test
	public void solarTimeCrossingLichunAddsNoExtraYear() {
		// 126°38′E:真太阳时约 +10 分、平太阳时约 +24 分;1990 年立春 02-04 10:14(+08:00)。
		// 钟表 10:08 在立春前,换算后在立春后 → 庚午戊寅(此前换算跨立春再进一年 → 辛未庚寅)
		Assert.assertEquals("庚午戊寅", yearMonth(direct("1990-02-04 10:08:00", ZONE, "126e38", "45n45", TimeZiAlg.RealSun)));
		Assert.assertEquals("庚午戊寅", yearMonth(direct("1990-02-04 10:08:00", ZONE, "126e38", "45n45", TimeZiAlg.LocalMao)));
		Assert.assertEquals("己巳丁丑", yearMonth(direct("1990-02-04 10:08:00", ZONE, "126e38", "45n45", TimeZiAlg.DirectTime)));
	}

	@Test
	public void shiftedBirthOutsideClockWindowRefetches() {
		// 87°36′E 真太阳时 / 平太阳时约 −2 小时:1990 年芒种 06-06 06:46(+08:00)后 40 分钟出生,换算后在交节前
		// → 辛巳月,不再报「节气窗不够」;八字、六壬、四柱农历同一口径
		for (TimeZiAlg alg : new TimeZiAlg[] {TimeZiAlg.RealSun, TimeZiAlg.LocalMao}) {
			Assert.assertEquals(alg.name(), "庚午辛巳", yearMonth(direct("1990-06-06 07:26:30", ZONE, "87e36", "43n48", alg)));
			LiuReng lr = new LiuReng(1, "1990-06-06 07:26:30", ZONE, "87e36", "43n48", alg, false, "日", true, true);
			lr.calculate(PhaseType.ShuiTu);
			Assert.assertEquals(alg.name(), "庚午辛巳", yearMonth(lr));
			OnlyFourColumns of = new OnlyFourColumns(1, "1990-06-06 07:26:30", ZONE, "87e36", "43n48", true, BaZiGender.Male, alg, false, true);
			FourColumns fc = (FourColumns) of.getNongli().get("bazi");
			Assert.assertEquals(alg.name(), "庚午辛巳", fc.year.ganzi + fc.month.ganzi);
		}
		// 换算后仍在交节后:壬午月
		Assert.assertEquals("庚午壬午", yearMonth(direct("1990-06-06 10:36:30", ZONE, "87e36", "43n48", TimeZiAlg.RealSun)));
	}
}
