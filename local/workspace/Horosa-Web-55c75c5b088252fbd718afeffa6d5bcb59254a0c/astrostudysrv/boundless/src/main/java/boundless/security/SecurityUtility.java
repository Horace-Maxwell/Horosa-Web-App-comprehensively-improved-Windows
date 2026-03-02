package boundless.security;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.Provider;
import java.security.SecureRandom;
import java.security.Security;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.util.encoders.Base64Encoder;

import boundless.log.QueueLog;
import boundless.utility.StringUtility;


public class SecurityUtility {

	protected static Provider bcProvider;
	
	static{
		bcProvider = Security.getProvider("BC");
		if (bcProvider == null) {
			Security.addProvider(new BouncyCastleProvider());
			bcProvider = Security.getProvider("BC");
			if(bcProvider == null){
				QueueLog.error(boundless.log.Logger.globalLog, "cannot find Bouncy Castle JCE Providor");
			}
		}
				
	}
	
	public static void initProvider() {
		bcProvider = Security.getProvider("BC");
		if (bcProvider == null) {
			try {
				Security.addProvider(new BouncyCastleProvider());				
			}catch(Exception e) {
				throw new RuntimeException(e);
			}
			bcProvider = Security.getProvider("BC");
			if(bcProvider == null){
				QueueLog.error(boundless.log.Logger.globalLog, "cannot find Bouncy Castle JCE Providor");
			}
		}
		
	}
	
	static byte getByteFromHexChar(char c){
		if(c >= 'a' && c <='f'){
			return (byte)(c - 87);
		}
		if(c >= 'A' && c <='F'){
			return (byte)(c - 55);
		}
		if(c >= '0' && c <='9'){
			return (byte)(c - 48);
		}
		return -1;
	}

	
	public static String base64(byte[] data){
		if(data == null || data.length == 0){
			return null;
		}
		ByteArrayOutputStream os = new ByteArrayOutputStream();
		Base64Encoder base64=new Base64Encoder(); 
		try {
			base64.encode(data, 0, data.length, os);
			String res = new String(os.toByteArray(), "UTF-8");
			return res;
		} catch (Exception e) {
			throw new RuntimeException(e);
		}finally{
			try {
				os.close();
			} catch (IOException e) {
			}
		}
	}
	
	public static String base64(String txt) {
		try {
			byte[] raw = txt.getBytes("UTF-8");
			return base64(raw);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] fromBase64(String data) throws Exception{
		if(StringUtility.isNullOrEmpty(data)){
			return new byte[0];
		}
		ByteArrayOutputStream os = new ByteArrayOutputStream();
		Base64Encoder base64 = new Base64Encoder();
		try{
			byte[] raw = data.getBytes("UTF-8");
			base64.decode(raw, 0, raw.length, os);
			return os.toByteArray();
		}catch(Exception e){
			throw new RuntimeException(e);
		}finally{
			try {
				os.close();
			} catch (IOException e) {
			}
		}
	}
	
	public static String hexString(byte[] data){
		if(data == null || data.length == 0){
			return null;
		}
		StringBuilder sb = new StringBuilder();
		for(byte n : data){
			int num = n & 0xff;
			sb.append(String.format("%02X", num));
		}
		return sb.toString();
	}
	
	public static byte[] fromHexString(String hex){
		if(StringUtility.isNullOrEmpty(hex)){
			return new byte[0];
		}
		String hexstr = hex;
		if(hex.startsWith("0x") || hex.startsWith("0X")) {
			hexstr = hex.substring(2);
		}
		
        int size = hexstr.length() / 2;
        if(hexstr.length() % 2 > 0){
            size++;
        }
        byte[] res = new byte[size];

        int k = size - 1;
        int i = hexstr.length() - 1;
        while(i >= 0){
            byte n = getByteFromHexChar(hexstr.charAt(i));
            if (n < 0){
                throw new RuntimeException("invalid hexchar to byte: " + hexstr.charAt(i));
            }
            if(i > 0){
                i--;
                byte m = getByteFromHexChar(hexstr.charAt(i));
                if (m < 0){
                    throw new RuntimeException("invalid hexchar to byte: " + hexstr.charAt(i));
                }
                n = (byte)((m << 4) | n);
            }
            res[k--] = n;

            i--;
        }


        return res;
		
	}
	
	/**
	 * 生成一个用于对称加密算法中的随机秘钥
	 * @param keyLength
	 * @return
	 */
	public static byte[] generateSecureRandomKey(int keyLength) {
		byte[] key = new byte[keyLength];
		SecureRandom secRan = new SecureRandom();
		secRan.nextBytes(key);
		return key;
	}
	
	public static String createSecureKey(int keyLength) {
		byte[] key = generateSecureRandomKey(keyLength);
		return hexString(key);
	}
	
	public static void main(String[] args) throws Exception{
		int keylen = 6;
		String key = createSecureKey(keylen);
		System.out.println(key);
	}
}
