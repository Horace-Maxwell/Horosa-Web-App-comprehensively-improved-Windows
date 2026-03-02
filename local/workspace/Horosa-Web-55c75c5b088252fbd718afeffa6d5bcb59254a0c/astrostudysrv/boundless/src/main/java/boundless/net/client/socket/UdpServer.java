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

import org.slf4j.Logger;

import boundless.log.QueueLog;
import boundless.netty.BasePacketIds;
import boundless.netty.Datagram;
import boundless.types.bytesbuf.UdpPacketDecoder;
import boundless.utility.StringUtility;

public class UdpServer {
	private static final int MAX_SIZE = 1000;
	private static final int SLEEPMS = 500;
	
	private Logger logger;
	private Logger errorLogger;

	private DatagramSocket socket;
	private int broadPort;
	private UdpPacketDecoder packetDecoder;

	private CircleReadThread readThread;
	private CircleSendThread sendThread;
	private WorkerThread workerThread;

	private boolean closing=false;
	private boolean listened = false;
	private boolean restarting = false;
	
	private Map<Integer, CommandHandle> cmdHandleMap;
	private NetExceptionHandle exceptionHandler;
	private boolean handlingNetException = false;
	
	private boolean tracePacket = false;
	
	private String selfPrivateExp;
	private String selfModulus;
	private String selfPublicExp;
	private String clientPublicExp;
	private String clientModulus;
	private boolean useRSA = false;
	private boolean inverseRSA = true;
	
	public UdpServer(UdpPacketDecoder packetDecoder){
		this.packetDecoder = packetDecoder;
		this.cmdHandleMap = new HashMap<Integer, CommandHandle>();
	}
	
	public void setUseRSA(boolean value){
		this.useRSA = value;
	}
	
	public void setInverseRSA(boolean value){
		this.inverseRSA = value;
	}
	
	public void setSelfPrivateExp(String selfPrivateExp) {
		this.selfPrivateExp = selfPrivateExp;
	}

	public void setSelfModulus(String selfModulus) {
		this.selfModulus = selfModulus;
	}

	public void setSelfPublicExp(String selfPublicExp) {
		this.selfPublicExp = selfPublicExp;
	}

	public void setClientPublicExp(String clientPublicExp) {
		this.clientPublicExp = clientPublicExp;
	}

	public void setClientModulus(String clientModulus) {
		this.clientModulus = clientModulus;
	}

	public void setLogger(Logger logger){
		this.logger = logger;
		this.packetDecoder.setLogger(logger);
	}
	public void setErrorLogger(Logger errlog){
		this.errorLogger = errlog;
		this.packetDecoder.setErrorLogger(errlog);
	}

	public boolean isTracePacket(){
		return this.tracePacket;
	}
	public void setTracePacket(boolean value){
		this.tracePacket = value;
	}

	public void registerPacketHandle(int packetNo, CommandHandle handle){
		this.cmdHandleMap.put(packetNo, handle);
	}
	
	public void restart(){
		synchronized(this){
			if(this.restarting || this.isListenning()){
				return;
			}
			this.restarting = true;
		}
		this.close();
		try{
			Thread.sleep(1000);
		}catch(Exception e){
		}
		while(this.restarting){
			try{
				this.listen(this.broadPort);
				break;
			}catch(Exception e){
				if(errorLogger != null){
					QueueLog.error(errorLogger, e);
				}else{
					e.printStackTrace();
				}
				try{
					Thread.sleep(5000);
				}catch(Exception er){
				}
			}
		}
		
		synchronized(this){
			this.restarting = false;
		}
	}

	public void listen(int broadport) throws Exception{
		if(listened){
			throw new IOException("already.listen.on.port." + broadport);
		}
		this.broadPort = broadport;
		
		this.socket = new DatagramSocket(broadPort);
		
		this.readThread = new CircleReadThread();
		this.workerThread = new WorkerThread();
		this.sendThread = new CircleSendThread();
		
		this.sendThread.start();
		this.workerThread.start();
		this.readThread.start();

		this.listened = true;		
		this.closing=false;
		
	}
	
	public boolean isListenning(){
		return listened;
	}

	public void close() {
		close(true);
	}
	
	private void close(boolean manual) {
		synchronized (this) {
			if (closing || !listened){
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
			if(errorLogger != null){
				QueueLog.error(errorLogger, ex);
			}else{
				ex.printStackTrace();
			}
		}

		listened = false;
	}
	
	public void send(Datagram data){
		String clientIp = data.getIp();
		if(clientIp == null){
			return;
		}
		
		this.sendThread.add(data);
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
				if(errorLogger != null){
					QueueLog.error(errorLogger, err);
				}else{
					err.printStackTrace();
				}
			}
		}else{
			if(errorLogger != null){
				QueueLog.error(errorLogger, e);
			}else{
				e.printStackTrace();
			}
		}

	}
	
	private void handleReceivedPacket(List<Datagram> packets){
		for(Datagram datagram : packets){
			Datagram tmpdata = datagram;
			try{
				if(datagram.command() == BasePacketIds.SSLPacket){
					tmpdata = datagram.decodeRSA(selfModulus, selfPrivateExp);
				}
				int cmdno = tmpdata.command();
				CommandHandle callback = cmdHandleMap.get(cmdno);
				if(callback != null){
					Handler handle = new Handler(callback, tmpdata);
					this.workerThread.add(handle);
				}else{
					if(logger != null){
						QueueLog.info(logger, "do nothing, since no handle for packet-0x{}", Integer.toString(cmdno, 16));
					}else{
						System.out.println("do nothing, since no handle for packet-0x" + Integer.toString(cmdno, 16));
					}
				}
			}catch(Exception e){
				if(errorLogger != null){
					QueueLog.error(errorLogger, e);
				}else{
					e.printStackTrace();
				}
			}
		}
	}
	
	private class Handler implements Runnable{
		private CommandHandle callback;
		private Datagram datagram;
		
		public Handler(CommandHandle callback, Datagram datagram){
			this.callback = callback;
			this.datagram = datagram;
		}
		@Override
		public void run() {
			callback.accept(datagram);
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
							if(errorLogger != null){
								QueueLog.error(errorLogger, e);
							}else{
								e.printStackTrace();
							}
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
						QueueLog.error(errorLogger, e);
					}
										
					try{
						if (handle != null) {
							handle.run();
						}
					}catch(Exception e){
						if(errorLogger != null){
							QueueLog.error(errorLogger, e);
						}else{
							e.printStackTrace();
						}
					}
				}
			} catch (Exception ex) {
				ex.printStackTrace();
				actived = false;
			}
			handleQueue.clear();
		}
		
		public void add(Runnable handle) {
			synchronized (handleQueue) {
				if(count > MAX_SIZE){
					if(errorLogger != null){
						QueueLog.error(errorLogger, "not add work-task, tasks are too many. sizeOfTasks={}", count);
					}else{
						System.out.println("not add work-task, tasks are too many. sizeOfTasks=" + count);
					}
					return;
				}
				handleQueue.add(handle);
				count++;
				handleQueue.notifyAll();
			}
		}
	}
	
	private class CircleSendThread {
		private Boolean actived = false;
		private Queue<Datagram> sendingQueue = new LinkedList<Datagram>();
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
					Datagram datagram = null;
					byte[] item = null;
					try{
						synchronized (sendingQueue) {
							datagram = sendingQueue.poll();
							if(datagram != null){
								count--;
							}else{
								sendingQueue.wait(SLEEPMS);
							}
						}
					}catch(Exception e){
						QueueLog.error(errorLogger, e);
					}
										
					if (datagram != null) {
						if(useRSA){
							if(inverseRSA){
								item = datagram.encodeRSA(selfModulus, selfPrivateExp);
							}else{
								item = datagram.encodeRSA(clientModulus, clientPublicExp);
							}
						}else{
							item = datagram.getAllRawData();
						}
						DatagramPacket packet = new DatagramPacket(item, item.length);
						InetAddress addr = InetAddress.getByName(datagram.getIp());
						packet.setAddress(addr);
						packet.setPort(datagram.getPort());
						socket.send(packet);
						
						if(tracePacket){
							String msg = String.format("UDPTX: %s", StringUtility.toHex(item));
							if(logger != null){
								QueueLog.debug(logger, msg);
							}else{
								System.out.println(msg);
							}
						}else{
							String tx = String.format("UDPTX: command:0x%04X, dec:%d, length:%d, to: %s:%d", datagram.command(), datagram.command(), item.length, datagram.getIp(), datagram.getPort());
							if(logger == null){
								System.out.println(tx);
							}else{
								QueueLog.debug(logger, tx);
							}
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
					String msg = String.format("size of sendQueue is too many, sizeOfQueue=%d, datagram will be rejected, no sending for datagram:0x%s", 
							count, pktid);
					if(errorLogger != null){
						QueueLog.error(errorLogger, msg);
					}else{
						System.out.println(msg);
					}
					return;
				}
				
				sendingQueue.add(datagram);
				count++;
				if(count > MAX_SIZE){
					if(errorLogger != null){
						QueueLog.error(errorLogger, "size of sendQueue is too many, sizeOfQueue={}", count);
					}else{
						System.out.println("size of sendQueue is too many, sizeOfQueue=" + count);
					}
				}
				sendingQueue.notifyAll();
			}
		}
		
	}


}
