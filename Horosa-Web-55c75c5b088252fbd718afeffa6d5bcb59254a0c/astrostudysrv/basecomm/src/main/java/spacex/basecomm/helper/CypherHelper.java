package spacex.basecomm.helper;

import boundless.security.AESUtility;
import boundless.security.DESUtility;
import boundless.security.SecurityUtility;
import boundless.security.SimpleCommSecUtility;
import boundless.spring.help.PropertyPlaceholder;

public class CypherHelper {

	private static String modulus = PropertyPlaceholder.getProperty("encrypt.rsa.modulus");
	private static String privateExp = PropertyPlaceholder.getProperty("encrypt.rsa.privateexp");
	private static String publicExp = PropertyPlaceholder.getProperty("encrypt.rsa.publicexp");

	private static String desKey = PropertyPlaceholder.getProperty("encrypt.des.key");
	private static String aesKey = PropertyPlaceholder.getProperty("encrypt.aes.key");
	
	public static String encryptByPrivateKey(String plain){
		try{
			byte[] raw = plain.getBytes("UTF-8");
			String str = SimpleCommSecUtility.encrypt(raw, modulus, privateExp);
			return str;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static String encryptByPublicKey(String plain){
		try{
			byte[] raw = plain.getBytes("UTF-8");
			String str = SimpleCommSecUtility.encrypt(raw, modulus, publicExp);
			return str;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static String decryptByPrivateKey(String cypher){
		try{
			byte[] raw = SimpleCommSecUtility.decrypt(cypher, modulus, privateExp);
			return new String(raw, "UTF-8");
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static String decryptByPublicKey(String cypher){
		try{
			byte[] raw = SimpleCommSecUtility.decrypt(cypher, modulus, publicExp);
			return new String(raw, "UTF-8");
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static String encryptByDes(String plain){
		return DESUtility.encryptDES(plain, desKey);
	}	
	public static String decryptByDes(String txt){
		return DESUtility.decryptDES(txt, desKey);
	}
	
	public static String encryptByAes(String plain){
		try{
			byte[] raw = AESUtility.encrypt(plain, aesKey.getBytes("UTF-8"));
			return SecurityUtility.base64(raw);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}	
	public static String decryptByAes(String txt){
		try{
			byte[] b = SecurityUtility.fromBase64(txt);
			byte[] raw = AESUtility.decrypt(b, aesKey.getBytes("UTF-8"));
			return new String(raw, "UTF-8");
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
}
