package spacex.astroreader.helper;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import boundless.exception.NeedLoginException;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.TransData;
import boundless.types.ICache;
import boundless.types.cache.CacheFactory;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.PeriodTask;
import boundless.utility.RandomUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.constants.AstroPrivilege;
import spacex.astrostudy.model.AstroUser;

public class RtmpHelper {
	private static ICache cache = CacheFactory.getCache("rtmp");
	private static final String cachePrefix = "rtmp_";
	
	private static class RtmpToken{
		String user;
		long time;
		long type; // value from AstroPrivilege
		boolean doing;
		String ip;
		String name;
		String token;
		
		public RtmpToken() {
			
		}
		
		public RtmpToken(String user, long tm, long t, String name, String token) {
			this.user = user;
			this.time = tm;
			this.type = t;
			this.doing = false;
			this.name = name;
			this.token = token;
		}
	}
	
	private static final int tokenTimeout = PropertyPlaceholder.getPropertyAsInt("rtmp.token.timeout", 60) * 1000;
	private static String RtmpPlayPath = PropertyPlaceholder.getProperty("rtmp.playpath", "/live");
	private static String RtmpApp = PropertyPlaceholder.getProperty("rtmp.app", "userlive");
	private static int RtmpPort = PropertyPlaceholder.getPropertyAsInt("rtmp.port", 1935);
	
	private static Map<String, String> streamNames = new ConcurrentHashMap<String, String>();
	
	static {

	}
	
	private static void saveCache(String token, RtmpToken utoken) {
		utoken.time = System.currentTimeMillis();
		String key = String.format("%s%s", cachePrefix, token);
		String val = JsonUtility.encode(utoken);
		cache.put(key, val, tokenTimeout / 1000);
	}
	
	private static void removeCache(String token) {
		String key = String.format("%s%s", cachePrefix, token);
		cache.remove(key);
	}
	
	private static RtmpToken getCache(String token) {
		String key = String.format("%s%s", cachePrefix, token);
		String json = (String) cache.get(key);
		if(StringUtility.isNullOrEmpty(json)) {
			return null;
		}
		return JsonUtility.decode(json, RtmpToken.class);
	}
		
	public static String genToken(long privi, String name) {
		String token = StringUtility.getUUID();
		AstroUser user = (AstroUser) TransData.getCurrentUser();
		if(user == null) {
			throw new NeedLoginException();
		}
		if(!user.permit(privi)) {
			throw new RuntimeException("no.priviliege");
		}
		
		RtmpToken utoken = new RtmpToken(user.getLoginId(), System.currentTimeMillis(), privi, name, token);
		saveCache(token, utoken);
		
		return token;
	}
	
	public static void removeToken(String key) {
		removeCache(key);
		streamNames.remove(key);		
	}
	
	private static String genStreamName(String token, String stream) {
		return String.format("%s_%s", token, stream);
	}
	
	public static String genPublishPath(String stream) {
		String name = stream;
		if(StringUtility.isNullOrEmpty(stream)) {
			name = "Live" + RandomUtility.random();
		}
		String token = RtmpHelper.genToken(AstroPrivilege.PUBLISH_LIVE, name);
		streamNames.put(token, name);
		String streamname = genStreamName(token, name);
		String path = String.format("/%s/%s?key=%s", RtmpApp, streamname, token);
		return path;
	}

	public static void checkPlay(String key, String ip) {
		RtmpToken utoken = getCache(key);
		if(utoken == null) {
			throw new RuntimeException("miss.key");
		}
		if(utoken.time + tokenTimeout < System.currentTimeMillis()) {
			removeToken(key);
			throw new RuntimeException("key.expired");
		}
		if(utoken.doing) {
			throw new RuntimeException("key.playing");
		}
		if(StringUtility.isNullOrEmpty(utoken.ip)) {
			utoken.ip = ip;
			utoken.doing = true;
		}else {
			if(utoken.ip.equals(ip)) {
				utoken.doing = true;				
			}else {
				throw new RuntimeException("key.using");
			}
		}
	}
	
	public static void finishPlay(String key) {
		RtmpToken utoken = getCache(key);
		if(utoken == null) {
			return;
		}
		utoken.doing = false;
	}
	
	public static void checkPublish(String key, String ip) {
		RtmpToken utoken = getCache(key);
		if(utoken == null) {
			throw new RuntimeException("miss.key");
		}
		if(utoken.time + tokenTimeout < System.currentTimeMillis()) {
			removeToken(key);
			throw new RuntimeException("key.expired");
		}
		if(utoken.doing) {
			throw new RuntimeException("key.publishing");
		}
		if(StringUtility.isNullOrEmpty(utoken.ip)) {
			utoken.ip = ip;
			utoken.doing = true;
		}else {
			if(utoken.ip.equals(ip)) {
				utoken.doing = true;				
			}else {
				throw new RuntimeException("key.using");
			}
		}
	}
	
	public static void checkPublishing(String key) {
		RtmpToken utoken = getCache(key);
		if(utoken == null) {
			throw new RuntimeException("miss.key");
		}else {
			utoken.time = System.currentTimeMillis();
		}
		utoken.doing = true;
		saveCache(key, utoken);
		
		streamNames.put(utoken.token, utoken.name);
	}
	
	public static void finishPublish(String key) {
		RtmpToken utoken = getCache(key);
		if(utoken == null) {
			return;
		}
		utoken.doing = false;
		saveCache(key, utoken);
	}
	
	public static List<Map<String, Object>> getStreams(){
		List<Map<String, Object>> res = new ArrayList<Map<String, Object>>(streamNames.size());
		List<String> removeKeys = new ArrayList<String>();
		for(Map.Entry<String, String> entry : streamNames.entrySet()) {
			String key = entry.getKey();
			String stream = entry.getValue();
			RtmpToken token = getCache(key);
			if(token == null) {
				removeKeys.add(key);
				continue;
			}
			Map<String, Object> map = new HashMap<String, Object>();
			map.put("Key", key);
			map.put("Stream", stream);
			map.put("User", token.user);
			Date tm = FormatUtility.parseDateTime(token.time);
			map.put("Time", FormatUtility.formatDateTime(tm, "yyyy-MM-dd HH:mm:ss"));
			
			res.add(map);
		}
		for(String key : removeKeys) {
			removeToken(key);
		}
		
		return res;
	}
		
	public static String getPlayPath(String key) {
		String stream = streamNames.get(key);
		if(StringUtility.isNullOrEmpty(stream)) {
			throw new RuntimeException("no.found.stream");
		}
		
		String streamname = genStreamName(key, stream);
		String path = String.format("%s?port=%d&app=%s&stream=%s", RtmpPlayPath, RtmpPort, RtmpApp, streamname);
		return path;
	}
	
}
