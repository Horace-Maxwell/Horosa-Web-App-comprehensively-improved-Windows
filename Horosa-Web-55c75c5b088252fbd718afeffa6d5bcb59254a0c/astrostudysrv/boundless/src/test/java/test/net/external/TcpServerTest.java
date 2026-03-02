package test.net.external;

import boundless.net.*;
import boundless.net.external.*;

public class TcpServerTest {
	public static void main(String args[]) throws Exception {
		ServerConfiguration config=new ServerConfiguration();
		config.serverId((short)1).serverName("test").port(8000);
		TcpServer server=new TcpServer(config,false);
		server.checkClientAlive(false);
		
		server.packetManager().registerHandler(1048576, (e)->{
			PacketWriter pw=new PacketWriter(1048576);
			pw.writeString("hello");
			e.sendAsync(pw);
		});
		
		System.in.read();
    }  
}
