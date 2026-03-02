package boundless.netty;

import org.slf4j.Logger;

import boundless.net.ByteOrder;
import boundless.utility.StringUtility;

public interface Datagram {	

	public int command();
	public void command(int value);
	public int length();
	
	default public void key(String key){}
	
	default public boolean readBoolean(){
		throw new RuntimeException("no implementation");
	}
	default public byte readByte(){
		throw new RuntimeException("no implementation");
	}
	
	default public byte[] readBytes(){
		throw new RuntimeException("no implementation");
	}
	
	default public byte[] readBytes(int n){
		throw new RuntimeException("no implementation");
	}
	
	default public short readShort(){
		throw new RuntimeException("no implementation");
	}
	default public int readUInt16(){
		throw new RuntimeException("no implementation");
	}
	default public short readUInt8(){
		throw new RuntimeException("no implementation");
	}
	default public int readInt(){
		throw new RuntimeException("no implementation");
	}
	default public long readLong(){
		throw new RuntimeException("no implementation");
	}
	default public long readUInt32(){
		throw new RuntimeException("no implementation");
	}
	
	default public int readInt24(){
		throw new RuntimeException("no implementation");
	}
	default public String readString(){
		throw new RuntimeException("no implementation");
	}
	default public String readShortString(){
		throw new RuntimeException("no implementation");
	}
	default public byte currentByte(){
		throw new RuntimeException("no implementation");
	}
	default public float readFloat(){
		throw new RuntimeException("no implementation");
	}
	default public double readDouble(){
		throw new RuntimeException("no implementation");
	}
	
	default public void write(Boolean value){
		throw new RuntimeException("no implementation");
	}
	
	default public void write(byte value){
		throw new RuntimeException("no implementation");
	}
	
	default public void write(short value){
		throw new RuntimeException("no implementation");
	}
	
	default public void write(int value){
		throw new RuntimeException("no implementation");
	}
	
	default public void write(long value){
		throw new RuntimeException("no implementation");
	}
	
	default public void write(byte[] value){
		throw new RuntimeException("no implementation");
	}
	
	default public void write(byte[] buffer, int offset, int size){
		throw new RuntimeException("no implementation");
	}
	
	default public void writeUInt16(int value){
		throw new RuntimeException("no implementation");
	}
	
	default public void writeUInt32(long value){
		throw new RuntimeException("no implementation");
	}
	
	default public void writeInt24(int value){
		throw new RuntimeException("no implementation");
	}
	default public void writeString(String str){
		throw new RuntimeException("no implementation");
	}
	default public void writeShortString(String str){
		throw new RuntimeException("no implementation");
	}
	default public void write(float value){
		throw new RuntimeException("no implementation");
	}
	default public void write(double value){
		throw new RuntimeException("no implementation");
	}
	
	public byte[] getAllRawData();
	
	default byte[] getCurrentRawData(){
		return getAllRawData();
	}
	default public void copyFrom(Datagram raw){}
	
	default public String toHexString(){
		byte[] values = getCurrentRawData();
		StringBuilder res = new StringBuilder("[ ");
		for(byte value : values){
			res.append(StringUtility.toHex(value)).append(" ");
		}
		res.append("]");
		return res.toString();
	}

	default public String toDecString(){
		byte[] values = getCurrentRawData();
		StringBuilder res = new StringBuilder("[ ");
		for(byte value : values){
			res.append(value).append(" ");
		}
		res.append("]");
		return res.toString();
	}


	default public void customNo(int n){
		
	}

	default public int getCallbackno(){
		return 0;
	}
	
	default public void setCallbackno(int no){
	}

	default public String getKey(){
		return null;
	}
	
	default public void setKey(String key){
	}
	
	default public void order(ByteOrder value){
	}
	default public ByteOrder order(){ return ByteOrder.BIG_ENDIAN; }
	
	default public void id(String id){}
	default public String id(){ return ""; }

	default public void info(String info){}
	default public String info(){ return ""; }
	
	default public void packetMsg(String msg){}
	default public String packetMsg(){ return ""; }
	
	default public Logger log(){ return null; }
	default public void log(Logger log){}
	
	default public byte[] head(){ return null; }
	default public byte[] body(){ return null; }
	default public byte[] tail(){ return null; }
	
	default public void setIp(String ip){}
	default public void setPort(int port){}
	default public String getIp(){ throw new RuntimeException("no implementation"); }
	default public int getPort(){ throw new RuntimeException("no implementation"); }
	default public byte[] getFlag(){ throw new RuntimeException("no implementation"); }
	default public byte getNo(){ throw new RuntimeException("no implementation"); }
	default public byte getVersion(){ throw new RuntimeException("no implementation"); }
	default public byte getChecksum(){ throw new RuntimeException("no implementation"); }
	
	default public Datagram decodeRSA(String modulus, String privateExp){ throw new RuntimeException("no implementation"); }
	default public byte[] encodeRSA(String modulus, String publicExp){ throw new RuntimeException("no implementation"); }
}
