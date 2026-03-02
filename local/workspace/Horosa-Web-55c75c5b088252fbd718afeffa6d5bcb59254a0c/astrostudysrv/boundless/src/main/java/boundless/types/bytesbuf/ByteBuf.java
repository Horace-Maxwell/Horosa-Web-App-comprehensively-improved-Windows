package boundless.types.bytesbuf;

public interface ByteBuf {
	public int readableBytes();
	public byte getByte(int index);
	public byte readByte();
	public ByteBuf discardReadBytes();
	public ByteBuf getBytes(int index, byte[] dst);
	public ByteBuf readBytes(byte[] dst);
	public ByteBuf skipBytes(int n);
}
