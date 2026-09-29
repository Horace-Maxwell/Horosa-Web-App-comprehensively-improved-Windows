package spacex.astrostudycn.model;

import java.util.Map;

import org.junit.Assert;
import org.junit.Test;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudycn.constants.TimeZiAlg;

/**
 * 跨公元纪元的大运岁数 / 小运年份:年份是「显示年」(公元前 1 年 = -1,没有公元 0 年)。
 * 公元前 5 年 5 月出生、公元 3 年起运 → 实足 7 年(前5→前4→前3→前2→前1→1→2→3);小运年份前5…前1 之后是公元 1 年。
 * 公元年份的盘与直接相减 / 相加逐一相同。需本地 Python 计算服务(127.0.0.1:8899)在线。
 */
public class BaZiEraBoundaryTest {

	private static BaZiDirect direct(String birth) {
		BaZiDirect bz = new BaZiDirect(birth.startsWith("-") ? -1 : 1, birth, "+08:00", "118e27", "31n38",
				TimeZiAlg.RealSun, false, "年日", true, true, false, true);
		bz.calculate(PhaseType.HuoTu);
		return bz;
	}

	@Test
	public void bcBirthLuckStartingInAdDoesNotCountYearZero() {
		BaZiDirect bz = direct("-0005-05-18 10:00:00");
		Assert.assertEquals(3, bz.direction[0].startYear);
		Assert.assertEquals(7, bz.direction[0].age);
		Assert.assertEquals(17, bz.direction[1].age);
		int[] years = new int[7];
		for (int i = 0; i < years.length; i++) {
			years[i] = bz.smallDirection[i].year;
			Assert.assertEquals(i, bz.smallDirection[i].age);
		}
		Assert.assertArrayEquals(new int[] {-5, -4, -3, -2, -1, 1, 2}, years);
	}

	@Test
	@SuppressWarnings("unchecked")
	public void onlyFourColumnsSameAge() {
		OnlyFourColumns of = new OnlyFourColumns(-1, "-0005-05-18 10:00:00", "+08:00", "118e27", "31n38", true,
				spacex.astrostudycn.constants.BaZiGender.Male, TimeZiAlg.RealSun, false, true);
		Map<String, Object> direct = (Map<String, Object>) of.getNongli().get("direct");
		FateDirect[] dirs = (FateDirect[]) direct.get("direction");
		Assert.assertEquals(3, dirs[0].startYear);
		Assert.assertEquals(7, dirs[0].age);
	}

	@Test
	public void adBirthUnchanged() {
		BaZiDirect bz = direct("1990-05-18 10:00:00");
		Assert.assertEquals(bz.direction[0].startYear - 1990, bz.direction[0].age);
		for (int i = 0; i < 12; i++) {
			Assert.assertEquals(1990 + i, bz.smallDirection[i].year);
		}
	}
}
