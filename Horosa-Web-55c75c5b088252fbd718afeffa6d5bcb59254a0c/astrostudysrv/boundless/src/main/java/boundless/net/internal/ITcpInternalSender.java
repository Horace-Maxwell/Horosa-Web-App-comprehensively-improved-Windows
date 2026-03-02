package boundless.net.internal;

import boundless.function.*;
import boundless.net.external.*;

/**
 * 内部数据包发送器
 *
 */
public interface ITcpInternalSender
{
	/**
	 * 使用单通道发送数据
	 * @param ipw
	 * @param callback 回调方法。会在调用者的线程里执行
	 * @param timeoutCallback
	 */
    void sendAsync(InternalPacketWriter ipw, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> callback, Consumer0 timeoutCallback);

    /**
     * 使用单通道发送数据
     * @param ipw
     */
    void sendAsync(InternalPacketWriter ipw);
}
