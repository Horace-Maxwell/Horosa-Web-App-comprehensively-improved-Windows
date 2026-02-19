package boundless.netty;


import boundless.net.ByteOrder;
import boundless.net.StreamWriter;
import boundless.security.SimpleCommSecUtility;

public class InnerOutboundDatagram extends InnerDatagram {
	private static byte noCounter = 0;
		
	private StreamWriter streamWriter = new StreamWriter();
	
	public InnerOutboundDatagram(){
		this(0);
	}
	
	public InnerOutboundDatagram(int command){
		this.command = command & 0xffff;
		streamWriter.order(this.byteOrder);
	}
	
	public void order(ByteOrder byteorder){
		super.order(byteorder);
		this.streamWriter.order(byteorder);
	}
	
	public void order(java.nio.ByteOrder byteorder) {
		ByteOrder border = ByteOrder.from(byteorder);
		order(border);
	}

	@Override
	public void copyFrom(Datagram raw){
		this.byteOrder = raw.order();
		this.flag = raw.getFlag();
		this.length = raw.length();
		this.version = raw.getVersion();
		this.no = raw.getNo();
		this.command = raw.command();
		this.callbackno = raw.getCallbackno();
		this.checksum = raw.getChecksum();
		
		this.streamWriter = new StreamWriter();
		this.streamWriter.write(raw.body());
	}
	
	@Override
	public int length() {
		return this.streamWriter.length() + 14;
	}

	@Override
	public void packetMsg(String msg){
		this.streamWriter.writeString(msg);
	}

	@Override
	public void write(Boolean value) {
		this.streamWriter.write(value);
	}

	@Override
	public void write(byte value) {
		this.streamWriter.write(value);
	}

	@Override
	public void write(short value) {
		this.streamWriter.write(value);
	}

	@Override
	public void write(int value) {
		this.streamWriter.write(value);
	}

	@Override
	public void write(long value) {
		this.streamWriter.write(value);
	}

	@Override
	public void write(byte[] value) {
		this.streamWriter.write(value);
	}

	@Override
	public void write(byte[] buffer, int offset, int size) {
		this.streamWriter.write(buffer, offset, size);
	}

	@Override
	public void writeUInt16(int value) {
		this.streamWriter.writeUInt16(value);
	}

	@Override
	public void writeInt24(int value) {
		this.streamWriter.writeInt24(value);
	}

	@Override
	public void writeUInt32(long value) {
		this.streamWriter.writeUInt32(value);
	}
	
	@Override
	public void writeString(String str){
		this.streamWriter.writeString(str);
	}

	@Override
	public void writeShortString(String str){
		this.streamWriter.writeShortString(str);
	}
	
	@Override
	public void write(float value){
		this.streamWriter.write(value);
	}
	
	@Override
	public void write(double value){
		this.streamWriter.write(value);
	}
	
	@Override
	public byte[] getAllRawData() {
		this.no = noCounter++;
		return getCurrentRawData();
	}

	@Override
	public byte[] getCurrentRawData() {
		StreamWriter sw = new StreamWriter();
		sw.order(this.streamWriter.order());
		
		sw.write(this.flag);
		sw.writeInt24(this.length());
		sw.write((byte)this.version);
		sw.write((byte)this.no);
		sw.write((short)this.command);
		sw.write((int)this.callbackno);
		
		byte[] data = this.streamWriter.toArray();
		this.checksum = generateChecksum(data);
		
		sw.write(data);
		sw.write((byte)this.checksum);
		
		byte[] res = sw.toArray();
		this.length = res.length;
		
		return res;
	}
		
	@Override
	public byte[] encodeRSA(String modulus, String publicExp){
		Datagram ssldata = new InnerOutboundDatagram(BasePacketIds.SSLPacket);
		byte[] raw = this.getAllRawData();
		String coded = SimpleCommSecUtility.encrypt(raw, modulus, publicExp);
		ssldata.writeString(coded);
		return ssldata.getAllRawData();
	}
	
	@Override
	public boolean readBoolean() {
		throw new RuntimeException("no implementation");
	}

	@Override
	public byte readByte() {
		throw new RuntimeException("no implementation");
	}

	@Override
	public byte[] readBytes() {
		throw new RuntimeException("no implementation");
	}

	@Override
	public byte[] readBytes(int n) {
		throw new RuntimeException("no implementation");
	}

	@Override
	public short readShort() {
		throw new RuntimeException("no implementation");
	}

	@Override
	public short readUInt8() {
		throw new RuntimeException("no implementation");
	}

	@Override
	public int readUInt16() {
		throw new RuntimeException("no implementation");
	}

	@Override
	public long readUInt32() {
		throw new RuntimeException("no implementation");
	}

	@Override
	public int readInt() {
		throw new RuntimeException("no implementation");
	}

	@Override
	public long readLong() {
		throw new RuntimeException("no implementation");
	}


}
