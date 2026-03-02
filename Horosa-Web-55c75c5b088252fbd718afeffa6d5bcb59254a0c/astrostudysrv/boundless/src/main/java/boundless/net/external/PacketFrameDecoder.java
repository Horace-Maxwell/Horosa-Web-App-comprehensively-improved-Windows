package boundless.net.external;

import java.util.List;

import boundless.log.Logger;
import boundless.log.QueueLog;
import boundless.net.StreamReader;
import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.ByteToMessageDecoder;

public class PacketFrameDecoder extends ByteToMessageDecoder {
	private Logger _logger;

	public PacketFrameDecoder(Logger logger) {
		_logger=logger;
	}
	
	@Override
	protected void decode(ChannelHandlerContext ctx, ByteBuf in,
			List<Object> out) throws Exception {
		while (true) {
			int readableLength = in.readableBytes();
			if (readableLength < 3)
				return;

			in.markReaderIndex();
			
			int packetLength = (StreamReader.toInt(in.readByte()) << 16) + (StreamReader.toInt(in.readByte()) << 8)
					+ StreamReader.toInt(in.readByte());
			
			if (packetLength < 6)
            {
				ctx.channel().close();
                if (_logger!=null){
                	_logger.writeLog("Packet length "+packetLength+" error,client:" + ctx.channel().remoteAddress());
                }
                return;
            }
			
			in.resetReaderIndex();
			if (readableLength < packetLength)
				return;

			out.add(in.readBytes(packetLength));
		}
	}
}
