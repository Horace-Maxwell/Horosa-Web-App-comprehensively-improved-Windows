package spacex.basecomm.helper;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TimeZone;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.bouncycastle.util.Arrays;
import org.java_websocket.handshake.ServerHandshake;
import org.slf4j.Logger;
import org.web3j.protocol.websocket.WebSocketClient;

import boundless.function.Consumer3;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.SecurityUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.OutParameter;
import boundless.types.storage.ICloudStorage;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.utility.sound.SoundUtility;
import okhttp3.HttpUrl;

public class XunFeiHelper {
	private static Logger errLog = AppLoggers.getLog("xunfei", "error");
	private static Logger log = AppLoggers.getLog("xunfei", "ws");

	private static String ttsUrl = PropertyPlaceholder.getProperty("xunfei.ttsurl", "https://tts-api.xfyun.cn/v2/tts");
	private static String iatUrl = PropertyPlaceholder.getProperty("xunfei.iaturl", "https://iat-api.xfyun.cn/v2/iat");
	private static String appId = PropertyPlaceholder.getProperty("xunfei.appid", "6af99624");
	private static String apiSecret = PropertyPlaceholder.getProperty("xunfei.apisecret", "ODNhYzJiOTYwM2M3M2E0OWUxZWE1NzFj");
	private static String apiKey = PropertyPlaceholder.getProperty("xunfei.apikey", "1d474c7fc79339d336f42a404ec705b5");
	private static String tte = PropertyPlaceholder.getProperty("xunfei.tte", "UTF8");
	private static String vcn = PropertyPlaceholder.getProperty("xunfei.vcn", "xiaoyan");
	
	public static enum AUE {
		raw, lame
	}

	private static WebSocketClient createWSClient(String apiUrl, List<String> bos, OutParameter<Boolean> finishFlag,
			Consumer3<String, List<String>, OutParameter<Boolean>> msgHandler) {
		try {
			String url = getAuthUrl(apiUrl, apiKey, apiSecret);
			String wsUrl = url.replace("https://", "wss://");
			URI uri = new URI(wsUrl);
			WebSocketClient wsClient = new WebSocketClient(uri) {

				@Override
				public void onOpen(ServerHandshake serverHandshake) {
					QueueLog.debug(log, "ws建立连接成功..., status:{}, msg:{}", serverHandshake.getHttpStatus(),
							serverHandshake.getHttpStatusMessage());
				}

				@Override
				public void onMessage(String s) {
					msgHandler.accept(s, bos, finishFlag);
				}

				@Override
				public void onClose(int code, String reason, boolean remote) {
					QueueLog.debug(log, "ws链接已关闭，本次请求完成. code:{}, reason:{}, remote:{}", code, reason, remote);
				}

				@Override
				public void onError(Exception e) {
					QueueLog.error(errLog, e);
				}

			};

			return wsClient;
		} catch (Exception e) {
			QueueLog.error(errLog, e);
			throw new RuntimeException(e);
		}
	}

	// 鉴权方法
	public static String getAuthUrl(String hostUrl, String apiKey, String apiSecret) throws Exception {
		URL url = new URL(hostUrl);
		// 时间
		SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
		format.setTimeZone(TimeZone.getTimeZone("GMT"));
		String date = format.format(new Date());
		// 拼接
		String preStr = "host: " + url.getHost() + "\n" + "date: " + date + "\n" + "GET " + url.getPath() + " HTTP/1.1";
		// System.out.println(preStr);
		// SHA256加密
		Mac mac = Mac.getInstance("hmacsha256");
		SecretKeySpec spec = new SecretKeySpec(apiSecret.getBytes(StandardCharsets.UTF_8), "hmacsha256");
		mac.init(spec);
		byte[] hexDigits = mac.doFinal(preStr.getBytes(StandardCharsets.UTF_8));
		// Base64加密
		String sha = Base64.getEncoder().encodeToString(hexDigits);
		// 拼接
		String authorization = String.format("api_key=\"%s\", algorithm=\"%s\", headers=\"%s\", signature=\"%s\"",
				apiKey, "hmac-sha256", "host date request-line", sha);
		// 拼接地址
		HttpUrl httpUrl = Objects.requireNonNull(HttpUrl.parse("https://" + url.getHost() + url.getPath())).newBuilder()
				.//
				addQueryParameter("authorization",
						Base64.getEncoder().encodeToString(authorization.getBytes(StandardCharsets.UTF_8)))
				.//
				addQueryParameter("date", date).//
				addQueryParameter("host", url.getHost()).//
				build();

		return httpUrl.toString();
	}

	private static Map<String, Object> ttsParams(String text, int pitch, int speed, int volume, String aue) {
		Map<String, Object> map = new HashMap<String, Object>();
		Map<String, Object> common = new HashMap<String, Object>();
		Map<String, Object> data = new HashMap<String, Object>();
		Map<String, Object> business = new HashMap<String, Object>();

		data.put("status", 2);
		data.put("text", SecurityUtility.base64(text));

		common.put("app_id", appId);

		business.put("aue", aue);
		if (aue.equals("lame")) {
			business.put("sfl", 1);
		}
		business.put("vcn", vcn);
		business.put("tte", tte);
		business.put("pitch", pitch);
		business.put("speed", speed);
		business.put("volume", volume);

		map.put("common", common);
		map.put("business", business);
		map.put("data", data);

		return map;
	}

	private static void treatTtsMsg(String s, List<String> os, OutParameter<Boolean> finishFlag) {
		finishFlag.value = false;
		Map<String, Object> res = JsonUtility.toDictionary(s);
		int code = ConvertUtility.getValueAsInt(res.get("code"));
		String sid = (String) res.get("sid");
		String msg = (String) res.get("message");
		if (code != 0) {
			QueueLog.error(errLog, "错误码：{}, 本次请求的sid为：{}, msg：{}", code, sid, msg);
		}
		Map<String, Object> data = (Map<String, Object>) res.get("data");
		if (data == null) {
			synchronized (os) {
				os.notifyAll();
			}
			finishFlag.value = true;
			return;
		}

		String ced = (String) data.get("ced");
		QueueLog.debug(log, "process: {}", ced);

		int status = ConvertUtility.getValueAsInt(data.get("status"));
		String audio = (String) data.get("audio");
		os.add(audio);

		if (status == 2) {
			synchronized (os) {
				os.notifyAll();
			}
			finishFlag.value = true;
		}
	}

	private static List<String> innerRequest(String api, List<Map<String, Object>> params, int interval,
			Consumer3<String, List<String>, OutParameter<Boolean>> msgHandler) throws Exception {

		final OutParameter<Boolean> finishFlag = new OutParameter<Boolean>(false);
		
		List<String> bos = new ArrayList<String>();
		WebSocketClient client = null;
		try {
			client = createWSClient(api, bos, finishFlag, msgHandler);
			client.connectBlocking();
			int i = 0;
			for(Map<String, Object> param : params) {
				if(i > 0 && interval > 0) {
					Thread.sleep(interval);					
				}
				String data = JsonUtility.encodePretty(param);
				client.send(data);
				i++;
			}
			if(!finishFlag.value) {
				try {
					synchronized (bos) {
						bos.wait(60000);
					}
				} catch (Exception e) {
					QueueLog.error(errLog, e);
					throw e;
				}				
			}
			return bos;
		}finally {
			if (client != null) {
				client.close();
			}
		}
	}

	public static byte[] tts(String text, int pitch, int speed, int volume, String aue) {
		return tts(text, pitch, speed, volume, aue, null);
    }

	public static byte[] tts(String text, int pitch, int speed, int volume, String aue, List<String> b64list) {
		try {
	    	Map<String, Object> map = ttsParams(text, pitch, speed, volume, aue);
	    	List<Map<String, Object>> params = new ArrayList<Map<String, Object>>(1);
	    	params.add(map);
	    	List<String> list = innerRequest(ttsUrl, params, 0, (s, bos, finishFlag)->{
	        	treatTtsMsg(s, bos, finishFlag);
	        });
	    	
	    	if(list.isEmpty()) {
	    		return null;
	    	}
	    	
	    	ByteArrayOutputStream bos = new ByteArrayOutputStream();
	    	for(String str : list) {
	    		byte[] raw = SecurityUtility.fromBase64(str);
	    		bos.write(raw);
	    		bos.flush();
	    	}
	    	byte[] res = bos.toByteArray();
	    	bos.close();
	    	
	    	if(b64list != null) {
	    		b64list.addAll(list);
	    	}
	    	return res;			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
    }
	
	public static String ttsToUrl(String text, int pitch, int speed, int volume, String aue) {
		byte[] raw = tts(text, pitch, speed, volume, aue);
		ICloudStorage storage = StorageHelper.getGPTStorage();
		String key = String.format("gpt/%s.mp3", StringUtility.getUUID());
		String url = storage.upload(raw, key);
		return url;
	}

	private static List<Map<String, Object>> iatParams(byte[] audio, String aue) throws Exception {
		List<Map<String, Object>> list = new ArrayList<Map<String, Object>>();
		Map<String, Object> map = new HashMap<String, Object>();
		Map<String, Object> common = new HashMap<String, Object>();
		Map<String, Object> data = new HashMap<String, Object>();
		Map<String, Object> business = new HashMap<String, Object>();
		
		common.put("app_id", appId);

		ByteArrayInputStream bis = new ByteArrayInputStream(audio);
		int frameSize = 1280; 
		byte[] buffer = new byte[frameSize];
		int status = 0;
		while(true) {
			int len = bis.read(buffer);
			if(len == -1) {
				status = 2;
			}
			switch(status) {
			case 0:
				business.put("language", "zh_cn");
				business.put("domain", "iat");
				business.put("accent", "mandarin");
				business.put("dwa", "wpgs");

				data.put("status", 0);
				data.put("format", "audio/L16;rate=16000");
				data.put("encoding", aue);
				byte[] raw = Arrays.copyOf(buffer, len);
				String b64 = SecurityUtility.base64(raw);
				data.put("audio", b64);
				
				map.put("data", data);
				map.put("common", common);
				map.put("business", business);
				
				status = 1;
				break;
			case 1:
				data.put("status", 1);
				data.put("format", "audio/L16;rate=16000");
				data.put("encoding", aue);
				raw = Arrays.copyOf(buffer, len);
				b64 = SecurityUtility.base64(raw);
				data.put("audio", b64);
				
				map.put("data", data);
				
				break;
			case 2:
				data.put("status", 2);
				data.put("format", "audio/L16;rate=16000");
				data.put("encoding", aue);
				data.put("audio", "");

				map.put("data", data);
				
				break;
			}
			
			list.add(map);
			if(status == 2) {
				break;
			}
			map = new HashMap<String, Object>();
			data = new HashMap<String, Object>();
		}

		return list;
	}
		
	private static void treatIatMsg(String s, List<String> os, OutParameter<Boolean> finishFlag) {
		finishFlag.value = false;
		System.out.println(s);
		
		Map<String, Object> res = JsonUtility.toDictionary(s);
		int code = ConvertUtility.getValueAsInt(res.get("code"));
		String sid = (String) res.get("sid");
		String msg = (String) res.get("message");
		if (code != 0) {
			QueueLog.error(errLog, "错误码：{}, 本次请求的sid为：{}, msg：{}", code, sid, msg);
		}
		Map<String, Object> data = (Map<String, Object>) res.get("data");
		if (data == null || code != 0) {
			synchronized (os) {
				os.notifyAll();
			}
			finishFlag.value = true;
			return;
		}

		int status = ConvertUtility.getValueAsInt(data.get("status"));
		Map<String, Object> result = (Map<String, Object>) data.get("result");
		List<Map<String, Object>> ws = (List<Map<String, Object>>) result.get("ws");
		
		for(Map<String, Object> map : ws) {
			List<Map<String, Object>> cw = (List<Map<String, Object>>) map.get("cw");
			Map<String, Object> select = cw.get(0);
			String txt = (String) select.get("w");
			os.add(txt);
		}		
		
		if(status == 2) {
			synchronized (os) {
				os.notifyAll();
			}
			finishFlag.value = true;
		}
	}

	public static String iat(byte[] audio, String aue) {
		try {
	    	List<Map<String, Object>> params = iatParams(audio, aue);
	    	List<String> raw = innerRequest(iatUrl, params, 40, (s, bos, finishFlag)->{
	    		treatIatMsg(s, bos, finishFlag);
	        });
	    	
	    	StringBuilder sb = new StringBuilder();
	    	for(String str : raw) {
	    		sb.append(str);
	    	}
	    	return sb.toString();			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}		
	}
	
	public static String iat(String audio, String aue) {
		try {
			byte[] raw = SecurityUtility.fromBase64(audio);
			return iat(raw, aue);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}		
	}
	
	public static String iatFromWebm(String webmaudio, String aue, String dir) {
		try {
			File dest = SoundUtility.webmToMP3FromBase64(webmaudio, dir);
			byte[] raw = FileUtility.getBytesFromFile(dest);
			return iat(raw, aue);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}		
	}

	public static void main(String[] args) throws Exception {
		String aue = "lame";
//		String txt = "你会做首描写苍茫大地的七绝吗？";
//		byte[] raw = tts(txt, 50, 50, 50, aue);
//
//		String file = "/Users/zjf/file/test";
//		if(aue.equals("raw")) {
//			file = String.format("%s.pcm", file);
//		}else {
//			file = String.format("%s.mp3", file);
//		}
//		FileUtility.save(file, raw);
//		
		
//		String file = "/Users/zjf/file/你好.mp3";
//		byte[] raw = FileUtility.getBytesFromFile(file);
//		String iatstr = iat(raw, aue);
//		System.out.println(iatstr);
		
//		aue = "raw";
		String b64file = "/Users/zjf/file/snd1.txt";
		String webmaudio = FileUtility.getStringFromFile(b64file);
		String audio = webmaudio.substring(23);
//		String txt = iatFromWebm(audio, aue, "/Users/zjf/file/iat");
//		String txt = iat(audio, aue);
//		System.out.println(txt);
//
//		b64file = "/Users/zjf/file/你好.txt";
//		webmaudio = FileUtility.getStringFromFile(b64file);
//		audio = webmaudio.substring(23);
//		txt = iatFromWebm(audio, aue, "/Users/zjf/file/iat");
//		System.out.println(txt);
		
//		List<String> list = new ArrayList<String>();
//		String txt = "你好我是大眼鹿";
//		byte[] raw = tts(txt, 50, 50, 50, aue, list);
//		String b64 = SecurityUtility.base64(raw);
//		String file = String.format("/Users/zjf/file/%s.txt", txt);
//		FileUtility.save(file, b64);
		
		
		System.out.println("finish");
	}

}
