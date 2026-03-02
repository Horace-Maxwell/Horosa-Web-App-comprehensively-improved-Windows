package boundless.net.client;

import java.io.IOException;
import java.net.*;
import java.nio.*;
import java.nio.channels.*;
import java.util.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.net.*;
import boundless.types.ExecutionGroup;

public class TcpClient {
	private static Logger globalLog = LoggerFactory.getLogger(TcpClient.class);
	
	private static ExecutionGroup _threadPool = new ExecutionGroup(1, "TcpClient");
	public static void shutdown(){
		_threadPool.close();
	}
	
	private Logger log;
	
	private SocketChannel _channel;
	private String _description;
	private ArrayList<IPacketEventListener> _listeners = new ArrayList<IPacketEventListener>();
	private ArrayList<ITcpListener> _tcpListeners = new ArrayList<ITcpListener>();
	private Selector _selector;
	private CircleReadThread _readThread;
	private CircleSendThread _sendThread;
	private TcpRequest _request;
	private PendingPacket _packet = new PendingPacket();
	private boolean _closing=false;
	private boolean _connected = false;

	public TcpClient() {
		this._request = new TcpRequest(this);
	}
	
	public void log(Logger log){
		this.log = log;
	}
	
	public Logger log(){
		if(log == null){
			log = globalLog;
		}
		return log;
	}

	/**
	 * 连接
	 * 
	 * @param ip
	 * @param port
	 */
	public void connect(String ip, int port) throws IOException{
		if(_connected){
			throw new IOException("already.connected");
		}
		
		this._connected = true;		
		this._closing=false;
		this._readThread = new CircleReadThread();
		this._sendThread=new CircleSendThread();
		
		_selector = Selector.open();

		// 打开Socket通道
		this._channel = SocketChannel.open();
		// 设置为非阻塞模式
		_channel.configureBlocking(false);
		// 连接
		_channel.connect(new InetSocketAddress(ip, port));
		// 注册连接服务端socket动作
		_channel.register(_selector, SelectionKey.OP_CONNECT);
		this._description = "ip:" + ip + ",port:" + port;

		_selector.select();
		Iterator<SelectionKey> iter = _selector.selectedKeys().iterator();
		while (iter.hasNext()) {
			SelectionKey key = iter.next();
			iter.remove();
			if (key.isConnectable() && _channel.finishConnect()) {
				_channel.register(_selector, SelectionKey.OP_READ);
				_readThread.start();
				_sendThread.start();
				return;
			}
		}

		_connected = false;
		throw new IOException("Connect error");
	}

	/**
	 * close the tcp connection
	 */
	public void close() {
		close(true);
	}

	private void close(boolean manual) {
		synchronized (this) {
			if (_closing) return;
			_closing=true;
		}
		
		if (_readThread != null) _readThread.stop();
		if (_sendThread != null) _sendThread.stop();
		
		try {
			if (_channel != null)
				_channel.close();
		} catch (Exception ex) {
			ex.printStackTrace();
		}

		try {
			if (_selector != null)
				_selector.close();
		} catch (Exception ex) {
			ex.printStackTrace();
		}

		if (manual) return;
		synchronized (_tcpListeners) {
			for (ITcpListener ls : _tcpListeners) {
				ls.onClose();
			}
		}
	}

	/**
	 * send a packet to server
	 * @param pw a PacketWriter object as a packet to be sent
	 */
	public void send(PacketWriter pw) {
		send(pw,null);
	}
	
	/**
	 * send a packet to server 
	 * @param pw a PacketWriter object as a packet to be sent
	 * @param callback a Runnable object that will be executed when finishing sending the packet pw
	 */
    public void send(PacketWriter pw,Runnable callback) {
		_sendThread.add(pw, callback);
	}

	/**
	 * 请求并得到响应
	 * 
	 * @param pw
	 *            请求包
	 * @return 响应包
	 */
	public PacketReader request(PacketWriter pw) throws IOException {
		return _request.send(pw);
	}

	/**
	 * send a request to server synchronously
	 * @param pw a packet that will be sent to server
	 * @param timeout request timeout
	 * @return a PacketReader object as a response from server
	 * @throws IOException
	 */
	public PacketReader request(PacketWriter pw, long timeout) throws IOException {
		return _request.send(pw, timeout);
	}

	/**
	 * 
	 * @param ls
	 *            在非UI线程里执行
	 */
	public void addListener(IPacketEventListener ls) {
		synchronized (_listeners) {
			_listeners.add(ls);
		}
	}

	public void removeListener(IPacketEventListener ls) {
		synchronized (_listeners) {
			_listeners.remove(ls);
		}
	}

	/**
	 * 
	 * @param ls
	 *            在非UI线程里执行
	 */
	public void addListener(ITcpListener ls) {
		synchronized (_tcpListeners) {
			_tcpListeners.add(ls);
		}
	}

	public void removeListener(ITcpListener ls) {
		synchronized (_tcpListeners) {
			_tcpListeners.remove(ls);
		}
	}

	public void clearListeners() {
		synchronized (_listeners) {
			_listeners.clear();
		}

		synchronized (_tcpListeners) {
			_tcpListeners.clear();
		}
		
	}
	

	private class CircleReadThread {
		// 打开选择器
		private boolean _actived = true;
		private ByteBuffer _buffer;// 字节缓冲区
		private Thread _thread;

		public void start() {
			_thread = new java.lang.Thread(new Runnable() {
				public void run() {
					CircleReadThread.this.run();
				}
			});
			_thread.start();
		}

		public void stop() {
			_actived = false;
		}

		private void run() {
			try {
				_buffer = ByteBuffer.allocate(10 * 1024);
				while (_actived) {
					_selector.select();
					if (!_actived) break;
					Iterator<SelectionKey> iter = _selector.selectedKeys().iterator();
					while (iter.hasNext()) {
						SelectionKey key = iter.next();
						iter.remove();
						handleKey(key);
					}
				}
			} catch (Exception ex) {
				_actived = false;
				ex.printStackTrace();
			}
			close(false);
		}

		private void handleKey(SelectionKey key) throws IOException {
			if (key.isReadable()){
				handleReceive(key);
			}
		}

		private void handleReceive(SelectionKey key) throws IOException {
			// 读信息
			SocketChannel channel = (SocketChannel) key.channel();
			_buffer.rewind();
			int count = channel.read(_buffer);
			if (count > 0) {
				// _buffer.flip();
				// receive(_buffer, 0, count);
				_packet.receive(_buffer.array(), 0, count);
			} else if (count < 0) {
				// 服务端已经断开
				close(false);
			}

			_buffer.clear();// 清空缓冲区
		}
	}

	private class CircleSendThread {
		private boolean _actived = true;
		private Queue<SendingItem> _sendingQueue = new LinkedList<SendingItem>();
		private Thread _thread;

		public void start() {
			_thread = new java.lang.Thread(new Runnable() {
				public void run() {
					CircleSendThread.this.run();
				}
			});
			_thread.start();
		}

		public void stop() {
			_actived = false;
		}

		private void run() {
			try {
				while (_actived) {
					SendingItem item=null;
					synchronized (_sendingQueue) {
						item=_sendingQueue.peek();
					}
					
					while (item!=null && item._buffer.hasRemaining()) {
						_channel.write(item._buffer);
						if (!item._buffer.hasRemaining()) break; 
						Thread.sleep(100);
					}
					
					if (item!=null) {
						synchronized (_sendingQueue) {
							_sendingQueue.poll();
						}
						if (item._callback!=null) _threadPool.execute(item._callback);
					} else {
						Thread.sleep(100);
					}
				}
			} catch (Exception ex) {
				_actived = false;
				ex.printStackTrace();
			}
			close(false);
		}
		
		public void add(PacketWriter pw,Runnable callback) {
			SendingItem item=new SendingItem();
			item._buffer=ByteBuffer.wrap(pw.outputData());
			item._callback=callback;
			synchronized (_sendingQueue) {
				_sendingQueue.add(item);
			}
		}
		
		private class SendingItem{
		    ByteBuffer _buffer;
		    Runnable _callback;
		}
	}
	
	private class PendingPacket {
		private byte[] _buffer = new byte[3];
		private int _position = 0;
		private int _length = -1;

		public void receive(byte[] data, int offset, int dataLength) {
			int index = offset;

			if (_length == -1) {
				while (_position < _buffer.length && index < dataLength) {
					_buffer[_position] = data[index];
					_position++;
					index++;
				}

				// 已接收完头
				if (_position >= _buffer.length) {
					_length = (StreamReader.toInt(_buffer[0]) << 16)
							+ (StreamReader.toInt(_buffer[1]) << 8)
							+ StreamReader.toInt(_buffer[2]);
				} else {
					return;
				}

				byte[] newBuffer = new byte[_length];
				System.arraycopy(_buffer, 0, newBuffer, 0, _buffer.length);
				_buffer = newBuffer;
			}

			int balanceLen = _length - _position;
			if (balanceLen > (dataLength - index))
				balanceLen = (dataLength - index);

			System.arraycopy(data, index, _buffer, _position, balanceLen);
			_position += balanceLen;
			index += balanceLen;

			if (_position < _length)
				return;

			try {
				PacketEvent e = new PacketEvent(new PacketReader(_buffer),
						TcpClient.this);
				synchronized (_listeners) {
					for (int i = 0; i < _listeners.size(); i++) {
						IPacketEventListener ls = _listeners.get(i);
						int attenId = ls.getAttentionId();
						if (attenId < 0 || attenId == e.packetId()) {
							e.reset();
							ls.recevie(e);
						}
					}
				}
			} catch (Exception ex) {
				TcpClient.this.log().error("RaiseReceivePacket error,client:{}", TcpClient.this._description);
				ex.printStackTrace();
			}

			_buffer = new byte[3];
			_position = 0;
			_length = -1;

			if (index < dataLength)
				receive(data, index, dataLength);
		}
	}
}
