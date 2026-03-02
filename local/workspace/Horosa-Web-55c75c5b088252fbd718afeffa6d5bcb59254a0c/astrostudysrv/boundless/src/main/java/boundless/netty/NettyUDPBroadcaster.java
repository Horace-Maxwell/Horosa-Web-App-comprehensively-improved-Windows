package boundless.netty;

import io.netty.bootstrap.Bootstrap;
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
import io.netty.channel.socket.nio.NioDatagramChannel;

import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.log.QueueLog;
import boundless.utility.StringUtility;

public class NettyUDPBroadcaster implements Broadcast {
	public static final Logger globalLog = LoggerFactory.getLogger(NettyUDPBroadcaster.class);
	public static final int WorkThreadSize = 1;

	private static EventLoopGroup workerGroup = null;
		
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
	
	private Logger log;
	private ChannelHandlerContext contex;
	private ChannelFuture bindFuture = null;

	public NettyUDPBroadcaster(IBroadcastConfig config){
		this.config = config;
	}
		
	public NettyUDPBroadcaster(int port){
		this(0, "255.255.255.255", port);
	}
	
	public NettyUDPBroadcaster(int broadcastId, String addr, int port){
		IBroadcastConfig conf = new BroadcastConfig(broadcastId, addr, port);
		this.config = conf;
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
	

	synchronized public void close(){
		try{
			if(bindFuture != null){
		        ChannelFuture cf = bindFuture.channel().close();
		        cf.addListener(new ChannelFutureListener(){
					@Override
					public void operationComplete(ChannelFuture future) throws Exception {
						QueueLog.info(log(), "udpbroadcaster on port {} closed", config.broadcastPort());
					}
		        	
		        });
		        cf.syncUninterruptibly();
		        bindFuture = null;
			}
		}catch(Exception e){
			e.printStackTrace();
		}
	}
	
	synchronized public void run(){
		if(bindFuture != null){
			return;
		}
        try {
            // NIO辅助启动类
        	if(workerGroup == null){
        		workerGroup = new NioEventLoopGroup(WorkThreadSize);
        	}
            Bootstrap bootstrap = new Bootstrap();
            bootstrap.group(workerGroup)
                    .channel(NioDatagramChannel.class)// 类似NIO中serverSocketChannel
                    .option(ChannelOption.SO_BROADCAST, true)
                    .handler(new InitChannelHandler(this));
 
            bindFuture = bootstrap.bind(0);
            bindFuture.addListener(new ChannelFutureListener(){
				@Override
				public void operationComplete(ChannelFuture future) throws Exception {
					QueueLog.info(log(), "udpbroadcaster bind on port 0, ready to broadcast msg");
				}
            	
            });
            bindFuture.sync();
        }catch(Exception e){
        	QueueLog.error(this.log(), e);
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
			QueueLog.error(this.log(), e);
		}
	}
	
	
	/**
     * 网络事件处理器
     */
    private static class InitChannelHandler extends ChannelInitializer<NioDatagramChannel> {
       	private NettyUDPBroadcaster owner;
    	
    	public InitChannelHandler(NettyUDPBroadcaster owner){
    		this.owner = owner;
    	}

		@Override
		protected void initChannel(NioDatagramChannel ch) throws Exception {
			InetSocketAddress addr = new InetSocketAddress(this.owner.config.broadcastAddress(), this.owner.config.broadcastPort());
			DatagramPacketEncoder encoder = new DatagramPacketEncoder(addr);
            ch.pipeline().addLast(encoder, new OutboundHandler(this.owner), new TransHandler(this.owner));
		}
 
    }
    
    
    private static class TransHandler extends SimpleChannelInboundHandler<Datagram> {
       	private NettyUDPBroadcaster owner;
            	
    	public TransHandler(NettyUDPBroadcaster owner){
    		super(true);
    		this.owner = owner;
    	}
    	
		@Override
		protected void channelRead0(ChannelHandlerContext ctx, Datagram msg) throws Exception {
			messageReceived(ctx, msg);
		}

        public void messageReceived(ChannelHandlerContext ctx, Datagram msg) throws Exception {
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
        		QueueLog.info(this.owner.log(), "channelActive, remoteAddress{}", remote.toString());
        	}else{
        		QueueLog.info(this.owner.log(), "channelActive, localAddress {}", local.toString());
        	}
		}

		@Override
		public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        	SocketAddress local = ctx.channel().localAddress();
        	SocketAddress remote = ctx.channel().remoteAddress();
        	if(remote != null){
        		QueueLog.info(this.owner.log(), "channelInactive, remoteAddress{}", remote.toString());
        	}else{
        		QueueLog.info(this.owner.log(), "channelInactive, localAddress {}", local.toString());
        	}
		}

		@Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
			QueueLog.error(this.owner.log(), "exception, cause:{}", cause.getMessage());
        }
		
		public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
			Datagram outdata = (Datagram) msg;
    		String cmd = StringUtility.toHex(outdata.command());
        	if(this.owner.config.trackPacket()){
        		QueueLog.debug(this.owner.log(), "UDPTX, command:{}, length:{}, \nallrawdata: {}", cmd, outdata.length(), outdata.toHexString());
        	}else{
        		QueueLog.debug(this.owner.log(), "UDPTX, command:{}, length:{}", cmd, outdata.length());
        	}
		}

    }

    private static class OutboundHandler extends ChannelOutboundHandlerAdapter{
    	private NettyUDPBroadcaster owner;
    	
    	public OutboundHandler(NettyUDPBroadcaster owner){
    		this.owner = owner;
    	}
    	
		public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
			super.write(ctx, msg, promise);
			
			Datagram outdata = (Datagram) msg;
    		String cmd = StringUtility.toHex(outdata.command());
        	if(this.owner.config.trackPacket()){
        		QueueLog.debug(this.owner.log(), "UDPTX, command:{}, length:{}, \nallrawdata: {}", cmd, outdata.length(), outdata.toHexString());
        	}else{
        		QueueLog.debug(this.owner.log(), "UDPTX, command:{}, length:{}", cmd, outdata.length());
        	}
		}

   }

	
}
