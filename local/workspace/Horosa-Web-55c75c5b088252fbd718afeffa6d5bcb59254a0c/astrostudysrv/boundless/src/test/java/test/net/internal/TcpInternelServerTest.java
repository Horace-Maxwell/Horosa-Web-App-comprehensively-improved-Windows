package test.net.internal;

import java.text.DecimalFormat;

import boundless.console.ApplicationUtility;
import boundless.net.external.ServerConfiguration;
import boundless.net.internal.TcpInternalServer;
import boundless.threading.TickThread;

public class TcpInternelServerTest {
	private static long cnt = 0;
	private static DecimalFormat _df = new DecimalFormat("#,###,###,###,###,##0.00");

	public static void main(String[] args) {
		ServerConfiguration config = new ServerConfiguration();
		config.serverId((short)100).port(5000).serverName("center").serverType((byte)1);
		TcpInternalServer server = new TcpInternalServer(config);
		server.packetManager().registerHandler(102, (e)->{
			try {
				cnt += e.reader().communicationReader().length();
				System.out.println(System.currentTimeMillis() + " receive total size:" + _df.format(cnt));
			} catch (Exception e1) {
				System.out.println(e1.getMessage());
			}
		});
	}

}
