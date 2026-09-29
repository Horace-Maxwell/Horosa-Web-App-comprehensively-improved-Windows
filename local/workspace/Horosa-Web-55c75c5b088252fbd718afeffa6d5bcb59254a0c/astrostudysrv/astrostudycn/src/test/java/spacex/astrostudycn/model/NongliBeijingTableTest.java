package spacex.astrostudycn.model;

import org.junit.Assert;
import org.junit.Test;

import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudy.model.NongLi;

/**
 * 农历按国标口径以北京时间编算的农历表查,出生地不在东八区时按出生地日期查(与八字主盘 / 紫微本地路径同口径);
 * 此前按出生地时区求朔得「当地农历」,西半球常多一天、东九区及以东少一天。
 * 需本地 Python 计算服务(127.0.0.1:8899)在线。
 */
public class NongliBeijingTableTest {

	private static NongLi nongli(String birth, String zone, String lon) {
		return NongliHelper.getNongLi(1, birth, zone, lon, true, true, true);
	}

	@Test
	public void overseasDateLooksUpTheBeijingTable() {
		// 纽约 1990-01-05:按北京农历表是腊月初九(此前按当地朔为腊月初十)
		NongLi ny = nongli("1990-01-05 07:33:00", "-05:00", "74w00");
		Assert.assertEquals(12, ny.monthInt);
		Assert.assertEquals(9, ny.dayInt);
		NongLi bj = nongli("1990-01-05 07:33:00", "+08:00", "120e00");
		Assert.assertEquals(9, bj.dayInt);
	}

	@Test
	public void newYearFollowsBeijingDate() {
		// 2024 春节是北京时间 2 月 10 日(朔 06:59);纽约同一日历日期也是正月初一,前一天是腊月三十(癸卯年)
		NongLi first = nongli("2024-02-10 12:00:00", "-05:00", "74w00");
		Assert.assertEquals(1, first.monthInt);
		Assert.assertEquals(1, first.dayInt);
		Assert.assertEquals("甲辰", first.year);
		Assert.assertEquals("06:59:11（北京时间）", first.moonTime);
		NongLi eve = nongli("2024-02-09 12:00:00", "-05:00", "74w00");
		Assert.assertEquals(12, eve.monthInt);
		Assert.assertEquals(30, eve.dayInt);
		Assert.assertEquals("癸卯", eve.year);
		Assert.assertNull(eve.moonTime);
		// 东八区的朔时刻不加标注
		Assert.assertEquals("06:59:11", nongli("2024-02-10 12:00:00", "+08:00", "120e00").moonTime);
	}

	@Test
	public void leapMonthOf2033IsTheEleventhAndConsistentAcrossTheYearBoundary() {
		// 冬至所在月按日期定为十一月:2033 年闰十一月(12-22 起),此前误成闰七月且 12 月与次年 1 月叫法前后矛盾
		NongLi sep = nongli("2033-09-01 12:00:00", "+08:00", "120e00");
		Assert.assertEquals(8, sep.monthInt);
		Assert.assertFalse(sep.leap);
		NongLi dec = nongli("2033-12-25 12:00:00", "+08:00", "120e00");
		Assert.assertEquals(11, dec.monthInt);
		Assert.assertTrue(dec.leap);
		NongLi jan = nongli("2034-01-01 12:00:00", "+08:00", "120e00");
		Assert.assertEquals(11, jan.monthInt);
		Assert.assertTrue(jan.leap);
	}
}
