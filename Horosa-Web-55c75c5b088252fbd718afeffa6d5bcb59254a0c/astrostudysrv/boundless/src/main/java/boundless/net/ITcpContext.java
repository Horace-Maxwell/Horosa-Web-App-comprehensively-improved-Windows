package boundless.net;

import boundless.log.*;

public interface ITcpContext<T_PacketReader extends IPacketReader> {
	/**
	 * 是否跟踪包
	 * @return
	 */
    boolean trackPacket();

    /**
     * 获得写日志的日志对象
     */
    Logger logger();

    /**
     * 获得写网络错误日志的日志对象
     * @return
     */
    Logger networkErrorLogger();

    /**
     * 获得操时时间，单位秒
     */
    int timeoutSeconds();
}
