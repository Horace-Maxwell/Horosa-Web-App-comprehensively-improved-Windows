package test.netty;

import java.util.Timer;
import java.util.TimerTask;

import boundless.netty.Datagram;
import boundless.netty.DiscardDecoder;
import boundless.netty.DummyDatagram;
import boundless.netty.NettyUDPBroadcaster;
import boundless.netty.UDPDiscardDecoder;
import boundless.utility.PeriodTask;

public class BroadcastTest {
	private static Datagram data = new DummyDatagram(new byte[]{0x30});
	private static NettyUDPBroadcaster broadcaster = new NettyUDPBroadcaster(10000);

	private static TimerTask serverStateTask = new TimerTask(){
		@Override
		public void run() {
			try{
				broadcaster.broadcast(data);
			}catch(Exception e){
				e.printStackTrace();
			}
		}
		
	};
	
	public static void main(String[] args){
		try{
			broadcaster.run();
			PeriodTask.submit(serverStateTask, 1000, 2000);
		}catch(Exception e){
			e.printStackTrace();
		}
	}
	
}
