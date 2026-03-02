package boundless.net.security;

import java.util.*;

import boundless.net.*;
import boundless.net.external.*;
import boundless.threading.*;

public abstract class ErrorPrevention<T_ErrorData extends ErrorData> implements ITicker
{
protected int ERROR_COUNT = 3;
protected Hashtable<Integer, T_ErrorData> _userConnections = new Hashtable<Integer, T_ErrorData>();
protected TcpServer _server;

public ErrorPrevention(TcpServer server)
{
    server.addOnDisconnect((client)->{
    	clearError(client.connectionId());
    });
    this._server = server;
}

protected void error(TcpChannel<PacketReader> client,Object args)
{
    T_ErrorData error = null;
    if (!_userConnections.containsKey(client.connectionId()))
    {
        error = newError(client);
        error.client(client);
        error.errorCount(1);
        error.lastValue(args);
        _userConnections.put(client.connectionId(),error);
        return;
    }
    else
    {
        error = _userConnections.get(client.connectionId());
        error.errorCount(error.errorCount()+1);
        error.lastValue(args);
        error(error);
    }
}

/**
 * 发生错误。第2次之后发生错误时调用，包含第2次
 * @param error
 */
protected void error(T_ErrorData error)
{
}

/**
 * 实例化错误数据对象。第1次发生错误是调用
 * @param client
 * @return
 */
protected abstract T_ErrorData newError(TcpChannel<PacketReader> client);


/**
 * 清除错误
 * @param connectionId 连接代码
 */
protected void clearError(int connectionId)
{
    if (!_userConnections.containsKey(connectionId))
        return;

    _userConnections.remove(connectionId);
}

public void tick()
{
	Enumeration<T_ErrorData> enumeration=_userConnections.elements();
	while (enumeration.hasMoreElements()){
		T_ErrorData item=enumeration.nextElement();
		if (item.errorCount() >= ERROR_COUNT)
        {
            String clientMsg = clientMessage(item.client());
            SecurityPrevention.logger(_server).writeLog(errorHeader(item) + ",client ip:" + item.client().address() + (clientMsg == "" ? "" : "\r\n" + clientMsg));
            item.client().close();
        }
	}
}

/**
 * 获得错误头
 * @return
 */
protected String errorHeader(T_ErrorData error)
{
    return this.getClass().getName();
}

/**
 * 获得客户端信息
 */
protected String clientMessage(TcpChannel<PacketReader> client)
{
    return client.description();
}
}
