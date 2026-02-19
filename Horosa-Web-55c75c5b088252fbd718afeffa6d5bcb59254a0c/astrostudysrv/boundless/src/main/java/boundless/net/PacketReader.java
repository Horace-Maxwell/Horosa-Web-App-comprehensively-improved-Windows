package boundless.net;

public class PacketReader implements IPacketReader{
	private byte[] _inputData;
	private int _packetId;
	private int _packetType;
	private short _resposeId;
	private StreamReader _body;

	public PacketReader(byte[] inputData) {
		this._inputData = inputData;
		StreamReader reader = new StreamReader(inputData);
		reader.seek(3, SeekOrigin.BEGIN);
		this._packetId = reader.readInt24();
		byte flag = reader.readByte();
		this._packetType = (int) (flag & 3);
		if (this._packetType != PacketType.NORMAL)
			this._resposeId = reader.readInt16();
		byte[] raw = reader.readBytes();
		if(raw == null){
			raw = new byte[0];
		}
		this._body = new StreamReader(raw);
	}

	/**
	 * 获得原始输入数据
	 */
	public byte[] inputData() {
		return this._inputData;
	}

	/**
	 * 获得包编号
	 */
	public int packetId() {
		return this._packetId;
	}

	/**
	 * 获时得回调编号，当包类型为请求或响应包才有效
	 */
	public short responseId() {
		return this._resposeId;
	}

	/**
	 * 获取包体
	 * @return
	 */
	public StreamReader body() {
		return this._body;
	}

	/**
	 * set the cursor to the beginning of stream. That means the offset in stream is 0
	 */
	public void reset() {
		_body.seek(0, SeekOrigin.BEGIN);
	}

	/**
	 * 获得包类型
	 */
	public int packetType() {
		return this._packetType;
	}

	/**
	 * indicate whether the cursor (offset) is in the end of stream.
	 * @return
	 * <ul>
	 * 	<li>true: at the end of stream</li>
	 * 	<li>false: not at the end of stream</li>
	 * </ul>
	 */
	public boolean eof() {
		return this._body.eof();
	}

	/**
	 * read a long from stream
	 * @return a long integer
	 */
	public long readLong() {
		return this._body.readLong();
	}

	public int readInt32() {
		return this._body.readInt32();
	}

	public short readInt16() {
		return this._body.readInt16();
	}

	public byte readByte() {
		return this._body.readByte();
	}

	/**
	 * 读取用24位表示的数字。
	 * @return
	 */
	public int readInt24() {
		return this._body.readInt24();
	}

	/**
	 * 读取用8位或16位表示的数字。
	 * @return
	 */
	public int readInt8or16() {
		return this._body.readInt8or16();
	}

	/**
	 * 读取用16位或32位表示的数字。
	 * @return
	 */
	public int readInt16or32() {
		return this._body.readInt16or32();
	}

	public boolean readBoolean() {
		return this._body.readBoolean();
	}

	public String readString() {
		return this._body.readString();
	}

	/** 
	 * read a string from stream
	 * @return the string from stream, this byte-length of string must be less than 256
	 */
	public String readShortString() {
		return this._body.readShortString();
	}

	/**
	 * read the rest bytes from current position in stream
	 * @return a bytes array containing all rest bytes in stream from current position
	 */
	public byte[] readBytes() {
		return this._body.readBytes();
	}

	/**
	 * read the n-length bytes in stream from current position
	 * @param n the number of bytes to be read from stream
	 * @return a byte array containing the n-length bytes, 
	 * 	the length of byte array is less and equal to n, 
	 * 	if the size of rest bytes in stream less and equal to n.
	 */
	public byte[] readBytes(int n) {
		return this._body.readBytes(n);
	}
	
	public int length(){
		return _inputData.length;
	}
}
