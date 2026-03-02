package boundless.net.internal;

import boundless.exception.UnimplementedException;
import boundless.net.*;

/**
 * 内部包写入器。
 * 字节数组格式:同InternalPacketReader
 *
 */
public class InternalPacketWriter implements IPacketWriter,IOutputData
{
	private int _packetId;
	private int _connectionId;
	private int _packetType;
	private short _responseId;
	private StreamWriter _paramsWriter;
	private IPacketWriter _communicationWriter;
	
    public InternalPacketWriter(int packetId)
    {
    	this(0,(IPacketWriter)null);
        this._packetId = packetId;
    }

    /**
     * 
     * @param connectionId
     * @param communicationPacket 交互包写入器对象
     */
    public InternalPacketWriter(int connectionId,IPacketWriter communicationPacket)
    {
        this._connectionId = connectionId;
        _paramsWriter = new StreamWriter();
        if (communicationPacket!=null) _packetId = communicationPacket.packetId();
        this._communicationWriter = communicationPacket;
        this._responseId = 0;
    }

    /**
     * 
     * @param connectionId
     * @param communicationPacket 交互包读取器对象，用于转发接收到的交互包
     */
    public InternalPacketWriter(int connectionId, IPacketReader communicationPacket)
    {
    	this(connectionId, createPacketWriter(communicationPacket));
    }

    /**
     * 获得包编号
     * @return
     */
    public int packetId()
    {
        return _packetId;
    }
    /**
     * 设置包编号
     * @param value
     */
    public void packetId(int value)
    {
        _packetId=value;
    }

    /**
     * 导入读取器里的数据
     * @param reader
     */
    public void load(IPacketReader reader)
    {
        throw new UnimplementedException();
    }

    /**
     * 获得包输出数据。
     * @return
     */
	public byte[] outputData() {
		StreamWriter constVariantPw = new StreamWriter();
		constVariantPw.writeInt24(_connectionId);
		constVariantPw.write((byte) this._packetType);
		if (this._packetType != PacketType.NORMAL)
			constVariantPw.write((short) this._responseId);
		byte[] constVariantOutputData = constVariantPw.toArray();

		byte[] paramOutputData = _paramsWriter.toArray();
		int paramLength = paramOutputData.length;

		byte[] communicationOutputData = _communicationWriter == null ? null
				: _communicationWriter.outputData();

		StreamWriter pw = new StreamWriter();
		pw.writeInt24(this.length());
		pw.writeInt24(_packetId);
		pw.write(constVariantOutputData, 0, constVariantOutputData.length);
		pw.writeInt24(paramLength);
		pw.write(paramOutputData, 0, paramOutputData.length);
		if (communicationOutputData != null)
			pw.write(communicationOutputData, 0, communicationOutputData.length);

		return pw.toArray();
	}

    /**
     * 获得包输出数据的长度
     * @return
     */
    public int length()
    {
    	int length = 3 + 3 + 3 +1+(int)(this._packetType!=PacketType.NORMAL?2:0) + 3;
        length += _paramsWriter.length();
        if (_communicationWriter != null) length += _communicationWriter.length();
        return length;
    }

    /**
     * 是否溢出
     * @param addLength 要再加入的长度
     * @return true:溢出
     */
    public boolean overflow(int addLength)
    {
        int willLength = this.length() + addLength;
        return willLength >= Short.MAX_VALUE*2 + Byte.MAX_VALUE;
    }

    public int dataTypeId()
    {
    	return _packetId;
    }
    
    public Object sourceData()
    {
    	return this;
    }

    /**
     * 获得连接ID。用于表示包从哪个连接发出来或要发给哪个连接，实际意义由具体包自定
     * @return
     */
    public int connectionId(){
    	return _connectionId;
    }
    /**
     * 设置连接ID。用于表示包从哪个连接发出来或要发给哪个连接，实际意义由具体包自定
     * @param value
     */
    public void connectionId(int value){
    	_connectionId=value;
    }

    /**
     * 获得包类型
     * @return
     */
    public int packetType() { 
    	return _packetType;
    }
    /**
     * 设置包类型
     * @param value
     */
    public void packetType(int value) { 
    	_packetType=value;
    }

    /**
     * 获得回调响应ID
     * @return
     */
    public short responseId()
    {
        return _responseId;
    }
    /**
     * 设置回调响应ID
     * @param value
     */
    public void responseId(short value)
    {
        _responseId=value;
    }

    /// <summary>
    /// 获得自定义参数写入器对象
    /// </summary>
    public StreamWriter paramsWriter()
    {
        return _paramsWriter;
    }

    /**
     * 获得交互包写入器对象
     * @return
     */
    public IPacketWriter communicationWriter()
    {
    	return _communicationWriter;
    }
    /**
     * 设置交互包写入器对象
     * @param value
     */
    public void communicationWriter(IPacketWriter value)
    {
    	_communicationWriter=value;
    }

    public static InternalPacketWriter copyFrom(InternalPacketReader reader)
    {
        reader.reset();

        InternalPacketWriter ipw = new InternalPacketWriter(reader.connectionId(), reader.communicationReader());
        ipw.packetId(reader.packetId());

        byte[] paramBytes = reader.paramsReader().readBytes();
        if (paramBytes != null && paramBytes.length > 0) ipw.paramsWriter().write(paramBytes);
        return ipw;
    }

    /**
     * 创建响应包
     * @param reader 请求包
     * @return 响应包ID.null:同请求包
     */
    public static InternalPacketWriter createResponse(InternalPacketReader reader)
    {
        InternalPacketWriter ipw = new InternalPacketWriter(reader.packetId());
        ipw.connectionId(reader.connectionId());
        ipw.responseId(reader.responseId());
        ipw.packetType(PacketType.RESPONSE);
        return ipw;
    }

    private static IPacketWriter createPacketWriter(IPacketReader reader)
    {
        if (reader == null) return null;
        IPacketWriter pw = new PacketWriter(reader.packetId());
        pw.load(reader);
        return pw;
    }
}
