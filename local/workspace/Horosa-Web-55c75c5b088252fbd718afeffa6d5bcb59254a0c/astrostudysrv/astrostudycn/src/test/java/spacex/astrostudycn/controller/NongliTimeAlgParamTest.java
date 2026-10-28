package spacex.astrostudycn.controller;

import org.junit.Assert;
import org.junit.Test;

/**
 * /nongli/time 的时间算法归一:四档按实际换算口径(此前只认 1,2 / 3 都被折成真太阳时 ——
 * 全局设成平太阳时或春分定卯时的用户,六爻等走这个接口的页面占时与八字 / 本地引擎不同)。
 */
public class NongliTimeAlgParamTest {

	@Test
	public void fourCodesMapToCalcBasis() {
		Assert.assertEquals(0, NongliController.nongliTimeAlgCode(0));
		Assert.assertEquals(1, NongliController.nongliTimeAlgCode(1));
		Assert.assertEquals(1, NongliController.nongliTimeAlgCode(2));   // 春分定卯时 = 直接时间
		Assert.assertEquals(3, NongliController.nongliTimeAlgCode(3));   // 平太阳时
		Assert.assertEquals(0, NongliController.nongliTimeAlgCode(9));   // 认不出 = 真太阳时
	}
}
