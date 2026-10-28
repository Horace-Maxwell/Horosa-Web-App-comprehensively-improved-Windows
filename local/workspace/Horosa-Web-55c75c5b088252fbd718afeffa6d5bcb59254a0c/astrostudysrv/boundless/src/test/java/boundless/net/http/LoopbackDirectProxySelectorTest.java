package boundless.net.http;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketAddress;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

import org.apache.http.HttpHost;
import org.apache.http.client.methods.HttpGet;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import com.sun.net.httpserver.HttpServer;

/**
 * 本机地址出站一律直连:开了系统代理(无论 JDK 把它报成 HTTP 代理还是 SOCKS 代理)时,
 * 连 127.0.0.1 / localhost / ::1 的请求不进代理;外部地址仍按原选择器走代理。
 *
 * <p>端到端用例在本机起一个「只会说 HTTP 的代理」(收到任何字节都回 HTTP/1.1 400)冒充系统代理,
 * 先断言不装直连选择器时裸 Socket 确实报 SOCKS 握手错误(复现故障),再断言装上后直连成功。
 */
public class LoopbackDirectProxySelectorTest {

	private ProxySelector savedDefault;
	private String savedHttpHost;
	private String savedHttpPort;
	private ServerSocket fakeHttpOnlyProxy;
	private Thread fakeProxyThread;
	// horosa_win_socks_abort_v1:假代理收到的连接数(复现前提的平台无关判据,见 rawSocketToLoopbackStaysDirectUnderSystemSocksProxy)
	private final java.util.concurrent.atomic.AtomicInteger proxyHits = new java.util.concurrent.atomic.AtomicInteger();

	@Before
	public void setUp() throws Exception {
		savedDefault = ProxySelector.getDefault();
		savedHttpHost = System.getProperty("http.proxyHost");
		savedHttpPort = System.getProperty("http.proxyPort");
		fakeHttpOnlyProxy = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
		fakeProxyThread = new Thread(() -> {
			while (!fakeHttpOnlyProxy.isClosed()) {
				try (Socket s = fakeHttpOnlyProxy.accept()) {
					proxyHits.incrementAndGet();
					s.setSoTimeout(2000);
					try {
						s.getInputStream().read(new byte[64]);
					} catch (IOException ignore) {
						// 对端没发东西也照样回
					}
					OutputStream out = s.getOutputStream();
					out.write("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
					out.flush();
				} catch (IOException e) {
					// 关停时 accept 抛错,退出循环
				}
			}
		}, "fake-http-only-proxy");
		fakeProxyThread.setDaemon(true);
		fakeProxyThread.start();
	}

	@After
	public void tearDown() throws Exception {
		ProxySelector.setDefault(savedDefault);
		restoreProp("http.proxyHost", savedHttpHost);
		restoreProp("http.proxyPort", savedHttpPort);
		fakeHttpOnlyProxy.close();
	}

	private static void restoreProp(String key, String val) {
		if (val == null) {
			System.clearProperty(key);
		} else {
			System.setProperty(key, val);
		}
	}

	/** 冒充「系统代理」的选择器:任何目标都给同一个代理(Windows 只写 主机:端口 时 JDK 对 SOCKS 查询也这么回)。 */
	private static ProxySelector everythingVia(Proxy.Type type, int port) {
		final Proxy p = new Proxy(type, new InetSocketAddress("127.0.0.1", port));
		return new ProxySelector() {
			@Override
			public List<Proxy> select(URI uri) {
				return Collections.singletonList(p);
			}

			@Override
			public void connectFailed(URI uri, SocketAddress sa, IOException ioe) {
			}
		};
	}

	private int proxyPort() {
		return fakeHttpOnlyProxy.getLocalPort();
	}

	@Test
	public void loopbackHostVectors() {
		String[] yes = { "localhost", "LOCALHOST", "localhost.", "app.localhost", "127.0.0.1", "127.5.6.7",
			"[::1]", "::1", "0:0:0:0:0:0:0:1", "0.0.0.0", "[::]", "::ffff:127.0.0.1", " 127.0.0.1 " };
		for (String h : yes) {
			assertTrue("应判本机:" + h, LoopbackDirectProxySelector.isLoopbackHost(h));
		}
		String[] no = { null, "", "example.com", "127.example.com", "localhost.example.com", "10.0.0.1",
			"192.168.1.2", "8.8.8.8", "[2001:db8::1]", "api.openai.com", "1270.0.0.1" };
		for (String h : no) {
			assertFalse("不应判本机:" + h, LoopbackDirectProxySelector.isLoopbackHost(h));
		}
	}

	@Test
	public void selectBypassesLoopbackForHttpAndSocksDelegates() throws Exception {
		for (Proxy.Type type : new Proxy.Type[] { Proxy.Type.HTTP, Proxy.Type.SOCKS }) {
			ProxySelector delegate = everythingVia(type, 31181);
			LoopbackDirectProxySelector sel = new LoopbackDirectProxySelector(delegate);
			String[] local = { "http://127.0.0.1:8899/chart", "http://localhost:9999/ziwei/birth",
				"socket://127.0.0.1:8899", "socket://[::1]:9999", "socket://localhost:27017", "https://[::1]:11434/v1" };
			for (String u : local) {
				List<Proxy> got = sel.select(new URI(u));
				assertEquals(type + " 代理下本机目标应直连:" + u, Collections.singletonList(Proxy.NO_PROXY), got);
			}
			String[] external = { "https://api.openai.com/v1", "socket://api.openai.com:443", "http://10.0.0.8:80" };
			for (String u : external) {
				List<Proxy> got = sel.select(new URI(u));
				assertEquals(type + " 代理下外部目标仍走代理:" + u, type, got.get(0).type());
			}
		}
	}

	@Test
	public void installIsIdempotentAndUnwrapsNested() {
		ProxySelector.setDefault(everythingVia(Proxy.Type.HTTP, 1));
		ProxySelector a = LoopbackDirectProxySelector.install();
		ProxySelector b = LoopbackDirectProxySelector.install();
		assertSame(a, b);
		assertSame(a, ProxySelector.getDefault());
		LoopbackDirectProxySelector nested = new LoopbackDirectProxySelector(a);
		assertSame(((LoopbackDirectProxySelector) a).delegate(), nested.delegate());
		LoopbackDirectProxySelector none = new LoopbackDirectProxySelector(null);
		assertEquals(Proxy.NO_PROXY, none.select(URI.create("https://api.openai.com")).get(0));
	}

	@Test
	public void rawSocketToLoopbackStaysDirectUnderSystemSocksProxy() throws Exception {
		try (ServerSocket target = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))) {
			Thread t = new Thread(() -> {
				for (int i = 0; i < 2; i++) {
					try (Socket s = target.accept()) {
						s.getOutputStream().write("OK\n".getBytes(StandardCharsets.US_ASCII));
					} catch (IOException e) {
						return;
					}
				}
			});
			t.setDaemon(true);
			t.start();
			InetSocketAddress dest = new InetSocketAddress("127.0.0.1", target.getLocalPort());

			// 复现:只有「系统代理」选择器时,裸 Socket 连本机端口会先跟 HTTP 代理做 SOCKS 握手而失败
			ProxySelector.setDefault(everythingVia(Proxy.Type.SOCKS, proxyPort()));
			try (Socket s = new Socket()) {
				s.connect(dest, 3000);
				fail("预期 SOCKS 握手失败(复现前提不成立)");
			} catch (SocketException expected) {
				// horosa_win_socks_abort_v1:Windows 上假代理回完 400 即关连接,JDK 的 SOCKS 客户端读回包时先收到
				// WSAECONNABORTED / WSAECONNRESET(「An established connection was aborted…」,文字不含 socks)——
				// 复现前提改为「报 SOCKS 握手错误,或这次连接确实先进了假代理」;修复段的断言不变。
				assertTrue("应是 SOCKS 握手错误:" + expected,
						String.valueOf(expected.getMessage()).toLowerCase().contains("socks") || proxyHits.get() > 0);
			}
			int hitsBeforeFix = proxyHits.get();

			// 修复:装上本机直连选择器后同一个连接直达目标
			ProxySelector.setDefault(new LoopbackDirectProxySelector(everythingVia(Proxy.Type.SOCKS, proxyPort())));
			try (Socket s = new Socket()) {
				s.connect(dest, 3000);
				s.setSoTimeout(3000);
				InputStream in = s.getInputStream();
				byte[] buf = new byte[3];
				int n = in.read(buf);
				assertEquals("OK\n", new String(buf, 0, n, StandardCharsets.US_ASCII));
			}
			assertEquals("装上直连选择器后不应再进假代理", hitsBeforeFix, proxyHits.get());
		}
	}

	@Test
	public void apacheClientToLoopbackStaysDirectUnderHttpAndSocksProxies() throws Exception {
		HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/ping", ex -> {
			byte[] body = "pong".getBytes(StandardCharsets.UTF_8);
			ex.sendResponseHeaders(200, body.length);
			ex.getResponseBody().write(body);
			ex.close();
		});
		server.start();
		try {
			String local = "http://127.0.0.1:" + server.getAddress().getPort() + "/ping";
			// HTTP 代理这一层(系统属性代理)+ SOCKS 这一层(系统代理被报成 SOCKS)同时设上
			System.setProperty("http.proxyHost", "127.0.0.1");
			System.setProperty("http.proxyPort", String.valueOf(proxyPort()));
			ProxySelector.setDefault(new LoopbackDirectProxySelector(everythingVia(Proxy.Type.SOCKS, proxyPort())));

			assertNull("本机目标不设 Apache 代理", HttpClientUtility.getHttpHostFor(URI.create(local)));
			assertNull(HttpClientUtility.getHttpHostFor("http://localhost:9999/chart"));
			assertNull(HttpClientUtility.getProxyFor("http://[::1]:8899/"));
			if (System.getenv("http_proxy") == null && System.getenv("https_proxy") == null && System.getenv("all_proxy") == null) {
				HttpHost ext = HttpClientUtility.getHttpHostFor("https://api.openai.com/v1/models");
				assertNotNull("外部目标仍走代理", ext);
				assertEquals(proxyPort(), ext.getPort());
			}

			String body = HttpUriRequestHystrixCommand.doCmd(null, null, new HttpGet(local), null, null, 5000, null, null);
			assertEquals("pong", body);
		} finally {
			server.stop(0);
		}
	}

	@Test
	public void connectFailureClassifier() {
		assertTrue(HttpClientUtility.isConnectFailure(new RuntimeException(new SocketException("Reply from SOCKS server has bad version"))));
		assertTrue(HttpClientUtility.isConnectFailure(new RuntimeException(new ConnectException("Connection refused"))));
		assertTrue(HttpClientUtility.isConnectFailure(new SocketTimeoutException("connect timed out")));
		assertTrue(HttpClientUtility.isConnectFailure(new RuntimeException(new SocketException("Can't connect to SOCKS proxy:Connection refused"))));
		assertFalse("读超时不算连不上", HttpClientUtility.isConnectFailure(new RuntimeException(new SocketTimeoutException("Read timed out"))));
		assertFalse(HttpClientUtility.isConnectFailure(new RuntimeException(new IOException("boom"))));
		assertFalse(HttpClientUtility.isConnectFailure(new IllegalStateException("x")));
		assertFalse(HttpClientUtility.isConnectFailure(null));
	}
}
