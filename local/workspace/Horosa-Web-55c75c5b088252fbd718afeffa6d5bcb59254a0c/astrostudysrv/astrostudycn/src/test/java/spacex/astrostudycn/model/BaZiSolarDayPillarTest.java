package spacex.astrostudycn.model;

import org.junit.Assert;
import org.junit.Test;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.model.FourColumns;
import spacex.astrostudycn.constants.TimeZiAlg;

/**
 * 真太阳时 / 平太阳时的日柱:按换算后的出生时刻取(含 23 点换日),不再另减一天。
 * 此前偏移 ≥ 约 2 小时的西部地点子时出生(或 0 点刚过、换算到前一天 23 点前),日柱被多减一天、时干随之错。
 * 偏移小的地点结果不变。需本地 Python 计算服务(127.0.0.1:8899)在线。
 */
public class BaZiSolarDayPillarTest {

	private static final String ZONE = "+08:00";

	private static String pillars(String birth, String lon, String lat, TimeZiAlg alg) {
		BaZiDirect bz = new BaZiDirect(1, birth, ZONE, lon, lat, alg, false, "年日", true, true, false, true);
		bz.calculate(PhaseType.HuoTu);
		FourColumns fc = bz.getFourColums();
		return fc.year.ganzi + fc.month.ganzi + fc.day.ganzi + fc.time.ganzi;
	}

	@Test
	public void westernLateNightUsesDayOfConvertedTime() {
		// 87°36′E:真太阳时约 −2 小时 8 分
		// 05-18 23:30 → 换算 21:22(05-18 亥时)→ 癸未日癸亥时(此前 壬午 辛亥)
		Assert.assertEquals("庚午辛巳癸未癸亥", pillars("1990-05-18 23:30:00", "87e36", "43n48", TimeZiAlg.RealSun));
		Assert.assertEquals("庚午辛巳癸未癸亥", pillars("1990-05-18 23:30:00", "87e36", "43n48", TimeZiAlg.LocalMao));
		// 05-18 00:10 → 换算 05-17 22:02(亥时)→ 壬午日辛亥时(此前 辛巳 己亥)
		Assert.assertEquals("庚午辛巳壬午辛亥", pillars("1990-05-18 00:10:00", "87e36", "43n48", TimeZiAlg.RealSun));
		// 01-05 23:13 → 换算 20:58(01-05 戌时)→ 庚午日丙戌时(此前 己巳 甲戌)
		Assert.assertEquals("己巳丙子庚午丙戌", pillars("1990-01-05 23:13:25", "87e36", "43n48", TimeZiAlg.RealSun));
	}

	@Test
	public void smallOffsetUnchanged() {
		// 118°27′E:偏移只有几分钟,子时出生结果不变
		Assert.assertEquals("庚午辛巳癸未壬子", pillars("1990-05-18 00:10:00", "118e27", "31n38", TimeZiAlg.RealSun));
		Assert.assertEquals("庚午辛巳甲申甲子", pillars("1990-05-18 23:30:00", "118e27", "31n38", TimeZiAlg.RealSun));
		Assert.assertEquals("庚午辛巳甲申甲子", pillars("1990-05-18 23:30:00", "118e27", "31n38", TimeZiAlg.DirectTime));
	}

	@Test
	public void meanSolarUsesLongitudeMinutes() {
		// 118°27′E 平太阳时 −372 秒:15:07:29 → 15:01:17 申时(此前按 −471 秒落未时)
		Assert.assertEquals("甲辰丁卯戊戌庚申", pillars("2024-04-04 15:07:29", "118e27", "31n38", TimeZiAlg.LocalMao));
	}
}
