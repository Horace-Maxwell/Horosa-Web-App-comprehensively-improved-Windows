package boundless.netty;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.log.QueueLog;
import boundless.types.ExecutionGroup;

public class UDPClient {
	private static Logger log = LoggerFactory.getLogger(UDPClient.class);
	
	private static ExecutionGroup executor = null;
	static{
		executor = new ExecutionGroup(1);
		executor.setGroupName("UDPClient");
	}
	
	public static void shutdown(){
		executor.close();
	}
	
	private DatagramSocket socket = null;
	private int udpPort;
	
	public UDPClient(int port){
		try{
			this.udpPort = port;
			this.socket = new DatagramSocket();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public void send(Datagram data, String destip){
		executor.execute(()->{
			try{
				byte[] buf = data.getAllRawData();
				InetAddress address = InetAddress.getByName(destip);
				DatagramPacket packet = new DatagramPacket(buf, buf.length, address, this.udpPort);
				this.socket.send(packet);
			}catch(Exception e){
				QueueLog.error(log, e);
				throw new RuntimeException(e);
			}
		});
	}
	
}
