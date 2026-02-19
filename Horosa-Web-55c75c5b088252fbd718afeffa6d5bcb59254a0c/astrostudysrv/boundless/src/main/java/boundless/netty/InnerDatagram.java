package boundless.netty;

import boundless.net.ByteOrder;
import boundless.net.StreamReader;
import boundless.net.StreamWriter;
import boundless.netty.Datagram;
import boundless.utility.JsonUtility;

/**
 * 包格式: 起始域(2字节),长度域(3字节),版本域(1字节),序列号域(1字节),包编码(2字节),回调编码(4字节),数据域(N字节),校验和域(1字节)
 * 起始域(2字节, uint16): 0xF5,0xFA
 * 长度域(3字节, uint24): 整个报文包，包含从“起始域”到“校验和域”的所有字节
 * 版本域(1字节, byte): 0xF0
 * 序列号域(1字节, byte): 报文的序号0~255循环累加
 * 包编码(2字节, uint16): 报文编码，又称为命令代码
 * 回调编码(4字节, int32): 回调编码，一般为0，未来扩展用，如果非0，响应报文应如实复制请求报文中的回调编码
 * 数据域(N字节, byte[]): 存放具体内容
 * 校验和域(1字节, byte): 采用累加和计算校验值，计算范围:版本域+序列号域+包编码+回调编码+数据域
 * @author zjf
 *
 */
abstract public class InnerDatagram implements Datagram {
	public static byte[] StartFlag = new byte[]{(byte)0xF5, (byte)0xFA};
	public static byte Version = (byte) 0xF0;
	public static ByteOrder DataByteOrder = ByteOrder.BIG_ENDIAN;

	protected ByteOrder byteOrder = DataByteOrder;
	
	private String ip;
	private int port;

	protected byte[] flag = StartFlag;
	protected int length = 0;
	protected byte version = Version;
	protected byte no = 0;
	protected int command = 0;
	protected int callbackno = 0;

	protected byte[] data;
	
	protected byte checksum = 0;
	
	protected String info = "";
	
	public InnerDatagram(){
		
	}
	
	public void order(ByteOrder byteorder){
		this.byteOrder = byteorder;
	}
	public ByteOrder order(){
		return this.byteOrder;
	}

	public void setCallbackno(int no){
		this.callbackno = no;
	}
	
	public int getCallbackno(){
		return this.callbackno;
	}

	public byte[] getFlag() {
		return flag;
	}

	public void setFlag(byte[] flag) {
		this.flag = flag;
	}

	public byte getVersion() {
		return version;
	}

	public void setVersion(byte version) {
		this.version = version;
	}

	public byte getNo() {
		return no;
	}

	public void setNo(byte no) {
		this.no = no;
	}

	public int getCommand() {
		return command;
	}

	public void setCommand(int command) {
		this.command = command;
	}

	@Override
	public void info(String info) {
		this.info = info;
	}

	@Override
	public String info() {
		return this.info;
	}
	
	public String packetMsg(){
		return info();
	}
	
	public void packetMsg(String msg){
		this.info(msg);
	}
	
	public void command(int value){
		setCommand(value);
	}

	public byte[] getData() {
		return data;
	}

	public byte getChecksum() {
		return checksum;
	}

	public int command(){
		return this.getCommand();
	}
	
	public String toString(){
		return JsonUtility.encode(this);
	}
	
	protected byte generateChecksum(byte[] data){
		byte value = 0;
		value += this.version;
		value += this.no;
		for(int i=0; i<2; i++){
			value += (byte) ((this.command >> (8*i)) & 0xFF);
		}
		for(int i=0; i<4; i++){
			value += (byte) ((this.callbackno >> (8*i)) & 0xFF);
		}
		if(data != null && data.length > 0){
			for(byte n : data){
				value += n;
			}
		}
		return value;
	}
	
	@Override
	public byte[] getAllRawData(){
		StreamWriter sw = new StreamWriter();
		sw.order(this.byteOrder);
		
		sw.write(this.flag);
		sw.writeInt24(this.length());
		sw.write((byte)this.version);
		sw.write((byte)this.no);
		sw.write((short)this.command);
		sw.write(this.callbackno);
		sw.write(this.data);
		sw.write((byte)this.checksum);
		return sw.toArray();
	}
	
	@Override
	public int length(){
		return length & 0xffffff;
	}
	
	public void length(int length) {
		this.length = length;
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

	@Override
	public void copyFrom(Datagram raw){
		this.byteOrder = raw.order();
		this.flag = raw.getFlag();
		this.length = raw.length();
		this.version = raw.getVersion();
		this.no = raw.getNo();
		this.command = raw.command();
		this.callbackno = raw.getCallbackno();
		this.data = raw.body();
		this.checksum = raw.getChecksum();
	}

	@Override
	public byte[] body() {
		return this.data;
	}

	@Override
	public byte[] head() {
		StreamWriter sw = new StreamWriter();
		sw.order(this.byteOrder);
		
		sw.write(this.flag);
		sw.writeInt24(this.length());
		sw.write((byte)this.version);
		sw.write((byte)this.no);
		sw.write((short)this.command);
		sw.write(this.callbackno);
		return sw.toArray();
	}

	@Override
	public byte[] tail() {
		return new byte[]{ (byte)this.checksum };
	}
	
}
