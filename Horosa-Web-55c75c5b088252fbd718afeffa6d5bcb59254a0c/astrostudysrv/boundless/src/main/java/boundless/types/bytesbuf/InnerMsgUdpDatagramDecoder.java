package boundless.types.bytesbuf;

import java.net.DatagramPacket;
import java.util.List;

import org.slf4j.Logger;

import boundless.log.QueueLog;
import boundless.net.ByteOrder;
import boundless.net.StreamReader;
import boundless.netty.Datagram;
import boundless.netty.InnerDatagram;
import boundless.netty.InnerInboundDatagram;
import boundless.utility.StringUtility;

public class InnerMsgUdpDatagramDecoder implements UdpPacketDecoder {
	private Logger logger;
	private Logger errorLogger;
	
	public void setLogger(Logger logger){
		this.logger = logger;
	}
	public void setErrorLogger(Logger errorLogger){
		this.errorLogger = errorLogger;
	}

	public synchronized void decode(DatagramPacket msg, List<Datagram> out, boolean tracePacket) {
		ByteOrder byteOrder = InnerDatagram.DataByteOrder;

		if(msg.getLength() < 5){
			return;
		}
		
		byte[] raw = msg.getData();
		byte[] indata = new byte[msg.getLength()];
		System.arraycopy(raw, msg.getOffset(), indata, 0, indata.length);
		if(tracePacket){
			String rx = String.format("UDPRX: length:%d, from: %s:%d \n%s", 
					indata.length, msg.getAddress().toString(), msg.getPort(), StringUtility.toHex(indata));
			if(this.logger == null){
				System.out.println(rx);
			}else{
				QueueLog.debug(logger, rx);
			}
		}else{
			String rx = String.format("UDPRX: length:%d, from: %s:%d", indata.length, msg.getAddress().toString(), msg.getPort());
			if(this.logger == null){
				System.out.println(rx);
			}else{
				QueueLog.debug(logger, rx);
			}
		}
		
		StreamReader in = new StreamReader(indata);
		in.order(byteOrder);
		
		byte flag1 = in.readByte();
		byte flag2 = in.readByte();
		if(flag1 != InnerDatagram.StartFlag[0] || flag2 != InnerDatagram.StartFlag[1]){
			if(this.errorLogger == null){
				System.out.println("udppacket flag error");
			}else{
				QueueLog.error(errorLogger, "udppacket flag error");
			}
			return;
		}
		int pktlen = in.readInt24();
		int len = pktlen - 5;
		int avail = in.readableBytes(); 
		if(avail < len){
			if(this.errorLogger == null){
				System.out.println("udppacket length error");
			}else{
				QueueLog.error(errorLogger, "udppacket length error");
			}
			return;
		}
		InnerInboundDatagram datagram = new InnerInboundDatagram();
		datagram.setIp(msg.getAddress().getHostAddress());
		datagram.setPort(msg.getPort());
		
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
			if(this.errorLogger == null){
				System.out.println("received data checksum error, discard data: " + datagram.toHexString());
			}else{
				QueueLog.error(errorLogger, "received data checksum error, discard data: {}", datagram.toHexString());
			}
		}else{
			out.add(datagram);
			if(!tracePacket){
				String rx = String.format("UDPRX: packet command:0x%04X, dec:%d", datagram.command(), datagram.command());
				if(this.logger == null){
					System.out.println(rx);
				}else{
					QueueLog.debug(logger, rx);
				}
			}
		}
		
	}

}
