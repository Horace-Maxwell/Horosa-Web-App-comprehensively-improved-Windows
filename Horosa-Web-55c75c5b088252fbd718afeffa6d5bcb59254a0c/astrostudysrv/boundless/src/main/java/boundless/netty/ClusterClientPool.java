package boundless.netty;

import java.net.SocketAddress;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Map.Entry;
import java.util.concurrent.ScheduledFuture;
import java.util.function.Consumer;
import java.util.function.Supplier;

import org.slf4j.Logger;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.OutParameter;
import boundless.utility.IPUtility;
import boundless.utility.PeriodTask;
import boundless.utility.StringUtility;

public class ClusterClientPool implements ClientPool {
	public static final String logDir = "tcp";
	private ClusterClientSelector owner; 
	private Set<Long> serverSet; // Set<服务器ipnum>
	private Map<Long, Long> serverWeight; // Map<服务器ipnum, 权重>
	private int restype;
	
	private int size = 1;
	private int maxSize = 1;
	private int currentSize = 0;

	private int heartbeatCmd;
	private long heartbeatInterval;
	private Supplier<Datagram> heartbeatDatagaramSupply;

	private List<ClientTcp> clientPool; // 有效的连接
	private Set<ClientTcp> clients;  // 存放正在连接或失败的客户端对象
	
	private ScheduledFuture checkSchedule;
	private ScheduledFuture shrinkSchedule;
	private ScheduledFuture balanceSchedule;
	private ScheduledFuture heartbeatSchedule;
	
	private long balanceInterval;
	
	private Consumer<IClient> onConnectHandle;
	private Consumer<ProcessorContext> defaultCallbackHandler;
	
	ClusterClientPool(ClusterClientSelector owner, int restype, int maxpoolsize){
		this.serverSet = new HashSet<Long>();
		this.serverWeight = new HashMap<Long, Long>(); 
		this.clientPool = new LinkedList<ClientTcp>();
		this.clients = new HashSet<ClientTcp>(); 
		this.balanceInterval = 3600000;
		this.heartbeatInterval = 10000;
		this.heartbeatCmd = BasePacketIds.HeartBeat;
		
		this.owner = owner;
		this.restype = restype;
		this.maxSize = maxpoolsize;
		
		this.heartbeatDatagaramSupply = owner.heartbeatDatagaramSupply();
		this.heartbeatCmd = owner.heartbeatCmd();
		this.heartbeatInterval = owner.heartbeatInterval();
		
		innerconnect();
	}
	
	
	private synchronized void innerconnect(){
		for(int i=0; i<this.size; i++){
			spawnClient();
		}
		
		this.checkSchedule = PeriodTask.submit(()->{
			check();
		}, 1000, 10000);
		
		this.shrinkSchedule = PeriodTask.submit(()->{
			shrink();
		}, 1000, 10000);
		
		this.balanceSchedule = PeriodTask.submit(()->{
			balance();
		}, 10000, balanceInterval);
		
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
	
	private synchronized void check(){
		if(this.serverSet.isEmpty()){
			return;
		}
		
		for(ClientTcp cl : this.clients){
			if(cl.client == null){
				OutParameter<Integer> port = new OutParameter<Integer>();
				String servip = chooseServer(port);
				if(!StringUtility.isNullOrEmpty(servip)){
					spawnNettyClient(cl, servip, port.value);
					cl.client.connect();
				}
			}
		}
				
		expandPool();
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
					QueueLog.error(this.owner.errorLog(), e.getMessage());
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
							QueueLog.error(this.owner.errorLog(), e.getMessage());
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
	
	private synchronized void balance(){
		if(this.clientPool.isEmpty() || this.clientPool.size() == 1){
			return;
		}
		OutParameter<Integer> port = new OutParameter<Integer>();
		String servip = chooseServer(port);
		ClientTcp choose = null;
		if(!StringUtility.isNullOrEmpty(servip)){
			for(ClientTcp tcp : this.clientPool){
				if(tcp.getServerIp().equals(servip)){
					choose = tcp;
					break;
				}
			}
		}
		
		if(choose != null){
			if(this.clientPool.remove(choose)){
				this.clientPool.add(0, choose);
			}
		}
	}
	
	private String chooseServer(OutParameter<Integer> port){
		Set<Long> tmpset = new HashSet<Long>();
		Long chosenServer = null;
		long weight = Long.MAX_VALUE;
		for(long serv : serverSet){
			port.value = 0;
			String ip = IPUtility.convert(serv, port);
			if(port.value<=0 || port.value >= 65535 || !IPUtility.isReachable(ip, port.value, 500)){
				tmpset.add(serv);
				QueueLog.info(this.owner.log(), "remove server, ip: {}:{}, seems that server isnot alive", ip, port.value);
				continue;
			}
			long w = this.serverWeight.get(serv);
			if(w < weight){
				chosenServer = serv;
				weight = w;
			}
		}
		
		for(long serv : tmpset){
			this.serverSet.remove(serv);
		}
		if(chosenServer == null){
			return null;
		}
		long serv = chosenServer.longValue();
		String serverIp = IPUtility.convert(serv, port);
		return serverIp;
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
	
	private void spawnClient(){
		int cnt = this.clientPool.size() + this.clients.size();
		if(this.serverSet.isEmpty() || cnt >= this.maxSize){
			return;
		}
		OutParameter<Integer> port = new OutParameter<Integer>();
		String serverIp = chooseServer(port);
		if(StringUtility.isNullOrEmpty(serverIp)){
			return;
		}
		
		ClientTcp client = new ClientTcp(this);
		spawnNettyClient(client, serverIp, port.value);
		
		if(client.client != null){
			clients.add(client);
			client.client.connect();
		}
	}
	
	private void spawnNettyClient(ClientTcp owner, String ip, int port){
		if(this.serverSet.isEmpty()){
			return;
		}
		NettyClient client = new NettyClient(ip, port, this.owner.serverDecoder(), this.owner.trackPacket());
		owner.client = client;
		
		client.setDefaultCallbackHandler(defaultCallbackHandler);
		client.log(this.owner.log());
		client.errorLog(this.owner.errorLog());
		client.setConnectHandler((nettyclient, serversockaddr, clientsockaddr)->whenConnect(nettyclient, serversockaddr, clientsockaddr));
		client.setDisconnectHandler((nettyclient, serversockaddr, clientsockaddr)->whenDisconnect(nettyclient, serversockaddr, clientsockaddr));
		
		client.addExceptionHandle((err, servip, servport)->{
			try{
				onDisconnect(client);
			}catch(Exception e){
				QueueLog.error(this.owner.errorLog(), e.getMessage());
			}
		});
		
		registerHeartbeat(client);

		Map<Integer, Consumer<ProcessorContext>> handles = this.owner.getHandlers(this.restype);
		if(handles != null){
			for(Entry<Integer, Consumer<ProcessorContext>> entry : handles.entrySet()){
				int cmd = entry.getKey();
				Consumer<ProcessorContext> handle = entry.getValue();
				client.register(cmd, handle);
			}
		}

	}
	
	private synchronized void whenConnect(NettyClient client, SocketAddress serveraddr, SocketAddress clientaddr){
		ClientTcp tmp = null;
		
		for(ClientTcp cl : clients){
			if(cl.client == client){
				tmp = cl;
				clientPool.add(cl);
				if(this.onConnectHandle == null){
					if(this.owner.onConnectHandle() != null){
						this.owner.onConnectHandle().accept(cl);
					}
				}else{
					this.onConnectHandle.accept(cl);
				}
				Datagram data = this.owner.heartbeatDatagaramSupply().get();
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
			QueueLog.error(client.errorLog(), e.getMessage());
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
			}
		}
		
	}
	
	public int countServer(){
		return serverSet.size();
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
		return this.owner.log();
	}

	synchronized public void decreaseCurrentSize(){
		this.currentSize = this.currentSize <= 0 ? 0 : this.currentSize - 1;
	}
	
	synchronized public void removeServer(long serv){
		serverSet.remove(serv);
		serverWeight.remove(serv);
	}
	
	synchronized public void addServer(long serv, long weight){
		if(!IPUtility.isReachable(serv)){
			return;
		}
		
		boolean needChooseClient = false;
		if(serverSet.isEmpty()){
			needChooseClient = true;
		}
		serverSet.add(serv);
		serverWeight.put(serv, weight);
		
		if(needChooseClient){
			this.spawnClient();
		}
	}
	
	synchronized public void close(){
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
		if(this.balanceSchedule != null){
			try{
				this.balanceSchedule.cancel(true);
			}catch(Exception e){
			}
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
		
		this.serverSet.clear();

		for(ClientTcp client : clients){
			try{
				client.client.setConnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
				client.client.setDisconnectHandler((nettyclient, serversockaddr, clientsockaddr)->{});
				client.close();
				client.client.close();
			}catch(Exception e){
				QueueLog.error(this.owner.errorLog(), e.getMessage());
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
				QueueLog.error(this.owner.errorLog(), e.getMessage());
			}
		}
		clientPool.clear();
	}

	public void setMaxSize(int size){
		this.maxSize = size;
	}

	public void setDefaultCallbackHandler(Consumer<ProcessorContext> handler){
		this.defaultCallbackHandler = handler;
	}

	public void register(int command, Consumer<ProcessorContext> handler){
		for(ClientTcp cl : clientPool){
			cl.register(command, handler);
		}
		for(ClientTcp cl : clients){
			cl.register(command, handler);
		}
	}
	
	public void unregister(int command){
		for(ClientTcp cl : clientPool){
			cl.unregister(command);
		}
		for(ClientTcp cl : clients){
			cl.unregister(command);
		}
	}
	
	public void registerOnConnect(Consumer<IClient> handle){
		this.onConnectHandle = handle;
	}
	
	public void registerHeartbeat(int command, long heartbeatIntervalMS, Supplier<Datagram> datagaramsupply){
		this.heartbeatCmd = command;
		this.heartbeatInterval = heartbeatIntervalMS;
		this.heartbeatDatagaramSupply = datagaramsupply;
	}
	
	public synchronized IClient getClient(){
		if(serverSet.isEmpty() || this.clientPool.isEmpty()){
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
		
		currentSize++;
		client.countRef++;
		this.clientPool.add(client);
		
		this.currentSize = this.currentSize <= 0 ? 0 : this.currentSize - 1;
		return client;
	}
	

}
