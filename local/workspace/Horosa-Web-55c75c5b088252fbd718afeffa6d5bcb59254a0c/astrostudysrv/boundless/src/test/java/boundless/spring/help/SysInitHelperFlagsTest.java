package boundless.spring.help;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.lang.reflect.Method;

import org.junit.After;
import org.junit.BeforeClass;
import org.junit.Test;

import boundless.spring.help.interceptor.TransData;
import boundless.types.period.CronTask;

/**
 * 两种「缺省开」的开关口径:
 * <ul>
 *   <li>{@link SysInitHelper#propThenEnvOn}:系统属性(非空白才算设了)优先,其次环境变量;false / 0 为关,off 不算关;</li>
 *   <li>{@link SysInitHelper#flagEnabled}:同名系统属性优先,其次同名环境变量;0 / false / off 为关。</li>
 * </ul>
 * 响应保序、XML 扫描延迟初始化走前者;启动期定时任务走后者。
 */
public class SysInitHelperFlagsTest {

	private static final String PROP = "unit.sysinit.flag.prop";
	private static final String UNSET_ENV = "UNIT_SYSINIT_FLAG_ENV_NEVER_SET";
	private static final String CRON_KEY = "HOROSA_ENABLE_STARTUP_CRON";

	/** TransData 在类初始化时按开关定下响应表类型:先在开关未设时完成初始化,本类改属性不影响同进程其它用例。 */
	@BeforeClass
	public static void initTransDataWithDefaults() throws Exception {
		System.clearProperty("horosa.response.ordered");
		Class.forName(TransData.class.getName(), true, SysInitHelperFlagsTest.class.getClassLoader());
	}

	@After
	public void cleanup() {
		System.clearProperty(PROP);
		System.clearProperty("horosa.response.ordered");
		System.clearProperty("horosa.lazyinit.xmlscan");
		System.clearProperty(CRON_KEY);
	}

	private static boolean on(String value) {
		if (value == null) {
			System.clearProperty(PROP);
		} else {
			System.setProperty(PROP, value);
		}
		return SysInitHelper.propThenEnvOn(PROP, UNSET_ENV);
	}

	private static boolean flag(String value) {
		if (value == null) {
			System.clearProperty(PROP);
		} else {
			System.setProperty(PROP, value);
		}
		return SysInitHelper.flagEnabled(PROP);
	}

	private static boolean invokeStatic(Class<?> cls, String name) throws Exception {
		Method m = cls.getDeclaredMethod(name);
		m.setAccessible(true);
		return (Boolean) m.invoke(null);
	}

	@Test
	public void propThenEnvOnTable() {
		assertTrue(on(null));
		assertTrue(on(""));
		assertTrue(on("   "));
		assertFalse(on("false"));
		assertFalse(on(" FALSE "));
		assertFalse(on("0"));
		assertFalse(on(" 0 "));
		assertTrue(on("off"));
		assertTrue(on("1"));
		assertTrue(on("true"));
		assertTrue(on("no"));
	}

	@Test
	public void flagEnabledTable() {
		assertTrue(SysInitHelper.flagEnabled(null));
		assertTrue(SysInitHelper.flagEnabled(""));
		assertTrue(flag(null));
		assertTrue(flag(""));
		assertTrue(flag("   "));
		assertFalse(flag("0"));
		assertFalse(flag(" false "));
		assertFalse(flag("OFF"));
		assertFalse(flag("off"));
		assertTrue(flag("1"));
		assertTrue(flag("yes"));
	}

	@Test
	public void callersReadTheirOwnKeys() throws Exception {
		System.setProperty("horosa.response.ordered", "0");
		assertFalse(invokeStatic(TransData.class, "orderedResponseOn"));
		System.setProperty("horosa.response.ordered", "true");
		assertTrue(invokeStatic(TransData.class, "orderedResponseOn"));

		System.setProperty("horosa.lazyinit.xmlscan", "FALSE");
		assertFalse(LazyInitXmlScanPostProcessor.switchOn());
		System.setProperty("horosa.lazyinit.xmlscan", "off");
		assertTrue(LazyInitXmlScanPostProcessor.switchOn());

		System.setProperty(CRON_KEY, "off");
		assertFalse(invokeStatic(CronTask.class, "cronStartupEnabled"));
		System.setProperty(CRON_KEY, "1");
		assertTrue(invokeStatic(CronTask.class, "cronStartupEnabled"));
		assertEquals(Boolean.TRUE, Boolean.valueOf(SysInitHelper.flagEnabled(CRON_KEY)));
	}
}
