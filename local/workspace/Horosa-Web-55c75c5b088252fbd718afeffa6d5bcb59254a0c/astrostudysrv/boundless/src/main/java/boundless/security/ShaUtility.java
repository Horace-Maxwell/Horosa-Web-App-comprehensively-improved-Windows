package boundless.security;

import java.security.MessageDigest;

import org.apache.commons.codec.digest.HmacUtils;

import boundless.io.FileUtility;
import boundless.utility.ByteUtility;

public class ShaUtility {
	
	private static String sha(String str, String encode, String alg){
	    if (null == str || 0 == str.length()){
	        return null;
	    }
	    try {
	        MessageDigest mdTemp = MessageDigest.getInstance(alg);
	        mdTemp.update(str.getBytes(encode));
	         
	        byte[] md = mdTemp.digest();
	        String hex = ByteUtility.toHexString(md);
	        return hex;
	    } catch (Exception e) {
	        throw new RuntimeException(e);
	    }
	}
	
	private static byte[] sha(byte[] data, String alg){
	    if (null == data || 0 == data.length){
	        return null;
	    }
	    try {
	        MessageDigest mdTemp = MessageDigest.getInstance(alg);
	        mdTemp.update(data);
	         
	        byte[] md = mdTemp.digest();
	        return md;
	    } catch (Exception e) {
	        throw new RuntimeException(e);
	    }
	}

	public static String getSha1(String str, String encode){
		return sha(str, encode, "SHA-1");
	}
	public static String getSha1(String str){
		return getSha1(str, "UTF-8");
	}
	
	public static String getSha256(String str, String encode){
		return sha(str, encode, "SHA-256");
	}
	public static String getSha256(String str){
		return getSha256(str, "UTF-8");
	}
	
	public static String getSha512(String str, String encode){
		return sha(str, encode, "SHA-512");
	}
	public static String getSha512(String str){
		return getSha512(str, "UTF-8");
	}
	
	public static byte[] getSha1(byte[] data){
		return sha(data, "SHA-1");
	}
	public static byte[] getSha256(byte[] data){
		return sha(data, "SHA-256");
	}
	public static byte[] getSha512(byte[] data){
		return sha(data, "SHA-512");
	}
	
	public static byte[] hmacSha1(byte[] key, byte[] data){
		return HmacUtils.hmacSha1(key, data);
	}
	
	public static byte[] hmacSha265(byte[] key, byte[] data){
		return HmacUtils.hmacSha256(key, data);
	}
	
	public static String hmacSha265(String key, String data) {
		try {
			byte[] keyraw = key.getBytes("UTF-8");
			byte[] dataraw = data.getBytes("UTF-8");
			byte[] cypher = hmacSha265(keyraw, dataraw);
			return SecurityUtility.hexString(cypher);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	

	
	public static void main(String[] args){
		String str = "123";
		
		String hex = getSha1(str);
		System.out.println(hex);
		
		hex = getSha256(str);
		System.out.println(hex.toLowerCase());

		hex = getSha512(str);
		System.out.println(hex);
		
//		String file = "/Users/zjf/Documents/fivevisual/lib/LicenseUtil.class";
//		byte[] data = FileUtility.getBytesFromFile(file);
//		byte[] raw = getSha256(data);
//		String base64 = SecurityUtility.base64(raw);
//		System.out.println(base64);
//		
//		file = "/Users/zjf/Documents/fivevisual/n4crack/LicenseUtil.class";
//		data = FileUtility.getBytesFromFile(file);
//		raw = getSha256(data);
//		base64 = SecurityUtility.base64(raw);
//		System.out.println(base64);
	}
	
}
