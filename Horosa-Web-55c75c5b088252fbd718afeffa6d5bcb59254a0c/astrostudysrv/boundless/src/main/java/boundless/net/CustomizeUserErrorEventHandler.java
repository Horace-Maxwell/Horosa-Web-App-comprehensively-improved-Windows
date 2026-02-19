package boundless.net;

/**
 * 自定义用户错误事件处理方法
 *
 * @param <T_PacketReader>
 */
public interface CustomizeUserErrorEventHandler<T_PacketReader extends IPacketReader> {
	/**
	 * 事件处理方法
	 * @param errorCode 错误代码
	 * @param client
	 */
	void handle(short errorCode, TcpChannel<T_PacketReader> client);
}
