package boundless.security;

import java.security.SecureRandom;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import boundless.exception.DecryptException;
import boundless.exception.DecryptTimeoutException;
import boundless.exception.EncryptException;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.ConvertUtility;
import boundless.utility.RandomUtility;

public class SimpleWebSocketSecUtility {
	private static int defTimeout = PropertyPlaceholder.getProperty("webencrypt.timeout", 180);

	// webencrypt_keycache_v1:客户端在同一页面会话里复用同一把 AES 传输钥及其 RSA 密文(前端 rsaSessionKey),
	// 于是每个请求的 parts[1] 恒同 —— 逐请求重解 RSA(2048 位模幂 + KeyFactory)是纯浪费。按「模数|RSA 密文」记忆
	// 已解出的钥(有界 LRU),命中即免模幂;-Dwebencrypt.keycache=false 关掉(恒重解,逐字节旧行为)。
	private static final boolean KEY_CACHE_ON = !"false".equalsIgnoreCase(System.getProperty("webencrypt.keycache", "true"));
	private static final int KEY_CACHE_MAX = 512;
	private static final Map<String, byte[]> KEY_CACHE = new LinkedHashMap<String, byte[]>(64, 0.75f, true) {
		private static final long serialVersionUID = 1L;
		@Override
		protected boolean removeEldestEntry(Map.Entry<String, byte[]> eldest) {
			return size() > KEY_CACHE_MAX;
		}
	};
	/** 真正做过 RSA 解钥的次数(测试钉缓存契约用)。 */
	public static final AtomicLong RSA_DECRYPT_CALLS = new AtomicLong();
	private static final SecureRandom GCM_RANDOM = new SecureRandom();
	private static final int GCM_IV_BYTES = 12;
	private static final int GCM_TAG_BITS = 128;

	/** 从加密信封取会话传输钥(parts[1] 的 RSA 密文 → 明文钥字节;命中缓存不做模幂)。 */
	public static byte[] sessionKey(String codedstr, String modulus, String privateExponent) {
		String[] parts = codedstr.split(",");
		if(parts.length < 2) {
			throw new DecryptException(new IllegalArgumentException("cypher.envelope"));
		}
		String blob = parts[1];
		String cacheKey = modulus + "|" + blob;
		if(KEY_CACHE_ON) {
			synchronized (KEY_CACHE) {
				byte[] hit = KEY_CACHE.get(cacheKey);
				if(hit != null) {
					return hit.clone();
				}
			}
		}
		RSA_DECRYPT_CALLS.incrementAndGet();
		byte[] rckey = RSAUtility.decrypt(blob, modulus, privateExponent);
		if(KEY_CACHE_ON && rckey != null) {
			synchronized (KEY_CACHE) {
				KEY_CACHE.put(cacheKey, rckey.clone());
			}
		}
		return rckey;
	}

	/** 已知会话钥时解信封(时效校验与旧 decrypt 逐字节同语义)。 */
	public static byte[] decryptWithKey(String codedstr, byte[] rckey, int timeout, boolean forceTimeout){
		try{
			String[] parts = codedstr.split(",");
			if(forceTimeout) {
				if(parts.length < 3) {
					throw new DecryptTimeoutException("cypher.timeout");
				}
			}
			if(parts.length > 2 && timeout > 0 && forceTimeout){
				String tmb64 = parts[2];
				byte[] tmdata = SecurityUtility.fromBase64(tmb64);
				byte[] tmplaindata = AESUtility.decrypt(tmdata, rckey);
				String tmstr = new String(tmplaindata, "UTF-8");
				long ms = ConvertUtility.getValueAsLong(tmstr);
				long now = System.currentTimeMillis();
				if(now > ms + timeout * 1000){
					throw new DecryptTimeoutException("cypher.timeout");
				}
			}
			byte[] codeddata = SecurityUtility.fromBase64(parts[0]);
			return AESUtility.decrypt(codeddata, rckey);
		}catch(DecryptTimeoutException e){
			throw e;
		}catch(Exception e){
			throw new DecryptException(e);
		}
	}

	public static byte[] decryptWithKey(String codedstr, byte[] rckey, boolean forceTimeout){
		return decryptWithKey(codedstr, rckey, defTimeout, forceTimeout);
	}

	// webencrypt_gcm_v1:响应用请求里已协商的会话钥做 AES-128-GCM(随机 12 字节 IV 前置,128 位标签),
	// 不再逐响应生成随机钥 + RSA 私钥运算;输出 base64(iv || 密文 || 标签),响应头 Encrypted: 2。
	// 只在客户端声明能力(X-Horosa-Crypto: gcm1)且本请求带会话钥时启用,其余照旧 Encrypted: 1。
	public static String encryptGcm(byte[] plaindata, byte[] key) {
		try{
			byte[] iv = new byte[GCM_IV_BYTES];
			GCM_RANDOM.nextBytes(iv);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
			byte[] ct = cipher.doFinal(plaindata);
			byte[] out = new byte[iv.length + ct.length];
			System.arraycopy(iv, 0, out, 0, iv.length);
			System.arraycopy(ct, 0, out, iv.length, ct.length);
			return SecurityUtility.base64(out);
		}catch(Exception e){
			throw new EncryptException(e);
		}
	}

	public static byte[] decryptGcm(String b64, byte[] key) {
		try{
			byte[] all = SecurityUtility.fromBase64(b64);
			if(all == null || all.length <= GCM_IV_BYTES) {
				throw new IllegalArgumentException("gcm.envelope");
			}
			byte[] iv = new byte[GCM_IV_BYTES];
			System.arraycopy(all, 0, iv, 0, GCM_IV_BYTES);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
			return cipher.doFinal(all, GCM_IV_BYTES, all.length - GCM_IV_BYTES);
		}catch(Exception e){
			throw new DecryptException(e);
		}
	}
	private static String ivStr = "0123456789ABCDEF";
	private static byte[] ivRaw = new byte[128];
	static {
		SecurityUtility.initProvider();
		try {
			ivRaw = ivStr.getBytes("UTF-8");
		}catch(Exception e) {
			
		}
	}
	
	public static String encrypt(byte[] plaindata, int rcKeyLength, String modulus, String publicExponent, Date keytime){
		try{
			String keystr = RandomUtility.randomString(rcKeyLength);
			byte[] rckey = keystr.getBytes("UTF-8");
			byte[] codeddata = AESUtility.encrypt(plaindata, rckey);
			String codedtxt = SecurityUtility.base64(codeddata);
			
			byte[] codeddeskey = RSAUtility.encrypt(rckey, modulus, publicExponent);
			String codeddeskeytxt = SecurityUtility.base64(codeddeskey);
			
			StringBuilder sb = new StringBuilder(codedtxt);
			sb.append(",").append(codeddeskeytxt);
			if(keytime != null){
				String tmstr = keytime.getTime() + "";
				byte[] tmdata = AESUtility.encrypt(tmstr.getBytes("UTF-8"), rckey);
				String tmcoded = SecurityUtility.base64(tmdata);
				sb.append(",").append(tmcoded);
			}
			return sb.toString();
		}catch(Exception e){
			throw new EncryptException(e);
		}
	}
	
	public static byte[] decrypt(String codedstr, String modulus, String privateExponent, int timeout, boolean forceTimeout){
		// webencrypt_keycache_v1:先取会话钥(缓存命中免模幂),再按旧语义解信封。
		byte[] rckey;
		try{
			rckey = sessionKey(codedstr, modulus, privateExponent);
		}catch(DecryptException e){
			throw e;
		}catch(Exception e){
			throw new DecryptException(e);
		}
		return decryptWithKey(codedstr, rckey, timeout, forceTimeout);
	}
	
	public static String encrypt(byte[] plaindata, int rcKeyLength, String modulus, String publicExponent){
		return encrypt(plaindata, rcKeyLength, modulus, publicExponent, null);
	}
	
	public static String encrypt(byte[] plaindata, String modulus, String publicExponent){
		return encrypt(plaindata, 16, modulus, publicExponent, null);
	}
	
	public static String encrypt(byte[] plaindata, String modulus, String publicExponent, Date tm){
		return encrypt(plaindata, 16, modulus, publicExponent, tm);
	}
	
	public static byte[] decrypt(String codedstr, String modulus, String privateExponent){
		return decrypt(codedstr, modulus, privateExponent, defTimeout, false);
	}

	public static byte[] decrypt(String codedstr, String modulus, String privateExponent, boolean forceTimeout){
		return decrypt(codedstr, modulus, privateExponent, defTimeout, forceTimeout);
	}

	
	
	public static void main(String[] args) throws Exception{
		String modulus="6C5BA65F46931FB71D2A1691ABFB3F3D92E4219E740A8AD95B0A9F490A022AF5077E818F06093E5A79BC7534AE931F5D5BD3B5B012E963EC028A29705DC6243771436F2A67335576A99DC13F9B35B5E30BD7F8EFD2BFBE9E67839A3BB800D239AEE4C1246F222E07848D7D58A755DEB6EA1752E139901FBFF883B87BFD4F67BA69D61E0CD9EE8BAB71C6915F02300E38AC242EE33F1A32C138442989932AE9220D9881ACCA455CEE8F1BFF321DF739507AE8E291DAD667A7492CD600C36AB7421B62C62F6236291583EF9EE2732766C93879B1ACD94A9F3F847AF1BE205F0BEFB1F1FAC6271189848F0A8872A7486EDD0BA6BD84116B5A85EA9ED6058E02DE59";
		String privateExp="1368BB3D57ABE4C36D02EBF5FDE34C29A05522BC7A36A53657BB685AB1E33F84926A1394E5D4E4095AC2EA0F9CB197ADA6541EB8423AF1FE055A701FC37C496270F44E463F240FCBE887EC64934DA49DDDB23AD1E2631C26CD8DE2238E4AFF5CFBB9D7EAC9C94A8B682FDBE2F45E4A3D6362F82285A80E37D9B0E66BB72CF0FC54672474DF1E52A9B3D9126D2C2E6FAAD302E1CFAA3ED66674D0B56D7A13C7375A1671AE663A75DA5CCB3CDFA1A617B947657848F80D1489093C0443E8C28FF7D1E70B7C5D7B247C2944B8210BA5A9176C5DD709989D062FA33403AA51EBFE876070DFE95C8FD8916B2BDEE14589C53E4B55C319245F3980777A624498E6C84D";
		String publicExp = "10001";
		
		String plain = "testtesttesttesttesttesttesttest";
		byte[] plainraw = plain.getBytes("UTF-8");
		String cypher = encrypt(plainraw, modulus, privateExp);
		
		byte[] raw = decrypt(cypher, modulus, publicExp);
		String str = new String(raw, "UTF-8");
		
		System.out.println(cypher);
		System.out.println(str);
		
		
		cypher = encrypt(plainraw, modulus, publicExp);
		raw = decrypt(cypher, modulus, privateExp);
		str = new String(raw, "UTF-8");
		
		System.out.println(cypher);
		System.out.println(str);
		
	}
}
