package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.net.InetAddress;

import org.junit.Test;

import boundless.exception.ErrorCodeException;

/** 出站地址守卫直测:基础档 / 严格档字面层 / 解析层(桩)/ 回环字面放行 / 点分十进制才判私网 / trim / 单前缀文案 / 地址分类向量。 */
public class OutboundUrlGuardTest {

	private static String rejectReason(String url) {
		try {
			OutboundUrlGuard.validate(url);
			fail("应拒绝: " + url);
			return "";
		} catch (ErrorCodeException e) {
			assertEquals(AIWebSearchService.ERR_NOT_CONFIGURED, e.getCode());
			return e.getMessage();
		}
	}

	private static String strictReason(String url, boolean allowLoopback) {
		try {
			OutboundUrlGuard.validateStrict(url, allowLoopback);
			fail("严格档应拒绝: " + url);
			return "";
		} catch (ErrorCodeException e) {
			assertEquals(AIWebFetchService.ERR_FETCH_BLOCKED, e.getCode());
			return e.getMessage();
		}
	}

	/** 测试里绝不发真 DNS:名字一律解析成公网地址;三个特定名字分别解析到回环 / 解析失败 / 无结果。 */
	private static OutboundUrlGuard.Resolver publicOnlyResolver() {
		return new OutboundUrlGuard.Resolver() {
			@Override
			public InetAddress[] resolve(String host) throws java.net.UnknownHostException {
				if (host.matches("[0-9.]+") || host.indexOf(':') >= 0) {
					return InetAddress.getAllByName(host);
				}
				if ("inner.example".equals(host)) {
					return new InetAddress[] { InetAddress.getByName("127.0.0.1") };
				}
				if ("dead.example".equals(host)) {
					throw new java.net.UnknownHostException(host);
				}
				if ("empty.example".equals(host)) {
					return new InetAddress[0];
				}
				return new InetAddress[] { InetAddress.getByName("93.184.216.34") };
			}
		};
	}

	@Test
	public void basicGuardVectors() {
		assertTrue(rejectReason(null).contains("地址为空"));
		assertTrue(rejectReason("   ").contains("地址为空"));
		StringBuilder longUrl = new StringBuilder("https://example.com/");
		while (longUrl.length() <= OutboundUrlGuard.URL_MAX) {
			longUrl.append('a');
		}
		assertTrue(rejectReason(longUrl.toString()).contains("地址过长"));
		assertTrue(rejectReason("ftp://example.com/x").contains("只允许 http/https"));
		assertTrue(rejectReason("javascript:alert(1)").contains("只允许 http/https"));
		assertTrue(rejectReason("http://user:pw@example.com/").contains("用户信息"));
		assertTrue(rejectReason("http://169.254.169.254/latest/meta-data").contains("不允许访问该主机"));
		assertTrue(rejectReason("http://metadata.google.internal/").contains("不允许访问该主机"));
		assertTrue(rejectReason("http://0.0.0.0/").contains("不允许访问该主机"));
		assertTrue(rejectReason("http://2130706433/").contains("整数形式"));
		assertTrue(rejectReason("http://0x7f000001/").contains("整数形式"));
		assertTrue(rejectReason("http://127.0.0.1:9999/api").contains("自身端口"));
		assertTrue(rejectReason("http://localhost:8899/chart").contains("自身端口"));
		String noHost = rejectReason("http:///nohost");
		assertTrue(noHost, noHost.contains("缺主机名") || noHost.contains("不合法"));
		// 放行:回环非自身端口(本机 searxng 是明面用法)、公网、带端口、带查询
		assertEquals("http://127.0.0.1:8080/search", OutboundUrlGuard.validate("http://127.0.0.1:8080/search"));
		assertEquals("https://example.com/a?q=1", OutboundUrlGuard.validate("https://example.com/a?q=1"));
		// [D34] 首尾空白:回 trim 后的串(此前回原串,到 HttpRequest 的 URI.create 抛裸 IllegalArgumentException)
		assertEquals("https://example.com/a", OutboundUrlGuard.validate("  https://example.com/a \n"));
		// 文案永不回显地址
		assertFalse(rejectReason("http://user:pw@secret-host.example/").contains("secret-host"));
	}

	/** [AR-34] 基础档「回环禁自身端口」的别名绕过:`localhost.` 与 `[::ffff:127.0.0.1]` 不是回环字面量,却解析到回环 → 带自身端口必拒;非自身端口照放;解析失败不拒。 */
	@Test
	public void basicGuardLoopbackAliasOnOwnPort() {
		OutboundUrlGuard.setResolverForTests(publicOnlyResolver());
		try {
			assertTrue(rejectReason("http://localhost.:8899/x").contains("自身端口"));   // 尾点归一后即回环字面量(不靠 DNS)
			assertTrue(rejectReason("http://[::ffff:127.0.0.1]:9999/x").contains("自身端口"));
			assertTrue(rejectReason("http://inner.example:9999/x").contains("自身端口"));   // 名字解析到 127.0.0.1(桩)
			// 非自身端口的回环别名(本机自建引擎)照放;公网名字带自身端口照放(解析到公网);解析失败的名字不在基础档拒
			assertEquals("http://localhost.:8080/search", OutboundUrlGuard.validate("http://localhost.:8080/search"));
			assertEquals("https://example.com:9999/a", OutboundUrlGuard.validate("https://example.com:9999/a"));
			assertEquals("http://dead.example:9999/a", OutboundUrlGuard.validate("http://dead.example:9999/a"));
			assertTrue(OutboundUrlGuard.resolvesToLoopback("inner.example"));   // 桩:解析到 127.0.0.1
			assertTrue(OutboundUrlGuard.resolvesToLoopback("::ffff:127.0.0.1"));   // IPv4 映射回环字面量(不发 DNS)
			assertFalse(OutboundUrlGuard.resolvesToLoopback("example.com"));
			assertFalse(OutboundUrlGuard.resolvesToLoopback("dead.example"));
		} finally {
			OutboundUrlGuard.setResolverForTests(null);
		}
	}

	@Test
	public void strictGuardLiteralLayerVectors() {
		OutboundUrlGuard.setResolverForTests(publicOnlyResolver());
		try {
			// [D29] 点分十进制才判私网:10.gov / 172.today / fcc.gov / fdroid.org 是公网名字;172.32.0.1 不在 172.16/12
			assertEquals("http://10.gov/x", OutboundUrlGuard.validateStrict("http://10.gov/x", false));
			assertEquals("http://172.today/", OutboundUrlGuard.validateStrict("http://172.today/", false));
			assertEquals("http://fcc.gov/", OutboundUrlGuard.validateStrict("http://fcc.gov/", false));
			assertEquals("http://fdroid.org/", OutboundUrlGuard.validateStrict("http://fdroid.org/", false));
			assertEquals("http://172.32.0.1/", OutboundUrlGuard.validateStrict("http://172.32.0.1/", false));
			String[] mustReject = { "http://10.0.0.1/", "http://172.16.0.1/", "http://172.31.255.255/", "http://192.168.0.1/", "http://127.0.0.1:8080/", "http://localhost/", "http://[::1]/", "http://[fe80::1]/", "http://[fd00::1]/", "http://a.local/", "http://b.internal/", "http://c.home.arpa/", "http://100.64.0.1/" };
			for (String u : mustReject) {
				assertTrue(u, strictReason(u, false).contains("本机或内网"));
			}
			// [D28] 单前缀文案:基础档的拒绝原因经严格档只加一层前缀(ASCII 冒号,全仓无全角冒号)
			assertEquals("网页地址不允许:只允许 http/https", strictReason("ftp://example.com/", false));
			assertEquals("网页地址不允许:不允许访问该主机", strictReason("http://169.254.169.254/", false));
			assertEquals("网页地址不允许:不允许读取本机或内网地址", strictReason("http://10.0.0.1/", false));
		} finally {
			OutboundUrlGuard.setResolverForTests(null);
		}
	}

	@Test
	public void strictGuardResolvedLayerAndLoopbackLiteralVectors() {
		OutboundUrlGuard.setResolverForTests(publicOnlyResolver());
		try {
			assertEquals("https://example.com/", OutboundUrlGuard.validateStrict("https://example.com/", false));
			// [D21] 公网名字解析到回环 ⇒ 拒;解析失败 / 无结果 ⇒ 拒(读不到也不该读)
			assertTrue(strictReason("http://inner.example/", false).contains("解析到本机或内网"));
			assertTrue(strictReason("http://dead.example/", false).contains("解析失败"));
			assertTrue(strictReason("http://empty.example/", false).contains("无解析结果"));
			// [D30] allowLoopback 只放回环字面量(127.x / localhost / ::1):名字主机照样解析判定;非回环私网字面量照拒;自身端口照拒
			assertEquals("http://127.0.0.1:18081/x", OutboundUrlGuard.validateStrict("http://127.0.0.1:18081/x", true));
			assertEquals("http://localhost:18081/x", OutboundUrlGuard.validateStrict("http://localhost:18081/x", true));
			assertEquals("http://[::1]:18081/x", OutboundUrlGuard.validateStrict("http://[::1]:18081/x", true));
			assertTrue(strictReason("http://inner.example/", true).contains("解析到本机或内网"));
			assertTrue(strictReason("http://10.0.0.1/", true).contains("本机或内网"));
			assertTrue(strictReason("http://127.0.0.1:9999/api", true).contains("自身端口"));
			// 严格档同样回 trim 后的串
			assertEquals("https://example.com/b", OutboundUrlGuard.validateStrict(" https://example.com/b ", false));
		} finally {
			OutboundUrlGuard.setResolverForTests(null);
		}
	}

	@Test
	public void addressClassificationVectors() throws Exception {
		String[] privateOnes = { "127.0.0.1", "10.1.2.3", "172.16.5.5", "192.168.1.1", "169.254.1.1", "100.64.0.1", "100.127.255.255", "192.0.0.1", "198.18.0.1", "198.19.255.1", "240.0.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fc00::1", "fd12::1", "64:ff9b::7f00:1", "2001:db8::1", "192.88.99.1", "::ffff:127.0.0.1" };
		for (String ip : privateOnes) {
			assertTrue(ip, OutboundUrlGuard.isPrivateOrLocalAddress(InetAddress.getByName(ip)));
		}
		String[] publicOnes = { "8.8.8.8", "93.184.216.34", "172.32.0.1", "100.128.0.1", "198.20.0.1", "2606:4700::1111", "1.1.1.1" };
		for (String ip : publicOnes) {
			assertFalse(ip, OutboundUrlGuard.isPrivateOrLocalAddress(InetAddress.getByName(ip)));
		}
		assertTrue(OutboundUrlGuard.isPrivateOrLocalAddress(null));
		assertTrue(OutboundUrlGuard.isDottedQuad("10.0.0.1"));
		assertFalse(OutboundUrlGuard.isDottedQuad("10.gov"));
		assertFalse(OutboundUrlGuard.isDottedQuad("1.2.3"));
		assertTrue(OutboundUrlGuard.isLoopbackLiteral("localhost"));
		assertTrue(OutboundUrlGuard.isLoopbackLiteral("127.9.9.9"));
		assertTrue(OutboundUrlGuard.isLoopbackLiteral("::1"));
		assertFalse(OutboundUrlGuard.isLoopbackLiteral("127.example"));
		assertFalse(OutboundUrlGuard.isLoopbackLiteral("10.0.0.1"));
		assertTrue(OutboundUrlGuard.isPrivateOrLocalHost(""));
		assertTrue(OutboundUrlGuard.isPrivateOrLocalHost("x.localhost"));
		assertFalse(OutboundUrlGuard.isPrivateOrLocalHost("fcc.gov"));
		assertFalse(OutboundUrlGuard.isPrivateOrLocalHost("10.gov"));
	}
}
