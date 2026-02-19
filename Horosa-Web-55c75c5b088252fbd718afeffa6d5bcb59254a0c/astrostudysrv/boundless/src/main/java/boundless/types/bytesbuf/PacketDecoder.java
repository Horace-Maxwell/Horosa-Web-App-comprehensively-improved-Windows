package boundless.types.bytesbuf;

import java.util.List;

import boundless.netty.Datagram;

public interface PacketDecoder {
	public void decode(ByteBuf in, List<Datagram> out);
}
