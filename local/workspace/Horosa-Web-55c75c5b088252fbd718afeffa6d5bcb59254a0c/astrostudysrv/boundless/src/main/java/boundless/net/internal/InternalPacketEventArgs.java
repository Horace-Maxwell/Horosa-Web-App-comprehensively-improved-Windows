package boundless.net.internal;

import boundless.net.*;
import boundless.net.external.*;

/**
 * 内部包环境。装入一个完整的Socket请求包信息
 *
 */
public class InternalPacketEventArgs extends GenericPacketEventArgs<InternalPacketReader, TcpInternalChannel>
{
    protected InternalPacketEventArgs(InternalPacketReader reader,TcpInternalChannel client)
    {
    	super(reader,client);
    }

    @Override
    protected IDataReceiver createDataReceiver()
    {
        return new DataReceiverInfo();
    }

    public class DataReceiverInfo implements IDataReceiver
    {
        public int connectionId()
        {
            return reader().connectionId();
        }

        public Object receiver()
        {
            return InternalPacketEventArgs.this;
        }
    }
}