package boundless.security;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;

import org.junit.Test;

import boundless.exception.DecryptException;
import boundless.spring.help.interceptor.RsaParam;

/**
 * webencrypt_keycache_v1 / webencrypt_gcm_v1 金标:
 *  ① 旧信封 encrypt/decrypt 往返逐字节不变;② 同一 RSA 密文只做一次模幂(缓存),不同密文各一次;
 *  ③ GCM 往返(含中文)、IV 随机(两次密文不同)、篡改必失败。
 */
public class SimpleWebSocketSecUtilityV2Test {

	private static final RsaParam RSA = RSAUtility.genRsaParam();

	@Test
	public void legacyEnvelopeRoundTripUnchanged() {
		byte[] plain = "{\"名\":\"星阙\",\"x\":1.5}".getBytes(StandardCharsets.UTF_8);
		String coded = SimpleWebSocketSecUtility.encrypt(plain, RSA.modulus, RSA.pubexp);
		assertArrayEquals(plain, SimpleWebSocketSecUtility.decrypt(coded, RSA.modulus, RSA.privexp));
		assertEquals(2, coded.split(",").length);
	}

	@Test
	public void sessionKeyCacheSkipsRepeatedRsa() {
		byte[] plain = "{\"a\":1}".getBytes(StandardCharsets.UTF_8);
		String coded = SimpleWebSocketSecUtility.encrypt(plain, RSA.modulus, RSA.pubexp);
		long before = SimpleWebSocketSecUtility.RSA_DECRYPT_CALLS.get();
		byte[] k1 = SimpleWebSocketSecUtility.sessionKey(coded, RSA.modulus, RSA.privexp);
		byte[] k2 = SimpleWebSocketSecUtility.sessionKey(coded, RSA.modulus, RSA.privexp);
		SimpleWebSocketSecUtility.decrypt(coded, RSA.modulus, RSA.privexp);
		assertArrayEquals(k1, k2);
		assertEquals(before + 1, SimpleWebSocketSecUtility.RSA_DECRYPT_CALLS.get());
		String coded2 = SimpleWebSocketSecUtility.encrypt(plain, RSA.modulus, RSA.pubexp);
		SimpleWebSocketSecUtility.sessionKey(coded2, RSA.modulus, RSA.privexp);
		assertEquals(before + 2, SimpleWebSocketSecUtility.RSA_DECRYPT_CALLS.get());
		k1[0] ^= 0x7f;
		assertArrayEquals(k2, SimpleWebSocketSecUtility.sessionKey(coded, RSA.modulus, RSA.privexp));
	}

	@Test
	public void gcmRoundTripRandomIvAndTamperDetected() {
		byte[] key = "abcdefghijklmnop".getBytes(StandardCharsets.US_ASCII);
		byte[] plain = "{\"ResultCode\":0,\"Result\":{\"名\":\"星阙\"}}".getBytes(StandardCharsets.UTF_8);
		String c1 = SimpleWebSocketSecUtility.encryptGcm(plain, key);
		String c2 = SimpleWebSocketSecUtility.encryptGcm(plain, key);
		assertNotEquals(c1, c2);
		assertArrayEquals(plain, SimpleWebSocketSecUtility.decryptGcm(c1, key));
		assertArrayEquals(plain, SimpleWebSocketSecUtility.decryptGcm(c2, key));
		byte[] raw = java.util.Base64.getDecoder().decode(c1);
		raw[raw.length - 1] ^= 0x01;
		try {
			SimpleWebSocketSecUtility.decryptGcm(java.util.Base64.getEncoder().encodeToString(raw), key);
			fail("tampered tag must fail");
		} catch (DecryptException expected) {
			// ok
		}
	}
}
