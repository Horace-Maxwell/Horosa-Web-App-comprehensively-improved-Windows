package boundless.netty;

import java.util.function.Consumer;

import org.slf4j.Logger;

import boundless.log.QueueLog;

public final class ClientTcp implements IClient {
	NettyClient client;
	
	private ClientPool pool;
	
	int countRef = 0;

	ClientTcp(ClientPool pool){
		this.pool = pool;
	}

	@Override
	public void register(int command, Consumer<ProcessorContext> handler) {
		if(this.client != null){
			this.client.register(command, handler);
		}
	}

	@Override
	public void unregister(int command) {
		if(this.client != null){
			this.client.unregister(command);
		}
	}

	@Override
	public synchronized void send(Datagram data){
		if(this.client != null){
			this.client.send(data);
		}else{
			QueueLog.error(log(), "server not ready, no send data, reject datagram");
		}
	}
	
	@Override
	public synchronized Datagram request(Datagram data, long timeoutInSec){
		if(this.client != null){
			return this.client.request(data, timeoutInSec);
		}else{
			QueueLog.error(log(), "server not ready, no send data, reject datagram");
		}
		return null;
	}
	
	@Override
	public synchronized Datagram request(Datagram data){
		if(this.client != null){
			return this.client.request(data);
		}else{
			QueueLog.error(log(), "server not ready, no send data, reject datagram");
		}
		return null;
	}
	
	@Override
	public String getServerIp(){
		if(this.client == null){
			QueueLog.error(log(), "server not ready, cannot get ip");
			return null;
		}
		return this.client.getServerIp();
	}
	
	@Override
	public int getServerPort(){
		if(this.client == null){
			QueueLog.error(log(), "server not ready, cannot get port");
			return -1;
		}
		return this.client.getServerPort();
	}
	
	@Override
	public Logger log(){
		return this.pool.log();
	}
	
	@Override
	public synchronized void close(){
		this.countRef--;
		this.pool.decreaseCurrentSize();
	}

}
