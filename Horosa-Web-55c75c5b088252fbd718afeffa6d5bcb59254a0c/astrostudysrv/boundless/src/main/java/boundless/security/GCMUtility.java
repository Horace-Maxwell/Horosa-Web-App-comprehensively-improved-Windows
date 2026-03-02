package boundless.security;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class GCMUtility extends SecurityUtility {
	private static final String AesGcmAlg = "AES/GCM/NoPadding";
	private static final int TagLengthBit = 128;
	private static final int NonceLengthByte = 12;
	private static final String TransformPkcs1Padding = "RSA/ECB/PKCS1Padding";
	
	public static String decrypt(String aeskey, String aad, String iv, String cipherText) {
		try {
			byte[] raw = SecurityUtility.fromBase64(cipherText);
			Cipher cipher = Cipher.getInstance(AesGcmAlg, bcProvider);
			SecretKeySpec key = new SecretKeySpec(aeskey.getBytes("UTF-8"), "AES");
			GCMParameterSpec spec = new GCMParameterSpec(TagLengthBit, iv.getBytes("UTF-8"));
			cipher.init(Cipher.DECRYPT_MODE, key, spec);
			cipher.updateAAD(aad.getBytes("UTF-8"));
			byte[] plainraw = cipher.doFinal(raw);
			return new String(plainraw, "UTF-8");
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
}
