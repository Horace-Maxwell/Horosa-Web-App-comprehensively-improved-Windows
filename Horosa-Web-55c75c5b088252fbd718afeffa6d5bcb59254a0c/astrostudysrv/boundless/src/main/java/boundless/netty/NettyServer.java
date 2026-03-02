package boundless.netty;

import java.net.SocketAddress;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelFutureListener;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.ChannelOutboundHandlerAdapter;
import io.netty.channel.ChannelPromise;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.group.ChannelGroup;
import io.netty.channel.group.DefaultChannelGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.ByteToMessageDecoder;
import io.netty.handler.codec.MessageToByteEncoder;
import io.netty.util.concurrent.GlobalEventExecutor;

import org.slf4j.Logger;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.external.IServerConfiguration;
import boundless.net.external.ServerConfiguration;
import boundless.netty.PacketRegistor;
import boundless.netty.ProcessorContext;
import boundless.netty.ProcessorExecution;
import boundless.security.RSASetup;
import boundless.utility.ConsoleUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.IPUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class NettyServer implements PacketRegistor,Server {
	public static final String logDir = "tcp";
	public static final Logger globalLog = AppLoggers.getLog(logDir, "tcp");
	public static final int WorkThreadSize = 3;
	
	private static int serverCounter = 0;
	
	public static int getActiveServerCount(){
		return serverCounter;
	}
	

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

	
	public NettyServer(IServerConfiguration config){
		try {
			Class decoder = Class.forName(config.decoderClass());
			Class encoder = null;
			if(!StringUtility.isNullOrEmpty(config.encoderClass())){
				encoder = Class.forName(config.encoderClass());
			}
			
			init(config, decoder, encoder);
		} catch (Exception e) {
			String msg = ConsoleUtility.getStackTrace(e);
			log().error(msg);
			throw new RuntimeException(e);
		}
	}

	public NettyServer(IServerConfiguration config, Class decoder, Class encoder){
		init(config, decoder, encoder);
	}
	
	public NettyServer(IServerConfiguration config, Class decoder){
		this(config, decoder, null);
	}
	
	public NettyServer(int port, Class decoder){
		this(port, decoder, null);
	}
	
	public NettyServer(int port, Class decoder, Class encoder){
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
			this.execution = new ProcessorExecution(workers, "NettyServerOnPort"+config.port());
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
			if(encoder == null){
				this.encoderClass = DatagramEncoder.class;
			}
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
		Logger errlog = this.errorLog;
		if(errlog == null){
			errlog = this.log();
		}
		QueueLog.error(this.log(), err);
		
		if(this.exceptionMsgReturn){
			try{
				String errmsg = "err:" + err.getMessage();
				Datagram datagram;
				if(this.exceptionDatagramClass == null){
					datagram = new StringDatagram(errmsg.getBytes("UTF-8"));
					datagram.packetMsg(errmsg);
				}else{
					datagram = (Datagram) this.exceptionDatagramClass.newInstance();
					datagram.command(this.config.exceptionPacketId());
					datagram.packetMsg(errmsg);
					datagram.writeString(errmsg);
				}
				return datagram;
			}catch(Exception e){
				QueueLog.error(errlog, e);
			}
			return null;
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
			this.focusLog = NettyServer.globalLog;
		}
		return this.focusLog;
	}
	
	public void log(Logger log){
		this.log = log;
		this.execution.log(log);
	}
	
	public Logger log(){
		if(log == null){
			this.log = NettyServer.globalLog;
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
    	private NettyServer owner;
    	
    	public ChildChannelHandler(ProcessorExecution execution, NettyServer owner){
    		this.execution = execution;
    		this.owner = owner;
    	}

    	@Override
        protected void initChannel(SocketChannel ch) throws Exception {
    		ByteToMessageDecoder decoder = (ByteToMessageDecoder)this.owner.decoderClass.newInstance();
    		MessageToByteEncoder<Datagram> encoder = (MessageToByteEncoder<Datagram>)this.owner.encoderClass.newInstance();
    		if(decoder instanceof RSASetup){
    			RSASetup rsasetup = (RSASetup) decoder;
    			rsasetup.setPrivateKey(this.owner.selfModulus, this.owner.selfPrivateExp);
    		}
    		if(encoder instanceof RSASetup){
    			RSASetup rsasetup = (RSASetup) encoder;
    			rsasetup.setUseRSA(this.owner.useRSA);
    			if(this.owner.inverseRSA){
        			rsasetup.setPublicKey(this.owner.selfModulus, this.owner.selfPrivateExp);
    			}else{
        			rsasetup.setPublicKey(this.owner.clientModulus, this.owner.clientPublicExp);
    			}
    		}
            ch.pipeline().addLast(decoder, encoder, 
            		new OutboundHandler(this.owner),
            		new TransHandler(this.execution, this.owner));
        }
 
    }
    

    private static class TransHandler extends SimpleChannelInboundHandler<Datagram> {
    	private ProcessorExecution execution;
    	private NettyServer owner;
    	private long serverNum;
    	
    	public TransHandler(ProcessorExecution execution, NettyServer owner){
    		super(true);
    		this.execution = execution;
    		this.owner = owner;
    		serverNum = ServerAddress.getDistinctCode(IPUtility.getLocalIps()[0], this.owner.config.port());
    	}
    	
		@Override
		protected void channelRead0(ChannelHandlerContext ctx, Datagram msg) throws Exception {
			messageReceived(ctx, msg);
		}

		protected void messageReceived(ChannelHandlerContext ctx, Datagram msg) throws Exception {
        	try{
            	if(msg == null){
            		return;
            	}
            	Datagram indata = (Datagram) msg;
    			int ncmd = indata.command();
        		String ncmdstr = ConvertUtility.getValueAsUInt32(ncmd) + "";

            	SocketAddress client = ctx.channel().remoteAddress();
        		String cmd = StringUtility.toHex(indata.command());
            	if(this.owner.config.trackPacket()){
            		QueueLog.debug(this.owner.log(), "RX packet, command:{}, dec:{}, length:{}, from {}, \nRX: {}", 
            				cmd, ncmdstr, indata.length(), client.toString(), indata.toHexString());
            	}else{
            		QueueLog.debug(this.owner.log(), "RX packet, command:{}, dec:{}, length:{}, from {}", cmd, ncmdstr, indata.length(), client.toString());
            	}

            	ProcessorContext proctx = new ProcessorContext(ctx.channel(), indata, serverNum);
            	proctx.log(this.owner.log());
            	proctx.setSessionable(this.owner.execution);
            	execution.execute(indata.command(), proctx);

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
        	QueueLog.debug(this.owner.log(), "client channel unregistered, {}, ChannelHandlerContext:{}, channel obj:{}", 
        			client.toString(), ctx.toString(), ctx.channel().toString());
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
    	private NettyServer owner;
 
    	public OutboundHandler(NettyServer owner){
    		this.owner = owner;
    	}
    	
		public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
			super.write(ctx, msg, promise);
			
			Datagram outdata = (Datagram) msg;
			int ncmd = outdata.command();
    		String ncmdstr = ConvertUtility.getValueAsUInt32(ncmd) + "";
    		String cmd = StringUtility.toHex(outdata.command());
        	
    		SocketAddress client = ctx.channel().remoteAddress();
        	if(this.owner.config.trackPacket()){
        		QueueLog.debug(this.owner.log(), "TX packet, command:{}, dec:{}, length:{}, {}, to {}\nTX: {}", 
        				cmd, ncmdstr, outdata.length(), outdata.info(), client, outdata.toHexString());
        	}else{
        		QueueLog.debug(this.owner.log(), "TX packet, command:{}, dec:{}, length:{}, {} to {}", cmd, ncmdstr, outdata.length(), outdata.info(), client);
        	}
        	
        	if(outdata.log() != null){
        		try{
        			QueueLog.info(outdata.log(), "TX,cmd:{};dec:{},{}", cmd, ncmdstr, outdata.toHexString());
        		}catch(Exception e){
        			QueueLog.error(this.owner.log(), ConsoleUtility.getStackTrace(e));
        		}
        	}
		}
    }
}
