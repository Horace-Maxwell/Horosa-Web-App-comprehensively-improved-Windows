package boundless.netty;

import java.util.List;

import boundless.console.ApplicationUtility;
import boundless.io.FileUtility;
import boundless.net.external.ServerConfiguration;
import boundless.program.Servers;
import boundless.utility.JsonUtility;

public class WebSocketServerInit {
	
	private static String jsonpath = "data/wsservers.json";
	
	synchronized public static void build() {
		String cnfFile = ApplicationUtility.getAppPath() + "data/wsservers.json";
		String json = null;
		if(FileUtility.exists(cnfFile)) {
			json = FileUtility.getStringFromFile(cnfFile);
		}else {
			json = FileUtility.getStringFromClassPath(jsonpath);			
		}
		List<ServerConfiguration> list = JsonUtility.decodeList(json, ServerConfiguration.class);
		for(ServerConfiguration config : list) {
			InnerWebSocketServer serv = new InnerWebSocketServer(config);
			int srvid = config.serverId();
			if(Servers.getServer(srvid) != null) {
				throw new RuntimeException("wsserver.existed");
			}
			Servers.put(srvid, serv);
			serv.run();			
		}

	}
	

	
}
