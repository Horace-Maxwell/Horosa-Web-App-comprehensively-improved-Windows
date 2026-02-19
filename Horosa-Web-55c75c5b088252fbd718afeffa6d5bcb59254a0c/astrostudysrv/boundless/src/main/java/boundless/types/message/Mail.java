package boundless.types.message;

import boundless.utility.mail.MailUtility;

public class Mail extends Messager {
	public boolean ssl = false;
	
	@Override
	protected void doSend(String msg) throws Exception{
		doSend("alert", msg);
	}

	@Override
	protected void doSend(String title, String msg) throws Exception {
		String[] dests = this.dest.split(",");
		MailUtility.send(this.host, this.port, this.username, this.password, this.timeout*1000, dests, title, msg, this.ssl);
	}


}
