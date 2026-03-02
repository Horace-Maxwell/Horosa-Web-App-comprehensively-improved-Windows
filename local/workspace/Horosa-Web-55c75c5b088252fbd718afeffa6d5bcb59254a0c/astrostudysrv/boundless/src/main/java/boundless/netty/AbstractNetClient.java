package boundless.netty;

import java.util.function.Consumer;

import org.slf4j.Logger;

import boundless.netty.Datagram;
import boundless.netty.NettyClient;
import boundless.netty.ProcessorContext;
import boundless.utility.PeriodTask;

public abstract class AbstractNetClient {
	private String host;
	private int port;
	private Class decode;
	
	protected boolean needReconnect;
	protected NettyClient client;
	
	public AbstractNetClient(String host, int port, Class decode){
		this.host = host;
		this.port = port;
		this.decode = decode;
		
		client = new NettyClient(host, port, decode);
		needReconnect = false;
		
		PeriodTask.submit(new Runnable(){
			@Override
			public void run() {
				try{
					checkNeedReconnect();
				}catch(Exception e){
					e.printStackTrace();
				}
			}
			
		}, 10000, 60000);
	}
	
	public void signin(){}
	public void heartbeat(){}
	
	public void connect(){
		try{
			client.connect();
		}catch(Exception e){
			this.needReconnect = true;
			e.printStackTrace();
		}
	}
	
	public void send(Datagram data){
		client.send(data);
	}
	
	public void register(int command, Consumer<ProcessorContext> handler){
		client.register(command, handler);
	}
	
	public void close(){
		client.close();
	}
	
	public void log(Logger log){
		client.log(log);
	}
	
	public Logger log(){
		return client.log();
	}
	
	private void checkNeedReconnect(){
		if(needReconnect){
			client.reconnect();
			this.signin();
			needReconnect = false;
		}
	}
	
}
