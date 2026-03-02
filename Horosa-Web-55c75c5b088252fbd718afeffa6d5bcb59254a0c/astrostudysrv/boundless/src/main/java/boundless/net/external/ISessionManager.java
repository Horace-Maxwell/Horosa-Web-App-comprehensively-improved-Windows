package boundless.net.external;

import java.util.function.*;

import boundless.net.*;

/**
 * 客户端会话管理。线程安全s
 *
 * @param <T_PacketReader>
 */
public interface ISessionManager<T_PacketReader extends IPacketReader>
{
	/**
	 * 获得客户端会话
	 * @param connectionId 
	 * @return null表示未登陆
	 */
    ClientSession<T_PacketReader> getSession(int connectionId);

    /**
     * 新增客户端会话
     * @param session
     */
    void addSession(ClientSession<T_PacketReader> session);

    /**
     * 移除客户端会话
     * @param connectionId
     */
    void removeSession(int connectionId);

    /**
     * 注册不需要会话的包编号
     * @param packetId
     */
    void registerUnsessionPacketId(int packetId);

    /**
     * 注销不需要会话的包编号
     * @param packetId
     */
    void unregisterUnsessionPacketId(int packetId);

    /**
     * 验证包编号是否有效
     * @param connectionId
     * @param packetId
     * @return
     */
    boolean validatePacketId(int connectionId, int packetId);

    /**
     * 增加"新增会话"监听器
     * @param handler 参数:会话对象
     */
    void addOnAddSession(Consumer<ClientSession<T_PacketReader>> handler);

    /**
     * 移除"新增会话"监听器
     * @param handler 参数:会话对象
     */
    void removeOnAddSession(Consumer<ClientSession<T_PacketReader>> handler);

    /**
     * 增加"移除会话"监听器
     * @param handler 参数:会话对象
     */
    void addOnRemoveSession(Consumer<ClientSession<T_PacketReader>> handler);

    /**
     * 移除"移除会话"监听器
     * @param handler 参数:会话对象
     */
    void removeOnRemoveSession(Consumer<ClientSession<T_PacketReader>> handler);

    /**
     * 获得所有的会话对象
     * @return
     */
    ClientSession<T_PacketReader>[] sessions();
}
