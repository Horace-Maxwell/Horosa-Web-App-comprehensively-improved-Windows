package boundless.net.internal;

import boundless.net.*;

/**
 * 内部包发送者
 *
 */
public interface IInternalPacketSender {
	void send(IDataReceiver receiver, InternalPacketWriter ipw);
}
