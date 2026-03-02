package boundless.net.external;

import java.util.*;

import boundless.net.*;

/**
 * 请求包过滤器处理链
 * 
 * @param <T_PacketReader>
 * @param <T_Client>
 * @param <T_PacketEventArgs>
 */
class RequestPacketFilterChain<T_PacketReader extends IPacketReader, T_Client extends TcpChannel<T_PacketReader>,T_PacketEventArgs extends GenericPacketEventArgs<T_PacketReader,T_Client>>{
	private List<IRequestPacketFilter<T_PacketReader, T_Client, T_PacketEventArgs>> _beforeFilters = new ArrayList<IRequestPacketFilter<T_PacketReader, T_Client, T_PacketEventArgs>>();
    private List<IRequestPacketFilter<T_PacketReader, T_Client, T_PacketEventArgs>> _afterFilters = new ArrayList<IRequestPacketFilter<T_PacketReader, T_Client, T_PacketEventArgs>>();
    private GenericPacketManager<T_PacketReader, T_Client, T_PacketEventArgs> _packetManager;

    public RequestPacketFilterChain(GenericPacketManager<T_PacketReader, T_Client, T_PacketEventArgs> packetManager)
    {
        this._packetManager = packetManager;
    }

    public void execute(T_PacketEventArgs e)
    {
        for (int i = 0; i < _beforeFilters.size(); i++)
        {
            if (!_beforeFilters.get(i).filter(e)) return;
        }

        _packetManager.post(e);

        for (int i = 0; i < _afterFilters.size(); i++)
        {
            if (!_afterFilters.get(i).filter(e)) break;
        }

        if (!e.isConsumed()) EventCenter.<T_PacketReader>publishPacketNotFound(e.client(),e.reader());
    }

    /**
     * 增加包处理前的过滤器
     * @param filter
     */
    public void addBeforeFilter(IRequestPacketFilter<T_PacketReader, T_Client, T_PacketEventArgs> filter)
    {
        _beforeFilters.add(filter);
    }

    /**
     * 增加包处理后的过滤器
     * @param filter
     */
    public void addAfterFilter(IRequestPacketFilter<T_PacketReader, T_Client, T_PacketEventArgs> filter)
    {
        _afterFilters.add(filter);
    }
}
