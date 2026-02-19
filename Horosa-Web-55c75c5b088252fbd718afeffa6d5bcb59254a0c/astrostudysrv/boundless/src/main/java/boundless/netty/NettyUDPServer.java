package boundless.netty;

import io.netty.bootstrap.Bootstrap;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelFutureListener;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.ChannelOutboundHandlerAdapter;
import io.netty.channel.ChannelPromise;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.nio.NioDatagramChannel;
import io.netty.handler.codec.ByteToMessageDecoder;
import io.netty.handler.codec.MessageToMessageDecoder;

import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.Function;

import org.slf4j.Logger;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.security.RSASetup;
import boundless.utility.ConsoleUtility;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class NettyUDPServer implements PacketRegistor,Broadcast {
	public static final String logDir = "udp";
	public static final Logger globalLog = AppLoggers.getLog(logDir, "udp");
	public static final int WorkThreadSize = 1;
	
	private static NioEventLoopGroup workerGroup = null;
	
	
	public static void shutdown(){
		try{
			if(workerGroup != null){
				workerGroup.shutdownGracefully(1, 1, TimeUnit.MILLISECONDS);
			}
		}catch(Exception e){
		}
		
	}
	
	private Object attach;

	private IBroadcastConfig config;
	private ProcessorExecution execution;
	private Class decoder;
	
	private Logger log;
	private Logger errorLog;
	private ChannelHandlerContext contex;
	private ChannelFuture bindFuture = null;
	private ServerPlug serverPlug;
	private boolean exceptionMsgReturn = false;
	private Class exceptionDatagramClass;

	private String selfPrivateExp;
	private String selfModulus;
	private String selfPublicExp;
	private String clientPublicExp;
	private String clientModulus;
	private boolean useRSA = false;
	private boolean inverseRSA = true;
	
	
	public NettyUDPServer(IBroadcastConfig config){
		try {
			Class decoder = null;
			if(!StringUtility.isNullOrEmpty(config.decoderClass())){
				decoder = Class.forName(config.decoderClass());
			}else{
				decoder = InnerMsgUdpDatagramDecoder.class;
			}
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
		
	public NettyUDPServer(IBroadcastConfig config, Class decoder){
		init(config, decoder, null);
	}
	
	public NettyUDPServer(int port, Class decoder){
		this(0, "255.255.255.255", port, decoder);
	}
	
	public NettyUDPServer(int broadcastId, String addr, int port, Class decoder){
		IBroadcastConfig conf = new BroadcastConfig(broadcastId, addr, port);
		init(conf, decoder, null);
	}
	
	public int serverId() {
		return this.config.broadcastId();
	}
	
	public IBroadcastConfig getConfig() {
		return this.config;
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

	
	private void init(IBroadcastConfig config, Class decoder, Class encoder){
		try{
			this.config = config;
			this.execution = new ProcessorExecution(WorkThreadSize, "NettyUDPServerOnPort" + config.broadcastPort());
			this.execution.setTaskThreshold(config.taskThreshold());
			this.decoder = decoder;

			this.useRSA = config.useRSA();
			this.inverseRSA = config.inverseRSA();
			this.selfModulus = config.rsaServerModulus();
			this.selfPrivateExp = config.rsaServerPrivateExp();
			this.selfPublicExp = config.rsaServerPublicExp();
			this.clientPublicExp = config.rsaClientPublicExp();
			this.clientModulus = config.rsaClientModulus();
						
			if(!StringUtility.isNullOrEmpty(config.loggerName())){
				log(AppLoggers.getLog(logDir, config.loggerName()));
			}
			if(!StringUtility.isNullOrEmpty(config.errorLoggerName())){
				this.errorLog = AppLoggers.getLog(logDir, config.errorLoggerName());
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
			
			if(!StringUtility.isNullOrEmpty(config.initPluginClass())){
				Class plugin = Class.forName(config.initPluginClass());
				ServerPlug plug = (ServerPlug) plugin.newInstance();
				plug.plugin(this);
			}
		}catch(Exception e){
			String msg = ConsoleUtility.getStackTrace(e);
			QueueLog.error(log(), msg);
			throw new RuntimeException(e);
		}
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
				}else{
					datagram = (Datagram) this.exceptionDatagramClass.newInstance();
					datagram.command(this.config.exceptionPacketId());
				}
				datagram.packetMsg(errmsg);
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
	
	public void setAttach(Object value){
		this.attach = value;
	}
	
	public void log(Logger log){
		this.log = log;
	}
	
	public Logger log(){
		if(log == null){
			this.log = globalLog;
		}
		return this.log;
	}
	
	public void setTrackPacket(boolean value){
		this.config.trackPacket(value);
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

	public void close(){
		closeWithReuse(false);
	}
	
	synchronized private void closeWithReuse(boolean reuse){
		this.contex = null;
		try{
			this.execution.stopWithReuse(reuse);
		}catch(Exception e){
			QueueLog.error(this.log(), e.getMessage());
		}
		
		try{
			if(bindFuture != null && reuse == false){
		        ChannelFuture cf = bindFuture.channel().close();
		        cf.addListener(new ChannelFutureListener(){
					@Override
					public void operationComplete(ChannelFuture future) throws Exception {
						QueueLog.info(log(), "udpserver on port {} closed", config.broadcastPort());
					}
		        	
		        });
		        cf.syncUninterruptibly();
		        bindFuture = null;
			}
		}catch(Exception e){
			QueueLog.error(this.log(), e.getMessage());
		}
		
	}

	synchronized public void run(){
		if(bindFuture != null){
			return;
		}
		pluginServer();
		
        try {
            // NIO辅助启动类
        	if(workerGroup == null){
        		workerGroup = new NioEventLoopGroup(WorkThreadSize);
        	}
            Bootstrap bootstrap = new Bootstrap();
            bootstrap.group(workerGroup)
                    .channel(NioDatagramChannel.class)// 类似NIO中serverSocketChannel
                    .option(ChannelOption.SO_BROADCAST, true)
                    .handler(new InitChannelHandler(this.execution, this.decoder, this));
 
            bindFuture = bootstrap.bind(this.config.broadcastPort());
            bindFuture.addListener(new ChannelFutureListener(){
				@Override
				public void operationComplete(ChannelFuture future) throws Exception {
					QueueLog.info(log(), "udpserver bind on port {}", config.broadcastPort());
				}
            	
            });
            bindFuture.sync();
 
        }catch(Exception e){
        	closeWithReuse(false);
        	QueueLog.error(this.log(), e.getMessage());
        }
 
    }
	
	public boolean isClosed(){
		return this.bindFuture == null;
	}
	
	public void broadcast(Datagram data){
		if(this.isClosed()){
			throw new RuntimeException("client_is_closed");
		}
		try{
			if(this.contex == null){
				synchronized(this){
					this.wait(10000);
				}
			}
			if(this.contex != null){
				this.contex.channel().writeAndFlush(data);
			}else{
				QueueLog.error(this.log(), "the contex is null, cannot broadcast, now");
			}
		}catch(Exception e){
			QueueLog.error(this.log(), e.getMessage());
		}
	}
	
	/**
     * 网络事件处理器
     */
    private static class InitChannelHandler extends ChannelInitializer<NioDatagramChannel> {
    	private ProcessorExecution execution;
    	private Class decoder;
       	private NettyUDPServer owner;
    	
    	public InitChannelHandler(ProcessorExecution execution, Class decoder, NettyUDPServer owner){
    		this.execution = execution;
    		this.decoder = decoder;
    		this.owner = owner;
    	}

		@Override
		protected void initChannel(NioDatagramChannel ch) throws Exception {
			InetSocketAddress addr = new InetSocketAddress(this.owner.config.broadcastAddress(), this.owner.config.broadcastPort());
			DatagramPacketEncoder encoder = new DatagramPacketEncoder(addr);
    		if(encoder instanceof RSASetup){
    			RSASetup rsasetup = (RSASetup) encoder;
    			rsasetup.setUseRSA(this.owner.useRSA);
    			if(this.owner.inverseRSA){
        			rsasetup.setPublicKey(this.owner.selfModulus, this.owner.selfPrivateExp);
    			}else{
        			rsasetup.setPublicKey(this.owner.clientModulus, this.owner.clientPublicExp);
    			}
    		}
    		
    		MessageToMessageDecoder<Datagram> msgdecoder = (MessageToMessageDecoder<Datagram>)this.decoder.newInstance();
    		if(msgdecoder instanceof RSASetup){
    			RSASetup rsasetup = (RSASetup) msgdecoder;
    			rsasetup.setPrivateKey(this.owner.selfModulus, this.owner.selfPrivateExp);
    		}
            ch.pipeline().addLast(msgdecoder, 
            		encoder, 
            		new OutboundHandler(this.owner),
            		new TransHandler(this.execution, this.owner));
		}
 
    }
    
    
    private static class TransHandler extends SimpleChannelInboundHandler<Datagram> {
    	private ProcessorExecution execution;
       	private NettyUDPServer owner;
    	private long serverNum;
           	
    	public TransHandler(ProcessorExecution execution, NettyUDPServer owner){
    		super(true);
    		this.execution = execution;
    		this.owner = owner;
    		serverNum = ServerAddress.getDistinctCode(IPUtility.getLocalIps()[0], this.owner.config.broadcastPort());
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
            	
        		String cmd = StringUtility.toHex(msg.command());
            	if(this.owner.config.trackPacket()){
            		QueueLog.debug(this.owner.log(), "UDPRX packet, command:{}, length:{}, \nUDPRX: {}", cmd, msg.length(), msg.toHexString());
            	}else{
            		QueueLog.debug(this.owner.log(), "UDPRX packet, command:{}, length:{}", cmd, msg.length());
            	}

            	ProcessorContext proctx = new ProcessorContext(ctx.channel(), msg, serverNum);
            	proctx.setAttach(this.owner.attach);
            	proctx.setAllowSend(false);
            	
            	execution.execute(msg.command(), proctx);
        	}catch(Exception err){
    			Datagram datagram = this.owner.treatCommonException(err);
    			if(datagram != null){
    				ctx.channel().writeAndFlush(datagram);
    			}
        	}
		}
		
        @Override
		public void channelActive(ChannelHandlerContext ctx) throws Exception {
        	if(this.owner.contex == null){
            	synchronized(this.owner){
                	this.owner.contex = ctx;
        			this.owner.notify();
            	}
        	}
        	SocketAddress local = ctx.channel().localAddress();
        	SocketAddress remote = ctx.channel().remoteAddress();
        	if(remote != null){
        		QueueLog.debug(this.owner.log(), "channelActive, remoteAddress {}", remote.toString());
        	}else{
        		QueueLog.debug(this.owner.log(), "channelActive, localAddress {}", local.toString());
        	}
		}

		@Override
		public void channelUnregistered(ChannelHandlerContext ctx) throws Exception {
        	SocketAddress client = ctx.channel().remoteAddress();
        	String key = client == null ? "" : client.toString();
        	this.owner.execution.removeSession(ctx.channel());
        	QueueLog.debug(this.owner.log(), "client channel unregistered, {}, ChannelHandlerContext:{}, channel obj:{}", 
        			key, ctx.toString(), ctx.channel().toString());
		}

		@Override
		public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        	SocketAddress local = ctx.channel().localAddress();
        	SocketAddress remote = ctx.channel().remoteAddress();
        	if(remote != null){
        		QueueLog.info(this.owner.log(), "channelInactive, remoteAddress {}", remote.toString());
        	}else{
        		QueueLog.info(this.owner.log(), "channelInactive, localAddress {}", local.toString());
        	}
		}

		@Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
			QueueLog.error(this.owner.log(), "exception, cause:{}", cause.getMessage());

			Datagram datagram = this.owner.treatCommonException(cause);
			if(datagram != null){
				ctx.channel().writeAndFlush(datagram);
			}
			
			if(this.owner.config.closeOnException()){
				ctx.channel().close();
			}

        }
		
		public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
			Datagram outdata = (Datagram) msg;
    		String cmd = StringUtility.toHex(outdata.command());
        	if(this.owner.config.trackPacket()){
        		QueueLog.debug(this.owner.log(), "UDPTX packet, command:{}, length:{}, \nUDPTX: {}", cmd, outdata.length(), outdata.toHexString());
        	}else{
        		QueueLog.debug(this.owner.log(), "UDPTX packet, command:{}, length:{}", cmd, outdata.length());
        	}
		}

    }

    private static class OutboundHandler extends ChannelOutboundHandlerAdapter {
       	private NettyUDPServer owner;

       	public OutboundHandler(NettyUDPServer owner){
       		this.owner = owner;
       	}
       	
		@Override
		public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
			super.write(ctx, msg, promise);
			Datagram outdata = (Datagram) msg;
    		String cmd = StringUtility.toHex(outdata.command());
        	if(this.owner.config.trackPacket()){
        		QueueLog.debug(this.owner.log(), "UDPTX packet, command:{}, length:{}, \nUDPTX: {}", cmd, outdata.length(), outdata.toHexString());
        	}else{
        		QueueLog.debug(this.owner.log(), "UDPTX packet, command:{}, length:{}", cmd, outdata.length());
        	}
		}
    	
    }
}
