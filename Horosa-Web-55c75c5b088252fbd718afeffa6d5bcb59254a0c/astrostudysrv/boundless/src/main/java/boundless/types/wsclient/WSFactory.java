package boundless.types.wsclient;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class WSFactory {
	private static Map<String, WSClient> clients = new HashMap<String, WSClient>();
	
	public static void build(String configfile) {
		close();
		
		String json = FileUtility.getStringFromClassPath(configfile);
		List<ClientConfig> list = JsonUtility.decodeList(json, ClientConfig.class);
		for(ClientConfig config : list) {
			try {
				WSClient client = new WSClient(config.url, config.log, config.reconnectOnError, config.heartbeatPeriod, config.logData);
				client.setRSA(config.rsaModulus, config.rsaExp);
				if(!StringUtility.isNullOrEmpty(config.initPluginClass)) {
					Class cls = Class.forName(config.initPluginClass);
					Method method = cls.getMethod("build", WSClient.class);
					if(method != null) {
						method.invoke(null, client);
					}
				}
				boolean flag = client.connectBlock();
				if(flag) {
					clients.put(config.serverName, client);					
				}
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
	}
	
	public static WSClient getClient(String name) {
		return clients.get(name);
	}
	
	public static void close() {
		for(WSClient client : clients.values()) {
			try {
				client.close();
			}catch(Exception e) {
			}
		}
	}
	
	public static class ClientConfig{
		public String serverName;
		public String url;
		public String log;
		public boolean reconnectOnError;
		public String rsaModulus;
		public String rsaExp;
		public String initPluginClass;
		public boolean logData;
		public int heartbeatPeriod;
	}
}
