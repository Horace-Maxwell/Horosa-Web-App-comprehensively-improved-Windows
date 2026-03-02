package boundless.net.external;

import boundless.net.*;

public class PacketEventArgs extends
		GenericPacketEventArgs<PacketReader, TcpChannel<PacketReader>> {
	public PacketEventArgs(PacketReader reader, TcpChannel<PacketReader> client) {
		super(reader, client);
	}
}
