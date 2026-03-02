package boundless.program;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import boundless.netty.Server;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.client.socket.UdpServer;
import boundless.netty.Broadcast;
import boundless.netty.NettyUDPServer;

public class Servers {
	private static String externalIp;
	private static int externalIpNum;

	private static Map<Integer, Server> servers = new ConcurrentHashMap<Integer, Server>();
	private static Map<Integer, Broadcast> broadcasts = new ConcurrentHashMap<Integer, Broadcast>();
	private static Map<Integer, UdpServer> udpServers = new ConcurrentHashMap<Integer, UdpServer>();
	private static Map<Integer, NettyUDPServer> nettyUdpServers = new ConcurrentHashMap<Integer, NettyUDPServer>();

	public static int getExternalIpNum(){
		return externalIpNum;
	}
	
	public static String getExternalIp(){
		return externalIp;
	}
	
	public static void put(int serverId, Broadcast server){
		broadcasts.put(serverId, server);
	}
	
	public static Broadcast getBroadcaster(int broadcastId){
		return broadcasts.get(broadcastId);
	}
	
	public static void put(int serverId, NettyUDPServer server){
		nettyUdpServers.put(serverId, server);
	}
	
	public static NettyUDPServer getNettyUDPServer(int serverId) {
		return nettyUdpServers.get(serverId);
	}
	
	public static void put(int serverId, Server server){
		servers.put(serverId, server);
	}
	
	public static Server getServer(int serverId){
		return servers.get(serverId);
	}
	
	public static void put(int serverId, UdpServer server){
		udpServers.put(serverId, server);
	}
	
	public static UdpServer getUdpServer(int serverId){
		return udpServers.get(serverId);
	}
	
	public static void shutdown() {
		for(Server srv : servers.values()) {
			try {
				srv.close();				
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		for(UdpServer srv : udpServers.values()) {
			try {
				srv.close();				
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		for(NettyUDPServer srv : nettyUdpServers.values()) {
			try {
				srv.close();				
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		for(Broadcast srv : broadcasts.values()) {
			try {
				srv.close();				
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
		
		servers.clear();
		udpServers.clear();
		nettyUdpServers.clear();
		broadcasts.clear();
	}
	
}
