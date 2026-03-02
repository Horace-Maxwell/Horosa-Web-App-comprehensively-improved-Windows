package boundless.net.client.socket;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;

import boundless.netty.BasePacketIds;
import boundless.netty.Datagram;
import boundless.types.bytesbuf.UdpPacketDecoder;
import boundless.utility.StringUtility;

public class UdpClient {
	private static final int MAX_SIZE = 1000;
	private static final int SLEEPMS = 500;

	private DatagramSocket socket;
	private InetAddress broadAddr;
	private int broadPort;

	private CircleReadThread readThread;
	private CircleSendThread sendThread;
	private WorkerThread workerThread;

	private boolean closing=false;
	private boolean connected = false;
	private NetExceptionHandle exceptionHandler;
	private boolean handlingNetException = false;

	private boolean tracePacket = false;
	private int callbackCounter = 0;

	private UdpPacketDecoder packetDecoder;
	private Map<Integer, ResponseCallback> callbackMap;
	private Map<Integer, ResponseCallback> cmdHandleMap;
	private ResponseCallback defaultPacketHandle;

	private boolean useRSA = false;
	private boolean inverseRSA = true;
	
	public UdpClient(UdpPacketDecoder packetDecoder){
		this.packetDecoder = packetDecoder;
		this.callbackMap = new HashMap<Integer, ResponseCallback>();
		this.cmdHandleMap = new HashMap<Integer, ResponseCallback>();
	}
	
	public void setUseRSA(boolean value){
		this.useRSA = value;
	}
	
	public void setInverseRSA(boolean value){
		this.inverseRSA = value;
	}
	
	public boolean isTracePacket(){
		return this.tracePacket;
	}
	public void setTracePacket(boolean value){
		this.tracePacket = value;
	}

	public void registerPacketHandle(int cmd, ResponseCallback callback){
		this.cmdHandleMap.put(cmd, callback);
	}

	public void setDefaultPacketHandle(ResponseCallback handle){
		this.defaultPacketHandle = handle;
	}

	public void connect(String broadIp, int broadport) throws Exception{
		if(connected){
			throw new IOException("already.connected");
		}
		this.broadAddr = InetAddress.getByName(broadIp);
		this.broadPort = broadport;
		
		this.socket = new DatagramSocket();
		
		this.connected = true;		
		this.closing=false;
		
		this.readThread = new CircleReadThread();
		this.sendThread = new CircleSendThread();
		this.workerThread = new WorkerThread();
		
		this.readThread.start();
		this.sendThread.start();
		this.workerThread.start();
	}
	
	public boolean isConnected(){
		return connected;
	}
	
	public void send(Datagram data){
		send(data, null);
	}
	
	public void send(Datagram data, ResponseCallback callback){
		if(data == null || sendThread == null || !connected){
			return;
		}
		
		if(callback != null){
			int cbno = ++callbackCounter;
			if(cbno == 0){
				cbno++;
				callbackCounter++;
			}
			data.setCallbackno(cbno);
			callbackMap.put(cbno, callback);
		}
		sendThread.add(data);
	}

	public void close() {
		close(true);
	}
	
	private void close(boolean manual) {
		synchronized (this) {
			if (closing || !connected){
				return;
			}
			closing=true;
		}
		
		if (sendThread != null){
			sendThread.stop();
			sendThread = null;
		}
		if (readThread != null){
			readThread.stop();
			readThread = null;
		}
		if(workerThread != null){
			workerThread.stop();
			workerThread = null; 
		}
		
		try {
			if (socket != null){
				socket.close();
				socket = null;
			}
		} catch (Exception ex) {
			ex.printStackTrace();
		}

		connected = false;
	}

	public void setNetExceptionHandle(NetExceptionHandle handle){
		this.exceptionHandler = handle;
	}
	
	private void treatNetException(Exception e){
		synchronized(this){
			if(handlingNetException){
				return;
			}
			handlingNetException = true;
		}
		if(exceptionHandler != null){
			try{
				exceptionHandler.handle(e);
			}catch(Exception err){
				err.printStackTrace();
			}
		}else{
			e.printStackTrace();
		}

	}

	private void handleReceivedPacket(List<Datagram> packets){
		for(Datagram datagram : packets){
			Datagram tmpdata = datagram;
			try{
				if(datagram.command() == BasePacketIds.SSLPacket){
					if(inverseRSA){
						tmpdata = datagram.decodeRSA(CommRSASetup.modulus, CommRSASetup.publicExp);
					}else{
						tmpdata = datagram.decodeRSA(CommRSASetup.selfModulus, CommRSASetup.selfPrivateExp);
					}
				}
				int cbno = tmpdata.getCallbackno();
				ResponseCallback callback = callbackMap.remove(cbno);
				if(callback != null && cbno != 0){
					Handler handle = new Handler(callback, tmpdata);
					this.workerThread.add(handle);
				}else{
					ResponseCallback cmdhandle = cmdHandleMap.get(tmpdata.command());
					if(cmdhandle != null){
						Handler handle = new Handler(cmdhandle, tmpdata);
						this.workerThread.add(handle);
					}else if(this.defaultPacketHandle != null){
						Handler handle = new Handler(defaultPacketHandle, tmpdata);
						this.workerThread.add(handle);
					}
				}
			}catch(Exception e){
				e.printStackTrace();
			}
		}
	}
	
	private class Handler implements Runnable{
		private ResponseCallback callback;
		private Datagram datagram;
		
		public Handler(ResponseCallback callback, Datagram datagram){
			this.callback = callback;
			this.datagram = datagram;
		}
		@Override
		public void run() {
			callback.callback(datagram);
		}
	}


	private class CircleSendThread {
		private Boolean actived = false;
		private Queue<byte[]> sendingQueue = new LinkedList<byte[]>();
		private Thread thread;
		private int count = 0;

		public void start() {
			synchronized(actived){
				if(actived){
					return;
				}
				actived = true;
			}
			thread = new java.lang.Thread(new Runnable() {
				@Override
				public void run() {
					CircleSendThread.this.run();
				}
			});
			count = 0;
			thread.start();
		}

		public void stop() {
			actived = false;
		}

		private void run() {
			try {
				while (actived) {
					byte[] item = null;
					try{
						synchronized (sendingQueue) {
							item = sendingQueue.poll();
							if(item != null){
								count--;
							}else{
								sendingQueue.wait(SLEEPMS);
							}
						}
					}catch(Exception e){
						e.printStackTrace();
					}
										
					if (item != null) {
						DatagramPacket packet = new DatagramPacket(item, item.length);
						packet.setAddress(broadAddr);
						packet.setPort(broadPort);
						socket.send(packet);
						
						if(tracePacket){
							String msg = String.format("UDPTX: %s", StringUtility.toHex(item));
							System.out.println(msg);
						}
					}
				}
			} catch (Exception ex) {
				actived = false;
				
				close(false);
				sendingQueue.clear();
				treatNetException(ex);
				return;
			}
			
			close(false);
			sendingQueue.clear();
		}
		
		public void add(Datagram datagram) {
			synchronized (sendingQueue) {
				if(count >= MAX_SIZE*2){
					String pktid = Integer.toString(datagram.command(), 16);
					String msg = "size of sendQueue is too many, sizeOfQueue=" + count;
					msg = msg + ", datagram will be rejected, no sending for datagram:0x" + pktid;
					System.out.println(msg);
					return;
				}
				
				byte[] data;
				if(useRSA){
					data = datagram.encodeRSA(CommRSASetup.modulus, CommRSASetup.publicExp);
				}else{
					data = datagram.getAllRawData();
				}
				sendingQueue.add(data);
				count++;
				if(count > MAX_SIZE){
					System.out.println("size of sendQueue is too many, sizeOfQueue=" + count);
				}
				
				sendingQueue.notifyAll();
			}
		}
		
	}

	private class CircleReadThread {
		private Boolean actived = false;
		private Thread thread;

		public void start() {
			synchronized(actived){
				if(actived){
					return;
				}
				actived = true;
			}
			thread = new java.lang.Thread(new Runnable() {
				@Override
				public void run() {
					CircleReadThread.this.run();
				}
			});
			thread.start();
		}

		public void stop() {
			actived = false;
		}

		private void run() {
			try {
				while (actived) {
					byte[] buf = new byte[204800];
					DatagramPacket packet = new DatagramPacket(buf, buf.length);
					socket.receive(packet);
					if(packet.getLength() > 0){
						List<Datagram> list = new LinkedList<Datagram>();
						try{
							packetDecoder.decode(packet, list, tracePacket);
							if(!list.isEmpty()){
								handleReceivedPacket(list);
							}
						}catch(Exception e){
							e.printStackTrace();
						}
					}
				}
			} catch (Exception ex) {
				actived = false;
				close(false);

				treatNetException(ex);
				return;
			}
			close(false);
		}

	}

	
	private class WorkerThread{
		private Boolean actived = false;
		private Queue<Runnable> handleQueue = new LinkedList<Runnable>();
		private Thread thread;
		private int count = 0;

		public void start() {
			synchronized(actived){
				if(actived){
					return;
				}
				actived = true;
			}
			thread = new java.lang.Thread(new Runnable() {
				@Override
				public void run() {
					WorkerThread.this.run();
				}
			});
			count = 0;
			thread.start();
		}

		public void stop() {
			actived = false;
		}

		private void run() {
			try {
				while (actived) {
					Runnable handle = null;
					try{
						synchronized (handleQueue) {
							handle = handleQueue.poll();
							if(handle != null){
								count--;
							}else{
								handleQueue.wait(SLEEPMS);
							}
						}
					}catch(Exception e){
						e.printStackTrace();
					}
										
					try{
						if (handle != null) {
							handle.run();
						}
					}catch(Exception e){
						e.printStackTrace();
					}
				}
			} catch (Exception ex) {
				actived = false;
			}
			handleQueue.clear();
		}
		
		public void add(Runnable handle) {
			synchronized (handleQueue) {
				if(count > MAX_SIZE){
					System.out.println("not add work-task, tasks are too many. sizeOfTasks=" + count);
					return;
				}
				handleQueue.add(handle);
				count++;
				
				handleQueue.notifyAll();
			}
		}
	}
	
}
