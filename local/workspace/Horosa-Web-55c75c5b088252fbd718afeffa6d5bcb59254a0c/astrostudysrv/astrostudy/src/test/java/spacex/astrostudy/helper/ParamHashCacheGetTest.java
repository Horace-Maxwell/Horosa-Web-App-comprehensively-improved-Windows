package spacex.astrostudy.helper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
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
 * 键并入运行时版本:换了版本,同一组参数落到别的键,上一版留在盘上的结果不会再被读到;
 * 版本只进键,计算函数拿到的参数原样。
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

	@Test
	public void keyCarriesRuntimeVersion() throws Exception {
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("date", "1976-07-06");
		params.put("zone", "+08:00");
		String current = spacex.basecomm.constants.RuntimeWire.RUNTIME_VERSION;
		assertEquals("键里的版本就是运行时版本", current, staticField("CacheEpoch"));
		String now = ParamHashCacheHelper.hash(params);
		assertEquals(now, ParamHashCacheHelper.hash(params, current));
		assertNotEquals("换了运行时版本必须换键", now, ParamHashCacheHelper.hash(params, "0.0.0-runtime0"));
		assertNotEquals("不带版本的旧键不能与现键相同", now, ParamHashCacheHelper.hash(params, null));
		assertEquals("版本为空 = 纯参数哈希", ParamHashCacheHelper.hash(params, null), ParamHashCacheHelper.hash(params, ""));
		// 调用方自己放进参数的同名字段不能冒充版本段
		Map<String, Object> spoof = new LinkedHashMap<String, Object>(params);
		spoof.put("#runtime", current);
		assertNotEquals(now, ParamHashCacheHelper.hash(spoof, null));
	}

	@Test
	public void entryLeftByAnotherRuntimeVersionIsNotServed() throws Exception {
		Assume.assumeTrue("缓存总开关或本地层关闭时不适用", Boolean.TRUE.equals(staticField("EnableCache")) && Boolean.TRUE.equals(staticField("EnableLocal")));
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("date", "1990-01-01");
		params.put("zone", "+08:00");
		// 上一版(键里不带版本)与另一运行时版本各留一份「旧结果」在盘上,有效期未到
		for (String stale : new String[] { ParamHashCacheHelper.hash(params, null), ParamHashCacheHelper.hash(params, "0.0.0-runtime0") }) {
			Path file = Paths.get((String) staticField("LocalDir"), CLEAN_SCOPE, stale.substring(0, 2), stale + ".json");
			Files.createDirectories(file.getParent());
			long nowMs = System.currentTimeMillis();
			Files.writeString(file, "{\"createdAt\":" + nowMs + ",\"expAt\":" + (nowMs + 3600_000L) + ",\"value\":{\"from\":\"old\"}}", java.nio.charset.StandardCharsets.UTF_8);
		}
		final AtomicInteger calls = new AtomicInteger();
		final Map<String, Object> seen = new LinkedHashMap<String, Object>();
		java.util.function.Function<Map<String, Object>, Object> fun = (req) -> {
			calls.incrementAndGet();
			seen.putAll(req);
			Map<String, Object> out = new LinkedHashMap<String, Object>();
			out.put("from", "new");
			return out;
		};
		Object got = ParamHashCacheHelper.get(SCOPE, params, fun);
		assertEquals("旧版本留下的结果不得命中,必须重算", 1, calls.get());
		assertEquals("new", ((Map<?, ?>) got).get("from"));
		assertEquals("版本只进键:计算函数拿到的参数原样", params, seen);
		assertEquals("new", ((Map<?, ?>) ParamHashCacheHelper.get(SCOPE, params, fun)).get("from"));
		assertEquals("本版本自己写下的可以命中", 1, calls.get());
	}
}
