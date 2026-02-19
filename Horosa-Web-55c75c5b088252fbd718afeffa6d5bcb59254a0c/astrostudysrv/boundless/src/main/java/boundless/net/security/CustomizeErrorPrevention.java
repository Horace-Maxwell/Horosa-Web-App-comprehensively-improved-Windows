package boundless.net.security;

import java.util.Hashtable;

import boundless.net.*;
import boundless.net.external.*;

/**
 * 自定义错误
 *
 */
class CustomizeErrorPrevention extends ErrorPrevention<ErrorData>
{
    private Hashtable<Short, CustomizeErrorPrevention> _errors = new Hashtable<Short, CustomizeErrorPrevention>();
    private short _errorCode;
    
    public CustomizeErrorPrevention(TcpServer server)
    {
    	super(server);
        EventCenter.<PacketReader>subscribeCustomizeUserError((errorCode,client)->{
        	customizeError(errorCode,client);
        });
    }

    private CustomizeErrorPrevention(short errorCode,TcpServer server)
    {
    	super(server);
        this._errorCode = errorCode;
    }

    @Override
    protected ErrorData newError(TcpChannel<PacketReader> client)
    {
        return new ErrorData();
    }

    private void customizeError(short errorCode, TcpChannel<PacketReader> client)
    {
        CustomizeErrorPrevention item=_errors.get(errorCode);
        if (item==null)
        {
            item = new CustomizeErrorPrevention(errorCode,_server);
            _errors.put(errorCode,item);
        }
        item.error(client,null);
    }

    @Override
    protected String errorHeader(ErrorData error)
    {
        return "自定义错误("+_errorCode+")";
    }
}