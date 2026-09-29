package boundless.spring.help.interceptor;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;

import javax.servlet.http.HttpServletRequest;

import org.junit.After;
import org.junit.Test;
import org.springframework.http.HttpHeaders;

import boundless.security.RSAUtility;
import boundless.security.SimpleWebSocketSecUtility;

/**
 * webencrypt_gcm_v1 出口金标:① 无能力头 → Encrypted:1 旧信封;② 有能力头但无会话钥 → 1;
 * ③ 能力头 + 会话钥 → Encrypted:2 且能用同一钥解回;④ 能力头大小写 / 空白容错。
 */
public class ResponseCryptoTest {

	private static final RsaParam RSA = RSAUtility.genRsaParam();

	@After
	public void cleanup() {
		RequestHeaderInterceptor.setSessionKeyForTest(null);
		TransData.clearTransData();
	}

	private static HttpServletRequest requestWithCap(final String cap) {
		return (HttpServletRequest) Proxy.newProxyInstance(
			ResponseCryptoTest.class.getClassLoader(),
			new Class[] { HttpServletRequest.class },
			(proxy, method, args) -> {
				if("getHeader".equals(method.getName()) && args != null && args.length == 1) {
					return ResponseCrypto.CAP_HEADER.equalsIgnoreCase(String.valueOf(args[0])) ? cap : null;
				}
				if("getAttribute".equals(method.getName())) {
					return null;
				}
				Class<?> rt = method.getReturnType();
				if(rt == boolean.class) return false;
				if(rt == int.class) return 0;
				if(rt == long.class) return 0L;
				return null;
			});
	}

	private static void arrange(String cap, byte[] sessionKey) {
		TransData.clearTransData();
		TransData.setRequestData(new HashMap<String, Object>(), new HashMap<String, Object>());
		TransData.setRequestObject(requestWithCap(cap), null);
		RequestHeaderInterceptor.setSessionKeyForTest(sessionKey);
	}

	// 请求收尾 / 异步让出线程都要清会话钥:不经拦截器的下一个响应(如无处理器的 404)不能拿到上一请求的钥
	@Test
	public void sessionKeyClearedWhenRequestCompletesOrGoesAsync() throws Exception {
		RequestHeaderInterceptor interceptor = new RequestHeaderInterceptor();
		RequestHeaderInterceptor.setSessionKeyForTest("0123456789abcdef".getBytes(StandardCharsets.US_ASCII));
		interceptor.afterCompletion(requestWithCap(null), null, null, new Exception("handler failed"));
		assertEquals(null, RequestHeaderInterceptor.currentSessionKey());
		RequestHeaderInterceptor.setSessionKeyForTest("0123456789abcdef".getBytes(StandardCharsets.US_ASCII));
		interceptor.afterConcurrentHandlingStarted(requestWithCap(null), null, null);
		assertEquals(null, RequestHeaderInterceptor.currentSessionKey());
	}

	@Test
	public void noCapabilityHeaderKeepsLegacyEnvelope() {
		byte[] key = "abcdefghijklmnop".getBytes(StandardCharsets.US_ASCII);
		arrange(null, key);
		HttpHeaders h = new HttpHeaders();
		byte[] plain = "{\"a\":1}".getBytes(StandardCharsets.UTF_8);
		String out = ResponseCrypto.encrypt(plain, RSA.modulus, RSA.privexp, h);
		assertEquals("1", h.getFirst("Encrypted"));
		assertEquals(2, out.split(",").length);
	}

	@Test
	public void capabilityWithoutSessionKeyKeepsLegacyEnvelope() {
		arrange("gcm1", null);
		HttpHeaders h = new HttpHeaders();
		ResponseCrypto.encrypt("{\"a\":1}".getBytes(StandardCharsets.UTF_8), RSA.modulus, RSA.privexp, h);
		assertEquals("1", h.getFirst("Encrypted"));
	}

	@Test
	public void capabilityAndSessionKeyUseGcm() {
		byte[] key = "abcdefghijklmnop".getBytes(StandardCharsets.US_ASCII);
		arrange(" GCM1 ", key);
		HttpHeaders h = new HttpHeaders();
		byte[] plain = "{\"ResultCode\":0,\"名\":\"星阙\"}".getBytes(StandardCharsets.UTF_8);
		String out = ResponseCrypto.encrypt(plain, RSA.modulus, RSA.privexp, h);
		assertEquals("2", h.getFirst("Encrypted"));
		assertArrayEquals(plain, SimpleWebSocketSecUtility.decryptGcm(out, key));
	}
}
