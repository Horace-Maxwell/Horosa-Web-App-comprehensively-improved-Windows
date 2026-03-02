package boundless.net;

public class PacketWriter implements IPacketWriter{
	private byte[] _encodingData = null;
	private int _packetId;
	private int _packetType;
	private short _responseId;
	private StreamWriter _body = new StreamWriter();

	public PacketWriter(int packetId) {
		this._packetId = packetId;
	}

	/**
	 * 获得包编号
	 */
	public int packetId() {
		return _packetId;
	}

	/**
	 * 获得包类型
	 * @return
	 */
	public int packetType() {
		return this._packetType;
	}
	public void packetType(int packetType) {
		this._packetType = packetType;
	}

	/**
	 * 获时得回调编号，当包类型为请求或响应包才有效
	 */
	public short responseId() {
		return this._responseId;
	}
	public void responseId(short responseId) {
		this._responseId = responseId;
	}

	/**
	 * 获取包体
	 * @return
	 */
	public StreamWriter body() {
		return _body;
	}

	/**
	 * return all bytes in the stream
	 * @return a byte array containing all the contents in the stream 
	 * including packet head and body
	 */
	public byte[] outputData() {
		if (_encodingData != null)
			return _encodingData;

		byte[] bodyOutputData = this._body.toArray();
		int length = this.length();
		StreamWriter pw = new StreamWriter();
		pw.writeInt24(length);
		pw.writeInt24(this._packetId);
		pw.write((byte) this._packetType);
		if (this._packetType != PacketType.NORMAL)
			pw.write((short) this._responseId);
		pw.write(bodyOutputData, 0, bodyOutputData.length);

		return pw.toArray();
	}

	/**
	 * return the length of packet including head and body
	 * @return the length of packet including head and body
	 */
	public int length() {
		if (_encodingData != null)
			return _encodingData.length;
		int length = (int) (3 + 3 + 1);
		if (this._packetType != PacketType.NORMAL)
			length += 2;
		return length + (int) _body.length();
	}

	/**
	 * verify if overflow the allowed packet length after adding an additional length
	 * @param addLength an additional length
	 * @return <ul>
	 * 	<li>true:overflow the allowed packet length</li>
	 * 	<li>false: no overflow the allowed packet length</li>
	 * </ul>
	 */
	public boolean overflow(int addLength) {
		int willLength = (int) (this.length() + addLength);
		return willLength >= Short.MAX_VALUE + Byte.MAX_VALUE;
	}

	// / <summary>
	// /
	// / </summary>
	/**
	 * write a boolean to packet
	 * @param value a boolean to be written to packet
	 * @return this PacketWriter object
	 */
	public PacketWriter write(boolean value) {
		this._body.write(value);
		return this;
	}

	// / <summary>
	// / Writes a 1-byte unsigned integer value to the underlying stream.
	// / </summary>
	public PacketWriter write(byte value) {
		this._body.write(value);
		return this;
	}

	// / <summary>
	// / Writes a 2-byte signed integer value to the underlying stream.
	// / </summary>
	public PacketWriter write(short value) {
		this._body.write(value);
		return this;
	}

	// / <summary>
	// / Writes a 4-byte signed integer value to the underlying stream.
	// / </summary>
	public PacketWriter write(int value) {
		this._body.write(value);
		return this;
	}

	/**
	 * writes a long to packet
	 * @param value a long to be written to packet
	 * @return this PacketWriter object
	 */
	public PacketWriter write(long value) {
		this._body.write(value);
		return this;
	}

	// / <summary>
	// / 写入用24位表示的数字。
	// / </summary>
	// / <param name="value"></param>
	public PacketWriter writeInt24(int value) {
		this._body.write(value);
		return this;
	}

	// / <summary>
	// / 写入用8位或16位表示的数字。
	// / </summary>
	// / <param name="value"></param>
	public PacketWriter writeInt8or16(short value) {
		this._body.write(value);
		return this;
	}

	// / <summary>
	// / 写入用16位或32位表示的数字。
	// / </summary>
	// / <param name="value"></param>
	public PacketWriter writeInt16or32(int value) {
		this._body.write(value);
		return this;
	}

	// / <summary>
	// / Writes a sequence of bytes to the underlying stream
	// / </summary>
	public PacketWriter write(byte[] buffer) {
		this._body.write(buffer);
		return this;
	}

	// / <summary>
	// / Writes a sequence of bytes to the underlying stream
	// / </summary>
	public PacketWriter write(byte[] buffer, int offset, int size) {
		this._body.write(buffer, offset, size);
		return this;
	}

	/**
	 * writes a string to packet
	 * @param value a string to be written to packet
	 * @return this PacketWriter object
	 */
	public PacketWriter writeString(String value) {
		this._body.writeString(value);
		return this;
	}

	/**
	 * writes a short string to packet.
	 * @param value a short string whose byte length must be less than 256 (byte-length &lt;= 255)
	 * @return this PacketWriter object
	 */
	public PacketWriter writeShortString(String value) {
		this._body.writeShortString(value);
		return this;
	}

	@Override
	public void load(IPacketReader reader) {
		if (reader == null) return;
        this._encodingData = reader.inputData();
	}
	
	public static PacketWriter createResponse(IPacketReader reader)
    {
        PacketWriter ipw = new PacketWriter(reader.packetId());
        ipw.responseId(reader.responseId());
        ipw.packetType(PacketType.RESPONSE);
        return ipw;
    }

    public static PacketWriter copyFrom(PacketReader reader)
    {            
        PacketWriter pw = new PacketWriter(reader.packetId());
        pw.responseId(reader.responseId());
        pw.packetType(reader.packetType());
        
        reader.reset();
        byte[] body = reader.readBytes();
        if(body != null){
        	pw.write(body);
        }
        return pw;
    }
}
