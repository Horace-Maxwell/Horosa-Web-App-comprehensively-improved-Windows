package spacex.astrostudy.helper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.Test;

import boundless.utility.JsonUtility;

/**
 * ParamHashCacheHelper.persistable():冷路径把含 Enum / POJO 的响应树 JSON 往返成纯 Map/List/标量树,
 * 让磁盘缓存不再对这类响应静默不落盘。契约:① 响应 JSON 字节不变;② 输出树内无 Enum / POJO;
 * ③ 已是纯树的输入原对象返回(幂等、零拷贝);④ null 透传。
 */
public class ParamHashPersistableTest {

	enum Sample { A, B }

	public static class Pojo {
		public String name = "n";
		public int v = 3;
		public Sample s = Sample.B;
		public List<Integer> xs = Arrays.asList(1, 2);
	}

	private static void assertPlainTree(Object o) {
		if(o == null || o instanceof String || o instanceof Number || o instanceof Boolean) {
			return;
		}
		if(o instanceof Map) {
			for(Object v : ((Map<?, ?>) o).values()) {
				assertPlainTree(v);
			}
			return;
		}
		if(o instanceof List) {
			for(Object v : (List<?>) o) {
				assertPlainTree(v);
			}
			return;
		}
		throw new AssertionError("非纯树节点: " + o.getClass().getName());
	}

	@Test
	public void enumAndPojoTreeKeepsJsonBytesAndBecomesPlain() {
		Map<String, Object> raw = new LinkedHashMap<String, Object>();
		raw.put("z", 1);
		raw.put("a", "文本");
		raw.put("e", Sample.A);
		raw.put("d", 1.5);
		raw.put("l", Arrays.asList(Sample.B, 2L, "x"));
		raw.put("p", new Pojo());
		raw.put("n", null);
		raw.put("b", Boolean.TRUE);
		Object plain = ParamHashCacheHelper.persistable(raw);
		assertEquals(JsonUtility.encode(raw), JsonUtility.encode(plain));
		assertTrue(plain instanceof Map);
		assertPlainTree(plain);
		// 幂等:纯树再进来原对象返回
		assertSame(plain, ParamHashCacheHelper.persistable(plain));
	}

	@Test
	public void plainInputIsReturnedAsIsAndNullPassesThrough() {
		Map<String, Object> m = new HashMap<String, Object>();
		m.put("k", Arrays.asList(1, "s", 2.5));
		assertSame(m, ParamHashCacheHelper.persistable(m));
		assertNull(ParamHashCacheHelper.persistable(null));
	}
}
