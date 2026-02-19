package boundless.utility;

import java.util.HashMap;
import java.util.Map;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.http.HttpClientUtility;

public class WeChatUtility {
	
	public static String login(String corpId, String corpSecret){
		if(StringUtility.isNullOrEmpty(corpId) || StringUtility.isNullOrEmpty(corpSecret)){
			throw new RuntimeException("parameters null exeception");
		}
		
		String url = String.format("https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=%s&corpsecret=%s", corpId, corpSecret);
		String response = HttpClientUtility.getString(url, 2000);
		Map<String, Object> map = JsonUtility.toDictionary(response);
		if(map != null && map.containsKey("access_token")){
			String token = ConvertUtility.getValueAsString(map.get("access_token"));
			return token;
		}
		throw new RuntimeException(response);
	}
	
	public static boolean sendMsg(String msgContent, String accessToken, String toUsers, String agentId){
		return sendMsg(msgContent, accessToken, toUsers, agentId, WeChatMsgTypeOption.Text);
	}
	
	public static boolean sendPartyMsg(String msgContent, String accessToken, String toPartys, String agentId){
		return sendPartyMsg(msgContent, accessToken, toPartys, agentId, WeChatMsgTypeOption.Text);
	}
	
	public static boolean sendMsg(String msgContent, String accessToken, String toUsers, String agentId, WeChatMsgTypeOption type){
		try{
			if(StringUtility.isNullOrEmpty(msgContent)){
				throw new RuntimeException("msg content cannot be emtpy");
			}
			if(StringUtility.isNullOrEmpty(accessToken)){
				throw new RuntimeException("access deny");
			}
			
			String url = String.format("https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=%s", accessToken);

			Map<String, Object> text = new HashMap<String, Object>();
			text.put("content", msgContent);
			
			Map<String, Object> map = new HashMap<String, Object>();
			map.put("touser", toUsers);
			map.put("msgtype", type.toString().toLowerCase());
			map.put("agentid", agentId);
			map.put("text", text);
			
			String json = JsonUtility.encode(map);
			String response = HttpClientUtility.httpPost(url, json);
			Map<String, Object> resp = JsonUtility.toDictionary(response);
			if(resp != null && resp.containsKey("errcode")){
				int code = ConvertUtility.getValueAsInt(resp.get("errcode"));
				return code == 0;
			}
			
			return true;
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return false;
		}
	}
	
	public static boolean sendPartyMsg(String msgContent, String accessToken, String toPartys, String agentId, WeChatMsgTypeOption type){
		try{
			if(StringUtility.isNullOrEmpty(msgContent)){
				throw new RuntimeException("msg content cannot be emtpy");
			}
			if(StringUtility.isNullOrEmpty(accessToken)){
				throw new RuntimeException("access deny");
			}
			
			String url = String.format("https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=%s", accessToken);

			Map<String, Object> text = new HashMap<String, Object>();
			text.put("content", msgContent);
			
			Map<String, Object> map = new HashMap<String, Object>();
			map.put("toparty", toPartys);
			map.put("msgtype", type.toString().toLowerCase());
			map.put("agentid", agentId);
			map.put("text", text);
			
			String json = JsonUtility.encode(map);
			String response = HttpClientUtility.httpPost(url, json);
			Map<String, Object> resp = JsonUtility.toDictionary(response);
			if(resp != null && resp.containsKey("errcode")){
				int code = ConvertUtility.getValueAsInt(resp.get("errcode"));
				return code == 0;
			}
			
			return true;
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return false;
		}
	}
	
	public static boolean sendMsg(String msgContent, String accessToken){
		try{
			if(StringUtility.isNullOrEmpty(msgContent)){
				throw new RuntimeException("msg content cannot be emtpy");
			}
			if(StringUtility.isNullOrEmpty(accessToken)){
				throw new RuntimeException("access deny");
			}
			
			String url = String.format("https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=%s", accessToken);

			Map<String, Object> text = new HashMap<String, Object>();
			text.put("content", msgContent);
						
			String response = HttpClientUtility.httpPost(url, msgContent);
			Map<String, Object> resp = JsonUtility.toDictionary(response);
			if(resp != null && resp.containsKey("errcode")){
				int code = ConvertUtility.getValueAsInt(resp.get("errcode"));
				return code == 0;
			}
			
			return true;
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return false;
		}
	}
	
	public static enum WeChatMsgTypeOption{
		Text(1);
		
		private int code;
		private WeChatMsgTypeOption(int code){
			this.code = code;
		}
		
		public int getCode(){
			return this.code;
		}
	}

}
