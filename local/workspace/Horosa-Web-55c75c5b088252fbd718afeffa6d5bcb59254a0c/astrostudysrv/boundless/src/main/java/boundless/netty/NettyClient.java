package boundless.netty;

import java.net.SocketAddress;
import java.util.function.Consumer;
import java.util.function.Function;

import io.netty.bootstrap.Bootstrap;
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
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioSocketChannel;
import io.netty.handler.codec.ByteToMessageDecoder;
import io.netty.handler.codec.MessageToByteEncoder;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.function.Consumer3;
import boundless.function.Consumer3Delegate;
import boundless.log.QueueLog;
import boundless.net.client.socket.CommRSASetup;
import boundless.net.internal.ClientConfiguration;
import boundless.net.internal.IClientConfiguration;
import boundless.netty.PacketRegistor;
import boundless.netty.ProcessorContext;
import boundless.netty.ProcessorExecution;
import boundless.security.RSASetup;
import boundless.types.OutParameter;
import boundless.utility.ConsoleUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class NettyClient implements IClient {
	public static final Logger globalLog = LoggerFactory.getLogger(NettyClient.class);
	public static final int WorkThreadSize = 2;
	
	private EventLoopGroup workerGroup = new NioEventLoopGroup(1);
		
	private Object attach;
	private int type = 0;
	private int callbackCounter = 1;
	private int timeout = 3000;

	private IClientConfiguration config;
	private ProcessorExecution execution;
	private Class decoder;
	private Class encoder;
	private ChannelFuture connectFuture = null;
	private Bootstrap bootstrap;
	
	private Logger log;
	private Logger errorLog;
	private ChannelHandlerContext contex;
	private Consumer3Delegate<Throwable, String, Integer> exceptionHandle;
	private boolean closeOnException = false;
	private boolean exceptionMsgReturn = false;
	private Class exceptionDatagramClass;
	private int exceptionPacketId = 0;
	
	private Object connLock = new Object();
	private boolean connected = false;
	
	private Consumer3<NettyClient, SocketAddress, SocketAddress> connectHandler;
	private Consumer3<NettyClient, SocketAddress, SocketAddress> disconnectHandler;

	private boolean useRSA;
	private boolean inverseRSA = true;

	public NettyClient(IClientConfiguration config, Class decoder, Class encoder){
		this.config = config;
		String tfname = String.format("NettyClient_%s:%d", config.serverAddress(), config.port());
		this.execution = new ProcessorExecution(WorkThreadSize, tfname);
		this.decoder = decoder;
		this.encoder = encoder;
		if(encoder == null){
			this.encoder = DatagramEncoder.class;
		}
		this.exceptionHandle = new Consumer3Delegate<Throwable, String, Integer>();
	}
	
	public NettyClient(IClientConfiguration config, Class decoder){
		this(config, decoder, null);
	}
	
	public NettyClient(String servaddr, int port, Class decoder, Class encoder){
		this(servaddr, port, decoder, encoder, false);
	}
	
	public NettyClient(String servaddr, int port, Class decoder, Class encoder, boolean trackPacket){
		this(0, servaddr, port, decoder, encoder, trackPacket);
	}
	
	public NettyClient(String servaddr, int port, Class decoder){
		this(servaddr, port, decoder, false);
	}
	
	public NettyClient(String servaddr, int port, Class decoder, boolean trackPacket){
		this(servaddr, port, decoder, null, trackPacket);
	}
	
	public NettyClient(int servId, String servaddr, int port, Class decoder){
		this(servId, servaddr, port, decoder, null, false);
	}
	
	public NettyClient(int servId, String servaddr, int port, Class decoder, Class encoder, boolean trackPacket){
		ClientConfiguration conf = new ClientConfiguration((short)servId, servaddr, port);
		conf.trackPacket(trackPacket);
		this.config = conf;
		String tfname = String.format("NettyClient_%s:%d", config.serverAddress(), config.port());
		this.execution = new ProcessorExecution(WorkThreadSize, tfname);
		this.decoder = decoder;
		this.encoder = encoder;
		if(encoder == null){
			this.encoder = DatagramEncoder.class;
		}
		this.exceptionHandle = new Consumer3Delegate<Throwable, String, Integer>();
	}
	
	public void setUseRSA(boolean value){
		this.useRSA = value;
	}
	
	public void setInverseRSA(boolean value){
		this.inverseRSA = value;
	}
	
	public void setExceptionDatagram(String classname){
		try {
			this.exceptionDatagramClass = Class.forName(classname);
		} catch (ClassNotFoundException e) {
			this.exceptionDatagramClass = null;
		}
		
		this.execution.setCommExceptionHandler(new Function<Throwable, Datagram>(){
			@Override
			public Datagram apply(Throwable t) {
				return treatCommonException(t);
			}
			
		});
	}
	
	public void setExceptionPacketId(int packetid){
		this.exceptionPacketId = packetid;
	}
	
	public void setExceptionMsgReturn(boolean value){
		this.exceptionMsgReturn = value;
	}
	
	public void setCloseOnException(boolean value){
		this.closeOnException = value;
	}
	
	public void setConnectHandler(Consumer3<NettyClient, SocketAddress, SocketAddress> connectHandler){
		this.connectHandler = connectHandler;
	}
	public void setDisconnectHandler(Consumer3<NettyClient, SocketAddress, SocketAddress> disconnectHandler){
		this.disconnectHandler = disconnectHandler;
	}
	
	public void setAttach(Object value){
		this.attach = value;
	}
	
	public void log(Logger log){
		this.log = log;
	}
	
	public Logger log(){
		if(log == null){
			this.log = NettyClient.globalLog;
		}
		return this.log;
	}
	
	public void errorLog(Logger log){
		this.errorLog = log;
	}
	
	public Logger errorLog(){
		if(errorLog == null){
			this.errorLog = log();
		}
		return this.errorLog;
	}
	
	public void setType(int n){
		this.type = n;
	}
	
	public int getType(){
		return this.type;
	}
	
	private Datagram treatCommonException(Throwable err){
		Logger errlog = this.errorLog;
		if(errlog == null){
			errlog = this.log();
		}
		
		try{
			this.exceptionHandle.execute(err, this.config.serverAddress(), this.config.port());
		}catch(Exception e){
			QueueLog.error(errlog, e);
		}
		
		if(this.exceptionMsgReturn){
			try{
				String errmsg = "err:" + err.getMessage();
				Datagram datagram;
				if(this.exceptionDatagramClass == null){
					datagram = new StringDatagram(errmsg.getBytes("UTF-8"));
				}else{
					datagram = (Datagram) this.exceptionDatagramClass.newInstance();
					datagram.command(this.exceptionPacketId);
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
	

	public void setDefaultCallbackHandler(Consumer<ProcessorContext> handler){
		this.execution.setDefaultCallbackHandler(handler);
	}
	
	public void addExceptionHandle(Consumer3<Throwable, String, Integer> handle){
		this.exceptionHandle.add(handle);
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

	private void removeChannel(Channel ctx){
		if(ctx.remoteAddress() != null){
			QueueLog.info(log, "session closed correspond to channel-{}", ctx.remoteAddress());
		}else{
			QueueLog.info(log, "session closed correspond to channel-{}", ctx);
		}
	}
	
	private void forceClose(){
		this.contex = null;
		this.connected = false;
		try{
			this.execution.stopWithReuse(false);
		}catch(Exception e){
			QueueLog.error(errorLog(), e);
		}
		try{
			this.workerGroup.shutdownGracefully();
		}catch(Exception e){
			QueueLog.error(errorLog(), e.getMessage());
		}
		try{
			if(connectFuture != null){
		        ChannelFuture cf = connectFuture.channel().close();
		        cf.addListener(new ChannelFutureListener(){
					@Override
					public void operationComplete(ChannelFuture future) throws Exception {
						QueueLog.info(log(), "disconnect from {}:{} closed", config.serverAddress(), config.port());
					}
		        	
		        });
		        cf.syncUninterruptibly();
		        connectFuture = null;
			}
		}catch(Exception e){
			QueueLog.error(errorLog(), e);
		}
	}
	
	public void close(){
		if(!connected){
			return;
		}
		
		forceClose();
	}
	
	synchronized private void closeWithReuse(boolean reuse){
		this.contex = null;
		this.connected = false;
		try{
			this.execution.stopWithReuse(reuse);
		}catch(Exception e){
			QueueLog.error(errorLog(), e);
		}
		
		try{
			if(connectFuture != null){
		        ChannelFuture cf = connectFuture.channel().close();
		        cf.addListener(new ChannelFutureListener(){
					@Override
					public void operationComplete(ChannelFuture future) throws Exception {
						QueueLog.info(log(), "disconnect from {}:{} closed", config.serverAddress(), config.port());
					}
		        	
		        });
		        cf.syncUninterruptibly();
		        connectFuture = null;
			}
		}catch(Exception e){
			QueueLog.error(errorLog(), e);
		}
		
	}

	synchronized public void connect(){
		if(connectFuture != null){
			return;
		}
		
        try {
            // NIO辅助启动类
            bootstrap = new Bootstrap();
            bootstrap.group(workerGroup)
                    .channel(NioSocketChannel.class)// 类似NIO中serverSocketChannel
                    .option(ChannelOption.SO_KEEPALIVE, true).option(ChannelOption.CONNECT_TIMEOUT_MILLIS, timeout)
                    .handler(new InitChannelHandler(this.execution, this.decoder, this.encoder, this));
 
            // 连接服务器 同步等待成功 主要用于异步操作的通知回调 回调处理用的ChannelHandler
            connectFuture = bootstrap.connect(config.serverAddress(), config.port());
        }catch(Exception e){
        	forceClose();
        	try{
            	this.treatCommonException(e);
        	}catch(Exception err){
        		QueueLog.error(errorLog(), err);
        	}
        }
 
    }
	
	synchronized public void reconnect(){
		try{
			closeWithReuse(true);
			connect();
		}catch(Exception e){
        	String errmsg = ConsoleUtility.getStackTrace(e);
        	QueueLog.error(log(), errmsg);
		}
	}
	
	public String getServerIp(){
		return config.serverAddress();
	}
	
	public int getServerPort(){
		return config.port();
	}
	
	public boolean isClosed(){
		return this.connectFuture == null || this.connected == false || this.contex == null;
	}
	
	public void send(Datagram data){
		try{
			if(this.isClosed()){
				throw new RuntimeException("client_not_ready");
			}
			this.contex.channel().writeAndFlush(data);
		}catch(Exception e){
			try{
				this.exceptionHandle.execute(e, this.config.serverAddress(), this.config.port());
			}catch(Exception err){
				QueueLog.error(errorLog(), err);
			}
        	QueueLog.error(errorLog(), e.getMessage());
		}
	}
	
	public void send(Datagram data, int timeoutSec, Consumer<ProcessorContext> handler){
		send(data, timeoutSec, handler, (e)->{
			QueueLog.error(log(), e);
		});
	}
	
	public void send(Datagram data, Consumer<ProcessorContext> handler){
		send(data, 30, handler);
	}
	
	public void send(Datagram data, int timeoutSec, Consumer<ProcessorContext> handler, Consumer<Throwable> errorHandler){
		send(data, timeoutSec, handler, errorHandler, null);
	}
	
	private void send(Datagram data, int timeoutSec, Consumer<ProcessorContext> handler, Consumer<Throwable> errorHandler, OutParameter<Integer> cbno){
		if(this.isClosed()){
			RuntimeException e = new RuntimeException("client_is_closed | client_not_ready");
			try{
				this.exceptionHandle.execute(e, this.config.serverAddress(), this.config.port());
			}catch(Exception err){
				QueueLog.error(errorLog(), err);
			}
        	QueueLog.error(errorLog(), e.getMessage());
        	return;
		}
		
		if(data.getCallbackno() == 0){
			if(callbackCounter == 0){
				callbackCounter = 1;
			}
			int no = callbackCounter++;
			if(cbno != null){
				cbno.value = no;
			}
			data.setCallbackno(no);
		}
		if(handler != null){
			this.execution.registerCallback(data.getCallbackno(), handler, timeoutSec, errorHandler);
		}
		send(data);
	}
	
	public void send(Datagram data, Consumer<ProcessorContext> handler, Consumer<Throwable> errorHandler){
		send(data, 30, handler, errorHandler);
	}
	
	public boolean syncSend(Datagram data){
		return syncSend(data, 10000);
	}
	
	public boolean syncSend(Datagram data, long timeoutms){
		if(this.isClosed()){
			return false;
		}
		try{
			if(this.contex == null){
				synchronized(this){
					this.wait();
				}
			}
			return this.contex.channel().writeAndFlush(data).awaitUninterruptibly(timeoutms);
		}catch(Exception e){
			QueueLog.error(this.errorLog(), e.getMessage());
		}
		return false;
	}
	
	public Datagram request(Datagram data, long timeoutInSec){
		Object lock = new Object();
		OutParameter<Datagram> response = new OutParameter<Datagram>();
		OutParameter<Throwable> exparam = new OutParameter<Throwable>();

		OutParameter<Integer> cbno = new OutParameter<Integer>();
		
		this.send(data, (int)timeoutInSec, (ctx)->{
			response.value = ctx.getInData();
			synchronized(lock){
				lock.notifyAll();
			}
		}, (err)->{
			exparam.value = err;
			synchronized(lock){
				lock.notifyAll();
			}
		}, cbno);
		
		synchronized(lock){
			try {
				lock.wait(timeoutInSec * 1000);
			} catch (InterruptedException e1) {
				throw new RuntimeException(e1);
			}
		}
		
		if(exparam.value != null){
			if(cbno.value != null){
				this.execution.removeCallback(cbno.value);
			}
			throw new RuntimeException(exparam.value);
		}
		if(response.value == null){
			if(cbno.value != null){
				this.execution.removeCallback(cbno.value);
			}
			throw new RuntimeException("request.timeout");
		}
		
		return response.value;
	}
	
	public Datagram request(Datagram data){
		return request(data, 30000);
	}
	
	/**
     * 网络事件处理器
     */
    private static class InitChannelHandler extends ChannelInitializer<SocketChannel> {
    	private ProcessorExecution execution;
    	private Class decoder;
    	private Class encoder;
       	private NettyClient owner;
    	
    	public InitChannelHandler(ProcessorExecution execution, Class decoder, Class encoder, NettyClient owner){
    		this.execution = execution;
    		this.decoder = decoder;
    		this.encoder = encoder;
    		this.owner = owner;
    	}

    	@Override
        protected void initChannel(SocketChannel ch) throws Exception {
    		ByteToMessageDecoder decoderObj = (ByteToMessageDecoder)this.owner.decoder.newInstance();
    		MessageToByteEncoder<Datagram> encoderObj = (MessageToByteEncoder<Datagram>)this.owner.encoder.newInstance();
    		if(decoderObj instanceof RSASetup){
    			RSASetup rsasetup = (RSASetup) decoderObj;
    			if(this.owner.inverseRSA){
        			rsasetup.setPrivateKey(CommRSASetup.modulus, CommRSASetup.publicExp);
    			}else{
        			rsasetup.setPrivateKey(CommRSASetup.selfModulus, CommRSASetup.selfPrivateExp);
    			}
    		}
    		if(encoderObj instanceof RSASetup){
    			RSASetup rsasetup = (RSASetup) encoderObj;
    			rsasetup.setUseRSA(this.owner.useRSA);
    			rsasetup.setPublicKey(CommRSASetup.modulus, CommRSASetup.publicExp);
    		}
            ch.pipeline().addLast(decoderObj, encoderObj, 
            		new OutboundHandler(this.owner),
            		new TransHandler(this.execution, this.owner));
        }
 
    }
    
    
    private static class TransHandler extends SimpleChannelInboundHandler<Datagram> {
    	private ProcessorExecution execution;
       	private NettyClient owner;
            	
    	public TransHandler(ProcessorExecution execution, NettyClient owner){
    		super(true);
    		this.execution = execution;
    		this.owner = owner;
    	}
    	
		@Override
		protected void channelRead0(ChannelHandlerContext ctx, Datagram msg) throws Exception {
			messageReceived(ctx, msg);
		}

        public void messageReceived(ChannelHandlerContext ctx, Datagram msg) throws Exception {
        	try{
            	if(msg == null){
            		return;
            	}
            	Datagram indata = (Datagram) msg;
            	SocketAddress server = ctx.channel().remoteAddress();
            	String cmd = StringUtility.toHex(indata.command());
        		String ncmdstr = ConvertUtility.getValueAsUInt32(indata.command()) + "";
            	if(this.owner.config.trackPacket()){
            		QueueLog.debug(this.owner.log(), "clientRX packet, command:{};dec:{}, length:{}, from:{} \n{}", cmd, ncmdstr, indata.length(), server, indata.toHexString());
            	}else{
            		QueueLog.debug(this.owner.log(), "clientRX packet, command:{};dec:{}, length:{}, from:{}", cmd, ncmdstr, indata.length(), server);
            	}

            	ProcessorContext proctx = new ProcessorContext(ctx.channel(), indata, this.owner.config.serverNum());
            	proctx.setAttach(this.owner.attach);
            	execution.execute(indata.command(), proctx);

        	}catch(Exception err){
        		this.owner.log().error(err.getMessage());
        	}
        	
        }
         
        
        @Override
		public void channelActive(ChannelHandlerContext ctx) throws Exception {
            synchronized(this.owner.connLock){
            	this.owner.connected = true;
            	this.owner.connLock.notifyAll();
            }
        	if(this.owner.contex == null){
            	synchronized(this.owner){
                	this.owner.contex = ctx;
        			this.owner.notifyAll();
            	}
        	}
        	SocketAddress server = ctx.channel().remoteAddress();
        	QueueLog.info(this.owner.log(), "channelActive, client connected to {}", server.toString());
        	
        	if(this.owner.connectHandler != null){
        		this.owner.connectHandler.accept(this.owner, server, ctx.channel().localAddress());
        	}
		}

		@Override
		public void channelUnregistered(ChannelHandlerContext ctx) throws Exception {
        	SocketAddress server = ctx.channel().remoteAddress();
        	if(server == null){
        		QueueLog.debug(this.owner.log(), "client channel unregistered, ChannelHandlerContext:{}, channel obj:{}", 
            			ctx.toString(), ctx.channel().toString());
        		try{
            		this.owner.close();
        		}catch(Exception e){
        		}
            	if(this.owner.disconnectHandler != null){
            		this.owner.disconnectHandler.accept(this.owner, server, ctx.channel().localAddress());
            	}
        		return;
        	}
        	
        	this.owner.execution.removeSession(ctx.channel());
        	QueueLog.debug(this.owner.log(), "client channel unregistered and disconnect from server:{}, ChannelHandlerContext:{}, channel obj:{}", 
        			server.toString(), ctx.toString(), ctx.channel().toString());
        	
    		try{
        		this.owner.close();
    		}catch(Exception e){
    		}
        	if(this.owner.disconnectHandler != null){
        		this.owner.disconnectHandler.accept(this.owner, server, ctx.channel().localAddress());
        	}
		}

		@Override
		public void channelInactive(ChannelHandlerContext ctx) throws Exception {
			this.owner.removeChannel(ctx.channel());
			
        	SocketAddress server = ctx.channel().remoteAddress();
        	QueueLog.info(this.owner.log(), "channelInactive from {}", server.toString());
		}

		@Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
			QueueLog.error(this.owner.log(), "exception, cause:{}", cause.getMessage());

			Datagram datagram = this.owner.treatCommonException(cause);
			if(datagram != null){
				ctx.channel().writeAndFlush(datagram);
			}
			
			if(this.owner.closeOnException){
				this.owner.removeChannel(ctx.channel());
				ctx.close();
				this.owner.close();
			}
			
        }
		
		public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
			Datagram outdata = (Datagram) msg;
    		String cmd = StringUtility.toHex(outdata.command());
    		String ncmdstr = ConvertUtility.getValueAsUInt32(outdata.command()) + "";
        	if(this.owner.config.trackPacket()){
        		QueueLog.debug(this.owner.log(), "clientTX packet, command:{};dec:{}, length:{}, to {}:{}, \n{}", 
        				cmd, ncmdstr, outdata.length(), this.owner.config.serverAddress(), this.owner.config.port(), outdata.toHexString());
        	}else{
        		QueueLog.debug(this.owner.log(), "clientTX packet, command:{};dec:{}, length:{}, to {}:{}", 
        				cmd, ncmdstr, outdata.length(), this.owner.config.serverAddress(), this.owner.config.port());
        	}
		}

    }

    private static class OutboundHandler extends ChannelOutboundHandlerAdapter{
    	private NettyClient owner;
    	
    	public OutboundHandler(NettyClient owner){
    		this.owner = owner;
    	}
    	
		public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
			super.write(ctx, msg, promise);
			
			Datagram outdata = (Datagram) msg;
    		String cmd = StringUtility.toHex(outdata.command());
    		String ncmdstr = ConvertUtility.getValueAsUInt32(outdata.command()) + "";
        	if(this.owner.config.trackPacket()){
        		QueueLog.debug(this.owner.log(), "clientTX packet, command:{};dec:{}, length:{}, to {}:{} \n{}", 
        				cmd, ncmdstr, outdata.length(), this.owner.config.serverAddress(), this.owner.config.port(), outdata.toHexString());
        	}else{
        		QueueLog.debug(this.owner.log(), "clientTX packet, command:{};dec:{}, length:{}, to {}:{}", 
        				cmd, ncmdstr, outdata.length(), this.owner.config.serverAddress(), this.owner.config.port());
        	}
		}

    }
}
