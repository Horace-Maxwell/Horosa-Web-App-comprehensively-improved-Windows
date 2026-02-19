package boundless.netty;

import org.slf4j.Logger;

public abstract class AbstractDatagram implements Datagram {
	private String ip;
	private int port;
	
	protected int command = 0;
	protected int callbackno = 0;
	protected String key;
	protected String info = "";
	protected String id = "";
	protected Logger log = null;

	@Override
	public void setCallbackno(int no){
		this.callbackno = no;
	}
	
	@Override
	public int getCallbackno(){
		return this.callbackno;
	}

	@Override
	public int command() {
		return this.command;
	}
	
	@Override
	public void command(int value){
		this.command = value;
	}

	@Override
	public void info(String info) {
		this.info = info;
	}

	@Override
	public String info() {
		return this.info;
	}
	
	@Override
	public void id(String id) {
		this.id = id;
	}

	@Override
	public String id() {
		return this.id;
	}

	@Override
	public Logger log() {
		return this.log;
	}

	@Override
	public void log(Logger log) {
		this.log = log;
	}

	@Override
	public void setKey(String key){
		this.key = key;
	}
	
	public void setIp(String ip){
		this.ip = ip;
	}
	public void setPort(int port){
		this.port = port;
	}
	public String getIp(){
		return ip;
	}
	public int getPort(){
		return port;
	}
	
}
