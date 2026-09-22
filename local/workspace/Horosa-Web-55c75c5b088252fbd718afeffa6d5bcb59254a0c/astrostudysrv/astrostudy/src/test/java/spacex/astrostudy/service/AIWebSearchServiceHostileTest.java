package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.Test;

import com.sun.net.httpserver.HttpServer;

import boundless.exception.ErrorCodeException;

/**
 * 联网检索·敌意面(L1 阶段 2 先红)。
 *
 * <p>本文件里的用例分两类:
 * <ul>
 *   <li><b>🔴 先红</b>——钉住当前 {@code AIWebSearchService} 的出站缺陷(SSRF / 无上限 / 吞根因),
 *       在守卫落地前必须失败;</li>
 *   <li><b>🟢 回归锁</b>——现状已成立的口径(合法内网地址放行、错误文案永不回显 Key),
 *       守卫落地后不许被误伤。</li>
 * </ul>
 * 所有外呼一律指向本机 {@link HttpServer} 假上游或不可路由地址,绝不打真实网络。
 */
public class AIWebSearchServiceHostileTest {

	/** 假上游:按路径分流(/ok 正常、/redirect 302 打二跳、/big 20MB 体);记录每一跳与实际写出的字节数。 */
	private static final class FakeUpstream implements AutoCloseable {
		final HttpServer server;
		final int port;
		final List<String> hits = Collections.synchronizedList(new ArrayList<String>());
		final AtomicLong bytesWritten = new AtomicLong();

		FakeUpstream() throws IOException {
			server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			port = server.getAddress().getPort();
			server.createContext("/", exchange -> {
				String path = exchange.getRequestURI().getPath();
				hits.add(exchange.getRequestMethod() + " " + path);
				try {
					exchange.getRequestBody().readAllBytes();
					if (path.startsWith("/redirect")) {
						// 二跳指向 0.0.0.0:<本服务端口>——0.0.0.0 在 macOS/Linux 上 connect 即回环,
						// 于是「有没有跟随重定向」变成本机可观测事实;同时 0.0.0.0 正是守卫必须拒的地址之一。
						exchange.getResponseHeaders().add("Location", "http://0.0.0.0:" + port + "/second-hop");
						exchange.sendResponseHeaders(302, -1);
						exchange.close();
						return;
					}
					if (path.startsWith("/second-hop")) {
						// 冒充「元数据服务」的回体:一旦跟随重定向,这段假机密就会随检索结果回到调用方。
						writeText(exchange, 200, "{\"results\":[{\"title\":\"metadata\",\"url\":\"http://169.254.169.254/\",\"content\":\"" + LEAK_MARKER + "\"}]}");
						return;
					}
					if (path.startsWith("/big")) {
						exchange.sendResponseHeaders(200, BIG_BODY_BYTES);
						OutputStream os = exchange.getResponseBody();
						byte[] chunk = new byte[64 * 1024];
						Arrays.fill(chunk, (byte) 'a');
						long left = BIG_BODY_BYTES;
						try {
							while (left > 0) {
								int n = (int) Math.min(chunk.length, left);
								os.write(chunk, 0, n);
								bytesWritten.addAndGet(n);
								left -= n;
							}
							os.flush();
						} catch (IOException clientStopped) {
							// 正确实现会在 2MiB 上限处掐断读流 → 这里收到 broken pipe,bytesWritten 停在很小的值
						}
						exchange.close();
						return;
					}
					writeText(exchange, 200, "{\"results\":[{\"title\":\"t\",\"url\":\"https://ok.test/1\",\"content\":\"c\"}]}");
				} catch (Exception ignored) {
					try {
						exchange.close();
					} catch (Exception ignoredToo) {
						// 假上游收尾失败无关判据
					}
				}
			});
			server.setExecutor(Executors.newCachedThreadPool());
			server.start();
		}

		private static void writeText(com.sun.net.httpserver.HttpExchange exchange, int status, String body) throws IOException {
			byte[] bytes = body.getBytes("UTF-8");
			exchange.sendResponseHeaders(status, bytes.length);
			exchange.getResponseBody().write(bytes);
			exchange.close();
		}

		String url(String path) {
			return "http://127.0.0.1:" + port + path;
		}

		@Override
		public void close() {
			server.stop(0);
		}
	}

	private static final String LEAK_MARKER = "SSRF-LEAKED-METADATA";
	private static final long BIG_BODY_BYTES = 20L * 1024 * 1024;
	/** 守卫落地后的读上限(批一 #13 的 MAX_RESPONSE_BYTES=2MiB);判据留足 socket 缓冲余量。 */
	private static final long READ_CAP_BYTES = 2L * 1024 * 1024;
	private static final String FAKE_KEY = "tvly-SECRET-KEY-0000";

	private static Map<String, Object> params(String... kv) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		for (int i = 0; i + 1 < kv.length; i += 2) {
			m.put(kv[i], kv[i + 1]);
		}
		return m;
	}

	// ────────────────────────── ① validateOutboundUrl 拒绝面 ──────────────────────────

	/**
	 * 🔴 先红:出站地址守卫全缺位。
	 *
	 * <p>当前 {@code AIWebSearchService.validateOutboundUrl}(AIWebSearchService.java:202)
	 * 是「原样返回」的测试缝——scheme 白名单、云元数据地址、通配地址、userinfo、长度上限一律不判,
	 * 所以下面每一条恶意地址都不会抛,本用例必红。守卫落地后应逐条抛出。
	 *
	 * <p>放行面(127.0.0.1 本应用之外的端口、RFC1918 内网)必须继续放行——本机 searxng / 内网自建
	 * 检索服务是产品明面上的用法,守卫不得连坐。
	 */
	@Test
	public void validateOutboundUrlRejectsHostileTargetsAndKeepsPrivateHostsUsable() {
		StringBuilder overlong = new StringBuilder("http://a.test/");
		while (overlong.length() < 8192) {
			overlong.append('x');
		}
		String[] mustReject = {
			"file:///etc/passwd",
			"ftp://x",
			"http://169.254.169.254/latest/meta-data",
			"http://metadata.google.internal",
			"http://0.0.0.0/",
			"http://[::]/",
			"http://user:pw@host/",
			"javascript:alert(1)",
			overlong.toString(),
		};
		List<String> escaped = new ArrayList<String>();
		for (String url : mustReject) {
			try {
				AIWebSearchService.validateOutboundUrl(url);
				escaped.add(url.length() > 60 ? (url.substring(0, 60) + "…(" + url.length() + "字符)") : url);
			} catch (RuntimeException expected) {
				assertFalse("守卫的错误文案不得回显整串目标地址(避免把内网拓扑写进日志)",
					String.valueOf(expected.getMessage()).contains("user:pw"));
			}
		}
		assertTrue("这些出站目标必须被守卫拒绝,当前全部逃逸:" + escaped, escaped.isEmpty());

		// 🟢 合法内网/本机地址不得连坐(本机 searxng、内网自建引擎是明面用法)
		for (String ok : new String[]{ "http://127.0.0.1:18081/x", "http://192.168.1.5/" }) {
			try {
				assertTrue("放行面必须原样交出可用地址:" + ok, String.valueOf(AIWebSearchService.validateOutboundUrl(ok)).contains(ok.substring("http://".length()).split("/")[0]));
			} catch (RuntimeException e) {
				fail("守卫不得连坐本机/内网检索服务(" + ok + "):" + e);
			}
		}
	}

	// ────────────────────────── ② 重定向不跟随 ──────────────────────────

	/**
	 * 🔴 先红:302 被无条件跟随 → SSRF。
	 *
	 * <p>当前独立 HttpClient 建在 AIWebSearchService.java:45 的 {@code followRedirects(Redirect.NORMAL)},
	 * 于是假上游一句 302 就能把这次外呼引到别处;本用例用 {@code 0.0.0.0:<假上游端口>} 作二跳目标
	 * ——connect 会回环到同一台假上游,所以「有没有跟随」在本机就是可观测事实(hits 里出现 /second-hop)。
	 *
	 * <p>期望(守卫落地后):{@code Redirect.NEVER} + 逐跳校验 → 调用方只看到状态码 302,
	 * 二跳绝不发生,冒充元数据的回体也绝不进检索结果。
	 */
	@Test
	public void redirectToMetadataHostIsNotFollowed() throws Exception {
		try (FakeUpstream upstream = new FakeUpstream()) {
			AIWebSearchService svc = new AIWebSearchService();
			String message = "";
			Object results = null;
			try {
				Map<String, Object> out = svc.search(params(
					"engine", "custom", "query", "紫微斗数", "apiKey", FAKE_KEY, "baseUrl", upstream.url("/redirect")));
				results = out.get("results");
			} catch (ErrorCodeException e) {
				message = String.valueOf(e.getMessage());
				assertEquals(AIWebSearchService.ERR_UPSTREAM, e.getCode());
			}
			assertFalse("绝不跟随重定向:假上游不该收到第二跳。实收 " + upstream.hits,
				upstream.hits.toString().contains("/second-hop"));
			assertFalse("跟随重定向拿回的「元数据」绝不能混进检索结果:" + results,
				String.valueOf(results).contains(LEAK_MARKER));
			assertTrue("不跟随时调用方只该看到状态码,实得:" + message, message.contains("302"));
		}
	}

	// ────────────────────────── ③ 回体有上限 ──────────────────────────

	/**
	 * 🔴 先红:回体无上限,{@code BodyHandlers.ofString} 把上游给多少吸多少。
	 *
	 * <p>当前 AIWebSearchService.java:227 的 {@code send} 用 {@code ofString} 一次性全读,
	 * 假上游回 20MB 就整整 20MB 进堆;判据取「假上游实际写出了多少字节」——
	 * 正确实现在 2MiB 上限处掐断读流,假上游会在 ~2MiB + socket 缓冲处收到 broken pipe。
	 *
	 * <p>期望(守卫落地后):{@code ofInputStream} 有界读满 2MiB 即断,报 {@code ERR_UPSTREAM}。
	 */
	@Test
	public void oversizedUpstreamBodyIsCutAtTheReadCap() throws Exception {
		try (FakeUpstream upstream = new FakeUpstream()) {
			AIWebSearchService svc = new AIWebSearchService();
			int code = 0;
			String message = "";
			boolean returnedNormally = false;
			try {
				svc.search(params("engine", "custom", "query", "q", "apiKey", FAKE_KEY, "baseUrl", upstream.url("/big")));
				returnedNormally = true;
			} catch (ErrorCodeException e) {
				code = e.getCode();
				message = String.valueOf(e.getMessage());
			} catch (RuntimeException other) {
				// 当前实现全读完后交给 JSON 解析器炸——同样算红,把实际异常写进判据信息
				message = other.getClass().getName() + ": " + other.getMessage();
			}
			long wrote = upstream.bytesWritten.get();
			assertTrue("读流必须在 2MiB 上限处断开:假上游一路写出了 " + wrote + " 字节(上限 " + READ_CAP_BYTES + ")",
				wrote < READ_CAP_BYTES * 4);
			assertFalse("20MB 回体不该被当成正常回体收下", returnedNormally);
			assertEquals("超上限必须报 ERR_UPSTREAM,实得:" + message, AIWebSearchService.ERR_UPSTREAM, code);
			assertFalse("错误文案永不含 Key", message.contains(FAKE_KEY));
		}
	}

	// ────────────────────────── ④ 传输层失败留根因 ──────────────────────────

	/**
	 * 🔴 先红:连接被拒时根因被吞。
	 *
	 * <p>当前 AIWebSearchService.java:235 的 {@code catch (Exception e)} 把一切都压成
	 * 「检索服务不可达」,排障时既看不出是连不上、超时、还是 TLS 失败。
	 *
	 * <p>期望:错误文案带上异常类名({@code ConnectException} 等),同时仍然一个字都不含 Key。
	 */
	@Test
	public void connectionRefusedKeepsTheCauseClassNameAndNeverEchoesTheKey() {
		AIWebSearchService svc = new AIWebSearchService();
		try {
			svc.search(params("engine", "custom", "query", "q", "apiKey", FAKE_KEY, "baseUrl", "http://127.0.0.1:1/x"));
			fail("连接被拒应报 ERR_UPSTREAM");
		} catch (ErrorCodeException e) {
			String message = String.valueOf(e.getMessage());
			assertEquals(AIWebSearchService.ERR_UPSTREAM, e.getCode());
			// 🟢 回归锁:任何形态下都不得回显 Key
			assertFalse("错误文案永不含 Key:" + message, message.contains(FAKE_KEY));
			assertTrue("错误文案应带根因异常类名(ConnectException),实得:" + message, message.contains("ConnectException"));
		}
	}

	/**
	 * 🔴 先红:连接超时同样被吞成一句「不可达」。
	 *
	 * <p>用 I14 的构造器注入缝换上 400ms 连接超时的 HttpClient,打 TEST-NET-1(192.0.2.0/24,
	 * RFC5737 文档保留段,永不可路由)——JDK 回 {@code HttpConnectTimeoutException};
	 * 若测试机根本没有默认路由则回 {@code ConnectException},两者都属「有类名的根因」,
	 * 所以判据取「文案里出现某个 *Exception 类名」,不锁死具体哪一个。
	 */
	@Test
	public void connectTimeoutKeepsTheCauseClassName() {
		HttpClient shortFuse = HttpClient.newBuilder()
			.connectTimeout(Duration.ofMillis(400))
			.followRedirects(HttpClient.Redirect.NEVER)
			.build();
		AIWebSearchService svc = new AIWebSearchService(shortFuse);
		try {
			svc.search(params("engine", "custom", "query", "q", "apiKey", FAKE_KEY, "baseUrl", "http://192.0.2.1/x"));
			fail("不可路由地址应报 ERR_UPSTREAM");
		} catch (ErrorCodeException e) {
			String message = String.valueOf(e.getMessage());
			assertEquals(AIWebSearchService.ERR_UPSTREAM, e.getCode());
			assertFalse("错误文案永不含 Key:" + message, message.contains(FAKE_KEY));
			assertTrue("错误文案应带根因异常类名(HttpConnectTimeoutException / ConnectException 等),实得:" + message,
				message.matches("(?s).*[A-Za-z]+Exception.*"));
		}
	}

	// ────────────────────────── 🟢 假上游正常路径:夹具自证 ──────────────────────────

	/**
	 * 🟢 夹具自证:同一具假上游在 /ok 上走通全链(POST → 归一 → results),
	 * 证明上面几条红不是「夹具本身连不上」造成的假报。
	 */
	@Test
	public void fakeUpstreamHappyPathProvesTheHarnessItself() throws Exception {
		try (FakeUpstream upstream = new FakeUpstream()) {
			AIWebSearchService svc = new AIWebSearchService();
			Map<String, Object> out = svc.search(params(
				"engine", "custom", "query", "紫微斗数", "apiKey", FAKE_KEY, "baseUrl", upstream.url("/ok")));
			@SuppressWarnings("unchecked")
			List<Map<String, Object>> results = (List<Map<String, Object>>) out.get("results");
			assertEquals(1, results.size());
			assertEquals("https://ok.test/1", results.get(0).get("url"));
			assertEquals(1, upstream.hits.size());
			assertTrue(upstream.hits.get(0).startsWith("POST /ok"));
		}
	}
}
