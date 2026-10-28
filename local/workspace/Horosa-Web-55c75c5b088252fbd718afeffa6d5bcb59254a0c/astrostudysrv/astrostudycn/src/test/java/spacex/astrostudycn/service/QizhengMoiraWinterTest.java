package spacex.astrostudycn.service;

import org.junit.Assert;
import org.junit.Test;

/**
 * 七政 Moira「冬」判据(出生月份 11 / 12 / 1):公元前日期串 "-300/12/10" 的月份是 12,不是 300(与前端 localMoiraIsWinter 同口径)。
 * 不需要 Python 计算服务。
 */
public class QizhengMoiraWinterTest {

	@Test
	public void bcDatesReadTheMonthNotTheYear() {
		Assert.assertTrue(QizhengMoiraRuleService.isWinterMonthOf("-300/12/10"));
		Assert.assertFalse(QizhengMoiraRuleService.isWinterMonthOf("-300/06/10"));
		Assert.assertTrue(QizhengMoiraRuleService.isWinterMonthOf("-0300-01-05"));
		Assert.assertFalse(QizhengMoiraRuleService.isWinterMonthOf("-0300-07-01"));
	}

	@Test
	public void modernDatesUnchanged() {
		Assert.assertTrue(QizhengMoiraRuleService.isWinterMonthOf("1990/11/18"));
		Assert.assertTrue(QizhengMoiraRuleService.isWinterMonthOf("2026/01/01"));
		Assert.assertFalse(QizhengMoiraRuleService.isWinterMonthOf("2026/07/01"));
		Assert.assertTrue("缺日期沿用旧缺省(按 1 月)", QizhengMoiraRuleService.isWinterMonthOf(""));
	}
}
