package boundless.net.external;

import boundless.net.*;

/**
 * 客户端会话信息
 *
 * @param <T_PacketReader>
 */
public class ClientSession<T_PacketReader extends IPacketReader>
{
	private TcpChannel<T_PacketReader> _client;
	
    public ClientSession(TcpChannel<T_PacketReader> client)
    {
        this._client = client;
    }

    /**
     * 获得客户端网络通路对象
     * @return
     */
    public TcpChannel<T_PacketReader> client()
    {
        return _client;
    }
}
