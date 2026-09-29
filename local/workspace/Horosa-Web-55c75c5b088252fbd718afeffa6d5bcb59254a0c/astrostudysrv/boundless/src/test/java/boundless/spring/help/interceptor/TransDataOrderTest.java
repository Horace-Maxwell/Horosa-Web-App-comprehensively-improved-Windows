package boundless.spring.help.interceptor;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.After;
import org.junit.Test;

/**
 * horosa_response_order_v1:响应主体顶层键序 = 生产方插入顺序,与池线程处理过多大的响应无关。
 * 旧实现(线程本地 HashMap clear() 不缩容 + 取数时拷进新 HashMap)下,第一例必红:
 * 撑大过的线程上 chart / surround、aspects / mutuals 的先后会反转。
 */
public class TransDataOrderTest {

	private static final List<String> CHART_KEYS = Arrays.asList(
		"params", "chart", "receptions", "mutuals", "declParallel", "aspects",
		"lots", "surround", "guoStarSect", "predictives", "predict");

	@After
	public void cleanup() {
		TransData.clearThreadContext();
	}

	private static Map<String, Object> chartShaped() {
		Map<String, Object> res = new LinkedHashMap<String, Object>();
		for (String k : CHART_KEYS) {
			res.put(k, k);
		}
		return res;
	}

	private static List<String> keysOf(Object out) {
		return new ArrayList<String>(((Map<String, Object>) out).keySet());
	}

	@Test
	public void grownThreadStillEmitsProducerOrder() {
		Map<String, Object> big = new LinkedHashMap<String, Object>();
		for (int i = 0; i < 40; i++) {
			big.put("k" + i, i);   // 模拟池线程先处理过一个 40 键的大响应,线程本地表已扩容
		}
		TransData.set(big);
		TransData.getResponseData();
		TransData.set(chartShaped());
		assertEquals(CHART_KEYS, keysOf(TransData.getResponseData()));
	}

	@Test
	public void freshAndGrownThreadsAgree() throws Exception {
		AtomicReference<List<String>> fresh = new AtomicReference<List<String>>();
		AtomicReference<List<String>> grown = new AtomicReference<List<String>>();
		Thread a = new Thread(() -> {
			TransData.set(chartShaped());
			fresh.set(keysOf(TransData.getResponseData()));
			TransData.clearThreadContext();
		});
		Thread b = new Thread(() -> {
			Map<String, Object> big = new LinkedHashMap<String, Object>();
			for (int i = 0; i < 100; i++) {
				big.put("x" + i, i);
			}
			TransData.set(big);
			TransData.set(chartShaped());
			grown.set(keysOf(TransData.getResponseData()));
			TransData.clearThreadContext();
		});
		a.start(); b.start(); a.join(); b.join();
		assertEquals(fresh.get(), grown.get());
		assertEquals(CHART_KEYS, fresh.get());
	}

	@Test
	public void setKeyAndSetAllKeepInsertionOrder() {
		TransData.set("b", 1);
		TransData.set("a", 2);
		Map<String, Object> more = new LinkedHashMap<String, Object>();
		more.put("z", 3);
		more.put("c", 4);
		TransData.setAll(more);
		assertEquals(Arrays.asList("b", "a", "z", "c"), keysOf(TransData.getResponseData()));
	}

	@Test
	public void switchDefaultsOn() {
		assertTrue(TransData.ORDERED_RESPONSE);
	}
}
