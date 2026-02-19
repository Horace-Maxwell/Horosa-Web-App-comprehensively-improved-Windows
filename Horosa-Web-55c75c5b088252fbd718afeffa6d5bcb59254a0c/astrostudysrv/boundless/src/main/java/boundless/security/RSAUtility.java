package boundless.security;

import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPrivateKeySpec;
import java.security.spec.RSAPublicKeySpec;

import javax.crypto.Cipher;

import boundless.spring.help.interceptor.RsaParam;
import boundless.utility.JsonUtility;


public class RSAUtility extends SecurityUtility {

	/**
	 * RSA加密
	 * @param plain 明文字节数组
	 * @param modulus 模数，16进制的字符串
	 * @param publicExponent 公钥指数，16进制的字符串， 一般为"10001"代表16进制0x10001
	 * @return 密文字节数组
	 * @throws Exception
	 */
	public static byte[] encrypt(byte[] plain, String modulus, String publicExponent) throws Exception{
		Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding", bcProvider);
		PublicKey key = getPublicKey(modulus, publicExponent);
		cipher.init(Cipher.ENCRYPT_MODE, key);
		byte[] dest = cipher.doFinal(plain);
		
		return dest;
		
	}
	
	/**
	 * RSA解密
	 * @param cipherData 密文字节数组
	 * @param modulus 模数，16进制的字符串
	 * @param privateExponent 私钥指数，16进制的字符串
	 * @return 明文字节数组
	 * @throws Exception
	 */
	public static byte[] decrypt(byte[] cipherData, String modulus, String privateExponent) throws Exception {
		Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding", bcProvider);
		PrivateKey key = getRSAPrivateKey(modulus, privateExponent);
		cipher.init(Cipher.DECRYPT_MODE, key);
		byte[] dest = cipher.doFinal(cipherData);
		
		return dest;
	}
	
	public static byte[] decrypt(String base64, String modulus, String privateExponent) {
		try{
			byte[] cypherdata = SecurityUtility.fromBase64(base64);
			return decrypt(cypherdata, modulus, privateExponent);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static PublicKey getPublicKey(String modulus, String publicExponent) throws Exception{
		BigInteger  m = new BigInteger(modulus, 16);
		BigInteger  e = new BigInteger(publicExponent, 16);
		RSAPublicKeySpec keySpec = new RSAPublicKeySpec(m, e);
	    KeyFactory fact = KeyFactory.getInstance("RSA", bcProvider);
	    
	    PublicKey pubKey = fact.generatePublic(keySpec);
	    return pubKey;		
	}

	public static PrivateKey getRSAPrivateKey(String modulus, String privateExponent) throws Exception {
		BigInteger  m = new BigInteger(modulus, 16);
		BigInteger  e = new BigInteger(privateExponent, 16);
		RSAPrivateKeySpec spec = new RSAPrivateKeySpec(m, e);
		KeyFactory fact = KeyFactory.getInstance("RSA", bcProvider);
		
		return fact.generatePrivate(spec);
	}
	
	public static RsaParam genRsaParam() {
		try {			
			KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
			gen.initialize(2048);
			KeyPair key = gen.generateKeyPair();
			RSAPrivateKey privkey = (RSAPrivateKey)key.getPrivate();
			RSAPublicKey pubkey = (RSAPublicKey)key.getPublic();
			RsaParam param = new RsaParam();
			param.reqencrypt = true;
			param.rspencrypt = true;
			param.modulus = privkey.getModulus().toString(16).toUpperCase();
			param.privexp = privkey.getPrivateExponent().toString(16).toUpperCase();
			param.pubexp = pubkey.getPublicExponent().toString(16).toUpperCase();
			
			return param;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static String getModulus(KeyPair key) {
		RSAPrivateKey privkey = (RSAPrivateKey)key.getPrivate();
		return privkey.getModulus().toString(16);
	}
	
	public static String getPrivExp(KeyPair key) {
		RSAPrivateKey privkey = (RSAPrivateKey)key.getPrivate();
		return privkey.getPrivateExponent().toString(16);
	}
	
	public static String getPubExp(KeyPair key) {
		RSAPublicKey pubkey = (RSAPublicKey)key.getPublic();
		return pubkey.getPublicExponent().toString(16);
	}

	public static void main(String[] args) throws Exception {
		String modulus="EFA82FF4684A031CBD3E268EC1E2689890E528BAF769E5BF64E14C1BDC334410FC7B4C48D06F6131504D3A6E97B083282C977B84BD25354B33171735DD1F83C19EBAC68A33B061227BE266F01EE57B014052B3263D4A7546661A66B4987359C1BD150B1AD8BD6A2C78B72A359673ACD0D5A4B50DFF3C10AC0752E3214BC0438578DE394A9E04F28262FC25C6AC1C1D906CCA1B5C5E41D906A6C3C5381B8E0000EB6A49B512ED3CD204423CE39F481E9E121A262C17860236BAAD4D5A143C76E150C9D0134ECF00400C7F8169E096FDB0BED687021649B7DE26BCDDCC6519CBE0B96900AA296BA2263FCBD5C81F62334D4B5A840C4683006DE0BA721BB49004F1";
		String priExp="845BCC185CDCBB794CDF1D666C984192393C06D1B3C14DBCF5D72434A2D9C176EC2AA087FA6DF92CC61FD0ECB164301BA8FD049FDBE2C7DB3F5D3A596A45747C23D11DC3C8265A8F3402673DA8A2AEDB930DD9997DF23870E8051EC2110C6BFEFF11B72F5D92C727C687CA8D0C09D8E1018D54DD65206448CE46ADE07EB8B1D0DCC56CB4E12204EF331742F7F40E6169E1B7FCC7853AE21484A072E76D97B2E852FD394CCC02E65EABD6F7AEE20E27F77FC01E9A354CE4A3E1B529227B0AC927DF91C4D714A50578BE772DB1B95D59CA43B3FCEE49A50353A825C9EB2338088BE363A10D54B0C1F441B2F3BF1EE2D60308686810462AE69B154837E4D4EF96DD";
		String pubExp = "10001";
		
		String plain = "bat_4atq3y3hxam_";
		byte[] plaindata = plain.getBytes("UTF-8");
		
		byte[] bM = SecurityUtility.fromHexString(modulus);
		String bM64 = SecurityUtility.base64(bM);
		System.out.println("modulus base64: " + bM64);
		
		byte[] cypher = encrypt(plaindata, modulus, pubExp);
		String cb64 = SecurityUtility.base64(cypher);
		byte[] decode = decrypt(cypher, modulus, priExp);
		System.out.println("cypherB64:" + cb64);
		System.out.println("decode:" + new String(decode, "UTF-8"));
		
		cypher = encrypt(plaindata, modulus, priExp);
		cb64 = SecurityUtility.base64(cypher);
		decode = decrypt(cypher, modulus, pubExp);
		System.out.println("\ncypherB64:" + cb64);
		System.out.println("decode:" + new String(decode, "UTF-8"));
		
		RsaParam rsaparam = genRsaParam();
		System.out.println(JsonUtility.encodePretty(rsaparam));
	}
	
}
