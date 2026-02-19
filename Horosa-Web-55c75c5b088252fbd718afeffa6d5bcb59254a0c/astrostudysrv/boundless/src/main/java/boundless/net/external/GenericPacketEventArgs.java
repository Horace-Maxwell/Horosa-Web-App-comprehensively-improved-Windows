package boundless.net.external;

import boundless.net.*;

/**
 * 泛型包事件参数。装入一个完整的Socket请求包信息
 *
 * @param <T_PacketReader> 包读取器类型
 * @param <T_Client> 连接对象类型
 */
public class GenericPacketEventArgs<T_PacketReader extends IPacketReader,T_Client extends TcpChannel<T_PacketReader>>
{
	private T_PacketReader _reader;
    private IDataReceiver _receiver;
    private boolean _consumed=false;
    private T_Client _client;
    
    public GenericPacketEventArgs(T_PacketReader reader, T_Client client)
    {
        this._reader = reader;
        this._client = client;
        this._client.alive();
        this._receiver = createDataReceiver();
    }

    public T_Client client()
    {
        return _client;
    }

    /**
     * 获得包读取器
     * @return
     */
    public T_PacketReader reader()
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

    /**
     * 输出数据
     * @param output
     */
    public void output(IOutputData output)
    {
        this._client.output(this._receiver, output);
    }

    public void sendAsync(IPacketWriter pw)
    {
        this._client.sendAsync(null,pw);
    }

    protected IDataReceiver createDataReceiver()
    {
        return null;
    }

    /**
     * 消费事件
     */
    public void consume()
    {
        this._consumed = true;
    }

    /**
     * 事件是否有被消费了
     */
    public boolean isConsumed()
    {
        return _consumed;
    }
}
