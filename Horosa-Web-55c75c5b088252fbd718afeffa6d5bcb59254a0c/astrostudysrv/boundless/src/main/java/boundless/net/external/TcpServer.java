package boundless.net.external;

import java.util.*;

import io.netty.buffer.ByteBuf;
import io.netty.channel.Channel;
import io.netty.handler.codec.MessageToMessageDecoder;
import boundless.log.*;
import boundless.net.*;

public class TcpServer extends GenericTcpServer<PacketReader, TcpChannel<PacketReader>,PacketEventArgs>{
	private ITcpContext<PacketReader> _context;
	private ISessionManager<PacketReader> _sessionManager;
	private int _timeoutSeconds=120;

    /// <summary>
    /// 
    /// </summary>
    /// <param name="server">服务器配置信息</param>
    public TcpServer(IServerConfiguration server, boolean sessionEnabled)
    {
    	this(server,new HashMap(), sessionEnabled);
    }

    public TcpServer(IServerConfiguration server, Map logVar, boolean sessionEnabled)
    {
    	super(server,logVar);
        this._context = new TcpContext();

        if (sessionEnabled)
        {
            this._sessionManager = new SessionManager<PacketReader>();
            this.addOnDisconnect((client) ->
            {
                if (this._sessionManager == null) return;
                this._sessionManager.removeSession(client.connectionId());
            });
        }

        checkClientAlive(server.checkAlive());

        this.packetManager().addBeforeFilter(new SessionPacketFilter());
    }

    /**
     * 获得客户端会话管理器
     * @return
     */
    public ISessionManager<PacketReader> sessionManager()
    {
        return _sessionManager;
    }
    
    /**
     * 设置客户端会话管理器
     * @param value
     */
    public void sessionManager(ISessionManager<PacketReader> value)
    {
        _sessionManager=value;
    }

    @Override
    protected IPacketContext<PacketReader, TcpChannel<PacketReader>, PacketEventArgs> createPacketContext()
    {
        return new PacketContext();
    }

    @Override
    protected TcpChannel<PacketReader> createClient(int connectionId, Channel clientChannel)
    {
        return new TcpChannel<PacketReader>(connectionId, clientChannel, this._context);
    }

    @Override
    protected TcpChannel<PacketReader>[] newClients(int count){
    	return new TcpChannel[count];
    }

    public int timeoutSeconds()
    {
        return _timeoutSeconds;
    }
    public void timeoutSeconds(int value)
    {
        _timeoutSeconds=value;
    }

    private class PacketContext implements IPacketContext<PacketReader, TcpChannel<PacketReader>, PacketEventArgs>
    {
    	@Override
        public Logger logger()
        {
            return TcpServer.this.logger(); 
        }

		@Override
		public PacketEventArgs createEventArgs(PacketReader reader,
				TcpChannel<PacketReader> client) {
			return new PacketEventArgs(reader, client);
		}

        @Override
        public boolean trackPacket()
        {
            return TcpServer.this.trackPacket(); 
        }

		@Override
		public PacketReader createReader(byte[] data) {
			return new PacketReader(data);
		}
    }

    private class TcpContext implements ITcpContext<PacketReader>
    {
		@Override
		public boolean trackPacket() {
			return TcpServer.this.trackPacket();
		}
    
		@Override
		public Logger logger() {
			return TcpServer.this.logger(); 
		}
		
		@Override
		public Logger networkErrorLogger() {
			return TcpServer.this.networkErrorLogger(); 
		}
		
		@Override
		public int timeoutSeconds() {
			return _timeoutSeconds;
		}
    }

    private class SessionPacketFilter implements IRequestPacketFilter<PacketReader, TcpChannel<PacketReader>, PacketEventArgs>
    {
        public boolean filter(PacketEventArgs e)
        {
            try
            {
                if (_sessionManager != null && !_sessionManager.validatePacketId(e.client().connectionId(), e.packetId()))
                {
                    EventCenter.publishSessionError(e.client());
                    return false;
                }
            }
            catch (Exception ex)
            {
                if (logger() != null) logger().writeLog("发布SessionError错误,Packet Id:" + e.packetId(), ex);
            }

            return true;
        }
    }
}
