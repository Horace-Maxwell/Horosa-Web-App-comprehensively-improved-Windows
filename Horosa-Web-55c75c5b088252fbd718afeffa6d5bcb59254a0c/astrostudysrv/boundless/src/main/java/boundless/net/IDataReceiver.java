package boundless.net;

/**
 * 数据接收者
 * @author Administrator
 *
 */
public interface IDataReceiver {
	/**
	 * 获得接收者会话ID
	 * @return
	 */
    int connectionId();

    /**
     * 获得接收者对象
     * @return
     */
    Object receiver();
}
