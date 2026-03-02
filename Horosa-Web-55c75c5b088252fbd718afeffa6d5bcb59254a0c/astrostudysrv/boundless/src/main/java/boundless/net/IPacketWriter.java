package boundless.net;

/**
 * 包写入器
 * @author Administrator
 *
 */
public interface IPacketWriter {
	/**
	 * 获得包编号
	 * @return
	 */
    int packetId();

    /**
     * 获得包类型
     */
    int packetType();

    /**
     * 获时得回调编号，当包类型为请求或响应包才有效
     */
    short responseId();

    /**
     * 获得包输出数据
     * @return
     */
    byte[] outputData();

    /**
     * 获得包输出数据的长度
     * @return
     */
    int length();

    /**
     * 导入读取器里的数据
     * @param reader
     */
    void load(IPacketReader reader);

    /**
     * 是否溢出
     * @param addLength 要再加入的长度
     * @return true:溢出
     */
    boolean overflow(int addLength);
}
