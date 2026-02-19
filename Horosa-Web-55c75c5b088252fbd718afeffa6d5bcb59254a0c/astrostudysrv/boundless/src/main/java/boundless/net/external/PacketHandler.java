package boundless.net.external;

import boundless.net.*;

public interface PacketHandler<T_PacketReader extends IPacketReader, T_Client extends TcpChannel<T_PacketReader>,T_PacketEventArgs extends GenericPacketEventArgs<T_PacketReader,T_Client>>{
	void handle(T_PacketEventArgs e);
}
