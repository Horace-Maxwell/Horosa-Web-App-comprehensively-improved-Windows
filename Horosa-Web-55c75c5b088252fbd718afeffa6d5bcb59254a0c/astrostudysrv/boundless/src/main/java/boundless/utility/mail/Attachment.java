package boundless.utility.mail;

import boundless.io.FileUtility;
import boundless.security.SecurityUtility;

public class Attachment {
	public String content;
	public String filename;
	public String type;
	public String disposition = "attachment";
	
	public void file(byte[] raw, String fname) {
		try {
			this.content = SecurityUtility.base64(raw);
			this.filename = fname;
			this.type = FileUtility.getContentType(raw);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
}
