package boundless.security;

import java.security.MessageDigest;

import boundless.utility.ByteUtility;

/**
 * 提供MD5实用功能
 */
public class MD5Utility {

    public static String encryptAsString(String str) {
        try {  
            MessageDigest md = MessageDigest.getInstance("MD5");  
            md.update(str.getBytes("UTF-8"));  
            byte[]byteDigest = md.digest();  
            int i;  
            StringBuffer buf = new StringBuffer("");  
            for (int offset = 0; offset < byteDigest.length; offset++) {  
                i = byteDigest[offset];  
                if (i < 0)  
                    i += 256;  
                if (i < 16)  
                    buf.append("0");  
                buf.append(Integer.toHexString(i));  
            }  
//            String res = ByteUtility.toHexString(byteDigest).toLowerCase();
//            System.out.println(res);
            return buf.toString();  
        } catch (Exception e) {  
            e.printStackTrace();  
            return null;  
        }  
    	
    }
    public static String encryptAsString(byte[] data) {
        try {  
            MessageDigest md = MessageDigest.getInstance("MD5");  
            md.update(data);  
            byte[]byteDigest = md.digest();  
            int i;  
            StringBuffer buf = new StringBuffer("");  
            for (int offset = 0; offset < byteDigest.length; offset++) {  
                i = byteDigest[offset];  
                if (i < 0)  
                    i += 256;  
                if (i < 16)  
                    buf.append("0");  
                buf.append(Integer.toHexString(i));  
            }  
            return buf.toString();  
        } catch (Exception e) {  
            e.printStackTrace();  
            return null;  
        }  
    	
    }
    
    public static byte[] encrypt(byte[] data){
        try {  
            MessageDigest md = MessageDigest.getInstance("MD5");  
            md.update(data);  
            byte[]byteDigest = md.digest();  
            return byteDigest;  
        } catch (Exception e) {  
            e.printStackTrace();  
            return null;  
        }  
    }
    
    public static String encryptWithSalt(String str, String salt){
    	return encryptAsString(salt + str);
    }
    
    public static void main(String[] args){
    	String plain = "sendaWeixin6868#!";
    	String test = "Zjd2022";
    	System.out.println(encryptAsString(test));
    	System.out.println(encryptWithSalt(test, "zjd2022"));
    }

}
