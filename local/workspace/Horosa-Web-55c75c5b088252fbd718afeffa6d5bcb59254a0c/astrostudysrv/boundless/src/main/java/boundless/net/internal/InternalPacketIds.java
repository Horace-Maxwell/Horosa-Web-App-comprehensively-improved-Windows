package boundless.net.internal;

/**
 * 内部包编号列表
 *
 */
public final class InternalPacketIds
{
    /**
     * 已使用的包编号的最小值
     */
    public static final int MIN_VALUE = 100;

    /**
     * 内部服务器开始向另一台内部服务器注册为远程机器
     */
    public static final int BEGIN_REGISTER_REMOTE = MIN_VALUE;

    /**
     * 内部服务器正在向另一台内部服务器注册为远程机器
     */
    public static final int DOING_REGISTER_REMOTE = BEGIN_REGISTER_REMOTE+1;

    /**
     * 内部服务器完成向另一台内部服务器注册为远程机器
     */
    public static final int END_REGISTER_REMOTE = DOING_REGISTER_REMOTE + 1;

    /**
     * 作为交互包的载体。目的是：客户端产生的包编号有时候会与系统保留的包编号冲突，例如0号包，此时有此包编号产生内部包，作为交互包的载体
     */
    public static final int COMMUNICATION_CARRIER = END_REGISTER_REMOTE + 1;

    /**
     * 已使用的包编号的最大值
     */
    public static final int MAX_VALUE = COMMUNICATION_CARRIER;
}