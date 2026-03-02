package test.netty;

import boundless.netty.DiscardDecoder;
import boundless.netty.DummyDatagram;
import boundless.netty.NettyClient;

public class NettyClientTest {

	public static void main(String[] args){
		NettyClient client = new NettyClient("127.0.0.1", 7530, DiscardDecoder.class);
		client.connect();
		
		DummyDatagram data = new DummyDatagram(new byte[]{ 0x30 });
		
		for(int i=0; i<10; i++){
			boolean res = client.syncSend(data);
//			boolean res = IPUtility.isReachable("127.0.0.1", "127.0.0.1", 7530, 10000);
			System.out.println(res);
		}
		
	}
	
}
