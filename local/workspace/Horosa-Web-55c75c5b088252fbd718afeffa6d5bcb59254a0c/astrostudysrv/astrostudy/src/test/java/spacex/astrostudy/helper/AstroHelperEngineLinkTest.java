package spacex.astrostudy.helper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.fail;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.ServerSocket;
import java.net.SocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import com.sun.net.httpserver.HttpServer;

import boundless.exception.ErrorCodeException;
import boundless.net.http.LoopbackDirectProxySelector;

/**
 * 后端转发本地排盘引擎:
 * ① 开了系统代理(被报成 SOCKS)时,经全局本机直连选择器仍直达引擎;
 * ② 真连不上引擎时抛固定业务码 + 稳定键(前端据此给可见提示),不是一条裸异常文本。
 */
public class AstroHelperEngineLinkTest {

	private ProxySelector saved;

	@Before
	public void setUp() {
		saved = ProxySelector.getDefault();
	}

	@After
	public void tearDown() {
		ProxySelector.setDefault(saved);
	}

	private static ProxySelector socksEverything(int port) {
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

	private static int closedPort() throws IOException {
		try (ServerSocket s = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
			return s.getLocalPort();
		}
	}

	@Test
	public void engineReachableUnderSocksSystemProxy() throws Exception {
		HttpServer engine = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		engine.createContext("/chart", ex -> {
			byte[] body = "{\"ok\":1}".getBytes(StandardCharsets.UTF_8);
			ex.getResponseHeaders().add("Content-Type", "application/json");
			ex.sendResponseHeaders(200, body.length);
			ex.getResponseBody().write(body);
			ex.close();
		});
		engine.start();
		try {
			// 「系统代理」指向一个不存在的 SOCKS 端口:不直连就必然失败
			ProxySelector.setDefault(new LoopbackDirectProxySelector(socksEverything(closedPort())));
			Map<String, Object> res = AstroHelper.requestEngineAt("http://127.0.0.1:" + engine.getAddress().getPort(), "/chart", new HashMap<String, Object>());
			assertEquals(1, ((Number) res.get("ok")).intValue());
		} finally {
			engine.stop(0);
		}
	}

	@Test
	public void unreachableEngineMapsToStableCode() throws Exception {
		try {
			AstroHelper.requestEngineAt("http://127.0.0.1:" + closedPort(), "/chart", new HashMap<String, Object>());
			fail("预期连不上引擎");
		} catch (ErrorCodeException e) {
			assertEquals(AstroHelper.EngineLinkErrorCode, e.getCode());
			assertEquals(AstroHelper.EngineLinkErrorKey, e.getMessage());
		}
	}

	@Test
	public void engineHttpErrorIsNotLinkFailure() throws Exception {
		HttpServer engine = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		engine.createContext("/chart", ex -> {
			ex.sendResponseHeaders(500, -1);
			ex.close();
		});
		engine.start();
		try {
			AstroHelper.requestEngineAt("http://127.0.0.1:" + engine.getAddress().getPort(), "/chart", new HashMap<String, Object>());
			fail("预期 HTTP 500 上抛");
		} catch (RuntimeException e) {
			boolean link = e instanceof ErrorCodeException && ((ErrorCodeException) e).getCode() == AstroHelper.EngineLinkErrorCode;
			assertFalse("引擎在、只是报错:不算连不上", link);
		} finally {
			engine.stop(0);
		}
	}
}
