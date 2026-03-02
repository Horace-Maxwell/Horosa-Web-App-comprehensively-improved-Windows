package boundless.program;

import java.lang.reflect.Method;

import boundless.console.ApplicationUtility;
import boundless.log.AppLoggers;
import boundless.model.HierarchicalMap;
import boundless.net.client.socket.UdpServer;
import boundless.net.client.socket.UdpServerPlug;
import boundless.net.external.IServerConfiguration;
import boundless.net.external.ServerConfiguration;
import boundless.netty.BroadcastConfig;
import boundless.netty.IBroadcastConfig;
import boundless.netty.InnerClusterServer;
import boundless.netty.NettyUDPServer;
import boundless.types.bytesbuf.UdpPacketDecoder;
import boundless.utility.CalculatePool;

public class ServerProgram {
	
	public static void initAppParams(String[] args){
    	for(String arg : args){
    		String param[] = arg.split("=");
    		if(param.length > 1){
    			ApplicationUtility.putAppParam(param[0], param[1]);
    		}
    	}
    	
		ApplicationUtility.saveStartupInfo();
	}
	
	public static void initServers() throws Exception {
		HierarchicalMap[] tcpmaps = ApplicationUtility.tcpServers();
		HierarchicalMap[] udpmaps = ApplicationUtility.udpServers();

		for(HierarchicalMap map : tcpmaps){
			IServerConfiguration config = new ServerConfiguration(map);
			InnerClusterServer serv = new InnerClusterServer(config);
			Servers.put(config.serverId(), serv);
			serv.run();
		}
				
		for(HierarchicalMap map : udpmaps){
			IServerConfiguration config = new ServerConfiguration(map);
			UdpServer serv = generateUdpServer(config);
			Servers.put(config.serverId(), serv);
			serv.listen(config.port());
		}
	}
	
	private static UdpServer generateUdpServer(IServerConfiguration config) throws Exception {
		String decodeClass = config.decoderClass();
		Object dec = Class.forName(decodeClass).newInstance();
		if(!(dec instanceof UdpPacketDecoder)){
			throw new Exception(decodeClass + "isnot UdpPacketDecoder class");
		}
		String plugclass = config.initPluginClass();
		Object plugobj = Class.forName(plugclass).newInstance();
		if(!(plugobj instanceof UdpServerPlug)){
			throw new Exception(plugclass + "isnot UdpServerPlug class");
		}
		
		String log = config.loggerName();
		String errlog = config.errorLoggerName();
		
		UdpPacketDecoder decoder = (UdpPacketDecoder) dec;
		UdpServer srv = new UdpServer(decoder);
		srv.setUseRSA(config.useRSA());
		srv.setInverseRSA(config.inverseRSA());
		srv.setClientModulus(config.rsaClientModulus());
		srv.setClientPublicExp(config.rsaClientPublicExp());
		srv.setSelfModulus(config.rsaServerModulus());
		srv.setSelfPrivateExp(config.rsaServerPrivateExp());
		srv.setSelfPublicExp(config.rsaServerPublicExp());
		
		srv.setTracePacket(config.trackPacket());
		srv.setLogger(AppLoggers.getLog("udp", log));
		srv.setErrorLogger(AppLoggers.getLog("udp", errlog));
		
		UdpServerPlug servplug = (UdpServerPlug) plugobj;
		servplug.plugin(srv);
		
		srv.setNetExceptionHandle((e)->{
			srv.close();
			CalculatePool.queueUserWorkItem(()->{
				srv.restart();
			});
		});
		
		return srv;
	}
	
	public static void initPeriodTasks() throws Exception {
		HierarchicalMap[] tasks = ApplicationUtility.periodTasks();
		for(HierarchicalMap map : tasks){
			String periodclassstr = map.getAttributeAsString("class");
			Class periodclass = Class.forName(periodclassstr);
			Method method = periodclass.getMethod("schedule", long.class, long.class);
			long delay = map.getAttributeAsInt("delay") * 1000;
			long period = map.getAttributeAsInt("period") * 1000;
			method.invoke(null, delay, period);
		}
	}

	public static void initCronTasks() throws Exception{
		HierarchicalMap[] tasks = ApplicationUtility.cronTasks();
		for(HierarchicalMap map : tasks){
			String periodclassstr = map.getAttributeAsString("class");
			Class periodclass = Class.forName(periodclassstr);
			Method method = periodclass.getMethod("start", String.class);
			String pattern = map.getAttributeAsString("pattern");
			method.invoke(null, pattern);
		}
		
	}

}
