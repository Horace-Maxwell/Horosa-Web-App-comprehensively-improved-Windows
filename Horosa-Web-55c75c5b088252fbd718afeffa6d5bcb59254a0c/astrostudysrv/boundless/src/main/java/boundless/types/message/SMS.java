package boundless.types.message;


import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.http.HttpClientUtility;
import boundless.security.DesEncrypterUtil;
import boundless.types.KeyValuePair;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class SMS extends Messager {
	private static Logger log = AppLoggers.getLog("debug", "sms");
	private static Logger WechartLogger = AppLoggers.getLog("error", "sms");
	public SMS(){
		super();
	}
	
	public SMS clone(){
		SMS sms = new SMS();
		sms.host = this.host;
		sms.port = this.port;
		sms.username = this.username;
		sms.password = this.password;
		sms.signature = this.signature;
		sms.dest = this.dest;
		
		return sms;
	}
			
	@Override
	protected void doSend(String msg) throws Exception {
		String url = this.host;
		
		KeyValuePair<String, String>[] params = new KeyValuePair[]{
			new KeyValuePair<String, String>("name", this.username),
			new KeyValuePair<String, String>("pwd", this.password),
			new KeyValuePair<String, String>("mobile", this.dest),
			new KeyValuePair<String, String>("type", "pt"),
			new KeyValuePair<String, String>("sign", this.signature),
			new KeyValuePair<String, String>("content", msg)
		};
		
		String res = HttpClientUtility.httpPost(url, params);
		if(StringUtility.isNullOrEmpty(res)){
			String errmsg = "request " + url + " fail";
			log.error(errmsg);
			//throw new Exception(errmsg);
		}
		log.info("result of sending sms:" + res);

		try {
			Map<String, Object> map = JsonUtility.toDictionary(res);
			int code = ConvertUtility.getValueAsInt(map.get("ResultCode"));
			if(code != 0) {
				String errmsg = (String) map.get("Result");
				log.error("msg:"+msg);
				log.error("result:"+res);
				log.error("send sms fail, error msg:{}", errmsg);				
			}
			return;
		}catch(Exception e) {
			
		}
		
		String[] parts = res.split(",");
		
		if(!parts[0].equals("0")){
			log.error("msg:"+msg);
			log.error("params:"+params);
			log.error("result:"+res);
			log.error("send sms fail, error msg:{}", parts[parts.length - 1]);
			//throw new Exception(parts[parts.length - 1]);
		}
	}

	@Override
	protected void doSend(String title, String msg) throws Exception {
		send(msg);
	}
	
	@Override
	public void send(String msg){
		try {
			doSend(msg);
		} catch (Exception e) {
			//throw new RuntimeException(e);
			QueueLog.error(WechartLogger, e);
		}
		reset();
	}
	
	public static void main(String[] args){
		String url = "http://web.cr6868.com/asmx/smsservice.aspx";
		KeyValuePair<String, String>[] params = new KeyValuePair[]{
				new KeyValuePair<String, String>("name", "18350136677"),
				new KeyValuePair<String, String>("pwd", "6F0ACA02F2BB8783C7F266F0168A"),
				new KeyValuePair<String, String>("mobile", "13328682559"),
				new KeyValuePair<String, String>("type", "pt"),
				new KeyValuePair<String, String>("sign", "【五维发展】"),
				new KeyValuePair<String, String>("content", "短信验证码为:1234，请勿将验证码提供给他人。")
			};
		
		System.out.println(ConvertUtility.getValueAsString(params));
		String res = HttpClientUtility.httpPost(url, params);
		System.out.println("result of sending sms:" + res);
	}

}
