package boundless.net.internal;

import boundless.net.*;

/**
 * 内部包读取器
 * 
 */
public class InternalPacketReader implements IPacketReader
{
	private byte[] _inputData;
	private int _packetId;
	private int _connectionId;
	private int _packetType;
	private short _responseId;
	private StreamReader _paramsReader;
	private PacketReader _communicationReader;
	
    public InternalPacketReader(byte[] inputData)
    {
        this._inputData=inputData;

        StreamReader reader = new StreamReader(inputData);
        reader.seek(3, SeekOrigin.BEGIN);
        this._packetId = reader.readInt24();
        this._connectionId = reader.readInt24();

        byte flag = reader.readByte();
        this._packetType = flag & 3;
        if (this._packetType != PacketType.NORMAL) this._responseId = reader.readInt16();

        int paramLength = reader.readInt24();
        byte[] paramData = reader.readBytes((int)paramLength);
        _paramsReader = new StreamReader(paramData == null?new byte[0]:paramData);

        byte[] communicationContent = reader.readBytes();
        if (communicationContent == null || communicationContent.length <= 0) return;
        _communicationReader = new PacketReader(communicationContent);

        if (this._packetId == InternalPacketIds.COMMUNICATION_CARRIER && _communicationReader != null) this._packetId = _communicationReader.packetId();
    }

    /**
     * 获得包编号
     */
    public int packetId()
    {
        return _packetId;
    }

    /**
     * 获得包输入数据
     */
    public byte[] inputData()
    {
        return _inputData;
    }

    /**
     * 连接ID，用于表示包从哪个连接发出来或要发给哪个连接，实际意义由具体包自定
     * @return
     */
    public int connectionId()
    {
        return _connectionId;
    }

    /**
     * 获得包类型
     */
    public int packetType(){
    	return _packetType;
    }

    /**
     * 获得回调响应ID
     */
    public short responseId() { 
    	return _responseId;
    }

    /**
     * 获得自定义参数读取器
     * @return
     */
    public StreamReader paramsReader()
    {
        return _paramsReader;
    }

    /**
     * 获得交互包读取器对象
     * @return
     */
    public PacketReader communicationReader()
    {
        return _communicationReader;
    }

    public void reset()
    {
        _paramsReader.seek(0, SeekOrigin.BEGIN);
        if (_communicationReader!=null) _communicationReader.reset();
    }

	@Override
	public int length() {
		return _inputData.length;
	}
}
