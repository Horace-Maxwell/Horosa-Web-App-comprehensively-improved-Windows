package boundless.net.security;

import boundless.net.*;
import boundless.net.external.*;

/**
 * 会话错误，即未登陆但发送登陆后才会发送的包
 *
 */
class SessionErrorPrevention extends ErrorPrevention<ErrorData>
{
    public SessionErrorPrevention(TcpServer server)
    {
    	super(server);
        EventCenter.<PacketReader>subscribeSessionError((client,args)->{
        	error(client,args);
        });
    }

    @Override
    protected ErrorData newError(TcpChannel<PacketReader> client)
    {
        return new ErrorData();
    }

    protected String errorHeader(ErrorData error)
    {
        return "会话错误";
    }
}