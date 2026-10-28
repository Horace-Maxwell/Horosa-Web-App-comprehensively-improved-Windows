package boundless.utility;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.Test;

/**
 * 密钥脱敏单源的判别向量:该掩的名字 / 形态必掩,不该掩的(业务字段里带 key / token 字样的)原样;
 * 写时复制不动调用方的活对象。
 */
public class SecretRedactorTest {

	/** 各写法的密钥类字段名:大小写、下划线、连字符、前后缀。 */
	static final String[] SENSITIVE_NAMES = {
		"apiKey", "APIKEY", "api_key", "api-key", "ApiKey", "key", "Key", "KEY",
		"token", "Token", "accessToken", "access_token", "refresh_token", "idToken", "X-Subscription-Token",
		"secret", "client_secret", "clientSecret", "appSecret",
		"authorization", "Authorization", "Proxy-Authorization", "bearer", "Bearer",
		"x-api-key", "X-Api-Key", "x-goog-api-key", "X-Goog-Api-Key",
		"password", "Password", "PASSWORD", "UserPassword", "LoginPassword", "OldPassword", "passwd", "Pwd",
		"cookie", "Set-Cookie", "extraHeaders", "_rsaparam_", "privateKey", "secret_key", "accessKey", "credentials",
		"signature", "sigkey"
	};

	/** 业务字段:名字里带 key / token / auth 字样但不是凭据,必须原样。 */
	static final String[] PLAIN_NAMES = {
		"pdTimeKey", "rateKey", "star_sky_key", "countKey", "keyword", "keys", "monkey",
		"maxTokens", "max_tokens", "totalTokens", "tokens", "authHeaderName", "authPrefix", "AuthType",
		"model", "providerType", "baseUrl", "messages", "content", "transcode"
	};

	@Test
	public void sensitiveNamesAreRecognisedAcrossSpellings() {
		for(String n : SENSITIVE_NAMES) {
			assertTrue(n, SecretRedactor.isSensitiveName(n));
		}
		for(String n : PLAIN_NAMES) {
			assertFalse(n, SecretRedactor.isSensitiveName(n));
		}
		assertFalse(SecretRedactor.isSensitiveName(null));
		assertFalse(SecretRedactor.isSensitiveName("__"));
		// 追加表(配置项)同样按归一形比较
		assertTrue(SecretRedactor.isSensitiveName("My-Custom_Field", new String[] {"mycustomfield"}));
		assertFalse(SecretRedactor.isSensitiveName("My-Custom_Field", null));
	}

	@Test
	public void textShapesAreMasked() {
		assertEquals("https://h/m?alt=sse&key=***", SecretRedactor.redactText("https://h/m?alt=sse&key=AnyThing123"));
		assertEquals("https://h/m?api_key=***&x=1", SecretRedactor.redactText("https://h/m?api_key=abc123&x=1"));
		assertEquals("providerType=deepseek&apiKey=***&token=***", SecretRedactor.redactText("providerType=deepseek&apiKey=sk-secret-value&token=abc123"));
		assertEquals("Authorization: Bearer ***", SecretRedactor.redactText("Authorization: Bearer abcdef123456"));
		assertEquals("Authorization: Basic ***", SecretRedactor.redactText("Authorization: Basic dXNlcjpwYXNz"));
		assertEquals("x-api-key: ***", SecretRedactor.redactText("x-api-key: anth-secret-zzz"));
		assertEquals("X-Goog-Api-Key: ***, next", SecretRedactor.redactText("X-Goog-Api-Key: plainValue77, next"));
		assertEquals("用 *** 调用", SecretRedactor.redactText("用 sk-abcdefghijklmnop 调用"));
		assertEquals("key ***", SecretRedactor.redactText("key AIzaSyA1234567890abcdefghijk"));
		assertEquals("{\"apiKey\":\"***\",\"model\":\"m\"}", SecretRedactor.redactText("{\"apiKey\":\"opaque-1\",\"model\":\"m\"}"));
		assertEquals("{\\\"api_key\\\":\\\"***\\\",\\\"model\\\":\\\"m\\\"}", SecretRedactor.redactText("{\\\"api_key\\\":\\\"opaque-2\\\",\\\"model\\\":\\\"m\\\"}"));
		// 本次密钥原文(不是任何常见形态)+ 网址编码形
		assertEquals("x *** y ***", SecretRedactor.redactText("x opaque/Key+1 y opaque%2FKey%2B1", "opaque/Key+1"));
		// 其它认证类型连同令牌一起掩;Cookie 多个键值对全掩;名=值写法里的 Bearer 令牌不漏
		assertEquals("Authorization: ***", SecretRedactor.redactText("Authorization: Token abcdef123456"));
		assertEquals("Proxy-Authorization: ***", SecretRedactor.redactText("Proxy-Authorization: Digest username=u"));
		assertEquals("Authorization: ***", SecretRedactor.redactText("Authorization: Bearer lowercaseonly"));
		assertEquals("Cookie: ***", SecretRedactor.redactText("Cookie: a=b; sid=secret-1; c=d"));
		assertEquals("Set-Cookie: ***\nnext", SecretRedactor.redactText("Set-Cookie: sid=secret-2; Path=/\nnext"));
		String eq = SecretRedactor.redactText("authorization=Bearer opaqueToken99");
		assertFalse(eq, eq.contains("opaqueToken99"));
		// 不该动的
		assertEquals("basic authentication required", SecretRedactor.redactText("basic authentication required"));
		assertEquals("bearer token missing", SecretRedactor.redactText("bearer token missing"));
		assertEquals("pdTimeKey=12&monkey=3", SecretRedactor.redactText("pdTimeKey=12&monkey=3"));
		assertEquals("{\"pdTimeKey\":\"a\",\"maxTokens\":\"9\"}", SecretRedactor.redactText("{\"pdTimeKey\":\"a\",\"maxTokens\":\"9\"}"));
		assertEquals("没有密钥的文字原样", SecretRedactor.redactText("没有密钥的文字原样", "", null));
		assertNull(SecretRedactor.redactText(null));
		// 幂等
		String once = SecretRedactor.redactText("Authorization: Bearer abcdef123456 ?key=zz {\"token\":\"t1\"}");
		assertEquals(once, SecretRedactor.redactText(once));
	}

	@Test
	public void longJsonStringValueDoesNotOverflowTheStack() throws Exception {
		// 交替分组的重复在 Java 正则里逐字符递归:几千字的 JSON 字符串值曾让 redactText 栈溢出(普通线程约 1 万字)
		StringBuilder sb = new StringBuilder("{\"note\":\"");
		for(int i = 0; i < 200000; i++) {
			sb.append(i % 50 == 0 ? "\\n" : "x");
		}
		sb.append("\",\"apiKey\":\"opaque-long-1\"}");
		final String big = sb.toString();
		final String[] out = new String[1];
		final Throwable[] err = new Throwable[1];
		Thread t = new Thread(null, () -> {
			try {
				out[0] = SecretRedactor.redactText(big);
			}catch(Throwable e) {
				err[0] = e;
			}
		}, "small-stack", 256 * 1024);
		t.start();
		t.join();
		assertNull(err[0]);
		assertTrue(out[0].endsWith("\"apiKey\":\"***\"}"));
		assertEquals(big.length() - "opaque-long-1".length() + 3, out[0].length());
	}

	@Test
	public void nestedRecordIsMaskedWithoutTouchingTheInput() {
		Map<String, Object> options = new LinkedHashMap<String, Object>();
		Map<String, Object> extra = new LinkedHashMap<String, Object>();
		extra.put("X-Custom-Auth", "custom-opaque-1");
		options.put("extraHeaders", extra);
		options.put("authHeaderName", "X-Custom-Auth");
		Map<String, Object> params = new LinkedHashMap<String, Object>();
		params.put("providerType", "custom");
		params.put("apiKey", "opaque-api-1");
		params.put("providerOptions", options);
		params.put("pdTimeKey", "keep-me");
		List<Object> list = new ArrayList<Object>();
		Map<String, Object> inList = new LinkedHashMap<String, Object>();
		inList.put("Token", "opaque-token-1");
		list.add("https://x/y?key=opaque-q-1");
		list.add(inList);
		params.put("items", list);
		params.put("arr", new Object[] {"Bearer opaque-bearer-1", "plain"});
		Map<String, Object> head = new LinkedHashMap<String, Object>();
		head.put("Authorization", "Bearer opaque-auth-1");
		head.put("x-goog-api-key", "opaque-goog-1");
		head.put("clientapp", "desktop");
		Map<String, Object> record = new LinkedHashMap<String, Object>();
		record.put("_id", "rec-1");
		record.put("head", head);
		record.put("params", params);
		record.put("errmsg", "upstream failed: https://h/v1?key=opaque-err-1");
		record.put("errstack", "java.lang.RuntimeException: {\"password\":\"opaque-pw-1\"}");

		String before = JsonUtility.encode(record);
		Map<String, Object> out = SecretRedactor.redactRecord(record);
		String json = JsonUtility.encode(out);

		for(String sec : new String[] {"opaque-api-1", "custom-opaque-1", "opaque-token-1", "opaque-q-1", "opaque-bearer-1",
				"opaque-auth-1", "opaque-goog-1", "opaque-err-1", "opaque-pw-1"}) {
			assertFalse(sec + " 漏网:" + json, json.contains(sec));
		}
		assertTrue(json.contains("keep-me"));
		assertTrue(json.contains("desktop"));
		assertTrue(json.contains("X-Custom-Auth"));
		assertEquals("rec-1", out.get("_id"));
		// 输入不动(请求上下文里的活对象还在用)
		assertEquals(before, JsonUtility.encode(record));
		assertEquals("opaque-api-1", params.get("apiKey"));
	}

	@Test
	public void cleanRecordIsReturnedAsIs() {
		Map<String, Object> rec = new LinkedHashMap<String, Object>();
		rec.put("transcode", "/chart");
		rec.put("params", new LinkedHashMap<String, Object>(Map.of("date", "2020-01-01", "pdTimeKey", "x")));
		rec.put("list", Arrays.asList("a", "b"));
		assertSame(rec, SecretRedactor.redactRecord(rec));
		assertNull(SecretRedactor.redactRecord(null));
	}

	@Test
	public void protectedTopKeyKeepsItsNameButNotSecretsInside() {
		Map<String, Object> rec = new LinkedHashMap<String, Object>();
		rec.put("key", "2020-01-01");
		rec.put("token", "opaque-t-9");
		Map<String, Object> out = SecretRedactor.redactRecord(rec, null, "key");
		assertEquals("2020-01-01", out.get("key"));
		assertEquals(SecretRedactor.MASK, out.get("token"));
	}

	@Test
	public void headersAreMaskedByName() {
		Map<String, String> h = new LinkedHashMap<String, String>();
		h.put("Authorization", "Bearer opaque-h-1");
		h.put("x-api-key", "opaque-h-2");
		h.put("Content-Type", "application/json");
		Map<String, String> out = SecretRedactor.redactHeaders(h);
		assertEquals(SecretRedactor.MASK, out.get("Authorization"));
		assertEquals(SecretRedactor.MASK, out.get("x-api-key"));
		assertEquals("application/json", out.get("Content-Type"));
		assertTrue(SecretRedactor.redactHeaders(null).isEmpty());
	}
}
