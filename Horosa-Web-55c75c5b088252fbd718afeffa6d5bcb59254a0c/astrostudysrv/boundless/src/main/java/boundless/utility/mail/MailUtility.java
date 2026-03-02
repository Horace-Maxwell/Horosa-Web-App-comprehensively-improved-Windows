package boundless.utility.mail;

import java.util.Properties;

import javax.mail.internet.MimeMessage;

import org.apache.commons.mail.HtmlEmail;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.CalculatePool;
import boundless.utility.ConvertUtility;



public class MailUtility {
	
	public static void send(String host, int port, String username, String password, int timeout,
			String dest, String subject, Object data, boolean ssl){
		String[] dests = new String[]{ dest };
		send(host, port, username, password, timeout, dests, subject, data, ssl);
	}


	public static void send(String host, int port, String username, String password, int timeout,
			String[] dests, String subject, Object data, boolean ssl) {
		CalculatePool.queueUserWorkItem(()->{
			try{
				sendByHtmlEmail(host, port, username, password, timeout, dests, subject, data, ssl);
				QueueLog.debug(AppLoggers.DebugLogger, "mail send to {}", ConvertUtility.getValueAsString(dests));
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		});
	}

	private static void sendByHtmlEmail(String host, int port, String username, String password, int timeout,
			String[] dests, String subject, Object data, boolean ssl) throws Exception {
		
		if(!(data instanceof String)){
			return;
		}
		String msg = (String) data;

		final HtmlEmail mail = new HtmlEmail();
		mail.setCharset("UTF-8");
		mail.setHostName(host);
		mail.setSmtpPort(port);
		mail.setAuthentication(username, password);
		mail.setSSLOnConnect(ssl);
		mail.setSocketTimeout(timeout);

		mail.addTo(dests);
		mail.setFrom(username);
		mail.setSubject(subject);
		mail.setMsg(msg);
		
		mail.send();
	}
	
	private static void sendByJavaMailSenderImpl(String host, int port, String username, String password, int timeout,
			String[] dests, String subject, Object data, boolean ssl) throws Exception {
		if(!(data instanceof String)){
			return;
		}
				
		String emaildata = (String) data;
		
		JavaMailSenderImpl senderImpl = generateMailSenderImpl(host, port, username, password, timeout, ssl);
		
		MimeMessage mailMessage = senderImpl.createMimeMessage();  
	    MimeMessageHelper messageHelper = new MimeMessageHelper(mailMessage);
	    
	    messageHelper.setTo(dests);
	    messageHelper.setFrom(username);
	    messageHelper.setSubject(subject);
	    
	    messageHelper.setText(emaildata);
        senderImpl.send(mailMessage);
	}


	private static JavaMailSenderImpl generateMailSenderImpl(String host, int port, String username, String password, int timeout, boolean ssl){
		JavaMailSenderImpl senderImpl = new JavaMailSenderImpl();
		senderImpl.setHost(host);
		senderImpl.setPort(port);
		senderImpl.setUsername(username);
		senderImpl.setPassword(password);
		Properties prop = new Properties();
//		prop.put("mail.debug", "true");
		prop.put("mail.smtp.auth", "true"); // 将这个参数设为true，让服务器进行认证,认证用户名和密码是否正确 
		prop.put("mail.smtp.timeout", "" + timeout); 
		if(ssl){
			prop.put("mail.smtp.starttls.enable", "true");
			prop.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
			prop.put("mail.smtp.socketFactory.port", "" + port);
			prop.put("mail.smtp.socketFactory.fallback", "false");
		}
		
		senderImpl.setJavaMailProperties(prop);  

		return senderImpl;
	}
	

	public static void main(String[] args){
		try {
			String[] dests = new String[]{ "zjfchine@foxmail.com" };
			
//			send("smtp.163.com", 25, "zjfchine@163.com", "smtp123456", 25000,
//					dests, "email token", "123456", false);

			send("smtp.sendgrid.net", 587, "it@mas-x.io", "YOUR_API_KEY_HERE", 25000,
					dests, "email token", "123456", true);

			System.out.println("finish sending");
			Thread.sleep(100000);
		} catch (Exception e) {
			e.printStackTrace();
		}
		
	}
	
}
