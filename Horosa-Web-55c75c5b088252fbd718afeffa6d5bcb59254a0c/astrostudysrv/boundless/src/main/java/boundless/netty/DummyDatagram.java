package boundless.netty;

public class DummyDatagram implements Datagram {
	private String ip;
	private int port;
	
	private byte[] data;
	
	public DummyDatagram(){
		data = new byte[0];
	}

	public DummyDatagram(byte[] fake){
		if(fake == null){
			data = new byte[0];
		}
		data = fake;
	}

	@Override
	public int command() {
		return 0;
	}

	@Override
	public void command(int value) {

	}

	@Override
	public int length() {
		return data.length;
	}

	@Override
	public boolean readBoolean() {
		return false;
	}

	@Override
	public byte readByte() {
		return 0;
	}

	@Override
	public byte[] readBytes() {
		return data;
	}

	@Override
	public byte[] readBytes(int n) {
		return data;
	}

	@Override
	public short readShort() {
		return 0;
	}

	@Override
	public int readUInt16() {
		return 0;
	}

	@Override
	public short readUInt8() {
		return 0;
	}

	@Override
	public int readInt() {
		return 0;
	}

	@Override
	public long readLong() {
		return 0;
	}

	@Override
	public long readUInt32() {
		return 0;
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

	@Override
	public byte[] getAllRawData() {
		return data;
	}

	public void setIp(String ip){
		this.ip = ip;
	}
	public void setPort(int port){
		this.port = port;
	}
	public String getIp(){
		return ip;
	}
	public int getPort(){
		return port;
	}
	
}
