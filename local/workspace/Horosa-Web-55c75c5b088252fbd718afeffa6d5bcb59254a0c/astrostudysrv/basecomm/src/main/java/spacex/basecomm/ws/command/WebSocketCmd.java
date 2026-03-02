package spacex.basecomm.ws.command;


import java.util.HashMap;
import java.util.Map;

import boundless.net.http.HttpClientUtility;
import boundless.netty.BasePacketIds;
import boundless.netty.Datagram;
import boundless.netty.ProcessorContext;
import boundless.netty.WebSocketDatagram;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.utility.JsonUtility;
import spacex.basecomm.ws.packet.WebSocketPacketIds;

public class WebSocketCmd {
	private static final String ResultKey = PropertyPlaceholder.getProperty("response.unified.result.key", KeyConstants.ResultMessage);
	
	public static WebSocketDatagram genDatagram(int cmd, Object resultCode, Object res, Map<String, Object> head) {
		Map<String, Object> map = new HashMap<String, Object>();
		Map<String, Object> body = new HashMap<String, Object>();
		body.put(ResultKey, res);
		body.put(KeyConstants.ResultCode, resultCode);
		map.put("Cmd", cmd);
		map.put("Body", body);
		map.put("Head", head);
		String json = JsonUtility.encode(map);
		WebSocketDatagram dt = new WebSocketDatagram(json);
		dt.setBody(body);
		dt.setHead(head);
		dt.command(cmd);
		return dt;
	}
	
	public static WebSocketDatagram genDatagram(int cmd, Object res, Map<String, Object> head) {
		return genDatagram(cmd, 0, res, head);
	}
	
	public static WebSocketDatagram genDatagram(int cmd, Map<String, Object> res) {
		return genDatagram(cmd, res, new HashMap<String, Object>());
	}
	
	public static WebSocketDatagram genDatagram(int cmd, String json, Map<String, String> respHead) {
		Map<String, Object> map = JsonUtility.toDictionary(json);
		Object code = map.get(KeyConstants.ResultCode);
		Object res = map.get(ResultKey);
		Map<String, Object> head = new HashMap<String, Object>();
		if(respHead != null) {
			for(Map.Entry<String, String> entry : respHead.entrySet()) {
				head.put(entry.getKey(), entry.getValue());
			}			
		}
		return genDatagram(cmd, code, res, head);
	}
	
	public static WebSocketDatagram genDatagram(int cmd) {
		return genDatagram(cmd, new HashMap<String, Object>(), new HashMap<String, Object>());
	}

	public static Datagram heartbeat() {
		return genDatagram(BasePacketIds.HeartBeat);
	}
	
	
	public static Datagram httpRequest(ProcessorContext ctx, String url) {
		WebSocketDatagram inData = (WebSocketDatagram) ctx.getInData();
		Map<String, String> head = inData.getHeadStringMap();
		Map<String, Object> body = (Map<String, Object>)inData.getBody();
		Map<String, String> responseHeaders = new HashMap<String, String>();
		
		String json = HttpClientUtility.httpPost(url, body, head, responseHeaders);
		Datagram outData = WebSocketCmd.genDatagram(inData.command(), json, responseHeaders);
		return outData;
	}
}
