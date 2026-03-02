package boundless.netty;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.SocketChannel;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.types.ExecutionGroup;
import boundless.utility.StringUtility;


public class TcpSender {
	private static Logger log = LoggerFactory.getLogger(TcpSender.class);
	private static ExecutionGroup executor = new ExecutionGroup(1, "TcpSender");
	public static void shutdown(){
		executor.close();
	}
	
	private SocketChannel _channel;
	private Selector _selector;
	private boolean _closing=false;
	private boolean _connected = false;
	
	private String ip; 
	private int port;

	private int type;
	private Object attach;
	
	public TcpSender(){
		
	}
	
	public void connect(String ip, int port) throws IOException{
		if(_connected){
			throw new IOException("already.connected");
		}
		this.ip = ip;
		this.port = port;
		
		this._connected = true;		
		this._closing=false;
		
		_selector = Selector.open();

		// 打开Socket通道
		this._channel = SocketChannel.open();
		// 设置为非阻塞模式
		_channel.configureBlocking(false);
		// 连接
		_channel.connect(new InetSocketAddress(ip, port));
		// 注册连接服务端socket动作
		_channel.register(_selector, SelectionKey.OP_CONNECT);

		_selector.select();
		Iterator<SelectionKey> iter = _selector.selectedKeys().iterator();
		while (iter.hasNext()) {
			SelectionKey key = iter.next();
			iter.remove();
			if (key.isConnectable() && _channel.finishConnect()) {
				_channel.register(_selector, SelectionKey.OP_WRITE);
				return;
			}
		}

		_connected = false;
		throw new IOException("Connect error");
	}
	
	public void close() {
		synchronized (this) {
			if (_closing) return;
			_closing=true;
		}
				
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

		_closing = false;
		_connected = false;
	}
	
	public void send(Datagram data){
		executor.execute(()->{
			try{
				byte[] raw = data.getAllRawData();
				ByteBuffer buf = ByteBuffer.wrap(raw);
				_channel.write(buf);
				log.debug("\nsend packet, command:{}, length:{}, \nallrawdata: {}", StringUtility.toHex(data.command()), data.length(), StringUtility.toHex(raw));
			}catch(Exception e){
				
			}
		});
	}

	public int getType() {
		return type;
	}

	public void setType(int type) {
		this.type = type;
	}

	public Object getAttach() {
		return attach;
	}

	public void setAttach(Object attach) {
		this.attach = attach;
	}
	
	public boolean isConnected(){
		return this._connected;
	}
	
	public boolean isClosed(){
		return isConnected() == false;
	}
}
