package spacex.basecomm.im;

// 使用旧版本 base64 编解码实现增强兼容性
import java.io.UnsupportedEncodingException;
import java.security.*;
import java.nio.charset.Charset;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.Deflater;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import boundless.security.SecurityUtility;
import boundless.utility.JsonUtility;

public class TLSSigAPIv2 {
	private long sdkappid;
	private String key;

	public TLSSigAPIv2(long sdkappid, String key) {
		this.sdkappid = sdkappid;
		this.key = key;
	}

	private String hmacsha256(String identifier, long currTime, long expire, String base64Userbuf) {
		String contentToBeSigned = "TLS.identifier:" + identifier + "\n" + "TLS.sdkappid:" + sdkappid + "\n"
				+ "TLS.time:" + currTime + "\n" + "TLS.expire:" + expire + "\n";
		if (null != base64Userbuf) {
			contentToBeSigned += "TLS.userbuf:" + base64Userbuf + "\n";
		}
		try {
			byte[] byteKey = key.getBytes("UTF-8");
			Mac hmac = Mac.getInstance("HmacSHA256");
			SecretKeySpec keySpec = new SecretKeySpec(byteKey, "HmacSHA256");
			hmac.init(keySpec);
			byte[] byteSig = hmac.doFinal(contentToBeSigned.getBytes("UTF-8"));
			String b64 = SecurityUtility.base64(byteSig).replaceAll("\\s*", "");
			return b64;
		} catch (UnsupportedEncodingException e) {
			return "";
		} catch (NoSuchAlgorithmException e) {
			return "";
		} catch (InvalidKeyException e) {
			return "";
		}
	}

	private String genSig(String identifier, long expire, byte[] userbuf) {
		long currTime = System.currentTimeMillis() / 1000;
		Map<String, Object> sigDoc = new HashMap<String, Object>();
		sigDoc.put("TLS.ver", "2.0");
		sigDoc.put("TLS.identifier", identifier);
		sigDoc.put("TLS.sdkappid", sdkappid);
		sigDoc.put("TLS.expire", expire);
		sigDoc.put("TLS.time", currTime);
		String base64UserBuf = null;
		if (null != userbuf) {
			base64UserBuf = SecurityUtility.base64(userbuf);
			sigDoc.put("TLS.userbuf", base64UserBuf);
		}
		String sig = hmacsha256(identifier, currTime, expire, base64UserBuf);
		if (sig.length() == 0) {
			return "";
		}
		sigDoc.put("TLS.sig", sig);
		String docJson = JsonUtility.encode(sigDoc);
		Deflater compressor = new Deflater();
		compressor.setInput(docJson.getBytes(Charset.forName("UTF-8")));
		compressor.finish();
		byte[] compressedBytes = new byte[2048];
		int compressedBytesLength = compressor.deflate(compressedBytes);
		compressor.end();
		String b64 = SecurityUtility.base64(Arrays.copyOfRange(compressedBytes, 0, compressedBytesLength)).replaceAll("\\s*", "");
		return b64;
	}

	public String genSig(String identifier, long expire) {
		return genSig(identifier, expire, null);
	}

	public String genSigWithUserBuf(String identifier, long expire, byte[] userbuf) {
		return genSig(identifier, expire, userbuf);
	}
}
