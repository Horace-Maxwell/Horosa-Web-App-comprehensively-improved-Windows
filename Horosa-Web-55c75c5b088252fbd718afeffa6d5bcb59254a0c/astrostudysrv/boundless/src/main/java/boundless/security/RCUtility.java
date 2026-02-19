package boundless.security;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

import boundless.utility.RandomUtility;

public class RCUtility extends SecurityUtility {
	public final static int FakeDataLength = 512;
	
	/**
	 * RC4加密
	 * @param plain 明文数据
	 * @param key 秘钥
	 * @param rc4FakeDataLength 假数据长度，目的是添加些附加的字节，以增加加密强度，一般为512
	 * @return 密文数据
	 * @throws Exception
	 */
	public static byte[] rc4Encrypt(byte[] plain, byte[] key, int rc4FakeDataLength) throws Exception {
		Cipher cipher = Cipher.getInstance("RC4", bcProvider);
		SecretKeySpec tmpKey = new SecretKeySpec(key, "RC4");
		
		cipher.init(Cipher.ENCRYPT_MODE, tmpKey);
		cipher.update(new byte[rc4FakeDataLength]);		
		byte[] dest = cipher.doFinal(plain);
		
		return dest;		
	}

	/**
	 * RC4解密
	 * @param cipherData 密文数据
	 * @param key 秘钥
	 * @param rc4FakeDataLength 假数据长度，目的是添加些附加的字节，以增加加密强度，一般为512
	 * @return 明文数据
	 * @throws Exception
	 */
	public static byte[] rc4Decrypt(byte[] cipherData, byte[] key, int rc4FakeDataLength) throws Exception {
		Cipher cipher = Cipher.getInstance("RC4", bcProvider);
		SecretKeySpec tmpKey = new SecretKeySpec(key, "RC4");
		
		cipher.init(Cipher.DECRYPT_MODE, tmpKey);
		cipher.update(new byte[rc4FakeDataLength]);
		byte[] plainText = cipher.doFinal(cipherData);
		
		return plainText;
	}

	public static byte[] rc4Encrypt(byte[] plain, byte[] key) throws Exception {
		return rc4Encrypt(plain, key, FakeDataLength);
	}
	
	public static String rc4EncryptReturnBase64(byte[] plain, byte[] key){
		try{
			byte[] res = rc4Encrypt(plain, key);
			return SecurityUtility.base64(res);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] rc4Decrypt(byte[] cipherData, byte[] key) throws Exception{
		return rc4Decrypt(cipherData, key, FakeDataLength);
	}
	
	public static void main(String[] args) throws Exception {
		byte[] key1 = SecurityUtility.generateSecureRandomKey(16);
		byte[] key2 = SecurityUtility.generateSecureRandomKey(16);
		
		String plain = RandomUtility.randomString(128);
		byte[] encode1 = rc4Encrypt(plain.getBytes("UTF-8"), key1, 512);
		byte[] encode2 = rc4Encrypt(plain.getBytes("UTF-8"), key2, 512);
		
		byte[] decode1 = rc4Decrypt(encode1, key1, 512);
		byte[] decode2 = rc4Decrypt(encode2, key2, 512);
		System.out.println("cypher len:" + encode1.length + "\tdecode:" + new String(decode1, "UTF-8"));
		System.out.println("cypher len:" + encode2.length + "\tdecode:" + new String(decode2, "UTF-8"));
	}
	
}
