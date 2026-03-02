package boundless.net.internal;

/**
 * 服务器相关信息
 *
 */
public interface IClientConfiguration
{
    /**
     * 获得服务器编号
     * @return
     */
    short serverId();

    /**
     * 获得服务器名称
     * @return
     */
    String serverName();

    /**
     * 获得服务器类型
     * @return
     */
    byte serverType();

    /**
     * 获得服务器监听地址
     * @return
     */
    String serverAddress();
    
    int serverAddressNum();
    
    long serverNum();

    /**
     * 获得服务器监听端口
     * @return
     */
    int port();

    /**
     * 获得是否跟踪包
     * @return
     */
    boolean trackPacket();
    IClientConfiguration trackPacket(boolean value);
}
