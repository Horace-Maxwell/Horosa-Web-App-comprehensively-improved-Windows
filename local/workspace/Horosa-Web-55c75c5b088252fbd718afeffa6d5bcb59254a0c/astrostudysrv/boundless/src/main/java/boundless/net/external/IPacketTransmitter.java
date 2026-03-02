package boundless.net.external;

import boundless.net.*;

/**
 * 包转发器。
 * 当PacketManager对象接收到包时，会把包转发给有向它注册的包转发器对象，此时对PacketManager对象而言它的工作已经结束，后面有包转发器接管包的后面处理
 * 
 * @param <T_PacketReader>
 * @param <T_Client>
 * @param <T_PacketEventArgs>
 */
public interface IPacketTransmitter<T_PacketReader extends IPacketReader, T_Client extends TcpChannel<T_PacketReader>,T_PacketEventArgs extends GenericPacketEventArgs<T_PacketReader,T_Client>>{
	boolean transmit(T_PacketEventArgs e);
}
