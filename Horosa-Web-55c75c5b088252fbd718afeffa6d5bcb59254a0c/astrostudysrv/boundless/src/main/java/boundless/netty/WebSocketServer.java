package boundless.netty;

import java.net.SocketAddress;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Function;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelFutureListener;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.ChannelOutboundHandlerAdapter;
import io.netty.channel.ChannelPipeline;
import io.netty.channel.ChannelPromise;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.group.ChannelGroup;
import io.netty.channel.group.DefaultChannelGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.HttpUtil;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.handler.codec.http.websocketx.CloseWebSocketFrame;
import io.netty.handler.codec.http.websocketx.PingWebSocketFrame;
import io.netty.handler.codec.http.websocketx.PongWebSocketFrame;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketServerHandshaker;
import io.netty.handler.codec.http.websocketx.WebSocketServerHandshakerFactory;
import io.netty.handler.stream.ChunkedWriteHandler;
import io.netty.util.CharsetUtil;
import io.netty.util.concurrent.GlobalEventExecutor;

import org.slf4j.Logger;

import boundless.exception.AppException;
import boundless.exception.ErrorCodeException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.external.IServerConfiguration;
import boundless.net.external.ServerConfiguration;
import boundless.netty.PacketRegistor;
import boundless.netty.ProcessorContext;
import boundless.netty.ProcessorExecution;
import boundless.security.SimpleWebSocketSecUtility;
import boundless.types.Tuple;
import boundless.utility.ConsoleUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.IPUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class WebSocketServer implements PacketRegistor,Server {
	public static final String logDir = "tcp";
	public static final Logger globalLog = AppLoggers.getLog(logDir, "tcp");
	public static final int WorkThreadSize = 3;
	public static final int MaxContentLength = 1024*1024*300;
	public static final String PacketFinFlag = "_@_^^_@_";
	public static final String PacketStartFlag = "_@@__@@_";
	public static final int FinFlagSize = PacketFinFlag.length();
	public static final int StartFlagSize = PacketStartFlag.length();
	
	private static int serverCounter = 0;
	
	public static int getActiveServerCount(){
		return serverCounter;
	}
	
	private Map<String, WebSocketServerHandshaker> webSocketHandshakerMap = new HashMap<String, WebSocketServerHandshaker>();

	private EventLoopGroup bossGroup = new NioEventLoopGroup(3);
	private EventLoopGroup workerGroup = new NioEventLoopGroup(3);
	
	protected IServerConfiguration config;

	private int type = 0;
	private Logger log;
	private Logger focusLog;
	private Logger errorLog;
	private ProcessorExecution execution;
	private Class decoderClass;
	private Class encoderClass;
	private ChannelGroup channels;
	private ChannelFuture bindFuture = null;
	private ServerPlug serverPlug;
	private boolean exceptionMsgReturn = false;
	private Class exceptionDatagramClass;
	
	private String selfPrivateExp;
	private String selfModulus;
	private String selfPublicExp;
	private String clientPublicExp;
	private String clientModulus;
	private boolean useRSA;
	private boolean inverseRSA;

	
	public WebSocketServer(IServerConfiguration config){
		try {
			Class decoder = null;
			Class encoder = null;
			if(!StringUtility.isNullOrEmpty(config.encoderClass())){
				encoder = Class.forName(config.encoderClass());
			}
			if(!StringUtility.isNullOrEmpty(config.decoderClass())){
				decoder = Class.forName(config.decoderClass());
			}
			
			init(config, decoder, encoder);
		} catch (Exception e) {
			String msg = ConsoleUtility.getStackTrace(e);
			log().error(msg);
			throw new RuntimeException(e);
		}
	}

	public WebSocketServer(IServerConfiguration config, Class decoder, Class encoder){
		init(config, decoder, encoder);
	}
	
	public WebSocketServer(IServerConfiguration config, Class decoder){
		this(config, decoder, null);
	}
	
	public WebSocketServer(int port, Class decoder){
		this(port, decoder, null);
	}
	
	public WebSocketServer(int port, Class decoder, Class encoder){
		ServerConfiguration conf = new ServerConfiguration();
		conf.port(port);
		init(conf, decoder, encoder);
	}
	
	private void init(IServerConfiguration config, Class decoder, Class encoder){
		try {
			this.config = config;
			int workers = config.worker();
			if(workers <= 0){
				workers = WorkThreadSize;
			}
			this.execution = new ProcessorExecution(workers, "WebSocketServerOnPort"+config.port());
			this.execution.setTaskThreshold(config.taskThreshold());
			
			this.useRSA = config.useRSA();
			this.inverseRSA = config.inverseRSA();
			this.selfModulus = config.rsaServerModulus();
			this.selfPrivateExp = config.rsaServerPrivateExp();
			this.selfPublicExp = config.rsaServerPublicExp();
			this.clientPublicExp = config.rsaClientPublicExp();
			this.clientModulus = config.rsaClientModulus();
			
			this.decoderClass = decoder;
			this.encoderClass = encoder;
			this.channels = new DefaultChannelGroup(GlobalEventExecutor.INSTANCE);
			
			if(!StringUtility.isNullOrEmpty(config.initPluginClass())){
				Class plugin = Class.forName(config.initPluginClass());
				this.serverPlug = (ServerPlug) plugin.newInstance();
			}
			
			if(!StringUtility.isNullOrEmpty(config.loggerName())){
				this.log = AppLoggers.getLog(logDir, config.loggerName());
			}
			if(!StringUtility.isNullOrEmpty(config.errorLoggerName())){
				this.errorLog = AppLoggers.getLog(logDir, config.errorLoggerName());
			}
			if(!StringUtility.isNullOrEmpty(config.focusLoggerName())){
				this.focusLog = AppLoggers.getLog(logDir, config.focusLoggerName());
			}
			
			if(!StringUtility.isNullOrEmpty(config.exceptionDatagram())){
				this.exceptionDatagramClass = Class.forName(config.exceptionDatagram());
			}else{
				this.exceptionDatagramClass = null;
			}
			this.exceptionMsgReturn = config.exceptionMsgReturn();
			
			this.execution.setCommExceptionHandler(new Function<Throwable, Datagram>(){
				@Override
				public Datagram apply(Throwable t) {
					return treatCommonException(t);
				}
				
			});
			
			QueueLog.info(log(), JsonUtility.encode(config));
			Thread.sleep(1000);
		} catch (Exception e) {
			String msg = ConsoleUtility.getStackTrace(e);
			log().error(msg);
			throw new RuntimeException(e);
		}
	}
	
	public void setSelfPrivateExp(String selfPrivateExp) {
		this.selfPrivateExp = selfPrivateExp;
	}

	public void setSelfModulus(String selfModulus) {
		this.selfModulus = selfModulus;
	}
	
	public void setClientPublicExp(String clientPublicExp) {
		this.clientPublicExp = clientPublicExp;
	}

	public void setClientModulus(String clientModulus) {
		this.clientModulus = clientModulus;
	}

	public void setUseRSA(boolean useRSA) {
		this.useRSA = useRSA;
	}

	private Datagram treatCommonException(Throwable err){
		int errcode = 999;
		int cmd = BasePacketIds.ExceptionPacket;
		if(err instanceof AppException) {
			AppException ex = (AppException)err;
			cmd = ex.getCommand();
		}
		Logger errlog = this.errorLog;
		if(errlog == null){
			errlog = this.log();
		}
		QueueLog.error(this.log(), err);
		
		if(this.exceptionMsgReturn){
			if(err instanceof ErrorCodeException) {
				ErrorCodeException errex = (ErrorCodeException) err;
				errcode = errex.getCode();
			}
			return treatCommonException(cmd, errcode, err.getMessage());
		}
		return null;
	}
	
	private Datagram treatCommonException(int cmd, int errcode, String errmsg) {
		Logger errlog = this.errorLog;
		if(errlog == null){
			errlog = this.log();
		}
		try{
			Map<String, Object> map = new HashMap<String, Object>();
			Map<String, Object> head = new HashMap<String, Object>();
			Map<String, Object> body = new HashMap<String, Object>();
			body.put("Result", errmsg);
			body.put("ResultCode", errcode);
			map.put("Body", body);
			map.put("Head", head);
			map.put("Cmd", cmd);
			String msg = JsonUtility.encode(map);
			Datagram datagram = new WebSocketDatagram(msg);
			return datagram;
		}catch(Exception e){
			QueueLog.error(errlog, e);
		}
		return null;
	}
	
	protected void pluginServer(){
		if(this.serverPlug != null){
			this.serverPlug.plugin(this);
		}
	}
	
	public void setExceptionDatagramClass(Class value){
		this.exceptionDatagramClass = value;
	}
	
	public void trackPacket(boolean value){
		this.config.trackPacket(value);
	}
	
	public void focusLog(Logger log){
		this.focusLog = log;
	}
	
	public Logger focusLog(){
		if(focusLog == null){
			this.focusLog = WebSocketServer.globalLog;
		}
		return this.focusLog;
	}
	
	public void log(Logger log){
		this.log = log;
		this.execution.log(log);
	}
	
	public Logger log(){
		if(log == null){
			this.log = WebSocketServer.globalLog;
		}
		return this.log;
	}
	
	public void errorLog(Logger log){
		this.errorLog = log;
	}
	
	public void setType(int n){
		this.type = n;
	}
	
	public int getType(){
		return this.type;
	}
		
	private void removeChannel(Channel ctx){
		if(ctx.remoteAddress() != null){
			QueueLog.info(log, "session closed correspond to channel-{}", ctx.remoteAddress());
		}else{
			QueueLog.info(log, "session closed correspond to channel-{}", ctx);
		}
		this.channels.remove(ctx);

    	this.execution.removeSession(ctx);
	}
	
	@Override
	public void registerHeartbeatHandle(int command, Consumer<ProcessorContext> handler){
		this.execution.registerHeartbeatHandle(command, handler);
	}
	
	@Override
	public void register(int command, Consumer<ProcessorContext> handler) {
		this.execution.register(command, handler);
	}

	@Override
	public void unregister(int command) {
		this.execution.unregister(command);
	}
	
	@Override
	public void addChain(Function<ProcessorContext, Boolean> fun){
		this.execution.addChain(fun);
	}
	
	@Override
	public void addAfterChain(Function<ProcessorContext, Boolean> fun){
		this.execution.addAfterChain(fun);
	}
	
	@Override
	public void addBeforeCmdChain(int command, Function<ProcessorContext, Boolean> fun){
		this.execution.addBeforeCmdChain(command, fun);
	}
	
	@Override
	public void addAfterCmdChain(int command, Function<ProcessorContext, Boolean> fun){
		this.execution.addAfterCmdChain(command, fun);
	}
	
	@Override
	public void broadcast(Function<Object, Datagram> fun){
		this.execution.broadcast(fun);
	}
	
	@Override
	public void broadcast(Datagram data){
		for(Channel ch : this.channels){
			ch.writeAndFlush(data);
		}
	}
	
	@Override
	public int port(){
		return this.config.port();
	}
	
	public NettySession[] getMostActiveSessions(){
		return this.execution.getMostActiveSessions();
	}
	
	public NettySession[] getAllSessions(){
		return this.execution.getAllSessions();
	}
	
	public Long[] getAllClientAddress(){
		return this.execution.getAllClientAddress();
	}
	
	public int countConnection(){
		return this.channels.size();
	}
	
	public int countRunning(){
		return this.execution.countRunning();
	}
	
	public List<Object> getAttachList(){
		return this.execution.getAttachList();
	}
	
	public void treatAttach(Consumer<Object> consumer){
		this.execution.treatAttach(consumer);
	}
	
	public NettySession getSession(String sessionId){
		NettySession sess = this.execution.getSession(sessionId);
		if(sess != null){
			long key = sess.getClientAddress();
			String existId = this.execution.getSessionId(key);
			if(StringUtility.isNullOrEmpty(existId)){
				return null;
			}
		}
		return sess;
	}
	
	public void close(){
		closeWithReuse(false);
		
		try{
			bossGroup.shutdownGracefully();
		}catch(Exception e){
			e.printStackTrace();
		}
		
		try{
			workerGroup.shutdownGracefully();
		}catch(Exception e){
			e.printStackTrace();
		}
	}
	
	synchronized private void closeWithReuse(boolean reuse){
		try{
			this.execution.stopWithReuse(reuse);
		}catch(Exception e){
			e.printStackTrace();
		}
		
		try{
			this.channels.close().sync();
		}catch(Exception e){
			e.printStackTrace();
		}finally{
			this.channels.clear();
		}
		
		try{
			if(bindFuture != null && reuse == false){
		        // 等待服务端监听端口关闭
		        ChannelFuture cf = bindFuture.channel().close();
		        cf.addListener(new ChannelFutureListener(){
					@Override
					public void operationComplete(ChannelFuture future) throws Exception {
						QueueLog.queueWorkItem(()->{
							QueueLog.info(log(), "{} closed", config.serverName());
						});
					}
		        	
		        });
		        
		        cf.syncUninterruptibly();
		        bindFuture = null;
		        
		        serverCounter--;
			}
		}catch(Exception e){
			e.printStackTrace();
		}
	}
	
	
	synchronized public void run() {
		if(bindFuture != null){
			return;
		}
		pluginServer();
		
        try {
            // NIO服务器端的辅助启动类 降低服务器开发难度
            ServerBootstrap serverBootstrap = new ServerBootstrap();
            serverBootstrap.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)// 类似NIO中serverSocketChannel
                    .option(ChannelOption.SO_BACKLOG, this.config.maxClient()) // The maximum queue length for incoming connection
                    .option(ChannelOption.SO_TIMEOUT, this.config.timeout()*1000)
                    .childOption(ChannelOption.SO_KEEPALIVE, true)
                    .childHandler(
                    		new ChildChannelHandler(this.execution, this)
                    		);// 最后绑定I/O事件的处理类, 处理网络IO事件
 
            // 服务器启动后 绑定监听端口 同步等待成功 主要用于异步操作的通知回调 回调处理用的ChildChannelHandler
            bindFuture = serverBootstrap.bind(this.config.port());
            bindFuture.addListener(new ChannelFutureListener(){
				@Override
				public void operationComplete(ChannelFuture future) throws Exception {
					QueueLog.queueWorkItem(()->{
						QueueLog.info(log(), "{} started", config.serverName());
					});
		            for (String ip : IPUtility.getLocalIps()){
		            	Object params[] = new String[]{
		            		config.serverName(), config.serverId()+"", ip, config.port()+""
		            	};
						QueueLog.queueWorkItem(()->{
							QueueLog.info(log(), "{},serverId:{}, ip:{}, listen on port {}", params);
						});
		            }
				}
            	
            });
            bindFuture.sync();
            
            serverCounter++;
        }catch(Exception e){
        	e.printStackTrace();
        	closeWithReuse(false);
        }
    }
	
	/**
     * 网络事件处理器
     */
    private static class ChildChannelHandler extends ChannelInitializer<SocketChannel> {
    	private ProcessorExecution execution;
    	private WebSocketServer owner;
    	
    	public ChildChannelHandler(ProcessorExecution execution, WebSocketServer owner){
    		this.execution = execution;
    		this.owner = owner;
    	}

    	@Override
        protected void initChannel(SocketChannel ch) throws Exception {
    		ChannelPipeline pipeline = ch.pipeline();
            // 将请求与应答消息编码或者解码为HTTP消息
            pipeline.addLast("http-codec", new HttpServerCodec());
            // 将http消息的多个部分组合成一条完整的HTTP消息
            pipeline.addLast("aggregator", new HttpObjectAggregator(MaxContentLength));
            // 分块。主要用于支持浏览器和服务端进行WebSocket通信
            pipeline.addLast("http-chunked", new ChunkedWriteHandler());
            
            pipeline.addLast("httpRequestHandle", new HttpRequestHandler(this.owner));
            pipeline.addLast("WebSocketReadHandle", new TransHandler(this.execution, this.owner));
            pipeline.addLast("WebSocketWriteHandle", new OutboundHandler(this.owner));
    		
        }
 
    }
    
    private static class HttpRequestHandler extends SimpleChannelInboundHandler<Object>{
    	private WebSocketServer owner;
    	public HttpRequestHandler(WebSocketServer owner) {
    		this.owner = owner;
    	}

		@Override
		protected void channelRead0(ChannelHandlerContext ctx, Object msg) throws Exception {
			if (msg instanceof FullHttpRequest) {
	            handleHttpRequest(ctx, (FullHttpRequest) msg);
	        } else if (msg instanceof WebSocketFrame) {
	            ctx.fireChannelRead(((WebSocketFrame) msg).retain());
	        }
		}
    	
		/**
	     * 描述：处理Http请求，主要是完成HTTP协议到Websocket协议的升级
	     * @param ctx
	     * @param req
	     */
	    private void handleHttpRequest(ChannelHandlerContext ctx, FullHttpRequest req) {
	        if (!req.decoderResult().isSuccess()) {
	            sendHttpResponse(ctx, req,
	                    new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.BAD_REQUEST));
	            return;
	        }

	        String url = String.format("ws:/%s/ws", ctx.channel().localAddress());
	        WebSocketServerHandshakerFactory wsFactory = new WebSocketServerHandshakerFactory(url, null, false, MaxContentLength);
	        WebSocketServerHandshaker handshaker = wsFactory.newHandshaker(req);

			SocketAddress client = ctx.channel().remoteAddress();
	        if (handshaker == null) {
	            WebSocketServerHandshakerFactory.sendUnsupportedVersionResponse(ctx.channel());
				QueueLog.debug(this.owner.log(), "unsupported websocket version, {}", client.toString());
	        } else {
		        this.owner.webSocketHandshakerMap.put(ctx.channel().id().asLongText(), handshaker);// 保存握手类到全局变量，方便以后关闭连接
	            handshaker.handshake(ctx.channel(), req);
				QueueLog.debug(this.owner.log(), "{}, client handshake, {}", url, client.toString());
	        }
	        
	    }

	    private void sendHttpResponse(ChannelHandlerContext ctx, FullHttpRequest req, DefaultFullHttpResponse res) {
	        // 返回应答给客户端
	        if (res.status().code() != 200) {
	            ByteBuf buf = Unpooled.copiedBuffer(res.status().toString(), CharsetUtil.UTF_8);
	            res.content().writeBytes(buf);
	            buf.release();
	        }
	        // 如果是非Keep-Alive，关闭连接
	        boolean keepAlive = HttpUtil.isKeepAlive(req);
	        ChannelFuture f = ctx.channel().writeAndFlush(res);
	        if (!keepAlive) {
	            f.addListener(ChannelFutureListener.CLOSE);
	        }
	    }

		@Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
			if(ctx.channel().remoteAddress() != null){
				QueueLog.error(this.owner.log(), "exception occurs in client channel-{}, cause:{}", ctx.channel().remoteAddress(), cause.getMessage());
			}else{
				QueueLog.error(this.owner.log(), "exception occurs in client channel-{}, cause:{}", ctx.channel(), cause.getMessage());
			}
						
			ctx.channel().close();
        }
	    
    }

    private static class TransHandler extends SimpleChannelInboundHandler<WebSocketFrame> {
    	public static final long LongDataTimeout = 3600 * 60;
    	
    	private Map<String, Tuple<String, Long>> longData = new ConcurrentHashMap<String, Tuple<String, Long>>();

    	private ProcessorExecution execution;
    	private WebSocketServer owner;
    	private long serverNum;
    	
    	public TransHandler(ProcessorExecution execution, WebSocketServer owner){
    		super(true);
    		this.execution = execution;
    		this.owner = owner;
    		serverNum = ServerAddress.getDistinctCode(IPUtility.getLocalIps()[0], this.owner.config.port());
    	}
    	
		@Override
		protected void channelRead0(ChannelHandlerContext ctx, WebSocketFrame msg) throws Exception {
			messageReceived(ctx, msg);
		}
		
		private String decode(String str) {
    		if(!this.owner.config.useRSA()) {
    			return str;
    		}
    		try {
        		String modulus = this.owner.config.rsaServerModulus();
        		String exp = this.owner.config.rsaServerPrivateExp();
        	    byte[] raw = SimpleWebSocketSecUtility.decrypt(str, modulus, exp);
        	    String res = new String(raw);
        	    return res;
    		}catch(Exception e) {
    			throw new RuntimeException(e);
    		}
		}
		
		private void swipeLongDatas() {
			long now = System.currentTimeMillis();
			Set<String> keys = new HashSet<String>();
			for(Map.Entry<String, Tuple<String, Long>> entry : longData.entrySet()) {
				String key = entry.getKey();
				Tuple<String, Long> tuple = entry.getValue();
				long delta = now - tuple.item2();
				if(delta > LongDataTimeout) {
					keys.add(key);
				}
			}
			
			for(String key : keys) {
				longData.remove(key);
			}
		}

		protected void messageReceived(ChannelHandlerContext ctx, WebSocketFrame msg) throws Exception {
    		int cmd = BasePacketIds.WebSockePacket;
    		boolean trackpkg = this.owner.config.trackPacket() ;
        	try{
                SocketAddress client = ctx.channel().remoteAddress();
                String remoteaddr = client.toString();

            	if(msg == null){
            		return;
            	}
            	
            	// 关闭请求
                if (msg instanceof CloseWebSocketFrame) {
                    WebSocketServerHandshaker handshaker =
                            this.owner.webSocketHandshakerMap.get(ctx.channel().id().asLongText());
                    if (handshaker == null) {
            			Datagram datagram = this.owner.treatCommonException(BasePacketIds.ExceptionPacket, 999, "no.exist.client.connect");
            			if(datagram != null){
            				ctx.channel().writeAndFlush(datagram);
            			}
                    } else {
                    	this.owner.webSocketHandshakerMap.remove(ctx.channel().id().asLongText());
                        handshaker.close(ctx.channel(), (CloseWebSocketFrame) msg.retain());
                    }
                    longData.remove(remoteaddr);
                    return;
                }
                // ping请求
                if (msg instanceof PingWebSocketFrame) {
                    ctx.channel().write(new PongWebSocketFrame(msg.content().retain()));
                    return;
                }

        		String json = null;
    			ByteBuf buf = msg.content();
    			byte[] raw = new byte[buf.readableBytes()];
    			buf.readBytes(raw);
    			json = new String(raw, "UTF-8");
    			if(trackpkg) {
    				QueueLog.debug(this.owner.log(), "rawtxt: {}", json);
    			}
    			
    			boolean startPkg = json.startsWith(PacketStartFlag);
    			boolean finPkg = json.endsWith(PacketFinFlag);
    			boolean fullpkg = startPkg && finPkg;
    			if(fullpkg) {
        			int sz = json.length();
    				json = json.substring(StartFlagSize, sz - FinFlagSize);
        			if(trackpkg) {
        				QueueLog.debug(this.owner.log(), "fultxt: {}", json);
        			}
    			}else {
    				Tuple<String, Long> tuple = longData.get(remoteaddr);
    				if(tuple == null) {
    					tuple = new Tuple<String, Long>(json, System.currentTimeMillis());
    					longData.put(remoteaddr, tuple);    					
    				}else{
        				String str = tuple.item1();
        				if(startPkg) {
        					tuple.item1(json);
        				}else {
        					json = str + json;   
            				tuple.item1(json);        					
        				}
    				}
        			
        			int sz = json.length();
        			if(sz < FinFlagSize) {
        				this.swipeLongDatas();
        				return;
        			}
        			
        			if(!finPkg) {
        				this.swipeLongDatas();
        				return;
        			}   
        			String str = tuple.item1();
        			sz = str.length();
        			int endidx = sz - FinFlagSize;
        			json = str.substring(StartFlagSize, endidx);
        			longData.remove(remoteaddr);
    			}
    			
    			json = decode(json);
    			if(trackpkg) {
    				QueueLog.debug(this.owner.log(), "plain: {}", json);
    			}
            	
        		Object body = json;
        		Map<String, Object> head = new HashMap<String, Object>();
        		try {
        			Map<String, Object> map = JsonUtility.toDictionary(json);
        			cmd = ConvertUtility.getValueAsInt(map.get("Cmd"));
        			Object headobj = map.get("Head");
        			if(headobj instanceof Map) {
        				head = (Map<String, Object>) headobj;
        			}
        			body = map.get("Body");
        		}catch(Exception e) {
        			
        		}
        		WebSocketDatagram datagram = new WebSocketDatagram(json);
        		datagram.command(cmd);
        		datagram.setBody(body);
        		datagram.setHead(head);
        		
            	if(trackpkg) {
            		QueueLog.debug(this.owner.log(), "RX packet, cmd:{}, dec:{} from {}, \nRX: {}", StringUtility.toHex(cmd), cmd, remoteaddr, json);            		
            	}else {
            		QueueLog.debug(this.owner.log(), "RX packet, cmd:{}, dec:{} from {}", StringUtility.toHex(cmd), cmd, remoteaddr);            		
            	}

            	ProcessorContext proctx = new ProcessorContext(ctx.channel(), datagram, serverNum);
            	proctx.log(this.owner.log());
            	proctx.setSessionable(this.owner.execution);
            	execution.execute(cmd, proctx);
            	
            	swipeLongDatas();
        	}catch(Exception err){
    			Datagram datagram = this.owner.treatCommonException(err);
    			if(datagram != null){
    				ctx.channel().writeAndFlush(datagram);
    			}
        	}
		}
		
         
        @Override
		public void channelRegistered(ChannelHandlerContext ctx) throws Exception {
        	SocketAddress client = ctx.channel().remoteAddress();
        	QueueLog.debug(this.owner.log(), "client channel registered, {}, ChannelHandlerContext:{}, channel obj:{}", 
        			client.toString(), ctx.toString(), ctx.channel().toString());
		}

		@Override
		public void channelUnregistered(ChannelHandlerContext ctx) throws Exception {
        	SocketAddress client = ctx.channel().remoteAddress();
            String remoteaddr = client.toString();
        	longData.remove(remoteaddr);
        	
        	QueueLog.debug(this.owner.log(), "client channel unregistered, {}, ChannelHandlerContext:{}, channel obj:{}", 
        			client.toString(), ctx.toString(), ctx.channel().toString());
        	
            WebSocketServerHandshaker handshaker =
                    this.owner.webSocketHandshakerMap.get(ctx.channel().id().asLongText());
            if (handshaker != null) {
            	this.owner.webSocketHandshakerMap.remove(ctx.channel().id().asLongText());
            }
		}

		@Override
		public void channelActive(ChannelHandlerContext ctx) throws Exception {
        	this.owner.channels.add(ctx.channel());
        	this.owner.execution.addSession(ctx.channel());

        	SocketAddress client = ctx.channel().remoteAddress();
        	QueueLog.debug(this.owner.log(), "client connected, {}", client.toString());
		}

		@Override
		public void channelInactive(ChannelHandlerContext ctx) throws Exception {
			this.owner.removeChannel(ctx.channel());

			SocketAddress client = ctx.channel().remoteAddress();
			QueueLog.debug(this.owner.log(), "client disconnected, {}", client.toString());
		}

		@Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
			if(ctx.channel().remoteAddress() != null){
				QueueLog.error(this.owner.log(), "exception occurs in client channel-{}, cause:{}", ctx.channel().remoteAddress(), cause.getMessage());
			}else{
				QueueLog.error(this.owner.log(), "exception occurs in client channel-{}, cause:{}", ctx.channel(), cause.getMessage());
			}
			
			Datagram datagram = this.owner.treatCommonException(cause);
			if(datagram != null){
				ctx.channel().writeAndFlush(datagram);
			}
			
			if(this.owner.config.closeOnException()){
				this.owner.removeChannel(ctx.channel());
				ctx.channel().close();
			}
        }
				
    }

    private static class OutboundHandler extends ChannelOutboundHandlerAdapter{
    	private WebSocketServer owner;
 
    	public OutboundHandler(WebSocketServer owner){
    		this.owner = owner;
    	}
    	
    	private String encode(String str) {
    		if(!this.owner.config.useRSA()) {
    			return str;
    		}
    		try {
        		byte[] plaindata = str.getBytes("UTF-8");
        		String modulus = this.owner.config.rsaServerModulus();
        		String exp = this.owner.config.rsaServerPrivateExp();
        	    String res = SimpleWebSocketSecUtility.encrypt(plaindata, modulus, exp);
        	    return res;
    		}catch(Exception e) {
    			throw new RuntimeException(e);
    		}
    	}
    	
		public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {			
			if(msg instanceof WebSocketDatagram) {
				WebSocketDatagram outdata = (WebSocketDatagram) msg;
				String txt = outdata.text();
				txt = encode(txt);
				TextWebSocketFrame frame = new TextWebSocketFrame(txt);
				super.write(ctx, frame, promise);
	        	
				int cmd = outdata.command();
				String hex = StringUtility.toHex(cmd);
	    		SocketAddress client = ctx.channel().remoteAddress();
	        	if(this.owner.config.trackPacket()){
	        		QueueLog.debug(this.owner.log(), "TX packet, cmd:{}, dec:{}, to {}\nTX: {}", hex, cmd, client, txt);
	        	}else{
	        		QueueLog.debug(this.owner.log(), "TX packet, cmd:{}, dec:{}, to {}", hex, cmd, client);
	        	}
	        	
	        	if(outdata.log() != null){
	        		try{
	        			QueueLog.info(outdata.log(), "TX, {}", txt);
	        		}catch(Exception e){
	        			QueueLog.error(this.owner.log(), ConsoleUtility.getStackTrace(e));
	        		}
	        	}				
			}else {
				super.write(ctx, msg, promise);				
			}
		}
		
    }
    
}
