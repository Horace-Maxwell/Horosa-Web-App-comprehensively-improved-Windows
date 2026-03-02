package boundless.netty;

import java.util.List;

import boundless.console.ApplicationUtility;
import boundless.io.FileUtility;
import boundless.program.Servers;
import boundless.utility.JsonUtility;

public class UdpServerInit {
	
	private static String jsonpath = "data/udpservers.json";
	
	synchronized public static void build() {
		String cnfFile = ApplicationUtility.getAppPath() + "data/udpservers.json";
		String json = null;
		if(FileUtility.exists(cnfFile)) {
			json = FileUtility.getStringFromFile(cnfFile);
		}else {
			json = FileUtility.getStringFromClassPath(jsonpath);			
		}
		List<BroadcastConfig> list = JsonUtility.decodeList(json, BroadcastConfig.class);
		for(BroadcastConfig config : list) {
			NettyUDPServer serv = new NettyUDPServer(config);
			int srvid = config.broadcastId();
			if(Servers.getNettyUDPServer(srvid) != null) {
				throw new RuntimeException("udpserver.existed");
			}
			Servers.put(srvid, serv);
			serv.run();			
		}

	}
	

	
}
