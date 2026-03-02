package boundless.security;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import boundless.utility.ConvertUtility;

public class SignatureUtility {
	
	private static String getPlain(Map<String, Object> map){
		List<String> keys = new ArrayList<String>();
		
		keys.addAll(map.keySet());
		keys.sort((e1, e2)->{ return e1.compareTo(e2); });
		
		StringBuilder sb = new StringBuilder();
		for(String key : keys){
			Object obj = map.get(key);
			String str = getString(obj);
			sb.append(key).append("=").append(str).append("&");
		}
		return sb.toString();
	}
	
	private static String getString(Object obj){
		if(obj == null){
			return "";
		}
		if(obj instanceof Map){
			return getPlain((Map<String, Object>)obj);
		}
		
		return ConvertUtility.getValueAsString(obj);
	}
	
	public static String rsaSignature(Map<String, Object> map, String modulus, String privateExp){
		String plain = getPlain(map);
		try{
			byte[] plainraw = plain.getBytes("UTF-8");
			String cypher = SimpleCommSecUtility.encrypt(plainraw, modulus, privateExp);
			return cypher;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	public static boolean checkRsaSignature(Map<String, Object> map, String codedStr, String modulus, String publicExp){
		try{
			String plain = getPlain(map);
			String str = "";
			byte[] raw = SimpleCommSecUtility.decrypt(codedStr, modulus, publicExp);
			str = new String(raw, "UTF-8");
			return str.equals(plain);
		}catch(Exception e){
			e.printStackTrace();
			return false;
		}
	}
	
	public static String sha256Signature(String text){
		return ShaUtility.getSha256(text);
	}
	
	public static boolean checkSha256Signature(String text, String codedStr){
		String data = ShaUtility.getSha256(text);
		return data.equalsIgnoreCase(codedStr);
	}
	
	public String md5Signature(String text){
		return MD5Utility.encryptAsString(text);
	}
	public static boolean checkMD5Signature(String text, String codedStr){
		String data = MD5Utility.encryptAsString(text);
		return data.equalsIgnoreCase(codedStr);
	}
	
}
