package boundless.net.security;

import boundless.net.*;
import boundless.net.external.*;

/**
 * 包不存在
 *
 */
class PacketNotFoundPrevention extends ErrorPrevention<ErrorData>
{
    public PacketNotFoundPrevention(TcpServer server)
    {
    	super(server);
        EventCenter.<PacketReader>subscribePacketNotFound((client,args)->{
        	error(client,args);
        });
    }

    @Override
    protected ErrorData newError(TcpChannel<PacketReader> client)
    {
        return new ErrorData();
    }

    @Override
    protected String errorHeader(ErrorData error)
    {
        return "包不存在,id:"+((IPacketReader)error.lastValue()).packetId();
    }
}
