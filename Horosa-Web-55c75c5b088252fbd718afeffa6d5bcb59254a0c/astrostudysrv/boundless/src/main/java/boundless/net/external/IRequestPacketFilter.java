package boundless.net.external;

import boundless.net.*;

/**
 * 请求包过滤器。可以用于拦截请求包
 * 
 * @param <T_PacketReader>
 * @param <T_Client>
 * @param <T_PacketEventArgs>
 */
public interface IRequestPacketFilter<T_PacketReader extends IPacketReader, T_Client extends TcpChannel<T_PacketReader>,T_PacketEventArgs extends GenericPacketEventArgs<T_PacketReader,T_Client>>{
	boolean filter(T_PacketEventArgs e);
}
