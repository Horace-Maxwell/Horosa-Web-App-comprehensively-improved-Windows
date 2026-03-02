package spacex.astroreader.helper;

import java.util.HashMap;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.JsonUtility;
import boundless.utility.ProcessUtility;
import spacex.astrostudy.constants.AstroPrivilege;

public class FlvUrlHelper {
	private static String flvHttp = PropertyPlaceholder.getProperty("httpflv.http", "http://spacex.f3322.net:18888/live");
	private static String flvApp = PropertyPlaceholder.getProperty("httpflv.app", "camlive");
	private static String flvStream = PropertyPlaceholder.getProperty("httpflv.stream", "baobao");
	private static String flvStream2 = PropertyPlaceholder.getProperty("httpflv.stream2", "baobao2");
	private static int flvPort = PropertyPlaceholder.getPropertyAsInt("httpflv.port", 1935);
	
	private static String restartCmd = PropertyPlaceholder.getProperty("httpflv.live.restart", "/mnt/sdb1/app/flvsrv/surestart");
	
	private static Map<String, Object> rtspMap = new HashMap<String, Object>();
	
	static {
		String json = FileUtility.getStringFromClassPath("data/rtsp.json");
		rtspMap = JsonUtility.toDictionary(json);
	}
	
	public static String getHttp() {
		return flvHttp;
	}
	
	public static String getApp() {
		return flvApp;
	}
	
	public static String getStream() {
		return flvStream;
	}
	
	public static int getPort() {
		return flvPort;
	}
	
	
	public static String getUrl(int idx) {
		String token = RtmpHelper.genToken(AstroPrivilege.PLAY_CAMLIVE, null);
		String stream = flvStream;
		if(idx == 2) {
			stream = flvStream2;
		}
		String url = String.format("%s?port=%d&app=%s&stream=%s&key=%s", flvHttp, flvPort, flvApp, stream, token);
		return url;
	}
	
	public static void restartBaobaoLive() {
		String cmd = String.format("/bin/sh %s", restartCmd);
		ProcessUtility.execute(cmd);
	}
	
}
