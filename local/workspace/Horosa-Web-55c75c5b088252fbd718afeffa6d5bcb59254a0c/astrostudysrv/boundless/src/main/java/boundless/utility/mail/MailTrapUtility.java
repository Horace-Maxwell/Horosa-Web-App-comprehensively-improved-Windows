package boundless.utility.mail;

import java.util.HashMap;
import java.util.Map;

import boundless.net.http.HttpClientUtility;
import boundless.spring.help.PropertyPlaceholder;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class MailTrapUtility {

	private static String url = PropertyPlaceholder.getProperty("mailtrap.url", "https://send.api.mailtrap.io/api/send");
	private static String apiKey = PropertyPlaceholder.getProperty("mailtrap.apikey", "4e8d93e377dac1320c076fe639696d39");
	
	public static void send(String toEmail, String toName, String subject, String txt, String catalogue) {
		String[] emails = StringUtility.splitString(toEmail, ',');
		String[] names = new String[emails.length];
		if(!StringUtility.isNullOrEmpty(toName)) {
			names = StringUtility.splitString(toName, ',');
		}
		
		MailAddr from = new MailAddr("it@mas-x.io", "mas it department");
		MailData data = new MailData();
		for(int i=0; i<emails.length; i++) {
			String email = emails[i];
			if(!StringUtility.isEmail(email)) {
				throw new RuntimeException("email.format.error");
			}
			String name = null;
			if(i < names.length) {
				name = names[i];
			}
			MailAddr to = new MailAddr(email, name);
			data.to.add(to);			
		}
		data.from = from;
		data.subject = subject;
		data.text = txt;
		data.category = catalogue;
		
		Map<String, String> authHeader = new HashMap<String, String>();
		authHeader.put("Api-Token", apiKey);
		authHeader.put("Authorization", String.format("Bearer %s", apiKey));
		
		String json = JsonUtility.encode(data);
		HttpClientUtility.uploadJson(url, authHeader, json);
	}
	
	public static void main(String[] args) {
		String toemail = "zjfchine@foxmail.com";
		String name = "zjf";
		
//		toemail = "zjfchinespace@gmail.com";
		
		String subject = "mail trap 测试";
		String txt = "这是一封用mail trap平台的测试邮件";
		
		send(toemail, null, subject, txt, "test");
	}
}
