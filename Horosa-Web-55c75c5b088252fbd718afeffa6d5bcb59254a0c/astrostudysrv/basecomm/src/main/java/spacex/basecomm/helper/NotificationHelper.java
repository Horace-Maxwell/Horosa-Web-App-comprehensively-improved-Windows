package spacex.basecomm.helper;

import java.util.HashMap;
import java.util.Map;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.http.HttpClientUtility;
import boundless.security.MD5Utility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.message.Messager;
import boundless.types.message.SMS;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.utility.mail.MailUtility;

public class NotificationHelper {

	private static String SmtpHost = PropertyPlaceholder.getProperty("smtp.host");
	private static int SmtpPort = ConvertUtility.getValueAsInt(PropertyPlaceholder.getProperty("smtp.port"));
	private static String SmtpUsername = PropertyPlaceholder.getProperty("smtp.username");
	private static String SmtpPassword = PropertyPlaceholder.getProperty("smtp.password");
	private static boolean SmtpSsl = ConvertUtility.getValueAsBool(PropertyPlaceholder.getProperty("smtp.ssl"), false);
	private static boolean SmsEnable = ConvertUtility.getValueAsBool(PropertyPlaceholder.getProperty("sms.enable"), false);

	private static String PortName = PropertyPlaceholder.getProperty("sms.portname");
	private static String CenterNo = PropertyPlaceholder.getProperty("sms.centerno");
	private static boolean SmsLocal = ConvertUtility.getValueAsBool(PropertyPlaceholder.getProperty("sms.local"), false);
	
	private static boolean UsePlatform = ConvertUtility.getValueAsBool(PropertyPlaceholder.getProperty("sms.platform"), false);
	private static String PlatformUrl = PropertyPlaceholder.getProperty("sms.platform.url");
	private static int PlatformAppid = ConvertUtility.getValueAsInt(PropertyPlaceholder.getProperty("sms.platform.appid"));
	private static String PlatformKey = PropertyPlaceholder.getProperty("sms.platform.key");
	
	
	private static SMS sms;
//	private static SmsAt smsat;
	
	static{
		sms = new SMS();
		
		sms.host = PropertyPlaceholder.getProperty("sms.host");
		sms.username = PropertyPlaceholder.getProperty("sms.user");
		sms.password = PropertyPlaceholder.getProperty("sms.password");
		sms.signature = PropertyPlaceholder.getProperty("sms.signature");
		
//		smsat = new SmsAt();
//		smsat.centerNo = CenterNo;
//		smsat.portName = PortName;
	}
	
	private static void platformSendSms(String receiver, String msg) {
		long tm = System.currentTimeMillis() / 1000;
		String sigtxt = String.format("%d%s%d%s", PlatformAppid, receiver, tm, PlatformKey);
		String sig = MD5Utility.encryptAsString(sigtxt).toLowerCase();
		
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("appId", PlatformAppid);
		params.put("mobile", receiver);
		params.put("timestamp", tm);
		params.put("sms", msg);
		params.put("sign", sig);
				
		String json = HttpClientUtility.httpPost(PlatformUrl, params, null, "application/x-www-form-urlencoded");
		Map<String, Object> res = JsonUtility.toDictionary(json);
		int status = ConvertUtility.getValueAsInt(res.get("status"));
		if(status == 0) {
			String err = (String) res.get("info");
			throw new RuntimeException(err);
		}
	}
	
	public static boolean sendSms(String receiver, String msg){
		if(StringUtility.isNullOrEmpty(msg) || !SmsEnable){
			return false;
		}
		
		try {
			if(UsePlatform) {
				platformSendSms(receiver, msg);
				return true;
			}
			
			Messager msger;
			if(SmsLocal) {
//				msger = smsat.clone();
				msger = sms.clone();
			}else {
				msger = sms.clone();
			}
			msger.dest = receiver;
			
			msger.send(msg);	
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return false;
		}
		return true;
	}

	public static void sendEmail(String subject, String msg, String dest){
		MailUtility.send(SmtpHost, SmtpPort, SmtpUsername, SmtpPassword, 25000, dest, subject, msg, SmtpSsl);
	}
	
	public static void main(String[] args) {
		long tm = System.currentTimeMillis() / 1000;
		String sigtxt = String.format("%d%s%d%s", 10005, "12345678", tm, "");
		System.out.println(sigtxt);
		String sig = MD5Utility.encryptAsString(sigtxt).toLowerCase();
		System.out.println(sig);
		
	}
	
}
