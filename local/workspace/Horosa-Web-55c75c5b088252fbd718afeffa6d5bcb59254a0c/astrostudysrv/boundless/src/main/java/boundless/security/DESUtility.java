package boundless.security;

import java.security.SecureRandom;
import java.security.Key;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.DESKeySpec;
import javax.crypto.spec.DESedeKeySpec;
import javax.crypto.spec.IvParameterSpec;

import boundless.net.StreamReader;


public class DESUtility extends SecurityUtility {
	
	private static final String Des3Algorithm = "DESede";

	public static String encryptDES(String encryptString, String key) {
		try{
			byte[] plainText = encryptString.getBytes("UTF-8");
			byte[] bytekey = key.getBytes("UTF-8");
			byte[] res = encrypt(plainText, bytekey);
			return base64(res);
		}catch(Exception e){
			e.printStackTrace();
			return null;
		}
	}
	
	public static byte[] encryptDESToBytes(String encryptString, String key){
		try{
			byte[] plainText = encryptString.getBytes("UTF-8");
			byte[] bytekey = key.getBytes("UTF-8");
			byte[] res = encrypt(plainText, bytekey);
			return res;
		}catch(Exception e){
			e.printStackTrace();
			return null;
		}
	}

	public static String encryptDES(String encryptString, String key, String iv) {
		try{
			byte[] plainText = encryptString.getBytes("UTF-8");
			byte[] bytekey = key.getBytes("UTF-8");
			byte[] ivdata = iv.getBytes("UTF-8");
			byte[] res = encrypt(plainText, bytekey, ivdata);
			return base64(res);
		}catch(Exception e){
			e.printStackTrace();
			return null;
		}
	}

	public static String decryptDES(String decryptString, String key) {
		try{
			byte[] cipherText = fromBase64(decryptString);
			byte[] bytekey = key.getBytes("UTF-8");
			byte[] res = decrypt(cipherText, bytekey);
			return new String(res, "UTF-8");
		}catch(Exception e){
			boundless.log.Logger.globalLog.error(e.getMessage());
			return null;
		}
		
	}
	
	public static byte[] decryptDES(byte[] cipherText, String key) {
		try{
			byte[] bytekey = key.getBytes("UTF-8");
			byte[] res = decrypt(cipherText, bytekey);
			return res;
		}catch(Exception e){
			boundless.log.Logger.globalLog.error(e.getMessage());
			return null;
		}
		
	}
	
	public static String decryptDES(String decryptString, String key, String iv) {
		try{
			byte[] cipherText = fromBase64(decryptString);
			byte[] bytekey = key.getBytes("UTF-8");
			byte[] ivdata = iv.getBytes("UTF-8");
			byte[] res = decrypt(cipherText, bytekey, ivdata);
			return new String(res, "UTF-8");
		}catch(Exception e){
			boundless.log.Logger.globalLog.error(e.getMessage());
			return null;
		}
		
	}
	
	public static byte[] encrypt(byte[] plainText, byte[] key) throws Exception {
		return encrypt(plainText, key, "DES/ECB/PKCS5Padding");
    }

	public static byte[] encrypt(byte[] plainText, byte[] key, String padMode) throws Exception {
		DESKeySpec dks = new DESKeySpec(key);
		SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("DES");
		SecretKey seckey = keyFactory.generateSecret(dks);
		SecureRandom sr = new SecureRandom();
		Cipher cipher = Cipher.getInstance(padMode);
		cipher.init(Cipher.ENCRYPT_MODE, seckey, sr);
		byte[] encryptedData = cipher.doFinal(plainText);
		return encryptedData;
    }

	public static byte[] encrypt(byte[] plainText, byte[] key, byte[] iv) throws Exception {
		return encrypt(plainText, key, iv, "DES/CBC/PKCS5Padding");
    }

	public static byte[] encrypt(byte[] plainText, byte[] key, byte[] iv, String padMode) throws Exception {
		DESKeySpec dks = new DESKeySpec(key);
		SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("DES");
		SecretKey seckey = keyFactory.generateSecret(dks);
		IvParameterSpec ivspec = new IvParameterSpec(iv);
		Cipher cipher = Cipher.getInstance(padMode);
		cipher.init(Cipher.ENCRYPT_MODE, seckey, ivspec);
		byte[] encryptedData = cipher.doFinal(plainText);
		return encryptedData;
    }

    public static byte[] decrypt(byte[] cipherText, byte[] key) throws Exception {
		return decrypt(cipherText, key, "DES/ECB/PKCS5Padding");
    }	
    
    public static byte[] decrypt(byte[] cipherText, byte[] key, String padMode) throws Exception {
		DESKeySpec dks = new DESKeySpec(key);
		SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("DES");
		SecretKey seckey = keyFactory.generateSecret(dks);
		SecureRandom sr = new SecureRandom();
		Cipher cipher = Cipher.getInstance(padMode);
		cipher.init(Cipher.DECRYPT_MODE, seckey, sr);
		byte[] decryptedData = cipher.doFinal(cipherText);
		return decryptedData;
    }	
    
    public static byte[] decrypt(byte[] cipherText, byte[] key, byte[] iv) throws Exception {
		return decrypt(cipherText, key, iv, "DES/CBC/PKCS5Padding");
    }	
    
    public static byte[] decrypt(byte[] cipherText, byte[] key, byte[] iv, String padMode) throws Exception {
		DESKeySpec dks = new DESKeySpec(key);
		SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("DES");
		SecretKey seckey = keyFactory.generateSecret(dks);
		IvParameterSpec ivspec = new IvParameterSpec(iv);
		Cipher cipher = Cipher.getInstance(padMode);
		cipher.init(Cipher.DECRYPT_MODE, seckey, ivspec);
		byte[] decryptedData = cipher.doFinal(cipherText);
		return decryptedData;
    }	
    
 
	/**
	 * Description:3des加密 Author: guojianyun_91 Date: 2015年9月8日 下午3:09:34
	 * 
	 * @param key
	 * @param data
	 * @return
	 * @throws Exception
	 */
	public static byte[] encodeDes3ECB(byte[] data, String key) throws Exception {
		byte[] bkey = key.getBytes("UTF-8");
		return encodeDes3ECB(data, bkey);
	}
	
	public static byte[] encodeDes3ECB(byte[] data, byte[] key) throws Exception{
		Key deskey = null;
		DESedeKeySpec spec = new DESedeKeySpec(key);
		SecretKeyFactory keyfactory = SecretKeyFactory.getInstance(Des3Algorithm);
		deskey = keyfactory.generateSecret(spec);
		Cipher cipher = Cipher.getInstance(Des3Algorithm + "/ECB/PKCS7Padding");
		cipher.init(Cipher.ENCRYPT_MODE, deskey);
		return cipher.doFinal(data);
	}

	/**
	 * Description:3des解密 Author: guojianyun_91 Date: 2015年9月8日 下午3:09:22
	 * 
	 * @param key
	 * @param data
	 * @return
	 * @throws Exception
	 */
	public static byte[] decodeDes3ECB(byte[] data, String key) throws Exception {
		byte[] bkey = key.getBytes("UTF-8");
		return decodeDes3ECB(data, bkey);

	}
	
	public static byte[] decodeDes3ECB(byte[] data, byte[] key) throws Exception{
		Key deskey = null;
		DESedeKeySpec spec = new DESedeKeySpec(key);
		SecretKeyFactory keyfactory = SecretKeyFactory.getInstance(Des3Algorithm);
		deskey = keyfactory.generateSecret(spec);
		Cipher cipher = Cipher.getInstance(Des3Algorithm + "/ECB/PKCS7Padding");
		cipher.init(Cipher.DECRYPT_MODE, deskey);
		return cipher.doFinal(data);
	}
    
    public static void main(String[] args) throws Exception{
//    	String plain = "abcdefghabcdefghabcdefghabcdefgh";
//    	String key = "g9A6eELT";
//    	String iv = "GTvn6aEw";
//    	
//    	String cypher = encryptDES(plain, key);
//    	System.out.println(cypher);
//    	
//    	String org = decryptDES(cypher, key);
//    	System.out.println(org);
//    	
//    	cypher = encryptDES(plain, key, iv);
//    	System.out.println(cypher);
//    	
//    	org = decryptDES(cypher, key, iv);
//    	System.out.println(org);
//    	
//    	byte[] key1 = SecurityUtility.generateSecureRandomKey(16);
//    	byte[] coded = encrypt(plain.getBytes("UTF-8"), key1);
//    	byte[] raw = decrypt(coded, key1);
//    	System.out.println(new String(raw, "UTF-8"));
//    	
    	String keyroot = "TTMJ_123";
    	byte[] keyrootraw = keyroot.getBytes("UTF-8");
    	
    	String hex = "010020b3af04cc012762243029cc3b813d5acaf40bdd329840619cdbeb9a0312d07d3e6bfb34";
    	byte[] plainraw = SecurityUtility.fromHexString(hex);
    	StreamReader reader = new StreamReader(plainraw);
    	byte cmd = reader.readByte();
    	int len = reader.readUInt16();
    	byte[] encoded = reader.readBytes(len);
    	byte crc = reader.readByte();
    	
    	System.out.println(SecurityUtility.hexString(encoded));
    	
    	byte[] decoded = decrypt(encoded, keyrootraw, "DES/ECB/NoPadding");
    	System.out.println(encoded.length);
    	System.out.println(decoded.length);
    	System.out.println(SecurityUtility.hexString(decoded));
    	System.out.println();
    	
    	StreamReader resreader = new StreamReader(decoded);
    	byte[] id = resreader.readBytes(8);
    	byte state = resreader.readByte();
    	byte installst = resreader.readByte();
    	byte[] tm = resreader.readBytes(14);
    	System.out.println(SecurityUtility.hexString(tm));
    	String tmstr = new String(tm, "UTF-8");
    	System.out.println(tmstr);
    	
    }
    
}
