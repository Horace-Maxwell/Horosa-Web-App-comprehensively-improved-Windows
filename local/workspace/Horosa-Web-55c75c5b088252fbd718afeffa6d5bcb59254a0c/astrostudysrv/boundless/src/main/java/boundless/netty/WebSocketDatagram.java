package boundless.netty;

import java.util.HashMap;
import java.util.Map;

import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;

public class WebSocketDatagram extends TextWebSocketFrame implements Datagram {
	private int cmd = BasePacketIds.WebSockePacket;
	private byte[] raw = new byte[0];
	private Object body = null;
	private Map<String, Object> head = new HashMap<String, Object>();
	private IUser user;
		
	public WebSocketDatagram(String text){
		super(text);
		if(!StringUtility.isNullOrEmpty(text)) {
			try {
				this.raw = text.getBytes("UTF-8");
			}catch(Exception e) {
				
			}		
		}
	}
	
	@Override
	public int command() {
		return cmd;
	}

	@Override
	public void command(int value) {
		this.cmd = value;
	}

	@Override
	public int length() {
		return this.raw.length;
	}

	@Override
	public byte[] getAllRawData() {
		return this.raw;
	}

	public String getString() {
		return this.text();
	}
	
	public Object getBody() {
		return this.body;
	}
	
	public void setBody(Object obj) {
		this.body = obj;
	}
	
	public Map<String, Object> getHead(){
		return this.head;
	}
	
	public void setHead(Map<String, Object> head) {
		this.head = head;
	}

	public Map<String, String> getHeadStringMap(){
		Map<String, String> map = new HashMap<String, String>();
		if(this.head == null) {
			return map;
		}
		
		for(Map.Entry<String, Object> entry : this.head.entrySet()) {
			map.put(entry.getKey(), ConvertUtility.getValueAsString(entry.getValue()));
		}
		return map;
	}
	
	public IUser getUser() {
		return this.user;
	}
	
	public void setUser(IUser user) {
		this.user = user;
	}
}
