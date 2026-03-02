package test.security;

import boundless.security.DESUtility;
import boundless.security.SecurityUtility;

public class TestDESUtility {

	public static void main(String[] args) {
		String str = "ADMIN";
		String key = "bpa.ms.web";
		String code = DESUtility.encryptDES(str, key);
		System.out.println(code);
		
		String plain = DESUtility.decryptDES(code, key);
		System.out.println(plain);
		
		boolean res = str.equals(plain);
		System.out.println(res);
		
		byte[] test = SecurityUtility.generateSecureRandomKey(1000);
		String base64 = SecurityUtility.base64(test);
		System.out.println(base64);
				
	}

}
