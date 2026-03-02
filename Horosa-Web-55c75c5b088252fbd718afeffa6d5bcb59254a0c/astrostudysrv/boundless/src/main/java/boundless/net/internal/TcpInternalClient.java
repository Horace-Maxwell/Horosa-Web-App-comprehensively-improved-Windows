package boundless.net.internal;

import java.net.InetSocketAddress;
import java.util.*;
import java.util.function.Consumer;

import io.netty.bootstrap.*;
import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelPipeline;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioSocketChannel;
import io.netty.handler.codec.MessageToMessageDecoder;
import boundless.console.ApplicationUtility;
import boundless.function.*;
import boundless.io.FileUtility;
import boundless.net.IDataReceiver;
import boundless.net.external.*;
import boundless.threading.*;
import boundless.utility.FormatUtility;
import boundless.utility.IPUtility;
import boundless.log.*;

/**
 * 内部客户端
 *
 */
public class TcpInternalClient implements ITcpInternalSender,ITicker
{
    private TcpInternalRemote _remote;
    private AsyncCallbackManager _asyncManager = null;
    private GenericPacketManager<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> _packetManager;
    private RemoteListener _listener;
    private TickThread _workThread;
    private IClientConfiguration _config;
    private IServerConfiguration _local;
    private boolean _autoReconnect=true;
    private boolean _connected = false;
    private Logger _logger;
    private Logger _networkErrorLogger;

    //当客户端几条连接都连接上时。在并发线程里
    private ConsumerDelegate<TcpInternalClient> _connectDelegate=new ConsumerDelegate<TcpInternalClient>();
    //当客户端几条连接都断开时。在并发线程里
    private ConsumerDelegate<TcpInternalClient> _disconnectDelegate=new ConsumerDelegate<TcpInternalClient>();

    public TcpInternalClient(IClientConfiguration config, IServerConfiguration local)
    {
    	this(config, local, new HashMap<String,Object>());
    }

    public TcpInternalClient(IClientConfiguration config, IServerConfiguration local, HashMap<String,Object> logVar)
    {
        this._config = config;
        this._local = local;

        String appPath =ApplicationUtility.getAppPath();
        logVar.put(Logger.LOG_DIRECTORY,FileUtility.combinePath(appPath, "Log/Packet/"+local.port() + "/" + config.port()));
        _logger = new CircleLogger(logVar);
        _networkErrorLogger = new DailyLogger(FileUtility.combinePath(appPath, "Log/Network-errors/" + local.port() + "/" + config.port()));

        this._packetManager = new GenericPacketManager<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs>(new PacketContext());
        _asyncManager = new AsyncCallbackManager(this._packetManager);
        this._listener = new RemoteListener();
    }

    /**
     * 获得：当连接关闭时，是否自动重连
     * @return
     */
    public boolean autoReconnect()
    {
        return _autoReconnect;
    }
    /**
     * 设置：当连接关闭时，是否自动重连
     * @param value
     */
    public void autoReconnect(boolean value)
    {
        _autoReconnect=value;
    }
    
    /**
     * 获得远程服务器配置信息
     * @return
     */
    public IClientConfiguration config() {
    	return _config;
    }

    /**
     * 获得本地服务器配置信息
     * @return
     */
    public IServerConfiguration local() {
    	return _local;
    }

    /**
     * 获得包管理器
     * @return
     */
    public GenericPacketManager<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> packetManager()
    {
    	return this._packetManager;
    }

    /**
     * 是否已连接
     * @return
     */
    public boolean isConnected()
    {
        return _connected;
    }

    private void raiseConnected()
    {
    	_connected = true;
        _connectDelegate.execute(this);
    }

    public void close()
    {
        if (_workThread != null) _workThread.removeTicker(this);
        if (_remote != null) _remote.close();
        _disconnectDelegate.execute(this);
    }
    
    public void addOnConnect(Consumer<TcpInternalClient> ls){
    	_connectDelegate.add(ls);
    }
    
    public void removeOnConnect(Consumer<TcpInternalClient> ls){
    	_connectDelegate.remove(ls);
    }
    
    public void addOnDisconnect(Consumer<TcpInternalClient> ls){
    	_disconnectDelegate.add(ls);
    }
    
    public void removeOnDisconnect(Consumer<TcpInternalClient> ls){
    	_disconnectDelegate.remove(ls);
    }

    public void tick()
    {
        if (_workThread == null) _workThread = TickThread.current();
        _listener.tick();
    }

    /**
     * 获得日志对象
     * @return
     */
    public Logger logger()
    {
        return _logger;
    }

    /**
     * 获得网络错误日志对象
     * @return
     */
    Logger networkErrorLogger()
    {
        return _networkErrorLogger;
    }

    public void sendAsync(InternalPacketWriter ipw, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> callback, Consumer0 timeoutCallback)
    {
        if (_remote == null)
        {
            if (timeoutCallback != null) timeoutCallback.accept();
        }
        else _remote.sendAsync(ipw, callback, timeoutCallback);
    }

    public void sendAsync(InternalPacketWriter ipw)
    {
        if (_remote != null) _remote.sendAsync(ipw);
    }

    private class PacketContext implements IPacketContext<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs>
    {
        public Logger logger()
        {
        	return TcpInternalClient.this._logger;
        }

        public InternalPacketReader createReader(byte[] data){
        	return new InternalPacketReader(data);
        }
        
        public boolean trackPacket()
        {
        	return _config.trackPacket();
        }

		public InternalPacketEventArgs createEventArgs(
				InternalPacketReader reader, TcpInternalChannel client) {
			return new InternalPacketEventArgs(reader,client);
		}
    }

    private class MyServerConfiguration implements IServerConfiguration
    {
        public short serverId()
        {
            return _config.serverId();
        }

        public String serverName()
        {
        	return _config.serverName();
        }

        public byte serverType()
        {
        	return _config.serverType();
        }

        public int port()
        {
        	return _config.port();
        }

        public int maxClient()
        {
            return 0;
        }

        public boolean trackPacket()
        {
        	return _config.trackPacket();
        }
        
		public IServerConfiguration trackPacket(boolean value) {
			_config.trackPacket(value);
			return this;
		}

        public boolean checkAlive()
        {
            return false;
        }
    }

    private class RemoteListener implements ITcpInternalContext
    {
        private RegistingState _state= new RegistingState();
        private String _guid;

        public void tick()
        {
            this._state.tick();
        }

        public void sendAsync(IDataReceiver receiver, InternalPacketWriter ipw, IInternalPacketSender sender, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> callback, Consumer0 timeoutCallback)
        {
            _asyncManager.sendAsync(receiver, ipw, sender, callback, timeoutCallback);
        }

        public boolean trackPacket()
        {
            return _config.trackPacket();
        }

        public Logger logger()
        {
        	return TcpInternalClient.this.logger();
        }

        public Logger networkErrorLogger()
        {
        	return TcpInternalClient.this.networkErrorLogger();
        }

        private TcpInternalChannel createChannel() throws InterruptedException
        {
        	Bootstrap bootstrap = new Bootstrap();
            bootstrap.channel(NioSocketChannel.class);
            bootstrap.handler(new ClientInitializer());
            bootstrap.group(new NioEventLoopGroup());
            ChannelFuture future=bootstrap.connect(new InetSocketAddress(_config.serverAddress(), _config.port()));
            future.sync();
            return new TcpInternalChannel(0,future.channel(),this);
        }

        public int timeoutSeconds()
        {
        	return 600;
        }

        private class ClientInitializer extends ChannelInitializer<SocketChannel> {

            @Override
            protected void initChannel(SocketChannel ch) throws Exception {
                ChannelPipeline pipeline = ch.pipeline();

                pipeline.addLast("framer", new PacketFrameDecoder(_networkErrorLogger));
                pipeline.addLast("decoder", new PacketDecoder());
                pipeline.addLast("handler", new ChannelHandler());
            }
        }
        
        private class PacketDecoder extends MessageToMessageDecoder<ByteBuf>{

        	@Override
        	protected void decode(ChannelHandlerContext ctx, ByteBuf msg,
        			List<Object> out) throws Exception {
        		out.add(_packetManager.context().createReader(msg.array()));
        	}

        }
        
        private class ChannelHandler extends SimpleChannelInboundHandler<InternalPacketReader> {
            
            @Override
            public void channelActive(ChannelHandlerContext ctx) throws Exception {
            }
            
            @Override
            public void channelInactive(ChannelHandlerContext ctx) throws Exception {
            	if (_remote==null) return;
            	TcpInternalChannel client=_remote.client(ctx.channel());
            	if (client!=null) client.close();
            }

			@Override
			public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
            	if (_remote==null) return;
            	TcpInternalChannel client=_remote.client(ctx.channel());
            	
            	if (client!=null) client.close();
            	
            	_networkErrorLogger.writeLog("TcpInternalClient exceptionCaught, client:" + client.description(), cause);
            	
        		if(Logger.isDebug){
        			System.out.println(FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.SSS") + 
        					" TcpInternalClient exceptionCaught, connection closed, remote ip:" + client.description() + "; cause:" + cause.getMessage());
        		}
			}

			protected void channelRead0(ChannelHandlerContext ctx, InternalPacketReader msg) throws Exception {
				TcpInternalChannel client=_remote.client(ctx.channel());
            	if (client==null) return;
				_packetManager.receive(client, msg);
			}

			protected void messageReceived(ChannelHandlerContext ctx, InternalPacketReader msg) throws Exception {
				channelRead0(ctx, msg);
			}
        }
        
        private class RegistingState
        {
            //当打开连接不成功时，记录上一次尝试打开连接的时间
            private long _tryOpenTimeMills;
            private boolean _connected = false;

            public void tick()
            {
                if (_connected) return;

                if ((System.currentTimeMillis() - _tryOpenTimeMills) >= 5000)
                {
                	_tryOpenTimeMills = System.currentTimeMillis();
                }
                else return;

                beginRegisterRemote();
            }

            private void beginRegisterRemote()
            {
                _connected = true;
                try
                {
                    TcpInternalChannel channel = createChannel();
                    _remote = new TcpInternalRemote(
                        new MyServerConfiguration(),
                        new String[] { _config.serverAddress() },
                        channel
                        );

                    _remote.addOnClose((r)->
                    {
                        _remote = null;

                        if (!_autoReconnect)
                        {
                            close();
                        }
                        else 
                        {
                            try
                            {
                                _disconnectDelegate.execute(TcpInternalClient.this);
                            }
                            catch (Throwable ex)
                            {
                            	ex.printStackTrace();
                            }
                        }
                        _connected = false;
                    });

                    InternalPacketWriter ipw = new InternalPacketWriter(InternalPacketIds.BEGIN_REGISTER_REMOTE);
                    ipw.paramsWriter().write(ServerConfigurationSerializer.serialize(_local));
                    for (String ip : IPUtility.getLocalIps())
                    {
                        ipw.paramsWriter().writeShortString(ip);
                    }
                    channel.sendAsync(ipw, (e)->
                    {
                        _guid = e.reader().paramsReader().readShortString();
                        doingRegisterRemote();
                    },null);
                    
                    System.out.println("begin register remote to "+_config.serverName()+"(id:"+_config.serverId()+"),"+_config.serverAddress()+":"+_config.port());
                }
                catch (Exception ex)
                {
                    _connected = false;
                    System.err.println("connection error,"+_config.serverName()+"(id:"+_config.serverId()+"),"+_config.serverAddress()+":"+_config.port());
                }
            }

            private void doingRegisterRemote()
            {
                TcpInternalChannel channel;
				try {
					channel = createChannel();
				} catch (InterruptedException ex) {
					ex.printStackTrace();
					System.err.println("doing register error,remote to "+_config.serverName()+"(id:"+_config.serverId()+"),"+_config.serverAddress()+":"+_config.port());
					return;
				}
                
				_remote.slave(channel);
				
                InternalPacketWriter ipw = new InternalPacketWriter(InternalPacketIds.DOING_REGISTER_REMOTE);
                ipw.paramsWriter().writeShortString(_guid);
                channel.sendAsync(ipw, (e)->
                {
                    endRegisterRemote();
                },null);

                System.out.println("doing register remote to "+_config.serverName()+"(id:"+_config.serverId()+"),"+_config.serverAddress()+":"+_config.port());
            }

            private void endRegisterRemote()
            {
                if (_remote == null) return;
                InternalPacketWriter ipw = new InternalPacketWriter(InternalPacketIds.END_REGISTER_REMOTE);
                ipw.paramsWriter().writeShortString(_guid);

                _remote.sendAsync(ipw, (e)->
                {
                    raiseConnected();
                },null);

                System.out.println("end register remote to "+_config.serverName()+"(id:"+_config.serverId()+"),"+_config.serverAddress()+":"+_config.port());
            }
        }
    }
}
