package boundless.utility.mail;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MailData {
	public List<MailAddr> to = new ArrayList<MailAddr>();
	public List<MailAddr> cc = new ArrayList<MailAddr>();
	public List<MailAddr> bcc = new ArrayList<MailAddr>();
	public MailAddr from;
	public List<Attachment> attachments = new ArrayList<Attachment>();
	public Map<String, String> custom_variables = new HashMap<String, String>();
	public Map<String, String> headers = new HashMap<String, String>();
	public String subject;
	public String text;
	public String category;
	
	public void header(String sourceDomain) {
		headers.put("X-Message-Source", sourceDomain);
	}
	
	public void header(String key, String value) {
		headers.put(key, value);
	}
	
	public void variable(String var, String value) {
		custom_variables.put(var, value);
	}
	
}
