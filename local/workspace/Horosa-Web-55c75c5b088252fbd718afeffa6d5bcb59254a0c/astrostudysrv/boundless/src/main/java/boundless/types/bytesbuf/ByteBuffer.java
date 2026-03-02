package boundless.types.bytesbuf;

public class ByteBuffer implements ByteBuf {
	private static final int DEFAULT_CAPACITY = 102400;
	
	private byte[] buf;
	
	private int writePos = 0;
	private int readPos = 0;
	
	public ByteBuffer(){
		this(DEFAULT_CAPACITY);
	}
	
	public ByteBuffer(int length){
		buf = new byte[length];
	}
	
	public ByteBuffer(byte[] raw){
		this(raw.length);
		System.arraycopy(raw, 0, buf, 0, raw.length);
	}
	
	synchronized public int addBytes(byte[] data){
		if(data.length == 0){
			return readableBytes();
		}
		
		int avail = buf.length - readableBytes();
		if(avail <= data.length){
			byte[] raw = new byte[buf.length + data.length];
			if(writePos == readPos){
				System.arraycopy(data, 0, raw, 0, data.length);
			}else if(writePos > readPos){
				int len = writePos - readPos;
				System.arraycopy(buf, readPos, raw, 0, len);
				System.arraycopy(data, 0, raw, len, data.length);
			}else{
				int len = buf.length - readPos;
				System.arraycopy(buf, readPos, raw, 0, len);
				System.arraycopy(buf, 0, raw, len, writePos);
				len += writePos;
				System.arraycopy(data, 0, raw, len, data.length);
			}
			buf = raw;
			readPos = 0;
			writePos = data.length;
		}else{
			if(writePos == readPos){
				System.arraycopy(data, 0, buf, 0, data.length);
				readPos = 0;
				writePos = data.length;
			}else if(writePos > readPos){
				int leftlen = buf.length - writePos;
				if(leftlen >= data.length){
					System.arraycopy(data, 0, buf, writePos, data.length);
					writePos = (writePos + data.length) % buf.length;
				}else{
					System.arraycopy(data, 0, buf, writePos, leftlen);
					writePos = data.length - leftlen;
					System.arraycopy(data, leftlen, buf, 0, writePos);
				}
			}else{
				System.arraycopy(data, 0, buf, writePos, data.length);
				writePos += data.length;
			}
		}
		return readableBytes();
	}
	
	synchronized public int capacity(){
		return buf.length;
	}

	@Override
	synchronized public int readableBytes() {
		if(writePos == readPos){
			return 0;
		}
		if(writePos > readPos){
			return writePos - readPos;
		}
		return buf.length - readPos + writePos;
	}

	@Override
	synchronized public byte getByte(int index) {
		int readabledata = readableBytes();
		if(readabledata < 1){
			throw new BufferNoDataException();
		}
		if(index < 0 || index >= readabledata){
			throw new IndexOutOfBoundsException();
		}
		int idx = (readPos + index) % buf.length;
		return buf[idx];
	}

	@Override
	synchronized public byte readByte() {
		int readabledata = readableBytes();
		if(readabledata < 1){
			throw new BufferNoDataException();
		}
		byte d = buf[readPos];
		readPos = (readPos + 1) % buf.length;
		return d;
	}

	@Override
	synchronized public ByteBuf discardReadBytes() {
		return this;
	}

	synchronized public ByteBuf discardBytes() {
		readPos = writePos = 0;
		return this;
	}

	@Override
	synchronized public ByteBuf getBytes(int index, byte[] dst) {
		int readableData = readableBytes();
		if(readableData < 1){
			throw new BufferNoDataException();
		}
		if(readableData < dst.length || index < 0 || index >= readableData || (readableData-index) < dst.length){
			throw new IndexOutOfBoundsException(); 
		}
		
		if(writePos > readPos){
			int idx = readPos + index;
			System.arraycopy(buf, idx, dst, 0, dst.length);
		}else{
			int left = buf.length - readPos;
			int len = left - index;
			if(len > 0){
				readPos += index;
				if(len >= dst.length){
					System.arraycopy(buf, readPos, dst, 0, dst.length);
				}else{
					System.arraycopy(buf, readPos, dst, 0, len);
					System.arraycopy(buf, 0, dst, len, dst.length - len);
					readPos = dst.length - len;
				}
			}else if(len == 0){
				System.arraycopy(buf, 0, dst, 0, dst.length);
				readPos = dst.length;
			}else{
				len = 0 - len;
				System.arraycopy(buf, len, dst, 0, dst.length);
				readPos = len + dst.length;
			}
		}
		return this;
	}

	@Override
	synchronized public ByteBuf readBytes(byte[] dst) {
		int readableData = readableBytes();
		if(readableData < 1){
			throw new BufferNoDataException();
		}
		if(readableData < dst.length){
			throw new IndexOutOfBoundsException(); 
		}
		
		if(writePos > readPos){
			System.arraycopy(buf, readPos, dst, 0, dst.length);
			readPos += dst.length;
		}else{
			int left = buf.length - readPos;
			if(left >= dst.length){
				System.arraycopy(buf, readPos, dst, 0, dst.length);
				readPos = (readPos + dst.length) % buf.length;
			}else{
				System.arraycopy(buf, readPos, dst, 0, left);
				int len = dst.length - left;
				System.arraycopy(buf, 0, dst, left, len);
				readPos = len;
			}
		}
		return this;
	}

	@Override
	synchronized public ByteBuf skipBytes(int n) {
		if(readPos == writePos){
			return this;
		}
		if(readPos < writePos){
			readPos += n;
			if(readPos >= writePos){
				readPos = writePos = 0;
			}
		}else{
			int left = buf.length - readPos;
			if(left >= n){
				readPos = (readPos + n) % buf.length;
			}else{
				n -= left;
				readPos = n;
				if(readPos >= writePos){
					readPos = writePos = 0;
				}
			}
		}
		return this;
	}

}
