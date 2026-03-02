package boundless.security;

import java.util.Date;

import boundless.utility.ConvertUtility;

public class CommunicationSecurityUtility {
	
	public static String encrypt(byte[] plaindata, int desKeyLength, String modulus, String publicExponent, Date keytime){
		try{
			byte[] deskey = SecurityUtility.generateSecureRandomKey(desKeyLength);
			byte[] codeddata = DESUtility.encrypt(plaindata, deskey);
			String codedtxt = SecurityUtility.base64(codeddata);
			
			byte[] codeddeskey = RSAUtility.encrypt(deskey, modulus, publicExponent);
			String codeddeskeytxt = SecurityUtility.base64(codeddeskey);
			
			StringBuilder sb = new StringBuilder(codedtxt);
			sb.append(",").append(codeddeskeytxt);
			if(keytime != null){
				sb.append(",").append(keytime.getTime() + "");
			}
			return sb.toString();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] decrypt(String codedstr, String modulus, String privateExponent, int timeout){
		try{
			String[] parts = codedstr.split(",");
			if(parts.length > 2 && timeout > 0){
				long ms = ConvertUtility.getValueAsLong(parts[2]);
				Date now = new Date();
				if(now.getTime() > ms + timeout * 1000){
					throw new RuntimeException("cypher_timeout");
				}
			}
			byte[] deskey = RSAUtility.decrypt(parts[1], modulus, privateExponent);
			byte[] codeddata = SecurityUtility.fromBase64(parts[0]);
			byte[] plaindata = DESUtility.decrypt(codeddata, deskey);
			return plaindata;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	
	public static String encrypt(byte[] plaindata, int desKeyLength, String modulus, String publicExponent){
		return encrypt(plaindata, desKeyLength, modulus, publicExponent, null);
	}
	
	public static String encrypt(byte[] plaindata, String modulus, String publicExponent){
		return encrypt(plaindata, 16, modulus, publicExponent, null);
	}
	
	
	public static byte[] decrypt(String codedstr, String modulus, String privateExponent){
		return  decrypt(codedstr, modulus, privateExponent, 0);
	}

}
