package boundless.types.bytesbuf;

import java.util.List;

import boundless.net.ByteOrder;
import boundless.net.StreamReader;
import boundless.netty.Datagram;
import boundless.netty.InnerDatagram;
import boundless.netty.InnerInboundDatagram;

public class InnerMsgPacketDecoder implements PacketDecoder {
	private boolean flagFound = false;
	
	public synchronized void decode(ByteBuf in, List<Datagram> out){
		Datagram datagram = innerDecode(in);
		if(datagram == null){
			return;
		}
		
		out.add(datagram);
	}

	private Datagram innerDecode(ByteBuf in) {
		ByteOrder byteOrder = InnerDatagram.DataByteOrder;
		try{
			if(!flagFound){
				if(in.readableBytes() < 2){
					return null;
				}
				byte flag = in.getByte(0);
				if(flag == InnerDatagram.StartFlag[0]){
					in.readByte();
					in.discardReadBytes();
					flag = in.getByte(0);
					if(flag == InnerDatagram.StartFlag[1]){
						in.readByte();
						in.discardReadBytes();
						flagFound = true;
					}
				}else{
					in.readByte();
					in.discardReadBytes();
				}
				if(!flagFound){
					return null;
				}
			}
			
			if(in.readableBytes() < 3){
				return null;
			}
			byte[] lenbytes = new byte[3];
			in.getBytes(0, lenbytes);
			StreamReader reader = new StreamReader(lenbytes);
			reader.order(byteOrder);
			int len = reader.readInt24();
			int avail = len - 5;
			if(in.readableBytes()-3 < avail){
				return null;
			}
			in.readBytes(lenbytes);
			
			byte[] raw = new byte[avail];
			in.readBytes(raw);
			reader = new StreamReader(raw);
			reader.order(byteOrder);
			
			InnerInboundDatagram datagram = new InnerInboundDatagram();
			datagram.length(len);
			datagram.setVersion(reader.readByte());
			datagram.setNo(reader.readByte());
			datagram.setCommand(reader.readUInt16());
			datagram.setCallbackno(reader.readInt32());
			int datalen = avail - 9;
			if(datalen > 0){
				byte[] data = reader.readBytes(datalen);
				datagram.setData(data);
			}
			datagram.setChecksum(reader.readByte());
			
			in.discardReadBytes();
			
			if(!datagram.validateChecksum()){
				StringBuilder msg = new StringBuilder("received data checksum error, discard data:");
				msg.append(datagram.toHexString());
				String msgerr = msg.toString();
				flagFound = false;
				throw new Exception(msgerr);
			}
			flagFound = false;
			return datagram;
		}catch(Exception e){
			e.printStackTrace();
			
			in.discardReadBytes();
			int n = in.readableBytes();
			if(n > 0){
				in.skipBytes(n);
				in.discardReadBytes();
				String msg = String.format("discard %d bytes, since decode exception:%s, errmsg:%s", 
						n, e.getClass().getName(), e.getMessage());
				System.out.println(msg);
			}
			return null;
		}

	}
		
}
