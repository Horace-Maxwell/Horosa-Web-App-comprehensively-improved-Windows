package boundless.netty;

import java.util.List;

import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.ByteToMessageDecoder;

public class InnerStringFrameDecoder extends ByteToMessageDecoder {

	@Override
	protected synchronized void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) throws Exception {
		byte[] raw = new byte[in.readableBytes()];
		in.readBytes(raw);
		InnerStringDatagram datagram = new InnerStringDatagram(raw);
		out.add(datagram);
	}

}
