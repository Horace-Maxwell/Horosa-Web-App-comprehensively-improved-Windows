package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import com.sun.net.httpserver.HttpServer;

import boundless.exception.ErrorCodeException;

/**
 * 联网检索 / 网页读取的路由与安全:
 * <ul>
 *   <li>开了系统代理(Windows 形态:http/https 报 HTTP 代理、socket 报 SOCKS 代理)时,外部地址经代理发出;</li>
 *   <li>本机地址直连(代理一字节都收不到),SOCKS 形态的系统代理也不会把本机连接搞坏;</li>
 *   <li>出站守卫按目标地址判,经代理也拦:内网字面量 / 解析到内网的名字 / 元数据地址 / 未放行时的回环,
 *       以及经代理拿到的 3xx 指向内网 / 元数据 —— 代理一律收不到被拒的那一跳。</li>
 * </ul>
 * 「代理」是本机一个只记录请求行、回固定响应的假 HTTP 代理;外部主机名由注入的解析器解析成公网地址(不发真 DNS、不出网)。
 */
public class AIWebOutboundProxyRouteTest {

	private ProxySelector savedSelector;
	private FakeHttpProxy proxy;
	private HttpServer local;
	private String localBase;

	/** 本机假 HTTP 代理:记下每个请求的请求行,按请求行给响应。 */
	static final class FakeHttpProxy implements Runnable {
		final ServerSocket server;
		final List<String> requestLines = Collections.synchronizedList(new ArrayList<String>());
		volatile Function<String, String> responder = line -> ok("text/html", "<html><head><title>via proxy</title></head><body>proxied page</body></html>");

		FakeHttpProxy() throws IOException {
			server = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
			Thread t = new Thread(this, "fake-http-proxy");
			t.setDaemon(true);
			t.start();
		}

		static String ok(String type, String body) {
			byte[] b = body.getBytes(StandardCharsets.UTF_8);
			return "HTTP/1.1 200 OK\r\nContent-Type: " + type + "; charset=utf-8\r\nContent-Length: " + b.length + "\r\nConnection: close\r\n\r\n" + body;
		}

		int port() {
			return server.getLocalPort();
		}

		@Override
		public void run() {
			while (!server.isClosed()) {
				try (Socket s = server.accept()) {
					s.setSoTimeout(3000);
					InputStream in = s.getInputStream();
					StringBuilder head = new StringBuilder();
					int c;
					while ((c = in.read()) >= 0) {
						head.append((char) c);
						if (head.length() >= 4 && head.substring(head.length() - 4).equals("\r\n\r\n")) {
							break;
						}
						if (head.length() > 65536) {
							break;
						}
					}
					String line = head.toString().split("\r\n", 2)[0];
					requestLines.add(line);
					OutputStream out = s.getOutputStream();
					out.write(responder.apply(line).getBytes(StandardCharsets.UTF_8));
					out.flush();
				} catch (IOException e) {
					// 关停 / 对端断开
				}
			}
		}
	}

	/** Windows「主机:端口」形态的系统代理:http/https 报 HTTP 代理,socket 报同一地址的 SOCKS 代理。 */
	private static ProxySelector windowsStyle(int port) {
		final InetSocketAddress addr = new InetSocketAddress("127.0.0.1", port);
		return new ProxySelector() {
			@Override
			public List<Proxy> select(URI uri) {
				Proxy.Type t = "socket".equalsIgnoreCase(uri.getScheme()) ? Proxy.Type.SOCKS : Proxy.Type.HTTP;
				return Collections.singletonList(new Proxy(t, addr));
			}

			@Override
			public void connectFailed(URI uri, SocketAddress sa, IOException ioe) {
			}
		};
	}

	private static ProxySelector socksOnly(int port) {
		final Proxy p = new Proxy(Proxy.Type.SOCKS, new InetSocketAddress("127.0.0.1", port));
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

	@Before
	public void setUp() throws Exception {
		savedSelector = ProxySelector.getDefault();
		proxy = new FakeHttpProxy();
		final Map<String, String> dns = new HashMap<String, String>();
		dns.put("pub.example.test", "93.184.216.34");
		dns.put("intranet.example.test", "10.0.0.5");
		OutboundUrlGuard.setResolverForTests(new OutboundUrlGuard.Resolver() {
			@Override
			public InetAddress[] resolve(String host) throws UnknownHostException {
				String ip = dns.get(host);
				return ip != null ? new InetAddress[] { InetAddress.getByName(ip) } : InetAddress.getAllByName(host);
			}
		});
		local = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		local.createContext("/", ex -> {
			byte[] b = "{\"results\":[],\"local\":\"direct\"}".getBytes(StandardCharsets.UTF_8);
			ex.getResponseHeaders().add("Content-Type", "application/json");
			ex.sendResponseHeaders(200, b.length);
			ex.getResponseBody().write(b);
			ex.close();
		});
		local.start();
		localBase = "http://127.0.0.1:" + local.getAddress().getPort();
	}

	@After
	public void tearDown() throws Exception {
		ProxySelector.setDefault(savedSelector);
		OutboundUrlGuard.setResolverForTests(null);
		local.stop(0);
		proxy.server.close();
	}

	/**
	 * 默认选择器只放「系统代理」本身、不预先包本机直连:服务用生产构造器,必须自己取到已装好的本机直连选择器
	 * (构造早于入口安装 / 不经主入口的进程同样成立;不给 .proxy() 的客户端会定死这个裸选择器,本机目标进代理)。
	 */
	private AIWebFetchService fetchServiceVia(ProxySelector systemProxy) {
		ProxySelector.setDefault(systemProxy);
		return new AIWebFetchService();
	}

	private AIWebSearchService searchServiceVia(ProxySelector systemProxy) {
		ProxySelector.setDefault(systemProxy);
		return new AIWebSearchService();
	}

	private static void assertBlocked(Runnable r) {
		try {
			r.run();
			fail("预期被出站守卫拒绝");
		} catch (ErrorCodeException e) {
			assertEquals(AIWebFetchService.ERR_FETCH_BLOCKED, e.getCode());
		}
	}

	@Test
	public void fetchExternalGoesThroughSystemHttpProxy() {
		AIWebFetchService svc = fetchServiceVia(windowsStyle(proxy.port()));
		AIWebFetchService.Fetched f = svc.fetchFollowing("http://pub.example.test/page", false);
		assertTrue(f.body.contains("proxied page"));
		assertEquals(1, proxy.requestLines.size());
		assertTrue("代理收到的应是目标地址的绝对请求行:" + proxy.requestLines, proxy.requestLines.get(0).startsWith("GET http://pub.example.test/page "));
	}

	@Test
	public void fetchLoopbackStaysDirectUnderHttpAndSocksSystemProxies() {
		for (ProxySelector sys : new ProxySelector[] { windowsStyle(proxy.port()), socksOnly(proxy.port()) }) {
			AIWebFetchService svc = fetchServiceVia(sys);
			AIWebFetchService.Fetched f = svc.fetchFollowing(localBase + "/page", true);
			assertTrue(f.body.contains("direct"));
		}
		assertEquals("本机目标一字节都不该进代理", 0, proxy.requestLines.size());
	}

	@Test
	public void fetchGuardStillRejectsPrivateTargetsWhenProxied() {
		final AIWebFetchService svc = fetchServiceVia(windowsStyle(proxy.port()));
		assertBlocked(() -> svc.fetchFollowing("http://192.168.1.10/admin", false));
		assertBlocked(() -> svc.fetchFollowing("http://10.0.0.5/", false));
		assertBlocked(() -> svc.fetchFollowing("http://intranet.example.test/", false));   // 名字解析到内网
		assertBlocked(() -> svc.fetchFollowing("http://169.254.169.254/latest/meta-data/", false));
		assertBlocked(() -> svc.fetchFollowing("http://metadata.google.internal/", false));
		assertBlocked(() -> svc.fetchFollowing(localBase + "/page", false));   // 未放行回环时经代理也不行
		assertBlocked(() -> svc.fetchFollowing("http://[::ffff:127.0.0.1]/", false));
		assertEquals("被拒的目标代理一个请求都收不到", 0, proxy.requestLines.size());
	}

	@Test
	public void fetchRedirectFromProxiedHopIsRevalidatedPerHop() {
		final AIWebFetchService svc = fetchServiceVia(windowsStyle(proxy.port()));
		String[] badLocations = { "http://169.254.169.254/latest/meta-data/", "http://intranet.example.test/secret", "http://127.0.0.1:9999/chart", "http://192.168.0.1/" };
		for (final String loc : badLocations) {
			proxy.requestLines.clear();
			proxy.responder = line -> "HTTP/1.1 302 Found\r\nLocation: " + loc + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
			assertBlocked(() -> svc.fetchFollowing("http://pub.example.test/redirect", false));
			assertEquals("只有第一跳(公网)经代理发出,被拒的下一跳不发:" + loc, 1, proxy.requestLines.size());
		}
	}

	@Test
	public void searchExternalViaProxyLoopbackDirectMetadataRejected() {
		proxy.responder = line -> FakeHttpProxy.ok("application/json", "{\"results\":[]}");
		AIWebSearchService svc = searchServiceVia(windowsStyle(proxy.port()));

		Map<String, Object> ext = new HashMap<String, Object>();
		ext.put("engine", "searxng");
		ext.put("query", "test");
		ext.put("baseUrl", "http://pub.example.test");
		assertEquals("searxng", svc.search(ext).get("engine"));
		assertEquals(1, proxy.requestLines.size());
		assertTrue(proxy.requestLines.get(0), proxy.requestLines.get(0).startsWith("GET http://pub.example.test/"));

		Map<String, Object> loop = new HashMap<String, Object>();
		loop.put("engine", "searxng");
		loop.put("query", "test");
		loop.put("baseUrl", localBase);
		svc.search(loop);
		assertEquals("本机自建检索直连,不进代理", 1, proxy.requestLines.size());

		for (String bad : new String[] { "http://169.254.169.254", "http://127.0.0.1:9999", "http://metadata.google.internal" }) {
			Map<String, Object> p = new HashMap<String, Object>();
			p.put("engine", "custom");
			p.put("query", "test");
			p.put("baseUrl", bad);
			try {
				svc.search(p);
				fail("预期被出站守卫拒绝:" + bad);
			} catch (ErrorCodeException e) {
				assertEquals(AIWebSearchService.ERR_NOT_CONFIGURED, e.getCode());
			}
		}
		assertEquals("被拒的检索地址代理收不到", 1, proxy.requestLines.size());
	}
}
