package boundless.netty;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Supplier;

import boundless.utility.IPUtility;

public class ClientPoolFactory {
	
	private static Map<Long, ClientPool> singleServerPool = new ConcurrentHashMap<Long, ClientPool>();
	private static Map<Integer, ClusterClientSelector> multiServerPool = new ConcurrentHashMap<Integer, ClusterClientSelector>();
	
	private static String logName = "tcplog";
	private static String udpLogName = "udplog";
	private static String errorLogName = "errorlog";
	private static int poolSize = 1;
	private static boolean trackPacket = false;
	private static String defaultDecodeClass = "boundless.netty.InnerMsgPacketDecoder";

	private static int heartbeatCmd = BasePacketIds.HeartBeat;
	private static long heartbeatInterval = 10000;
	
	private static Supplier<Datagram> heartbeatDatagaramSupply = new Supplier<Datagram>(){
		@Override
		public Datagram get() {
			return new InnerOutboundDatagram(heartbeatCmd);
		}
	};
	
	private static Consumer<IClient> onConnectHandle;

	
	static void closePool(ClientPool pool){

	}
	
	public static void init(String logname, String errorlogname, String udplogname, int poolsize, boolean trackpkt, String decodeClass){
		logName = logname;
		errorLogName = errorlogname;
		poolSize = poolsize;
		trackPacket = trackpkt;
		udpLogName = udplogname;
		defaultDecodeClass = decodeClass;
	}
	
	public static void init(String logname, String errorlogname, int poolsize, boolean trackpkt, String decodeClass){
		logName = logname;
		errorLogName = errorlogname;
		poolSize = poolsize;
		trackPacket = trackpkt;
		defaultDecodeClass = decodeClass;
	}
	
	public static void init(String logname, String errorlogname, String udplogname, int poolsize, boolean trackpkt){
		logName = logname;
		errorLogName = errorlogname;
		poolSize = poolsize;
		trackPacket = trackpkt;
		udpLogName = udplogname;
	}
	
	public static void init(String logname, String errorlogname, int poolsize, boolean trackpkt){
		init(logname, errorlogname, logname, poolsize, trackpkt);
	}
	
	public static void registerOnConnect(Consumer<IClient> handle){
		onConnectHandle = handle;
		
		initHandlers();
	}

	public static void registerHeartbeat(int command, long heartbeatIntervalMS, Supplier<Datagram> datagaramsupply){
		heartbeatCmd = command;
		heartbeatInterval = heartbeatIntervalMS;
		heartbeatDatagaramSupply = datagaramsupply;
		
		initHandlers();
	}

	private static void initHandlers(){
		for(ClientPool pool : singleServerPool.values()){
			pool.registerOnConnect(onConnectHandle);
			pool.registerHeartbeat(heartbeatCmd, heartbeatInterval, heartbeatDatagaramSupply);
		}
		
		for(ClusterClientSelector selector : multiServerPool.values()){
			selector.registerOnConnect(onConnectHandle);
			selector.registerHeartbeat(heartbeatCmd, heartbeatInterval, heartbeatDatagaramSupply);
		}
	}
	
	public static ClientPool getPool(String ip, int port, String decodeClass){
		long num = IPUtility.convertToLong(ip, port);
		ClientPool res = singleServerPool.get(num);
		if(res != null){
			return res;
		}
		
		res = NettyClientPool.createPool(ip, port, poolSize, decodeClass, trackPacket, logName, errorLogName);
		res.registerOnConnect(onConnectHandle);
		res.registerHeartbeat(heartbeatCmd, heartbeatInterval, heartbeatDatagaramSupply);
		res.connect();
		
		singleServerPool.put(num, res);
		return res;
	}
	
	public static ClientPool getPool(String ip, int port){
		return getPool(ip, port, defaultDecodeClass);
	}
	
	public static void initClientPool(int udpport){
		ClusterClientSelector selector = multiServerPool.get(udpport);
		if(selector == null){
			selector = ClusterClientSelector.createSelector(defaultDecodeClass, trackPacket, udpport, poolSize, logName, errorLogName, udpLogName);
			multiServerPool.put(udpport, selector);
		}
		selector.registerOnConnect(onConnectHandle);
		selector.registerHeartbeat(heartbeatCmd, heartbeatInterval, heartbeatDatagaramSupply);
	}
	
	public static ClientPool getPool(int udpport, int restype, String decodeClass){
		ClusterClientSelector selector = multiServerPool.get(udpport);
		if(selector == null){
			selector = ClusterClientSelector.createSelector(decodeClass, trackPacket, udpport, poolSize, logName, errorLogName, udpLogName);
			selector.registerOnConnect(onConnectHandle);
			selector.registerHeartbeat(heartbeatCmd, heartbeatInterval, heartbeatDatagaramSupply);
			multiServerPool.put(udpport, selector);
		}
		
		return selector.getClientPoolForResType(restype);
	}
	
	public static ClientPool getPool(int udpport, int restype){
		return getPool(udpport, restype, defaultDecodeClass);
	}
	
	public static void removePool(String ip, int port){
		long num = IPUtility.convertToLong(ip, port);
		ClientPool res = singleServerPool.get(num);
		if(res != null){
			res.close();
		}
		singleServerPool.remove(num);
	}
	
	public static void removePool(int udpport){
		ClusterClientSelector selector = multiServerPool.get(udpport);
		if(selector != null){
			selector.close();
		}
		multiServerPool.remove(udpport);
	}
	
	public static void clear(){
		for(ClientPool client : singleServerPool.values()){
			client.close();
		}
		singleServerPool.clear();
		
		for(ClusterClientSelector selector : multiServerPool.values()){
			selector.close();
		}
		multiServerPool.clear();
	}
	
	public static int[] getAllRestype(int udpPort){
		ClusterClientSelector selector = multiServerPool.get(udpPort);
		if(selector == null){
			return new int[0];
		}
		
		return selector.getAllRestype();
	}
}
