package test.netty;

import java.util.Timer;
import java.util.TimerTask;

import boundless.netty.Datagram;
import boundless.netty.DiscardDecoder;
import boundless.netty.DummyDatagram;
import boundless.netty.NettyUDPBroadcaster;
import boundless.netty.NettyUDPServer;
import boundless.netty.UDPDiscardDecoder;
import boundless.utility.CalculatePool;

public class BroadcastTest2 {
	private static Datagram data = new DummyDatagram(new byte[]{0x30});
	private static NettyUDPServer broadcaster = new NettyUDPServer(10000, UDPDiscardDecoder.class);


	public static void main(String[] args){
		broadcaster.run();
		CalculatePool.queueUserWorkItem(()->{
			while(true){
				try {
					Thread.sleep(1000);
				} catch (Exception e1) {
				}
			}
		}, (e)->{
			e.printStackTrace();
		});
	}
	
}
