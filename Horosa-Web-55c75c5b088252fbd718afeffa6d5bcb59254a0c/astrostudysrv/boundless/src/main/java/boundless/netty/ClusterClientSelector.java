package boundless.netty;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Supplier;

import org.slf4j.Logger;

import boundless.console.Diagnostic;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.IPUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;


public class ClusterClientSelector {
	public static final String logDir = "tcp";
	
	public static final int EmptyResType = Integer.MIN_VALUE;
	
	private UDPServer udpserver;
	
	// <资源类型, 处理此类资源的集群客户端连接池>
	private Map<Integer, ClusterClientPool> servers = new ConcurrentHashMap<Integer, ClusterClientPool>();
	
	private int udpPort = 16530;
	private String udpAddress = "255.255.255.255";

	private String serverDecoder = "boundless.netty.InnerMsgPacketDecoder";
	private boolean trackPacket = false;
	private String logname = "tcplog";
	private String errorLogname = "errorlog";
	private Logger log;
	private Logger errorlog;

	private int maxPoolSize = 3;
	
	private int heartbeatCmd = BasePacketIds.HeartBeat;
	private long heartbeatInterval = 10000;
	private Supplier<Datagram> heartbeatDatagaramSupply;

	private Map<Integer, Map<Integer, Consumer<ProcessorContext>>> handlers;
	private Consumer<IClient> onConnectHandle;
	
	ClusterClientSelector(String decoderClass, boolean trackpacket, int udpPort, int maxpoolsize, String logname, String errorlogname, String udplogname) {
		this.serverDecoder = decoderClass;
		this.trackPacket = trackpacket;
		this.udpPort = udpPort;
		this.logname = logname;
		this.errorLogname = errorlogname;
		this.log = AppLoggers.getLog(logDir, logname);
		this.errorlog = AppLoggers.getLog(logDir, errorlogname);
		
		this.maxPoolSize = maxpoolsize;

		this.handlers = new HashMap<Integer, Map<Integer, Consumer<ProcessorContext>>>();
		
		this.udpserver = new UDPServer(this, udplogname);
		
		this.heartbeatDatagaramSupply = new Supplier<Datagram>(){
			@Override
			public Datagram get() {
				return new InnerOutboundDatagram(heartbeatCmd);
			}
		};
		
		this.udpserver.run();

	}
	
	public static ClusterClientSelector createSelector(String decoderClass, boolean trackpacket, int udpport, int maxpoolsize,
			String logname, String errorlogname, String udplogname){
		ClusterClientSelector pool = new ClusterClientSelector(decoderClass, trackpacket, udpport, maxpoolsize, logname, errorlogname, udplogname);
		
		return pool;
	}
	
	public static ClusterClientSelector createSelector(String decoderClass, boolean trackpacket, int udpport, int maxpoolsize, String logname){
		return createSelector(decoderClass, trackpacket, udpport, maxpoolsize, logname, logname, logname);
	}

	public static ClusterClientSelector createSelector(String decoderClass, boolean trackpacket, int udpport, String logname){
		return createSelector(decoderClass, trackpacket, udpport, 3, logname, logname, logname);
	}

	public static ClusterClientSelector createSelector(String decoderClass, boolean trackpacket, int udpport){
		return createSelector(decoderClass, trackpacket, udpport, 3, "tcplog", AppLoggers.ErrorLogger.getName(), "udplog");
	}
	
	
	public void registerHeartbeat(int command, long heartbeatIntervalMS, Supplier<Datagram> datagaramsupply){
		this.heartbeatCmd = command;
		this.heartbeatInterval = heartbeatIntervalMS;
		this.heartbeatDatagaramSupply = datagaramsupply;
	}
	
	public void register(int restype, int command, Consumer<ProcessorContext> handler){
		Map<Integer, Consumer<ProcessorContext>> reshandle = this.handlers.get(restype);
		if(reshandle == null){
			reshandle = new HashMap<Integer, Consumer<ProcessorContext>>();
			this.handlers.put(restype, reshandle);
		}
		reshandle.put(command, handler);
		ClusterClientPool pool = this.servers.get(restype);
		if(pool != null){
			pool.register(command, handler);
		}
	}
	
	public void unregister(int restype, int command){
		Map<Integer, Consumer<ProcessorContext>> reshandle = this.handlers.get(restype);
		if(reshandle == null){
			return;
		}
		reshandle.remove(command);
		ClusterClientPool pool = this.servers.get(restype);
		if(pool != null){
			pool.unregister(command);
		}
	}
	
	public void registerOnConnect(Consumer<IClient> handle){
		this.onConnectHandle = handle;
	}
	
	public void close(){
		for(ClusterClientPool pool : this.servers.values()){
			pool.close();
		}
		this.handlers.clear();
		this.servers.clear();
		this.udpserver.close();
	}
	
	public void removeServer(int restype){
		ClusterClientPool pool = this.servers.get(restype);
		if(pool != null){
			pool.close();
		}
		this.servers.remove(restype);
	}
	
	public ClusterClientPool getClientPoolForResType(){
		return getClientPoolForResType(EmptyResType);
	}
	
	public ClusterClientPool getClientPoolForResType(int restype){
		ClusterClientPool pool = this.getClientPool(restype);		
		return pool;
	}
	
	public Logger log(){
		return this.log;
	}
	
	public Logger errorLog(){
		return this.errorlog;
	}
	
	public int[] getAllRestype(){
		Set<Integer> set = this.servers.keySet();
		int[] res = new int[set.size()];
		int i=0;
		for(Integer rt : set){
			res[i++] = rt.intValue();
		}
		return res;
	}
	
	Class serverDecoder(){
		try {
			return Class.forName(this.serverDecoder);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	boolean trackPacket(){
		return this.trackPacket;
	}
	
	long heartbeatInterval(){
		return this.heartbeatInterval;
	}
	
	int heartbeatCmd(){
		return this.heartbeatCmd;
	}
	
	Supplier<Datagram> heartbeatDatagaramSupply(){
		return this.heartbeatDatagaramSupply;
	}
	
	Map<Integer, Consumer<ProcessorContext>> getHandlers(int restype){
		return this.handlers.get(restype);
	}
	
	Consumer<IClient> onConnectHandle(){
		return this.onConnectHandle;
	}
	

	private synchronized ClusterClientPool getClientPool(int restype){
		ClusterClientPool  pool = servers.get(restype);
		if(pool == null){
			pool = new ClusterClientPool(this, restype, this.maxPoolSize);
			this.servers.put(restype, pool);
		}
		
		return pool;
	}
	
	private void addServers(int[] ips, int port, String restypestr, long weight){
		long[] resary = StringUtility.splitUInt32(restypestr, ',');
		for(long res : resary){
			ClusterClientPool cluster = getClientPool((int)res);
			for(int ip : ips){
				long serv = IPUtility.convertToLong(ip, port);
				cluster.addServer(serv, weight);
			}
		}
	}
	
	private void lostServers(int[] ips, int port, String restypestr){
		long[] resary = StringUtility.splitUInt32(restypestr, ',');
		for(long res : resary){
			ClusterClientPool cluster = getClientPool((int)res);
			for(int ip : ips){
				long serv = IPUtility.convertToLong(ip, port);
				cluster.removeServer(serv);
			}
			if(cluster.countServer() == 0){
				this.servers.remove(res);
			}
		}
	}
	
	
	private void onServerInfo(ProcessorContext ctx){
		Datagram indata = ctx.getInData();
		byte ipcnt = indata.readByte();
		int[] ips = new int[ipcnt];
		for(int i=0; i<ips.length; i++){
			ips[i] = indata.readInt();
		}
		int port = indata.readUInt16();
		String statejson = indata.readString();
		String restype = indata.readShortString();
		
		String[] ipary = IPUtility.convert(ips);
		QueueLog.debug(this.log(), "ips:{}, port:{}, statejson:{}, response to restype:{}", ConvertUtility.getValueAsString(ipary), port, statejson, restype);
		if(StringUtility.isNullOrEmpty(statejson)){
			return;
		}
		try{
			Map map = JsonUtility.toDictionary(statejson);
			int conncnt = ConvertUtility.getValueAsInt(map.get("Connectioins"));
			long memUsage = ConvertUtility.getValueAsLong(map.get(Diagnostic.MemoryUsageKey));
			int threadcnt = ConvertUtility.getValueAsInt(map.get(Diagnostic.ThreadCountKey));
			int cpuUsage = ConvertUtility.getValueAsInt(map.get(Diagnostic.CpuUsageKey));
			int taskrunning = ConvertUtility.getValueAsInt(map.get("Running"));
			long weight = (cpuUsage + memUsage) * 1000000 + (taskrunning + conncnt) * 1000 + threadcnt;
			
			if(StringUtility.isNullOrEmpty(restype)){
				restype = EmptyResType + "";
			}
			this.addServers(ips, port, restype, weight);
		}catch(Exception e){
			QueueLog.error(this.log(), e.getMessage());
		}
	}

	private void onWillReboot(ProcessorContext ctx){
		Datagram indata = ctx.getInData();
		byte ipcnt = indata.readByte();
		int[] ips = new int[ipcnt];
		for(int i=0; i<ips.length; i++){
			ips[i] = indata.readInt();
		}
		int port = indata.readInt();
		String restype = indata.readShortString();

		String[] ipary = IPUtility.convert(ips);
		QueueLog.debug(this.log(), "server will reboot, ips:{}, response to restype:{}", ConvertUtility.getValueAsString(ipary), restype);
		
		if(StringUtility.isNullOrEmpty(restype)){
			restype = EmptyResType + "";
		}
		this.lostServers(ips, port, restype);
	}
	
	private static class UDPServer{
		private int id = 0;
		private boolean trackPacket = false;
		private boolean exceptionMsgReturn = false;
		private boolean closeOnException = false;
		private String exceptionDatagram = "boundless.netty.InnerOutboundDatagram";
		private String decoder = "boundless.netty.InnerMsgUdpDatagramDecoder";
		private String logger = "udplog";
		
		private IBroadcastConfig config;
		private NettyUDPServer server;
		
		private ClusterClientSelector owner;
		
		UDPServer(ClusterClientSelector owner, String udplog){
			this.owner = owner;
			this.logger = udplog;
			initServer();
		}

		private IBroadcastConfig initConfig(){
			if(config == null){
				config = new BroadcastConfig(id, this.owner.udpAddress, this.owner.udpPort);
			}
			config.trackPacket(trackPacket);
			config.exceptionMsgReturn(exceptionMsgReturn);
			config.closeOnException(closeOnException);
			config.exceptionDatagram(exceptionDatagram);
			config.decoderClass(decoder);
			config.loggerName(logger);
			config.errorLoggerName(this.owner.errorLogname);
			
			return config;
		}
				
		private void initServer(){
			initConfig();
			server = new NettyUDPServer(config);
			
			server.register(BasePacketIds.ServerInfo, (ctx)->this.owner.onServerInfo(ctx));
			server.register(BasePacketIds.WillReboot, (ctx)->this.owner.onWillReboot(ctx));
			
			server.run();
		}
				
		private void run(){
			this.server.run();
		}
		
		private void close(){
			this.server.close();
		}
	}
}
