package boundless.spring.help.interceptor;

import java.io.Serializable;

import boundless.utility.JsonUtility;

public class RequestPacket implements Serializable{
	private static final long serialVersionUID = 7452743796027220880L;

	public RequestHead head;
	public String bodyStr;
	
	public String toString(){
		return JsonUtility.encodePretty(this);
	}
	
}
