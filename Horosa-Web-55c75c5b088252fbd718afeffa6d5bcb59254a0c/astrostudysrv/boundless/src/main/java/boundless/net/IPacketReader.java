package boundless.net;

/**
 * 包读取器
 * @author Administrator
 *
 */
public interface IPacketReader {
	/**
	 * 获得包编号
	 * @return
	 */
    int packetId();

    /**
     * 获得包输入数据
     * @return
     */
    byte[] inputData();

    /**
     * 重置
     */
    void reset();

    /**
     * 获得包类型
     */
    int packetType();

    /**
     * 获时得回调编号，当包类型为请求或响应包才有效
     */
    short responseId();
    
    /**
     * 获得长度
     * @return
     */
    int length();
}
