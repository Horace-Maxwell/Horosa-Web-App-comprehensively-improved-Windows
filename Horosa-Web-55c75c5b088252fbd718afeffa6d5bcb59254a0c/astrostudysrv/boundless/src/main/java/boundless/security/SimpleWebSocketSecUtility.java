package boundless.security;

import java.util.Date;

import boundless.exception.DecryptException;
import boundless.exception.DecryptTimeoutException;
import boundless.exception.EncryptException;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.ConvertUtility;
import boundless.utility.RandomUtility;

public class SimpleWebSocketSecUtility {
	private static int defTimeout = PropertyPlaceholder.getProperty("webencrypt.timeout", 180);
	private static String ivStr = "0123456789ABCDEF";
	private static byte[] ivRaw = new byte[128];
	static {
		SecurityUtility.initProvider();
		try {
			ivRaw = ivStr.getBytes("UTF-8");
		}catch(Exception e) {
			
		}
	}
	
	public static String encrypt(byte[] plaindata, int rcKeyLength, String modulus, String publicExponent, Date keytime){
		try{
			String keystr = RandomUtility.randomString(rcKeyLength);
			byte[] rckey = keystr.getBytes("UTF-8");
			byte[] codeddata = AESUtility.encrypt(plaindata, rckey);
			String codedtxt = SecurityUtility.base64(codeddata);
			
			byte[] codeddeskey = RSAUtility.encrypt(rckey, modulus, publicExponent);
			String codeddeskeytxt = SecurityUtility.base64(codeddeskey);
			
			StringBuilder sb = new StringBuilder(codedtxt);
			sb.append(",").append(codeddeskeytxt);
			if(keytime != null){
				String tmstr = keytime.getTime() + "";
				byte[] tmdata = AESUtility.encrypt(tmstr.getBytes("UTF-8"), rckey);
				String tmcoded = SecurityUtility.base64(tmdata);
				sb.append(",").append(tmcoded);
			}
			return sb.toString();
		}catch(Exception e){
			throw new EncryptException(e);
		}
	}
	
	public static byte[] decrypt(String codedstr, String modulus, String privateExponent, int timeout, boolean forceTimeout){
		try{
			String[] parts = codedstr.split(",");
			byte[] rckey = RSAUtility.decrypt(parts[1], modulus, privateExponent);
			if(forceTimeout) {
				if(parts.length < 3) {
					throw new DecryptTimeoutException("cypher.timeout");
				}
			}
			
			if(parts.length > 2 && timeout > 0 && forceTimeout){
				String tmb64 = parts[2];
				byte[] tmdata = SecurityUtility.fromBase64(tmb64);
				byte[] tmplaindata = AESUtility.decrypt(tmdata, rckey);
				String tmstr = new String(tmplaindata, "UTF-8");
				long ms = ConvertUtility.getValueAsLong(tmstr);
				long now = System.currentTimeMillis();
				if(now > ms + timeout * 1000){
					throw new DecryptTimeoutException("cypher.timeout");
				}
			}
			
			byte[] codeddata = SecurityUtility.fromBase64(parts[0]);
			byte[] plaindata = AESUtility.decrypt(codeddata, rckey);
			return plaindata;
		}catch(DecryptTimeoutException e){
			throw e;
		}catch(Exception e){
			throw new DecryptException(e);
		}
	}
	
	public static String encrypt(byte[] plaindata, int rcKeyLength, String modulus, String publicExponent){
		return encrypt(plaindata, rcKeyLength, modulus, publicExponent, null);
	}
	
	public static String encrypt(byte[] plaindata, String modulus, String publicExponent){
		return encrypt(plaindata, 16, modulus, publicExponent, null);
	}
	
	public static String encrypt(byte[] plaindata, String modulus, String publicExponent, Date tm){
		return encrypt(plaindata, 16, modulus, publicExponent, tm);
	}
	
	public static byte[] decrypt(String codedstr, String modulus, String privateExponent){
		return decrypt(codedstr, modulus, privateExponent, defTimeout, false);
	}

	public static byte[] decrypt(String codedstr, String modulus, String privateExponent, boolean forceTimeout){
		return decrypt(codedstr, modulus, privateExponent, defTimeout, forceTimeout);
	}

	
	
	public static void main(String[] args) throws Exception{
		String modulus="6C5BA65F46931FB71D2A1691ABFB3F3D92E4219E740A8AD95B0A9F490A022AF5077E818F06093E5A79BC7534AE931F5D5BD3B5B012E963EC028A29705DC6243771436F2A67335576A99DC13F9B35B5E30BD7F8EFD2BFBE9E67839A3BB800D239AEE4C1246F222E07848D7D58A755DEB6EA1752E139901FBFF883B87BFD4F67BA69D61E0CD9EE8BAB71C6915F02300E38AC242EE33F1A32C138442989932AE9220D9881ACCA455CEE8F1BFF321DF739507AE8E291DAD667A7492CD600C36AB7421B62C62F6236291583EF9EE2732766C93879B1ACD94A9F3F847AF1BE205F0BEFB1F1FAC6271189848F0A8872A7486EDD0BA6BD84116B5A85EA9ED6058E02DE59";
		String privateExp="1368BB3D57ABE4C36D02EBF5FDE34C29A05522BC7A36A53657BB685AB1E33F84926A1394E5D4E4095AC2EA0F9CB197ADA6541EB8423AF1FE055A701FC37C496270F44E463F240FCBE887EC64934DA49DDDB23AD1E2631C26CD8DE2238E4AFF5CFBB9D7EAC9C94A8B682FDBE2F45E4A3D6362F82285A80E37D9B0E66BB72CF0FC54672474DF1E52A9B3D9126D2C2E6FAAD302E1CFAA3ED66674D0B56D7A13C7375A1671AE663A75DA5CCB3CDFA1A617B947657848F80D1489093C0443E8C28FF7D1E70B7C5D7B247C2944B8210BA5A9176C5DD709989D062FA33403AA51EBFE876070DFE95C8FD8916B2BDEE14589C53E4B55C319245F3980777A624498E6C84D";
		String publicExp = "10001";
		
		String plain = "testtesttesttesttesttesttesttest";
		byte[] plainraw = plain.getBytes("UTF-8");
		String cypher = encrypt(plainraw, modulus, privateExp);
		
		byte[] raw = decrypt(cypher, modulus, publicExp);
		String str = new String(raw, "UTF-8");
		
		System.out.println(cypher);
		System.out.println(str);
		
		
		cypher = encrypt(plainraw, modulus, publicExp);
		raw = decrypt(cypher, modulus, privateExp);
		str = new String(raw, "UTF-8");
		
		System.out.println(cypher);
		System.out.println(str);
		
	}
}
