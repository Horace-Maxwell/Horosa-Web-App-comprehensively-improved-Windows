package boundless.types.wsclient;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.enums.ReadyState;
import org.java_websocket.handshake.ServerHandshake;
import org.slf4j.Logger;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.netty.BasePacketIds;
import boundless.netty.WebSocketServer;
import boundless.security.SimpleWebSocketSecUtility;
import boundless.utility.CalculatePool;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class WSClient {
	private WebSocketClient client;
	private Logger log;
	private Consumer<String> recvHandler;
	private Map<Integer, BiConsumer<Map<String, Object>, Object>>  recvRsaHandlers = new HashMap<Integer, BiConsumer<Map<String, Object>, Object>>();
	private String modulus;
	private String exp;
	private boolean reconnectOnError;
	private boolean logData;
	private int heartbeatPeriod;
	private String url;
	
	private Object clientLock = new Object();
	private Object sendLock = new Object();
	private Map<Integer, Object> receData = new ConcurrentHashMap<Integer, Object>();
	
	public WSClient(String url){
		this(url, null, true, 30, false);
	}
	
	public WSClient(String url, String logname, boolean autoReconnect, int hbperiod, boolean logData) {
		this.url = url;
		String logn = "wsclient";
		if(!StringUtility.isNullOrEmpty(logname)) {
			logn = logname;
		}
		this.log = AppLoggers.getLog("tcp", logn);
		this.reconnectOnError = autoReconnect;
		this.heartbeatPeriod = hbperiod;
		this.logData = logData;
		
		this.genWebSocket();
	}
	
	private void genWebSocket() {
		try {
			if(this.client != null) {
				this.client.close();				
			}
		}catch(Exception e) {
		}
		
		try {
			URI uri = new URI(url);
			this.client = new WebSocketClient(uri) {
				@Override
				public void onOpen(ServerHandshake handshakedata) {
					QueueLog.info(log, "websocket opend, httpcode:{}, httpmsg:{}", handshakedata.getHttpStatus(), handshakedata.getHttpStatusMessage());
					handleOpen();
				}

				@Override
				public void onMessage(String message) {
					recv(message);
				}

				@Override
				public void onClose(int code, String reason, boolean remote) {
					QueueLog.info(log, "websocket opend, code:{}, reason:{}, from remote:{}", code, reason, remote);
				}

				@Override
				public void onError(Exception ex) {
					QueueLog.error(log, ex);
					handleError();
				}
				
			};
		}catch(Exception e) {
			throw new RuntimeException(e);
		}			
	}
	
	private void reGenWebSocket() {
		synchronized(this.clientLock) {
			this.genWebSocket();
			try {
				this.client.connectBlocking(3, TimeUnit.SECONDS);				
			}catch(Exception e) {
			}
		}
	}
	
	public String getUrl() {
		return this.url;
	}
	
	public void close() {
		try {
			this.client.closeBlocking();			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public void connect() {
		if(this.isReady()) {
			return;
		}
		try {
			this.client.connect();			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public boolean connectBlock() {
		if(this.isReady()) {
			return true;
		}
		try {
			return this.client.connectBlocking(3, TimeUnit.SECONDS);		
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public void connect(Consumer<String> handler) {
		this.setRecvHandler(handler);
		this.connect();
	}
	
	public void reconnect() {
		try {
			this.client.reconnectBlocking();			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public void send(String txt) {
		String msg = String.format("%s%s%s", WebSocketServer.PacketStartFlag, txt, WebSocketServer.PacketFinFlag);
		if(this.logData) {
			QueueLog.debug(this.log, "TX: {}", msg);
		}

		try {
			this.client.send(msg);			
		}catch(Exception e) {
			try {
				this.client.closeBlocking();				
			}catch(Exception er) {
			}
			QueueLog.error(log, e);
			this.handleError();
		}
	}
	
	public void sendRaw(String msg) {
		if(this.logData) {
			QueueLog.debug(this.log, "TX: {}", msg);
		}

		try {
			this.client.send(msg);			
		}catch(Exception e) {
			try {
				this.client.closeBlocking();				
			}catch(Exception er) {
			}
			QueueLog.error(log, e);
			this.handleError();
		}
	}
	
	public void send(byte[] data) {
		try {
			this.client.send(data);			
		}catch(Exception e) {
			try {
				this.client.closeBlocking();				
			}catch(Exception er) {
			}
			QueueLog.error(log, e);
			this.handleError();
		}
	}
	
	public void setRecvHandler(Consumer<String> handler) {
		this.recvHandler = handler;
	}
	
	public void setRecvRsaHandler(int cmd, BiConsumer<Map<String, Object>, Object> handler) {
		this.recvRsaHandlers.put(cmd, handler);
	}
	
	public boolean containRsaHandler(int cmd) {
		return this.recvRsaHandlers.containsKey(cmd);
	}
	
	public void setRSA(String modulus, String exp) {
		this.modulus = modulus;
		this.exp = exp;
	}
	
	public boolean isReady() {
		if(this.client == null) {
			return false;
		}
		synchronized(this.clientLock) {
			ReadyState state = client.getReadyState();
			return state == ReadyState.OPEN;			
		}
	}
	
	public void send(int cmd, Object data) {
		Map<String, Object> head = new HashMap<String, Object>();
		this.send(cmd, data, head);
	}
	
	public void send(int cmd, Object data, Map<String, Object> head) {
		try {
			Map<String, Object> map = new HashMap<String, Object>();
			map.put("Cmd", cmd);
			map.put("Body", data);
			map.put("Head", head);
			String json = JsonUtility.encode(map);
			if(this.logData) {
				QueueLog.debug(this.log, "TX plain:\n{}", json);
			}
			
			byte[] plaindata = json.getBytes("UTF-8");
			String res = SimpleWebSocketSecUtility.encrypt(plaindata, this.modulus, this.exp);
			this.send(res);			
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public synchronized Map<String, Object> sendSync(int cmd, Object data, Map<String, Object> head) {
		this.receData.remove(cmd);
		this.send(cmd, data, head);
		synchronized(this.sendLock) {
			try {
				this.sendLock.wait(10000);			
			}catch(Exception e) {
				this.sendLock.notifyAll();
			}			
		}
		return (Map<String, Object>)this.receData.get(cmd);
	}
	
	private void recv(String msg) {
		if(this.logData) {
			QueueLog.debug(this.log, "RX: {}", msg);
		}
		
		if(StringUtility.isNullOrEmpty(this.modulus)) {
			if(this.recvHandler != null) {
				this.recvHandler.accept(msg);
			}
			return;
		}
		
		byte[] data = SimpleWebSocketSecUtility.decrypt(msg, modulus, exp);
		int cmd = -1;
		Map<String, Object> map = new HashMap<String, Object>();
		try {
			String plain = new String(data, "UTF-8");	
			if(this.logData) {
				QueueLog.debug(this.log, "RX plain:\n{}", plain);
			}
			
			if(this.recvHandler != null) {
				this.recvHandler.accept(plain);
				return;
			}
			
			map = JsonUtility.toDictionary(plain);
			cmd = ConvertUtility.getValueAsInt(map.get("Cmd"), -1);
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
		
		BiConsumer<Map<String, Object>, Object> rsaHandler = this.recvRsaHandlers.get(cmd);
		Map<String, Object> head = (Map<String, Object>) map.get("Head");
		Object body = map.get("Body");
		if(rsaHandler != null) {
			rsaHandler.accept(head, body);
		}else {
			this.receData.put(cmd, body);
			synchronized(this.sendLock) {
				this.sendLock.notifyAll();				
			}
		}
		
	}
	
	private void handleOpen() {
		if(StringUtility.isNullOrEmpty(modulus)) {
			return;
		}
		
		Map<String, Object> heartb = new HashMap<String, Object>();
		
		this.setRecvRsaHandler(BasePacketIds.HeartBeat, (head, body)->{
			CalculatePool.queueUserWorkItem(()->{
				try {
					Thread.sleep(1000*this.heartbeatPeriod);
				}catch(Exception e) {
				}
				this.send(BasePacketIds.HeartBeat, heartb);				
			});
		});
		
		this.send(BasePacketIds.HeartBeat, heartb);
	}
	
	private void handleError() {
		if(this.isReady()) {
			return;
		}
		
		if(this.reconnectOnError) {
			this.reGenWebSocket();
		}
	}
}
