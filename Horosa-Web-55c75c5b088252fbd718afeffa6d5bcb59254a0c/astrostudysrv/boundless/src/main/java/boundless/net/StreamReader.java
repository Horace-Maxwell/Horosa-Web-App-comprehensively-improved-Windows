package boundless.net;

import java.util.*;


/// <summary>
/// 数据流读取器
/// </summary>
public class StreamReader{
    private byte[] _data;
    private int _position;
    private ByteOrder _byteOrder;
    
    private int stringLengthByte = 3;

    public StreamReader(byte[] data)
    {
    	if(data == null){
    		_data = new byte[0];
    	}else{
            _data = data;
    	}
        _position = 0;
        _byteOrder = ByteOrder.BIG_ENDIAN;
    }
    
    public ByteOrder order(){
    	return _byteOrder;
    }
    
    public void order(ByteOrder order){
    	this._byteOrder = order;
    }
    
    public void order(java.nio.ByteOrder order){
    	if(order == java.nio.ByteOrder.BIG_ENDIAN) {
        	this._byteOrder = ByteOrder.BIG_ENDIAN;    		
    	}else {
    		this._byteOrder = ByteOrder.LITTLE_ENDIAN;   
    	}
    }    
    
    public void stringLengthByte(int value){
    	this.stringLengthByte = value;
    }

    public byte[] toBuffer(){
        return _data;
    }

    public int length()
    {
        return _data.length;
    }

    public boolean eof()
    {
        return _position >= length();
    }

    /**
     * seek the location in stream
     * @param offset the offset from the cursor
     * @param origin direction from which we begin seeking. 
     * 	<br>there are 3 direction<br>
     * 		<ul>
     * 			<li>SeekOrigin.BEGIN: set the offset from the beginning of the stream,
     * 				so the new position is the offset </li>
     * 			<li>SeekOrigin.CURRENT: set the offset from the current position of the stream, 
     * 				so the new position is current position plus the offset </li>
     * 			<li>SeekOrigin.END: set the offset from the end of the stream, 
     * 				so the new position is the length of stream minus the offset.</li>
     * 		</ul>
     * @return the new position in the stream.
     */
    public int seek(int offset,SeekOrigin origin)
    {
    	if (origin==SeekOrigin.BEGIN) _position = offset; 
    	else if (origin==SeekOrigin.CURRENT) _position += offset; 
    	else if (origin==SeekOrigin.END) _position = length() - offset;

        return _position;
    }

    public long readLong()
    {
        if ((_position + 8) > length())
        {
            _position = length();
            return 0;
        }
        
        long res = 0L;
        
        if(order() == ByteOrder.LITTLE_ENDIAN){
            byte b = _data[_position++];
            res |=  (b & 0xff);
            
            b = _data[_position++];
            res |= ((0L |  (b & 0xff)) << 8);
            
            b = _data[_position++];
            res |= ((0L |  (b & 0xff)) << 16);
            
            b = _data[_position++];
            res |= ((0L |  (b & 0xff)) << 24);
            
            b = _data[_position++];
            res |= ((0L |  (b & 0xff)) << 32);
            
            b = _data[_position++];
            res |= ((0L |  (b & 0xff)) << 40);
            
            b = _data[_position++];
            res |= ((0L |  (b & 0xff)) << 48);
            
            b = _data[_position++];
            res |= ((0L | (b & 0xff)) << 56);
            
            return res;
        }
        
        byte b = _data[_position++];
        res |= ((0L | (b & 0xff)) << 56);
        
        b = _data[_position++];
        res |= ((0L |  (b & 0xff)) << 48);
        
        b = _data[_position++];
        res |= ((0L |  (b & 0xff)) << 40);
        
        b = _data[_position++];
        res |= ((0L |  (b & 0xff)) << 32);
        
        b = _data[_position++];
        res |= ((0L |  (b & 0xff)) << 24);
        
        b = _data[_position++];
        res |= ((0L |  (b & 0xff)) << 16);
        
        b = _data[_position++];
        res |= ((0L |  (b & 0xff)) << 8);
        
        b = _data[_position++];
        res |=  (b & 0xff);
        
        return res;
    }
    
    public long readUInt32(){
        if ((_position + 4) > length())
        {
            _position = length();
            return 0;
        }
        
        if(order() == ByteOrder.LITTLE_ENDIAN){
            return (0L | toInt(_data[_position++]))
                    | ((0L | toInt(_data[_position++])) << 8)
                    | ((0L | toInt(_data[_position++])) << 16)
            		| ((0L | toInt(_data[_position++])) << 24);
        }

        return ((0L | toInt(_data[_position++])) << 24)
             | ((0L | toInt(_data[_position++])) << 16)
             | ((0L | toInt(_data[_position++])) << 8)
             | (0L | toInt(_data[_position++]));
    }

    public int readInt32()
    {
        if ((_position + 4) > length())
        {
            _position = length();
            return 0;
        }
        
        if(order() == ByteOrder.LITTLE_ENDIAN){
            return ((toInt(_data[_position++])
                    | (toInt(_data[_position++]) << 8)
                    | (toInt(_data[_position++]) << 16)
            		| toInt(_data[_position++]) << 24));
        }

        return (toInt(_data[_position++]) << 24)
             | (toInt(_data[_position++]) << 16)
             | (toInt(_data[_position++]) << 8)
             | (toInt(_data[_position++]));
    }

    public short readInt16()
    {
        if ((_position + 2) > length())
        {
            _position = length();
            return 0;
        }
        if(order() == ByteOrder.LITTLE_ENDIAN){
            return (short)(toInt(_data[_position++]) | (toInt(_data[_position++]) << 8));
        }
        return (short)((toInt(_data[_position++]) << 8) | toInt(_data[_position++]));
    }
    
    public short readShort(){
    	return readInt16();
    }
    
    public short readUInt8(){
    	byte value = readByte();
    	return (short) (value & 0xff);
    }
    
    public int readUInt16(){
        if ((_position + 2) > length())
        {
            _position = length();
            return 0;
        }
        if(order() == ByteOrder.LITTLE_ENDIAN){
            return toInt(_data[_position++]) | (toInt(_data[_position++]) << 8);
        }
        return (toInt(_data[_position++]) << 8) | toInt(_data[_position++]);
    }

    public byte readByte()
    {
        if ((_position + 1) > length())
        {
            _position = length();
            return 0;
        }

        return _data[_position++];
    }

    /// <summary>
    /// 读取用24位表示的数字。
    /// </summary>
    /// <returns></returns>
    public int readInt24()
    {
    	if ((_position + 3) > length())
        {
            _position = length();
            return 0;
        }

    	if(order() == ByteOrder.LITTLE_ENDIAN){
            return (int)((toInt(_data[_position++]) | (toInt(_data[_position++]) << 8) | toInt(_data[_position++]) << 16));
    	}
    	
        return (int)((toInt(_data[_position++]) << 16) | (toInt(_data[_position++]) << 8) | toInt(_data[_position++]));
    }

    /// <summary>
    /// 读取用8位或16位表示的数字。
    /// </summary>
    /// <returns></returns>
    public int readInt8or16()
    {
    	if(order() == ByteOrder.LITTLE_ENDIAN){
        	int[] values=readInt8or16LittleEndian(_data, _position);
            _position=values[0];
            return values[1];
    	}
    	int[] values=readInt8or16(_data, _position);
        _position=values[0];
        return values[1];
    }

    /// <summary>
    /// 读取用16位或32位表示的数字。
    /// </summary>
    /// <returns></returns>
    public int readInt16or32()
    {
    	if ((_position + 2) > length())
        {
            _position = length();
            return 0;
        }

    	if(order() == ByteOrder.LITTLE_ENDIAN){
    		int lowW = (int)(toInt(_data[_position++]) | (toInt(_data[_position++]) << 8));
            if ((_position + 2) > length())
            {
                _position = length();
                return lowW;
            }
            return toInt(_data[_position++]) << 16 | toInt(_data[_position++]) << 24 | lowW;
    	}
    	
        int highWord = (int)((toInt(_data[_position++]) << 8) | toInt(_data[_position++]));
        if ((highWord >> 15) == 0) return highWord;

        if ((_position + 2) > length())
        {
            _position = length();
            return highWord;
        }

        return (int)((highWord << 16) | (toInt(_data[_position++]) << 8) | toInt(_data[_position++]));
    }

    public boolean readBoolean()
    {
        if ((_position + 1) > length())
        {
            _position = length();
            return false;
        }

        return (toInt(_data[_position++]) != 0);
    }

    public String readString()
    {
        int len;
        if(this.stringLengthByte == 3){
        	len = readInt24();
        }else if(this.stringLengthByte == 4){
        	len = readInt32();
        }else if(this.stringLengthByte == 2){
        	len = readInt16();
        }else if(this.stringLengthByte == 1){
        	return readShortString();
        }else{
        	len = readInt24();
        }
        byte[] buffer = readBytes((int)len);
        try{
        	return new String(buffer,"UTF-8");
        } catch(Exception ex){
        	ex.printStackTrace();
        	return "";
        }
    }

    public String readShortString()
    {
        short len = readByte();        
        byte[] buffer = readBytes(len);
        try{
            return new String(buffer,"UTF-8");
            } catch(Exception ex){
            	return "";
            }
    }

    public byte[] readBytes()
    {
        if (_position >= length())
            return null;

        byte[] r = Arrays.copyOfRange(_data, _position, length());
        _position = length();
        return r;
    }

    public byte[] readBytes(int n){
        if ((_position + n) > length()){
            _position = length();
            return null;
        }

        byte[] r =Arrays.copyOfRange(_data, _position, _position+n);
        _position += n;
        return r;
    }
    
    public int readBytes(byte[] data){
    	int n = data.length;
    	if(eof()){
    		return 0;
    	}
    	
        if ((_position + n) >= length()){
        	int len = readableBytes();
            System.arraycopy(_data, _position, data, 0, len);
            _position = length();
            return len;
        }
        
        System.arraycopy(_data, _position, data, 0, n);
        _position += n;
        
        return n;
    }
    
    public float readFloat(){
    	int n = readInt32();
    	return Float.intBitsToFloat(n);
    }
    
    public double readDouble(){
    	long n = readLong();
    	return Double.longBitsToDouble(n);
    }
    

    public int getPosition()
    {
        return this._position;
    }
    
    public byte currentByte(){
    	if(eof()){
    		return -1;
    	}
    	return this._data[getPosition()];
    }

    /**
     * 读取用8位或16位表示的数字。
     * @param srcBytes 字节数组
     * @param offsetIndex 起始偏移坐标
     * @return 第0个:新的偏移坐标,第1个:读到的值
     */
    private static int[] readInt8or16(byte[] srcBytes, int offsetIndex)
    {
    	int readValue=0;    	
        if ((offsetIndex + 1) > srcBytes.length)
        {
            readValue = 0;
            offsetIndex = srcBytes.length;
            return new int[]{offsetIndex,readValue};
        }

        int highByte = toInt(srcBytes[offsetIndex++]);
        if ((highByte >> 7) == 0)
        {
            readValue = highByte;
            return new int[]{offsetIndex,readValue};
        }

        if ((offsetIndex + 1) > srcBytes.length)
        {
            readValue = highByte;
            offsetIndex = srcBytes.length;
            return new int[]{offsetIndex,readValue};
        }

        readValue = (int)((highByte << 8) | toInt(srcBytes[offsetIndex++]));
        return new int[]{offsetIndex,readValue};
    }
    
    public int readableBytes(){
    	return length() - _position;
    }
    
    public void reset(){
        _position = 0;
    }
    
    private static int[] readInt8or16LittleEndian(byte[] srcBytes, int offsetIndex)
    {
    	int readValue=0;    	
        if ((offsetIndex + 1) > srcBytes.length)
        {
            readValue = 0;
            offsetIndex = srcBytes.length;
            return new int[]{offsetIndex,readValue};
        }

        int lowByte = toInt(srcBytes[offsetIndex++]);

        if ((offsetIndex + 1) > srcBytes.length)
        {
            readValue = lowByte;
            offsetIndex = srcBytes.length;
            return new int[]{offsetIndex,readValue};
        }

        readValue = (int)(lowByte | toInt(srcBytes[offsetIndex++]) << 8);
        return new int[]{offsetIndex,readValue};
    }
    
    public static int toInt(byte value){
    	return value & 0xFF;
    }
    
}
