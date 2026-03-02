package boundless.net.internal;

import io.netty.channel.Channel;

import java.util.function.Consumer;

import boundless.function.*;
import boundless.net.TcpChannel;
import boundless.net.external.*;

/**
 * 内部远程客户端机器。为了可靠性保证，每个内部服务器连到本服务器时会创建多条连接，本服务器把由同个服务器的连接组成同一组
 *
 */
public class TcpInternalRemote implements ITcpInternalSender
{
    //当所有连接都关闭后触发
    public ConsumerDelegate<TcpInternalRemote> _closeDelegate=new ConsumerDelegate<TcpInternalRemote>();

    private IServerConfiguration _config;
    private RemoteClient _masterClient;
    private RemoteClient _slaveClient;
    private RemoteClient[] _clients;
    private boolean _closed = false;
    private String[] _serverIps;

    public TcpInternalRemote(IServerConfiguration config, String[] serverIps, TcpInternalChannel masterClient)
    {
        this._config = config;
        this._serverIps = serverIps;

        this._masterClient = new RemoteClient();
        this._masterClient._changedDelegate.add((oldCon, newCon)->
        {
            //防止循环
            if (newCon != null) return;

            //当主通道断了，如果有备援的，则由备援的承担主通道
            TcpInternalChannel tempClient = this.slave();
            if (tempClient == null) return;
            this.slave(null);
            this.master(tempClient);
        });

        this._slaveClient = new RemoteClient();
        this._clients=new RemoteClient[]{this._masterClient,this._slaveClient};
        
        this.master(masterClient);

        for (RemoteClient c : new RemoteClient[] { _masterClient, _slaveClient })
        {
            c._changedDelegate.add((oldCon, newCon)->
            {
            	synchronized (TcpInternalRemote.this)
                {
                    if (_closed) return;
                    for (RemoteClient item : new RemoteClient[] { _masterClient, _slaveClient })
                    {
                        if (item.channel() != null) return;
                    }
                    _closed = true;
                }

                _closeDelegate.execute(TcpInternalRemote.this);
            });
        }
    }

    /**
     * 单通道的主通道
     * @return
     */
    public TcpInternalChannel master()
    {
        return _masterClient.channel();
    }
    
    void master(TcpInternalChannel value){
    	_masterClient.channel(value);
    }

    /**
     * 单通道的备援通道
     * @return
     */
    public TcpInternalChannel slave()
    {
            return _slaveClient.channel();
    }
    void slave(TcpInternalChannel value){
        	_slaveClient.channel(value);
    }

    public short serverId()
    {
    	return _config.serverId();
    }

    public String[] serverIps()
    {
        return _serverIps;
    }

    public IServerConfiguration config()
    {
        return _config;
    }

    public TcpInternalChannel client(Channel channel){
    	for	(RemoteClient c:_clients){
    		if (c!=null && c._channel!=null && c._channel.channel()==channel) return c._channel;
    	}
    	return null;
    }
    
    /**
     * 使用单通道发送数据
     * 
     * @param ipw
     * @param callback 回调方法。会在调用者的线程里执行
     */
    public void sendAsync(InternalPacketWriter ipw, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> callback, Consumer0 timeoutCallback)
    {
        master().sendAsync(ipw, callback, timeoutCallback);
    }

    /**
     * 使用单通道发送数据
     */
    public void sendAsync(InternalPacketWriter ipw)
    {
        master().sendAsync(ipw);
    }

    public void close()
    {
        for (TcpInternalChannel c : new TcpInternalChannel[]{
            master(),slave()
        })
        {
            if (c != null) c.close();
        }
    }

    public void addOnClose(Consumer<TcpInternalRemote> ls){
    	_closeDelegate.add(ls);
    }
    
    public void removeOnClose(Consumer<TcpInternalRemote> ls){
    	_closeDelegate.remove(ls);
    }
    
    private class RemoteClient
    {
        private Consumer2Delegate<TcpInternalChannel, TcpInternalChannel> _changedDelegate=new Consumer2Delegate<TcpInternalChannel, TcpInternalChannel>();
        private CloseListener _closeListener=new CloseListener();
        private TcpInternalChannel _channel;

        public TcpInternalChannel channel()
        {
        	return _channel;
        }
        
        public void channel(TcpInternalChannel value)
            {
                if (value != null && value.remote() != null && value.remote() != TcpInternalRemote.this) return;

                TcpInternalChannel old = _channel;
                if (_channel != null)
                {
                	_channel.remote(null);
                	_channel.removeOnClose(_closeListener);
                }
                _channel = value;
                if (_channel != null)
                {
                	_channel.remote(TcpInternalRemote.this);
                	_channel.addOnClose(_closeListener);
                }

                _changedDelegate.execute(old, _channel);
        }
        
        private class CloseListener implements Consumer<TcpChannel<InternalPacketReader>>{
    		@Override
    		public void accept(TcpChannel<InternalPacketReader> client) {
    			doClose(client);
    		}
        	
    		private void doClose(Object sender)
            {
            	TcpInternalChannel temp = _channel;
                synchronized (TcpInternalRemote.this)
                {
                    //如果已是脏数据了--begin
                    if (temp != _channel)
                    {
                        for (RemoteClient c : new RemoteClient[] { _masterClient, _slaveClient })
                        {
                            if (c.channel() == temp) doClose(temp);
                        }
                        return;
                    }
                    //如果已是脏数据了--end

                    if (_channel == null) return;
                    TcpInternalChannel old = _channel;
                    _channel.remote(null);
                    _channel.removeOnClose(this);
                    _channel = null;

                    _changedDelegate.execute(old, null);
                }
            }
        }

    }
}