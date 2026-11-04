package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.Test;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import boundless.utility.JsonUtility;

/**
 * 决策层转发合同 + 敌意面:路径与头(只三个头、不透传自定义头)· 缺省与自定义基址 · 出站守卫拒绝(元数据地址 / 本应用 9999 与 8899)·
 * 不跟随重定向 · 总时限 · 429 + Retry-After 重试且不超剩余时限 · 401 / 422 不重试 · 批量单项隔离且序不乱 · 请求与响应上限 ·
 * 错误体不含上游正文与 key。全部外呼指向本机假上游,绝不打真实网络。
 */
public class AISystemOneServiceTest {

	private static final String KEY = "ts-secret-KEY-9f8e7d";
	private static final String UPSTREAM_SECRET_BODY = "UPSTREAM-BODY-MUST-NOT-LEAK";

	private static final class FakeUpstream implements AutoCloseable {
		final HttpServer server;
		final int port;
		final List<String> paths = Collections.synchronizedList(new ArrayList<String>());
		final List<Map<String, List<String>>> headers = Collections.synchronizedList(new ArrayList<Map<String, List<String>>>());
		final List<String> bodies = Collections.synchronizedList(new ArrayList<String>());
		final AtomicInteger hits = new AtomicInteger();

		FakeUpstream() throws IOException {
			server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			port = server.getAddress().getPort();
			server.createContext("/", exchange -> {
				String path = exchange.getRequestURI().getPath();
				hits.incrementAndGet();
				paths.add(path);
				headers.add(new LinkedHashMap<String, List<String>>(exchange.getRequestHeaders()));
				String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
				bodies.add(body);
				try {
					route(exchange, path, body);
				} catch (Exception ignored) {
					try {
						exchange.close();
					} catch (Exception ignoredToo) {
						// 收尾失败无关判据
					}
				}
			});
			server.setExecutor(Executors.newCachedThreadPool());
			server.start();
		}

		private void route(HttpExchange exchange, String path, String body) throws IOException, InterruptedException {
			if (path.endsWith("/ok/v1/systemone") || path.equals("/v1/systemone")) {
				write(exchange, 200, okBody("jev-2026-09-01"));
			} else if (path.startsWith("/slow")) {
				Thread.sleep(2500L);
				write(exchange, 200, okBody("jev-slow"));
			} else if (path.startsWith("/redirect")) {
				exchange.getResponseHeaders().add("Location", "http://127.0.0.1:" + port + "/ok/v1/systemone");
				exchange.sendResponseHeaders(302, -1);
				exchange.close();
			} else if (path.startsWith("/rate-then-ok")) {
				if (hits.get() == 1) {
					exchange.getResponseHeaders().add("Retry-After", "0");
					write(exchange, 429, "{\"error\":\"" + UPSTREAM_SECRET_BODY + "\"}");
				} else {
					write(exchange, 200, okBody("jev-after-retry"));
				}
			} else if (path.startsWith("/rate-long")) {
				exchange.getResponseHeaders().add("Retry-After", "120");
				write(exchange, 429, "{\"error\":\"" + UPSTREAM_SECRET_BODY + "\"}");
			} else if (path.startsWith("/auth")) {
				write(exchange, 401, "{\"error\":\"" + UPSTREAM_SECRET_BODY + "\"}");
			} else if (path.startsWith("/unprocessable")) {
				write(exchange, 422, "{\"error\":\"" + UPSTREAM_SECRET_BODY + " " + body + "\"}");
			} else if (path.startsWith("/flaky")) {
				// 批量:state.n == 2 的那项恒 500,其余 200(单项隔离)
				if (body.contains("\"n\":2")) {
					write(exchange, 500, "{\"error\":\"" + UPSTREAM_SECRET_BODY + "\"}");
				} else {
					String n = body.replaceAll("(?s).*\"n\":(\\d+).*", "$1");
					write(exchange, 200, "{\"model\":\"jev-batch\",\"answers\":{\"q\":{\"type\":\"noul\",\"noul\":0." + n + "1}},\"usage\":{\"input_tokens\":3,\"output_tokens\":1}}");
				}
			} else if (path.startsWith("/huge")) {
				byte[] big = new byte[AISystemOneService.RESPONSE_MAX_BYTES + 4096];
				Arrays.fill(big, (byte) 'a');
				exchange.getResponseHeaders().add("Content-Type", "application/json");
				exchange.sendResponseHeaders(200, big.length);
				exchange.getResponseBody().write(big);
				exchange.close();
			} else if (path.startsWith("/notjson")) {
				write(exchange, 200, "<html>not json</html>");
			} else {
				write(exchange, 404, "{\"error\":\"nf\"}");
			}
		}

		private static String okBody(String model) {
			return "{\"model\":\"" + model + "\",\"answers\":{\"is_short\":{\"type\":\"noul\",\"noul\":0.97},"
				+ "\"kind\":{\"type\":\"choice\",\"choice\":\"a\",\"probabilities\":{\"a\":0.9,\"b\":0.1},\"confidence\":0.88}},"
				+ "\"usage\":{\"input_tokens\":12,\"output_tokens\":2}}";
		}

		private static void write(HttpExchange exchange, int status, String body) throws IOException {
			byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(status, bytes.length);
			exchange.getResponseBody().write(bytes);
			exchange.close();
		}

		String base(String prefix) {
			return "http://127.0.0.1:" + port + prefix;
		}

		@Override
		public void close() {
			server.stop(0);
		}
	}

	private static AISystemOneService svc() {
		return new AISystemOneService(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).followRedirects(HttpClient.Redirect.NEVER).build());
	}

	private static Map<String, Object> questions() {
		Map<String, Object> q = new LinkedHashMap<String, Object>();
		Map<String, Object> noul = new LinkedHashMap<String, Object>();
		noul.put("type", "noul");
		noul.put("instructions", "Is `text` shorter than ten characters?");
		Map<String, Object> crit = new LinkedHashMap<String, Object>();
		crit.put("true", "fewer than ten");
		crit.put("false", "ten or more");
		noul.put("criteria", crit);
		q.put("is_short", noul);
		return q;
	}

	private static Map<String, Object> item(Object state) {
		Map<String, Object> it = new LinkedHashMap<String, Object>();
		it.put("state", state);
		it.put("questions", questions());
		return it;
	}

	private static Map<String, Object> params(String baseUrl, Object state, int timeoutMs, int maxRetries) {
		Map<String, Object> p = new LinkedHashMap<String, Object>();
		p.put("apiKey", KEY);
		p.put("baseUrl", baseUrl);
		p.put("timeoutMs", Integer.valueOf(timeoutMs));
		p.put("maxRetries", Integer.valueOf(maxRetries));
		p.put("request", item(state));
		return p;
	}

	private static Map<String, Object> state(String text) {
		Map<String, Object> s = new LinkedHashMap<String, Object>();
		s.put("text", text);
		return s;
	}

	private static void assertNoLeak(Map<String, Object> result) {
		String dump = JsonUtility.encode(result);
		assertFalse("错误体不得含上游正文: " + dump, dump.contains(UPSTREAM_SECRET_BODY));
		assertFalse("回体不得含 key: " + dump, dump.contains(KEY));
	}

	@Test
	public void postsToFixedPathWithOnlyThreeHeadersAndReturnsNormalizedShape() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			Map<String, Object> p = params(up.base("/ok/"), state("ping"), 5000, 0);
			Map<String, Object> custom = new LinkedHashMap<String, Object>();
			custom.put("X-Evil", "1");
			p.put("headers", custom);   // 调用方自定义头必须被无视
			p.put("model", "JEV-PREVIEW");
			Map<String, Object> r = svc().ask(p);
			assertEquals(Boolean.TRUE, r.get("ok"));
			assertEquals(Integer.valueOf(200), r.get("status"));
			assertEquals("jev-2026-09-01", r.get("model"));
			assertTrue(r.get("answers") instanceof Map);
			assertTrue(r.get("usage") instanceof Map);
			assertEquals(1, up.hits.get());
			assertEquals("/ok/v1/systemone", up.paths.get(0));
			Map<String, List<String>> h = up.headers.get(0);
			assertEquals("Bearer " + KEY, h.get("Authorization").get(0));
			assertTrue(h.get("Content-type").get(0).startsWith("application/json"));
			assertEquals("application/json", h.get("Accept").get(0));
			assertFalse("不透传调用方自定义头", h.containsKey("X-evil"));
			Map<String, Object> sent = JsonUtility.toDictionary(up.bodies.get(0));
			assertEquals("jev-preview", sent.get("model"));
			assertTrue(sent.get("state") instanceof Map);
			assertTrue(sent.get("questions") instanceof Map);
			assertEquals(3, sent.size());
			assertNoLeak(r);
		}
	}

	@Test
	public void endpointResolutionDefaultsToOfficialBaseAndStripsTrailingSlashes() {
		assertEquals("https://api.typesafe.ai/v1/systemone", AISystemOneService.resolveEndpoint(""));
		assertEquals("https://api.typesafe.ai/v1/systemone", AISystemOneService.resolveEndpoint(null));
		assertEquals("http://127.0.0.1:18081/v1/systemone", AISystemOneService.resolveEndpoint("http://127.0.0.1:18081///"));
		assertEquals("jev-latest", AISystemOneService.normalizeModel(""));
		assertEquals("jev-latest", AISystemOneService.normalizeModel("gpt-4o"));
		assertEquals("jev-preview", AISystemOneService.normalizeModel("jev-preview"));
	}

	@Test
	public void outboundGuardRejectsMetadataAndOwnPortsWithoutTouchingNetwork() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			for (String base : new String[] { "http://169.254.169.254", "http://127.0.0.1:9999", "http://127.0.0.1:8899", "http://user:pw@127.0.0.1:" + up.port, "ftp://127.0.0.1:" + up.port, "http://2130706433" }) {
				Map<String, Object> r = svc().ask(params(base, state("x"), 3000, 0));
				assertEquals("必须拒: " + base, Boolean.FALSE, r.get("ok"));
				assertEquals("必须拒: " + base, AISystemOneService.E_GUARD, r.get("code"));
				assertNoLeak(r);
			}
			assertEquals("守卫拒绝的请求不得出网", 0, up.hits.get());
		}
	}

	@Test
	public void neverFollowsRedirects() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			Map<String, Object> r = svc().ask(params(up.base("/redirect"), state("x"), 3000, 2));
			assertEquals(Boolean.FALSE, r.get("ok"));
			assertEquals(Integer.valueOf(302), r.get("status"));
			assertEquals(AISystemOneService.E_HTTP, r.get("code"));
			assertEquals("3xx 不重试、不跟跳", 1, up.hits.get());
			assertNoLeak(r);
		}
	}

	@Test
	public void totalDeadlineBoundsSlowUpstream() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			long t0 = System.currentTimeMillis();
			Map<String, Object> r = svc().ask(params(up.base("/slow"), state("x"), 600, 2));
			long dt = System.currentTimeMillis() - t0;
			assertEquals(Boolean.FALSE, r.get("ok"));
			assertEquals(AISystemOneService.E_TIMEOUT, r.get("code"));
			assertTrue("总时限 600ms 内返回,实测 " + dt, dt < 2000L);
			assertNoLeak(r);
		}
	}

	@Test
	public void retriesRateLimitHonouringRetryAfterAndStopsWhenRetriesAreZero() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			Map<String, Object> r = svc().ask(params(up.base("/rate-then-ok"), state("x"), 5000, 1));
			assertEquals(Boolean.TRUE, r.get("ok"));
			assertEquals("jev-after-retry", r.get("model"));
			assertEquals(2, up.hits.get());
			assertNoLeak(r);
		}
		try (FakeUpstream up = new FakeUpstream()) {
			Map<String, Object> r = svc().ask(params(up.base("/rate-then-ok"), state("x"), 5000, 0));
			assertEquals(Boolean.FALSE, r.get("ok"));
			assertEquals(Integer.valueOf(429), r.get("status"));
			assertEquals(AISystemOneService.E_HTTP, r.get("code"));
			assertEquals("maxRetries=0 只打一次", 1, up.hits.get());
			assertNoLeak(r);
		}
	}

	@Test
	public void retryAfterLongerThanRemainingDeadlineIsNotWaitedFor() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			long t0 = System.currentTimeMillis();
			Map<String, Object> r = svc().ask(params(up.base("/rate-long"), state("x"), 800, 2));
			long dt = System.currentTimeMillis() - t0;
			assertEquals(Boolean.FALSE, r.get("ok"));
			assertEquals(Integer.valueOf(429), r.get("status"));
			assertTrue("Retry-After 120s 不得等待,实测 " + dt, dt < 2000L);
			assertEquals(1, up.hits.get());
			assertNoLeak(r);
		}
	}

	@Test
	public void authAndValidationFailuresAreNotRetriedAndNeverEchoUpstreamBody() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			Map<String, Object> r = svc().ask(params(up.base("/auth"), state("x"), 3000, 2));
			assertEquals(Boolean.FALSE, r.get("ok"));
			assertEquals(Integer.valueOf(401), r.get("status"));
			assertEquals(AISystemOneService.E_HTTP, r.get("code"));
			assertEquals(1, up.hits.get());
			assertNoLeak(r);
		}
		try (FakeUpstream up = new FakeUpstream()) {
			Map<String, Object> r = svc().ask(params(up.base("/unprocessable"), state("STATE-ORIGINAL-TEXT"), 3000, 2));
			assertEquals(Boolean.FALSE, r.get("ok"));
			assertEquals(Integer.valueOf(422), r.get("status"));
			assertEquals(1, up.hits.get());
			assertNoLeak(r);
			assertFalse("422 不得把 state 回显", JsonUtility.encode(r).contains("STATE-ORIGINAL-TEXT"));
		}
	}

	@Test
	public void batchIsolatesFailingItemsAndKeepsOrder() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			Map<String, Object> p = new LinkedHashMap<String, Object>();
			p.put("apiKey", KEY);
			p.put("baseUrl", up.base("/flaky"));
			p.put("timeoutMs", Integer.valueOf(5000));
			p.put("maxRetries", Integer.valueOf(0));
			p.put("concurrency", Integer.valueOf(99));
			List<Map<String, Object>> batch = new ArrayList<Map<String, Object>>();
			for (int n = 1; n <= 4; n++) {
				Map<String, Object> s = new LinkedHashMap<String, Object>();
				s.put("n", Integer.valueOf(n));
				batch.add(item(s));
			}
			batch.add(new LinkedHashMap<String, Object>());   // 缺 state / questions 的坏项
			p.put("batch", batch);
			Map<String, Object> r = svc().ask(p);
			assertEquals(Boolean.TRUE, r.get("ok"));
			assertEquals("jev-batch", r.get("model"));
			@SuppressWarnings("unchecked")
			List<Map<String, Object>> results = (List<Map<String, Object>>) r.get("results");
			assertEquals(5, results.size());
			assertEquals(Boolean.TRUE, results.get(0).get("ok"));
			assertEquals(Boolean.FALSE, results.get(1).get("ok"));
			assertEquals(Integer.valueOf(500), results.get(1).get("status"));
			assertEquals(Boolean.TRUE, results.get(2).get("ok"));
			assertEquals(Boolean.TRUE, results.get(3).get("ok"));
			assertEquals(Boolean.FALSE, results.get(4).get("ok"));
			assertEquals(AISystemOneService.E_BAD_REQUEST, results.get(4).get("code"));
			// 序不乱:第 k 项的回答来自 n=k 的那次调用
			@SuppressWarnings("unchecked")
			Map<String, Object> a0 = (Map<String, Object>) ((Map<String, Object>) results.get(0).get("answers")).get("q");
			@SuppressWarnings("unchecked")
			Map<String, Object> a3 = (Map<String, Object>) ((Map<String, Object>) results.get(3).get("answers")).get("q");
			assertEquals(0.11d, ((Number) a0.get("noul")).doubleValue(), 1e-9);
			assertEquals(0.41d, ((Number) a3.get("noul")).doubleValue(), 1e-9);
			assertEquals("坏项不出网", 4, up.hits.get());
			assertNoLeak(r);
		}
	}

	@Test
	public void batchSizeAndItemSizeAndResponseSizeAreBounded() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			// 批量 > 16 项
			Map<String, Object> p = new LinkedHashMap<String, Object>();
			p.put("apiKey", KEY);
			p.put("baseUrl", up.base("/ok/"));
			List<Map<String, Object>> batch = new ArrayList<Map<String, Object>>();
			for (int n = 0; n < AISystemOneService.BATCH_MAX + 1; n++) {
				batch.add(item(state("x")));
			}
			p.put("batch", batch);
			Map<String, Object> r = svc().ask(p);
			assertEquals(Boolean.FALSE, r.get("ok"));
			assertEquals(AISystemOneService.E_TOO_LARGE, r.get("code"));
			// 单项 > 512 KB
			char[] big = new char[AISystemOneService.ITEM_MAX_BYTES + 10];
			Arrays.fill(big, 'a');
			Map<String, Object> r2 = svc().ask(params(up.base("/ok/"), state(new String(big)), 3000, 0));
			assertEquals(Boolean.FALSE, r2.get("ok"));
			assertEquals(AISystemOneService.E_TOO_LARGE, r2.get("code"));
			assertEquals("超限请求不出网", 0, up.hits.get());
			// 响应 > 1 MB
			Map<String, Object> r3 = svc().ask(params(up.base("/huge"), state("x"), 5000, 0));
			assertEquals(Boolean.FALSE, r3.get("ok"));
			assertEquals(AISystemOneService.E_TOO_LARGE, r3.get("code"));
			assertNoLeak(r3);
		}
	}

	@Test
	public void badRequestsAreRejectedLocally() throws Exception {
		try (FakeUpstream up = new FakeUpstream()) {
			Map<String, Object> noKey = params(up.base("/ok/"), state("x"), 3000, 0);
			noKey.put("apiKey", "  ");
			assertEquals(AISystemOneService.E_BAD_REQUEST, svc().ask(noKey).get("code"));
			Map<String, Object> noQuestions = params(up.base("/ok/"), state("x"), 3000, 0);
			((Map<String, Object>) noQuestions.get("request")).put("questions", new LinkedHashMap<String, Object>());
			assertEquals(AISystemOneService.E_BAD_REQUEST, svc().ask(noQuestions).get("code"));
			Map<String, Object> badType = params(up.base("/ok/"), state("x"), 3000, 0);
			Map<String, Object> q = new LinkedHashMap<String, Object>();
			Map<String, Object> weird = new LinkedHashMap<String, Object>();
			weird.put("type", "essay");
			weird.put("instructions", "write");
			q.put("w", weird);
			((Map<String, Object>) badType.get("request")).put("questions", q);
			assertEquals(AISystemOneService.E_BAD_REQUEST, svc().ask(badType).get("code"));
			Map<String, Object> shortChoice = params(up.base("/ok/"), state("x"), 3000, 0);
			Map<String, Object> q2 = new LinkedHashMap<String, Object>();
			Map<String, Object> ch = new LinkedHashMap<String, Object>();
			ch.put("type", "choice");
			ch.put("instructions", "pick");
			Map<String, Object> one = new LinkedHashMap<String, Object>();
			one.put("only", "x");
			ch.put("criteria", one);
			q2.put("c", ch);
			((Map<String, Object>) shortChoice.get("request")).put("questions", q2);
			assertEquals(AISystemOneService.E_BAD_REQUEST, svc().ask(shortChoice).get("code"));
			Map<String, Object> nullState = params(up.base("/ok/"), null, 3000, 0);
			assertEquals(AISystemOneService.E_BAD_REQUEST, svc().ask(nullState).get("code"));
			assertEquals("本地拒绝的请求不出网", 0, up.hits.get());
			// 非 JSON 的 2xx 回体 → HTTP 类失败,不抛
			Map<String, Object> r = svc().ask(params(up.base("/notjson"), state("x"), 3000, 0));
			assertEquals(Boolean.FALSE, r.get("ok"));
			assertEquals(AISystemOneService.E_HTTP, r.get("code"));
			assertNotNull(r.get("status"));
		}
	}

	@Test
	public void retryDelayUsesRetryAfterSecondsOrBoundedBackoff() {
		assertEquals(2000L, AISystemOneService.retryDelayMs("2", 0));
		assertEquals(0L, AISystemOneService.retryDelayMs("0", 3));
		long b0 = AISystemOneService.retryDelayMs(null, 0);
		assertTrue(b0 >= 300L && b0 <= 400L);
		long b2 = AISystemOneService.retryDelayMs("garbage", 2);
		assertTrue(b2 >= 1200L && b2 <= 1300L);
		long b9 = AISystemOneService.retryDelayMs(null, 9);
		assertTrue("指数封顶", b9 <= 300L * 16 + 100L);
	}

	@Test
	public void sourceHasNoLoggerCalls() throws Exception {
		java.nio.file.Path src = java.nio.file.Paths.get("src/main/java/spacex/astrostudy/service/AISystemOneService.java");
		String text = new String(java.nio.file.Files.readAllBytes(src), StandardCharsets.UTF_8);
		assertFalse(text.contains("Logger"));
		assertFalse(java.util.regex.Pattern.compile("log\\.(info|debug|warn|error)").matcher(text).find());
		assertFalse(text.contains("System.out"));
	}
}
