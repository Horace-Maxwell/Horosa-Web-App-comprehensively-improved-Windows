package boundless.security;

import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;




public class AESUtility extends SecurityUtility {

	private static SecretKey initKeyForAES(byte[] key) throws Exception{
		if (null == key || key.length == 0) {
            throw new NullPointerException("key not is null");
        }
//        SecretKeySpec key2 = null;
//        SecureRandom random = SecureRandom.getInstance("SHA1PRNG");
//        try {
//            random.setSeed(key);
//            KeyGenerator kgen = KeyGenerator.getInstance("AES");
//            kgen.init(key.length*8, random);
//            SecretKey secretKey = kgen.generateKey();
//            byte[] enCodeFormat = secretKey.getEncoded();
//            key2 = new SecretKeySpec(enCodeFormat, "AES");
//        } catch (Exception ex) {
//            throw ex;
//        }
//        return key2;
		
		return new SecretKeySpec(key, "AES");
	}
	
	
    public static byte[] encrypt(byte[] plainText, byte[] key, byte[] ivBytes){
    	try{
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            IvParameterSpec iv = new IvParameterSpec(ivBytes);
            SecretKey secretKey = initKeyForAES(key);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, iv);
            return cipher.doFinal(plainText);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
  
    public static byte[] encrypt(byte[] plainText, byte[] key) {
    	try{
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            SecretKey secretKey = initKeyForAES(key);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            return cipher.doFinal(plainText);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static byte[] encrypt(String data, byte[] key, byte[] ivBytes){
    	try{
    		byte[] plain = data.getBytes("UTF-8");
    		return encrypt(plain, key, ivBytes);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static byte[] encrypt(String data, byte[] key) {
    	try{
    		byte[] plain = data.getBytes("UTF-8");
    		return encrypt(plain, key);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    
    public static byte[] decrypt(byte[] bytesEnc, byte[] key, byte[] ivBytes){
    	try{
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            IvParameterSpec iv = new IvParameterSpec(ivBytes);
            SecretKey secretKey = initKeyForAES(key);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, iv);
            return cipher.doFinal(bytesEnc);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static byte[] decrypt(byte[] bytesEnc, byte[] key) {
    	try{
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            SecretKey secretKey = initKeyForAES(key);
            cipher.init(Cipher.DECRYPT_MODE, secretKey);
            return cipher.doFinal(bytesEnc);
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }

}
