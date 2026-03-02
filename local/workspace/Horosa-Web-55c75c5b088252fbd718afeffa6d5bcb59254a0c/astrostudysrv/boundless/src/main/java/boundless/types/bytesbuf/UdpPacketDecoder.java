package boundless.types.bytesbuf;

import java.net.DatagramPacket;
import java.util.List;

import org.slf4j.Logger;

import boundless.netty.Datagram;

public interface UdpPacketDecoder {
	public void decode(DatagramPacket msg, List<Datagram> out, boolean tracePacket);
	public void setLogger(Logger logger);
	public void setErrorLogger(Logger errorLogger);
}
