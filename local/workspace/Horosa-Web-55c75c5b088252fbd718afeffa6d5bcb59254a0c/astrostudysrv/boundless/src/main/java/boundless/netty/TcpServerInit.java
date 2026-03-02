package boundless.netty;

import java.util.List;

import boundless.console.ApplicationUtility;
import boundless.io.FileUtility;
import boundless.net.external.ServerConfiguration;
import boundless.program.Servers;
import boundless.utility.JsonUtility;

public class TcpServerInit {
	
	private static String jsonpath = "data/tcpservers.json";
	
	synchronized public static void build() {
		String cnfFile = ApplicationUtility.getAppPath() + "data/tcpservers.json";
		String json = null;
		if(FileUtility.exists(cnfFile)) {
			json = FileUtility.getStringFromFile(cnfFile);
		}else {
			json = FileUtility.getStringFromClassPath(jsonpath);			
		}
		List<ServerConfiguration> list = JsonUtility.decodeList(json, ServerConfiguration.class);
		for(ServerConfiguration config : list) {
			InnerClusterServer serv = new InnerClusterServer(config);
			int srvid = config.serverId();
			if(Servers.getServer(srvid) != null) {
				throw new RuntimeException("tcpserver.existed");
			}
			Servers.put(srvid, serv);
			serv.run();			
		}

	}
	

	
}
