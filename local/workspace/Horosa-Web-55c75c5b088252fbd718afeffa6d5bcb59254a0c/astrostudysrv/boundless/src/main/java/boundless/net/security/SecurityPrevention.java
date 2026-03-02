package boundless.net.security;

import java.util.*;

import boundless.log.*;
import boundless.net.external.*;
import boundless.threading.*;
import boundless.console.ApplicationUtility;
import boundless.io.*;

/**
 * 安全防范
 *
 */
public final class SecurityPrevention
{
    private static HashMap<TcpServer, LoginFailPrevention> _loginFails = new HashMap<TcpServer, LoginFailPrevention>();
    private static HashMap<Object, Logger> _loggers = new HashMap<Object, Logger>();

    /**
     * 建制安全防范
     * @param server
     * @return
     */
    public static ITicker[] build(TcpServer server)
    {
    	String appPath =ApplicationUtility.getAppPath();
        _loggers.put(server,new CircleLogger(FileUtility.combinePath(appPath, "Log/Security/"+server.config().port())));

        List<ITicker> tickers = new ArrayList<ITicker>();

        LoginFailPrevention fail = new LoginFailPrevention(server);
        _loginFails.put(server,fail);
        tickers.add(fail);
        tickers.add(new LoginTimeoutPrevention(server));
        tickers.add(new PacketNotFoundPrevention(server));
        tickers.add(new SessionErrorPrevention(server));
        tickers.add(new CustomizeErrorPrevention(server));
        
        ITicker[] result=new ITicker[tickers.size()];
        tickers.toArray(result);
        return result;
    }

    static LoginFailPrevention getLoginFail(TcpServer server)
    {
        return _loginFails.get(server);
    }

    static Logger logger(TcpServer server)
    {
        return _loggers.get(server);
    }
}