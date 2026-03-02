package boundless.netty;


import boundless.net.ByteOrder;
import boundless.net.StreamWriter;

public class InnerStringDatagram implements Datagram {
	private String ip;
	private int port;
	
	private byte[] data;
	private ByteOrder byteOrder;
	
	public InnerStringDatagram(){
		this(new byte[0]);
	}
	
	public InnerStringDatagram(byte[] data){
		this.data = data;
		byteOrder = ByteOrder.BIG_ENDIAN;
	}

	@Override
	public int command() {
		return BasePacketIds.ExceptionPacket;
	}

	@Override
	public void command(int value) {
		
	}

	@Override
	public int length() {
		return this.data.length + 3;
	}

	@Override
	public byte[] getAllRawData() {
		StreamWriter sw = new StreamWriter();
		sw.order(byteOrder);
		sw.writeInt24(this.data.length);
		sw.write(this.data);
		return sw.toArray();
	}
	
	public String getString(){
		return getString("UTF-8");
	}
	
	public String getString(String locale){
		try{
			return new String(this.data, locale);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	@Override
	public void packetMsg(String msg) {
		try {
			this.data = msg.getBytes("UTF-8");
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	@Override
	public String packetMsg() {
		return getString();
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
