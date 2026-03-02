package test.network;

import java.text.DecimalFormat;
import java.util.LinkedList;
import java.util.Queue;

import boundless.net.PacketWriter;
import boundless.net.external.ServerConfiguration;
import boundless.net.internal.ClientConfiguration;
import boundless.net.internal.InternalPacketWriter;
import boundless.net.internal.TcpInternalClient;
import boundless.threading.ITicker;
import boundless.threading.TickThread;

public class TcpChannelTest extends TickThread {
	private static TcpChannelTest _program;
	private static DecimalFormat _df = new DecimalFormat("#,###,###,###,###,###,###,###,##0.00");

	
	public static void main(String[] args){
		
		_program = new TcpChannelTest();
		
		ServerConfiguration servconfig = new ServerConfiguration();
		servconfig.serverId((short)101).port(7003).serverName("internal").serverType((byte)2);
		
		ClientConfiguration config = new ClientConfiguration((short)100, "127.0.0.1", 5000);
		TcpInternalClient[] clients = new TcpInternalClient[]{
				new TcpInternalClient(config, servconfig)
			};
		for(TcpInternalClient c : clients){
			_program.addTicker(new ITicker(){
				@Override
				public void tick() {
					c.tick();
				}
			});
		}
		
		_program.start();

		try {
			Thread.sleep(5000);
		} catch (InterruptedException e) {

		}
		
		int tsize = clients.length;
		TestThread[] senders = new TestThread[tsize];
		for(int i=0; i<tsize; i++){
			int idx = i % clients.length;
			senders[i] = new TestThread(clients[idx], i, idx);
			senders[i].start();
		}

		long cnt = 0;
		long sz = 0;
		long n = 0;
		while(n<10000){
			PacketWriter pw = new PacketWriter(1048576);
			pw.write(new byte[1024*50]);
			InternalPacketWriter ipw = new InternalPacketWriter(102);
			ipw.communicationWriter(pw);
			int idx = (int) cnt % senders.length;
			senders[idx].send(ipw);
			sz += ipw.communicationWriter().length();
			System.out.println("loop " + n + "\ttime:" + System.currentTimeMillis() + ", generate total size: " + _df.format(sz));
			cnt++;
			if(cnt < 0){
				cnt = 0;
			}
			n++;
			try {
				Thread.sleep(1);
			} catch (InterruptedException e) {

			}
		}
		
		while(true){
			try {
				Thread.sleep(1);
			} catch (InterruptedException e) {

			}
		}
	}
	
	
	private static class TestThread extends Thread {
		private long packCnt = 0;
		private TcpInternalClient client;
		private int id;
		private int clientNo;
		private Queue<InternalPacketWriter> _list = new LinkedList<InternalPacketWriter>();
		
		public TestThread(TcpInternalClient client, int n, int clientNo){
			this.client = client;
			this.id = n;
			this.clientNo = clientNo;
		}

		@Override
		public void run() {
			while(true){
				synchronized(_list){
					while(!_list.isEmpty()){
						InternalPacketWriter ipw = _list.poll();
						if(ipw == null){
							System.out.println("ipw is null");
						}
						packCnt++;
						System.out.println("poll packet count:" + packCnt);
						this.client.sendAsync(ipw);
						try {
							Thread.sleep(1);
						} catch (InterruptedException e) {

						}
					}
				}
				
				try {
					Thread.sleep(1);
				} catch (InterruptedException e) {

				}
			}
		}
		
		public void send(InternalPacketWriter ipw){
			synchronized(_list){
				_list.offer(ipw);
			}
			
		}
		
	}
	
}
