package boundless.netty;

import java.util.List;

import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.ByteToMessageDecoder;

public class StringFrameDecoder extends ByteToMessageDecoder {

	@Override
	protected synchronized void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) throws Exception {
		byte[] raw = new byte[in.readableBytes()];
		in.readBytes(raw);
		StringDatagram datagram = new StringDatagram(raw);
		out.add(datagram);
	}

}
