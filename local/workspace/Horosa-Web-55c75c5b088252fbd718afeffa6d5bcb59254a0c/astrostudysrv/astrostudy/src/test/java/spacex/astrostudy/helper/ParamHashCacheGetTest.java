package spacex.astrostudy.helper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.After;
import org.junit.Assume;
import org.junit.Before;
import org.junit.Test;

/**
 * ParamHashCacheHelper.get():同一组参数(与键的插入顺序无关)只算一次,第二次直接命中缓存;
 * 本地缓存文件落在「清洗后的作用域 / 哈希前两位 / 哈希.json」,哈希即 {@link ParamHashCacheHelper#hash(Map)},
 * 缓存键末段与 {@link ParamHashCacheHelper#buildCacheKey(String, Map)} 同一个哈希。
 */
public class ParamHashCacheGetTest {

	private static final String SCOPE = "unit/get key";
	private static final String CLEAN_SCOPE = "unit_get_key";

	private Path localRoot;
	private boolean rootExisted;
	private boolean parentExisted;

	@Before
	public void clean() throws Exception {
		localRoot = Paths.get((String) staticField("LocalDir"));
		rootExisted = Files.exists(localRoot);
		parentExisted = localRoot.getParent() != null && Files.exists(localRoot.getParent());
		ParamHashCacheHelper.clearByScope(SCOPE);
	}

	@After
	public void cleanAfter() throws Exception {
		ParamHashCacheHelper.clearByScope(SCOPE);
		// 只收拾本用例新建出来、且已清空的缓存根目录,别人的缓存一概不碰
		if (!rootExisted) {
			deleteIfEmpty(localRoot);
		}
		if (!parentExisted && localRoot.getParent() != null) {
			deleteIfEmpty(localRoot.getParent());
		}
	}

	private static void deleteIfEmpty(Path dir) {
		try {
			Files.deleteIfExists(dir);
		} catch (java.io.IOException notEmpty) {
			// 目录里还有别的东西:保留
		}
	}

	private static Object staticField(String name) throws Exception {
		Field f = ParamHashCacheHelper.class.getDeclaredField(name);
		f.setAccessible(true);
		return f.get(null);
	}

	@Test
	public void sameParamsComputeOnceAndLandOnHashedLocalPath() throws Exception {
		Assume.assumeTrue("缓存总开关或本地层关闭时不适用", Boolean.TRUE.equals(staticField("EnableCache")) && Boolean.TRUE.equals(staticField("EnableLocal")));
		Map<String, Object> first = new LinkedHashMap<String, Object>();
		first.put("date", "1976-07-06");
		first.put("zone", "+08:00");
		first.put("nested", new LinkedHashMap<String, Object>(Map.of("b", 2, "a", 1)));
		Map<String, Object> second = new LinkedHashMap<String, Object>();
		second.put("nested", new LinkedHashMap<String, Object>(Map.of("a", 1, "b", 2)));
		second.put("zone", "+08:00");
		second.put("date", "1976-07-06");

		final AtomicInteger calls = new AtomicInteger();
		java.util.function.Function<Map<String, Object>, Object> fun = (req) -> {
			Map<String, Object> out = new LinkedHashMap<String, Object>();
			out.put("n", calls.incrementAndGet());
			out.put("date", req.get("date"));
			return out;
		};

		Object a = ParamHashCacheHelper.get(SCOPE, first, fun);
		Object b = ParamHashCacheHelper.get(SCOPE, second, fun);
		assertEquals(1, calls.get());
		assertEquals(a, b);

		String hash = ParamHashCacheHelper.hash(first);
		assertEquals(hash, ParamHashCacheHelper.hash(second));
		String key = ParamHashCacheHelper.buildCacheKey(SCOPE, second);
		assertTrue(key, key.endsWith(hash));
		assertTrue(key, key.contains(CLEAN_SCOPE));
		Path local = Paths.get((String) staticField("LocalDir"), CLEAN_SCOPE, hash.substring(0, 2), hash + ".json");
		assertTrue("本地缓存文件应落在清洗后的作用域 + 参数哈希路径:" + local, Files.isRegularFile(local));
	}
}
