package boundless.security;



/**
 * <p>
 * Title:
 * </p>
 * <p>
 * Description:
 * </p>
 * <p>
 * Copyright: Copyright (c) 2003
 * </p>
 * <p>
 * Company: www.fjqiji.com
 * </p>
 * 
 * @author laisz
 * @version 1.0
 */
public class DesEncrypterUtil {
	public static String encrypt(String str){
		if(null==str) return null;
		DesEncrypter de = new DesEncrypter();
		return de.encrypt(str);
	}
	public static String decrypt(String str){
		try{
		if(null==str) return null;
		DesEncrypter de = new DesEncrypter();
		return de.decrypt(str);
		}catch (Exception e) {
			//javax.crypto.IllegalBlockSizeException: Input length must be multiple of 8 when decrypting with padded cipher
			//return null;
			DesEncrypter de = new DesEncrypter();
			return de.decrypt(str);
		}
	}	
	public static void main(String args[]) {

		String strPassword = DesEncrypterUtil.encrypt("系统管理员");
		System.out.println(strPassword);
		//System.out.println(DesEncrypterUtil.decrypt(strPassword));
		System.out.println(DesEncrypterUtil.decrypt("F3Xgx0r3wv8="));



	}
}
