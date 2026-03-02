package boundless.netty;

import java.net.SocketAddress;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.concurrent.ScheduledFuture;
import java.util.function.Consumer;
import java.util.function.Supplier;

import org.slf4j.Logger;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.PeriodTask;

public class NettyClientPool implements ClientPool {
	public static final String logDir = "tcp";
	private String serverIp;
	private int serverPort;
	
	private Class decoder;
	private boolean trackPacket;
	private Logger log;
	private Logger errorLog;
	
	private int size = 1;
	private int maxSize = 1;
	private int currentSize = 0;
	
	private int heartbeatCmd = BasePacketIds.HeartBeat;
	private long heartbeatInterval = 10000;
	Supplier<Datagram> heartbeatDatagaramSupply;
	
	private Consumer<IClient> onConnectHandle;
	private Consumer<ProcessorContext> defaultCallbackHandler;
	
	private List<ClientTcp> clientPool = new LinkedList<ClientTcp>(); // 有效的连接
	private Set<ClientTcp> clients = new HashSet<ClientTcp>();  // 存放正在连接或失败的客户端对象
	
	private ScheduledFuture checkSchedule;
	private ScheduledFuture shrinkSchedule;
	private ScheduledFuture heartbeatSchedule;
	
	private Map<Integer, Consumer<ProcessorContext>> handlers;
	

	public static NettyClientPool createPool(String serverIp, int serverPort, int size, String decoderClass, boolean trackpacket, String logname, String errlog){
		NettyClientPool pool = new NettyClientPool(serverIp, serverPort, size, decoderClass, trackpacket, logname, errlog);
		return pool;
	}
	
	public static NettyClientPool createPool(String serverIp, int serverPort, String decoderClass, boolean trackpacket, String logname){
		return createPool(serverIp, serverPort, 1, decoderClass, trackpacket, logname, logname);
	}
	
	public static NettyClientPool createPool(String serverIp, int serverPort, String decoderClass, String logname){
		return createPool(serverIp, serverPort, 1, decoderClass, false, logname, logname);
	}

	public static NettyClientPool createPool(String serverIp, int serverPort, String decoderClass){
		return createPool(serverIp, serverPort, 1, decoderClass, false, "tcplog", "tcplog");
	}

	
	NettyClientPool(String serverIp, int serverPort, int size, String decoderClass, boolean trackpacket, String logname, String errorlog){
		try{
			this.serverIp = serverIp;
			this.serverPort = serverPort;
			this.size = size;
			this.maxSize = size;
			this.decoder = Class.forName(decoderClass);
			this.trackPacket = trackpacket;
			this.log = AppLoggers.getLog(logDir, logname);
			this.errorLog = AppLoggers.getLog(logDir, errorlog);
			
			this.handlers = new HashMap<Integer, Consumer<ProcessorContext>>();

			this.heartbeatDatagaramSupply = new Supplier<Datagram>(){
				@Override
				public Datagram get() {
					return new InnerOutboundDatagram(heartbeatCmd);
				}
			};
			
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
		
	
	public void setMaxSize(int size){
		this.maxSize = size;
	}
			
	public void setDefaultCallbackHandler(Consumer<ProcessorContext> handler){
		this.defaultCallbackHandler = handler;
	}
	
	public void register(int command, Consumer<ProcessorContext> handler){
		this.handlers.put(command, handler);
		for(ClientTcp cl : clientPool){
			cl.register(command, handler);
		}
		for(ClientTcp cl : clients){
			cl.register(command, handler);
		}
	}
	
	public void unregister(int command){
		this.handlers.remove(command);
		for(ClientTcp cl : clientPool){
			cl.unregister(command);
		}
		for(ClientTcp cl : clients){
			cl.unregister(command);
		}
	}
	
	public void connect(){
		close();
		for(int i=0; i<this.size; i++){
			spawnClient();
		}
		
		this.checkSchedule = PeriodTask.submit(()->{
			check();
		}, 1000, 10000);
		
		this.shrinkSchedule = PeriodTask.submit(()->{
			shrink();
		}, 10000, 10000);
		
		this.heartbeatSchedule = PeriodTask.submit(()->{
			heartbeat();
		}, this.heartbeatInterval, this.heartbeatInterval);
	}
	
	private void expandPool(){
		int cnt = this.clientPool.size() + this.clients.size();
		if(cnt < this.maxSize){
			spawnClient();
		}
	}
	
	private synchronized void check(){
		for(ClientTcp cl : this.clients){
			if(cl.client == null){
				spawnNettyClient(cl);
				cl.client.connect();
			}
		}
		
		expandPool();
	}
	
	private void heartbeat(){
		for(ClientTcp cl : this.clientPool){
			try{
				if(cl.client != null){
					Datagram hbData = this.heartbeatDatagaramSupply.get();
					cl.send(hbData);
				}
			}catch(Exception e){
				
			}
		}
	}
	
	private synchronized void shrink(){
		int cnt = this.clientPool.size() + this.clients.size();
		
		Set<ClientTcp> tmpset = new HashSet<ClientTcp>();
		Set<ClientTcp> tmppoolset = new HashSet<ClientTcp>();
		
		if(cnt > this.maxSize){
			int i = 0;
			for(ClientTcp cl : clients){
				try{
					tmpset.add(cl);
					cl.client.setConnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
					cl.client.setDisconnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
					cl.close();
					cl.client.close();
				}catch(Exception e){
					QueueLog.error(this.errorLog, e.getMessage());
				}
				i++;
				if(i >= cnt/2){
					break;
				}
			}
			if(i < cnt/2){
				for(ClientTcp cl : this.clientPool){
					if(cl.countRef <= 0){
						try{
							tmppoolset.add(cl);
							cl.client.setConnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
							cl.client.setDisconnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
							cl.client.close();
						}catch(Exception e){
							QueueLog.error(this.errorLog, e.getMessage());
						}
						i++;
						if(i >= cnt/2){
							break;
						}
					}
				}
			}
		}
		
		for(ClientTcp cl : tmpset){
			this.clients.remove(cl);
			cl.client = null;
		}
		for(ClientTcp cl : tmppoolset){
			this.clientPool.remove(cl);
			cl.client = null;
		}

	}
	
	private void spawnNettyClient(ClientTcp owner){
		NettyClient client = new NettyClient(serverIp, serverPort, decoder, trackPacket);
		owner.client = client;
		
		client.setDefaultCallbackHandler(defaultCallbackHandler);
		client.log(log);
		client.errorLog(AppLoggers.ErrorLogger);
		client.setConnectHandler((nettyclient, serversockaddr, clientsockaddr)->whenConnect(nettyclient, serversockaddr, clientsockaddr));
		client.setDisconnectHandler((nettyclient, serversockaddr, clientsockaddr)->whenDisconnect(nettyclient, serversockaddr, clientsockaddr));
		
		client.addExceptionHandle((err, servip, servport)->{
			try{
				QueueLog.error(this.errorLog, err);
				onDisconnect(client);
			}catch(Exception e){
				QueueLog.error(this.errorLog, e);
			}
		});
		
		registerHeartbeat(client);

		for(Entry<Integer, Consumer<ProcessorContext>> entry : this.handlers.entrySet()){
			int cmd = entry.getKey();
			Consumer<ProcessorContext> handle = entry.getValue();
			client.register(cmd, handle);
		}
	}
	
	private void spawnClient(){
		ClientTcp client = new ClientTcp(this);

		spawnNettyClient(client);
		
		if(client.client != null){
			clients.add(client);
			client.client.connect();
		}
	}
	
	private synchronized void whenConnect(NettyClient client, SocketAddress serveraddr, SocketAddress clientaddr){
		ClientTcp tmp = null;
		
		for(ClientTcp cl : clients){
			if(cl.client == client){
				tmp = cl;
				clientPool.add(cl);
				if(this.onConnectHandle != null){
					this.onConnectHandle.accept(cl);
				}
				Datagram data = this.heartbeatDatagaramSupply.get();
				client.send(data);
				break;
			}
		}
		
		if(tmp != null){
			this.clients.remove(tmp);
		}
	}
	
	private void whenDisconnect(NettyClient client, SocketAddress serveraddr, SocketAddress clientaddr){
		onDisconnect(client);
	}
	
	private synchronized void onDisconnect(NettyClient client){
		ClientTcp tmp = null;
		
		try{
			client.close();
		}catch(Exception e){
			QueueLog.error(this.errorLog, e.getMessage());
		}
		for(ClientTcp cl : clientPool){
			if(cl.client == client){
				tmp = cl;
				this.clients.add(cl);
				break;
			}
		}
		
		if(tmp != null){
			this.clientPool.remove(tmp);
		}

		for(ClientTcp cl : clients){
			if(cl.client == client){
				cl.client = null;
				break;
			}
		}
				
	}
	
	synchronized public void decreaseCurrentSize(){
		this.currentSize = this.currentSize <= 0 ? 0 : this.currentSize - 1;
	}
	
	public synchronized void close(){
		if(this.heartbeatSchedule != null){
			try{
				this.heartbeatSchedule.cancel(true);
			}catch(Exception e){
			}
		}
		try{
			ClientPoolFactory.closePool(this);
		}catch(Exception e){
		}
		if(this.checkSchedule != null){
			try{
				this.checkSchedule.cancel(true);
			}catch(Exception e){
			}
		}
		if(this.shrinkSchedule != null){
			try{
				this.shrinkSchedule.cancel(true);
			}catch(Exception e){
			}
		}
		
		for(ClientTcp client : clients){
			try{
				client.client.setConnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
				client.client.setDisconnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
				client.close();
				client.client.close();
			}catch(Exception e){
				QueueLog.error(this.errorLog, e.getMessage());
			}
		}
		clients.clear();
		
		for(ClientTcp client : clientPool){
			try{
				client.client.setConnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
				client.client.setDisconnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
				client.close();
				client.client.close();
			}catch(Exception e){
				QueueLog.error(this.errorLog, e.getMessage());
			}
		}
		clientPool.clear();
	}
	
	private synchronized void registerHeartbeat(){
		for(ClientTcp client : clientPool){
			if(client != null){
				registerHeartbeat(client.client);
			}
		}
	}
	
	private void registerHeartbeat(NettyClient client){
		client.registerHeartbeatHandle(this.heartbeatCmd, (ctx)->{
			try {
				Thread.sleep(this.heartbeatInterval);
				Datagram data = this.heartbeatDatagaramSupply.get();
				ctx.send(data);
			} catch (Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e.getMessage());
			}
		});
	}
	
	public void registerHeartbeat(int command, long heartbeatIntervalMS, Supplier<Datagram> datagaramsupply){
		this.heartbeatCmd = command;
		this.heartbeatInterval = heartbeatIntervalMS;
		this.heartbeatDatagaramSupply = datagaramsupply;
		registerHeartbeat();
	}
	
	public void registerOnConnect(Consumer<IClient> handle){
		this.onConnectHandle = handle;
	}
		
	public String getServerIp() {
		return serverIp;
	}

	public int getServerPort() {
		return serverPort;
	}

	public int getSize() {
		return size;
	}
	
	public int countPoolSize(){
		return this.clientPool.size();
	}
	
	public int countClientObject(){
		return this.clientPool.size() + this.clients.size();
	}
	
	public int countClientRef(){
		return this.currentSize;
	}
	
	public Logger log(){
		return this.log;
	}
	

	public synchronized IClient getClient(){
		if(this.clientPool.isEmpty()){
			expandPool();
			return null;
		}
		ClientTcp client = null;
		try{
			if(this.clientPool.size() == 1){
				client = this.clientPool.get(0);
				this.currentSize++;
				client.countRef++;
				this.currentSize = this.currentSize <= 0 ? 0 : this.currentSize - 1;
				return client;
			}
			client = this.clientPool.remove(0);
		}catch(Exception e){
			return null;
		}
		this.currentSize++;
		client.countRef++;
		this.clientPool.add(client);
		
		this.currentSize = this.currentSize <= 0 ? 0 : this.currentSize - 1;
		return client;
	}
	
	

}
