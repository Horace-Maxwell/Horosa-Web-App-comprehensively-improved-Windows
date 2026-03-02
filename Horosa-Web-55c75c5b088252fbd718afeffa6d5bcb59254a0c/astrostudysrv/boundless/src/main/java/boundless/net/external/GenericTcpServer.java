package boundless.net.external;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.buffer.ByteBuf;
import io.netty.channel.Channel;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelPipeline;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.DelimiterBasedFrameDecoder;
import io.netty.handler.codec.Delimiters;
import io.netty.handler.codec.MessageToMessageDecoder;
import io.netty.handler.codec.string.StringDecoder;
import io.netty.handler.codec.string.StringEncoder;

import java.net.InetAddress;
import java.net.URISyntaxException;
import java.util.*;
import java.util.function.*;

import boundless.net.*;
import boundless.io.*;
import boundless.log.*;
import boundless.utility.*;
import boundless.types.*;
import boundless.console.ApplicationUtility;
import boundless.function.*;

public abstract class GenericTcpServer<T_PacketReader extends IPacketReader, T_Client extends TcpChannel<T_PacketReader>, T_PacketEventArgs extends GenericPacketEventArgs<T_PacketReader, T_Client>> {
	//当客户端连接时触发
    private ConsumerDelegate<T_Client> _connectDelegate=new ConsumerDelegate<T_Client>();
    //当客户端连接断开时触发
    public ConsumerDelegate<T_Client> _disconnectDelegate=new ConsumerDelegate<T_Client>();

    private TcpListenerWrapper _wrapper;
    private ClientCollection _clients = new ClientCollection();
    private GenericPacketManager<T_PacketReader, T_Client, T_PacketEventArgs> _packetManager = null;
    private IServerConfiguration _config;
    private java.util.Timer _checkAliveTimer;
    private boolean _checkClientAlive=false;
    private Logger _logger;
    private Logger _networkErrorLogger;

    /**
     * 
     * @param config 服务器配置信息
     */
    public GenericTcpServer(IServerConfiguration config)
    {
    	this(config,new HashMap());
    }

    /**
     * 
     * @param config 服务器配置信息
     * @param logVar
     */
    public GenericTcpServer(IServerConfiguration config, Map logVar)
    {
        this._config = config;

        String appPath =ApplicationUtility.getAppPath();
        _logger = new CircleLogger(FileUtility.combinePath(appPath, "Log/Packet/" + config.port()));
        _networkErrorLogger = new DailyLogger(FileUtility.combinePath(appPath, "Log/Network-errors/" + config.port()));

        _packetManager = new GenericPacketManager<T_PacketReader, T_Client, T_PacketEventArgs>(createPacketContext());
        this._wrapper = new TcpListenerWrapper();
        this._wrapper.open();

        _checkAliveTimer = new java.util.Timer();
        _checkAliveTimer.schedule(new CheckAliveTask(), 60 *1000, 60 *1000);
    }

    /**
     * 获得是否检查客户端是否活动着
     * @return
     */
    public boolean checkClientAlive()
    {
        return _checkClientAlive;
    }
    
    /**
     * 设置是否检查客户端是否活动着
     * @param value
     */
    public void checkClientAlive(boolean value)
    {
        _checkClientAlive=value;
    }

    /**
     * 获得客户端网络通路
     * @param connectionId
     * @return
     */
    public T_Client client(int connectionId)
    {
    	return _clients.get(connectionId);
    }

    /**
     * 获得客户端网络通路列表
     * @return
     */
    public T_Client[] clients()
    {
    	return _clients.toArray();
    }
    
    public void close()
    {
        _packetManager.Close();
        _wrapper.close();
    }

    /**
     * 获得是否跟踪包
     * @return
     */
    public boolean trackPacket()
    {
    	return _config.trackPacket();
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
    public Logger networkErrorLogger()
    {
        return _networkErrorLogger;
    }

    /**
     * 获得包管理器
     * @return
     */
    public GenericPacketManager<T_PacketReader,T_Client,T_PacketEventArgs> packetManager()
    {
    	return this._packetManager;
    }

    /**
     * 获得服务器配置信息
     * @return
     */
    public IServerConfiguration config()
    {
    	return this._config;
    }

    public void addOnConnect(Consumer<T_Client> ls){
    	_connectDelegate.add(ls);
    }
    
    public void removeOnConnect(Consumer<T_Client> ls){
    	_connectDelegate.remove(ls);
    }
    
    public void addOnDisconnect(Consumer<T_Client> ls){
    	_disconnectDelegate.add(ls);
    }
    
    public void removeOnDisconnect(Consumer<T_Client> ls){
    	_disconnectDelegate.remove(ls);
    }
    
    private void raiseConnect(T_Client client){
    	_connectDelegate.execute(client);
    }
    
    private void raiseDisconnect(T_Client client){
    	_disconnectDelegate.execute(client);
    }

    protected abstract IPacketContext<T_PacketReader, T_Client, T_PacketEventArgs> createPacketContext();
    
    /**
     * 创建客户端连接对象
     * @param connectionId
     * @param clientChannel
     * @return
     */
    protected abstract T_Client createClient(int connectionId, Channel clientChannel);

    /**
     * 创建客户端连接对象数组，数组里每个元素为空
     * @param count 数组大小
     * @return
     */
    protected abstract T_Client[] newClients(int count);
    
    private class CheckAliveTask extends TimerTask{

		@Override
		public void run() {
			if (!_checkClientAlive) return;
            try
            {
                for (TcpChannel<T_PacketReader> c : clients())
                {
                    if (!c.isAlive())
                    {
                        c.close();
                        _networkErrorLogger.writeLog("client is not alive,"+c.description());
                    }
                }
            }
            catch (Throwable ex)
            {
            	ex.printStackTrace();
            }
		}
    }
    
    private class TcpListenerWrapper
    {
        private EventLoopGroup _bossGroup = new NioEventLoopGroup();
        private EventLoopGroup _workerGroup = new NioEventLoopGroup();

        public void open()
        {
            try {
                ServerBootstrap b = new ServerBootstrap();
                b.group(_bossGroup, _workerGroup)
                 .channel(NioServerSocketChannel.class)
                 .childHandler(new ServerInitializer());
                b.bind(_config.port());
            } 
            catch (Throwable ex)
            {
            	System.err.println("start listener error,port:"+_config.port());
            	ex.printStackTrace();
                return;
            }
            
            for (String ip : IPUtility.getLocalIps())
            {
            	System.out.println(_config.serverName()+"(id:"+_config.serverId()+") Listening: "+ip+":"+_config.port());
            }
        }

        public void close()
        {
        	for (TcpChannel<T_PacketReader> c : clients())
            {
                c.close();
            }

            _bossGroup.shutdownGracefully();
            _workerGroup.shutdownGracefully();
        }

        private class ServerInitializer extends ChannelInitializer<SocketChannel> {

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
        
        private class ChannelHandler extends SimpleChannelInboundHandler<T_PacketReader> {
            
            @Override
            public void channelActive(ChannelHandlerContext ctx) throws Exception {
            	_clients.add(ctx.channel());
            }
            
            @Override
            public void channelInactive(ChannelHandlerContext ctx) throws Exception {
            	T_Client client=_clients.get(ctx.channel());
            	if (client!=null){
            		if(Logger.isDebug){
            			System.out.println(FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.SSS") + " TcpServer channel inactive, client will close, ip:" + client.description());
            		}
            		client.close();
            	}
            }

			@Override
			public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
            	T_Client client=_clients.get(ctx.channel());
            	if (client!=null){
                	_networkErrorLogger.writeLog("TcpServer exceptionCaught, client:" + client.description(), cause);
                	
            		if(Logger.isDebug){
            			System.out.println(FormatUtility.formatDateTime(new Date(), "yyyy-MM-dd HH:mm:ss.SSS") + 
            					" TcpServer channel exceptionCaught, client will close, ip:" + client.description() + "; cause:" + cause.getMessage());
            		}
            		client.close();
            	}
			}

			protected void channelRead0(ChannelHandlerContext ctx, T_PacketReader msg) throws Exception {
				T_Client client=_clients.get(ctx.channel());
            	if (client==null) return;
				_packetManager.receive(client, msg);
			}

			protected void messageReceived(ChannelHandlerContext ctx, T_PacketReader msg) throws Exception {
				channelRead0(ctx, msg);
			}
        }
    }
    
    private class ClientCollection{
    	private IntPool _connectionIdPool = new IntPool(10000);
    	private HashMap<Integer, T_Client> _clientsIndexById = new HashMap<Integer, T_Client>();
    	private HashMap<Channel, T_Client> _clientsIndexByChannel = new HashMap<Channel, T_Client>();
    	
    	public synchronized T_Client add(Channel clientChannel) throws Exception {
            T_Client client = null;
            int connectionId = _connectionIdPool.getValue();
            client = createClient(connectionId, clientChannel);
            
            client.addOnClose((sender) ->
            {
                remove((T_Client)sender);
            });

            _clientsIndexById.put(connectionId,client);
            _clientsIndexByChannel.put(clientChannel,client);
            
            System.out.println("client connect,ip:"+client.description()+",count:"+_clientsIndexById.size()
            		+",time:"+DateTimeFormatUtility.currentDateTime());
            raiseConnect(client);
            client.open();
            return client;
        }
    	
    	public synchronized void remove(T_Client client) {
			_clientsIndexById.remove(Integer.valueOf(client.connectionId()));
			_clientsIndexByChannel.remove(client.channel());
			try{
			   raiseDisconnect(client);
			} finally{
			   _connectionIdPool.putback(client.connectionId());
			}
			System.out.println("client disconnect,ip:" + client.description()
					+ ",count:" + _clientsIndexById.size()+",time:"+DateTimeFormatUtility.currentDateTime());
		}
    	
        public synchronized T_Client get(int connectionId)
        {
        	return _clientsIndexById.get(Integer.valueOf(connectionId));
        }
        
        public synchronized T_Client get(Channel clientChannel)
        {
        	return _clientsIndexByChannel.get(clientChannel);
        }

        public synchronized T_Client[] toArray()
        {
        	T_Client[] clients=newClients(_clientsIndexById.size());
        	_clientsIndexById.values().toArray(clients);
            return clients;
        }
    }
}
