package boundless.net.client;

import java.util.*;

import boundless.net.*;

/**
 * a PacketEvent object will be created, when receiving a packet from server.
 * We can use getReader() method to get the real data
 *
 */
public class PacketEvent extends EventObject {
	private PacketReader _reader;
	private TcpClient _client;
	private boolean _consumed=false;
	
    public PacketEvent(PacketReader reader,TcpClient client)
    {
    	super(client);
    	this._reader=reader;
    	this._client=client;
    }
    
    public TcpClient getClient()
    {
        return _client;
    }

    /**
     * 获得包读取器
     * @return
     */
    public PacketReader reader()
    {
        return _reader;
    }

    /**
     * 获得包编号
     * @return
     */
    public int packetId()
    {
        return _reader.packetId();
    }

    public void reset()
    {
        _reader.reset();
    }

    public void send(PacketWriter pw)
    {
        this._client.send(pw);
    }

    /**
     * 消费事件
     */
    public void consume()
    {
    	this._consumed=true;
    }

    /**
     * 事件是否有被消费了
     * @return
     */
    public boolean isConsumed()
    {
        return _consumed;
    } 
}
