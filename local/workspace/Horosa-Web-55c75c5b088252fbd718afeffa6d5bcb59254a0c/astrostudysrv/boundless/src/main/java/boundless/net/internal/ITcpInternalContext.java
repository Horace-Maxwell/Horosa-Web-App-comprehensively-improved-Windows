package boundless.net.internal;

import boundless.net.*;
import boundless.net.external.PacketHandler;
import boundless.function.*;

public interface ITcpInternalContext extends ITcpContext<InternalPacketReader>
{
     void sendAsync(IDataReceiver receiver, InternalPacketWriter ipw, IInternalPacketSender sender, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> callback, Consumer0 timeoutCallback);
}
