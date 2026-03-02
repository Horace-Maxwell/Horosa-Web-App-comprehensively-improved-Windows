package boundless.netty;

public class BasePacketIds {
	public static final int SSLPacket = 0;
	
	public static final int WebSockePacket = 0x7FFFFFFF;
	public static final int ExceptionPacket = 0xFFFFFFFF;
	public static final int HeartBeat = 0x0100;
	public static final int FileInfo = 0x0101;
	public static final int FileData = 0x0102;
	public static final int FileUpload = 0x0103;

	public static final int JsonRequest = 0x0200;

	public static final int ServerInfo = 0xFF00;
	public static final int WillReboot = 0xFE00;

	public static final int ChangeHost = 0xFD00;
	
}
