package boundless.utility.mail;

import java.util.Arrays;
import java.util.List;

import boundless.spring.help.PropertyPlaceholder;
import boundless.types.message.SendGridMailService;

public class SendGridUtility {
	private static String apiKey = PropertyPlaceholder.getProperty("sendgrid.apikey", "YOUR_API_KEY_HERE");
	private static String fromEmail = PropertyPlaceholder.getProperty("sendgrid.fromemail", "it@mas-x.io");
	private static String fromName = PropertyPlaceholder.getProperty("sendgrid.fromname", "it@mas");
	
	public static void sendMail(List<String> toEmailsList, String subject, String body) {
		SendGridMailService service = new SendGridMailService(apiKey, fromEmail, fromName);
		service.sendMailWithoutAttachment(toEmailsList, null, null, subject, body);
	}
	
	public static void main(String[] args) {
		List<String> list = Arrays.asList("zjfchinespace@gmail.com", "zjfchine@foxmail.com");
		String subject = "测试验证码";
		String body = "你的验证码为xt89S";
		sendMail(list, subject, body);
	}
	
}
