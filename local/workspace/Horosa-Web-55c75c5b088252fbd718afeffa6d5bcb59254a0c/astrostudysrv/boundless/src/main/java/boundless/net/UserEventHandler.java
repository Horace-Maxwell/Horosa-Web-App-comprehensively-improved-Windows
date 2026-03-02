package boundless.net;

/**
 * 用户事件处理方法
 *
 * @param <T_PacketReader>
 */
public interface UserEventHandler<T_PacketReader extends IPacketReader> {
	/**
	 * 事件处理方法
	 * @param client
	 * @param args 参数
	 */
	void handle(TcpChannel<T_PacketReader> client,Object args);
}
