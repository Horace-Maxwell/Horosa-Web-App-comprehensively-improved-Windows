package boundless.netty;


import boundless.net.ByteOrder;
import boundless.net.StreamReader;
import boundless.security.SimpleCommSecUtility;
import boundless.types.bytesbuf.ByteBuf;
import boundless.types.bytesbuf.ByteBuffer;
import boundless.utility.StringUtility;


public class InnerInboundDatagram extends InnerDatagram {

	private StreamReader reader;
	
	private String pktMsg;
	
	public InnerInboundDatagram(){
		
	}

	public void setChecksum(byte checksum) {
		this.checksum = checksum;
	}
		
	public void setData(byte[] data) {
		this.data = data;
		this.reader = new StreamReader(data);
		this.reader.order(byteOrder);
	}
	
	public boolean validateChecksum(){
		byte value = generateChecksum(this.data);
		return value == this.checksum;
	}
	
	@Override
	public String packetMsg(){
		if(StringUtility.isNullOrEmpty(this.pktMsg)){
			this.pktMsg = readString();
		}
		
		return this.pktMsg;
	}
		
	@Override
	public boolean readBoolean() {
		return this.reader.readBoolean();
	}

	@Override
	public byte readByte() {
		return this.reader.readByte();
	}

	@Override
	public byte[] readBytes() {
		return this.reader.readBytes();
	}

	@Override
	public byte[] readBytes(int n) {
		return this.reader.readBytes(n);
	}

	@Override
	public short readShort() {
		return this.reader.readInt16();
	}

	@Override
	public short readUInt8() {
		return this.reader.readUInt8();
	}

	@Override
	public int readUInt16() {
		return this.reader.readUInt16();
	}

	@Override
	public int readInt24() {
		return this.reader.readInt24();
	}

	@Override
	public long readUInt32() {
		return this.reader.readUInt32();
	}
	
	@Override
	public int readInt(){
		return this.reader.readInt32();
	}
	
	@Override
	public long readLong(){
		return this.reader.readLong();
	}
	
	@Override
	public String readString(){
		return this.reader.readString();
	}
	
	@Override
	public String readShortString(){
		return this.reader.readShortString();
	}	
	
	@Override
	public float readFloat(){
		return this.reader.readFloat();
	}
	
	@Override
	public double readDouble(){
		return this.reader.readDouble();
	}
	
	public Datagram decodeRSA(String modulus, String privateExp){
		if(this.command() != BasePacketIds.SSLPacket){
			return this;
		}
		this.reader.reset();
		String codedstr = this.readString();
		byte[] raw = SimpleCommSecUtility.decrypt(codedstr, modulus, privateExp);
		ByteBuffer buffer = new ByteBuffer();
		buffer.addBytes(raw);
		try {
			return innerDecode(buffer);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}

	}
	
	private Datagram innerDecode(ByteBuf in) {
		ByteOrder byteOrder = InnerDatagram.DataByteOrder;
		boolean flagFound = false;
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
			throw new RuntimeException(msgerr);
		}
		flagFound = false;
		return datagram;

	}
	
	
	@Override
	public void write(Boolean value) {
		throw new RuntimeException("no implementation");
	}

	@Override
	public void write(byte value) {
		throw new RuntimeException("no implementation");
	}

	@Override
	public void write(short value) {
		throw new RuntimeException("no implementation");
	}

	@Override
	public void write(int value) {
		throw new RuntimeException("no implementation");
	}

	@Override
	public void write(long value) {
		throw new RuntimeException("no implementation");
	}

	@Override
	public void write(byte[] value) {
		throw new RuntimeException("no implementation");
	}

	@Override
	public void write(byte[] buffer, int offset, int size) {
		throw new RuntimeException("no implementation");
	}

	@Override
	public void writeUInt16(int value) {
		throw new RuntimeException("no implementation");
	}

	@Override
	public void writeUInt32(long value) {
		throw new RuntimeException("no implementation");
	}
}
