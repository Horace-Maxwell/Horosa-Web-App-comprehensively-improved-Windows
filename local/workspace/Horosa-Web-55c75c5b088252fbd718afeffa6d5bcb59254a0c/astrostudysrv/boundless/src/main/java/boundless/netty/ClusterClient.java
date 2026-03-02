package boundless.netty;

import java.util.HashSet;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.function.Consumer;

import org.slf4j.Logger;

import boundless.log.QueueLog;
import boundless.types.OutParameter;
import boundless.utility.IPUtility;
import boundless.utility.PeriodTask;

public final class ClusterClient implements IClient {

	private ClusterClientSelector owner; 
	
	private Set<Long> serverSet = new HashSet<Long>();
	private Map<Long, Long> serverWeight = new ConcurrentHashMap<Long, Long>();
	
	private NettyClient client = null;
	private int restype;
	
	private ScheduledFuture checkSchedule;

	ClusterClient(ClusterClientSelector owner, int restype, long checkIntervalInSec){
		this.owner = owner;
		this.restype = restype;
		
		this.checkSchedule = PeriodTask.submit(()->{
			if(this.serverSet.isEmpty()){
				return;
			}
			this.checkServerAlive();
		}, 1000, checkIntervalInSec * 1000);
		
	}
	
	NettyClient client(){
		return client;
	}
	
	int serverSize(){
		return serverSet.size();
	}
	
	void removeServer(long serv){
		serverSet.remove(serv);
		serverWeight.remove(serv);
	}
	
	void addServer(long serv, long weight){
		boolean needChooseClient = false;
		if(serverSet.isEmpty()){
			needChooseClient = true;
		}
		serverSet.add(serv);
		serverWeight.put(serv, weight);
		
		if(needChooseClient){
			this.checkServerAlive();
		}
	}
	
	void shutdown(){
		try{
			this.checkSchedule.cancel(true);
			this.serverSet.clear();
			NettyClient cl = this.client;
			this.client = null;
			if(cl != null){
				cl.close();
			}
		}catch(Exception e){
			QueueLog.error(this.log(), e.getMessage());
		}
	}
	
	
	
	void checkServerAlive(){
		for(long serv : serverSet){
			OutParameter<Integer> port = new OutParameter<Integer>();
			port.value = 0;
			String ip = IPUtility.convert(serv, port);
			if(port.value<=0 || port.value >= 65535 || !IPUtility.isReachable(ip, port.value, 500)){
				removeServer(serv);
				QueueLog.info(this.owner.log(), "remove server, ip: {}:{}, seems that server isnot alive", ip, port.value);
				continue;
			}
		}
		if(this.client == null){
			chooseServer();
		}
	}
	
	private void chooseServer(){
		if(this.serverSet.isEmpty()){
			return;
		}
		
		Long chosenServer = null;
		long weight = Long.MAX_VALUE;
		for(long serv : serverSet){
			OutParameter<Integer> port = new OutParameter<Integer>();
			port.value = 0;
			String ip = IPUtility.convert(serv, port);
			if(port.value<=0 || port.value >= 65535 || !IPUtility.isReachable(ip, port.value, 500)){
				removeServer(serv);
				QueueLog.info(this.owner.log(), "remove server, ip: {}:{}, seems that server isnot alive", ip, port.value);
				continue;
			}
			long w = this.serverWeight.get(serv);
			if(w < weight){
				chosenServer = serv;
				weight = w;
			}
		}
		
		if(chosenServer == null){
			return;
		}
		
		if(this.client != null){
			String ip = this.client.getServerIp();
			int port = this.client.getServerPort();
			long nip = IPUtility.convertToLong(ip, port);
			if(nip != chosenServer.longValue()){
				try{
					this.client.close();
				}catch(Exception e){
					QueueLog.error(this.owner.errorLog(), e.getMessage());
				}
				this.client = null;
				getChosenClient(chosenServer.longValue());
			}
		}else{
			getChosenClient(chosenServer.longValue());
		}
	}
	
	private void getChosenClient(long chosenServer){
		try{
			OutParameter<Integer> port = new OutParameter<Integer>();
			String ip = IPUtility.convert(chosenServer, port);
			Class decoder = this.owner.serverDecoder();
			NettyClient client = new NettyClient(ip, port.value, decoder, this.owner.trackPacket());
			client.log(this.owner.log());
			client.errorLog(this.owner.errorLog());
			
			client.register(BasePacketIds.HeartBeat, (ctx)->{
				try {
					Thread.sleep(this.owner.heartbeatInterval());
				} catch (Exception e) {
				}
				Datagram data = this.owner.heartbeatDatagaramSupply().get();
				ctx.send(data);
			});
			
			client.addExceptionHandle((err, servip, servport)->{
				QueueLog.error(this.owner.errorLog(), err.getMessage());
				this.onClientException(servip, servport);
			});
			
			client.setDisconnectHandler((nettyclient, serveraddr, clientaddr)->{
				String servip = nettyclient.getServerIp();
				int servport = nettyclient.getServerPort();
				this.onClientException(servip, servport);
			});
			
			client.setConnectHandler((nettyclient, serversockaddr, clientsockaddr)->{
				this.client = nettyclient;
				
				if(this.owner.onConnectHandle() != null){
					this.owner.onConnectHandle().accept(this);
				}
			});
			
			Map<Integer, Consumer<ProcessorContext>> handles = this.owner.getHandlers(this.restype);
			if(handles != null){
				for(Entry<Integer, Consumer<ProcessorContext>> entry : handles.entrySet()){
					int cmd = entry.getKey();
					Consumer<ProcessorContext> handle = entry.getValue();
					client.register(cmd, handle);
				}
			}
			
			
			client.connect();
			
			Datagram data = this.owner.heartbeatDatagaramSupply().get();
			client.send(data);

		}catch(Exception err){
			QueueLog.error(this.owner.errorLog(), err);
		}
	}

	private void onClientException(String servip, int servport){
		long serv = IPUtility.convertToLong(servip, servport);
		this.removeServer(serv);
		
		if(this.client != null && this.client.getServerIp().equals(servip) && this.client.getServerPort() == servport){
			NettyClient cl = this.client;
			this.client = null;
			try{
				cl.close();
			}catch(Exception e){
				QueueLog.error(this.owner.errorLog(), e.getMessage());
			}
		}
		this.checkServerAlive();
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
		return this.client.getServerIp();
	}
	
	@Override
	public int getServerPort(){
		return this.client.getServerPort();
	}
	
	@Override
	public Logger log(){
		return this.owner.log();
	}
	
	@Override
	public void close(){
		
	}

	public int getResType(){
		return this.restype;
	}
	
	public String[] getServers(){
		String[] servs = new String[this.serverSet.size()];
		OutParameter<Integer> port = new OutParameter<Integer>();
		int i = 0;
		for(long serv : this.serverSet){
			String ip = IPUtility.convert(serv, port);
			StringBuilder sb = new StringBuilder(ip);
			sb.append(":").append(port.value);
			servs[i++] = sb.toString(); 
		}
		return servs;
	}
	
}
