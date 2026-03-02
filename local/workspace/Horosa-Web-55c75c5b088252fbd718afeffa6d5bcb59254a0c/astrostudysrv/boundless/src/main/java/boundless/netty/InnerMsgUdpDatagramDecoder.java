package boundless.netty;

import java.util.List;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.ByteOrder;
import boundless.net.StreamReader;
import boundless.security.RSASetup;
import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.socket.DatagramPacket;
import io.netty.handler.codec.MessageToMessageDecoder;

public class InnerMsgUdpDatagramDecoder extends MessageToMessageDecoder<DatagramPacket> implements RSASetup {
	private String selfPrivateExp;
	private String selfModulus;
	
	public void setPrivateKey(String privateModulus, String privateExp){
		this.selfModulus = privateModulus;
		this.selfPrivateExp = privateExp;
	}
	
	@Override
	protected synchronized void decode(ChannelHandlerContext ctx, DatagramPacket msg, List<Object> out) throws Exception {
		Datagram datagram = innerDecode(ctx, msg);
		if(datagram == null){
			return;
		}
		if(datagram.command() == BasePacketIds.SSLPacket){
			Datagram realdata = datagram.decodeRSA(selfModulus, selfPrivateExp);
			if(realdata != null){
				out.add(realdata);
			}
		}else{
			out.add(datagram);
		}
	}

	private InnerInboundDatagram innerDecode(ChannelHandlerContext ctx, DatagramPacket msg) throws Exception {
		ByteOrder byteOrder = InnerDatagram.DataByteOrder;
		try {
			ByteBuf buf = msg.content();
			if(buf.readableBytes() < 5){
				return null;
			}
			
			byte[] raw = new byte[buf.readableBytes()];
			buf.readBytes(raw);
			
			StreamReader in = new StreamReader(raw);
			in.order(byteOrder);
			
			byte flag1 = in.readByte();
			byte flag2 = in.readByte();
			if(flag1 != InnerDatagram.StartFlag[0] || flag2 != InnerDatagram.StartFlag[1]){
				return null;
			}
			int pktlen = in.readInt24();
			int len = pktlen - 5;
			int avail = in.readableBytes(); 
			if(avail < len){
				return null;
			}
			InnerInboundDatagram datagram = new InnerInboundDatagram();
			datagram.length(pktlen);
			datagram.setVersion(in.readByte());
			datagram.setNo(in.readByte());
			datagram.setCommand(in.readUInt16());
			datagram.setCallbackno(in.readInt32());
			int datalen = len - 9;
			if(datalen > 0){
				byte[] data = new byte[datalen];
				if(data.length > 0){
					in.readBytes(data);
				}
				datagram.setData(data);
			}
			datagram.setChecksum(in.readByte());
			
			if(!datagram.validateChecksum()){
				QueueLog.error(AppLoggers.ErrorLogger, "received data checksum error, discard data:{}", datagram.toHexString());
				buf.discardReadBytes();
				return null;
			}
			
			buf.discardReadBytes();
			return datagram;
			
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return null;
		}
	}

}
