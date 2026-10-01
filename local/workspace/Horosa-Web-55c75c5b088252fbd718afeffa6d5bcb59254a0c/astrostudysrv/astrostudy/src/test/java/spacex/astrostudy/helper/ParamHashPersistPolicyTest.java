package spacex.astrostudy.helper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.After;
import org.junit.Test;

/** `-Dparamhash.persistable` 回退开关的判别向量:缺省 / 非 false 值 → 往返;false(不分大小写)→ 原引用。 */
public class ParamHashPersistPolicyTest {

	@After
	public void clearProperty() {
		System.clearProperty(ParamHashPersistPolicy.PROPERTY);
	}

	@Test
	public void defaultIsEnabledAndAppliesPersistable() {
		System.clearProperty(ParamHashPersistPolicy.PROPERTY);
		assertTrue(ParamHashPersistPolicy.enabled());
		Map<String, Object> raw = new HashMap<String, Object>();
		raw.put("k", "v");
		Object out = ParamHashPersistPolicy.apply(raw, v -> "plain:" + ((Map<?, ?>) v).get("k"));
		assertEquals("plain:v", out);
		System.setProperty(ParamHashPersistPolicy.PROPERTY, "true");
		assertTrue(ParamHashPersistPolicy.enabled());
		System.setProperty(ParamHashPersistPolicy.PROPERTY, "yes");
		assertTrue("只有 false 才关", ParamHashPersistPolicy.enabled());
	}

	@Test
	public void falseDisablesAndReturnsSameReference() {
		System.setProperty(ParamHashPersistPolicy.PROPERTY, "false");
		assertFalse(ParamHashPersistPolicy.enabled());
		Map<String, Object> raw = new HashMap<String, Object>();
		assertSame(raw, ParamHashPersistPolicy.apply(raw, v -> "never"));
		System.setProperty(ParamHashPersistPolicy.PROPERTY, "FALSE");
		assertFalse(ParamHashPersistPolicy.enabled());
	}

	@Test
	public void nullFunctionIsNoop() {
		System.clearProperty(ParamHashPersistPolicy.PROPERTY);
		Object raw = new Object();
		assertSame(raw, ParamHashPersistPolicy.apply(raw, null));
	}
}
