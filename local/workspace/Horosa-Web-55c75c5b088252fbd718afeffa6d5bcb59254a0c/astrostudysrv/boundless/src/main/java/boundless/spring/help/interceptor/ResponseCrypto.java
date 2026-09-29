package boundless.spring.help.interceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;

import boundless.security.SimpleWebSocketSecUtility;

/**
 * webencrypt_gcm_v1:响应加密的单一出口。客户端在请求头声明 {@code X-Horosa-Crypto: gcm1} 且本请求带会话钥时,
 * 用该会话钥做 AES-128-GCM(响应头 Encrypted: 2,免 RSA 私钥运算,前端可用 WebCrypto 异步解);否则走旧路径
 * (逐响应随机钥 + RSA,Encrypted: 1)。-Dwebencrypt.v2=false 一键回旧。
 */
public final class ResponseCrypto {
	public static final String CAP_HEADER = "X-Horosa-Crypto";
	public static final String CAP_GCM1 = "gcm1";
	static final boolean V2_ON = !"false".equalsIgnoreCase(System.getProperty("webencrypt.v2", "true"));

	private ResponseCrypto() {
	}

	static byte[] eligibleSessionKey() {
		if(!V2_ON) {
			return null;
		}
		byte[] key = RequestHeaderInterceptor.currentSessionKey();
		if(key == null || key.length == 0) {
			return null;
		}
		try {
			Object req = TransData.getRequestHeader(KeyConstants.RequestObject);
			if(!(req instanceof HttpServletRequest)) {
				return null;
			}
			String cap = ((HttpServletRequest) req).getHeader(CAP_HEADER);
			return cap != null && CAP_GCM1.equalsIgnoreCase(cap.trim()) ? key : null;
		}catch(Exception e) {
			return null;
		}
	}

	/** Spring 消息转换器路径。 */
	public static String encrypt(byte[] raw, String modulus, String privexp, HttpHeaders headers) {
		byte[] key = eligibleSessionKey();
		if(key != null) {
			String encoded = SimpleWebSocketSecUtility.encryptGcm(raw, key);
			headers.set("Encrypted", "2");
			return encoded;
		}
		String encoded = SimpleWebSocketSecUtility.encrypt(raw, modulus, privexp);
		headers.set("Encrypted", "1");
		return encoded;
	}

	/** Servlet 直写路径(过滤器异常信封)。 */
	public static String encrypt(byte[] raw, String modulus, String privexp, HttpServletResponse response) {
		byte[] key = eligibleSessionKey();
		if(key != null) {
			String encoded = SimpleWebSocketSecUtility.encryptGcm(raw, key);
			response.setHeader("Encrypted", "2");
			return encoded;
		}
		String encoded = SimpleWebSocketSecUtility.encrypt(raw, modulus, privexp);
		response.setHeader("Encrypted", "1");
		return encoded;
	}
}
