package boundless.net.internal;

import io.netty.channel.Channel;

import java.util.*;
import java.util.function.Consumer;

import boundless.function.*;
import boundless.log.Logger;
import boundless.net.IDataReceiver;
import boundless.net.external.*;

/**
 * 内部服务器
 *
 */
public class TcpInternalServer extends GenericTcpServer<InternalPacketReader, TcpInternalChannel,InternalPacketEventArgs>
{
    //当远程客户端连上来时触发。在并发环境里执行
    private ConsumerDelegate<TcpInternalRemote> _createRemoteDelegate=new ConsumerDelegate<TcpInternalRemote>();
    //当远程客户端断开时触发。在并发环境里执行
    private ConsumerDelegate<TcpInternalRemote> _removeRemoteDelegate=new ConsumerDelegate<TcpInternalRemote>();
    
    private ITcpInternalContext _context;
    private AsyncCallbackManager _asyncManager = null;

    public TcpInternalServer(IServerConfiguration config)
    {
    	this(config, new HashMap());
    }

    public TcpInternalServer(IServerConfiguration config, HashMap logVar)
    {
    	super(config, logVar);
        this._context = new TcpInternalContext();
        _asyncManager = new AsyncCallbackManager(this.packetManager());
        new RemoteListener();
    }

    @Override
    protected TcpInternalChannel createClient(int connectionId, Channel clientChannel)
    {
        return new TcpInternalChannel(connectionId, clientChannel, this._context);
    }

    @Override
    protected IPacketContext<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> createPacketContext()
    {
        return new PacketContext();
    }

    @Override
	protected TcpInternalChannel[] newClients(int count) {
		return new TcpInternalChannel[count];
	}
    
    public void addOnCreateRemote(Consumer<TcpInternalRemote> ls){
    	this._createRemoteDelegate.add(ls);
    }
    public void removeOnCreateRemote(Consumer<TcpInternalRemote> ls){
    	this._createRemoteDelegate.remove(ls);
    }
    
    public void addOnRemoveRemote(Consumer<TcpInternalRemote> ls){
    	this._removeRemoteDelegate.add(ls);
    }
    public void removeOnRemoveRemote(Consumer<TcpInternalRemote> ls){
    	this._removeRemoteDelegate.remove(ls);
    }
    
    private class PacketContext implements IPacketContext<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs>
    {
        public Logger logger()
        {
        	return TcpInternalServer.this.logger(); 
        }

        public InternalPacketEventArgs createEventArgs(InternalPacketReader reader, TcpInternalChannel client)
        {
            return new InternalPacketEventArgs(reader, client);
        }

        public boolean trackPacket()
        {
        	return TcpInternalServer.this.trackPacket();
        }

		@Override
		public InternalPacketReader createReader(byte[] data) {
			return new InternalPacketReader(data);
		}
    }

    private class TcpInternalContext implements ITcpInternalContext
    {
        public boolean trackPacket()
        {
        	return TcpInternalServer.this.trackPacket();
        }

        public Logger logger()
        {
        	return TcpInternalServer.this.logger(); 
        }

        public Logger networkErrorLogger()
        {
        	return TcpInternalServer.this.networkErrorLogger(); 
        }

        public void sendAsync(IDataReceiver receiver, InternalPacketWriter ipw, IInternalPacketSender sender, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> callback, Consumer0 timeoutCallback)
        {
            _asyncManager.sendAsync(receiver, ipw, sender, callback, timeoutCallback);
        }

        public int timeoutSeconds()
        {
        	return 600; 
        }
    }

    private class RemoteListener
    {
        //{Key:建立远程连接的唯一ID,Value:内部远程客户端机器}
        private HashMap<String, TcpInternalRemote> _remotes = new HashMap<String, TcpInternalRemote>();

        public RemoteListener()
        {
            packetManager().registerHandler(InternalPacketIds.BEGIN_REGISTER_REMOTE, (e)->beginRegisterRemote(e));
            packetManager().registerHandler(InternalPacketIds.DOING_REGISTER_REMOTE, (e)->doingRegisterRemote(e));
            packetManager().registerHandler(InternalPacketIds.END_REGISTER_REMOTE, (e)->endRegisterRemote(e));
        }

        private void beginRegisterRemote(InternalPacketEventArgs e)
        {
            if (e.client().remote() != null) return;
            IServerConfiguration config = ServerConfigurationSerializer.deserialize(e.reader());
            List<String> serverIps = new ArrayList<String>();
            while (!e.reader().paramsReader().eof())
            {
                serverIps.add(e.reader().paramsReader().readShortString());
            }

            String guid = UUID.randomUUID().toString();
            String[] ips=new String[serverIps.size()];
            serverIps.toArray(ips);
            TcpInternalRemote remote = new TcpInternalRemote(config,ips , e.client());
            synchronized (_remotes){
                _remotes.put(guid,remote);
            }

            remote.addOnClose((r)->
            {
            	synchronized (_remotes)
                {
                    _remotes.remove(guid);

                    System.out.println("remote disconnect: "+e.client().description()+". count: "+_remotes.size());
                }

                _removeRemoteDelegate.execute(r);
            });

            InternalPacketWriter ipw = InternalPacketWriter.createResponse(e.reader());
            ipw.paramsWriter().writeShortString(guid);
            e.output(ipw);

            System.out.println("begin register remote from "+config.serverName()+"(id:"+ config.serverId()+"),"+e.client().description());
        }

        private void doingRegisterRemote(InternalPacketEventArgs e)
        {
            if (e.client().remote() != null) return;
            String guid = e.reader().paramsReader().readShortString();

            TcpInternalRemote remote;
            synchronized (_remotes)
            {
            	remote=_remotes.get(guid);
            	if (remote==null) return;
                remote.slave(e.client());
            }

            InternalPacketWriter ipw = InternalPacketWriter.createResponse(e.reader());
            ipw.paramsWriter().writeShortString(guid);
            e.output(ipw);

            System.out.println("doing register remote from "+remote.config().serverName()+"(id:"+remote.config().serverId()+"),"+e.client().description());
        }

        private void endRegisterRemote(InternalPacketEventArgs e)
        {
            if (e.client().remote() == null) return;
            String guid = e.reader().paramsReader().readShortString();
            int count = 0;
            TcpInternalRemote remote;
            synchronized (_remotes)
            {
            	remote=_remotes.get(guid);
            	if (remote==null) return;
                count = _remotes.size();
            }

            e.output(InternalPacketWriter.createResponse(e.reader()));

            System.out.println("end register remote from "+remote.config().serverName()+"(id:"+remote.config().serverId()+"),"+e.client().description()+". count:"+count);

            _createRemoteDelegate.execute(remote);
        }
    }

}
